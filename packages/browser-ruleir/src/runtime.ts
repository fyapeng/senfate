import { deepClone, deepEqual, stableStringify } from "./shared";
export * from "./chart";
export * from "./classical-ziping";
export * from "./classical-ziping-w03";
export * from "./shao-weihua";
export * from "./modern-schools";

export type Truth = "true" | "false" | "unknown";
export type Resolver = (args: Record<string, unknown>, context: RuntimeContext) => Truth;
export interface RuntimeContext { [key: string]: any; }
export interface RuleEvaluation {
  rule_id: string;
  result: string;
  condition_truth: Truth;
  actions_executed: Record<string, unknown>[];
  emitted_findings: Record<string, unknown>[];
  emitted_facts: Record<string, unknown>[];
  emitted_relations: Record<string, unknown>[];
  required_phases: string[];
  exceptions_applied: string[];
  warnings: string[];
}

const MISSING = Symbol("missing");

export function triNot(value: Truth): Truth {
  return value === "true" ? "false" : value === "false" ? "true" : "unknown";
}

export function triAll(values: Iterable<Truth>): Truth {
  let sawUnknown = false;
  for (const value of values) {
    if (value === "false") return "false";
    if (value === "unknown") sawUnknown = true;
  }
  return sawUnknown ? "unknown" : "true";
}

export function triAny(values: Iterable<Truth>): Truth {
  let sawUnknown = false;
  for (const value of values) {
    if (value === "true") return "true";
    if (value === "unknown") sawUnknown = true;
  }
  return sawUnknown ? "unknown" : "false";
}

export function getPath(data: unknown, dottedPath: string, defaultValue: unknown = MISSING): any {
  let current: any = data;
  for (const part of dottedPath.split(".")) {
    if (current && !Array.isArray(current) && typeof current === "object") {
      if (!Object.prototype.hasOwnProperty.call(current, part)) return defaultValue;
      current = current[part];
    } else if (Array.isArray(current) && /^\d+$/.test(part)) {
      const index = Number(part);
      if (index >= current.length) return defaultValue;
      current = current[index];
    } else {
      return defaultValue;
    }
  }
  return current;
}

export function setPath(data: RuntimeContext, dottedPath: string, value: unknown): void {
  const parts = dottedPath.split(".");
  let current: RuntimeContext = data;
  for (const part of parts.slice(0, -1)) {
    const child = current[part];
    if (!child || Array.isArray(child) || typeof child !== "object") current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]!] = value;
}

function contains(container: any, member: any): boolean {
  if (Array.isArray(container)) return container.some((item) => deepEqual(item, member));
  if (typeof container === "string" && typeof member === "string") return container.includes(member);
  if (container && typeof container === "object") return Object.prototype.hasOwnProperty.call(container, String(member));
  throw new TypeError("unsupported membership test");
}

function compare(actual: any, operator: string, expected?: any): Truth {
  if (operator === "exists") return actual === MISSING ? "false" : "true";
  if (actual === MISSING) return "unknown";
  try {
    let result: boolean;
    switch (operator) {
      case "equals": result = deepEqual(actual, expected); break;
      case "not_equals": result = !deepEqual(actual, expected); break;
      case "in": result = contains(expected, actual); break;
      case "not_in": result = !contains(expected, actual); break;
      case "gt": result = actual > expected; break;
      case "gte": result = actual >= expected; break;
      case "lt": result = actual < expected; break;
      case "lte": result = actual <= expected; break;
      case "contains": result = contains(actual, expected); break;
      default: return "unknown";
    }
    return result ? "true" : "false";
  } catch {
    return "unknown";
  }
}

