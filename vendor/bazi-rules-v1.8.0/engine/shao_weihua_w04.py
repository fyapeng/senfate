"""Transparent W04 reference compiler for Shao Weihua's system.

This module formalizes traditional textual rules. It is not a scientific
prediction model and blocks deterministic medical, legal, death, marriage, or
criminality outputs.
"""
from __future__ import annotations

import json
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping

from .classical_ziping_w02 import BRANCH_ELEMENT, GENERATES, CONTROLS, STEM_ELEMENT
from .reference_dsl import Truth, get_path
from .classical_ziping_w03 import _layer_context, _pair_relations

ROOT = Path(__file__).resolve().parents[1]
PATTERN_MATRIX = json.loads((ROOT / "ontology/shao_weihua/W04_PATTERN_MATRIX.json").read_text(encoding="utf-8"))
BRANCH_CLASH_PAIRS = {
    frozenset(("子", "午")): "zi_wu", frozenset(("丑", "未")): "chou_wei",
    frozenset(("寅", "申")): "yin_shen", frozenset(("卯", "酉")): "mao_you",
    frozenset(("辰", "戌")): "chen_xu", frozenset(("巳", "亥")): "si_hai",
}
BRANCH_HARM_PAIRS = {
    frozenset(pair): slug for pair, slug in (
        (("子", "未"), "zi_wei"), (("丑", "午"), "chou_wu"),
        (("寅", "巳"), "yin_si"), (("卯", "辰"), "mao_chen"),
        (("申", "亥"), "shen_hai"), (("酉", "戌"), "you_xu"),
    )
}
BRANCH_MEETINGS = {
    frozenset("寅卯辰"): ("yin_mao_chen", "wood"),
    frozenset("巳午未"): ("si_wu_wei", "fire"),
    frozenset("申酉戌"): ("shen_you_xu", "metal"),
    frozenset("亥子丑"): ("hai_zi_chou", "water"),
}
BRANCH_TRINES = {
    frozenset("申子辰"): ("shen_zi_chen", "water"),
    frozenset("寅午戌"): ("yin_wu_xu", "fire"),
    frozenset("巳酉丑"): ("si_you_chou", "metal"),
    frozenset("亥卯未"): ("hai_mao_wei", "wood"),
}
BRANCH_TRINE_ORDER = {
    "shen_zi_chen": ["申", "子", "辰"],
    "yin_wu_xu": ["寅", "午", "戌"],
    "si_you_chou": ["巳", "酉", "丑"],
    "hai_mao_wei": ["亥", "卯", "未"],
}
BRANCH_MEETING_ORDER = {
    "yin_mao_chen": ["寅", "卯", "辰"],
    "si_wu_wei": ["巳", "午", "未"],
    "shen_you_xu": ["申", "酉", "戌"],
    "hai_zi_chou": ["亥", "子", "丑"],
}
STEM_COMBINES = {
    frozenset("甲己"): "earth", frozenset("乙庚"): "metal",
    frozenset("丙辛"): "water", frozenset("丁壬"): "wood",
    frozenset("戊癸"): "fire",
}

STEM_COMBINE_ORDER = {
    frozenset(("甲","己")):("甲","己"), frozenset(("乙","庚")):("乙","庚"),
    frozenset(("丙","辛")):("丙","辛"), frozenset(("丁","壬")):("丁","壬"),
    frozenset(("戊","癸")):("戊","癸"),
}
BRANCH_HALF_COMBINES = {
    frozenset("寅午"): ("yin_wu", "fire"), frozenset("午戌"): ("wu_xu", "fire"),
    frozenset("申子"): ("shen_zi", "water"), frozenset("子辰"): ("zi_chen", "water"),
    frozenset("巳酉"): ("si_you", "metal"), frozenset("酉丑"): ("you_chou", "metal"),
    frozenset("亥卯"): ("hai_mao", "wood"), frozenset("卯未"): ("mao_wei", "wood"),
}
ELEMENT_CN = {"wood":"木", "fire":"火", "earth":"土", "metal":"金", "water":"水"}
PATTERN_BY_PAIR = {(r["day_stem"], r["month_branch"]): r for r in PATTERN_MATRIX["entries"]}
UG_CATALOG = json.loads((ROOT / "ontology/shao_weihua/W04_USEFUL_GOD_CASES.json").read_text(encoding="utf-8"))["entries"]
UG_BY_ID = {r["case_id"]: r for r in UG_CATALOG}
SHENSHA_CATALOG = json.loads((ROOT / "ontology/shao_weihua/W04_SHENSHA_CATALOG.json").read_text(encoding="utf-8"))["entries"]

DEFAULT_PARAMETERS = {"support_many_min": 4, "restraint_many_min": 4, "root_many_min": 2}
STEM_YINYANG = dict(zip("甲乙丙丁戊己庚辛壬癸", ["yang","yin"]*5))
BRANCHES = list("子丑寅卯辰巳午未申酉戌亥")
SEXAGENARY = [
    "甲子","乙丑","丙寅","丁卯","戊辰","己巳","庚午","辛未","壬申","癸酉",
    "甲戌","乙亥","丙子","丁丑","戊寅","己卯","庚辰","辛巳","壬午","癸未",
    "甲申","乙酉","丙戌","丁亥","戊子","己丑","庚寅","辛卯","壬辰","癸巳",
    "甲午","乙未","丙申","丁酉","戊戌","己亥","庚子","辛丑","壬寅","癸卯",
    "甲辰","乙巳","丙午","丁未","戊申","己酉","庚戌","辛亥","壬子","癸丑",
    "甲寅","乙卯","丙辰","丁巳","戊午","己未","庚申","辛酉","壬戌","癸亥",
]
VOID_BY_XUN = [set("戌亥"),set("申酉"),set("午未"),set("辰巳"),set("寅卯"),set("子丑")]
TEN_GOD_GROUP = {
    "正财":"wealth","偏财":"wealth","正官":"official_kill","七杀":"official_kill","七煞":"official_kill",
    "正印":"resource","偏印":"resource","食神":"output","伤官":"output","比肩":"peer","劫财":"peer",
}


def _merge(target: dict[str, Any], update: Mapping[str, Any] | None) -> dict[str, Any]:
    if not update:
        return target
    for k,v in update.items():
        if isinstance(v, Mapping) and isinstance(target.get(k), dict):
            _merge(target[k], v)
        else:
            target[k] = deepcopy(v)
    return target


def _visible_stems(chart: Mapping[str, Any], luck_cycle=None, annual=None) -> list[str]:
    result=[chart["pillars"][p]["stem"] for p in ("year","month","hour")]
    if luck_cycle: result.append(luck_cycle["stem"])
    if annual: result.append(annual["stem"])
    return result


def _all_branches(chart: Mapping[str, Any], luck_cycle=None, annual=None) -> list[str]:
    result=[chart["pillars"][p]["branch"] for p in ("year","month","day","hour")]
    if luck_cycle: result.append(luck_cycle["branch"])
    if annual: result.append(annual["branch"])
    return result


def _all_stems(chart: Mapping[str, Any], luck_cycle=None, annual=None) -> list[str]:
    result=[chart["pillars"][p]["stem"] for p in ("year","month","day","hour")]
    if luck_cycle: result.append(luck_cycle["stem"])
    if annual: result.append(annual["stem"])
    return result


