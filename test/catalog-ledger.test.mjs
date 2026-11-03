import {RULES_HASH} from '../shared/guidance.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {localSuggestions,excluded,searchMethods,safeSnippet,validateModelResult,insertSafely} from '../core.mjs';
import {UsageLedger,makeSystem,boundedBody,createHandler,LIMIT} from '../server-core.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;
const by=id=>methods.find(m=>m.id===id);
const fixture=f=>{const p=mkdtempSync(join(tmpdir(),'prompt-coach-test-'));try{return f(p);}finally{rmSync(p,{recursive:true,force:true});}};
const wire=(suggestions)=>JSON.stringify({suggestions});
const row=(id,quote='',basis=quote||'调查')=>({methodId:id,variantId:'standard',reason:'该任务涉及实际验证',increment:{sourceBlockId:'draft',sourceQuote:basis,snippetQuote:by(id)?.generic_snippet||'合成占位动作'},placement:{hint:'实施要求处',quote},decisionRequired:false});
test('90 distinct complete methods, source refs real',()=>{assert.equal(methods.length,90);assert.equal(new Set(methods.map(m=>m.id)).size,90);const s=JSON.parse(readFileSync(new URL('../sources.json',import.meta.url)));for(const m of methods){for(const key of ['label','technical_name','plain_explanation','when_to_suggest','when_not_to_suggest','snippet','placement_hint'])assert.ok(m[key],m.id+key);for(const id of m.reference_sources)assert.ok(s.sources.some(s=>s.id===id));}});
for(const t of ['继续','照上面做','你好','谢谢','什么是第一性原理？','翻译这个句子：hello world','请输出JSON，包含结果和证据，按这些验收标准完成。'])test('no forced suggestions: '+t,()=>assert.deepEqual(localSuggestions(t,methods),[]));
test('readonly excludes implementation and cleanup',()=>{const t='只读调查插件为什么失败，不改配置，不执行修复，最后列证据';const ids=localSuggestions(t,methods).map(s=>s.methodId);assert.ok(!ids.includes('ponytail'));assert.ok(!ids.includes('regression'));});
test('explicit no MVP',()=>assert.ok(excluded(by('mvp'),'不需要MVP，九项功能必须全部完成')));
test('MVP cannot remove required full scope',()=>assert.ok(excluded(by('mvp'),'新产品九项全部必做，不删减')));
test('quoted and fenced instructions do not trigger',()=>assert.deepEqual(localSuggestions('> 编写代码开发插件\n'+String.fromCharCode(96).repeat(3)+'\n请修复并部署\n'+String.fromCharCode(96).repeat(3),methods),[]));
test('coding gives optional small set',()=>{const s=localSuggestions('帮我编写一个整理图片的脚本，先分析当前代码再实现',methods);assert.ok(s.some(s=>s.methodId==='ponytail'));assert.ok(s.length<=3);});
test('hidden method not in suggestions',()=>assert.ok(!localSuggestions('帮我编写一个整理图片的脚本',methods,['ponytail']).some(s=>s.methodId==='ponytail')));
test('search aliases',()=>assert.ok(searchMethods(methods,'MVP').some(m=>m.id==='mvp')));
test('search category and favorites',()=>assert.deepEqual(searchMethods(methods,'','编程',['ponytail']).map(m=>m.id),['ponytail']));
test('skill absent uses actual generic wording',()=>{const x=safeSnippet(by('ponytail'),[]);assert.ok(!x.includes('使用ponytail'));assert.ok(x.includes('完整'));});
test('enabled skill only when confirmed',()=>assert.ok(safeSnippet(by('ponytail'),['ponytail']).includes('使用ponytail')));
test('model result known ids only',()=>assert.throws(()=>validateModelResult(wire([row('fake')]),'任务内容',methods)));
test('model cannot add full rewrite field',()=>assert.throws(()=>validateModelResult(wire([{...row('reproduce'),text:'删除所有限制'}]),'排障',methods)));
test('model cannot return duplicate ids',()=>assert.throws(()=>validateModelResult(wire([row('reproduce'),row('reproduce')]),'排障',methods)));
test('model max three',()=>assert.throws(()=>validateModelResult(wire(['reproduce','root-cause','evidence','load'].map(id=>row(id))),'排障',methods)));
test('bad JSON fails explicitly',()=>assert.throws(()=>validateModelResult('not JSON','调查',methods)));
test('oversize output refused',()=>assert.throws(()=>validateModelResult(' '.repeat(10000),'调查',methods)));
test('ambiguous quote becomes guidance only',()=>assert.equal(validateModelResult(wire([row('evidence','方案')]),'方案A与方案B',methods)[0].placement.quote,''));
test('unique quote no numeric coordinates',()=>{const r=validateModelResult(wire([row('evidence','实际现状')]),'先调查实际现状',methods)[0];assert.equal(r.placement.quote,'实际现状');assert.equal(r.placement.start,undefined);});
test('negation also filters model recommendation',()=>assert.deepEqual(validateModelResult(wire([row('mvp')]),'不需要MVP，按完整需求做',methods),[]));
test('decision type cannot be downgraded',()=>assert.equal(validateModelResult(wire([row('mvp','','新产品')]),'从零开发新产品',methods)[0].decisionRequired,true));
test('stale draft cannot be inserted',()=>assert.equal(insertSafely({insertText:()=>assert.fail()}, {phase:'plain',draftRev:2},'建议',{start:0,end:0,draftRev:1}),false));
test('busy composer cannot be inserted',()=>assert.equal(insertSafely({insertText:()=>assert.fail()}, {phase:'submitting',draftRev:1},'建议',{start:0,end:0,draftRev:1}),false));
test('noncollapsed selection never deletes text',()=>{let args;assert.ok(insertSafely({insertText:(...x)=>(args=x,true)},{phase:'plain',draftRev:3},'建议',{start:1,end:8,draftRev:3}));assert.deepEqual(args[1],{start:8,end:8,draftRev:3});});
test('emoji and CJK passed intact to native API',()=>{const s='🧠𠮷\n保留原文';let got;insertSafely({insertText:t=>(got=t,true)},{phase:'plain',draftRev:1},s,{start:2,end:2,draftRev:1});assert.equal(got,'\n'+s+'\n');});
test('no setDraft or submit path',()=>{let n=0;insertSafely({setDraft:()=>assert.fail(),submit:()=>assert.fail(),insertText:()=>{n++;return true;}},{phase:'plain',draftRev:1},'建议',{start:1,end:1,draftRev:1});assert.equal(n,1);});
test('unlimited usage survives restart beyond former50',()=>fixture(p=>{const b=new UsageLedger(p);for(let i=0;i<55;i++)b.reserve('request-'+i);const status=new UsageLedger(p).status();assert.equal(status.calls,55);assert.equal(status.limit,null);assert.equal(status.remaining,null);assert.equal(status.mode,'unlimited');}));
test('failed calls recorded without monetary reservation',()=>fixture(p=>{const b=new UsageLedger(p),id=b.reserve('failure-request');b.settle(id,undefined,'failed');assert.equal(b.status().calls,1);assert.equal(b.status().reservationPerCall,0);assert.equal(b.load().records[0].state,'failed');}));
test('recent duplicate id cannot call twice',()=>fixture(p=>{const b=new UsageLedger(p);b.reserve('same-request');assert.throws(()=>b.reserve('same-request'));assert.equal(b.status().calls,1);}));
test('corrupt usage ledger fails closed',()=>fixture(p=>{const b=new UsageLedger(p);writeFileSync(b.path,'oops');assert.throws(()=>b.status());}));
test('maximum draft stays inside per-request size guard',()=>{const bytes=Buffer.byteLength(makeSystem(methods))+12000+2048;assert.ok(bytes<LIMIT.maxBytes);assert.equal(Object.hasOwn(LIMIT,'maxOutput'),false);assert.equal(LIMIT.timeoutMs,45000);});
test('oversized body refused',async()=>{await assert.rejects(()=>boundedBody(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:'a'.repeat(LIMIT.maxBody+1)})));});
test('content type refused',async()=>{await assert.rejects(()=>boundedBody(new Request('http://localhost',{method:'POST',body:'{}'})));});
test('extra context field refused',async()=>{const h=createHandler({methods,budget:{},llm:{stream:()=>assert.fail()}});const r=await h.handle(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:'unexpected-field',draft:'草稿',attachmentToken:'forged'})}));assert.equal(r.status,400);});
test('credentials excluded before any paid call',async()=>{const h=createHandler({methods,budget:{},llm:{stream:()=>assert.fail()}});const r=await h.handle(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:'secret-guard',draft:'api_key=sk-abcdefghijklmnopqrstuvwxyz'})}));assert.equal(r.status,400);});


