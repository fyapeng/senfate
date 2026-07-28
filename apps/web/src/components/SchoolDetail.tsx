import { useEffect, useMemo, useState } from "react";

const labels: Record<string, string> = { classical_ziping: "传统子平", shao_weihua: "邵伟华体系", li_hanchen: "李涵辰体系", duan_li_xiang: "段氏理象体系" };
const topicNames: Record<string, string> = { career: "事业", wealth: "财运", relationships: "关系", health: "平衡" };
const analysisSchema = "senfate-browser-ruleir.v5";

export default function SchoolDetail({ id }: { id: string }) {
  const [data, setData] = useState<any>();
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem("senfate.analysis") || "null"); setData(saved?.schema === analysisSchema ? saved : null); } catch { setData(null); } }, []);
  const label = labels[id] ?? "流派";
  const result = useMemo(() => data?.schools?.find((item: any) => item.school === label), [data, label]);
  const audit = useMemo(() => data?.audit?.find((item: any) => item.schoolId === id), [data, id]);
  const referenced = useMemo(() => (audit?.trace ?? []).filter((event: any) => event.condition_truth === "true"), [audit]);

  if (!result || !audit) return <section className="page"><p className="eyebrow">流派详情 · {label}</p><h1 className="page-title">请先完成排盘</h1><p className="page-summary">流派详情会基于当前命盘展示这一体系的独立解读。</p><a className="button" href="/calculation">前往排盘计算</a></section>;

  return <section className="page"><p className="eyebrow">流派详情 · {label} / {data.selectedYear}</p><h1 className="page-title">{label}的独立解读</h1><p className="page-summary">四套体系分别解读同一命盘；页面不会把它们合并成单一结论或权重。</p><div className="grid-two"><section><article className="panel"><span className="tag">本命原局</span><h2 className="detail-headline">{result.verdict?.headline}</h2><p className="muted">{result.verdict?.summary}</p>{result.verdict?.natal_points?.length ? <dl className="run-metrics">{result.verdict.natal_points.map((point: any) => <div key={point.label}><dt>{point.label}</dt><dd>{point.text}</dd></div>)}</dl> : null}</article><section className="section"><h2 className="section-title">年度主题</h2><div className="rows">{result.themes?.map((theme: any) => <article className="row" key={theme.topic}><span className="row-index">主题</span><span><strong>{topicNames[theme.topic] || theme.topic}</strong><small className="row-sub">{theme.headline}</small></span><span className="tag">结论</span></article>)}</div></section><section className="section"><h2 className="section-title">本次采用的规则</h2><p className="page-summary compact-copy">这些公开规则与当前命局条件相符；点击可查看使用范围与来源。</p><div className="rows">{referenced.slice(0, 20).map((event: any) => <a className="row rule-row" href={`/rules/${event.rule_id}`} key={event.rule_id}><span className="row-index">{event.phase || "规则"}</span><span><strong>{event.title || "公开规则说明"}</strong><small className="row-sub">{event.description || "查看规则说明与来源"}</small></span><span className="tag">查看依据</span></a>)}</div>{referenced.length > 20 && <p className="muted">其余规则已收在“规则”页中。</p>}</section></section><aside className="panel run-panel"><span className="tag">岁运判定</span><p className="metric">独立</p><p className="muted">本派结论不与其他体系加权合并</p><dl className="run-metrics"><div><dt>顺逆判定</dt><dd>{result.verdict?.timing_focus || "本派没有形成岁运判定。"}</dd></div><div><dt>方法说明</dt><dd>{result.verdict?.method_note || "按本派公开规则独立判断。"}</dd></div></dl><a className="button secondary" href="/rules">浏览规则与来源</a></aside></div></section>;
}
