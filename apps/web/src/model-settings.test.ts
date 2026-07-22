import{describe,expect,it}from"vitest";
import{modelOverrideCount,overridesFromValues,valuesWithOverrides}from"./model-settings";

describe("public model settings",()=>{it("stores only values that differ from the selected preset",()=>{const base={"temporalLayers.natal":1,"temporalLayers.luck":1,"temporalLayers.month":1,"topics.domainWeights.career":1};const overrides=overridesFromValues(base,{...base,"temporalLayers.luck":1.5,"temporalLayers.month":1.25,"topics.domainWeights.career":2});expect(overrides).toEqual({temporalLayers:{luck:1.5,month:1.25},topics:{domainWeights:{career:2}}});expect(modelOverrideCount(overrides)).toBe(3);expect(valuesWithOverrides(base,overrides)).toEqual({...base,"temporalLayers.luck":1.5,"temporalLayers.month":1.25,"topics.domainWeights.career":2})})});
