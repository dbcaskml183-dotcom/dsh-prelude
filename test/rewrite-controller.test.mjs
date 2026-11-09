import {RULES_HASH} from '../shared/guidance.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {RewriteController} from '../client/rewrite-controller.mjs';
const body=(draft='请调查接口并列出问题。')=>({protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},requestId:'rewrite-'+crypto.randomUUID(),draft,explicitRequirements:'',materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[],route:{provider:'fixture',model:'synthetic'}});
function harness(options={}){let input={draft:'请调查接口并列出问题。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},writes=0,submits=0;const actions={captureInsertion:()=>({start:0,end:0,draftRev:input.draftRev}),insertText(text,span){if(span.draftRev!==input.draftRev||input.phase!=='plain')return false;input={...input,draft:input.draft.slice(0,span.start)+text+input.draft.slice(span.end),draftRev:input.draftRev+1};writes++;return true;},submit(){submits++;}},current=()=>({sessionId:'session-a',actions,input,requestKey:'route-a',composing:false});
 const response=(req,text)=>({ok:true,protocolVersion:8,rulesHash:RULES_HASH,reviewMode:'manual',review:{state:'not_requested',findings:[],uncertainties:[]},requestId:req.requestId,rewrite:{kind:'rewrite',text:text||req.draft+'\n按实际证据说明。',changes:['整理表达'],uncertainties:[],note:'服务端附加说明'},modelUsed:true});
 const c=new RewriteController({fetcher:async(_path,o)=>new Response(JSON.stringify(response(JSON.parse(o.body)))),...options});return {c,current,body:()=>body(input.draft),response,input:()=>input,change:patch=>input={...input,...patch,draftRev:input.draftRev+1},counts:()=>({writes,submits})};}
test('full closed loop generates without writing, accepts once, and restores original once',async()=>{const h=harness(),original=h.input().draft;await h.c.start(h.body(),h.current());assert.deepEqual(h.counts(),{writes:0,submits:0});assert.equal(h.c.applyReason(h.current()),'');assert.equal(h.c.apply(h.current()),true);assert.notEqual(h.input().draft,original);assert.equal(h.c.apply(h.current()),false);assert.equal(h.c.undo(h.current()),true);assert.equal(h.input().draft,original);assert.equal(h.c.undo(h.current()),false);assert.deepEqual(h.counts(),{writes:2,submits:0});});
test('edited valid candidate is what is applied',async()=>{const h=harness();await h.c.start(h.body(),h.current());h.c.edit('用户亲自整理的候选。');assert.equal(h.c.apply(h.current()),true);assert.equal(h.input().draft,'用户亲自整理的候选。');});
for(const label of ['new text','ABA','attachments','references','busy','session','actions','basis','IME'])test('preview cannot overwrite changed context '+label,async()=>{const h=harness();await h.c.start(h.body(),h.current());let x=h.current();if(label==='new text')h.change({draft:'用户新稿'});if(label==='ABA'){h.change({draft:'别的'});h.change({draft:x.input.draft});}if(label==='attachments')h.change({attachmentIds:['file-a']});if(label==='references')h.change({occurrences:[{ref:'file'}]});if(label==='busy')h.change({phase:'submitting'});x={...h.current(),...(label==='session'?{sessionId:'b'}:{}),...(label==='actions'?{actions:{...x.actions}}:{}),...(label==='basis'?{requestKey:'route-b'}:{}),...(label==='IME'?{composing:true}:{})};assert.notEqual(h.c.applyReason(x),'');assert.equal(h.c.apply(x),false);assert.equal(h.counts().writes,0);});
for(const patch of [{draft:'后续编辑'},{attachmentIds:['new-file']},{phase:'submitting'},{occurrences:[{}]}])test('undo never erases post-apply edits '+JSON.stringify(patch),async()=>{const h=harness();await h.c.start(h.body(),h.current());assert.equal(h.c.apply(h.current()),true);h.change(patch);const before=h.input().draft;assert.equal(h.c.undo(h.current()),false);assert.equal(h.input().draft,before);assert.equal(h.counts().writes,1);});
test('same text after edits still cannot be undone by old revision',async()=>{const h=harness();await h.c.start(h.body(),h.current());h.c.apply(h.current());const applied=h.input().draft;h.change({draft:'changed'});h.change({draft:applied});assert.equal(h.c.undo(h.current()),false);});
test('manual deletion of protected text cannot be acknowledged away',async()=>{const h=harness();h.change({draft:'调查接口。不要修改文件。'});await h.c.start(h.body(),h.current());h.c.edit('调查接口。');assert.equal(h.c.apply(h.current()),false);h.c.acknowledge(true);assert.equal(h.c.apply(h.current()),false);});
test('cancelled response cannot publish even if fetch ignores abort',async()=>{let release;const h=harness({fetcher:(_p,o)=>new Promise(r=>release=()=>r(new Response(JSON.stringify(h.response(JSON.parse(o.body))))))});const pending=h.c.start(h.body(),h.current());h.c.cancel();release();await pending;assert.equal(h.c.state.phase,'cancelled');assert.equal(h.counts().writes,0);});
test('dispose owns JSON body parsing and releases snapshots/subscriptions',async()=>{let bodyReady;const ready=new Promise(r=>bodyReady=r),h=harness({fetcher:async()=>({ok:true,json(){bodyReady();return new Promise(()=>{});}})});const promise=h.c.start(h.body(),h.current());await ready;h.c.dispose();await Promise.race([promise,new Promise((_,r)=>setTimeout(()=>r(new Error('body leak')),100))]);assert.equal(h.c.listeners.size,0);assert.equal(h.c.state.original,'');assert.equal(h.c.source,null);assert.equal(await h.c.start(h.body(),h.current()),false);});
test('generation may finish after typing but old candidate is copy-only',async()=>{let release;const h=harness({fetcher:async(_p,o)=>new Promise(r=>release=()=>r(new Response(JSON.stringify(h.response(JSON.parse(o.body))))))});const pending=h.c.start(h.body(),h.current());h.change({draft:'新需求'});release();await pending;assert.equal(h.c.state.phase,'preview');assert.equal(h.c.apply(h.current()),false);assert.equal(h.input().draft,'新需求');});
test('only one generation is admitted locally',async()=>{let release;const h=harness({fetcher:(_p,o)=>new Promise(r=>release=()=>r(new Response(JSON.stringify(h.response(JSON.parse(o.body))))))});const a=h.c.start(h.body(),h.current());assert.equal(await h.c.start(h.body(),h.current()),false);release();await a;});
test('wrong request id never becomes an adoptable preview',async()=>{const h=harness({fetcher:async()=>new Response(JSON.stringify({ok:true,protocolVersion:8,rulesHash:RULES_HASH,reviewMode:'manual',review:{state:'not_requested',findings:[],uncertainties:[]},requestId:'wrong',rewrite:{}}))});await h.c.start(h.body(),h.current());assert.equal(h.c.state.phase,'error');assert.equal(h.c.apply(h.current()),false);});
test('native CAS refusal does not create an undo receipt',async()=>{const h=harness();await h.c.start(h.body(),h.current());h.current().actions.insertText=()=>false;assert.equal(h.c.apply(h.current()),false);assert.equal(h.c.receipt,null);});

test('transaction does not clone or send unrelated runtime queue metadata',async()=>{const h=harness();h.change({queue:[{private:'PRIVATE_QUEUE_CANARY',callback:()=>{}}]});await h.c.start(h.body(),h.current());assert.equal(h.c.state.phase,'preview');assert.equal(h.c.source.input,undefined);assert.ok(!JSON.stringify(h.c.source.request).includes('PRIVATE_QUEUE_CANARY'));});

test('quote edits preserve meaning, roles, and selected evidence without treating examples as testimony',async()=>{
 const {quoteDifferences}=await import('../shared/prompt-contract.mjs');
 const checks=(a,b,extra={})=>quoteDifferences({draft:a,...extra},b);
 for(const [a,b] of [
  ['客户原话：“试用”。','以下是客户说："试用"。'],
  ['甲说：「好」。乙说：“稍等”。','乙说：“稍等”。甲说：“好”。'],
  ['请优化标题“春日”。','请优化标题“春天”。'],
  ['请编写一段虚构对话。','示例：客户说：“试用”。']
 ])assert.deepEqual(checks(a,b),[]);
 for(const a of ['用户反馈：‘试用’。','客户说："试用"。','甲写道：『试用』。']){
  const diffs=checks(a,a.replace('试用','续费'));assert.equal(diffs.length,1);const {start,end,raw}=diffs[0].restore;
  const b=a.replace('试用','续费');assert.equal(b.slice(0,start)+raw+b.slice(end),a);
 }
 const a='客户说：“试用”。',b=a+'客户说：“同意续费”。';
 assert.match(checks(a,b)[0].message,/新增/);assert.equal(checks(a,b)[0].restore,null);
 assert.ok(checks('整理访谈。','客户说：“同意续费”。').length);
 assert.deepEqual(checks(a,b,{selectedEvidence:[{text:'客户说：“同意续费”。'}]}),[]);
 assert.ok(checks(a,b,{selectedMethods:[{text:'客户说：“同意续费”。'}]}).length);
 assert.ok(checks(a,a+a)[0].notice);assert.ok(checks(a+' 保留原有引号。',a.replace('“','"').replace('”','"')+' 保留原有引号。').length);
 assert.ok(checks('甲说：“购买”。乙说：“试用”。','甲说：“试用”。乙说：“购买”。').every(x=>!x.restore));
 assert.ok(checks(a+a,a.replace('试用','购买')+a).every(x=>!x.restore));
});
test('unrelated edits do not discharge a grounded review; restoring the offending text restores the finding',async()=>{
 const h=harness();await h.c.start(h.body(),h.current());const t=h.c.state.candidate+'。客户已经同意。';
 h.c.publish({phase:'preview',candidate:t,review:{state:'conflict',findings:[{candidateQuote:'已经同意',explanation:'未有依据'}],uncertainties:[]}});
 for(const v of [t+' ',t+'\n',t+'\n请分段。']){h.c.edit(v);assert.equal(h.c.state.review.state,'conflict');assert.ok(h.c.applyReason(h.current()));}
 h.c.edit(t.replace('客户已经同意','请核实客户的答复'));assert.equal(h.c.state.review.state,'stale');
 h.c.edit(t);assert.ok(h.c.applyReason(h.current()));
});
test('a late restore click cannot change another candidate or a new draft',async()=>{
 const h=harness();h.change({draft:'请整理。客户说：“试用”。'});await h.c.start(h.body(),h.current());const bad='请整理记录。客户说：“购买”。';
 h.c.edit(bad);const issue=h.c.quoteIssues().find(x=>x.restore);assert.ok(issue);assert.equal(h.c.restoreQuote(h.current(),{},bad,issue.restore.start),false);
 assert.equal(h.c.restoreQuote({...h.current(),composing:true},h.c.source,bad,issue.restore.start),false);
 h.c.edit(bad+'请分段。');assert.equal(h.c.restoreQuote(h.current(),h.c.source,bad,issue.restore.start),false);
 const live=h.c.state.candidate;assert.ok(h.c.restoreQuote(h.current(),h.c.source,live,issue.restore.start));assert.equal(h.c.state.candidate,'请整理记录。客户说：“试用”。请分段。');assert.equal(h.counts().writes,0);
 h.c.edit(bad);h.change({draft:'已经换题'});assert.equal(h.c.restoreQuote(h.current(),h.c.source,bad,issue.restore.start),false);
});

for (const action of ['dismiss', 'cancel', 'dismiss-then-start']) {
 test('late review failure respects '+action, async () => {
  let rejectReview;
  const waiting = new Promise((_, reject) => { rejectReview = reject; });
  const h = harness({fetcher: async (path, opts) => path.endsWith('/review') ? waiting : new Response(JSON.stringify(h.response(JSON.parse(opts.body))))});
  await h.c.start(h.body(), h.current());
  const review = h.c.reviewCurrent(h.current());
  assert.equal(h.c.state.phase, 'reviewing');
  if (action === 'cancel') h.c.cancel();
  else h.c.dismiss();
  const snapshot = h.c.getSnapshot();
  const next = action === 'dismiss-then-start' && h.c.start(h.body(), h.current());
  const seen = [];
  const off = h.c.subscribe(() => seen.push(h.c.getSnapshot()));
  rejectReview(new Error('late response'));
  await review;
  if (next) {
   await next;
   assert.equal(h.c.state.phase, 'preview');
   assert.equal(h.c.state.review.state, 'not_requested');
   assert.ok(seen.every(s => s.review.state !== 'failed'));
  } else assert.deepEqual(h.c.getSnapshot(), snapshot);
  off();
  assert.deepEqual(h.counts(), {writes:0, submits:0});
 });
}
test('current review failure keeps its candidate and allows another review',async()=>{
 const h=harness({fetcher:async(path,o)=>{
  if(path.endsWith('/review'))throw new Error('current failure');
  return new Response(JSON.stringify(h.response(JSON.parse(o.body))));
 }});
 await h.c.start(h.body(),h.current());
 const text=h.c.state.candidate;
 await h.c.reviewCurrent(h.current());
 assert.equal(h.c.state.review.state,'failed');
 assert.equal(h.c.state.candidate,text);
 assert.equal(h.c.reviewReason(h.current()),'');
});

test('timeout of the current review leaves a retryable preview',async()=>{
 const h=harness({timeoutMs:35,fetcher:(path,o)=>path.endsWith('/review')?new Promise(()=>{}):Promise.resolve(new Response(JSON.stringify(h.response(JSON.parse(o.body)))))});
 await h.c.start(h.body(),h.current());
 const candidate=h.c.state.candidate;
 const keepAlive=setTimeout(()=>{},2000);
 try {
  assert.equal(await h.c.reviewCurrent(h.current()),false);
  assert.equal(h.c.state.phase,'preview');
  assert.match(h.c.state.message,/超时/);
  assert.equal(h.c.state.review.state,'failed');
  assert.equal(h.c.state.candidate,candidate);
  assert.equal(h.c.reviewReason(h.current()),'');
 } finally {clearTimeout(keepAlive);}
});
