import { useEffect, useMemo, useState } from "react";

const labels: Record<string, string> = { classical_ziping: "传统子平", shao_weihua: "邵伟华体系", li_hanchen: "李涵辰体系", duan_li_xiang: "段氏理象体系" };

export default function SchoolDetail({ id }: { id: string }) {
  const [data, setData] = useState<any>();
  useEffect(() => { try { setData(JSON.parse(sessionStorage.getItem("senfate.analysis") || "null")); } catch { setData(null); } }, []);
  const label = labels[id] ?? "流派";
  const result = useMemo(() => data?.schools?.find((item: any) => item.school === label), [data, label]);
  const audit = useMemo(() => data?.audit?.find((item: any) => item.schoolId === id), [data, id]);
  const fired = useMemo(() => (audit?.trace?.events ?? []).filter((event: any) => event.event_type === "rule_evaluated" && event.result === "fired"), [audit]);

  if (!result || !audit) return <section className="page"><p className="eyebrow">流派详情 · {label}</p><h1 className="page-title">请先运行认证分析</h1><p className="page-summary">流派详情只显示当前认证命盘上本派的实际运行轨迹。</p><a className="button" href="/calculation">前往排盘计算</a></section>;

  return <section className="page"><p className="eyebrow">流派详情 · {label} / {data.selectedYear}</p><h1 className="page-title">{label}的独立推演</h1><p className="page-summary">只展示本派在当前认证命盘和流年下的运行结果，不引用其他流派结论，也不生成综合权重。</p><div className="grid-two"><section><article className="panel"><span className="tag">年度主判断</span><h2 className="detail-headline">{result.verdict?.headline}</h2><p className="muted">{result.verdict?.primary_structure}</p></article><section className="section"><h2 className="section-title">主题判断</h2><div className="rows">{result.themes?.map((theme: any) => <article className="row" key={theme.topic}><span className="row-index">主题</span><span><strong>{theme.topic}</strong><small className="row-sub">{theme.headline}</small></span><span className="muted">{theme.conclusion}</span><span className="tag">{theme.assessment}</span></article>)}</div></section><section className="section"><h2 className="section-title">已触发规则</h2><p className="page-summary compact-copy">以下条目来自本次运行的审计事件；点击可查看规则的结构化条件、动作与来源。</p><div className="rows">{fired.slice(0, 20).map((event: any) => <a className="row rule-row" href={`/rules/${event.rule_id}`} key={event.event_index}><span className="row-index">{event.phase || "规则"}</span><span><strong>{event.rule_id}</strong><small className="row-sub">事件 #{event.event_index}</small></span><span className="muted">{event.reason || "条件满足并已进入本派推演。"}</span><span className="tag">查看依据</span></a>)}</div>{fired.length > 20 && <p className="muted">已展示前 20 条触发规则；完整审计链可在总览右侧抽屉逐项展开。</p>}</section></section><aside className="panel run-panel"><span className="tag">本次运行</span><p className="metric">{audit.ruleCount ?? 0}</p><p className="muted">条规则参与求值</p><dl className="run-metrics"><div><dt>审计事件</dt><dd>{audit.trace?.events?.length ?? 0}</dd></div><div><dt>触发规则</dt><dd>{audit.evaluationCounts?.fired ?? 0}</dd></div><div><dt>未触发路径</dt><dd>{audit.evaluationCounts?.not_fired ?? 0}</dd></div></dl><a className="button secondary" href="/rules">浏览完整规则库</a></aside></div></section>;
}
