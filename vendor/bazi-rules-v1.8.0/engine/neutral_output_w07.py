"""Render safe, provenance-carrying W07 user output from ComparisonIR."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Mapping

ROOT = Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "interpretations/neutral_output_policy.json").read_text(encoding="utf-8"))
TEMPLATES = json.loads((ROOT / "interpretations/W07_OUTPUT_TEMPLATES.json").read_text(encoding="utf-8"))
TRANSFORMS = json.loads((ROOT / "interpretations/W07_LANGUAGE_TRANSFORMS.json").read_text(encoding="utf-8"))
TOPICS = json.loads((ROOT / "ontology/comparison/W07_TOPIC_ONTOLOGY.json").read_text(encoding="utf-8"))
TOPIC_BY_ID = {row["topic_id"]: row for row in TOPICS["topics"]}


def _claim_text(item: Mapping[str, Any], topic_label: str) -> str:
    role = item["comparison_role"]
    phrases = {
        "supports": f"该体系登记了与“{topic_label}”同向的结构或主题候选。",
        "opposes": f"该体系登记了与“{topic_label}”反向的结构或主题候选。",
        "mixed": f"该体系在“{topic_label}”内部同时保留支持与抑制因素。",
        "incommensurable": f"该体系的相关输出属于独立结构对象，不能直接换算到“{topic_label}”的统一尺度。",
        "unknown": f"该体系关于“{topic_label}”的证据不足，保持未知。",
        "not_applicable": f"该体系没有“{topic_label}”对应模块。",
    }
    return phrases[role]


def _rule_ids(finding_ids: Iterable[str], finding_index: Mapping[str, Mapping[str, Any]]) -> list[str]:
    result: set[str] = set()
    for fid in finding_ids:
        result.update(finding_index.get(fid, {}).get("source_rule_ids", []))
    return sorted(result)


def render_neutral_output(
    chart_id: str,
    comparisons: Iterable[Mapping[str, Any]],
    findings: Iterable[Mapping[str, Any]],
) -> dict[str, Any]:
    finding_index = {row["finding_id"]: row for row in findings}
    sections: list[dict[str, Any]] = []
    provenance_complete = True
    for index, comparison in enumerate(comparisons, 1):
        topic = TOPIC_BY_ID[comparison["topic"]]
        risk = comparison.get("safety", {}).get("risk_class", topic["risk_class"])
        transform = TRANSFORMS["risk_classes"][risk]
        output_mode = transform["output_mode"]
        summary = TEMPLATES["status_templates"][comparison["status"]].format(topic_label=topic["label"])
        caveats = []
        if transform.get("required_caveat"):
            caveats.append(transform["required_caveat"])
        caveats.append("unknown、contested、mixed 与 incommensurable 状态均未被消解。")

        claims: list[dict[str, Any]] = []
        blocked_codes: list[str] = []
        if output_mode == "blocked":
            summary += " 用户层不展开具体传统断语。"
            blocked_codes = [f"blocked_risk_class:{risk}"]
        else:
            for item_no, item in enumerate(comparison["items"], 1):
                rule_ids = _rule_ids(item["finding_ids"], finding_index)
                evidence_statuses = item.get("evidence_statuses", [])
                evidence_status = "unknown"
                for candidate in ("contested", "incomplete", "unknown", "derived", "direct"):
                    if candidate in evidence_statuses:
                        evidence_status = candidate
                        break
                if item["finding_ids"] and not rule_ids:
                    provenance_complete = False
                claims.append({
                    "claim_id": f"claim.{chart_id}.{index}.{item_no}",
                    "text": _claim_text(item, topic["label"]),
                    "school_profile_id": item["school_profile_id"],
                    "finding_ids": item["finding_ids"],
                    "source_rule_ids": rule_ids,
                    "evidence_status": evidence_status,
                })
        sections.append({
            "section_id": f"neutral.{chart_id}.{index}",
            "topic": comparison["topic"],
            "topic_label": topic["label"],
            "status": comparison["status"],
            "output_mode": output_mode,
            "summary": summary,
            "claims": claims,
            "caveats": caveats,
            "blocked_reason_codes": blocked_codes,
        })

    return {
        "schema_version": "1.0.0",
        "output_id": f"neutral.{chart_id}.w07",
        "chart_id": chart_id,
        "policy_id": POLICY["policy_id"],
        "context_prefix": POLICY["default_context_prefix"],
        "sections": sections,
        "global_disclaimer": POLICY["global_disclaimer"],
        "provenance_complete": provenance_complete,
        "raw_source_quotes_included": False,
    }
