# W03 Resolver 合同

W03 Profile 登记四个 resolver：

1. `classical_ziping.qi_flow.bridge_effective`：通关候选出现且未被显式阻断时为 true；信息缺失为 unknown。
2. `classical_ziping.climate.recipe_resolved`：存在已确认调候候选时为 true；候选只藏、缺失或未完成条件判断时不得自动确认。
3. `classical_ziping.remedy.medicine_matches_disease`：已选焦点中存在病候选、有效药且药不过重时为 true。
4. `classical_ziping.temporal.state_recompiled`：当前状态事实与关系均完成重编译后为 true。

所有 resolver 都必须遵守三值逻辑。显式注释只允许带来源或调用者溯源地覆盖证据字段，不得静默修改公共本体或父状态。
