import { useMemo, useState } from "react";

const groups = [
  { id: "ontology", label: "基础本体", stages: ["历法与时空", "干支四柱", "五行阴阳", "藏干", "十神", "生克泄耗"] },
  { id: "structure", label: "结构判断", stages: ["关系候选", "通根透干", "五行测度", "日主强弱", "格局", "调候", "扶抑"] },
  { id: "resolution", label: "裁决与正规形", stages: ["古籍结构改写", "关系裁决", "稳定正规形"] },
  { id: "semantics", label: "语义与测量", stages: ["六亲角色", "主题贡献", "事件假设", "向量测度"] },
] as const;

export function TheoryExplorer() {
  const [active, setActive] = useState<(typeof groups)[number]["id"]>("ontology");
  const selected = useMemo(() => groups.find((group) => group.id === active) ?? groups[0], [active]);
  return (
    <div className="explorer">
      <div className="explorer-tabs" role="tablist" aria-label="理论阶段">
        {groups.map((group) => (
          <button
            type="button"
            role="tab"
            aria-selected={active === group.id}
            className={active === group.id ? "active" : ""}
            onClick={() => setActive(group.id)}
            key={group.id}
          >
            {group.label}
          </button>
        ))}
      </div>
      <ol className="stage-list">
        {selected.stages.map((stage, index) => (
          <li key={stage}><span>{String(index + 1).padStart(2, "0")}</span>{stage}</li>
        ))}
      </ol>
    </div>
  );
}
