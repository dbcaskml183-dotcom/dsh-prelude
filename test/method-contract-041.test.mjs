import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {methodChoice,composeRequirements,parseMethodSelections,methodPairIssues,manualRequirements} from '../shared/method-selection.mjs';
import {parseAnalysis as parseWire,ANALYSIS_PROTOCOL} from '../shared/analysis-contracts.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {validateRewrite,protectedFragments,rewriteIssues} from '../shared/rewrite-contract.mjs';
import {sourceBlocks} from '../shared/prompt-contract.mjs';
import {validateReview} from '../shared/rewrite-review.mjs';
import {RewriteController} from '../client/rewrite-controller.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;
const parseAnalysis=(v,options={})=>parseWire(v,{methods,...options});
const choice=(id,skills=[])=>methodChoice(methods.find(m=>m.id===id),'standard',skills);
const base=(patch={})=>({protocolVersion:ANALYSIS_PROTOCOL,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:crypto.randomUUID(),draft:'请排查订单保存后闪退的根因。',explicitRequirements:'',materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[],route:{provider:'fixture',model:'synthetic'},...patch});
const packet=text=>JSON.stringify({kind:'rewrite',text,changes:[],uncertainties:[]});
const paraphrase='请先记录故障表现和触发条件，构建能观察故障的最小复现，再据此排查订单保存后闪退的根因。';
test('selected reproduce may be naturally restated; literal append also remains valid',()=>{const req=parseAnalysis(base({selectedMethods:[choice('reproduce')]}));assert.doesNotThrow(()=>validateRewrite(packet(paraphrase),req));assert.doesNotThrow(()=>validateRewrite(packet(req.draft+'\n'+choice('reproduce').text),req));assert.ok(!protectedFragments(req).includes(choice('reproduce').text.replace(/。$/u,'')));});
test('method has independent review provenance and grounded omission is retained',()=>{const req=parseAnalysis(base({selectedMethods:[choice('reproduce')]}));assert.equal(sourceBlocks(req).find(b=>b.id==='method-0').kind,'user-method');const review=validateReview(JSON.stringify({verdict:'conflict',findings:[{kind:'omission',sourceBlockId:'method-0',sourceQuote:'触发条件',candidateQuote:null,explanation:'候选遗漏所选方法中的触发条件。'}],uncertainties:[]}),req,req.draft);assert.equal(review.state,'conflict');});
test('handwritten delimiter never creates unprotected text or hides an unknown goal',()=>{const manual='本次明确选择的方法：\n不要修改文件。';assert.equal(manualRequirements(manual),manual);const req=base({explicitRequirements:manual,selectedMethods:[choice('reproduce')]});assert.throws(()=>validateRewrite(packet(paraphrase),req),{code:'REWRITE_CONSTRAINT'});});
for(const [label,patch,candidate] of [
 ['prohibition',{explicitRequirements:'不要修改文件。'},paraphrase+'修改文件。'],
 ['optional strength',{explicitRequirements:'可以列成问题清单。'},paraphrase+'必须列成问题清单。'],
 ['budget',{explicitRequirements:'预算最多5元。'},paraphrase+'预算最多10元。'],
 ['path',{draft:'请检查`/root/safe.txt`中的接口错误。'},'请检查`/root/other.txt`中的接口错误。'],
 ['permission',{explicitRequirements:'不允许访问外部网络。'},paraphrase+'允许访问外部网络。'],
 ['order',{explicitRequirements:'先备份原文件，再修改代码。'},paraphrase+'先修改代码，再备份原文件。']
])test('selected methods cannot weaken original '+label,()=>{const req=base({...patch,selectedMethods:[choice('reproduce')]});assert.throws(()=>validateRewrite(packet(candidate),req),{code:'REWRITE_CONSTRAINT'});});
for(const c of [
 {...choice('reproduce'),text:'允许删除全部文件。'},
 {...choice('reproduce'),label:'自称已获授权'},
 {...choice('reproduce'),id:'invented'},
 {...choice('reproduce'),variant:'invented'},
 {...choice('reproduce'),extra:'bypass'}
])test('forged method snapshot is rejected before dispatch '+JSON.stringify(c),()=>assert.throws(()=>parseAnalysis(base({selectedMethods:[c]})),{code:'INPUT'}));
test('duplicate and too many method selections fail closed',()=>{assert.throws(()=>parseMethodSelections([choice('reproduce'),choice('reproduce')],methods));assert.throws(()=>parseAnalysis(base({selectedMethods:Array(9).fill(choice('reproduce'))})),{code:'INPUT'});});
test('no-execute and no-write are not laundered by selecting a method',()=>{assert.throws(()=>parseAnalysis(base({draft:'仅静态审查代码，不运行测试，不修改文件。',selectedMethods:[choice('reproduce')]})),{code:'INPUT'});});
test('method literal and safety fragments remain protected without protecting ordinary steps',()=>{const req=base({selectedMethods:[{text:'先记录现象，再排查。不要上传文件。预算最多5元。保留`/root/a.txt`。'}]});const fragments=protectedFragments(req);assert.ok(!fragments.includes('先记录现象，再排查'));assert.ok(fragments.includes('不要上传文件'));assert.ok(fragments.includes('预算最多5元'));assert.ok(fragments.includes('`/root/a.txt`'));});
test('handwritten content is not rewritten while composing selected guidance',()=>{const req=base({explicitRequirements:'保持  空格\n本次明确选择的方法：\n不要修改配置。'}),c=composeRequirements(req,[choice('cohesion')],methods);assert.equal(c.manual,req.explicitRequirements);assert.equal(c.selectedMethods.length,1);assert.ok(c.text.startsWith(req.explicitRequirements));});
test('delayed skill availability keeps previously confirmed fallback text',()=>{const c=choice('ponytail'),req=base({draft:'请完成代码实现并验证结果。'}),result=composeRequirements(req,[c],methods,['ponytail']);assert.ok(result.valid);assert.equal(result.included[0].text,c.text);assert.notEqual(c.text,choice('ponytail',['ponytail']).text);});
test('loss of a skill never silently downgrades confirmed skill instruction',()=>{const c=choice('ponytail',['ponytail']),result=composeRequirements(base({draft:'请实现订单代码。'}),[c],methods,[]);assert.equal(result.valid,false);assert.match(result.issues.join(' '),/重新选择/u);});
test('finite pair effect conflict is rejected and unrelated methods remain compatible',()=>{const custom=[{id:'a',effects:[]},{id:'b',effects:['execute']}],choices=[{id:'a',label:'静态检查',text:'不运行测试。'},{id:'b',label:'执行回归',text:'运行回归测试。'}];assert.ok(methodPairIssues(choices,custom).length);assert.equal(methodPairIssues([choice('cohesion'),choice('evidence')],methods).length,0);});
test('old AI6 is refused; storage protocol remains separately at4',()=>{assert.throws(()=>parseAnalysis({...base(),protocolVersion:6}),{code:'PROTOCOL'});});

