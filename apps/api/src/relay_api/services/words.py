"""Small pieces of English that several screens and notices share, so a time or a count reads the same
everywhere: "9:12 PM", "6 rice and dhal cases", "Dry-box truck"."""

from __future__ import annotations

from datetime import datetime, timedelta

from relay_api.clock import COLOMBO


def clock(moment: datetime) -> str:
    local = moment.astimezone(COLOMBO)
    hour = local.hour % 12 or 12
    return f"{hour}:{local.minute:02d} {'AM' if local.hour < 12 else 'PM'}"


def round5(moment: datetime) -> datetime:
    """Drivers and stores read expected times to 5 minutes ("around 6:25 AM"); the dispatcher reads the minute."""
    local = moment.astimezone(COLOMBO)
    minutes = round((local.hour * 60 + local.minute + local.second / 60) / 5) * 5
    return local.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(minutes=minutes)


def cases(name: str, qty: int) -> str:
    """cases('Rice and dhal case', 6) is '6 rice and dhal cases'."""
    lower = name[:1].lower() + name[1:]
    if qty != 1:
        lower = f"{lower}es" if lower.endswith("box") else f"{lower}s"
    return f"{qty} {lower}"


def short_case_name(name: str) -> str:
    """The loader's short name: 'Rice and dhal case' is 'Rice and dhal'."""
    for suffix in (" case", " crate", " box", " carton"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


def vehicle_kind(vehicle_type: str, temp: str) -> str:
    if temp == "reefer":
        return f"Refrigerated {vehicle_type}"
    return "Dry-box truck" if vehicle_type == "truck" else "Ambient van"


def load_kind(brand: str, temp: str) -> str:
    """How the dock names a load: Dry or Chilled for Fresh, the brand otherwise."""
    if brand == "Fresh":
        return "Chilled" if temp == "chilled" else "Dry"
    return brand


def initials(display_name: str) -> str:
    parts = display_name.split()
    return (parts[0][:1] + (parts[-1][:1] if len(parts) > 1 else "")).upper()


def window(open_hhmm: str, close_hhmm: str) -> str:
    """window('04:00', '07:45') is '4:00 to 7:45 AM'; the AM or PM is written once when both ends share it."""

    def ampm(hhmm: str) -> str:
        hour, minute = int(hhmm[:2]), int(hhmm[3:5])
        return f"{hour % 12 or 12}:{minute:02d} {'AM' if hour < 12 else 'PM'}"

    a, b = ampm(open_hhmm), ampm(close_hhmm)
    return f"{a[:-3]} to {b}" if a[-2:] == b[-2:] else f"{a} to {b}"
