import {RULES_HASH} from '../shared/guidance.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHandler} from '../host/service.mjs';import {UsageLedger} from '../host/usage-ledger.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;
const body=(extra={})=>({protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:'rewrite-'+crypto.randomUUID(),draft:'整理接口说明，区分输入和输出。',materials:{attachmentCount:0,referenceCount:0},route:{provider:'fixture',model:'synthetic'},...extra});
const req=(v,signal)=>new Request('http://fixture.local/api/prompt-coach/v4/rewrite',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(v),signal});
const packets={rewrite:{kind:'rewrite',text:'整理接口说明，区分输入和输出。\n用清楚的小节组织内容。',changes:['组织结构'],uncertainties:[]},suggest:{kind:'suggestions',suggestions:[{methodId:'evidence',variantId:'standard',reason:'核对证据。',increment:{sourceBlockId:'draft',sourceQuote:'整理接口说明',snippetQuote:methods.find(m=>m.id==='evidence').generic_snippet},placement:{hint:'末尾',quote:''}}]}};
const fake=check=>({prepareCall:async config=>({config,async *stream(options){check?.(options);yield {type:'text-delta',text:JSON.stringify(options.system.includes('文字编辑器')?packets.rewrite:packets.suggest)};yield {type:'usage',usage:{inputTokens:15,outputTokens:15}};yield {type:'finish',reason:{kind:'stop'}};}})});
async function fixture(fn){const d=mkdtempSync(join(tmpdir(),'prelude-rewrite-'));try{await fn(new UsageLedger(d));}finally{rmSync(d,{recursive:true,force:true});}}
test('rewrite is a separate result protocol over same native model and ledger',()=>fixture(async budget=>{let calls=0;const h=createHandler({methods,budget,llm:fake(o=>{calls++;assert.deepEqual(o.tools,[]);assert.equal(o.sessionId,undefined);assert.ok(JSON.parse(o.messages[0].content[0].text).protectedFragments);}),limits:{minIntervalMs:0}});const a=await h.handle(req(body()),{operation:'rewrite'});assert.equal(a.status,200);assert.equal((await a.json()).rewrite.kind,'rewrite');assert.equal(budget.status().calls,1);assert.equal(calls,1);h.dispose();}));
test('old suggestion path still returns decision, not rewrite',()=>fixture(async budget=>{const h=createHandler({methods,budget,llm:fake(),limits:{minIntervalMs:0}});const a=await h.handle(req(body()));const v=await a.json();assert.equal(a.status,200);assert.equal(v.decision.kind,'suggestions');assert.equal(v.rewrite,undefined);h.dispose();}));
for(const draft of ['继续','帮我补充完善','请逐字复制原文'])test('local rewrite preflight does not reserve a paid call '+draft,()=>fixture(async budget=>{const h=createHandler({methods,budget,llm:{prepareCall:()=>assert.fail('must not dispatch')}});const a=await h.handle(req(body({draft,materials:{attachmentCount:1,referenceCount:0}})),{operation:'rewrite'});assert.equal(a.status,200);assert.equal((await a.json()).modelUsed,false);assert.equal(budget.status().calls,0);h.dispose();}));
test('rewrite and suggestions share one execution lease',()=>fixture(async budget=>{let release,entered;const ready=new Promise(r=>entered=r),llm={prepareCall:()=>{entered();return new Promise(r=>release=r);}};const h=createHandler({methods,budget,llm,limits:{minIntervalMs:0}}),a=h.handle(req(body()),{operation:'rewrite'});await ready;assert.equal((await h.handle(req(body()))).status,429);release({config:{},async *stream(){yield {type:'text-delta',text:JSON.stringify(packets.rewrite)};yield {type:'finish',reason:{kind:'stop'}};}});assert.equal((await a).status,200);h.dispose();}));
test('host disposal aborts the new operation without waiting for provider cooperation',()=>fixture(async budget=>{let release,entered;const ready=new Promise(r=>entered=r),h=createHandler({methods,budget,llm:{prepareCall:()=>{entered();return new Promise(r=>release=r);}},limits:{minIntervalMs:0}});const a=h.handle(req(body()),{operation:'rewrite'});await ready;h.dispose();assert.equal((await a).status,503);release({config:{},async *stream(){}});}));
for(const kind of ['invalid','lost-constraint','empty'])test('bad rewrite is visible and does not bypass ledger '+kind,()=>fixture(async budget=>{const llm={prepareCall:async config=>({config,async *stream(){if(kind!=='empty')yield {type:'text-delta',text:kind==='invalid'?'CANARY provider text':JSON.stringify(packets.rewrite)};yield {type:'finish',reason:{kind:'stop'}};}})},h=createHandler({methods,budget,llm});const a=await h.handle(req(body({...(kind==='lost-constraint'?{explicitRequirements:'不要修改文件。'}:{})})),{operation:'rewrite'});assert.equal(a.status,kind==='lost-constraint'?200:503);const result=await a.json();if(kind==='lost-constraint'){assert.equal(result.review.state,'blocked');assert.ok(result.rewrite.text);}assert.ok(!JSON.stringify(result).includes('CANARY'));assert.equal(budget.status().calls,1);h.dispose();}));
test('existing corrupt ledger blocks rewrite before sending, without rebuilding it',()=>fixture(async budget=>{writeFileSync(budget.path,'broken');const h=createHandler({methods,budget,llm:fake(()=>assert.fail('must not stream'))});assert.equal((await h.handle(req(body()),{operation:'rewrite'})).status,503);assert.equal(readFileSync(budget.path,'utf8'),'broken');h.dispose();}));

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('047 generation close finishes before automatic review starts',()=>fixture(async budget=>{const closing=deferred(),startedClose=deferred();let calls=0;const h=createHandler({methods,budget,limits:{minIntervalMs:0},llm:{prepareCall:async config=>({config,stream(){const index=++calls;let step=0;return {[Symbol.asyncIterator](){return this;},next:async()=>step++===0?{done:false,value:{type:'text-delta',text:JSON.stringify(index===1?packets.rewrite:{verdict:'no_issue_found',findings:[],uncertainties:[]})}}:step===2?{done:false,value:{type:'finish',reason:{kind:'stop'}}}:{done:true},return(){if(index===1){startedClose.resolve();return closing.promise;}return Promise.resolve({done:true});}};}})}});const flight=h.handle(req(body({reviewMode:'auto'})),{operation:'rewrite'});await startedClose.promise;assert.equal(calls,1);assert.equal((await h.handle(req(body()),{operation:'rewrite'})).status,429);closing.resolve({done:true});const r=await flight;assert.equal(r.status,200);assert.equal((await r.json()).review.state,'no_issue_found');assert.equal(calls,2);h.dispose();}));
for(const sync of [false,true])test('047 failed close preserves candidate and refuses the automatic next stage '+sync,()=>fixture(async budget=>{let calls=0;const h=createHandler({methods,budget,limits:{minIntervalMs:0},llm:{prepareCall:async config=>({config,stream(){calls++;let step=0;return {[Symbol.asyncIterator](){return this;},next:async()=>step++===0?{done:false,value:{type:'text-delta',text:JSON.stringify(packets.rewrite)}}:step===2?{done:false,value:{type:'finish',reason:{kind:'stop'}}}:{done:true},return(){if(sync)throw Error('synthetic close');return Promise.reject(Error('synthetic close'));}};}})}});const r=await h.handle(req(body({reviewMode:'auto'})),{operation:'rewrite'}),v=await r.json();assert.equal(r.status,200);assert.equal(v.rewrite.text,packets.rewrite.text);assert.equal(v.review.state,'failed');assert.ok(v.reviewError.includes('收尾'));assert.equal(calls,1);h.dispose();}));
test('047 cancelled response retains lease until queued iterator cleanup settles',()=>fixture(async budget=>{const enter=deferred(),yieldNext=deferred(),closeEnter=deferred(),closeDone=deferred();let calls=0;const h=createHandler({methods,budget,limits:{minIntervalMs:0},llm:{prepareCall:async config=>({config,async *stream(){calls++;try{enter.resolve();await yieldNext.promise;yield {type:'text-delta',text:'cancelled'};}finally{closeEnter.resolve();await closeDone.promise;}}})}});const ac=new AbortController(),flight=h.handle(req(body(),ac.signal),{operation:'rewrite'});await enter.promise;ac.abort();assert.equal((await flight).status,503);yieldNext.resolve();await closeEnter.promise;await new Promise(r=>setTimeout(r,0));const status=await(await h.handle(new Request('http://synthetic.invalid/status'))).json();assert.equal(status.busy,true);assert.equal((await h.handle(req(body()),{operation:'rewrite'})).status,429);assert.equal(calls,1);closeDone.resolve();await new Promise(r=>setTimeout(r,0));assert.equal((await(await h.handle(new Request('http://synthetic.invalid/status'))).json()).busy,false);h.dispose();}));

test('busy takes priority over repeat timing; rejected attempts never start another model call',()=>fixture(async budget=>{
 const entered=deferred(), finish=deferred();
 let clock=10000, calls=0;
 const llm={prepareCall:async config=>{
  calls++;
  entered.resolve();
  await finish.promise;
  return fake().prepareCall(config);
 }};
 const handler=createHandler({methods,budget,llm,now:()=>clock,limits:{minIntervalMs:2000}});
 const send=()=>handler.handle(req(body()),{operation:'rewrite'});
 try{
  const first=send();
  await entered.promise;
  const busy=await send();
  assert.equal(busy.status,429);
  assert.match((await busy.json()).error,/正在执行或收尾/);
  finish.resolve();
  assert.equal((await first).status,200);
  const repeat=await send();
  assert.equal(repeat.status,429);
  assert.match((await repeat.json()).error,/相同操作/);
  assert.equal(calls,1);
  assert.equal(budget.status().calls,1);
  clock+=2000;
  assert.equal((await send()).status,200);
  assert.equal(calls,2);
 }finally{finish.resolve();handler.dispose();}
}));
