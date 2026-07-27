# W02 Resolver 合同

W02 规则的条件字段只读取 `facts.classical_ziping.w02.*`。证据生产者分为两类：

- `engine.classical_ziping_w02`：从 `ChartIR` 与公开参数直接编译；
- `explicit_source_judgment`：涉及有效刑冲、成败、有情有力、所从之神成势等来源依赖判断，必须由可追溯 resolver 或显式注释提供。

当前注册 resolver：

- `classical_ziping.pattern.resolve_month_command`：月令候选与变化路径；
- `classical_ziping.pattern.resolve_mixed_storage`：杂气透会及冲刑条件；
- `classical_ziping.strength.unique_resolution`：只在相对证据清晰时确认唯一强弱类别；
- `classical_ziping.follow.resolve_dominance`：确认所从对象、根气与成势条件；
- `classical_ziping.transform.true_transform`：综合日干五合、化神旺衰、根苗、争合与损害条件。

约束：

1. resolver 不得把缺失路径当作否定；
2. resolver 使用的阈值必须来自 Profile；
3. resolver 不得覆盖来源冲突，只能追加候选、确认或否决事实；
4. 每次判断须进入 TraceIR，记录输入事实、参数、规则或来源；
5. 真化确认后产生的新状态只在流派命名空间内生效，不能改写公共 ChartIR；
6. W02 只处理 `natal`，大运与流年重算由 W03 扩展。
