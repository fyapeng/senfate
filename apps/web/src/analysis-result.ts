import type {ApiAnalysisResponse,ApiAnnualTrajectory} from "@senfate/contracts";

export function selectableTrajectoryYears(trajectory:ApiAnnualTrajectory):readonly number[]{
  return trajectory.points.filter(point=>point.status==="stable"||point.failureCode==="trajectory-not-loaded").map(point=>point.year);
}

export function mergeTrajectoryBatch(current:ApiAnalysisResponse,batch:ApiAnalysisResponse):ApiAnalysisResponse{
  const replacements=new Map(batch.annualTrajectory.points.map(point=>[point.year,point]));
  return{...current,annualTrajectory:{...current.annualTrajectory,points:current.annualTrajectory.points.map(point=>replacements.get(point.year)??point)}};
}

export function mergeTrajectoryPoint(current:ApiAnalysisResponse,point:ApiAnnualTrajectory["points"][number]):ApiAnalysisResponse{
  return{...current,annualTrajectory:{...current.annualTrajectory,points:current.annualTrajectory.points.map(item=>item.year===point.year?point:item)}};
}

export function mergeBrowserAnnualDetail(
  current:ApiAnalysisResponse,
  detail:Readonly<{annual:ApiAnalysisResponse["annual"];point:ApiAnnualTrajectory["points"][number];certificate:Readonly<Record<string,unknown>>}>,
):ApiAnalysisResponse{
  return{
    ...current,
    requestId:`browser-${detail.annual.targetYear}-${detail.annual.normalForm.fingerprint}`,
    annual:detail.annual,
    annualTrajectory:{...current.annualTrajectory,points:current.annualTrajectory.points.map(item=>item.year===detail.point.year?detail.point:item)},
    certificate:{...current.certificate,browserAnnual:detail.certificate},
  };
}

export function mergeAnnualDetail(current:ApiAnalysisResponse,detail:ApiAnalysisResponse):ApiAnalysisResponse{
  const selected=detail.annualTrajectory.points.find(point=>point.year===detail.annual.targetYear&&point.status==="stable");
  const points=selected?current.annualTrajectory.points.map(point=>point.year===selected.year&&point.status==="unavailable"?selected:point):current.annualTrajectory.points;
  return{...detail,annualTrajectory:points===current.annualTrajectory.points?current.annualTrajectory:{...current.annualTrajectory,points}};
}
