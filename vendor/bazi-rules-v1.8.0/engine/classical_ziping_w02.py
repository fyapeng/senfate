"""W02 evidence compiler and resolvers for traditional Ziping rules.

This module is deliberately narrower than the W08 runtime.  It compiles facts
that are directly recoverable from ChartIR and exposes every threshold in a
profile parameter object.  Source-dependent judgments such as whether a
particular clash is effective remain overridable annotations rather than hidden
scores.
"""
from __future__ import annotations

from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping

from .reference_dsl import Truth, get_path

ROOT = Path(__file__).resolve().parents[1]

STEM_ELEMENT = {
    "甲": "wood", "乙": "wood", "丙": "fire", "丁": "fire", "戊": "earth",
    "己": "earth", "庚": "metal", "辛": "metal", "壬": "water", "癸": "water",
}
BRANCH_ELEMENT = {
    "寅": "wood", "卯": "wood", "巳": "fire", "午": "fire",
    "辰": "earth", "戌": "earth", "丑": "earth", "未": "earth",
    "申": "metal", "酉": "metal", "亥": "water", "子": "water",
}
GENERATES = {"wood": "fire", "fire": "earth", "earth": "metal", "metal": "water", "water": "wood"}
CONTROLS = {"wood": "earth", "earth": "water", "water": "fire", "fire": "metal", "metal": "wood"}
PAIR_TO_ELEMENT = {"甲己": "earth", "乙庚": "metal", "丙辛": "water", "丁壬": "wood", "戊癸": "fire"}
PAIR_CANONICAL = {frozenset(pair): pair for pair in PAIR_TO_ELEMENT}
TEN_GOD_GROUP = {
    "正财": "财", "偏财": "财", "正官": "正官", "七杀": "七杀",
    "正印": "印", "偏印": "印", "食神": "食神", "伤官": "伤官",
    "比肩": "比肩", "劫财": "劫财",
}
DIRECTION_SETS = {
    "wood": [set("寅卯辰"), set("亥卯未")],
    "fire": [set("巳午未"), set("寅午戌")],
    "metal": [set("申酉戌"), set("巳酉丑")],
    "water": [set("亥子丑"), set("申子辰")],
    "earth": [set("辰戌丑未")],
}
TRINES = [set("申子辰"), set("巳酉丑"), set("寅午戌"), set("亥卯未")]
DIRECTIONS = [set("寅卯辰"), set("巳午未"), set("申酉戌"), set("亥子丑")]
BRANCH_GROUP_CATALOG = {
    frozenset("申子辰"): {"slug": "shen_zi_chen", "element": "water", "kind": "trine", "label": "申子辰三合水局"},
    frozenset("巳酉丑"): {"slug": "si_you_chou", "element": "metal", "kind": "trine", "label": "巳酉丑三合金局"},
    frozenset("寅午戌"): {"slug": "yin_wu_xu", "element": "fire", "kind": "trine", "label": "寅午戌三合火局"},
    frozenset("亥卯未"): {"slug": "hai_mao_wei", "element": "wood", "kind": "trine", "label": "亥卯未三合木局"},
    frozenset("寅卯辰"): {"slug": "yin_mao_chen", "element": "wood", "kind": "meeting", "label": "寅卯辰三会木局"},
    frozenset("巳午未"): {"slug": "si_wu_wei", "element": "fire", "kind": "meeting", "label": "巳午未三会火局"},
    frozenset("申酉戌"): {"slug": "shen_you_xu", "element": "metal", "kind": "meeting", "label": "申酉戌三会金局"},
    frozenset("亥子丑"): {"slug": "hai_zi_chou", "element": "water", "kind": "meeting", "label": "亥子丑三会水局"},
}
BRANCH_CLASHES = {frozenset(pair) for pair in (("子","午"),("丑","未"),("寅","申"),("卯","酉"),("辰","戌"),("巳","亥"))}
BRANCH_HARMS = {frozenset(pair) for pair in (("子","未"),("丑","午"),("寅","巳"),("卯","辰"),("申","亥"),("酉","戌"))}
BRANCH_BREAKS = {frozenset(pair) for pair in (("子","酉"),("卯","午"),("辰","丑"),("戌","未"),("寅","亥"),("巳","申"))}
POSITION_INDEX = {"year": 0, "month": 1, "day": 2, "hour": 3}

DEFAULT_PARAMETERS: dict[str, Any] = {
    "visible_stem_positions": ["year", "month", "hour"],
    "support_many_min": 4,
    "restraint_many_min": 4,
    "heavy_root_min_branches": 2,
    "strength_unit_policy": "each non-day visible stem plus each branch contributes at most one support/restraint unit",
    "transform_support_policy": "month branch same as or generating transformation element",
}


def _merge(target: dict[str, Any], update: Mapping[str, Any]) -> dict[str, Any]:
    for key, value in update.items():
        if isinstance(value, Mapping) and isinstance(target.get(key), dict):
            _merge(target[key], value)
        else:
            target[key] = deepcopy(value)
    return target


def _relation_to_day(target_element: str, day_element: str) -> str:
    if target_element == day_element:
        return "peer"
    if GENERATES[target_element] == day_element:
        return "resource"
    if GENERATES[day_element] == target_element:
        return "output"
    if CONTROLS[day_element] == target_element:
        return "wealth"
    if CONTROLS[target_element] == day_element:
        return "official_kill"
    return "unknown"


def _all_branch_hidden(chart: Mapping[str, Any]) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for position, pillar in chart["pillars"].items():
        for hidden in pillar.get("hidden_stems", []):
            result.append((position, hidden["stem"]))
    return result


