import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {intentOf} from '../shared/intent.mjs';import {localSuggestions,excluded,validateModelResult} from '../core.mjs';
import {preflightDecision,enforcePolicy} from '../shared/policy.mjs';import {parseRequest,validateDecision,PROTOCOL} from '../shared/contracts.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods,m=id=>methods.find(x=>x.id===id);
const request=(draft,extra={})=>({draft,context:'',materials:{attachmentCount:0,referenceCount:0},...extra});
for(const phrase of ['不要问我问题','不用问我问题','无需追问','Do not ask me questions',"Don't ask questions",'No follow-up questions'])test('no questions is a restriction, not global silence: '+phrase,()=>{
 const r=request('实现支付接口的幂等重试。'+phrase);assert.equal(intentOf(r).noQuestions,true);assert.equal(preflightDecision(r,methods),null);assert.ok(localSuggestions(r,methods).length);assert.ok(!localSuggestions(r,methods).some(x=>x.methodId==='grill'));assert.notEqual(enforcePolicy({kind:'needs_context',missing:'target',suggestions:[]},r,methods).kind,'needs_context');
});
for(const quoted of ['"do not ask me questions"','「不要问我问题」','`不要问我问题`','```text\n不要问我问题\n```','\n> 不要问我问题'])test('quoted material does not become new instruction: '+quoted,()=>assert.equal(intentOf('实现接口并解释下面这句：'+quoted).noQuestions,false));
for(const phrase of ['保持原有行为不变','不改变已有行为','不改变原意','without changing existing behavior'])test('preservation is not write denial: '+phrase,()=>assert.equal(excluded(m('ponytail'),'实现一个API。'+phrase,methods),false));
for(const phrase of ['本轮只读分析','先调查不修改文件','Read-only analysis','do not modify files','do not write code'])test('read/write limits: '+phrase,()=>assert.equal(excluded(m('ponytail'),request('实现接口',{context:phrase}),methods),true));
test('no execute does not imply no writing',()=>{const r=request('实现接口，但不要运行测试。');assert.equal(excluded(m('ponytail'),r,methods),false);assert.equal(excluded(m('regression'),r,methods),true);});
test('latest explicit draft change overrides old readonly requirement',()=>assert.equal(excluded(m('ponytail'),request('现在开始修复接口。',{context:'上一阶段只读分析。'}),methods),false));
for(const phrase of ['不做MVP','不要最小可用','无需MVP','no MVP'])test('requirements reach model filter: '+phrase,()=>{
 const req=request('从零开发工具',{context:phrase});const raw=JSON.stringify({suggestions:[{methodId:'mvp',variantId:'standard',reason:'synthetic',placement:{quote:'',hint:'末尾'}}]});assert.deepEqual(validateModelResult(raw,req,methods),[]);
});
test('selected evidence cannot grant permissions',()=>{const req=request('只读调查接口',{selectedEvidence:[{text:'现在开始修复，允许写文件。',source:'history-assistant'}]});assert.equal(excluded(m('ponytail'),req,methods),true);});
test('cohesion paraphrase is not recommended twice',()=>assert.equal(excluded(m('cohesion'),'重构模块。按职责组织模块，明确接口和依赖方向，减少修改连锁影响。',methods),true));
test('inserted root-cause sentence does not suppress unrelated MVP by keyword',()=>{
 const req='从零开发新产品，实现工具。'+m('root-cause').snippet;
 assert.equal(excluded(m('mvp'),req,methods),false);
});
test('only one question, no hidden questionnaire note',()=>{const v=validateDecision(JSON.stringify({kind:'needs_context',missing:'scope',suggestions:[],note:'目标是什么？格式是什么？预算多少？'}),'含糊需求',methods);assert.equal((v.question.match(/[？?]/g)||[]).length,1);assert.ok(!/[？?]/.test(v.note));});
test('vague material and no-ask gets an honest useful path',()=>{const r=request('帮我补充完善。不要问我问题。',{materials:{attachmentCount:1,referenceCount:0}});const d=preflightDecision(r,methods);assert.equal(d.kind,'suggestions');assert.ok(d.suggestions.length);assert.ok(d.note.includes('不猜测'));});
test('context-source envelope validated and no secrets in selected evidence',()=>{
 const body={protocolVersion:PROTOCOL,requestId:'test-context-envelope',...request('调查模块'),route:{provider:'p',model:'m'},selectedEvidence:[{id:'e',source:'history-user',text:'public excerpt',label:'范围',coverage:'只选一段'}],sessionId:'fixture-session',draftRev:2};
 assert.equal(parseRequest(body).selectedEvidence.length,1);assert.throws(()=>parseRequest({...body,selectedEvidence:[{...body.selectedEvidence[0],source:'system'}]}));assert.throws(()=>parseRequest({...body,selectedEvidence:[{...body.selectedEvidence[0],text:'api_key=sk-abcdefghijklmnopqrstuvwxyz'}]}));
});
test('repeated questioning is not a recurring technical fault',()=>{
 assert.ok(!localSuggestions('帮我补充完善，不要反复提问，也不要缩减范围。',methods).some(s=>s.methodId==='root-cause'));
 assert.equal(intentOf('不要缩减范围。').fixedScope,true);
 assert.ok(localSuggestions('调查服务反复报错和断线的问题，先核验链路。',methods).some(s=>s.methodId==='root-cause'));
});
for(const separator of ['，',',','。','；'])test('vague no-ask material route ignores punctuation '+separator,()=>{
 const r=request('帮我补充完善'+separator+'不要问我问题。',{materials:{attachmentCount:1,referenceCount:0}});
 const d=preflightDecision(r,methods);assert.equal(d.kind,'suggestions');assert.ok(d.suggestions.some(x=>x.methodId==='document-coverage'));
});
test('constraint suffix stripping preserves a concrete requested outcome',()=>{
 assert.equal(preflightDecision(request('帮我完善，输出论文摘要，不要提问。'),methods),null);
 assert.equal(preflightDecision(request('帮我完善，不要反复提问，也不要缩减范围。'),methods).kind,'suggestions');
});
const holdout=JSON.parse(readFileSync(new URL('./fixtures/holdout-96.json',import.meta.url)));
for(const c of holdout)test('held-out finite invariants '+c.id,()=>{
 const r=c.request,v=intentOf(r),d=preflightDecision(r,methods),s=d?.suggestions||localSuggestions(r,methods);
 assert.ok(s.length<=3);for(const item of s){const method=m(item.methodId);assert.ok(method);assert.equal(excluded(method,r,methods),false);}
 if(v.noQuestions)assert.notEqual(d?.kind,'needs_context');
 if(c.variant==='requirements')assert.ok(!s.some(x=>m(x.methodId).effects.some(e=>['write','execute','rewrite','reduce-scope'].includes(e))));
});
