import {manualRequirements} from './method-selection.mjs';
import {QUESTIONS} from './contracts.mjs';
import {plainDraft,localSuggestions,excluded,methodApplicable} from './method-policy.mjs';
import {intentOf} from './intent.mjs';
export const noQuestions=text=>intentOf(text).noQuestions;
export function isVague(text){if(/^(?:(?:请|麻烦|帮我)\s*)?(?:优化|完善|补充|处理)(?:一下)?(?:这个|这些)?(?:附件|文件|ZIP)(?:一下)?[。！!\s]*$|^把(?:这个|这些)?附件(?:里|中)的内容处理好[。！!\s]*$/i.test(text.trim()))return true;return /^(?:(?:请|麻烦|帮我)\s*)?(?:补充完善|补充|完善|优化|改进|修改|处理|看看|改)(?:一下|这个|这些|附件|一下这个)?[。！!\s]*$|^(?:improve|fix|enhance)\s+(?:this|it)(?:\s+please)?[.!\s]*$/i.test(text.trim());}
// Strip only a finite whole trailing constraint clause, never a concrete goal.
function taskWithoutConstraintSuffix(text){
 let t=text.trim();
 const suffix=/(?:[，,。；;]\s*)?(?:也)?(?:不要|不用|无需|不必|别)(?:再|反复|重复)?(?:问我问题|提问|追问|问我|发问|缩减范围|删减范围|做MVP|用MVP)[。！!\s]*$|(?:[,.!?;]\s*)?do not ask me questions[.!\s]*$/i;
 for(let i=0;i<8;i++){const next=t.replace(suffix,'').replace(/[，,。；;]\s*$/,'').trim();if(next===t)break;t=next;}
 return t;
}
export function preflightDecision(request,methods=[]){
 const {draft='',context='',selectedEvidence=[],materials={attachmentCount:0,referenceCount:0}}=request;
 const v=intentOf(request,methods),t=plainDraft(draft);
 if(/^(?:谢谢|你好|thanks|hello)[。！!.\s]*$/i.test(t))return {kind:'no_suggestion',suggestions:[],note:'日常回应无需额外方法。'};
 if(/^(?:请认真处理：)?(?:继续|好的|照上面做)[。！!\s]*$|^继续[，,\s]*(?:上一步)?(?:按|照)?(?:原计划|上面的?计划|上一步|上面|刚才的?方案)(?:做|执行|推进)?[。！!\s]*$|^continue[.!\s]*$/i.test(t)){
  if(!manualRequirements(request.explicitRequirements??context).trim()&&!selectedEvidence.some(x=>x.text?.trim().length>20))return {kind:'uncertain',suggestions:[],note:'当前只见继续指令，不能确认上一步；可选取相关上文后分析，不自行猜测。'};
 }
 if(/^(?:请)?(?:严格)?(?:逐字|原样)(?:复制|保存)|^(?:请)?(?:概括|总结)这段引文|^(?:please\s+)?(?:copy|quote)\s+(?:verbatim|exactly)/i.test(draft.trim())||/^(?:把\s*.+\s*翻译|计算\s*[\d乘加减除×÷+*/\s]+)|只(?:给|返回|输出)(?:数字|公式|翻译结果)/.test(t))return {kind:'no_suggestion',suggestions:[],note:'请求已明确，无需增加方法。'};
 const meaningfulContext=taskWithoutConstraintSuffix(manualRequirements(request.explicitRequirements??context)).trim().length>0||selectedEvidence.some(x=>x.text?.trim().length>20);
 const vague=isVague(taskWithoutConstraintSuffix(t));
 if(!meaningfulContext&&(vague||(!t&&materials.attachmentCount+materials.referenceCount>0))){
  if(v.noQuestions){const ids=materials.attachmentCount?['document-coverage','evidence']:['evidence'];return {kind:'suggestions',suggestions:ids.filter(id=>!methods.length||methods.some(m=>m.id===id&&!excluded(m,request,methods))).map(id=>({methodId:id,variantId:'standard',reason:'目标尚不明确，可先保留未知并核对资料范围；这不是对材料正文的判断。',placement:{hint:'任务要求后',quote:''},decisionRequired:false})),note:'遵守不追问要求；以下是可选方法，不猜测材料内容或交付目标。'};}
  return {kind:'needs_context',missing:'outcome',question:QUESTIONS.outcome,suggestions:[],note:'只补最关键的一点即可，也可以跳过并使用方法库。'};
 }
 if(!t&&!meaningfulContext)return {kind:'no_suggestion',suggestions:[],note:'先照常写需求，也可以直接使用方法库。'};
 return null;
}
export function enforcePolicy(decision,request,methods=[]){
 const local=preflightDecision(request,methods);if(local)return local;
 const intent=intentOf(request,methods);
 if(decision.kind==='needs_context'&&(intent.noQuestions||(/整理.{0,20}(?:文献|证据)|总结|概括|翻译|列出.{0,20}(?:清单|问题|风险|证据)/.test(intent.signals)&&decision.missing==='outcome'))){
  const suggestions=localSuggestions(request,methods);return {kind:suggestions.length?'suggestions':'no_suggestion',suggestions,note:intent.noQuestions?'遵守不追问要求；保留未知，只提供可选方法。':'未补充额外格式；请按实际目标核对。'};
 }
 if(decision.kind==='needs_context')return {...decision,note:'只补最关键的一点即可，也可以跳过。'};
 const suggestions=(decision.suggestions||[]).filter(s=>{const m=methods.find(m=>m.id===s.methodId);return m&&!excluded(m,request,methods);});
 return {...decision,kind:decision.kind==='suggestions'&&!suggestions.length?'uncertain':decision.kind,suggestions,...(intent.noQuestions&&/[?？]/.test(decision.note||'')?{note:'遵守不追问要求；以下方法由你决定是否采用。'}:{})};
}