def compile_pattern(chart: Mapping[str, Any], *, luck_cycle=None, annual=None) -> dict[str, Any]:
    key=(chart["day_master"],chart["pillars"]["month"]["branch"])
    cell=deepcopy(PATTERN_BY_PAIR[key])
    visible=set(_visible_stems(chart,luck_cycle,annual))
    active=[]; fallback=[]
    for c in cell["candidate_patterns"]:
        if c["visible_stem"] is None or c["visible_stem"] in visible:
            active.append(c)
        else:
            fallback.append(c)
    if not active and cell["fallback_policy"]=="discretionary_when_no_hidden_stem_visible":
        status="discretionary_unknown"
    elif active:
        status="active_candidates"
    else:
        status="no_candidate"

    day_pillar=chart["pillars"]["day"]["stem"]+chart["pillars"]["day"]["branch"]
    hour_pillar=chart["pillars"]["hour"]["stem"]+chart["pillars"]["hour"]["branch"]
    jinshen_day_present=day_pillar in PILLAR_SETS["jinshen"]
    jinshen_hour_present=hour_pillar in PILLAR_SETS["jinshen"]
    # The source contains a broad day/hour statement and a narrower “六己日见
    # 金神时” clause.  Runtime uses the conservative, auditable intersection:
    # day-pillar 金神, or a 己 day with a 金神 hour.  The broader hour-only
    # candidate remains recorded but is not promoted automatically.
    jinshen_present=jinshen_day_present or (chart["day_master"]=="己" and jinshen_hour_present)
    day_element=STEM_ELEMENT[chart["day_master"]]
    output_visible=any(
        _relation_to_day(STEM_ELEMENT[chart["pillars"][pos]["stem"]],day_element)=="output"
        for pos in ("year","month","hour")
    )
    special=[]
    if jinshen_present and output_visible:
        special.append({"pattern":"金神伤官格","basis":"jinshen_pillar_and_visible_output","pillars":[x for x in (day_pillar,hour_pillar) if x in PILLAR_SETS["jinshen"]]})
    return {"evidence_compiled":True,"cell_key":cell["cell_key"],"day_stem":key[0],"month_branch":key[1],
            "all_candidates":cell["candidate_patterns"],"active_candidates":active,"fallback_candidates":fallback,
            "special_candidates":special,"jinshen_present":jinshen_present,
            "jinshen_day_present":jinshen_day_present,"jinshen_hour_candidate":jinshen_hour_present,
            "output_visible":output_visible,
            "status":status,"source_mode":cell["source_mode"],"raw_text":cell["raw_text"]}


def _relation_to_day(target: str, day: str) -> str:
    if target==day: return "peer"
    if GENERATES[target]==day: return "resource"
    if GENERATES[day]==target: return "output"
    if CONTROLS[day]==target: return "wealth"
    if CONTROLS[target]==day: return "official_kill"
    return "unknown"


def compile_strength(chart: Mapping[str, Any], parameters: Mapping[str, Any] | None=None) -> dict[str, Any]:
    p={**DEFAULT_PARAMETERS,**(parameters or {})}; day_el=STEM_ELEMENT[chart["day_master"]]
    month_el=BRANCH_ELEMENT[chart["pillars"]["month"]["branch"]]
    month_supportive=month_el==day_el or GENERATES[month_el]==day_el
    support=restraint=0; roots=[]; reasons=[]
    for pos in ("year","month","hour"):
        rel=_relation_to_day(STEM_ELEMENT[chart["pillars"][pos]["stem"]],day_el)
        if rel in {"peer","resource"}: support+=1
        elif rel in {"output","wealth","official_kill"}: restraint+=1
        reasons.append(f"stem:{pos}:{rel}")
    for pos,pillar in chart["pillars"].items():
        rels={_relation_to_day(STEM_ELEMENT[h["stem"]],day_el) for h in pillar.get("hidden_stems",[])}
        if rels & {"peer","resource"}: support+=1
        if rels & {"output","wealth","official_kill"}: restraint+=1
        if any(STEM_ELEMENT[h["stem"]]==day_el for h in pillar.get("hidden_stems",[])): roots.append(pos)
    support_level="many" if support>=p["support_many_min"] else "few"
    restraint_level="many" if restraint>=p["restraint_many_min"] else "few"
    if support_level=="many" and restraint_level=="few": category="strong"
    elif support_level=="few" and restraint_level=="many": category="weak"
    elif month_supportive and (support>=restraint or (len(roots)>=2 and support+1>=restraint)): category="strong"
    elif (not month_supportive) and restraint>=support+2: category="weak"
    else: category="balanced_or_contested"
    return {"evidence_compiled":True,"month_supportive":month_supportive,"support_count":support,"restraint_count":restraint,
            "support_level":support_level,"restraint_level":restraint_level,"root_positions":roots,
            "root_level":"many" if len(roots)>=p["root_many_min"] else "some" if roots else "none",
            "category":category,"reasons":reasons,"thresholds":p}


def _ten_god_counts(chart: Mapping[str, Any]) -> Counter[str]:
    c=Counter()
    for pos,pillar in chart["pillars"].items():
        if pos!="day": c[TEN_GOD_GROUP.get(pillar.get("stem_ten_god"),"unknown")]+=1
        for h in pillar.get("hidden_stems",[]): c[TEN_GOD_GROUP.get(h.get("ten_god"),"unknown")]+=1
    return c


def _token_rows(chart: Mapping[str, Any]) -> list[dict[str, Any]]:
    day_element=STEM_ELEMENT[chart["day_master"]]
    rows=[]
    for idx,pos in enumerate(("year","month","day","hour")):
        pillar=chart["pillars"][pos]
        if pos!="day":
            rows.append({"token":pillar["stem"],"kind":"stem","position":pos,"index":idx,"group":_relation_to_day(STEM_ELEMENT[pillar["stem"]],day_element),"element":STEM_ELEMENT[pillar["stem"]]})
        rows.append({"token":pillar["branch"],"kind":"branch","position":pos,"index":idx,"group":_relation_to_day(BRANCH_ELEMENT[pillar["branch"]],day_element),"element":BRANCH_ELEMENT[pillar["branch"]]})
    return rows


