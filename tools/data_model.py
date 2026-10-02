"""Write docs/data-model.md from the SQLAlchemy models, so the document can never drift from the schema.

    uv run python tools/data_model.py

Each table gets its docstring, its columns (type, key, nullability, docstring) and its relationships, and one
Mermaid ER diagram per area shows how the tables connect.
"""

from __future__ import annotations

import inspect
from collections import defaultdict
from pathlib import Path

from sqlalchemy import Table

from relay_api.models import Base, WorkspaceScoped

OUT = Path(__file__).resolve().parents[1] / "docs" / "data-model.md"

AREAS = {
    "reference": "The network: the organizers' reference tables and what Relay learned from the route history",
    "people": "People and sign-in",
    "workspace": "Copies of the day, the scenario clock and the audit trail",
    "orders": "Orders",
    "planning": "Plans, trips, stops, deferrals and changes after publishing",
    "dock": "The dock: loading lines, shortfalls and the handover",
    "field": "What drivers record on the road",
    "store": "What stores confirm",
    "comms": "Notices and the dispatcher's feed",
}


def _area(model: type) -> str:
    return model.__module__.rsplit(".", 1)[-1]


def _type(column) -> str:  # type: ignore[no-untyped-def]
    try:
        text = str(column.type)
    except Exception:
        text = column.type.__class__.__name__
    return text.split("(")[0].lower().replace(" ", "_")


def _doc(model: type, name: str) -> str:
    source = inspect.getsource(model)
    marker = f"    {name}:"
    lines = source.splitlines()
    for i, line in enumerate(lines):
        if line.startswith(marker):
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith('"""') and lines[j].startswith("        "):
                j += 1
            if j < len(lines) and lines[j].strip().startswith('"""'):
                text = lines[j].strip().strip('"')
                k = j
                while not lines[k].rstrip().endswith('"""') or (k == j and lines[k].strip() == '"""'):
                    k += 1
                    text += " " + lines[k].strip().strip('"')
                return " ".join(text.split())
            return ""
    return ""


def main() -> None:
    order = list(AREAS)
    models = sorted((m.class_ for m in Base.registry.mappers), key=lambda m: (order.index(_area(m)), m.__tablename__))
    by_area: dict[str, list[type]] = defaultdict(list)
    for model in models:
        by_area[_area(model)].append(model)

    out = [
        "# Data model",
        "",
        "Generated from the SQLAlchemy models by `tools/data_model.py`; do not edit by hand.",
        "",
        "Every table marked **per copy** belongs to one copy of the delivery day (a workspace) and carries a",
        "`workspace_id`. One ORM hook in `relay_api/db.py` adds `workspace_id = :id` to every query on those",
        "tables, so no endpoint can read another copy by forgetting a filter. Reference tables, people and the",
        "engine cache are shared by every copy.",
        "",
    ]
    for area, title in AREAS.items():
        members = by_area.get(area, [])
        if not members:
            continue
        out += [f"## {title}", "", "```mermaid", "erDiagram"]
        names = {m.__tablename__ for m in members}
        edges = set()
        for model in members:
            table: Table = model.__table__  # type: ignore[attr-defined]
            for column in table.columns:
                for fk in column.foreign_keys:
                    target = fk.column.table.name
                    if target == "workspace":
                        continue
                    if target in names or target in {m.__tablename__ for m in models}:
                        edges.add((target, table.name, column.name))
        for target, source, column in sorted(edges):
            out.append(f'    {target} ||--o{{ {source} : "{column}"')
        for model in members:
            table = model.__table__  # type: ignore[attr-defined]
            out.append(f"    {table.name} {{")
            for column in table.columns:
                if column.name == "workspace_id":
                    continue
                key = " PK" if column.primary_key else " FK" if column.foreign_keys else ""
                out.append(f"        {_type(column)} {column.name}{key}")
            out.append("    }")
        out += ["```", ""]
        for model in members:
            table = model.__table__  # type: ignore[attr-defined]
            scoped = issubclass(model, WorkspaceScoped)
            doc = " ".join((inspect.getdoc(model) or "").split())
            out += [f"### `{table.name}`{' (per copy)' if scoped else ''}", ""]
            if doc and not doc.startswith(model.__name__ + "("):
                out += [doc, ""]
            out += ["| Column | Type | Notes |", "|---|---|---|"]
            for column in table.columns:
                if column.name == "workspace_id":
                    continue
                notes = []
                if column.primary_key:
                    notes.append("primary key")
                for fk in column.foreign_keys:
                    notes.append(f"references `{fk.column.table.name}.{fk.column.name}`")
                if column.nullable and not column.primary_key:
                    notes.append("optional")
                field_doc = _doc(model, column.key)
                if field_doc:
                    notes.append(field_doc)
                out.append(f"| `{column.name}` | {_type(column)} | {'; '.join(notes)} |")
            out.append("")
    OUT.write_text("\n".join(out), encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(OUT.parents[1])}: {len(models)} tables")


if __name__ == "__main__":
    main()
