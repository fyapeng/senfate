import { useEffect, useState } from "react";
const labels: Record<string, string> = { classical_ziping: "传统子平", shao_weihua: "邵伟华体系", li_hanchen: "李涵辰体系", duan_li_xiang: "段氏理象体系" };

export default function Timeline() {
  const [data, setData] = useState<any>();
  const [school, setSchool] = useState("classical_ziping");
  useEffect(() => { try { setData(JSON.parse(sessionStorage.getItem("senfate.analysis") || "null")); } catch { setData(null); } }, []);
  if (!data?.trajectory || !data?.chart?.annualContexts) return <section className="page"><p className="eyebrow">年度轨迹</p><h1 className="page-title">请先运行分析</h1><p className="page-summary">时间线只读取已认证命盘产生的年度规则运行结果。</p><a className="button" href="/calculation">前往排盘计算</a></section>;

  const rows = data.trajectory[school] || [];
  const annuals = data.chart.annualContexts || [];
  const lucks = data.chart.luckCycles || [];
  const luckIndexes = data.luckTrajectory?.[school] || [];
  return <section className="page"><p className="eyebrow">年度轨迹 / 真实运行数据</p><h1 className="page-title">大运分段与流年明细</h1><p className="page-summary">总览 K 线显示全生命周期。这里按八步大运分栏目展开每运十年流年；点击年份回到总览中的对应浮窗。</p><div className="school-tabs">{Object.entries(labels).map(([id, label]) => <button className={id === school ? "active" : ""} onClick={() => setSchool(id)} key={id}>{label}</button>)}</div><div className="timeline-groups">{lucks.slice(0, 8).map((luck: any) => { const index = luckIndexes.find((item: any) => item.luckCycleId === luck.luck_cycle_id)?.index; const group = rows.filter((row: any) => row.year >= luck.start_year && row.year <= luck.end_year); return <section className="timeline-group" key={luck.luck_cycle_id}><header><div><p>第 {luck.order} 运</p><h2>{luck.stem}{luck.branch}大运</h2><small>{luck.start_year} — {luck.end_year} · 规则结构 {typeof index === "number" ? `${index > 0 ? "+" : ""}${index}` : "—"}</small></div><a href={`/?year=${luck.start_year}`}>在总览定位</a></header><div className="rows">{group.map((row: any) => { const annual = annuals.find((item: any) => item.year === row.year); const delta = row.close - row.open; return <a className="row" href={`/?year=${row.year}`} key={row.year}><span className="row-index">{row.year}</span><span><strong>{annual?.stem}{annual?.branch} 流年</strong><small className="row-sub">结构指数 OHLC：{row.open} / {row.high} / {row.low} / {row.close} · 年度变动 {delta >= 0 ? "+" : ""}{delta.toFixed(2)}</small></span><span className="muted">{labels[school]}</span><span className="tag">总览浮窗</span></a>; })}</div></section>; })}</div></section>;
}
