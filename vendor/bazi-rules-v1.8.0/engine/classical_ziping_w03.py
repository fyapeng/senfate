"""W03 reference compiler for classical Ziping qi, climate, remedy and time.

The module is intentionally transparent. It does not claim a scientific
prediction model and does not convert historical structural vocabulary into
medical, legal, financial or deterministic life-event conclusions.
"""
from __future__ import annotations

import json
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Iterable

from .classical_ziping_w02 import (
    BRANCH_ELEMENT,
    CONTROLS,
    GENERATES,
    STEM_ELEMENT,
    compile_w02_evidence,
)
from .reference_dsl import Truth, get_path

ROOT = Path(__file__).resolve().parents[1]
CLIMATE_PATH = ROOT / "ontology/classical_ziping/W03_CLIMATE_MATRIX.json"
BRANCH_PATH = ROOT / "ontology/common/earthly_branches.json"
RELATION_PATH = ROOT / "ontology/common/relation_catalog.json"

CLIMATE_MATRIX = json.loads(CLIMATE_PATH.read_text(encoding="utf-8"))
CLIMATE_BY_KEY = {row["recipe_key"]: row for row in CLIMATE_MATRIX["entries"]}
BRANCH_ROWS = json.loads(BRANCH_PATH.read_text(encoding="utf-8"))["items"]
BRANCH_HIDDEN = {row["branch"]: [x["stem"] for x in row["hidden_stems"]] for row in BRANCH_ROWS}
RELATION_CATALOG = json.loads(RELATION_PATH.read_text(encoding="utf-8"))
PAIR_RELATIONS = {
    row["relation_type"]: {frozenset(pair) for pair in row["pairs"]}
    for row in RELATION_CATALOG["pair_relations"]
}
GROUP_RELATIONS = {
    row["relation_type"]: [set(group) for group in row["groups"]]
    for row in RELATION_CATALOG["group_relations"]
}
INVERSE_CONTROLS = {controlled: controller for controller, controlled in CONTROLS.items()}
INVERSE_GENERATES = {generated: generator for generator, generated in GENERATES.items()}
ELEMENTS = ["wood", "fire", "earth", "metal", "water"]


def _merge(target: dict[str, Any], update: Mapping[str, Any]) -> dict[str, Any]:
    for key, value in update.items():
        if isinstance(value, Mapping) and isinstance(target.get(key), dict):
            _merge(target[key], value)
        else:
            target[key] = deepcopy(value)
    return target


