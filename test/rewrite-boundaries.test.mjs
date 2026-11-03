import test from 'node:test';import assert from 'node:assert/strict';
import {RewriteController} from '../client/rewrite-controller.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {editorPolicyReason} from '../shared/editor-policy.mjs';
import {validateRewrite,protectedFragments} from '../shared/rewrite-contract.mjs';
const draftRequest=draft=>({protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:'boundary-'+crypto.randomUUID(),draft,explicitRequirements:'',materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[],route:{provider:'fixture',model:'synthetic'}});
const payload=text=>JSON.stringify({kind:'rewrite',text,changes:[],uncertainties:[]});
function fixture(draft='请整理接口说明。',candidate=draft+'\n按用途分段。',mode='manual',reviewState){
 let input={draft,draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},writes=0,calls=0;
 const actions={captureInsertion:()=>({start:0,end:0,draftRev:input.draftRev}),insertText(text,span){if(span.draftRev!==input.draftRev)return false;input={...input,draft:text,draftRev:input.draftRev+1};writes++;return true;}};
 const current=()=>({sessionId:'fixture',input,actions,requestKey:'fixture',composing:false});
 const req={...draftRequest(draft),reviewMode:mode};
 const c=new RewriteController({fetcher:async(_p,o)=>{calls++;const r=JSON.parse(o.body);return new Response(JSON.stringify({ok:true,protocolVersion:8,requestId:r.requestId,rulesHash:RULES_HASH,reviewMode:r.reviewMode,modelUsed:true,review:{state:reviewState||(candidate===draft?'unchanged':mode==='auto'?'no_issue_found':'not_requested'),findings:[],uncertainties:[]},rewrite:{kind:candidate===draft?'unchanged':'rewrite',text:candidate,changes:[],uncertainties:[]}}));}});
 return {c,req,current,counts:()=>({writes,calls}),editOriginal:next=>input={...input,draft:next,draftRev:input.draftRev+1}};
}
for(const text of ['/clear','  /clear','\n/cmd','//','\u200b/clear','@file','请读 @file'])test('R1 generated candidate is copy-only '+JSON.stringify(text),async()=>{
 const h=fixture(undefined,text);await h.c.start(h.req,h.current());assert.equal(h.c.state.phase,'preview');assert.notEqual(h.c.applyReason(h.current()),'');assert.equal(h.c.apply(h.current()),false);assert.equal(h.counts().writes,0);h.c.dispose();
});
for(const text of ['/clear','@file','\u001b[31mtext'])test('R1 hand edit cannot bypass editor admission '+JSON.stringify(text),async()=>{const h=fixture();await h.c.start(h.req,h.current());h.c.edit(text);assert.equal(h.c.apply(h.current()),false);assert.equal(h.counts().writes,0);h.c.dispose();});
for(const text of ['联系 a@example.com','/root/project/main.mjs','`@file`是一个例子。','```sh\n/clear\n```','普通中文 😀 English','https://example.com/@name'])test('R1 normal text remains usable '+text,async()=>{assert.equal(editorPolicyReason(text),'');const h=fixture(undefined,text);await h.c.start(h.req,h.current());assert.equal(h.c.apply(h.current()),true);assert.equal(h.c.undo(h.current()),true);assert.equal(h.current().input.draft,h.req.draft);assert.equal(h.counts().writes,2);h.c.dispose();});
for(const [source,extra] of [
 ['不允许访问外部网络，只输出JSON。','允许访问外部网络。'],
 ['请不要授权访问网络。','授权访问网络。'],
 ['不得批准上传文件。','批准上传文件。'],
 ['Do not allow network access.','Allow network access.'],
 ['Do not authorize external access.','Authorize external access.'],
 ['不要联网。','可以联网。'],
 ['只调查，不修改。','允许修改。'],
 ['不允许联网。','不修改文件但允许联网。'],
 ['不允许联网。','在不修改文件的前提下允许联网。']
])test('R2 opposite/additional grant rejected '+extra,()=>assert.throws(()=>validateRewrite(payload(source+extra),draftRequest(source)),e=>e.code==='REWRITE_CONSTRAINT'));
test('R2 hand-edit adoption shares generation hard checks',async()=>{const s='不允许访问外部网络，只输出JSON。',h=fixture(s,s);await h.c.start(h.req,h.current());h.c.edit(s+'允许访问外部网络。');assert.equal(h.c.apply(h.current()),false);assert.equal(h.counts().writes,0);h.c.dispose();});
for(const s of ['允许访问测试网络。','不允许访问外部网络。','检查是否允许发布这个版本。','Do not allow network access.','“允许联网”只是一个坏例子。','修复 allowlist 解析器。'])test('R2 unchanged text remains valid '+s,()=>assert.equal(validateRewrite(payload(s),draftRequest(s)).kind,'unchanged'));
for(const mode of ['manual','auto'])for(const draft of ['帮我处理一下','优化这个附件','把附件里的内容处理好。'])test('R4 local clarification needs zero calls '+mode+draft,async()=>{const h=fixture(draft,'unused',mode);await h.c.start(h.req,h.current());assert.equal(h.c.state.phase,'needs_context');assert.match(h.c.state.message,/目标|补充/);assert.deepEqual(h.counts(),{writes:0,calls:0});h.c.dispose();});
for(const state of ['not_requested','unchanged'])test('changed auto candidate cannot forge review '+state,async()=>{const h=fixture(undefined,undefined,'auto',state);await h.c.start(h.req,h.current());assert.equal(h.c.state.phase,'error');assert.equal(h.c.apply(h.current()),false);h.c.dispose();});
test('unchanged auto has no review stage and preserves draft',async()=>{const s='请整理接口说明。',h=fixture(s,s,'auto');await h.c.start(h.req,h.current());assert.equal(h.c.state.review.state,'unchanged');assert.equal(h.c.apply(h.current()),false);assert.equal(h.counts().calls,1);h.c.dispose();});
const prose='插件更新了，请全面细致审查，看看是否还有产品不合格导致不允许上线GitHub的问题，有的话整理为报告。';
test('descriptive 不允许 no longer locks the prose paragraph',()=>{assert.ok(!protectedFragments(draftRequest(prose)).some(x=>x.includes('不允许上线')));assert.equal(validateRewrite(payload('请全面细致审查更新后的插件，检查是否存在影响GitHub发布的问题；如有，请整理报告。'),draftRequest(prose)).kind,'rewrite');});
for(const s of ['不要修改文件。','只调查，不修改文件。','本轮请不要重启。','必须保留业务数据。','输出JSON。','请面向新手解释。'])test('true explicit constraint still cannot disappear '+s,()=>assert.throws(()=>validateRewrite(payload('请继续。'),draftRequest(s)),e=>e.code==='REWRITE_CONSTRAINT'));
for(const s of ['保留函数名`createClient`，重写接口说明。','说明“不要删除”是坏例子，只调查。'])test('protected text remains a real source slice '+s,()=>assert.ok(protectedFragments(draftRequest(s)).every(x=>s.includes(x))));
test('repeat closed loop does not restore a stale transaction',async()=>{const h=fixture();for(let i=0;i<3;i++){await h.c.start(h.req,h.current());assert.equal(h.c.apply(h.current()),true);assert.equal(h.c.undo(h.current()),true);h.c.dismiss();}assert.equal(h.counts().writes,6);h.c.dispose();});
test('ABA edits remain protected after contract refactor',async()=>{const h=fixture();await h.c.start(h.req,h.current());h.editOriginal('别的草稿');h.editOriginal(h.req.draft);assert.equal(h.c.apply(h.current()),false);assert.equal(h.counts().writes,0);h.c.dispose();});

