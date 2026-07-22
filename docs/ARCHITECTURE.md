# Architecture

## Dependency direction

```text
apps/web ───────→ packages/contracts
apps/api ───────→ packages/contracts, packages/core, packages/ephemeris, packages/locations
packages/rules ─→ packages/core
packages/locations → no application dependency
packages/ephemeris → packages/core
packages/core ──→ pinned IANA tzdb distribution
```

The browser never imports the calculation kernel. The Worker owns request
validation and calculation orchestration. Core functions do not know about HTTP,
Cloudflare, React or storage. Historical offsets come from the dependency-locked
IANA distribution, not from the Worker host's mutable time-zone database.

## Deployment

```text
GitHub Pages:  static product website
Cloudflare:    /senfate/api/* only
Cloudflare D1: public canonical location search only
local-data/:  untracked research files and generated datasets
```

API schema versions change whenever a public response changes. Calculation
profiles, corpus digests and rule certificates are part of result provenance.
Birth and user records are not persisted in the location index.

The public calendar route accepts at most 8 KiB of JSON, resolves a canonical
location through D1, and returns a `senfate-calendar-response.v1` document. The
browser does not reproduce time-zone, solar-term or pillar algorithms.
