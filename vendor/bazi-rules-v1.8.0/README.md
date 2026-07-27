# 八字传统规则工程 v1.8.0 Portable

这是用于其他项目直接接入的轻量运行包。包内保留了四套流派规则、全部现有规范化语料与检索块、Profile、Schema、解释层、Python/TypeScript 运行时以及现成 SQLite 索引。

## 四套体系

- 传统子平经典体系
- 邵伟华现代综合体系
- 李涵辰体系
- 段氏理象体系

## 活跃规则

- 传统子平：391
- 邵伟华体系：345
- 李涵辰体系：325
- 段氏理象体系：306
- 合计：1367

## 语料保留范围

上游工程没有单独的 `corpus/raw/` 扫描原件目录。本包完整保留当前工程中全部可用语料资产：

- `corpus/normalized/`：规范化全文；
- `corpus/chunks/`：可检索语料块；
- `01_CORPUS_MANIFEST.json`：语料来源与哈希；
- `02_CONVERSION_REPORT.md`：转换与质量说明；
- `03_SOURCE_USAGE_GUIDE.md`：来源使用规范。

## 直接运行

```bash
node runtime/ts/dist/src/cli.js doctor
node runtime/ts/dist/src/cli.js analyze --chart schemas/examples/chart_ir.valid.json
```

也可使用：

```bash
npm run doctor
npm run serve
```

## 推荐接入目录

- `rules/`
- `profiles/`
- `schemas/`
- `ontology/`
- `interpretations/`
- `engine/`
- `runtime/`
- `corpus/`

普通输出应按四派分别显示。跨流派比较仅作并列展示，不做多数投票。
