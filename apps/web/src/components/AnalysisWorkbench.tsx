import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import {
  ANALYSIS_REQUEST_SCHEMA,
  type ApiAnalysisRequest,
  type ApiAnalysisResponse,
  type ApiErrorResponse,
  type ApiLocation,
  type ApiLocationSearchResponse,
  type ApiModelId,
  type ApiModelOverrides,
  type ApiSex,
  type ApiTopicContributionCertificate,
} from "@senfate/contracts";
import {clearModelSettings,loadModelSettings,modelOverrideCount} from "../model-settings";
import {formatCoordinateUncertainty,validateExactCoordinates} from "../coordinates";
import {ANALYSIS_TABS,clearAnalysisSession,loadAnalysisSession,saveAnalysisSession,type AnalysisTab} from "../analysis-session";
import {userFacingRequestError} from "../request-error";
import {mergeAnnualDetail,mergeTrajectoryBatch,selectableTrajectoryYears} from "../analysis-result";

const API_BASE = import.meta.env.PUBLIC_API_BASE ?? "https://fyapeng.com/senfate/api/v1";
const tabs = ANALYSIS_TABS;
const modelLabels: Readonly<Record<ApiModelId, string>> = {
  "transparent-baseline": "透明综合基准",
  "month-command": "月令结构优先",
  "climate-priority": "调候优先",
};
const errorLabels: Readonly<Record<string, string>> = {
  "ambiguous-local-time": "这个当地时刻出现过两次，请在计算口径中选择较早或较晚时刻。",
  "nonexistent-local-time": "这个当地时刻因夏令时切换而不存在，请调整出生时间。",
  "boundary-ambiguous": "时间或地点精度跨越了时辰、日界，请提供更精确的地点或时间。",
  "ephemeris-window-mismatch": "输入的不确定区间跨越节气边界，系统已停止给出单一排盘。",
  "outside-ephemeris-range": "当前认证节气表支持 1850—2100 年。",
};

function ganZhi(value: { stem: string; branch: string }): string { return `${value.stem}${value.branch}`; }
function decimal(value: number, digits = 2): string { return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(value); }
function localDate(utcMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utcMs));
}
function utcDateTime(utcMs: number): string { return new Date(utcMs).toISOString().replace("T", " ").slice(0, 16) + " UTC"; }
function localWallClock(wallTimeMs: number): string { return new Date(wallTimeMs).toISOString().replace("T", " ").slice(0, 16); }

