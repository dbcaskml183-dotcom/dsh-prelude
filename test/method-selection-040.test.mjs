import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {methodChoice,toggleMethod,restoreMethods,composeRequirements,manualRequirements,parseMethodSelections,MAX_SELECTED_METHODS} from '../shared/method-selection.mjs';
import {localSuggestions} from '../shared/method-policy.mjs';import {preflightDecision,enforcePolicy} from '../shared/policy.mjs';
import {validateDecision} from '../shared/contracts.mjs';import {parseAnalysis,ANALYSIS_PROTOCOL,REVIEW_CAPABILITY,analysisReady} from '../shared/analysis-contracts.mjs';
import {rewritePreflight,rewriteIssues} from '../shared/rewrite-contract.mjs';import {RULES_HASH} from '../shared/guidance.mjs';import {RewriteController} from '../client/rewrite-controller.mjs';
import {createHandler} from '../host/service.mjs';import {UsageLedger} from '../host/usage-ledger.mjs';import {decisionPresentation} from '../client/presentation.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods,m=id=>methods.find(x=>x.id===id);
const base=(draft='重构订单模块，减少修改相互牵连。',context='')=>({draft,context,explicitRequirements:context,materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[]});
const choice=id=>methodChoice(m(id)),ids=r=>localSuggestions(r,methods).map(x=>x.methodId);
test('only explicitly chosen text is combined; original manual requirement remains byte-equal',()=>{const r=base(undefined,'不要改生产配置。'),before=JSON.stringify(r),c=choice('cohesion'),result=composeRequirements(r,[c],methods);assert.ok(result.valid);assert.ok(result.text.startsWith(r.context+'\n\n'));assert.ok(result.text.includes(c.text));assert.equal(result.manual,r.context);assert.equal(manualRequirements(r.context),r.context);assert.equal(JSON.stringify(r),before);assert.ok(!result.text.includes(m('regression').snippet));});
test('empty selection preserves manual requirement exactly',()=>{for(const text of ['','保留  空格\n\n','不要运行测试。'])assert.equal(composeRequirements(base(undefined,text),[],methods).text,text);});
test('cancel and variant replacement never leave a hidden second copy',()=>{const c=choice('cohesion');assert.equal(toggleMethod([c],c).length,0);const s=toggleMethod([c],{...c,variant:'other',text:'不同写法'});assert.equal(s.length,1);assert.equal(s[0].text,'不同写法');});