export function evaluateCondition(
  condition: Record<string, any>,
  context: RuntimeContext,
  resolvers?: Record<string, Resolver>,
): Truth {
  const op = condition.op;
  if (op === "literal") return condition.value as Truth;
  if (op === "all") return triAll((condition.args as Record<string, any>[]).map((arg) => evaluateCondition(arg, context, resolvers)));
  if (op === "any") return triAny((condition.args as Record<string, any>[]).map((arg) => evaluateCondition(arg, context, resolvers)));
  if (op === "not") return triNot(evaluateCondition(condition.arg, context, resolvers));
  if (op === "fact") return compare(getPath(context, condition.path, MISSING), condition.operator, condition.value);
  if (op === "count") {
    const actual = getPath(context, condition.path, MISSING);
    if (actual === MISSING) return "unknown";
    let count: number;
    if (Array.isArray(actual) || typeof actual === "string") count = actual.length;
    else if (actual && typeof actual === "object") count = Object.keys(actual).length;
    else return "unknown";
    return compare(count, condition.operator, condition.value);
  }
  if (op === "relation_exists") {
    const relations = context.relations;
    if (relations === undefined || relations === null) return "unknown";
    const wanted = new Set<string>(condition.participant_refs || []);
    for (const relation of relations as Record<string, any>[]) {
      if (relation.relation_type !== condition.relation_type) continue;
      if (condition.status && relation.resolution_status !== condition.status) continue;
      const refs = new Set<string>((relation.participants || []).map((row: Record<string, any>) => row.ref_id));
      if (wanted.size && ![...wanted].every((ref) => refs.has(ref))) continue;
      return "true";
    }
    return "false";
  }
  if (op === "resolver") {
    const resolver = resolvers?.[condition.resolver];
    if (!resolver) return "unknown";
    const result = resolver(condition.args || {}, context);
    return result === "true" || result === "false" || result === "unknown" ? result : "unknown";
  }
  return "unknown";
}

export function resolveTemplate(value: any, context: RuntimeContext, missingPaths?: string[]): any {
  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, context, missingPaths));
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$path") {
      const resolved = getPath(context, value.$path, MISSING);
      if (resolved === MISSING) {
        missingPaths?.push(value.$path);
        return null;
      }
      return deepClone(resolved);
    }
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) output[key] = resolveTemplate(item, context, missingPaths);
    return output;
  }
  return deepClone(value);
}

function newEvaluation(ruleId: string): RuleEvaluation {
  return {
    rule_id: ruleId,
    result: "not_evaluated",
    condition_truth: "unknown",
    actions_executed: [],
    emitted_findings: [],
    emitted_facts: [],
    emitted_relations: [],
    required_phases: [],
    exceptions_applied: [],
    warnings: [],
  };
}

function executeAction(
  action: Record<string, any>,
  context: RuntimeContext,
  evaluation: RuleEvaluation,
  truthOverride?: Truth,
): void {
  const kind = action.action;
  const missingPaths: string[] = [];
  const payload = resolveTemplate(action.payload, context, missingPaths) as Record<string, any>;
  for (const path of missingPaths) evaluation.warnings.push(`template path missing: ${path}`);
  if (truthOverride && ["emit_finding", "emit_fact", "emit_relation"].includes(kind)) payload.truth = truthOverride;
  if (kind === "set_state") {
    if (typeof payload.path !== "string") evaluation.warnings.push("set_state action missing string path");
    else setPath(context.state ||= {}, payload.path, payload.value);
  } else if (kind === "emit_finding") {
    payload.source_rule_ids ??= [evaluation.rule_id];
    evaluation.emitted_findings.push(payload);
    (context.findings ||= []).push(payload);
  } else if (kind === "emit_fact") {
    payload.source_rule_id ??= evaluation.rule_id;
    evaluation.emitted_facts.push(payload);
    (context.emitted_facts ||= []).push(payload);
  } else if (kind === "emit_relation") {
    payload.source_rule_ids ??= [evaluation.rule_id];
    evaluation.emitted_relations.push(payload);
    (context.relations ||= []).push(payload);
  } else if (kind === "require_phase") {
    if (typeof payload.phase === "string") {
      evaluation.required_phases.push(payload.phase);
      (context.required_phases ||= []).push(payload.phase);
    } else evaluation.warnings.push("require_phase action missing string phase");
  } else if (kind === "tag_entity") {
    (context.entity_tags ||= []).push(payload);
  }
  evaluation.actions_executed.push({ action: kind, payload });
}

export function evaluateRule(
  rule: Record<string, any>,
  context: RuntimeContext,
  resolvers?: Record<string, Resolver>,
): RuleEvaluation {
  const evaluation = newEvaluation(rule.rule_id);
  if (!rule.enabled) { evaluation.result = "disabled"; return evaluation; }
  let truth = evaluateCondition(rule.when, context, resolvers);
  evaluation.condition_truth = truth;
  if (truth === "false") { evaluation.result = "not_fired"; return evaluation; }
  let selectedActions = rule.actions as Record<string, any>[];
  for (const exception of (rule.exceptions || []) as Record<string, any>[]) {
    if (evaluateCondition(exception.when, context, resolvers) !== "true") continue;
    evaluation.exceptions_applied.push(exception.exception_id);
    if (exception.effect === "skip") { evaluation.result = "suppressed_by_exception"; return evaluation; }
    if (exception.effect === "downgrade_to_unknown") truth = "unknown";
    if (exception.effect === "replace_actions") selectedActions = exception.replacement_actions || [];
  }
  if (truth === "unknown") {
    const policy = rule.unknown_policy || "propagate";
    if (policy === "skip") { evaluation.result = "skipped_unknown"; return evaluation; }
    if (policy === "propagate") { evaluation.result = "unknown"; return evaluation; }
    if (policy === "fire_as_unknown") {
      selectedActions.forEach((action) => executeAction(action, context, evaluation, "unknown"));
      evaluation.result = "fired_unknown";
      return evaluation;
    }
  }
  selectedActions.forEach((action) => executeAction(action, context, evaluation));
  evaluation.result = "fired";
  return evaluation;
}

