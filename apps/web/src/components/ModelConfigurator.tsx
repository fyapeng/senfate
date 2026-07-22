import { useMemo, useState } from "react";

const presets = [
  { id:"baseline", name:"透明综合基准", desc:"均衡展示月令、格局、调候与关系裁决", values:[68,52,76,64] },
  { id:"month", name:"月令格局优先", desc:"提高月令、透干与格局完整度的作用", values:[86,42,70,58] },
  { id:"climate", name:"调候优先", desc:"提高寒热燥湿与季节适配的作用", values:[58,88,66,61] },
] as const;
const groups = [
  { title:"原局结构", items:["明干与藏干权重","月令季节乘数","日主支持泛函","强弱等级阈值"] },
  { title:"动态生命周期", items:["原局状态保留","大运直接参与","流年扰动强度","状态迁移阈值"] },
  { title:"关系裁决", items:["关系基础优先值","完整度与显现","竞争冲突边际","成化与通关阈值"] },
  { title:"主题贡献", items:["规则家族权重","支持压力聚合","争议保留方式","事件激活条件"] },
] as const;

export function ModelConfigurator() {
  const [selected,setSelected]=useState("baseline");
  const [group,setGroup]=useState(0);
  const [values,setValues]=useState([68,52,76,64]);
  const preset=useMemo(()=>presets.find(x=>x.id===selected)??presets[0],[selected]);
  function choose(id:string){const next=presets.find(x=>x.id===id)??presets[0];setSelected(id);setValues([...next.values]);}
  return <div className="configurator"><aside className="preset-panel"><div className="panel-heading"><div><span className="step-label">MODEL PRESETS</span><h2>模型预设</h2></div><span className="version-pill">v0.4</span></div>{presets.map(x=><button type="button" className={selected===x.id?"selected":""} onClick={()=>choose(x.id)} key={x.id}><i></i><span><strong>{x.name}</strong><small>{x.desc}</small></span></button>)}<div className="preset-note"><span>配置边界</span><p>三个内置预设已经驱动首页计算。这里的自定义滑杆用于比较参数，提交自定义模型的接口仍在封闭测试。</p></div></aside><section className="parameter-panel"><div className="parameter-header"><div><span>当前配置</span><h2>{preset.name}</h2><p>{preset.desc}</p></div><div><button type="button">比较模型</button><button type="button" className="dark">导出 JSON</button></div></div><div className="parameter-tabs">{groups.map((x,i)=><button type="button" className={group===i?"active":""} onClick={()=>setGroup(i)} key={x.title}>{x.title}</button>)}</div><div className="parameter-list">{groups[group].items.map((item,i)=><label key={item}><div><strong>{item}</strong><small>{["控制该结构在模型中的相对作用","用于显示敏感性，并非经验概率","变更后要求当前阶段重新求值","随模型版本写入计算证书"][i]}</small></div><input aria-label={item} type="range" min="0" max="100" value={values[i]} onChange={e=>setValues(v=>v.map((x,j)=>j===i?Number(e.target.value):x))}/><output>{values[i]}</output></label>)}</div><div className="config-footer"><div><span>配置摘要</span><code>senfate-model.{selected}.v0.4</code></div><p>修改任何参数后，原局、大运与流年状态都必须完整重算。</p></div></section></div>;
}
