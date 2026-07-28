import { useMemo } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import "../styles/audit.css";

export default function AuditDrawer({ label, year, annual, luck, verdict, audit }: any) {
  const trace = useMemo(() => audit?.trace ?? [], [audit]);
  const referenced = trace.filter((event: any) => event.condition_truth === "true");
  const otherRules = trace.filter((event: any) => event.condition_truth !== "true");
  return <aside className="detail-drawer">
    <p className="eyebrow">{label} / {year} {annual?.stem}{annual?.branch}</p>
    <div className="insight-card"><span className="tag">年度解读</span><h2>{verdict?.headline || "本年度暂未形成摘要"}</h2><p>{verdict?.primary_structure}</p></div>
    <details open className="audit-fold"><summary><b>1</b><span>本命基础</span></summary><p>{verdict?.strength_or_axis || "请结合原局整体关系观察。"}</p></details>
    <details open className="audit-fold"><summary><b>2</b><span>所在大运 · {luck ? `${luck.stem}${luck.branch}` : "—"}</span></summary><p>{verdict?.primary_use || "岁运变化可与原局一同参看。"}</p></details>
    <details open className="audit-fold"><summary><b>3</b><span>当年提示 · {annual ? `${annual.stem}${annual.branch}` : "—"}</span></summary><p>本年结合原局、所属大运与流年干支进行解读；点击图中的其他年份即可切换查看。</p></details>
    <details className="audit-fold"><summary><b>4</b><span>本次参考的规则</span></summary><p className="muted">以下规则与当前命局条件相符，可点击阅读其适用范围和来源。</p><ul className="rule-list">{referenced.slice(0, 12).map((event: any) => <li key={event.rule_id}><a href={`/rules/${event.rule_id}`}>{event.title || "公开规则说明"}</a><small>{event.phase || "原局与岁运"}</small></li>)}</ul></details>
    <details className="audit-fold"><summary><b>5</b><span>完整计算说明</span></summary><p>本次共核对 {trace.length} 条公开规则。其余规则因适用条件不同，未写入本年度解读。</p>{audit?.warnings?.map((warning: string) => <p key={warning}>{warning}</p>)}</details>
    <a className="drawer-action" href="/rules"><span>查看规则体系与公开依据</span><ArrowRight size={17}/></a>
  </aside>;
}
