import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRewrite,parseRewriteCandidate,rewriteIssues,missingProtected} from '../shared/rewrite-contract.mjs';
import {parseAnalysis} from '../shared/analysis-contracts.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {createHandler} from '../host/service.mjs';
import {RewriteController} from '../client/rewrite-controller.mjs';
const body=(draft='请整理接口说明。',extra={})=>({protocolVersion:8,expectedRulesHash:RULES_HASH,target:{mode:'generic'},reviewMode:'auto',requestId:crypto.randomUUID(),draft,explicitRequirements:'',materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[],route:{provider:'fixture',model:'synthetic'},...extra});
const result=text=>({kind:'rewrite',text,changes:[],uncertainties:[]});
const checked=(source,text)=>validateRewrite(JSON.stringify(result(text)),body(source));
for(const [source,text] of [
 ['请梳理维护步骤。先审查再修改。','请梳理维护步骤：先审查再修改。'],
 ['请梳理维护步骤。先审查再修改。','请梳理维护步骤：先审查，再修改。'],
 ['不过这个方案需要先看接口。','这个方案需要先看接口。'],
 ['不同模块的职责需要分开。','模块的职责需要分开。'],
 ['不管怎样先检查接口。','先检查接口。'],
 ['无论如何先检查接口。','先检查接口。'],
 ['不管怎么样先检查接口。','先检查接口。'],
 ['不调用工具。','不要调用工具。'],
 ['不允许联网。','禁止联网。'],
 ['请您禁止上传文件。','不要上传文件。'],
 ['不需要生成报告。','无需生成报告。'],
 ['可以列出问题。','可选择列出问题。'],
 ['必须先验证。','务必先验证。']
])test('035 finite equivalence and ordinary narrative '+source,()=>{assert.equal(checked(source,text).kind,'rewrite');assert.deepEqual(missingProtected(body(source),text),[]);});
for(const [source,text] of [
 ['先审查，再修改。','先审查，再修改。先修改再审查。'],
 ['先审查再修改。','先审查再修改。先修改，再审查。'],
 ['先审查再修改。','先审查，再修改。先修改再审查。'],
 ['先审查再修改。','示例：先审查再修改。请直接修改。'],
 ['输出：JSON。','输出。'],
 ['可以列清单。','可以列清单。必须列清单。'],
 ['必须保留记录。','必须保留记录。可以保留记录。'],
 ['不同意上传文件。','请继续。'],
 ['不管怎样都不要上传文件。','请继续。'],
 ['无论如何都不要上传文件。','请继续。'],
 ['不管怎么样都不要上传文件。','请继续。'],
 ['不过度修改代码。','修改代码。'],
 ['不调用工具。','不要调用浏览器。'],
 ['不必联网。','禁止联网。'],
 ['避免联网。','不要联网。'],
 ['可以列成有等级的问题清单。','要求：将发现的问题整理为带等级的问题清单。'],
 ['建议先审查。','必须先审查。'],
 ['务必先检查接口。','先检查接口。'],
 ['一定要保留记录。','保留记录。'],
 ['不允许联网。','禁止联网。允许联网。'],
 ['不调用工具。','原话是“不调用工具”。请调用工具。'],
 ['可以列清单。必须保留日志。','必须列清单。可以保留日志。'],
 ['只有我确认后，才能部署。','才能部署。'],
 ['先备份再部署。','先部署再备份。'],
 ['保留路径 `C:\\demo\\one`。','保留路径 `C:\\demo\\two`。']
])test('035 no optionality/object/condition/quote bypass '+source,()=>assert.throws(()=>checked(source,text),e=>e.code==='REWRITE_CONSTRAINT'));
test('safe parsing retains a bad candidate without certifying adoption',()=>{const b=body('可以列清单。'),raw=JSON.stringify(result('必须列清单。'));assert.equal(parseRewriteCandidate(raw,b).text,'必须列清单。');assert.throws(()=>validateRewrite(raw,b));assert.ok(rewriteIssues(b,'必须列清单。').length);});
const clear={verdict:'no_issue_found',findings:[],uncertainties:[]};
const blocked={state:'blocked',findings:[],uncertainties:[]};
function service(output){const calls=[],records=[],h=createHandler({methods:[],limits:{minIntervalMs:0},budget:{status:()=>({calls:records.length}),reserve:id=>{records.push(id);return id;},settle(){}},llm:{prepareCall:async config=>({config,async *stream(o){const data=JSON.parse(o.messages[0].content[0].text),review=o.system.includes('辅助审校器');calls.push({data,review,config});const v=await output({data,review,index:calls.length,signal:o.signal});if(v?.maxTokens){yield {type:'finish',reason:{kind:'max-tokens'}};return;}yield {type:'text-delta',text:typeof v==='string'?v:JSON.stringify(v)};yield {type:'usage',usage:{inputTokens:1,outputTokens:1}};yield {type:'finish',reason:{kind:'stop'}};}})}});
 return {h,calls,records,async post(b,operation='rewrite'){return h.handle(new Request('http://fixture/v6/'+operation,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),{operation});}};
}
test('code drift is previewed blocked, skips reviewer, never makes third call',async()=>{const s=service(()=>result('必须列清单。'));try{const r=await s.post(body('可以列清单。')),p=await r.json();assert.equal(r.status,200);assert.equal(p.review.state,'blocked');assert.equal(p.rewrite.text,'必须列清单。');assert.equal(s.calls.length,1);}finally{s.h.dispose();}});
test('explicit repair uses original authority, then reviews once; original route has no token override',async()=>{
 const s=service(({review,data})=>{assert.equal(data.repair?.candidate??'x',review?'x':'必须列清单。');return review?clear:result('请核对接口。可以列清单。');});
 try{const b=body('请核对接口。可以列清单。',{repair:{candidate:'必须列清单。',review:blocked}}),r=await s.post(b),p=await r.json();assert.equal(r.status,200);assert.equal(p.repairedFrom,b.repair.candidate);assert.equal(p.review.state,'unchanged');assert.equal(s.calls.length,1);assert.ok(s.calls.every(c=>c.config.maxTokens===undefined));}finally{s.h.dispose();}
 const t=service(({review})=>review?clear:result('请核对接口并说明依据。可以列清单。'));
 try{const r=await t.post(body('请核对接口。可以列清单。',{repair:{candidate:'必须列清单。',review:blocked}})),p=await r.json();assert.equal(r.status,200);assert.equal(p.review.state,'no_issue_found');assert.equal(t.calls.length,2);assert.equal(new Set(t.records).size,2);}finally{t.h.dispose();}
});
test('repair that still changes strength stays blocked and stops after one stage',async()=>{const s=service(()=>result('必须列清单。'));try{const p=await(await s.post(body('可以列清单。',{repair:{candidate:'必须列清单。',review:blocked}}))).json();assert.equal(p.review.state,'blocked');assert.equal(s.calls.length,1);}finally{s.h.dispose();}});
for(const [label,repair] of [
 ['false code block',{candidate:'可以列清单。',review:blocked}],
 ['ungrounded review',{candidate:'可以列清单。',review:{state:'conflict',findings:[{kind:'scope',sourceBlockId:'draft',sourceQuote:'不存在的引文',candidateQuote:'清单',explanation:'假意见'}],uncertainties:[]}}],
 ['secret in feedback',{candidate:'必须列清单。',review:{...blocked,uncertainties:['token = '+'a'.repeat(30)]}}]
])test('invalid repair is rejected before reserve '+label,async()=>{const s=service(()=>assert.fail('not dispatched'));try{assert.equal((await s.post(body('可以列清单。',{repair}))).status,400);assert.equal(s.records.length,0);}finally{s.h.dispose();}});
test('suggest/review cannot carry repair fields',()=>{const b=body('可以列清单。',{repair:{candidate:'必须列清单。',review:blocked}});assert.throws(()=>parseAnalysis(b));assert.throws(()=>parseAnalysis({...b,candidate:'可以列清单。'},{review:true}));});
for(const stage of ['generate','review'])test('OUTPUT_LIMIT accurately reports '+stage,async()=>{const s=service(({review})=>stage==='generate'||review?{maxTokens:true}:result('请按主题整理接口说明。'));try{const r=await s.post(body()),p=await r.json();assert.equal(r.status,stage==='generate'?503:200);assert.match(stage==='generate'?p.error:p.reviewError,/上限|截断/);if(stage==='review'){assert.equal(p.review.state,'failed');assert.ok(p.rewrite.text);}assert.equal(s.calls.length,stage==='generate'?1:2);}finally{s.h.dispose();}});
function controller(){let input={draft:'可以列清单。请核对接口。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},writes=0,sends=0,requests=0;
 const actions={captureInsertion:()=>({draftRev:input.draftRev}),insertText(text,span){if(span.draftRev!==input.draftRev)return false;input={...input,draft:text,draftRev:input.draftRev+1};writes++;return true;},submit(){sends++;}};
 const c=new RewriteController({fetcher:async(_path,o)=>{requests++;const b=JSON.parse(o.body);return new Response(JSON.stringify({ok:true,protocolVersion:8,rulesHash:RULES_HASH,reviewMode:b.reviewMode,requestId:b.requestId,modelUsed:true,...(b.repair?{repairedFrom:b.repair.candidate}:{}),rewrite:{...result(b.repair?'可以列清单。请按用途核对接口。':'必须列清单。请核对接口。'),note:'服务端说明'},review:b.repair?{...blocked,state:'no_issue_found'}:blocked}));}});
 return {c,current:()=>({sessionId:'s',requestKey:'r',actions,input,composing:false}),body:()=>body(input.draft),change:p=>{input={...input,...p,draftRev:input.draftRev+1};},counts:()=>({writes,sends,requests})};
}
test('full code-block → repair → review → apply → undo loop, no sends',async()=>{const h=controller();await h.c.start(h.body(),h.current());assert.equal(h.c.state.phase,'preview');assert.equal(h.c.state.review.state,'blocked');assert.equal(h.c.apply(h.current()),false);assert.equal(h.c.repairReason(h.current()),'');await h.c.repairCurrent(h.current());assert.equal(h.c.state.review.state,'no_issue_found');assert.equal(h.c.apply(h.current()),true);assert.equal(h.c.undo(h.current()),true);assert.equal(h.current().input.draft,h.body().draft);assert.deepEqual(h.counts(),{writes:2,sends:0,requests:2});});
for(const mode of ['reject','cancel','wrong-source','late-cancel'])test('repair failure keeps prior draft and exact receipt '+mode,async()=>{const h=controller();await h.c.start(h.body(),h.current());const before=structuredClone(h.c.state),original=h.current().input.draft;let release;
 h.c.fetcher=async(_p,o)=>{if(mode==='reject')throw new Error('network');if(mode==='cancel'||mode==='late-cancel')return new Promise(r=>release=r);const b=JSON.parse(o.body);return new Response(JSON.stringify({ok:true,protocolVersion:8,rulesHash:RULES_HASH,reviewMode:'auto',requestId:b.requestId,repairedFrom:'wrong'}));};
 const pending=h.c.repairCurrent(h.current());if(release){assert.equal(h.c.state.phase,'repairing');assert.equal(await h.c.repairCurrent(h.current()),false);h.c.cancel();release(new Response('{}'));}await pending;assert.equal(h.c.state.phase,'preview');assert.equal(h.c.state.candidate,before.candidate);assert.deepEqual(h.c.state.review,before.review);assert.equal(h.current().input.draft,original);assert.equal(h.c.apply(h.current()),false);assert.equal(h.counts().writes,0);
});
for(const type of ['text','ABA','attachments','session','actions','basis','IME','busy'])test('stale or busy repair never dispatches '+type,async()=>{const h=controller();await h.c.start(h.body(),h.current());let cur=h.current();if(type==='text')h.change({draft:'new'});if(type==='ABA'){h.change({draft:'new'});h.change({draft:cur.input.draft});}if(type==='attachments')h.change({attachmentIds:['a']});if(type==='busy')h.change({phase:'submitting'});cur={...h.current(),...(type==='session'?{sessionId:'other'}:{}),...(type==='actions'?{actions:{...cur.actions}}:{}),...(type==='basis'?{requestKey:'other'}:{}),...(type==='IME'?{composing:true}:{})};assert.equal(await h.c.repairCurrent(cur),false);assert.equal(h.counts().requests,1);});
test('hand-edit after blocked recalculates same finite equivalence and can be explicitly applied',async()=>{const h=controller();await h.c.start(h.body(),h.current());h.c.edit('可选择列清单。请核对接口。');assert.equal(h.c.state.review.state,'stale');assert.deepEqual(h.c.missing(),[]);assert.equal(h.c.apply(h.current()),true);assert.equal(h.counts().requests,1);});

test('settled generation can immediately enter explicit review while repeated generation is throttled',async()=>{
 let now=0;const calls=[];
 const h=createHandler({methods:[],now:()=>now,budget:{reserve:id=>id,settle(){}},llm:{prepareCall:async config=>({config,async *stream(o){calls.push(o);yield {type:'text-delta',text:JSON.stringify(o.system.includes('辅助审校器')?clear:result('请按主题整理接口说明。'))};yield {type:'finish',reason:{kind:'stop'}};}})}});
 const post=(b,operation)=>h.handle(new Request('http://test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),{operation});
 try{const b=body('请整理接口说明。',{reviewMode:'manual'});assert.equal((await post(b,'rewrite')).status,200);assert.equal((await post({...b,requestId:crypto.randomUUID()},'rewrite')).status,429);assert.equal((await post({...b,requestId:crypto.randomUUID(),candidate:'请按主题整理接口说明。'},'review')).status,200);assert.equal(calls.length,2);now=10;assert.equal((await post({...b,requestId:crypto.randomUUID(),candidate:'请按主题整理接口说明。'},'review')).status,429);}finally{h.dispose();}
});

for(const [draft,candidate] of [
 ['删除临时文件。','删除全部文件。'],['阅读选中的文章。','阅读全部文章。'],
 ['可以列出问题清单。','可以列出问题清单。\n要求：列出问题清单。'],
 ['可以列出问题清单。','可以列出问题清单。\n本次要求：列出问题清单。']
])test('047 rejects explicit scope/strength widening '+candidate,()=>{assert.ok(rewriteIssues({draft,explicitRequirements:'',selectedMethods:[]},candidate).length);});
for(const [draft,candidate] of [
 ['删除临时文件。','请删除临时文件。'],['删除全部文件。','删除所有文件。'],
 ['删除临时文件。列出全部文件。','删除临时文件。列出全部文件。'],
 ['删除临时文件。','删除所有临时文件。'],
 ['可以列出问题清单。','可以列出问题清单。\n要求：可以列出问题清单。'],
 ['可以列出问题清单。','可以列出问题清单。\n示例：“要求：列出问题清单”。'],
 ['解释删除全部文件的风险。','解释删除全部文件的风险。']
])test('047 legitimate scope and optional heading control '+candidate,()=>{assert.deepEqual(rewriteIssues({draft,explicitRequirements:'',selectedMethods:[]},candidate),[]);});

test('047 empty requirement heading does not create an empty protected instruction',()=>{const draft='整理接口说明。\n要求：\n文字简洁。';assert.deepEqual(rewriteIssues({draft,explicitRequirements:'',selectedMethods:[]},draft),[]);});