export function AnalysisWorkbench() {
  const [active, setActive] = useState<AnalysisTab>("命盘");
  const [advanced, setAdvanced] = useState(false);
  const [date, setDate] = useState("1993-01-26");
  const [time, setTime] = useState("05:30");
  const [targetYear,setTargetYear]=useState(2026);
  const [sex, setSex] = useState<ApiSex>("female");
  const [modelId, setModelId] = useState<ApiModelId>("transparent-baseline");
  const [modelOverrides,setModelOverrides]=useState<ApiModelOverrides>({});
  const [clockUncertaintySeconds, setClockUncertaintySeconds] = useState(60);
  const [useExactCoordinates,setUseExactCoordinates]=useState(false);
  const [latitude,setLatitude]=useState("");
  const [longitude,setLongitude]=useState("");
  const [coordinateUncertaintyMeters,setCoordinateUncertaintyMeters]=useState("100");
  const [disambiguation, setDisambiguation] = useState<"earlier" | "later" | "reject">("reject");
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<readonly ApiLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ApiLocation>();
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiAnalysisResponse>();
  const [resultLocationLabel,setResultLocationLabel]=useState<string>();
  const [analysisRequest,setAnalysisRequest]=useState<ApiAnalysisRequest>();
  const [message, setMessage] = useState("");
  const [sessionLoaded,setSessionLoaded]=useState(false);
  const [trajectoryLoading,setTrajectoryLoading]=useState(false);
  const [annualSelectingYear,setAnnualSelectingYear]=useState<number>();
  const trajectoryAbort=useRef<AbortController | undefined>(undefined);
  const annualDetailAbort=useRef<AbortController | undefined>(undefined);
  const analysisGeneration=useRef(0);

  useEffect(()=>{const stored=loadModelSettings();if(stored){setModelId(stored.baseModelId);setModelOverrides(stored.overrides)}},[]);
  useEffect(()=>{const stored=loadAnalysisSession(window.sessionStorage);if(stored){setDate(stored.date);setTime(stored.time);setTargetYear(stored.targetYear);setSex(stored.sex);setClockUncertaintySeconds(stored.clockUncertaintySeconds);setUseExactCoordinates(stored.useExactCoordinates);setLatitude(stored.latitude);setLongitude(stored.longitude);setCoordinateUncertaintyMeters(stored.coordinateUncertaintyMeters);setDisambiguation(stored.disambiguation);setQuery(stored.query);setSelectedLocation(stored.selectedLocation);setResultLocationLabel(stored.resultLocationLabel);setAnalysisRequest(stored.request);setResult(stored.result);setActive(stored.activeTab)}setSessionLoaded(true)},[]);
  useEffect(()=>{if(!sessionLoaded)return;saveAnalysisSession(window.sessionStorage,{version:2,date,time,targetYear,sex,clockUncertaintySeconds,useExactCoordinates,latitude,longitude,coordinateUncertaintyMeters,disambiguation,query,...(selectedLocation?{selectedLocation}:{}),...(resultLocationLabel?{resultLocationLabel}:{}),...(analysisRequest?{request:analysisRequest}:{}),...(result?{result}:{}),activeTab:active})},[sessionLoaded,date,time,targetYear,sex,clockUncertaintySeconds,useExactCoordinates,latitude,longitude,coordinateUncertaintyMeters,disambiguation,query,selectedLocation,resultLocationLabel,analysisRequest,result,active]);
  useEffect(()=>()=>{trajectoryAbort.current?.abort();annualDetailAbort.current?.abort()},[]);

  useEffect(() => {
    if (selectedLocation && query === selectedLocation.displayName) return;
    if (query.trim().length < 1) { setLocations([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`${API_BASE}/locations/search?q=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal });
        const body = await response.json() as ApiLocationSearchResponse | ApiErrorResponse;
        if (!response.ok || !("results" in body)) throw new Error("地点索引暂时不可用");
        setLocations(body.results);
      } catch (cause) {
        if (!controller.signal.aborted) setMessage(userFacingRequestError(cause,"地点搜索暂时不可用，请稍后重试。"));
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selectedLocation]);

  const exactCoordinate=useMemo(()=>validateExactCoordinates({enabled:useExactCoordinates,latitude,longitude,uncertaintyMeters:coordinateUncertaintyMeters}),[useExactCoordinates,latitude,longitude,coordinateUncertaintyMeters]);
  const canSubmit = Boolean(selectedLocation && date && time && exactCoordinate.valid && !submitting && annualSelectingYear===undefined);
  const inputSummary = useMemo(() => selectedLocation ? `${selectedLocation.displayName} · ${selectedLocation.timeZone}${useExactCoordinates?" · 精确坐标":""}` : "尚未选择规范地点", [selectedLocation,useExactCoordinates]);

  function requestPayloadFor(yearToOpen:number):ApiAnalysisRequest|undefined{
    if(!selectedLocation||!exactCoordinate.valid)return undefined;
    const [year,month,day]=date.split("-").map(Number);const [hour,minute]=time.split(":").map(Number);
    if(!year||!month||!day||hour===undefined||minute===undefined)return undefined;
    return{schemaVersion:ANALYSIS_REQUEST_SCHEMA,targetYear:yearToOpen,locationId:selectedLocation.id,localDateTime:{year,month,day,hour,minute},sex,modelId,...(modelOverrideCount(modelOverrides)?{modelOverrides}:{}),...(exactCoordinate.value?{exactCoordinates:exactCoordinate.value}:{}),disambiguation,clockUncertaintySeconds,periodCount:12};
  }

  async function requestFullAnalysis(payload:ApiAnalysisRequest,signal?:AbortSignal):Promise<ApiAnalysisResponse>{
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch(`${API_BASE}/analysis/calculate`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),...(signal?{signal}:{})});
        const candidate=await response.json() as ApiAnalysisResponse|ApiErrorResponse;
        if(response.ok&&"structure" in candidate)return candidate;
        const code="error" in candidate?candidate.error.code:"request-failed";
        throw new Error(errorLabels[code]??"计算服务暂时不可用，请稍后重试。");
      }catch(cause){if(signal?.aborted||attempt===1)throw cause}
      await new Promise(resolve=>window.setTimeout(resolve,700));
    }
    throw new Error("计算服务暂时不可用，请稍后重试。");
  }

  async function calculate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLocation) { setMessage("请从搜索结果中选择出生地点。 "); return; }
    if(!exactCoordinate.valid){setMessage(exactCoordinate.reason);return}
    const requestPayload=requestPayloadFor(targetYear);if(!requestPayload){setMessage("请检查出生日期、时间与地点。");return}
    const generation=++analysisGeneration.current;trajectoryAbort.current?.abort();annualDetailAbort.current?.abort();setAnnualSelectingYear(undefined);setTrajectoryLoading(false);setSubmitting(true); setMessage("");setAnalysisRequest(undefined); setResult(undefined);
    try {
      const body=await requestFullAnalysis(requestPayload);if(analysisGeneration.current!==generation)return;
      setResultLocationLabel(selectedLocation.displayName);setAnalysisRequest(requestPayload);setResult(body);setActive("命盘");void loadMonthlyCandles(body,requestPayload,generation);
    } catch (cause) { setMessage(userFacingRequestError(cause,"计算服务暂时不可用，请稍后重试。")); }
    finally { if(analysisGeneration.current===generation)setSubmitting(false); }
  }

  async function loadMonthlyCandles(base:ApiAnalysisResponse,payload:ApiAnalysisRequest,generation:number){
    const years=base.annualTrajectory.points.filter(point=>point.status==="unavailable"?point.failureCode==="trajectory-not-loaded":point.monthlyCandle.status==="unavailable"&&point.monthlyCandle.failureCode==="monthly-candle-not-loaded").map(point=>point.year);
    if(years.length===0)return;
    const batches:Readonly<{startYear:number;endYear:number}>[]=[];
    for(let index=0;index<years.length;index+=4)batches.push({startYear:years[index]!,endYear:years[Math.min(index+3,years.length-1)]!});
    const controller=new AbortController();trajectoryAbort.current=controller;setTrajectoryLoading(true);
    let nextBatch=0;let failed=0;
    async function requestBatch(batch:Readonly<{startYear:number;endYear:number}>):Promise<ApiAnalysisResponse|undefined>{
      for(let attempt=0;attempt<3&&!controller.signal.aborted;attempt++){
        try{
          const response=await fetch(`${API_BASE}/analysis/trajectory?startYear=${batch.startYear}&endYear=${batch.endYear}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),signal:controller.signal});
          const body=await response.json() as ApiAnalysisResponse|ApiErrorResponse;
          if(response.ok&&"annualTrajectory" in body)return body;
        }catch{if(controller.signal.aborted)return undefined;}
        if(attempt<2)await new Promise(resolve=>window.setTimeout(resolve,600*(attempt+1)));
      }
      return undefined;
    }
    async function worker(){
      while(!controller.signal.aborted){
        const batch=batches[nextBatch++];if(!batch)return;
        const body=await requestBatch(batch);if(!body){if(!controller.signal.aborted)failed+=1;continue;}
        setResult(current=>current&&analysisGeneration.current===generation?mergeTrajectoryBatch(current,body):current);
      }
    }
    await worker();
    if(trajectoryAbort.current===controller&&analysisGeneration.current===generation){trajectoryAbort.current=undefined;setTrajectoryLoading(false);if(failed>0)setMessage(`${failed} 个流月区间暂未完成，图中已保留缺口，可以重新生成后再试。`);}
  }

  async function selectAnnualYear(year:number){
    if(!result||annualSelectingYear!==undefined)return;if(result.annual.targetYear===year){setActive("年度主题");return}
    if(!analysisRequest){setMessage("当前结果缺少完整的计算请求，请重新生成一次分析。");return}const payload:ApiAnalysisRequest={...analysisRequest,targetYear:year};
    annualDetailAbort.current?.abort();const controller=new AbortController();annualDetailAbort.current=controller;const generation=analysisGeneration.current;setAnnualSelectingYear(year);setMessage("");
    try{const detail=await requestFullAnalysis(payload,controller.signal);if(controller.signal.aborted||analysisGeneration.current!==generation)return;setTargetYear(year);setAnalysisRequest(payload);setResult(current=>current?mergeAnnualDetail(current,detail):detail);setActive("年度主题")}
    catch(cause){if(!controller.signal.aborted)setMessage(userFacingRequestError(cause,`${year} 年度详情暂时无法载入，请稍后重试。`))}
    finally{if(annualDetailAbort.current===controller){annualDetailAbort.current=undefined;setAnnualSelectingYear(undefined)}}
  }

  function clearSession(){analysisGeneration.current++;trajectoryAbort.current?.abort();annualDetailAbort.current?.abort();trajectoryAbort.current=undefined;annualDetailAbort.current=undefined;setTrajectoryLoading(false);setAnnualSelectingYear(undefined);clearAnalysisSession(window.sessionStorage);setDate("1993-01-26");setTime("05:30");setTargetYear(2026);setSex("female");setClockUncertaintySeconds(60);setDisambiguation("reject");setCoordinateUncertaintyMeters("100");setResultLocationLabel(undefined);setAnalysisRequest(undefined);setResult(undefined);setSelectedLocation(undefined);setQuery("");setUseExactCoordinates(false);setLatitude("");setLongitude("");setMessage("本次浏览会话中的出生信息和结果已清除。");setActive("命盘")}

  return (
    <div className="workbench live-workbench">
      <aside className="input-panel">
        <div className="panel-heading"><div><span className="step-label">填写信息</span><h2>出生信息</h2></div><button className="privacy-pill session-clear" type="button" onClick={clearSession}>清除本次记录</button></div>
        <form onSubmit={calculate}>
          <label>出生日期<input type="date" min="1850-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <div className="field-row">
            <label>出生时间<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
            <label>性别<select value={sex} onChange={(event) => setSex(event.target.value as ApiSex)}><option value="female">女</option><option value="male">男</option></select></label>
          </div>
          <label className="location-field">出生地点
            <div className="location-input"><span aria-hidden="true">⌖</span><input type="search" value={query} placeholder="搜索城市、县区或国家" autoComplete="off" onChange={(event) => { setQuery(event.target.value); setSelectedLocation(undefined); }} aria-expanded={locations.length > 0} /></div>
            {searching && <small>正在查询规范地点…</small>}
            {locations.length > 0 && !selectedLocation && <div className="location-results" role="listbox" aria-label="地点搜索结果">{locations.map((location) => <button type="button" role="option" key={location.id} onClick={() => { setSelectedLocation(location);setLatitude(String(location.latitude));setLongitude(String(location.longitude)); setQuery(location.displayName); setLocations([]); setMessage(""); }}><strong>{location.displayName}</strong><span>{location.countryCode} · {location.timeZone}</span></button>)}</div>}
            {!searching && <small>{inputSummary}</small>}
          </label>
          <label>模型预设<select value={modelId} onChange={(event) => {setModelId(event.target.value as ApiModelId);setModelOverrides({});clearModelSettings()}}>{Object.entries(modelLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select><small>{modelOverrideCount(modelOverrides)>0?`已应用 ${modelOverrideCount(modelOverrides)} 项自定义权重。`:"使用公开预设参数。"} <a className="inline-link" href="/senfate/models/">调整模型参数</a></small></label>
          <label>首次展开年度<input type="number" min={Math.max(1850,Number(date.slice(0,4))||1850)} max="2100" value={targetYear} disabled={Boolean(result)} onChange={(event)=>setTargetYear(Number(event.target.value))} required/><small>{result?"请在人生轨迹中直接选择其他年份。":"只决定首先查看哪一年；其余大运、流年和流月轨迹会随后自动生成。"}</small></label>
          <button className="advanced-toggle" type="button" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}><span>时间精度与歧义处理</span><i>{advanced ? "−" : "+"}</i></button>
          {advanced && <div className="advanced-fields">
            <label className="coordinate-toggle"><input type="checkbox" checked={useExactCoordinates} onChange={(event)=>setUseExactCoordinates(event.target.checked)}/><span>使用精确出生坐标<small>时区仍由上方规范地点确定；经纬度用于地方视太阳时和边界误差。</small></span></label>
            {useExactCoordinates&&<div className="coordinate-fields"><label>纬度<input type="number" min="-90" max="90" step="0.000001" value={latitude} onChange={(event)=>setLatitude(event.target.value)}/></label><label>经度<input type="number" min="-180" max="180" step="0.000001" value={longitude} onChange={(event)=>setLongitude(event.target.value)}/></label><label>坐标误差（米）<input type="number" min="0" max="1000000" step="1" value={coordinateUncertaintyMeters} onChange={(event)=>setCoordinateUncertaintyMeters(event.target.value)}/></label></div>}
            <label>钟表时间精度<select value={clockUncertaintySeconds} onChange={(event) => setClockUncertaintySeconds(Number(event.target.value))}><option value={1}>精确到秒</option><option value={60}>精确到分钟</option><option value={1800}>约半小时</option><option value={3600}>约一小时</option></select></label>
            <label>重复当地时刻<select value={disambiguation} onChange={(event) => setDisambiguation(event.target.value as typeof disambiguation)}><option value="reject">停止并提示</option><option value="earlier">采用较早时刻</option><option value="later">采用较晚时刻</option></select></label>
          </div>}
          {useExactCoordinates&&!exactCoordinate.valid&&<p className="field-error">{exactCoordinate.reason}</p>}
          <button className="calculate-button" type="submit" disabled={!canSubmit}><span>{submitting ? "正在计算…" : "生成完整分析"}</span><small>排盘 · 格局 · 大运 · 流年 · 人生轨迹</small></button>
          {message && <p className="form-message" role="alert">{message}</p>}
        </form>
        <p className="privacy-copy">出生信息与结果仅在当前浏览器标签会话中保留，便于页面往返；关闭标签页或点击“清除”即移除。服务端不写入用户数据库。</p>
      </aside>

      <section className="result-panel" aria-label="排盘计算结果">
        {!result ? <EmptyResult /> : <>
          <div className="result-header"><div><span className="step-label">分析结果</span><h2>{resultLocationLabel??result.calendar.location.displayName}命盘</h2><p>{result.calendar.model.label} · {result.calendar.time.timeZone}{result.modelConfiguration.customized?` · ${result.modelConfiguration.overrideCount} 项自定义设置`:""}</p></div><span className="verified-pill">计算完成</span></div>
          <div className="result-tabs" role="tablist" aria-label="结果层级">{tabs.map((tab) => <button role="tab" type="button" aria-selected={active === tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}</div>
          <div className="result-body">
            {active === "命盘" && <ChartResult result={result} date={date} time={time} />}
            {active === "结构" && <StructureResult result={result} />}
            {active === "格局与调候" && <InterpretationResult result={result} />}
            {active === "大运" && <LuckResult result={result} />}
            {active === "人生轨迹" && <LifeTrajectoryResult result={result} loading={trajectoryLoading} selectingYear={annualSelectingYear} onSelectYear={selectAnnualYear} />}
            {active === "年度主题" && <AnnualTopicResult result={result} />}
            {active === "计算证书" && <CertificateResult result={result} />}
          </div>
        </>}
      </section>
    </div>
  );
}

function EmptyResult() {
  return <div className="empty-result"><span>准备开始</span><h2>从准确的出生时间与地点开始</h2><p>系统会处理当地历史时间、真太阳时、节气边界、四柱十神、格局、大运和逐年轨迹。输入接近换日、换月或时区切换边界时，会请你确认后再继续。</p><div className="empty-flow"><b>出生时空</b><i>→</i><b>四柱十神</b><i>→</i><b>格局强弱</b><i>→</i><b>大运流年</b></div></div>;
}

function ChartResult({ result, date, time }: { result: ApiAnalysisResponse; date: string; time: string }) {
  const calendar = result.calendar;
  const pillars = [["年柱", calendar.pillars.year, result.structure.pillars.year], ["月柱", calendar.pillars.month, result.structure.pillars.month], ["日柱", calendar.pillars.day, result.structure.pillars.day], ["时柱", calendar.pillars.hour, result.structure.pillars.hour]] as const;
  return <>
    <div className="chart-summary"><div><span>日主</span><strong>{result.structure.dayMaster.stem}{result.structure.dayMaster.element}</strong><small>{result.structure.dayMaster.polarity}{result.structure.dayMaster.element}</small></div><div className="season-chip"><span>节气月序</span><strong>第 {calendar.solarTerms.monthOrdinal + 1} 月</strong><small>{calendar.solarTerms.previous.name}之后</small></div><div className="summary-note"><span>输入可信区间</span><p>时间与地点合并不确定度约 ±{decimal(calendar.time.uncertaintySeconds, 0)} 秒。</p></div></div>
    <div className="pillars">{pillars.map(([label, pillar, detail], index) => <article className={index === 2 ? "day-pillar" : ""} key={label}><span>{label}</span><div className={`stem element-${elementClass[detail.visibleElement]}`}>{pillar.stem}</div><div className={`branch element-${elementClass[detail.hiddenStems[0]!.element]}`}>{pillar.branch}</div><dl><div><dt>十神</dt><dd><b className={`ten-god ${tenGodTone(index === 2 ? "比肩" : detail.tenGod)}`}>{index === 2 ? "日主" : detail.tenGod}</b></dd></div><div><dt>藏干</dt><dd className="hidden-stems">{detail.hiddenStems.map((item)=><i className={`element-${elementClass[item.element]}`} key={`${item.stem}-${item.rank}`}>{item.stem}</i>)}</dd></div></dl></article>)}</div>
    <div className="method-row"><div><span>原始当地时间</span><strong>{date} {time}</strong></div><b>→</b><div><span>历史时区</span><strong>UTC{calendar.time.utcOffsetMinutes >= 0 ? "+" : ""}{decimal(calendar.time.utcOffsetMinutes / 60)}</strong></div><b>→</b><div><span>地方视太阳时</span><strong>{localWallClock(calendar.time.apparentSolarWallTimeMs)}</strong><small>修正 {calendar.time.apparentSolarCorrectionMinutes >= 0 ? "+" : ""}{decimal(calendar.time.apparentSolarCorrectionMinutes)} 分钟</small></div></div>
    <div className="term-window"><div><span>前一节</span><strong>{calendar.solarTerms.previous.name}</strong><small>{utcDateTime(calendar.solarTerms.previous.utcMs)}</small></div><i>出生时刻位于认证节气窗口内</i><div><span>后一节</span><strong>{calendar.solarTerms.next.name}</strong><small>{utcDateTime(calendar.solarTerms.next.utcMs)}</small></div></div>
  </>;
}

const elementClass = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" } as const;
function tenGodTone(value:string):string{return value==="比肩"||value==="劫财"?"peer":value==="正印"||value==="偏印"?"resource":value==="食神"||value==="伤官"?"output":value==="正财"||value==="偏财"?"wealth":"officer"}
const strengthLabels = { "very-weak": "极弱", weak: "偏弱", balanced: "中和", strong: "偏强", "very-strong": "极强" } as const;
const relationLabels: Readonly<Record<string, string>> = { "stem-combine": "天干合", "branch-combine": "地支合", "branch-clash": "地支冲", "branch-harm": "地支害", "branch-break": "地支破", "branch-punishment": "地支刑", "three-harmony": "三合", "three-meeting": "三会" };
const statusLabels: Readonly<Record<string, string>> = { effective: "有效", transformed: "成化", contested: "争议", blocked: "阻断", candidate: "候选" };
const specialStateLabels:Readonly<Record<string,string>>={"luck-annual-repeat":"岁运并临","phase-very-weak":"阶段极弱","phase-very-strong":"阶段极强","natal-seven-supportive":"七字生助同向","natal-seven-pressuring":"七字克泄耗同向"};

function StructureResult({ result }: { result: ApiAnalysisResponse }) {
  const structure = result.structure;
  const total = structure.elementMeasure.total || 1;
  const elements = (["木", "火", "土", "金", "水"] as const).map((element) => ({ element, value: structure.elementMeasure.atoms[element], percent: structure.elementMeasure.atoms[element] / total * 100 }));
  return <div className="structure-result">
    <div className="structure-grid">
      <article className="insight-card wide"><div className="card-title"><div><span>五行测度</span><h3>显干、藏干与月令修正后的有限测度</h3></div><em>模型内部量，不是自然比例</em></div><div className="measure-bars">{elements.map((item) => <div key={item.element}><span>{item.element}</span><i><b className={elementClass[item.element]} style={{ width: `${item.percent}%` }}></b></i><strong>{decimal(item.value, 2)}</strong></div>)}</div></article>
      <article className="insight-card"><span>日主强弱</span><h3>{strengthLabels[structure.strength.state]}</h3><p>支持占总作用量 {decimal(structure.strength.supportRatio * 100, 1)}%，支持 {decimal(structure.strength.support)}，压力 {decimal(structure.strength.pressure)}。</p><footer><b className="state effective">已求值</b><span>根质量 {decimal(structure.rootExposure.dayMasterRootMass)}</span></footer></article>
      <article className="insight-card"><span>干支关系</span><h3>{structure.relations.length} 条关系成立</h3><p>合冲刑害会结合完整度、月令、通根和相互竞争判断，不把所有表面组合都算作成立。</p><footer><b className="state effective">已判定</b><span>可查看逐条关系</span></footer></article>
    </div>
    <div className="decomposition-grid">{Object.entries(structure.strength.decomposition).map(([key, value]) => <article key={key}><span>{{ sameElement: "同类", resource: "生扶", root: "通根", output: "泄秀", wealth: "财星", officer: "官杀" }[key as keyof typeof structure.strength.decomposition]}</span><strong>{decimal(value)}</strong></article>)}</div>
    <div className="relation-list"><div className="relation-heading"><span>原局干支关系</span><strong>仅显示完成条件判定的关系</strong></div>{structure.relations.length === 0 ? <p className="empty-relations">当前原局没有形成达到条件的合冲刑害关系。</p> : structure.relations.map((relation) => <article key={relation.id}><div><strong>{relationLabels[relation.kind] ?? relation.kind}</strong><span>{relation.members.join(" · ")}{relation.targetElement ? ` → ${relation.targetElement}` : ""}</span></div><div><b className={`state ${relation.status}`}>{statusLabels[relation.status] ?? relation.status}</b><small>依据强度 {decimal(relation.score.total)}</small></div></article>)}</div>
  </div>;
}

const patternStatusLabels = { qualified: "条件通过", contested: "并列待裁", candidate: "待判定", unqualified: "未达阈值" } as const;
const climateLabels = { cold: "偏寒", hot: "偏热", dry: "偏燥", humid: "偏湿", balanced: "中和" } as const;
const balancingLabels = { supportive: "增益候选", neutral: "中性", avoid: "减益候选" } as const;
function patternName(tenGod:string):string{return tenGod==="比肩"||tenGod==="劫财"?`${tenGod}月令结构候选`:`${tenGod}格`}

function InterpretationResult({ result }: { result: ApiAnalysisResponse }) {
  const projection = result.interpretation;const leading=projection.pattern.candidates.filter(candidate=>candidate.status==="qualified"||candidate.status==="contested");const patternTitle=leading.length?leading.map(candidate=>patternName(candidate.tenGod)).join(" / "):patternStatusLabels[projection.pattern.status];
  return <div className="interpretation-result">
    <div className="interpretation-grid">
      <article className="insight-card"><span>月令格局投影</span><h3>{patternTitle}</h3><p>{leading.length?`${patternStatusLabels[projection.pattern.status]}。`:"当前没有候选达到结构阈值。"} 候选来自月支藏干，并计入透干、通根与模型阈值；比劫月令不会在缺少禄刃条件时被直接命名为建禄格或羊刃格。</p></article>
      <article className="insight-card"><span>调候坐标</span><h3>{climateLabels[projection.climate.temperatureState]} · {climateLabels[projection.climate.humidityState]}</h3><p>温度 {decimal(projection.climate.temperature, 3)}，湿度 {decimal(projection.climate.humidity, 3)}。坐标由月令基线与五行测度共同生成。</p></article>
    </div>
    <div className="pattern-list"><div className="relation-heading"><span>格局条件排序</span><strong>按月令、透干与通根综合判断</strong></div>{projection.pattern.candidates.map((candidate) => <article key={`${candidate.stem}-${candidate.rank}`}><div><strong>{patternName(candidate.tenGod)}</strong><span>{candidate.stem} · {candidate.tenGod} · {candidate.rank === "main" ? "本气" : candidate.rank === "middle" ? "中气" : "余气"}{candidate.exposed ? " · 透干" : ""}</span></div><div><b className={`state ${candidate.status}`}>{patternStatusLabels[candidate.status]}</b><small>依据强度 {decimal(candidate.score, 3)}</small></div></article>)}</div>
    <div className="balancing-vector"><div className="relation-heading"><span>五行平衡方向</span><strong>综合强弱与寒热燥湿</strong></div>{projection.balancing.candidates.map((candidate) => <article key={candidate.element}><strong className={elementClass[candidate.element]}>{candidate.element}</strong><div><i><b style={{ width: `${Math.min(100, Math.abs(candidate.score) * 70 + 3)}%` }}></b></i><small>强弱 {decimal(candidate.strengthContribution, 3)} · 调候 {decimal(candidate.climateContribution, 3)}</small></div><span>{balancingLabels[candidate.status]} {candidate.score >= 0 ? "+" : ""}{decimal(candidate.score, 3)}</span></article>)}</div>
    <p className="boundary-note">这里给出可比较的五行方向；“用神”等最终命名仍需满足对应流派的完整条件，也不能直接推出具体事件。</p>
  </div>;
}

function LuckResult({ result }: { result: ApiAnalysisResponse }) {
  const calendar = result.calendar;
  return <div className="luck-result"><div className="luck-lead"><div><span>行运方向</span><strong>{calendar.direction === "forward" ? "顺排" : "逆排"}</strong></div><div><span>起运年龄</span><strong>{decimal(calendar.luckStartAgeYears, 3)} 岁</strong><small>区间 {decimal(calendar.luckStartAgeInterval.lower, 3)}—{decimal(calendar.luckStartAgeInterval.upper, 3)}</small></div><p>每一步均累计原局与当步大运，重新计算五行测度、强弱、关系正规形和候选向量。</p></div><div className="luck-grid">{result.luckDynamics.map((period) => { const calendarPeriod = calendar.majorLuck.find((item) => item.ordinal === period.ordinal)!; const supportive = period.interpretation.balancing.candidates.filter((item) => item.status === "supportive").slice(0, 2).map((item) => item.element).join("、") || "无显著项"; return <article key={period.ordinal}><span>第 {period.ordinal} 运 · {strengthLabels[period.strength.state]}</span><strong>{ganZhi(period.pillar)}</strong><p>{decimal(period.startAgeInterval.lower, 2)}—{decimal(period.startAgeInterval.upper, 2)} 岁起</p><small>{localDate(calendarPeriod.startUtcMs, calendar.time.timeZone)} · 增益候选 {supportive}</small><em>支持比 {decimal(period.strength.supportRatio * 100, 1)}% · {period.relations.length} 条关系</em></article>; })}</div></div>;
}

function LifeTrajectoryResult({result,loading,selectingYear,onSelectYear}:{result:ApiAnalysisResponse;loading:boolean;selectingYear:number|undefined;onSelectYear:(year:number)=>void}){
  const trajectory=result.annualTrajectory;const points=trajectory.points;const width=Math.max(760,points.length*24+70);const height=300;const plotTop=28;const plotHeight=210;const x=(index:number)=>50+(points.length<=1?0:index*(width-80)/(points.length-1));const y=(value:number)=>plotTop+(1-Math.max(-1,Math.min(1,value)))/2*plotHeight;
  const stable=points.filter((point):point is Extract<(typeof points)[number],{status:"stable"}>=>point.status==="stable");const pending=points.filter(point=>point.status==="unavailable"&&point.failureCode==="trajectory-not-loaded");const candles=stable.filter(point=>point.monthlyCandle.status==="stable");const special=stable.filter(point=>point.specialStateCodes.length>0);const visibleSpecial=[...special].sort((a,b)=>Number(b.year===result.annual.targetYear)-Number(a.year===result.annual.targetYear)||Number(b.specialStateCodes.includes("luck-annual-repeat"))-Number(a.specialStateCodes.includes("luck-annual-repeat"))||a.year-b.year).slice(0,12);const tickEvery=Math.max(1,Math.ceil(points.length/8));const selectableYears=selectableTrajectoryYears(trajectory);
  return <div className="life-trajectory-result">
    <div className="trajectory-lead"><div><span>人生状态 K 线</span><h3>{trajectory.startYear}—{trajectory.endYear}</h3></div><p>每个年度累计原局、所属大运和流年；蜡烛的开、高、低、收来自立春起连续十二个流月的逐月重算。点击任一 K 线即可继续查看该年的六亲、主题与古籍来源。</p><div><strong>{candles.length}/{points.length}</strong><span>{loading?"正在生成年度与流月轨迹":candles.length===stable.length&&pending.length===0?"流月影线已生成":"部分流月影线暂缺"}</span><small>{loading?`${pending.length} 个年度正在排队`:`${points.length-stable.length} 个明确缺口`}</small></div></div>
    <div className="trajectory-year-control"><label>查看年度<select value={result.annual.targetYear} disabled={selectingYear!==undefined} onChange={event=>onSelectYear(Number(event.target.value))}>{selectableYears.map(year=><option value={year} key={year}>{year} 年</option>)}</select></label><span>{selectingYear===undefined?`${result.annual.targetYear} 年详情已载入`:`正在载入 ${selectingYear} 年的完整分析…`}</span></div>
    <div className="trajectory-chart" role="img" aria-label={`${trajectory.startYear}年至${trajectory.endYear}人生状态轨迹`}><svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <line className="trajectory-grid zero" x1="45" x2={width-25} y1={y(0)} y2={y(0)}/><line className="trajectory-grid" x1="45" x2={width-25} y1={y(1)} y2={y(1)}/><line className="trajectory-grid" x1="45" x2={width-25} y1={y(-1)} y2={y(-1)}/>
      <text x="8" y={y(1)+4}>+1</text><text x="18" y={y(0)+4}>0</text><text x="8" y={y(-1)+4}>−1</text>
      {points.slice(1).map((point,index)=>{const previous=points[index];if(point.status!=="stable"||previous?.status!=="stable")return null;return <g key={`segment-${point.year}`}><line className="trajectory-support-segment" x1={x(index)} y1={y(previous.supportRatio*2-1)} x2={x(index+1)} y2={y(point.supportRatio*2-1)}/><line className="trajectory-index-segment" x1={x(index)} y1={y(previous.normalizedTopicIndex)} x2={x(index+1)} y2={y(point.normalizedTopicIndex)}/></g>})}
      {points.map((point,index)=>{if(point.status!=="stable"){const isPending=point.failureCode==="trajectory-not-loaded";const canOpen=isPending&&selectingYear===undefined;return <g className={`${isPending?"trajectory-pending":"trajectory-gap"} ${point.year===result.annual.targetYear?"selected":""} ${canOpen?"selectable":""}`} key={point.year} role={canOpen?"button":undefined} tabIndex={canOpen?0:undefined} aria-label={canOpen?`查看 ${point.year} 年完整分析`:undefined} onClick={()=>{if(canOpen)onSelectYear(point.year)}} onKeyDown={event=>{if(canOpen&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onSelectYear(point.year)}}}><line x1={x(index)} x2={x(index)} y1={plotTop} y2={plotTop+plotHeight}/><title>{point.year} · {isPending?"年度轨迹正在生成，可先查看完整分析":"年度不可用"}</title></g>}const candle=point.monthlyCandle;const direction=candle.status==="stable"&&candle.close<candle.open?"negative":"positive";const canOpen=selectingYear===undefined;return <g className={`trajectory-candle ${direction} ${point.year===result.annual.targetYear?"selected":""} ${canOpen?"selectable":""}`} key={point.year} role="button" tabIndex={canOpen?0:undefined} aria-label={`查看 ${point.year} 年完整分析`} onClick={()=>{if(canOpen)onSelectYear(point.year)}} onKeyDown={event=>{if(canOpen&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onSelectYear(point.year)}}}>{candle.status==="stable"?<><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)}/><rect x={x(index)-3} y={Math.min(y(candle.open),y(candle.close))} width="6" height={Math.max(3,Math.abs(y(candle.open)-y(candle.close)))}/></>:<line className="monthly-gap" x1={x(index)} x2={x(index)} y1={y(.08)} y2={y(-.08)}/>}<circle cx={x(index)} cy={y(point.normalizedTopicIndex)} r={point.year===result.annual.targetYear?4:2.5}/>{point.specialStateCodes.length>0&&<path d={`M ${x(index)-5} ${plotTop-4} L ${x(index)+5} ${plotTop-4} L ${x(index)} ${plotTop+5} Z`}/>}<title>{point.year} · {ganZhi(point.luckPillar)}运 / {ganZhi(point.annualPillar)}年 · 年度方向 {decimal(point.normalizedTopicIndex,3)} · {candle.status==="stable"?`流月 开 ${decimal(candle.open,3)} / 高 ${decimal(candle.high,3)} / 低 ${decimal(candle.low,3)} / 收 ${decimal(candle.close,3)}`:"流月序列不可用"}{point.specialStateCodes.length?` · ${point.specialStateCodes.map(code=>specialStateLabels[code]??"特殊状态").join("、")}`:""}</title></g>})}
      {points.map((point,index)=>index%tickEvery===0||index===points.length-1?<text className="trajectory-year" x={x(index)} y="274" textAnchor="middle" key={`year-${point.year}`}>{point.year}</text>:null)}
    </svg></div>
    <div className="trajectory-legend"><span><i className="index"></i>年度综合方向</span><span><i className="support"></i>命局支持结构</span><span><b></b>十二流月开高低收</span><span><em></em>特殊状态</span></div>
    {special.length>0&&<div className="trajectory-events"><div className="relation-heading"><span>特殊状态年度</span><strong>优先显示目标年、岁运并临与极值状态</strong></div>{visibleSpecial.map(point=><article key={point.year}><strong>{point.year}</strong><span>{ganZhi(point.luckPillar)}运 · {ganZhi(point.annualPillar)}年</span><div>{point.specialStateCodes.map(code=><b key={code}>{specialStateLabels[code]??"特殊状态"}</b>)}</div></article>)}{special.length>visibleSpecial.length&&<p className="trajectory-more">另有 {special.length-visibleSpecial.length} 个年度已在图中标记，可移动到相应 K 线查看。</p>}</div>}
    <p className="boundary-note">纵轴表示规则证据的相对方向，不是收益率、事件概率或人生价值评分。某个流月无法稳定求值时，该年影线会留空。</p>
  </div>;
}

