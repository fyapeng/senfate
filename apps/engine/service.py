from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "vendor" / "bazi-rules-v1.8.0"
sys.path.insert(0, str(VENDOR))
from engine.orchestrator_w08 import analyze_chart  # noqa: E402

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
ELEMENT = {"甲":"wood","乙":"wood","丙":"fire","丁":"fire","戊":"earth","己":"earth","庚":"metal","辛":"metal","壬":"water","癸":"water"}
ELEMENT_ZH = {"wood":"木","fire":"火","earth":"土","metal":"金","water":"水"}
BRANCH_ELEMENT = {"子":"water","丑":"earth","寅":"wood","卯":"wood","辰":"earth","巳":"fire","午":"fire","未":"earth","申":"metal","酉":"metal","戌":"earth","亥":"water"}
YANG = set("甲丙戊庚壬")
HIDDEN = {"子":"癸","丑":"己癸辛","寅":"甲丙戊","卯":"乙","辰":"戊乙癸","巳":"丙庚戊","午":"丁己","未":"己丁乙","申":"庚壬戊","酉":"辛","戌":"戊辛丁","亥":"壬甲"}
GENERATES = {"wood":"fire","fire":"earth","earth":"metal","metal":"water","water":"wood"}
CONTROLS = {"wood":"earth","fire":"metal","earth":"water","metal":"wood","water":"fire"}
SCHOOL_LABELS = {"classical_ziping":"传统子平", "shao_weihua":"邵伟华体系", "li_hanchen":"李涵辰体系", "duan_li_xiang":"段氏理象体系"}
NAYIN = ("海中金","炉中火","大林木","路旁土","剑锋金","山头火","涧下水","城头土","白蜡金","杨柳木","泉中水","屋上土","霹雳火","松柏木","长流水","砂中金","山下火","平地木","壁上土","金箔金","覆灯火","天河水","大驿土","钗钏金","桑柘木","大溪水","沙中土","天上火","石榴木","大海水")
CHANGSHENG_BASE = {"甲":"亥","乙":"午","丙":"寅","丁":"酉","戊":"寅","己":"酉","庚":"巳","辛":"子","壬":"申","癸":"卯"}
CHANGSHENG_STAGES = ("长生","沐浴","冠带","临官","帝旺","衰","病","死","墓","绝","胎","养")
MONTH_START_STEM = {"甲":"丙","己":"丙","乙":"戊","庚":"戊","丙":"庚","辛":"庚","丁":"壬","壬":"壬","戊":"甲","癸":"甲"}
SUPPORTING_GODS = {"比肩", "劫财", "正印", "偏印"}
SIX_HARMONIES = {frozenset(pair) for pair in ("子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未")}
CLASHES = {frozenset(pair) for pair in ("子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥")}
STEM_COMBINATIONS = {frozenset(pair) for pair in ("甲己", "乙庚", "丙辛", "丁壬", "戊癸")}
GROWTH_WEIGHT = {"长生": .32, "沐浴": .05, "冠带": .22, "临官": .42, "帝旺": .58, "衰": -.08, "病": -.26, "死": -.42, "墓": -.20, "绝": -.55, "胎": -.12, "养": .03}

def ten_god(day: str, target: str) -> str:
    same = (day in YANG) == (target in YANG)
    own, other = ELEMENT[day], ELEMENT[target]
    if own == other: return "比肩" if same else "劫财"
    if GENERATES[own] == other: return "食神" if same else "伤官"
    if CONTROLS[own] == other: return "偏财" if same else "正财"
    if GENERATES[other] == own: return "偏印" if same else "正印"
    return "七杀" if same else "正官"

def sexagenary_index(token: str) -> int:
    for index in range(60):
        if STEMS[index % 10] + BRANCHES[index % 12] == token: return index
    raise ValueError(f"无效干支：{token}")

