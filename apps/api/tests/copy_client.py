"""A private copy of the story day, driven through the API the way the web app drives it."""

from __future__ import annotations

from typing import Any

PASSWORD = "relay2026"
PINS = {"rizwan": "2580", "suresh": "4826", "anjali": "1357", "kasun": "3690"}


class Copy:
    """One private copy of the story day, driven through the API the way the web app drives it: every request
    names the role it acts as, and every change carries the X-Relay-Client header."""

    def __init__(self, client: Any) -> None:
        self.client = client
        response = client.post("/api/demo/workspaces")
        response.raise_for_status()
        self.code = response.json()["workspace"]["code"]

    def sign_in(self, username: str, role: str) -> None:
        if role == "loader":
            response = self.client.post("/api/auth/pin", json={"username": username, "pin": PINS[username]})
        else:
            response = self.client.post("/api/auth/login", json={"username": username, "password": PASSWORD})
        response.raise_for_status()

    def get(self, path: str, role: str | None = None) -> Any:
        response = self.client.get(path, headers={"X-Relay-Role": role} if role else {})
        response.raise_for_status()
        return response.json()

    def post(self, path: str, body: object = None, role: str | None = None, expect: int = 200) -> Any:
        response = self.client.post(path, json=body or {}, headers={"X-Relay-Role": role} if role else {})
        assert response.status_code == expect, response.text
        return response.json() if response.content else None

    def delete(self, path: str, role: str | None = None) -> Any:
        response = self.client.delete(path, headers={"X-Relay-Role": role} if role else {})
        response.raise_for_status()
        return response.json()

    def jump(self, moment: str) -> Any:
        return self.post("/api/demo/clock", {"action": "jump", "to": moment})

    def advance(self, minutes: int) -> Any:
        return self.post("/api/demo/clock", {"action": "advance", "minutes": minutes})
