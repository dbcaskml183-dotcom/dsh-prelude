import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {operationConstraints,intentOf} from '../shared/intent.mjs';
import {methodChoice,methodPairIssues,composeRequirements} from '../shared/method-selection.mjs';
import {enforcePolicy} from '../shared/policy.mjs';
import {excluded} from '../shared/method-policy.mjs';
import {parseAnalysis as parseWire,ANALYSIS_PROTOCOL} from '../shared/analysis-contracts.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {rewriteIssues} from '../shared/rewrite-contract.mjs';
import {createHandler} from '../host/service.mjs';
import {RewriteController} from '../client/rewrite-controller.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;
const m=id=>methods.find(x=>x.id===id),choice=(id,skills=[],variant='standard')=>methodChoice(m(id),variant,skills);
const base=(patch={})=>({protocolVersion:ANALYSIS_PROTOCOL,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:crypto.randomUUID(),draft:'请设计并实现一个本地订单管理工具。',explicitRequirements:'',materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[],route:{provider:'fixture',model:'synthetic'},...patch});
const parse=(v,opts={})=>parseWire(v,{methods,...opts});
for(const text of ['只读摘要','我只读摘要。','区分读过全文、只读摘要和未取得原文。','说明不运行测试的原因。','解释不修改代码的含义。','不要把有限检索称为穷尽。','若适合分期，先提出最小版本。','未经确认不删减已要求的功能。','如果是生产环境，不运行测试。','Explain why not to run tests.','例如：不运行测试。','「不要运行测试」只是引用。'])test('descriptive or conditional text is not a global operation ban: '+text,()=>{const v=operationConstraints(text);assert.ok(!v.noWrite&&!v.noExecute&&!v.fixedScope,text);});
for(const [text,key] of [['本轮只读分析','noWrite'],['只读调查订单接口','noExecute'],['仅静态审查，不运行测试。','noExecute'],['请不要修改文件。','noWrite'],['Do not write code.','noWrite'],['Do not run commands.','noExecute'],['Read-only analysis','noExecute'],['不要追问。','noQuestions'],['不要缩减范围。','fixedScope'],['不删减','fixedScope'],['禁止修改配置。','noWrite'],['Do not rewrite.','noRewrite'],['本轮只读分析。','noRewrite'],['请不要运行测试。','noExecute'],['Ｎｏ ＭＶＰ','noMvp']])test('explicit operation ban retains scope: '+text,()=>assert.equal(operationConstraints(text)[key],true));
for(const ids of [['scope','mvp'],['literature-protocol','tdd'],['literature-protocol','reproduce'],['literature-protocol','ponytail'],['literature-protocol','bounded-revision']])test('real reported pair composes in both orders '+ids.join('+'),()=>{for(const order of [ids,[...ids].reverse()]){const result=composeRequirements(base(),order.map(id=>choice(id)),methods);assert.equal(result.valid,true,result.issues.join(';'));assert.equal(result.included.length,2);}});
test('all actual standard and variant pairs avoid false task-level exclusions',()=>{
 const choices=methods.flatMap(method=>['standard',...(method.variants||[]).map(v=>v.id)].map(v=>methodChoice(method,v,[])));let pairs=0;
 for(let i=0;i<choices.length;i++)for(let j=i+1;j<choices.length;j++){
  if(choices[i].id===choices[j].id)continue;pairs++;
  assert.deepEqual(methodPairIssues([choices[i],choices[j]],methods),[],choices[i].id+'/'+choices[i].variant+'+'+choices[j].id+'/'+choices[j].variant);
 }
 assert.ok(pairs>=4005);
});
test('actual selected literature method cannot silently suppress TDD recommendation',()=>{
 const d={kind:'suggestions',suggestions:[{methodId:'tdd',variantId:'standard',reason:'需实现并验证',placement:{hint:'实现阶段',quote:''},decisionRequired:false}],note:'合成分析'};
 const req=base({selectedMethods:[choice('literature-protocol')]});assert.equal(intentOf(req).noExecute,false);assert.equal(enforcePolicy(d,req,methods).suggestions[0].methodId,'tdd');
});
test('real user bans continue to reject execution methods in source and manual fields',()=>{for(const req of [base({draft:'只读调查订单接口。'}),base({explicitRequirements:'不运行测试。'})]){assert.equal(excluded(m('tdd'),req,methods),true);assert.equal(composeRequirements(req,[choice('tdd')],methods).valid,false);}});
test('conditional method source remains protected without a blanket operation veto',()=>{const req=base({selectedMethods:[choice('mvp')]});assert.ok(rewriteIssues(req,req.draft+'\n未经确认可以删减已要求的功能。').length);});
test('unconditional synthetic opposing methods remain incompatible',()=>{const ms=[{id:'a',effects:[]},{id:'b',effects:['execute']}];assert.ok(methodPairIssues([{id:'a',label:'只读',text:'不运行测试。'},{id:'b',label:'执行',text:'运行测试。'}],ms).length);});
test('parser must receive trusted runtime catalogue for a nonempty selection',()=>{assert.throws(()=>parseWire(base({selectedMethods:[choice('reproduce')]})),{code:'INPUT'});assert.equal(parse(base({selectedMethods:[choice('reproduce')]})).selectedMethods.length,1);});
test('different runtime catalogue is authoritative rather than hidden bundled copy',()=>{const runtime=methods.map(x=>x.id==='reproduce'?{...x,snippet:'先保留现场，再使用新目录里的复现入口。',generic_snippet:'先保留现场，再使用新目录里的复现入口。'}:x);const c=methodChoice(runtime.find(x=>x.id==='reproduce'));assert.equal(parse(base({selectedMethods:[c]}),{methods:runtime}).selectedMethods[0].text,c.text);assert.throws(()=>parse(base({selectedMethods:[choice('reproduce')]}),{methods:runtime}),{code:'INPUT'});});
test('skill snapshots require actual callable availability; fallback remains exact',()=>{const specific=choice('ponytail',['ponytail']),fallback=choice('ponytail');assert.throws(()=>parse(base({selectedMethods:[specific]})),{code:'SKILL_UNAVAILABLE'});assert.equal(parse(base({selectedMethods:[specific]}),{availableSkills:['ponytail']}).selectedMethods[0].text,specific.text);assert.equal(parse(base({selectedMethods:[fallback]}),{availableSkills:['ponytail']}).selectedMethods[0].text,fallback.text);});
function fixture(skills){let calls=0,skillCalls=0,seen;const h=createHandler({methods,skills:async()=>{skillCalls++;return await skills();},budget:{reserve:()=>String(calls),settle(){},status:()=>({})},llm:{prepareCall:async config=>({config,async *stream(o){calls++;seen=JSON.parse(o.messages[0].content[0].text);const text=o.system.includes('辅助审校器')?JSON.stringify({verdict:'no_issue_found',findings:[],uncertainties:[]}):o.system.includes('文字编辑器')?JSON.stringify({kind:'unchanged',text:seen.draft,changes:[],uncertainties:[]}):JSON.stringify({kind:'uncertain',suggestions:[],note:'合成验证'});yield {type:'text-delta',text};yield {type:'usage',usage:{inputTokens:0,outputTokens:0}};yield {type:'finish',reason:{kind:'stop'}};}})}});return{h,calls:()=>calls,skillCalls:()=>skillCalls,seen:()=>seen};}
const post=(f,body,op='rewrite',signal)=>f.h.handle(new Request('http://synthetic/'+op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal}),{operation:op});
for(const op of ['suggest','rewrite','review'])for(const mode of ['missing','not-invocable','error'])test('service rejects unavailable specific skill before model '+op+'/'+mode,async()=>{
 const f=fixture(async()=>mode==='error'?Promise.reject(new Error('private internal detail')):mode==='not-invocable'?[{name:'ponytail',invocation:{modelInvocable:false}}]:[]);
 try{const r=await post(f,base({selectedMethods:[choice('ponytail',['ponytail'])],...(op==='review'?{candidate:'请设计并实现一个本地订单管理工具。'}:{})}),op),p=await r.json();assert.equal(r.status,400);assert.match(p.error,/技能暂不可确认/u);assert.equal(f.calls(),0);assert.ok(!p.error.includes('private'));}finally{f.h.dispose();}
});
test('generic fallback does not query a broken skill service or silently become specific',async()=>{const f=fixture(async()=>{throw Error('unavailable');});try{const fallback=choice('ponytail'),r=await post(f,base({selectedMethods:[fallback]}));assert.equal(r.status,200);assert.equal(f.skillCalls(),0);assert.equal(f.calls(),1);assert.equal(f.seen().selectedMethods[0].text,fallback.text);}finally{f.h.dispose();}});
test('specific skill succeeds when service confirms callable entry',async()=>{const f=fixture(async()=>[{name:'ponytail',invocation:{modelInvocable:true}}]);try{assert.equal((await post(f,base({selectedMethods:[choice('ponytail',['ponytail'])]}))).status,200);assert.equal(f.calls(),1);assert.equal(f.skillCalls(),1);}finally{f.h.dispose();}});
test('skill lookup is bounded; timeout never starts paid model work',async()=>{const f=fixture(()=>new Promise(resolve=>setTimeout(()=>resolve([]),1250)));try{const before=Date.now(),r=await post(f,base({selectedMethods:[choice('ponytail',['ponytail'])]}));assert.equal(r.status,400);assert.equal(f.calls(),0);assert.ok(Date.now()-before<2000);}finally{f.h.dispose();}});
test('cancel during skill lookup never dispatches a model request',async()=>{const f=fixture(()=>new Promise(resolve=>setTimeout(()=>resolve([{name:'ponytail'}]),60))),ac=new AbortController();try{const p=post(f,base({selectedMethods:[choice('ponytail',['ponytail'])]}),'rewrite',ac.signal);setTimeout(()=>ac.abort(),10);assert.equal((await p).status,400);assert.equal(f.calls(),0);}finally{f.h.dispose();}});
test('controller preserves selection and explains unavailable skill; explicit fallback can recover',async()=>{
 let calls=0;const input={draft:base().draft,draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},actions={},current={sessionId:'synthetic',input,actions,requestKey:'same'};
 const c=new RewriteController({methods,getSkills:()=>[],fetcher:async(_p,o)=>{calls++;const x=JSON.parse(o.body);return new Response(JSON.stringify({ok:true,protocolVersion:8,rulesHash:RULES_HASH,requestId:x.requestId,reviewMode:'manual',modelUsed:true,rewrite:{kind:'unchanged',text:x.draft,changes:[],uncertainties:[]},review:{state:'unchanged',findings:[],uncertainties:[]}}));}});
 try{const original=choice('ponytail',['ponytail']);assert.equal(await c.start(base({selectedMethods:[original]}),current),false);assert.match(c.state.message,/技能暂不可确认/u);assert.equal(calls,0);assert.equal(original.text,choice('ponytail',['ponytail']).text);await c.start(base({selectedMethods:[choice('ponytail')]}),current);assert.equal(calls,1);}finally{c.dispose();}
});