def _layer_context(
    chart: Mapping[str, Any],
    *,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    stems: list[dict[str, Any]] = []
    branches: list[dict[str, Any]] = []
    for position, pillar in chart["pillars"].items():
        stems.append({"symbol": pillar["stem"], "layer": "natal", "position": position, "ref_id": f"{chart['chart_id']}.pillar.{position}.stem"})
        branches.append({"symbol": pillar["branch"], "layer": "natal", "position": position, "ref_id": f"{chart['chart_id']}.pillar.{position}.branch", "hidden_stems": [row["stem"] for row in pillar.get("hidden_stems", [])]})
    if luck_cycle:
        stems.append({"symbol": luck_cycle["stem"], "layer": "luck", "position": luck_cycle["luck_cycle_id"], "ref_id": f"{chart['chart_id']}.{luck_cycle['luck_cycle_id']}.stem"})
        hidden = [row["stem"] for row in luck_cycle.get("hidden_stems", [])] or BRANCH_HIDDEN[luck_cycle["branch"]]
        branches.append({"symbol": luck_cycle["branch"], "layer": "luck", "position": luck_cycle["luck_cycle_id"], "ref_id": f"{chart['chart_id']}.{luck_cycle['luck_cycle_id']}.branch", "hidden_stems": hidden})
    if annual:
        stems.append({"symbol": annual["stem"], "layer": "annual", "position": annual["annual_id"], "ref_id": f"{chart['chart_id']}.{annual['annual_id']}.stem"})
        branches.append({"symbol": annual["branch"], "layer": "annual", "position": annual["annual_id"], "ref_id": f"{chart['chart_id']}.{annual['annual_id']}.branch", "hidden_stems": BRANCH_HIDDEN[annual["branch"]]})
    return stems, branches


def _element_units(stems: Iterable[Mapping[str, Any]], branches: Iterable[Mapping[str, Any]]) -> tuple[Counter[str], list[str]]:
    """Visible stem + branch main-qi units; the counting policy is exposed."""
    counts: Counter[str] = Counter()
    reasons: list[str] = []
    for token in stems:
        element = STEM_ELEMENT[token["symbol"]]
        counts[element] += 1
        reasons.append(f"visible_stem:{token['layer']}:{token['position']}:{element}")
    for token in branches:
        hidden = token.get("hidden_stems", [])
        if hidden:
            element = STEM_ELEMENT[hidden[0]]
        else:
            element = BRANCH_ELEMENT[token["symbol"]]
        counts[element] += 1
        reasons.append(f"branch_main_qi:{token['layer']}:{token['position']}:{element}")
    return counts, reasons


def compile_climate_evidence(
    chart: Mapping[str, Any],
    *,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    stems, branches = _layer_context(chart, luck_cycle=luck_cycle, annual=annual)
    recipe_key = f"{chart['day_master']}.{chart['pillars']['month']['branch']}"
    recipe = CLIMATE_BY_KEY[recipe_key]
    visible = {row["symbol"] for row in stems}
    hidden = {stem for row in branches for stem in row.get("hidden_stems", [])}
    candidates = recipe["ordered_candidates"]
    primary = candidates[0]
    visibility = "visible" if primary in visible else "hidden" if primary in hidden else "absent"
    month = chart["pillars"]["month"]["branch"]
    counts, reasons = _element_units(stems, branches)
    evidence: dict[str, Any] = {
        "evidence_compiled": True,
        "recipe_available": True,
        "recipe_key": recipe_key,
        "ordered_candidates": candidates,
        "primary_candidate": primary,
        "primary_candidate_visibility": visibility,
        "candidate_visibility": {c: ("visible" if c in visible else "hidden" if c in hidden else "absent") for c in candidates},
        "visible_stems": sorted(visible),
        "hidden_stems": sorted(hidden),
        "winter": month in {"亥", "子", "丑"},
        "summer": month in {"巳", "午", "未"},
        "spring_autumn_moderate_candidate": month in {"寅", "卯", "辰", "申", "酉", "戌"},
        "fire_present": any(STEM_ELEMENT[s] == "fire" for s in visible | hidden),
        "water_present": any(STEM_ELEMENT[s] == "water" for s in visible | hidden),
        "element_units": dict(counts),
        "unit_policy": "visible_stem_plus_each_branch_main_qi",
        "unit_reasons": reasons,
        "candidate_can_function": visibility == "visible",
        "candidate_blocked": False,
        "new_imbalance": False,
        "resolved_candidate": primary if visibility == "visible" else None,
        "source_chunk_id": recipe["source_chunk_id"],
        "condition_note": recipe["condition_note"],
    }
    if annotations:
        _merge(evidence, annotations)
        if evidence.get("candidate_can_function") and not evidence.get("candidate_blocked") and not evidence.get("new_imbalance"):
            evidence["resolved_candidate"] = evidence.get("primary_candidate")
        else:
            evidence["resolved_candidate"] = None
    return evidence


def _flow_chain(source: str, present: set[str]) -> tuple[list[str], str | None]:
    chain = [source]
    current = source
    seen = {source}
    while True:
        nxt = GENERATES[current]
        if nxt not in present:
            return chain, nxt
        if nxt in seen:
            return chain, None
        chain.append(nxt)
        seen.add(nxt)
        current = nxt


def compile_qi_flow_evidence(
    chart: Mapping[str, Any],
    *,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    stems, branches = _layer_context(chart, luck_cycle=luck_cycle, annual=annual)
    counts, reasons = _element_units(stems, branches)
    present = {e for e, n in counts.items() if n > 0}
    max_count = max(counts.values(), default=0)
    sources = [e for e in ELEMENTS if counts[e] == max_count and max_count > 0]
    chains = {source: _flow_chain(source, present) for source in sources}
    destinations = list(dict.fromkeys(chain[-1] for chain, _missing in chains.values()))
    missing_links = list(dict.fromkeys(missing for _chain, missing in chains.values() if missing))
    conflict_pairs: list[dict[str, Any]] = []
    bridge_elements: list[str] = []
    for controller, controlled in CONTROLS.items():
        if controller in present and controlled in present:
            bridge = GENERATES[controller]
            conflict_pairs.append({"controller": controller, "controlled": controlled, "bridge": bridge, "bridge_present": bridge in present})
            bridge_elements.append(bridge)
    bridge_present = bool(conflict_pairs) and all(row["bridge_present"] for row in conflict_pairs)
    active_layers = {row["layer"] for row in stems + branches}
    natal_stems, natal_branches = _layer_context(chart)
    natal_counts, _ = _element_units(natal_stems, natal_branches)
    natal_present = {e for e, n in natal_counts.items() if n > 0}
    added = present - natal_present
    evidence: dict[str, Any] = {
        "evidence_compiled": True,
        "element_units": dict(counts),
        "unit_policy": "visible_stem_plus_each_branch_main_qi",
        "unit_reasons": reasons,
        "source_candidates_available": bool(sources),
        "source_elements": sources,
        "flow_graph_available": bool(present),
        "flow_chains": {k: v[0] for k, v in chains.items()},
        "destinations": destinations,
        "missing_generated_links": missing_links,
        "blocked": bool(missing_links),
        "conflict_pairs": conflict_pairs,
        "bridge_candidates_available": bool(conflict_pairs),
        "bridge_elements": list(dict.fromkeys(bridge_elements)),
        "bridge_present": bridge_present,
        "bridge_blocked": False,
        "bridge_added_by_active_layer": bool(set(bridge_elements) & added) and len(active_layers) > 1,
        "ordered_roles": False,
        "conflicting_roles": bool(conflict_pairs),
        "clear_candidate": False,
        "effective_force": max_count >= 2,
        "clarification_signal": False,
        "month_assembly": BRANCH_ELEMENT[chart["pillars"]["month"]["branch"]] in sources,
        "false_party_many": len(sources) > 1,
        "true_false_ambiguous": len(sources) > 1,
        "formed_momentum": max_count >= 5 and len(sources) == 1,
        "favored_overexposed": False,
        "hidden_inhibitor_activated": False,
        "visible_inhibitor": False,
        "majority_minority_available": bool(counts),
        "idle_candidates_available": False,
        "idle_elements": [],
        "idle_activated": False,
        "war_candidate": bool(conflict_pairs),
        "war_resolution_signal": bridge_present,
        "combination_candidate": False,
    }
    if annotations:
        _merge(evidence, annotations)
    return evidence


def compile_remedy_evidence(
    chart: Mapping[str, Any],
    *,
    qi_flow: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    qi = dict(qi_flow or compile_qi_flow_evidence(chart))
    counts = Counter(qi.get("element_units", {}))
    diseases: list[dict[str, Any]] = []
    medicines: list[dict[str, Any]] = []
    for element, count in counts.items():
        if count >= 4:
            disease = {"type": "element_excess", "element": element, "count": count, "focus": "whole_state_balance"}
            control = INVERSE_CONTROLS[element]
            drain = GENERATES[element]
            diseases.append(disease)
            medicines.extend([
                {"operation": "control", "element": control, "targets": element},
                {"operation": "drain", "element": drain, "targets": element},
            ])
    # Stable deduplication.
    seen: set[tuple[str, str, str]] = set()
    medicines = [m for m in medicines if not ((m["operation"], m["element"], m["targets"]) in seen or seen.add((m["operation"], m["element"], m["targets"])))]
    evidence: dict[str, Any] = {
        "evidence_compiled": True,
        "focus_selected": True,
        "focus": "whole_state_balance",
        "disease_candidates_available": bool(diseases),
        "disease_candidates": diseases,
        "medicine_candidates_available": bool(medicines),
        "medicine_candidates": medicines,
        "resolved_medicine": medicines[0] if diseases and medicines else None,
        "medicine_excess": False,
        "relative_force_available": bool(diseases),
        "relative_force": "medicine_unknown" if diseases else "not_applicable",
        "pure_earth_example_match": counts.get("earth", 0) >= 6,
        "category_candidate": None,
        "birth_stage_candidate": False,
        "growth_stage_candidate": False,
        "shenfeng_stem_interaction": False,
        "shenfeng_branch_interaction": False,
        "cover_head_candidate": False,
    }
    if annotations:
        _merge(evidence, annotations)
    return evidence


def _pair_relations(stems: list[dict[str, Any]], branches: list[dict[str, Any]], stage: str, state_id: str) -> list[dict[str, Any]]:
    relations: list[dict[str, Any]] = []
    active_stems = [x for x in stems if x["layer"] == stage]
    prior_stems = [x for x in stems if x["layer"] != stage]
    active_branches = [x for x in branches if x["layer"] == stage]
    prior_branches = [x for x in branches if x["layer"] != stage]

    def entity(row: Mapping[str, Any], kind: str) -> dict[str, Any]:
        return {"ref_id": row["ref_id"], "entity_type": kind, "layer": row["layer"], "label": row["symbol"]}

    for a in active_stems:
        for b in prior_stems:
            pair = frozenset({a["symbol"], b["symbol"]})
            rtype = None
            if pair in PAIR_RELATIONS["common.relation.stem.combine"]:
                rtype = "common.relation.stem.combine"
            elif STEM_ELEMENT[a["symbol"]] == STEM_ELEMENT[b["symbol"]]:
                rtype = "common.relation.same_element"
            elif CONTROLS[STEM_ELEMENT[a["symbol"]]] == STEM_ELEMENT[b["symbol"]] or CONTROLS[STEM_ELEMENT[b["symbol"]]] == STEM_ELEMENT[a["symbol"]]:
                rtype = "common.relation.element.controls"
            if rtype:
                relation = {"schema_version":"1.0.0","relation_id":f"relation.{state_id}.{len(relations)+1}","relation_type":rtype,"participants":[entity(a,"stem"),entity(b,"stem")],"truth":"true","resolution_status":"candidate","scope":{"stage":stage,"state_id":state_id},"reason_codes":["active_prior_pair_match"]}
                if rtype == "common.relation.element.controls":
                    a_element = STEM_ELEMENT[a["symbol"]]
                    b_element = STEM_ELEMENT[b["symbol"]]
                    if CONTROLS[a_element] == b_element:
                        controller, controlled = a, b
                    else:
                        controller, controlled = b, a
                    relation["attributes"] = {
                        "participant_roles": {
                            controller["ref_id"]: "controller",
                            controlled["ref_id"]: "controlled",
                        },
                        "controller_ref_id": controller["ref_id"],
                        "controlled_ref_id": controlled["ref_id"],
                        "controller_element": STEM_ELEMENT[controller["symbol"]],
                        "controlled_element": STEM_ELEMENT[controlled["symbol"]],
                    }
                    relation["reason_codes"].append("control_direction_explicit")
                relations.append(relation)
    for a in active_branches:
        for b in prior_branches:
            pair = frozenset({a["symbol"], b["symbol"]})
            for rtype in ("common.relation.branch.six_harmony","common.relation.branch.clash","common.relation.branch.harm","common.relation.branch.break"):
                if pair in PAIR_RELATIONS[rtype]:
                    relations.append({"schema_version":"1.0.0","relation_id":f"relation.{state_id}.{len(relations)+1}","relation_type":rtype,"participants":[entity(a,"branch"),entity(b,"branch")],"truth":"true","resolution_status":"candidate","scope":{"stage":stage,"state_id":state_id},"reason_codes":["active_prior_pair_match"]})
    return relations


def _temporal_flags(
    chart: Mapping[str, Any],
    *,
    stage: str,
    luck_cycle: Mapping[str, Any] | None,
    annual: Mapping[str, Any] | None,
    relations: list[dict[str, Any]],
    w02_natal: Mapping[str, Any],
) -> dict[str, Any]:
    active = annual if stage == "annual" else luck_cycle if stage == "luck" else None
    active_stem = active.get("stem") if active else None
    active_branch = active.get("branch") if active else None
    day = chart["day_master"]
    day_combine_pairs = {frozenset(pair) for pair in (("甲","己"),("乙","庚"),("丙","辛"),("丁","壬"),("戊","癸"))}
    natal_branches = {p["branch"] for p in chart["pillars"].values()}
    if luck_cycle:
        natal_branches.add(luck_cycle["branch"])
    trines = [set("申子辰"),set("巳酉丑"),set("寅午戌"),set("亥卯未")]
    assembly = bool(active_branch and any(group.issubset(natal_branches | {active_branch}) and not group.issubset(natal_branches) for group in trines))
    relation_types = [r["relation_type"] for r in relations]
    hidden_natal = {h["stem"] for p in chart["pillars"].values() for h in p.get("hidden_stems", [])}
    return {
        "state_chain_valid": stage in {"natal","luck","annual"},
        "recompute_complete": True,
        "baseline_available": bool(w02_natal),
        "active_layer_available": active is not None,
        "active_stem": active_stem,
        "active_branch": active_branch,
        "apparent_support_reversed": False,
        "apparent_inhibitor_reversed": False,
        "same_stem_class_candidate": bool(active_stem),
        "same_branch_class_candidate": bool(active_branch),
        "clash_candidate": "common.relation.branch.clash" in relation_types,
        "clash_urgency": "requires_position_resolver" if "common.relation.branch.clash" in relation_types else "not_applicable",
        "clash_severity": "requires_focus_resolver" if "common.relation.branch.clash" in relation_types else "not_applicable",
        "clash_neutralized": False,
        "paired_clash": False,
        "pattern_completed": assembly,
        "pattern_changed": assembly,
        "completion_inhibited": False,
        "change_rescued": False,
        "branch_activated_by_assembly": assembly,
        "hidden_exposed": bool(active_stem and active_stem in hidden_natal),
        "assembly_candidate": assembly,
        "assembly_urgency": "requires_position_resolver" if assembly else "not_applicable",
        "stem_war_candidate": "common.relation.element.controls" in relation_types,
        "luck_annual_clash": stage == "annual" and "common.relation.branch.clash" in relation_types,
        "luck_annual_harmony": stage == "annual" and "common.relation.branch.six_harmony" in relation_types,
        "luck_annual_same_kind": stage == "annual" and "common.relation.same_element" in relation_types,
        "conflict_candidate": any(t in relation_types for t in ("common.relation.branch.clash","common.relation.element.controls")),
        "rescue_available": False,
        "luck_annual_conflict": stage == "annual" and any(t in relation_types for t in ("common.relation.branch.clash","common.relation.element.controls")),
        "follow_candidate_changed": False,
        "transform_candidate_changed": bool(active_stem and frozenset({day,active_stem}) in day_combine_pairs),
        "relations_compiled": True,
    }


def compile_w03_evidence(
    chart: Mapping[str, Any],
    *,
    stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    stems, branches = _layer_context(chart, luck_cycle=luck_cycle, annual=annual)
    state_id = _state_id(chart, stage, luck_cycle=luck_cycle, annual=annual)
    relations = [] if stage == "natal" else _pair_relations(stems, branches, stage, state_id)
    w02_natal = compile_w02_evidence(chart)
    climate = compile_climate_evidence(chart, luck_cycle=luck_cycle, annual=annual)
    qi = compile_qi_flow_evidence(chart, luck_cycle=luck_cycle, annual=annual)
    remedy = compile_remedy_evidence(chart, qi_flow=qi)
    temporal = _temporal_flags(chart, stage=stage, luck_cycle=luck_cycle, annual=annual, relations=relations, w02_natal=w02_natal)
    composite = {
        "inputs_available": True,
        "w02_baseline_available": True,
        "climate_available": True,
        "qi_flow_available": True,
        "remedy_available": True,
        "temporal_available": stage in {"luck","annual"},
        "conflicts_available": bool(qi.get("conflict_pairs")) or temporal.get("conflict_candidate", False),
    }
    result = {"climate":climate,"qi_flow":qi,"remedy":remedy,"temporal":temporal,"composite":composite,"compiled_relations":relations}
    if annotations:
        _merge(result, annotations)
    return result


def _state_id(chart: Mapping[str, Any], stage: str, *, luck_cycle: Mapping[str, Any] | None = None, annual: Mapping[str, Any] | None = None) -> str:
    if stage == "natal":
        suffix = "natal"
    elif stage == "luck" and luck_cycle:
        suffix = f"luck.{luck_cycle['luck_cycle_id']}"
    elif stage == "annual" and annual:
        suffix = f"annual.{annual['annual_id']}"
    else:
        raise ValueError(f"incomplete active context for stage {stage}")
    return f"state.{chart['chart_id']}.{suffix}"


def _fact_for_state(chart_id: str, state_id: str, stage: str, predicate: str, value: Any) -> dict[str, Any]:
    return {
        "schema_version":"1.0.0","fact_id":f"fact.{state_id}.{predicate.rsplit('.',1)[-1]}",
        "subject":{"ref_id":chart_id,"entity_type":"chart","layer":stage},"predicate":predicate,"value":value,"truth":"true",
        "scope":{"stage":stage,"state_id":state_id},"source_type":"computed","algorithm_id":"classical_ziping.w03.compiler@1.0.0"
    }


def build_state_ir(
    chart: Mapping[str, Any],
    *,
    stage: str,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    parent_state_id: str | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    state_id = _state_id(chart, stage, luck_cycle=luck_cycle, annual=annual)
    w02 = compile_w02_evidence(chart)
    w03 = compile_w03_evidence(chart, stage=stage, luck_cycle=luck_cycle, annual=annual, annotations=annotations)
    active_context: dict[str, Any] = {"natal_chart_id":chart["chart_id"]}
    if luck_cycle:
        active_context["luck_cycle_id"] = luck_cycle["luck_cycle_id"]
    if annual:
        active_context["annual_id"] = annual["annual_id"]
    state: dict[str, Any] = {
        "schema_version":"1.0.0","state_id":state_id,"chart_id":chart["chart_id"],"stage":stage,
        "school_profile_id":"classical_ziping.composite@1.1.0","active_context":active_context,
        "facts":[_fact_for_state(chart["chart_id"],state_id,stage,"classical_ziping.temporal.recompute_complete",True)],
        "relations":w03.pop("compiled_relations"),"findings":[],
        "school_state":{"classical_ziping":{"w02":w02,"w03":w03}},
        "trace_id":f"trace.{state_id}",
    }
    if parent_state_id:
        state["parent_state_id"] = parent_state_id
    return state


def build_state_chain(chart: Mapping[str, Any], *, annotations_by_state: Mapping[str, Mapping[str, Any]] | None = None) -> list[dict[str, Any]]:
    annotations_by_state = annotations_by_state or {}
    natal = build_state_ir(chart, stage="natal", annotations=annotations_by_state.get("natal"))
    states = [natal]
    luck_states: dict[str,str] = {}
    luck_rows: dict[str,Mapping[str,Any]] = {}
    for luck in chart.get("luck_cycles", []):
        state = build_state_ir(chart, stage="luck", luck_cycle=luck, parent_state_id=natal["state_id"], annotations=annotations_by_state.get(luck["luck_cycle_id"]))
        states.append(state); luck_states[luck["luck_cycle_id"]]=state["state_id"]; luck_rows[luck["luck_cycle_id"]]=luck
    for annual in chart.get("annual_contexts", []):
        luck = next((row for row in chart.get("luck_cycles", []) if row["start_year"] <= annual["year"] <= row["end_year"]), None)
        parent = luck_states.get(luck["luck_cycle_id"]) if luck else natal["state_id"]
        state = build_state_ir(chart, stage="annual", luck_cycle=luck, annual=annual, parent_state_id=parent, annotations=annotations_by_state.get(annual["annual_id"]))
        if not luck:
            state["school_state"]["classical_ziping"]["w03"]["temporal"]["annual_parent_fallback"] = "natal_no_matching_luck"
        states.append(state)
    return states


def make_rule_context_w03(
    chart: Mapping[str, Any],
    *,
    stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "chart": deepcopy(chart),
        "facts": {"classical_ziping": {"w02": compile_w02_evidence(chart), "w03": compile_w03_evidence(chart, stage=stage, luck_cycle=luck_cycle, annual=annual, annotations=annotations)}},
    }


def climate_recipe_resolved(_args: dict[str, Any], context: dict[str, Any]) -> Truth:
    value = get_path(context, "facts.classical_ziping.w03.climate.resolved_candidate", None)
    return Truth.TRUE if value else Truth.FALSE


def qi_bridge_effective(_args: dict[str, Any], context: dict[str, Any]) -> Truth:
    present = get_path(context, "facts.classical_ziping.w03.qi_flow.bridge_present", None)
    blocked = get_path(context, "facts.classical_ziping.w03.qi_flow.bridge_blocked", None)
    if present is None or blocked is None:
        return Truth.UNKNOWN
    return Truth.TRUE if present and not blocked else Truth.FALSE


def medicine_matches_disease(_args: dict[str, Any], context: dict[str, Any]) -> Truth:
    disease = get_path(context, "facts.classical_ziping.w03.remedy.disease_candidates_available", None)
    medicine = get_path(context, "facts.classical_ziping.w03.remedy.resolved_medicine", None)
    excess = get_path(context, "facts.classical_ziping.w03.remedy.medicine_excess", None)
    if disease is None or excess is None:
        return Truth.UNKNOWN
    return Truth.TRUE if disease and medicine and not excess else Truth.FALSE


def temporal_state_recompiled(_args: dict[str, Any], context: dict[str, Any]) -> Truth:
    complete = get_path(context, "facts.classical_ziping.w03.temporal.recompute_complete", None)
    relations = get_path(context, "facts.classical_ziping.w03.temporal.relations_compiled", None)
    if complete is None or relations is None:
        return Truth.UNKNOWN
    return Truth.TRUE if complete and relations else Truth.FALSE


W03_RESOLVERS = {
    "classical_ziping.climate.recipe_resolved": climate_recipe_resolved,
    "classical_ziping.qi_flow.bridge_effective": qi_bridge_effective,
    "classical_ziping.remedy.medicine_matches_disease": medicine_matches_disease,
    "classical_ziping.temporal.state_recompiled": temporal_state_recompiled,
}
