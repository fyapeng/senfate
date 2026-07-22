# SenFate

SenFate is a clean-room implementation of an auditable modern Bazi reasoning
system. Classical sources are preserved as evidence; executable behavior is
defined by explicit, versioned functions and a closed inference pipeline.

```text
calendar input
→ stems and branches
→ elements, yin-yang and hidden stems
→ ten gods and generation/control
→ relation candidates and root/exposure
→ element measure, strength, pattern, climate and balancing
→ structure rewrites and relation resolution
→ stable normal form
→ kinship roles
→ topic contributions
→ event hypotheses
→ transparent measurements
```

## Workspace

```text
apps/web           Astro + React product site, deployed by GitHub Pages
apps/api           Cloudflare Worker API only
packages/core      theory ontology and deterministic calculation kernel
packages/rules     classical corpus validation and rule compilation
packages/contracts versioned public API contracts
packages/locations canonical place contracts and GeoNames importer
packages/ephemeris pinned solar-term table and certified calendar facade
data               seven source texts and the 37,231-record canonical corpus
docs               product, architecture and theory specifications
```

## Product pages

The public site has four first-level routes:

```text
/senfate/              analysis workbench
/senfate/principles/   inference principles and formal pipeline
/senfate/perspective/  historical context and epistemic boundaries
/senfate/models/       visible model presets and parameter controls
```

The analysis workbench is connected to the versioned Calendar Engine and natal
structure runtime. It shows four pillars, hidden stems, ten gods, solar-time
corrections, solar-term boundaries, major luck, five-element measure, day-master
support-pressure, stable relation dispositions, pattern candidates, climate
coordinates, a five-element balancing vector and dynamically recomputed
major-luck periods, a selected annual state, six kinship roles and an audited
ten-domain topic contribution vector. Source-linked event hypotheses are shown
as traditional-model statements rather than empirical probabilities. The model
page exposes active presets and previews future custom-profile controls.

## Commands

```bash
pnpm install
pnpm audit:rules
pnpm audit:reference-compilation
pnpm audit:resolved-topic-features
pnpm audit:ephemeris
pnpm typecheck
pnpm test
pnpm build
pnpm dev:web
pnpm dev:api
```

Location search uses a public GeoNames index in Cloudflare D1. The repository tracks its schema and provenance contract; raw geographical datasets and generated import SQL remain in `local-data/`.

Large PDFs, databases, exports and generated snapshots belong in `local-data/`
and are never committed. Their manifests and hashes may be tracked separately.

The model represents a historical knowledge system. Its outputs are not medical,
legal or financial advice and are not empirical probabilities.
