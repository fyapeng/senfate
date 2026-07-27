"""W07 cross-school comparison engine.

The engine compares only explicit common facts or curated neutral themes. It
never converts school-specific structures into a score and never uses majority
vote. Unknown, conflict, internal mixture and incommensurability are preserved.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

ROOT = Path(__file__).resolve().parents[1]
TOPIC_PATH = ROOT / "ontology/comparison/W07_TOPIC_ONTOLOGY.json"
CROSSWALK_PATH = ROOT / "ontology/comparison/W07_CONCEPT_CROSSWALK.json"

TOPIC_CATALOG = json.loads(TOPIC_PATH.read_text(encoding="utf-8"))
CROSSWALK = json.loads(CROSSWALK_PATH.read_text(encoding="utf-8"))
TOPIC_BY_ID = {row["topic_id"]: row for row in TOPIC_CATALOG["topics"]}
PROFILE_TO_SCHOOL = {
    "classical_ziping.composite@1.1.0": "classical_ziping",
    "classical_ziping.composite@1.1.0": "classical_ziping",
    "shao_weihua.w04@1.0.0": "shao_weihua",
    "li_hanchen.w05@1.0.0": "li_hanchen",
    "duan_li_xiang.w06@1.1.0": "duan_li_xiang",
}


def _predicate(finding: Mapping[str, Any]) -> str:
    return str(finding.get("proposition", {}).get("predicate", ""))


def _profile_id(finding: Mapping[str, Any]) -> str | None:
    attrs = finding.get("attributes", {})
    return attrs.get("school_profile_id") or finding.get("school_profile_id")


def _school_id(finding: Mapping[str, Any], profile_id: str | None) -> str | None:
    attrs = finding.get("attributes", {})
    if attrs.get("school_id"):
        return attrs["school_id"]
    if profile_id in PROFILE_TO_SCHOOL:
        return PROFILE_TO_SCHOOL[profile_id]
    ns = finding.get("namespace", "")
    return ns.split(".", 1)[0] if "." in ns else None


def _longest_mapping(school_id: str | None, predicate: str) -> dict[str, Any] | None:
    candidates = [
        row for row in CROSSWALK["mappings"]
        if row["school_id"] == school_id and predicate.startswith(row["predicate_prefix"])
    ]
    return max(candidates, key=lambda row: len(row["predicate_prefix"])) if candidates else None


def normalize_finding(finding: Mapping[str, Any]) -> dict[str, Any]:
    """Attach W07 comparison metadata without changing the source FindingIR."""
    profile_id = _profile_id(finding)
    school_id = _school_id(finding, profile_id)
    attrs = finding.get("attributes", {})
    mapping = _longest_mapping(school_id, _predicate(finding))

    canonical_topic = attrs.get("canonical_topic")
    concept_family = attrs.get("concept_family")
    reason_family = attrs.get("reason_family")
    role_mode = attrs.get("role_mode")
    if mapping:
        canonical_topic = canonical_topic or mapping["canonical_topic"]
        concept_family = concept_family or mapping["concept_family"]
        reason_family = reason_family or mapping["reason_family"]
        role_mode = role_mode or mapping["role_mode"]

    if not canonical_topic and finding.get("finding_type") in {"structural", "procedural"}:
        canonical_topic = "comparison.structural.framework"
        concept_family = concept_family or f"{school_id or 'unknown'}_unmapped_structural"
        reason_family = reason_family or "unmapped_structural"
        role_mode = role_mode or "structural"

    return {
        "finding": dict(finding),
        "finding_id": finding["finding_id"],
        "profile_id": profile_id,
        "school_id": school_id,
        "canonical_topic": canonical_topic,
        "concept_family": concept_family or "unknown",
        "reason_family": reason_family or "unknown",
        "role_mode": role_mode or "unknown",
    }


def _role(row: Mapping[str, Any]) -> str:
    finding = row["finding"]
    if finding.get("truth") == "unknown" or finding.get("evidence_status") in {"unknown", "incomplete"}:
        return "unknown"
    if row["role_mode"] == "structural":
        return "incommensurable"
    if row["role_mode"] == "presence":
        return "supports" if finding.get("truth") == "true" else "opposes"
    direction = finding.get("direction", "unknown")
    return {
        "supportive": "supports",
        "inhibitory": "opposes",
        "mixed": "mixed",
        "not_applicable": "not_applicable",
        "unknown": "unknown",
        "neutral": "supports" if row["role_mode"] == "presence" else "unknown",
    }.get(direction, "unknown")


def _aggregate_roles(roles: set[str]) -> str:
    if "supports" in roles and "opposes" in roles:
        return "mixed"
    if "mixed" in roles:
        return "mixed"
    for preferred in ("supports", "opposes", "incommensurable", "unknown", "not_applicable"):
        if preferred in roles:
            return preferred
    return "unknown"


def compare_topic(
    chart_id: str,
    topic: str,
    findings: Iterable[Mapping[str, Any]],
    profile_ids: Sequence[str] | None = None,
) -> dict[str, Any]:
    if topic not in TOPIC_BY_ID:
        raise ValueError(f"unknown W07 topic: {topic}")
    profile_ids = list(profile_ids or CROSSWALK["formal_profiles"])
    normalized = [row for row in map(normalize_finding, findings) if row["canonical_topic"] == topic]
    by_profile: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in normalized:
        if row["profile_id"]:
            by_profile[row["profile_id"]].append(row)

    topic_row = TOPIC_BY_ID[topic]
    covered_schools = {
        row["school_id"] for row in CROSSWALK["mappings"] if row["canonical_topic"] == topic
    }
    items: list[dict[str, Any]] = []
    for profile_id in profile_ids:
        rows = by_profile.get(profile_id, [])
        school = PROFILE_TO_SCHOOL.get(profile_id)
        if not rows:
            role = "unknown" if school in covered_schools else "not_applicable"
            items.append({
                "school_profile_id": profile_id,
                "finding_ids": [],
                "comparison_role": role,
                "reason_summary": "该体系存在对应映射但当前没有充分 FindingIR。" if role == "unknown" else "该体系没有登记该主题的可比较模块。",
                "reason_families": [],
                "concept_families": [],
                "evidence_statuses": [],
            })
            continue
        roles = {_role(row) for row in rows}
        role = _aggregate_roles(roles)
        items.append({
            "school_profile_id": profile_id,
            "finding_ids": sorted({row["finding_id"] for row in rows}),
            "comparison_role": role,
            "reason_summary": f"保留 {len(rows)} 条 FindingIR；角色为 {role}。",
            "reason_families": sorted({row["reason_family"] for row in rows}),
            "concept_families": sorted({row["concept_family"] for row in rows}),
            "evidence_statuses": sorted({row["finding"].get("evidence_status", "unknown") for row in rows}),
        })

    roles_by_profile = {item["school_profile_id"]: item["comparison_role"] for item in items}
    supports = {p for p, role in roles_by_profile.items() if role == "supports"}
    opposes = {p for p, role in roles_by_profile.items() if role == "opposes"}
    mixed = {p for p, role in roles_by_profile.items() if role == "mixed"}
    incommensurable = {p for p, role in roles_by_profile.items() if role == "incommensurable"}
    comparable = supports | opposes | mixed

    reason_codes: list[str] = []
    if supports and opposes:
        status = "contested"
        reason_codes.append("opposite_directions_preserved")
    elif mixed:
        status = "mixed"
        reason_codes.append("within_school_mixed_evidence")
    elif len(comparable) >= 2:
        active_items = [item for item in items if item["school_profile_id"] in comparable]
        reason_families = {x for item in active_items for x in item["reason_families"]}
        concept_families = {x for item in active_items for x in item["concept_families"]}
        if len(reason_families) == 1 and len(concept_families) == 1:
            status = "agreement"
            reason_codes.append("same_direction_same_reason_family")
        else:
            status = "same_direction_different_reason"
            reason_codes.append("same_direction_distinct_reason_family")
    elif incommensurable and (len(incommensurable) >= 2 or comparable):
        status = "incommensurable"
        reason_codes.append("heterogeneous_structural_objects")
    elif all(item["comparison_role"] == "not_applicable" for item in items):
        status = "not_applicable"
        reason_codes.append("no_selected_profile_has_topic_module")
    elif any(item["comparison_role"] == "unknown" for item in items):
        status = "unknown"
        reason_codes.append("insufficient_or_missing_findings")
    else:
        status = "unknown"
        reason_codes.append("fewer_than_two_comparable_profiles")

    if topic_row["comparison_basis"] == "not_comparable":
        comparison_basis = "not_comparable"
        comparability = "none"
        if any(item["finding_ids"] for item in items):
            status = "incommensurable"
    else:
        comparison_basis = topic_row["comparison_basis"]
        comparability = "exact" if comparison_basis == "common_fact" and status == "agreement" else "partial"
        if status in {"unknown", "not_applicable"}:
            comparability = "unknown"

    output = {
        "schema_version": "1.1.0",
        "comparison_id": f"comparison.{chart_id}.{topic.replace('.', '_')}",
        "chart_id": chart_id,
        "topic": topic,
        "status": status,
        "comparison_basis": comparison_basis,
        "comparability": comparability,
        "items": items,
        "input_finding_ids": sorted({row["finding_id"] for row in normalized}),
        "coverage": {
            "requested_profile_count": len(profile_ids),
            "participating_profile_count": sum(bool(item["finding_ids"]) for item in items),
            "comparable_profile_count": len(comparable),
            "unknown_profile_count": sum(item["comparison_role"] == "unknown" for item in items),
            "not_applicable_profile_count": sum(item["comparison_role"] == "not_applicable" for item in items),
        },
        "safety": {
            "risk_class": topic_row["risk_class"],
            "output_mode": topic_row["default_output_mode"],
            "reason_codes": [] if topic_row["risk_class"] == "none" else [f"risk_class:{topic_row['risk_class']}"]
        },
        "reason_codes": reason_codes,
        "notes": ["No majority vote; all profile roles are retained."],
    }
    return output


def compare_all_topics(
    chart_id: str,
    findings: Iterable[Mapping[str, Any]],
    profile_ids: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    findings = list(findings)
    return [compare_topic(chart_id, row["topic_id"], findings, profile_ids) for row in TOPIC_CATALOG["topics"]]
