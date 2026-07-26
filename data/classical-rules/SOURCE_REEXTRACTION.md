# 原文重抽取

`pnpm --filter @senfate/rules extract:source-rules` 只读取 `data/classical-corpus/sources` 下的七本原始 TXT，不读取历史的 37,231 条压缩规则库。

输出文件 `source-reextracted-passages.v1.json` 保存每一条非空原文行、行号、书籍筛选模式、上下文以及是否为案例。案例、序言、网址和编辑说明会保留为可审计语料，但不会进入 `candidates`。

候选规则仍是待审语料，并非运行规则。它们必须同时具备可编码的条件信号与结论信号；条件信号完整保留“透”“不见”“成局”等原文语义，待规则运行时的条件体系逐项承接。