def compile_useful_god(chart: Mapping[str, Any], pattern: Mapping[str, Any], strength: Mapping[str, Any]) -> dict[str, Any]:
    active={r["pattern"] for r in pattern["active_candidates"]}; counts=_ten_god_counts(chart)
    many={k for k,v in counts.items() if v>=4}; available={k for k,v in counts.items() if v>0}
    matched=[]
    for row in UG_CATALOG:
        pats=row["pattern"] if isinstance(row["pattern"],list) else [row["pattern"]]
        if row["case_id"]=="analog_secondary_patterns":
            if active & set(pats): matched.append(row["case_id"])
            continue
        if row["case_id"]=="climate_when_pattern_unclear":
            if not active or pattern["status"]=="discretionary_unknown": matched.append(row["case_id"])
            continue
        if not active & set(pats): continue
        if row["strength"] not in {"any",strength["category"]}: continue
        trigger=row["trigger"]
        base=trigger.replace("_no_official_kill","").replace("_no_resource","").replace("_no_wealth","").replace("_no_peer","")
        group=base.replace("_many","")
        ok=group in many
        if "_no_official_kill" in trigger: ok=ok and "official_kill" not in available
        if "_no_resource" in trigger: ok=ok and "resource" not in available
        if "_no_wealth" in trigger: ok=ok and "wealth" not in available
        if "_no_peer" in trigger: ok=ok and "peer" not in available
        if ok: matched.append(row["case_id"])
    candidates=[UG_BY_ID[i]["candidate"] for i in matched]
    rows=_token_rows(chart)
    branches=set(_all_branches(chart))
    meetings=[]
    for catalog, kind in ((BRANCH_MEETINGS, "meeting"), (BRANCH_TRINES, "trine")):
        for group,(slug,element) in catalog.items():
            if group.issubset(branches): meetings.append({"slug":slug,"element":element,"branches":sorted(group),"kind":kind})

    specific=[]; basis=[]
    # 金神以火为制化要点；若火透，优先返回具体火干。
    if pattern.get("jinshen_present"):
        fire_stems=[r for r in rows if r["kind"]=="stem" and r["element"]=="fire"]
        if fire_stems:
            specific.append(sorted(fire_stems,key=lambda r:(abs(r["index"]-2),r["index"]))[0]["token"]); basis.append("jinshen_uses_visible_fire")
    # 三会成方后，若所会五行为日主印星且过多，则取命局实有财星疏泄。
    day_element=STEM_ELEMENT[chart["day_master"]]
    resource_element=next((e for e,target in GENERATES.items() if target==day_element),None)
    if any(m["element"]==resource_element for m in meetings) and counts.get("resource",0)>=4:
        wealth_rows=[r for r in rows if r["group"]=="wealth"]
        if wealth_rows:
            specific.append(sorted(wealth_rows,key=lambda r:(0 if r["kind"]=="branch" else 1,abs(r["index"]-2),r["index"]))[0]["token"]); basis.append("meeting_resource_excess_uses_wealth")
    # General candidate categories are resolved to an actually present token.
    for group in candidates:
        if group in {"profile_defined","climate_candidate"}: continue
        group_rows=[r for r in rows if r["group"]==group]
        if group_rows:
            specific.append(sorted(group_rows,key=lambda r:(abs(r["index"]-2),0 if r["kind"]=="branch" else 1,r["index"]))[0]["token"]); basis.append(f"present_{group}_token")
    # Early-spring wood examples explicitly take a visible fire stem for warming.
    month=chart["pillars"]["month"]["branch"]
    if day_element=="wood" and month in {"寅","卯"}:
        fire_stems=[r for r in rows if r["kind"]=="stem" and r["element"]=="fire"]
        if fire_stems:
            specific.append(sorted(fire_stems,key=lambda r:(abs(r["index"]-2),r["index"]))[0]["token"]); basis.append("spring_wood_visible_fire_climate")
    specific=list(dict.fromkeys(specific))
    visible_stems=set(_visible_stems(chart))
    hidden_visible_links=[]
    for pos,pillar in chart["pillars"].items():
        for hidden in pillar.get("hidden_stems",[]):
            if hidden["stem"] in visible_stems:
                hidden_visible_links.append({"branch":pillar["branch"],"hidden_stem":hidden["stem"],"position":pos})
    wood_meeting=any(m["element"]=="wood" for m in meetings)
    wood_blocks_fire=bool(day_element=="fire" and wood_meeting and counts.get("resource",0)>=4)
    return {"evidence_compiled":True,"ten_god_group_counts":dict(counts),"many_groups":sorted(many),
            "matched_case_ids":matched,"candidate_useful_gods":candidates,"specific_useful_tokens":specific,
            "specific_useful_basis":basis,"specific_useful_available":bool(specific),"meeting_groups":meetings,
            "wood_many_fire_blocked":wood_blocks_fire,"hidden_visible_links":hidden_visible_links,
            "hidden_visible_link_present":bool(hidden_visible_links)}


# Detection maps
STEM_BRANCH_MAPS={
"tianyi":{"甲":"丑未","戊":"丑未","乙":"子申","己":"子申","丙":"亥酉","丁":"亥酉","壬":"卯巳","癸":"卯巳","庚":"寅午","辛":"寅午"},
"taiji":{"甲":"子午","乙":"子午","丙":"卯酉","丁":"卯酉","戊":"辰戌丑未","己":"辰戌丑未","庚":"寅亥","辛":"寅亥","壬":"巳申","癸":"巳申"},
"fuxing":{"甲":"寅子","丙":"寅子","乙":"卯丑","癸":"卯丑","戊":"申","己":"未","丁":"亥","庚":"午","辛":"巳","壬":"辰"},
"wenchang":{"甲":"巳","乙":"午","丙":"申","戊":"申","丁":"酉","己":"酉","庚":"亥","辛":"子","壬":"寅","癸":"卯"},
"guoyin":{"甲":"戌","乙":"亥","丙":"丑","丁":"寅","戊":"丑","己":"寅","庚":"辰","辛":"巳","壬":"未","癸":"申"},
"jinyu":{"甲":"辰","乙":"巳","丙":"未","戊":"未","丁":"申","己":"申","庚":"戌","辛":"亥","壬":"丑","癸":"寅"},
"lushen":{"甲":"寅","乙":"卯","丙":"巳","戊":"巳","丁":"午","己":"午","庚":"申","辛":"酉","壬":"亥","癸":"子"},
"yangren":{"甲":"卯","乙":"寅","丙":"午","戊":"午","丁":"巳","己":"巳","庚":"酉","辛":"申","壬":"子","癸":"亥"},
}
GROUP_TARGETS={
"yima":{"申子辰":"寅","寅午戌":"申","巳酉丑":"亥","亥卯未":"巳"},
"huagai":{"寅午戌":"戌","亥卯未":"未","申子辰":"辰","巳酉丑":"丑"},
"jiangxing":{"寅午戌":"午","巳酉丑":"酉","申子辰":"子","亥卯未":"卯"},
"jiesha":{"申子辰":"巳","寅午戌":"亥","巳酉丑":"寅","亥卯未":"申"},
"zaisha":{"寅午戌":"子","申子辰":"午","亥卯未":"酉","巳酉丑":"卯"},
"xianchi":{"申子辰":"酉","巳酉丑":"午","寅午戌":"卯","亥卯未":"子"},
"guchen":{"亥子丑":"寅","寅卯辰":"巳","巳午未":"申","申酉戌":"亥"},
"guasu":{"亥子丑":"戌","寅卯辰":"丑","巳午未":"辰","申酉戌":"未"},
}
TIANDE={"寅":"丁","卯":"申","辰":"壬","巳":"辛","午":"亥","未":"甲","申":"癸","酉":"寅","戌":"丙","亥":"乙","子":"巳","丑":"庚"}
YUEDE={"寅午戌":"丙","申子辰":"壬","亥卯未":"甲","巳酉丑":"庚"}
TIANYI_MED={"寅":"丑","卯":"寅","辰":"卯","巳":"辰","午":"巳","未":"午","申":"未","酉":"申","戌":"酉","亥":"戌","子":"亥","丑":"子"}
PILLAR_SETS={
"kuigang":{"壬辰","庚戌","庚辰","戊戌"},"jinshen":{"乙丑","己巳","癸酉"},
"shie_dabai":{"甲辰","乙巳","壬申","丙申","丁亥","庚辰","戊戌","癸亥","辛巳","己丑"},
"guluan":{"乙巳","丁巳","辛亥","戊申","壬寅","戊午","壬子","丙午"},
"yinyang_chacuo":{"丙子","丁丑","戊寅","辛卯","壬辰","癸巳","丙午","丁未","戊申","辛酉","壬戌","癸亥"},
}


def _group_target(source: str, table: Mapping[str,str]) -> str | None:
    for group,target in table.items():
        if source in group: return target
    return None


