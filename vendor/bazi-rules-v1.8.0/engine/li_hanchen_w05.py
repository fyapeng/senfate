"""Transparent W05 reference compiler for Li Hanchen's system.

This module formalizes rules extracted from 《八字预测真踪》. It is a
traditional-cultural rule interpreter, not a validated forecasting model. The
compiler deliberately exposes thresholds, preserves missing algorithms as
``unknown``, keeps natal classification fixed across temporal states, and blocks
high-risk deterministic outputs.
"""
from __future__ import annotations

import json
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping

from .classical_ziping_w02 import BRANCH_ELEMENT, CONTROLS, GENERATES, STEM_ELEMENT
from .classical_ziping_w03 import _layer_context, _pair_relations
from .reference_dsl import Truth, get_path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PARAMETERS = {
    "reference_dominance_margin": 2,
    "root_effective_min": 1,
    "twice_restrained_count": 2,
}

YANG_TOMB_MONTH = {"甲": "未", "丙": "戌", "戊": "戌", "庚": "丑", "壬": "辰"}
BRANCH_CLASHES = {frozenset(pair) for pair in (("子", "午"), ("丑", "未"), ("寅", "申"), ("卯", "酉"), ("辰", "戌"), ("巳", "亥"))}

STEMS = list("甲乙丙丁戊己庚辛壬癸")
BRANCHES = list("子丑寅卯辰巳午未申酉戌亥")
TOKEN_UNIVERSE = STEMS + BRANCHES
STEM_YINYANG = dict(zip(STEMS, ["yang", "yin"] * 5))
BRANCH_YINYANG = dict(zip(BRANCHES, ["yang", "yin"] * 6))
TEN_GOD_GROUP = {
    "正财": "wealth", "偏财": "wealth",
    "正官": "official", "七杀": "official", "七煞": "official",
    "正印": "resource", "偏印": "resource",
    "食神": "output", "伤官": "output",
    "比肩": "peer", "劫财": "peer",
}
TRANSFORM_PAIRS = {
    frozenset("甲己"): "earth",
    frozenset("乙庚"): "metal",
    frozenset("丙辛"): "water",
    frozenset("丁壬"): "wood",
    frozenset("戊癸"): "fire",
}
TRANSFORM_SLUG = {
    frozenset("甲己"): "pair_jia_ji",
    frozenset("乙庚"): "pair_yi_geng",
    frozenset("丙辛"): "pair_bing_xin",
    frozenset("丁壬"): "pair_ding_ren",
    frozenset("戊癸"): "pair_wu_gui",
}
STEM_PAIR_SLUG = {
    frozenset("甲己"): "jia_ji", frozenset("乙庚"): "yi_geng",
    frozenset("丙辛"): "bing_xin", frozenset("丁壬"): "ding_ren",
    frozenset("戊癸"): "wu_gui",
}
BRANCH_PAIR_SLUG = {
    frozenset("子丑"): "zi_chou", frozenset("寅亥"): "yin_hai",
    frozenset("卯戌"): "mao_xu", frozenset("辰酉"): "chen_you",
    frozenset("巳申"): "si_shen", frozenset("午未"): "wu_wei",
}
CLASH_SLUG = {
    frozenset("子午"): "zi_wu", frozenset("丑未"): "chou_wei",
    frozenset("寅申"): "yin_shen", frozenset("卯酉"): "mao_you",
    frozenset("辰戌"): "chen_xu", frozenset("巳亥"): "si_hai",
}
THREE_COMBINE = {
    frozenset("申子辰"): ("shen_zi_chen", "water"),
    frozenset("寅午戌"): ("yin_wu_xu", "fire"),
    frozenset("巳酉丑"): ("si_you_chou", "metal"),
    frozenset("亥卯未"): ("hai_mao_wei", "wood"),
}
MEETINGS = {
    frozenset("寅卯辰"): "yin_mao_chen", frozenset("亥子丑"): "hai_zi_chou",
    frozenset("申酉戌"): "shen_you_xu", frozenset("巳午未"): "si_wu_wei",
}
HALF_COMBINE = {
    frozenset("申子"): "shen_zi", frozenset("寅午"): "yin_wu",
    frozenset("巳酉"): "si_you", frozenset("亥卯"): "hai_mao",
    frozenset("子辰"): "zi_chen", frozenset("午戌"): "wu_xu",
    frozenset("酉丑"): "you_chou", frozenset("卯未"): "mao_wei",
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
    base = ROOT / "rules/li_hanchen/w05"
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
    """Seed directly stated catalogue/procedure rules; leave incomplete rules absent."""
    out: dict[str, Any] = {}
    for slug, meta in RULE_CONTRACT[group].items():
        statuses = set(meta["status"])
        if "incomplete" in statuses:
            continue
        if "historical_only" in statuses:
            continue
        out[slug] = True
    return out


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


def _token_group(token: str, day_element: str) -> str:
    element = STEM_ELEMENT[token] if token in STEM_ELEMENT else BRANCH_ELEMENT[token]
    return _relation_to_day(element, day_element)


def _natal_tokens(chart: Mapping[str, Any]) -> set[str]:
    return {
        *(chart["pillars"][p]["stem"] for p in ("year", "month", "day", "hour")),
        *(chart["pillars"][p]["branch"] for p in ("year", "month", "day", "hour")),
    }


def _month_restraint_reasons(chart: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Compile the author's month-command restraint rules transparently.

    This includes ordinary control/clash plus the book's explicit wet-earth
    dampening of fire and dry-earth weakening of metal.  Duplicate branches in
    different positions count as separate restraints, matching the author's
    “两次受制” examples.
    """
    month = chart["pillars"]["month"]["branch"]
    month_element = BRANCH_ELEMENT[month]
    reasons: list[dict[str, Any]] = []
    for pos in ("year", "day", "hour"):
        branch = chart["pillars"][pos]["branch"]
        element = BRANCH_ELEMENT[branch]
        reason = None
        if frozenset((month, branch)) in BRANCH_CLASHES:
            reason = "clash"
        elif month in {"巳", "午"} and branch in {"辰", "丑"}:
            reason = "wet_earth_dampens_fire"
        elif month in {"申", "酉"} and branch in {"未", "戌"}:
            reason = "dry_earth_weakens_metal"
        elif CONTROLS[element] == month_element:
            reason = "other_branch_controls_month"
        # Mere generation from the month branch to another branch is not
        # automatically counted as one of the author's two effective injuries.
        # v1.2 treated every drain as a restraint and over-expanded the rule.
        if reason:
            reasons.append({"position": pos, "branch": branch, "reason": reason})
    return reasons


def _visible_compound_structures(chart: Mapping[str, Any]) -> dict[str, Any]:
    day_element = STEM_ELEMENT[chart["day_master"]]
    rows = []
    for index, pos in enumerate(("year", "month", "day", "hour")):
        if pos == "day":
            continue
        stem = chart["pillars"][pos]["stem"]
        rows.append({
            "position": pos,
            "index": index,
            "stem": stem,
            "element": STEM_ELEMENT[stem],
            "group": _relation_to_day(STEM_ELEMENT[stem], day_element),
        })
    official_resource_pairs = []
    for source in rows:
        for target in rows:
            if source["group"] != "official" or target["group"] != "resource":
                continue
            if GENERATES[source["element"]] != target["element"]:
                continue
            if abs(source["index"] - target["index"]) != 1:
                continue
            official_resource_pairs.append({"official": source, "resource": target})
    return {
        "official_resource_generation": bool(official_resource_pairs),
        "official_resource_pairs": official_resource_pairs,
        "compound_labels": ["官印相生"] if official_resource_pairs else [],
    }


def compile_procedure() -> dict[str, Any]:
    evidence = _base_group("procedure")
    evidence.update({
        "evidence_compiled": True,
        "unpublished_modules": [
            "four_character_interaction_rule", "three_temporal_rules",
            "virtual_real_six_type_algorithm", "baishen", "reverse_rule",
            "natal_fengshui",
        ],
        "source_scope_value": "author_text_only",
    })
    return evidence


def compile_relations(
    chart: Mapping[str, Any], *, luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("relations")
    stems = [chart["pillars"][p]["stem"] for p in ("year", "month", "day", "hour")]
    branches = [chart["pillars"][p]["branch"] for p in ("year", "month", "day", "hour")]
    if luck_cycle:
        stems.append(luck_cycle["stem"]); branches.append(luck_cycle["branch"])
    if annual:
        stems.append(annual["stem"]); branches.append(annual["branch"])
    stem_set, branch_set = set(stems), set(branches)

    for pair, slug in STEM_PAIR_SLUG.items():
        present = pair.issubset(stem_set)
        evidence[f"stem_combine_{slug}_candidate"] = present
        evidence[f"stem_combine_{slug}_bind"] = present
    for pair, slug in BRANCH_PAIR_SLUG.items():
        present = pair.issubset(branch_set)
        evidence[f"branch_six_combine_{slug}_candidate"] = present
        evidence[f"branch_six_combine_{slug}_bind"] = present
    for pair, slug in CLASH_SLUG.items():
        evidence[f"branch_clash_{slug}"] = pair.issubset(branch_set)
    for group, (slug, _element) in THREE_COMBINE.items():
        present = group.issubset(branch_set)
        evidence[f"branch_three_combine_{slug}_candidate"] = present
        evidence[f"branch_three_combine_{slug}_bind"] = present
    for group, slug in MEETINGS.items():
        evidence[f"branch_meeting_{slug}"] = group.issubset(branch_set)
    for pair, slug in HALF_COMBINE.items():
        evidence[f"branch_half_combine_{slug}"] = pair.issubset(branch_set)
    evidence["branch_punishment_chou_xu"] = frozenset("丑戌").issubset(branch_set)
    evidence["branch_punishment_yin_si"] = frozenset("寅巳").issubset(branch_set)
    evidence["yin_si_generate_if_copresent"] = frozenset("寅巳").issubset(branch_set)
    evidence["yin_si_punish_if_not_copresent"] = not frozenset("寅巳").issubset(branch_set)
    evidence.update({
        "evidence_compiled": True,
        "active_stems": stems,
        "active_branches": branches,
        "stage": "annual" if annual else "luck" if luck_cycle else "natal",
        "polarity": {
            "stems": {s: STEM_YINYANG[s] for s in stems},
            "branches": {b: BRANCH_YINYANG[b] for b in branches},
        },
        "unresolved_activation_families": ["meeting", "half_combine", "four_character_rule"],
    })
    return _merge(evidence, annotations)


def _branch_attack_count(chart: Mapping[str, Any], target_position: str) -> tuple[int, list[str]]:
    target=chart["pillars"][target_position]["branch"]
    target_element=BRANCH_ELEMENT[target]
    count=0; reasons=[]
    for pos in ("year","month","day","hour"):
        if pos==target_position: continue
        branch=chart["pillars"][pos]["branch"]; element=BRANCH_ELEMENT[branch]
        if frozenset((target,branch)) in BRANCH_CLASHES:
            count+=1; reasons.append(f"{pos}:clash:{branch}")
        elif CONTROLS.get(element)==target_element:
            count+=1; reasons.append(f"{pos}:control:{branch}")
    return count,reasons


def _effective_unit(chart: Mapping[str, Any], unit: dict[str, Any]) -> tuple[bool,list[str]]:
    if unit["party"]!="support": return True,[]
    pos=unit["unit"].split('.')[1]
    reasons=[]
    if unit["unit"].startswith("branch"):
        attacks,attack_reasons=_branch_attack_count(chart,pos)
        if attacks>=2:
            reasons.extend(["twice_injured",*attack_reasons]); return False,reasons
        if pos=="year":
            day_element=STEM_ELEMENT[chart["day_master"]]
            month_stem_group=_token_group(chart["pillars"]["month"]["stem"],day_element)
            month_branch_group=_token_group(chart["pillars"]["month"]["branch"],day_element)
            if month_stem_group not in {"resource","peer"} and month_branch_group not in {"resource","peer"}:
                return False,["remote_year_branch_without_bridge"]
    elif pos=="year":
        day_element=STEM_ELEMENT[chart["day_master"]]
        seat_group=_token_group(chart["pillars"]["year"]["branch"],day_element)
        bridge_group=_token_group(chart["pillars"]["month"]["stem"],day_element)
        if seat_group not in {"resource","peer"} and bridge_group not in {"resource","peer"}:
            return False,["remote_year_stem_unrooted_and_interrupted"]
    return True,reasons


def compile_strength(
    chart: Mapping[str, Any], parameters: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    params = {**DEFAULT_PARAMETERS, **(parameters or {})}
    day_element = STEM_ELEMENT[chart["day_master"]]
    units: list[dict[str, Any]] = []
    for pos in ("year", "month", "hour"):
        token = chart["pillars"][pos]["stem"]
        group = _token_group(token, day_element)
        unit={"unit":f"stem.{pos}","token":token,"group":group,"party":"support" if group in {"resource","peer"} else "restraint"}
        unit["effective"],unit["ineffective_reasons"]=_effective_unit(chart,unit); units.append(unit)
    for pos in ("year", "month", "day", "hour"):
        token = chart["pillars"][pos]["branch"]
        group = _token_group(token, day_element)
        unit={"unit":f"branch.{pos}.main_qi","token":token,"group":group,"party":"support" if group in {"resource","peer"} else "restraint"}
        unit["effective"],unit["ineffective_reasons"]=_effective_unit(chart,unit)
        if chart["day_master"] in {"戊","己"} and token in {"辰","丑"} and unit["party"]=="support":
            unit["effective"]=False
            unit["ineffective_reasons"]=[*unit.get("ineffective_reasons",[]),"chen_chou_not_support_wu_ji"]
        units.append(unit)
    support=[u for u in units if u["party"]=="support"]
    restraint=[u for u in units if u["party"]=="restraint"]
    effective_support=[u for u in support if u["effective"]]
    effective_restraint=[u for u in restraint if u["effective"]]
    month_branch=chart["pillars"]["month"]["branch"]
    month_group=_token_group(month_branch,day_element); month_supportive=month_group in {"resource","peer"}
    if chart["day_master"] in {"戊","己"} and month_branch in {"辰","丑"}:
        month_supportive=False
    root_positions=[u["unit"] for u in effective_support if u["unit"].startswith("branch") and u["group"]=="peer"]
    difference=len(effective_support)-len(effective_restraint); margin=params["reference_dominance_margin"]
    raw_category="contested"
    if difference>=margin or (month_supportive and difference>=0): raw_category="strong"
    elif difference<=-margin or ((not month_supportive) and difference<=0): raw_category="weak"
    month_restraints=_month_restraint_reasons(chart)
    month_twice_restrained=len(month_restraints)>=params["twice_restrained_count"]
    yang_tomb_month=YANG_TOMB_MONTH.get(chart["day_master"])==month_branch

    # v1.4 author-specific repeated peer/output boundary.  The source states
    # that repeated same-polarity peer stems together with repeated output
    # branches are read without the ordinary reverse-treatment shortcut.  The
    # trigger is expressed by roles rather than one fixed 壬/寅 chart.
    visible_peer_stems=[
        chart["pillars"][pos]["stem"] for pos in ("year","month","hour")
        if _token_group(chart["pillars"][pos]["stem"],day_element)=="peer"
        and STEM_YINYANG[chart["pillars"][pos]["stem"]]==STEM_YINYANG[chart["day_master"]]
    ]
    output_branches=[
        chart["pillars"][pos]["branch"] for pos in ("year","month","day","hour")
        if _token_group(chart["pillars"][pos]["branch"],day_element)=="output"
    ]
    repeated_peer_stems=any(visible_peer_stems.count(x)>=2 for x in set(visible_peer_stems))
    repeated_output_branches=any(output_branches.count(x)>=2 for x in set(output_branches))
    month_stem_group=_token_group(chart["pillars"]["month"]["stem"],day_element)
    repeated_peer_output_no_reverse=bool(
        (not month_supportive) and month_stem_group=="resource"
        and repeated_peer_stems and repeated_output_branches
    )
    visible_official_stems=[
        chart["pillars"][pos]["stem"] for pos in ("year","month","hour")
        if _token_group(chart["pillars"][pos]["stem"],day_element)=="official"
    ]
    peer_branches=[
        chart["pillars"][pos]["branch"] for pos in ("year","month","day","hour")
        if _token_group(chart["pillars"][pos]["branch"],day_element)=="peer"
    ]
    repeated_official_stems=any(visible_official_stems.count(x)>=2 for x in set(visible_official_stems))
    repeated_peer_branches=any(peer_branches.count(x)>=2 for x in set(peer_branches))
    repeated_official_output_peer_no_reverse=bool(
        (not month_supportive) and repeated_official_stems
        and repeated_output_branches and repeated_peer_branches
    )

    wet_earth_branches=[
        chart["pillars"][pos]["branch"] for pos in ("year","month","day","hour")
        if chart["pillars"][pos]["branch"] in {"辰","丑"}
    ]
    visible_rows=[
        {"position":pos,"stem":chart["pillars"][pos]["stem"],
         "element":STEM_ELEMENT[chart["pillars"][pos]["stem"]],
         "group":_token_group(chart["pillars"][pos]["stem"],day_element)}
        for pos in ("year","month","hour")
    ]
    official_rows=[x for x in visible_rows if x["group"]=="official"]
    wealth_rows=[x for x in visible_rows if x["group"]=="wealth"]
    wealth_generates_official=any(
        GENERATES.get(w["element"])==o["element"] for w in wealth_rows for o in official_rows
    )
    day_branch_resource=_token_group(chart["pillars"]["day"]["branch"],day_element)=="resource"
    wet_earth_suppresses_fire_resource_for_official_follow=bool(
        day_element=="earth" and day_branch_resource
        and BRANCH_ELEMENT[chart["pillars"]["day"]["branch"]]=="fire"
        and len(wet_earth_branches)>=2 and official_rows and wealth_generates_official
    )

    # v1.6 source-grounded strong boundary: when the day master is visibly
    # accompanied by a same-group month stem and receives two close resource
    # branches (including the day seat), the author reads the chart as strong
    # even when ordinary attack-count pruning would otherwise remove those
    # resource units.  The condition is role-based and applies across stems.
    month_peer_visible = month_stem_group == "peer"
    close_resource_branches = [
        chart["pillars"][pos]["branch"] for pos in ("year", "day", "hour")
        if _token_group(chart["pillars"][pos]["branch"], day_element) == "resource"
    ]
    seated_resource_with_visible_peer_strong = bool(
        month_peer_visible
        and _token_group(chart["pillars"]["day"]["branch"], day_element) == "resource"
        and len(close_resource_branches) >= 2
    )

    # v1.8: effective support is position-sensitive. These author-system
    # overrides are expressed by roles and relations rather than chart IDs.
    month_branch_token=chart["pillars"]["month"]["branch"]
    year_branch_token=chart["pillars"]["year"]["branch"]
    support_branch_rows=[u for u in support if u["unit"].startswith("branch")]
    month_controls_support_branches=[u for u in support_branch_rows if CONTROLS.get(BRANCH_ELEMENT[month_branch_token])==BRANCH_ELEMENT[u["token"]]]
    year_peer_clashed_by_month=bool(
        _token_group(year_branch_token,day_element)=="peer" and frozenset((year_branch_token,month_branch_token)) in BRANCH_CLASHES
    )
    visible_wealth_controls_visible_resource=any(
        w["group"]=="wealth" and r["group"]=="resource" and CONTROLS.get(w["element"])==r["element"]
        for w in visible_rows for r in visible_rows
    )
    month_wealth_suppresses_support_network=bool(
        month_group=="wealth" and len(month_controls_support_branches)>=2
        and year_peer_clashed_by_month and visible_wealth_controls_visible_resource
    )
    all_visible_peer_stems=[x["stem"] for x in visible_rows if x["group"]=="peer"]
    multiple_visible_peers_repeated_output_weak=bool(
        (not month_supportive) and len(all_visible_peer_stems)>=2 and repeated_output_branches
    )
    hour_resource_stem=next((x for x in visible_rows if x["position"]=="hour" and x["group"]=="resource"),None)
    month_wealth_stem=next((x for x in visible_rows if x["position"]=="month" and x["group"]=="wealth"),None)
    day_resource_branch=_token_group(chart["pillars"]["day"]["branch"],day_element)=="resource"
    hour_wealth_branch=_token_group(chart["pillars"]["hour"]["branch"],day_element)=="wealth"
    resource_stem_neutralized=bool(
        hour_resource_stem and month_wealth_stem
        and (CONTROLS.get(month_wealth_stem["element"])==hour_resource_stem["element"]
             or frozenset((month_wealth_stem["stem"],hour_resource_stem["stem"])) in TRANSFORM_PAIRS)
    )
    seated_resource_controlled_by_hour_wealth=bool(
        day_resource_branch and hour_wealth_branch
        and CONTROLS.get(BRANCH_ELEMENT[chart["pillars"]["hour"]["branch"]])==BRANCH_ELEMENT[chart["pillars"]["day"]["branch"]]
    )
    resource_network_neutralized_for_follow=bool(
        resource_stem_neutralized and seated_resource_controlled_by_hour_wealth
    )

    any_no_reverse=bool(repeated_peer_output_no_reverse or repeated_official_output_peer_no_reverse)
    if month_wealth_suppresses_support_network:
        category="weak"; category_basis="month_wealth_suppresses_support_network"
    elif multiple_visible_peers_repeated_output_weak:
        category="weak"; category_basis="multiple_visible_peers_repeated_output_weak"
    elif seated_resource_with_visible_peer_strong:
        category="strong"; category_basis="seated_resource_with_visible_peer_strong"
    elif wet_earth_suppresses_fire_resource_for_official_follow:
        category="weak"; category_basis="wet_earth_suppresses_fire_resource_for_official_follow"
    elif any_no_reverse:
        category="weak"; category_basis=("repeated_peer_output_no_reverse" if repeated_peer_output_no_reverse else "repeated_official_output_peer_no_reverse")
    elif yang_tomb_month:
        category="weak"; category_basis="yang_day_master_in_tomb_month_not_strong"
    elif month_twice_restrained:
        # Two injuries change the force of the month command, but do not
        # mechanically reverse a chart whose remaining effective evidence is
        # still clearly weak.
        if month_supportive:
            category="weak"
        elif raw_category=="weak" and difference<0:
            category="weak"
        else:
            category="strong"
        category_basis="month_command_twice_restrained"
    else:
        category=raw_category; category_basis="transparent_two_party_evidence"
    evidence={
        "evidence_compiled":True,"method":"transparent_two_party_evidence_with_effective_support","hidden_numeric_score":False,
        "day_element":day_element,"seven_units":units,"support_evidence":support,"restraint_evidence":restraint,
        "effective_support_evidence":effective_support,"effective_restraint_evidence":effective_restraint,
        "support_count":len(support),"restraint_count":len(restraint),
        "effective_support_count":len(effective_support),"effective_restraint_count":len(effective_restraint),
        "remote_year_support_ignored":any((not u["effective"]) and "remote_year_support" in u.get("ineffective_reasons",[]) for u in support),
        "twice_attacked_support_ignored":any((not u["effective"]) and "attacked_twice" in u.get("ineffective_reasons",[]) for u in support),
        "effective_support_resolver_used":True,
        "chen_chou_support_removed":any("chen_chou_not_support_wu_ji" in u.get("ineffective_reasons",[]) for u in units),
        "difference":difference,"month_group":month_group,"month_supportive":month_supportive,"root_positions":root_positions,
        "root_effective":len(root_positions)>=params["root_effective_min"],"raw_category":raw_category,"category":category,
        "category_basis":category_basis,"yang_tomb_month":yang_tomb_month,"month_restraint_reasons":month_restraints,
        "month_restraint_count":len(month_restraints),"month_twice_restrained":month_twice_restrained,
        "visible_peer_stems":visible_peer_stems,"visible_official_stems":visible_official_stems,
        "output_branches":output_branches,"peer_branches":peer_branches,
        "repeated_peer_stems":repeated_peer_stems,"repeated_official_stems":repeated_official_stems,
        "repeated_peer_branches":repeated_peer_branches,"repeated_output_branches":repeated_output_branches,
        "repeated_peer_output_no_reverse":repeated_peer_output_no_reverse,
        "repeated_official_output_peer_no_reverse":repeated_official_output_peer_no_reverse,
        "wet_earth_branches":wet_earth_branches,"wealth_generates_official":wealth_generates_official,
        "wet_earth_suppresses_fire_resource_for_official_follow":wet_earth_suppresses_fire_resource_for_official_follow,
        "month_peer_visible":month_peer_visible,"close_resource_branches":close_resource_branches,
        "seated_resource_with_visible_peer_strong":seated_resource_with_visible_peer_strong,
        "month_controls_support_branches":[u["unit"] for u in month_controls_support_branches],
        "year_peer_clashed_by_month":year_peer_clashed_by_month,
        "visible_wealth_controls_visible_resource":visible_wealth_controls_visible_resource,
        "month_wealth_suppresses_support_network":month_wealth_suppresses_support_network,
        "all_visible_peer_stems":all_visible_peer_stems,
        "multiple_visible_peers_repeated_output_weak":multiple_visible_peers_repeated_output_weak,
        "resource_stem_neutralized":resource_stem_neutralized,
        "seated_resource_controlled_by_hour_wealth":seated_resource_controlled_by_hour_wealth,
        "resource_network_neutralized_for_follow":resource_network_neutralized_for_follow,
        "thresholds":params,
    }
    return _merge(evidence,annotations)


def compile_transform(
    chart: Mapping[str, Any], strength: Mapping[str, Any],
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("transform")
    day = chart["day_master"]
    candidates: list[dict[str, Any]] = []
    for pos, adjacent_slug in (("month", "day_month_adjacent"), ("hour", "day_hour_adjacent")):
        other = chart["pillars"][pos]["stem"]
        pair = frozenset((day, other))
        if pair in TRANSFORM_PAIRS:
            candidates.append({
                "position": pos,
                "other_stem": other,
                "pair_slug": TRANSFORM_SLUG[pair],
                "transform_element": TRANSFORM_PAIRS[pair],
                "adjacent_rule": adjacent_slug,
            })
    for slug in TRANSFORM_SLUG.values():
        evidence[slug] = any(c["pair_slug"] == slug for c in candidates)
    one_to_one = len(candidates) == 1
    transform_element = candidates[0]["transform_element"] if one_to_one else None
    branch_elements = [BRANCH_ELEMENT[chart["pillars"][p]["branch"]] for p in ("year", "month", "day", "hour")]
    transform_element_strong = bool(transform_element and branch_elements.count(transform_element) >= 2)
    month_element=BRANCH_ELEMENT[chart["pillars"]["month"]["branch"]]
    month_supports_transform=bool(transform_element and (month_element==transform_element or GENERATES.get(month_element)==transform_element))
    disruptor_element=CONTROLS.get(transform_element) if transform_element else None
    disruptor_present=bool(disruptor_element and branch_elements.count(disruptor_element)>=2)
    changing_stems_weak = strength["category"] != "strong"
    confirmed = (
        one_to_one and transform_element_strong and month_supports_transform and changing_stems_weak
        and not disruptor_present
        and not strength.get("wet_earth_suppresses_fire_resource_for_official_follow")
    )
    evidence.update({
        "evidence_compiled": True,
        "candidates": candidates,
        "one_to_one": one_to_one,
        "transform_element": transform_element,
        "transform_element_strong": transform_element_strong,
        "month_supports_transform": month_supports_transform,
        "disruptor_present": disruptor_present,
        "changing_stems_weak": changing_stems_weak,
        "confirmed": confirmed,
        "natal_only": True,
    })
    evidence = _merge(evidence, annotations)
    if annotations and "confirmed" in annotations:
        evidence["confirmed"] = bool(annotations["confirmed"])
    return evidence


def compile_classification(
    chart: Mapping[str, Any], strength: Mapping[str, Any], transform: Mapping[str, Any],
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence=_base_group("classification")
    for slug in ("fuyi_class","cong_strong_class","cong_weak_class","transform_class",
        "cong_strong_subtype_peer","cong_strong_subtype_resource","cong_weak_subtype_official",
        "cong_weak_subtype_output","cong_weak_subtype_wealth","cong_weak_generic"):
        evidence[slug]=False
    group_counts=Counter(u["group"] for u in strength["seven_units"] if u.get("effective",True))
    opposition_effective=strength.get("effective_restraint_count",strength["restraint_count"])>=DEFAULT_PARAMETERS["twice_restrained_count"]
    support_effective=strength.get("effective_support_count",strength["support_count"])>=DEFAULT_PARAMETERS["twice_restrained_count"]
    if strength.get("repeated_peer_output_no_reverse") or strength.get("repeated_official_output_peer_no_reverse"):
        support_effective=False
    if strength.get("wet_earth_suppresses_fire_resource_for_official_follow"):
        support_effective=False
    explicit_no_reverse=bool(
        strength.get("repeated_peer_output_no_reverse")
        or strength.get("repeated_official_output_peer_no_reverse")
    )
    # Only an effective hour-stem resource is treated as an adjacent, visible
    # rescue that can block following. A month-stem resource is not enough by
    # itself, and the author's explicit repeated-output no-reverse boundaries
    # take precedence over this local rescue.
    hour_resource_stem_effective=any(
        u.get("group")=="resource" and u.get("unit")=="stem.hour" and u.get("effective")
        for u in strength.get("seven_units",[])
    )
    hour_resource_branch_rooted=any(
        u.get("group")=="resource" and u.get("unit")=="branch.hour.main_qi"
        for u in strength.get("seven_units",[])
    )
    visible_near_resource=bool(hour_resource_stem_effective and hour_resource_branch_rooted)
    visible_near_resource_prevents_follow=bool(
        strength.get("category")=="weak"
        and visible_near_resource
        and not explicit_no_reverse
        and not strength.get("resource_network_neutralized_for_follow")
    )
    if visible_near_resource_prevents_follow:
        support_effective=True
    if strength.get("resource_network_neutralized_for_follow"):
        support_effective=False
    # In the author's tomb-month examples, a visible resource plus an actual
    # seated storage/root prevents an automatic follow classification even if
    # the storage branch is under pressure.
    if (strength.get("yang_tomb_month") and strength.get("support_count",0)>=2
        and any(u.get("group")=="resource" and u.get("effective") for u in strength.get("seven_units",[]))):
        support_effective=True
    if transform.get("confirmed"): classification="transform"
    elif strength["category"]=="strong": classification="fuyi_strong" if opposition_effective else "cong_strong"
    elif strength["category"]=="weak": classification="fuyi_weak" if support_effective else "cong_weak"
    else: classification="unknown"

    compound=_visible_compound_structures(chart)
    visible=[]
    for pos in ("year","month","hour"):
        token=chart["pillars"][pos]["stem"]
        visible.append({"position":pos,"token":token,"group":_token_group(token,STEM_ELEMENT[chart["day_master"]]),
                        "ten_god":chart["pillars"][pos].get("stem_ten_god") or chart["ten_god_map"].get(token)})
    official_total=group_counts.get("official",0)
    visible_zhengguan_count=sum(x.get("ten_god")=="正官" for x in visible)
    output_visible=any(x["group"]=="output" for x in visible)
    visible_wealth_tokens=[x["token"] for x in visible if x["group"]=="wealth"]
    repeated_visible_wealth=any(visible_wealth_tokens.count(x)>=2 for x in set(visible_wealth_tokens))
    hurt_exhausted=bool(
        classification=="cong_weak" and output_visible and visible_zhengguan_count==0 and not support_effective
        and (not visible_wealth_tokens or repeated_visible_wealth)
    )
    if hurt_exhausted:
        compound["hurt_output_exhausted"]=True; compound.setdefault("compound_labels",[]).append("伤官伤尽")
    if strength.get("wet_earth_suppresses_fire_resource_for_official_follow"):
        compound["wet_earth_suppresses_fire_resource"]=True
        wet_tokens = "".join(str(x) for x in strength.get("wet_earth_branches", []))
        resource_token = chart["pillars"]["day"]["branch"]
        official_token = next((x["token"] for x in visible if x["group"] == "official"), "官星")
        wealth_token = next((x["token"] for x in visible if x["group"] == "wealth"), "财星")
        compound.setdefault("compound_labels",[]).extend([
            f"{wet_tokens}湿土晦{resource_token}火印" if wet_tokens else "湿土晦火印",
            f"{wealth_token}水财星生{official_token}木官星",
        ])

    position_actions=[]
    active_stems=[
        {"position":pos,"stem":chart["pillars"][pos]["stem"],"element":STEM_ELEMENT[chart["pillars"][pos]["stem"]],
         "ten_god":chart["pillars"][pos].get("stem_ten_god") or chart["ten_god_map"].get(chart["pillars"][pos]["stem"])}
        for pos in ("year","month","day","hour")
    ]
    for i,a in enumerate(active_stems):
        for b in active_stems[i+1:]:
            if GENERATES.get(a["element"])==b["element"]:
                position_actions.append({"type":"generate","source":a,"target":b,"label":f"{a['stem']}生{b['stem']}"})
            elif GENERATES.get(b["element"])==a["element"]:
                position_actions.append({"type":"generate","source":b,"target":a,"label":f"{b['stem']}生{a['stem']}"})
            if CONTROLS.get(a["element"])==b["element"]:
                position_actions.append({"type":"control","source":a,"target":b,"label":f"{a['stem']}制{b['stem']}"})
            elif CONTROLS.get(b["element"])==a["element"]:
                position_actions.append({"type":"control","source":b,"target":a,"label":f"{b['stem']}制{a['stem']}"})
            pair=frozenset((a["stem"],b["stem"]))
            if pair in TRANSFORM_PAIRS:
                position_actions.append({"type":"combine","source":a,"target":b,"label":f"{a['stem']}{b['stem']}相合"})

    subtype=None
    if classification.startswith("fuyi"): evidence["fuyi_class"]=True
    elif classification=="cong_strong":
        evidence["cong_strong_class"]=True; subtype=max(("peer","resource"),key=lambda g:group_counts[g]); evidence[f"cong_strong_subtype_{subtype}"]=True
    elif classification=="cong_weak":
        evidence["cong_weak_class"]=True
        if strength.get("wet_earth_suppresses_fire_resource_for_official_follow"): subtype="official"
        elif hurt_exhausted: subtype="output"
        else:
            order={"hour":0,"month":1,"year":2}
            restraint_visible=sorted((x for x in visible if x["group"] in {"wealth","official","output"}),key=lambda x:order[x["position"]])
            subtype=restraint_visible[0]["group"] if restraint_visible else max(("wealth","official","output"),key=lambda g:group_counts[g])
        if subtype in {"wealth","official","output"}: evidence[f"cong_weak_subtype_{subtype}"]=True
        else: evidence["cong_weak_generic"]=True
    elif classification=="transform": evidence["transform_class"]=True
    evidence.update({"evidence_compiled":True,"classification":classification,"classification_subtype":subtype,
        "strength_category":strength["category"],"opposition_effective":opposition_effective,"support_effective":support_effective,
        "group_counts":dict(group_counts),"special_strength_basis":strength.get("category_basis"),
        "repeated_peer_output_no_reverse":bool(strength.get("repeated_peer_output_no_reverse")),
        "repeated_official_output_peer_no_reverse":bool(strength.get("repeated_official_output_peer_no_reverse")),
        "wet_earth_suppresses_fire_resource_for_official_follow":bool(strength.get("wet_earth_suppresses_fire_resource_for_official_follow")),
        "visible_near_resource_prevents_follow":visible_near_resource_prevents_follow,
        "resource_network_neutralized_for_follow":bool(strength.get("resource_network_neutralized_for_follow")),
        "month_wealth_suppresses_support_network":bool(strength.get("month_wealth_suppresses_support_network")),
        "multiple_visible_peers_repeated_output_weak":bool(strength.get("multiple_visible_peers_repeated_output_weak")),
        "compound_structures":compound,"hurt_output_exhausted":hurt_exhausted,
        "position_actions":position_actions,"position_action_present":bool(position_actions),
        "repeated_visible_wealth":repeated_visible_wealth,"fixed_across_temporal_states":True})
    evidence["fuyi_strong_opposition_effective"]=classification=="fuyi_strong"
    evidence["fuyi_weak_support_effective"]=classification=="fuyi_weak"
    return _merge(evidence,annotations)


def compile_useful_party(
    classification: Mapping[str, Any], chart: Mapping[str, Any],
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence=_base_group("useful_party")
    choice_slugs=["strong_fuyi_useful","strong_fuyi_unfavorable","weak_fuyi_useful","weak_fuyi_unfavorable",
        "cong_strong_useful","cong_strong_unfavorable","cong_weak_useful","cong_weak_unfavorable","transform_useful_separate"]
    for slug in choice_slugs: evidence[slug]=False
    cls=classification["classification"]; subtype=classification.get("classification_subtype")
    useful=[]; unfavorable=[]; conditional=[]
    if cls=="fuyi_strong": useful=["wealth","official","output"]; unfavorable=["resource","peer"]; evidence["strong_fuyi_useful"]=evidence["strong_fuyi_unfavorable"]=True
    elif cls=="fuyi_weak": useful=["resource","peer"]; unfavorable=["wealth","official","output"]; evidence["weak_fuyi_useful"]=evidence["weak_fuyi_unfavorable"]=True
    elif cls=="cong_strong": useful=["resource","peer"]; unfavorable=["wealth","official"]; conditional=["output"]; evidence["cong_strong_useful"]=evidence["cong_strong_unfavorable"]=True
    elif cls=="cong_weak": useful=["wealth","official","output"]; unfavorable=["resource","peer"]; evidence["cong_weak_useful"]=evidence["cong_weak_unfavorable"]=True
    elif cls=="transform": evidence["transform_useful_separate"]=True; useful=["transform_element","generators_of_transform","controllers_of_disruptors"]; unfavorable=["disruptors_of_transform"]
    day_element=STEM_ELEMENT[chart["day_master"]]; token_roles={}
    for token in TOKEN_UNIVERSE:
        group=_token_group(token,day_element)
        token_roles[token]="useful" if group in useful else "unfavorable" if group in unfavorable else "conditional" if group in conditional else "unknown"
    # In this author system 辰丑 do not directly support 戊己.  They therefore
    # cannot be promoted into ordinary useful peer tokens merely because their
    # public element is earth; keep them conditional for later position rules.
    if chart["day_master"] in {"戊","己"}:
        for token in ("辰","丑"):
            token_roles[token]="conditional"
    rows=[]
    for idx,pos in enumerate(("year","month","day","hour")):
        pillar=chart["pillars"][pos]
        if pos!="day": rows.append({"token":pillar["stem"],"position":pos,"index":idx,"kind":"stem","group":_token_group(pillar["stem"],day_element)})
        rows.append({"token":pillar["branch"],"position":pos,"index":idx,"kind":"branch","group":_token_group(pillar["branch"],day_element)})
    target_group=subtype if cls in {"cong_weak","cong_strong"} else None
    if target_group:
        # Follow-pattern subtypes prioritize the concrete visible token that
        # carries the followed party, while retaining deterministic position
        # ordering for ties.
        def rank(row):
            pos_priority={"hour":0,"month":1,"year":2,"day":3}
            return (0 if row["group"]==target_group else 1,pos_priority[row["position"]],0 if row["kind"]=="stem" else 1)
        useful_rows=sorted((r for r in rows if token_roles.get(r["token"])=="useful"),key=rank)
        unfavorable_rows=sorted((r for r in rows if token_roles.get(r["token"])=="unfavorable"),key=rank)
    else:
        # Preserve the author's original visible-position reading order for
        # ordinary supporting/controlling classifications.  This also keeps
        # duplicate branch tokens from displacing a nearer stem token after
        # de-duplication (e.g. 戌、丙 rather than 丙、戌).
        order_keys=[("day","branch"),("month","branch"),("month","stem"),("year","stem"),("hour","stem"),("year","branch"),("hour","branch")]
        order_index={key:i for i,key in enumerate(order_keys)}
        def ordinary_rank(row):
            return order_index.get((row["position"],row["kind"]),len(order_index))
        useful_rows=sorted((r for r in rows if token_roles.get(r["token"])=="useful"),key=ordinary_rank)
        unfavorable_rows=sorted((r for r in rows if token_roles.get(r["token"])=="unfavorable"),key=ordinary_rank)
    paired_hour_useful_override=[]
    hour_stem=chart["pillars"]["hour"]["stem"]
    hour_branch=chart["pillars"]["hour"]["branch"]
    if cls.startswith("fuyi") and token_roles.get(hour_stem)=="useful" and token_roles.get(hour_branch)=="useful":
        paired_hour_useful_override=[hour_stem,hour_branch]
        hour_rows=[r for r in rows if r["position"]=="hour" and r["token"] in set(paired_hour_useful_override)]
        useful_rows=hour_rows+[r for r in useful_rows if r["token"] not in set(paired_hour_useful_override)]
    # The day master itself belongs to the peer group and may be named as the
    # principal unfavorable token in strong ordinary charts.
    day_master_unfavorable = cls=="fuyi_strong" and token_roles.get(chart["day_master"])=="unfavorable"
    if day_master_unfavorable:
        unfavorable_rows=[{"token":chart["day_master"],"position":"day","kind":"stem","group":"peer"}]+[r for r in unfavorable_rows if r["token"]!=chart["day_master"]]

    reverse_useful_tokens=[]; reverse_unfavorable_tokens=[]; override_reasons=[]
    hour_group=_token_group(chart["pillars"]["hour"]["stem"],day_element)
    month_group=_token_group(chart["pillars"]["month"]["stem"],day_element)
    hour_element=STEM_ELEMENT[chart["pillars"]["hour"]["stem"]]
    month_element=STEM_ELEMENT[chart["pillars"]["month"]["stem"]]
    same_polarity_hour_month=STEM_YINYANG[chart["pillars"]["hour"]["stem"]]==STEM_YINYANG[chart["pillars"]["month"]["stem"]]
    if (cls=="fuyi_weak" and hour_group=="official" and month_group=="resource"
        and GENERATES.get(hour_element)==month_element and same_polarity_hour_month):
        token=chart["pillars"]["hour"]["stem"]
        reverse_useful_tokens.append(token); token_roles[token]="useful"
        override_reasons.append(f"{token}官生月干印，同宗反断为用")
    if cls=="fuyi_weak" and classification.get("multiple_visible_peers_repeated_output_weak") and hour_group=="resource":
        token=chart["pillars"]["hour"]["stem"]
        reverse_unfavorable_tokens.append(token); token_roles[token]="unfavorable"
        override_reasons.append(f"{token}印在重复比劫—食伤边界中反断为忌")
    if reverse_useful_tokens:
        override_rows=[r for r in rows if r["token"] in set(reverse_useful_tokens)]
        useful_rows=override_rows+[r for r in useful_rows if r["token"] not in set(reverse_useful_tokens)]
        unfavorable_rows=[r for r in unfavorable_rows if r["token"] not in set(reverse_useful_tokens)]
    if reverse_unfavorable_tokens:
        override_rows=[r for r in rows if r["token"] in set(reverse_unfavorable_tokens)]
        unfavorable_rows=override_rows+[r for r in unfavorable_rows if r["token"] not in set(reverse_unfavorable_tokens)]
        useful_rows=[r for r in useful_rows if r["token"] not in set(reverse_unfavorable_tokens)]
    if cls=="cong_weak" and subtype=="wealth":
        month_wealth_row=next((r for r in rows if r["position"]=="month" and r["kind"]=="stem" and r["group"]=="wealth"),None)
        month_output_row=next((r for r in rows if r["position"]=="month" and r["kind"]=="branch" and r["group"]=="output"),None)
        preferred=[r for r in (month_wealth_row,month_output_row) if r and token_roles.get(r["token"])=="useful"]
        if preferred:
            pref_tokens={r["token"] for r in preferred}
            useful_rows=preferred+[r for r in useful_rows if r["token"] not in pref_tokens]
            override_reasons.append("从弱财型优先月干财与月令食伤")

    near_day_branch_override=None
    day_branch=chart["pillars"]["day"]["branch"]
    month_branch=chart["pillars"]["month"]["branch"]
    if cls=="fuyi_weak" and frozenset((day_branch,month_branch)) in BRANCH_CLASHES:
        near_day_branch_override=day_branch
        token_roles[day_branch]="useful"
        override_row=next((r for r in rows if r["position"]=="day" and r["kind"]=="branch"),None)
        if override_row:
            useful_rows=[override_row]+[r for r in useful_rows if r["token"]!=day_branch]
    adverse_generation_actions=[]
    for action in classification.get("position_actions",[]):
        if action.get("type")!="generate": continue
        source=action.get("source",{}).get("stem"); target=action.get("target",{}).get("stem")
        if source and target and token_roles.get(source)=="unfavorable" and token_roles.get(target)=="unfavorable":
            adverse_generation_actions.append({"label":action.get("label"),"source":source,"target":target})

    evidence.update({"evidence_compiled":True,"classification":cls,"classification_subtype":subtype,
        "useful_groups":useful,"unfavorable_groups":unfavorable,"conditional_groups":conditional,"token_roles":token_roles,"no_idle_god":True,
        "primary_useful_tokens":list(dict.fromkeys(r["token"] for r in useful_rows)),
        "primary_unfavorable_tokens":list(dict.fromkeys(r["token"] for r in unfavorable_rows)),
        "near_day_branch_useful_override":near_day_branch_override,
        "paired_hour_useful_override":paired_hour_useful_override,
        "paired_hour_useful_override_present":bool(paired_hour_useful_override),
        "day_master_unfavorable":day_master_unfavorable,
        "reverse_useful_tokens":reverse_useful_tokens,
        "reverse_unfavorable_tokens":reverse_unfavorable_tokens,
        "token_override_reasons":override_reasons,
        "token_level_override_present":bool(reverse_useful_tokens or reverse_unfavorable_tokens),
        "adverse_generation_actions":adverse_generation_actions,
        "adverse_generation_present":bool(adverse_generation_actions),
        "primary_useful_near_day_master":bool(near_day_branch_override or paired_hour_useful_override or (useful_rows and useful_rows[0]["position"] in {"day","month"}))})
    evidence["primary_useful_available"]=bool(evidence["primary_useful_tokens"])
    return _merge(evidence,annotations)


def compile_virtual_real(
    chart: Mapping[str, Any], useful_party: Mapping[str, Any],
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("virtual_real")
    present = _natal_tokens(chart)
    real = [token for token in TOKEN_UNIVERSE if token in present]
    virtual = [token for token in TOKEN_UNIVERSE if token not in present]
    roles = useful_party["token_roles"]
    evidence.update({
        "evidence_compiled": True,
        "universe": TOKEN_UNIVERSE,
        "real_tokens": real,
        "virtual_tokens": virtual,
        "real_count": len(real),
        "virtual_count": len(virtual),
        "partition_complete": len(real) + len(virtual) == 22 and not set(real).intersection(virtual),
        "real_useful": [t for t in real if roles.get(t) == "useful"],
        "real_unfavorable": [t for t in real if roles.get(t) == "unfavorable"],
        "virtual_useful": [t for t in virtual if roles.get(t) == "useful"],
        "virtual_unfavorable": [t for t in virtual if roles.get(t) == "unfavorable"],
        "detailed_six_type_algorithm": None,
    })
    return _merge(evidence, annotations)


def _temporal_group(row: Mapping[str, Any] | None) -> str | None:
    if not row:
        return None
    ten_god = row.get("stem_ten_god")
    return TEN_GOD_GROUP.get(ten_god, "unknown") if ten_god else "unknown"


def compile_temporal(
    chart: Mapping[str, Any], *, stage: str, luck_cycle: Mapping[str, Any] | None,
    annual: Mapping[str, Any] | None, natal_classification: Mapping[str, Any],
    useful_party: Mapping[str, Any], virtual_real: Mapping[str, Any],
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("temporal")
    matrix_slugs = [s for s in RULE_CONTRACT["temporal"] if s.startswith("matrix_")]
    for slug in matrix_slugs:
        evidence[slug] = False
    luck_group = _temporal_group(luck_cycle)
    annual_group = _temporal_group(annual)
    matched_matrix = None
    if luck_group in {"wealth", "official", "resource", "output", "peer"} and annual_group in {"wealth", "official", "resource", "output", "peer"}:
        matched_matrix = f"matrix_{luck_group}_{annual_group}"
        evidence[matched_matrix] = True
    natal_set = set(virtual_real["real_tokens"])
    luck_real = bool(luck_cycle and (luck_cycle["stem"] in natal_set or luck_cycle["branch"] in natal_set))
    annual_real = bool(annual and (annual["stem"] in natal_set or annual["branch"] in natal_set))
    double_temporal_stem_generation = []
    if luck_cycle and annual and luck_cycle.get("stem") == annual.get("stem"):
        source = luck_cycle["stem"]
        for pos in ("year", "month", "day", "hour"):
            target = chart["pillars"][pos]["stem"]
            if source != target and GENERATES.get(STEM_ELEMENT[source]) == STEM_ELEMENT[target]:
                double_temporal_stem_generation.append({
                    "source_stem": source,
                    "target_stem": target,
                    "target_position": pos,
                })
    temporal_generation_chains=[]
    natal_visible=[
        {"position":pos,"stem":chart["pillars"][pos]["stem"],"element":STEM_ELEMENT[chart["pillars"][pos]["stem"]]}
        for pos in ("year","month","day","hour")
    ]
    temporal_rows=[]
    if luck_cycle: temporal_rows.append({"layer":"luck","stem":luck_cycle["stem"],"element":STEM_ELEMENT[luck_cycle["stem"]]})
    if annual: temporal_rows.append({"layer":"annual","stem":annual["stem"],"element":STEM_ELEMENT[annual["stem"]]})
    for src in temporal_rows:
        for target in natal_visible:
            if GENERATES.get(src["element"])==target["element"]:
                temporal_generation_chains.append({"steps":[src["stem"],target["stem"]],"label":f"{src['stem']}生{target['stem']}"})
    if luck_cycle and annual and GENERATES.get(STEM_ELEMENT[annual["stem"]])==STEM_ELEMENT[luck_cycle["stem"]]:
        for target in natal_visible:
            if GENERATES.get(STEM_ELEMENT[luck_cycle["stem"]])==target["element"]:
                temporal_generation_chains.append({"steps":[annual["stem"],luck_cycle["stem"],target["stem"]],"label":f"{annual['stem']}生{luck_cycle['stem']}再生{target['stem']}"})

    evidence.update({
        "evidence_compiled": True,
        "stage": stage,
        "classification_inherited": True,
        "inherited_classification": natal_classification["classification"],
        "luck_annual_first": bool(luck_cycle and annual),
        "luck_group": luck_group,
        "annual_group": annual_group,
        "matched_matrix": matched_matrix,
        "luck_real": luck_real,
        "annual_real": annual_real,
        "double_temporal_stem_generation": double_temporal_stem_generation,
        "double_temporal_stem_generation_present": bool(double_temporal_stem_generation),
        "temporal_generation_chains": temporal_generation_chains,
        "temporal_generation_chain_present": bool(temporal_generation_chains),
        "real_real_both_reduce": bool(luck_cycle and annual and luck_real and annual_real),
        "temporal_activation_only": stage != "natal",
        "result_then_natal": bool(luck_cycle or annual),
        "unpublished_rules": None,
        "useful_groups_inherited": useful_party["useful_groups"],
        "unfavorable_groups_inherited": useful_party["unfavorable_groups"],
    })
    return _merge(evidence, annotations)


def compile_kinship(
    chart: Mapping[str, Any], useful_party: Mapping[str, Any],
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("kinship")
    evidence.update({
        "evidence_compiled": True,
        "neutralized": True,
        "token_roles": useful_party["token_roles"],
        "unpublished_baishen_formula": None,
        "deterministic_appearance_status_relationship": False,
    })
    return _merge(evidence, annotations)


def compile_w05_evidence(
    chart: Mapping[str, Any], *, stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    if stage not in {"natal", "luck", "annual"}:
        raise ValueError(f"unsupported stage: {stage}")
    annotations = annotations or {}
    procedure = compile_procedure()
    relations = compile_relations(chart, luck_cycle=luck_cycle, annual=annual, annotations=annotations.get("relations"))
    if natal_core is None:
        strength = compile_strength(chart, annotations=annotations.get("strength"))
        transform = compile_transform(chart, strength, annotations.get("transform"))
        classification = compile_classification(chart, strength, transform, annotations.get("classification"))
        useful_party = compile_useful_party(classification, chart, annotations.get("useful_party"))
        virtual_real = compile_virtual_real(chart, useful_party, annotations.get("virtual_real"))
    else:
        strength = deepcopy(natal_core["strength"])
        transform = deepcopy(natal_core["transform"])
        classification = deepcopy(natal_core["classification"])
        useful_party = deepcopy(natal_core["useful_party"])
        virtual_real = deepcopy(natal_core["virtual_real"])
    temporal = compile_temporal(
        chart, stage=stage, luck_cycle=luck_cycle, annual=annual,
        natal_classification=classification, useful_party=useful_party,
        virtual_real=virtual_real, annotations=annotations.get("temporal"),
    )
    kinship = compile_kinship(chart, useful_party, annotations.get("kinship"))
    return {
        "procedure": procedure,
        "relations": relations,
        "strength": strength,
        "classification": classification,
        "useful_party": useful_party,
        "virtual_real": virtual_real,
        "transform": transform,
        "temporal": temporal,
        "kinship": kinship,
    }


def _state_id(chart: Mapping[str, Any], stage: str, *, luck_cycle=None, annual=None) -> str:
    if stage == "natal":
        suffix = "natal.li_hanchen_w05"
    elif stage == "luck":
        suffix = f"luck.{luck_cycle['luck_cycle_id']}.li_hanchen_w05"
    else:
        suffix = f"annual.{annual['annual_id']}.li_hanchen_w05"
    return f"state.{chart['chart_id']}.{suffix}"


def _fact_for_state(chart_id: str, state_id: str, stage: str) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "fact_id": f"fact.{state_id}.temporal_compilation_complete",
        "subject": {"ref_id": chart_id, "entity_type": "chart", "layer": stage},
        "predicate": "li_hanchen.temporal.compilation_complete",
        "value": True,
        "truth": "true",
        "scope": {"stage": stage, "state_id": state_id},
        "source_type": "computed",
        "algorithm_id": "li_hanchen.w05.compiler@1.0.0",
    }


def build_state_ir_w05(
    chart: Mapping[str, Any], *, stage: str,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    parent_state_id: str | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    state_id = _state_id(chart, stage, luck_cycle=luck_cycle, annual=annual)
    evidence = compile_w05_evidence(
        chart, stage=stage, luck_cycle=luck_cycle, annual=annual,
        natal_core=natal_core, annotations=annotations,
    )
    stems, branches = _layer_context(chart, luck_cycle=luck_cycle, annual=annual)
    relations = [] if stage == "natal" else _pair_relations(stems, branches, stage, state_id)
    evidence["temporal"]["relation_count"] = len(relations)
    evidence["temporal"]["relations_compiled"] = True
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
        "school_profile_id": "li_hanchen.w05@1.0.0",
        "active_context": active_context,
        "facts": [_fact_for_state(chart["chart_id"], state_id, stage)],
        "relations": relations,
        "findings": [],
        "school_state": {"li_hanchen": {"w05": evidence}},
        "trace_id": f"trace.{state_id}",
    }
    if parent_state_id:
        state["parent_state_id"] = parent_state_id
    return state


def build_state_chain_w05(
    chart: Mapping[str, Any], *,
    annotations_by_state: Mapping[str, Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    annotations_by_state = annotations_by_state or {}
    natal = build_state_ir_w05(chart, stage="natal", annotations=annotations_by_state.get("natal"))
    natal_core = natal["school_state"]["li_hanchen"]["w05"]
    states = [natal]
    luck_states: dict[str, str] = {}
    for luck in chart.get("luck_cycles", []):
        state = build_state_ir_w05(
            chart, stage="luck", luck_cycle=luck, parent_state_id=natal["state_id"],
            natal_core=natal_core, annotations=annotations_by_state.get(luck["luck_cycle_id"]),
        )
        states.append(state)
        luck_states[luck["luck_cycle_id"]] = state["state_id"]
    for annual in chart.get("annual_contexts", []):
        luck = next((r for r in chart.get("luck_cycles", []) if r["start_year"] <= annual["year"] <= r["end_year"]), None)
        parent = luck_states.get(luck["luck_cycle_id"]) if luck else natal["state_id"]
        state = build_state_ir_w05(
            chart, stage="annual", luck_cycle=luck, annual=annual,
            parent_state_id=parent, natal_core=natal_core,
            annotations=annotations_by_state.get(annual["annual_id"]),
        )
        if not luck:
            state["school_state"]["li_hanchen"]["w05"]["temporal"]["annual_parent_fallback"] = "natal_no_matching_luck"
        states.append(state)
    return states


def make_rule_context(
    chart: Mapping[str, Any], *, stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = compile_w05_evidence(
        chart, stage=stage, luck_cycle=luck_cycle, annual=annual,
        natal_core=natal_core, annotations=annotations,
    )
    return {
        "chart": deepcopy(chart),
        "facts": {"li_hanchen": {"w05": evidence}},
        "relations": [],
        "findings": [],
    }


def _resolver_relation(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    slug = args.get("slug")
    if not slug:
        return Truth.UNKNOWN
    value = get_path(context, f"facts.li_hanchen.w05.relations.{slug}", None)
    if value is None:
        return Truth.UNKNOWN
    return Truth.TRUE if value else Truth.FALSE


def _resolver_classification(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    value = get_path(context, "facts.li_hanchen.w05.classification.classification", None)
    if value is None:
        return Truth.UNKNOWN
    return Truth.TRUE if value == args.get("classification") else Truth.FALSE


def _resolver_transform(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    value = get_path(context, "facts.li_hanchen.w05.transform.confirmed", None)
    if value is None:
        return Truth.UNKNOWN
    return Truth.TRUE if value else Truth.FALSE


def _resolver_temporal(args: dict[str, Any], context: dict[str, Any]) -> Truth:
    matched = get_path(context, "facts.li_hanchen.w05.temporal.matched_matrix", None)
    if matched is None:
        return Truth.UNKNOWN
    wanted = args.get("matrix")
    return Truth.TRUE if wanted is None or wanted == matched else Truth.FALSE


W05_RESOLVERS = {
    "li_hanchen.w05.relation_active": _resolver_relation,
    "li_hanchen.w05.classification_matches": _resolver_classification,
    "li_hanchen.w05.transform_matches": _resolver_transform,
    "li_hanchen.w05.temporal_result": _resolver_temporal,
}
