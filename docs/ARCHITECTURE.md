# Architecture

## Dependency direction

```text
apps/web ───────→ packages/contracts
apps/api ───────→ packages/contracts, packages/core, packages/rules, packages/locations
packages/rules ─→ packages/core
packages/locations → no application dependency
packages/ephemeris → packages/core
packages/core ──→ no application dependency
```

The browser never imports the calculation kernel. The Worker owns request
validation and calculation orchestration. Core functions do not know about HTTP,
Cloudflare, React or storage.

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