def _detect_shensha(chart: Mapping[str, Any], sid: str, annotations: Mapping[str,Any] | None=None) -> bool | None:
    stems=_all_stems(chart); branches=_all_branches(chart); year_stem=stems[0]; day_stem=chart["day_master"]
    year_branch=branches[0]; day_branch=chart["pillars"]["day"]["branch"]
    day_pillar=chart["pillars"]["day"]["stem"]+day_branch; hour_pillar=chart["pillars"]["hour"]["stem"]+branches[3]
    if annotations and sid in annotations: return bool(annotations[sid])
    if sid in STEM_BRANCH_MAPS:
        keys=[day_stem] if sid in {"jinyu","lushen","yangren"} else [year_stem,day_stem]
        return any(any(b in STEM_BRANCH_MAPS[sid][k] for b in branches) for k in keys)
    if sid in GROUP_TARGETS:
        sources=[year_branch] if sid in {"zaisha","guchen","guasu"} else [year_branch,day_branch]
        return any((_group_target(s,GROUP_TARGETS[sid]) in branches) for s in sources)
    if sid=="tiande": return TIANDE[chart["pillars"]["month"]["branch"]] in set(stems+branches)
    if sid=="yuede": return _group_target(chart["pillars"]["month"]["branch"],YUEDE) in stems
    if sid=="sanqi": return any(stems[i:i+3]==list(seq) for seq in ["甲戊庚","乙丙丁","壬癸辛"] for i in range(len(stems)-2))
    if sid=="xuetang" or sid=="ciguan": return None
    if sid=="dexiu":
        month=chart["pillars"]["month"]["branch"]
        sets=[("寅午戌",set("丙丁戊癸")),("申子辰",set("壬癸戊己丙辛甲")),("巳酉丑",set("庚辛乙")),("亥卯未",set("甲乙丁壬"))]
        return any(month in group and len(set(stems)&needed)>=2 for group,needed in sets)
    if sid in PILLAR_SETS:
        if sid=="jinshen": return day_pillar in PILLAR_SETS[sid] or hour_pillar in PILLAR_SETS[sid]
        if sid=="guluan": return day_pillar in PILLAR_SETS[sid] and hour_pillar in PILLAR_SETS[sid]
        return day_pillar in PILLAR_SETS[sid]
    if sid=="tianyi_medical": return TIANYI_MED[chart["pillars"]["month"]["branch"]] in branches
    if sid=="gonglu": return (day_pillar,hour_pillar) in {("癸亥","癸丑"),("癸丑","癸亥"),("丁巳","丁未"),("己未","己巳"),("戊辰","戊午")}
    if sid=="tianshe":
        target=_group_target(chart["pillars"]["month"]["branch"],{"寅卯辰":"戊寅","巳午未":"甲午","申酉戌":"戊申","亥子丑":"甲子"})
        return day_pillar==target
    if sid=="tianluodiwang": return set("辰巳").issubset(branches) or set("戌亥").issubset(branches)
    if sid in {"gou","jiao","yuanchen"}:
        sex=chart.get("traditional_context",{}).get("sex_parameter","unspecified")
        if sex not in {"male","female"}: return None
        yang=STEM_YINYANG[year_stem]=="yang"; forward=(sex=="male" and yang) or (sex=="female" and not yang)
        idx=BRANCHES.index(year_branch); target=BRANCHES[(idx+(3 if (sid=="gou")==forward else -3))%12] if sid in {"gou","jiao"} else BRANCHES[(idx+(7 if forward else 5))%12]
        return target in branches[1:]
    if sid=="wangshen":
        table={"寅午戌":"巳","巳酉丑":"申","申子辰":"亥","亥卯未":"寅"}
        return any(set(group).issubset(branches) and target in branches for group,target in table.items())
    if sid=="kongwang":
        try: xun=SEXAGENARY.index(day_pillar)//10
        except ValueError: return None
        return any(b in VOID_BY_XUN[xun] for b in [branches[0],branches[1],branches[3]])
    if sid=="sifei":
        month=chart["pillars"]["month"]["branch"]
        targets=set()
        if month in "寅卯辰": targets={"庚申","辛酉"}
        elif month in "巳午未": targets={"壬子","癸亥"}
        elif month in "申酉戌": targets={"甲寅","乙卯"}
        else: targets={"丙午","丁巳"}
        return day_pillar in targets
    return None


def compile_shensha(chart: Mapping[str, Any], annotations: Mapping[str, Any] | None=None) -> dict[str, Any]:
    detections={}; present=[]; unknown=[]
    for row in SHENSHA_CATALOG:
        sid=row["shensha_id"]; value=_detect_shensha(chart,sid,annotations)
        detections[sid]=value
        if value is True: present.append(sid)
        elif value is None: unknown.append(sid)
    return {"evidence_compiled":True,"detections":detections,"present":present,"unknown":unknown,
            "any_present":bool(present),"context_available":True,"supplementary_only":True}


def compile_temporal(chart: Mapping[str, Any], *, luck_cycle=None, annual=None, annotations=None) -> dict[str, Any]:
    branches=_all_branches(chart,luck_cycle,annual); stems=_all_stems(chart,luck_cycle,annual)
    ev={"evaluation_order":True,"luck_ten_god_mapping":luck_cycle is not None,"luck_stem_branch_weight":luck_cycle is not None,
        "state_chain":True,"luck_branch_full_effect":luck_cycle is not None,"annual_branch_tai_sui_w04":annual is not None,
        "favorable_stage":False,"unfavorable_stage":False,"neutral_stage":False,"interaction_can_reverse":bool(luck_cycle or annual),
        "temporal_priority_interaction":bool(luck_cycle or annual),"latent_combination_transform":False,
        "remove_unfavorable":False,"remove_favorable":False,"favorable_blocked":False,"unfavorable_blocked":False,
        "successful_transform":False,"punishment_signal":False,"heaven_earth_clash":False,"mixed_heaven_earth":False,
        "multi_target_conflict":False,"multi_target_combination":False,"hurt_official_vs_official":False,"opposing_groups":False,
        "palace_clash":False,"kinship_star_punishment":False,"repeated_punishment":False,"offend_tai_sui":False}
    if annual:
        ev["offend_tai_sui"] = CONTROLS[STEM_ELEMENT[chart["day_master"]]]==STEM_ELEMENT[annual["stem"]]
    return _merge(ev,annotations)


def _active_stem_rows(chart: Mapping[str, Any], *, luck_cycle=None, annual=None, include_hidden: bool = True) -> list[dict[str, Any]]:
    rows=[]
    for pos in ("year","month","hour"):
        pillar=chart["pillars"][pos]; stem=pillar["stem"]
        rows.append({"ref_id":f"natal.{pos}.stem","position":pos,"layer":"natal","stem":stem,
                     "element":STEM_ELEMENT[stem],"ten_god":pillar.get("stem_ten_god") or chart["ten_god_map"].get(stem),"visible":True})
    if luck_cycle:
        stem=luck_cycle["stem"]
        rows.append({"ref_id":"luck.stem","position":"luck","layer":"luck","stem":stem,"element":STEM_ELEMENT[stem],
                     "ten_god":luck_cycle.get("stem_ten_god") or chart["ten_god_map"].get(stem),"visible":True})
    if annual:
        stem=annual["stem"]
        rows.append({"ref_id":"annual.stem","position":"annual","layer":"annual","stem":stem,"element":STEM_ELEMENT[stem],
                     "ten_god":annual.get("stem_ten_god") or chart["ten_god_map"].get(stem),"visible":True})
    if include_hidden:
        for pos in ("year","month","day","hour"):
            for i,h in enumerate(chart["pillars"][pos].get("hidden_stems",[]),1):
                stem=h["stem"]
                rows.append({"ref_id":f"natal.{pos}.hidden.{i}","position":pos,"layer":"natal","stem":stem,
                             "element":STEM_ELEMENT[stem],"ten_god":h.get("ten_god") or chart["ten_god_map"].get(stem),"visible":False})
        if luck_cycle:
            for i,h in enumerate(luck_cycle.get("hidden_stems",[]),1):
                stem=h["stem"]
                rows.append({"ref_id":f"luck.hidden.{i}","position":"luck","layer":"luck","stem":stem,
                             "element":STEM_ELEMENT[stem],"ten_god":h.get("ten_god") or chart["ten_god_map"].get(stem),"visible":False})
    return rows


def _active_pillar_rows(chart: Mapping[str, Any], *, luck_cycle=None, annual=None) -> list[dict[str, Any]]:
    rows=[]
    for pos in ("year","month","day","hour"):
        p=chart["pillars"][pos]
        rows.append({"position":pos,"layer":"natal","stem":p["stem"],"branch":p["branch"]})
    if luck_cycle:
        rows.append({"position":"luck","layer":"luck","stem":luck_cycle["stem"],"branch":luck_cycle["branch"]})
    if annual:
        rows.append({"position":"annual","layer":"annual","stem":annual["stem"],"branch":annual["branch"]})
    return rows


