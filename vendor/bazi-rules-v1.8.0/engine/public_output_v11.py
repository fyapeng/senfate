"""Public school-separated rendering with v1.7 verdict and theme layers.

Internal rule identifiers, three-valued states and traces remain audit-only.
Each school gives its own decisive verdict; no cross-school voting is used.
"""
from __future__ import annotations
from typing import Any, Mapping

SCHOOL_LABELS={
    'classical_ziping':'传统子平','shao_weihua':'邵伟华体系',
    'li_hanchen':'李涵辰体系','duan_li_xiang':'段氏理象体系'}
STAGE_LABELS={'natal':'原局','luck':'大运','annual':'流年'}
TOPIC_LABELS={'personality':'性格与行为方式','learning':'学习与能力形成','wealth':'财富与资源','career':'事业与权责','relationships':'婚恋与人际'}
STANCE_LABELS={'supportive':'支持条件较明确','mixed':'支持与限制并存','challenging':'限制条件较强','descriptive':'结构性描述'}


def render_public_analysis(analysis:Mapping[str,Any],*,comparison_included:bool=False)->dict[str,Any]:
    schools=[]
    for run in analysis.get('profile_runs',[]):
        verdict=run.get('verdict') or {}
        themes=[]
        for row in run.get('themes') or []:
            themes.append({
                'topic':TOPIC_LABELS.get(row.get('topic'),row.get('topic','')),
                'assessment':STANCE_LABELS.get(row.get('stance'),row.get('stance','')),
                'headline':row.get('headline',''),
                'conclusion':row.get('conclusion',''),
                'supporting_factors':list(row.get('supporting_factors') or []),
                'limiting_factors':list(row.get('limiting_factors') or []),
                'time_effect':row.get('time_effect'),
            })
        schools.append({
            'school':SCHOOL_LABELS.get(run.get('school_id'),run.get('school_id','未命名体系')),
            'stage':STAGE_LABELS.get(analysis.get('stage'),analysis.get('stage','')),
            'verdict':{
                'headline':verdict.get('headline','本次未形成终局判断。'),
                'primary_structure':(verdict.get('primary_structure') or {}).get('conclusion',''),
                'strength_or_axis':(verdict.get('strength_or_axis') or {}).get('conclusion',''),
                'primary_use':(verdict.get('primary_use') or {}).get('conclusion',''),
                'secondary_structures':list(verdict.get('secondary_structures') or []),
                'rejected_routes':[f"{x.get('route')}：{x.get('reason')}" for x in verdict.get('rejected_routes') or []],
                'caveats':list(verdict.get('caveats') or []),
            },
            'themes':themes,
            'key_findings':list(run.get('case_summary') or []),
            'note':'结论按该体系自身规则作出；明确判断不等于科学事实或现实结果保证。',
        })
    return {
        'analysis_id':analysis.get('analysis_id'),'chart_id':analysis.get('chart_id'),
        'stage':STAGE_LABELS.get(analysis.get('stage'),analysis.get('stage')),
        'schools':schools,'cross_school_comparison_included':comparison_included,
        'comparison_note':('跨流派比较仅作并列展示，不参与任何流派的规则验证；不以其他流派是否同意作为判定依据。' if comparison_included else '默认不展示跨流派比较；各体系分别作出终局判断，不以其他流派是否同意作为判定依据。'),
        'scope_note':'本结果用于传统文本规则重构与研究，不构成现实预测或医学、法律、投资等专业建议。'
    }