for(const extra of ['允\u200b许联网。','Ａｌｌｏｗ network access.','不需要停机就允许联网。','没有风险允许联网。'])test('permission obfuscation/scope cannot add grant '+extra,()=>assert.throws(()=>validateRewrite(payload('不允许联网。'+extra),draftRequest('不允许联网。')),e=>e.code==='REWRITE_CONSTRAINT'));
test('bare Windows path does not freeze following ordinary prose',()=>{const s='请检查 C:\\work\\main.mjs，分析是否有不允许上线的问题。',r=draftRequest(s);assert.ok(!protectedFragments(r).some(x=>x.includes('不允许上线')));assert.equal(validateRewrite(payload('请审查 C:\\work\\main.mjs，找出影响发布的问题。'),r).kind,'rewrite');});
test('quoted Windows paths with spaces remain exact',()=>{const s='请审查“C:\\Program Files\\Demo\\main.mjs”。';assert.ok(protectedFragments(draftRequest(s)).some(x=>x.includes('Program Files')));assert.throws(()=>validateRewrite(payload('请审查“C:\\Program Files\\Other\\main.mjs”。'),draftRequest(s)));});

for(const [source,extra] of [['预算¥5。','预算¥50。'],['最多3次。','最多30次。'],['只输出JSON。','输出Markdown。'],['返回中文表格。','输出英文JSON。']])test('copied constraint cannot mask a contradictory appended contract '+extra,()=>assert.throws(()=>validateRewrite(payload(source+extra),draftRequest(source)),e=>e.code==='REWRITE_CONSTRAINT'));
for(const s of ['预算¥5。','最多3次。','只输出JSON。','返回中文表格。'])test('explicit contract unchanged remains accepted '+s,()=>assert.equal(validateRewrite(payload(s),draftRequest(s)).kind,'unchanged'));

for(const [source,extra] of [['预算$5。','预算¥5。'],['预算5次。','预算5元。'],['输出：JSON。','返回：YAML。'],['Return JSON.','Return YAML.']])test('bound/format coordinates retain currency, unit and colon semantics '+extra,()=>assert.throws(()=>validateRewrite(payload(source+extra),draftRequest(source)),e=>e.code==='REWRITE_CONSTRAINT'));
test('equivalent time bound does not become an invented larger limit',()=>{const source='最多1小时。';assert.equal(validateRewrite(payload(source+'最多60分钟。'),draftRequest(source)).kind,'rewrite');});
test('input JSON is not automatically an output-format contract',()=>{const source='把JSON转换为YAML，保留所有键。';assert.equal(validateRewrite(payload(source+'按用途分段。'),draftRequest(source)).kind,'rewrite');assert.throws(()=>validateRewrite(payload(source+'输出JSON。'),draftRequest(source)));});

import {createHandler} from '../host/service.mjs';

for(const [source,candidate] of [['不允许联网。','不允许联网。允许联网。'],['预算¥5。','预算¥5。预算¥50。'],['只输出JSON。','只输出JSON。输出Markdown。']])test('review input contract failure is HTTP400 and cannot touch LLM or ledger '+candidate,async()=>{const h=createHandler({methods:[],llm:{prepareCall(){assert.fail('bad candidate dispatched to model');}},budget:{reserve(){assert.fail('bad candidate charged');},settle(){assert.fail('unexpected settlement');}}});try{const response=await h.handle(new Request('http://fixture/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...draftRequest(source),candidate})}),{operation:'review'});assert.equal(response.status,400);}finally{h.dispose();}});