def compile_relations(chart: Mapping[str, Any], *, luck_cycle=None, annual=None) -> dict[str, Any]:
    """Compile the author's six harms, meetings and half-combinations.

    These are structural relations only. Whether a relation helps or harms the
    active pattern remains a later school-specific decision.
    """
    pillar_rows = _active_pillar_rows(chart, luck_cycle=luck_cycle, annual=annual)
    branches = [x["branch"] for x in pillar_rows]
    branch_set = set(branches)
    clashes=[]; clash_flags={}; heaven_earth_clashes=[]
    for i,left in enumerate(pillar_rows):
        for right in pillar_rows[i+1:]:
            pair=frozenset((left["branch"],right["branch"]))
            if pair not in BRANCH_CLASH_PAIRS:
                continue
            row={"relation":"clash","branches":[left["branch"],right["branch"]],"slug":BRANCH_CLASH_PAIRS[pair],"left":left,"right":right}
            clashes.append(row); clash_flags[f"branch_clash_{BRANCH_CLASH_PAIRS[pair]}"]=True
            le,re=STEM_ELEMENT[left["stem"]],STEM_ELEMENT[right["stem"]]
            if CONTROLS.get(le)==re or CONTROLS.get(re)==le:
                heaven_earth_clashes.append({**row,"stems":[left["stem"],right["stem"]]})
    branch_counts=Counter(branches)
    repeated_clashes=[]
    for pair,slug in BRANCH_CLASH_PAIRS.items():
        a,b=tuple(pair); ca,cb=branch_counts[a],branch_counts[b]
        if ca and cb and (ca>1 or cb>1):
            repeated_clashes.append({"slug":slug,"a":a,"b":b,"a_count":ca,"b_count":cb})
    harms=[]; flags={}
    for pair,slug in BRANCH_HARM_PAIRS.items():
        present=pair.issubset(branch_set); flags[f"branch_harm_{slug}"]=present
        if present: harms.append({"relation":"harm","pair":sorted(pair),"slug":slug,"requires_resolution_check":True})
    meetings=[]; meeting_flags={}
    for group,(slug,element) in BRANCH_MEETINGS.items():
        present=group.issubset(branch_set); meeting_flags[f"branch_meeting_{slug}"]=present
        if present: meetings.append({"relation":"meeting","branches":BRANCH_MEETING_ORDER[slug],"slug":slug,"element":element})
    trines=[]; trine_flags={}
    for group,(slug,element) in BRANCH_TRINES.items():
        present=group.issubset(branch_set); trine_flags[f"branch_trine_{slug}"]=present
        if present: trines.append({"relation":"trine","branches":BRANCH_TRINE_ORDER[slug],"slug":slug,"element":element})
    half=[]; half_combine_flags={}
    complete_groups=[set(x["branches"]) for x in meetings+trines]
    for pair,(slug,element) in BRANCH_HALF_COMBINES.items():
        present=pair.issubset(branch_set); half_combine_flags[f"branch_half_combine_{slug}"]=present
        absorbed=any(set(pair).issubset(group) for group in complete_groups)
        if present: half.append({"relation":"half_combine","branches":sorted(pair),"slug":slug,"element":element,"absorbed_by_complete_group":absorbed})
    visible_stems=_active_stem_rows(chart,luck_cycle=luck_cycle,annual=annual,include_hidden=False)
    stem_combinations=[]
    for i,left in enumerate(visible_stems):
        for right in visible_stems[i+1:]:
            pair=frozenset((left["stem"],right["stem"]))
            if pair in STEM_COMBINES:
                stem_combinations.append({"relation":"stem_combine","stems":[left["stem"],right["stem"]],
                                          "left":left,"right":right,"transform_element":STEM_COMBINES[pair]})
    return {"evidence_compiled":True,"active_branches":branches,"active_pillars":pillar_rows,
            "clash_flags":clash_flags,"clashes":clashes,"clash_count":len(clashes),
            "heaven_earth_clashes":heaven_earth_clashes,"heaven_earth_clash_present":bool(heaven_earth_clashes),
            "repeated_clashes":repeated_clashes,"repeated_clash_present":bool(repeated_clashes),
            "branch_counts":dict(branch_counts),
            "harm_flags":flags,"harms":harms,"harm_count":len(harms),
            "meeting_flags":meeting_flags,"meetings":meetings,"meeting_count":len(meetings),
            "trine_flags":trine_flags,"trines":trines,"trine_count":len(trines),"trine_count_nonzero":bool(trines),
            "half_combine_flags":half_combine_flags,"half_combines":half,"half_combine_count":len(half),
            "six_harm_catalog_complete":len(BRANCH_HARM_PAIRS)==6,"meeting_catalog_complete":len(BRANCH_MEETINGS)==4,
            "trine_catalog_complete":len(BRANCH_TRINES)==4,
            "half_combine_catalog_complete":len(BRANCH_HALF_COMBINES)==8,
            "active_visible_stems":visible_stems,"stem_combinations":stem_combinations,
            "stem_combination_present":bool(stem_combinations),"deterministic_event_output":False}