const topicLabels={career:"事业",family:"家庭",general:"总体",health:"身心",mobility:"迁动",personality:"表达",relationship:"关系",risk:"风险",study:"学习",wealth:"财务"} as const;
const directionLabels={support:"支持",pressure:"压力",mixed:"并存",neutral:"中性"} as const;
const effectLabels={complete_or_transform:"完成或转化",pressure:"形成压力",reveal:"显露",support:"支持",weaken_or_block:"削弱或阻断"} as const;
const evidenceLabels={"single-source":"单条来源","same-book-corroborated":"同书复证","cross-book-corroborated":"跨书复证","mixed-evidence":"方向混合"} as const;
const kinshipVisibilityLabels={visible:"显现",latent:"藏见",absent:"未见"} as const;
const kinshipLayerLabels={natal:"原局",luck:"大运",annual:"流年",month:"流月"} as const;
const sourceBookLabels:Readonly<Record<string,string>>={"san-ming-tong-hui":"《三命通会》","qian-li-ming-gao":"《千里命稿》","zi-ping-zhen-quan":"《子平真诠》","yuan-hai-zi-ping":"《渊海子平》","di-tian-sui":"《滴天髓》","shen-feng-tong-kao":"《神峰通考》","qiong-tong-bao-jian":"《穷通宝鉴》"};
const conditionStateLabels:Readonly<Record<string,string>>={"very-weak":"极弱",weak:"偏弱",balanced:"中和",strong:"偏强","very-strong":"极强",abundant:"偏旺",deficient:"偏弱",male:"男命",female:"女命",forward:"顺排",reverse:"逆排",supported:"得令支持",unsupported:"不得令支持"};
type ApiActivatedCondition=ApiTopicContributionCertificate["activatedSources"][number]["conditions"][number];
function readableConditionValue(value:string|readonly string[]):string{const values:readonly string[]=typeof value==="string"?[value]:value;return values.map(item=>conditionStateLabels[item]??item).join("、")}
function referenceConditionLabel(condition:ApiActivatedCondition):string{const value=readableConditionValue(condition.value);switch(condition.operator){case"dayStem.equals":return`日主为${value}`;case"monthBranch.equals":case"monthBranch.in":return`月支为${value}`;case"dayMasterState.equals":return`日主强弱为${value}`;case"element.state":return`${condition.subject??"指定五行"}处于${value}状态`;case"ganZhi.present":case"ganZhi.in":return`命局或岁运出现${value}`;case"relation.exists":return`稳定关系中形成${value}`;case"seasonalCommand":return`月令条件为${value}`;case"branchFormation.equals":return`地支结构形成${value}`;case"luckDirection.equals":return`大运采用${value}`;case"sex.equals":return`性别条件为${value}`;case"symbol.absent":return`不见${value}`;case"symbol.present":return`出现${value}`}}
function AnnualTopicResult({result}:{result:ApiAnalysisResponse}){
  const annual=result.annual;const topics=annual.topics;const vectors=Object.entries(topics.contribution.atoms).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  return <div className="annual-topic-result">
    <div className="annual-heading"><div><span>{annual.targetYear} · 立春起算</span><h3>{ganZhi(annual.luckPillar)}大运 × {ganZhi(annual.annualPillar)}流年</h3><p>系统先确定这一年所属的大运，再把原局、大运和流年共同纳入分析，分别查看结构变化、六亲线索与古籍规则提示。</p></div><div><strong>{topics.activated}</strong><span>本年符合的规则</span><small>共检验 {topics.evaluated} 条可执行规则</small></div></div>
    <div className="special-state-strip"><div><span>需要留意的状态</span><strong>七字同向检验：生助 {annual.specialStates.natalSevenSymbolConsensus.supportCount} / 克泄耗 {annual.specialStates.natalSevenSymbolConsensus.pressureCount}</strong></div><div>{annual.specialStates.signals.length===0?<small>当前年度没有出现已收录的特殊状态。</small>:annual.specialStates.signals.map(signal=><span className="special-state" key={signal.code}>{signal.label}<small>{signal.scope==="natal"?"原局":signal.scope==="luck"?"大运":"年度"}</small></span>)}</div></div>
    <div className="topic-vector">{vectors.map(([domain,value])=><article key={domain}><div><strong>{topicLabels[domain as keyof typeof topicLabels]}</strong><span>{value>0?"支持贡献":value<0?"压力贡献":"净值中性"}</span></div><i><b className={value<0?"negative":""} style={{width:`${Math.min(100,Math.abs(value)*5)}%`}}></b></i><em>{value>0?"+":""}{decimal(value,2)}</em></article>)}</div>
    <div className="kinship-section"><div className="relation-heading"><span>六亲关系线索</span><strong>分别查看原局、大运与流年的十神显现</strong></div><div className="kinship-grid">{annual.kinship.roles.map(role=><article className={`kinship-card ${role.visibility}`} key={role.id}><header><span>{role.label}</span><b>{kinshipVisibilityLabels[role.visibility]}</b></header><strong>{decimal(role.weightedExposure,2)}</strong><small>综合显现 · 明 {role.visibleCount} / 藏 {role.hiddenCount}</small><div className="kinship-layers">{Object.entries(role.layerExposure).map(([layer,exposure])=><span key={layer}>{kinshipLayerLabels[layer as keyof typeof kinshipLayerLabels]} <b>{decimal(exposure.weightedExposure,2)}</b></span>)}</div><details><summary>查看 {role.observedCount} 条十神依据</summary><div className="kinship-evidence">{role.evidence.length===0?<small>当前组合没有映射到该角色的十神。</small>:role.evidence.map((item,index)=><span key={`${item.pillarId}-${item.stem}-${index}`}><b className={`ten-god ${tenGodTone(item.tenGod)}`}>{item.tenGod}</b><i>{kinshipLayerLabels[item.layer]} · {item.source==="visible-stem"?"显干":`${item.hiddenRank}藏干`} · 权重 {decimal(item.weight,2)}</i></span>)}</div></details></article>)}</div></div>
    <div className="hypothesis-list"><div className="relation-heading"><span>古籍规则提示</span><strong>按生活主题和作用方向整理，可展开核对条件与来源</strong></div>{topics.eventHypotheses.length===0?<p className="empty-relations">该年度没有形成可发布的古籍规则提示。</p>:topics.eventHypotheses.map(item=>{const sources=topics.activatedSources.filter(source=>source.eventEvidence.some(evidence=>evidence.domain===item.domain&&evidence.operator===item.operator));return <details className="event-predicate" key={item.predicateId}><summary><div><strong>{topicLabels[item.domain]} · {effectLabels[item.operator]}</strong><span>{directionLabels[item.direction]} · 综合贡献 {item.contribution>0?"+":""}{decimal(item.contribution,2)}</span></div><small>{evidenceLabels[item.evidenceStatus]} · {item.sourceCount} 条 / {item.bookCount} 本</small></summary><div className="event-sources"><p>来源分布：原局 {item.scopeEvidence.natalSources}、大运 {item.scopeEvidence.luckSources}、流年 {item.scopeEvidence.annualSources}、通用 {item.scopeEvidence.unscopedSources}。同一条规则声明多个时间层时，会在相应层级共同生效。</p>{sources.slice(0,8).map(source=><div key={source.recordId}><strong>{sourceBookLabels[source.bookId]??source.bookId}</strong><span>第 {source.lineStart}—{source.lineEnd} 行 · {source.scopes.length?source.scopes.map(scope=>kinshipLayerLabels[scope]).join(" + "):"通用规则"}</span><ul className="source-conditions">{source.conditions.map((condition,index)=><li key={`${condition.operator}-${index}`}>{referenceConditionLabel(condition)}</li>)}</ul></div>)}{sources.length>8&&<small>另有 {sources.length-8} 条来源保存在完整计算证书中。</small>}</div></details>})}</div>
    <p className="boundary-note">本次检验 {topics.evaluated} 条可执行规则：{topics.activated} 条符合、{topics.inactive} 条条件不符、{topics.unresolved} 条无法确认。无法确认的规则不会按零贡献处理；延期和争议资料也不会混入结论。</p>
  </div>;
}

function CertificateResult({ result }: { result: ApiAnalysisResponse }) {
  const calendar = result.calendar;
  return <div className="certificate-result"><div className="certificate-grid"><article><span>地点来源</span><strong>{calendar.provenance.locationDataset}</strong><p>{calendar.coordinateProvenance.source} · {formatCoordinateUncertainty(calendar.coordinateProvenance.uncertaintyMeters)}</p></article><article><span>节气星历</span><strong>{calendar.provenance.ephemeris}</strong><p>摘要 {calendar.provenance.ephemerisDigest.slice(0, 16)}…</p></article><article><span>模型配置</span><strong>{result.modelConfiguration.customized?`${result.modelConfiguration.overrideCount} 项自定义权重`:"公开预设"}</strong><p>指纹 {result.modelConfiguration.overrideFingerprint}</p></article><article><span>正规形链</span><strong>原局 + {result.luckDynamics.length} 步大运</strong><p>全部稳定后才返回结果</p></article></div><details><summary>查看机器可读证书</summary><pre>{JSON.stringify(result.certificate, null, 2)}</pre></details><p className="boundary-note">证书记录历法、模型权重、五行测度、格局与调候投影、关系裁决及逐运重算链。当前结果不等同于现实事件概率。</p></div>;
}
