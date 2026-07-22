import type {ApiAnalysisResponse,ApiAnnualTrajectory} from "@senfate/contracts";

export function selectableTrajectoryYears(trajectory:ApiAnnualTrajectory):readonly number[]{
  return trajectory.points.filter(point=>point.status==="stable"||point.failureCode==="trajectory-not-loaded").map(point=>point.year);
}

export function mergeTrajectoryBatch(current:ApiAnalysisResponse,batch:ApiAnalysisResponse):ApiAnalysisResponse{
  const replacements=new Map(batch.annualTrajectory.points.map(point=>[point.year,point]));
  return{...current,annualTrajectory:{...current.annualTrajectory,points:current.annualTrajectory.points.map(point=>replacements.get(point.year)??point)}};
}

export function mergeAnnualDetail(current:ApiAnalysisResponse,detail:ApiAnalysisResponse):ApiAnalysisResponse{
  const selected=detail.annualTrajectory.points.find(point=>point.year===detail.annual.targetYear&&point.status==="stable");
  const points=selected?current.annualTrajectory.points.map(point=>point.year===selected.year&&point.status==="unavailable"?selected:point):current.annualTrajectory.points;
  return{...detail,annualTrajectory:points===current.annualTrajectory.points?current.annualTrajectory:{...current.annualTrajectory,points}};
}
