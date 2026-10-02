"""Sign-in, sessions and role checks.

A judge usually keeps several roles open side by side in one browser. Each role therefore has its
own session cookie, and the web app names the role it is acting as in the X-Relay-Role header
(EventSource, which cannot send headers, uses ?as=). Signing in as the store manager in one tab
leaves the dispatcher signed in in the next.

Cookies are httpOnly and SameSite=Lax. Every state-changing request must also carry
X-Relay-Client, a custom header that a cross-site form or image cannot send.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from relay_api.config import get_settings
from relay_api.db import get_db
from relay_api.models import AppUser, Role

_hasher = PasswordHasher()

COOKIE_FOR_ROLE = {
    Role.DISPATCHER: "relay_dsp",
    Role.LOADER: "relay_ldr",
    Role.DRIVER: "relay_drv",
    Role.STORE_MANAGER: "relay_stm",
}

CLIENT_HEADER = "X-Relay-Client"
ROLE_HEADER = "X-Relay-Role"


def hash_secret(secret: str) -> str:
    return _hasher.hash(secret)


def verify_secret(secret_hash: str | None, secret: str) -> bool:
    if not secret_hash:
        return False
    try:
        return _hasher.verify(secret_hash, secret)
    except (VerifyMismatchError, InvalidHashError):
        return False


def issue_session(response: Response, user: AppUser) -> None:
    settings = get_settings()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "role": user.role.value,
            "iat": now,
            "exp": now + timedelta(hours=settings.session_hours),
        },
        settings.secret_key,
        algorithm="HS256",
    )
    response.set_cookie(
        COOKIE_FOR_ROLE[user.role],
        token,
        max_age=settings.session_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session(response: Response, role: Role) -> None:
    response.delete_cookie(COOKIE_FOR_ROLE[role], path="/")


def acting_role(request: Request) -> Role:
    raw = request.headers.get(ROLE_HEADER) or request.query_params.get("as")
    try:
        return Role(raw) if raw else Role.DISPATCHER
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown role") from exc


def current_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> AppUser:
    role = acting_role(request)
    token = request.cookies.get(COOKIE_FOR_ROLE[role])
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    try:
        claims = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired") from exc
    user = db.get(AppUser, uuid.UUID(claims["sub"]))
    if user is None or user.role != role:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


CurrentUser = Annotated[AppUser, Depends(current_user)]


def require(*roles: Role) -> Callable[[AppUser], AppUser]:
    """Dependency that lets only the given roles through."""

    def check(user: CurrentUser) -> AppUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This screen is for another role")
        return user

    return check


async def require_client_header(request: Request) -> None:
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and CLIENT_HEADER not in request.headers:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing client header")
