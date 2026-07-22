# 理论函数流水线

## 原则

每个函数声明输入、输出、依赖、模型 profile、来源和失败条件。下游只能消费上游发布的稳定对象，不能重新查询原始命盘图形成旁路。

```text
01 calendar.normalize             历法与时空输入
02 ontology.pillars               干支与四柱
03 ontology.elements              五行与阴阳
04 ontology.hidden-stems          藏干
05 ontology.ten-gods              十神
06 ontology.generation-control    生克泄耗
07 ontology.relation-candidates   干支关系候选
08 ontology.root-exposure         通根与透干
09 structure.element-measure      五行动态测度
10 structure.strength             日主强弱
11 structure.pattern              格局
12 structure.climate              调候
13 structure.balancing            扶抑与用神候选
14 structure.reference-rewrites   古籍结构改写
15 resolution.relations           关系裁决
16 resolution.normal-form         结构—关系正规形
17 semantic.kinship               六亲角色
18 semantic.topics                主题贡献
19 semantic.events                事件假设
20 measurement.vector             透明向量测度
```

## 动态状态

原局包含年、月、日、时四个柱。大运状态在四柱上加入当前大运柱；年度状态同时加入当前大运柱和流年柱。每个阶段从全部现存柱重新计算测度、强弱与关系候选，不沿用上一阶段的局部增量。年度缺少所属大运时失败关闭。

关系候选目前覆盖天干五合、六合、冲、害、破、刑、三合与三会。加权裁决结果必须成为 `effective`、`transformed`、`contested` 或 `blocked`；候选状态不能发布到主题层。每个分数都保留基础优先级、完整性、月令支持、透出、根、当前层六项分解。

```text
DynamicChartState
→ relation candidates
→ ReferenceNormalFormPhaseResult (stable only)
→ resolved reference features
→ TopicFunction conditions
→ topic contribution certificate
→ finite signed topic measure
→ phase × domain × canonical effect operator
→ source-level event hypothesis
```

The public annual runtime now implements this chain. Its topic certificate
includes the compiler disposition ledger and source line references. Event
hypotheses consume normalized effect tuples attached to activated sources and
their signed topic contribution. They do not query raw chart edges, source text
or unresolved candidates.

## 终止语义

正规形求值必须有确定的状态指纹、迭代上限和循环检测。只有 `stable` 可以进入六亲与主题层。`cycle` 和 `limit-reached` 失败关闭，不选择任意中间轮次充当结果。

## 规则归位

37,231 条来源记录必须进入以下一种状态：

- executable：条件与效应可由当前规范对象完整表达；
- deferred：缺少规范特征、阈值或事件谓词；
- contested：存在尚未裁决的语义冲突；
- evidence：解释、定义或旁证；
- fixture：可形成回归测试的完整命例。

任何规则都不得静默丢失。统计数量由重算审计产生，不写成人工维护的目标配额。

## 数学合同

状态空间、测度、阶段算子、主题泛函和贡献证书的正式定义见 `FORMAL_MODEL.md`。实现层使用闭区间表达出生时空不确定性，使用有限有符号测度表达多主题贡献，并将正规形稳定性作为主题层的定义域约束。
