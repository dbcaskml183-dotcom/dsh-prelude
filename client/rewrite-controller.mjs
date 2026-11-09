import {quoteDifferences} from '../shared/prompt-contract.mjs';
import {abortable,deadlineFetch} from '../shared/async.mjs';
import {publicError} from '../shared/contracts.mjs';
import {parseAnalysis,ANALYSIS_PROTOCOL} from '../shared/analysis-contracts.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {MAX_REWRITE,missingProtected,rewriteIssues,parseRewriteCandidate,rewritePreflight,validateRewrite} from '../shared/rewrite-contract.mjs';
import {editorPolicyReason} from '../shared/editor-policy.mjs';
import {validateReview,reviewFor,validReviewPacket} from '../shared/rewrite-review.mjs';
const copy=v=>structuredClone(v);
const inputOf=c=>c?.input||{};
const initialState=()=>({phase:'idle',original:'',candidate:'',changes:[],uncertainties:[],message:'',edited:false,acknowledged:false,modelUsed:false,methodCount:0,review:reviewFor('not_requested'),reviewMode:'manual',priorFindings:[]});
function signature(c){const i=inputOf(c);return JSON.stringify([c?.sessionId,i.draft,i.draftRev,i.phase,i.attachmentIds,i.occurrences,c?.requestKey]);}
function sameAttachments(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function writeAvailability(c){const i=inputOf(c);
 if(c?.composing)return '中文输入法仍在组字，请完成输入后再采用或撤回。';
 if(!c?.actions||typeof c.actions.insertText!=='function'||typeof c.actions.captureInsertion!=='function'||typeof i.draft!=='string'||!Number.isSafeInteger(i.draftRev)||!Array.isArray(i.attachmentIds)||!Array.isArray(i.occurrences))return '宿主输入接口不可确认；可复制候选，不直接替换。';
 if(i.phase!=='plain')return '输入框正在提交或被其他功能占用，请完成后重新核对。';
 if(i.occurrences.length)return '当前含宿主引用；为保留宿主语义，仅提供预览与复制。';
 const semantics=editorPolicyReason(i.draft);if(semantics)return semantics;
 return '';
}
function packetReview(packet,request,text){
 if(!validReviewPacket(packet.review))throw new Error('审校状态缺失或无效，未采用结果。');
 const v=packet.review;
 if(v.state==='unchanged'&&text!==request.draft)throw new Error('审校回执声称原稿未变，但候选不同，未采用结果。');
 if(['no_issue_found','conflict','uncertain'].includes(v.state))return validateReview(JSON.stringify({verdict:v.state,findings:v.findings,uncertainties:v.uncertainties}),request,text);
 if(v.findings.length||v.uncertainties.length)throw new Error('审校状态与依据不符。');
 if(request.reviewMode==='auto'&&v.state==='not_requested'&&text!==request.draft)throw new Error('自动审校未完成，未降级采用。');
 return reviewFor(v.state);
}
export class RewriteController{
 constructor({fetcher=deadlineFetch,timeoutMs=105000,methods=[],getSkills=()=>[]}={}){this.methods=methods;this.getSkills=getSkills;this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.listeners=new Set();this.serial=0;this.controller=null;this.disposed=false;this.source=null;this.state=initialState();}
 subscribe=fn=>{if(this.disposed)return()=>{};this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 getSnapshot=()=>this.state;
 publish(patch){if(this.disposed)return;this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
 async request(path,body,signal){const response=await abortable(this.fetcher(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal},this.timeoutMs),signal);const packet=await abortable(response.json(),signal);if(!response.ok||!packet.ok)throw new Error(packet.error||'模型调用未完成，原稿未改动。');if(packet.protocolVersion!==ANALYSIS_PROTOCOL||packet.requestId!==body.requestId||packet.rulesHash!==RULES_HASH||packet.reviewMode!==body.reviewMode)throw new Error('返回身份或规范版本不符，未采用结果。');return packet;}
 async start(request,current){
  if(this.disposed||['generating','reviewing','repairing'].includes(this.state.phase))return false;
  let body;try{body=parseAnalysis(request,{methods:this.methods,availableSkills:this.getSkills()});}catch(e){this.publish({phase:'error',message:publicError(e)});return false;}
  this.source={key:signature(current),actions:current.actions,sessionId:current.sessionId,request:body};this.receipt=null;
  this.publish({phase:'generating',original:body.draft,candidate:'',changes:[],uncertainties:[],message:body.reviewMode==='auto'?'正在改写；有改动或已选方法时自动审校，两个阶段均可能计费。':'正在生成完整候选，输入框原稿保持不变。',edited:false,acknowledged:false,modelUsed:false,review:reviewFor('not_requested'),reviewMode:body.reviewMode,methodCount:body.selectedMethods.length,priorFindings:[]});
  const seq=++this.serial,ac=new AbortController();this.controller=ac;const signal=AbortSignal.any([ac.signal,AbortSignal.timeout(this.timeoutMs)]);
  try{
   let packet;const local=rewritePreflight(body);
   if(local)packet={ok:true,protocolVersion:ANALYSIS_PROTOCOL,requestId:body.requestId,rulesHash:RULES_HASH,reviewMode:body.reviewMode,rewrite:local,review:reviewFor(local.kind==='unchanged'?'unchanged':'not_requested'),modelUsed:false};
   else{if(!body.route)throw new Error('请选择宿主模型路线；未调用模型，原稿未改动。');packet=await this.request('/api/prompt-coach/v8/rewrite',body,signal);}
   if(seq!==this.serial||this.disposed||signal.aborted)return false;
   let result=packet.rewrite;
   if(!local)result=parseRewriteCandidate(JSON.stringify({kind:result?.kind,text:result?.text,changes:result?.changes,uncertainties:result?.uncertainties}),body);
   const review=local?.kind==='needs_context'?reviewFor('not_requested'):packetReview(packet,body,result.text);
   if(!local&&rewriteIssues(body,result.text).length&&review.state!=='blocked')throw new Error('代码检查与返回状态不符，未采用结果。');
   if(review.state==='blocked'&&!rewriteIssues(body,result.text).length)throw new Error('代码拦截回执无法复算，未采用结果。');
   this.publish({phase:result.kind==='needs_context'?'needs_context':'preview',candidate:result.text,changes:result.changes,uncertainties:result.uncertainties,message:packet.ledgerError||packet.reviewError||result.note,modelUsed:!!packet.modelUsed,review});return packet;
  }catch(e){if(seq===this.serial&&!this.disposed)this.publish({phase:'error',message:signal.aborted?'生成已取消或超时；已开始的调用可能计费，原稿未改动。':e.message||'整稿生成失败；原稿未改动。'});return false;}
  finally{if(this.controller===ac)this.controller=null;}
 }
 edit(text){
  if(!['preview','reviewing'].includes(this.state.phase)||typeof text!=='string'||text.length>MAX_REWRITE)return false;
  if(text===this.state.candidate)return true;
  if(this.state.phase==='reviewing')this.cancel();
  const s=this.state,anchor=this.source;
  if(!anchor)return false;
  if(!anchor.editBasis)anchor.editBasis={text:s.candidate,review:s.review};
  const basis=anchor.editBasis,r=basis.review;
  // Ignore outer whitespace only to KEEP an existing adverse verdict, never to approve content.
  const sameTail=text.trim()===basis.text.trim();
  const retained=(r.findings||[]).filter(f=>{
   if(!f.candidateQuote)return false;
   const at=basis.text.indexOf(f.candidateQuote);
   if(at<0||basis.text.indexOf(f.candidateQuote,at+1)>=0)return false;
   const before=basis.text.slice(0,at).split(/[。！？!?\n]/u).pop();
   const after=basis.text.slice(at+f.candidateQuote.length).split(/[。！？!?\n]/u)[0];
   const clause=before+f.candidateQuote+after;
   // Keep a grounded finding while its entire local context still exists,
   // including punctuation inside the reported span.
   let i=text.indexOf(clause);
   while(i>=0){if((!i||/[。！？!?\n]/u.test(text[i-1]))&&(i+clause.length===text.length||/[。！？!?\n]/u.test(text[i+clause.length])))return true;i=text.indexOf(clause,i+1);}
   return false;
  });
  const hold=['blocked','conflict','uncertain','failed'].includes(r.state);
  const review=hold&&sameTail?r:retained.length?{...r,findings:retained}:reviewFor('stale');
  this.publish({phase:'preview',candidate:text,edited:true,acknowledged:false,review,priorFindings:[...new Set([...s.priorFindings,...(r.findings||[])])].slice(-6)});
  return true;
 }
 quoteIssues(){return this.source?quoteDifferences(this.source.request,this.state.candidate):[];}
 restoreQuote(current,source,snapshot,start){
  if(this.source!==source||snapshot!==this.state.candidate||this.state.phase!=='preview'||!this.source||this.comparisonStatus(current)!=='current'||current.composing||inputOf(current).phase!=='plain')return false;
  const range=this.quoteIssues().map(q=>q.restore).find(q=>q&&q.start===start);
  return !!range&&this.edit(snapshot.slice(0,range.start)+range.raw+snapshot.slice(range.end));
 }
 acknowledge(){return false;}
 missing(){return this.source?missingProtected(this.source.request,this.state.candidate):[];}
 issues(){return this.source?rewriteIssues(this.source.request,this.state.candidate):[];}
 repairReason(current){
  if(this.disposed||this.state.phase!=='preview'||!this.source)return '当前没有可修正的候选。';
  if(signature(current)!==this.source.key||current.actions!==this.source.actions)return '原稿或依据已变化，请重新生成。';
  if(current.composing||inputOf(current).phase!=='plain')return '请完成输入或提交后再修稿。';
  if(this.issues().length)return '';
  if(['conflict','uncertain'].includes(this.state.review.state)&&this.state.review.findings.length)return '';
  return '没有可核对的修稿意见；可手改或重新审校。';
 }
 async repairCurrent(current){
  if(this.repairReason(current))return false;
  const previous={candidate:this.state.candidate,review:copy(this.state.review)},review=this.issues().length?reviewFor('blocked'):previous.review;
  let body;try{body=parseAnalysis({...this.source.request,requestId:crypto.randomUUID(),reviewMode:'auto',repair:{candidate:previous.candidate,review}},{repairAllowed:true,methods:this.methods,availableSkills:this.getSkills()});}catch(e){this.publish({phase:'preview',message:publicError(e).replace(/[。；;]$/u,'')+'；保留上次候选和审校意见，未发送修稿请求。'});return false;}
  const seq=++this.serial,ac=new AbortController();this.controller=ac;const signal=AbortSignal.any([ac.signal,AbortSignal.timeout(this.timeoutMs)]);
  this.publish({phase:'repairing',message:'正在按原稿核对意见并修正，再审校；最多两个模型阶段，可能计费，不会自动采用。'});
  try{
   const packet=await this.request('/api/prompt-coach/v8/rewrite',body,signal);
   if(seq!==this.serial||signal.aborted||this.disposed)return false;
   if(packet.repairedFrom!==previous.candidate)throw new Error('修稿来源不符，保留上次候选。');
   const result=parseRewriteCandidate(JSON.stringify({kind:packet.rewrite?.kind,text:packet.rewrite?.text,changes:packet.rewrite?.changes,uncertainties:packet.rewrite?.uncertainties}),body),receipt=packetReview(packet,body,result.text),issues=rewriteIssues(body,result.text);
   if((issues.length>0)!==(receipt.state==='blocked'))throw new Error('修稿代码检查回执不符。');
   this.source.request={...this.source.request,reviewMode:'auto'};this.source.editBasis=null;
   this.publish({phase:'preview',candidate:result.text,changes:result.changes,uncertainties:result.uncertainties,review:receipt,edited:false,reviewMode:'auto',priorFindings:[...this.state.priorFindings,...previous.review.findings].slice(-6),message:packet.ledgerError||packet.reviewError||'修稿与检查已结束；请核对原稿，再决定是否采用。',modelUsed:true});return packet;
  }catch(e){if(seq===this.serial&&!this.disposed)this.publish({phase:'preview',message:(signal.aborted?'修稿取消或超时':e.message)+'；保留上次候选和审校问题，不自动重试。'});return false;}
  finally{if(this.controller===ac)this.controller=null;}
 }
 comparisonStatus(current){
  if(this.state.phase==='applied'){
   const i=inputOf(current),r=this.receipt;
   return r&&current.actions===r.actions&&current.sessionId===r.sessionId&&i.draftRev===r.revision&&i.draft===r.text&&sameAttachments(i.attachmentIds,r.attachments)?'applied':'outdated';
  }
  if(this.state.phase==='reverted')return 'archived';
  return this.source&&(signature(current)!==this.source.key||current.actions!==this.source.actions)?'outdated':'current';
 }
 reviewReason(current){
  if(this.disposed||this.state.phase!=='preview'||!this.source)return '当前没有可审校的候选。';
  if(this.comparisonStatus(current)==='outdated')return '草稿或依据已变化；请按当前草稿重新生成，旧稿仍可查看或复制。';
  if(current.composing||inputOf(current).phase!=='plain')return '请完成输入或提交后再审校。';
  return '';
 }
 async reviewCurrent(current){
  const reason=this.reviewReason(current);if(reason){this.publish({message:reason});return false;}
  try{validateRewrite(JSON.stringify({kind:this.state.candidate===this.state.original?'unchanged':'rewrite',text:this.state.candidate,changes:[],uncertainties:[]}),this.source.request);}catch(e){this.publish({message:publicError(e)});return false;}
  const previousReview=this.state.review,candidate=this.state.candidate,body={...this.source.request,requestId:crypto.randomUUID(),candidate};
  const seq=++this.serial,ac=new AbortController();this.controller=ac;const signal=AbortSignal.any([ac.signal,AbortSignal.timeout(this.timeoutMs)]);
  this.publish({phase:'reviewing',message:'正在审校当前稿；这次可能计费，不会自动采用。'});
  try{const packet=await this.request('/api/prompt-coach/v8/review',body,signal);if(seq!==this.serial||signal.aborted||this.disposed)return false;if(packet.candidate!==candidate)throw new Error('审校对应的候选不符。');const review=packetReview(packet,body,candidate);this.source.editBasis=null;this.publish({phase:'preview',review,message:packet.ledgerError||'辅助审校结束；请核对后决定是否采用。'});return packet;}
  catch(e){if(seq===this.serial&&!this.disposed)this.source.editBasis={text:candidate,review:{...reviewFor('failed'),findings:previousReview.findings||[]}};this.publish({phase:'preview',review:reviewFor('failed'),message:signal.aborted?'审校取消或超时，已开始的调用可能计费。':e.message});return false;}
  finally{if(this.controller===ac)this.controller=null;}
 }
 applyReason(current){
  if(this.state.phase!=='preview')return '请先生成并核对完整候选。';
  if(!this.state.candidate.trim()||this.state.candidate===this.state.original)return '候选为空或与原稿相同，无需替换。';
  const unavailable=writeAvailability(current);if(unavailable)return unavailable;
  if(!this.source||current.actions!==this.source.actions||signature(current)!==this.source.key)return '输入框或依据已变化；旧候选仅供查看/复制，请重新生成后再采用。';
  const semantics=editorPolicyReason(this.state.candidate);if(semantics)return semantics;
  try{validateRewrite(JSON.stringify({kind:'rewrite',text:this.state.candidate,changes:[],uncertainties:[]}),this.source.request);}catch(e){return publicError(e);}
  const state=this.state.review.state;
  if(['blocked','conflict','uncertain','failed'].includes(state))return '本稿审校发现问题或未完成，请核对并修改/重新审校；不会自动降级采用。';
  if(this.state.reviewMode==='auto'&&!this.state.edited&&!['no_issue_found','unchanged'].includes(state))return '本次自动审校尚未完成。';
  return '';
 }
 apply(current){
  const reason=this.applyReason(current);if(reason){this.publish({message:reason});return false;}
  const i=current.input,text=this.state.candidate;
  if(current.actions.insertText(text,{start:0,end:i.draft.length,draftRev:i.draftRev})!==true){this.publish({message:'宿主拒绝了过期或不可用的替换；没有重试，请核对输入框。'});return false;}
  const after=current.actions.captureInsertion();this.receipt={actions:current.actions,sessionId:current.sessionId,revision:after?.draftRev>i.draftRev?after.draftRev:null,attachments:copy(i.attachmentIds),text};
  this.publish({phase:'applied',message:'已采用到输入框，尚未发送；继续编辑后不会用撤回覆盖你的新内容。'});return true;
 }
 undoReason(current){
  if(this.state.phase!=='applied'||!this.receipt)return '本页没有可撤回的本次替换。';const unavailable=writeAvailability(current);if(unavailable)return unavailable;
  const i=current.input,r=this.receipt;
  if(current.actions!==r.actions||current.sessionId!==r.sessionId||i.draftRev!==r.revision||i.draft!==r.text||!sameAttachments(i.attachmentIds,r.attachments))return '采用后输入框已有变化，快捷撤回不会覆盖新编辑；原稿仍可查看或复制。';return '';
 }
 undo(current){const reason=this.undoReason(current);if(reason){this.publish({message:reason});return false;}const i=current.input;
  if(current.actions.insertText(this.state.original,{start:0,end:i.draft.length,draftRev:i.draftRev})!==true){this.publish({message:'宿主拒绝了过期的撤回，未自动重试；原稿仍可复制。'});return false;}
  this.receipt=null;this.publish({phase:'reverted',message:'已撤回本次替换，恢复采用前原稿；没有发送。'});return true;
 }
 cancel(){if(!['generating','reviewing','repairing'].includes(this.state.phase))return;const repairing=this.state.phase==='repairing',reviewing=this.state.phase==='reviewing';if(reviewing&&this.source)this.source.editBasis={text:this.state.candidate,review:{...reviewFor('failed'),findings:this.state.review.findings||[]}};this.serial++;this.controller?.abort();this.controller=null;this.publish({phase:reviewing||repairing?'preview':'cancelled',...(reviewing?{review:reviewFor('failed')}:{ }),message:'已取消，原稿未改动；已开始的调用可能计费。'});}
 invalidate(current){if(this.source&&(signature(current)!==this.source.key||current.actions!==this.source.actions))this.cancel();}
 dismiss(){this.serial++;this.controller?.abort();this.controller=null;this.source=null;this.receipt=null;this.publish(initialState());}
 dispose(){if(this.disposed)return;this.serial++;this.disposed=true;this.controller?.abort();this.controller=null;this.listeners.clear();this.source=null;this.receipt=null;this.state=initialState();}
}