def nayin(token: str) -> dict[str, str]:
    name = NAYIN[sexagenary_index(token) // 2]
    element = {"金":"metal","木":"wood","水":"water","火":"fire","土":"earth"}[name[-1]]
    return {"name": name, "element": element, "element_zh": ELEMENT_ZH[element]}

def changsheng(day: str, branch: str) -> str:
    origin = BRANCHES.index(CHANGSHENG_BASE[day])
    delta = (BRANCHES.index(branch) - origin) % 12
    if day not in YANG: delta = (-delta) % 12
    return CHANGSHENG_STAGES[delta]

def pillar(token: str, day: str) -> dict[str, Any]:
    if len(token) != 2 or token[0] not in STEMS or token[1] not in BRANCHES: raise ValueError(f"无效柱：{token}")
    stems = HIDDEN[token[1]]
    roles = ("main", "middle", "residual")
    return {"stem": token[0], "branch": token[1], "stem_ten_god": ten_god(day, token[0]), "stem_element": ELEMENT[token[0]], "stem_element_zh": ELEMENT_ZH[ELEMENT[token[0]]], "branch_element": BRANCH_ELEMENT[token[1]], "branch_element_zh": ELEMENT_ZH[BRANCH_ELEMENT[token[1]]], "nayin": nayin(token), "twelve_growth_stage": changsheng(day, token[1]), "hidden_stems": [{"stem": stem, "role": roles[index], "order": index + 1, "ten_god": ten_god(day, stem), "element": ELEMENT[stem], "element_zh": ELEMENT_ZH[ELEMENT[stem]]} for index, stem in enumerate(stems)]}

def annual_pillar(year: int) -> str:
    index = (year - 1984) % 60
    return STEMS[index % 10] + BRANCHES[index % 12]

def monthly_pillar(year: int, ordinal: int) -> str:
    """Return the 12 solar-month pillars, where ordinal 0 is 寅月 after 立春."""
    annual = annual_pillar(year)
    start = STEMS.index(MONTH_START_STEM[annual[0]])
    return STEMS[(start + ordinal) % 10] + BRANCHES[(2 + ordinal) % 12]

def advance(token: str, steps: int) -> str:
    return STEMS[(STEMS.index(token[0]) + steps) % 10] + BRANCHES[(BRANCHES.index(token[1]) + steps) % 12]

def chart_from_manual(payload: dict[str, Any]) -> dict[str, Any]:
    raw = payload.get("pillars", "甲子 丙寅 戊辰 庚申").replace("　", " ").split()
    if len(raw) != 4: raise ValueError("请输入年、月、日、时四柱，以空格分隔。")
    day = raw[2][0]
    names = ("year", "month", "day", "hour")
    start = int(payload.get("luckStartYear", 2020)); first_luck = payload.get("firstLuck", "辛酉")
    lucks = []
    for order in range(10):
        token = advance(first_luck, order)
        row = pillar(token, day)
        lucks.append({"luck_cycle_id": f"luck.{order + 1:02d}", "order": order + 1, "stem": token[0], "branch": token[1], "start_year": start + order * 10, "end_year": start + order * 10 + 9, "stem_ten_god": row["stem_ten_god"], "hidden_stems": row["hidden_stems"]})
    start_year = int(payload.get("startYear", start)); end_year = int(payload.get("endYear", start + 11))
    if end_year < start_year or end_year - start_year > 24: raise ValueError("K 线一次最多分析 25 年。")
    annuals = []
    for year in range(start_year, end_year + 1):
        token = annual_pillar(year)
        annuals.append({"annual_id": f"annual.{year}", "year": year, "stem": token[0], "branch": token[1], "stem_ten_god": ten_god(day, token[0])})
    return {"schema_version": "1.0.0", "chart_id": "senfate.user.chart", "pillars": dict(zip(names, (pillar(value, day) for value in raw))), "day_master": day, "ten_god_map": {stem: ten_god(day, stem) for stem in STEMS}, "luck_cycles": lucks, "annual_contexts": annuals, "traditional_context": {"sex_parameter": payload.get("sex", "unspecified"), "direction_parameter": "not_supplied", "note": "由 SenFate 四派工作台生成；仅作传统规则分析。"}, "provenance": {"input_boundary": "post_charting", "provider": "senfate-four-schools", "generated_at": "local", "notes": []}}

def chart_from_certified(payload: dict[str, Any]) -> dict[str, Any]:
    certified = payload.get("compiledChart")
    if not isinstance(certified, dict): raise ValueError("认证排盘结果缺失。请先调用 /api/chart/compile。")
    calendar = certified.get("calendar", certified)
    birth = certified.get("zonedBirth", {}).get("civilBirth", {})
    source_pillars = calendar.get("pillars", {})
    names = ("year", "month", "day", "hour")
    tokens = []
    for name in names:
        source = source_pillars.get(name, {})
        token = f"{source.get('stem', '')}{source.get('branch', '')}"
        if len(token) != 2: raise ValueError(f"认证排盘缺少{name}柱。")
        tokens.append(token)
    day = tokens[2][0]
    lucks = []
    for source in calendar.get("majorLuck", []):
        token = f"{source.get('pillar', {}).get('stem', '')}{source.get('pillar', {}).get('branch', '')}"
        if len(token) != 2: continue
        start_year = datetime.fromtimestamp(float(source["startUtcMs"]) / 1000, UTC).year
        row = pillar(token, day)
        lucks.append({"luck_cycle_id": f"luck.{int(source['ordinal']):02d}", "order": int(source["ordinal"]), "stem": token[0], "branch": token[1], "start_year": start_year, "end_year": start_year + 9, "stem_ten_god": row["stem_ten_god"], "hidden_stems": row["hidden_stems"], "start_utc_ms": source["startUtcMs"], "start_age_years": source["startAgeYears"]})
    if not lucks: raise ValueError("认证排盘没有可用的大运。")
    start_year = int(payload.get("startYear", lucks[0]["start_year"]))
    end_year = int(payload.get("endYear", start_year + 11))
    if end_year < start_year or end_year - start_year > 24: raise ValueError("K 线一次最多分析 25 年。")
    annuals = []
    for year in range(start_year, end_year + 1):
        token = annual_pillar(year)
        annuals.append({"annual_id": f"annual.{year}", "year": year, "stem": token[0], "branch": token[1], "stem_ten_god": ten_god(day, token[0])})
    return {"schema_version": "1.0.0", "chart_id": "senfate.certified.chart", "pillars": dict(zip(names, (pillar(value, day) for value in tokens))), "day_master": day, "ten_god_map": {stem: ten_god(day, stem) for stem in STEMS}, "luck_cycles": lucks, "annual_contexts": annuals, "traditional_context": {"sex_parameter": payload.get("sex", "unspecified"), "direction_parameter": calendar.get("direction", "certified"), "note": "大运由认证排盘生成；年度分段按公历年显示。"}, "provenance": {"input_boundary": "certified-calendar", "provider": "senfate-chart-compile.v1", "generated_at": "local", "notes": [f"出生地时区：{certified.get('zonedBirth', {}).get('timeZone', 'unknown')}", "大运实际起点保留为 UTC 时间戳；K 线按公历年度聚合。"], "birth": birth}}

def chart_from(payload: dict[str, Any]) -> dict[str, Any]:
    return chart_from_certified(payload) if isinstance(payload.get("compiledChart"), dict) else chart_from_manual(payload)

def score(themes: list[dict[str, Any]]) -> dict[str, float]:
    values = {"supportive": 1.0, "mixed": 0.0, "descriptive": 0.0, "cautionary": -1.0, "restrictive": -1.0}
    series = [values.get(row.get("stance"), 0.0) for row in themes]
    return {"close": round(sum(series) / len(series), 3) if series else 0.0, "high": max(series, default=0.0), "low": min(series, default=0.0)}

def public_theme_signals(themes: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Keep the annual UI payload small while retaining each school's published theme stance."""
    return [{"topic": row.get("topic", ""), "stance": row.get("stance", "descriptive"), "headline": row.get("headline", "")} for row in themes]

def display_index(index: float) -> float:
    """Map internal support/pressure coordinates (-100..100) to the public 0..100 scale."""
    return round((index + 100) / 2, 2)

def display_candle(candle: dict[str, Any]) -> dict[str, Any]:
    visible = {**candle}
    for key in ("open", "high", "low", "close", "monthOpen"):
        visible[key] = display_index(candle[key])
    visible["monthlySamples"] = [{**sample, "index": display_index(sample["index"])} for sample in candle["monthlySamples"]]
    return visible

def layer_coordinate(chart: dict[str, Any], luck: dict[str, Any], annual: dict[str, Any], month_token: str) -> float:
    """Compose 原局、大运、流年、流月 as support/pressure odds, not an additive score.

    The annual rule result is deliberately not inserted here. It is composed later in
    log-odds space, so no layer can be treated as a raw score that is simply added.
    """
    day = chart["day_master"]
    supports, pressure = 0.5, 0.5
    month = pillar(month_token, day)
    base_layers = list(chart["pillars"].values()) + [luck, annual]
    layers = base_layers + [month]
    for item in layers:
        gods = [item.get("stem_ten_god", ten_god(day, item["stem"]))]
        gods.extend(hidden.get("ten_god", ten_god(day, hidden["stem"])) for hidden in item.get("hidden_stems", []))
        for god in gods:
            if god in SUPPORTING_GODS: supports += 1
            else: pressure += 1
    # The monthly layer must not collapse to just a ten-god category.  Relations
    # are folded into the same support/pressure odds used above, rather than
    # appended as a separate score.  This preserves the stated non-additive model.
    month_supportive = month["stem_ten_god"] in SUPPORTING_GODS
    for base in base_layers:
        branch_pair = frozenset((month["branch"], base["branch"]))
        if branch_pair in CLASHES:
            pressure += .72
        elif branch_pair in SIX_HARMONIES:
            if month_supportive: supports += .36
            else: pressure += .36
        elif month["branch"] == base["branch"]:
            if month_supportive: supports += .18
            else: pressure += .18
        if frozenset((month["stem"], base["stem"])) in STEM_COMBINATIONS:
            if month_supportive: supports += .22
            else: pressure += .22
    seasonal = GROWTH_WEIGHT[month["twelve_growth_stage"]]
    if seasonal >= 0: supports += seasonal
    else: pressure += -seasonal
    import math
    return max(-0.98, min(0.98, math.tanh(math.log(supports / pressure))))

def compose_month_index(annual_anchor: float, monthly_layer: float) -> float:
    """Fisher-space composition keeps annual rules as anchor and flow-month as range."""
    import math
    bounded_anchor = max(-0.98, min(0.98, annual_anchor))
    bounded_month = max(-0.98, min(0.98, monthly_layer))
    return math.tanh(0.68 * math.atanh(bounded_anchor) + 0.32 * math.atanh(bounded_month))

def monthly_candle(chart: dict[str, Any], luck: dict[str, Any], annual: dict[str, Any], annual_anchor: float, previous_close: float | None = None) -> dict[str, Any]:
    values = []
    for ordinal in range(12):
        token = monthly_pillar(annual["year"], ordinal)
        index = round(compose_month_index(annual_anchor, layer_coordinate(chart, luck, annual, token)) * 100, 2)
        values.append({"ordinal": ordinal + 1, "pillar": token, "index": index})
    month_open, month_close = values[0]["index"], values[-1]["index"]
    # A yearly candle follows the market-chart convention: its open is the prior
    # period's close, its close is the current period's final observation, and its
    # wick spans all observations reached during this year.
    annual_open = month_open if previous_close is None else previous_close
    return {"open": annual_open, "high": max(annual_open, *(row["index"] for row in values)), "low": min(annual_open, *(row["index"] for row in values)), "close": month_close, "monthOpen": month_open, "monthlySamples": values}

def run(payload: dict[str, Any]) -> dict[str, Any]:
    chart = chart_from(payload)
    selected = payload.get("school", "all")
    target_year = int(payload.get("targetYear", chart["annual_contexts"][-1]["year"]))
    display_lucks = chart["luck_cycles"][:8]
    selected_luck = next((row for row in display_lucks if row["start_year"] <= target_year <= row["end_year"]), None)
    if not selected_luck: raise ValueError("选择年份未落在已认证的大运范围内。")
    # A single local analysis run materializes all eight luck cycles.  Browsing a
    # year/range in the client thereafter is a pure in-memory operation.
    chart["annual_contexts"] = [{"annual_id": f"annual.{year}", "year": year, "stem": annual_pillar(year)[0], "branch": annual_pillar(year)[1], "stem_ten_god": ten_god(chart["day_master"], annual_pillar(year)[0])} for luck in display_lucks for year in range(luck["start_year"], luck["end_year"] + 1)]
    current = analyze_chart(chart, stage="annual", annual_id=f"annual.{target_year}", include_comparison=False)
    schools = [row for row in current["public_output"]["schools"] if selected == "all" or row["school"] == SCHOOL_LABELS.get(selected)]
    trajectory = {key: [] for key in SCHOOL_LABELS}
    previous_closes: dict[str, float] = {}
    for annual in chart["annual_contexts"]:
        result = analyze_chart(chart, stage="annual", annual_id=annual["annual_id"], include_comparison=False, include_state_chain=False)
        annual_luck = next(row for row in display_lucks if row["start_year"] <= annual["year"] <= row["end_year"])
        for profile in result["profile_runs"]:
            key = profile["school_id"]
            anchor = score(profile["themes"])["close"]
            previous_close = previous_closes.get(key)
            candle = monthly_candle(chart, annual_luck, annual, anchor, previous_close)
            previous_closes[key] = candle["close"]
            trajectory[key].append({"year": annual["year"], "luckCycleId": annual_luck["luck_cycle_id"], "annualRuleAnchor": display_index(anchor * 100), "themeSignals": public_theme_signals(profile["themes"]), **display_candle(candle)})
    luck_trajectory = {key: [] for key in SCHOOL_LABELS}
    for luck in display_lucks:
        result = analyze_chart(chart, stage="luck", luck_cycle_id=luck["luck_cycle_id"], include_comparison=False, include_state_chain=False)
        for profile in result["profile_runs"]:
            luck_trajectory[profile["school_id"]].append({"luckCycleId": luck["luck_cycle_id"], "order": luck["order"], "stem": luck["stem"], "branch": luck["branch"], "startYear": luck["start_year"], "endYear": luck["end_year"], "index": display_index(score(profile["themes"])["close"] * 100)})
    audit = [{"schoolId": row["school_id"], "ruleCount": row["rule_count"], "evaluationCounts": row["evaluation_counts"], "warnings": row["warnings"], "trace": row["trace"], "stateChain": row["state_chain_summary"]} for row in current["profile_runs"]]
    return {"schema": "senfate-four-schools.v1", "analysisId": current["analysis_id"], "chart": {"pillars": chart["pillars"], "luckCycles": display_lucks, "annualContexts": chart["annual_contexts"], "activeLuck": selected_luck, "provenance": chart["provenance"]}, "selectedYear": target_year, "schools": schools, "trajectory": trajectory, "luckTrajectory": luck_trajectory, "audit": audit, "labels": SCHOOL_LABELS, "calculationMethod": {"annual": "四派规则在原局→所属大运→流年链上独立运行；首次运行一次性生成前八步大运的全部流年。", "monthlyCandle": "年度 K 线沿用市场图的 OHLC 语义：开盘取上年年末结构指数（首年取寅月），收盘取当年丑月，影线覆盖十二流月高低范围。内部支持/压力坐标经 Fisher 合成后，统一映射为 0—100 的公开结构指数；不是各层分数直接相加。", "unit": "0—100 结构指数：50 为中性映射点，非概率、收益或现实事件评分。"}, "scope": "红色表示本年收盘高于开盘，绿色表示本年收盘低于开盘；K线表示各派规则与流月层级组合生成的 0—100 年度结构指数，缩放、拖动和查看浮窗均在浏览器本地完成，不表示现实概率或投资建议。"}

if __name__ == "__main__":
    try: print(json.dumps(run(json.load(sys.stdin)), ensure_ascii=False))
    except Exception as error: print(json.dumps({"error": str(error)}, ensure_ascii=False)); sys.exit(1)
