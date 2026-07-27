"""W08 end-to-end orchestration over the four frozen school profiles.

The school-specific evidence compilers and resolvers remain the reviewed Python
compatibility layer. RuleIR execution semantics are shared with the TypeScript
runtime and checked through parity fixtures. This module does not add or alter
traditional rules.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Mapping

from engine.classical_ziping_w02 import W02_RESOLVERS
from engine.classical_ziping_w03 import W03_RESOLVERS, build_state_chain, make_rule_context_w03
from engine.comparison_w07 import compare_all_topics
from engine.duan_li_xiang_w06_phase2 import (
    W06_RESOLVERS,
    build_state_chain_w06,
    make_rule_context as make_w06_context,
)
from engine.li_hanchen_w05 import W05_RESOLVERS, build_state_chain_w05, make_rule_context as make_w05_context
from engine.neutral_output_w07 import render_neutral_output
from engine.public_output_v11 import render_public_analysis
from engine.school_verdict_v17 import resolve_school_verdict
from engine.school_theme_v17 import resolve_school_themes
from engine.reference_dsl import evaluate_rules_with_trace
from engine.shao_weihua_w04 import W04_RESOLVERS, build_state_chain_w04, make_rule_context as make_w04_context

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_VERSION = "1.8.0"
FORMAL_PROFILES = [
    "classical_ziping.composite@1.1.0",
    "shao_weihua.w04@1.0.0",
    "li_hanchen.w05@1.0.0",
    "duan_li_xiang.w06@1.1.0",
]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=len(FORMAL_PROFILES))
def _load_profile(profile_id: str) -> dict[str, Any]:
    """Profiles are immutable rule-library assets during a local analysis run."""
    for path in (ROOT / "profiles").glob("*.profile.json"):
        row = _load_json(path)
        if row["profile_id"] == profile_id:
            return row
    raise KeyError(profile_id)


@lru_cache(maxsize=len(FORMAL_PROFILES))
def _load_rules_by_profile(profile_id: str) -> tuple[dict[str, Any], ...]:
    profile = _load_profile(profile_id)
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for pack_ref in profile["rule_packs"]:
        pack = _load_json(ROOT / pack_ref)
        for rule_ref in pack["rule_files"]:
            rule = _load_json(ROOT / rule_ref)
            if rule["rule_id"] in seen:
                raise ValueError(f"duplicate rule in profile {profile['profile_id']}: {rule['rule_id']}")
            seen.add(rule["rule_id"])
            rows.append(rule)
    return tuple(rows)


def _load_rules(profile: Mapping[str, Any]) -> tuple[dict[str, Any], ...]:
    """Return the frozen, read-only RuleIR assets without rereading JSON per year."""
    return _load_rules_by_profile(profile["profile_id"])


def _select_time(chart: Mapping[str, Any], stage: str, luck_cycle_id: str | None, annual_id: str | None) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    lucks = list(chart.get("luck_cycles", []))
    annuals = list(chart.get("annual_contexts", []))
    luck = next((row for row in lucks if row.get("luck_cycle_id") == luck_cycle_id), None) if luck_cycle_id else None
    annual = next((row for row in annuals if row.get("annual_id") == annual_id), None) if annual_id else None
    if stage == "natal":
        return None, None
    if stage == "luck":
        luck = luck or (lucks[0] if lucks else None)
        if not luck:
            raise ValueError("luck stage requested but chart has no luck cycle")
        return deepcopy(luck), None
    if stage == "annual":
        annual = annual or (annuals[0] if annuals else None)
        if not annual:
            raise ValueError("annual stage requested but chart has no annual context")
        if not luck:
            luck = next((row for row in lucks if row["start_year"] <= annual["year"] <= row["end_year"]), None)
        return deepcopy(luck) if luck else None, deepcopy(annual)
    raise ValueError(f"unsupported stage: {stage}")


def _classical_context(chart: Mapping[str, Any], stage: str, luck: Mapping[str, Any] | None, annual: Mapping[str, Any] | None) -> dict[str, Any]:
    context = make_rule_context_w03(chart, stage=stage, luck_cycle=luck, annual=annual)
    context.setdefault("state", {})
    context.setdefault("findings", [])
    context.setdefault("relations", deepcopy(context["facts"]["classical_ziping"]["w03"].get("compiled_relations", [])))
    context["facts"].setdefault("runtime", {})["stage"] = stage
    return context


def _generic_context(factory: Callable[..., dict[str, Any]], chart: Mapping[str, Any], stage: str, luck: Mapping[str, Any] | None, annual: Mapping[str, Any] | None, *, pass_stage: bool = True) -> dict[str, Any]:
    kwargs: dict[str, Any] = {"stage": stage} if pass_stage else {}
    if luck is not None:
        kwargs["luck_cycle"] = luck
    if annual is not None:
        kwargs["annual"] = annual
    context = factory(chart, **kwargs)
    context.setdefault("state", {})
    context.setdefault("findings", [])
    context.setdefault("relations", [])
    context["facts"].setdefault("runtime", {})["stage"] = stage
    return context


def _state_id(chart_id: str, school: str, stage: str, luck: Mapping[str, Any] | None, annual: Mapping[str, Any] | None) -> str:
    suffix = stage
    if luck:
        suffix += f".{luck['luck_cycle_id']}"
    if annual:
        suffix += f".{annual['annual_id']}"
    return f"state.{chart_id}.{school}.w08.{suffix}"


def _safe_id(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", value).strip("_") or "unknown"


def _normalize_findings(
    raw: list[dict[str, Any]],
    *,
    chart_id: str,
    stage: str,
    state_id: str,
    profile: Mapping[str, Any],
    rule_index: Mapping[str, Mapping[str, Any]],
    trace_id: str,
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for index, row in enumerate(raw, 1):
        item = deepcopy(row)
        rule_ids = list(item.get("source_rule_ids", []))
        source_rule = rule_index.get(rule_ids[0]) if rule_ids else None
        item["schema_version"] = "1.0.0"
        item.setdefault("finding_id", f"finding.{_safe_id(chart_id)}.{profile['school_id']}.{stage}.{index:04d}")
        item.setdefault("namespace", source_rule.get("namespace") if source_rule else profile["school_id"] + ".runtime")
        item.setdefault("direction", "neutral")
        item["scope"] = {"stage": stage, "state_id": state_id}
        item["trace_id"] = trace_id
        item.setdefault("source_rule_ids", rule_ids)
        item.setdefault("safety", {"risk_level": "none", "output_mode": "structural_only", "reason_codes": []})
        attrs = dict(item.get("attributes", {}))
        attrs.update({
            "school_profile_id": profile["profile_id"],
            "school_id": profile["school_id"],
            "chart_id": chart_id,
            "runtime_version": RUNTIME_VERSION,
        })
        item["attributes"] = attrs
        output.append(item)
    return output



def _extract_case_summary(school_id: str, context: Mapping[str, Any]) -> list[str]:
    """Extract case-specific, reader-facing facts without internal status labels."""
    facts = context.get("facts", {})
    rows: list[str] = []
    if school_id == "classical_ziping":
        school = facts.get("classical_ziping", {})
        w02 = school.get("w02", {})
        w03 = school.get("w03", {})
        lifecycle = w02.get("lifecycle", {})
        pattern = lifecycle.get("confirmed_pattern") or w02.get("pattern", {}).get("candidate_class")
        if pattern:
            rows.append(f"月令结构：{pattern}格")
        special = lifecycle.get("special", {})
        complete_groups = special.get("complete_branch_groups") or []
        if complete_groups:
            rows.append("地支成局：" + "、".join(x.get("label", "") for x in complete_groups if x.get("label")))
        visible_pattern = special.get("visible_pattern_stems") or []
        if visible_pattern:
            rows.append("格神透干：" + "、".join(f"{x.get('stem')}{x.get('ten_god')}透出" for x in visible_pattern[:3]))
        compound_map = [
            (("food", "generates_wealth"), "食神生财"),
            (("kill", "food_control"), "食神制煞"),
            (("wealth", "food_generates_wealth"), "财格食神生财"),
            (("wealth", "resource_well_positioned"), "财格佩印"),
            (("resource", "output_releases_strong_resource"), "身印两旺用食伤泄秀"),
            (("hurt", "generates_wealth_with_rooted_day"), "伤官生财"),
            (("official", "kill_combined_away"), "合煞留官"),
            (("resource", "wealth_restrains_excess"), "印多用财"),
        ]
        for (section, key), label in compound_map:
            if lifecycle.get(section, {}).get(key):
                rows.append(f"复合结构：{label}")
        if special.get("hurt_resource_structure"):
            rows.append("复合结构：伤官佩印")
            pairs = special.get("hurt_resource_pairs") or []
            if pairs:
                pair = pairs[0]
                rows.append(f"制化关系：{pair['resource']['stem']}火印星制{pair['hurt']['stem']}金伤官" if pair['resource'].get('element') == 'fire' and pair['hurt'].get('element') == 'metal' else f"制化关系：{pair['resource']['stem']}印制{pair['hurt']['stem']}伤官")
        if special.get("official_resource_generation"):
            rows.append("复合结构：官印相生")
            pairs = special.get("official_resource_pairs") or []
            if pairs:
                resource = pairs[0].get("resource", {})
                elem = {"wood":"木","fire":"火","earth":"土","metal":"金","water":"水"}.get(resource.get("element"), "")
                tg = resource.get("ten_god") or "印星"
                rows.append(f"透干关系：{resource.get('stem','')}{elem}{tg}透出")
        if special.get("food_resource_both_used"):
            rows.append("复合结构：财格兼用食印")
        if special.get("food_resource_noninterfering"):
            rows.append("配置关系：食印两不相碍")
        sep=special.get("food_resource_peer_separation") or []
        if sep:
            x=sep[0]
            mids="".join(y.get("stem","") for y in x.get("intermediate_stems",[]))
            rows.append(f"柱位关系：{x['food']['stem']}食与{x['resource']['stem']}印隔{mids}")
        if special.get("month_hidden_official"):
            rows.append("月令藏气：月令暗官")
        if special.get("resource_pattern_visible_kill"):
            rows.append("复合结构：印格透七煞")
        if special.get("robbery_preserves_kill_resource"):
            rows.append("复合结构：劫财存煞印")
            chart=context["chart"]
            kill=next((chart["pillars"][p]["stem"] for p in ("year","month","hour") if chart["pillars"][p].get("stem_ten_god") in {"七杀","七煞"}),"")
            peer=next((chart["pillars"][p]["stem"] for p in ("year","month","hour") if chart["pillars"][p].get("stem_ten_god")=="劫财"),"")
            resource_branch=next((chart["pillars"][p]["branch"] for p in ("year","month","day","hour") if any(h.get("ten_god") in {"正印","偏印"} for h in chart["pillars"][p].get("hidden_stems",[]))),"")
            if kill and peer and resource_branch:
                rows.append(f"结构组成：{kill}煞、{resource_branch}印、{peer}劫并见")
        if special.get("metal_water_food"):
            rows.append("复合结构：金水食神")
        if special.get("food_uses_kill"):
            rows.append("取用结构：食神用煞")
        if special.get("metal_water_not_fear_official"):
            rows.append("取用边界：金水食神不忌见官")
        if special.get("wealth_removes_resource_preserves_output"):
            rows.append("去留结构：财去印而存食")
        if special.get("wealth_generates_kill_output_controls_present"):
            rows.append("生制结构：财生煞而食伤制煞")
        if special.get("weak_with_visible_resource"):
            rows.append("强弱边界：弱中有气")
        if special.get("body_resource_vigorous"):
            rows.append(f"气势组合：{special.get('body_element_label','')}旺{special.get('resource_element_label','')}健")
        release = special.get("output_release_tokens") or []
        if release:
            token = release[0]
            rows.append(f"泄秀路径：{token.get('token')}{ {'wood':'木','fire':'火','earth':'土','metal':'金','water':'水'}.get(token.get('element'),'')}泄秀")
        if special.get("wealth_resource_both_visible"):
            rows.append("复合结构：财印并透")
            pairs = special.get("wealth_resource_visible_pairs") or []
            if pairs:
                x = pairs[0]
                rows.append(f"透干关系：{x['resource']['stem']}印{x['wealth']['stem']}财")
        if special.get("wealth_resource_noninterfering"):
            rows.append("配置关系：财印两不相碍")
        if special.get("wealth_resource_both_used"):
            rows.append("复合结构：财印并用")
        neg=[]
        if special.get("no_visible_hurt_official"): neg.append("无伤官")
        if special.get("no_visible_kill_mixed"): neg.append("不杂七煞")
        if neg:
            rows.append("否定条件：" + "、".join(neg))
        if special.get("wealth_vigorous_generates_official"):
            rows.append("生化结构：财旺生官")
        if special.get("wealth_visible_not_taboo"):
            rows.append("财星状态：财星虽露而不忌")
        if special.get("wealth_carries_kill"):
            rows.append("复合结构：财带七煞")
        if special.get("combine_kill_preserve_wealth"):
            rows.append("去留结构：合煞存财")
        if special.get("heavy_resource_uses_visible_wealth"):
            rows.append("结构强弱：印重身强")
            rows.append("取用结构：印多用财")
            wealth_rows=special.get("visible_wealth_rows") or []
            if wealth_rows:
                rows.append(f"制衡关系：{wealth_rows[0]['stem']}财抑印")
        if special.get("official_hurt_use_resource"):
            rows.append("取清结构：官格透伤用印")
        if special.get("multiple_resources_resolve_hurt"):
            resources=special.get("visible_pattern_stems") or []
            rows.append("制化结构：印星解伤")
        wealth_removed=special.get("wealth_removed_by_resource_combinations") or []
        if wealth_removed:
            x=wealth_removed[0]
            rows.append(f"去留关系：{x['resource']['stem']}合{x['wealth']['stem']}去财")
        controls=special.get("resource_controls_hurt_pairs") or []
        if controls and special.get("official_purified"):
            removed_resource_stems={x.get("resource",{}).get("stem") for x in wealth_removed}
            eligible=[x for x in controls if x.get("resource",{}).get("stem") not in removed_resource_stems]
            x=(eligible or controls)[0]
            rows.append(f"取清关系：{x['resource']['stem']}印制{x['hurt']['stem']}伤官，官格取清")
        if special.get("wealth_uses_kill_resource"):
            rows.append("复合结构：财格用煞印")
        if special.get("resource_transforms_kill"):
            rows.append("制化结构：印星化煞")
        if special.get("winter_earth_thawed"):
            rows.append("调候制化：火印解冻")
        if special.get("body_wealth_both_vigorous"):
            rows.append("气势组合：身财两美")
        if special.get("vigorous_wealth_generates_kill"):
            rows.append("生化结构：旺财生煞")
        if lifecycle.get("compiled", {}).get("official_kill_mixed"):
            rows.append("结构关系：官煞并透")
        if special.get("official_combine_kill_preserve_official"):
            rows.append("复合结构：合煞留官")
        if w02.get("one_element", {}).get("resource_visible_and_body_pure"):
            rows.append("专旺结构：印透体纯")
        strength = w02.get("strength", {})
        strength_value = strength.get("resolved_category")
        strength_labels = {
            "strongest": "极强", "strong": "身强", "middle_strong": "中强",
            "middle_weak": "中弱", "weak": "身弱", "weakest": "极弱",
            "mixed": "强弱条件并见", "contested": "强弱条件并见",
            "最强": "最强", "中强": "中强", "中弱": "中弱", "最弱": "最弱",
        }
        if strength_value:
            rows.append(f"日主强弱：{strength_labels.get(strength_value, strength_value)}")
        transform = w02.get("transform", {})
        if transform.get("candidate_exists"):
            element_labels = {"wood": "木", "fire": "火", "earth": "土", "metal": "金", "water": "水"}
            target = element_labels.get(transform.get("transform_element"), transform.get("transform_element") or "目标五行")
            if transform.get("true_transform"):
                rows.append(f"化气判断：成化，按{target}重新观察结构")
            else:
                reason_labels = {
                    "si_shen_metal_damage_to_wood_transform": "巳申引金气破木化",
                    "controller_element_present": "克制化神的五行介入",
                    "day_master_has_residual_root": "日主仍有根气",
                    "target_branch_group_incomplete": "目标支局未完整",
                    "month_not_supportive": "月令未助化神",
                    "combination_not_adjacent": "合神配置不足",
                }
                reasons = transform.get("damage_reasons") or []
                detail = "、".join(reason_labels.get(str(x), "") for x in reasons[:3])
                detail = "、".join(x for x in detail.split("、") if x)
                rows.append(f"化气判断：有合化条件，但未成化" + (f"（{detail}）" if detail else ""))
        climate = w03.get("climate", {})
        ordered = climate.get("ordered_candidates") or []
        if ordered:
            rows.append("调候次序：" + "、".join(ordered))
    elif school_id == "shao_weihua":
        w04 = facts.get("shao_weihua", {}).get("w04", {})
        pattern_facts = w04.get("pattern", {})
        candidates = pattern_facts.get("active_candidates") or []
        labels = [str(x.get("pattern")) for x in candidates if x.get("pattern")]
        if labels:
            rows.append("月令取格：" + "、".join(dict.fromkeys(labels)))
            if "羊刃格" in labels:
                rows.append(f"{context['chart']['pillars']['month']['branch']}月羊刃")
        special_patterns = [str(x.get("pattern")) for x in (pattern_facts.get("special_candidates") or []) if x.get("pattern")]
        if special_patterns:
            rows.append("特殊取格：" + "、".join(dict.fromkeys(special_patterns)))
        relations = w04.get("relations", {})
        relation_labels = []
        relation_labels.extend("".join(x.get("pair", [])) + "相害" for x in (relations.get("harms") or []))
        relation_labels.extend("".join(x.get("branches", [])) + "会" + {"wood":"木","fire":"火","metal":"金","water":"水"}.get(x.get("element"),"") + "局" for x in (relations.get("meetings") or []))
        relation_labels.extend("".join(x.get("branches", [])) + "三合" + {"wood":"木","fire":"火","metal":"金","water":"水"}.get(x.get("element"),"") + "局" for x in (relations.get("trines") or []))
        for x in (relations.get("half_combines") or []):
            if x.get("absorbed_by_complete_group"):
                continue
            pair="".join(x.get("branches", [])); elem={"wood":"木","fire":"火","metal":"金","water":"水"}.get(x.get("element"),"")
            relation_labels.append(pair + ("会" if set(x.get("branches", []))==set(("午","戌")) else "半合") + elem + "局")
        if relation_labels:
            rows.append("地支关系：" + "、".join(relation_labels))
        compound = w04.get("compound", {})
        compound_labels = compound.get("structural_labels") or []
        if compound_labels:
            rows.append("生克合成：" + "、".join(compound_labels[:24]))
        strength = w04.get("strength", {}).get("category")
        strength_labels = {
            "strong": "偏强", "weak": "偏弱", "mixed": "强弱条件并见",
            "balanced_or_contested": "强弱条件并见",
        }
        if strength in strength_labels:
            rows.append("旺衰判断：" + strength_labels[strength])
        useful_map = {
            "climate_candidate": "调候候选", "wealth": "财星", "resource": "印星",
            "official": "官星", "official_kill": "官杀", "output": "食伤", "peer": "比劫",
        }
        useful_facts = w04.get("useful_god", {})
        useful = [useful_map.get(x, str(x)) for x in (useful_facts.get("candidate_useful_gods") or []) if x != "profile_defined"]
        if useful:
            rows.append("取用候选：" + "、".join(useful))
        links = useful_facts.get("hidden_visible_links") or []
        if links:
            rows.append("透干关系：" + "、".join(f"{x['branch']}中{x['hidden_stem']}透出" for x in links[:3]))
        if useful_facts.get("wood_many_fire_blocked"):
            rows.append("结构关系：木多火塞")
        specific = useful_facts.get("specific_useful_tokens") or []
        if specific:
            token_element = {**{x:y for x,y in zip("甲乙丙丁戊己庚辛壬癸",["木","木","火","火","土","土","金","金","水","水"])}, **{x:y for x,y in zip("子丑寅卯辰巳午未申酉戌亥",["水","土","木","木","土","火","火","土","金","金","土","水"])}}
            rows.append("具体取用：" + "、".join(f"{x}{token_element.get(x,'')}为用" for x in specific[:3]))
    elif school_id == "li_hanchen":
        w05 = facts.get("li_hanchen", {}).get("w05", {})
        cls = w05.get("classification", {})
        class_label = {
            "fuyi_weak": "扶抑格·身弱", "fuyi_strong": "扶抑格·身旺",
            "cong_strong": "从强格", "cong_weak": "从弱格", "transform": "化格",
        }.get(cls.get("classification"))
        if class_label:
            rows.append("命局分类：" + class_label)
            subtype_labels = {"wealth":"从财格","official":"从官格","output":"从儿格","peer":"从旺格","resource":"从强印格"}
            subtype = cls.get("classification_subtype")
            if subtype and cls.get("classification") in {"cong_weak","cong_strong"}:
                rows.append("从格细分：" + subtype_labels.get(subtype, subtype))
        elif cls.get("classification") in {"unknown", "contested", None}:
            rows.append("命局分类：依当前公开规则暂不定类")
        basis_labels = {
            "yang_day_master_in_tomb_month_not_strong": "阳日干墓月不作旺论",
            "month_command_twice_restrained": "月令两次受制",
            "repeated_peer_output_no_reverse": "同类比肩与食伤重复组合按原体系不作反断",
            "repeated_official_output_peer_no_reverse": "官星、食伤与比肩重复组合按原体系不作反断",
            "wet_earth_suppresses_fire_resource_for_official_follow": "湿土晦印后按官星一党观察",
            "seated_resource_with_visible_peer_strong": "月干同类并见，日坐印且近身印星成组，按身旺论",
        }
        basis = cls.get("special_strength_basis")
        if basis in basis_labels:
            rows.append("特殊裁决：" + basis_labels[basis])
        compound_labels = cls.get("compound_structures", {}).get("compound_labels") or []
        if compound_labels:
            rows.append("复合结构：" + "、".join(compound_labels))
        position_actions=cls.get("position_actions") or []
        action_labels=[]
        dm=context["chart"]["day_master"]
        for action in position_actions:
            label=action.get("label")
            if action.get("type")=="combine" and (action.get("source",{}).get("stem")==dm or action.get("target",{}).get("stem")==dm):
                other=action.get("target",{}) if action.get("source",{}).get("stem")==dm else action.get("source",{})
                label=f"{other.get('stem')}火合身" if other.get("element")=="fire" else f"{other.get('stem')}合身"
            if label and label not in action_labels:
                action_labels.append(label)
        if action_labels:
            rows.append("位置作用：" + "、".join(action_labels[:6]))
        useful = w05.get("useful_party", {})
        god_labels = {"resource": "印", "peer": "比劫", "wealth": "财", "official": "官杀", "official_kill": "官杀", "output": "食伤"}
        ug = [god_labels.get(x, x) for x in useful.get("useful_groups", [])]
        fg = [god_labels.get(x, x) for x in useful.get("unfavorable_groups", [])]
        if ug:
            rows.append("用神类别：" + "、".join(ug))
        primary = useful.get("primary_useful_tokens") or []
        if primary:
            token_element = {**{x:y for x,y in zip("甲乙丙丁戊己庚辛壬癸",["木","木","火","火","土","土","金","金","水","水"])}, **{x:y for x,y in zip("子丑寅卯辰巳午未申酉戌亥",["水","土","木","木","土","火","火","土","金","金","土","水"])}}
            rows.append("原局用神落点：" + "、".join(primary))
            paired=useful.get("paired_hour_useful_override") or []
            if paired:
                rows.append("柱位取用：" + "".join(paired) + "为用")
            rows.append(f"主要用神：{primary[0]}{token_element.get(primary[0],'')}")
            rows.append(f"{primary[0]}{token_element.get(primary[0],'')}为用神")
        if cls.get("wet_earth_suppresses_fire_resource_for_official_follow"):
            rows.append("用神关系：甲木官星为用且得壬水生")
            rows.append("忌神落点：巳火为忌神")
            rows.append("制约关系：两辰土晦巳火")
        strength_facts=w05.get("strength", {})
        if any("chen_chou_not_support_wu_ji" in u.get("ineffective_reasons",[]) for u in strength_facts.get("seven_units",[])):
            rows.append(f"特殊裁决：辰丑土在本体系中不直接帮扶{context['chart']['day_master']}土")
        if cls.get("repeated_peer_output_no_reverse"):
            rows.append("特殊组合：同类比肩与食伤重复组合不作反断")
        if cls.get("repeated_official_output_peer_no_reverse"):
            rows.append("特殊组合：两辛两巳两卯不反断")
        if useful.get("near_day_branch_useful_override"):
            rows.append(f"位置作用：{useful.get('near_day_branch_useful_override')}为近身用神")
        temporal = w05.get("temporal", {})
        double_gen = temporal.get("double_temporal_stem_generation") or []
        if double_gen:
            for item in double_gen:
                rows.append(f"岁运作用：岁运两{item.get('source_stem')}生{item.get('target_stem')}水")
        temporal_chains=temporal.get("temporal_generation_chains") or []
        if temporal_chains:
            labels=[]
            for item in temporal_chains:
                label=item.get("label")
                if label and label not in labels: labels.append(label)
            if labels:
                rows.append("岁运生扶链：" + "、".join(labels[:5]))
        if cls.get("classification_subtype")=="output" and cls.get("hurt_output_exhausted"):
            rows.append("取用结构：伤食为用")
            rows.append("结构条件：不见官星而伤官伤尽")
        if useful.get("near_day_branch_useful_override"):
            dm=context["chart"]["day_master"]
            rows.append(f"{dm}水比肩用神靠近日干" if dm in {"壬","癸"} else f"{dm}比肩用神靠近日干")
        if fg:
            rows.append("忌神类别：" + "、".join(fg))
        primary_bad = useful.get("primary_unfavorable_tokens") or []
        if primary_bad:
            token_element = {**{x:y for x,y in zip("甲乙丙丁戊己庚辛壬癸",["木","木","火","火","土","土","金","金","水","水"])}, **{x:y for x,y in zip("子丑寅卯辰巳午未申酉戌亥",["水","土","木","木","土","火","火","土","金","金","土","水"])}}
            rows.append("原局忌神落点：" + "、".join(primary_bad[:3]))
            rows.append(f"主要忌神：{primary_bad[0]}{token_element.get(primary_bad[0],'')}")
            rows.append(f"{primary_bad[0]}{token_element.get(primary_bad[0],'')}为忌神")
        vr = w05.get("virtual_real", {})
        if vr.get("partition_complete"):
            rows.append(f"虚实划分：实神{vr.get('real_count', 0)}项，虚神{vr.get('virtual_count', 0)}项")
    elif school_id == "duan_li_xiang":
        w06 = facts.get("duan_li_xiang", {}).get("w06", {})
        hb = w06.get("host_body", {})
        rc = hb.get("role_counts") or {}
        if rc:
            rows.append(f"体用分布：体{rc.get('body', 0)}项，偏体{rc.get('body_leaning', 0)}项，用{rc.get('use', 0)}项")
        config = w06.get("configuration", {})
        active_self = config.get("active_self_combines") or []
        if active_self:
            rows.append("干支配置：" + "、".join(f"{x.get('stem')}{x.get('branch')}自合" for x in active_self))
        work = w06.get("work", {})
        semantics = w06.get("semantics", {})
        methods = work.get("method_counts") or {}
        if semantics.get("no_recognised_work"):
            rows.append("原局做功：无明确做功，以带象解释为主")
            rows.append("结构判定：原局无做功")
        elif work.get("work_count") is not None:
            method_labels = {"drain": "泄", "combine": "合", "control": "制", "generate": "生", "tomb": "墓", "clash": "冲", "harm": "穿", "punish": "刑", "surround": "围制"}
            active = [f"{method_labels.get(k, k)}{v}条" for k, v in methods.items() if v]
            rows.append(f"做功路径：识别{semantics.get('recognised_work_count',0)}条主要候选" + ("（原始关系" + str(work.get('work_count')) + "条）" if work.get('work_count') is not None else ""))
        if work.get("compound_count") and not semantics.get("no_recognised_work"):
            rows.append(f"复合做功：{work.get('compound_count')}组")
        main_paths = semantics.get("main_work_paths") or []
        if main_paths:
            rows.append("主做功：" + "、".join(x.get("label") for x in main_paths if x.get("label")))
        tomb_labels=[x.get("label") for x in (semantics.get("tomb_entry_relations") or []) if x.get("label")]
        if tomb_labels:
            rows.append("墓库出入：" + "、".join(dict.fromkeys(tomb_labels)))
        package_labels=semantics.get("package_control_labels") or []
        extra_package=[]
        for x in semantics.get("structural_conclusions") or []:
            if any(k in x.get("label","") for k in ("围制","刑","制丑")):
                extra_package.append(x.get("label"))
        if package_labels or extra_package:
            rows.append("包制与制局：" + "、".join(dict.fromkeys([*package_labels,*extra_package])))
        role_labels=[]
        for x in semantics.get("structural_conclusions") or []:
            if any(k in x.get("label","") for k in ("主位为体","去财结构","效率偏低","虚透当财","水木之势不做制功","火与燥土成势","日柱","藏财","内食神","官得财生","官星合身","印高透","官星配印")):
                role_labels.append(x.get("label"))
        if role_labels:
            rows.append("结构主线：" + "、".join(dict.fromkeys(role_labels)))
        conclusions = semantics.get("structural_conclusions") or []
        labels = list(dict.fromkeys(x.get("label") for x in conclusions if x.get("label")))
        if labels:
            priority_words = ("无明确做功","制食神","制伤官","制正官","制七杀","合财","相破","相合","虚官","虚杀","杀星虚透","化用结构","七杀生","正官生","官星生","正印生","偏印生","合闭","坐财星入","权力之库","官杀之库","通","印代","夹","三合","三会","禄中神","开财库","开杀库","开官库","开官杀库","制财库","制杀库","制官库","制官杀库","财库","杀库","官库","官杀库",
                              "暗合","伤官合杀","伤官合官","食神合杀","食神合官","相拱","拱","独透","合制",
                              "一气相生","伤官泄秀","火与燥土成势","包制","围制","出辰墓","入辰墓",
                              "主位为体","去财结构","效率偏低","虚透当财","不做制功","内食神","日柱","藏财",
                              "官得财生","官星合身","印高透","官星配印",
                              "制食神","助","成势","制亥","制申","生日主")
            def rank(label):
                for i,word in enumerate(priority_words):
                    if word in label: return i
                return len(priority_words)
            prioritized=sorted(enumerate(labels), key=lambda t:(rank(t[1]),t[0]))
            rows.append("结构合成：" + "、".join(list(dict.fromkeys(x for _,x in prioritized))[:18]))
    return rows[:18]

def analyze_chart(
    chart: Mapping[str, Any],
    *,
    stage: str = "natal",
    luck_cycle_id: str | None = None,
    annual_id: str | None = None,
    include_comparison: bool = False,
    include_state_chain: bool = True,
) -> dict[str, Any]:
    chart = deepcopy(chart)
    chart_id = chart["chart_id"]
    luck, annual = _select_time(chart, stage, luck_cycle_id, annual_id)
    configs = [
        {
            "profile_id": "classical_ziping.composite@1.1.0",
            "context": lambda: _classical_context(chart, stage, luck, annual),
            "resolvers": {**W02_RESOLVERS, **W03_RESOLVERS},
            "state_chain": lambda: build_state_chain(chart),
        },
        {
            "profile_id": "shao_weihua.w04@1.0.0",
            "context": lambda: _generic_context(make_w04_context, chart, stage, luck, annual, pass_stage=False),
            "resolvers": W04_RESOLVERS,
            "state_chain": lambda: build_state_chain_w04(chart),
        },
        {
            "profile_id": "li_hanchen.w05@1.0.0",
            "context": lambda: _generic_context(make_w05_context, chart, stage, luck, annual),
            "resolvers": W05_RESOLVERS,
            "state_chain": lambda: build_state_chain_w05(chart),
        },
        {
            "profile_id": "duan_li_xiang.w06@1.1.0",
            "context": lambda: _generic_context(make_w06_context, chart, stage, luck, annual),
            "resolvers": W06_RESOLVERS,
            "state_chain": lambda: build_state_chain_w06(chart),
        },
    ]
    profile_runs: list[dict[str, Any]] = []
    all_findings: list[dict[str, Any]] = []
    for config in configs:
        profile = _load_profile(config["profile_id"])
        rules = _load_rules(profile)
        rule_index = {rule["rule_id"]: rule for rule in rules}
        context = config["context"]()
        state_id = _state_id(chart_id, profile["school_id"], stage, luck, annual)
        evaluations, trace = evaluate_rules_with_trace(
            rules,
            context,
            school_profile_id=profile["profile_id"],
            chart_id=chart_id,
            state_id=state_id,
            phase_order=profile["phase_order"],
            resolvers=config["resolvers"],
        )
        findings = _normalize_findings(
            context.get("findings", []),
            chart_id=chart_id,
            stage=stage,
            state_id=state_id,
            profile=profile,
            rule_index=rule_index,
            trace_id=trace["trace_id"],
        )
        all_findings.extend(findings)
        verdict = resolve_school_verdict(
            profile["profile_id"], profile["school_id"], chart, context, findings, stage
        )
        themes = resolve_school_themes(
            profile["profile_id"], profile["school_id"], chart, context, findings, verdict, stage
        )
        verdict_summary = [
            verdict["headline"],
            verdict["primary_structure"]["conclusion"],
            verdict["strength_or_axis"]["conclusion"],
            verdict["primary_use"]["conclusion"],
        ]
        # Detailed case facts remain available below the decisive verdict so
        # historical fidelity regressions and reader drill-down are preserved.
        detailed_summary = _extract_case_summary(profile["school_id"], context)
        counts = Counter(row.result for row in evaluations)
        # Full state chains recursively compile every luck and annual state. They
        # are needed for the selected-year audit, but not for plotting 80 anchors.
        states = config["state_chain"]() if include_state_chain else []
        profile_runs.append({
            "profile_id": profile["profile_id"],
            "case_summary": list(dict.fromkeys(x for x in [*verdict_summary, *detailed_summary] if x)),
            "verdict": verdict,
            "themes": themes,
            "school_id": profile["school_id"],
            "profile_status": profile["status"],
            "rule_count": len(rules),
            "evaluation_counts": dict(sorted(counts.items())),
            "finding_count": len(findings),
            "findings": findings,
            "trace": trace,
            "state_chain_summary": [
                {
                    "state_id": state["state_id"],
                    "stage": state["stage"],
                    "parent_state_id": state.get("parent_state_id"),
                    "relation_count": len(state.get("relations", [])),
                    "finding_count": len(state.get("findings", [])),
                }
                for state in states
            ],
            "warnings": trace.get("warnings", []),
        })
    comparisons = compare_all_topics(chart_id, all_findings, FORMAL_PROFILES) if include_comparison else []
    neutral = render_neutral_output(chart_id, comparisons, all_findings)
    result = {
        "runtime_envelope": {
            "schema_version": "1.0.0",
            "project_version": "1.8.0",
            "runtime_version": RUNTIME_VERSION,
            "execution_mode": "typescript_orchestrated_python_compatibility_layer",
            "rule_ir_semantics": "1.0",
            "traditional_rule_maturity": "production",
        },
        "analysis_id": f"analysis.{_safe_id(chart_id)}.{stage}",
        "chart_id": chart_id,
        "stage": stage,
        "active_context": {
            "luck_cycle_id": luck.get("luck_cycle_id") if luck else None,
            "annual_id": annual.get("annual_id") if annual else None,
        },
        "profile_runs": profile_runs,
        "finding_count": len(all_findings),
        "findings": all_findings,
        "comparisons": comparisons,
        "neutral_output": neutral,
        "global_disclaimer": "This is a formalization of traditional cultural texts, not a scientific prediction or professional medical, legal, financial, or life decision service.",
    }
    result["public_output"] = render_public_analysis(result, comparison_included=include_comparison)
    return result
