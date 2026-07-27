"""School-specific theme resolution for v1.7.

Themes are derived only after each school's final verdict is resolved. They are
explicit traditional interpretations, not scientific or deterministic outcomes.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Mapping

from engine.school_verdict_v17 import _provenance

ROOT=Path(__file__).resolve().parents[1]
SOURCE_MAP=json.loads((ROOT/'interpretations/V17_THEME_SOURCE_MAP.json').read_text(encoding='utf-8'))
TOPICS=("personality","learning","wealth","career","relationships")
TOPIC_CN={"personality":"性格与行为方式","learning":"学习与能力形成","wealth":"财富与资源","career":"事业与权责","relationships":"婚恋与人际"}


def _safe(x:str)->str:
    return ''.join(ch if ch.isalnum() or ch in '_.-' else '_' for ch in x)


def _gods(chart:Mapping[str,Any])->list[str]:
    out=[]
    for p in ('year','month','day','hour'):
        row=chart['pillars'][p]
        if row.get('stem_ten_god'): out.append(row['stem_ten_god'])
        out += [h.get('ten_god') for h in row.get('hidden_stems',[]) if h.get('ten_god')]
    return out


def _visible(chart:Mapping[str,Any])->list[str]:
    return [chart['pillars'][p].get('stem_ten_god') for p in ('year','month','hour') if chart['pillars'][p].get('stem_ten_god')]


def _base(profile_id:str,school_id:str,chart_id:str,stage:str,topic:str,findings:list[Mapping[str,Any]])->dict[str,Any]:
    rules,chunks=_provenance([f for f in findings if f.get('finding_type') in {'theme','semantic','structural'}])
    chunks=list(dict.fromkeys(chunks + SOURCE_MAP.get(school_id,{}).get(topic,[])))
    return {
        'schema_version':'1.0.0','theme_id':f'theme.{_safe(chart_id)}.{school_id}.{stage}.{topic}',
        'school_id':school_id,'profile_id':profile_id,'chart_id':chart_id,'stage':stage,'topic':topic,
        'coverage':'partial','stance':'descriptive','headline':TOPIC_CN[topic], 'conclusion':'',
        'supporting_factors':[],'limiting_factors':[],'time_effect':None,
        'source_rule_ids':rules[:24],'source_chunk_ids':chunks[:24],
        'safety':{'output_mode':'neutralized','scope':'仅表示该流派传统解释，不保证现实结果。'},
    }


def _classical(profile_id,chart,context,findings,verdict,stage):
    x=context['facts']['classical_ziping']; w02=x['w02']; w03=x['w03']
    life=w02['lifecycle']; strength=w02['strength']
    verdict_pattern=verdict.get('primary_structure',{}).get('label') or life.get('confirmed_pattern') or '普通格局'
    pattern=verdict_pattern[:-1] if verdict_pattern.endswith('格') else verdict_pattern
    verdict_strength=verdict.get('strength_or_axis',{}).get('conclusion','')
    side='strong' if '身强' in verdict_strength else 'weak' if '身弱' in verdict_strength else None
    follow_route='从煞' in verdict_pattern or '从杀' in verdict_pattern
    gods=_gods(chart); vis=_visible(chart)
    counts={k:sum(g in v for g in gods) for k,v in {
        'wealth':{'正财','偏财'},'official':{'正官','七杀','七煞'},'resource':{'正印','偏印'},
        'output':{'食神','伤官'},'peer':{'比肩','劫财'}}.items()}
    out=[]
    t=_base(profile_id,'classical_ziping',chart['chart_id'],stage,'personality',findings)
    pmap={'正官':'重秩序、责任和边界','七杀':'行动果断、对压力反应直接','偏官':'行动果断、对压力反应直接',
          '正财':'重实际、资源安排与稳定','偏财':'重机会、交换与外部资源','正印':'重学习、保护与规范','偏印':'重独立理解和特殊方法',
          '食神':'表达舒展、重产出和生活节奏','伤官':'表达锋利、重判断和突破','比肩':'自主、坚持和同辈并行','劫财':'自主与竞争意识较强'}
    core=pmap.get(pattern,f'以{pattern}格的行为方式为主')
    accent=('特殊从煞路线已覆盖普通强弱模板，行为解释服从官杀主势。' if follow_route else '日主强，使该倾向表现得更主动和持续。' if side=='strong' else '日主弱，使该倾向更依赖环境与支持系统。' if side=='weak' else '强弱处于边界，表现会随结构触发而变化。')
    t.update(coverage='full',stance='descriptive',headline=f'{pattern}格的主导行为方式',conclusion=f'按传统子平，{core}；{accent}',supporting_factors=[f'主格为{pattern}',verdict['strength_or_axis']['conclusion']],limiting_factors=['若格局受破或岁运改写主线，外在表现随之改变。'])
    out.append(t)
    t=_base(profile_id,'classical_ziping',chart['chart_id'],stage,'learning',findings)
    if counts['resource'] or counts['output']:
        factors=[]; text=[]
        if counts['resource']: text.append('印星提供吸收、记忆和体系化倾向'); factors.append(f'印星{counts["resource"]}项')
        if counts['output']: text.append('食伤提供表达、转化和作品化能力'); factors.append(f'食伤{counts["output"]}项')
        t.update(coverage='full',stance='supportive' if counts['resource'] and counts['output'] else 'descriptive',headline='学习能力由印与食伤共同决定',conclusion='；'.join(text)+'。',supporting_factors=factors,limiting_factors=['印食相碍或一方过重时，吸收与表达会失衡。'])
    else:
        t.update(coverage='partial',headline='学习主题缺少直接格神',conclusion='现有结构缺少明显印食主线，只能从调候与岁运补充观察。')
    out.append(t)
    t=_base(profile_id,'classical_ziping',chart['chart_id'],stage,'wealth',findings)
    if counts['wealth']:
        can_bear=side=='strong'
        if follow_route:
            wealth_text='从煞主线已经成立，财星只按顺势生杀与气势流通观察，不再套用普通身弱“先扶身再任财”的模板。'
            wealth_stance='descriptive'
        else:
            wealth_text='日主有承载力，财星可作为资源组织和价值实现的有效通道。' if can_bear else '财星存在，但日主承载力不足时，资源机会也会形成负担；应先扶身再任财。'
            wealth_stance='supportive' if can_bear else 'mixed'
        t.update(coverage='full',stance=wealth_stance,headline='财星已进入原局结构',conclusion=wealth_text,supporting_factors=[f'财星{counts["wealth"]}项',verdict['strength_or_axis']['conclusion']],limiting_factors=(['比劫重时，获取与保有并非同一方向。'] if counts['peer'] and not follow_route else []))
    else:
        t.update(coverage='partial',stance='descriptive',headline='原局财星主线不显',conclusion='财富主题不以直接财星为主，应从食伤生财、暗财或岁运引入观察。')
    out.append(t)
    t=_base(profile_id,'classical_ziping',chart['chart_id'],stage,'career',findings)
    if counts['official']:
        good=side=='strong' or life.get('official',{}).get('resource_protection') or life.get('special',{}).get('official_resource_generation')
        if follow_route:
            career_text='从煞路线以官杀为原局主势，权责主题按顺势与气势是否纯粹裁决，不再按普通身弱受压模板解释。'
            career_stance='supportive'
        else:
            career_text='官杀有承载或制化，适合在规则、责任和组织权责中形成位置。' if good else '官杀形成明确外部要求，但承载与制化不足时，事业主题先表现为压力和约束。'
            career_stance='supportive' if good else 'mixed'
        t.update(coverage='full',stance=career_stance,headline='官杀构成事业与权责主线',conclusion=career_text,supporting_factors=[f'官杀{counts["official"]}项'],limiting_factors=(['官杀混杂或无制时，职责方向容易分散。'] if life.get('compiled',{}).get('official_kill_mixed') and not follow_route else []))
    else:
        t.update(coverage='partial',headline='官杀主线不显',conclusion='事业不以直接官杀为唯一入口，更适合从格局主用、食伤产出或财星经营路径观察。')
    out.append(t)
    t=_base(profile_id,'classical_ziping',chart['chart_id'],stage,'relationships',findings)
    sex=chart.get('traditional_context',{}).get('sex_parameter'); spouse_group='wealth' if sex=='male' else 'official' if sex=='female' else None
    if spouse_group:
        n=counts[spouse_group]; label='财星' if spouse_group=='wealth' else '官杀'
        conclusion=f'{label}在原局'+('可见，关系主题有明确结构载体；其状态仍须结合日支、合冲与格局喜忌。' if n else '不显，关系主题更依赖日支和岁运引入。')
        t.update(coverage='partial',stance='descriptive',headline='以配偶星与日支共同观察',conclusion=conclusion,supporting_factors=[f'{label}{n}项'],limiting_factors=['不据单一配偶星断定婚姻结果。'])
    else:
        t.update(coverage='partial',headline='关系主题需性别参数与日支共同裁决',conclusion='当前只登记日支和财官关系，不作唯一婚恋结论。')
    out.append(t)
    return out


def _shao(profile_id,chart,context,findings,verdict,stage):
    x=context['facts']['shao_weihua']['w04']; th=x['themes']; kin=x['kinship']; out=[]
    t=_base(profile_id,'shao_weihua',chart['chart_id'],stage,'personality',findings)
    if th.get('personality_no_official_freedom'):
        conclusion='官杀不显，按该体系更偏向自主决策和较少接受外部约束。'
    else:
        conclusion=f"旺衰裁决为{verdict['strength_or_axis']['conclusion']}；五行和格局共同决定行为倾向，不能只按单一十神贴标签。"
    t.update(coverage='full',stance='descriptive',headline='以旺衰、格局和五行性情合看',conclusion=conclusion,supporting_factors=[verdict['primary_structure']['label'],verdict['strength_or_axis']['conclusion']])
    out.append(t)
    t=_base(profile_id,'shao_weihua',chart['chart_id'],stage,'learning',findings)
    if th.get('study_output_overload_weak'):
        t.update(coverage='full',stance='challenging',headline='身弱而伤食叠叠，学习主题受抑',conclusion='输出过重而日主承载不足，且没有形成印制伤官的救应链；财官印的形式共现不得覆盖这一否定条件。',limiting_factors=['身弱','伤食叠叠','无印制伤救应'])
    elif th.get('study_hurt_control'):
        pairs=[r.get('label') for r in x.get('compound',{}).get('resource_controls_hurt_pairs',[]) if r.get('label')]
        t.update(coverage='full',stance='supportive',headline='伤官有印制，学习主题得到支持',conclusion='伤官由印星形成有向制约；制化闭合后，学习与训练主题得到支持。',supporting_factors=pairs or ['伤官佩印'])
    elif th.get('study_three_stars_complete'):
        t.update(coverage='full',stance='supportive',headline='财官印三项学习结构齐备',conclusion='该体系将财、官、印齐备视为学习、资格与组织性能力可以互相衔接。',supporting_factors=['财官印三项齐全'])
    elif th.get('study_three_stars'):
        t.update(coverage='full',stance='mixed',headline='学习结构已有主要组成',conclusion='财、官、印已有部分支持，但完整配置仍需看旺衰和是否受损。')
    else:
        t.update(coverage='partial',headline='学习主题没有形成完整专门结构',conclusion='按印星、食伤和神煞附加观察，不作强结论。')
    out.append(t)
    t=_base(profile_id,'shao_weihua',chart['chart_id'],stage,'wealth',findings)
    if th.get('wealth_presence'):
        factors=['财星出现']
        if th.get('wealth_output_generation'): factors.append('食伤生财')
        if th.get('wealth_useful'): factors.append('财为取用')
        if th.get('wealth_strong_day'): text='身强能任财，资源主题较易形成有效承载。'; stance='supportive'
        elif th.get('wealth_weak_day'): text='财星出现但身弱，资源机会与承载压力并存。'; stance='mixed'
        else: text='财星和生财路径已经出现，最终承载取决于旺衰与比劫竞争。'; stance='mixed'
        t.update(coverage='full',stance=stance,headline='财星进入资源主题',conclusion=text,supporting_factors=factors,limiting_factors=(['比劫克财时应区分获取与保有。'] if x.get('compound',{}).get('peer_controls_wealth') else []))
    else:
        t.update(coverage='partial',headline='财星不构成当前主题主线',conclusion='资源判断主要等待岁运或间接生财路径。')
    out.append(t)
    t=_base(profile_id,'shao_weihua',chart['chart_id'],stage,'career',findings)
    factors=[]; limiting=[]; stance='descriptive'
    if th.get('career_official_wealth'): factors.append('财生官'); stance='supportive'
    if th.get('career_kill_strong'): factors.append('七杀有承载'); stance='supportive'
    if th.get('career_mixed_official_kill'): limiting.append('官杀混杂'); stance='mixed'
    if th.get('career_official_damaged'): limiting.append('官星受损'); stance='challenging'
    if factors or limiting:
        t.update(coverage='full',stance=stance,headline='事业主题由官杀及其生护制化决定',conclusion=('支持路径为'+ '、'.join(factors)+'；' if factors else '')+('限制为'+ '、'.join(limiting)+'。' if limiting else '组织权责路径可用。'),supporting_factors=factors,limiting_factors=limiting)
    else:
        t.update(coverage='partial',headline='事业主题未形成专门触发',conclusion='只能从旺衰、取用和大运官杀激活继续观察。')
    out.append(t)
    t=_base(profile_id,'shao_weihua',chart['chart_id'],stage,'relationships',findings)
    sex=chart.get('traditional_context',{}).get('sex_parameter')
    factors=[]
    if sex=='male' and kin.get('male_spouse_star'): factors.append('男命财星为配偶星')
    if kin.get('spouse_palace_day'): factors.append('日支为配偶宫')
    if kin.get('day_branch_relation'): factors.append('日支关系已编译')
    t.update(coverage='partial',stance='descriptive',headline='配偶星与日支共同判断',conclusion='本体系已有婚恋结构入口，但默认只判断互动条件、支持与压力，不输出必然婚姻结局。',supporting_factors=factors,limiting_factors=['性别化和确定性婚姻断语不进入默认输出。'])
    out.append(t)
    return out


def _li(profile_id,chart,context,findings,verdict,stage):
    x=context['facts']['li_hanchen']['w05']; u=x['useful_party']; c=x['classification']; out=[]
    useful=set(u.get('useful_groups') or []); unf=set(u.get('unfavorable_groups') or [])
    primary=u.get('primary_useful_tokens') or []; bad=u.get('primary_unfavorable_tokens') or []
    reverse_useful=set(u.get('reverse_useful_tokens') or []); reverse_bad=set(u.get('reverse_unfavorable_tokens') or [])
    override_reasons=list(u.get('token_override_reasons') or [])
    def role(group): return '用神方向' if group in useful else '忌神方向' if group in unf else '条件方向'
    t=_base(profile_id,'li_hanchen',chart['chart_id'],stage,'personality',findings)
    pieces=[]
    if 'resource' in useful: pieces.append('印为用，重学习、吸收和支持系统')
    if 'peer' in useful: pieces.append('比劫为用，重自主、协作和同伴助力')
    if 'wealth' in useful: pieces.append('财为用，重实际执行和资源安排')
    if 'official' in useful: pieces.append('官杀为用，重规则、责任和社会活动')
    if 'output' in useful: pieces.append('食伤为用，重表达、技术和创造')
    behavior='；'.join(pieces or ['当前用神方向未形成可见行为主线'])+'。'
    if override_reasons: behavior+=' 字级反断：'+'；'.join(override_reasons)+'。'
    t.update(coverage='full',stance='descriptive',headline=f"按{verdict['primary_structure']['label']}的用忌塑造行为",conclusion=behavior,supporting_factors=[f'主要用神：{x}' for x in primary],limiting_factors=[f'主要忌神：{x}' for x in bad])
    out.append(t)
    t=_base(profile_id,'li_hanchen',chart['chart_id'],stage,'learning',findings)
    if 'resource' in useful:
        t.update(coverage='full',stance='supportive',headline='印星属于用神方向',conclusion='该体系将印作为学习、文凭、知识吸收和支持系统；印为用时，学习主题是主要优势路径。',supporting_factors=[f'印为{role("resource")}'])
    elif 'resource' in unf:
        t.update(coverage='full',stance='challenging',headline='印星属于忌神方向',conclusion='学习和知识主题并非越多越好，需要通过制约忌印或调用其他用神形成效率。',limiting_factors=['印为忌神方向'])
    else:
        t.update(coverage='partial',headline='学习主题为条件项',conclusion='需看印星具体落点和岁运作用。')
    out.append(t)
    t=_base(profile_id,'li_hanchen',chart['chart_id'],stage,'wealth',findings)
    if 'wealth' in useful:
        text='财为用神方向，财星得生扶或在岁运中增力时，按该体系视为资源主题得到支持。'; stance='supportive'
    elif 'wealth' in unf:
        text='财为忌神方向，直接强化财星未必有利；应先看用神是否能制约或承受财的作用。'; stance='challenging'
    else: text='财为条件方向，需结合具体字和位置作用。'; stance='descriptive'
    t.update(coverage='full',stance=stance,headline=f'财星属于{role("wealth")}',conclusion=text,supporting_factors=[f'用神落点：{"、".join(primary)}'],limiting_factors=[f'忌神落点：{"、".join(bad)}'])
    out.append(t)
    t=_base(profile_id,'li_hanchen',chart['chart_id'],stage,'career',findings)
    if 'official' in useful:
        text='官杀为用，社会活动、工作安排和权责主题以官杀得力为支持路径。'; stance='supportive'
    elif 'official' in unf:
        text='官杀为忌，外部规则和职位压力是主要约束；事业改善依赖用神制官杀或化解其作用。'; stance='challenging'
    else: text='官杀为条件项，需按具体位置和岁运作用决定。'; stance='descriptive'
    chains=[r.get('label') for r in c.get('position_actions',[]) if r.get('label')]
    if reverse_useful & set(primary):
        text+=' 其中'+'、'.join(sorted(reverse_useful & set(primary)))+'按字级反断转为用神，覆盖官杀组的默认方向。'; stance='mixed'
    t.update(coverage='full',stance=stance,headline=f'官杀属于{role("official")}',conclusion=text,supporting_factors=chains[:4]+override_reasons[:2])
    out.append(t)
    t=_base(profile_id,'li_hanchen',chart['chart_id'],stage,'relationships',findings)
    sex=chart.get('traditional_context',{}).get('sex_parameter'); spouse_group='wealth' if sex=='male' else 'official' if sex=='female' else None
    if spouse_group:
        dirn=role(spouse_group)
        text=f"按该体系，{'财星' if spouse_group=='wealth' else '官杀'}为配偶主题入口，当前属于{dirn}；再依据靠近日干、受生受制和岁运增减判断互动支持或压力。"
        t.update(coverage='full',stance='supportive' if spouse_group in useful else 'challenging' if spouse_group in unf else 'descriptive',headline=f'配偶星属于{dirn}',conclusion=text,limiting_factors=['不据用忌单独断定婚姻成败。'])
    else:
        t.update(coverage='partial',headline='配偶主题需性别参数',conclusion='现阶段只输出关系支持与压力。')
    out.append(t)
    return out


def _duan(profile_id,chart,context,findings,verdict,stage):
    x=context['facts']['duan_li_xiang']['w06']; sem=x['semantics']; hb=x['host_body']; out=[]
    candidates=sem.get('theme_candidates') or []
    themes=[]
    for c in candidates:
        themes.extend(c.get('themes') or [])
    theme_set=set(themes)
    main=verdict['primary_use']['tokens']
    conclusions=sem.get('structural_conclusions') or []
    labels=[]; bases=set()
    for row in conclusions:
        if isinstance(row,str): labels.append(row)
        else:
            if row.get('label'): labels.append(row['label'])
            if row.get('basis'): bases.add(row['basis'])
    label_set=set(labels)
    body_count=len(hb.get('body_refs') or []); use_count=len(hb.get('use_refs') or [])

    t=_base(profile_id,'duan_li_xiang',chart['chart_id'],stage,'personality',findings)
    conclusion=f'体{body_count}项、用{use_count}项。该体系以主位如何调用宾位资源解释行动方式：主做功越集中，行动主线越明确；多种方法并存时，处理方式更复合。'
    t.update(coverage='full',stance='descriptive',headline='由体用和主做功描述行动方式',conclusion=conclusion,supporting_factors=main or ['原局无认可做功'])
    out.append(t)

    t=_base(profile_id,'duan_li_xiang',chart['chart_id'],stage,'learning',findings)
    f=[]
    if {'学习','知识','凭证与保护'} & theme_set: f.append('印星类象进入知识与支持主题')
    if {'表达','产出','技术'} & theme_set: f.append('食伤类象进入表达与产出主题')
    if sem.get('ordered_generation_present'): f.append('一气相生形成连续转化')
    if sem.get('output_text_idea_image'): f.append('乙卯食伤进入文字载体与思想表达类象')
    if sem.get('propagation_theme'): f.append('年时卯未库拱链形成传播接口')
    t.update(coverage='partial' if not f else 'full',stance='supportive' if len(f)>=2 else 'descriptive',headline='学习主题看印、食伤及生化链',conclusion=('；'.join(f)+'。' if f else '当前主做功未指向明确学习路径，只保留类象候选。'),supporting_factors=f)
    out.append(t)

    t=_base(profile_id,'duan_li_xiang',chart['chart_id'],stage,'wealth',findings)
    f=[]; lim=[]
    if {'资产','资源','价值流','交换'} & theme_set: f.append('财星进入资源与资产类象')
    if '主位为体，宾位为财' in label_set: f.append('宾位财与主位体形成连接')
    if any('食神藏财' in x or '内食神' in x for x in label_set): f.append('食神藏财形成转化路径')
    if sem.get('same_polarity_kill_as_wealth'): f.append('同极七杀按财象观察')
    if sem.get('month_guest_kill_resource'): f.append('月令宾位财象指向组织或公共资源')
    if sem.get('guest_source_branch_for_kill_wealth'): f.append('宾位支为七杀财象之源，归入他方资源')
    if any('效率偏低' in x or '去财结构' in x for x in label_set): lim.append('财的取得或保有路径效率偏低')
    if sem.get('no_recognised_work'): lim.append('原局无认可做功')
    stance='supportive' if f and not lim else 'mixed' if f and lim else 'challenging' if lim else 'descriptive'
    conclusion=('支持路径：'+'、'.join(f)+'；' if f else '')+('限制：'+'、'.join(lim)+'。' if lim else '主线可用。' if f else '财星未进入当前认可主做功。')
    t.update(coverage='full' if f or lim else 'partial',stance=stance,headline='财富看财星是否被主位有效取得',conclusion=conclusion,supporting_factors=f,limiting_factors=lim)
    out.append(t)

    t=_base(profile_id,'duan_li_xiang',chart['chart_id'],stage,'career',findings)
    f=[]; lim=[]
    if {'权责','管理','组织约束','规则'} & theme_set: f.append('官杀进入权责与组织类象')
    if sem.get('kill_transformed_to_body') or '化用结构' in label_set: f.append('官杀经印或做功转入主体能力')
    if sem.get('official_pressure_heavy'): lim.append('官杀压力重')
    if sem.get('untransformed_official_present'): lim.append('官杀支路未化')
    if main: f.append('主做功：'+'、'.join(main[:2]))
    if sem.get('propagation_theme'): f.append('文字与思想表达经库拱链转入传播和知识工作主题')
    stance='supportive' if f and not lim else 'mixed' if f and lim else 'challenging' if lim else 'descriptive'
    t.update(coverage='full' if f or lim else 'partial',stance=stance,headline='事业看官杀是否通过做功归主',conclusion=('；'.join(f)+'。' if f else '官杀类象不构成当前主线。')+(' 限制为'+'、'.join(lim)+'。' if lim else ''),supporting_factors=f,limiting_factors=lim)
    out.append(t)

    t=_base(profile_id,'duan_li_xiang',chart['chart_id'],stage,'relationships',findings)
    f=['日支代表近身与私人关系语境']
    if 'six_combine_visible' in bases or any('相合' in x for x in label_set): f.append('明合表示连接、绑定或共同处理')
    if sem.get('branch_breaks'): f.append('破表示关系结构中的拆分或损耗')
    if sem.get('dark_combines'): f.append('暗合表示未直接显露的连接')
    t.update(coverage='partial',stance='descriptive',headline='关系主题看日支及实际合破穿刑是否进入主做功',conclusion='；'.join(f)+'。不据单一合冲直接断定关系结局。',supporting_factors=f,limiting_factors=['只有进入认可做功的关系才列为主线。'])
    out.append(t)
    return out


def resolve_school_themes(profile_id:str,school_id:str,chart:Mapping[str,Any],context:Mapping[str,Any],findings:list[Mapping[str,Any]],verdict:Mapping[str,Any],stage:str)->list[dict[str,Any]]:
    funcs={'classical_ziping':_classical,'shao_weihua':_shao,'li_hanchen':_li,'duan_li_xiang':_duan}
    rows=funcs[school_id](profile_id,chart,context,findings,verdict,stage)
    if stage!='natal':
        for row in rows:
            row['time_effect']=f"本{ {'luck':'大运','annual':'流年'}.get(stage,stage)}主题结论由原局终局判断与当前时间层关系共同生成。"
    return rows
