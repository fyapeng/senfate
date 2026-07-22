# Model Configuration

## Contract

Every calculation consumes one `senfate-model-profile.v1` object. A profile is versioned, validated before execution and attached to calculation certificates. There are no runtime-only weight constants outside this contract.

## Parameter groups

| Group | Parameters | Recomputed stages |
| --- | --- | --- |
| Calendar | apparent solar time, day boundary, luck conversion | calendar and every downstream stage |
| Element measure | pillar positions, hidden-stem ranks, 12×5 seasonal matrix | measure, strength, pattern, climate and downstream stages |
| Strength | same element, resource, output, wealth, officer, roots and thresholds | strength and downstream stages |
| Temporal layers | natal, major-luck and annual layer weights | dynamic measure, strength, relations and downstream stages |
| Relation resolution | relation priorities, completeness, season, exposure, roots, current layer and thresholds | resolution, normal form and downstream stages |
| Climate | temperature, humidity and seasonal command | climate, balancing and downstream stages |
| Topics | domain projection weights | contribution measure and visual projection |

Each numeric parameter has a finite range, step, unit and owning stage in `MODEL_PARAMETER_METADATA`. User interfaces may generate controls from this metadata, but the server validates the complete profile again.

## Presets

- `transparent-baseline`: balanced public reference profile;
- `month-command`: increases month-position and seasonal-command influence;
- `climate-priority`: increases temperature and humidity coordinates.

Presets are ordinary model profiles. A user-edited profile follows the same schema and execution path. Changing an upstream parameter invalidates cached downstream states and requires complete recomputation.

## Interpretation

Weights are assumptions inside a representation of traditional theory. They are not fitted probabilities, biological coefficients or causal effects. Future empirical models must keep their estimated parameters in a separate contract.
