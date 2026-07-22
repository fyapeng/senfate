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
inference are not yet part of this API contract.
