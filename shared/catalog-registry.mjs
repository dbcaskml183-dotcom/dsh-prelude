// One trusted catalog supplies discovery and recommendation. No I/O or SDKs.
export const DOMAINS=Object.freeze(['任务规划','思考决策','代码工程','故障恢复','研究资料','写作表达','数据分析','产品体验','学习理解','安全可靠','长任务收尾']);
const compiled=new WeakMap();
export const autoEligible=m=>m.recommendation_mode!=='manual';
export function recommendationMatch(method,text){
 if(!autoEligible(method))return null;
 let rules=compiled.get(method);if(!rules){rules=(method.recommendation?.signals||[]).map(s=>new RegExp(s,'i'));compiled.set(method,rules);}
 for(const rule of rules){const hit=rule.exec(text);if(hit)return hit[0];}return null;
}
export function orderedMethods(methods){return [...methods].sort((a,b)=>(b.recommendation?.priority||0)-(a.recommendation?.priority||0));}
export function modelCatalog(methods){
 // Columns are described once in the prompt. Keep actual generic text, not a
 // paraphrase of its purpose; no skill availability is inferred by the model.
 return methods.filter(autoEligible).map(m=>[m.id,m.technical_name||m.label,safeSnippet(m,[]),m.when_to_suggest,m.when_not_to_suggest,m.effects||[]]);
}
export function methodTexts(method){return [method.snippet,method.generic_snippet,...(method.variants||[]).map(v=>v.snippet)].filter(Boolean);}
export function methodForVariant(method,id='standard'){
 const chosen=(method.variants||[]).find(v=>v.id===id);
 const variantLabels=new Set((method.variants||[]).map(v=>v.label));
 return {...method,variants:[],...(chosen?{technical_name:chosen.label,snippet:chosen.snippet,generic_snippet:chosen.snippet,
  search_terms:[...(method.search_terms||[]).filter(t=>!variantLabels.has(t)),chosen.label],coverage:chosen.coverage}:{})};
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function explicitlyNamed(method,text){
 const names=[method.technical_name?.split(' / ')[0],...(method.variants||[]).map(v=>v.label.split(' / ')[0])].filter(s=>s&&s.length>2);
 return names.some(s=>/^[a-z\d -]+$/i.test(s)?new RegExp('(?:^|[^a-z\\d])'+escape(s)+'(?:$|[^a-z\\d])','i').test(text):text.includes(s));
}
export function validateCatalog(methods,sources=[]){
 const ids=new Set(),refs=new Set(sources.map(s=>s.id));
 for(const m of methods){
  if(!/^[-a-z\d]+$/.test(m.id)||ids.has(m.id))throw new Error('目录ID不唯一或不合法');ids.add(m.id);
  if(!m.technical_name||!m.snippet||m.snippet.length>1000||!m.when_to_suggest||!m.when_not_to_suggest)throw new Error('方法元数据不完整');
  if(!m.domains?.length||m.domains.some(d=>!DOMAINS.includes(d)))throw new Error('领域不合法');
  if(m.reference_sources?.some(id=>!refs.has(id)))throw new Error('方法来源缺失');
  if((m.variants||[]).some(v=>!/^[-a-z\d]+$/.test(v.id)||!v.label||!v.snippet||v.snippet.length>1000))throw new Error('方法写法不合法');
  if(m.coverage){const p=m.coverage,steps=new Set();if(!Array.isArray(p.actions)||!p.actions.length||p.actions.length>12)throw new Error('覆盖动作无效');
   for(const a of p.actions){if(Object.keys(a).some(k=>!['id','label','patterns','conditional','negative','allowedNegation','notApplicable'].includes(k))||!/^[-a-z\d]+$/.test(a.id)||steps.has(a.id)||typeof a.label!=='string'||a.label.length>80||!Array.isArray(a.patterns)||!a.patterns.length||a.patterns.length>4||a.patterns.some(s=>typeof s!=='string'||s.length>300)||['conditional','negative'].some(k=>a[k]!==undefined&&typeof a[k]!=='boolean')||['allowedNegation','notApplicable'].some(k=>a[k]!==undefined&&(!Array.isArray(a[k])||a[k].length>3||a[k].some(s=>typeof s!=='string'||s.length>120))))throw new Error('覆盖动作不完整');steps.add(a.id);for(const s of [...a.patterns,...(a.allowedNegation||[]),...(a.notApplicable||[])])new RegExp(s,'iu');}
   if((p.order||[]).some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(id=>!steps.has(id))))throw new Error('覆盖顺序无效');
  }
  recommendationMatch(m,'');
 }
 return true;
}

export function safeSnippet(m,availableSkills=[]) {
 if(m.related_installed_skill && !availableSkills.includes(m.related_installed_skill)) {
  return m.generic_snippet || m.snippet.replace(/(?:使用|加载)\s*[\w-]+\s*技能[，,]?/g,'');
 }
 return m.snippet;
}
