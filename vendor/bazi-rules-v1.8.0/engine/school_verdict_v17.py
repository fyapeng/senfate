"""School-internal final verdict resolution for v1.7.

This layer does not compare schools. It selects a principal route inside each
profile after the school-specific compiler has finished. The public headline is
therefore decisive while rejected candidates and provenance remain auditable.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Mapping

ROOT = Path(__file__).resolve().parents[1]
ELEMENT_CN = {"wood":"木", "fire":"火", "earth":"土", "metal":"金", "water":"水"}
GENERATES = {"wood":"fire", "fire":"earth", "earth":"metal", "metal":"water", "water":"wood"}
CONTROLS = {"wood":"earth", "earth":"water", "water":"fire", "fire":"metal", "metal":"wood"}
STEM_ELEMENT = {"甲":"wood","乙":"wood","丙":"fire","丁":"fire","戊":"earth","己":"earth","庚":"metal","辛":"metal","壬":"water","癸":"water"}


def _safe(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "_.-" else "_" for ch in value)


@lru_cache(maxsize=1)
def _rule_source_index() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for path in ROOT.glob("rules/**/*.rule.json"):
        try:
            row = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        rid = row.get("rule_id")
        if rid:
            out[rid] = [x.get("chunk_id") for x in row.get("source_refs", []) if x.get("chunk_id")]
    return out


def _provenance(findings: Iterable[Mapping[str, Any]], limit: int = 28) -> tuple[list[str], list[str]]:
    rule_ids: list[str] = []
    seen: set[str] = set()
    for finding in findings:
        if finding.get("truth") != "true":
            continue
        for rid in finding.get("source_rule_ids", []):
            if rid not in seen:
                seen.add(rid); rule_ids.append(rid)
    chunks: list[str] = []
    cseen: set[str] = set()
    idx = _rule_source_index()
    for rid in rule_ids:
        for chunk in idx.get(rid, []):
            if chunk not in cseen:
                cseen.add(chunk); chunks.append(chunk)
    return rule_ids[:limit], chunks[:limit]


def _all_ten_gods(chart: Mapping[str, Any]) -> list[str]:
    gods: list[str] = []
    for pos in ("year", "month", "day", "hour"):
        p = chart["pillars"][pos]
        if p.get("stem_ten_god"): gods.append(p["stem_ten_god"])
        gods.extend(x.get("ten_god") for x in p.get("hidden_stems", []) if x.get("ten_god"))
    return gods


def _visible_ten_gods(chart: Mapping[str, Any]) -> list[str]:
    return [chart["pillars"][p].get("stem_ten_god") for p in ("year","month","hour") if chart["pillars"][p].get("stem_ten_god")]


def _role_elements(day_master: str) -> dict[str, str]:
    dm = STEM_ELEMENT[day_master]
    output = GENERATES[dm]
    wealth = CONTROLS[dm]
    official = next(e for e, target in CONTROLS.items() if target == dm)
    resource = next(e for e, target in GENERATES.items() if target == dm)
    return {"比劫":dm, "食伤":output, "财":wealth, "官杀":official, "印":resource}


def _base(profile_id: str, school_id: str, chart_id: str, stage: str, findings: list[Mapping[str, Any]]) -> dict[str, Any]:
    rules, chunks = _provenance(findings)
    return {
        "schema_version":"1.0.0",
        "verdict_id":f"verdict.{_safe(chart_id)}.{school_id}.{stage}",
        "school_id":school_id,
        "profile_id":profile_id,
        "chart_id":chart_id,
        "stage":stage,
        "resolution":"resolved",
        "headline":"",
        "primary_structure":{"label":"","conclusion":""},
        "strength_or_axis":{"label":"","conclusion":""},
        "primary_use":{"label":"主要取用","roles":[],"tokens":[],"conclusion":""},
        "decisive_reasons":[],
        "secondary_structures":[],
        "rejected_routes":[],
        "caveats":[],
        "source_rule_ids":rules,
        "source_chunk_ids":chunks,
    }


def _classical(profile_id: str, chart: Mapping[str, Any], context: Mapping[str, Any], findings: list[Mapping[str, Any]], stage: str) -> dict[str, Any]:
    out = _base(profile_id, "classical_ziping", chart["chart_id"], stage, findings)
    x = context["facts"]["classical_ziping"]
    w02, w03 = x["w02"], x["w03"]
    life, strength, transform = w02["lifecycle"], w02["strength"], w02["transform"]
    follow = w02.get("follow", {})
    pattern = life.get("confirmed_pattern") or w02.get("pattern", {}).get("candidate_class") or "普通结构"
    follow_kill_confirmed=bool(follow.get("candidate_exists") and follow.get("candidate_type")=="七杀" and follow.get("kill_assembled"))
    hurt_kill_resource=bool(life.get("hurt",{}).get("strong_hurt_weak_day_kill_resource"))
    if follow_kill_confirmed:
        pattern="从煞"
    side = strength.get("resolved_side")
    category = strength.get("resolved_category")
    if side not in {"strong","weak"}:
        if strength.get("month_supportive") and strength.get("root_level") in {"heavy","many"}: side="strong"
        elif strength.get("restraint_count",0) > strength.get("support_count",0): side="weak"
    if follow_kill_confirmed:
        side="weak"; category="最弱"
    strength_cn = "身强" if side == "strong" else "身弱" if side == "weak" else str(category or "边界未闭合")
    special = life.get("special", {})
    secondary: list[str] = []
    bool_labels = {
        "hurt_resource_structure":"伤官佩印","official_resource_generation":"官印相生",
        "food_resource_both_used":"财格兼用食印","wealth_resource_both_used":"财印并用",
        "wealth_vigorous_generates_official":"财旺生官","food_uses_kill":"食神用煞",
        "wealth_removes_resource_preserves_output":"财去印而存食","resource_transforms_kill":"印星化煞",
        "robbery_preserves_kill_resource":"劫财存煞印","body_wealth_both_vigorous":"身财两美",
        "official_combine_kill_preserve_official":"合煞留官","combine_kill_preserve_wealth":"合煞存财",
    }
    for key, label in bool_labels.items():
        if special.get(key): secondary.append(label)
    for section, key, label in [
        ("food","generates_wealth","食神生财"),("kill","food_control","食神制煞"),
        ("wealth","food_generates_wealth","财格食神生财"),("wealth","resource_well_positioned","财格佩印"),
        ("resource","output_releases_strong_resource","身印两旺用食伤泄秀"),
        ("official","kill_combined_away","合煞留官")]:
        if life.get(section, {}).get(key): secondary.append(label)
    secondary = list(dict.fromkeys(secondary))
    roles = _role_elements(chart["day_master"])
    visible = _visible_ten_gods(chart)
    use_roles: list[str] = []
    if follow_kill_confirmed:
        use_roles=["顺从七杀气势"]
        use_conclusion="日主仅有远位孤根且被三重七杀支势压倒，从煞路线成立；不再以远根作为普通扶身依据。"
    elif hurt_kill_resource:
        use_roles=["煞","印"]
        use_conclusion="伤多身弱，采用煞生印、印帮身并制伤的有向救应链，主取煞印而非一般扶抑并列。"
    elif transform.get("true_transform"):
        elem = ELEMENT_CN.get(transform.get("transform_element"), str(transform.get("transform_element")))
        use_conclusion = f"真化成立，按化神{elem}观察，不再沿普通扶抑路线。"
        use_roles=[f"化神{elem}"]
    elif side == "strong":
        if any(g in {"正官","七杀","七煞"} for g in visible): use_roles.append("官杀")
        if any(g in {"食神","伤官"} for g in _all_ten_gods(chart)): use_roles.append("食伤")
        if any(g in {"正财","偏财"} for g in _all_ten_gods(chart)): use_roles.append("财")
        use_roles = use_roles or ["官杀","食伤","财"]
        ordered = "、".join(f"{r}（{ELEMENT_CN[roles[r]]}）" for r in use_roles)
        use_conclusion = f"日主强，以克、泄、耗降低原有偏势，优先观察{ordered}；印比再增通常不列首用。"
    elif side == "weak":
        use_roles=["印","比劫"]
        use_conclusion=f"日主弱，以印（{ELEMENT_CN[roles['印']]}）和比劫（{ELEMENT_CN[roles['比劫']]}）扶助承载，再谈财官食伤。"
    else:
        use_conclusion="日主强弱处于边界，不据此强行指定扶抑路线；终局先由格局、调候和病药裁决。"
    climate = w03.get("climate", {})
    climate_tokens = climate.get("ordered_candidates") or []
    climate_visibility=climate.get("candidate_visibility") or {}
    if climate_tokens:
        visible_tokens=[t for t in climate_tokens[:4] if climate_visibility.get(t)=="visible"]
        hidden_tokens=[t for t in climate_tokens[:4] if climate_visibility.get(t)=="hidden"]
        if side not in {"strong", "weak"} and not use_roles:
            use_roles=["格局调候"]
            use_conclusion=f"日主强弱处于边界，不据此强行指定扶抑；终局确定为{pattern}格，并以调候次序形成明确取用。"
        use_conclusion += " 调候次序为" + "、".join(climate_tokens[:4]) + "。"
        if visible_tokens: use_conclusion += " 已透："+"、".join(visible_tokens)+"。"
        if hidden_tokens: use_conclusion += " 未透而仅藏："+"、".join(hidden_tokens)+"。"
    elif side not in {"strong", "weak"}:
        out["resolution"]="two_route"
    if follow_kill_confirmed:
        structure_conclusion="三重七杀支势压倒远位孤根，特殊从煞路线覆盖普通七杀格与常规扶抑路线。"
    elif hurt_kill_resource:
        structure_conclusion="伤官为月令主结构，终局由煞生印、印制伤的复合救应取清。"
        pattern="伤官用煞印"
    else:
        structure_conclusion=f"以月令{pattern}为主结构，其他关系服从该格局的成败、救应与强弱裁决。"
    out["primary_structure"]={"label":f"{pattern}格", "conclusion":structure_conclusion}
    out["strength_or_axis"]={"label":"日主强弱", "conclusion":strength_cn}
    out["primary_use"]={"label":"主要取用","roles":use_roles,"tokens":climate_tokens[:4],"conclusion":use_conclusion}
    out["secondary_structures"]=secondary
    out["decisive_reasons"]=[
        f"月令入口确定为{pattern}",
        f"月令支持={bool(strength.get('month_supportive'))}，根气层级={strength.get('root_level')}",
        f"支持证据{strength.get('support_count',0)}项、制泄耗证据{strength.get('restraint_count',0)}项，终局判{strength_cn}",
    ]
    if follow.get("literal_root_present") and follow.get("remote_single_root_overwhelmed"):
        out["rejected_routes"].append({"route":"远位孤根据以判普通身强","reason":"孤根只在年位，且三重七杀支势直接压制，按本例规则不构成有效倚靠。"})
    hidden_climate=[t for t in climate_tokens[:4] if climate_visibility.get(t)=="hidden"]
    if hidden_climate:
        out["rejected_routes"].append({"route":"调候候选已到位","reason":"候选"+"、".join(hidden_climate)+"仅藏未透，不能视为已充分发挥。"})
    if transform.get("candidate_exists") and not transform.get("true_transform"):
        reasons="、".join(transform.get("damage_reasons") or ["成化条件不全"])
        out["rejected_routes"].append({"route":"化气格","reason":reasons})
    if life.get("compiled",{}).get("month_conflict"):
        out["caveats"].append("月令内部含多种气，终局以已确认格局与全局救应为准。")
    out["headline"] = f"{pattern}格，{strength_cn}；{use_conclusion}"
    return out


def _shao(profile_id: str, chart: Mapping[str, Any], context: Mapping[str, Any], findings: list[Mapping[str, Any]], stage: str) -> dict[str, Any]:
    out=_base(profile_id,"shao_weihua",chart["chart_id"],stage,findings)
    x=context["facts"]["shao_weihua"]["w04"]
    pattern, strength, useful = x["pattern"], x["strength"], x["useful_god"]
    active=pattern.get("active_candidates") or []
    fallback=pattern.get("fallback_candidates") or []
    if active:
        primary=active[0].get("pattern","月令格")
        pcon=f"月令条目中{primary}条件直接成立。"
    elif pattern.get("special_candidates"):
        primary=pattern["special_candidates"][0].get("pattern","特殊格")
        pcon=f"先按{primary}检查，再由旺衰与制化确认。"
    elif fallback:
        labels=list(dict.fromkeys(x.get("pattern") for x in fallback if x.get("pattern")))
        primary="杂气月"
        pcon="候选为"+"、".join(labels)+"，因格神未按条目直接透出，终局转由全局旺衰和取用裁决。"
    else:
        primary="普通月令结构"; pcon="按月令、旺衰和全局制化裁决。"
    compound=x.get("compound",{})
    cat=strength.get("category")
    if cat in {"strong","very_strong"}: side="strong"
    elif cat in {"weak","very_weak"}: side="weak"
    elif strength.get("month_supportive") and strength.get("root_level") in {"many","heavy"}: side="strong"
    elif strength.get("restraint_count",0) > strength.get("support_count",0)+1: side="weak"
    else: side="balanced"
    side_cn={"strong":"身强","weak":"身弱","balanced":"中和偏界"}[side]
    if compound.get("metal_water_hurt") and compound.get("resource_meets_huagai"):
        primary="金水伤官"
        pcon="金日主见水伤官成势，印又落华盖，以金水伤官、印逢华盖作为首要复合结构。"
    elif compound.get("hurt_resource_control_structure"):
        primary="伤官佩印"
        pair_labels=[r.get("label") for r in compound.get("resource_controls_hurt_pairs",[]) if r.get("label")]
        pcon="伤官与印均非并列候选，而是由"+("、".join(pair_labels) if pair_labels else "印制伤官")+"形成有向制化。"
    elif compound.get("metal_water_hurt"):
        primary="金水伤官"
        pcon="金日主见水伤官成势，以金水伤官作为首要复合结构。"
    elif compound.get("wealth_official_resource_complete"):
        primary="财官印综合结构"
        pcon="财、官杀、印三类结构齐备，终局按三者的生护与承载关系综合裁决。"
    specific=useful.get("specific_useful_tokens") or []
    roles=[]
    if compound.get("hurt_resource_control_structure"):
        roles=["印制伤"]
        specific=list(dict.fromkeys(r.get("resource",{}).get("stem") for r in compound.get("resource_controls_hurt_pairs",[]) if r.get("resource",{}).get("stem")))
        conclusion="以印星制约伤官为主用，制化链已闭合。"
    elif compound.get("wealth_official_resource_complete"):
        roles=["财","官杀","印"]
        conclusion="财官印俱全，以印承载、财生官及官印关系共同构成学习与权责路径。"
    elif specific:
        conclusion="以已落到原局的具体用神"+"、".join(specific)+"为主。"
    else:
        if side=="strong": roles=["官杀","食伤","财"]
        elif side=="weak": roles=["印","比劫"]
        else: roles=["调候","结构补偏"]
        conclusion=f"未裁决到唯一字，按{side_cn}以"+"、".join(roles)+"为主要取用方向。"
    out["primary_structure"]={"label":primary,"conclusion":pcon}
    out["strength_or_axis"]={"label":"旺衰判断","conclusion":side_cn}
    out["primary_use"]={"label":"主要取用","roles":roles,"tokens":specific,"conclusion":conclusion}
    out["secondary_structures"]=list(compound.get("structural_labels") or [])[:16]
    out["decisive_reasons"]=[
        f"月令={pattern.get('month_branch')}，月令支持={bool(strength.get('month_supportive'))}",
        f"根气位置={','.join(strength.get('root_positions') or []) or '无'}",
        f"支持证据{strength.get('support_count',0)}项、制泄耗证据{strength.get('restraint_count',0)}项，裁决为{side_cn}",
    ]
    for row in fallback[1:]:
        if row.get("pattern"):
            out["rejected_routes"].append({"route":row["pattern"],"reason":"未被选为首要月令路线，保留为次候选。"})
    if side=="balanced" and not (compound.get("hurt_resource_control_structure") or compound.get("metal_water_hurt") or compound.get("wealth_official_resource_complete")):
        out["resolution"]="two_route"; out["caveats"].append("本体系公开旺衰条款在此处形成边界，取用以结构补偏和调候共同处理。")
    if compound.get("repeated_clash_movement_semantic"):
        out["decisive_reasons"].append("重复辰戌冲进入走动与环境变化语义，但不单独推出具体事件。")
    out["headline"]=f"{primary}，{side_cn}；{conclusion}"
    return out


def _li(profile_id: str, chart: Mapping[str, Any], context: Mapping[str, Any], findings: list[Mapping[str, Any]], stage: str) -> dict[str, Any]:
    out=_base(profile_id,"li_hanchen",chart["chart_id"],stage,findings)
    x=context["facts"]["li_hanchen"]["w05"]
    c,u=x["classification"],x["useful_party"]
    label_map={"fuyi_weak":"扶抑格·身弱","fuyi_strong":"扶抑格·身旺","cong_strong":"从强格","cong_weak":"从弱格","transform":"化格"}
    raw=c.get("classification")
    label=label_map.get(raw,raw or "分类未完成")
    useful=list(u.get("useful_groups") or []); unf=list(u.get("unfavorable_groups") or [])
    tokens=list(u.get("primary_useful_tokens") or []); bad=list(u.get("primary_unfavorable_tokens") or [])
    role_cn={"resource":"印","peer":"比劫","wealth":"财","official":"官杀","output":"食伤"}
    useful_cn=[role_cn.get(r,r) for r in useful]; unf_cn=[role_cn.get(r,r) for r in unf]
    use_con=f"用神类别为{'、'.join(useful_cn) or '未定'}，主要落点为{'、'.join(tokens) or '未定'}；忌神类别为{'、'.join(unf_cn) or '未定'}，主要落点为{'、'.join(bad) or '未定'}。"
    override_reasons=list(u.get("token_override_reasons") or [])
    if override_reasons:
        use_con += " 字级反断覆盖组级默认："+"；".join(override_reasons)+"。"
    out["primary_structure"]={"label":label,"conclusion":f"原局分类固定为{label}，岁运层继承此分类，只重算用忌作用。"}
    out["strength_or_axis"]={"label":"分类强弱","conclusion":"身弱" if "weak" in str(raw) else "身旺" if "strong" in str(raw) else "化格路线" if raw=="transform" else label}
    out["primary_use"]={"label":"用忌分党","roles":useful_cn,"tokens":tokens,"conclusion":use_con}
    out["secondary_structures"]=list(c.get("compound_structures",{}).get("compound_labels") or [])
    for row in u.get("adverse_generation_actions") or []:
        if row.get("label"): out["secondary_structures"].append(row["label"]+"（忌神相生链）")
    out["secondary_structures"]=list(dict.fromkeys(out["secondary_structures"]))
    out["decisive_reasons"]=[
        f"月令为首要证据，原局分组={c.get('group_counts',{})}",
        f"帮扶有效={bool(c.get('support_effective'))}，制约有效={bool(c.get('opposition_effective'))}",
        f"主要用神靠近日主={bool(u.get('primary_useful_near_day_master'))}",
        "字级反断="+("；".join(override_reasons) if override_reasons else "无"),
    ]
    if c.get("transform_class") is False:
        out["rejected_routes"].append({"route":"化格","reason":"化格条件未闭合。"})
    if c.get("cong_weak_class") is False and raw and raw.startswith("fuyi"):
        reason="近身透干印仍构成有效帮扶。" if c.get("visible_near_resource_prevents_follow") else "原局仍有本体系认定的有效帮扶或根气。"
        out["rejected_routes"].append({"route":"从弱格","reason":reason})
    if raw=="cong_weak" and c.get("resource_network_neutralized_for_follow"):
        out["rejected_routes"].append({"route":"扶抑身弱","reason":"可见印被财合制，坐下印又受近位财制，帮扶网络不能阻止从弱。"})
    out["headline"]=f"{label}；{use_con}"
    return out


def _duan(profile_id: str, chart: Mapping[str, Any], context: Mapping[str, Any], findings: list[Mapping[str, Any]], stage: str) -> dict[str, Any]:
    out=_base(profile_id,"duan_li_xiang",chart["chart_id"],stage,findings)
    x=context["facts"]["duan_li_xiang"]["w06"]
    hb,sem,eff=x["host_body"],x["semantics"],x["efficiency"]
    main=sem.get("main_work_paths") or []
    main_labels=[]
    for row in main:
        if isinstance(row,str): main_labels.append(row)
        elif row.get("label"): main_labels.append(row["label"])
        elif row.get("method"): main_labels.append(str(row["method"]))
    if sem.get("propagation_theme"):
        main_labels=["乙卯入未库并由卯未拱连通"]+[x for x in main_labels if x!="乙卯入未库并由卯未拱连通"]
    elif sem.get("same_polarity_kill_as_wealth"):
        semantic_label=next((x.get("label") for x in sem.get("structural_conclusions",[]) if isinstance(x,dict) and x.get("basis")=="same_polarity_kill_as_wealth"),"同极七杀当财")
        main_labels=[semantic_label]+[x for x in main_labels if x!=semantic_label]
    main_labels=list(dict.fromkeys(main_labels))[:4]
    if not main_labels:
        for row in sem.get("structural_conclusions") or []:
            if isinstance(row,str): main_labels.append(row)
            elif row.get("label"): main_labels.append(row["label"])
    main_labels=list(dict.fromkeys(main_labels))[:4]
    no_work=bool(sem.get("no_recognised_work"))
    body_count=len(hb.get("body_refs") or [])
    use_count=len(hb.get("use_refs") or [])
    if no_work:
        pcon="原局存在关系候选，但没有满足本体系宾主体用方向和效率要求的认可做功。"
        main_labels=[]
    else:
        pcon="以"+"、".join(main_labels or ["已筛选主做功"])+"为主线，其余关系降为背景或辅助。"
        if sem.get("month_guest_kill_resource"):
            pcon += " 月令宾位的七杀财象按组织或公共资源语境解释。"
        if sem.get("guest_source_branch_for_kill_wealth"):
            pcon += " 宾位支为七杀财象之源，归入他方资源。"
        if sem.get("propagation_theme"):
            pcon += " 年时库拱链把文字、思想表达连接到传播主题。"
    tiers=[v.get("tier") for v in eff.get("vectors",[]) if v.get("tier")]
    top="high" if "high" in tiers else "medium" if "medium" in tiers else "low" if tiers else "未定"
    out["primary_structure"]={"label":"宾主体用—做功结构","conclusion":pcon}
    out["strength_or_axis"]={"label":"体用轴","conclusion":f"体{body_count}项、用{use_count}项；做功最高定性层级为{ {'high':'高','medium':'中','low':'低'}.get(top,top)}。"}
    out["primary_use"]={"label":"主做功","roles":["体","用"],"tokens":main_labels,"conclusion":pcon}
    conclusions=[]
    for row in sem.get("structural_conclusions") or []:
        label=row if isinstance(row,str) else row.get("label")
        if label and label not in main_labels: conclusions.append(label)
    out["secondary_structures"]=list(dict.fromkeys(conclusions))[:14]
    out["decisive_reasons"]=[
        f"认可做功数量={sem.get('recognised_work_count',0)}",
        f"候选做功数量={x.get('work',{}).get('work_count',0)}",
        "主线按宾主方向、方法层级、墓库与复合链闭合筛选",
    ]
    out["rejected_routes"].append({"route":"普通生克关系自动等同做功","reason":"本体系要求关系进入宾主体用与效率裁决后才算认可做功。"})
    if no_work: out["headline"]="原局无认可做功；关系只保留为类象背景。"
    else: out["headline"]="主做功为"+"、".join(main_labels or ["已筛选路径"])+"；"+out["strength_or_axis"]["conclusion"]
    return out


def resolve_school_verdict(profile_id: str, school_id: str, chart: Mapping[str, Any], context: Mapping[str, Any], findings: list[Mapping[str, Any]], stage: str) -> dict[str, Any]:
    funcs={"classical_ziping":_classical,"shao_weihua":_shao,"li_hanchen":_li,"duan_li_xiang":_duan}
    return funcs[school_id](profile_id,chart,context,findings,stage)
