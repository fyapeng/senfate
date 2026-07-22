import { useState } from "react";

const states = [
  { id: "candidate", label: "候选", en: "candidate", text: "检测到符号关系，但尚未证明在当前层有效。", checks: ["组合成员齐全", "记录所在时间层", "保留参与节点"] },
  { id: "effective", label: "有效", en: "effective", text: "关系满足当前模型的完整条件，可以进入稳定结构。", checks: ["季节与月令支持", "不存在高优先级阻断", "当前层直接参与"] },
  { id: "contested", label: "争议", en: "contested", text: "支持与反向证据接近阈值，系统保留分歧。", checks: ["记录冲突规则", "保留各自来源", "禁止强制净化"] },
  { id: "mitigated", label: "缓和", en: "mitigated", text: "关系仍有效，但通关、救应或上下文降低其作用。", checks: ["记录缓和机制", "保留原始关系", "重新计算贡献"] },
  { id: "blocked", label: "阻断", en: "blocked", text: "必要条件不成立或更高优先级规则否决，不进入主题层。", checks: ["明确失败原因", "写入计算证书", "贡献为零而非丢失"] },
  { id: "transformed", label: "成化", en: "transformed", text: "组合满足严格转化条件，关系目标发生结构变化。", checks: ["目标五行明确", "成化阈值满足", "原关系不重复计分"] },
] as const;

export function InferenceExplorer() {
  const [active, setActive] = useState<(typeof states)[number]["id"]>("candidate");
  const state = states.find(x => x.id === active) ?? states[0];
  return <div className="resolution-explorer"><div className="resolution-tabs" role="tablist">{states.map(x=><button type="button" role="tab" aria-selected={x.id===active} className={x.id===active?"active":""} onClick={()=>setActive(x.id)} key={x.id}><i className={x.id}></i>{x.label}<small>{x.en}</small></button>)}</div><div className="resolution-detail"><div><span className={`state ${state.id}`}>{state.label}</span><h3>{state.text}</h3></div><ol>{state.checks.map((x,i)=><li key={x}><span>{i+1}</span>{x}</li>)}</ol></div></div>;
}
