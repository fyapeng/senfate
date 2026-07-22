import { describe,expect,it } from "vitest";
import { evaluateNormalForm,type RewriteOperator } from "./normal-form";
describe("normal-form evaluator",()=>{
  it("publishes only stable output",()=>{const increment:RewriteOperator<number>={id:"increment",apply:value=>({state:Math.min(value+1,2),changed:value<2,ruleId:"increment"})};expect(evaluateNormalForm(0,{maxIterations:5,fingerprint:String,operators:[increment]})).toMatchObject({ok:true,value:{status:"stable",state:2}})});
  it("fails closed on cycles",()=>{const toggle:RewriteOperator<number>={id:"toggle",apply:value=>({state:1-value,changed:true,ruleId:"toggle"})};expect(evaluateNormalForm(0,{maxIterations:5,fingerprint:String,operators:[toggle]})).toMatchObject({ok:false,code:"cycle"})});
  it("fails closed on limits",()=>{const increment:RewriteOperator<number>={id:"increment",apply:value=>({state:value+1,changed:true,ruleId:"increment"})};expect(evaluateNormalForm(0,{maxIterations:2,fingerprint:String,operators:[increment]})).toMatchObject({ok:false,code:"limit-reached"})});
});
