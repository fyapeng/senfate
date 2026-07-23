# Interpretive structure model

## Calculation boundary

The interpretive layer accepts a certified four-pillar state, a finite element
measure, a strength result and a stable `ReferenceNormalFormPhaseResult`. It
does not read civil-time input, raw graph edges, unresolved relation candidates
or source-record prose.

```text
stable reference normal form
→ regular/special/following pattern projection
→ temperature–humidity coordinate
→ five-element balancing contribution vector
```

An unstable or failed normal form produces no interpretive result. Major-luck
analysis repeats dynamic materialization, relation resolution and this complete
projection for every period. Natal state is retained in every period.

## Pattern projection

`senfate-pattern-projection.v3` evaluates patterns through a rule-driven
engine that follows the canonical 子平 sequence: month-command day
segmentation, exposure-based pattern locking, formation/break/remedy checks,
and following-pattern subtyping. Each conclusion carries classical source
evidence (`bookId`, `lineStart`, `lineEnd`, `rule`) so that every pattern
decision is traceable to a specific passage.

**Month-command segmentation.** The runtime resolves the command stem
(司令之神) from a pinned day-segmentation table
(`command-days.json`, sourced from 《子平真诠》/《渊海子平》/《千里命稿》)
using the number of days elapsed since the enclosing "节" boundary. This
replaces the earlier model that scored all three month-branch hidden stems
simultaneously without distinguishing which is in season.

**Regular patterns (八格).** The command stem's ten-god determines the
candidate pattern label. The hard rule is: a pattern is locked only when the
command stem is exposed in a heavenly stem (透干定格). If the command stem is
not exposed, the runtime falls back to the month-branch main qi if it is
exposed. Formation is then checked against resolved relations: a clash
(冲) against the pattern stem breaks the pattern (破格); if a remedy (印星
or 通关 bridge) exists, the conclusion is downgraded to `contested` rather
than fully broken.

**Special patterns.** `建禄格` fires when the month branch is the day stem's
prosperity branch. `羊刃格` uses an explicit blade-branch table; yin-stem
cases stay `contested` (school disagreement). `月劫格` / `月刃格` fires when
a month-branch hidden stem of peer/robbery ten-god is exposed and the month
is neither prosperity nor blade.

**Following patterns (从格).** `从强格` and `从弱格` require extreme strength
plus unanimous direction. `从弱格` additionally requires zero day-master
root mass and is subtyped into `从财格` (wealth dominant), `从杀格` (officer
dominant), and `从儿格` (output dominant) based on which non-supporting
element dominates the visible stems.

**Transform patterns (变格).** When a three-harmony or three-meeting relation
reaches `transformed` status in the normal form, a candidate transform
pattern is recorded (e.g. 三合水局变格).

When the normal form or command context is unavailable, the runtime falls
back to the earlier parameterized projection so existing results remain
available. This classification always uses the natal strength result; later
luck and annual projections do not rewrite the natal pattern name when their
dynamic strength changes.

## Climate coordinate

The coordinate has temperature and humidity axes. Each combines a documented
month-branch baseline with normalized element-measure adjustments. Values are
dimensionless model coordinates. They are neither weather observations nor
biological measurements.

## Balancing vector

For every element, the runtime records a strength contribution, climate
contribution, stable-relation confidence and final signed score. Scores above
or below the configured decision threshold become `supportive` or `avoid`;
the remainder stay `neutral`. The API describes this output as a balancing
candidate vector and does not label it a final useful-god decision.

All parameters live in `senfate-model-profile.v3`. The response certificate
records the model version and upstream normal-form fingerprint.
