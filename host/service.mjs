import {rewritePreflight,validateRewrite,parseRewriteCandidate,rewriteIssues,makeRewriteSystem,protectedFragments} from '../shared/rewrite-contract.mjs';
import {makeSystem,makeReviewSystem} from './prompts.mjs';
import {parseAnalysis,ANALYSIS_PROTOCOL,REVIEW_CAPABILITY} from '../shared/analysis-contracts.mjs';
import {guidanceFor,RULES_HASH} from '../shared/guidance.mjs';
import {sourceBlocks} from '../shared/prompt-contract.mjs';
import {methodChoice} from '../shared/method-selection.mjs';
import {validateReview,reviewFor} from '../shared/rewrite-review.mjs';
import {createHash} from 'node:crypto';
import {MAX_DRAFT} from '../shared/method-limits.mjs';
import {CoachError,PROTOCOL,publicError,validateDecision,modelFailure,failureFacts} from '../shared/contracts.mjs';
import {preflightDecision,enforcePolicy} from '../shared/policy.mjs';
import {prepareModel} from './model-adapter.mjs';
import {abortable} from '../shared/async.mjs';
export const LIMIT=Object.freeze({maxBody:64000,maxBytes:80000,maxRecords:2000,minIntervalMs:2000,timeoutMs:45000});
export const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export {makeSystem} from './prompts.mjs';
export async function boundedBody(req,maxBody=LIMIT.maxBody){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new CoachError('INPUT');
 const size=req.headers.get('content-length');if(size&&(!/^\d+$/.test(size)||Number(size)>maxBody))throw new CoachError('INPUT');
 if(req.signal.aborted)throw new CoachError('CANCELLED');
 const reader=req.body?.getReader();if(!reader)throw new CoachError('INPUT');
 const signal=AbortSignal.any([req.signal,AbortSignal.timeout(5000)]);let bytes=0;const chunks=[];
 try{for(;;){const {done,value}=await abortable(reader.read(),signal);if(done)break;bytes+=value.byteLength;if(bytes>maxBody)throw new CoachError('INPUT');chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 finally{void reader.cancel().catch(()=>{});}
}
export function createHandler({getLlm,llm,budget,methods,skills=async()=>[],version='unknown',now=Date.now,getConfig=()=>({routeMode:'follow',provider:'',model:''}),validateSession=async()=>false,onError=()=>{},diagnosticRoots=[],limits={}}){
 const policy={...LIMIT,...limits};let lease=null,last=-Infinity,lastKind=null,pendingSettlement=null;const life=new AbortController();const model=()=>getLlm?getLlm():llm;
 const ledgerWarning='模型结果已保留，但调用记录未能完成登记。不会自动重发模型请求；请在Prelude设置重试登记。';
 const pendingWarning=()=>pendingSettlement?.state==='completed'?ledgerWarning:'调用记录尚未完成登记；不会自动重发模型请求，请在Prelude设置重试登记。';
 const settle=(id,usage,state)=>{try{budget.settle(id,usage,state);return null;}catch{const safeUsage=Object.fromEntries(['inputTokens','outputTokens','cacheReadTokens','cacheWriteTokens'].filter(k=>Number.isFinite(usage?.[k])&&usage[k]>=0).map(k=>[k,usage[k]]));pendingSettlement={id,usage:safeUsage,state};return pendingWarning();}};
 const own=(operation,record)=>{record.pending++;const p=Promise.resolve(operation);p.then(()=>release(),()=>release());function release(){record.pending--;if(record.finished&&!record.pending&&lease===record)lease=null;}return p;};
 const track=(operation,record,signal)=>abortable(own(operation,record),signal);
 const availableSkills=async signal=>(await abortable(skills(signal),signal)).filter(s=>s.invocation?.modelInvocable!==false).map(s=>s.name).filter(x=>methods.some(m=>m.related_installed_skill===x));
 const needsSkills=body=>Array.isArray(body?.selectedMethods)&&body.selectedMethods.some(c=>{const m=methods.find(x=>x.id===c?.id);return m?.related_installed_skill&&c.text!==methodChoice(m,c.variant,[]).text;});
 return {dispose(){life.abort();},async reconcile(req){
  if(req.method!=='POST')return json({ok:false,error:'method not allowed'},405);
  try{const body=await boundedBody(req);if(body?.protocolVersion!==PROTOCOL||Object.keys(body).some(k=>k!=='protocolVersion'))throw new CoachError('INPUT');}catch{return json({ok:false,error:publicError(new CoachError('INPUT'))},400);}
  if(lease)return json({ok:false,error:'调用仍在收尾，请稍后重试登记。'},409);
  if(!pendingSettlement)return json({ok:true,reconciled:false,note:'本进程没有待登记结果；历史未知用量不会被补写成成功。'});
  const pending=pendingSettlement;try{budget.settle(pending.id,pending.usage,pending.state);if(pendingSettlement===pending)pendingSettlement=null;return json({ok:true,reconciled:true});}catch{return json({ok:false,error:pendingWarning()},503);}
 },async handle(req,{operation='suggest'}={}){
  if(life.signal.aborted)return json({ok:false,error:publicError(new CoachError('CANCELLED'))},503);
  if(req.method==='GET'){
   let b=null,ledgerError=null;try{b=budget.status();}catch{ledgerError=publicError(new CoachError('LEDGER'));}
   if(pendingSettlement)ledgerError=pendingWarning();
   let available=[];try{available=await availableSkills(AbortSignal.any([req.signal,life.signal,AbortSignal.timeout(1200)]));}catch{}
   return json({ok:true,protocolVersion:PROTOCOL,version,analysisProtocol:ANALYSIS_PROTOCOL,rulesHash:RULES_HASH,count:methods.length,budget:b,ledgerError,pendingSettlement:!!pendingSettlement,availableSkills:available,config:getConfig(),busy:!!lease,capabilities:{rewrite:'preview-explicit-apply',review:REVIEW_CAPABILITY,materials:'explicit-text-preview',history:'selected-loaded-chat-only',fileRead:'client-opt-in-text-only'},maxDraft:MAX_DRAFT});
  }
  if(req.method!=='POST')return json({ok:false,error:'method not allowed'},405);
  let body;try{const raw=await boundedBody(req);let available=[];if(needsSkills(raw)){try{available=await availableSkills(AbortSignal.any([req.signal,life.signal,AbortSignal.timeout(1200)]));}catch{throw new CoachError('SKILL_UNAVAILABLE');}}body=parseAnalysis(raw,{review:operation==='review',repairAllowed:operation==='rewrite',methods,availableSkills:available});if(operation==='review')validateRewrite(JSON.stringify({kind:body.candidate===body.draft?'unchanged':'rewrite',text:body.candidate,changes:[],uncertainties:[]}),body);}catch(e){return json({ok:false,error:publicError(e instanceof CoachError?e:new CoachError('INPUT'))},e instanceof CoachError&&e.code==='PROTOCOL'?409:400);}
  if(body.repair?.review.state==='blocked'&&!rewriteIssues(body,body.repair.candidate).length)return json({ok:false,error:publicError(new CoachError('INPUT'))},400);
  if(req.signal.aborted)return json({ok:false,error:publicError(new CoachError('CANCELLED'))},503);
  const rewrite=operation==='rewrite',reviewOnly=operation==='review';const local=reviewOnly||body.repair?null:rewrite?rewritePreflight(body):preflightDecision(body,methods);if(local)return json({ok:true,protocolVersion:ANALYSIS_PROTOCOL,requestId:body.requestId,rulesHash:RULES_HASH,reviewMode:body.reviewMode,[rewrite?'rewrite':'decision']:local,review:reviewFor(rewrite&&local.kind==='unchanged'?'unchanged':'not_requested'),modelUsed:false});
  if(pendingSettlement)return json({ok:false,error:pendingWarning()},503);
  const nextKind=body.repair?'repair':operation;
  if(lease||(lastKind===nextKind&&now()-last<policy.minIntervalMs))return json({ok:false,error:'已有请求或上一请求仍在收尾；本地方法库可用，请稍后再试。'},429);
  const guidance=guidanceFor(body),payload={draft:body.draft,explicitRequirements:body.explicitRequirements,selectedMethods:body.selectedMethods,selectedEvidence:body.selectedEvidence,materials:{...body.materials,contentRead:body.selectedEvidence.length?'selected-excerpts-only':'none'},analysisScope:body.analysisScope,target:body.target,guidance,...(rewrite?{protectedFragments:protectedFragments(body),...(body.repair?{repair:{candidate:body.repair.candidate,feedback:body.repair.review,codeIssues:rewriteIssues(body,body.repair.candidate)}}:{})}:{})};
  const system=rewrite?makeRewriteSystem():makeSystem(methods);
  if(Buffer.byteLength(system+JSON.stringify(payload))+2048>policy.maxBytes)return json({ok:false,error:publicError(new CoachError('INPUT'))},400);
  const record={pending:0,finished:false};lease=record;last=now();lastKind=nextKind;
  const signal=AbortSignal.any([req.signal,life.signal,AbortSignal.timeout(policy.timeoutMs*2+5000)]);
  let candidate=null,modelUsed=false;
  const envelope=()=>({ok:true,protocolVersion:ANALYSIS_PROTOCOL,requestId:body.requestId,rulesHash:RULES_HASH,reviewMode:body.reviewMode,modelUsed,...(body.repair?{repairedFrom:body.repair.candidate}:{})});
  async function callStep(stage,sys,data,decode=raw=>raw){
   const stepSignal=AbortSignal.any([signal,AbortSignal.timeout(policy.timeoutMs)]);
   let id,usage,raw='',complete=false,iterator,output,failure;
   if(stepSignal.aborted)throw new CoachError('CANCELLED');
   if(pendingSettlement)throw new CoachError('LEDGER');
   if(record.closing)try{await abortable(record.closing,stepSignal);}catch{throw new CoachError(stepSignal.aborted?'CANCELLED':'CLEANUP');}
   if(Buffer.byteLength(sys+JSON.stringify(data))+2048>policy.maxBytes)throw new CoachError('INPUT');
   try{
    const prepared=await track(prepareModel(model(),body.route,stepSignal),record,stepSignal);
    if(stepSignal.aborted)throw new CoachError('CANCELLED');
    const stepId=createHash('sha256').update('prelude-v7\0'+body.requestId+'\0'+stage).digest('hex');
    try{id=budget.reserve(stepId);}catch(e){throw new CoachError(e?.code==='GATE_LEGACY'?'LEDGER_LOCK':e?.code==='GATE_BUSY'?'LEDGER_BUSY':'LEDGER');}
    modelUsed=true;iterator=prepared.stream({...prepared.config,tools:[],system:sys,messages:[{role:'user',content:[{type:'text',text:JSON.stringify(data)}]}],signal:stepSignal})[Symbol.asyncIterator]();
    for(;;){const step=await track(iterator.next(),record,stepSignal);if(step.done)break;const chunk=step.value;
     if(chunk.type==='text-delta'){raw+=chunk.text;if(raw.length>9000)throw new CoachError('RESULT');}
     if(chunk.type==='usage')usage=chunk.usage;
     if(chunk.type==='finish'){
      complete=chunk.reason?.kind==='stop';
      if(!complete)throw stepSignal.aborted?new CoachError('CANCELLED'):chunk.reason?.kind==='max-tokens'?new CoachError('OUTPUT_LIMIT'):modelFailure(chunk.reason?.failure);
     }
    }
    if(stepSignal.aborted)throw new CoachError('CANCELLED');if(!complete||!raw)throw new CoachError('RESULT');
    const value=decode(raw);const ledgerError=settle(id,usage,'completed');id=null;
    output={value,ledgerError};
   }catch(e){if(id)settle(id,usage,stepSignal.aborted?'cancelled_usage_may_be_unknown':'failed_or_invalid');failure=e;}
   finally{if(iterator){record.closing=own(Promise.resolve().then(()=>iterator.return?.()),record);void record.closing.catch(e=>{try{onError(failureFacts(e,{codeRoots:diagnosticRoots}));}catch{}});}}
   // Cancellation stays prompt; ownership of a pending close outlives the response.
   if(failure)throw failure;
   if(record.closing)try{await abortable(record.closing,stepSignal);}catch{return {...output,closeError:publicError(new CoachError(stepSignal.aborted?'CANCELLED':'CLEANUP'))};}
   return output;
  }
  const runReview=async text=>{
   const checked=validateRewrite(JSON.stringify({kind:text===body.draft?'unchanged':'rewrite',text,changes:[],uncertainties:[]}),body);
   if(checked.kind==='unchanged'&&!body.selectedMethods.length)return {review:reviewFor('unchanged')};
   const step=await callStep('review',makeReviewSystem(),{blocks:sourceBlocks(body),candidate:text,target:body.target},raw=>validateReview(raw,body,text));
   if(step.closeError)throw new CoachError('CLEANUP');
   return {review:step.value,...(step.ledgerError?{ledgerError:step.ledgerError}:{})};
  };
  try{
   if(body.sessionId){let exists;try{exists=await track(validateSession(body.sessionId,signal),record,signal);}catch(e){if(signal.aborted)throw e;throw new CoachError('SESSION_SERVICE');}if(!exists)throw new CoachError('SESSION');}
   if(reviewOnly){const result=await runReview(body.candidate);return json({...envelope(),candidate:body.candidate,...result});}
   const generated=await callStep(rewrite?(body.repair?'repair':'generate'):'suggest',system,payload,raw=>rewrite?parseRewriteCandidate(raw,body):enforcePolicy(validateDecision(raw,body,methods),body,methods));
   const result=generated.value;
   if(!rewrite&&generated.closeError)throw new CoachError('CLEANUP');
   if(!rewrite)return json({...envelope(),decision:result,...(generated.ledgerError?{ledgerError:generated.ledgerError}:{})});
   candidate=result;
   const issues=rewriteIssues(body,candidate.text);
   if(issues.length)return json({...envelope(),rewrite:candidate,review:reviewFor('blocked'),...(generated.closeError?{reviewError:generated.closeError}:{}),...(generated.ledgerError?{ledgerError:generated.ledgerError}:{})});
   if(generated.closeError)return json({...envelope(),rewrite:candidate,review:reviewFor('failed'),reviewError:generated.closeError,...(generated.ledgerError?{ledgerError:generated.ledgerError}:{})});
   if(generated.ledgerError)return json({...envelope(),rewrite:candidate,review:reviewFor('failed'),ledgerError:generated.ledgerError});
   let reviewed={review:reviewFor(candidate.kind==='unchanged'&&!body.selectedMethods.length?'unchanged':'not_requested')};
   if(body.reviewMode==='auto'&&(candidate.kind!=='unchanged'||body.selectedMethods.length>0)){
    try{reviewed=await runReview(candidate.text);}catch(e){try{onError(failureFacts(e,{codeRoots:diagnosticRoots}));}catch{}reviewed={review:reviewFor('failed'),reviewError:publicError(signal.aborted?new CoachError('CANCELLED'):e)};}
   }
   return json({...envelope(),rewrite:candidate,...reviewed,...(pendingSettlement?{ledgerError:pendingWarning()}:{})});
  }catch(e){try{onError(failureFacts(e,{codeRoots:diagnosticRoots}));}catch{}return json({ok:false,error:publicError(signal.aborted?new CoachError('CANCELLED'):e instanceof CoachError?e:modelFailure(e))},503);}
  finally{record.finished=true;if(!record.pending&&lease===record)lease=null;}

 }};
}
