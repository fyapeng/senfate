import { describe,expect,it } from "vitest";
import { materializeDynamicChartState } from "./lifecycle";
import { TRANSPARENT_BASELINE_MODEL } from "./model";
import { resolveReferenceNormalForm } from "./resolution";
import { sexagenary } from "./ontology";

const natal={year:sexagenary(0),month:sexagenary(2),day:sexagenary(4),hour:sexagenary(6)};
describe("dynamic calculation lifecycle",()=>{
  it("requires annual states to include their major-luck layer",()=>{expect(materializeDynamicChartState({natal,annual:sexagenary(12)},TRANSPARENT_BASELINE_MODEL)).toMatchObject({ok:false,code:"missing-luck-layer"})});
  it("recomputes annual state from natal, luck and annual pillars",()=>{const result=materializeDynamicChartState({natal,luck:sexagenary(10),annual:sexagenary(20)},TRANSPARENT_BASELINE_MODEL);expect(result.ok).toBe(true);if(!result.ok)return;expect(result.value.pillars.map(item=>item.layer)).toEqual(["natal","natal","natal","natal","luck","annual"]);expect(result.value.phase).toBe("annual");expect(result.value.elementMeasure.total).toBeGreaterThan(0)});
  it("adds a flow-month only after luck and annual layers",()=>{expect(materializeDynamicChartState({natal,luck:sexagenary(10),month:sexagenary(30)},TRANSPARENT_BASELINE_MODEL)).toMatchObject({ok:false,code:"missing-luck-layer"});const result=materializeDynamicChartState({natal,luck:sexagenary(10),annual:sexagenary(20),month:sexagenary(30)},TRANSPARENT_BASELINE_MODEL);expect(result.ok).toBe(true);if(result.ok)expect(result.value.pillars.map(item=>item.layer)).toEqual(["natal","natal","natal","natal","luck","annual","month"])});
  it("resolves every candidate into an explicit terminal disposition",()=>{const dynamic=materializeDynamicChartState({natal:{year:sexagenary(2),month:sexagenary(11),day:sexagenary(3),hour:sexagenary(22)},luck:sexagenary(35)},TRANSPARENT_BASELINE_MODEL);expect(dynamic.ok).toBe(true);if(!dynamic.ok)return;const normal=resolveReferenceNormalForm(dynamic.value,TRANSPARENT_BASELINE_MODEL);expect(normal.ok).toBe(true);if(!normal.ok)return;expect(normal.value.status).toBe("stable");expect(normal.value.relations.every(item=>item.status!=="candidate")).toBe(true)});
});