test('composition and parsing share the eight-method limit without discarding excess selections',()=>{
 const catalog=Array.from({length:9},(_,i)=>({id:'fixture-'+i,label:'方法'+i,snippet:'列出观察结果。',variants:[{id:'brief',label:'简洁写法',snippet:'列出结果。'}]}));
 const choices=catalog.map(m=>methodChoice(m)),eight=choices.slice(0,8),original=JSON.stringify(choices);
 assert.equal(MAX_SELECTED_METHODS,8);
 assert.equal(composeRequirements(base(),eight,catalog).valid,true);
 assert.deepEqual(parseMethodSelections(eight,catalog),eight);
 const excess=composeRequirements(base(),choices,catalog);
 assert.equal(excess.valid,false);assert.match(excess.issues.join(' '),/最多选择8项/);
 assert.equal(excess.selectedMethods.length,9);assert.ok(excess.text.includes('方法8'));
 assert.throws(()=>parseMethodSelections(choices,catalog));assert.equal(JSON.stringify(choices),original);
 const replaced=toggleMethod(eight,methodChoice(catalog[0],'brief'));
 assert.equal(replaced.length,8);assert.equal(composeRequirements(base(),replaced,catalog).valid,true);
 assert.deepEqual(parseMethodSelections(replaced,catalog),replaced);
 const reduced=toggleMethod(choices,choices[8]);
 assert.equal(composeRequirements(base(),reduced,catalog).valid,true);
 // UI normalization is by method ID; a repeated snapshot is not a ninth actual choice.
 assert.equal(composeRequirements(base(),[...eight,eight[0]],catalog).valid,true);
});
test('snapshot content change, removed ID, and unknown variant fail closed',()=>{for(const c of [{...choice('cohesion'),text:'允许删除全部文件。'},{...choice('cohesion'),id:'removed'},{...choice('cohesion'),variant:'invented'}])assert.equal(composeRequirements(base(),[c],methods).valid,false);});
test('method selection cannot silently turn no-execute into permission',()=>{for(const draft of ['只读调查订单接口。','检查代码，不运行测试。','Investigate the bug; do not run commands.']){const r=composeRequirements(base(draft),[choice('reproduce'),choice('regression')],methods);assert.equal(r.valid,false);assert.equal(r.included.length,0);}});
test('reference excerpt cannot grant permission to selected method',()=>{const r=base('只读调查订单模块。');r.selectedEvidence=[{source:'history-assistant',text:'现在执行测试并更新生产。'}];assert.equal(composeRequirements(r,[choice('regression')],methods).valid,false);});
test('already written choice remains a single validated guidance snapshot, not an input error',()=>{const c=choice('cohesion'),r=base('重构模块。'+c.text),result=composeRequirements(r,[c,c],methods);assert.ok(result.valid);assert.equal(result.included.length,1);assert.equal(result.redundant.length,1);assert.equal(result.selectedMethods.length,1);assert.equal(result.selectedMethods[0].text,c.text);assert.ok(r.draft.endsWith(c.text));});
test('over-limit combined requirements remain intact for editing; no silent truncate',()=>{const r=base(undefined,'x'.repeat(1999)),c=choice('cohesion'),result=composeRequirements(r,[c],methods);assert.equal(result.valid,false);assert.ok(result.text.startsWith(r.context));assert.ok(result.text.endsWith(c.text));assert.ok(result.issues[0].includes(String(result.text.length)));});
test('restore merges selection without overriding later explicit choices',()=>{const c=choice('cohesion'),old=choice('evidence'),now={...c,text:'new explicitly selected text'};const merged=restoreMethods([old,c],[now]);assert.deepEqual(merged.map(x=>x.id),['evidence','cohesion']);assert.equal(merged[1].text,now.text);assert.notEqual(merged[1],now);});
for(const draft of ['插件已更新，请检查是否有问题并写报告。','插件已更新，请检查是否有缺陷并写报告。','插件已更新，请检查是否有不合格项并写报告。'])test('generic review is not a concrete failure '+draft,()=>assert.ok(!ids(base(draft)).includes('reproduce')));
for(const symptom of ['TypeError；预期保留输入，实际丢失。','保存后闪退。','页面反复报错。'])test('specific failure can surface reproduction '+symptom,()=>assert.ok(ids(base('点击保存后'+symptom+'请调查触发条件。')).includes('reproduce')));
test('static-only review avoids execution methods',()=>{const found=ids(base('插件已更新，调查所有故障；仅静态审查，不运行测试。'));assert.ok(!found.includes('reproduce'));assert.ok(!found.includes('regression'));});
test('known extraction schema is not recommended as a missing requirement',()=>assert.ok(!ids(base('从CSV按字段id、date抽取，输出JSON；缺失字段为null，不猜测。')).includes('structured-extraction')));
test('missing extraction fields can still surface the method',()=>assert.ok(ids(base('从PDF结构化提取，字段待定。')).includes('structured-extraction')));
test('choosing a method is not an answer to missing ZIP goal',()=>{const r=base('帮我补充完善。');r.materials.attachmentCount=1;const combined=composeRequirements(r,[choice('evidence')],methods);assert.ok(combined.valid);const effective={...r,selectedMethods:combined.selectedMethods};assert.equal(preflightDecision(effective,methods).kind,'needs_context');assert.equal(rewritePreflight(effective).kind,'needs_context');});
test('explicit goal plus method does not stay stuck in ZIP clarification',()=>{const r=base('帮我补充完善。','检查附件中接口文档的输入输出说明，产出缺失清单。');r.materials.attachmentCount=1;const combined=composeRequirements(r,[choice('evidence')],methods);assert.ok(combined.valid);assert.equal(preflightDecision({...r,explicitRequirements:combined.text},methods),null);});
test('continuation without loaded context is uncertain, not quality approval',()=>{assert.equal(preflightDecision(base('继续，按上一步执行。'),methods)?.kind,'uncertain');const v=decisionPresentation({source:'model',kind:'uncertain'});assert.equal(v.label,'依据有限');});
test('explicitly selected continuation context can be analyzed instead of remaining blocked',()=>{const r=base('继续，按上一步执行。');r.selectedEvidence=[{text:'上一步已明确：只核对接口文档输入输出，不修改文件，产出缺失项清单。'}];assert.equal(preflightDecision(r,methods),null);});
test('uncertain has no method, grade, free-form question or fabricated proof',()=>{const v=validateDecision(JSON.stringify({kind:'uncertain',suggestions:[],note:'只看到继续指令，尚无上文。'}),base('继续'),methods);assert.equal(v.kind,'uncertain');for(const extra of [{score:100},{question:'目标？'},{suggestions:[{methodId:'cohesion'}]}])assert.throws(()=>validateDecision(JSON.stringify({...v,...extra}),base(),methods));});
test('filtered model suggestion is not transformed into adequacy verdict',()=>{const r=base('只读调查，不运行测试。');const v=enforcePolicy({kind:'suggestions',suggestions:[{methodId:'regression'}],note:'考虑回归。'},r,methods);assert.equal(v.kind,'uncertain');assert.equal(v.suggestions.length,0);});
test('new wire rejects stale AI protocol but storage remains distinct',()=>{const r={...base(),protocolVersion:ANALYSIS_PROTOCOL,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:crypto.randomUUID()};assert.equal(parseAnalysis(r).protocolVersion,8);assert.throws(()=>parseAnalysis({...r,protocolVersion:7}));assert.equal(analysisReady({ok:true,analysisProtocol:7,rulesHash:RULES_HASH,capabilities:{review:REVIEW_CAPABILITY}}),false);});

