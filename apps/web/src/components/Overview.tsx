import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Clock, MapPin, ShieldCheck } from "@phosphor-icons/react";
import "../styles/workbench-overrides.css";

const labels: Record<string, string> = {
  classical_ziping: "传统子平",
  shao_weihua: "邵伟华体系",
  li_hanchen: "李涵辰体系",
  duan_li_xiang: "段氏理象体系",
};
const schoolDisplayLabels: Record<string, string> = {
  classical_ziping: "子平格局体系",
  shao_weihua: "现代综合体系",
  li_hanchen: "干支作用体系",
  duan_li_xiang: "理象做功体系",
};
const schoolOrigins: Record<string, string> = {
  classical_ziping: "传统子平经典",
  shao_weihua: "邵伟华",
  li_hanchen: "李涵辰",
  duan_li_xiang: "段氏理象",
};
const pillarLabels: Record<string, string> = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" };
const elementByStem: Record<string, string> = { 甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth", 己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water" };
const elementLabels: Record<string, string> = { metal: "金", wood: "木", water: "水", fire: "火", earth: "土" };
const themeMeta = [
  { topic: "career", label: "事业", tone: "career" },
  { topic: "wealth", label: "财运", tone: "wealth" },
  { topic: "relationships", label: "关系", tone: "relationship" },
  { topic: "health", label: "平衡", tone: "health" },
];
const sentence = (value?: string) => value?.split("。").find(Boolean) || "未产生可公开的判断。";
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const beforeClimate = (value?: string) => (value || "").split(/调候次序|调候信息/)[0].trim().replace(/[。；\s]+$/, "");
const verdictLead = (value?: string) => (value || "未形成终局裁决").split("；")[0].replace("，", " · ");

