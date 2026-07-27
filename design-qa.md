# Design QA — SenFate Four-Schools Workbench

## Comparison target and evidence

- Source visual truth: `C:\Users\ENAN\.codex\generated_images\019fa347-6a20-7260-bdf2-4c9d1ed96625\exec-7526e51c-c409-41d2-bf25-2e0a5ce20142.png`.
- Source pixels: 1488 × 1058.
- Browser-rendered implementation capture: `http://localhost:4345/?session=89cf7cce-877f-44be-ae15-27b60486288e`.
- Implementation state: populated, certified 1990-06-15 10:30 / Asia/Shanghai chart; traditional Ziping selected; 2026 丙午 / 戊寅 selected; right audit drawer open.
- Desktop comparison viewport: 1488 × 1058 CSS px, device scale factor 1. The in-app-browser preview scales its returned image to the desktop surface; comparison was made at the same CSS viewport and route state.
- Responsive verification: 390 × 844 CSS px. `scrollWidth === clientWidth`; no horizontal overflow.
- Full-view evidence: source and populated implementation were opened in the same QA pass before this report was written.
- Focused-region evidence: inspected the left certified-profile rail, four-school tab strip, OHLC annual chart, selected 2026 state, and right audit drawer.

## Comparison history

### Iteration 1 — blocked

- Earlier P1: reloading at the comparison viewport lost the in-memory analysis payload and rendered an empty overview.
- Earlier P2: at a narrow viewport the three-column desktop composition could not be validated in the populated state.
- Fix: added a shareable analysis-session endpoint, global session hydration, session-preserving navigation, and an explicit no-year guard.

### Iteration 2 — passed

- Post-fix evidence: the implementation rendered the certified profile, 2026 annual chart, four tabs, and open audit drawer at the reference viewport. Browser console errors: 0.
- Post-fix responsive evidence: populated 2026 overview at 390 × 844 had no horizontal overflow. Browser console errors: 0.

## Findings

No actionable P0, P1, or P2 differences remain for the selected workbench composition.

- [P3] The reference uses a small circular brand seal and skeleton-like chart variation; the implementation uses the textual `SenFate` brand and its OHLC geometry follows the actual rule output.
  - Evidence: the reference is a visual mock; the implemented candlesticks encode real annual open/high/low/close values and disclose those values below the chart.
  - Impact: no loss of hierarchy or interaction. Replacing the values with visually varied placeholders would violate the product requirement for non-fabricated charts.
  - Follow-up: if a final brand asset is supplied, replace the text mark without changing navigation or layout.

## Required fidelity surfaces

- Fonts and typography: display headings use a high-contrast Chinese serif stack, with a compact sans-serif UI layer; large annual heading, tabs, metadata, and audit hierarchy are readable without truncation at the evaluated desktop state.
- Spacing and layout rhythm: the fixed left rail, broad central work area, and fixed-width right drawer preserve the reference’s spatial grouping; tab strip and chart have deliberate separation rather than dense stacked cards.
- Colors and visual tokens: white surfaces, hairline gray dividers, muted copy, and the restrained blue active state map consistently to the reference’s palette. Selected school, selected year, rule links, and audit counts use the same blue token.
- Image quality and asset fidelity: no raster imagery is required by the selected reference beyond UI iconography. The implementation uses the installed icon library for functional metadata icons; it contains no generated placeholder imagery or hand-drawn SVG substitutes.
- Copy and content: workbench content is certified chart data, actual four-school verdicts, annual contexts, trace counts, and source-linked rule IDs. No synthetic score, weighted conclusion, or placeholder K-line data is rendered.
- Icons and shapes: metadata icons use a single icon family; rails, dividers, outlined tabs, drawer panels, and focus/selected states follow the reference’s quiet outlined treatment.
- Interaction and accessibility: school tabs and annual candles are native buttons; each candle has an accessible OHLC label. The calculation form has visible labels. Selected states have both color and outline/border treatment.

## Primary interactions verified

1. Create certified chart → run four-school analysis → redirected populated workbench.
2. Switch school → independently rendered school result and trace.
3. Select annual year from time line → matching annual header and audit chain reload.
4. Overview → timeline → selected annual audit → overview data remains synchronized.
5. School detail → actual fired rule → structural logic and source-boundary detail page.
6. Rule search filters vendor-sourced rule results.

