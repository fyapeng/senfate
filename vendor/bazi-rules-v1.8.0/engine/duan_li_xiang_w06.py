"""Transparent W06 phase-1 compiler for Duan Jianye's Li-Xiang system.

The compiler reconstructs the explicit analysis sequence in 《段氏理象学》 as
an inspectable graph procedure:

    host/guest -> body/use -> stem/branch configuration -> entry route
    -> work graph -> qualitative efficiency -> temporal recomputation

It does not use day-master strength as an entry condition, does not hide a
single numeric score, does not infer missing mnemonics from examples, and does
not emit deterministic life-event claims.  This is a formalization of a
traditional textual system, not a scientifically validated forecasting model.
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from copy import deepcopy
from itertools import combinations
from pathlib import Path
from typing import Any, Iterable, Mapping

from .classical_ziping_w02 import BRANCH_ELEMENT, CONTROLS, GENERATES, STEM_ELEMENT
from .classical_ziping_w03 import _layer_context, _pair_relations
from .reference_dsl import Truth, get_path

ROOT = Path(__file__).resolve().parents[1]
POSITIONS = ("year", "month", "day", "hour")

STEM_COMBINES = {
    frozenset(("甲", "己")): "earth",
    frozenset(("乙", "庚")): "metal",
    frozenset(("丙", "辛")): "water",
    frozenset(("丁", "壬")): "wood",
    frozenset(("戊", "癸")): "fire",
}
SIX_COMBINES = {
    frozenset(("子", "丑")), frozenset(("寅", "亥")),
    frozenset(("卯", "戌")), frozenset(("辰", "酉")),
    frozenset(("巳", "申")), frozenset(("午", "未")),
}
CLASHES = {
    frozenset(("子", "午")), frozenset(("丑", "未")),
    frozenset(("寅", "申")), frozenset(("卯", "酉")),
    frozenset(("辰", "戌")), frozenset(("巳", "亥")),
}
HARMS = {
    frozenset(("子", "未")), frozenset(("丑", "午")),
    frozenset(("寅", "巳")), frozenset(("卯", "辰")),
    frozenset(("申", "亥")), frozenset(("酉", "戌")),
}
PAIR_PUNISHMENTS = {
    frozenset(("子", "卯")), frozenset(("寅", "巳")),
    frozenset(("巳", "申")), frozenset(("寅", "申")),
    frozenset(("丑", "戌")), frozenset(("戌", "未")),
    frozenset(("丑", "未")),
}
SELF_PUNISH = {"辰", "午", "酉", "亥"}
TOMBS = {"辰", "戌", "丑", "未"}

LU_MAP = {
    "甲": "寅", "乙": "卯", "丙": "巳", "丁": "午", "戊": "巳",
    "己": "午", "庚": "申", "辛": "酉", "壬": "亥", "癸": "子",
}
ORIGINAL_STEM_MAP = defaultdict(list)
for _stem, _branch in LU_MAP.items():
    ORIGINAL_STEM_MAP[_branch].append(_stem)

SELF_COMBINES = {
    ("丁", "亥"): None,
    ("己", "亥"): None,
    ("辛", "巳"): None,
    ("癸", "巳"): None,
    ("壬", "午"): None,
    ("甲", "午"): None,
    ("戊", "子"): None,
    ("丙", "戌"): "未",
    ("壬", "戌"): "未",
}
HALF_LU_STEM_PAIRS = {
    frozenset(("丙", "戊")): "bing_wu",
    frozenset(("丁", "己")): "ding_ji",
}
HALF_LU_STEM_BRANCH = {
    ("丁", "未"): "ding_wei",
    ("癸", "丑"): "gui_chou",
}

BODY_GODS = {"正印", "偏印", "比肩", "劫财"}
USE_GODS = {"正财", "偏财", "正官", "七杀", "七煞"}
OUTPUT_GODS = {"食神", "伤官"}

DEFAULT_PARAMETERS = {
    "reference_party_min_nodes": 3,
    "reference_party_margin": 1,
    "reference_clean_control_max_residual_targets": 0,
}


def _merge(target: dict[str, Any], update: Mapping[str, Any] | None) -> dict[str, Any]:
    if not update:
        return target
    for key, value in update.items():
        if isinstance(value, Mapping) and isinstance(target.get(key), dict):
            _merge(target[key], value)
        else:
            target[key] = deepcopy(value)
    return target


def _load_rule_contract() -> dict[str, dict[str, dict[str, Any]]]:
    contract: dict[str, dict[str, dict[str, Any]]] = {}
    base = ROOT / "rules/duan_li_xiang/w06"
    for group_dir in sorted(p for p in base.iterdir() if p.is_dir()):
        rows: dict[str, dict[str, Any]] = {}
        for path in sorted(group_dir.glob("*.rule.json")):
            rule = json.loads(path.read_text(encoding="utf-8"))
            slug = rule["rule_id"].split("@", 1)[0].rsplit(".", 1)[-1]
            rows[slug] = {"status": rule["status"], "rule_id": rule["rule_id"]}
        contract[group_dir.name] = rows
    return contract


RULE_CONTRACT = _load_rule_contract()


def _base_group(group: str) -> dict[str, Any]:
    """Seed direct catalogue/procedure statements; incomplete rules stay unknown."""
    out: dict[str, Any] = {}
    for slug, meta in RULE_CONTRACT[group].items():
        statuses = set(meta["status"])
        if "incomplete" in statuses or "historical_only" in statuses:
            continue
        out[slug] = True
    return out


def _ten_god_role(ten_god: str | None, *, is_day_master: bool = False) -> str:
    if is_day_master:
        return "body"
    if ten_god in BODY_GODS:
        return "body"
    if ten_god in USE_GODS:
        return "use"
    if ten_god == "食神":
        return "body_leaning"
    if ten_god == "伤官":
        return "use_leaning"
    return "unknown"


def _relation_to_day(element: str, day_element: str) -> str:
    if element == day_element:
        return "peer"
    if GENERATES[element] == day_element:
        return "resource"
    if GENERATES[day_element] == element:
        return "output"
    if CONTROLS[day_element] == element:
        return "wealth"
    if CONTROLS[element] == day_element:
        return "official"
    return "unknown"


def _generic_role_from_element(element: str, day_element: str) -> str:
    group = _relation_to_day(element, day_element)
    if group in {"peer", "resource"}:
        return "body"
    if group in {"wealth", "official"}:
        return "use"
    if group == "output":
        return "contextual_output"
    return "unknown"


def _main_hidden_ten_god(pillar: Mapping[str, Any]) -> str | None:
    rows = sorted(pillar.get("hidden_stems", []), key=lambda x: x.get("order", 99))
    if not rows:
        return None
    return rows[0].get("ten_god")


def _token_rows(
    chart: Mapping[str, Any], *, luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    day_element = STEM_ELEMENT[chart["day_master"]]
    for position in POSITIONS:
        pillar = chart["pillars"][position]
        stem = pillar["stem"]
        branch = pillar["branch"]
        stem_god = pillar.get("stem_ten_god") or chart.get("ten_god_map", {}).get(stem)
        branch_god = _main_hidden_ten_god(pillar)
        rows.extend([
            {
                "ref_id": f"natal.{position}.stem", "layer": "natal", "position": position,
                "kind": "stem", "token": stem, "element": STEM_ELEMENT[stem],
                "ten_god": stem_god, "body_use": _ten_god_role(stem_god, is_day_master=position == "day"),
                "pillar_ref": f"natal.{position}",
            },
            {
                "ref_id": f"natal.{position}.branch", "layer": "natal", "position": position,
                "kind": "branch", "token": branch, "element": BRANCH_ELEMENT[branch],
                "ten_god": branch_god,
                "body_use": _ten_god_role(branch_god) if branch_god else _generic_role_from_element(BRANCH_ELEMENT[branch], day_element),
                "pillar_ref": f"natal.{position}",
            },
        ])
    for layer, row in (("luck", luck_cycle), ("annual", annual)):
        if not row:
            continue
        stem, branch = row["stem"], row["branch"]
        stem_god = row.get("stem_ten_god") or chart.get("ten_god_map", {}).get(stem)
        rows.extend([
            {
                "ref_id": f"{layer}.stem", "layer": layer, "position": layer,
                "kind": "stem", "token": stem, "element": STEM_ELEMENT[stem],
                "ten_god": stem_god, "body_use": _ten_god_role(stem_god),
                "pillar_ref": layer,
            },
            {
                "ref_id": f"{layer}.branch", "layer": layer, "position": layer,
                "kind": "branch", "token": branch, "element": BRANCH_ELEMENT[branch],
                "ten_god": None, "body_use": _generic_role_from_element(BRANCH_ELEMENT[branch], day_element),
                "pillar_ref": layer,
            },
        ])
    return rows


def _assign_host_guest(row: Mapping[str, Any], level: str) -> str:
    layer, position, kind = row["layer"], row["position"], row["kind"]
    if level == "day_master":
        return "host" if layer == "natal" and position == "day" and kind == "stem" else "guest"
    if level == "day_pillar":
        return "host" if layer == "natal" and position == "day" else "guest"
    if level == "day_hour":
        return "host" if layer == "natal" and position in {"day", "hour"} else "guest"
    if level == "natal_time":
        return "host" if layer == "natal" else "guest"
    return "unknown"


def compile_procedure(annotations: Mapping[str, Any] | None = None) -> dict[str, Any]:
    evidence = _base_group("procedure")
    evidence.update({
        "evidence_compiled": True,
        "analysis_sequence": [
            "host_body", "configuration", "entry", "work_graph",
            "qualitative_efficiency", "temporal_recompute", "safe_findings",
        ],
        "entry_excludes": ["day_master_strength", "global_useful_god"],
        "source_scope": "introductory_theory_with_explicit_incompleteness",
        "unpublished_or_incomplete": ["deep_image", "technique", "exact_timing", "unseen_mnemonics"],
        "examples_generalizable_by_default": False,
    })
    return _merge(evidence, annotations)


def compile_host_body(
    chart: Mapping[str, Any], *, luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("host_body")
    rows = _token_rows(chart, luck_cycle=luck_cycle, annual=annual)
    levels = ("day_master", "day_pillar", "day_hour", "natal_time")
    for row in rows:
        row["host_guest"] = {level: _assign_host_guest(row, level) for level in levels}
    default_level = "natal_time" if annual or luck_cycle else "day_hour"
    body_refs = [r["ref_id"] for r in rows if r["body_use"] == "body"]
    use_refs = [r["ref_id"] for r in rows if r["body_use"] == "use"]
    output_refs = [r["ref_id"] for r in rows if r["body_use"] in {"body_leaning", "use_leaning", "contextual_output"}]
    evidence.update({
        "evidence_compiled": True,
        "levels": list(levels),
        "default_comparison_level": default_level,
        "tokens": rows,
        "body_refs": body_refs,
        "use_refs": use_refs,
        "contextual_output_refs": output_refs,
        "role_counts": dict(Counter(r["body_use"] for r in rows)),
        "host_counts_by_level": {
            level: sum(r["host_guest"][level] == "host" for r in rows) for level in levels
        },
        "role_assignment_is_contextual": True,
    })
    return _merge(evidence, annotations)


def compile_configuration(
    chart: Mapping[str, Any], *, luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("configuration")
    rows = _token_rows(chart, luck_cycle=luck_cycle, annual=annual)
    active_branches = {r["token"] for r in rows if r["kind"] == "branch"}
    pillar_states: list[dict[str, Any]] = []
    self_combine_candidates: list[dict[str, Any]] = []
    lu_connections: list[dict[str, Any]] = []
    half_lu_candidates: list[dict[str, Any]] = []

    for position in POSITIONS:
        pillar = chart["pillars"][position]
        stem, branch = pillar["stem"], pillar["branch"]
        hidden = {h["stem"] for h in pillar.get("hidden_stems", [])}
        rooted = stem in hidden
        generated = GENERATES[BRANCH_ELEMENT[branch]] == STEM_ELEMENT[stem]
        state = "real" if rooted or generated else "virtual"
        pillar_states.append({
            "pillar_ref": f"natal.{position}", "stem": stem, "branch": branch,
            "rooted": rooted, "generated_by_branch": generated,
            "virtual_real": state,
        })
        required = SELF_COMBINES.get((stem, branch), "__not_listed__")
        if required != "__not_listed__":
            active = required is None or required in active_branches
            self_combine_candidates.append({
                "pillar_ref": f"natal.{position}", "stem": stem, "branch": branch,
                "required_branch": required, "active": active,
                "resolution": "active" if active else "unknown_condition_not_met",
            })
        if LU_MAP.get(stem) == branch:
            lu_connections.append({"pillar_ref": f"natal.{position}", "stem": stem, "branch": branch, "kind": "same_pillar_lu"})
        if (stem, branch) in HALF_LU_STEM_BRANCH:
            half_lu_candidates.append({"pillar_ref": f"natal.{position}", "stem": stem, "branch": branch, "slug": HALF_LU_STEM_BRANCH[(stem, branch)]})

    active_stem_rows = [r for r in rows if r["kind"] == "stem"]
    active_stem_tokens = {r["token"] for r in active_stem_rows}
    for pair, slug in HALF_LU_STEM_PAIRS.items():
        if pair.issubset(active_stem_tokens):
            refs = [r["ref_id"] for r in active_stem_rows if r["token"] in pair]
            half_lu_candidates.append({"stem_refs": refs, "stems": sorted(pair), "slug": slug})

    # Cross-position lu/original-body connections remain explicit graph edges.
    for srow in (r for r in rows if r["kind"] == "stem"):
        for brow in (r for r in rows if r["kind"] == "branch"):
            if LU_MAP.get(srow["token"]) == brow["token"]:
                lu_connections.append({
                    "stem_ref": srow["ref_id"], "branch_ref": brow["ref_id"],
                    "stem": srow["token"], "branch": brow["token"], "kind": "lu_original_connection",
                })

    evidence.update({
        "evidence_compiled": True,
        "pillar_virtual_real": pillar_states,
        "real_pillars": [p["pillar_ref"] for p in pillar_states if p["virtual_real"] == "real"],
        "virtual_pillars": [p["pillar_ref"] for p in pillar_states if p["virtual_real"] == "virtual"],
        "self_combine_candidates": self_combine_candidates,
        "active_self_combines": [x for x in self_combine_candidates if x["active"]],
        "lu_connections": lu_connections,
        "half_lu_candidates": half_lu_candidates,
        "four_tomb_branches": sorted(active_branches.intersection(TOMBS)),
        "plain_branch_controls_stem": False,
        "stem_controls_branch_allowed": True,
        "branch_generates_stem_allowed": True,
        "virtual_real_scope": "same_pillar_configuration",
        "virtual_real_is_strength": False,
    })
    return _merge(evidence, annotations)


def _pair_relation_types(left: Mapping[str, Any], right: Mapping[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    ltok, rtok = left["token"], right["token"]
    if left["kind"] == right["kind"] == "stem":
        pair = frozenset((ltok, rtok))
        if pair in STEM_COMBINES:
            out.append({"relation_type": "stem_combine", "method": "combine", "transform_element": STEM_COMBINES[pair]})
        if CONTROLS[left["element"]] == right["element"]:
            out.append({"relation_type": "control", "method": "control", "directed": "left_to_right"})
        if CONTROLS[right["element"]] == left["element"]:
            out.append({"relation_type": "control", "method": "control", "directed": "right_to_left"})
        if GENERATES[left["element"]] == right["element"]:
            out.append({"relation_type": "generate", "method": "generate_or_drain", "directed": "left_to_right"})
        if GENERATES[right["element"]] == left["element"]:
            out.append({"relation_type": "generate", "method": "generate_or_drain", "directed": "right_to_left"})
    elif left["kind"] == right["kind"] == "branch":
        pair = frozenset((ltok, rtok))
        if pair in SIX_COMBINES:
            out.append({"relation_type": "six_combine", "method": "combine"})
        if pair in CLASHES:
            out.append({"relation_type": "clash", "method": "control"})
        if pair in HARMS:
            out.append({"relation_type": "harm", "method": "control"})
        if pair in PAIR_PUNISHMENTS or (ltok == rtok and ltok in SELF_PUNISH):
            out.append({"relation_type": "punishment", "method": "control"})
        if CONTROLS[left["element"]] == right["element"]:
            out.append({"relation_type": "element_control", "method": "control", "directed": "left_to_right"})
        if CONTROLS[right["element"]] == left["element"]:
            out.append({"relation_type": "element_control", "method": "control", "directed": "right_to_left"})
        if GENERATES[left["element"]] == right["element"]:
            out.append({"relation_type": "element_generate", "method": "generate_or_drain", "directed": "left_to_right"})
        if GENERATES[right["element"]] == left["element"]:
            out.append({"relation_type": "element_generate", "method": "generate_or_drain", "directed": "right_to_left"})
        if ltok in TOMBS or rtok in TOMBS:
            out.append({"relation_type": "tomb_candidate", "method": "tomb"})
    else:
        stem = left if left["kind"] == "stem" else right
        branch = right if left["kind"] == "stem" else left
        if CONTROLS[stem["element"]] == branch["element"]:
            out.append({"relation_type": "stem_controls_branch", "method": "control", "directed_ref": stem["ref_id"]})
        if GENERATES[branch["element"]] == stem["element"]:
            out.append({"relation_type": "branch_generates_stem", "method": "generate", "directed_ref": branch["ref_id"]})
        if GENERATES[stem["element"]] == branch["element"]:
            out.append({"relation_type": "stem_generates_branch", "method": "drain", "directed_ref": stem["ref_id"]})
        # Deliberately no plain branch-controls-stem edge.
    return out


def _direction_and_parties(
    left: Mapping[str, Any], right: Mapping[str, Any], relation: Mapping[str, Any], level: str,
) -> tuple[str, str | None, str | None]:
    source, target = left, right
    directed = relation.get("directed")
    directed_ref = relation.get("directed_ref")
    if directed == "right_to_left" or directed_ref == right["ref_id"]:
        source, target = right, left
    elif directed == "left_to_right" or directed_ref == left["ref_id"]:
        source, target = left, right
    elif relation["method"] in {"combine", "tomb"}:
        # Symmetric relations keep both orientations unresolved unless host/use breaks tie.
        if right["host_guest"][level] == "host" and left["host_guest"][level] == "guest":
            source, target = right, left
    source_side = source["host_guest"][level]
    target_side = target["host_guest"][level]
    source_role, target_role = source["body_use"], target["body_use"]
    if source_side == "host" and target_side == "guest":
        direction = "positive"
    elif source_side == "guest" and target_side == "host":
        direction = "reverse"
    elif source_role in {"body", "body_leaning"} and target_role in {"use", "use_leaning"}:
        direction = "positive"
    elif source_role in {"use", "use_leaning"} and target_role in {"body", "body_leaning"}:
        direction = "reverse"
    else:
        direction = "mixed_or_unknown"
    return direction, source["ref_id"], target["ref_id"]


def compile_work(
    chart: Mapping[str, Any], host_body: Mapping[str, Any], configuration: Mapping[str, Any],
    *, luck_cycle: Mapping[str, Any] | None = None, annual: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("work")
    rows = deepcopy(host_body["tokens"])
    level = host_body["default_comparison_level"]
    work_paths: list[dict[str, Any]] = []
    for left, right in combinations(rows, 2):
        for relation in _pair_relation_types(left, right):
            direction, source_ref, target_ref = _direction_and_parties(left, right, relation, level)
            method = relation["method"]
            if method == "generate_or_drain":
                source = next(r for r in rows if r["ref_id"] == source_ref)
                method = "drain" if source["host_guest"][level] == "host" or source["body_use"] in {"body", "body_leaning"} else "generate"
            path = {
                "work_id": f"work.{len(work_paths)+1:04d}",
                "participants": [left["ref_id"], right["ref_id"]],
                "tokens": [left["token"], right["token"]],
                "relation_type": relation["relation_type"],
                "method": method,
                "source_ref": source_ref,
                "target_ref": target_ref,
                "direction": direction,
                "comparison_level": level,
                "resolution_status": "candidate",
            }
            if "transform_element" in relation:
                path["transform_element"] = relation["transform_element"]
            work_paths.append(path)

    # Add same-pillar combine paths from the configuration resolver.
    for item in configuration["active_self_combines"]:
        work_paths.append({
            "work_id": f"work.{len(work_paths)+1:04d}",
            "participants": [f"{item['pillar_ref']}.stem", f"{item['pillar_ref']}.branch"],
            "tokens": [item["stem"], item["branch"]],
            "relation_type": "self_combine", "method": "combine",
            "source_ref": f"{item['pillar_ref']}.stem", "target_ref": f"{item['pillar_ref']}.branch",
            "direction": "mixed_or_unknown", "comparison_level": level,
            "resolution_status": "active",
        })

    by_pair: dict[tuple[str, ...], list[dict[str, Any]]] = defaultdict(list)
    for path in work_paths:
        by_pair[tuple(sorted(path["participants"]))].append(path)
    compound_paths = [
        {"participants": list(pair), "component_work_ids": [p["work_id"] for p in paths], "method": "compound"}
        for pair, paths in by_pair.items() if len(paths) >= 2
    ]

    relation_counts = Counter(p["relation_type"] for p in work_paths)
    method_counts = Counter(p["method"] for p in work_paths)
    direction_counts = Counter(p["direction"] for p in work_paths)
    participant_counts = Counter(ref for p in work_paths for ref in p["participants"])
    gong_refs = sorted(ref for ref, count in participant_counts.items() if count > 0)
    all_refs = {r["ref_id"] for r in rows}
    waste_refs = sorted(all_refs.difference(gong_refs))

    # Transparent element-party descriptions. These are descriptive graph clusters,
    # never a concealed numerical prosperity score.
    element_counts = Counter(r["element"] for r in rows)
    party_candidates = []
    party_specs = {
        "wood_fire": {"wood", "fire"}, "fire_dry_earth": {"fire", "earth"},
        "metal_water": {"metal", "water"}, "water_wood": {"water", "wood"},
        "metal_wet_earth": {"metal", "earth"}, "water_wet_earth": {"water", "earth"},
    }
    for name, elements in party_specs.items():
        node_count = sum(element_counts[e] for e in elements)
        party_candidates.append({"party": name, "elements": sorted(elements), "node_count": node_count, "active": node_count >= DEFAULT_PARAMETERS["reference_party_min_nodes"]})

    evidence.update({
        "evidence_compiled": True,
        "work_graph": work_paths,
        "work_count": len(work_paths),
        "compound_paths": compound_paths,
        "compound_count": len(compound_paths),
        "relation_counts": dict(relation_counts),
        "method_counts": dict(method_counts),
        "direction_counts": dict(direction_counts),
        "gong_refs": gong_refs,
        "waste_refs": waste_refs,
        "party_candidates": party_candidates,
        "target_required": True,
        "hidden_total_score": False,
        "graph_complete_for_phase1_relations": True,
    })
    # Dynamic flags used by executable rules.
    evidence.update({
        "relation_combine": method_counts["combine"] > 0,
        "relation_clash": relation_counts["clash"] > 0,
        "relation_control": method_counts["control"] > 0,
        "relation_harm": relation_counts["harm"] > 0,
        "relation_punish": relation_counts["punishment"] > 0,
        "relation_tomb": method_counts["tomb"] > 0,
        "mode_combine": method_counts["combine"] > 0,
        "mode_control": method_counts["control"] > 0,
        "mode_generate": method_counts["generate"] > 0,
        "mode_drain": method_counts["drain"] > 0,
        "mode_tomb": method_counts["tomb"] > 0,
        "mode_compound": len(compound_paths) > 0,
        "gong_participant": bool(gong_refs),
        "waste_nonparticipant": bool(waste_refs),
    })
    return _merge(evidence, annotations)


def compile_entry(
    chart: Mapping[str, Any], host_body: Mapping[str, Any], work: Mapping[str, Any],
    *, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("entry")
    day_stem_ref = "natal.day.stem"
    day_branch_ref = "natal.day.branch"
    day_stem_paths = [p for p in work["work_graph"] if day_stem_ref in p["participants"]]
    combine_paths = [p for p in day_stem_paths if p["method"] == "combine"]
    output_adjacent = []
    for position in ("month", "hour"):
        row = next(r for r in host_body["tokens"] if r["ref_id"] == f"natal.{position}.stem")
        if row["ten_god"] in OUTPUT_GODS:
            output_adjacent.append(row["ref_id"])
    day_branch_paths = [p for p in work["work_graph"] if day_branch_ref in p["participants"]]
    lu_peer_refs = [
        r["ref_id"] for r in host_body["tokens"]
        if r["ref_id"] not in {day_stem_ref, day_branch_ref}
        and (r["body_use"] == "body" or r["token"] == LU_MAP.get(chart["day_master"]))
    ]
    if combine_paths:
        route = "day_stem_combine"
    elif output_adjacent:
        route = "day_stem_output"
    elif day_branch_paths:
        route = "day_branch"
    elif lu_peer_refs:
        route = "lu_peer"
    else:
        route = "image_unknown"
    evidence.update({
        "evidence_compiled": True,
        "selected_route": route,
        "day_stem_combine_paths": [p["work_id"] for p in combine_paths],
        "adjacent_output_refs": output_adjacent,
        "day_branch_work_paths": [p["work_id"] for p in day_branch_paths],
        "lu_peer_refs": lu_peer_refs,
        "fallback_image_status": "unknown_incomplete" if route == "image_unknown" else "not_needed",
        "day_stem_combine": bool(combine_paths),
        "day_stem_output_second": bool(output_adjacent),
        "output_adjacent": bool(output_adjacent),
        "day_branch_relations": bool(day_branch_paths),
        "day_branch_party": bool(day_branch_paths),
        "fallback_day_branch": not combine_paths and not output_adjacent and bool(day_branch_paths),
        "fallback_lu_peer": not combine_paths and not output_adjacent and not day_branch_paths and bool(lu_peer_refs),
        "combine_requires_work": bool(combine_paths),
    })
    # Day-stem combination subtype: wealth or official according to counterpart.
    combine_counterparts = []
    for path in combine_paths:
        other = next(ref for ref in path["participants"] if ref != day_stem_ref)
        row = next(r for r in host_body["tokens"] if r["ref_id"] == other)
        combine_counterparts.append({"ref_id": other, "ten_god": row["ten_god"]})
    evidence["combine_counterparts"] = combine_counterparts
    evidence["day_stem_combine_wealth"] = any(x["ten_god"] in {"正财", "偏财"} for x in combine_counterparts)
    evidence["day_stem_combine_official"] = any(x["ten_god"] in {"正官", "七杀", "七煞"} for x in combine_counterparts)
    return _merge(evidence, annotations)


def _efficiency_tier(path: Mapping[str, Any]) -> tuple[str, list[str]]:
    relation, method = path["relation_type"], path["method"]
    tokens = set(path["tokens"])
    factors: list[str] = []
    if relation == "tomb_candidate" and tokens.intersection(TOMBS):
        factors.append("tomb_candidate")
    if relation == "clash" and tokens.intersection(TOMBS):
        factors.append("tomb_or_tomb_clash")
    if relation == "clash" and frozenset(path["tokens"]) in {
        frozenset(("寅", "申")), frozenset(("巳", "亥")),
    }:
        factors.append("yin_shen_si_hai_clash")
    if relation == "clash" and frozenset(path["tokens"]) in {
        frozenset(("子", "午")), frozenset(("卯", "酉")),
    }:
        factors.append("zi_wu_mao_you_clash")
    if method == "combine":
        factors.append("combine")
    if method == "control":
        factors.append("plain_or_relational_control")
    if relation == "harm":
        factors.append("harm_requires_force")
    if "tomb_or_tomb_clash" in factors or "yin_shen_si_hai_clash" in factors:
        return "high", factors
    if method == "combine" or relation in {"harm", "punishment"}:
        return "medium", factors
    if method in {"control", "generate", "drain"}:
        return "low", factors
    return "unknown", factors


def compile_efficiency(
    host_body: Mapping[str, Any], work: Mapping[str, Any],
    *, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("efficiency")
    row_by_ref = {r["ref_id"]: r for r in host_body["tokens"]}
    vectors = []
    for path in work["work_graph"]:
        tier, factors = _efficiency_tier(path)
        carrier_layers = sorted({row_by_ref[ref]["kind"] for ref in path["participants"] if ref in row_by_ref})
        branch_carrier = "branch" in carrier_layers
        vectors.append({
            "work_id": path["work_id"],
            "tier": tier,
            "carrier_layers": carrier_layers,
            "branch_carrier": branch_carrier,
            "method": path["method"],
            "direction": path["direction"],
            "factors": factors,
            "numeric_score": None,
        })
    tier_counts = Counter(v["tier"] for v in vectors)
    evidence.update({
        "evidence_compiled": True,
        "vectors": vectors,
        "tier_counts": dict(tier_counts),
        "branch_path_count": sum(v["branch_carrier"] for v in vectors),
        "stem_only_path_count": sum(not v["branch_carrier"] for v in vectors),
        "qualitative_dimensions": [
            "carrier_layer", "relation_method", "direction", "enclosure",
            "target_control", "source_support", "residual_interference",
        ],
        "hidden_total_score": False,
        "total_score": None,
        "rank_mapping_enabled": False,
        "branch_above_stem": any(v["branch_carrier"] for v in vectors),
        "no_hidden_total_score": True,
        "plain_control_low": any(v["tier"] == "low" and v["method"] == "control" for v in vectors),
        "combine_medium": any(v["tier"] == "medium" and v["method"] == "combine" for v in vectors),
        "tomb_clash_high": any(v["tier"] == "high" and "tomb_or_tomb_clash" in v["factors"] for v in vectors),
        "yin_shen_si_hai_high": any("yin_shen_si_hai_clash" in v["factors"] for v in vectors),
        "zi_wu_mao_you_lower": any("zi_wu_mao_you_clash" in v["factors"] for v in vectors),
    })
    return _merge(evidence, annotations)


def compile_temporal(
    *, stage: str, luck_cycle: Mapping[str, Any] | None, annual: Mapping[str, Any] | None,
    configuration: Mapping[str, Any], work: Mapping[str, Any],
    natal_configuration: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("temporal")
    natal_states = {p["pillar_ref"]: p["virtual_real"] for p in (natal_configuration or configuration)["pillar_virtual_real"]}
    current_states = {p["pillar_ref"]: p["virtual_real"] for p in configuration["pillar_virtual_real"]}
    transitions = [
        {"pillar_ref": ref, "from": natal_states.get(ref), "to": value}
        for ref, value in current_states.items() if natal_states.get(ref) != value
    ]
    evidence.update({
        "evidence_compiled": True,
        "stage": stage,
        "luck_annual_guest": stage in {"luck", "annual"},
        "active_luck": deepcopy(luck_cycle),
        "active_annual": deepcopy(annual),
        "relations_recomputed": True,
        "virtual_real_recomputed": True,
        "work_recomputed": True,
        "work_count": work["work_count"],
        "virtual_real_transitions": transitions,
        "recompute_relations": True,
        "recompute_virtual_real": True,
        "virtual_real_timing": bool(transitions),
        "compound_modes_by_luck": stage in {"luck", "annual"} and work["compound_count"] > 0,
        "catcher_thief_activation": False,
        "multi_solution_allowed": True,
        "deep_timing_status": "unknown_incomplete",
    })
    return _merge(evidence, annotations)


def compile_safety(annotations: Mapping[str, Any] | None = None) -> dict[str, Any]:
    evidence = _base_group("safety")
    evidence.update({
        "evidence_compiled": True,
        "block_disease": True,
        "block_death": True,
        "block_crime": True,
        "no_scientific_claim": True,
        "neutralize_marriage": True,
        "neutralize_moral_labels": True,
        "neutralize_status": True,
        "neutralize_wealth": True,
        "example_not_general_rule": True,
        "output_scope": "traditional_structural_interpretation_only",
    })
    return _merge(evidence, annotations)


def compile_w06_evidence(
    chart: Mapping[str, Any], *, stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    if stage not in {"natal", "luck", "annual"}:
        raise ValueError(f"unsupported stage: {stage}")
    annotations = annotations or {}
    procedure = compile_procedure(annotations.get("procedure"))
    host_body = compile_host_body(chart, luck_cycle=luck_cycle, annual=annual, annotations=annotations.get("host_body"))
    configuration = compile_configuration(chart, luck_cycle=luck_cycle, annual=annual, annotations=annotations.get("configuration"))
    work = compile_work(
        chart, host_body, configuration, luck_cycle=luck_cycle, annual=annual,
        annotations=annotations.get("work"),
    )
    entry = compile_entry(chart, host_body, work, annotations=annotations.get("entry"))
    efficiency = compile_efficiency(host_body, work, annotations=annotations.get("efficiency"))
    natal_configuration = natal_core["configuration"] if natal_core else configuration
    temporal = compile_temporal(
        stage=stage, luck_cycle=luck_cycle, annual=annual,
        configuration=configuration, work=work,
        natal_configuration=natal_configuration, annotations=annotations.get("temporal"),
    )
    safety = compile_safety(annotations.get("safety"))
    return {
        "procedure": procedure,
        "host_body": host_body,
        "configuration": configuration,
        "entry": entry,
        "work": work,
        "efficiency": efficiency,
        "temporal": temporal,
        "safety": safety,
    }


def _state_id(chart: Mapping[str, Any], stage: str, *, luck_cycle=None, annual=None) -> str:
    if stage == "natal":
        suffix = "natal.duan_li_xiang_w06"
    elif stage == "luck":
        suffix = f"luck.{luck_cycle['luck_cycle_id']}.duan_li_xiang_w06"
    else:
        suffix = f"annual.{annual['annual_id']}.duan_li_xiang_w06"
    return f"state.{chart['chart_id']}.{suffix}"


def _fact_for_state(chart_id: str, state_id: str, stage: str) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "fact_id": f"fact.{state_id}.temporal_compilation_complete",
        "subject": {"ref_id": chart_id, "entity_type": "chart", "layer": stage},
        "predicate": "duan_li_xiang.temporal.compilation_complete",
        "value": True,
        "truth": "true",
        "scope": {"stage": stage, "state_id": state_id},
        "source_type": "computed",
        "algorithm_id": "duan_li_xiang.w06.phase1.compiler@1.0.0",
    }


def build_state_ir_w06(
    chart: Mapping[str, Any], *, stage: str,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    parent_state_id: str | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    state_id = _state_id(chart, stage, luck_cycle=luck_cycle, annual=annual)
    evidence = compile_w06_evidence(
        chart, stage=stage, luck_cycle=luck_cycle, annual=annual,
        natal_core=natal_core, annotations=annotations,
    )
    stems, branches = _layer_context(chart, luck_cycle=luck_cycle, annual=annual)
    relations = [] if stage == "natal" else _pair_relations(stems, branches, stage, state_id)
    active_context: dict[str, Any] = {"natal_chart_id": chart["chart_id"]}
    if luck_cycle:
        active_context["luck_cycle_id"] = luck_cycle["luck_cycle_id"]
    if annual:
        active_context["annual_id"] = annual["annual_id"]
    state: dict[str, Any] = {
        "schema_version": "1.0.0",
        "state_id": state_id,
        "chart_id": chart["chart_id"],
        "stage": stage,
        "school_profile_id": "duan_li_xiang.w06@1.0.0",
        "active_context": active_context,
        "facts": [_fact_for_state(chart["chart_id"], state_id, stage)],
        "relations": relations,
        "findings": [],
        "school_state": {"duan_li_xiang": {"w06": evidence}},
        "trace_id": f"trace.{state_id}",
    }
    if parent_state_id:
        state["parent_state_id"] = parent_state_id
    return state


def build_state_chain_w06(
    chart: Mapping[str, Any], *,
    annotations_by_state: Mapping[str, Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    annotations_by_state = annotations_by_state or {}
    natal = build_state_ir_w06(chart, stage="natal", annotations=annotations_by_state.get("natal"))
    natal_core = natal["school_state"]["duan_li_xiang"]["w06"]
    states = [natal]
    luck_states: dict[str, str] = {}
    for luck in chart.get("luck_cycles", []):
        state = build_state_ir_w06(
            chart, stage="luck", luck_cycle=luck, parent_state_id=natal["state_id"],
            natal_core=natal_core, annotations=annotations_by_state.get(luck["luck_cycle_id"]),
        )
        states.append(state)
        luck_states[luck["luck_cycle_id"]] = state["state_id"]
    for annual in chart.get("annual_contexts", []):
        luck = next((r for r in chart.get("luck_cycles", []) if r["start_year"] <= annual["year"] <= r["end_year"]), None)
        parent = luck_states.get(luck["luck_cycle_id"]) if luck else natal["state_id"]
        state = build_state_ir_w06(
            chart, stage="annual", luck_cycle=luck, annual=annual,
            parent_state_id=parent, natal_core=natal_core,
            annotations=annotations_by_state.get(annual["annual_id"]),
        )
        if not luck:
            state["school_state"]["duan_li_xiang"]["w06"]["temporal"]["annual_parent_fallback"] = "natal_no_matching_luck"
        states.append(state)
    return states


def make_rule_context(
    chart: Mapping[str, Any], *, stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = compile_w06_evidence(
        chart, stage=stage, luck_cycle=luck_cycle, annual=annual,
        natal_core=natal_core, annotations=annotations,
    )
    return {
        "chart": deepcopy(chart),
        "facts": {"duan_li_xiang": {"w06": evidence}},
        "relations": [],
        "findings": [],
    }


def _resolver_path(args: dict[str, Any], context: dict[str, Any], group: str) -> Truth:
    slug = args.get("slug")
    if not slug:
        return Truth.UNKNOWN
    value = get_path(context, f"facts.duan_li_xiang.w06.{group}.{slug}", None)
    if value is None:
        return Truth.UNKNOWN
    return Truth.TRUE if bool(value) else Truth.FALSE


def _resolver_host_level(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    level = get_path(context, "facts.duan_li_xiang.w06.host_body.default_comparison_level", None)
    return Truth.UNKNOWN if level is None else Truth.TRUE if level == args.get("level") else Truth.FALSE


def _resolver_body_use(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    rows = get_path(context, "facts.duan_li_xiang.w06.host_body.tokens", None)
    if rows is None:
        return Truth.UNKNOWN
    ref_id, role = args.get("ref_id"), args.get("role")
    found = next((r for r in rows if r["ref_id"] == ref_id), None)
    return Truth.UNKNOWN if found is None else Truth.TRUE if found["body_use"] == role else Truth.FALSE


def _resolver_configuration(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    return _resolver_path(args, context, "configuration")


def _resolver_work(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    return _resolver_path(args, context, "work")


def _resolver_efficiency(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    return _resolver_path(args, context, "efficiency")


def _resolver_temporal(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    return _resolver_path(args, context, "temporal")


W06_RESOLVERS = {
    "duan_li_xiang.w06.host_level": _resolver_host_level,
    "duan_li_xiang.w06.body_use_role": _resolver_body_use,
    "duan_li_xiang.w06.configuration_active": _resolver_configuration,
    "duan_li_xiang.w06.work_active": _resolver_work,
    "duan_li_xiang.w06.efficiency_vector": _resolver_efficiency,
    "duan_li_xiang.w06.temporal_recompute": _resolver_temporal,
}
