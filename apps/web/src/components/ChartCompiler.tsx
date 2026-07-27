import { useState } from "react";
import chinaAreas from "../data/china-counties.json";

type Location = { code: string; label: string; longitude: number; latitude: number; timeZone: string };
const locations = chinaAreas.counties as Location[];
const defaultLocation = locations.find(item => item.code === "310101") || locations[0];

export default function ChartCompiler() {
  const [compiled, setCompiled] = useState<any>();
  const [analysis, setAnalysis] = useState<any>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [cityCode, setCityCode] = useState(defaultLocation.code);
  const [cityQuery, setCityQuery] = useState(defaultLocation.label);
  const isPages = typeof window !== "undefined" && (window.location.hostname === "fyapeng.com" || window.location.hostname.endsWith(".github.io"));

  async function compile(form: HTMLFormElement) {
    const data = new FormData(form);
    const [date, time] = String(data.get("birth")).split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const city = locations.find(item => item.code === cityCode) || defaultLocation;
    const useManualLocation = data.get("manualLocation") === "on";
    const response = await fetch("/api/chart/compile", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({year,month,day,hour,minute,timeZone:useManualLocation ? data.get("timeZone") : city.timeZone,longitudeDegrees:useManualLocation ? Number(data.get("longitude")) : city.longitude,latitudeDegrees:useManualLocation ? Number(data.get("latitude")) : city.latitude,sex:data.get("sex")}) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    const enriched = { ...result, city: city.label };
    setCompiled(enriched); setError("");
    sessionStorage.setItem("senfate.chart", JSON.stringify(result.result));
    sessionStorage.setItem("senfate.compile", JSON.stringify(enriched));
  }

  async function run() {
    setRunning(true); setError("");
    try {
      const targetYear = new Date().getFullYear();
      const response = await fetch("/api/analysis/run", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({compiledChart:compiled.result,sex:"female",targetYear,school:"all"}) });
      const result = await response.json();
      if (!response.ok || result.error) { setError(result.error || "四派分析未能完成。"); return; }
      setAnalysis(result);
      sessionStorage.setItem("senfate.analysis", JSON.stringify(result));
      const saved = await fetch("/api/session", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({compiled,analysis:result}) }).then(item=>item.json());
      if (saved.id) window.location.assign(`/?session=${saved.id}`);
    } catch { setError("本地规则计算服务暂时不可用，请稍后重试。"); }
    finally { setRunning(false); }
  }

  const calendar = compiled?.result?.calendar;
  const city = locations.find(item => item.code === cityCode) || defaultLocation;
  function chooseLocation(value: string) {
    setCityQuery(value);
    const chosen = locations.find(item => item.label === value || item.code === value);
    if (chosen) { setCityCode(chosen.code); setError(""); }
  }
  if (isPages) return <section className="certificate"><p className="eyebrow">在线展示版</p><h2>排盘计算服务正在接入</h2><p className="muted">本页面已发布至网站；完整排盘和四派分析需要运行规则引擎。公开规则、命盘结构说明和产品界面可直接浏览。</p></section>;
  return <><form className="form-stack city-first-form" onSubmit={event=>{event.preventDefault(); if (!locations.some(item => item.code === cityCode && item.label === cityQuery)) { setError("请从全国区县候选中选择出生地。"); return; } void compile(event.currentTarget)}}><label>出生地（全国区县）<input name="city" list="china-counties" value={cityQuery} onChange={event => chooseLocation(event.target.value)} placeholder="输入省、市、区县名称搜索" autoComplete="off" required/><datalist id="china-counties">{locations.map(item => <option value={item.label} key={item.code} />)}</datalist><small>内置 {locations.length.toLocaleString()} 个县级行政区及参考坐标；将自动带入中国标准时区与当地中心点。</small></label><label>出生日期与时间<input name="birth" type="datetime-local" defaultValue="1990-06-15T10:30" required/></label><label>传统顺逆行参数<select name="sex" defaultValue="female"><option value="female">女</option><option value="male">男</option></select></label><details className="manual-location" key={city.code}><summary>高级地点校正</summary><label><input name="manualLocation" type="checkbox"/> 使用精确地点坐标</label><label>时区<input name="timeZone" defaultValue={city.timeZone} required/></label><label>经度<input name="longitude" type="number" step="0.0001" defaultValue={city.longitude} required/></label><label>纬度<input name="latitude" type="number" step="0.0001" defaultValue={city.latitude} required/></label></details><button className="button">生成计算证书</button></form>{error&&<p>{error}</p>}{compiled&&<section className="certificate"><p className="eyebrow">认证排盘结果 / {compiled.city}</p><div className="pillars">{["year","month","day","hour"].map(key=><div key={key}><small>{key}</small><strong>{calendar.pillars[key].stem}{calendar.pillars[key].branch}</strong></div>)}</div><p className="muted">{calendar.direction==="forward"?"顺行":"逆行"}；约 {calendar.luckStartAgeYears.toFixed(2)} 岁起运。</p><details><summary>查看完整计算证书</summary><p>真太阳时修正：{calendar.normalizedTime.apparentSolarCorrectionMinutes.toFixed(3)} 分钟；均时差：{calendar.normalizedTime.equationOfTimeMinutes.toFixed(3)} 分钟。</p><p>证书：{compiled.certificate.tzdbVersion} · {compiled.certificate.ephemerisDigest}</p><ol>{calendar.majorLuck.map((item:any)=><li key={item.ordinal}>第 {item.ordinal} 步 {item.pillar.stem}{item.pillar.branch} · {item.startAgeYears.toFixed(2)} 岁起</li>)}</ol></details><button className="button" disabled={running} onClick={()=>void run()}>{running ? "正在生成八步大运与流年图…" : "运行四派分析"}</button>{running&&<p className="muted">首次会在本机一次性展开 8 步大运、80 个流年；进入总览后的年份、范围和流派切换不再调用计算。</p>}{analysis?.schools?.map((item:any)=><p key={item.school}><strong>{item.school}</strong>：{item.verdict.headline}</p>)}</section>}</>;
}
