# 规则目录

规则使用 `RuleIR` JSON 表示，规则 ID 必须包含语义版本。

- W01：18 条 `sample` 规则；
- W02：124 条传统子平格局、旺衰与从化规则；
- W03：217 条传统子平气势、调候、病药与岁运规则；
- W04：300 条邵伟华体系规则；
- W05：296 条李涵辰体系规则。

W05 分组：`procedure` 24、`relations` 82、`classification` 52、`useful_party` 36、`virtual_real` 18、`transform` 26、`temporal` 42、`kinship` 16。

所有正式规则均绑定 SourceRef。`reviewed` 表示已完成逻辑和当前文本上下文核对，不表示通过权威纸本校勘或达到 `production`。

确定性生成与编译：

```bash
python scripts/build_w05_rules.py
python scripts/compile_rule_packs.py
python scripts/build_w05_audits.py
```

规则语义见 `DSL_SPEC.md`，各窗口的边界和 resolver 见对应 `docs/` 与 `profiles/` 文件。