## Implementation checklist completed

- [x] Same-state reference comparison at desktop viewport.
- [x] Certified chart and four-school data path.
- [x] OHLC chart, year selection, and audit drawer.
- [x] Timeline, schools, school detail, rules, rule detail, and calculation pages.
- [x] Session-safe navigation and mobile overflow check.
- [x] Browser console checked during the primary flows.

## Follow-up polish

- Optional final brand seal if an approved asset becomes available.

## Iteration 3 — original-chart and reading-layer refinement

- Implementation capture: `http://localhost:4347/?session=1cdb22ee-6604-45f7-8782-b3c6b14328ae`.
- State: certified 1990-06-15 10:30 / Asia/Shanghai chart, 2026 丙午 / 戊寅, traditional Ziping selected.
- Browser evidence: original-chart heading, four pillar cards, stem ten-gods, hidden-stem ten-gods, five-element coloring, Na Yin, twelve-growth stage, and 格局 / 旺衰 / 调候 / 用神 cards all rendered; console errors: 0.
- Rule-library capture: `http://localhost:4347/rules`.
- Browser evidence: default cards display Chinese rule titles, explanatory text, readable scope/phase, and Chinese book titles; Rule IDs remain only as link targets and within the opt-in technical audit disclosure.

### Fidelity review

- Typography: the new pillar cards retain the serif hierarchy for 干支 and compact sans-serif labels for ten-gods and metadata; no visible truncation at the inspected desktop size.
- Spacing/layout: the left rail is now solely a certificate rail, removing the duplicated four-pillar block; the central region presents the original chart before school selection and annual charting.
- Colors/tokens: five-element colors are limited to the stems and hidden stems, while all structural controls retain the restrained blue/gray visual system.
- Image/asset fidelity: no new image assets are introduced. The target is a desktop workbench visual and the product-specific original-chart cards replace reference placeholder content with real data.
- Copy/content: Na Yin, twelve-growth stage, ten-gods, and all four summary judgments are generated from the certified chart or selected school verdict; rule cards no longer surface machine IDs or English source IDs in readable content.

No actionable P0, P1, or P2 finding was found in this iteration.

final result: passed

## Iteration 14 — 固定八步大运与阅读层级

- Source visual truth: `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-f7362518-59e0-4cf2-8715-b87e7880b153.png` (full-lifecycle K-line request) and `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-ee891949-03c5-4329-a770-000f7376eaf5.png` (two-column workbench reading target).
- Browser-rendered implementation: `http://127.0.0.1:4327/?session=c9080189-68c3-4fae-a13e-c56d60d9e572`, desktop 1265 × 705 CSS px, standard density; a fresh 1990-06-15 10:30 Shanghai chart was used.
- Full-view comparison: the right pane presents all 80 annual candles as one fixed eight-luck lifecycle. Eight dashed boundaries divide the visual reading area, and a labelled eight-segment strip below gives every luck pillar and date range. The left chart facts remain legible as a compact reference column.
- Focused interaction evidence: clicking 2026 opened the annual popover with 丙午年, 戊寅大运 (第 4 运), stem ten-god, OHLC, annual change, and monthly range. DOM verification found exactly 80 candles, 8 luck segments, 0 range inputs, and no wheel attribute on the chart stage. Console errors: 0.

### Findings resolved

- [P1] The wheel/slider range controls conflicted with normal page reading and made the lifecycle view feel transient. The overview now has one fixed scope: the complete first eight major-luck cycles. The chart no longer consumes wheel gestures and has no draggable observation window.
- [P2] Thin gray text and similarly weighted labels weakened scanability. The updated visual system strengthens Chinese headings, tab names, annotation labels, axis numerals, judgment labels, and element/hidden-stem metadata; it also raises foreground contrast while retaining the restrained blue/gray base palette.
- [P2] A full 80-year chart did not clearly expose which decade belonged to which major luck. Dotted in-chart boundaries and the eight-part luck strip now make the hierarchy visible without adding interaction controls.

### Fidelity review

