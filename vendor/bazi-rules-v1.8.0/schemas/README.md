# Schema 合同

核心 Schema：

- `chart-ir.schema.json`：排盘后命盘、藏干、十神映射、大运与流年；
- `fact-ir.schema.json`、`relation-ir.schema.json`：事实与候选/生效关系；
- `rule-ir.schema.json`：三值条件、动作、例外、冲突和来源；
- `school-profile.schema.json`：流派模块、阶段和 resolver 配置；
- `state-ir.schema.json`、`finding-ir.schema.json`、`trace-ir.schema.json`：状态、结论与轨迹；
- `school-verdict-ir.schema.json`：单一流派的终局裁决、主要取用、否决路线与来源；
- `school-theme-ir.schema.json`：流派专用的性格、学习、财富、事业与关系主题；
- `comparison-ir.schema.json`：跨流派七状态比较；
- `neutral-output-ir.schema.json`：中性用户输出、来源链和阻断状态；
- `runtime-analysis.schema.json`：W08 端到端运行包，包含输入、各 Profile 结果、比较、输出与运行元数据；
- `source-ref.schema.json`、`rule-pack.schema.json`、`common.schema.json`：来源、规则包和共享类型。

`examples/` 提供有效实例，`instance_registry.json` 登记必须校验的样板、规则包、配置和 W08 运行输出。

运行：

```bash
python scripts/validate_project.py
```

JSON Schema 约束结构；命名空间所有权、语料哈希、十神推导、来源回指、编译产物、W02—W08 窗口合同和 SQLite 派生数据由 `scripts/validate_project.py` 与测试共同校验。
