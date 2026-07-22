import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  ANALYSIS_REQUEST_SCHEMA,
  type ApiAnalysisResponse,
  type ApiErrorResponse,
  type ApiLocation,
  type ApiLocationSearchResponse,
  type ApiModelId,
  type ApiModelOverrides,
  type ApiSex,
} from "@senfate/contracts";
import {clearModelSettings,loadModelSettings,modelOverrideCount} from "../model-settings";
import {formatCoordinateUncertainty,validateExactCoordinates} from "../coordinates";
import {ANALYSIS_TABS,clearAnalysisSession,loadAnalysisSession,saveAnalysisSession,type AnalysisTab} from "../analysis-session";

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
  const [message, setMessage] = useState("");
  const [sessionLoaded,setSessionLoaded]=useState(false);

  useEffect(()=>{const stored=loadModelSettings();if(stored){setModelId(stored.baseModelId);setModelOverrides(stored.overrides)}},[]);
  useEffect(()=>{const stored=loadAnalysisSession(window.sessionStorage);if(stored){setDate(stored.date);setTime(stored.time);setTargetYear(stored.targetYear);setSex(stored.sex);setClockUncertaintySeconds(stored.clockUncertaintySeconds);setUseExactCoordinates(stored.useExactCoordinates);setLatitude(stored.latitude);setLongitude(stored.longitude);setCoordinateUncertaintyMeters(stored.coordinateUncertaintyMeters);setDisambiguation(stored.disambiguation);setQuery(stored.query);setSelectedLocation(stored.selectedLocation);setResult(stored.result);setActive(stored.activeTab)}setSessionLoaded(true)},[]);
  useEffect(()=>{if(!sessionLoaded)return;saveAnalysisSession(window.sessionStorage,{version:1,date,time,targetYear,sex,clockUncertaintySeconds,useExactCoordinates,latitude,longitude,coordinateUncertaintyMeters,disambiguation,query,...(selectedLocation?{selectedLocation}:{}),...(result?{result}:{}),activeTab:active})},[sessionLoaded,date,time,targetYear,sex,clockUncertaintySeconds,useExactCoordinates,latitude,longitude,coordinateUncertaintyMeters,disambiguation,query,selectedLocation,result,active]);

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
        if (!controller.signal.aborted) setMessage(cause instanceof Error ? cause.message : "地点搜索失败");
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selectedLocation]);

  const exactCoordinate=useMemo(()=>validateExactCoordinates({enabled:useExactCoordinates,latitude,longitude,uncertaintyMeters:coordinateUncertaintyMeters}),[useExactCoordinates,latitude,longitude,coordinateUncertaintyMeters]);
  const canSubmit = Boolean(selectedLocation && date && time && exactCoordinate.valid && !submitting);
  const inputSummary = useMemo(() => selectedLocation ? `${selectedLocation.displayName} · ${selectedLocation.timeZone}${useExactCoordinates?" · 精确坐标":""}` : "尚未选择规范地点", [selectedLocation,useExactCoordinates]);

  async function calculate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLocation) { setMessage("请从搜索结果中选择出生地点。 "); return; }
    if(!exactCoordinate.valid){setMessage(exactCoordinate.reason);return}
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    setSubmitting(true); setMessage(""); setResult(undefined);
    try {
      const response = await fetch(`${API_BASE}/analysis/calculate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: ANALYSIS_REQUEST_SCHEMA,targetYear,
          locationId: selectedLocation.id,
          localDateTime: { year, month, day, hour, minute },
          sex, modelId, ...(modelOverrideCount(modelOverrides)?{modelOverrides}:{}),...(exactCoordinate.value?{exactCoordinates:exactCoordinate.value}:{}),disambiguation, clockUncertaintySeconds, periodCount: 12,
        }),
      });
      const body = await response.json() as ApiAnalysisResponse | ApiErrorResponse;
      if (!response.ok || !("structure" in body)) {
        const code = "error" in body ? body.error.code : "request-failed";
        const detail = "error" in body ? body.error.message : "计算请求失败";
        throw new Error(errorLabels[code] ?? detail);
      }
      setResult(body); setActive("命盘");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "计算服务暂时不可用"); }
    finally { setSubmitting(false); }
  }

  function clearSession(){clearAnalysisSession(window.sessionStorage);setDate("1993-01-26");setTime("05:30");setTargetYear(2026);setSex("female");setClockUncertaintySeconds(60);setDisambiguation("reject");setCoordinateUncertaintyMeters("100");setResult(undefined);setSelectedLocation(undefined);setQuery("");setUseExactCoordinates(false);setLatitude("");setLongitude("");setMessage("本次浏览会话中的出生信息和结果已清除。");setActive("命盘")}

  return (
    <div className="workbench live-workbench">
      <aside className="input-panel">
        <div className="panel-heading"><div><span className="step-label">STEP 01</span><h2>出生信息</h2></div><button className="privacy-pill session-clear" type="button" onClick={clearSession}>会话保留 · 清除</button></div>
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
          <label>首次展开年度<input type="number" min={Math.max(1850,Number(date.slice(0,4))||1850)} max="2100" value={targetYear} onChange={(event)=>setTargetYear(Number(event.target.value))} required/><small>只决定首次展示的详细结果；系统会一次计算可覆盖的全部大运与流年。</small></label>
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
          <div className="result-header"><div><span className="step-label">完整分析</span><h2>{result.calendar.location.displayName}命盘</h2><p>{result.calendar.model.label} · {result.calendar.time.timeZone}{result.modelConfiguration.customized?` · ${result.modelConfiguration.overrideCount} 项自定义设置`:""}</p></div><span className="verified-pill">计算完成</span></div>
          <div className="result-tabs" role="tablist" aria-label="结果层级">{tabs.map((tab) => <button role="tab" type="button" aria-selected={active === tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}</div>
          <div className="result-body">
            {active === "命盘" && <ChartResult result={result} date={date} time={time} />}
            {active === "结构" && <StructureResult result={result} />}
            {active === "格局与调候" && <InterpretationResult result={result} />}
            {active === "大运" && <LuckResult result={result} />}
            {active === "人生轨迹" && <LifeTrajectoryResult result={result} />}
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

function LifeTrajectoryResult({result}:{result:ApiAnalysisResponse}){
  const trajectory=result.annualTrajectory;const points=trajectory.points;const width=Math.max(760,points.length*24+70);const height=300;const plotTop=28;const plotHeight=210;const x=(index:number)=>50+(points.length<=1?0:index*(width-80)/(points.length-1));const y=(value:number)=>plotTop+(1-Math.max(-1,Math.min(1,value)))/2*plotHeight;
  const stable=points.filter((point):point is Extract<(typeof points)[number],{status:"stable"}>=>point.status==="stable");const special=stable.filter(point=>point.specialStateCodes.length>0);const tickEvery=Math.max(1,Math.ceil(points.length/8));
  return <div className="life-trajectory-result">
    <div className="trajectory-lead"><div><span>人生状态 K 线</span><h3>{trajectory.startYear}—{trajectory.endYear}</h3></div><p>每个年度累计原局、所属大运和流年；蜡烛的开、高、低、收来自立春起连续十二个流月的逐月重算。绿色主线表示年度综合方向，蓝色虚线表示命局支持结构。</p><div><strong>{stable.length}</strong><span>可计算年度</span><small>{points.length-stable.length} 个明确缺口</small></div></div>
    <div className="trajectory-chart" role="img" aria-label={`${trajectory.startYear}年至${trajectory.endYear}人生状态轨迹`}><svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <line className="trajectory-grid zero" x1="45" x2={width-25} y1={y(0)} y2={y(0)}/><line className="trajectory-grid" x1="45" x2={width-25} y1={y(1)} y2={y(1)}/><line className="trajectory-grid" x1="45" x2={width-25} y1={y(-1)} y2={y(-1)}/>
      <text x="8" y={y(1)+4}>+1</text><text x="18" y={y(0)+4}>0</text><text x="8" y={y(-1)+4}>−1</text>
      {points.slice(1).map((point,index)=>{const previous=points[index];if(point.status!=="stable"||previous?.status!=="stable")return null;return <g key={`segment-${point.year}`}><line className="trajectory-support-segment" x1={x(index)} y1={y(previous.supportRatio*2-1)} x2={x(index+1)} y2={y(point.supportRatio*2-1)}/><line className="trajectory-index-segment" x1={x(index)} y1={y(previous.normalizedTopicIndex)} x2={x(index+1)} y2={y(point.normalizedTopicIndex)}/></g>})}
      {points.map((point,index)=>{if(point.status!=="stable")return <g className="trajectory-gap" key={point.year}><line x1={x(index)} x2={x(index)} y1={plotTop} y2={plotTop+plotHeight}/><title>{point.year} · 年度不可用</title></g>;const candle=point.monthlyCandle;const direction=candle.status==="stable"&&candle.close<candle.open?"negative":"positive";return <g className={`trajectory-candle ${direction} ${point.year===result.annual.targetYear?"selected":""}`} key={point.year}>{candle.status==="stable"?<><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)}/><rect x={x(index)-3} y={Math.min(y(candle.open),y(candle.close))} width="6" height={Math.max(3,Math.abs(y(candle.open)-y(candle.close)))}/></>:<line className="monthly-gap" x1={x(index)} x2={x(index)} y1={y(.08)} y2={y(-.08)}/>}<circle cx={x(index)} cy={y(point.normalizedTopicIndex)} r={point.year===result.annual.targetYear?4:2.5}/>{point.specialStateCodes.length>0&&<path d={`M ${x(index)-5} ${plotTop-4} L ${x(index)+5} ${plotTop-4} L ${x(index)} ${plotTop+5} Z`}/>}<title>{point.year} · {ganZhi(point.luckPillar)}运 / {ganZhi(point.annualPillar)}年 · 年度方向 {decimal(point.normalizedTopicIndex,3)} · {candle.status==="stable"?`流月 开 ${decimal(candle.open,3)} / 高 ${decimal(candle.high,3)} / 低 ${decimal(candle.low,3)} / 收 ${decimal(candle.close,3)}`:"流月序列不可用"}{point.specialStateCodes.length?` · ${point.specialStateCodes.join(", ")}`:""}</title></g>})}
      {points.map((point,index)=>index%tickEvery===0||index===points.length-1?<text className="trajectory-year" x={x(index)} y="274" textAnchor="middle" key={`year-${point.year}`}>{point.year}</text>:null)}
    </svg></div>
    <div className="trajectory-legend"><span><i className="index"></i>年度综合方向</span><span><i className="support"></i>命局支持结构</span><span><b></b>十二流月开高低收</span><span><em></em>特殊状态</span></div>
    {special.length>0&&<div className="trajectory-events"><div className="relation-heading"><span>特殊状态年度</span><strong>当前批次列出轨迹标记与对应干支</strong></div>{special.map(point=><article key={point.year}><strong>{point.year}</strong><span>{ganZhi(point.luckPillar)}运 · {ganZhi(point.annualPillar)}年</span><div>{point.specialStateCodes.map(code=><b key={code}>{code}</b>)}</div></article>)}</div>}
    <p className="boundary-note">纵轴表示规则证据的相对方向，不是收益率、事件概率或人生价值评分。某个流月无法稳定求值时，该年影线会留空。</p>
  </div>;
}

const topicLabels={career:"事业",family:"家庭",general:"总体",health:"身心",mobility:"迁动",personality:"表达",relationship:"关系",risk:"风险",study:"学习",wealth:"财务"} as const;
const directionLabels={support:"支持",pressure:"压力",mixed:"并存",neutral:"中性"} as const;
const effectLabels={complete_or_transform:"完成或转化",pressure:"形成压力",reveal:"显露",support:"支持",weaken_or_block:"削弱或阻断"} as const;
const evidenceLabels={"single-source":"单条来源","same-book-corroborated":"同书复证","cross-book-corroborated":"跨书复证","mixed-evidence":"方向混合"} as const;
const kinshipVisibilityLabels={visible:"显现",latent:"藏见",absent:"未见"} as const;
const kinshipLayerLabels={natal:"原局",luck:"大运",annual:"流年",month:"流月"} as const;
function AnnualTopicResult({result}:{result:ApiAnalysisResponse}){
  const annual=result.annual;const topics=annual.topics;const vectors=Object.entries(topics.contribution.atoms).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  return <div className="annual-topic-result">
    <div className="annual-heading"><div><span>{annual.targetYear} · 认证立春时刻</span><h3>{ganZhi(annual.luckPillar)}大运 × {ganZhi(annual.annualPillar)}流年</h3><p>以认证立春时刻确定所属大运，原局、大运和流年共六柱重新物化，随后完成关系裁决、六亲投影和规则条件求值。</p></div><div><strong>{topics.activated}</strong><span>激活规则家族</span><small>{topics.evaluated} 条进入条件求值</small></div></div>
    <div className="special-state-strip"><div><span>特殊状态证书</span><strong>七字同向检验：生助 {annual.specialStates.natalSevenSymbolConsensus.supportCount} / 克泄耗 {annual.specialStates.natalSevenSymbolConsensus.pressureCount}</strong></div><div>{annual.specialStates.signals.length===0?<small>当前年度没有触发已规范化的特殊状态。</small>:annual.specialStates.signals.map(signal=><span className="special-state" key={signal.code}>{signal.label}<small>{signal.scope==="natal"?"原局":signal.scope==="luck"?"大运":"年度"}</small></span>)}</div></div>
    <div className="topic-vector">{vectors.map(([domain,value])=><article key={domain}><div><strong>{topicLabels[domain as keyof typeof topicLabels]}</strong><span>{value>0?"支持贡献":value<0?"压力贡献":"净值中性"}</span></div><i><b className={value<0?"negative":""} style={{width:`${Math.min(100,Math.abs(value)*5)}%`}}></b></i><em>{value>0?"+":""}{decimal(value,2)}</em></article>)}</div>
    <div className="kinship-section"><div className="relation-heading"><span>六亲语义证据</span><strong>稳定正规形 × 十神映射 × 时间层权重</strong></div><div className="kinship-grid">{annual.kinship.roles.map(role=><article className={`kinship-card ${role.visibility}`} key={role.id}><header><span>{role.label}</span><b>{kinshipVisibilityLabels[role.visibility]}</b></header><strong>{decimal(role.weightedExposure,2)}</strong><small>加权显现 · 明 {role.visibleCount} / 藏 {role.hiddenCount}</small><div className="kinship-layers">{Object.entries(role.layerExposure).map(([layer,exposure])=><span key={layer}>{kinshipLayerLabels[layer as keyof typeof kinshipLayerLabels]} <b>{decimal(exposure.weightedExposure,2)}</b></span>)}</div><details><summary>查看 {role.observedCount} 条映射证据</summary><div className="kinship-evidence">{role.evidence.length===0?<small>当前六柱没有映射到该角色的十神。</small>:role.evidence.map((item,index)=><span key={`${item.pillarId}-${item.stem}-${index}`}><b className={`ten-god ${tenGodTone(item.tenGod)}`}>{item.tenGod}</b><i>{item.pillarId} · {item.source==="visible-stem"?"显干":`${item.hiddenRank}藏干`} · {decimal(item.weight,2)}</i></span>)}</div></details></article>)}</div></div>
    <div className="hypothesis-list"><div className="relation-heading"><span>来源级事件命题</span><strong>时间层 × 主题领域 × 规范效应算子</strong></div>{topics.eventHypotheses.length===0?<p className="empty-relations">该年度没有规则形成非空事件命题。</p>:topics.eventHypotheses.map(item=>{const sources=topics.activatedSources.filter(source=>source.eventEvidence.some(evidence=>evidence.domain===item.domain&&evidence.operator===item.operator));return <details className="event-predicate" key={item.predicateId}><summary><div><strong>{topicLabels[item.domain]} · {effectLabels[item.operator]}</strong><span>{directionLabels[item.direction]} · 净贡献 {item.contribution>0?"+":""}{decimal(item.contribution,2)}</span></div><small>{evidenceLabels[item.evidenceStatus]} · {item.sourceCount} 条 / {item.bookCount} 本</small></summary><div className="event-sources"><p>命题编号 {item.predicateId}。声明作用域：原局 {item.scopeEvidence.natalSources}、大运 {item.scopeEvidence.luckSources}、流年 {item.scopeEvidence.annualSources}、未限定 {item.scopeEvidence.unscopedSources}。多作用域规则会分别计入其声明层。</p>{sources.slice(0,8).map(source=><div key={source.recordId}><strong>{source.bookId}</strong><span>第 {source.lineStart}—{source.lineEnd} 行 · {source.scopes.length?source.scopes.join(" + "):"未限定"}</span><code>{source.familyId}</code></div>)}{sources.length>8&&<small>另有 {sources.length-8} 条来源，可在机器可读证书中核验。</small>}</div></details>})}</div>
    <p className="boundary-note">程序台账：{topics.program.total} 条来源，其中 executable {topics.program.executable}、deferred {topics.program.deferred}、contested {topics.program.contested}。未解析条件 {topics.unresolved} 条，不以零贡献代替。</p>
  </div>;
}

function CertificateResult({ result }: { result: ApiAnalysisResponse }) {
  const calendar = result.calendar;
  return <div className="certificate-result"><div className="certificate-grid"><article><span>地点来源</span><strong>{calendar.provenance.locationDataset}</strong><p>{calendar.coordinateProvenance.source} · {formatCoordinateUncertainty(calendar.coordinateProvenance.uncertaintyMeters)}</p></article><article><span>节气星历</span><strong>{calendar.provenance.ephemeris}</strong><p>摘要 {calendar.provenance.ephemerisDigest.slice(0, 16)}…</p></article><article><span>模型配置</span><strong>{result.modelConfiguration.customized?`${result.modelConfiguration.overrideCount} 项自定义权重`:"公开预设"}</strong><p>指纹 {result.modelConfiguration.overrideFingerprint}</p></article><article><span>正规形链</span><strong>原局 + {result.luckDynamics.length} 步大运</strong><p>全部稳定后才返回结果</p></article></div><details><summary>查看机器可读证书</summary><pre>{JSON.stringify(result.certificate, null, 2)}</pre></details><p className="boundary-note">证书记录历法、模型权重、五行测度、格局与调候投影、关系裁决及逐运重算链。当前结果不等同于现实事件概率。</p></div>;
}