export function sortRules(rules: Record<string, any>[], phaseOrder?: string[]): Record<string, any>[] {
  const index = new Map((phaseOrder || []).map((phase, i) => [phase, i]));
  const fallback = index.size;
  return [...rules].sort((a, b) => {
    const ap = index.get(a.phase) ?? fallback;
    const bp = index.get(b.phase) ?? fallback;
    if (ap !== bp) return ap - bp;
    const priority = Number(b.priority || 0) - Number(a.priority || 0);
    return priority || String(a.rule_id).localeCompare(String(b.rule_id), "en");
  });
}

export function evaluateRules(
  rules: Record<string, any>[],
  context: RuntimeContext,
  phaseOrder?: string[],
  resolvers?: Record<string, Resolver>,
): RuleEvaluation[] {
  return sortRules(rules, phaseOrder).map((rule) => evaluateRule(rule, context, resolvers));
}

export function evaluateRulesWithTrace(
  rules: Record<string, any>[],
  context: RuntimeContext,
  options: {
    schoolProfileId: string;
    chartId: string;
    stateId: string;
    phaseOrder?: string[];
    traceId?: string;
    resolvers?: Record<string, Resolver>;
  },
): { evaluations: RuleEvaluation[]; trace: Record<string, any> } {
  const evaluations: RuleEvaluation[] = [];
  const events: Record<string, any>[] = [];
  const warnings: string[] = [];
  let currentPhase: string | null = null;
  const addEvent = (event_type: string, result: string, extra: Record<string, any> = {}) => {
    events.push({ event_index: events.length, event_type, state_id: options.stateId, result, ...extra });
  };
  for (const rule of sortRules(rules, options.phaseOrder)) {
    const phase = rule.phase || "";
    if (phase !== currentPhase) { currentPhase = phase; addEvent("phase_started", "started", { phase }); }
    const evaluation = evaluateRule(rule, context, options.resolvers);
    evaluations.push(evaluation);
    addEvent("rule_evaluated", evaluation.result, {
      phase,
      rule_id: evaluation.rule_id,
      condition_truth: evaluation.condition_truth,
      details: {
        emitted_finding_count: evaluation.emitted_findings.length,
        emitted_fact_count: evaluation.emitted_facts.length,
        emitted_relation_count: evaluation.emitted_relations.length,
      },
    });
    for (const exceptionId of evaluation.exceptions_applied) addEvent("exception_applied", "applied", { phase, rule_id: evaluation.rule_id, details: { exception_id: exceptionId } });
    for (const action of evaluation.actions_executed) addEvent("action_executed", "executed", { phase, rule_id: evaluation.rule_id, details: action });
    for (const warning of evaluation.warnings) {
      warnings.push(`${evaluation.rule_id}: ${warning}`);
      addEvent("warning", "warning", { phase, rule_id: evaluation.rule_id, details: { message: warning } });
    }
  }
  const trace = {
    schema_version: "1.0.0",
    trace_id: options.traceId || `trace.${options.chartId}.${options.schoolProfileId.split("@", 1)[0]}`,
    chart_id: options.chartId,
    school_profile_id: options.schoolProfileId,
    initial_state_id: options.stateId,
    events,
    final_state_id: options.stateId,
    warnings,
  };
  return { evaluations, trace };
}

export function resolverMapFromContext(context: RuntimeContext): Record<string, Resolver> {
  const table = context.resolver_results || {};
  return new Proxy({}, {
    get: (_target, name: string) => (args: Record<string, unknown>) => {
      const value = table[name];
      if (typeof value === "string") return value as Truth;
      if (value && typeof value === "object") {
        const exact = value[stableStringify(args)];
        if (typeof exact === "string") return exact as Truth;
        if (typeof value.default === "string") return value.default as Truth;
      }
      return "unknown";
    },
  }) as Record<string, Resolver>;
}