def compile_compound_relations(
    chart: Mapping[str, Any], strength: Mapping[str, Any], relations: Mapping[str, Any],
    *, luck_cycle=None, annual=None,
) -> dict[str, Any]:
    """Synthesize the author's complete 三合 and multi-step 生克 examples.

    The output remains structural.  No life-event label is generated.
    """
    rows=_token_rows(chart); day_element=STEM_ELEMENT[chart["day_master"]]
    element_rows={e:[r for r in rows if r["element"]==e] for e in ELEMENT_CN}
    trine_chains=[]; labels=[]
    stem_rows=_active_stem_rows(chart,luck_cycle=luck_cycle,annual=annual,include_hidden=True)
    for clash in relations.get("clashes",[]):
        labels.append(f"{clash['left']['branch']}{clash['right']['branch']}相冲")
    for clash in relations.get("heaven_earth_clashes",[]):
        left,right=clash["left"],clash["right"]
        labels.append(f"{left['stem']}{left['branch']}与{right['stem']}{right['branch']}天克地冲")
    for clash in relations.get("repeated_clashes",[]):
        if clash["a_count"]>1:
            labels.append(f"两{clash['a']}冲一{clash['b']}" if clash["a_count"]==2 and clash["b_count"]==1 else f"{clash['a_count']}{clash['a']}冲{clash['b_count']}{clash['b']}")
        if clash["b_count"]>1:
            labels.append(f"两{clash['b']}冲一{clash['a']}" if clash["b_count"]==2 and clash["a_count"]==1 else f"{clash['b_count']}{clash['b']}冲{clash['a_count']}{clash['a']}")
    visible_stem_rows=[x for x in stem_rows if x["visible"]]
    official_rows=[x for x in stem_rows if x.get("ten_god")=="正官"]
    kill_rows=[x for x in stem_rows if x.get("ten_god") in {"七杀","七煞"}]
    official_kill_mixed=bool(official_rows and kill_rows)
    if official_kill_mixed:
        labels.append("官杀混杂")
        official_tokens=list(dict.fromkeys(x["stem"] for x in official_rows))
        kill_tokens=list(dict.fromkeys(x["stem"] for x in kill_rows))
        if official_tokens and kill_tokens:
            labels.append(f"{kill_tokens[0]}{official_tokens[0]}官杀混杂")
    stem_combinations=relations.get("stem_combinations",[])
    for pair in stem_combinations:
        ordered=STEM_COMBINE_ORDER.get(frozenset(pair["stems"]),tuple(pair["stems"]))
        labels.append("".join(ordered)+"相合")
    kill_refs={x["ref_id"] for x in kill_rows}
    kill_combined_pairs=[p for p in stem_combinations if p["left"]["ref_id"] in kill_refs or p["right"]["ref_id"] in kill_refs]
    remove_kill_keep_official=bool(official_rows and kill_combined_pairs)
    if remove_kill_keep_official:
        labels.append("去杀留官")

    # Temporal aggregation keeps each active stem/hidden stem as a separate
    # node.  This captures repeated luck/annual官杀 without inventing missing
    # small-luck pillars.
    active_metal_nodes=[x for x in stem_rows if x["element"]=="metal"]
    if luck_cycle:
        active_metal_nodes.append({"ref_id":"luck.branch","position":"luck","layer":"luck","stem":luck_cycle["branch"],"element":BRANCH_ELEMENT[luck_cycle["branch"]],"visible":False}) if BRANCH_ELEMENT[luck_cycle["branch"]]=="metal" else None
    if annual:
        active_metal_nodes.append({"ref_id":"annual.branch","position":"annual","layer":"annual","stem":annual["branch"],"element":BRANCH_ELEMENT[annual["branch"]],"visible":False}) if BRANCH_ELEMENT[annual["branch"]]=="metal" else None
    metal_pressure_count=len({x["ref_id"] for x in active_metal_nodes})
    metal_pressure_on_wood=bool(day_element=="wood" and metal_pressure_count>=3 and (luck_cycle or annual))
    if metal_pressure_on_wood:
        labels.append("金多克木")
        labels.append(f"金多围克{chart['day_master']}木")

    # Visible output -> wealth -> official chain, with the official allowed to
    # reside in a branch.  Wealth mediates the output-official conflict.
    hurt_rows=[x for x in visible_stem_rows if x.get("ten_god")=="伤官"]
    for hurt in hurt_rows:
        labels.append(f"{hurt['stem']}{ELEMENT_CN[hurt['element']]}为伤官")
    wealth_stem_rows=[x for x in visible_stem_rows if x.get("ten_god") in {"正财","偏财"}]
    output_wealth_official_chains=[]
    for hurt in hurt_rows:
        for wealth in wealth_stem_rows:
            if GENERATES.get(hurt["element"])!=wealth["element"]: continue
            for official in official_rows:
                if GENERATES.get(wealth["element"])==official["element"]:
                    output_wealth_official_chains.append({"hurt":hurt,"wealth":wealth,"official":official})
    if output_wealth_official_chains:
        labels.append("财星泄伤官")
        first=output_wealth_official_chains[0]
        labels.append(f"{first['official']['stem']}金官星未受伤" if first['official']['element']=="metal" else f"{first['official']['stem']}官星未受伤")

    # v1.6: expose exact visible/hidden wealth roles and the author's
    # strong-body/weak-wealth and peer-controls-wealth synthesis.
    visible_wealth_rows_exact=[x for x in visible_stem_rows if x.get("ten_god") in {"正财","偏财"}]
    for x in visible_wealth_rows_exact:
        labels.append(f"{x['stem']}{ELEMENT_CN[x['element']]}为{x['ten_god']}")
    hidden_wealth_rows=[]
    for pos in ("year","month","day","hour"):
        p=chart["pillars"][pos]
        for h in p.get("hidden_stems",[]):
            if h.get("ten_god") in {"正财","偏财"}:
                row={"position":pos,"branch":p["branch"],"stem":h["stem"],"ten_god":h["ten_god"],"element":STEM_ELEMENT[h["stem"]]}
                hidden_wealth_rows.append(row)
                labels.append(f"{p['branch']}中{h['stem']}{ELEMENT_CN[row['element']]}为{h['ten_god']}")
    wealth_targets=visible_wealth_rows_exact+[
        {"stem":x["stem"],"element":x["element"],"ten_god":x["ten_god"],"position":x["position"],"visible":False}
        for x in hidden_wealth_rows
    ]
    peer_stems=[chart["day_master"]]+[x["stem"] for x in visible_stem_rows if x.get("ten_god") in {"比肩","劫财"}]
    peer_controls_wealth=bool(peer_stems and wealth_targets)
    if peer_controls_wealth:
        peers="".join(dict.fromkeys(peer_stems))
        labels.append(f"{peers}比劫克财")
    strong_weak_wealth=bool(strength.get("category")=="strong" and len(visible_wealth_rows_exact)==1)
    if strong_weak_wealth:
        w=visible_wealth_rows_exact[0]
        labels.append(f"旺{ELEMENT_CN[day_element]}克{w['stem']}财")
        labels.append(f"旺{ELEMENT_CN[day_element]}克弱财")
        labels.append("身旺财弱")

    # v1.8: compound terminal facts are directional, not mere co-presence.
    visible_resource_all=[x for x in visible_stem_rows if x.get("ten_god") in {"正印","偏印"}]
    resource_controls_hurt_pairs=[]
    for resource in visible_resource_all:
        for hurt in hurt_rows:
            if CONTROLS.get(resource["element"]) == hurt["element"]:
                resource_controls_hurt_pairs.append({"resource":resource,"hurt":hurt,
                    "label":f"{resource['stem']}印制{hurt['stem']}伤官"})
    hurt_resource_control_structure=bool(resource_controls_hurt_pairs)
    if hurt_resource_control_structure:
        labels.append("伤官佩印")
        labels.extend(x["label"] for x in resource_controls_hurt_pairs)

    visible_group_counts=Counter(
        "wealth" if x.get("ten_god") in {"正财","偏财"} else
        "official_kill" if x.get("ten_god") in {"正官","七杀","七煞"} else
        "resource" if x.get("ten_god") in {"正印","偏印"} else "other"
        for x in visible_stem_rows
    )
    wealth_official_resource_complete=all(visible_group_counts[k]>0 for k in ("wealth","official_kill","resource"))
    if wealth_official_resource_complete:
        labels.append("财官印俱全")

    output_water_count=sum(
        1 for x in stem_rows if x.get("ten_god") in {"食神","伤官"} and x.get("element")=="water"
    ) + sum(
        1 for pos in ("year","month","day","hour")
        if BRANCH_ELEMENT[chart["pillars"][pos]["branch"]]=="water"
        and _relation_to_day("water",day_element)=="output"
    )
    metal_water_hurt=bool(day_element=="metal" and output_water_count>=2 and any(x.get("ten_god")=="伤官" for x in visible_stem_rows))
    if metal_water_hurt:
        labels.append("金水伤官")

    huagai_map={frozenset("申子辰"):"辰",frozenset("寅午戌"):"戌",frozenset("巳酉丑"):"丑",frozenset("亥卯未"):"未"}
    natal_branches=[chart["pillars"][p]["branch"] for p in ("year","month","day","hour")]
    huagai_branches=[]
    for base_pos in ("year","day"):
        base=chart["pillars"][base_pos]["branch"]
        for group,marker in huagai_map.items():
            if base in group and marker in natal_branches:
                huagai_branches.append(marker)
    huagai_branches=list(dict.fromkeys(huagai_branches))
    resource_meets_huagai=bool(huagai_branches and any(
        _relation_to_day(BRANCH_ELEMENT[b],day_element)=="resource" for b in huagai_branches
    ))
    if resource_meets_huagai:
        labels.append("印逢华盖")
    repeated_clash_movement_semantic=bool(relations.get("repeated_clash_present"))
    if repeated_clash_movement_semantic:
        labels.append("重复冲动形成走动象")

    visible_resources=[x for x in visible_stem_rows if x.get("ten_god")=="偏印"]
    resource_token_counts=Counter(x["stem"] for x in visible_resources)
    repeated_resource_token=next((token for token,count in resource_token_counts.items() if count>=3),None)
    resource_concentrated=len(visible_resources)>=3
    if repeated_resource_token:
        labels.append(f"三个{repeated_resource_token}{ELEMENT_CN[STEM_ELEMENT[repeated_resource_token]]}偏印透出")
    if resource_concentrated:
        labels.append("枭印集中")
    temporal_trine_from_luck=False
    for trine in relations.get("trines",[]):
        element=trine["element"]
        if luck_cycle and luck_cycle.get("branch") in trine.get("branches",[]):
            temporal_trine_from_luck=True
            labels.append(f"{luck_cycle.get('stem','')}{luck_cycle.get('branch','')}运形成{''.join(trine.get('branches',[]))}三合{ELEMENT_CN[element]}局")
        source_element=next((e for e,t in GENERATES.items() if t==element),None)
        if source_element and element_rows.get(source_element):
            labels.append(f"{ELEMENT_CN[source_element]}生{ELEMENT_CN[element]}")
        if GENERATES.get(element)==day_element:
            labels.append(f"{ELEMENT_CN[element]}生日主{ELEMENT_CN[day_element]}")
            trine_chains.append({"trine":trine,"mode":"generate_day","source_element":source_element,"rescued":True})
            labels.append("受克得救")
        elif CONTROLS.get(element)==day_element:
            labels.append(f"{ELEMENT_CN[element]}局克日主{ELEMENT_CN[day_element]}")
            rescued=strength.get("category")!="weak"
            trine_chains.append({"trine":trine,"mode":"control_day","source_element":source_element,"rescued":rescued})
            labels.append("受克得救" if rescued else "受克无救")
        elif CONTROLS.get(day_element)==element:
            labels.append(f"日主{ELEMENT_CN[day_element]}制{ELEMENT_CN[element]}局")
            trine_chains.append({"trine":trine,"mode":"day_controls_trine","source_element":source_element,"rescued":None})

    wealth_positions=[]
    resource_rows=[]; wealth_rows=[]
    for pos in ("year","month","day","hour"):
        p=chart["pillars"][pos]
        local=[]
        if pos!="day":
            local.append({"token":p["stem"],"kind":"stem","position":pos,"group":_relation_to_day(STEM_ELEMENT[p["stem"]],day_element),"element":STEM_ELEMENT[p["stem"]]})
        local.append({"token":p["branch"],"kind":"branch","position":pos,"group":_relation_to_day(BRANCH_ELEMENT[p["branch"]],day_element),"element":BRANCH_ELEMENT[p["branch"]]})
        if any(x["group"]=="wealth" for x in local): wealth_positions.append(pos)
        wealth_rows.extend(x for x in local if x["group"]=="wealth")
        resource_rows.extend(x for x in local if x["group"]=="resource")
    wealth_concentrated=len(set(wealth_positions))>=3
    wealth_resource_controls=[]
    for wealth in wealth_rows:
        for resource in resource_rows:
            if CONTROLS.get(wealth["element"])==resource["element"]:
                wealth_resource_controls.append({"wealth":wealth,"resource":resource})
    if wealth_concentrated:
        labels.extend(["财星集中","财多"])
    for pair in wealth_resource_controls:
        labels.append(f"{pair['wealth']['token']}财星克{pair['resource']['token']}印星")
    return {"evidence_compiled":True,"trine_chains":trine_chains,"trine_chain_present":bool(trine_chains),
            "wealth_positions":wealth_positions,"wealth_concentrated":wealth_concentrated,"wealth_many":wealth_concentrated,
            "wealth_resource_controls":wealth_resource_controls,"wealth_controls_resource":bool(wealth_resource_controls),
            "official_rows":official_rows,"kill_rows":kill_rows,"official_kill_mixed":official_kill_mixed,
            "kill_combined_pairs":kill_combined_pairs,"remove_kill_keep_official":remove_kill_keep_official,
            "active_metal_node_count":metal_pressure_count,"metal_pressure_on_wood":metal_pressure_on_wood,
            "output_wealth_official_chains":output_wealth_official_chains,
            "visible_hurt_present":bool(hurt_rows),
            "temporal_trine_from_luck":temporal_trine_from_luck,
            "wealth_drains_hurt_protects_official":bool(output_wealth_official_chains),
            "hidden_wealth_rows":hidden_wealth_rows,"hidden_wealth_present":bool(hidden_wealth_rows),
            "visible_wealth_rows_exact":visible_wealth_rows_exact,
            "peer_controls_wealth":peer_controls_wealth,"strong_weak_wealth":strong_weak_wealth,
            "visible_pianyin_count":len(visible_resources),"repeated_pianyin_token":repeated_resource_token,
            "pianyin_concentrated":resource_concentrated,
            "resource_controls_hurt_pairs":resource_controls_hurt_pairs,
            "hurt_resource_control_structure":hurt_resource_control_structure,
            "visible_group_counts":dict(visible_group_counts),
            "wealth_official_resource_complete":wealth_official_resource_complete,
            "metal_water_hurt":metal_water_hurt,"output_water_count":output_water_count,
            "huagai_branches":huagai_branches,"resource_meets_huagai":resource_meets_huagai,
            "repeated_clash_movement_semantic":repeated_clash_movement_semantic,
            "structural_labels":list(dict.fromkeys(labels)),"deterministic_event_output":False}


