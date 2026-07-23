# Public calendar API

## Contract

`POST /senfate/api/v1/calendar/calculate` consumes
`senfate-calendar-request.v1` and returns `senfate-calendar-response.v1`.
The body is limited to 8 KiB and must use `application/json`.

Required inputs are a canonical `locationId`, local Gregorian date-time and
sex. Optional inputs select one of the three published model profiles, clock
uncertainty, repeated-time disambiguation, period count and exact coordinates.
The endpoint supports 1850–2150, matching the pinned ephemeris range.
The web workbench exposes the exact-coordinate override inside its time-precision
controls. The selected canonical location continues to supply the IANA time
zone; the override changes longitude/latitude and their uncertainty only.

## Calculation chain

```text
canonical location
→ IANA historical time-zone resolution
→ UTC instant and offset
→ NASA/JPL DE441 jie window
→ apparent solar wall time
→ four pillars
→ major-luck direction and start interval
→ versioned response and certificate
```

Historical UTC offsets are resolved from the repository-pinned IANA 2026c
distribution (`moment-timezone@0.6.3`). The Worker runtime's host time-zone
database is not consulted, so the same commit and input produce the same
offset candidates. Provider and tzdb versions are included in provenance and
the upstream calculation certificate.

When exact coordinates are absent, the API assigns conservative uncertainty to
the location source: 200 km for an administrative centroid, 50 km for a
settlement centroid and 10 km for a source point. This uncertainty is propagated
into day/hour boundary checks and major-luck start intervals.

Ambiguous or nonexistent local times, solar-term boundary overlap, day/hour
boundary overlap and dates outside the ephemeris range return explicit errors.
No fallback chart is produced. The endpoint does not store birth input or
calculation output.

The public response includes location, coordinate and pinned-tzdb provenance, model version,
time normalization, enclosing solar terms, four pillars, major-luck intervals,
ephemeris digest and an upstream calculation certificate. Structure and topic
inference are not added to this stable calendar response.

## Natal structure analysis

`POST /senfate/api/v1/analysis/calculate` accepts
`senfate-analysis-request.v3` and returns `senfate-analysis-response.v11`.
The request contains the calendar fields plus a required `targetYear`. The
calendar endpoint and its v1 contract remain unchanged.

Version 11 upgrades the interpretive payload to
`senfate-interpretive-model.v2` / `senfate-pattern-projection.v2`. The pattern
projection now publishes normalized conclusions for regular patterns, 建禄,
羊刃 and strict following-pattern checks, including evidence and unmet
conditions. Existing climate and balancing payloads are unchanged.

The request may include `modelOverrides`. This is a closed, range-validated
object covering 19 published parameters: natal/luck/annual/month layer weights,
month-command weight, climate and balancing weights, and ten topic-domain
weights. Unknown fields and values outside 0–4 reject the complete request.
The server merges accepted values into the selected preset, validates the
effective `senfate-model-profile.v3`, computes a deterministic fingerprint and
recomputes every downstream stage. The response and calculation certificate
publish the exact override object, count, fingerprint and effective version.

The response includes `senfate-annual-trajectory.v3`. The primary analysis call
returns the selected year's complete normal form and an explicit
`trajectory-not-loaded` placeholder for every other covered year. This keeps the
first chart request inside the Worker CPU limit.

The browser then downloads the versioned compressed corpus as a hashed GitHub
Pages asset, verifies its audited counts, and replaces those placeholders from a
Web Worker. Annual points and monthly open/high/low/close candles are evaluated
through the same `ReferenceCalculationRuntime`; transport changes do not remove
functions, weaken conditions, or interpolate failures.

`POST /senfate/api/v1/analysis/trajectory?startYear=YYYY&endYear=YYYY` remains a
fail-closed compatibility fallback. It accepts exactly one year
(`startYear === endYear`). The normal web application does not call this route.

```text
normalized topic index = signed topic total / topic total variation ∈ [-1, 1].
```

Annual and monthly trajectory samples evaluate the same 4,118 executable
functions through a compact trajectory summary; the selected detailed year
still receives the complete source and event certificate. An ambiguous luck boundary or failed normal form produces an explicit
`unavailable` point without a synthetic index. If any monthly sample fails, the
annual point remains available but its monthly candle fails closed. Failed
batches stay visible as gaps in the client. `targetYear` only determines
which year also receives the full source and contribution certificate.
Selecting a different K-line year sends the same certified request snapshot
with only `targetYear` changed, then merges the returned annual detail without
discarding already loaded trajectory batches.

`GET /senfate/api/v1/models` returns `senfate-model-catalog.v1`, the three
presets, their effective public parameter values and the authoritative slider
ranges. The web interface builds its controls from this endpoint.

The response nests the certified calendar and adds:

- visible and hidden-stem ten-god mappings for every pillar;
- the model-profiled finite five-element measure;
- day-master support, pressure, decomposition and strength class;
- root and exposure materialization;
- relation candidates after weighted competition;
- stable normal-form status, trace and fingerprint.
- month-command pattern candidates and their dispositions;
- temperature–humidity coordinates and decomposition;
- a signed five-element balancing contribution vector;
- every requested major-luck period recomputed from natal plus luck state,
  including strength, relations, stable normal form and interpretive projection.
- the selected annual state accumulated from natal, enclosing luck and annual pillars;
- six kinship role projections with visible/hidden atoms, model weights and natal/luck/annual decomposition;
- a special-state certificate for same luck-year pillars, phase extremes and seven-symbol consensus candidates;
- the complete covered annual trajectory with explicit unavailable gaps;
- the complete reference-program disposition ledger, topic contribution
  certificate, signed topic vector and source-level event predicates;
- each activated source's closed normalized trigger conditions, book and line
  provenance, declared time scopes and normalized effect evidence;
- event evidence grouped by canonical effect operator and topic domain, with
  book, family and source counts plus line-level provenance;
- declared natal, major-luck, annual and unscoped source counts for every event predicate.
- the effective public model configuration and override fingerprint.

The analysis route stops if calendar calculation, strength evaluation,
normal-form evaluation, major-luck projection, annual context selection or
reference-program integrity fails.
