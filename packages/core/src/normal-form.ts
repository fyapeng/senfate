import type { ClosedResult } from "./algebra";

export interface RewriteResult<S> { readonly state:S; readonly changed:boolean; readonly ruleId:string }
export interface RewriteOperator<S> { readonly id:string; apply(state:S):RewriteResult<S> }
export interface NormalFormOptions<S> { readonly maxIterations:number; readonly fingerprint:(state:S)=>string; readonly operators:readonly RewriteOperator<S>[] }
export interface StableNormalForm<S> { readonly status:"stable"; readonly state:S; readonly iterations:number; readonly trace:readonly string[]; readonly fingerprint:string }
export type NormalFormFailure="cycle"|"limit-reached"|"invalid-options";

export function evaluateNormalForm<S>(initial:S,options:NormalFormOptions<S>):ClosedResult<StableNormalForm<S>,NormalFormFailure>{
  const baseCertificate={functional:"resolution.normal-form",operatorIds:options.operators.map(x=>x.id),maxIterations:options.maxIterations};
  if(!Number.isInteger(options.maxIterations)||options.maxIterations<1||new Set(options.operators.map(x=>x.id)).size!==options.operators.length)return{ok:false,code:"invalid-options",reason:"Normal-form options require a positive limit and unique operator IDs",certificate:baseCertificate};
  let state=initial;const seen=new Set<string>([options.fingerprint(state)]);const trace:string[]=[];
  for(let iteration=1;iteration<=options.maxIterations;iteration++){
    let changed=false;
    for(const operator of options.operators){const result=operator.apply(state);state=result.state;if(result.changed){changed=true;trace.push(result.ruleId)}}
    const fingerprint=options.fingerprint(state);
    if(!changed)return{ok:true,value:{status:"stable",state,iterations:iteration-1,trace,fingerprint},certificate:{...baseCertificate,trace}};
    if(seen.has(fingerprint))return{ok:false,code:"cycle",reason:"Rewrite state fingerprint repeated before stability",certificate:{...baseCertificate,trace,fingerprint}};
    seen.add(fingerprint);
  }
  return{ok:false,code:"limit-reached",reason:"Rewrite iteration limit reached before stability",certificate:{...baseCertificate,trace,finalFingerprint:options.fingerprint(state)}};
}
