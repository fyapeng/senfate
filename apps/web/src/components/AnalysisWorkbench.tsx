import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  CALENDAR_REQUEST_SCHEMA,
  type ApiCalendarResponse,
  type ApiErrorResponse,
  type ApiLocation,
  type ApiLocationSearchResponse,
  type ApiModelId,
  type ApiSex,
} from "@senfate/contracts";

const API_BASE = import.meta.env.PUBLIC_API_BASE ?? "https://fyapeng.com/senfate/api/v1";
const tabs = ["命盘", "大运", "计算证书"] as const;
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
  const [sex, setSex] = useState<ApiSex>("female");
  const [modelId, setModelId] = useState<ApiModelId>("transparent-baseline");
  const [clockUncertaintySeconds, setClockUncertaintySeconds] = useState(60);
  const [disambiguation, setDisambiguation] = useState<"earlier" | "later" | "reject">("reject");
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<readonly ApiLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ApiLocation>();
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiCalendarResponse>();
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
      const response = await fetch(`${API_BASE}/calendar/calculate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: CALENDAR_REQUEST_SCHEMA,
          locationId: selectedLocation.id,
          localDateTime: { year, month, day, hour, minute },
          sex, modelId, disambiguation, clockUncertaintySeconds, periodCount: 8,
        }),
      });
      const body = await response.json() as ApiCalendarResponse | ApiErrorResponse;
      if (!response.ok || !("pillars" in body)) {
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
          <button className="advanced-toggle" type="button" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}><span>时间精度与歧义处理</span><i>{advanced ? "−" : "+"}</i></button>
          {advanced && <div className="advanced-fields">
            <label>钟表时间精度<select value={clockUncertaintySeconds} onChange={(event) => setClockUncertaintySeconds(Number(event.target.value))}><option value={1}>精确到秒</option><option value={60}>精确到分钟</option><option value={1800}>约半小时</option><option value={3600}>约一小时</option></select></label>
            <label>重复当地时刻<select value={disambiguation} onChange={(event) => setDisambiguation(event.target.value as typeof disambiguation)}><option value="reject">停止并提示</option><option value="earlier">采用较早时刻</option><option value="later">采用较晚时刻</option></select></label>
          </div>}
          <button className="calculate-button" type="submit" disabled={!canSubmit}><span>{submitting ? "正在计算…" : "生成认证排盘"}</span><small>历史时区 · 真太阳时 · 节气 · 大运</small></button>
          {message && <p className="form-message" role="alert">{message}</p>}
        </form>
        <p className="privacy-copy">出生信息会发送至计算接口并立即求值；当前服务不写入用户数据库，也不建立个人档案。</p>
      </aside>

      <section className="result-panel" aria-label="排盘计算结果">
        {!result ? <EmptyResult /> : <>
          <div className="result-header"><div><span className="step-label">STEP 02 · CERTIFIED</span><h2>{result.location.displayName}排盘</h2><p>{result.model.label} v{result.model.version} · {result.time.timeZone}</p></div><span className="verified-pill">计算完成</span></div>
          <div className="result-tabs" role="tablist" aria-label="结果层级">{tabs.map((tab) => <button role="tab" type="button" aria-selected={active === tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}</div>
          <div className="result-body">
            {active === "命盘" && <ChartResult result={result} date={date} time={time} />}
            {active === "大运" && <LuckResult result={result} />}
            {active === "计算证书" && <CertificateResult result={result} />}
          </div>
        </>}
      </section>
    </div>
  );
}

function EmptyResult() {
  return <div className="empty-result"><span>CALCULATION READY</span><h2>从一个可核验的排盘开始</h2><p>选择出生时间和规范地点后，系统会先解析历史时区，再计算地方视太阳时、节气月界、四柱和大运。任何跨越边界的不确定输入都会停止求值。</p><div className="empty-flow"><b>当地时间</b><i>→</i><b>历史时区</b><i>→</i><b>节气窗口</b><i>→</i><b>四柱与大运</b></div></div>;
}

function ChartResult({ result, date, time }: { result: ApiCalendarResponse; date: string; time: string }) {
  const pillars = [["年柱", result.pillars.year], ["月柱", result.pillars.month], ["日柱", result.pillars.day], ["时柱", result.pillars.hour]] as const;
  return <>
    <div className="chart-summary"><div><span>排盘年份</span><strong>{result.solarTerms.baziYear}</strong><small>以立春为年界</small></div><div className="season-chip"><span>节气月序</span><strong>第 {result.solarTerms.monthOrdinal + 1} 月</strong><small>{result.solarTerms.previous.name}之后</small></div><div className="summary-note"><span>输入可信区间</span><p>时间与地点合并不确定度约 ±{decimal(result.time.uncertaintySeconds, 0)} 秒。</p></div></div>
    <div className="pillars">{pillars.map(([label, pillar], index) => <article className={index === 2 ? "day-pillar" : ""} key={label}><span>{label}</span><div className="stem">{pillar.stem}</div><div className="branch">{pillar.branch}</div><dl><div><dt>干支</dt><dd>{ganZhi(pillar)}</dd></div><div><dt>序号</dt><dd>{pillar.index + 1} / 60</dd></div></dl></article>)}</div>
    <div className="method-row"><div><span>原始当地时间</span><strong>{date} {time}</strong></div><b>→</b><div><span>历史时区</span><strong>UTC{result.time.utcOffsetMinutes >= 0 ? "+" : ""}{decimal(result.time.utcOffsetMinutes / 60)}</strong></div><b>→</b><div><span>地方视太阳时</span><strong>{localWallClock(result.time.apparentSolarWallTimeMs)}</strong><small>修正 {result.time.apparentSolarCorrectionMinutes >= 0 ? "+" : ""}{decimal(result.time.apparentSolarCorrectionMinutes)} 分钟</small></div></div>
    <div className="term-window"><div><span>前一节</span><strong>{result.solarTerms.previous.name}</strong><small>{utcDateTime(result.solarTerms.previous.utcMs)}</small></div><i>出生时刻位于认证节气窗口内</i><div><span>后一节</span><strong>{result.solarTerms.next.name}</strong><small>{utcDateTime(result.solarTerms.next.utcMs)}</small></div></div>
  </>;
}

function LuckResult({ result }: { result: ApiCalendarResponse }) {
  return <div className="luck-result"><div className="luck-lead"><div><span>行运方向</span><strong>{result.direction === "forward" ? "顺排" : "逆排"}</strong></div><div><span>起运年龄</span><strong>{decimal(result.luckStartAgeYears, 3)} 岁</strong><small>区间 {decimal(result.luckStartAgeInterval.lower, 3)}—{decimal(result.luckStartAgeInterval.upper, 3)}</small></div><p>按“节气间隔三日折一年”计算；每一步同时保留起始年龄和公历日期的不确定区间。</p></div><div className="luck-grid">{result.majorLuck.map((period) => <article key={period.ordinal}><span>第 {period.ordinal} 运</span><strong>{ganZhi(period.pillar)}</strong><p>{decimal(period.startAgeInterval.lower, 2)}—{decimal(period.startAgeInterval.upper, 2)} 岁起</p><small>{localDate(period.startUtcMs, result.time.timeZone)}</small></article>)}</div></div>;
}

function CertificateResult({ result }: { result: ApiCalendarResponse }) {
  return <div className="certificate-result"><div className="certificate-grid"><article><span>地点来源</span><strong>{result.provenance.locationDataset}</strong><p>{result.coordinateProvenance.source} · ±{decimal(result.coordinateProvenance.uncertaintyMeters / 1000, 0)} km</p></article><article><span>节气星历</span><strong>{result.provenance.ephemeris}</strong><p>摘要 {result.provenance.ephemerisDigest.slice(0, 16)}…</p></article><article><span>时区运行时</span><strong>{result.provenance.tzdb}</strong><p>UTC 偏移 {result.time.utcOffsetMinutes} 分钟</p></article></div><details><summary>查看机器可读证书</summary><pre>{JSON.stringify(result.certificate, null, 2)}</pre></details><p className="boundary-note">这份证书证明“如何算出排盘”，不等同于现实事件预测。结构、主题和事件层将在规则审计完成后沿同一证书链接入。</p></div>;
}
