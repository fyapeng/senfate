import { useEffect, useState } from "react";
const labels: Record<string, string> = { classical_ziping: "传统子平", shao_weihua: "邵伟华体系", li_hanchen: "李涵辰体系", duan_li_xiang: "段氏理象体系" };

export default function Schools() {
  const [data, setData] = useState<any>();
  useEffect(() => { try { setData(JSON.parse(sessionStorage.getItem("senfate.analysis") || "null")); } catch { setData(null); } }, []);
  if (!Array.isArray(data?.schools) || !Array.isArray(data?.audit)) return <section className="page"><p className="eyebrow">四套独立体系</p><h1 className="page-title">先完成认证分析</h1><p className="page-summary">流派页会显示同一命盘下四套体系的实际独立结果。</p><a className="button" href="/calculation">前往排盘计算</a></section>;
  return <section className="page"><p className="eyebrow">四套独立体系 / 同一认证命盘</p><h1 className="page-title">四派并列结果</h1><p className="page-summary">以下结论均来自当前一次四派运行。它们不会互相投票、修正或合并为单一分数。</p><div className="school-grid">{Object.entries(labels).map(([id, label], index) => { const result = data.schools.find((item: any) => item.school === label); const audit = data.audit.find((item: any) => item.schoolId === id); return <a className="school-row" href={`/schools/${id}`} key={id}><strong className="school-mark">{String(index + 1).padStart(2, "0")}</strong><span><span className="school-name">{label}</span><small className="row-sub">{audit?.ruleCount ?? 0} 条运行规则 · {audit?.trace?.events?.length ?? 0} 条审计事件</small></span><span className="muted">{result?.verdict?.headline || "本次未形成公开摘要"}</span><strong>{result?.themes?.length ?? 0}</strong><span className="tag">查看</span></a>; })}</div></section>;
}
