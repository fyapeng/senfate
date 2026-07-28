import { useEffect, useState } from "react";
const labels: Record<string, string> = { classical_ziping: "传统子平", shao_weihua: "邵伟华体系", li_hanchen: "李涵辰体系", duan_li_xiang: "段氏理象体系" };
const analysisSchema = "senfate-browser-ruleir.v5";

export default function Schools() {
  const [data, setData] = useState<any>();
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem("senfate.analysis") || "null"); setData(saved?.schema === analysisSchema ? saved : null); } catch { setData(null); } }, []);
  if (!Array.isArray(data?.schools) || !Array.isArray(data?.audit)) return <section className="page"><p className="eyebrow">四套独立体系</p><h1 className="page-title">先完成认证分析</h1><p className="page-summary">流派页会显示同一命盘下四套体系的实际独立结果。</p><a className="button" href="/calculation">前往排盘计算</a></section>;
  return <section className="page"><p className="eyebrow">四套独立体系 / 同一认证命盘</p><h1 className="page-title">四派并列结果</h1><p className="page-summary">以下结论均基于同一命盘分别得出；它们不会互相投票、修正或合并为单一分数。</p><div className="school-grid">{Object.entries(labels).map(([id, label], index) => { const result = data.schools.find((item: any) => item.school === label); return <a className="school-row" href={`/schools/${id}`} key={id}><strong className="school-mark">{String(index + 1).padStart(2, "0")}</strong><span><span className="school-name">{label}</span><small className="row-sub">公开规则与来源均可查看</small></span><span className="muted">{result?.verdict?.headline || "本次暂未形成摘要"}</span><span className="tag">查看</span></a>; })}</div></section>;
}
