import {requestText,intentOf} from './intent.mjs';
import {excluded} from './method-policy.mjs';
import {DECISIONS} from './method-limits.mjs';
import {recommendationMatch,safeSnippet} from './catalog-registry.mjs';
import {coverageOf} from './intent.mjs';
import {sourceBlocks} from './prompt-contract.mjs';
export function checkModelSuggestions(raw,input,methods) {
 const {draft}=requestText(input);
 if(typeof raw!=='string'||raw.length>9000) throw new Error('返回格式不符合要求，本地方法库仍可使用');
 let v;try{v=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{throw new Error('返回格式不符合要求，本地方法库仍可使用');}
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>k!=='suggestions')||!Array.isArray(v.suggestions)||v.suggestions.length>3)throw new Error('建议数量或格式不符合要求');
 const seen=new Set(),out=[],filtered={covered:0,policy:0,unconfirmed:0};
 for(const r of v.suggestions) {
  if(!r||typeof r!=='object'||Object.keys(r).some(k=>!['methodId','variantId','reason','placement','decisionRequired','increment'].includes(k)))throw new Error('建议字段不符合要求');
  const m=methods.find(m=>m.id===r.methodId);
  if(!m||seen.has(m.id)||r.variantId!=='standard'||typeof r.reason!=='string'||r.reason.length>100||/[<>]/.test(r.reason)||(r.decisionRequired!==undefined&&typeof r.decisionRequired!=='boolean'))throw new Error('建议内容不符合要求');
  seen.add(m.id);
  const coverage=coverageOf(m,input);
  if(coverage.state==='covered'){filtered.covered++;continue;}
  if(excluded(m,input,methods)){filtered.policy++;continue;}
  const inc=r.increment,text=safeSnippet(m,[]),request=typeof input==='string'?{draft:input}:input;
  const blocks=sourceBlocks(request).filter(b=>b.kind!=='user-method');
  const valid=inc&&typeof inc==='object'&&!Array.isArray(inc)&&Object.keys(inc).every(k=>['sourceBlockId','sourceQuote','snippetQuote'].includes(k))&&typeof inc.sourceBlockId==='string'&&typeof inc.sourceQuote==='string'&&inc.sourceQuote.trim().length>0&&inc.sourceQuote.length<=160&&typeof inc.snippetQuote==='string'&&inc.snippetQuote.trim().length>=4&&inc.snippetQuote.length<=200&&text.includes(inc.snippetQuote)&&blocks.some(b=>b.id===inc.sourceBlockId&&b.text.includes(inc.sourceQuote));
  if(!valid){filtered.unconfirmed++;continue;}
  // A real source quote can still be unrelated to the recommended action.
  const evidenceSignal=intentOf({draft:inc.sourceQuote},methods).signals;
  if(['citations','regression'].includes(m.id)&&!recommendationMatch(m,evidenceSignal)&&
    !(m.id==='regression'&&/故障|异常|报错|失效|失败|复现|修好|报.{0,5}错|bug|fail|broken|fix/iu.test(evidenceSignal))){
   filtered.unconfirmed++;continue;
  }
  const proposedView=coverageOf(m,{draft:inc.snippetQuote}),proposed=proposedView.state==='covered'?(m.coverage?.actions||[]).map(a=>({...a,found:true})):proposedView.actions.filter(a=>a.found);
  if(m.coverage&&(!proposed.length||proposed.every(a=>coverage.actions.some(old=>old.id===a.id&&old.found)))){filtered.unconfirmed++;continue;}
  const p=r.placement;
  if(!p||typeof p.quote!=='string'||p.quote.length>120||typeof p.hint!=='string'||p.hint.length>60)throw new Error('位置说明不符合要求');
  const quote=p.quote;
  // Coordinates are never accepted from a model. Ambiguous quotes become guidance only.
  const unique=quote&&draft.indexOf(quote)!==-1&&draft.indexOf(quote)===draft.lastIndexOf(quote);
  out.push({methodId:m.id,variantId:'standard',reason:'可考虑补充：'+inc.snippetQuote,modelReason:r.reason,increment:{...inc},genericText:true,placement:{hint:unique?`放在「${quote}」附近；请将光标移到目标位置`:m.placement_hint,quote:unique?quote:''},decisionRequired:DECISIONS.has(m.id)||r.decisionRequired===true||(m.id==='constraints'&&/绝对安全|零失误/.test(draft)&&/永不退出|不重启|不终止/.test(draft))});
 }
 return {suggestions:out,filtered};
}
export const validateModelResult=(raw,input,methods)=>checkModelSuggestions(raw,input,methods).suggestions;