- Fonts and typography: serif display headings retain their chart-like character; navigation, annotations, and tab labels use heavier, higher-contrast sans-serif settings. Small utility text remains compact but now has a stronger optical weight.
- Spacing and layout rhythm: the fixed chart uses a stable full-width observation surface, while the eight-part strip provides a quiet second reading level below it. No horizontal control competes with the page scroll.
- Colors and visual tokens: cobalt remains the selection color; red/green remain exclusive to OHLC direction; neutral labels move to a darker blue-gray for clearer contrast.
- Image quality and asset fidelity: data/UI-only surface; no source imagery or decorative asset is replaced.
- Copy and content: chart copy now explicitly says that all eight major-luck cycles are shown and that a year click opens its interpretation.

No actionable P0, P1, or P2 issue remains in the desktop fixed-lifecycle state. The 80-candle density is intentional for the requested full-lifecycle view; the timeline remains the detailed per-luck reading surface.

final result: passed

## Iteration 13 — 自适应纵轴与同尺度主题指数

- Source issue: `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-f7362518-59e0-4cf2-8715-b87e7880b153.png` showed that a fixed 0—100 viewport compressed candles around the 70 band, while theme indices could look unrelated.
- Browser-rendered implementation: fresh certified Shanghai session at 1265 × 705 CSS px. The visible 24-year window reports a y-axis of 40—65 and renders readable candle height; console errors: 0.
- Data evidence: selected 2026 candle closes at 57.19. The displayed theme indices are 57 (balance), 57 (wealth), 61 (relationship), and 62 (career), all based on that close plus small disclosed theme adjustments.

### Findings resolved

- [P1] The K-line y-axis is now an adaptive crop of the stable public 0—100 scale, with a bounded visual margin around the current visible high/low instead of permanently rendering 0 and 100.
- [P1] Theme scores no longer begin from an independent 40–70 presentation scale. They begin from the selected annual K-line close, then apply only small school-theme-stance and annual-ten-god adjustments, clamped to 0—100. A low annual close therefore remains low across the theme row.

final result: passed

## Iteration 12 — 原局终局裁决层

- Source issue: user screenshot `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-ba300b87-06db-4b10-b43b-aaf952f09b76.png` showed a repeated long `格局` / `用神` paragraph, making the left card read as a reasoning transcript.
- Browser-rendered implementation: populated certified overview at `http://127.0.0.1:4327/`; desktop screenshot verified the revised left reading hierarchy renders beneath the invariant five-element section.

### Findings resolved

- [P1] Final conclusion and evidence were conflated. The left rail now leads with `所选流派终局裁决`, a concise result line (for example, `劫财格 · 身强`) and the system-specific axis/strength result. The evidence rows now use `结构依据`、`取用方向`、`调候`、`辅助关系` rather than duplicating the headline.
- [P2] Full reasoning had no dedicated location. `查看判定依据与边界` now contains the full decisive text, rejected routes, and caveats only on demand.

final result: passed

## Iteration 11 — 统一 0—100 指数与全国区县

- Browser-rendered implementation: `http://127.0.0.1:4327/?session=7e55e25e-63d0-40aa-8940-b7b487e1fcbb`, desktop 1265 × 705 CSS px, device scale factor 1.
- Interaction evidence: searched and selected `北京市 / 市辖区 / 海淀区` from the county-level combobox, generated a valid certificate, then ran the four-school analysis. The screen shows the selected full birthplace in the left card.
- Chart evidence: browser DOM confirmed y-axis labels `100, 75, 50, 25, 0`, title reports `当前纵轴 0 至 100`, and console errors were empty.

### Findings resolved

- [P1] The former annual rule anchor was a compressed qualitative baseline and could be stable across many years; it therefore conveyed little useful annual variation. The popover now reports `年度变动` and `流月波幅` instead.
- [P1] K-line values and theme indices used different scales. The engine now maps its internal -100—100 support/pressure coordinate into a public 0—100 structural index, and the overview uses a fixed 0—100 y-axis.
- [P2] The birthplace selector was limited to six presets. It now searches 2,991 county-level administrative divisions with locally bundled center coordinates and applies the selected location to the certificate calculation.

final result: passed

## Iteration 9 — 命盘卡与连续 K 线导航