export default function Overview() {
  const [analysis, setAnalysis] = useState<any>();
  const [compiled, setCompiled] = useState<any>();
  const [school, setSchool] = useState("classical_ziping");
  const [year, setYear] = useState<number>();
  const [hoveredCandle, setHoveredCandle] = useState<any>();

  useEffect(() => {
    try {
      setAnalysis(JSON.parse(sessionStorage.getItem("senfate.analysis") || "null"));
      setCompiled(JSON.parse(sessionStorage.getItem("senfate.compile") || "null"));
    } catch { /* session storage is intentionally optional */ }
  }, []);

  const line = analysis?.trajectory?.[school] || [];
  const selected = year ?? analysis?.selectedYear;
  const annual = analysis?.chart?.annualContexts?.find((item: any) => item.year === selected);
  const luck = analysis?.chart?.luckCycles?.find((item: any) => selected >= item.start_year && selected <= item.end_year);
  const result = useMemo(() => analysis?.schools?.find((item: any) => item.school === labels[school]), [analysis, school]);
  const selectedCandle = line.find((item: any) => item.year === selected);
  const natalPillars = analysis?.chart?.pillars || {};
  const climate = result?.verdict?.primary_use?.match(/调候[^。]+/)?.[0];
  const lucks = analysis?.chart?.luckCycles?.slice(0, 8) || [];

  function select(target: number) {
    setYear(target);
  }

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("year");
    if (value === null) return;
    const target = Number(value);
    if (!Number.isInteger(target) || !analysis || !compiled || target === analysis.selectedYear) return;
    select(target);
  }, [analysis, compiled]);

  if (!analysis || !compiled) {
    return <main className="empty-state"><p className="eyebrow">SenFate / 四派工作台</p><h1 className="page-title">从认证排盘开始</h1><p className="page-summary">完成认证排盘后，系统才会生成真实的四派年度图表与审计轨迹。</p><a className="button" href={`${import.meta.env.BASE_URL}calculation/`}>新建排盘 <ArrowRight size={17} /></a></main>;
  }

  const calendar = compiled.result.calendar;
  const birth = compiled.result.zonedBirth.civilBirth;
  const city = compiled.city || "上海市";
  const elementCounts = Object.values(natalPillars).reduce((counts: Record<string, number>, pillar: any) => { const stemElement = pillar.stem_element || elementByStem[pillar.stem]; counts[stemElement] += 1; (pillar.hidden_stems || []).forEach((hidden: any) => { counts[hidden.element || elementByStem[hidden.stem]] += 1; }); return counts; }, { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 });
  const elementTotal = Math.max(1, Object.values(elementCounts).reduce((sum, count) => sum + count, 0));
  const elementStats = ["metal", "water", "wood", "fire", "earth"].map(element => ({ element, label: elementLabels[element], percent: Math.round(elementCounts[element] / elementTotal * 100) }));
  const annualThemeSignals = selectedCandle?.themeSignals || result?.themes || [];
  const annualGod = annual?.stem_ten_god || "";
  const annualBase = selectedCandle?.close ?? 50;
  const themeScores = themeMeta.map(meta => {
    const theme = annualThemeSignals.find((item: any) => item.topic === meta.topic);
    const stance = theme?.stance || theme?.assessment || "descriptive";
    const stanceAdjust: Record<string, number> = { supportive: 8, mixed: 0, descriptive: 0, cautionary: -7, restrictive: -10 };
    const godBias = meta.topic === "career" ? (/(正官|七杀)/.test(annualGod) ? 5 : /(食神|伤官)/.test(annualGod) ? -4 : 0)
      : meta.topic === "wealth" ? (/(正财|偏财)/.test(annualGod) ? 5 : /(比肩|劫财)/.test(annualGod) ? -4 : 0)
      : meta.topic === "relationships" ? (/(正财|偏财|正官|七杀)/.test(annualGod) ? 4 : 0)
      : 0;
    const score = clamp(annualBase + (stanceAdjust[stance] ?? 0) + godBias);
    const fallback = meta.topic === "health" ? "以年度收盘与波动范围观察结构平衡。" : "该主题未设独立的公开年度结论。";
    return { ...meta, score, copy: theme?.headline || fallback, stance };
  });
  // 总览固定呈现八步大运；选择年度只更新解读，不改变观察范围。
  const visibleLine = line;
  const extent = visibleLine.flatMap((item: any) => [item.low, item.high]);
  const rawLow = extent.length ? Math.min(...extent) : 35;
  const rawHigh = extent.length ? Math.max(...extent) : 65;
  const rawSpread = Math.max(1, rawHigh - rawLow);
  const padding = Math.max(2, rawSpread * .18);
  let yMin = Math.max(0, Math.floor((rawLow - padding) / 5) * 5);
  let yMax = Math.min(100, Math.ceil((rawHigh + padding) / 5) * 5);
  if (yMax - yMin < 15) { yMin = Math.max(0, yMin - 10); yMax = Math.min(100, yMax + 10); }
  const chartHeight = Math.min(500, Math.max(330, 260 + (yMax - yMin) * 4));
  const yPosition = (value: number) => `${(1 - (value - yMin) / (yMax - yMin || 1)) * 100}%`;
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round((yMax - (yMax - yMin) * index / 4) * 10) / 10);
  const hoveredLuck = lucks.find((item: any) => item.luck_cycle_id === hoveredCandle?.luckCycleId);
  const hoveredAnnual = analysis?.chart?.annualContexts?.find((item: any) => item.year === hoveredCandle?.year);
  const hoveredIndex = hoveredCandle ? visibleLine.findIndex((item: any) => item.year === hoveredCandle.year) : -1;
  const judgmentRows = [
    { label: "结构依据", value: result?.verdict?.primary_structure },
    { label: "取用方向", value: beforeClimate(result?.verdict?.primary_use) },
    { label: "调候", value: climate },
    { label: "辅助关系", value: result?.verdict?.secondary_structures?.slice(0, 3).join("、") },
  ].filter(row => Boolean(row.value));
  const overviewDetails = <>
    <div className="sidebar-title">
      <p className="eyebrow">命盘摘要</p>
      <h1>{natalPillars.day?.stem || calendar.pillars.day.stem}{natalPillars.day?.stem_element_zh || ""}日主</h1>
      <p><MapPin size={14} />{city} · {compiled.result.zonedBirth.timeZone}</p>
      <p><Clock size={14} />{birth.year}年{birth.month}月{birth.day}日 {String(birth.hour).padStart(2, "0")}:{String(birth.minute).padStart(2, "0")}</p>
    </div>
    <section className="natal-overview sidebar-natal" aria-label="原局总览">
      <div className="natal-head"><div><p className="eyebrow">本命原局 / 以日干为轴</p><h2>四柱信息</h2></div><span>日主 · {natalPillars.day?.stem || calendar.pillars.day.stem}{natalPillars.day?.stem_element_zh ? `（${natalPillars.day.stem_element_zh}）` : ""}</span></div>
      <div className="natal-pillar-grid">{(["year", "month", "day", "hour"] as const).map((key) => { const pillar = natalPillars[key] || calendar.pillars[key]; const element = pillar.stem_element || elementByStem[pillar.stem] || "earth"; return <article className="natal-pillar" key={key}><header><span>{pillarLabels[key]}</span><small>{pillar.stem_ten_god || (key === "day" ? "日主" : "十神待载入")}</small></header><div className={`natal-ganzhi element-${element}`}><strong>{pillar.stem}{key === "day" && <sup className="overview-mark day-master">日主</sup>}</strong><b>{pillar.branch}{key === "month" && <sup className="overview-mark month-command">月令</sup>}{key === "day" && <sup className="overview-mark day-seat">日坐</sup>}</b></div><div className="natal-meta"><span>纳音</span><b>{pillar.nayin?.name || "—"}</b><span>十二长生</span><b>{pillar.twelve_growth_stage || "—"}</b></div><div className="hidden-stems"><span>藏干</span><div>{(pillar.hidden_stems || []).map((hidden: any) => <i className={`element-${hidden.element || elementByStem[hidden.stem] || "earth"}`} key={`${hidden.stem}-${hidden.order}`}>{hidden.stem}<small>{hidden.ten_god}</small></i>)}</div></div></article>; })}</div>
      <section className="element-summary" aria-label="五行比例"><div><p className="eyebrow">命局五行构成</p><span>按天干与藏干计数 · 不随流派改变</span></div><div className="element-bars">{elementStats.map(item => <article className={`element-bar element-${item.element}`} key={item.element}><header><strong>{item.label}</strong><span>{item.percent}%</span></header><i><b style={{ width: `${item.percent}%` }} /></i></article>)}</div></section>
      <section className="school-judgment" aria-label="所选流派判断"><header><p className="eyebrow">所选流派终局裁决</p><span>{schoolDisplayLabels[school]} · {schoolOrigins[school]}</span></header><article className="final-verdict"><p>原局结论</p><h3>{verdictLead(result?.verdict?.headline)}</h3><strong>{result?.verdict?.strength_or_axis || "该体系未以旺衰作为独立终局字段。"}</strong></article><div className="natal-judgments">{judgmentRows.map(row => <article key={row.label}><span>{row.label}</span><strong>{sentence(row.value)}</strong></article>)}</div><details className="verdict-basis"><summary>查看判定依据与边界</summary><p>{result?.verdict?.headline}</p>{result?.verdict?.rejected_routes?.length ? <p>未采路线：{result.verdict.rejected_routes.join("；")}</p> : null}{result?.verdict?.caveats?.length ? <p>保留说明：{result.verdict.caveats.join("；")}</p> : null}</details></section>
    </section>
  </>;
  return <main className="workbench lifecycle-workbench">
    <aside className="profile-rail">
      {overviewDetails}
      <details className="provenance-panel"><summary><ShieldCheck size={15} />计算依据与认证</summary><div><p>{calendar.direction === "forward" ? "顺行" : "逆行"} · {calendar.luckStartAgeYears.toFixed(2)} 岁起运</p><p>真太阳时 {calendar.normalizedTime.apparentSolarCorrectionMinutes.toFixed(1)} 分钟校正</p><p>DE441 节气 · IANA 时区证书</p></div></details>
    </aside>

    <section className="main-pane chart-pane">
      <div className="top-school-tabs" aria-label="选择分析流派">{Object.entries(labels).map(([id]) => <button className={id === school ? "active" : ""} onClick={() => { setSchool(id); setHoveredCandle(undefined); }} key={id}><b>{schoolDisplayLabels[id]}</b><small>{schoolOrigins[id]}</small></button>)}</div>
      <div className="chart-heading">
        <div><h2>八步大运 · 全生命周期年度结构波动</h2><p className="chart-subtitle">红色＝本年收盘高于开盘，绿色＝本年收盘低于开盘。八步大运完整展开；点击任一年度可查看该年的流年与所属大运。</p></div>
        <span>{line[0]?.year} — {line.at(-1)?.year} · 当前纵轴 {yMin} 至 {yMax}</span>
      </div>
      <div className="chart-controls" aria-label="K线展示说明"><span>固定展示 <b>{lucks.length || 8}</b> 步大运 · <b>{visibleLine.length}</b> 年</span><span>当前焦点：<b>{selected}</b> {annual?.stem}{annual?.branch}流年 · {luck?.stem}{luck?.branch}大运</span><span>{visibleLine[0]?.year} — {visibleLine.at(-1)?.year}</span></div>
      <div className="ohlc-stage">
        <div className="y-axis" aria-hidden="true" style={{ height: chartHeight }}>{ticks.map(value => <span style={{ top: yPosition(value) }} key={value}>{value}</span>)}</div>
        <div className={`ohlc-chart adaptive ${visibleLine.length > 40 ? "dense" : ""}`} style={{ height: chartHeight }}>
          {ticks.map(value => <span className={`gridline ${value === 0 ? "zero" : ""}`} style={{ top: yPosition(value) } as CSSProperties} key={value} />)}
          {lucks.slice(1).map((luck: any, index: number) => <i className="luck-divider" aria-hidden="true" style={{ left: `${(index + 1) / lucks.length * 100}%` }} key={luck.luck_cycle_id} />)}
          {visibleLine.map((candle: any, index: number) => {
            const up = candle.close >= candle.open;
            return <button onMouseEnter={() => setHoveredCandle(candle)} onFocus={() => setHoveredCandle(candle)} onClick={() => { setHoveredCandle(candle); select(candle.year); }} aria-label={`${candle.year} 年，开 ${candle.open}，高 ${candle.high}，低 ${candle.low}，收 ${candle.close}`} className={`ohlc ${up ? "up" : "down"} ${candle.year === selected ? "selected" : ""}`} style={{ left: `calc(${(index + .5) / visibleLine.length * 100}% - 13px)` }} key={candle.year}>
              <i className="wick" style={{ top: yPosition(candle.high), height: `${(candle.high - candle.low) / (yMax - yMin || 1) * 100}%` }} />
              <i className="body" style={{ top: yPosition(Math.max(candle.open, candle.close)), height: `${Math.max(2, Math.abs(candle.close - candle.open) / (yMax - yMin || 1) * 100)}%` }} />
              <i className="close-dot" style={{ top: yPosition(candle.close) }} />
            </button>;
          })}
          {hoveredCandle && hoveredIndex >= 0 && <aside className="annual-popover" style={{ left: `clamp(12px, ${(hoveredIndex + .5) / visibleLine.length * 100}%, calc(100% - 236px))` }}><button aria-label="关闭年度信息" onClick={() => setHoveredCandle(undefined)}>×</button><p>{hoveredCandle.year} {hoveredAnnual?.stem}{hoveredAnnual?.branch}年 <em>{hoveredCandle.close >= hoveredCandle.open ? "上行" : "回落"}</em></p><strong>{hoveredLuck?.stem}{hoveredLuck?.branch}大运 · 第 {hoveredLuck?.order} 运</strong><dl><div><dt>天干</dt><dd>{hoveredAnnual?.stem}（{hoveredAnnual?.stem_ten_god || "流年"}）</dd></div><div><dt>地支</dt><dd>{hoveredAnnual?.branch}</dd></div><div><dt>开 / 高 / 低 / 收</dt><dd>{hoveredCandle.open} / {hoveredCandle.high} / {hoveredCandle.low} / {hoveredCandle.close}</dd></div><div><dt>年度变动</dt><dd>{(hoveredCandle.close - hoveredCandle.open) >= 0 ? "+" : ""}{(hoveredCandle.close - hoveredCandle.open).toFixed(2)}</dd></div><div><dt>流月波幅</dt><dd>{(hoveredCandle.high - hoveredCandle.low).toFixed(2)}</dd></div></dl></aside>}
        </div>
      </div>
      <div className="chart-navigator fixed-lifecycle"><div className="year-strip">{visibleLine.map((candle: any, index: number) => (visibleLine.length > 40 && index % 5 !== 0) ? <span aria-hidden="true" key={candle.year} /> : <button onMouseEnter={() => setHoveredCandle(candle)} onFocus={() => setHoveredCandle(candle)} onClick={() => { setHoveredCandle(candle); select(candle.year); }} className={candle.year === selected ? "active-year" : ""} key={candle.year}>{candle.year}</button>)}</div><div className="chart-luck-strip" aria-label="八步大运分段">{lucks.map((item: any) => <article key={item.luck_cycle_id}><strong>第 {item.order} 运 · {item.stem}{item.branch}</strong><span>{item.start_year} — {item.end_year}</span></article>)}</div></div>
      <section className="theme-score-row" aria-label="年度主题分数"><header><span>{selected} 年主题结构指数</span><small>{schoolDisplayLabels[school]} · 以年度 K 线收盘为基底，主题立场与流年十神仅作小幅修正</small></header>{themeScores.map(theme => <article className={theme.tone} key={theme.label}><span>{theme.label}</span><strong>{theme.score}<small>/100</small></strong><p>{theme.copy}</p></article>)}</section>
      <div className="chart-footnote"><span>当前年度 OHLC：{selectedCandle ? `${selectedCandle.open} / ${selectedCandle.high} / ${selectedCandle.low} / ${selectedCandle.close}` : "—"}</span><p>{analysis.calculationMethod?.monthlyCandle || "指标由原局、大运、流年与十二流月共同构成；不代表现实概率或人生结果。"}</p></div>
    </section>
  </main>;
}
