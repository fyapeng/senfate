export const THEORY_SYSTEM_SCHEMA = "senfate-theory-system.v1" as const;

export type TheoryFunctionKind =
  | "deterministic"
  | "profiled-model"
  | "reference-functions"
  | "projection";

export interface TheoryFunction {
  readonly id: string;
  readonly label: string;
  readonly dependsOn: readonly string[];
  readonly kind: TheoryFunctionKind;
  readonly status: "specified" | "implementation-pending";
}

export const THEORY_FUNCTIONS: readonly TheoryFunction[] = [
  { id: "calendar.normalize", label: "历法与时空输入", dependsOn: [], kind: "deterministic", status: "implementation-pending" },
  { id: "ontology.pillars", label: "干支与四柱", dependsOn: ["calendar.normalize"], kind: "deterministic", status: "implementation-pending" },
  { id: "ontology.elements", label: "五行与阴阳", dependsOn: ["ontology.pillars"], kind: "deterministic", status: "implementation-pending" },
  { id: "ontology.hidden-stems", label: "藏干展开", dependsOn: ["ontology.pillars"], kind: "deterministic", status: "implementation-pending" },
  { id: "ontology.ten-gods", label: "十神", dependsOn: ["ontology.elements", "ontology.hidden-stems"], kind: "deterministic", status: "implementation-pending" },
  { id: "ontology.generation-control", label: "生克泄耗", dependsOn: ["ontology.elements"], kind: "deterministic", status: "implementation-pending" },
  { id: "ontology.relation-candidates", label: "干支关系候选", dependsOn: ["ontology.pillars", "ontology.generation-control"], kind: "deterministic", status: "implementation-pending" },
  { id: "ontology.root-exposure", label: "通根与透干", dependsOn: ["ontology.hidden-stems", "ontology.elements"], kind: "deterministic", status: "implementation-pending" },
  { id: "structure.element-measure", label: "五行动态测度", dependsOn: ["ontology.elements", "ontology.hidden-stems"], kind: "profiled-model", status: "implementation-pending" },
  { id: "structure.strength", label: "日主强弱", dependsOn: ["structure.element-measure", "ontology.root-exposure"], kind: "profiled-model", status: "implementation-pending" },
  { id: "structure.pattern", label: "格局", dependsOn: ["ontology.ten-gods", "ontology.root-exposure"], kind: "profiled-model", status: "implementation-pending" },
  { id: "structure.climate", label: "调候", dependsOn: ["structure.element-measure", "ontology.pillars"], kind: "profiled-model", status: "implementation-pending" },
  { id: "structure.balancing", label: "扶抑与用神候选", dependsOn: ["structure.strength", "structure.pattern", "structure.climate"], kind: "profiled-model", status: "implementation-pending" },
  { id: "structure.reference-rewrites", label: "古籍结构改写", dependsOn: ["structure.strength", "structure.pattern", "structure.climate", "structure.balancing"], kind: "reference-functions", status: "implementation-pending" },
  { id: "resolution.relations", label: "关系裁决", dependsOn: ["ontology.relation-candidates", "structure.reference-rewrites"], kind: "reference-functions", status: "implementation-pending" },
  { id: "resolution.normal-form", label: "结构—关系正规形", dependsOn: ["structure.reference-rewrites", "resolution.relations"], kind: "profiled-model", status: "implementation-pending" },
  { id: "semantic.kinship", label: "六亲角色", dependsOn: ["ontology.ten-gods", "resolution.normal-form"], kind: "profiled-model", status: "implementation-pending" },
  { id: "semantic.topics", label: "主题贡献", dependsOn: ["resolution.normal-form", "semantic.kinship"], kind: "reference-functions", status: "implementation-pending" },
  { id: "semantic.events", label: "事件假设", dependsOn: ["semantic.topics", "resolution.normal-form"], kind: "reference-functions", status: "implementation-pending" },
  { id: "measurement.vector", label: "透明向量测度", dependsOn: ["semantic.topics"], kind: "projection", status: "implementation-pending" },
] as const;

export function validateTheoryFunctions(functions: readonly TheoryFunction[]): void {
  const byId = new Map(functions.map((item) => [item.id, item]));
  if (byId.size !== functions.length) throw new Error("Theory function IDs must be unique");
  const active = new Set<string>();
  const complete = new Set<string>();
  const visit = (id: string): void => {
    if (complete.has(id)) return;
    if (active.has(id)) throw new Error(`Theory function cycle at ${id}`);
    const definition = byId.get(id);
    if (!definition) throw new Error(`Missing theory function ${id}`);
    active.add(id);
    for (const dependency of definition.dependsOn) visit(dependency);
    active.delete(id);
    complete.add(id);
  };
  for (const id of byId.keys()) visit(id);
}