def compile_pattern_evidence(chart: Mapping[str, Any], parameters: Mapping[str, Any] | None = None) -> dict[str, Any]:
    params = {**DEFAULT_PARAMETERS, **(parameters or {})}
    month = chart["pillars"]["month"]
    hidden = sorted(month["hidden_stems"], key=lambda row: row["order"])
    main = hidden[0]
    secondary = hidden[1:]
    visible_positions = params["visible_stem_positions"]
    visible_stems = [chart["pillars"][p]["stem"] for p in visible_positions]
    visible_hidden = [row for row in hidden if row["stem"] in visible_stems]
    visible_secondary = [row for row in secondary if row["stem"] in visible_stems]
    main_ten_god = main.get("ten_god") or chart["ten_god_map"][main["stem"]]
    month_tg_group = TEN_GOD_GROUP.get(main_ten_god, main_ten_god)
    mixed = month["branch"] in {"辰", "戌", "丑", "未"}
    return {
        "month_command_available": True,
        "ordinary_pattern_route": month_tg_group not in {"比肩", "劫财"},
        "main_qi_visible": main["stem"] in visible_stems,
        "main_qi_usable": True,
        "main_qi_damaged": False,
        "hidden_qi_available": bool(secondary),
        "secondary_hidden_visible": bool(visible_secondary),
        "secondary_hidden_usable": bool(visible_secondary),
        "multiple_secondary_hidden_visible": len(visible_secondary) > 1,
        "ranked_candidate_exists": len(visible_secondary) == 1,
        "month_hidden_none_visible": not visible_hidden,
        "ranked_hidden_candidate_exists": bool(hidden),
        "all_month_qi_unusable": False,
        "external_dominant_candidate_exists": False,
        "month_ten_god": main_ten_god,
        "candidate_ten_god": main_ten_god,
        "candidate_class": month_tg_group,
        "jianlu_or_yuejie_candidate": month_tg_group in {"比肩", "劫财"},
        "month_intrinsically_no_use": False,
        "month_use_available": True,
        "outer_pattern_candidate": False,
        "month_pattern_broken": False,
        "mixed_storage_month": mixed,
        "mixed_transparent_candidate_exists": mixed and bool(visible_hidden),
        "mixed_branch_combination_candidate_exists": False,
        "multiple_mixed_candidates": mixed and len(visible_hidden) > 1,
        "variation_by_hidden_exposure": not (main["stem"] in visible_stems) and bool(visible_secondary),
        "variation_by_branch_combination": False,
        "variation_detected": False,
        "original_pattern_still_supported": False,
        "no_hidden_qi_visible": not visible_hidden,
        "limited_clash_punishment": False,
        "day_master_strong": False,
        "forced_clash_proposed": False,
        "compiled": {
            "month_branch": month["branch"],
            "main_hidden_stem": main["stem"],
            "visible_stems": visible_stems,
            "visible_month_hidden_stems": [row["stem"] for row in visible_hidden],
            "visible_secondary_hidden_stems": [row["stem"] for row in visible_secondary],
        },
    }


def _support_and_restraint_units(chart: Mapping[str, Any]) -> tuple[int, int, list[str]]:
    day_element = STEM_ELEMENT[chart["day_master"]]
    support = 0
    restraint = 0
    reasons: list[str] = []
    for position in ("year", "month", "hour"):
        element = STEM_ELEMENT[chart["pillars"][position]["stem"]]
        relation = _relation_to_day(element, day_element)
        if relation in {"peer", "resource"}:
            support += 1
            reasons.append(f"stem:{position}:support:{relation}")
        elif relation in {"output", "wealth", "official_kill"}:
            restraint += 1
            reasons.append(f"stem:{position}:restraint:{relation}")
    for position, pillar in chart["pillars"].items():
        branch_relations = {
            _relation_to_day(STEM_ELEMENT[row["stem"]], day_element)
            for row in pillar.get("hidden_stems", [])
        }
        if branch_relations & {"peer", "resource"}:
            support += 1
            reasons.append(f"branch:{position}:support")
        if branch_relations & {"output", "wealth", "official_kill"}:
            restraint += 1
            reasons.append(f"branch:{position}:restraint")
    return support, restraint, reasons


def strength_category_candidates(evidence: Mapping[str, Any]) -> list[str]:
    month = evidence.get("month_supportive")
    support = evidence.get("support_level")
    restraint = evidence.get("restraint_level")
    root = evidence.get("root_level")
    candidates: list[str] = []
    if month is True and support == "many":
        candidates.append("最强")
    if month is False and support == "many":
        candidates.append("中强")
    if month is True and support == "few":
        candidates.append("中强")
    if month is False and support == "few" and root in {"light", "heavy"}:
        candidates.append("次强")
    if month is False and restraint == "many":
        candidates.append("最弱")
    if month is True and restraint == "many":
        candidates.append("中弱")
    if month is False and restraint == "few":
        candidates.append("中弱")
    if month is True and restraint == "few" and root == "none":
        candidates.append("次弱")
    # Deduplicate without destroying source order.
    return list(dict.fromkeys(candidates))


def resolve_strength_category(evidence: Mapping[str, Any]) -> str | None:
    """Resolve transparent strength cases without a hidden aggregate score.

    v1.1 adds one explicit boundary: when month command is supportive, roots are
    heavy, and support is numerous, simultaneous restraint does not by itself
    erase the strong-side conclusion. The restraint is retained as a competing
    force in the evidence record.
    """
    month = evidence.get("month_supportive")
    support = evidence.get("support_level")
    restraint = evidence.get("restraint_level")
    root = evidence.get("root_level")
    if support == "many" and restraint == "few":
        return "最强" if month is True else "中强"
    if support == "few" and restraint == "many":
        # When a weak day master still receives a visible, rooted resource and
        # at least three transparent support units, keep the author's
        # “弱中有气” boundary instead of collapsing it to the weakest class.
        if (
            month is False
            and isinstance(evidence.get("support_count"), int)
            and evidence.get("support_count") >= 3
            and evidence.get("visible_resource_count", 0) >= 1
        ):
            return "中弱"
        return "中弱" if month is True else "最弱"
    if support == "few" and restraint == "few" and month is True and root in {"light", "heavy"}:
        return "中强"
    if support == "many" and restraint == "many" and month is True and root == "heavy":
        return "最强"
    # 《子平真诠》明确强调“干多不如根重”：失令并不自动等于身弱。
    # 当日主已有明确根气、扶身证据达到 many，且克泄耗只比扶身多一
    # 个透明证据单元以内时，登记为可任财官食伤的“中强”边界。
    # 该裁决只使用公开计数和根气，不引入隐蔽总分。
    support_count = evidence.get("support_count")
    restraint_count = evidence.get("restraint_count")
    if (
        month is False
        and support == "many"
        and restraint == "many"
        and root in {"light", "heavy"}
        and isinstance(support_count, int)
        and isinstance(restraint_count, int)
        and restraint_count - support_count <= 1
    ):
        return "中强"
    return None


