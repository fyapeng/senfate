# Web Product

## Route contract

| Route | Product responsibility | Interactive surface |
| --- | --- | --- |
| `/senfate/` | Birth input and progressive analysis workspace | calculation options, five result layers |
| `/senfate/principles/` | Public inference and resolution method | resolution-state explorer |
| `/senfate/perspective/` | Historical and epistemic boundaries | editorial reading experience |
| `/senfate/models/` | Public model presets and parameters | preset switching, parameter sensitivity |

The four routes share one navigation, responsive layout, visual token system and
boundary statement. GitHub Pages owns all website assets. Cloudflare only owns
`/senfate/api/*` and is not a web-page origin.

## Honest-preview rule

The current calculation kernel is incomplete. The product therefore follows
these constraints:

1. Birth inputs remain in the browser and are not submitted.
2. The calculation action is disabled until the formal runtime is connected.
3. Any sample chart or model value is labelled as a product demonstration.
4. The interface does not imply that sample output was calculated from input.
5. Internal contribution measures are never labelled as empirical probability.

## Responsive acceptance

The principal acceptance widths are 1440 px desktop and 390 px mobile. All four
routes must render without horizontal document overflow. The mobile navigation,
analysis result tabs and parameter categories may scroll or collapse within their
own bounded containers.
