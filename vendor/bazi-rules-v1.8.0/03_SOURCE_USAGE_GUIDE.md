# 语料使用指南

## 1. 检索优先顺序

1. 先在 `corpus/chunks/corpus_chunks.jsonl` 按作品、章节和关键词召回；
2. 打开 `corpus/normalized/<work_id>.md` 查看完整上下文；
3. 依据 `src:<work_id>:Lxxxxxx-Lyyyyyy` 锚点定位规范化来源行；
4. 核对 SourceRef 中的 `corpus_content_version` 与 `normalized_sha256`；
5. 遇到 OCR 疑点时，使用固定外部原始语料包或扫描页复核。当前 Light 快照不重复包含 `corpus/raw/`。

## 2. 规则来源层级

每次抽取都要判断文本属于作者正文、原注、后注、引文、命例、编辑说明或网站简介。引用他书的文字不得自动算作当前作者体系规则。

## 3. 来源角色

- `primary_classical`：传统模型的重要一手文本；
- `primary_classical_encyclopedic`：汇编证据库；
- `primary_author_system`：现代作者体系主文本；
- `auxiliary_unverified`：作者或版本未核定的辅助材料。

## 4. SourceRef 最低合同

启用规则的每个来源必须包含作品 ID、规范化路径、检索块、来源行范围、锚点、精确引文、章节路径、文本层级、权威层级、上下文核验状态、OCR 状态、语料内容版本和规范化 Markdown SHA-256。相同 `source_ref_id` 不得映射到不同内容。

## 5. OCR 审查重点

进入规则条件的干支、十神、强弱词、否定词、数量、先后词、条件词和例外词必须逐段核验。不得静默修订原文；修订要记录原字符、修订字符、理由和审核状态。W01 中 OCR 样板只达到 `context_only`，不得直接升级为 production。W04 的《四柱预测学》规则同样保持 `context_only` 或 `scan_required`；丁日辰月条必须回看扫描页。

## 6. 禁止操作

- 不把网站简介当作原著规则；
- 不把命例中的一次性解释直接推广为一般规则；
- 不用同名概念跨流派覆盖；
- 不根据常识补写原文没有规定的条件；
- 不删除相互矛盾的原文；
- 不把传统断语转述为科学事实。


## 7. 现代作者体系来源权限

现代作者体系必须区分主文本与辅助讲义。W04 的正式来源只允许 `modern.shao_si_zhu_yu_ce_xue`；`aux.si_zhu_yu_ce_xue_jiang_yi` 可用于检索或提出待核问题，但不能成为正式规则的唯一来源。W05、W06 也必须在各自窗口重新冻结主文本权限，不能因内容相似而跨作者合并。

## 8. W05 来源权限与缺失算法

W05 正式来源只允许 `modern.li_hanchen_ba_zi_yu_ce_zhen_zong`。正文明确指向学习班、配套资料或以后出版物的算法，只登记缺失状态，不从命例、网络口诀或其他作者文本补齐。25 个运年十神矩阵单元中，程序推导项必须标记 `derived`，不能描述为逐条原文。

## W07 比较层来源说明

W07 不新增传统文本规则，也不以新的网络或二手材料补充流派内容。Crosswalk 只引用既有 FindingIR 谓词和 RuleIR 标识；任何用户层 claim 均可沿 FindingIR、RuleIR、SourceRef 回查原有语料。Crosswalk 覆盖率不等于原著覆盖率或科学有效性。
