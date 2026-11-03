import {sourceBlocks} from './prompt-contract.mjs';
export const REVIEW_STATES=['not_requested','unchanged','no_issue_found','conflict','uncertain','failed','stale','blocked'];
const kinds=['omission','contradiction','scope','format','audience','language','permission','fabrication'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateReview(raw,request,candidate){
 try{
  if(typeof raw!=='string'||raw.length>7000)throw 0;
  const v=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));
  if(!object(v)||Object.keys(v).some(k=>!['verdict','findings','uncertainties'].includes(k))||!['no_issue_found','conflict','uncertain'].includes(v.verdict)||!Array.isArray(v.findings)||v.findings.length>6||!Array.isArray(v.uncertainties)||v.uncertainties.length>3||v.uncertainties.some(s=>typeof s!=='string'||s.length>200))throw 0;
  const blocks=sourceBlocks(request);
  const findings=v.findings.map(f=>{
   if(!object(f)||Object.keys(f).some(k=>!['kind','sourceBlockId','sourceQuote','candidateQuote','explanation'].includes(k))||!kinds.includes(f.kind)||typeof f.sourceQuote!=='string'||!f.sourceQuote||f.sourceQuote.length>160||typeof f.explanation!=='string'||f.explanation.length>200)throw 0;
   const block=blocks.find(b=>b.id===f.sourceBlockId);if(!block||!block.text.includes(f.sourceQuote))throw 0;
   if(f.candidateQuote!==null&&(typeof f.candidateQuote!=='string'||!f.candidateQuote||f.candidateQuote.length>160||!candidate.includes(f.candidateQuote)))throw 0;
   if(f.candidateQuote===null&&f.kind!=='omission')throw 0;
   return {...f};
  });
  if(v.verdict==='no_issue_found'&&(findings.length||v.uncertainties.length)||v.verdict==='conflict'&&!findings.length||v.verdict==='uncertain'&&!findings.length&&!v.uncertainties.length)throw 0;
  return {state:v.verdict,findings,uncertainties:[...v.uncertainties]};
 }catch{return {state:'uncertain',findings:[],uncertainties:['审校依据或格式无法确认，未自动采用。']};}
}
export function reviewFor(state){return {state,findings:[],uncertainties:[]};}
export function validReviewPacket(v){return object(v)&&Object.keys(v).every(k=>['state','findings','uncertainties'].includes(k))&&REVIEW_STATES.includes(v.state)&&Array.isArray(v.findings)&&Array.isArray(v.uncertainties);}
