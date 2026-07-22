# Web Product

## Route contract

| Route | Product responsibility | Interactive surface |
| --- | --- | --- |
| `/senfate/` | Birth input and progressive analysis workspace | location search, optional exact coordinates, certified calculation, life trajectory and detailed result layers |
| `/senfate/principles/` | Public inference and resolution method | resolution-state explorer |
| `/senfate/perspective/` | Historical and epistemic boundaries | editorial reading experience |
| `/senfate/models/` | Public model presets and parameters | catalog-driven weights, local save, JSON export and analysis handoff |

The four routes share one navigation, responsive layout, visual token system and
boundary statement. GitHub Pages owns all website assets. Cloudflare only owns
`/senfate/api/*` and is not a web-page origin.

## Live-calculation rule

Birth input is submitted only to the calculation Worker and is not stored in a
user database. Results must come from the certified calendar and stable-normal-
form chain; the interface does not substitute sample data after a calculation
failure. Transient analysis requests are retried once, while domain failures
remain explicit. Public model settings are stored locally, accepted only through the
closed 19-parameter API contract and included in the returned certificate.
Internal contribution measures are never labelled as empirical probability.
The workbench restores form state and the last compatible result from
`sessionStorage` while the browser tab remains open. A visible clear action
removes this session copy. No account or server-side birth profile is implied
by the convenience layer.

The first analysis response supplies the complete annual trajectory. The client
then requests consecutive one-to-four-year flow-month batches serially, retries
each failed range twice and merges each candle by year. A final batch failure
remains an explicit gap and is never replaced with an estimated wick. Navigation
does not require a second user action, and completed batches are included in the
session copy.

## Responsive acceptance

The principal acceptance widths are 1440 px desktop and 390 px mobile. All four
routes must render without horizontal document overflow. The mobile navigation,
analysis result tabs and parameter categories may scroll or collapse within their
own bounded containers.
