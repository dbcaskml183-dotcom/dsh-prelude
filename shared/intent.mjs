import {autoEligible,methodTexts,explicitlyNamed} from './catalog-registry.mjs';
// Finite task constraints. No provider, storage, UI, or automatic history I/O.
export function dataFreeText(value='') {
 return String(value).replace(/~~~[\s\S]*?~~~/g,' ').replace(/```[\s\S]*?```/g,' ')
  .replace(/^\s*>.*$/gm,' ').replace(/`[^`\n]*`/g,' ')
  .replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g,' ')
  .replace(/(?<![A-Za-z])'[^']*'(?![A-Za-z])/g,' ').trim();
}
export function requestText(input) {
 return typeof input==='string'?{draft:input,context:''}:{draft:input?.draft||'',context:[input?.explicitRequirements??input?.context??'',...(input?.selectedMethods||[]).map(x=>x.text)].filter(Boolean).join('\n')};
}
// Only explicit, unconditional task-level operation restrictions become global
// recommendation gates. Conditions and descriptive text stay in source fidelity
// checks; they are never treated as permission to execute.
export function operationConstraints(text='') {
 const out={},sentences=dataFreeText(text).normalize('NFKC').replace(/[\u200b-\u200d\u2060\ufeff]/gu,'').split(/[。！？；;\n]+/u);
 const head=s=>s.trim().replace(/^(?:[-*•]|\d+[.)、])\s*/u,'').replace(/^(?:(?:但|也|且|同时|另外|并且)\s*)+/u,'').replace(/^(?:(?:请您|请|麻烦|严格|本轮|本次|这次|此次|你们?|我们|要求|注意|限制|please\b)\s*[:：]?\s*)+/iu,'');
 const deny='(?:不要|不得|禁止|严禁|不允许|不可以|不许|不准|请勿|切勿|勿|别|不|do not\\s+|don\'t\\s+|never\\s+|must not\\s+)';
 const denied=(t,action)=>new RegExp('^'+deny+action,'iu').test(t);
 for(const sentence of sentences){
  const whole=head(sentence);
  if(/^(?:若|如果|只有|除非|未经|未获|在.+?(?:前|后)|if\b|unless\b|only after\b)/iu.test(whole))continue;
  // A new task-stage instruction can override old contextual stage flags, but
  // a prohibition in that same sentence is never erased by the phase change.
  const parts=sentence.split(/[，,]+/u).map(head);
  if(/^(?:现在|接下来|本轮|这次)(?:可以|开始|请|允许)[^。！？\n]{0,5}(?:落实|实现|修复|修改)|^now (?:implement|fix|execute)/iu.test(sentence.trim())&&!parts.some(t=>new RegExp('^'+deny,'iu').test(t)))Object.assign(out,{readOnly:false,noWrite:false,noExecute:false,noRewrite:false});
  for(let t of parts){
   if(/^(?:说明|解释|区分|讨论|比较|判断|检查|分析|研究|示例|例如|原文|引用|我只读|之前|上一阶段|explain\b|describe\b|example\b|whether\b)/iu.test(t))continue;
   t=t.replace(/^先调查(?=不)/u,'');
   if(/^(?:只读(?:调查|分析|审查|检查|模式|任务|研究|[，,\s]|$)|(?:仅|只)(?:做)?(?:静态)?(?:调查|分析|审查|检查)(?:[，,\s]|不|$)|read[- ]?only(?:\b|$))/iu.test(t))Object.assign(out,{readOnly:true,noWrite:true,noExecute:true,noRewrite:true});
   if(denied(t,'(?:再|反复|重复)?(?:追问|提问|问我|发问)')||/^(?:不用|不必|无需)(?:再|反复|重复)?(?:问我问题|追问|提问)|^(?:do not|don\x27t|no)\s+(?:ask|questions|follow[- ]?up)/iu.test(t))out.noQuestions=true;
   if(denied(t,'(?:修改|写入|编辑|写)(?:任何|任何的|所有|这些|本地|生产)?(?:文件|代码|配置|数据|磁盘|目录)|(?:modify|write|edit)(?:\\s+(?:any|the))?\\s+(?:files?|code|anything)'))out.noWrite=true;
   if(/^(?:不做任何改动|禁止写入)$/u.test(t))out.noWrite=true;
   if(denied(t,'(?:执行|运行)(?:任何|所有|这些)?(?:测试|命令|脚本|代码|程序|工具|[。\\s]|$)|(?:execute|run)(?:\\s+(?:any|the))?\\s+(?:tests?|commands?|anything|scripts?|code)'))out.noExecute=true;
   if(denied(t,'(?:改写)(?:正文|原文|文稿|[。\\s]|$)|rewrite\\b'))out.noRewrite=true;
   if(/^(?:不要|不用|不需要|无需|不做|别用)[^。！？\n]{0,8}(?:最小(?:可用|可行)|MVP)|^(?:no|without|do not use)\s+(?:an?\s+)?mvp/iu.test(t))out.noMvp=true;
   if(/^(?:允许|采用|请用)[^。！？\n]{0,3}MVP/iu.test(t))out.noMvp=false;
   if(/^(?:(?:不要|不得|禁止|不允许|不)(?:删减|缩减)(?:已要求的功能|范围|需求|功能|$)|范围(?:已经|已)?固定|全部.{0,6}(?:必做|必须完成)|do not (?:reduce|shrink) (?:the )?scope)/iu.test(t))out.fixedScope=true;
  }
 }
 return out;
}
export function intentOf(input,methods=[]) {
 const {draft,context}=requestText(input);
 const authority=[dataFreeText(context),dataFreeText(draft)];
 const constraints={noQuestions:false,readOnly:false,noWrite:false,noExecute:false,noRewrite:false,noMvp:false,fixedScope:false,...operationConstraints(context),...operationConstraints(draft)};
 let signals=authority.join('\n');
 for(const m of methods)for(const s of new Set(methodTexts(m)))signals=signals.split(s).join(' ');
 // Negative clauses keep their authority but cannot create positive topic hits.
 signals=signals.replace(/(?:不(?:自行|擅自)|禁止|不得|不要)\s*(?:升级|更新)(?:依赖|项目版本)?/gu,' ');
 signals=signals.replace(/(^|[。！？；;，,\n])\s*(?:不要|不用|不必|无需|不需要|不做|别用|do not|don't|no\s)[^。！？；;，,\n]*/gi,'$1');
 return {...constraints,draft,context,authority:authority.join('\n'),signals:signals.trim()};
}
const EQUIVALENTS={
 cohesion:/高内聚.{0,5}低耦合|按职责.{0,12}模块.{0,28}(?:依赖方向|连锁影响)|职责.{0,12}(?:分离|独立).{0,30}(?:接口|依赖)|high cohesion.{0,8}low coupling/i,
 acceptance:/验收(?:标准|条件|判据)|完成标准|acceptance criteria/i,
 'root-cause':/定位根因|区分.{0,6}症状.{0,6}根因|root cause analysis/i,
 'primary-sources':/优先(?:核验|核对|阅读).{0,15}(?:原始|作者|源码)|primary sources/i,
 handoff:/交接.{0,30}(?:约束|原始入口).{0,30}(?:未测|未验证|证据)/,
};
// Comparison projections never replace the source used for permission/fidelity.
// Masked spans remain barriers so two instructions cannot join across a quote.
function comparison(text,mask=true,keepLines=false){
 const raw=String(text),masked=mask?raw.replace(/~~~[\s\S]*?~~~|```[\s\S]*?```|^\s*>.*$|`[^`\n]*`|“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"|(?<![A-Za-z])'[^']*'(?![A-Za-z])/gm,s=>'\u0000'.repeat(s.length)):raw;
 const layout=new Set();for(const match of masked.matchAll(/^[ \t]*(?:#{1,6}[ \t]+|[-*•][ \t]+|\d{1,2}[.)、][ \t]+)/gm))for(let i=match.index;i<match.index+match[0].length;i++)layout.add(i);
 const map=[],chars=[];for(let i=0;i<masked.length;i++)if(!layout.has(i)&&(!/\s/u.test(masked[i])||keepLines&&masked[i]==='\n')){map.push(i);chars.push(masked[i]);}
 return {raw,masked,text:chars.join(''),map};
}
const compact=s=>String(s).replace(/\s/gu,'');
function activeEvidence(view,start,end,{conditional=false,negative=false,action=false,allowedNegation=[]}={}){
 const from=view.map[start],to=view.map[end-1]+1;if(from===undefined||!Number.isFinite(to))return null;
 const matched=view.text.slice(start,end);
 if(matched.includes('\u0000'))return null;
 let polarityText=matched;for(const expression of allowedNegation)polarityText=polarityText.replace(new RegExp(expression,'giu'),' ');
 if(action&&!negative&&/不要|不得|禁止|不必|不用|无需|不需要|别|并未|未曾|没有|不以|不是|(?:不|未)(?:再|去|予以|主动)?对应|(?:不|未)(?:再|去|予以|主动)?(?:区分|组织|明确|记录|保存|建立|说明|指出|给出|提供|比较|减少|降低|核对|交接|保留|重跑)(?!的)|do\s*not|never/iu.test(polarityText))return null;
 const before=view.raw.slice(0,from),segment=before.slice(Math.max(before.lastIndexOf('。'),before.lastIndexOf('！'),before.lastIndexOf('？'),before.lastIndexOf('；'),before.lastIndexOf(';'))+1);
 // New lines delimit independent directives, but not a governing heading or
 // condition. Keep the original text; a projection cannot erase its authority.
 const lines=segment.split(/\r?\n/u),current=lines.pop(),carry=[];
 for(const line of lines){
  const h=line.replace(/^\s*(?:#{1,6}\s+|[-*•]\s+|\d+[.)、]\s*)/u,'').trim();
  if(!h){carry.length=0;continue;}
  if(/^(?:如果|假如|只有|除非|若|等到|if\b|unless\b|原文[:：]|引用[:：]|例如|示例|反例|过去|此前|之前|上一轮|上轮|曾经|已经完成|已完成)/iu.test(h)||/^(?:不要|不得|禁止|不必|无需|不需要|别|禁止事项|do not|never)[:：]?$/iu.test(h))carry.push(h);
 }
 const head=[...carry,current].join('\n');
 const after=view.raw.slice(to).split(/[。！？；;\n]/u,1)[0];
 if(/^(?:是什么意思|何意|的(?:意思|含义|定义))/u.test(after.trim())||/^(?:请)?(?:解释|讨论|比较|说明)[^。！？；;\n]{0,50}(?:含义|意思|术语|概念|以下|这句|这段|示例)[:：\s]*$/u.test(head.trim()))return null;
 if(/(?:通过|完成|验收)标准\s*[:：]?\s*\n\s*\n/u.test(view.raw.slice(from,to)))return null;
 // Finite guard: uncertainty never becomes evidence of full coverage.
 const clause=head.split(/[，,]/u).at(-1),sinceDirective=clause;
 if(/不要|不得|禁止|不必|不用|无需|不需要|别|尚未|并未|未曾|没有|不是|并非|不把|(?:不|未)(?:再|去|予以|主动|应当|应该|应|会|能|必)?$|do\s+not|don['’]t|never/iu.test(sinceDirective))return null;
 if(/^\s*(?:原文[:：]|引用[:：]|例如|示例|反例|过去|此前|之前|上一轮|上轮|曾经|已经完成|已完成)/u.test(head.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/u,''))&&!/(?:现在|接下来|本轮)/u.test(head))return null;
 if(!conditional&&/(?:如果|假如|只有|除非|若|等到|if\b|unless\b)/iu.test(head)&&!/(?:哪些|什么|怎样|如何)/u.test(head))return null;
 return {quote:view.raw.slice(from,to),start:from,end:to};
}
const coverageRules=new WeakMap();
const currentViews=new WeakMap();
function sourceViews(request){
 const draft=request.draft||'',context=request.explicitRequirements??request.context??'',cached=currentViews.get(request);
 if(cached?.draft===draft&&cached.context===context)return cached.blocks;
 const blocks=[{id:'draft',text:draft},{id:'requirements',text:context}].map(b=>({...b,...comparison(b.text),literal:comparison(b.text,false),lines:comparison(b.text,true,true)}));
 currentViews.set(request,{draft,context,blocks});return blocks;
}
export function coverageOf(method,input){
 const r=typeof input==='string'?{draft:input}:input||{},blocks=sourceViews(r);
 const evidence=[];
 // Standard/actual variant only; a different writing is not a proof of this one.
 for(const text of new Set([method.snippet,method.generic_snippet].filter(Boolean))){
  const needle=compact(text);for(const block of blocks){const view=block.literal;let at=view.text.indexOf(needle);while(at>=0){const e=activeEvidence(view,at,at+needle.length);if(e&&block.masked[e.start]!=='\u0000')return {state:'covered',evidence:[{blockId:block.id,...e}],missing:[],actions:[]};at=view.text.indexOf(needle,at+1);}}
 }
 const profile=method.coverage;if(!profile?.actions?.length)return {state:'unknown',evidence:[],missing:[],actions:[]};
 let rules=coverageRules.get(profile);if(!rules){rules=profile.actions.map(a=>({...a,compiled:a.patterns.map(p=>new RegExp(p,'giu')),notApplicableRules:(a.notApplicable||[]).map(p=>new RegExp(p,'giu'))}));coverageRules.set(profile,rules);}
 const actions=rules.map(action=>{
   for(const block of blocks)for(const view of [block,block.lines])for(const rule of action.compiled){rule.lastIndex=0;let m;while((m=rule.exec(view.text))){const e=activeEvidence(view,m.index,m.index+m[0].length,{...action,action:true});if(e)return {id:action.id,label:action.label,found:true,blockId:block.id,...e};if(!m[0])break;}}
  // Only a positive, bounded short-material instruction can make this
  // conditional step inapplicable; absence of an attachment never suffices.
  if(action.conditional&&!blocks.some(b=>/附件|文件|链接|网页|上文|长文|长篇/u.test(b.text)))for(const block of blocks)for(const rule of action.notApplicableRules){rule.lastIndex=0;const m=rule.exec(block.text);if(m){const e=activeEvidence(block,m.index,m.index+m[0].length,{action:true});if(e)return {id:action.id,label:action.label,found:true,notApplicable:true,blockId:block.id,...e};}}
  return {id:action.id,label:action.label,found:false};
 });
 let complete=actions.every(a=>a.found);
 for(const [first,last] of profile.order||[]){const a=actions.find(x=>x.id===first),b=actions.find(x=>x.id===last);if(a?.found&&b?.found&&(a.blockId!==b.blockId||a.start>b.start))complete=false;}
 return {state:complete?'covered':actions.some(a=>a.found)?'partial':'unknown',evidence:actions.filter(a=>a.found).map(({blockId,quote,start,end})=>({blockId,quote,start,end})),missing:actions.filter(a=>!a.found).map(a=>a.label),actions};
}
export function methodRestricted(method,input,methods=[],view) {
 const v=view||intentOf(input,methods),t=v.authority;
 if(!autoEligible(method))return true;
 const effects=method.effects||[];
 if(v.noQuestions&&effects.includes('ask'))return true;
 if((v.noWrite&&effects.includes('write'))||(v.noExecute&&effects.includes('execute'))||(v.noRewrite&&effects.includes('rewrite')))return true;
 if((v.noMvp||v.fixedScope)&&effects.includes('reduce-scope'))return true;
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 if([method.technical_name,method.id,...(method.search_terms||[])].filter(s=>s?.length>2).some(s=>new RegExp('(?:不要|不用|无需|不做|别用|不需要|不采用|不必)[^。！？\\n]{0,10}'+escape(s),'i').test(t)))return true;
 return false;
}
export function methodBlocked(method,input,methods=[]){
 const v=intentOf(input,methods);if(methodRestricted(method,input,methods,v))return true;
 const {draft,context}=requestText(input),t=[dataFreeText(context),dataFreeText(draft)].join('\n');
 if(coverageOf(method,input).state==='covered'||explicitlyNamed(method,t))return true;
 // Legacy named intent remains distinct from proof that every action is present.
 if(EQUIVALENTS[method.id]?.test(t))return true;
 return (typeof input==='object'?input?.selectedMethods:[])?.some(m=>m.id===method.id)??false;
}
