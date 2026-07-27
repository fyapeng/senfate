"""Reference engines for the Bazi traditional-rule reconstruction project."""

from .classical_ziping_w02 import W02_RESOLVERS, compile_w02_evidence, make_rule_context
from .classical_ziping_w03 import (
    W03_RESOLVERS,
    build_state_chain,
    build_state_ir,
    compile_climate_evidence,
    compile_qi_flow_evidence,
    compile_remedy_evidence,
    compile_w03_evidence,
    make_rule_context_w03,
)
from .shao_weihua_w04 import (
    W04_RESOLVERS,
    build_state_chain_w04,
    build_state_ir_w04,
    compile_w04_evidence,
    make_rule_context as make_rule_context_w04,
)
from .li_hanchen_w05 import (
    W05_RESOLVERS,
    build_state_chain_w05,
    build_state_ir_w05,
    compile_w05_evidence,
    make_rule_context as make_rule_context_w05,
)
from .duan_li_xiang_w06_phase2 import (
    W06_RESOLVERS,
    build_state_chain_w06,
    build_state_ir_w06,
    compile_w06_evidence,
    make_rule_context as make_rule_context_w06,
)
from .reference_dsl import Truth, evaluate_rule, evaluate_rules, evaluate_rules_with_trace

__all__ = [
    "Truth", "W02_RESOLVERS", "W03_RESOLVERS", "W04_RESOLVERS", "W05_RESOLVERS", "W06_RESOLVERS", "compile_w02_evidence", "compile_w03_evidence",
    "compile_climate_evidence", "compile_qi_flow_evidence", "compile_remedy_evidence", "compile_w04_evidence", "compile_w05_evidence", "compile_w06_evidence",
    "build_state_ir", "build_state_chain", "build_state_ir_w04", "build_state_chain_w04", "build_state_ir_w05", "build_state_chain_w05", "build_state_ir_w06", "build_state_chain_w06", "make_rule_context", "make_rule_context_w03", "make_rule_context_w04", "make_rule_context_w05", "make_rule_context_w06",
    "evaluate_rule", "evaluate_rules", "evaluate_rules_with_trace",
]

# W07 comparison and neutral-output modules are intentionally importable directly.
