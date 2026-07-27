"""Minimal reference interpreter for RuleIR v1.0.

This module exists to freeze W01 semantics and provide executable tests. It is not
intended to be the final W08 runtime. The implementation deliberately supports
open-world, three-valued logic and preserves unhandled conflicts.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Iterable, Mapping, MutableMapping


class Truth(str, Enum):
    TRUE = "true"
    FALSE = "false"
    UNKNOWN = "unknown"


def tri_not(value: Truth) -> Truth:
    if value is Truth.TRUE:
        return Truth.FALSE
    if value is Truth.FALSE:
        return Truth.TRUE
    return Truth.UNKNOWN


def tri_all(values: Iterable[Truth]) -> Truth:
    saw_unknown = False
    for value in values:
        if value is Truth.FALSE:
            return Truth.FALSE
        if value is Truth.UNKNOWN:
            saw_unknown = True
    return Truth.UNKNOWN if saw_unknown else Truth.TRUE


def tri_any(values: Iterable[Truth]) -> Truth:
    saw_unknown = False
    for value in values:
        if value is Truth.TRUE:
            return Truth.TRUE
        if value is Truth.UNKNOWN:
            saw_unknown = True
    return Truth.UNKNOWN if saw_unknown else Truth.FALSE


_MISSING = object()


def get_path(data: Any, path: str, default: Any = _MISSING) -> Any:
    """Resolve a dot-separated path in nested dict/list structures."""
    current = data
    for part in path.split("."):
        if isinstance(current, Mapping):
            if part not in current:
                return default
            current = current[part]
        elif isinstance(current, list) and part.isdigit():
            index = int(part)
            if index >= len(current):
                return default
            current = current[index]
        else:
            return default
    return current


def set_path(data: MutableMapping[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    current: MutableMapping[str, Any] = data
    for part in parts[:-1]:
        child = current.get(part)
        if not isinstance(child, MutableMapping):
            child = {}
            current[part] = child
        current = child
    current[parts[-1]] = value


def _compare(actual: Any, operator: str, expected: Any = None) -> Truth:
    if operator == "exists":
        return Truth.FALSE if actual is _MISSING else Truth.TRUE
    if actual is _MISSING:
        return Truth.UNKNOWN
    try:
        if operator == "equals":
            result = actual == expected
        elif operator == "not_equals":
            result = actual != expected
        elif operator == "in":
            result = actual in expected
        elif operator == "not_in":
            result = actual not in expected
        elif operator == "gt":
            result = actual > expected
        elif operator == "gte":
            result = actual >= expected
        elif operator == "lt":
            result = actual < expected
        elif operator == "lte":
            result = actual <= expected
        elif operator == "contains":
            result = expected in actual
        else:
            return Truth.UNKNOWN
    except (TypeError, ValueError):
        return Truth.UNKNOWN
    return Truth.TRUE if result else Truth.FALSE


Resolver = Callable[[dict[str, Any], dict[str, Any]], Truth]


def evaluate_condition(
    condition: dict[str, Any],
    context: dict[str, Any],
    resolvers: Mapping[str, Resolver] | None = None,
) -> Truth:
    op = condition.get("op")
    if op == "literal":
        return Truth(condition["value"])
    if op == "all":
        return tri_all(evaluate_condition(arg, context, resolvers) for arg in condition["args"])
    if op == "any":
        return tri_any(evaluate_condition(arg, context, resolvers) for arg in condition["args"])
    if op == "not":
        return tri_not(evaluate_condition(condition["arg"], context, resolvers))
    if op == "fact":
        actual = get_path(context, condition["path"], _MISSING)
        return _compare(actual, condition["operator"], condition.get("value"))
    if op == "count":
        actual = get_path(context, condition["path"], _MISSING)
        if actual is _MISSING:
            return Truth.UNKNOWN
        try:
            count = len(actual)
        except TypeError:
            return Truth.UNKNOWN
        return _compare(count, condition["operator"], condition["value"])
    if op == "relation_exists":
        relations = context.get("relations")
        if relations is None:
            return Truth.UNKNOWN
        wanted_type = condition["relation_type"]
        wanted_status = condition.get("status")
        wanted_participants = set(condition.get("participant_refs", []))
        for relation in relations:
            if relation.get("relation_type") != wanted_type:
                continue
            if wanted_status and relation.get("resolution_status") != wanted_status:
                continue
            refs = {p.get("ref_id") for p in relation.get("participants", [])}
            if wanted_participants and not wanted_participants.issubset(refs):
                continue
            return Truth.TRUE
        return Truth.FALSE
    if op == "resolver":
        if not resolvers or condition["resolver"] not in resolvers:
            return Truth.UNKNOWN
        result = resolvers[condition["resolver"]](condition.get("args", {}), context)
        return result if isinstance(result, Truth) else Truth(str(result))
    return Truth.UNKNOWN


def resolve_template(
    value: Any,
    context: dict[str, Any],
    missing_paths: list[str] | None = None,
) -> Any:
    """Resolve ``{"$path": "..."}`` templates and record missing paths."""
    if isinstance(value, dict):
        if set(value) == {"$path"}:
            path = value["$path"]
            resolved = get_path(context, path, _MISSING)
            if resolved is _MISSING:
                if missing_paths is not None:
                    missing_paths.append(path)
                return None
            return deepcopy(resolved)
        return {
            key: resolve_template(item, context, missing_paths)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [resolve_template(item, context, missing_paths) for item in value]
    return deepcopy(value)


@dataclass
class RuleEvaluation:
    rule_id: str
    result: str
    condition_truth: Truth
    actions_executed: list[dict[str, Any]] = field(default_factory=list)
    emitted_findings: list[dict[str, Any]] = field(default_factory=list)
    emitted_facts: list[dict[str, Any]] = field(default_factory=list)
    emitted_relations: list[dict[str, Any]] = field(default_factory=list)
    required_phases: list[str] = field(default_factory=list)
    exceptions_applied: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "result": self.result,
            "condition_truth": self.condition_truth.value,
            "actions_executed": self.actions_executed,
            "emitted_findings": self.emitted_findings,
            "emitted_facts": self.emitted_facts,
            "emitted_relations": self.emitted_relations,
            "required_phases": self.required_phases,
            "exceptions_applied": self.exceptions_applied,
            "warnings": self.warnings,
        }


def _execute_action(
    action: dict[str, Any],
    context: dict[str, Any],
    evaluation: RuleEvaluation,
    truth_override: Truth | None = None,
) -> None:
    kind = action["action"]
    missing_paths: list[str] = []
    payload = resolve_template(action["payload"], context, missing_paths)
    for path in missing_paths:
        evaluation.warnings.append(f"template path missing: {path}")
    if truth_override is not None and kind in {"emit_finding", "emit_fact", "emit_relation"}:
        payload["truth"] = truth_override.value

    if kind == "set_state":
        path = payload.get("path")
        if not isinstance(path, str):
            evaluation.warnings.append("set_state action missing string path")
            return
        set_path(context.setdefault("state", {}), path, payload.get("value"))
    elif kind == "emit_finding":
        payload.setdefault("source_rule_ids", [evaluation.rule_id])
        evaluation.emitted_findings.append(payload)
        context.setdefault("findings", []).append(payload)
    elif kind == "emit_fact":
        payload.setdefault("source_rule_id", evaluation.rule_id)
        evaluation.emitted_facts.append(payload)
        context.setdefault("emitted_facts", []).append(payload)
    elif kind == "emit_relation":
        payload.setdefault("source_rule_ids", [evaluation.rule_id])
        evaluation.emitted_relations.append(payload)
        context.setdefault("relations", []).append(payload)
    elif kind == "require_phase":
        phase = payload.get("phase")
        if isinstance(phase, str):
            evaluation.required_phases.append(phase)
            context.setdefault("required_phases", []).append(phase)
        else:
            evaluation.warnings.append("require_phase action missing string phase")
    elif kind == "tag_entity":
        context.setdefault("entity_tags", []).append(payload)
    evaluation.actions_executed.append({"action": kind, "payload": payload})


def evaluate_rule(
    rule: dict[str, Any],
    context: dict[str, Any],
    resolvers: Mapping[str, Resolver] | None = None,
) -> RuleEvaluation:
    evaluation = RuleEvaluation(rule_id=rule["rule_id"], result="not_evaluated", condition_truth=Truth.UNKNOWN)
    if not rule.get("enabled", False):
        evaluation.result = "disabled"
        return evaluation

    truth = evaluate_condition(rule["when"], context, resolvers)
    evaluation.condition_truth = truth
    if truth is Truth.FALSE:
        evaluation.result = "not_fired"
        return evaluation

    selected_actions = rule["actions"]
    for exception in rule.get("exceptions", []):
        exception_truth = evaluate_condition(exception["when"], context, resolvers)
        if exception_truth is not Truth.TRUE:
            continue
        evaluation.exceptions_applied.append(exception["exception_id"])
        effect = exception["effect"]
        if effect == "skip":
            evaluation.result = "suppressed_by_exception"
            return evaluation
        if effect == "downgrade_to_unknown":
            truth = Truth.UNKNOWN
        if effect == "replace_actions":
            selected_actions = exception.get("replacement_actions", [])

    if truth is Truth.UNKNOWN:
        policy = rule.get("unknown_policy", "propagate")
        if policy == "skip":
            evaluation.result = "skipped_unknown"
            return evaluation
        if policy == "propagate":
            evaluation.result = "unknown"
            return evaluation
        if policy == "fire_as_unknown":
            for action in selected_actions:
                _execute_action(action, context, evaluation, truth_override=Truth.UNKNOWN)
            evaluation.result = "fired_unknown"
            return evaluation

    for action in selected_actions:
        _execute_action(action, context, evaluation)
    evaluation.result = "fired"
    return evaluation


def _sort_rules(
    rules: Iterable[dict[str, Any]], phase_order: list[str] | None = None
) -> list[dict[str, Any]]:
    order_index = {phase: index for index, phase in enumerate(phase_order or [])}
    return sorted(
        list(rules),
        key=lambda rule: (
            order_index.get(rule.get("phase", ""), len(order_index)),
            -int(rule.get("priority", 0)),
            rule["rule_id"],
        ),
    )


def evaluate_rules(
    rules: Iterable[dict[str, Any]],
    context: dict[str, Any],
    phase_order: list[str] | None = None,
    resolvers: Mapping[str, Resolver] | None = None,
) -> list[RuleEvaluation]:
    return [
        evaluate_rule(rule, context, resolvers)
        for rule in _sort_rules(rules, phase_order)
    ]


def evaluate_rules_with_trace(
    rules: Iterable[dict[str, Any]],
    context: dict[str, Any],
    *,
    school_profile_id: str,
    chart_id: str,
    state_id: str,
    phase_order: list[str] | None = None,
    trace_id: str | None = None,
    resolvers: Mapping[str, Resolver] | None = None,
) -> tuple[list[RuleEvaluation], dict[str, Any]]:
    """Evaluate rules and emit a minimal TraceIR-conformant event stream.

    W01 does not construct a complete StateIR runtime. The initial and final
    state IDs are therefore identical unless a later runtime wraps this
    function in an explicit state transition.
    """
    sorted_rules = _sort_rules(rules, phase_order)
    evaluations: list[RuleEvaluation] = []
    events: list[dict[str, Any]] = []
    warnings: list[str] = []
    current_phase: str | None = None

    def add_event(event_type: str, result: str, **kwargs: Any) -> None:
        event = {
            "event_index": len(events),
            "event_type": event_type,
            "state_id": state_id,
            "result": result,
            **kwargs,
        }
        events.append(event)

    for rule in sorted_rules:
        phase = rule.get("phase", "")
        if phase != current_phase:
            current_phase = phase
            add_event("phase_started", "started", phase=phase)
        evaluation = evaluate_rule(rule, context, resolvers)
        evaluations.append(evaluation)
        add_event(
            "rule_evaluated",
            evaluation.result,
            phase=phase,
            rule_id=evaluation.rule_id,
            condition_truth=evaluation.condition_truth.value,
            details={
                "emitted_finding_count": len(evaluation.emitted_findings),
                "emitted_fact_count": len(evaluation.emitted_facts),
                "emitted_relation_count": len(evaluation.emitted_relations),
            },
        )
        for exception_id in evaluation.exceptions_applied:
            add_event(
                "exception_applied",
                "applied",
                phase=phase,
                rule_id=evaluation.rule_id,
                details={"exception_id": exception_id},
            )
        for action in evaluation.actions_executed:
            add_event(
                "action_executed",
                "executed",
                phase=phase,
                rule_id=evaluation.rule_id,
                details=action,
            )
        for warning in evaluation.warnings:
            warnings.append(f"{evaluation.rule_id}: {warning}")
            add_event(
                "warning",
                "warning",
                phase=phase,
                rule_id=evaluation.rule_id,
                details={"message": warning},
            )

    trace = {
        "schema_version": "1.0.0",
        "trace_id": trace_id or f"trace.{chart_id}.{school_profile_id.split('@', 1)[0]}",
        "chart_id": chart_id,
        "school_profile_id": school_profile_id,
        "initial_state_id": state_id,
        "events": events,
        "final_state_id": state_id,
        "warnings": warnings,
    }
    return evaluations, trace
