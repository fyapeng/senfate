# Annual topic analysis

## Public contract

`senfate-analysis-request.v2` adds a required `targetYear` to the certified
calendar inputs. The annual pillar and enclosing luck period are evaluated at
the certified Lichun instant for that year. The
runtime locates the enclosing major-luck period from its certified start time.
Targets before the first requested luck period or beyond the requested range
fail explicitly.
If a major-luck start uncertainty interval overlaps Lichun, annual analysis
fails with `luck-boundary-ambiguous` instead of selecting an arbitrary period.

```text
natal pillars + enclosing major luck + annual pillar
→ accumulated dynamic state
→ stable relation normal form
→ resolved reference features
→ kinship role projection
→ 4,118 executable TopicFunctions
→ TopicContributionCertificate v2
→ signed ten-domain topic measure
→ source-linked topic event hypotheses
```

Annual evaluation always includes rules scoped to natal, major luck and annual
time. It never executes only the annual subset. Deferred, contested, evidence
and fixture records remain in the program ledger but cannot contribute a value.

## Kinship projection

The projection publishes six role families: self, peers, mother-side caregiver,
father-side resource provider, partner and children. Each role records the
ten-god mapping used and the number of visible or hidden occurrences in the
accumulated state. Sex-specific partner and children mappings are explicit in
the certificate. These are traditional semantic roles, not verified family
outcomes.

## Contribution and hypotheses

Every activated source records book ID, source lines, family ID, affected
domains and polarity. The certificate separates evaluated, activated, inactive
and unresolved functions. Unknown conditions enter the unresolved list and
never contribute zero silently.

Event hypotheses aggregate source-backed domain direction and magnitude. Their
epistemic status is always `traditional-model-hypothesis`; they are not event
probabilities, causal estimates or factual predictions.

Public topic-domain weights scale the signed contribution measure only after a
rule condition has activated. They cannot make a false rule true, query raw
graph state or move a deferred record into the executable set. Temporal-layer
overrides act earlier and therefore require full dynamic-state and normal-form
recomputation. Both kinds are included in the model-configuration certificate.

`pnpm audit:resolved-topic-features` recompiles the canonical corpus, checks the
complete disposition partition, executes an annual fixture and reports the
actual TopicFunction and TopicRule counts.