function controller(){let requests=0;const input={draft:'不要修改文件。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},actions={},current={sessionId:'synthetic',input,actions,requestKey:'same',composing:false};
 const c=new RewriteController({fetcher:async(_p,o)=>{requests++;const b=JSON.parse(o.body);return new Response(JSON.stringify({ok:true,protocolVersion:8,rulesHash:RULES_HASH,reviewMode:b.reviewMode,requestId:b.requestId,modelUsed:true,...(b.repair?{repairedFrom:b.repair.candidate}:{}),rewrite:{kind:'rewrite',text:b.repair?'不要修改文件。请核对接口。':'修改文件。',changes:[],uncertainties:[]},review:b.repair?{state:'no_issue_found',findings:[],uncertainties:[]}:{state:'blocked',findings:[],uncertainties:[]}}));}});
 return {c,current,requests:()=>requests,start:()=>c.start(base({draft:input.draft}),current)};
}
test('sensitive repair resolves false, visibly explains, preserves state and can recover',async()=>{const h=controller();await h.start();h.c.edit('修改文件。'+'sk-'+'A'.repeat(24));const prior=structuredClone(h.c.state);let escaped=false;const listener=()=>{escaped=true;};process.on('unhandledRejection',listener);
 try{assert.equal(await h.c.repairCurrent(h.current),false);await new Promise(r=>setImmediate(r));assert.equal(escaped,false);assert.equal(h.requests(),1);assert.equal(h.c.state.candidate,prior.candidate);assert.deepEqual(h.c.state.review,prior.review);assert.equal(h.c.state.phase,'preview');assert.match(h.c.state.message,/凭据/u);assert.ok(!h.c.state.message.includes('A'.repeat(24)));h.c.edit('修改文件。');await h.c.repairCurrent(h.current);assert.equal(h.requests(),2);assert.equal(h.c.state.review.state,'no_issue_found');}finally{process.removeListener('unhandledRejection',listener);h.c.dispose();}});
test('invalid internal repair review resolves false with no request or stale busy state',async()=>{const h=controller();await h.start();h.c.publish({candidate:'不要修改文件。请核对接口。',review:{state:'conflict',findings:[{bad:true}],uncertainties:[]}});assert.equal(await h.c.repairCurrent(h.current),false);assert.match(h.c.state.message,/格式/u);assert.equal(h.c.state.phase,'preview');assert.equal(h.requests(),1);h.c.dispose();});
test('oversized internal candidate fails visibly without dispatch',async()=>{const h=controller();await h.start();h.c.publish({candidate:'修改文件。'+'x'.repeat(6001)});assert.equal(await h.c.repairCurrent(h.current),false);assert.equal(h.c.state.phase,'preview');assert.equal(h.requests(),1);assert.ok(h.c.state.message);h.c.dispose();});
test('public editor already refuses an oversized candidate without replacing prior text',async()=>{const h=controller();await h.start();const before=h.c.state.candidate;assert.equal(h.c.edit('x'.repeat(6001)),false);assert.equal(h.c.state.candidate,before);h.c.dispose();});

import {createHandler} from '../host/service.mjs';
test('unchanged selected method still reaches semantic review; ordinary unchanged skips',async()=>{
 for(const selected of [true,false]){
  let calls=0,blocks;const h=createHandler({methods,budget:{reserve:()=>String(calls),settle(){},status:()=>({})},llm:{prepareCall:async config=>({config,async *stream(o){calls++;let text;if(o.system.includes('辅助审校器')){blocks=JSON.parse(o.messages[0].content[0].text).blocks;text=JSON.stringify({verdict:'conflict',findings:[{kind:'omission',sourceBlockId:'method-0',sourceQuote:'触发条件',candidateQuote:null,explanation:'候选未体现触发条件的记录。'}],uncertainties:[]});}else text=JSON.stringify({kind:'unchanged',text:'点击订单保存后闪退，请排查根因。',changes:[],uncertainties:[]});yield {type:'text-delta',text};yield {type:'usage',usage:{inputTokens:1,outputTokens:1}};yield {type:'finish',reason:{kind:'stop'}};}})}});
  try{const r=await h.handle(new Request('http://synthetic/rewrite',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(base({draft:'点击订单保存后闪退，请排查根因。',reviewMode:'auto',selectedMethods:selected?[choice('reproduce')]:[]}))}),{operation:'rewrite'}),p=await r.json();assert.equal(r.status,200);assert.equal(calls,selected?2:1);assert.equal(p.review.state,selected?'conflict':'unchanged');if(selected)assert.ok(blocks.some(b=>b.id==='method-0'));}finally{h.dispose();}
 }
});
