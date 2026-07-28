import { useEffect, useMemo, useState } from "react";
import "../styles/professional-chart.css";

const labels: Record<string, string> = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" };
const stemElements: Record<string, string> = { 甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水" };
const branchElements: Record<string, string> = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
const elementClass: Record<string, string> = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" };

function StemBranch({ stem, branch, large = false, stemMark, branchMark }: { stem: string; branch: string; large?: boolean; stemMark?: "日主"; branchMark?: "月令" | "日坐" }) {
  const stemClass = elementClass[stemElements[stem] || ""] || "";
  const branchClass = elementClass[branchElements[branch] || ""] || "";
  return <div className={`sb ${large ? "large" : ""}`}><b className={stemClass}>{stem}{stemMark && <sup className="pillar-mark day-master">{stemMark}</sup>}</b><strong className={branchClass}>{branch}{branchMark && <sup className={`pillar-mark ${branchMark === "月令" ? "month-command" : "day-seat"}`}>{branchMark}</sup>}</strong></div>;
}

export default function ProfessionalChart() {
  const [analysis, setAnalysis] = useState<any>();
  const [compiled, setCompiled] = useState<any>();
  const [luckId, setLuckId] = useState<string>();
  useEffect(() => { try { setAnalysis(JSON.parse(sessionStorage.getItem("senfate.analysis") || "null")); setCompiled(JSON.parse(sessionStorage.getItem("senfate.compile") || "null")); } catch { setAnalysis(null); } }, []);
  const chart = analysis?.chart;
  const lucks = chart?.luckCycles?.slice(0, 8) || [];
  const activeLuck = lucks.find((item: any) => item.luck_cycle_id === luckId) || lucks.find((item: any) => analysis?.selectedYear >= item.start_year && analysis?.selectedYear <= item.end_year) || lucks[0];
  const annuals = useMemo(() => (chart?.annualContexts || []).filter((item: any) => item.year >= activeLuck?.start_year && item.year <= activeLuck?.end_year), [chart, activeLuck]);
  if (!chart) return <section className="page"><p className="eyebrow">专业命盘</p><h1 className="page-title">请先完成认证排盘</h1><p className="page-summary">专业命盘读取认证出生时间生成的四柱、起运和八步大运，不另行推断。</p><a className="button" href={`${import.meta.env.BASE_URL}calculation/`}>前往排盘计算</a></section>;
  const pillars = chart.pillars || {};
  const birth = compiled?.result?.zonedBirth?.civilBirth;
  return <section className="professional-page">
    <header className="professional-head"><div><p className="eyebrow">认证命盘 / 公开基础数据</p><h1>专业命盘</h1><p>{compiled?.city || "认证出生地"} · {birth ? `${birth.year}年${birth.month}月${birth.day}日 ${String(birth.hour).padStart(2, "0")}:${String(birth.minute).padStart(2, "0")}` : "出生时间已认证"}</p></div><aside><span>日主</span><strong>{pillars.day?.stem}{pillars.day?.stem_element_zh ? ` · ${pillars.day.stem_element_zh}` : ""}</strong><small>起运约 {compiled?.result?.calendar?.luckStartAgeYears?.toFixed?.(2) ?? "—"} 岁 · {compiled?.result?.calendar?.direction === "forward" ? "顺行" : "逆行"}</small></aside></header>
    <section className="professional-panel natal-board"><header><div><p className="eyebrow">本命四柱</p><h2>原局属性</h2></div><span>蓝色为日主，金色为月令，绿色为日坐；天干十神、地支藏干、纳音与十二长生均以日干为轴</span></header><div className="professional-pillars">{(["year", "month", "day", "hour"] as const).map(key => { const pillar = pillars[key]; const marks = { ...(key === "day" ? { stemMark: "日主" as const } : {}), ...(key === "month" ? { branchMark: "月令" as const } : key === "day" ? { branchMark: "日坐" as const } : {}) }; return <article key={key}><header><span>{labels[key]}</span><small>{pillar?.stem_ten_god || (key === "day" ? "日主" : "—")}</small></header><StemBranch stem={pillar?.stem || "—"} branch={pillar?.branch || "—"} large {...marks}/><dl><div><dt>纳音</dt><dd>{pillar?.nayin?.name || "—"}</dd></div><div><dt>十二长生</dt><dd>{pillar?.twelve_growth_stage || "—"}</dd></div></dl><footer><span>藏干</span><div>{(pillar?.hidden_stems || []).map((hidden: any) => <i className={elementClass[hidden.element_zh] || "earth"} key={`${hidden.stem}-${hidden.order}`}>{hidden.stem}<small>{hidden.ten_god}</small></i>)}</div></footer></article>; })}</div></section>
    <section className="professional-panel luck-board"><header><div><p className="eyebrow">人生时间轴 / 八步大运</p><h2>先定大运，再看流年</h2></div><span>选择任一步大运，展开其十年流年排盘</span></header><div className="luck-tabs">{lucks.map((luck: any) => <button className={luck.luck_cycle_id === activeLuck?.luck_cycle_id ? "active" : ""} onClick={() => setLuckId(luck.luck_cycle_id)} key={luck.luck_cycle_id}><small>第 {luck.order} 运</small><StemBranch stem={luck.stem} branch={luck.branch}/><span>{luck.start_year} — {luck.end_year}</span><em>{luck.stem_ten_god}</em></button>)}</div>{activeLuck && <div className="selected-luck"><div><p>当前大运</p><h3>{activeLuck.stem}{activeLuck.branch} · 第 {activeLuck.order} 运</h3><span>{activeLuck.start_year} — {activeLuck.end_year} · 天干十神：{activeLuck.stem_ten_god}</span></div><div className="luck-hidden"><span>支藏干</span>{(activeLuck.hidden_stems || []).map((hidden: any) => <i className={elementClass[hidden.element_zh] || "earth"} key={hidden.stem}>{hidden.stem}<small>{hidden.ten_god}</small></i>)}</div></div>}<div className="annual-grid">{annuals.map((annual: any) => <article key={annual.year}><header><strong>{annual.year}</strong><span>流年</span></header><StemBranch stem={annual.stem} branch={annual.branch}/><p>天干十神 · <b>{annual.stem_ten_god}</b></p></article>)}</div></section>
    <details className="professional-method"><summary>本页数据如何生成</summary><p>四柱以认证出生地时区、真太阳时修正与节气月界排定；大运按顺逆行和起运时刻生成；每个流年以六十甲子年序列取得干支。五行由天干、地支及藏干的公开对应表取得，十神由日干与目标天干的五行生克及阴阳同性/异性关系判定。完整规则、典籍来源和执行边界见“规则”栏目。</p></details>
  </section>;
}
