import {methodForVariant,safeSnippet} from './catalog-registry.mjs';
import {methodApplicable} from './method-policy.mjs';
import {operationConstraints} from './intent.mjs';
import {coverageOf} from './intent.mjs';
import {editorPolicyReason} from './editor-policy.mjs';
export const METHOD_HEADING='本次明确选择的方法：\n';
export const MAX_SELECTED_METHODS=8;
// A handwritten heading is ordinary user text, never a provenance delimiter.
export function manualRequirements(text=''){return text;}
export function methodChoice(method,variant='standard',skills=[]){
 if(!method||method.id.startsWith('custom-')||(variant!=='standard'&&!method.variants?.some(v=>v.id===variant)))throw new Error('方法或写法已变化，请重新选择。');
 const selected=methodForVariant(method,variant),text=safeSnippet(selected,skills);
 return {id:method.id,variant,text,label:selected.technical_name||selected.label};
}
export function toggleMethod(choices,choice){
 const same=choices.some(x=>x.id===choice.id&&x.variant===choice.variant&&x.text===choice.text);
 return same?choices.filter(x=>x.id!==choice.id):[...choices.filter(x=>x.id!==choice.id),{...choice}];
}
export function restoreMethods(previous,current){return [...previous.filter(x=>!current.some(v=>v.id===x.id)),...current].map(x=>({...x}));}
export function composeRequirements(request,choices,methods,skills=[]){
 const manual=request.explicitRequirements??request.context??'',seen=new Set(),included=[],redundant=[],issues=[];
 for(const choice of choices){
  if(seen.has(choice.id))continue;seen.add(choice.id);
  const method=methods.find(m=>m.id===choice.id);let expected;
  try{expected=methodChoice(method,choice.variant,skills);}catch(e){issues.push(e.message);continue;}
  const fallback=methodChoice(method,choice.variant,[]);
  if(expected.text!==choice.text&&fallback.text!==choice.text){const specific=methodChoice(method,choice.variant,method.related_installed_skill?[method.related_installed_skill]:[]);issues.push(choice.text===specific.text&&method.related_installed_skill?expected.label+'的所选技能暂不可确认，请重新选择通用写法；原选择保留。':expected.label+'的内容已变化，请重新选择。');continue;}
  if(!methodApplicable(methodForVariant(method,choice.variant),request,methods)){issues.push(expected.label+'与当前要求冲突；请取消该项或明确修改原稿。');continue;}
  const reason=editorPolicyReason(choice.text);if(reason){issues.push(reason);continue;}
  if(coverageOf(methodForVariant(method,choice.variant),request).state==='covered')redundant.push(expected);
  included.push({...expected,text:choice.text});
 }
 if(seen.size>MAX_SELECTED_METHODS)issues.push('最多选择'+MAX_SELECTED_METHODS+'项方法；请取消多余项后再改写，原选择未删减。');
 issues.push(...methodPairIssues(included,methods));
 const extra=included.map(x=>x.label+'：\n'+x.text).join('\n\n');
 const text=manual+(extra?(manual?'\n\n':'')+METHOD_HEADING+extra:'');
 if(text.length>2000)issues.push('补充要求与所选方法合计'+text.length+'字符，超过2000字符；请减少内容，未截断。');
 return {text,manual,selectedMethods:included.map(x=>({...x})),included,redundant,issues:[...new Set(issues)],valid:issues.length===0};
}

// Canonical snapshots only. Never interpret a client-supplied heading or label as authority.
export function parseMethodSelections(value=[],methods=[],availableSkills=[]){
 if(!Array.isArray(value)||value.length>MAX_SELECTED_METHODS)throw new Error('方法选择格式或数量不合法。');
 const seen=new Set();return value.map(choice=>{
  if(!choice||typeof choice!=='object'||Array.isArray(choice)||Object.keys(choice).some(k=>!['id','variant','text','label'].includes(k))||seen.has(choice.id))throw new Error('方法选择重复或格式不合法。');
  seen.add(choice.id);const method=methods.find(m=>m.id===choice.id);
  const fallback=methodChoice(method,choice.variant,[]),specific=methodChoice(method,choice.variant,method.related_installed_skill?[method.related_installed_skill]:[]);
  if(choice.text!==fallback.text&&choice.text!==specific.text||choice.label!==fallback.label)throw new Error('方法内容已变化，请重新选择。');
  if(choice.text!==fallback.text&&(!method.related_installed_skill||!availableSkills.includes(method.related_installed_skill)))throw Object.assign(new Error('所选技能暂不可确认，请刷新或重新选择通用写法；已确认文字未替换。'),{code:'SKILL_UNAVAILABLE'});
  return {...fallback,text:choice.text};
 });
}
export function methodPairIssues(choices,methods){
 const issues=[];
 for(let i=0;i<choices.length;i++)for(let j=i+1;j<choices.length;j++){
  for(const [a,b] of [[choices[i],choices[j]],[choices[j],choices[i]]]){
   const effects=methods.find(m=>m.id===b.id)?.effects||[],v=operationConstraints(a.text);
   if(v.noQuestions&&effects.includes('ask')||v.noWrite&&effects.includes('write')||v.noExecute&&effects.includes('execute')||v.noRewrite&&effects.includes('rewrite')||(v.noMvp||v.fixedScope)&&effects.includes('reduce-scope'))issues.push(a.label+'与'+b.label+'的操作要求冲突，请保留一种。');
  }
 }
 return [...new Set(issues)];
}