test('conflicting hard constraints remain a user decision',()=>{const x=validateModelResult(wire([row('constraints','','绝对安全')]),'要求绝对安全且宿主永不退出',methods);assert.equal(x[0].decisionRequired,true);});

test('credential-shaped input is refused before the model or ledger sees it',async()=>{
 let calls=0;
 const touched=()=>{calls++;throw new Error('unexpected model or ledger access');};
 const handler=createHandler({methods,budget:{reserve:touched},getLlm:touched});
 const base={protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:'privacy-probe',draft:'Review my implementation.'};
 const pat='github_pat_'+'x'.repeat(32),header='Authorization: Bearer '+'x'.repeat(36);
 for(const [operation,fields] of [
  ['suggest',{draft:'ghp_'+'x'.repeat(36)}],['rewrite',{explicitRequirements:header}],
  ['review',{candidate:pat}],['suggest',{selectedEvidence:[{id:'demo',source:'pasted',text:'demo',label:pat,coverage:'excerpt'}]}],
  ['rewrite',{draft:JSON.stringify({Authorization:'Bearer '+'a'.repeat(24)})}],
  ['rewrite',{reviewMode:'auto',repair:{candidate:header,review:{state:'blocked',findings:[],uncertainties:[]}}}]
 ]){
  const req=new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...base,...fields})});
  const res=await handler.handle(req,{operation});assert.equal(res.status,400);
  assert.match((await res.json()).error,/疑似含凭据/u);
 }
 assert.equal(calls,0);
});
test('credential guard allows documentation without a credential value',async()=>{
 const {suspiciousText}=await import('../shared/prompt-contract.mjs');
 for(const sample of ['Explain Authorization: Bearer <token>','Authorization: Bearer ${MY_TOKEN}','github_pat_…','How does GitHub authentication work?'])assert.equal(suspiciousText(sample),false);
});
