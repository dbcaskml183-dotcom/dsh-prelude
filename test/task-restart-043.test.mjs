import test from 'node:test';
import assert from 'node:assert/strict';
import {RewriteController} from '../client/rewrite-controller.mjs';
import * as sessions from '../client/session-buckets.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
function harness(){
 let input={draft:'请调查接口并列出问题。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},calls=0,writes=0;
 const actions={captureInsertion:()=>({start:0,end:0,draftRev:input.draftRev}),insertText:(text,span)=>{if(span.draftRev!==input.draftRev)return false;input={...input,draft:text,draftRev:input.draftRev+1};writes++;return true;}};
 const current=()=>({sessionId:'synthetic-a',actions,input,requestKey:JSON.stringify([input.draftRev,input.draft]),composing:false});
 const packet=r=>({ok:true,protocolVersion:8,rulesHash:RULES_HASH,reviewMode:r.reviewMode,requestId:r.requestId,modelUsed:true,rewrite:{kind:'rewrite',text:r.draft+'\n按实际证据说明。',changes:['整理表达'],uncertainties:[]},review:{state:'not_requested',findings:[],uncertainties:[]}});
 const c=new RewriteController({fetcher:async(_p,o)=>{calls++;return new Response(JSON.stringify(packet(JSON.parse(o.body))));}});
 const start=()=>c.start({protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:crypto.randomUUID(),draft:input.draft,explicitRequirements:'',materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[],route:{provider:'fixture',model:'synthetic'}},current());
 return {c,start,current,packet,change:d=>input={...input,draft:d,draftRev:input.draftRev+1},counts:()=>({calls,writes})};
}
test('six rewrites keep old source outdated, never reusable on ABA',async()=>{
 const h=harness();await h.start();const original=h.current().input.draft;
 for(const text of ['版本B','版本C','版本D','版本E','版本F',original]){
  h.change(text);h.c.invalidate(h.current());assert.equal(h.c.comparisonStatus(h.current()),'outdated');assert.notEqual(h.c.reviewReason(h.current()),'');assert.equal(h.c.apply(h.current()),false);
 }
 assert.deepEqual(h.counts(),{calls:1,writes:0});h.c.dispose();
});
test('own replacement stays applied and undo works, outside edit makes old receipt outdated',async()=>{
 const h=harness();await h.start();assert.equal(h.c.apply(h.current()),true);h.c.invalidate(h.current());assert.equal(h.c.comparisonStatus(h.current()),'applied');assert.equal(h.c.undo(h.current()),true);assert.equal(h.c.comparisonStatus(h.current()),'archived');
 await h.start();h.c.apply(h.current());h.change('新任务');assert.equal(h.c.comparisonStatus(h.current()),'outdated');assert.equal(h.c.undo(h.current()),false);h.c.dispose();
});
test('candidate edit only invalidates semantic review, not source relationship',async()=>{
 const h=harness();await h.start();h.c.edit('请调查接口并列出问题。\n请解释依据。');assert.equal(h.c.state.review.state,'stale');assert.equal(h.c.comparisonStatus(h.current()),'current');assert.equal(h.c.reviewReason(h.current()),'');h.c.dispose();
});
test('dismiss fully resets all candidate metadata and invalidates previous sequence',async()=>{
 const h=harness();await h.start();h.c.edit('请调查接口并列出问题。\n手改。');const seq=h.c.serial;h.c.dismiss();assert.equal(h.c.state.modelUsed,false);assert.equal(h.c.state.methodCount,0);assert.equal(h.c.state.edited,false);assert.equal(h.c.source,null);assert.equal(h.c.receipt,null);assert.ok(h.c.serial>seq);h.c.dispose();
});
test('dismiss ignores late response even when transport ignores abort and new request has same draft',async()=>{
 const h=harness();let release;h.c.fetcher=(_p,o)=>new Promise(r=>release=()=>r(new Response(JSON.stringify(h.packet(JSON.parse(o.body))))));
 const old=h.start();h.c.dismiss();const oldRelease=release;h.c.fetcher=async(_p,o)=>new Response(JSON.stringify(h.packet(JSON.parse(o.body))));await h.start();const latest=h.c.state;oldRelease();await old;assert.equal(h.c.state,latest);h.c.dispose();
});
test('reset patch is task-only and clears all method and source selection caches',()=>{
 const patch=sessions.taskResetPatch(6);
 assert.equal(patch.resetGeneration,6);for(const k of ['methodChoices','appliedChoices','evidence','hidden'])assert.deepEqual(patch[k],[]);
 assert.equal(patch.context,'');assert.equal(patch.selection,null);assert.equal(patch.resetConfirmation,null);
 for(const k of ['ledgerError','availableSkills','statusConfig','expanded','position','autoReview','routeMode'])assert.equal(k in patch,false);
});
test('reset confirmation token changes on protected edits but ignores natural analysis result',()=>{
 const s={resetGeneration:3,context:'只调查',methodChoices:[],evidence:[],selection:null};const r={edited:false,candidate:'模型候选'};
 const key=sessions.taskResetToken(s,r,1,null);assert.equal(sessions.taskResetToken({...s,decision:{new:true}},r,1,null),key);
 assert.notEqual(sessions.taskResetToken({...s,context:'只读调查'},r,1,null),key);
 assert.notEqual(sessions.taskResetToken(s,{...r,edited:true,candidate:'人手改稿'},1,null),key);
 assert.notEqual(sessions.taskResetToken({...s,resetGeneration:4},r,1,null),key);
 assert.notEqual(sessions.taskResetToken(s,r,2,null),key);
});

for(const rounds of [1,3,6,50])test('repeated explicit restarts remain bounded '+rounds,async()=>{
 const h=harness();let state={...sessions.taskResetPatch(0),ledgerError:'keep-ledger',availableSkills:['keep-skill'],expanded:true};
 const unsubscribe=h.c.subscribe(()=>{});
 for(let i=0;i<rounds;i++){
  h.change('第'+i+'版：请调查接口并列出问题。');await h.start();h.c.dismiss();state={...state,...sessions.taskResetPatch(state.resetGeneration+1)};
  assert.equal(h.c.source,null);assert.equal(h.c.receipt,null);assert.equal(h.c.listeners.size,1);assert.equal(state.ledgerError,'keep-ledger');assert.deepEqual(state.availableSkills,['keep-skill']);assert.equal(state.expanded,true);
 }
 assert.equal(state.resetGeneration,rounds);assert.equal(h.counts().writes,0);unsubscribe();assert.equal(h.c.listeners.size,0);h.c.dispose();
});
for(const failure of [false,true])test('six generations reject all late callbacks '+failure,async()=>{
 const h=harness(),callbacks=[],pending=[];
 h.c.fetcher=(_p,o)=>new Promise((resolve,reject)=>callbacks.push(()=>failure?reject(new Error('old failure')):resolve(new Response(JSON.stringify(h.packet(JSON.parse(o.body)))))));
 for(let i=0;i<6;i++){h.change('合成第'+i+'版：请调查接口并列出问题。');pending.push(h.start());h.c.dismiss();}
 h.c.fetcher=async(_p,o)=>new Response(JSON.stringify(h.packet(JSON.parse(o.body))));h.change('最终F版：请调查接口并列出问题。');await h.start();const snapshot=h.c.state;
 for(const callback of callbacks.reverse())callback();await Promise.all(pending);assert.equal(h.c.state,snapshot);assert.equal(h.c.state.original,h.current().input.draft);assert.equal(h.counts().writes,0);h.c.dispose();
});
test('failure review may be explicitly retried without weakening adoption guards',async()=>{
 const h=harness();await h.start();h.c.publish({review:{state:'failed',findings:[],uncertainties:[]}});
 assert.equal(h.c.reviewReason(h.current()),'');assert.notEqual(h.c.applyReason(h.current()),'');h.change('新题');assert.notEqual(h.c.reviewReason(h.current()),'');h.c.dispose();
});