- Source visual truth: `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-e6cf577d-4c45-4656-9018-97243bd1d330.png` and `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-198928a1-844e-4740-8d6f-c3ddf1d03b35.png`.
- Browser-rendered implementation: `http://127.0.0.1:4327/?session=ff73aeae-cb1a-486d-a14e-36c36ff9ea56`; populated Shanghai chart, 1990-06-15 10:30, first inspected at 1265 × 705 CSS px, device scale factor 1.
- Full-view evidence: the latest captured desktop view contains a narrow independently scrollable left rail, four-pillar matrix, five-element ratios, four core judgments, school tabs, 24 annual red/green candles, a lower navigator, and theme-index row.
- Focused-region evidence: clicked 1998 to display the annual popover; it shows year and stem-branch, trend label, luck cycle/order, heavenly stem, earthly branch, OHLC, and annual anchor. The second school tab was clicked and received the `active` state. The navigator's range input is present and exposes the accessible name `拖动平移年份窗口`.

### Comparison history

- [P1] Earlier capture at 1265 px had horizontal overflow because 24 year-label buttons retained their intrinsic width. Fixed by constraining label buttons to shrink within the navigator; revised capture measured `scrollWidth === clientWidth` (1265 px).
- [P2] An old `min-height` on the chart overrode the computed compact chart height. Fixed by allowing the adaptive chart height to govern and tightening only the short-desktop spacing; the left rail now scrolls internally rather than forcing the full page wider or taller.

### Fidelity review

- Fonts and typography: primary fate-chart headings and four core reading labels are bold, serif-led anchors; city/time, proportions, controls, and OHLC metadata use compact sans text. The card remains legible at the tested desktop width without horizontal truncation.
- Spacing and layout rhythm: the left rail is approximately 31% of the workbench, intentionally narrower than the chart. The four pillars remain one readable row on desktop; five-element bars and core conclusions form compact layers below it. The K line retains the main visual mass on the right.
- Colors and visual tokens: neutral white/gray surfaces and cobalt navigation match the source. Red denotes close above open, green denotes close below open; the legend is visible beside the chart title. Element ratios reserve their own five semantic hues without competing with the candles.
- Image quality and asset fidelity: the referenced view is a data workbench and contains no required raster illustration. UI symbols use the existing icon family; no placeholder imagery is introduced.
- Copy and content: the left card derives from certified chart fields. The popup exposes the requested `天干 / 地支 / 五行相关的 OHLC / 涨跌含义`-style annual facts, while the bottom themes expose a clearly labelled presentation index tied to the selected school’s public theme stance.
- Responsiveness and interaction: wheel behavior is bound to continuous `viewCount` changes (two-year increments per tick with a 6–80 bound); it does not mutate `rangeStart`. The bottom range input alone sets `rangeStart` for horizontal panning. There are no 40/80/all view buttons. Browser console errors: 0.

No actionable P0, P1, or P2 issue remains in the newly requested composition.

final result: passed

## Iteration 8 — selected Product Design concept

- Selected visual target: Product Design ideation image 1, stored at `C:\Users\ENAN\.codex\generated_images\019fa347-6a20-7260-bdf2-4c9d1ed96625\exec-a56c70ed-2521-4d3f-8f0d-f6b8aba4113c.png`.
- Browser-rendered implementation: `http://127.0.0.1:4327/`, new certified Shanghai session; desktop capture approximately 1248 × 705 CSS px at standard density. The selected target and implementation share the same state: certified chart, traditional Ziping selected, 40-year K-line view.
- Primary interactions checked: city dropdown changes from Shanghai to Beijing; city-first certificate generation succeeds; the top-of-chart Shao Weihua tab becomes active; the red/green candlestick chart remains rendered; console errors: 0.

### Fidelity review

- Fonts and typography: the display hierarchy uses a compact serif day-master and chart title, with concise sans-serif labels. The four schools are now a top-level, full-width segmented control, matching the selected concept’s control prominence.
- Spacing and layout rhythm: the left column begins with a short identity summary and a four-column pillar matrix rather than a long certification rail. The right column begins with the school switcher, then chart heading and controls, preserving the selected concept’s chart-first hierarchy.
- Colors and visual tokens: white canvas, cobalt active state, and restrained dividers remain consistent with the generated target. Candlestick red/green is semantic only.
- Image quality and asset fidelity: the selected concept contains no required raster artwork in the product surface. Existing icon-library symbols are retained as interface affordances.
- Copy and content: city and IANA zone replace default coordinate display; exact location parameters only appear inside the collapsed `高级地点校正` and `计算依据与认证` disclosures. The four-pillar labels and core judgments remain available without opening technical detail.