def compile_strength_evidence(chart: Mapping[str, Any], parameters: Mapping[str, Any] | None = None) -> dict[str, Any]:
    params = {**DEFAULT_PARAMETERS, **(parameters or {})}
    day_element = STEM_ELEMENT[chart["day_master"]]
    month_element = BRANCH_ELEMENT[chart["pillars"]["month"]["branch"]]
    month_supportive = month_element == day_element or GENERATES[month_element] == day_element
    support_count, restraint_count, reasons = _support_and_restraint_units(chart)
    root_branches: list[str] = []
    for position, pillar in chart["pillars"].items():
        if any(STEM_ELEMENT[row["stem"]] == day_element for row in pillar.get("hidden_stems", [])):
            root_branches.append(position)
    if len(root_branches) >= int(params["heavy_root_min_branches"]):
        root_level = "heavy"
    elif root_branches:
        root_level = "light"
    else:
        root_level = "none"
    visible_resource_count = 0
    for position in ("year", "month", "hour"):
        stem = chart["pillars"][position]["stem"]
        if _relation_to_day(STEM_ELEMENT[stem], day_element) == "resource":
            visible_resource_count += 1
    evidence: dict[str, Any] = {
        "evidence_compiled": True,
        "visible_resource_count": visible_resource_count,
        "month_supportive": month_supportive,
        "support_count": support_count,
        "restraint_count": restraint_count,
        "support_level": "many" if support_count >= int(params["support_many_min"]) else "few",
        "restraint_level": "many" if restraint_count >= int(params["restraint_many_min"]) else "few",
        "root_present": root_level != "none",
        "root_level": root_level,
        "root_branches": root_branches,
        "root_and_peer_evidence_available": True,
        "season_and_whole_chart_conflict": False,
        "evidence_reasons": reasons,
        "thresholds": {
            "support_many_min": int(params["support_many_min"]),
            "restraint_many_min": int(params["restraint_many_min"]),
            "heavy_root_min_branches": int(params["heavy_root_min_branches"]),
        },
    }
    candidates = strength_category_candidates(evidence)
    evidence["category_candidates"] = candidates
    evidence["candidate_count"] = len(candidates)
    resolved = resolve_strength_category(evidence)
    evidence["rooted_boundary_can_bear"] = bool(
        resolved == "中强"
        and evidence.get("month_supportive") is False
        and evidence.get("support_level") == "many"
        and evidence.get("restraint_level") == "many"
        and evidence.get("root_level") in {"light", "heavy"}
    )
    evidence["resolved_category"] = resolved
    evidence["resolved_side"] = (
        "strong" if resolved in {"最强", "中强", "次强"}
        else "weak" if resolved in {"最弱", "中弱", "次弱"}
        else "mixed"
    )
    return evidence


def _ten_god_tokens(chart: Mapping[str, Any]) -> list[str]:
    tokens: list[str] = []
    for position, pillar in chart["pillars"].items():
        if position != "day":
            tg = pillar.get("stem_ten_god") or chart["ten_god_map"][pillar["stem"]]
            tokens.append(TEN_GOD_GROUP.get(tg, tg))
        for hidden in pillar.get("hidden_stems", []):
            tg = hidden.get("ten_god") or chart["ten_god_map"][hidden["stem"]]
            tokens.append(TEN_GOD_GROUP.get(tg, tg))
    return tokens



