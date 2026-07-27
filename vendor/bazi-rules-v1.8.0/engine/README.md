# Python 参考实现与兼容层

流派编译器：

- `reference_dsl.py`：RuleIR v1.0 三值开放世界语义参考实现；
- `classical_ziping_w02.py`、`classical_ziping_w03.py`：传统子平；
- `shao_weihua_w04.py`：邵伟华体系；
- `li_hanchen_w05.py`：李涵辰体系；
- `duan_li_xiang_w06.py`、`duan_li_xiang_w06_phase2.py`：段氏理象；
- `comparison_w07.py`、`neutral_output_w07.py`：七状态比较与中性输出；
- `orchestrator_w08.py`：四套正式 Profile 的端到端编排和 TypeScript 桥接入口。

W08 采用混合运行架构。TypeScript 实现通用 RuleIR、CLI/API、比较、中性输出和 SQLite 查询；流派专用 resolver 保留在经回归冻结的 Python 兼容层，避免以不完整的通用算法替代各流派已审计语义。

安装与测试：

```bash
python -m pip install -e .
python -m pytest -q
```

## v1.7 终局与主题层

- `school_verdict_v17.py`：在各流派事实编译与 RuleIR 执行之后形成流派内终局裁决；
- `school_theme_v17.py`：以终局裁决为前置条件生成五类流派专用主题；
- `public_output_v11.py`：只负责自然语言排版，不在渲染阶段新增推断。
