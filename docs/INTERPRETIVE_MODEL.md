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

`senfate-pattern-projection.v2` separates three pattern families. The eight
regular structures originate from the hidden stems of the month branch; their
scores record month-command rank, visible exposure and root mass. `建禄格` is
identified only when the month branch is the day stem's canonical prosperity
branch. `羊刃格` uses an explicit blade-branch table, and yin-stem cases remain
contested because the convention is not shared by all schools.

`从强格` and `从弱格` are evaluated only at the corresponding extreme strength
state. A qualified following structure additionally requires every non-day
visible stem and every hidden stem to point in the same support or pressure
direction; `从弱格` also requires zero day-master root mass. If an extreme
strength state is present but these stricter conditions fail, the result is a
named candidate with the unmet conditions attached. Each conclusion records a
family, status, evidence vector and unmet-condition vector. This classification
always uses the natal strength result; later luck and annual projections do not
rewrite the natal pattern name when their dynamic strength changes.

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