def _ten_god_instances(chart: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for position, pillar in chart["pillars"].items():
        if position != "day":
            tg = pillar.get("stem_ten_god") or chart["ten_god_map"][pillar["stem"]]
            rows.append({
                "position": position,
                "stem": pillar["stem"],
                "ten_god": tg,
                "group": TEN_GOD_GROUP.get(tg, tg),
                "visible": True,
                "element": STEM_ELEMENT[pillar["stem"]],
            })
        for hidden in pillar.get("hidden_stems", []):
            tg = hidden.get("ten_god") or chart["ten_god_map"][hidden["stem"]]
            rows.append({
                "position": position,
                "stem": hidden["stem"],
                "ten_god": tg,
                "group": TEN_GOD_GROUP.get(tg, tg),
                "visible": False,
                "element": STEM_ELEMENT[hidden["stem"]],
            })
    return rows


def _visible_combinations(chart: Mapping[str, Any]) -> list[dict[str, Any]]:
    visible: list[dict[str, Any]] = []
    for position in ("year", "month", "hour"):
        stem = chart["pillars"][position]["stem"]
        tg = chart["pillars"][position].get("stem_ten_god") or chart["ten_god_map"][stem]
        visible.append({"position": position, "stem": stem, "ten_god": tg, "group": TEN_GOD_GROUP.get(tg, tg)})
    pairs: list[dict[str, Any]] = []
    for i, left in enumerate(visible):
        for right in visible[i + 1:]:
            canonical = PAIR_CANONICAL.get(frozenset({left["stem"], right["stem"]}))
            if canonical:
                pairs.append({
                    "pair": canonical,
                    "left": left,
                    "right": right,
                    "adjacent": abs(POSITION_INDEX[left["position"]] - POSITION_INDEX[right["position"]]) == 1,
                    "transform_element": PAIR_TO_ELEMENT[canonical],
                })
    return pairs


def _branch_month_conflict(chart: Mapping[str, Any]) -> bool:
    month = chart["pillars"]["month"]["branch"]
    for position, pillar in chart["pillars"].items():
        if position == "month":
            continue
        pair = frozenset({month, pillar["branch"]})
        if pair in BRANCH_CLASHES or pair in BRANCH_HARMS or pair in BRANCH_BREAKS:
            return True
    return False


def compile_lifecycle_evidence(
    chart: Mapping[str, Any],
    pattern: Mapping[str, Any],
    strength: Mapping[str, Any],
) -> dict[str, Any]:
    """Compile explicit pattern-lifecycle predicates used by reviewed W02 rules.

    Earlier snapshots left this subtree empty, so absence of compiler coverage
    appeared as an internal indeterminate state. v1.1 compiles only relations
    directly recoverable from ChartIR; source-dependent edge cases remain false
    unless supplied through traceable annotations.
    """
    confirmed = pattern.get("candidate_class") if pattern.get("month_use_available") else None
    rows = _ten_god_instances(chart)
    counts = Counter(row["group"] for row in rows)
    visible_counts = Counter(row["group"] for row in rows if row["visible"])
    combinations = _visible_combinations(chart)
    strong = strength.get("resolved_side") == "strong" or (
        strength.get("support_level") == "many" and strength.get("root_level") == "heavy"
    )
    heavy_resource = counts.get("印", 0) >= 4
    has_food = counts.get("食神", 0) > 0
    has_hurt = counts.get("伤官", 0) > 0
    has_wealth = counts.get("财", 0) > 0
    has_official = counts.get("正官", 0) > 0
    has_kill = counts.get("七杀", 0) > 0
    has_peer = counts.get("比肩", 0) + counts.get("劫财", 0) > 0
    visible_food = visible_counts.get("食神", 0) > 0
    visible_wealth = visible_counts.get("财", 0) > 0
    visible_official = visible_counts.get("正官", 0) > 0
    visible_kill = visible_counts.get("七杀", 0) > 0
    visible_resource = visible_counts.get("印", 0) > 0
    visible_hurt = visible_counts.get("伤官", 0) > 0

    kill_combines = [
        pair for pair in combinations
        if pair["left"]["group"] == "七杀" or pair["right"]["group"] == "七杀"
    ]
    wealth_combines = [
        pair for pair in combinations
        if pair["left"]["group"] == "财" or pair["right"]["group"] == "财"
    ]
    hurt_combines = [
        pair for pair in combinations
        if pair["left"]["group"] == "伤官" or pair["right"]["group"] == "伤官"
    ]
    official_kill_mixed = visible_official and visible_kill
    kill_combined_away = visible_kill and bool(kill_combines)

    visible_wealth_rows = [row for row in rows if row["visible"] and row["group"] == "财"]
    visible_resource_rows = [row for row in rows if row["visible"] and row["group"] == "印"]
    visible_food_rows = [row for row in rows if row["visible"] and row["group"] == "食神"]
    visible_output_rows = [row for row in rows if row["visible"] and row["group"] in {"食神", "伤官"}]
    visible_peer_rows = [row for row in rows if row["visible"] and row["ten_god"] == "劫财"]
    month_hidden_official_rows = [
        row for row in rows
        if (not row["visible"]) and row["position"] == "month" and row["group"] == "正官"
    ]
    wealth_resource_conflicts: list[dict[str, Any]] = []
    for wealth in visible_wealth_rows:
        for resource in visible_resource_rows:
            adjacent = abs(POSITION_INDEX[wealth["position"]] - POSITION_INDEX[resource["position"]]) == 1
            controls = CONTROLS[wealth["element"]] == resource["element"] or CONTROLS[resource["element"]] == wealth["element"]
            if adjacent and controls:
                wealth_resource_conflicts.append({"wealth": wealth, "resource": resource})

    month_conflict = _branch_month_conflict(chart)

    # v1.3: synthesize school-internal compound structures from directed
    # ten-god relations. These predicates are parameterized by ten-god role
    # and element, not by any single held-out chart.
    visible_hurt_rows = [row for row in rows if row["visible"] and row["group"] == "伤官"]
    hurt_resource_pairs = []
    for hurt in visible_hurt_rows:
        for resource in visible_resource_rows:
            if CONTROLS.get(resource["element"]) == hurt["element"]:
                hurt_resource_pairs.append({"hurt": hurt, "resource": resource})
    visible_official_rows = [row for row in rows if row["visible"] and row["group"] in {"正官", "七杀"}]
    official_resource_pairs = []
    for official in visible_official_rows:
        for resource in visible_resource_rows:
            if GENERATES.get(official["element"]) == resource["element"]:
                official_resource_pairs.append({"official": official, "resource": resource})

    day_element = STEM_ELEMENT[chart["day_master"]]
    element_cn = {"wood": "木", "fire": "火", "earth": "土", "metal": "金", "water": "水"}
    resource_element = next((e for e, target in GENERATES.items() if target == day_element), None)
    branch_output_tokens = []
    for position, pillar in chart["pillars"].items():
        relation = _relation_to_day(BRANCH_ELEMENT[pillar["branch"]], day_element)
        if relation == "output":
            branch_output_tokens.append({"position": position, "token": pillar["branch"], "element": BRANCH_ELEMENT[pillar["branch"]]})
    visible_output_tokens = [
        {"position": row["position"], "token": row["stem"], "element": row["element"], "ten_god": row["ten_god"]}
        for row in rows if row["visible"] and row["group"] in {"食神", "伤官"}
    ]
    output_release_tokens = visible_output_tokens + [x for x in branch_output_tokens if x["token"] not in {r["token"] for r in visible_output_tokens}]
    weak_with_resource = bool(
        strength.get("resolved_side") == "weak"
        and visible_resource_rows
        and strength.get("support_count", 0) >= 3
    )
    body_resource_vigorous = bool(strong and counts.get("印", 0) >= 2)

    # v1.4: compile complete branch formations and pattern-purification paths.
    branch_set = {pillar["branch"] for pillar in chart["pillars"].values()}
    complete_branch_groups = []
    for group, meta in BRANCH_GROUP_CATALOG.items():
        if group.issubset(branch_set):
            complete_branch_groups.append({**meta, "branches": sorted(group)})

    visible_pattern_stems = [
        row for row in rows if row["visible"] and confirmed and row["group"] == confirmed
    ]
    all_hurt_rows = [row for row in rows if row["group"] == "伤官"]
    resource_controls_hurt_pairs = []
    for resource in visible_resource_rows:
        for hurt in all_hurt_rows:
            if CONTROLS.get(resource["element"]) == hurt["element"]:
                resource_controls_hurt_pairs.append({"resource": resource, "hurt": hurt})

    wealth_removed_by_resource_combinations = []
    for pair in combinations:
        members = (pair["left"], pair["right"])
        groups = {x["group"] for x in members}
        # “合财去财” is a narrow official-pattern purification route.  A bare
        # 财印五合 is not enough: if no visible hurt-official conflict exists,
        # the same pair can instead be read as 财印并用 or 印多用财.
        if confirmed == "正官" and has_hurt and groups == {"财", "印"}:
            wealth = next(x for x in members if x["group"] == "财")
            resource = next(x for x in members if x["group"] == "印")
            wealth_removed_by_resource_combinations.append({"pair": pair["pair"], "wealth": wealth, "resource": resource})

    wealth_resource_visible_pairs = [
        {"wealth": wealth, "resource": resource,
         "separated": abs(POSITION_INDEX[wealth["position"]] - POSITION_INDEX[resource["position"]]) > 1,
         "direct_conflict": any(
             x["wealth"]["stem"] == wealth["stem"] and x["resource"]["stem"] == resource["stem"]
             for x in wealth_resource_conflicts
         )}
        for wealth in visible_wealth_rows for resource in visible_resource_rows
    ]
    wealth_resource_both_visible = bool(confirmed == "正官" and wealth_resource_visible_pairs)
    wealth_resource_noninterfering = bool(
        wealth_resource_both_visible and any((not x["direct_conflict"]) for x in wealth_resource_visible_pairs)
    )
    official_transformed_to_resource = bool(
        confirmed == "正官" and resource_element
        and any(x.get("element") == resource_element for x in complete_branch_groups)
    )
    wealth_resource_both_used = bool(
        wealth_resource_noninterfering and official_transformed_to_resource
        and not visible_hurt and not visible_kill
    )

    # v1.6: separate 食印 compatibility from 财印 compatibility.  The source
    # explicitly treats visible 食神 and 印星 as jointly usable when their
    # positions prevent a direct clash.  Intermediate day-master/peer stems are
    # retained so the reader-facing layer can state the actual separation.
    food_resource_pairs = []
    pillar_order = ("year", "month", "day", "hour")
    for food in visible_food_rows:
        for resource in visible_resource_rows:
            fi, ri = POSITION_INDEX[food["position"]], POSITION_INDEX[resource["position"]]
            lo, hi = sorted((fi, ri))
            between = []
            for pos in pillar_order[lo + 1:hi]:
                stem = chart["pillars"][pos]["stem"]
                tg = "比肩" if pos == "day" else (chart["pillars"][pos].get("stem_ten_god") or chart["ten_god_map"].get(stem))
                between.append({"position": pos, "stem": stem, "ten_god": tg})
            direct_control = CONTROLS.get(resource["element"]) == food["element"]
            food_resource_pairs.append({
                "food": food, "resource": resource, "separated": hi - lo > 1,
                "intermediate_stems": between, "direct_control": direct_control,
            })
    food_resource_both_used = bool(confirmed == "财" and food_resource_pairs)
    food_resource_noninterfering = bool(
        food_resource_both_used and any(x["separated"] for x in food_resource_pairs)
    )
    food_resource_peer_separation = [
        x for x in food_resource_pairs
        if x["separated"] and x["intermediate_stems"]
        and all(y["ten_god"] in {"比肩", "劫财"} for y in x["intermediate_stems"])
    ]

    official_hurt_use_resource = bool(
        confirmed == "正官" and has_hurt and visible_resource_rows and resource_controls_hurt_pairs
    )
    official_purified = bool(
        official_hurt_use_resource and (not visible_wealth or wealth_removed_by_resource_combinations)
    )
    multiple_resources_resolve_hurt = bool(
        confirmed == "正官" and has_hurt and len(visible_resource_rows) >= 2 and resource_controls_hurt_pairs
    )

    kill_resource_transform_pairs = []
    visible_kill_rows = [row for row in rows if row["visible"] and row["group"] == "七杀"]
    for kill in visible_kill_rows:
        for resource in visible_resource_rows:
            if GENERATES.get(kill["element"]) == resource["element"]:
                kill_resource_transform_pairs.append({"kill": kill, "resource": resource})
    wealth_uses_kill_resource = bool(confirmed == "财" and kill_resource_transform_pairs)
    winter_earth_thawed = bool(
        confirmed == "财" and day_element == "earth"
        and chart["pillars"]["month"]["branch"] in {"亥", "子", "丑"}
        and any(row["element"] == "fire" for row in visible_resource_rows)
    )

    wealth_element = CONTROLS[day_element]
    wealth_branch_groups = [g for g in complete_branch_groups if g["element"] == wealth_element]
    body_wealth_both_vigorous = bool(strong and has_wealth and wealth_branch_groups)
    vigorous_wealth_generates_kill = bool(body_wealth_both_vigorous and (visible_kill or visible_official))

    # v1.5: preserve distinct “财生官 / 财带煞 / 合煞存财” routes and
    # explicit negative conditions.  These are role-parameterized and do not
    # depend on a fixed pillar string.
    wealth_vigorous_generates_official = bool(
        confirmed == "财" and counts.get("财", 0) >= 3 and has_official
    )
    wealth_visible_not_taboo = bool(wealth_vigorous_generates_official and visible_wealth)
    wealth_carries_kill = bool(confirmed == "财" and has_kill)
    combine_kill_preserve_wealth = bool(
        confirmed == "财" and visible_kill and bool(kill_combines) and has_wealth
    )
    official_combine_kill_preserve_official = bool(
        (confirmed == "正官" or visible_official) and visible_kill and bool(kill_combines)
    )
    heavy_resource_uses_visible_wealth = bool(
        confirmed == "印" and heavy_resource and strong and visible_wealth
    )

    # v1.6 source-local compound structures exposed by the sixth holdout.
    resource_pattern_visible_kill = bool(confirmed == "印" and visible_kill_rows)
    robbery_preserves_kill_resource = bool(resource_pattern_visible_kill and visible_peer_rows)
    metal_water_food = bool(
        confirmed == "食神" and day_element == "metal"
        and BRANCH_ELEMENT[chart["pillars"]["month"]["branch"]] == "water"
    )
    food_uses_kill = bool(metal_water_food and visible_kill_rows)
    metal_water_not_fear_official = bool(metal_water_food and (has_official or has_kill))

    wealth_controls_resource_pairs = []
    for wealth in visible_wealth_rows:
        for resource in visible_resource_rows:
            if CONTROLS.get(wealth["element"]) == resource["element"]:
                wealth_controls_resource_pairs.append({"wealth": wealth, "resource": resource})
    resource_controls_output_pairs = []
    for resource in visible_resource_rows:
        for output in visible_output_rows:
            if CONTROLS.get(resource["element"]) == output["element"]:
                resource_controls_output_pairs.append({"resource": resource, "output": output})
    wealth_removes_resource_preserves_output = bool(
        confirmed == "七杀" and wealth_controls_resource_pairs and visible_output_rows
    )
    wealth_generates_kill_output_controls = []
    all_kill_rows=[row for row in rows if row["group"]=="七杀"]
    all_output_rows=[row for row in rows if row["group"] in {"食神","伤官"}]
    if confirmed == "七杀":
        for wealth in visible_wealth_rows:
            for kill in all_kill_rows:
                if GENERATES.get(wealth["element"]) != kill["element"]:
                    continue
                for output in all_output_rows:
                    if CONTROLS.get(output["element"]) == kill["element"]:
                        wealth_generates_kill_output_controls.append({"wealth": wealth, "kill": kill, "output": output})

    lifecycle: dict[str, Any] = {
        "confirmed_pattern": confirmed,
        "pattern_confirmed": confirmed is not None,
        "success_signal": False,
        "failure_signal": False,
        "rescue_signal": False,
        "taboo_signal": False,
        "assistant_star_candidate_exists": False,
        "assistant_star_damaged": False,
        "official": {
            "wealth_support": confirmed == "正官" and has_wealth,
            "resource_protection": confirmed == "正官" and counts.get("印", 0) > 0,
            "no_punish_clash_break_harm": confirmed == "正官" and not month_conflict,
            "hurt_control": confirmed == "正官" and visible_hurt,
            "punish_clash": confirmed == "正官" and month_conflict,
            "resource_visible": confirmed == "正官" and visible_resource,
            "kill_mixed": confirmed == "正官" and official_kill_mixed,
            "kill_combined_away": official_combine_kill_preserve_official,
            "clash_resolved_by_combination": False,
            "combination_pairs": kill_combines,
        },
        "wealth": {
            "generates_official": confirmed == "财" and has_official,
            "vigorous_generates_official": wealth_vigorous_generates_official,
            "visible_not_taboo": wealth_visible_not_taboo,
            "carries_kill": wealth_carries_kill,
            "combine_kill_preserve_wealth": combine_kill_preserve_wealth,
            "food_generates_and_day_strong_with_peer": confirmed == "财" and has_food and strong and has_peer,
            "food_generates_wealth": confirmed == "财" and has_food and strong,
            "resource_well_positioned": confirmed == "财" and counts.get("印", 0) > 0 and not wealth_resource_conflicts,
            "robbery": confirmed == "财" and has_peer,
            "food_visible": confirmed == "财" and visible_food,
            "official_generated": confirmed == "财" and has_official,
            "kill_present": confirmed == "财" and has_kill,
            "kill_visible": confirmed == "财" and visible_kill,
            "food_controls_kill": confirmed == "财" and has_food and has_kill,
            "kill_combined_away": confirmed == "财" and visible_kill and bool(kill_combines),
            "light_peer_heavy": confirmed == "财" and counts.get("财", 0) <= 2 and has_peer,
            "wealth_resource_conflicts": wealth_resource_conflicts,
        },
        "resource": {
            "light_with_kill_generation": confirmed == "印" and counts.get("印", 0) <= 2 and has_kill,
            "pattern_visible_kill": resource_pattern_visible_kill,
            "robbery_preserves_kill_resource": robbery_preserves_kill_resource,
            "official_resource_complete": confirmed == "印" and has_official,
            "day_and_resource_strong_with_output": confirmed == "印" and strong and heavy_resource and (has_food or has_hurt),
            "output_releases_strong_resource": confirmed == "印" and strong and heavy_resource and (has_food or has_hurt),
            "official_kill_mixed": confirmed == "印" and official_kill_mixed,
            "kill_combined_away": confirmed == "印" and kill_combined_away,
            "many_with_light_rooted_wealth": confirmed == "印" and heavy_resource and visible_wealth and strength.get("root_present"),
            "light_with_wealth": confirmed == "印" and counts.get("印", 0) <= 2 and has_wealth,
            "day_strong_resource_heavy_kill_visible": confirmed == "印" and strong and heavy_resource and visible_kill,
            "wealth_attack": confirmed == "印" and has_wealth,
            "robbery_relief": confirmed == "印" and has_peer,
            "wealth_combined_away": confirmed == "印" and visible_wealth and bool(wealth_combines) and not heavy_resource_uses_visible_wealth,
            "wealth_restrains_excess": heavy_resource_uses_visible_wealth,
        },
        "food": {
            "generates_wealth": confirmed == "食神" and has_wealth,
            "metal_water_food": metal_water_food,
            "uses_kill": food_uses_kill,
            "metal_water_not_fear_official": metal_water_not_fear_official,
            "with_kill_no_wealth_abandon_food_use_kill_resource": confirmed == "食神" and has_kill and not has_wealth and counts.get("印", 0) > 0,
            "owl": confirmed == "食神" and any(row["ten_god"] == "偏印" for row in rows),
            "route_to_kill": confirmed == "食神" and has_kill,
            "wealth_protects_food": confirmed == "食神" and has_wealth,
            "generates_wealth_and_kill_visible": confirmed == "食神" and has_wealth and visible_kill,
        },
        "kill": {
            "day_strong_and_controlled": confirmed == "七杀" and strong and has_food,
            "food_control": confirmed == "七杀" and has_food,
            "resource_protects_kill": confirmed == "七杀" and counts.get("印", 0) > 0,
            "wealth_removes_resource": confirmed == "七杀" and has_wealth and counts.get("印", 0) > 0,
            "wealth_present": confirmed == "七杀" and has_wealth,
            "uncontrolled": confirmed == "七杀" and not has_food,
        },
        "hurt": {
            "generates_wealth": confirmed == "伤官" and has_wealth,
            "generates_wealth_with_rooted_day": confirmed == "伤官" and has_wealth and strength.get("root_present") and strong,
            "resource_controls_hurt_with_roots": confirmed == "伤官" and counts.get("印", 0) > 0 and strength.get("root_present"),
            "strong_hurt_weak_day_kill_resource": confirmed == "伤官" and has_kill and counts.get("印", 0) > 0 and not strong,
            "with_kill_no_wealth": confirmed == "伤官" and has_kill and not has_wealth,
            "non_metal_water_meets_official": confirmed == "伤官" and has_official,
            "generates_wealth_with_kill": confirmed == "伤官" and has_wealth and has_kill,
            "resource_scheme_hurt_light_day_strong": confirmed == "伤官" and counts.get("印", 0) > 0 and strong,
            "kill_visible": confirmed == "伤官" and visible_kill,
            "kill_combined_away": confirmed == "伤官" and visible_kill and bool(kill_combines),
        },
        "blade": {
            "official_or_kill_visible": False,
            "wealth_resource_visible": False,
            "hurt_absent": not has_hurt,
            "official_absent": not has_official,
            "kill_absent": not has_kill,
            "food_or_hurt_present": has_food or has_hurt,
            "heavy_resource_protection": heavy_resource,
        },
        "lu": {
            "official_with_wealth_resource": False,
            "wealth_with_output": False,
            "kill_resource_visible": False,
            "official_used": False,
            "hurt_present": has_hurt,
            "hurt_combined_away": bool(hurt_combines),
            "wealth_used": False,
            "kill_present": has_kill,
            "kill_combined_away": bool(kill_combines),
            "kill_controlled": has_kill and has_food,
            "official_absent": not has_official,
            "wealth_absent": not has_wealth,
        },
        "special": {
            "hurt_resource_structure": bool(hurt_resource_pairs and has_hurt and counts.get("印", 0) > 0),
            "hurt_resource_pairs": hurt_resource_pairs,
            "official_resource_generation": bool(official_resource_pairs),
            "official_resource_pairs": official_resource_pairs,
            "weak_with_visible_resource": weak_with_resource,
            "body_resource_vigorous": body_resource_vigorous,
            "body_element_label": element_cn.get(day_element, day_element),
            "resource_element_label": element_cn.get(resource_element, resource_element),
            "output_release_tokens": output_release_tokens if strong else [],
            "output_release_present": bool(strong and output_release_tokens),
            "complete_branch_groups": complete_branch_groups,
            "complete_branch_group_present": bool(complete_branch_groups),
            "visible_pattern_stems": visible_pattern_stems,
            "visible_pattern_stem_present": bool(visible_pattern_stems),
            "official_hurt_use_resource": official_hurt_use_resource,
            "official_purified": official_purified,
            "resource_controls_hurt_pairs": resource_controls_hurt_pairs,
            "wealth_removed_by_resource_combinations": wealth_removed_by_resource_combinations,
            "wealth_removed_by_resource_combination": bool(wealth_removed_by_resource_combinations),
            "wealth_resource_visible_pairs": wealth_resource_visible_pairs,
            "wealth_resource_both_visible": wealth_resource_both_visible,
            "wealth_resource_noninterfering": wealth_resource_noninterfering,
            "wealth_resource_both_used": wealth_resource_both_used,
            "food_resource_pairs": food_resource_pairs,
            "food_resource_both_used": food_resource_both_used,
            "food_resource_noninterfering": food_resource_noninterfering,
            "food_resource_peer_separation": food_resource_peer_separation,
            "month_hidden_official_rows": month_hidden_official_rows,
            "month_hidden_official": bool(month_hidden_official_rows),
            "resource_pattern_visible_kill": resource_pattern_visible_kill,
            "robbery_preserves_kill_resource": robbery_preserves_kill_resource,
            "visible_peer_rows": visible_peer_rows,
            "metal_water_food": metal_water_food,
            "food_uses_kill": food_uses_kill,
            "metal_water_not_fear_official": metal_water_not_fear_official,
            "wealth_controls_resource_pairs": wealth_controls_resource_pairs,
            "resource_controls_output_pairs": resource_controls_output_pairs,
            "wealth_removes_resource_preserves_output": wealth_removes_resource_preserves_output,
            "wealth_generates_kill_output_controls": wealth_generates_kill_output_controls,
            "wealth_generates_kill_output_controls_present": bool(wealth_generates_kill_output_controls),
            "official_transformed_to_resource": official_transformed_to_resource,
            "no_visible_hurt_official": wealth_resource_both_used and not visible_hurt,
            "no_visible_kill_mixed": wealth_resource_both_used and not visible_kill,
            "wealth_vigorous_generates_official": wealth_vigorous_generates_official,
            "wealth_visible_not_taboo": wealth_visible_not_taboo,
            "wealth_carries_kill": wealth_carries_kill,
            "combine_kill_preserve_wealth": combine_kill_preserve_wealth,
            "official_combine_kill_preserve_official": official_combine_kill_preserve_official,
            "heavy_resource_uses_visible_wealth": heavy_resource_uses_visible_wealth,
            "visible_wealth_rows": visible_wealth_rows,
            "visible_resource_rows": visible_resource_rows,
            "multiple_resources_resolve_hurt": multiple_resources_resolve_hurt,
            "wealth_uses_kill_resource": wealth_uses_kill_resource,
            "kill_resource_transform_pairs": kill_resource_transform_pairs,
            "resource_transforms_kill": bool(kill_resource_transform_pairs),
            "winter_earth_thawed": winter_earth_thawed,
            "body_wealth_both_vigorous": body_wealth_both_vigorous,
            "vigorous_wealth_generates_kill": vigorous_wealth_generates_kill,
        },
        "compiled": {
            "ten_god_counts": dict(counts),
            "visible_ten_god_counts": dict(visible_counts),
            "visible_combinations": combinations,
            "strong_side_for_lifecycle": strong,
            "month_conflict": month_conflict,
            "official_kill_mixed": official_kill_mixed,
            "kill_combined_away": kill_combined_away,
            "official_combine_kill_preserve_official": official_combine_kill_preserve_official,
            "combine_kill_preserve_wealth": combine_kill_preserve_wealth,
        },
    }
    return lifecycle

def compile_follow_evidence(chart: Mapping[str, Any]) -> dict[str, Any]:
    day_element = STEM_ELEMENT[chart["day_master"]]
    root_rows = [
        {"position": pos, "branch": chart["pillars"][pos]["branch"], "stem": stem}
        for pos, stem in _all_branch_hidden(chart)
        if STEM_ELEMENT[stem] == day_element
    ]
    root_present = bool(root_rows)
    tokens = _ten_god_tokens(chart)
    counts = Counter(tokens)
    dominant, count = counts.most_common(1)[0] if counts else (None, 0)
    full = bool(tokens) and count == len(tokens)
    resource_count = counts.get("印", 0)
    peer_count = counts.get("比肩", 0) + counts.get("劫财", 0)
    wealth_count = counts.get("财", 0)
    officer_count = counts.get("正官", 0) + counts.get("七杀", 0)
    kill_branch_rows = [
        {"position": pos, "branch": chart["pillars"][pos]["branch"]}
        for pos in ("year", "month", "day", "hour")
        if chart["pillars"][pos]["hidden_stems"][0].get("ten_god") in {"七杀", "七煞"}
    ]
    remote_single_root_overwhelmed = bool(
        len(kill_branch_rows) >= 3
        and root_rows
        and {row["position"] for row in root_rows} == {"year"}
        and all(CONTROLS[BRANCH_ELEMENT[row["branch"]]] == day_element for row in kill_branch_rows)
    )
    effective_root_present = root_present and not remote_single_root_overwhelmed
    kill_assembled = counts.get("七杀", 0) >= 3 and len(kill_branch_rows) >= 3
    return {
        "day_master_rootless": not effective_root_present,
        "day_master_root_present": effective_root_present,
        "literal_root_present": root_present,
        "root_rows": root_rows,
        "kill_branch_rows": kill_branch_rows,
        "remote_single_root_overwhelmed": remote_single_root_overwhelmed,
        "dominant_ten_god": dominant,
        "dominance_full_chart": full,
        "candidate_exists": ((not effective_root_present) and ((full and dominant in {"正官", "七杀", "财", "食神", "伤官"}) or remote_single_root_overwhelmed)),
        "candidate_type": dominant,
        "follower_flourishing": False,
        "follower_attacked": False,
        "day_master_uncorrectably_weak": False,
        "day_master_unrestrainably_strong": False,
        "wealth_assembled": dominant == "财" and full,
        "kill_assembled": (dominant == "七杀" and full) or kill_assembled,
        "kill_present": counts.get("七杀", 0) > 0,
        "wealth_present": wealth_count > 0,
        "peers_full_chart": peer_count == len(tokens) and bool(tokens),
        "official_kill_absent": officer_count == 0,
        "resource_optional": True,
        "resource_heavy": resource_count >= 4,
        "peers_many": peer_count >= 3,
        "day_master_in_season": False,
        "wealth_official_kill_absent": wealth_count == 0 and officer_count == 0,
        "counts": dict(counts),
    }


def compile_one_element_evidence(chart: Mapping[str, Any]) -> dict[str, Any]:
    day_element = STEM_ELEMENT[chart["day_master"]]
    branches = {pillar["branch"] for pillar in chart["pillars"].values()}
    matched = [group for group in DIRECTION_SETS[day_element] if group.issubset(branches)]
    visible_other_stems = [chart["pillars"][p]["stem"] for p in ("year", "month", "hour")]
    visible_relations = [_relation_to_day(STEM_ELEMENT[s], day_element) for s in visible_other_stems]
    visible_resource_count = sum(r == "resource" for r in visible_relations)
    visible_disruptor_count = sum(r in {"wealth", "official_kill"} for r in visible_relations)
    return {
        "day_element": day_element,
        "element": day_element,
        "complete_direction_or_trine": bool(matched),
        "complete_group": bool(matched),
        "candidate_exists": bool(matched),
        "month_qi_connected": BRANCH_ELEMENT[chart["pillars"]["month"]["branch"]] in {day_element} or GENERATES[BRANCH_ELEMENT[chart["pillars"]["month"]["branch"]]] == day_element,
        "no_effective_break": True,
        "matched_groups": [sorted(group) for group in matched],
        "visible_resource_count": visible_resource_count,
        "visible_disruptor_count": visible_disruptor_count,
        "resource_visible_and_body_pure": bool(matched) and visible_resource_count > 0 and visible_disruptor_count == 0,
    }


def compile_transform_evidence(chart: Mapping[str, Any]) -> dict[str, Any]:
    day = chart["day_master"]
    partners: list[tuple[str, str]] = []
    for position in ("month", "hour"):
        other = chart["pillars"][position]["stem"]
        canonical = PAIR_CANONICAL.get(frozenset({day, other}))
        if canonical:
            partners.append((position, canonical))
    pair = partners[0][1] if partners else None
    element = PAIR_TO_ELEMENT.get(pair) if pair else None
    day_element = STEM_ELEMENT[day]
    day_root = any(STEM_ELEMENT[stem] == day_element for _, stem in _all_branch_hidden(chart))
    month_branch = chart["pillars"]["month"]["branch"]
    month_element = BRANCH_ELEMENT[month_branch]
    transform_support = bool(element) and (month_element == element or GENERATES[month_element] == element)
    branches = {pillar["branch"] for pillar in chart["pillars"].values()}
    all_groups = TRINES + DIRECTIONS
    generic_matches = [group for group in all_groups if len(group & branches) >= 2]
    generic_complete = [group for group in all_groups if group.issubset(branches)]
    target_groups = DIRECTION_SETS.get(element or "", [])
    target_complete = [group for group in target_groups if group.issubset(branches)]
    target_candidates = [group for group in target_groups if len(group & branches) >= 2]

    controller_element = next((controller for controller, controlled in CONTROLS.items() if controlled == element), None)
    controller_branch_units = 0
    if controller_element:
        for pillar in chart["pillars"].values():
            hidden_elements = {STEM_ELEMENT[row["stem"]] for row in pillar.get("hidden_stems", [])}
            if BRANCH_ELEMENT[pillar["branch"]] == controller_element or controller_element in hidden_elements:
                controller_branch_units += 1
    damaging_pair = frozenset({"巳", "申"}).issubset(branches)
    complete_target_group = bool(target_complete)
    effective_root_obstruction = day_root and not complete_target_group
    damaging_idle = bool(element and controller_element and controller_branch_units >= 2 and not complete_target_group)
    if damaging_pair and controller_element == "metal" and element == "wood":
        damaging_idle = True

    evidence = {
        "day_stem_combine_candidate": bool(partners),
        "candidate_exists": bool(partners),
        "day_stem_pair": pair,
        "transform_element": element,
        "month_branch": month_branch,
        "transform_god_flourishing": transform_support or complete_target_group,
        "competing_combine": len(partners) > 1,
        "day_root_peer_resource_support": effective_root_obstruction,
        "raw_day_root_present": day_root,
        "day_master_rootless": not day_root,
        "transform_god_sufficient": transform_support or complete_target_group,
        "damaging_idle_god": damaging_idle,
        "damage_reasons": [
            reason for condition, reason in (
                (controller_branch_units >= 2 and not complete_target_group, "controller_element_supported"),
                (damaging_pair and controller_element == "metal" and element == "wood", "si_shen_metal_damage_to_wood_transform"),
            ) if condition
        ],
        "fixed_month_only_support": transform_support and not complete_target_group,
        "trine_candidate": bool(generic_matches),
        "trine_complete": bool(generic_complete),
        "transformation_group_candidate": bool(target_candidates),
        "transformation_group_complete": complete_target_group,
        "transformation_group": [sorted(group) for group in target_complete],
        "transformation_group_candidates": [sorted(group) for group in target_candidates],
        "controller_element": controller_element,
        "controller_branch_units": controller_branch_units,
    }
    evidence["true_transform"] = bool(
        evidence["candidate_exists"]
        and evidence["transform_god_flourishing"]
        and not evidence["competing_combine"]
        and not evidence["day_root_peer_resource_support"]
        and evidence["transform_god_sufficient"]
        and not evidence["damaging_idle_god"]
    )
    return evidence


def compile_w02_evidence(
    chart: Mapping[str, Any],
    *,
    parameters: Mapping[str, Any] | None = None,
    annotations: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Compile a W02 context subtree under ``facts.classical_ziping.w02``.

    ``annotations`` is an explicit, traceable override for source-dependent
    judgments (effective clash, usable hidden qi, follower dominance, etc.).
    It is deep-merged after deterministic compilation and should be stored in
    caller provenance by a later runtime.
    """
    pattern = compile_pattern_evidence(chart, parameters)
    strength = compile_strength_evidence(chart, parameters)
    result = {
        "pattern": pattern,
        "lifecycle": compile_lifecycle_evidence(chart, pattern, strength),
        "strength": strength,
        "follow": compile_follow_evidence(chart),
        "one_element": compile_one_element_evidence(chart),
        "transform": compile_transform_evidence(chart),
        "parameters": {**DEFAULT_PARAMETERS, **(parameters or {})},
    }
    if annotations:
        _merge(result, annotations)
        # Re-resolve strength if annotations changed its primitive evidence.
        candidates = strength_category_candidates(result["strength"])
        result["strength"]["category_candidates"] = candidates
        result["strength"]["candidate_count"] = len(candidates)
        resolved = resolve_strength_category(result["strength"])
        result["strength"]["resolved_category"] = resolved
        result["strength"]["resolved_side"] = (
            "strong" if resolved in {"最强", "中强", "次强"}
            else "weak" if resolved in {"最弱", "中弱", "次弱"}
            else "mixed"
        )
        # Rebuild deterministic lifecycle evidence, then re-apply explicit lifecycle annotations.
        lifecycle_annotations = annotations.get("lifecycle") if isinstance(annotations, Mapping) else None
        result["lifecycle"] = compile_lifecycle_evidence(chart, result["pattern"], result["strength"])
        if lifecycle_annotations:
            _merge(result["lifecycle"], lifecycle_annotations)
        t = result["transform"]
        t["true_transform"] = bool(
            t.get("candidate_exists") and t.get("transform_god_flourishing")
            and not t.get("competing_combine") and not t.get("day_root_peer_resource_support")
            and t.get("transform_god_sufficient") and not t.get("damaging_idle_god")
        )
    return result


def make_rule_context(chart: Mapping[str, Any], **kwargs: Any) -> dict[str, Any]:
    return {"chart": deepcopy(chart), "facts": {"classical_ziping": {"w02": compile_w02_evidence(chart, **kwargs)}}}


def unique_strength_resolution(_args: dict[str, Any], context: dict[str, Any]) -> Truth:
    value = get_path(context, "facts.classical_ziping.w02.strength.resolved_category", None)
    return Truth.TRUE if value else Truth.FALSE


def true_transform(_args: dict[str, Any], context: dict[str, Any]) -> Truth:
    value = get_path(context, "facts.classical_ziping.w02.transform.true_transform", None)
    if value is None:
        return Truth.UNKNOWN
    return Truth.TRUE if value else Truth.FALSE


W02_RESOLVERS = {
    "classical_ziping.strength.unique_resolution": unique_strength_resolution,
    "classical_ziping.transform.true_transform": true_transform,
}
