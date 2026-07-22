import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  ANALYSIS_REQUEST_SCHEMA,
  type ApiAnalysisResponse,
  type ApiErrorResponse,
  type ApiLocation,
  type ApiLocationSearchResponse,
  type ApiModelId,
  type ApiSex,
} from "@senfate/contracts";

const API_BASE = import.meta.env.PUBLIC_API_BASE ?? "https://fyapeng.com/senfate/api/v1";
const tabs = ["命盘", "结构", "格局与调候", "大运", "年度主题", "计算证书"] as const;
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
  "outside-ephemeris-range": "当前认证节气表支持 1900—2035 年。",
};

function ganZhi(value: { stem: string; branch: string }): string { return `${value.stem}${value.branch}`; }
function decimal(value: number, digits = 2): string { return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(value); }
function localDate(utcMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utcMs));
}
function utcDateTime(utcMs: number): string { return new Date(utcMs).toISOString().replace("T", " ").slice(0, 16) + " UTC"; }
function localWallClock(wallTimeMs: number): string { return new Date(wallTimeMs).toISOString().replace("T", " ").slice(0, 16); }

export function AnalysisWorkbench() {
  const [active, setActive] = useState<(typeof tabs)[number]>("命盘");
  const [advanced, setAdvanced] = useState(false);
  const [date, setDate] = useState("1993-01-26");
  const [time, setTime] = useState("05:30");
  const [targetYear,setTargetYear]=useState(2026);
  const [sex, setSex] = useState<ApiSex>("female");
  const [modelId, setModelId] = useState<ApiModelId>("transparent-baseline");
  const [clockUncertaintySeconds, setClockUncertaintySeconds] = useState(60);
  const [disambiguation, setDisambiguation] = useState<"earlier" | "later" | "reject">("reject");
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<readonly ApiLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ApiLocation>();
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiAnalysisResponse>();
  const [message, setMessage] = useState("");

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

  const canSubmit = Boolean(selectedLocation && date && time && !submitting);
  const inputSummary = useMemo(() => selectedLocation ? `${selectedLocation.displayName} · ${selectedLocation.timeZone}` : "尚未选择规范地点", [selectedLocation]);

  async function calculate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLocation) { setMessage("请从搜索结果中选择出生地点。 "); return; }
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
          sex, modelId, disambiguation, clockUncertaintySeconds, periodCount: 12,
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

  return (
    <div className="workbench live-workbench">
      <aside className="input-panel">
        <div className="panel-heading"><div><span className="step-label">STEP 01</span><h2>出生信息</h2></div><span className="privacy-pill">不保存</span></div>
        <form onSubmit={calculate}>
          <label>出生日期<input type="date" min="1900-01-01" max="2035-12-31" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <div className="field-row">
            <label>出生时间<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
            <label>性别<select value={sex} onChange={(event) => setSex(event.target.value as ApiSex)}><option value="female">女</option><option value="male">男</option></select></label>
          </div>
          <label className="location-field">出生地点
            <div className="location-input"><span aria-hidden="true">⌖</span><input type="search" value={query} placeholder="搜索城市、县区或国家" autoComplete="off" onChange={(event) => { setQuery(event.target.value); setSelectedLocation(undefined); }} aria-expanded={locations.length > 0} /></div>
            {searching && <small>正在查询规范地点…</small>}
            {locations.length > 0 && !selectedLocation && <div className="location-results" role="listbox" aria-label="地点搜索结果">{locations.map((location) => <button type="button" role="option" key={location.id} onClick={() => { setSelectedLocation(location); setQuery(location.displayName); setLocations([]); setMessage(""); }}><strong>{location.displayName}</strong><span>{location.countryCode} · {location.timeZone}</span></button>)}</div>}
            {!searching && <small>{inputSummary}</small>}
          </label>
          <label>模型预设<select value={modelId} onChange={(event) => setModelId(event.target.value as ApiModelId)}>{Object.entries(modelLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
          <label>分析流年<input type="number" min={Math.max(1900,Number(date.slice(0,4))||1900)} max="2035" value={targetYear} onChange={(event)=>setTargetYear(Number(event.target.value))} required/><small>按该年立春后的流年干支，自动匹配所属大运。</small></label>
          <button className="advanced-toggle" type="button" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}><span>时间精度与歧义处理</span><i>{advanced ? "−" : "+"}</i></button>
          {advanced && <div className="advanced-fields">
            <label>钟表时间精度<select value={clockUncertaintySeconds} onChange={(event) => setClockUncertaintySeconds(Number(event.target.value))}><option value={1}>精确到秒</option><option value={60}>精确到分钟</option><option value={1800}>约半小时</option><option value={3600}>约一小时</option></select></label>
            <label>重复当地时刻<select value={disambiguation} onChange={(event) => setDisambiguation(event.target.value as typeof disambiguation)}><option value="reject">停止并提示</option><option value="earlier">采用较早时刻</option><option value="later">采用较晚时刻</option></select></label>
          </div>}
          <button className="calculate-button" type="submit" disabled={!canSubmit}><span>{submitting ? "正在计算…" : "生成结构分析"}</span><small>历法 · 格局候选 · 调候 · 逐运正规形</small></button>
          {message && <p className="form-message" role="alert">{message}</p>}
        </form>
        <p className="privacy-copy">出生信息会发送至计算接口并立即求值；当前服务不写入用户数据库，也不建立个人档案。</p>
      </aside>

      <section className="result-panel" aria-label="排盘计算结果">
        {!result ? <EmptyResult /> : <>
          <div className="result-header"><div><span className="step-label">STEP 02 · CERTIFIED</span><h2>{result.calendar.location.displayName}结构分析</h2><p>{result.calendar.model.label} v{result.calendar.model.version} · {result.calendar.time.timeZone}</p></div><span className="verified-pill">正规形稳定</span></div>
          <div className="result-tabs" role="tablist" aria-label="结果层级">{tabs.map((tab) => <button role="tab" type="button" aria-selected={active === tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}</div>
          <div className="result-body">
            {active === "命盘" && <ChartResult result={result} date={date} time={time} />}
            {active === "结构" && <StructureResult result={result} />}
            {active === "格局与调候" && <InterpretationResult result={result} />}
            {active === "大运" && <LuckResult result={result} />}
            {active === "年度主题" && <AnnualTopicResult result={result} />}
            {active === "计算证书" && <CertificateResult result={result} />}
          </div>
        </>}
      </section>
    </div>
  );
}

function EmptyResult() {
  return <div className="empty-result"><span>CALCULATION READY</span><h2>从一个可核验的排盘开始</h2><p>选择出生时间和规范地点后，系统会依次完成历史时区、节气月界、四柱、五行测度和关系裁决。任何跨越边界或正规形失败的输入都会停止求值。</p><div className="empty-flow"><b>出生时空</b><i>→</i><b>四柱十神</b><i>→</i><b>五行测度</b><i>→</i><b>稳定正规形</b></div></div>;
}

function ChartResult({ result, date, time }: { result: ApiAnalysisResponse; date: string; time: string }) {
  const calendar = result.calendar;
  const pillars = [["年柱", calendar.pillars.year, result.structure.pillars.year], ["月柱", calendar.pillars.month, result.structure.pillars.month], ["日柱", calendar.pillars.day, result.structure.pillars.day], ["时柱", calendar.pillars.hour, result.structure.pillars.hour]] as const;
  return <>
    <div className="chart-summary"><div><span>日主</span><strong>{result.structure.dayMaster.stem}{result.structure.dayMaster.element}</strong><small>{result.structure.dayMaster.polarity}{result.structure.dayMaster.element}</small></div><div className="season-chip"><span>节气月序</span><strong>第 {calendar.solarTerms.monthOrdinal + 1} 月</strong><small>{calendar.solarTerms.previous.name}之后</small></div><div className="summary-note"><span>输入可信区间</span><p>时间与地点合并不确定度约 ±{decimal(calendar.time.uncertaintySeconds, 0)} 秒。</p></div></div>
    <div className="pillars">{pillars.map(([label, pillar, detail], index) => <article className={index === 2 ? "day-pillar" : ""} key={label}><span>{label}</span><div className="stem">{pillar.stem}</div><div className="branch">{pillar.branch}</div><dl><div><dt>十神</dt><dd>{index === 2 ? "日主" : detail.tenGod}</dd></div><div><dt>藏干</dt><dd>{detail.hiddenStems.map((item) => item.stem).join(" ")}</dd></div></dl></article>)}</div>
    <div className="method-row"><div><span>原始当地时间</span><strong>{date} {time}</strong></div><b>→</b><div><span>历史时区</span><strong>UTC{calendar.time.utcOffsetMinutes >= 0 ? "+" : ""}{decimal(calendar.time.utcOffsetMinutes / 60)}</strong></div><b>→</b><div><span>地方视太阳时</span><strong>{localWallClock(calendar.time.apparentSolarWallTimeMs)}</strong><small>修正 {calendar.time.apparentSolarCorrectionMinutes >= 0 ? "+" : ""}{decimal(calendar.time.apparentSolarCorrectionMinutes)} 分钟</small></div></div>
    <div className="term-window"><div><span>前一节</span><strong>{calendar.solarTerms.previous.name}</strong><small>{utcDateTime(calendar.solarTerms.previous.utcMs)}</small></div><i>出生时刻位于认证节气窗口内</i><div><span>后一节</span><strong>{calendar.solarTerms.next.name}</strong><small>{utcDateTime(calendar.solarTerms.next.utcMs)}</small></div></div>
  </>;
}

const elementClass = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" } as const;
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
      <article className="insight-card"><span>关系正规形</span><h3>{structure.relations.length} 条关系进入裁决</h3><p>经过加权竞争后得到稳定状态；候选关系不会直接传给后续主题层。</p><footer><b className="state effective">稳定</b><span>{structure.normalForm.iterations} 次迭代</span></footer></article>
    </div>
    <div className="decomposition-grid">{Object.entries(structure.strength.decomposition).map(([key, value]) => <article key={key}><span>{{ sameElement: "同类", resource: "生扶", root: "通根", output: "泄秀", wealth: "财星", officer: "官杀" }[key as keyof typeof structure.strength.decomposition]}</span><strong>{decimal(value)}</strong></article>)}</div>
    <div className="relation-list"><div className="relation-heading"><span>原局关系裁决</span><strong>正规形指纹 {structure.normalForm.fingerprint.slice(0, 18)}…</strong></div>{structure.relations.length === 0 ? <p className="empty-relations">当前原局没有形成需要裁决的干支关系，空关系集仍通过稳定性检查。</p> : structure.relations.map((relation) => <article key={relation.id}><div><strong>{relationLabels[relation.kind] ?? relation.kind}</strong><span>{relation.members.join(" · ")}{relation.targetElement ? ` → ${relation.targetElement}` : ""}</span></div><div><b className={`state ${relation.status}`}>{statusLabels[relation.status] ?? relation.status}</b><small>得分 {decimal(relation.score.total)}</small></div></article>)}</div>
  </div>;
}

const patternStatusLabels = { qualified: "成立候选", contested: "并列待裁", candidate: "候选", unqualified: "未达阈值" } as const;
const climateLabels = { cold: "偏寒", hot: "偏热", dry: "偏燥", humid: "偏湿", balanced: "中和" } as const;
const balancingLabels = { supportive: "增益候选", neutral: "中性", avoid: "减益候选" } as const;

function InterpretationResult({ result }: { result: ApiAnalysisResponse }) {
  const projection = result.interpretation;
  return <div className="interpretation-result">
    <div className="interpretation-grid">
      <article className="insight-card"><span>月令格局投影</span><h3>{patternStatusLabels[projection.pattern.status]}</h3><p>候选来自月支藏干，并计入透干、通根与模型阈值。它是可审计的结构候选，不替代流派专属格局裁决。</p></article>
      <article className="insight-card"><span>调候坐标</span><h3>{climateLabels[projection.climate.temperatureState]} · {climateLabels[projection.climate.humidityState]}</h3><p>温度 {decimal(projection.climate.temperature, 3)}，湿度 {decimal(projection.climate.humidity, 3)}。坐标由月令基线与五行测度共同生成。</p></article>
    </div>
    <div className="pattern-list"><div className="relation-heading"><span>格局候选排序</span><strong>{projection.pattern.schema}</strong></div>{projection.pattern.candidates.map((candidate) => <article key={`${candidate.stem}-${candidate.rank}`}><div><strong>{candidate.tenGod}</strong><span>{candidate.stem} · {candidate.rank === "main" ? "本气" : candidate.rank === "middle" ? "中气" : "余气"}{candidate.exposed ? " · 透干" : ""}</span></div><div><b className={`state ${candidate.status}`}>{patternStatusLabels[candidate.status]}</b><small>得分 {decimal(candidate.score, 3)}</small></div></article>)}</div>
    <div className="balancing-vector"><div className="relation-heading"><span>五行平衡贡献向量</span><strong>强弱项 + 调候项 × 正规形置信度</strong></div>{projection.balancing.candidates.map((candidate) => <article key={candidate.element}><strong className={elementClass[candidate.element]}>{candidate.element}</strong><div><i><b style={{ width: `${Math.min(100, Math.abs(candidate.score) * 70 + 3)}%` }}></b></i><small>强弱 {decimal(candidate.strengthContribution, 3)} · 调候 {decimal(candidate.climateContribution, 3)}</small></div><span>{balancingLabels[candidate.status]} {candidate.score >= 0 ? "+" : ""}{decimal(candidate.score, 3)}</span></article>)}</div>
    <p className="boundary-note">这里展示的是参数化候选向量，便于比较模型和继续接入书证规则；尚未将它命名为最终“用神”，也不直接推出具体事件。</p>
  </div>;
}

function LuckResult({ result }: { result: ApiAnalysisResponse }) {
  const calendar = result.calendar;
  return <div className="luck-result"><div className="luck-lead"><div><span>行运方向</span><strong>{calendar.direction === "forward" ? "顺排" : "逆排"}</strong></div><div><span>起运年龄</span><strong>{decimal(calendar.luckStartAgeYears, 3)} 岁</strong><small>区间 {decimal(calendar.luckStartAgeInterval.lower, 3)}—{decimal(calendar.luckStartAgeInterval.upper, 3)}</small></div><p>每一步均累计原局与当步大运，重新计算五行测度、强弱、关系正规形和候选向量。</p></div><div className="luck-grid">{result.luckDynamics.map((period) => { const calendarPeriod = calendar.majorLuck.find((item) => item.ordinal === period.ordinal)!; const supportive = period.interpretation.balancing.candidates.filter((item) => item.status === "supportive").slice(0, 2).map((item) => item.element).join("、") || "无显著项"; return <article key={period.ordinal}><span>第 {period.ordinal} 运 · {strengthLabels[period.strength.state]}</span><strong>{ganZhi(period.pillar)}</strong><p>{decimal(period.startAgeInterval.lower, 2)}—{decimal(period.startAgeInterval.upper, 2)} 岁起</p><small>{localDate(calendarPeriod.startUtcMs, calendar.time.timeZone)} · 增益候选 {supportive}</small><em>支持比 {decimal(period.strength.supportRatio * 100, 1)}% · {period.relations.length} 条关系</em></article>; })}</div></div>;
}

const topicLabels={career:"事业",family:"家庭",general:"总体",health:"身心",mobility:"迁动",personality:"表达",relationship:"关系",risk:"风险",study:"学习",wealth:"财务"} as const;
const directionLabels={support:"支持",pressure:"压力",mixed:"并存"} as const;
function AnnualTopicResult({result}:{result:ApiAnalysisResponse}){
  const annual=result.annual;const topics=annual.topics;const vectors=Object.entries(topics.contribution.atoms).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  return <div className="annual-topic-result">
    <div className="annual-heading"><div><span>{annual.targetYear} · 认证立春时刻</span><h3>{ganZhi(annual.luckPillar)}大运 × {ganZhi(annual.annualPillar)}流年</h3><p>以认证立春时刻确定所属大运，原局、大运和流年共六柱重新物化，随后完成关系裁决、六亲投影和规则条件求值。</p></div><div><strong>{topics.activated}</strong><span>激活规则家族</span><small>{topics.evaluated} 条进入条件求值</small></div></div>
    <div className="topic-vector">{vectors.map(([domain,value])=><article key={domain}><div><strong>{topicLabels[domain as keyof typeof topicLabels]}</strong><span>{value>0?"支持贡献":value<0?"压力贡献":"净值中性"}</span></div><i><b className={value<0?"negative":""} style={{width:`${Math.min(100,Math.abs(value)*5)}%`}}></b></i><em>{value>0?"+":""}{decimal(value,2)}</em></article>)}</div>
    <div className="kinship-grid">{annual.kinship.roles.map(role=><article key={role.id}><span>{role.label}</span><strong>{role.observedCount}</strong><small>{role.primaryTenGods.join(" · ")}</small></article>)}</div>
    <div className="hypothesis-list"><div className="relation-heading"><span>可审计主题假设</span><strong>传统模型假设，不是现实概率</strong></div>{topics.eventHypotheses.length===0?<p className="empty-relations">该年度没有规则形成非空主题假设。</p>:topics.eventHypotheses.map(item=><article key={item.domain}><div><strong>{topicLabels[item.domain]}</strong><span>{directionLabels[item.direction]} · 强度 {decimal(item.magnitude,2)}</span></div><small>{item.sourceCount} 条来源记录</small></article>)}</div>
    <p className="boundary-note">程序台账：{topics.program.total} 条来源，其中 executable {topics.program.executable}、deferred {topics.program.deferred}、contested {topics.program.contested}。未解析条件 {topics.unresolved} 条，不以零贡献代替。</p>
  </div>;
}

function CertificateResult({ result }: { result: ApiAnalysisResponse }) {
  const calendar = result.calendar;
  return <div className="certificate-result"><div className="certificate-grid"><article><span>地点来源</span><strong>{calendar.provenance.locationDataset}</strong><p>{calendar.coordinateProvenance.source} · ±{decimal(calendar.coordinateProvenance.uncertaintyMeters / 1000, 0)} km</p></article><article><span>节气星历</span><strong>{calendar.provenance.ephemeris}</strong><p>摘要 {calendar.provenance.ephemerisDigest.slice(0, 16)}…</p></article><article><span>正规形链</span><strong>原局 + {result.luckDynamics.length} 步大运</strong><p>全部稳定后才返回结果</p></article></div><details><summary>查看机器可读证书</summary><pre>{JSON.stringify(result.certificate, null, 2)}</pre></details><p className="boundary-note">证书记录历法、模型、五行测度、格局与调候投影、关系裁决及逐运重算链。当前结果不等同于现实事件概率。</p></div>;
}
