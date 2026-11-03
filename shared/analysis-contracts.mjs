import {parseRequest,CoachError,PROTOCOL} from './contracts.mjs';
import {RULES_HASH} from './guidance.mjs';
import {MAX_REWRITE,parseRewriteCandidate} from './rewrite-contract.mjs';
import {validateReview} from './rewrite-review.mjs';
import {parseMethodSelections,composeRequirements} from './method-selection.mjs';
import {suspiciousText} from './prompt-contract.mjs';
export const ANALYSIS_PROTOCOL=8;
export const REVIEW_CAPABILITY='review-selectable-v2';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function parseAnalysis(v,{review=false,repairAllowed=false,methods=[],availableSkills=[]}={}){
 if(!object(v)||v.protocolVersion!==ANALYSIS_PROTOCOL||v.expectedRulesHash!==RULES_HASH)throw new CoachError('PROTOCOL');
 const {expectedRulesHash,target,reviewMode,candidate,repair,selectedMethods,...legacy}=v;
 let choices;try{choices=parseMethodSelections(selectedMethods,methods,availableSkills);}catch(e){throw new CoachError(e?.code==='SKILL_UNAVAILABLE'?'SKILL_UNAVAILABLE':'INPUT');}
 const base=parseRequest({...legacy,protocolVersion:PROTOCOL});
 const composed=composeRequirements(base,choices,methods,availableSkills);
 if(!composed.valid||composed.included.length!==choices.length)throw new CoachError('INPUT');
 if(!['manual','auto'].includes(reviewMode)||!object(target)||Object.keys(target).some(k=>!['mode','provider','model'].includes(k))||!['generic','session'].includes(target.mode))throw new CoachError('INPUT');
 if(target.mode==='generic'&&(Object.hasOwn(target,'provider')||Object.hasOwn(target,'model')))throw new CoachError('INPUT');
 if(target.mode==='session'&&![target.provider,target.model].every(x=>typeof x==='string'&&x.length>0&&x.length<=160&&!/[\u0000-\u001f]/.test(x)))throw new CoachError('INPUT');
 if([target.model,target.provider,...choices.map(x=>x.text)].some(s=>typeof s==='string'&&suspiciousText(s)))throw new CoachError('SENSITIVE');
 if(review){if(typeof candidate!=='string'||!candidate.trim()||candidate.length>MAX_REWRITE)throw new CoachError('INPUT');if(suspiciousText(candidate))throw new CoachError('SENSITIVE');}else if(candidate!==undefined)throw new CoachError('INPUT');
 if(repair!==undefined){
  if(!repairAllowed||review||reviewMode!=='auto'||!object(repair)||Object.keys(repair).some(k=>!['candidate','review'].includes(k)))throw new CoachError('INPUT');
  parseRewriteCandidate(JSON.stringify({kind:'rewrite',text:repair.candidate,changes:[],uncertainties:[]}),v);
  if(suspiciousText(JSON.stringify(repair)))throw new CoachError('SENSITIVE');
  const r=repair.review;
  if(!object(r)||!['blocked','conflict','uncertain'].includes(r.state)||Object.keys(r).some(k=>!['state','findings','uncertainties'].includes(k)))throw new CoachError('INPUT');
  if(r.state==='blocked'){if(!Array.isArray(r.findings)||r.findings.length||!Array.isArray(r.uncertainties)||r.uncertainties.length)throw new CoachError('INPUT');}
  else {const grounded=validateReview(JSON.stringify({verdict:r.state,findings:r.findings,uncertainties:r.uncertainties}),v,repair.candidate);if(grounded.state!==r.state||!grounded.findings.length)throw new CoachError('INPUT');}
 }
 return {...base,selectedMethods:choices,protocolVersion:ANALYSIS_PROTOCOL,expectedRulesHash,target:{...target},reviewMode,...(review?{candidate}:{}),...(repair?{repair:structuredClone(repair)}:{})};
}
export function analysisReady(status){return status?.ok===true&&status.analysisProtocol===ANALYSIS_PROTOCOL&&status.rulesHash===RULES_HASH&&status.capabilities?.review===REVIEW_CAPABILITY;}