No actionable P0, P1, or P2 issue was found. The generated target is an information-architecture reference rather than a pixel-for-pixel content source; the implementation intentionally retains the real four-pillar fields and transparent calculation text.

final result: passed

## Iteration 4 — 大运优先与流月 K 线

- Runtime capture: certified 1990-06-15 10:30 / Asia/Shanghai chart; traditional Ziping; selected fourth luck cycle 戊寅 (2023—2032), then switched to fifth luck cycle 丁丑 (2033—2042).
- Browser evidence: overview rendered 8 selectable luck cycles and exactly 10 annual candles for the selected luck cycle. Switching to 第 5 运 updated the header to `2033 癸丑年 · 丁丑大运`, the chart range to `2033 — 2042`, and retained 10 candles.
- Candle evidence: each candle carries 12 monthly samples; the accessible label exposes open/high/low/close. Sample 2033: `开 2.54，高 13.7，低 -1.02，收 8.19`.
- Timeline evidence: title `先定大运，再看流年`, 8 luck cards, 10 annual rows, current luck annotation, and the red/green direction legend all rendered.

### Method and transparency review

- The annual anchor is a four-school rule run over 原局 → 所属大运 → 流年.
- The monthly high/low range is calculated from the 12 solar-month pillars through the documented support/pressure coordinate and Fisher-space composition. This is disclosed in the chart footnote; the vendor engine does not currently run a separate four-school monthly stage.
- Values use the disclosed structural relative-index range -100 to 100. They are not probabilities, event forecasts, or a direct sum of layer scores.

No actionable P0, P1, or P2 issue was found in the verified K-line flow.

## Iteration 5 — 全生命周期浏览

- Runtime capture: certified 1990-06-15 10:30 / Asia/Shanghai chart; traditional Ziping.
- Browser evidence: the overview renders 80 annual candles covering 1993—2072. The default 40-year window has previous/next buttons, a range slider, and 10 / 20 / 40 / all display choices. Selecting “all” exposes all 80 candles and sparsifies year labels for readability.
- Chart evidence: the visible data range now sets the y-axis (`-15` to `35` in the inspected 40-year window), preserving visible OHLC variation instead of pinning the chart to a fixed ±100 frame.
- Interaction evidence: candle hover/click opens a compact annual popover with the year, corresponding luck cycle, OHLC and annual rule anchor. The permanent annual audit drawer was removed from this chart surface.
- Information architecture: detailed eight-luck segmentation and annual rows are now grouped under the Timeline view rather than repeated in the overview chart.

### Calculation review

- A successful first analysis materializes 8 luck cycles and 80 annual trajectories in one local Python run. The engine regression test verifies the 2020—2099 eight-cycle envelope for the manual fixture.
- After that run, changing school, visible range, wheel/slider position, or annual focus operates against browser-memory analysis data and makes no additional analysis request.
- The complete vendor-rule warm-up remains CPU-bound; a thread/process parallel experiment was rejected because it increased contention on this engine. The UI therefore discloses the one-time local warm-up explicitly.

## Iteration 6 — 年度计算与波动辨识度

- Performance correction: removed duplicate annual/luck profile calls in the lifecycle loop; skipped full recursive state-chain construction for trajectory-only rows; cached immutable profile and RuleIR JSON assets in the vendor orchestrator.
- Result: the 8-luck / 80-year engine regression completes in approximately 4–6 seconds in the local test fixture, while the selected-year audit retains its complete state chain.
- Variation correction: monthly support/pressure odds now incorporate month-to-base stem combinations, branch six-harmonies/clashes, same-branch activation and the day-master's twelve-growth seasonal weight. These factors are composed inside the existing odds/Fisher pipeline rather than added as a separate annual score.
- Regression: the fixture requires more than 40 distinct OHLC signatures across its 80-year traditional-Ziping trajectory; the inspected output produced 80 distinct signatures.