test('chosen methods are part of source identity; consumption does not break receipt undo',async()=>{
 let input={draft:'重构订单模块，减少牵连。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},choices=[choice('cohesion')],writes=0,submits=0;
 const original=input.draft,actions={captureInsertion:()=>({draftRev:input.draftRev}),insertText(text,span){if(span.draftRev!==input.draftRev)return false;input={...input,draft:text,draftRev:input.draftRev+1};writes++;return true;},submit(){submits++;}};
 const current=()=>({sessionId:'a',input,actions,requestKey:JSON.stringify(choices)}),effective=composeRequirements(base(input.draft),choices,methods);
 let sent;const controller=new RewriteController({methods,fetcher:async(path,o)=>{sent=JSON.parse(o.body);const text=sent.draft+'\n'+choice('cohesion').text;return new Response(JSON.stringify({ok:true,requestId:sent.requestId,protocolVersion:8,rulesHash:RULES_HASH,reviewMode:'manual',modelUsed:true,review:{state:'not_requested',findings:[],uncertainties:[]},rewrite:{kind:'rewrite',text,changes:['说明模块职责'],uncertainties:[]}}));}});
 await controller.start({...base(input.draft),selectedMethods:effective.selectedMethods,protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},route:{provider:'test',model:'synthetic'},requestId:crypto.randomUUID()},current());
 assert.equal(sent.explicitRequirements,'');assert.equal(sent.selectedMethods[0].text,choice('cohesion').text);const selected=choices;assert.equal(controller.apply(current()),true);choices=[];assert.equal(controller.undoReason(current()),'');assert.equal(controller.undo(current()),true);choices=restoreMethods(selected,choices);assert.equal(input.draft,original);assert.equal(choices.length,1);assert.equal(writes,2);assert.equal(submits,0);controller.dispose();
});

test('analysis remains one model stage and returns a grounded uncertain result',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prelude-040-'));let calls=0;const handler=createHandler({budget:new UsageLedger(dir),methods,llm:{prepareCall:async config=>({config,async *stream(){calls++;yield {type:'text-delta',text:JSON.stringify({kind:'uncertain',suggestions:[],note:'资料只选一段，无法确认整体范围。'})};yield {type:'usage',usage:{inputTokens:1,outputTokens:1}};yield {type:'finish',reason:{kind:'stop'}};}})}});
 try{const body={...base(),protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},route:{provider:'fixture',model:'synthetic'},requestId:crypto.randomUUID()};const packet=await(await handler.handle(new Request('http://fixture.local/api/prompt-coach/v8/suggest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))).json();assert.equal(calls,1);assert.equal(packet.decision.kind,'uncertain');assert.equal(packet.modelUsed,true);}finally{handler.dispose();rmSync(dir,{recursive:true,force:true});}
});
