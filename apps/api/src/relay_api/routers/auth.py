from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.config import get_settings
from relay_api.db import get_db
from relay_api.models import AppUser, Outlet, Role
from relay_api.schemas.common import Account, Me
from relay_api.security import CurrentUser, acting_role, clear_session, issue_session, verify_secret
from relay_api.seed.reference import read

router = APIRouter(prefix="/api/auth", tags=["auth"])

Db = Annotated[Session, Depends(get_db)]


class PasswordLogin(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class PinLogin(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    pin: str = Field(pattern=r"^\d{4}$")


def _find(db: Session, username: str) -> AppUser | None:
    return db.scalar(select(AppUser).where(AppUser.username == username.strip().lower()))


@router.post("/login", response_model=Me)
def login(body: PasswordLogin, response: Response, db: Db) -> AppUser:
    user = _find(db, body.username)
    if user is None or not verify_secret(user.password_hash, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That username and password did not match.")
    issue_session(response, user)
    return user


@router.post("/pin", response_model=Me)
def pin_login(body: PinLogin, response: Response, db: Db) -> AppUser:
    """The shared dock tablet: pick your name, enter your 4-digit PIN."""
    user = _find(db, body.username)
    if user is None or user.role not in (Role.LOADER, Role.DRIVER) or not verify_secret(user.pin_hash, body.pin):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That PIN did not match. Try again.")
    issue_session(response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response) -> None:
    clear_session(response, acting_role(request))


@router.get("/me", response_model=Me)
def me(user: CurrentUser) -> AppUser:
    return user


class LocaleIn(BaseModel):
    locale: Literal["en", "si", "ta"]


@router.patch("/me", response_model=Me)
def set_locale(body: LocaleIn, user: CurrentUser, db: Db) -> AppUser:
    """Each person's language comes back when they sign in, on any device."""
    user.locale = body.locale
    db.commit()
    return user


@router.get("/accounts", response_model=list[Account])
def accounts(db: Db) -> list[Account]:
    """The four judge accounts, and the other loaders who share the Kandy hub tablet."""
    if not get_settings().demo_mode:
        return []
    users = db.scalars(
        select(AppUser)
        .where((AppUser.judge_account.is_(True)) | (AppUser.role == Role.LOADER))
        .order_by(AppUser.username)
    ).all()
    outlets = {
        o.outlet_id: o
        for o in db.scalars(select(Outlet).where(Outlet.outlet_id.in_([u.outlet_id for u in users if u.outlet_id])))
    }
    order = [Role.DISPATCHER, Role.LOADER, Role.DRIVER, Role.STORE_MANAGER]
    settings = get_settings()
    pins = {r["username"]: r["pin"] for r in read(settings.seed_dir / "story" / "people.csv") if r["pin"]}
    out = []
    for u in sorted(users, key=lambda u: (order.index(u.role), not u.judge_account, u.display_name)):
        detail = {
            Role.DISPATCHER: "Peliyagoda planning office",
            Role.LOADER: f"{u.depot} hub dock",
            Role.DRIVER: f"{u.vehicle_id}, {u.depot} hub",
            Role.STORE_MANAGER: f"{u.outlet_id} {outlets[u.outlet_id].name}" if u.outlet_id in outlets else "",
        }[u.role]
        uses_pin = u.role is Role.LOADER
        hint = f"PIN {pins.get(u.username, '')}" if uses_pin else f"Password {settings.seed_password}"
        out.append(
            Account(
                username=u.username,
                display_name=u.display_name,
                role=u.role,
                detail=detail,
                uses_pin=uses_pin,
                hint=hint,
            )
        )
    return out
