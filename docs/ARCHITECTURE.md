# Architecture

## Dependency direction

```text
apps/web ───────→ packages/contracts, packages/core, packages/ephemeris, packages/rules
apps/api ───────→ packages/contracts, packages/core, packages/ephemeris, packages/locations
packages/rules ─→ packages/core
packages/locations → no application dependency
packages/ephemeris → packages/core
packages/core ──→ pinned IANA tzdb distribution
```

The browser imports the calculation kernel only inside a dedicated Web Worker.
The Cloudflare Worker owns request validation, canonical location lookup, and
the initial certified calculation. Core functions do not know about HTTP,
Cloudflare, React or storage. Historical offsets come from the dependency-locked
IANA distribution, not from the Worker host's mutable time-zone database.

## Hybrid execution boundary

The production website is statically built and published by GitHub Pages. Its
hashed rule corpus and browser analysis worker are immutable build artifacts.
Cloudflare retains the D1-backed canonical location search and the initial
certified calculation endpoint.

After the initial response, the browser worker compiles the same 37,231-record
corpus used by the API and verifies the executable, deferred, and contested
counts before use. It evaluates annual points, all twelve flow months, and
selected-year details locally through `ReferenceCalculationRuntime`. No raw
graph, unresolved candidate, or alternate legacy runtime is exposed to the
topic layer.

The server trajectory endpoint is capped at one year as a compatibility
fallback. Normal website operation does not call it. This boundary prevents a
single Cloudflare request from multiplying four annual and forty-eight monthly
normal-form evaluations, while preserving identical formal operators and
fail-closed behavior in both environments.

## Deployment

```text
GitHub Pages:  static product website, browser worker and versioned rule corpus
Cloudflare:    location lookup, initial certified calculation and one-year fallback
Cloudflare D1: public canonical location search only
local-data/:  untracked research files and generated datasets
```

API schema versions change whenever a public response changes. Calculation
profiles, corpus digests and rule certificates are part of result provenance.
Birth and user records are not persisted in the location index.

The public calendar route accepts at most 8 KiB of JSON, resolves a canonical
location through D1, and returns a `senfate-calendar-response.v1` document. The
browser does not reproduce time-zone, solar-term or pillar algorithms.