## Iteration 7 — 命盘信息 / K 线双栏工作台

- Source visual truth: `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-c213b093-fea0-4bd1-8a16-ca561909126c.png` (desktop SenFate workbench); user-directed reflow: put certification and original-chart reading at left, make the K-line visualization dominant at right.
- Implementation evidence: browser-rendered `http://127.0.0.1:4327/` after a newly generated certified session; desktop browser capture at approximately 1248 × 705 CSS px, standard-density. The left column shows certification metadata, active annual/luck, four-pillar original chart, summary judgments, and the four-school selector; the right column shows chart title, controls, and red/green K-line.
- Interaction evidence: a fresh certified run completed and loaded the overview; 40-year control is visible and the right-side K-line renders red/green bodies with same-color wicks.

### Fidelity review

- Fonts and typography: retained the source’s serif hierarchy for Chinese fate-chart headings and compact sans labels for certification and controls. The active year is deliberately reduced in the left column so the visualization can lead on the right.
- Spacing and layout rhythm: the original wide four-pillar strip is converted into a compact two-by-two reading grid in the left column. A clear vertical divider and neutral right canvas establish the requested two-column reading order.
- Colors and visual tokens: preserved white, blue, and gray structural tokens. Red/green are reserved for K-line direction and their wicks, avoiding the former conflicting blue wick.
- Image quality and asset fidelity: this is data/UI-only workbench; it contains no reference raster illustrations or images requiring recreation. Existing Phosphor icons remain vector UI controls.
- Copy and content: original-chart labels, ten-gods, Na Yin, twelve growth stages, and verdict summaries remain visible on the left; chart instructions are kept next to the visualization.

No actionable P0, P1, or P2 issue was found for the requested two-column desktop layout. Mobile intentionally becomes stacked at 960 px to preserve readable chart width.

final result: passed

## Iteration 10 — 年度主题联动与命局/流派边界

- Source visual truth: `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-ee891949-03c5-4329-a770-000f7376eaf5.png` and `C:\Users\ENAN\AppData\Local\Temp\codex-clipboard-5f495cae-5739-43af-ae89-d63eb9d230fa.png`.
- Browser-rendered implementation: `http://127.0.0.1:4327/?session=7b9bc1cb-aa2c-43c1-8732-1bf097f558c0`, desktop 1265 × 705 CSS px, device scale factor 1.
- Full-view evidence: revised screenshot shows functional-system school names with source line, hidden-stem ten-gods, invariant five-element composition disclosure, source-labelled selected-school judgments, and a K-line viewport initially centered on the selected year (2014—2037 for selected 2026).
- Focused interaction evidence: clicking 1998 changed the theme header from `2026 年主题结构指数` to `1998 年主题结构指数` and changed the four values from `66 / 54 / 58 / 50` to `57 / 57 / 53 / 53`. Console errors: 0.

### Findings resolved

- [P1] Theme indices were based on the selected school’s whole-chart themes, so year selection did not alter them. Each lifecycle row now carries compact annual theme signals; the displayed index is transparently mapped from that annual rule stance, the annual stem’s ten-god, and the annual K-line close/open movement.
- [P2] Hidden stems displayed only characters. Their ten-gods now render alongside each hidden stem.
- [P2] The label `由本派给出结果` blurred the distinction between common chart facts and school conclusions. Five-element percentages now explicitly identify themselves as common chart composition; result rows sit under `所选流派判断` and carry the active functional-system name plus provenance.
- [P2] Chart wheel scrolling always prevented page scrolling. It now only prevents the event while the annual-window size can change; at the 6-year or full-lifecycle bounds it releases the wheel to the page. Horizontal panning remains isolated to the bottom range input.

### Fidelity review

- Fonts and layout: hidden ten-god labels remain compact but readable; functional system names now provide a stable primary tab label with an author/provenance line below.
- Colors: five elements remain source-data colors, while selected-school and judgment labels use cobalt. Red/green candles retain only OHLC direction semantics.
- Copy and transparency: the annual theme header names its selected year and the inputs used in the presentation index; no school-specific conclusion is presented as an objective chart fact.

final result: passed
