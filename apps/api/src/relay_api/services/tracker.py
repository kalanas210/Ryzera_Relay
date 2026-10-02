"""The store's view of a delivery on its way (STM-04) and its confirmation of what arrived (STM-05).

The tracker reads the same estimate as the dispatcher: while the driver is in contact it shows "around 6:35 AM"; while
the driver's phone is silent it adds the likely range and says plainly that the van has gone quiet, never why. Once
the estimate has passed with no word, the store can confirm receipt itself: that counts as the delivery for every
estimate after it, and if a backup is still on the road to a later stop, the dispatcher is asked whether to keep it.
A store that confirmed can still report a problem with the goods until 4:00 PM on the delivery day.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, time
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import (
    AppUser,
    AuditLog,
    CaseType,
    FieldEvent,
    IssueKind,
    LoadLine,
    Order,
    OrderStatus,
    Photo,
    Plan,
    PlanStatus,
    Proof,
    Receipt,
    ReceiptIssue,
    ReceiptStatus,
    Shortfall,
    Stop,
    StopStatus,
    Trip,
)
from relay_api.services import backup, words
from relay_api.services.dock import Lookup
from relay_api.services.estimates import run_estimate
from relay_api.services.notify import add_feed_item

ISSUES_UNTIL = time(16, 0)
"""A store can report a problem with a delivery until this time on the delivery day."""


class TrackerError(Exception):
    """A receipt Relay cannot take, in words for the store."""


@dataclass
class TrackerStop:
    seq: int
    place: str
    state: str
    """delivered, arrived, last_known, yours, pending"""
    at: datetime | None


@dataclass
class Tracker:
    order_ref: str
    kind: str
    status: str
    """scheduled, on_the_way, arrived, delivered, confirmed, disputed, moved"""
    vehicle_id: str | None
    vehicle_kind: str | None
    driver: str | None
    stop_seq: int | None
    stops_before: int
    expected: datetime | None
    range: tuple[datetime, datetime] | None
    passed: bool
    out_of_contact: bool
    last_heard: datetime | None
    position: str
    window: str
    can_confirm: bool
    planned: datetime | None = None
    """The plan's time for the store's stop: "Planned 5:19 AM"."""
    departed_at: datetime | None = None
    arrived_at: datetime | None = None
    """When the driver recorded arriving at the store."""
    issues_until: datetime | None = None
    """Until when the store can still report a problem with this delivery."""
    on_board: list[dict[str, Any]] = field(default_factory=list)
    stops: list[TrackerStop] = field(default_factory=list)
    proof: dict[str, Any] | None = None
    receipt: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _stop_for(db: Session, order: Order) -> Stop | None:
    """The stop carrying this order on a published plan, so a store never sees a draft: a live backup copy wins over
    the moved original."""
    stops = list(
        db.scalars(
            select(Stop)
            .join(Trip, Trip.id == Stop.trip_id)
            .join(Plan, Plan.id == Trip.plan_id)
            .where(Stop.order_id == order.id, Stop.status != StopStatus.CANCELLED, Plan.status == PlanStatus.PUBLISHED)
        )
    )
    live = [s for s in stops if s.backup_of is not None]
    return live[0] if live else (stops[0] if stops else None)


def issues_until(plan: Plan) -> datetime:
    return datetime.combine(plan.run_date, ISSUES_UNTIL, tzinfo=COLOMBO)


def tracker(db: Session, now: datetime, order: Order) -> Tracker:
    look = Lookup(db)
    outlet = look.outlets[order.outlet_id]
    kind = "chilled" if order.temp == "chilled" else "dry" if order.brand == "Fresh" else order.brand
    stop = _stop_for(db, order)
    receipt = db.scalar(select(Receipt).where(Receipt.order_id == order.id))
    out = Tracker(
        order_ref=order.order_ref,
        kind=kind,
        status="scheduled",
        vehicle_id=None,
        vehicle_kind=None,
        driver=None,
        stop_seq=None,
        stops_before=0,
        expected=None,
        range=None,
        passed=False,
        out_of_contact=False,
        last_heard=None,
        position="",
        window=words.window(outlet.window_open, outlet.window_close),
        can_confirm=False,
    )
    if stop is None:
        return out
    trip = db.get(Trip, stop.trip_id)
    assert trip is not None
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    vehicle = look.vehicles[trip.vehicle_id]
    driver = look.driver_of(trip, plan.run_date)
    estimate = run_estimate(db, trip, now)
    mine = next((e for e in estimate.stops if e.stop_id == stop.id), None)
    out.vehicle_id = trip.vehicle_id
    out.vehicle_kind = words.vehicle_kind(vehicle.type, vehicle.temp)
    out.driver = driver.display_name if driver else None
    out.stop_seq = stop.seq
    out.planned = stop.planned_arrival
    out.departed_at = trip.departed_at
    out.arrived_at = stop.arrived_at
    out.issues_until = issues_until(plan)
    out.out_of_contact = estimate.out_of_contact
    out.last_heard = estimate.last_contact_at
    kind_, where = estimate.position
    to_come = [r for r in sorted(estimate.stops, key=lambda r: r.seq) if not r.done and r.arrived_at is None]
    if kind_ == "unloading" and where and to_come and to_come[0].stop_id == stop.id:
        out.position = "Your store is probably the next stop."  # what the store needs, not where the truck stands
    elif kind_ == "unloading" and where:
        out.position = f"Probably still unloading at {look.outlets[where].short_name}."
    elif kind_ == "on_the_road" and where:
        out.position = (
            "Probably on the road to you."
            if where == order.outlet_id
            else f"Probably on the road to {look.outlets[where].short_name}."
        )
    if mine is not None:
        out.expected = mine.estimate
        out.range = mine.range
        out.passed = mine.passed
    for row in sorted(estimate.stops, key=lambda r: r.seq):
        if row.seq > stop.seq and stop.backup_of is None:
            break
        if row.stop_id == stop.id:
            out.stops.append(
                TrackerStop(row.seq, look.outlets[row.outlet_id].short_name, "yours", mine.estimate if mine else None)
            )
        elif row.done:
            out.stops.append(
                TrackerStop(
                    row.seq, look.outlets[row.outlet_id].short_name, "delivered", row.delivered_at or row.receipt_at
                )
            )
        elif row.arrived_at is not None:
            out.stops.append(TrackerStop(row.seq, look.outlets[row.outlet_id].short_name, "arrived", row.arrived_at))
        else:
            out.stops.append(TrackerStop(row.seq, look.outlets[row.outlet_id].short_name, "pending", row.estimate))
    out.stops_before = sum(1 for s in out.stops if s.state in ("pending", "arrived") and s.seq < stop.seq)

    types = {c.code: c for c in db.scalars(select(CaseType))}
    for line in db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id).order_by(LoadLine.load_order)):
        shortfall = db.scalar(select(Shortfall).where(Shortfall.load_line_id == line.id))
        out.on_board.append(
            {
                "case_type": line.case_type,
                "name": words.short_case_name(types[line.case_type].name),
                "ordered": line.planned_qty,
                "on_board": line.loaded_qty if line.loaded_qty or line.status.value != "to_load" else line.planned_qty,
                "short": shortfall.qty if shortfall and shortfall.decision else 0,
                "comes_on": shortfall.added_to_order_ref if shortfall else None,
            }
        )

    proof = db.scalar(select(Proof).where(Proof.stop_id == stop.id))
    if proof is not None:
        event = db.get(FieldEvent, proof.event_id)
        photo = db.get(Photo, proof.photo_id) if proof.photo_id else None
        out.proof = {
            "delivered_at": proof.recorded_at,
            "receiver": proof.receiver_name,
            "lines": proof.lines,
            "all_delivered": proof.all_delivered,
            "photo_id": str(photo.id) if photo else None,
            "photo_coming": photo is None and bool(event and event.payload.get("photo_id")),
            "signed": bool(proof.signature_svg),
            "sent_at": event.received_at if event else None,
            "in_window": proof.recorded_at <= _close(plan, outlet),
        }
    if receipt is not None:
        out.receipt = {
            "status": receipt.status.value,
            "confirmed_at": receipt.confirmed_at,
            "before_driver_proof": receipt.before_driver_proof,
            "lines": receipt.lines,
            "issues": [
                {"case_type": i.case_type, "kind": i.kind.value, "qty": i.qty, "note": i.note}
                for i in db.scalars(select(ReceiptIssue).where(ReceiptIssue.receipt_id == receipt.id))
            ],
            "reported_at": max((line["at"] for line in receipt.lines if line.get("at")), default=None),
        }
    if receipt is not None:
        out.status = "confirmed" if receipt.status is ReceiptStatus.CONFIRMED else "disputed"
    elif stop.status is StopStatus.DELIVERED or proof is not None:
        out.status = "delivered"
    elif stop.status is StopStatus.ARRIVED:
        out.status = "arrived"
    elif trip.departed_at is not None:
        out.status = "on_the_way"
    out.can_confirm = receipt is None and (
        out.status in ("delivered", "arrived")
        or (out.status == "on_the_way" and (out.passed or estimate.out_of_contact))
    )
    return out


def _close(plan: Plan, outlet) -> datetime:  # type: ignore[no-untyped-def]
    from relay_api.services import network as adapters

    hh, mm = outlet.window_close.split(":")
    return adapters.at_minutes(plan.run_date, int(hh) * 60 + int(mm))


def confirm_receipt(
    db: Session,
    now: datetime,
    user: AppUser,
    order: Order,
    issues: list[dict[str, Any]],
    client_ref: str | None,
) -> Receipt:
    """The store confirms what arrived, with any missing, damaged or warm cases. Idempotent by client_ref."""
    if client_ref:
        existing = db.scalar(select(Receipt).where(Receipt.client_ref == client_ref))
        if existing is not None:
            return existing
    if db.scalar(select(Receipt).where(Receipt.order_id == order.id)) is not None:
        raise TrackerError("This order is already confirmed.")
    stop = _stop_for(db, order)
    if stop is None:
        raise TrackerError("This order is not on a run yet.")
    trip = db.get(Trip, stop.trip_id)
    if trip is None or trip.departed_at is None:
        raise TrackerError("The delivery has not left the hub yet.")
    types = {c.code: c for c in db.scalars(select(CaseType))}
    clean = _issues(types, issues)
    proof = db.scalar(select(Proof).where(Proof.stop_id == stop.id))
    receipt = Receipt(
        order_id=order.id,
        status=ReceiptStatus.WITH_ISSUES if clean else ReceiptStatus.CONFIRMED,
        confirmed_at=now,
        confirmed_by=user.id,
        before_driver_proof=proof is None,
        lines=[{"case_type": c, "kind": k.value, "qty": q} for c, k, q, _ in clean],
        client_ref=client_ref,
    )
    db.add(receipt)
    db.flush()
    for code, kind, qty, note in clean:
        db.add(ReceiptIssue(receipt_id=receipt.id, case_type=code, kind=kind, qty=qty, note=note))
    order.status = OrderStatus.DISPUTED if clean else OrderStatus.CONFIRMED
    if proof is None:
        backup.receipt_question(db, now, stop, now)
    if clean:
        _dispute(db, now, order, trip, receipt, types, clean)
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id,
            actor_label=user.display_name,
            action="receipt.confirmed",
            entity="order",
            entity_id=order.order_ref,
            summary=f"{order.order_ref} receipt confirmed" + (f" with {len(clean)} issues" if clean else ""),
        )
    )
    return receipt


Issue = tuple[str, IssueKind, int, str]


def _issues(types: dict[str, CaseType], issues: list[dict[str, Any]]) -> list[Issue]:
    clean = []
    for issue in issues:
        code = str(issue.get("case_type"))
        if code not in types:
            raise TrackerError("Choose the case type for each issue.")
        try:
            kind = IssueKind(str(issue.get("kind")))
        except ValueError as exc:
            raise TrackerError("Say what is wrong with each line.") from exc
        qty = int(issue.get("qty", 0))
        if qty < 1:
            raise TrackerError("Say how many cases each issue covers.")
        clean.append((code, kind, qty, str(issue.get("note", ""))[:300]))
    return clean


def _dispute(
    db: Session,
    now: datetime,
    order: Order,
    trip: Trip,
    receipt: Receipt,
    types: dict[str, CaseType],
    clean: list[Issue],
) -> None:
    from relay_api.models import FeedKind

    plan = db.get(Plan, trip.plan_id)
    add_feed_item(
        db,
        now,
        kind=FeedKind.DISPUTE,
        depot=plan.depot if plan else "Kandy",
        title=f"{order.outlet_id} reports {words.cases('case', sum(q for _, _, q, _ in clean))} with issues on "
        f"{order.order_ref}",
        body="; ".join(
            f"{q} {words.short_case_name(types[c].name).lower()} {k.value.replace('_', ' ')}" for c, k, q, _ in clean
        ),
        ref={"order_ref": order.order_ref, "receipt_id": str(receipt.id), "trip_id": str(trip.id)},
    )


def report_issues(
    db: Session, now: datetime, user: AppUser, order: Order, issues: list[dict[str, Any]], client_ref: str
) -> Receipt:
    """A problem the store finds after confirming receipt (a crushed case at the back of the pile), until 4:00 PM on
    the delivery day. Idempotent by client_ref: Try again never reports it twice."""
    receipt = db.scalar(select(Receipt).where(Receipt.order_id == order.id))
    if receipt is None:
        raise TrackerError("Confirm the receipt first.")
    if any(line.get("client_ref") == client_ref for line in receipt.lines):
        return receipt
    stop = _stop_for(db, order)
    trip = db.get(Trip, stop.trip_id) if stop else None
    plan = db.get(Plan, trip.plan_id) if trip else None
    if trip is None or plan is None:
        raise TrackerError("This order is not on a run.")
    if now >= issues_until(plan):
        raise TrackerError(f"Problems with this delivery could be reported until {words.clock(issues_until(plan))}.")
    types = {c.code: c for c in db.scalars(select(CaseType))}
    clean = _issues(types, issues)
    if not clean:
        raise TrackerError("Flag at least one line.")
    for code, kind, qty, note in clean:
        db.add(ReceiptIssue(receipt_id=receipt.id, case_type=code, kind=kind, qty=qty, note=note))
    receipt.lines = [
        *receipt.lines,
        *(
            {"case_type": c, "kind": k.value, "qty": q, "client_ref": client_ref, "at": now.isoformat()}
            for c, k, q, _ in clean
        ),
    ]
    receipt.status = ReceiptStatus.WITH_ISSUES
    order.status = OrderStatus.DISPUTED
    _dispute(db, now, order, trip, receipt, types, clean)
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id,
            actor_label=user.display_name,
            action="receipt.issues",
            entity="order",
            entity_id=order.order_ref,
            summary=f"{order.order_ref}: {len(clean)} issues reported after receipt",
        )
    )
    return receipt