def compile_kinship(chart: Mapping[str, Any]) -> dict[str, Any]:
    return {k:True for k in ["parent_palace_competing","parent_methods_combine","father_star","mother_star","alternate_mother_star",
        "ancestry_not_destiny","sibling_palace_month","sibling_stars","sibling_count_parameterized","male_spouse_star",
        "marriage_palace_month","spouse_palace_day","day_branch_relation","child_palace_hour","children_hour_strength",
        "child_star_official_kill","child_star_output","child_star_conflict","parents_year_month_context",
        "siblings_actual_markers_not_month_stems","children_method_not_sex_prediction","kinship_neutralization"]} | {
        "sibling_gender_mapping": chart.get("traditional_context",{}).get("sex_parameter") in {"male","female"},
        "palace_activation_year": bool(chart.get("annual_contexts"))}


def compile_themes(chart: Mapping[str, Any], pattern: Mapping[str,Any], strength: Mapping[str,Any], ug: Mapping[str,Any], compound: Mapping[str,Any] | None=None) -> dict[str, Any]:
    counts=_ten_god_counts(chart); active={r["pattern"] for r in pattern["active_candidates"]}
    facts={k:False for k in ["wealth_presence","wealth_storage","wealth_transparency","wealth_strong_day","wealth_weak_day","wealth_useful","wealth_output_generation","wealth_temporal_official","career_kill_strong","career_official_wealth","career_official_luck","career_no_official","career_official_damaged","career_mixed_official_kill","study_three_stars","study_three_stars_complete","study_strong_official","study_hurt_control","study_kill_resource","study_resource_lu","study_output_overload_weak","reputation_xuetang_without_official","reputation_hurt_kill","reputation_kill_resource","personality_no_official_freedom","theme_requires_structure"]}
    facts.update({"health_claims_blocked":True,"health_element_mapping_historical":True,"harm_chapter_incomplete":True,
                  "personality_elements_neutral":True,"no_criminality_inference":True,"no_death_timing":True,
                  "no_deterministic_marriage":True,"theme_requires_structure":True})
    facts["wealth_presence"]=counts["wealth"]>0; facts["wealth_strong_day"]=counts["wealth"]>0 and strength["category"]=="strong"
    facts["wealth_weak_day"]=counts["wealth"]>=4 and strength["category"]=="weak"; facts["wealth_useful"]="wealth" in ug["candidate_useful_gods"]
    facts["wealth_output_generation"]=counts["output"]>0 and counts["wealth"]>0
    facts["career_kill_strong"]=counts["official_kill"]>0 and strength["category"]=="strong"
    compound=compound or {}
    facts["career_no_official"]=counts["official_kill"]==0; facts["study_three_stars"]=all(counts[x]>0 for x in ["wealth","official_kill","resource"])
    facts["study_three_stars_complete"]=facts["study_three_stars"]
    facts["study_strong_official"]=facts["career_kill_strong"]
    facts["study_hurt_control"]=bool(compound.get("hurt_resource_control_structure"))
    facts["career_official_wealth"]=bool(compound.get("wealth_official_resource_complete"))
    facts["study_output_overload_weak"]=bool(strength.get("category")=="weak" and counts["output"]>=3 and not facts["study_hurt_control"])
    facts["personality_no_official_freedom"]=counts["official_kill"]==0
    return facts


