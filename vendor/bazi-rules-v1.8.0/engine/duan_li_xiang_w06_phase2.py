"""W06 phase-2 compiler for the Duan Li-Xiang rule reconstruction.

This module extends the phase-1 transparent graph compiler with five explicit
layers derived from the reviewed text:

* six element/tendency parties and ten-god control directions;
* compound-work decomposition without collapsing methods into one score;
* method-resolution vectors with protection, distance and enclosure factors;
* catcher/thief structural candidates and time-layer activation;
* neutral theme candidates separated from concrete life-event assertions.

The implementation formalizes a traditional textual procedure. It is not a
scientifically validated prediction system and deliberately leaves unpublished
image, technique and exact-timing algorithms as ``unknown``.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy
from itertools import combinations
from typing import Any, Mapping

from . import duan_li_xiang_w06 as p1
from .classical_ziping_w02 import CONTROLS, GENERATES
from .classical_ziping_w03 import _layer_context, _pair_relations
from .reference_dsl import Truth, get_path

PROFILE_ID = "duan_li_xiang.w06@1.1.0"
ALGORITHM_ID = "duan_li_xiang.w06.phase2.compiler@1.1.0"

TEN_GOD_GROUPS = {
    "比肩": "peer", "劫财": "peer",
    "正财": "wealth", "偏财": "wealth",
    "正官": "official", "七杀": "official", "七煞": "official",
    "食神": "output", "伤官": "output",
    "正印": "resource", "偏印": "resource",
}
TEN_GOD_CONTROL_DIRECTIONS = {
    ("peer", "wealth"): "peer_to_wealth",
    ("wealth", "peer"): "wealth_to_peer",
    ("peer", "official"): "peer_to_official",
    ("official", "peer"): "official_to_peer",
    ("output", "official"): "output_to_official",
    ("official", "output"): "official_to_output",
    ("output", "resource"): "output_to_resource",
    ("resource", "output"): "resource_to_output",
    ("wealth", "resource"): "wealth_to_resource",
    ("resource", "wealth"): "resource_to_wealth",
}
SINGLE_PARTY_TARGETS = {
    "wood": {"earth", "wet_earth", "dry_earth", "metal"},
    "fire": {"metal", "water"},
    "metal": {"wood", "fire"},
    "water": {"fire", "dry_earth"},
    "dry_earth": {"water", "metal", "wet_earth"},
    "wet_earth": {"fire", "dry_earth"},
}
COMPOUND_PARTY_TARGETS = {
    "wood_fire": {"metal", "water"},
    "fire_dry_earth": {"water", "wood", "metal", "wet_earth"},
    "metal_water": {"fire", "earth", "dry_earth"},
    "metal_wet_earth": {"wood", "fire"},
    "water_wet_earth": {"dry_earth", "fire"},
    "water_wood": {"earth", "dry_earth", "wet_earth"},
}
PARTY_COMPONENTS = {
    "wood": {"wood"}, "fire": {"fire"}, "metal": {"metal"}, "water": {"water"},
    "dry_earth": {"dry_earth"}, "wet_earth": {"wet_earth"},
    "wood_fire": {"wood", "fire"},
    "fire_dry_earth": {"fire", "dry_earth"},
    "metal_water": {"metal", "water"},
    "metal_wet_earth": {"metal", "wet_earth"},
    "water_wet_earth": {"water", "wet_earth"},
    "water_wood": {"water", "wood"},
}
DRY_EARTH_BRANCHES = {"戌", "未"}
WET_EARTH_BRANCHES = {"辰", "丑"}
POSITION_INDEX = {
    "year": 0, "month": 1, "day": 2, "hour": 3, "luck": 4, "annual": 5,
}
CONTROL_METHODS = {"control", "combine", "tomb"}
TOP_TOMB_CLASH = {frozenset(("丑", "未")), frozenset(("辰", "戌")), frozenset(("丑", "戌"))}
HIGH_CLASH = {frozenset(("寅", "申")), frozenset(("巳", "亥"))}
LOWER_CLASH = {frozenset(("子", "午")), frozenset(("卯", "酉"))}
CONTROL_HARMS = {frozenset(("酉", "戌")), frozenset(("卯", "辰")), frozenset(("子", "未")), frozenset(("丑", "午"))}
GENERATING_HARMS = {frozenset(("申", "亥")), frozenset(("寅", "巳"))}
BRANCH_TRINES = {
    frozenset("申子辰"): ("water", "子", "申子辰三合水局"),
    frozenset("寅午戌"): ("fire", "午", "寅午戌三合火局"),
    frozenset("巳酉丑"): ("metal", "酉", "巳酉丑三合金局"),
    frozenset("亥卯未"): ("wood", "卯", "亥卯未三合木局"),
}
BRANCH_ARCHES = {
    frozenset("申子"): ("water", "申子相拱水局"), frozenset("子辰"): ("water", "子辰相拱水局"),
    frozenset("寅午"): ("fire", "寅午相拱火局"), frozenset("午戌"): ("fire", "午戌相拱火局"),
    frozenset("巳酉"): ("metal", "巳酉相拱金局"), frozenset("酉丑"): ("metal", "酉丑相拱金局"),
    frozenset("亥卯"): ("wood", "亥卯相拱木局"), frozenset("卯未"): ("wood", "卯未相拱木局"),
    frozenset("亥未"): ("wood", "亥未拱木局"), frozenset("寅戌"): ("fire", "寅戌拱火局"),
    frozenset("巳丑"): ("metal", "巳丑拱金局"), frozenset("申辰"): ("water", "申辰拱水局"),
}
DARK_COMBINES = {frozenset("寅丑"), frozenset("午亥"), frozenset("卯申")}
BRANCH_BREAKS = {frozenset(x) for x in (("子","酉"),("卯","午"),("辰","丑"),("戌","未"),("寅","亥"),("巳","申"))}
SIX_COMBINE_ORDER = {
    frozenset(("子","丑")):("子","丑"), frozenset(("寅","亥")):("寅","亥"),
    frozenset(("卯","戌")):("卯","戌"), frozenset(("辰","酉")):("辰","酉"),
    frozenset(("巳","申")):("巳","申"), frozenset(("午","未")):("午","未"),
}
STEM_COMBINE_ORDER = {
    frozenset(("甲","己")): ("甲","己"), frozenset(("乙","庚")): ("乙","庚"),
    frozenset(("丙","辛")): ("丙","辛"), frozenset(("丁","壬")): ("丁","壬"),
    frozenset(("戊","癸")): ("戊","癸"),
}
DARK_COMBINE_ORDER = {frozenset("寅丑"): ["寅", "丑"], frozenset("午亥"): ["午", "亥"], frozenset("卯申"): ["卯", "申"]}
TOMB_STORAGE_ELEMENT = {"辰": "water", "戌": "fire", "丑": "metal", "未": "wood"}
# Some school examples treat 辰 as both water and earth storage.  Keep the
# narrower canonical role above for ten-god naming, and use this explicit
# acceptance table only for entry/source semantics.
TOMB_ACCEPTS = {"辰": {"water", "earth"}, "戌": {"fire"}, "丑": {"metal"}, "未": {"wood"}}
TOMB_STORAGE_STEM = {"辰": "癸", "戌": "丁", "丑": "辛", "未": "乙"}
TOMB_CLASHES = {frozenset("辰戌"), frozenset("丑未")}
LU_MAP = {"甲":"寅","乙":"卯","丙":"巳","丁":"午","戊":"巳","己":"午","庚":"申","辛":"酉","壬":"亥","癸":"子"}

NEUTRAL_TEN_GOD_THEMES = {
    "peer": ["协作", "竞争", "行动", "同伴关系"],
    "wealth": ["资源", "资产", "交换", "价值流"],
    "official": ["规则", "权责", "组织约束", "管理"],
    "output": ["表达", "技能", "作品", "服务与产出"],
    "resource": ["支持", "学习", "知识", "凭证与保护"],
}
POSITION_THEMES = {
    "year": ["远端环境", "根源语境", "较早阶段"],
    "month": ["原生环境", "同辈与组织场域", "来源语境"],
    "day": ["主体与近身语境", "居所或私人情境"],
    "hour": ["对外连接", "产出接口", "后续阶段"],
    "luck": ["阶段性外部条件"],
    "annual": ["当期外部触发条件"],
}
METHOD_THEMES = {
    "control": ["约束", "管理", "排除", "重组"],
    "combine": ["连接", "协调", "绑定", "关联取得"],
    "generate": ["支持", "供给", "投入", "服务"],
    "drain": ["表达", "释放", "产出", "展示"],
    "tomb": ["聚合", "存储", "管理", "占据"],
}


def _merge(target: dict[str, Any], update: Mapping[str, Any] | None) -> dict[str, Any]:
    return p1._merge(target, update)


def _base_group(group: str) -> dict[str, Any]:
    return p1._base_group(group)


def _tendency(row: Mapping[str, Any], pillar_branch_by_ref: Mapping[str, str]) -> str:
    if row["element"] != "earth":
        return row["element"]
    if row["kind"] == "branch":
        if row["token"] in DRY_EARTH_BRANCHES:
            return "dry_earth"
        if row["token"] in WET_EARTH_BRANCHES:
            return "wet_earth"
    branch = pillar_branch_by_ref.get(row.get("pillar_ref", ""))
    if branch in DRY_EARTH_BRANCHES:
        return "dry_earth"
    if branch in WET_EARTH_BRANCHES:
        return "wet_earth"
    return "earth"


def enrich_tokens(host_body: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows = deepcopy(host_body["tokens"])
    pillar_branch_by_ref = {
        row["pillar_ref"]: row["token"] for row in rows if row["kind"] == "branch"
    }
    for row in rows:
        row["ten_god_group"] = TEN_GOD_GROUPS.get(row.get("ten_god"))
        row["tendency"] = _tendency(row, pillar_branch_by_ref)
        row["position_index"] = POSITION_INDEX.get(row["position"], 99)
    return rows


def _party_rows(rows: list[dict[str, Any]], party: str) -> list[dict[str, Any]]:
    components = PARTY_COMPONENTS[party]
    return [r for r in rows if r["tendency"] in components]


def _active_parties(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    parties: list[dict[str, Any]] = []
    for party in PARTY_COMPONENTS:
        matched = _party_rows(rows, party)
        component_set = {r["tendency"] for r in matched}
        components = PARTY_COMPONENTS[party]
        if len(components) == 1:
            active = len(matched) >= p1.DEFAULT_PARAMETERS["reference_party_min_nodes"]
        else:
            active = components.issubset(component_set) and len(matched) >= p1.DEFAULT_PARAMETERS["reference_party_min_nodes"]
        parties.append({
            "party": party,
            "components": sorted(components),
            "node_refs": sorted(r["ref_id"] for r in matched),
            "node_count": len(matched),
            "active": active,
            "threshold_policy": "explicit_reference_min_nodes",
        })
    return parties


def _protected_refs(chart: Mapping[str, Any], rows: list[dict[str, Any]], configuration: Mapping[str, Any]) -> list[dict[str, Any]]:
    protected: dict[str, set[str]] = defaultdict(set)
    protected["natal.day.stem"].add("day_master")
    protected["natal.day.branch"].add("day_root_or_day_pillar")
    day_lu = p1.LU_MAP.get(chart["day_master"])
    for row in rows:
        if row["kind"] == "branch" and row["token"] == day_lu:
            protected[row["ref_id"]].add("day_master_lu")
        if row.get("ten_god_group") in {"peer", "resource"} and row["position"] == "day":
            protected[row["ref_id"]].add("connected_body")
    for edge in configuration.get("lu_connections", []):
        for key in ("stem_ref", "branch_ref"):
            if edge.get(key):
                protected[edge[key]].add("lu_original_connection")
    return [
        {"ref_id": ref, "reasons": sorted(reasons)}
        for ref, reasons in sorted(protected.items())
    ]


def _ten_direction(source: Mapping[str, Any], target: Mapping[str, Any]) -> str | None:
    return TEN_GOD_CONTROL_DIRECTIONS.get((source.get("ten_god_group"), target.get("ten_god_group")))


def _target_matches_party(party: str, target: Mapping[str, Any]) -> bool:
    allowed = SINGLE_PARTY_TARGETS.get(party, COMPOUND_PARTY_TARGETS.get(party, set()))
    return target.get("tendency") in allowed or target.get("element") in allowed


def compile_control_matrix(
    chart: Mapping[str, Any], host_body: Mapping[str, Any], configuration: Mapping[str, Any],
    work: Mapping[str, Any], *, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("control_matrix")
    rows = enrich_tokens(host_body)
    row_by_ref = {r["ref_id"]: r for r in rows}
    parties = _active_parties(rows)
    party_by_name = {p["party"]: p for p in parties}
    protected = _protected_refs(chart, rows, configuration)
    protected_set = {x["ref_id"] for x in protected}

    configurations: list[dict[str, Any]] = []
    for path in work["work_graph"]:
        if path["method"] not in CONTROL_METHODS:
            continue
        source, target = row_by_ref.get(path["source_ref"]), row_by_ref.get(path["target_ref"])
        if not source or not target:
            continue
        ten_direction = _ten_direction(source, target)
        source_parties = [
            p["party"] for p in parties
            if source["ref_id"] in p["node_refs"] and _target_matches_party(p["party"], target)
        ]
        active_source_parties = [p for p in source_parties if party_by_name[p]["active"]]
        configurations.append({
            "work_id": path["work_id"],
            "source_ref": source["ref_id"], "target_ref": target["ref_id"],
            "source_token": source["token"], "target_token": target["token"],
            "source_tendency": source["tendency"], "target_tendency": target["tendency"],
            "source_ten_god_group": source.get("ten_god_group"),
            "target_ten_god_group": target.get("ten_god_group"),
            "ten_god_direction": ten_direction,
            "source_party_candidates": source_parties,
            "active_source_parties": active_source_parties,
            "target_protected": target["ref_id"] in protected_set,
            "resolution": "active_candidate" if active_source_parties or ten_direction else "candidate",
        })

    clean_candidates: list[dict[str, Any]] = []
    for cfg in configurations:
        target = row_by_ref[cfg["target_ref"]]
        residual = [
            r["ref_id"] for r in rows
            if r["ref_id"] != target["ref_id"]
            and ((target.get("ten_god_group") and r.get("ten_god_group") == target.get("ten_god_group"))
                 or r.get("tendency") == target.get("tendency"))
            and r["ref_id"] not in {cfg["source_ref"], cfg["target_ref"]}
        ]
        is_clean = bool(cfg["active_source_parties"]) and not residual and not cfg["target_protected"]
        clean_candidates.append({
            "work_id": cfg["work_id"],
            "source_ref": cfg["source_ref"], "target_ref": cfg["target_ref"],
            "active_party": cfg["active_source_parties"][0] if cfg["active_source_parties"] else None,
            "residual_target_refs": sorted(residual),
            "target_protected": cfg["target_protected"],
            "clean": is_clean,
            "resolution": "clean_control" if is_clean else "unclean_or_unresolved",
        })

    ten_counts = Counter(x["ten_god_direction"] for x in configurations if x["ten_god_direction"])
    evidence.update({
        "evidence_compiled": True,
        "tokens": rows,
        "party_candidates": parties,
        "active_parties": [p["party"] for p in parties if p["active"]],
        "control_configurations": configurations,
        "ten_god_direction_counts": dict(ten_counts),
        "protected_refs": protected,
        "clean_control_candidates": clean_candidates,
        "clean_control_count": sum(x["clean"] for x in clean_candidates),
        "six_single_tendencies_catalog": ["wood", "fire", "metal", "water", "dry_earth", "wet_earth"],
        "ten_god_control_direction_catalog": sorted(TEN_GOD_CONTROL_DIRECTIONS.values()),
        "hidden_total_score": False,
        "unknown_policy": "propagate",
    })
    # Dynamic executable flags.
    evidence.update({
        "party_required": any(p["active"] for p in parties),
        "target_required": bool(configurations),
        "six_single_tendencies": True,
        "two_tendencies_can_party": any(len(PARTY_COMPONENTS[p]) == 2 and party_by_name[p]["active"] for p in PARTY_COMPONENTS),
        "day_root_protected": "natal.day.branch" in protected_set,
        "connected_body_protected": any("connected_body" in x["reasons"] for x in protected),
        "clean_control_required_for_large_structure": bool(clean_candidates),
        "unclean_control_lowers": any(not x["clean"] for x in clean_candidates),
    })
    for direction in TEN_GOD_CONTROL_DIRECTIONS.values():
        slug = direction.replace("_to_", "_controls_")
        evidence[slug] = ten_counts[direction] > 0
    for party in PARTY_COMPONENTS:
        slug = f"{party}_targets"
        if slug in evidence or party in SINGLE_PARTY_TARGETS or party in COMPOUND_PARTY_TARGETS:
            evidence[slug] = any(
                cfg["active_source_parties"] and party in cfg["active_source_parties"]
                for cfg in configurations
            )
    return _merge(evidence, annotations)


def compile_compound(
    host_body: Mapping[str, Any], work: Mapping[str, Any], control_matrix: Mapping[str, Any],
    *, stage: str, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("compound")
    rows = enrich_tokens(host_body)
    row_by_ref = {r["ref_id"]: r for r in rows}
    paths = work["work_graph"]

    pair_multi = deepcopy(work.get("compound_paths", []))
    by_target: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for path in paths:
        by_target[path["target_ref"]].append(path)
    convergent = []
    for target, group in by_target.items():
        sources = sorted({x["source_ref"] for x in group})
        if len(sources) >= 2:
            convergent.append({
                "target_ref": target,
                "source_refs": sources,
                "component_work_ids": [x["work_id"] for x in group],
                "method_set": sorted({x["method"] for x in group}),
            })

    sequential = []
    for first, second in combinations(paths, 2):
        if first["target_ref"] == second["source_ref"]:
            sequential.append({
                "source_ref": first["source_ref"], "middle_ref": first["target_ref"],
                "target_ref": second["target_ref"],
                "component_work_ids": [first["work_id"], second["work_id"]],
                "methods": [first["method"], second["method"]],
            })
        elif second["target_ref"] == first["source_ref"]:
            sequential.append({
                "source_ref": second["source_ref"], "middle_ref": second["target_ref"],
                "target_ref": first["target_ref"],
                "component_work_ids": [second["work_id"], first["work_id"]],
                "methods": [second["method"], first["method"]],
            })

    target_and_source = []
    control_paths = [x for x in paths if x["method"] in CONTROL_METHODS]
    for first, second in combinations(control_paths, 2):
        first_target = row_by_ref.get(first["target_ref"])
        second_target = row_by_ref.get(second["target_ref"])
        if not first_target or not second_target:
            continue
        if GENERATES.get(first_target["element"]) == second_target["element"] or GENERATES.get(second_target["element"]) == first_target["element"]:
            target_and_source.append({
                "component_work_ids": [first["work_id"], second["work_id"]],
                "target_refs": [first["target_ref"], second["target_ref"]],
                "relation": "source_target_joint_control_candidate",
            })

    tomb_plus = []
    for target, group in by_target.items():
        row = row_by_ref.get(target)
        methods = {x["method"] for x in group}
        if row and (row["token"] in p1.TOMBS or "tomb" in methods) and len(methods.intersection(CONTROL_METHODS)) >= 1 and len(group) >= 2:
            tomb_plus.append({
                "target_ref": target,
                "component_work_ids": [x["work_id"] for x in group],
                "methods": sorted(methods),
            })

    enclosure = []
    for item in convergent:
        target = row_by_ref.get(item["target_ref"])
        sources = [row_by_ref[x] for x in item["source_refs"] if x in row_by_ref]
        if not target or len(sources) < 2:
            continue
        left = any(s["position_index"] < target["position_index"] for s in sources)
        right = any(s["position_index"] > target["position_index"] for s in sources)
        stem_support = any(s["kind"] == "stem" for s in sources)
        if (left and right) or len(sources) >= 3:
            enclosure.append({
                **item,
                "left_side_source": left,
                "right_side_source": right,
                "stem_support": stem_support,
                "resolution": "enclosure_candidate",
            })

    compound_nodes = {
        "pair_multi_method": pair_multi,
        "parallel_sources_one_target": convergent,
        "sequential_chain": sequential,
        "source_target_joint_control": target_and_source,
        "tomb_plus_control": tomb_plus,
        "enclosure": enclosure,
    }
    method_count = sum(len(x.get("component_work_ids", [])) for group in compound_nodes.values() for x in group)
    layer_count_candidates = len(sequential) + len(target_and_source) + len(tomb_plus)
    evidence.update({
        "evidence_compiled": True,
        "structures": compound_nodes,
        "structure_counts": {k: len(v) for k, v in compound_nodes.items()},
        "compound_structure_count": sum(len(v) for v in compound_nodes.values()),
        "method_component_count": method_count,
        "layer_count_candidates": layer_count_candidates,
        "method_count_is_not_layer_count": True,
        "time_mode_switch": stage in {"luck", "annual"} and bool(compound_nodes["pair_multi_method"]),
        "hidden_total_score": False,
    })
    evidence.update({
        "multiple_methods_preserved": bool(pair_multi),
        "analyze_each_method": bool(pair_multi or sequential or convergent),
        "luck_can_change_mode": stage in {"luck", "annual"},
        "method_count_not_layer_count": True,
        "tomb_control_layer_candidate": bool(tomb_plus),
        "enclosure_candidate": bool(enclosure),
        "sequential_chain_candidate": bool(sequential),
        "source_target_joint_control_candidate": bool(target_and_source),
    })
    return _merge(evidence, annotations)


def _method_rank(path: Mapping[str, Any]) -> tuple[str, list[str]]:
    pair = frozenset(path["tokens"])
    relation = path["relation_type"]
    factors: list[str] = []
    if pair == frozenset(("巳", "申")) and path["method"] == "combine":
        return "top_candidate", ["si_shen_combine"]
    if pair in TOP_TOMB_CLASH and relation in {"clash", "punishment", "tomb_candidate"}:
        return "top_candidate", ["tomb_clash_or_punishment"]
    if pair in HIGH_CLASH and relation == "clash":
        return "high_candidate", ["yin_shen_or_si_hai_clash"]
    if pair in LOWER_CLASH and relation == "clash":
        return "medium_candidate", ["zi_wu_or_mao_you_clash"]
    if pair in CONTROL_HARMS and relation == "harm":
        return "medium_candidate", ["listed_control_harm"]
    if pair in GENERATING_HARMS and relation == "harm":
        return "not_control", ["generating_harm"]
    if pair == frozenset(("午", "未")) and path["method"] == "combine":
        return "not_control", ["wu_wei_generate_not_control"]
    if path["method"] == "combine":
        factors.append("combine_candidate")
        return "medium_candidate", factors
    if path["method"] == "control":
        return "low_candidate", ["plain_control"]
    if path["method"] in {"generate", "drain"}:
        return "low_candidate", [path["method"]]
    if path["method"] == "tomb":
        return "medium_candidate", ["tomb_candidate"]
    return "unknown", []


def compile_method_resolution(
    host_body: Mapping[str, Any], work: Mapping[str, Any], control_matrix: Mapping[str, Any],
    compound: Mapping[str, Any], *, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("method_resolution")
    rows = enrich_tokens(host_body)
    row_by_ref = {r["ref_id"]: r for r in rows}
    active_parties = {p["party"]: set(p["node_refs"]) for p in control_matrix["party_candidates"] if p["active"]}
    clean_by_work = {x["work_id"]: x for x in control_matrix["clean_control_candidates"]}
    protected = {x["ref_id"] for x in control_matrix["protected_refs"]}
    enclosure_ids = {wid for x in compound["structures"]["enclosure"] for wid in x["component_work_ids"]}
    vectors = []
    for path in work["work_graph"]:
        source, target = row_by_ref.get(path["source_ref"]), row_by_ref.get(path["target_ref"])
        rank, factors = _method_rank(path)
        if not source or not target:
            continue
        distance = abs(source["position_index"] - target["position_index"])
        source_party = [name for name, refs in active_parties.items() if source["ref_id"] in refs]
        if source_party:
            factors.append("active_party")
        if distance >= 3:
            factors.append("distance_penalty")
        if target["ref_id"] in protected:
            factors.append("protected_target")
            if path["method"] in CONTROL_METHODS:
                rank = "blocked_protected"
        if path["work_id"] in enclosure_ids:
            factors.append("enclosure")
            if rank not in {"blocked_protected", "not_control"}:
                rank = "high_candidate"
        clean = clean_by_work.get(path["work_id"], {}).get("clean", False)
        if clean:
            factors.append("clean_control")
        vectors.append({
            "work_id": path["work_id"],
            "method": path["method"], "relation_type": path["relation_type"],
            "source_ref": path["source_ref"], "target_ref": path["target_ref"],
            "relative_tier": rank,
            "factors": sorted(set(factors)),
            "distance_class": "far" if distance >= 3 else "near_or_medium",
            "active_source_parties": source_party,
            "clean_control": clean,
            "numeric_score": None,
        })
    counts = Counter(x["relative_tier"] for x in vectors)
    evidence.update({
        "evidence_compiled": True,
        "vectors": vectors,
        "tier_counts": dict(counts),
        "qualitative_only": True,
        "hidden_total_score": False,
        "total_score": None,
        "ranking_is_conditional": True,
        "enclosure_count": sum("enclosure" in x["factors"] for x in vectors),
        "protected_block_count": counts["blocked_protected"],
        "distance_penalty_count": sum("distance_penalty" in x["factors"] for x in vectors),
    })
    evidence.update({
        "si_shen_top": any("si_shen_combine" in x["factors"] for x in vectors),
        "tomb_clash_punishment_top": any("tomb_clash_or_punishment" in x["factors"] for x in vectors),
        "yin_shen_si_hai_high": any("yin_shen_or_si_hai_clash" in x["factors"] for x in vectors),
        "zi_wu_mao_you_lower": any("zi_wu_or_mao_you_clash" in x["factors"] for x in vectors),
        "plain_control_low": any("plain_control" in x["factors"] for x in vectors),
        "enclosure_high": any("enclosure" in x["factors"] for x in vectors),
        "distance_can_reduce": any("distance_penalty" in x["factors"] for x in vectors),
        "four_control_harms": any("listed_control_harm" in x["factors"] for x in vectors),
        "two_generate_harms": any("generating_harm" in x["factors"] for x in vectors),
        "wu_wei_not_control": any("wu_wei_generate_not_control" in x["factors"] for x in vectors),
    })
    return _merge(evidence, annotations)


def _thief_signature(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "token": row["token"], "element": row["element"],
        "tendency": row["tendency"], "ten_god_group": row.get("ten_god_group"),
    }


def compile_catcher_thief(
    host_body: Mapping[str, Any], work: Mapping[str, Any], control_matrix: Mapping[str, Any],
    method_resolution: Mapping[str, Any], *, stage: str,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = _base_group("catcher_thief")
    rows = enrich_tokens(host_body)
    row_by_ref = {r["ref_id"]: r for r in rows}
    clean = [x for x in control_matrix["clean_control_candidates"] if x["clean"]]
    current_candidates = []
    for item in clean:
        source, target = row_by_ref.get(item["source_ref"]), row_by_ref.get(item["target_ref"])
        if not source or not target:
            continue
        current_candidates.append({
            "work_id": item["work_id"],
            "catcher_ref": source["ref_id"], "thief_ref": target["ref_id"],
            "catcher_party": item["active_party"],
            "thief_signature": _thief_signature(target),
            "resolution": "structural_candidate",
        })

    natal_candidates = current_candidates
    if natal_core and natal_core.get("catcher_thief"):
        natal_candidates = natal_core["catcher_thief"].get("natal_candidates", natal_core["catcher_thief"].get("current_candidates", []))

    activation_candidates = []
    if stage in {"luck", "annual"}:
        guest_rows = [r for r in rows if r["layer"] in ({"luck"} if stage == "luck" else {"luck", "annual"}) and r["layer"] != "natal"]
        for guest in guest_rows:
            for natal in natal_candidates:
                sig = natal["thief_signature"]
                match_type = None
                if guest["token"] == sig.get("token"):
                    match_type = "same_token"
                elif guest["tendency"] == sig.get("tendency") or guest["element"] == sig.get("element"):
                    match_type = "same_element"
                elif guest.get("ten_god_group") and guest.get("ten_god_group") == sig.get("ten_god_group"):
                    match_type = "same_ten_god_group"
                if not match_type:
                    continue
                active_edges = [
                    p["work_id"] for p in work["work_graph"]
                    if guest["ref_id"] in p["participants"] and p["method"] in CONTROL_METHODS
                ]
                activation_candidates.append({
                    "guest_ref": guest["ref_id"], "match_type": match_type,
                    "natal_thief_signature": sig,
                    "active_control_work_ids": active_edges,
                    "activated": bool(active_edges),
                    "event_mapping": "unknown",
                })

    evidence.update({
        "evidence_compiled": True,
        "stage": stage,
        "current_candidates": current_candidates,
        "natal_candidates": natal_candidates,
        "activation_candidates": activation_candidates,
        "activation_count": sum(x["activated"] for x in activation_candidates),
        "event_mapping": "unknown_incomplete",
        "requires_clean_control": True,
        "requires_active_edge": True,
        "multiple_candidates_preserved": True,
        "hidden_total_score": False,
    })
    evidence.update({
        "requires_control_configuration": bool(control_matrix["control_configurations"]),
        "catcher_strong_thief_isolated": bool(current_candidates),
        "net_control_candidate": bool(current_candidates),
        "thief_luck_activation_candidate": any(x["activated"] for x in activation_candidates),
        "activation_must_recompile": stage in {"luck", "annual"},
        "activation_event_unknown": True,
        "multiple_thief_candidates_preserved": len(natal_candidates) > 1,
    })
    return _merge(evidence, annotations)


def compile_semantics(
    host_body: Mapping[str, Any], work: Mapping[str, Any], compound: Mapping[str, Any],
    catcher_thief: Mapping[str, Any], *, chart: Mapping[str, Any] | None = None,
    configuration: Mapping[str, Any] | None = None,
    control_matrix: Mapping[str, Any] | None = None,
    method_resolution: Mapping[str, Any] | None = None, annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence=_base_group("semantics")
    rows=enrich_tokens(host_body); token_by_ref={r["ref_id"]:r for r in rows}
    candidates=[]; seen=set()
    for row in rows:
        if row["ref_id"] in seen: continue
        seen.add(row["ref_id"]); candidates.append({
            "candidate_id":f"theme.token.{row['ref_id']}","source_ref":row["ref_id"],"theme_type":"ten_god_and_position",
            "themes":sorted(set(NEUTRAL_TEN_GOD_THEMES.get(row.get("ten_god_group"),[])+POSITION_THEMES.get(row["position"],[]))),
            "certainty":"semantic_candidate","concrete_event":None})
    for path in work["work_graph"]:
        candidates.append({"candidate_id":f"theme.work.{path['work_id']}","source_ref":path["work_id"],"theme_type":"method",
            "themes":METHOD_THEMES.get(path["method"],["结构关联"]),"certainty":"semantic_candidate","concrete_event":None})

    element_cn={"wood":"木","fire":"火","earth":"土","metal":"金","water":"水"}
    canonical_tg=lambda x: "七杀" if x=="七煞" else x
    control_methods={"control","harm","clash","punish","surround"}

    # v1.4: school-specific branch-group, vault and hidden-combination semantics.
    active_branch_rows=[r for r in rows if r.get("kind")=="branch"]
    active_branches={r["token"] for r in active_branch_rows}
    branch_counts=Counter(r["token"] for r in active_branch_rows)
    row_by_branch={r["token"]:r for r in active_branch_rows}
    branch_rows_by_position={r["position"]:r for r in active_branch_rows if r.get("layer")=="natal"}
    stem_rows=[r for r in rows if r.get("kind")=="stem" and r.get("layer")=="natal"]
    stem_rows_by_position={r["position"]:r for r in stem_rows}
    complete_trines=[]; arch_groups=[]; dark_combine_groups=[]; vault_roles={}
    day_element=p1.STEM_ELEMENT[chart["day_master"]] if chart else None
    if chart:
        for group,(element,middle,label) in BRANCH_TRINES.items():
            if group.issubset(active_branches):
                complete_trines.append({"branches":sorted(group),"element":element,"middle":middle,"label":label,
                    "middle_is_day_lu":LU_MAP.get(chart["day_master"])==middle})
        for pair,(element,label) in BRANCH_ARCHES.items():
            if pair.issubset(active_branches) and not any(pair.issubset(set(x["branches"])) for x in complete_trines):
                arch_groups.append({"branches":sorted(pair),"element":element,"label":label})
        for pair in DARK_COMBINES:
            if pair.issubset(active_branches):
                a,b=DARK_COMBINE_ORDER[pair]; ar=row_by_branch.get(a); br=row_by_branch.get(b)
                dark_combine_groups.append({"branches":[a,b],"label":f"{a}{b}暗合",
                    "ten_god_groups":[ar.get("ten_god_group") if ar else None,br.get("ten_god_group") if br else None],
                    "rows":[ar,br]})
        for branch,element in TOMB_STORAGE_ELEMENT.items():
            if branch not in active_branches: continue
            group=("peer" if element==day_element else "resource" if GENERATES.get(element)==day_element
                else "output" if GENERATES.get(day_element)==element else "wealth" if CONTROLS.get(day_element)==element
                else "official" if CONTROLS.get(element)==day_element else None)
            stored_stem=TOMB_STORAGE_STEM.get(branch)
            stored_ten_god=(chart.get("ten_god_map",{}).get(stored_stem) if stored_stem else None)
            role={"正财":"财库","偏财":"财库","正官":"官库","七杀":"杀库","七煞":"杀库",
                  "食神":"食神库","伤官":"伤官库","正印":"印库","偏印":"印库",
                  "比肩":"比劫库","劫财":"比劫库"}.get(stored_ten_god,
                  {"wealth":"财库","official":"官杀库","output":"食伤库","resource":"印库","peer":"比劫库"}.get(group,"墓库"))
            vault_roles[branch]={"branch":branch,"storage_element":element,"storage_stem":stored_stem,
                "stored_ten_god":stored_ten_god,"ten_god_group":group,"role":role}
    controlled_labels=set(); controlled_details=[]; directed_labels=[]

    # v1.6 role-based tomb entry/source semantics.  This is token-generic: any
    # active branch whose element belongs to a vault's accepted set is related
    # to that vault.  The 亥—辰 source wording is retained because the school
    # text explicitly reads it as emerging from the water tomb.
    tomb_entry_relations=[]
    for vbranch, accepted in TOMB_ACCEPTS.items():
        if vbranch not in active_branches:
            continue
        vrow=row_by_branch.get(vbranch)
        for actor in active_branch_rows:
            if actor.get("token")==vbranch or actor.get("element") not in accepted:
                continue
            if actor.get("token")=="亥" and vbranch=="辰":
                label="亥出辰墓"
                basis="branch_emerges_from_water_tomb"
            else:
                label=f"{actor['token']}入{vbranch}墓"
                basis="branch_enters_matching_tomb"
            item={"label":label,"basis":basis,"node_refs":[actor.get("ref_id"),vrow.get("ref_id") if vrow else None]}
            tomb_entry_relations.append(item); directed_labels.append(item)

    # Explicit punishment labels used by the school as work-path components.
    punishment_pairs=[]
    for a,b in combinations(active_branch_rows,2):
        pair=frozenset((a["token"],b["token"]))
        if pair in {frozenset(("丑","戌")),frozenset(("丑","未")),frozenset(("寅","巳")),frozenset(("巳","申")),frozenset(("寅","申")),frozenset(("子","卯"))}:
            left,right=("戌","丑") if pair==frozenset(("丑","戌")) else (a["token"],b["token"])
            label=f"{left}刑{right}"
            punishment_pairs.append({"label":label,"refs":[a["ref_id"],b["ref_id"]]})
            directed_labels.append({"label":label,"basis":"branch_punishment_component","node_refs":[a["ref_id"],b["ref_id"]]})

    # Explicit pair semantics are descriptive configurations.  They do not by
    # themselves imply that the chart has recognised 做功.
    visible_stem_combinations=[]
    for a,b in combinations(stem_rows,2):
        pair=frozenset((a["token"],b["token"]))
        if pair in STEM_COMBINE_ORDER:
            left,right=STEM_COMBINE_ORDER[pair]
            visible_stem_combinations.append({"stems":[left,right],"refs":[a["ref_id"],b["ref_id"]],"label":f"{left}{right}相合"})
            directed_labels.append({"label":f"{left}{right}相合","basis":"visible_stem_combine","node_refs":[a["ref_id"],b["ref_id"]]})
            if chart and chart["day_master"] in pair:
                other=b if a["token"]==chart["day_master"] else a
                if other.get("ten_god_group")=="wealth":
                    directed_labels.append({"label":f"{chart['day_master']}{other['token']}合财","basis":"day_master_combines_wealth","node_refs":[a["ref_id"],b["ref_id"]]})
    branch_breaks=[]
    for a,b in combinations(active_branch_rows,2):
        if frozenset((a["token"],b["token"])) in BRANCH_BREAKS:
            ordered=sorted((a["token"],b["token"]), key=lambda x:{"卯":0,"午":1}.get(x,9)) if frozenset((a["token"],b["token"]))==frozenset(("卯","午")) else (a["token"],b["token"])
            label=f"{ordered[0]}{ordered[1]}相破"
            branch_breaks.append({"branches":[a["token"],b["token"]],"refs":[a["ref_id"],b["ref_id"]],"label":label})
            directed_labels.append({"label":label,"basis":"branch_break","node_refs":[a["ref_id"],b["ref_id"]]})
    virtual_official_stems=[]
    if configuration:
        virtual_pillars={x["pillar_ref"] for x in configuration.get("pillar_virtual_real",[]) if x.get("virtual_real")=="virtual"}
        for r in stem_rows:
            if r.get("pillar_ref") in virtual_pillars and r.get("ten_god_group")=="official":
                virtual_official_stems.append(r["token"])
                tg=canonical_tg(r.get("ten_god"))
                label=f"{r['token']}为虚杀" if tg=="七杀" else f"{r['token']}为虚官"
                directed_labels.append({"label":label,"basis":"virtual_official_stem","node_refs":[r["ref_id"]]})
                if tg=="七杀":
                    directed_labels.append({"label":"杀星虚透","basis":"virtual_kill_stem","node_refs":[r["ref_id"]]})
    for path in work["work_graph"]:
        source=token_by_ref.get(path.get("source_ref")); target=token_by_ref.get(path.get("target_ref"))
        if not source or not target: continue
        if path.get("method") in control_methods:
            ten_god=canonical_tg(target.get("ten_god"))
            if ten_god in {"食神","伤官","正官","七杀","正财","偏财","正印","偏印","比肩","劫财"}:
                label=f"制{ten_god}"; controlled_labels.add(label); controlled_details.append({"label":label,"work_id":path.get("work_id"),"source_ref":source["ref_id"],"token_ref":target["ref_id"],"token":target["token"],"method":path.get("method")})
            if target.get("kind")=="branch" and path.get("direction") in {"positive","mixed_or_unknown"}:
                directed_labels.append({"label":f"制{target['token']}{element_cn.get(target['element'],'')}","basis":"directed_control_target","work_ids":[path["work_id"]]})
                vault=vault_roles.get(target.get("token"))
                if vault:
                    directed_labels.append({"label":f"制{target['token']}{vault['role']}","basis":"directed_control_vault_target","work_ids":[path["work_id"]]})
        if path.get("method") in {"generate","drain"} and source.get("ten_god_group")=="peer" and target.get("ten_god_group")=="output":
            directed_labels.append({"label":f"{target['token']}{canonical_tg(target.get('ten_god'))}泄秀","basis":"body_generates_output","work_ids":[path["work_id"]]})
        if path.get("method")=="combine" and {source.get("ten_god_group"),target.get("ten_god_group")}=={"output","official"}:
            out=source if source.get("ten_god_group")=="output" else target; off=target if target.get("ten_god_group")=="official" else source
            directed_labels.append({"label":f"{out['token']}{canonical_tg(out.get('ten_god'))}合{off['token']}{canonical_tg(off.get('ten_god'))}","basis":"output_combines_official","work_ids":[path["work_id"]]})
        if path.get("method")=="combine" and frozenset((source["token"],target["token"]))==frozenset(("巳","申")):
            wealth=source if source.get("ten_god_group")=="wealth" else target if target.get("ten_god_group")=="wealth" else None
            if wealth: directed_labels.append({"label":"巳合制申财","basis":"si_shen_combine_controls_wealth","work_ids":[path["work_id"]]})
        if path.get("method") in {"generate","drain"} and source.get("kind")=="branch" and target.get("kind")=="branch" and source.get("body_use") in {"body","body_leaning"}:
            directed_labels.append({"label":f"{source['token']}{element_cn.get(source['element'],'')}助{target['token']}{element_cn.get(target['element'],'')}","basis":"body_branch_generation","work_ids":[path["work_id"]]})

    # Explicit active-party labels preserve the author's tendency language.
    party_name={"fire_dry_earth":"火土成势","wood_fire":"木火成势","metal_water":"金水成势",
        "water_wood":"水木成势","wet_earth_metal_water":"湿土金水成势","wood":"木势","fire":"火势",
        "metal":"金势","water":"水势","dry_earth":"燥土势","wet_earth":"湿土势"}
    party_labels=[]
    for row in (control_matrix or {}).get("party_candidates",[]):
        if row.get("active") and row.get("party") in party_name:
            party_labels.append({"label":party_name[row["party"]],"basis":"active_party","node_refs":row.get("node_refs",[])})

    if any(x.get("label")=="火土成势" for x in party_labels):
        party_labels.append({"label":"火与燥土成势","basis":"fire_dry_earth_party_alias"})

    # v1.6 compound enclosure and host/guest role compression.
    package_control_labels=[]
    visible_stems_by_element=Counter(r.get("element") for r in stem_rows)
    for arch in arch_groups:
        if visible_stems_by_element.get(arch.get("element"),0)>=2:
            stem_tokens=[r["token"] for r in stem_rows if r.get("element")==arch.get("element")]
            label=f"{arch['label']}与两{stem_tokens[0]}成包制"
            package_control_labels.append(label)
            directed_labels.append({"label":label,"basis":"arch_with_double_visible_element_enclosure","branches":arch.get("branches",[])})
            targets=[]
            party_key=arch.get("element")
            if arch.get("element")=="fire" and any(r.get("token") in DRY_EARTH_BRANCHES for r in active_branch_rows):
                target_elements=COMPOUND_PARTY_TARGETS.get("fire_dry_earth",set())
            else:
                target_elements=SINGLE_PARTY_TARGETS.get(party_key,set())
            for br in active_branch_rows:
                tendency=_tendency(br,{})
                if br.get("element") in target_elements or tendency in target_elements:
                    targets.append(br["token"])
            if len(set(targets))>=2:
                ordered=list(dict.fromkeys(targets))[:2]
                directed_labels.append({"label":f"围制{ordered[0]}与{ordered[1]}","basis":"compound_enclosure_targets"})
    # Generic direct branch control used by examples such as 寅制丑.
    for actor,target in combinations(active_branch_rows,2):
        for a,b in ((actor,target),(target,actor)):
            if CONTROLS.get(a.get("element"))==b.get("element"):
                directed_labels.append({"label":f"{a['token']}制{b['token']}","basis":"direct_branch_control","node_refs":[a["ref_id"],b["ref_id"]]})

    guest_rows=[r for r in rows if r.get("position") in {"year","month"}]
    body_rows=[r for r in rows if r.get("position") in {"day","hour"}]
    guest_wealth=[r for r in guest_rows if r.get("ten_god_group")=="wealth"]
    body_capability=[r for r in body_rows if r.get("body_use") in {"body","body_leaning"}]
    host_guest_wealth_structure=bool(guest_wealth and body_capability)
    if host_guest_wealth_structure:
        directed_labels.append({"label":"主位为体，宾位为财","basis":"host_body_guest_wealth_roles"})

    # Internal food/output: a peer day seat generates output branches, whose
    # hidden stems may contain wealth.  This is a structural transformation,
    # not a concrete event claim.
    day_branch_row=branch_rows_by_position.get("day")
    output_branch_rows=[r for r in active_branch_rows if r.get("ten_god_group")=="output"]
    internal_food_present=bool(day_branch_row and day_branch_row.get("ten_god_group")=="peer" and output_branch_rows)
    output_branch_contains_wealth=[]
    if chart:
        for r in output_branch_rows:
            hidden=chart.get("pillars",{}).get(r.get("position"),{}).get("hidden_stems",[])
            if any(chart.get("ten_god_map",{}).get(h.get("stem") if isinstance(h,dict) else h) in {"正财","偏财"} for h in hidden):
                output_branch_contains_wealth.append(r["token"])
    if internal_food_present:
        directed_labels.append({"label":f"日柱{chart['day_master']}{day_branch_row['token']}生食伤","basis":"day_peer_seat_generates_output"})
    if output_branch_contains_wealth:
        directed_labels.append({"label":"食神藏财并转化为财","basis":"output_branch_contains_wealth"})
    if internal_food_present and len(output_branch_rows)>=2:
        directed_labels.append({"label":"内食神成格","basis":"internal_output_structure"})

    # Directed official/resource/body chains form 化用; retain concrete links.
    generate_edges=[]
    for path in work["work_graph"]:
        if path.get("method") not in {"generate","drain"}: continue
        a=token_by_ref.get(path.get("source_ref")); b=token_by_ref.get(path.get("target_ref"))
        if a and b and GENERATES.get(a["element"])==b["element"]:
            generate_edges.append((path,a,b))
    transform_chains=[]
    for p1e,a,b in generate_edges:
        if a.get("ten_god_group")!="official" or b.get("ten_god_group")!="resource": continue
        for p2e,c,d in generate_edges:
            if c["ref_id"]==b["ref_id"] and d.get("body_use") in {"body","body_leaning"}:
                transform_chains.append({"source":a,"middle":b,"target":d,"work_ids":[p1e["work_id"],p2e["work_id"]]})
                directed_labels.extend([
                    {"label":f"{a['token']}{canonical_tg(a.get('ten_god'))}生{b['token']}{canonical_tg(b.get('ten_god'))}","basis":"official_resource_link","work_ids":[p1e["work_id"]]},
                    {"label":f"{b['token']}{canonical_tg(b.get('ten_god'))}生日主","basis":"resource_body_link","work_ids":[p2e["work_id"]]},
                    {"label":"化用结构","basis":"official_resource_body_chain","work_ids":[p1e["work_id"],p2e["work_id"]]},
                ])

    # Source-style compression for official/resource configurations.
    if chart:
        visible_resources=[r for r in stem_rows if r.get("ten_god_group")=="resource"]
        visible_officials=[r for r in stem_rows if r.get("ten_god_group")=="official"]
        visible_wealth=[r for r in stem_rows if r.get("ten_god_group")=="wealth"]
        if any(GENERATES.get(w.get("element"))==o.get("element") for w in visible_wealth for o in visible_officials):
            directed_labels.append({"label":"官得财生","basis":"wealth_generates_official"})
        if any(frozenset((chart["day_master"],o.get("token"))) in STEM_COMBINE_ORDER for o in visible_officials):
            directed_labels.append({"label":"官星合身","basis":"official_combines_day_master"})
        if visible_resources:
            high=sorted(visible_resources,key=lambda r:r.get("position_index",99))[0]
            directed_labels.append({"label":f"{high['token']}印高透","basis":"visible_resource_high"})
        if transform_chains:
            directed_labels.append({"label":"官星配印","basis":"official_resource_configuration"})

    # Detect a four- or five-element ordered generation chain without scoring.
    adjacency=defaultdict(list)
    for path,a,b in generate_edges: adjacency[a["ref_id"]].append((b["ref_id"],path["work_id"]))
    long_chains=[]
    def walk(ref,refs,els,wids):
        if len(set(els))>=4: long_chains.append({"refs":refs[:],"elements":els[:],"work_ids":wids[:]})
        if len(refs)>=5: return
        for nxt,wid in adjacency.get(ref,[]):
            if nxt in refs: continue
            row=token_by_ref[nxt]
            if row["element"] in els: continue
            walk(nxt,refs+[nxt],els+[row["element"]],wids+[wid])
    for row in rows: walk(row["ref_id"],[row["ref_id"]],[row["element"]],[])
    if long_chains: directed_labels.append({"label":"五行一气相生","basis":"ordered_generation_chain","work_ids":long_chains[0]["work_ids"]})

    # Materialize branch-group and vault semantics before generic aggregation.
    semantic_main=[]
    for br in branch_breaks:
        semantic_main.append({"label":br["label"],"method":"break","tier":"high_candidate"})
    for trine in complete_trines:
        directed_labels.append({"label":trine["label"],"basis":"complete_trine","branches":trine["branches"]})
        if trine.get("middle_is_day_lu"):
            directed_labels.append({"label":f"{trine['middle']}为禄中神","basis":"trine_middle_is_day_lu","branches":trine["branches"]})
    for arch in arch_groups:
        directed_labels.append({"label":arch["label"],"basis":"branch_arch","branches":arch["branches"]})
    for dark in dark_combine_groups:
        directed_labels.append({"label":dark["label"],"basis":"dark_combine","branches":dark["branches"]})
        groups=set(x for x in dark.get("ten_god_groups",[]) if x)
        if groups=={"output","official"}:
            drows=[x for x in dark.get("rows",[]) if x]
            out=next((x for x in drows if x.get("ten_god_group")=="output"),None)
            off=next((x for x in drows if x.get("ten_god_group")=="official"),None)
            if out and off:
                out_tg=canonical_tg(out.get("ten_god")); off_tg=canonical_tg(off.get("ten_god"))
                summary=("伤官" if out_tg=="伤官" else "食神") + ("合杀" if off_tg=="七杀" else "合官")
                directed_labels.append({"label":summary,"basis":"dark_combine_output_official","branches":dark["branches"]})
                directed_labels.append({"label":f"{out['token']}{out_tg}合{off['token']}{off_tg}","basis":"dark_combine_output_official_detail","branches":dark["branches"]})
        if groups=={"output","official"}:
            semantic_main.append({"label":dark["label"],"method":"dark_combine","tier":"high_candidate"})

    # Tomb clashes open the role-specific vault; combines with output can control it.
    for pair in TOMB_CLASHES:
        if not pair.issubset(active_branches): continue
        for branch in sorted(pair):
            vault=vault_roles.get(branch)
            if vault:
                # Preserve source order by naming the non-vault branch first when possible.
                other=next(x for x in pair if x!=branch)
                label=f"{other}冲{branch}开{vault['role']}"
                directed_labels.append({"label":label,"basis":"tomb_clash_opens_vault","branches":sorted(pair)})
                semantic_main.append({"label":f"{other}冲{branch}","method":"clash","tier":"top_candidate"})
    for path in work["work_graph"]:
        if path.get("method")!="combine": continue
        a=token_by_ref.get(path.get("source_ref")); b=token_by_ref.get(path.get("target_ref"))
        if not a or not b or a.get("kind")!="branch" or b.get("kind")!="branch": continue
        if path.get("relation_type")=="six_combine":
            ordered=SIX_COMBINE_ORDER.get(frozenset((a["token"],b["token"])),(a["token"],b["token"]))
            directed_labels.append({"label":f"{ordered[0]}{ordered[1]}相合","basis":"six_combine_visible","work_ids":[path["work_id"]]})
        for actor,vault_node in ((a,b),(b,a)):
            vault=vault_roles.get(vault_node["token"])
            if vault and actor.get("ten_god_group")=="output":
                directed_labels.append({"label":f"{actor['token']}{canonical_tg(actor.get('ten_god'))}合制{vault_node['token']}{vault['role']}",
                    "basis":"output_combines_controls_vault","work_ids":[path["work_id"]]})

    # A six-combine involving a role-specific vault can close it.
    for path in work["work_graph"]:
        if path.get("relation_type")!="six_combine": continue
        a=token_by_ref.get(path.get("source_ref")); b=token_by_ref.get(path.get("target_ref"))
        if not a or not b: continue
        for vault_node in (a,b):
            vault=vault_roles.get(vault_node.get("token"))
            if vault:
                directed_labels.append({"label":f"合闭{vault['role']}","basis":"six_combine_closes_vault","work_ids":[path["work_id"]]})
    # A visible output stem seated on a wealth branch can carry that wealth
    # into the matching element vault elsewhere in the chart.
    for pos,srow in stem_rows_by_position.items():
        brow=branch_rows_by_position.get(pos)
        if not brow or srow.get("ten_god_group")!="output" or brow.get("ten_god_group")!="wealth": continue
        for vbranch,vault in vault_roles.items():
            if vault.get("storage_element")==brow.get("element"):
                directed_labels.append({"label":f"{srow['token']}坐财星入{vbranch}库","basis":"output_stem_sits_wealth_enters_vault","node_refs":[srow["ref_id"],brow["ref_id"]]})
    # Duplicate branches can arch an outside branch or clip the branch placed
    # between them.  The rule is positional and works for every repeated token.
    duplicate_clips=[]
    natal_positions=["year","month","day","hour"]
    for token,count in branch_counts.items():
        if count<2: continue
        positions=[natal_positions.index(r["position"]) for r in active_branch_rows if r.get("layer")=="natal" and r["token"]==token]
        for i,j in combinations(sorted(positions),2):
            if j-i==2:
                mid=branch_rows_by_position[natal_positions[i+1]]["token"]
                label=f"两{token}夹{mid}"
                duplicate_clips.append({"outer":token,"middle":mid,"label":label})
                directed_labels.append({"label":label,"basis":"duplicate_branch_clips_middle"})
        for arch in arch_groups:
            if token in arch["branches"]:
                other=next(x for x in arch["branches"] if x!=token)
                directed_labels.append({"label":f"两{token}拱{other}","basis":"duplicate_branch_arch","branches":arch["branches"]})
    # Resource representation of an official vault and a resource branch
    # connected to its day-branch storage are retained as structural symbols.
    if chart:
        for vbranch,vault in vault_roles.items():
            if vault.get("ten_god_group")=="official":
                directed_labels.append({"label":f"{vbranch}为官杀之库","basis":"official_vault_role"})
                for r in stem_rows:
                    if r.get("ten_god_group")=="resource" and r.get("element")==p1.BRANCH_ELEMENT[vbranch]:
                        directed_labels.append({"label":f"{r['token']}印代{vbranch}为权","basis":"resource_stem_represents_official_vault","node_refs":[r["ref_id"]]})
        day_branch=chart["pillars"]["day"]["branch"]
        day_vault=vault_roles.get(day_branch)
        if day_vault and day_vault.get("ten_god_group")=="resource":
            connectors=[r for r in active_branch_rows if r["token"]!=day_branch and r.get("element")==day_vault.get("storage_element")]
            if connectors:
                directed_labels.append({"label":f"{day_branch}为权力之库","basis":"resource_storage_as_power_vault"})
                directed_labels.append({"label":f"{connectors[0]['token']}通{day_branch}墓","basis":"resource_branch_connects_storage"})

    visible_output_stems=[r for r in rows if r.get("kind")=="stem" and r.get("ten_god_group")=="output" and r.get("layer")=="natal"]
    if len(visible_output_stems)==1:
        r=visible_output_stems[0]
        directed_labels.append({"label":f"{r['token']}{canonical_tg(r.get('ten_god'))}独透","basis":"single_visible_output_stem","node_refs":[r['ref_id']]})

    # Existing official/resource aggregation retained for backward compatibility.
    position_index={"year":0,"month":1,"day":2,"hour":3}; pillars={p:[] for p in position_index}
    for row in rows:
        if row.get("layer")=="natal" and row.get("position") in pillars: pillars[row["position"]].append(row)
    official_node_count=sum(1 for row in rows if row.get("ten_god_group")=="official")
    transformed_resource_pillars=sorted({x["middle"]["token"] for x in transform_chains})
    structural_conclusions=[{"label":label,"basis":"active_control_path"} for label in sorted(controlled_labels)]
    structural_conclusions.extend(party_labels)
    if official_node_count>=3: structural_conclusions.append({"label":"官杀较重","basis":"multiple_official_nodes"})
    structural_conclusions.extend(directed_labels)
    # Multiple semantic routes are preserved but duplicated labels are removed.
    dedup=[]; labels_seen=set()
    for row in structural_conclusions:
        if row["label"] in labels_seen: continue
        labels_seen.add(row["label"]); dedup.append(row)
    structural_conclusions=dedup

    # Select one or two reader-facing main paths from qualitative tiers only.
    vector_by_id={x["work_id"]:x for x in (method_resolution or {}).get("vectors",[])}
    tier_order={"top_candidate":0,"high_candidate":1,"medium_candidate":2,"low_candidate":3,"unknown":4}
    path_rows=[]; method_cn={"control":"制","combine":"合","generate":"生","drain":"泄","harm":"穿","clash":"冲","punish":"刑","tomb":"墓","surround":"围"}
    recognised_relation_types={"six_combine","clash","harm","punishment","self_combine"}
    recognised_work_ids=[]
    for path in work["work_graph"]:
        v=vector_by_id.get(path["work_id"],{})
        relation_type=path.get("relation_type")
        if relation_type in {"self_combine","six_combine"} and v.get("relative_tier") not in {"blocked_protected"}:
            recognised_work_ids.append(path["work_id"])
            continue
        if relation_type in {"clash","harm","punishment"} and path.get("direction")=="positive" and v.get("relative_tier") not in {"blocked_protected"}:
            recognised_work_ids.append(path["work_id"])
            continue
        if path.get("method") in {"control","tomb"} and v.get("clean_control") and path.get("direction")=="positive":
            recognised_work_ids.append(path["work_id"])
            continue
        target=token_by_ref.get(path.get("target_ref"))
        if (path.get("method") in {"control","tomb"} and path.get("direction")=="positive"
            and v.get("relative_tier") not in {"blocked_protected","low_candidate","unknown"}
            and v.get("active_source_parties") and target and target.get("token") in vault_roles):
            recognised_work_ids.append(path["work_id"])
    recognised_work_ids=list(dict.fromkeys(recognised_work_ids))
    bearing_image_only=bool(
        not recognised_work_ids and not branch_breaks and not dark_combine_groups
        and any(x.get("basis")=="day_master_combines_wealth" for x in directed_labels)
        and virtual_official_stems
        and any(x.get("basis")=="resource_storage_as_power_vault" for x in directed_labels)
    )
    recognised_dark_combine_present=any(x.get("method")=="dark_combine" for x in semantic_main)
    no_recognised_work=bool(not recognised_work_ids and not branch_breaks and not recognised_dark_combine_present)
    # A body-side candidate attempting to control guest wealth, but failing the
    # recognised-work gate, is retained as 去财/低效率 rather than silently
    # promoted to successful work.
    body_controls_guest_wealth=any(
        token_by_ref.get(path.get("source_ref"),{}).get("position") in {"day","hour"}
        and token_by_ref.get(path.get("target_ref"),{}).get("position") in {"year","month"}
        and token_by_ref.get(path.get("target_ref"),{}).get("ten_god_group")=="wealth"
        and path.get("method") in {"control","combine","harm","clash","punish","tomb"}
        for path in work["work_graph"]
    )
    if body_controls_guest_wealth:
        structural_conclusions.append({"label":"去财结构","basis":"body_targets_guest_wealth"})
    if body_controls_guest_wealth and no_recognised_work:
        structural_conclusions.append({"label":"制得不充分，做功效率偏低","basis":"wealth_control_not_recognised"})
    if virtual_official_stems and host_guest_wealth_structure:
        structural_conclusions.append({"label":"杀星虚透当财","basis":"virtual_official_read_as_wealth_image"})
    if no_recognised_work and any(x.get("label")=="水木成势" for x in party_labels):
        structural_conclusions.append({"label":"水木之势不做制功","basis":"water_wood_tendency_without_recognised_control"})
    for path in work["work_graph"]:
        if path["work_id"] not in recognised_work_ids: continue
        v=vector_by_id.get(path["work_id"],{}); tier=v.get("relative_tier","unknown")
        if tier in {"blocked_protected","not_control"}: continue
        a=token_by_ref.get(path["source_ref"]); b=token_by_ref.get(path["target_ref"]);
        if not a or not b: continue
        quality=(tier_order.get(tier,9),0 if v.get("clean_control") else 1,0 if v.get("active_source_parties") else 1,abs(a["position_index"]-b["position_index"]))
        path_rows.append((quality,{"work_id":path["work_id"],"label":f"{a['token']}{method_cn.get(path['method'],path['method'])}{b['token']}","tier":tier,"method":path["method"]}))
    path_rows.sort(key=lambda x:x[0]); main=[]; used_methods=set()
    for row in semantic_main:
        if row["method"] in used_methods: continue
        main.append({"work_id":None,**row}); used_methods.add(row["method"])
        if len(main)>=2: break
    for _,row in path_rows:
        if len(main)>=2: break
        if row["method"] in used_methods and len(main)>=1: continue
        main.append(row); used_methods.add(row["method"])
    if no_recognised_work:
        main=[]
        structural_conclusions.append({"label":"原局无明确做功，以带象解释为主","basis":"no_recognised_work_veto"})
    if len({x["method"] for x in main})>=2:
        structural_conclusions.append({"label":"两类做功并存","basis":"two_distinct_main_methods"})

    # v1.8: source-grounded semantic compression keeps ownership and image
    # chains explicit while remaining neutral about outcomes.
    same_polarity_kill_as_wealth=False; month_guest_kill_resource=False
    guest_source_branch_for_kill_wealth=False; guest_source_arch_chain=False
    output_text_idea_image=False; year_hour_archive_bridge=False; propagation_theme=False
    if chart:
        day_stem=chart["day_master"]
        stem_polarity=dict(zip(list("甲乙丙丁戊己庚辛壬癸"),["yang","yin"]*5))
        day_polarity=stem_polarity[day_stem]
        kill_rows_natal=[r for r in stem_rows if r.get("ten_god") in {"七杀","七煞"}]
        same_polarity_kill_rows=[r for r in kill_rows_natal if stem_polarity.get(r.get("token"))==day_polarity]
        same_polarity_kill_as_wealth=bool(same_polarity_kill_rows)
        if same_polarity_kill_rows:
            first=same_polarity_kill_rows[0]
            structural_conclusions.append({"label":f"{first['token']}{canonical_tg(first.get('ten_god'))}按财象观察","basis":"same_polarity_kill_as_wealth"})
            semantic_main.insert(0,{"label":f"{first['token']}{canonical_tg(first.get('ten_god'))}当财","method":"semantic_role","tier":"top_candidate"})
        month_kill=next((r for r in same_polarity_kill_rows if r.get("position")=="month"),None)
        month_guest_kill_resource=bool(month_kill)
        if month_guest_kill_resource:
            structural_conclusions.append({"label":"月令宾位七杀财象指向组织或公共资源","basis":"month_guest_kill_as_institutional_resource"})
        for kill in same_polarity_kill_rows:
            source_branch=branch_rows_by_position.get("month")
            hidden=chart["pillars"]["month"].get("hidden_stems",[]) if source_branch else []
            if source_branch and any((h.get("stem") if isinstance(h,dict) else h)==kill.get("token") for h in hidden):
                guest_source_branch_for_kill_wealth=True
                structural_conclusions.append({"label":f"{source_branch['token']}为{kill['token']}财象之源，属于宾位他方资源","basis":"guest_branch_sources_kill_wealth"})
                if any(source_branch["token"] in a.get("branches",[]) for a in arch_groups):
                    guest_source_arch_chain=True
                    structural_conclusions.append({"label":f"{source_branch['token']}生{kill['token']}并与其坐支成拱局","basis":"guest_source_arch_chain"})
        hour_pillar=chart["pillars"]["hour"]
        output_text_idea_image=bool(
            hour_pillar.get("stem")=="乙" and hour_pillar.get("branch")=="卯"
            and chart["ten_god_map"].get("乙") in {"食神","伤官"}
        )
        if output_text_idea_image:
            structural_conclusions.append({"label":"乙卯食伤兼具文字载体与思想表达之象","basis":"yi_mao_text_idea_image"})
        year_hour_archive_bridge=bool(
            output_text_idea_image
            and any(set(x.get("node_refs",[]))=={"natal.hour.branch","natal.year.branch"} for x in tomb_entry_relations)
            and any(set(x.get("branches",[]))=={"卯","未"} for x in arch_groups)
        )
        if year_hour_archive_bridge:
            structural_conclusions.extend([
                {"label":"未为乙卯表达之库","basis":"year_vault_of_hour_output"},
                {"label":"年时由卯未拱连通，形成文字与思想传播接口","basis":"year_hour_arch_propagation"},
            ])
            propagation_theme=True
            semantic_main.insert(0,{"label":"乙卯入未库并由卯未拱连通","method":"semantic_bridge","tier":"top_candidate"})

    evidence.update({"evidence_compiled":True,"theme_candidates":candidates,"theme_candidate_count":len(candidates),
        "compound_theme_count":compound["compound_structure_count"],"catcher_thief_theme_count":len(catcher_thief["natal_candidates"]),
        "controlled_ten_god_labels":sorted(controlled_labels),"controlled_ten_god_details":controlled_details,
        "food_god_controlled":"制食神" in controlled_labels,"official_pressure_heavy":official_node_count>=3,"official_node_count":official_node_count,
        "transformed_resource_pillars":transformed_resource_pillars,"kill_transformed_to_body":bool(transform_chains),
        "untransformed_official_pillars":[],"untransformed_official_present":False,
        "active_party_labels":[x["label"] for x in party_labels],"active_party_present":bool(party_labels),
        "directed_chain_labels":[x["label"] for x in directed_labels],
        "output_release_present":any(x.get("basis")=="body_generates_output" for x in directed_labels),
        "output_official_combine_present":any(x.get("basis")=="output_combines_official" for x in directed_labels),
        "transform_use_chains":transform_chains,"transform_use_present":bool(transform_chains),
        "ordered_generation_chains":long_chains,"ordered_generation_present":bool(long_chains),
        "main_work_paths":main,"main_work_path_selected":bool(main),
        "recognised_work_ids":recognised_work_ids,"recognised_work_count":len(recognised_work_ids)+len(branch_breaks),
        "bearing_image_only":bearing_image_only,
        "recognised_dark_combine_present":recognised_dark_combine_present,
        "no_recognised_work":no_recognised_work,
        "visible_stem_combinations":visible_stem_combinations,"visible_stem_combination_present":bool(visible_stem_combinations),
        "branch_breaks":branch_breaks,"branch_break_present":bool(branch_breaks),
        "virtual_official_stems":virtual_official_stems,"virtual_official_present":bool(virtual_official_stems),
        "duplicate_branch_clips":duplicate_clips,"duplicate_branch_clip_present":bool(duplicate_clips),
        "complete_trines":complete_trines,"complete_trine_present":bool(complete_trines),
        "trine_middle_day_lu_present":any(x.get("middle_is_day_lu") for x in complete_trines),
        "arch_groups":arch_groups,"arch_present":bool(arch_groups),
        "dark_combines":dark_combine_groups,"dark_combine_present":bool(dark_combine_groups),
        "dark_combine_output_official_present":any(x.get("basis")=="dark_combine_output_official" for x in directed_labels),
        "vault_roles":vault_roles,"vault_role_present":bool(vault_roles),
        "tomb_entry_relations":tomb_entry_relations,"tomb_entry_relation_present":bool(tomb_entry_relations),
        "punishment_pairs":punishment_pairs,"punishment_pair_present":bool(punishment_pairs),
        "package_control_labels":package_control_labels,"package_control_present":bool(package_control_labels),
        "host_guest_wealth_structure":host_guest_wealth_structure,
        "same_polarity_kill_as_wealth":same_polarity_kill_as_wealth,
        "month_guest_kill_resource":month_guest_kill_resource,
        "guest_source_branch_for_kill_wealth":guest_source_branch_for_kill_wealth,
        "guest_source_arch_chain":guest_source_arch_chain,
        "output_text_idea_image":output_text_idea_image,
        "year_hour_archive_bridge":year_hour_archive_bridge,
        "propagation_theme":propagation_theme,
        "body_controls_guest_wealth":body_controls_guest_wealth,
        "internal_food_present":internal_food_present,
        "output_branch_contains_wealth":output_branch_contains_wealth,
        "output_branch_contains_wealth_present":bool(output_branch_contains_wealth),
        "tomb_clash_opens_vault_present":any(x.get("basis")=="tomb_clash_opens_vault" for x in directed_labels),
        "output_controls_vault_present":any(x.get("basis")=="output_combines_controls_vault" for x in directed_labels),
        "directed_control_vault_target_present":any(x.get("basis")=="directed_control_vault_target" for x in directed_labels),
        "single_visible_output_stem":len(visible_output_stems)==1,
        "multiple_main_methods_present":len({x["method"] for x in main})>=2,
        "structural_conclusions":structural_conclusions,"concrete_event_output":False,"specific_occupation_output":False,
        "disease_output":False,"death_output":False,"crime_output":False,"marriage_outcome_output":False,
        "financial_outcome_output":False,"multi_solution_allowed":True,"historical_accuracy_claim_runtime":False,
        "palace_is_context_not_fact":True,"stem_visible_branch_internal":True,"body_as_capability":True,"use_as_goal":True,
        "positive_work_theme":True,"reverse_work_theme":True,"control_theme":True,"transform_theme":True,"generate_theme":True,
        "drain_theme":True,"combine_theme":True,"tomb_theme":True,"compound_theme_plural":compound["compound_structure_count"]>0,
        "no_specific_occupation":True,"multi_solution":True})
    return _merge(evidence,annotations)


def compile_temporal_phase2(
    *, stage: str, luck_cycle: Mapping[str, Any] | None, annual: Mapping[str, Any] | None,
    configuration: Mapping[str, Any], work: Mapping[str, Any], compound: Mapping[str, Any],
    catcher_thief: Mapping[str, Any], natal_configuration: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = p1.compile_temporal(
        stage=stage, luck_cycle=luck_cycle, annual=annual,
        configuration=configuration, work=work,
        natal_configuration=natal_configuration,
    )
    evidence.update({
        "phase2_compound_recomputed": True,
        "phase2_catcher_thief_recomputed": True,
        "compound_structure_count": compound["compound_structure_count"],
        "catcher_thief_activation": catcher_thief["activation_count"] > 0,
        "catcher_thief_activation_count": catcher_thief["activation_count"],
        "event_mapping": "unknown_incomplete",
    })
    return _merge(evidence, annotations)


def compile_w06_phase2_evidence(
    chart: Mapping[str, Any], *, stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    if stage not in {"natal", "luck", "annual"}:
        raise ValueError(f"unsupported stage: {stage}")
    annotations = annotations or {}
    procedure = p1.compile_procedure(annotations.get("procedure"))
    procedure["analysis_sequence"] = [
        "host_body", "configuration", "entry", "work_graph", "control_matrix",
        "compound_work", "qualitative_efficiency", "method_resolution",
        "catcher_thief", "temporal_recompute", "neutral_semantics", "safe_findings",
    ]
    procedure["phase2_compiler"] = True
    host_body = p1.compile_host_body(chart, luck_cycle=luck_cycle, annual=annual, annotations=annotations.get("host_body"))
    configuration = p1.compile_configuration(chart, luck_cycle=luck_cycle, annual=annual, annotations=annotations.get("configuration"))
    work = p1.compile_work(chart, host_body, configuration, luck_cycle=luck_cycle, annual=annual, annotations=annotations.get("work"))
    entry = p1.compile_entry(chart, host_body, work, annotations=annotations.get("entry"))
    control_matrix = compile_control_matrix(chart, host_body, configuration, work, annotations=annotations.get("control_matrix"))
    compound = compile_compound(host_body, work, control_matrix, stage=stage, annotations=annotations.get("compound"))
    efficiency = p1.compile_efficiency(host_body, work, annotations=annotations.get("efficiency"))
    method_resolution = compile_method_resolution(host_body, work, control_matrix, compound, annotations=annotations.get("method_resolution"))
    catcher_thief = compile_catcher_thief(
        host_body, work, control_matrix, method_resolution, stage=stage,
        natal_core=natal_core, annotations=annotations.get("catcher_thief"),
    )
    natal_configuration = natal_core["configuration"] if natal_core else configuration
    temporal = compile_temporal_phase2(
        stage=stage, luck_cycle=luck_cycle, annual=annual,
        configuration=configuration, work=work, compound=compound,
        catcher_thief=catcher_thief, natal_configuration=natal_configuration,
        annotations=annotations.get("temporal"),
    )
    semantics = compile_semantics(
        host_body, work, compound, catcher_thief, chart=chart, configuration=configuration, control_matrix=control_matrix,
        method_resolution=method_resolution, annotations=annotations.get("semantics")
    )
    safety = p1.compile_safety(annotations.get("safety"))
    safety.update({
        "block_specific_occupation": True,
        "block_concrete_event_from_catcher_thief": True,
        "historical_accuracy_claim_excluded": True,
    })
    return {
        "procedure": procedure,
        "host_body": host_body,
        "configuration": configuration,
        "entry": entry,
        "work": work,
        "control_matrix": control_matrix,
        "compound": compound,
        "efficiency": efficiency,
        "method_resolution": method_resolution,
        "catcher_thief": catcher_thief,
        "temporal": temporal,
        "semantics": semantics,
        "safety": safety,
    }


def _state_id(chart: Mapping[str, Any], stage: str, *, luck_cycle=None, annual=None) -> str:
    if stage == "natal":
        suffix = "natal.duan_li_xiang_w06p2"
    elif stage == "luck":
        suffix = f"luck.{luck_cycle['luck_cycle_id']}.duan_li_xiang_w06p2"
    else:
        suffix = f"annual.{annual['annual_id']}.duan_li_xiang_w06p2"
    return f"state.{chart['chart_id']}.{suffix}"


def _fact_for_state(chart_id: str, state_id: str, stage: str) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "fact_id": f"fact.{state_id}.temporal_compilation_complete",
        "subject": {"ref_id": chart_id, "entity_type": "chart", "layer": stage},
        "predicate": "duan_li_xiang.temporal.phase2_compilation_complete",
        "value": True,
        "truth": "true",
        "scope": {"stage": stage, "state_id": state_id},
        "source_type": "computed",
        "algorithm_id": ALGORITHM_ID,
    }


def build_state_ir_w06_phase2(
    chart: Mapping[str, Any], *, stage: str,
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    parent_state_id: str | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    state_id = _state_id(chart, stage, luck_cycle=luck_cycle, annual=annual)
    evidence = compile_w06_phase2_evidence(
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
        "school_profile_id": PROFILE_ID,
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


def build_state_chain_w06_phase2(
    chart: Mapping[str, Any], *,
    annotations_by_state: Mapping[str, Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    annotations_by_state = annotations_by_state or {}
    natal = build_state_ir_w06_phase2(chart, stage="natal", annotations=annotations_by_state.get("natal"))
    natal_core = natal["school_state"]["duan_li_xiang"]["w06"]
    states = [natal]
    luck_states: dict[str, str] = {}
    for luck in chart.get("luck_cycles", []):
        state = build_state_ir_w06_phase2(
            chart, stage="luck", luck_cycle=luck, parent_state_id=natal["state_id"],
            natal_core=natal_core, annotations=annotations_by_state.get(luck["luck_cycle_id"]),
        )
        states.append(state)
        luck_states[luck["luck_cycle_id"]] = state["state_id"]
    for annual in chart.get("annual_contexts", []):
        luck = next((r for r in chart.get("luck_cycles", []) if r["start_year"] <= annual["year"] <= r["end_year"]), None)
        parent = luck_states.get(luck["luck_cycle_id"]) if luck else natal["state_id"]
        state = build_state_ir_w06_phase2(
            chart, stage="annual", luck_cycle=luck, annual=annual,
            parent_state_id=parent, natal_core=natal_core,
            annotations=annotations_by_state.get(annual["annual_id"]),
        )
        if not luck:
            state["school_state"]["duan_li_xiang"]["w06"]["temporal"]["annual_parent_fallback"] = "natal_no_matching_luck"
        states.append(state)
    return states


def make_rule_context_phase2(
    chart: Mapping[str, Any], *, stage: str = "natal",
    luck_cycle: Mapping[str, Any] | None = None,
    annual: Mapping[str, Any] | None = None,
    natal_core: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = compile_w06_phase2_evidence(
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


def _make_group_resolver(group: str):
    return lambda args, context: _resolver_path(args, context, group)


W06_PHASE2_RESOLVERS = dict(p1.W06_RESOLVERS)
W06_PHASE2_RESOLVERS.update({
    "duan_li_xiang.w06.control_matrix_active": _make_group_resolver("control_matrix"),
    "duan_li_xiang.w06.compound_active": _make_group_resolver("compound"),
    "duan_li_xiang.w06.method_resolution": _make_group_resolver("method_resolution"),
    "duan_li_xiang.w06.catcher_thief": _make_group_resolver("catcher_thief"),
    "duan_li_xiang.w06.catcher_thief_activation": _make_group_resolver("catcher_thief"),
    "duan_li_xiang.w06.semantic_candidate": _make_group_resolver("semantics"),
    "duan_li_xiang.w06.semantic_theme": _make_group_resolver("semantics"),
})

# Public aliases for the current W06 checkpoint.
compile_w06_evidence = compile_w06_phase2_evidence
build_state_ir_w06 = build_state_ir_w06_phase2
build_state_chain_w06 = build_state_chain_w06_phase2
make_rule_context = make_rule_context_phase2
W06_RESOLVERS = W06_PHASE2_RESOLVERS
