import { useState } from "react";

const tabs = ["命盘", "结构", "生命周期", "主题", "推断依据"] as const;
const pillars = [
  { label: "年柱", stem: "癸", branch: "酉", hidden: "辛", god: "正印" },
  { label: "月柱", stem: "乙", branch: "丑", hidden: "己 癸 辛", god: "劫财" },
  { label: "日柱", stem: "甲", branch: "辰", hidden: "戊 乙 癸", god: "日主" },
  { label: "时柱", stem: "丁", branch: "卯", hidden: "乙", god: "伤官" },
] as const;

const topics = [
  { name: "事业与权责", state: "mixed", label: "支持与压力并存", support: 62, pressure: 38 },
  { name: "学习与表达", state: "support", label: "结构支持", support: 74, pressure: 26 },
  { name: "关系与承诺", state: "contested", label: "证据有争议", support: 48, pressure: 52 },
] as const;

export function AnalysisWorkbench() {
  const [active, setActive] = useState<(typeof tabs)[number]>("命盘");
  const [advanced, setAdvanced] = useState(false);
  return (
    <div className="workbench">
      <aside className="input-panel">
        <div className="panel-heading"><div><span className="step-label">STEP 01</span><h2>出生信息</h2></div><span className="privacy-pill">仅本地填写</span></div>
        <label>出生日期<input type="date" defaultValue="1993-01-26" /></label>
        <div className="field-row"><label>出生时间<input type="time" defaultValue="05:30" /></label><label>时间精度<select defaultValue="minute"><option value="minute">精确到分钟</option><option>约一小时</option><option>时辰范围</option></select></label></div>
        <label>出生地点<div className="location-input"><span aria-hidden="true">⌖</span><input type="text" defaultValue="中国 · 上海市" aria-label="出生地点" /></div><small>城市代表点 · 31.23°N, 121.47°E · Asia/Shanghai</small></label>
        <div className="field-row"><label>性别<select defaultValue="unspecified"><option value="unspecified">不指定</option><option>女</option><option>男</option></select></label><label>模型预设<select><option>透明综合基准</option><option>月令格局优先</option><option>调候优先</option></select></label></div>
        <button className="advanced-toggle" type="button" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}><span>计算口径</span><i>{advanced ? "−" : "+"}</i></button>
        {advanced && <div className="advanced-fields"><label><input type="checkbox" defaultChecked /> 使用真太阳时</label><label>日界<select><option>子初换日（23:00）</option><option>午夜换日（00:00）</option></select></label><label>起运算法<select><option>节气时刻折算</option></select></label></div>}
        <button className="calculate-button" type="button" disabled><span>开始结构分析</span><small>正式计算内核接通后开放</small></button>
        <p className="privacy-copy">出生信息具有识别性。当前表单不发送、不保存，也不建立公开档案。</p>
      </aside>

      <section className="result-panel" aria-label="分析结果产品演示">
        <div className="demo-banner"><span>产品演示</span>右侧内容用于展示结果组织方式，不是对左侧输入的真实计算。</div>
        <div className="result-header">
          <div><span className="step-label">STEP 02 · EXAMPLE</span><h2>结构分析</h2><p>研究演示盘 · 透明综合基准 v0.1</p></div>
          <button type="button" className="outline-button">查看计算证书 <span>↗</span></button>
        </div>
        <div className="result-tabs" role="tablist" aria-label="分析层级">
          {tabs.map((tab) => <button role="tab" type="button" aria-selected={active === tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}
        </div>
        <div className="result-body">
          {active === "命盘" && <ChartPanel />}
          {active === "结构" && <StructurePanel />}
          {active === "生命周期" && <LifecyclePanel />}
          {active === "主题" && <TopicPanel />}
          {active === "推断依据" && <EvidencePanel />}
        </div>
      </section>
    </div>
  );
}

function ChartPanel() {
  return <>
    <div className="chart-summary"><div><span>日主</span><strong>甲木</strong><small>阳木 · 演示结构</small></div><div className="season-chip"><span>月令</span><strong>丑月</strong><small>冬末土令</small></div><div className="summary-note"><span>当前阅读顺序</span><p>先核对排盘口径，再进入强弱、格局与关系裁决。</p></div></div>
    <div className="pillars">{pillars.map((pillar, index) => <article className={index === 2 ? "day-pillar" : ""} key={pillar.label}><span>{pillar.label}</span><div className="stem">{pillar.stem}</div><div className="branch">{pillar.branch}</div><dl><div><dt>十神</dt><dd>{pillar.god}</dd></div><div><dt>藏干</dt><dd>{pillar.hidden}</dd></div></dl></article>)}</div>
    <div className="method-row"><div><span>原始钟表时间</span><strong>1993-01-26 05:30</strong></div><b>→</b><div><span>历史时区</span><strong>UTC+08:00</strong></div><b>→</b><div><span>地方视太阳时</span><strong>等待内核计算</strong></div></div>
  </>;
}

function StructurePanel() {
  const measures = [{n:"木",v:72,c:"wood"},{n:"火",v:31,c:"fire"},{n:"土",v:61,c:"earth"},{n:"金",v:43,c:"metal"},{n:"水",v:56,c:"water"}];
  return <div className="structure-grid"><article className="insight-card wide"><div className="card-title"><div><span>五行测度</span><h3>分量与季节修正</h3></div><em>模型内部量</em></div><div className="measure-bars">{measures.map(x=><div key={x.n}><span>{x.n}</span><i><b className={x.c} style={{width:`${x.v}%`}}></b></i><strong>{x.v}</strong></div>)}</div></article><article className="insight-card"><span>日主强弱</span><h3>中和偏弱</h3><p>支持质量与压力质量接近阈值，结论对月令权重敏感。</p><footer><b className="state contested">有模型分歧</b><button>查看证据</button></footer></article><article className="insight-card"><span>格局候选</span><h3>月令结构待裁决</h3><p>候选关系存在，但显现、通根和竞争关系尚需完整求值。</p><footer><b className="state candidate">候选</b><button>查看条件</button></footer></article><article className="insight-card wide relation-card"><div><span>关系正规形</span><h3>候选关系必须经过竞争与阻断</h3></div><div className="relation-flow"><b>原始候选 <small>7</small></b><i>→</i><b>关系裁决 <small>5</small></b><i>→</i><b>稳定正规形 <small>待验证</small></b></div></article></div>;
}

function LifecyclePanel() {
  return <div className="lifecycle"><div className="timeline-header"><div><span>动态生命周期</span><h3>原局 → 大运 → 流年，每阶段完整重算</h3></div><span className="state candidate">交互样例</span></div><div className="timeline"><article className="selected"><span>原局</span><strong>基准状态</strong><small>结构初始化</small></article>{["甲寅","乙卯","丙辰","丁巳","戊午"].map((x,i)=><article key={x}><span>{2001+i*10}—{2010+i*10}</span><strong>{x}大运</strong><small>{8+i*10}—{17+i*10} 岁</small></article>)}</div><div className="path-explanation"><div><span>G<sub>N</sub></span><p>原局建立初始结构与候选规则。</p></div><i>→</i><div><span>G<sub>N,D</sub></span><p>大运改变关系、参数与可用算子。</p></div><i>→</i><div><span>G<sub>N,D,Y</sub></span><p>流年在当前大运状态中加入扰动。</p></div></div></div>;
}

function TopicPanel() {
  return <div className="topic-layout"><div className="topic-list">{topics.map(topic=><article key={topic.name}><div><span>{topic.name}</span><b className={`state ${topic.state}`}>{topic.label}</b></div><div className="contribution"><i className="pressure" style={{width:`${topic.pressure}%`}}></i><i className="support" style={{width:`${topic.support}%`}}></i></div><footer><span>压力 {topic.pressure}</span><span>支持 {topic.support}</span></footer></article>)}</div><aside className="topic-boundary"><span>如何阅读</span><h3>贡献不是概率</h3><p>这里表达规则家族在当前模型中的支持、压力与未决作用。它不表示事件发生概率。</p><button>为什么这样判断？</button></aside></div>;
}

function EvidencePanel() {
  return <div className="evidence-stack"><div className="evidence-summary"><span>主题命题</span><h3>事业权责：mixed / contested</h3><p>以下是理想解释链的界面结构；正式内容将在规则编译和来源审计完成后生成。</p></div>{["稳定正规形","规范主题特征","规则家族求值","贡献证书"].map((item,i)=><article key={item}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{item}</strong><p>{["只消费已裁决关系与阶段状态。","不读取 raw edge 或 unresolved candidate。","记录已满足、未满足与冲突条件。","绑定模型版本、规则版本与古籍来源。 "][i]}</p></div><b>{i<2?"结构就绪":"待接入"}</b></article>)}</div>;
}