def compile_w04_evidence(chart: Mapping[str, Any], *, luck_cycle=None, annual=None, annotations: Mapping[str,Any] | None=None, parameters=None) -> dict[str, Any]:
    ann=annotations or {}; pattern=compile_pattern(chart,luck_cycle=luck_cycle,annual=annual); strength=compile_strength(chart,parameters)
    useful=compile_useful_god(chart,pattern,strength); shensha=compile_shensha(chart,ann.get("shensha")); temporal=compile_temporal(chart,luck_cycle=luck_cycle,annual=annual,annotations=ann.get("temporal"))
    relations=compile_relations(chart,luck_cycle=luck_cycle,annual=annual)
    compound=compile_compound_relations(chart,strength,relations,luck_cycle=luck_cycle,annual=annual)
    procedure={k:True for k in ["whole_chart_available","year_pillar_available","year_strength_inputs_compiled","month_command_available","phase_order_ready","month_hidden_stems_compiled","luck_cycles_available","day_master_available","strength_compiled","strong_dimensions_compiled","weak_dimensions_compiled","hour_support_compiled","structural_imbalance_detected","remedy_candidate_detected","useful_god_inputs_compiled","missing_element_candidate","temporal_remedy_candidate","climate_fallback_candidate","shensha_module_enabled","shensha_catalog_loaded"]}
    return {"procedure":procedure,"pattern":pattern,"strength":strength,"useful_god":useful,"relations":relations,"compound":compound,"shensha":shensha,"temporal":temporal,"kinship":compile_kinship(chart),"themes":compile_themes(chart,pattern,strength,useful,compound)}



def _state_id(chart: Mapping[str, Any], stage: str, *, luck_cycle=None, annual=None) -> str:
    if stage == "natal":
        suffix = "natal"
    elif stage == "luck":
        suffix = f"luck.{luck_cycle['luck_cycle_id']}"
    else:
        suffix = f"annual.{annual['annual_id']}"
    return f"state.{chart['chart_id']}.shao_w04.{suffix}"


def _fact_for_state(chart_id: str, state_id: str, stage: str) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "fact_id": f"fact.{state_id}.recompute_complete",
        "subject": {"ref_id": chart_id, "entity_type": "chart", "layer": stage},
        "predicate": "shao_weihua.temporal.recompute_complete",
        "value": True,
        "truth": "true",
        "scope": {"stage": stage, "state_id": state_id},
        "source_type": "computed",
        "algorithm_id": "shao_weihua.w04.compiler@1.0.0",
    }


def build_state_ir_w04(
    chart: Mapping[str, Any],
    *,
    stage: str,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    parent_state_id: str | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Build one immutable W04 state with layer-specific evidence recomputation."""
    if stage not in {"natal", "luck", "annual"}:
        raise ValueError(f"unsupported stage: {stage}")
    state_id = _state_id(chart, stage, luck_cycle=luck_cycle, annual=annual)
    evidence = compile_w04_evidence(
        chart, luck_cycle=luck_cycle, annual=annual, annotations=annotations
    )
    stems, branches = _layer_context(chart, luck_cycle=luck_cycle, annual=annual)
    relations = [] if stage == "natal" else _pair_relations(stems, branches, stage, state_id)
    evidence["temporal"]["relations_compiled"] = True
    evidence["temporal"]["relation_count"] = len(relations)
    evidence["temporal"]["stage"] = stage
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
        "school_profile_id": "shao_weihua.w04@1.0.0",
        "active_context": active_context,
        "facts": [_fact_for_state(chart["chart_id"], state_id, stage)],
        "relations": relations,
        "findings": [],
        "school_state": {"shao_weihua": {"w04": evidence}},
        "trace_id": f"trace.{state_id}",
    }
    if parent_state_id:
        state["parent_state_id"] = parent_state_id
    return state


def build_state_chain_w04(
    chart: Mapping[str, Any],
    *,
    annotations_by_state: Mapping[str, Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Build NatalState -> LuckState -> AnnualState without mutating parents."""
    annotations_by_state = annotations_by_state or {}
    natal = build_state_ir_w04(chart, stage="natal", annotations=annotations_by_state.get("natal"))
    states = [natal]
    luck_states: dict[str, str] = {}
    for luck in chart.get("luck_cycles", []):
        state = build_state_ir_w04(
            chart, stage="luck", luck_cycle=luck, parent_state_id=natal["state_id"],
            annotations=annotations_by_state.get(luck["luck_cycle_id"]),
        )
        states.append(state)
        luck_states[luck["luck_cycle_id"]] = state["state_id"]
    for annual in chart.get("annual_contexts", []):
        luck = next((row for row in chart.get("luck_cycles", []) if row["start_year"] <= annual["year"] <= row["end_year"]), None)
        parent = luck_states.get(luck["luck_cycle_id"]) if luck else natal["state_id"]
        state = build_state_ir_w04(
            chart, stage="annual", luck_cycle=luck, annual=annual, parent_state_id=parent,
            annotations=annotations_by_state.get(annual["annual_id"]),
        )
        if not luck:
            state["school_state"]["shao_weihua"]["w04"]["temporal"]["annual_parent_fallback"] = "natal_no_matching_luck"
        states.append(state)
    return states

def make_rule_context(chart: Mapping[str, Any], **kwargs: Any) -> dict[str, Any]:
    ev=compile_w04_evidence(chart,**kwargs)
    return {"facts":{"common":{"day_master":{"stem":chart["day_master"]},"month":{"branch":chart["pillars"]["month"]["branch"]}},"shao_weihua":{"w04":ev}},"relations":[],"findings":[],"chart":deepcopy(chart)}


def _resolver_pattern(args: dict[str,Any], context: dict[str,Any]) -> Truth:
    p=get_path(context,"facts.shao_weihua.w04.pattern",None)
    if p is None: return Truth.UNKNOWN
    return Truth.TRUE if (p.get("day_stem"),p.get("month_branch"))==(args.get("day_stem"),args.get("month_branch")) else Truth.FALSE


def _resolver_ug(args: dict[str,Any], context: dict[str,Any]) -> Truth:
    ids=get_path(context,"facts.shao_weihua.w04.useful_god.matched_case_ids",None)
    if ids is None: return Truth.UNKNOWN
    return Truth.TRUE if args.get("case_id") in ids else Truth.FALSE


def _resolver_shensha(args: dict[str,Any], context: dict[str,Any]) -> Truth:
    d=get_path(context,"facts.shao_weihua.w04.shensha.detections",None)
    if d is None or args.get("shensha_id") not in d: return Truth.UNKNOWN
    v=d[args["shensha_id"]]
    return Truth.UNKNOWN if v is None else (Truth.TRUE if v else Truth.FALSE)


def _resolver_temporal(args: dict[str,Any], context: dict[str,Any]) -> Truth:
    return Truth.TRUE if get_path(context,"facts.shao_weihua.w04.temporal.state_chain",False) else Truth.UNKNOWN

W04_RESOLVERS={"shao_weihua.w04.pattern_cell_matches":_resolver_pattern,
               "shao_weihua.w04.useful_god_case_matches":_resolver_ug,
               "shao_weihua.w04.shensha_present":_resolver_shensha,
               "shao_weihua.w04.temporal_state_recompiled":_resolver_temporal}
