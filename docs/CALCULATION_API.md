# Public calendar API

## Contract

`POST /senfate/api/v1/calendar/calculate` consumes
`senfate-calendar-request.v1` and returns `senfate-calendar-response.v1`.
The body is limited to 8 KiB and must use `application/json`.

Required inputs are a canonical `locationId`, local Gregorian date-time and
sex. Optional inputs select one of the three published model profiles, clock
uncertainty, repeated-time disambiguation, period count and exact coordinates.
The endpoint supports 1900–2035, matching the pinned ephemeris range.

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

When exact coordinates are absent, the API assigns conservative uncertainty to
the location source: 200 km for an administrative centroid, 50 km for a
settlement centroid and 10 km for a source point. This uncertainty is propagated
into day/hour boundary checks and major-luck start intervals.

Ambiguous or nonexistent local times, solar-term boundary overlap, day/hour
boundary overlap and dates outside the ephemeris range return explicit errors.
No fallback chart is produced. The endpoint does not store birth input or
calculation output.

The public response includes location and coordinate provenance, model version,
time normalization, enclosing solar terms, four pillars, major-luck intervals,
ephemeris digest and an upstream calculation certificate. Structure and topic
inference are not added to this stable calendar response.

## Natal structure analysis

`POST /senfate/api/v1/analysis/calculate` accepts the same
`senfate-calendar-request.v1` body and returns
`senfate-analysis-response.v2`. The calendar
endpoint remains unchanged.

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

The analysis route stops if calendar calculation, strength evaluation,
normal-form evaluation or any major-luck projection fails. Topic contribution
and event hypotheses remain outside this contract.
