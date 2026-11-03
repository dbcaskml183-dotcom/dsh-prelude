import {suspiciousText} from './prompt-contract.mjs';
import {relativeCodeFrames} from './error-diagnostics.mjs';
import {MAX_DRAFT} from './method-limits.mjs';
import {checkModelSuggestions} from './result-validation.mjs';
export const PROTOCOL=4;
export const QUESTIONS=Object.freeze({outcome:'你希望最后得到什么结果？',target:'这次具体要处理什么内容？',scope:'这次希望处理到什么范围？'});
export const MESSAGES=Object.freeze({CLEANUP:'模型流收尾未确认或失败；已保留可用候选，不启动后续模型阶段，也不自动重试。',SKILL_UNAVAILABLE:'所选技能暂不可确认，请刷新或重新选择通用写法；原稿和已确认文字保留，未调用模型。',OUTPUT_LIMIT:'模型输出达到宿主或模型的长度上限，本阶段未完整结束；原稿保留，不自动重试。',REWRITE_RESULT:'模型没有返回可用的整稿候选；原稿未改动，不自动重试。',REWRITE_CONSTRAINT:'候选删改了受保护的要求，或增写了权限、预算、输出格式等限制，未采用；请核对原稿，不自动重试。',PROTOCOL:'Prelude已更新，请刷新页面后再试。',INPUT:'请求格式或大小不符合要求。',SENSITIVE:'草稿或补充背景疑似含凭据，请移除敏感值后再细化。',LEDGER:'调用记录暂不可用；本地方法库仍可使用，不自动重试。',MODEL:'智能细化暂不可用；本地方法库仍可使用，不自动重试。',RESULT:'模型未返回有效建议；本地方法库仍可使用，不自动重试。',CANCELLED:'已取消或超时；已开始的调用可能产生费用。',SESSION:'当前会话尚未在宿主登记，请刷新会话后重试；未调用模型。',SESSION_SERVICE:'宿主会话服务不可用；未调用模型，请检查会话服务。',LEDGER_LOCK:'调用记录被旧版锁阻止；请在Prelude设置查看存储诊断，不会自动抢锁。',LEDGER_BUSY:'另一写入者正在提交调用记录，请稍后手动重试；未启动新的模型调用。',ROUTE:'请选择当前宿主可用的模型；不会自动换用其他线路。'});
export class CoachError extends Error{constructor(code){super(Object.hasOwn(MESSAGES,code)?MESSAGES[code]:MESSAGES.MODEL);this.code=code;}}
// Display only a finite SDK failure category, never provider messages or causes.
const MODEL_CODES=new Set(['TRANSPORT','TIMEOUT','RATE_LIMIT','QUOTA','ACCOUNT_QUOTA','MISSING_CREDENTIAL','INVALID_CREDENTIAL','AUTH','PERMISSION','UNKNOWN_MODEL','NO_ADAPTER','REQUEST_EXTENSION','INVALID_PREPARED_CALL','CONTEXT_WINDOW_EXCEEDED','INVALID_ARGS','UNKNOWN']);
export function modelFailure(failure){const e=new CoachError('MODEL');if(MODEL_CODES.has(failure?.code))e.modelCode=failure.code;return e;}
export function publicError(error){const text=error instanceof CoachError&&Object.hasOwn(MESSAGES,error.code)?MESSAGES[error.code]:MESSAGES.MODEL;return error instanceof CoachError&&error.code==='MODEL'&&MODEL_CODES.has(error.modelCode)?text+'（宿主分类：'+error.modelCode+'）':text;}
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k));
export function parseRequest(v){
 if(!object(v)||v.protocolVersion!==PROTOCOL)throw new CoachError('PROTOCOL');
 if(!keys(v,['protocolVersion','requestId','draft','materials','context','explicitRequirements','selectedEvidence','sessionId','draftRev','analysisScope','route'])||typeof v.draft!=='string'||v.draft.length>MAX_DRAFT||typeof v.requestId!=='string'||!/^[-\w]{8,100}$/.test(v.requestId))throw new CoachError('INPUT');
 const m=v.materials===undefined?{attachmentCount:0,referenceCount:0}:v.materials;
 if(!keys(m,['attachmentCount','referenceCount'])||![m.attachmentCount,m.referenceCount].every(n=>Number.isInteger(n)&&n>=0&&n<=100))throw new CoachError('INPUT');
 if((v.context!==undefined&&typeof v.context!=='string')||(v.explicitRequirements!==undefined&&typeof v.explicitRequirements!=='string'))throw new CoachError('INPUT');
 const context=v.explicitRequirements??v.context??'';
 if(typeof context!=='string'||context.length>2000)throw new CoachError('INPUT');
 const route=v.route??null;
 if(route!==null&&(!keys(route,['provider','model'])||![route.provider,route.model].every(s=>typeof s==='string'&&s.length>0&&s.length<=160&&!/[\u0000-\u001f]/.test(s))))throw new CoachError('INPUT');
 const evidence=v.selectedEvidence??[];
 if(!Array.isArray(evidence)||evidence.length>8||evidence.some(x=>!keys(x,['id','source','text','label','coverage'])||typeof x.id!=='string'||x.id.length>200||!['history-user','history-assistant','attachment-text','pasted'].includes(x.source)||typeof x.text!=='string'||x.text.length>4000||typeof x.label!=='string'||x.label.length>160||typeof x.coverage!=='string'||x.coverage.length>160)||evidence.reduce((n,x)=>n+x.text.length,0)>4000)throw new CoachError('INPUT');
 if(v.sessionId!==undefined&&(typeof v.sessionId!=='string'||!/^[-\w.:]{1,200}$/.test(v.sessionId)))throw new CoachError('INPUT');
 if(v.draftRev!==undefined&&(!Number.isSafeInteger(v.draftRev)||v.draftRev<0))throw new CoachError('INPUT');
 if(v.analysisScope!==undefined&&!['draft','selection'].includes(v.analysisScope))throw new CoachError('INPUT');
 if([v.draft,context,...evidence.flatMap(x=>[x.id,x.label,x.coverage,x.text])].some(suspiciousText))throw new CoachError('SENSITIVE');
 return {protocolVersion:PROTOCOL,requestId:v.requestId,draft:v.draft,materials:{attachmentCount:m.attachmentCount,referenceCount:m.referenceCount},context,explicitRequirements:context,selectedEvidence:evidence.map(x=>({...x})),sessionId:v.sessionId,draftRev:v.draftRev,analysisScope:v.analysisScope??'draft',route:route?{provider:route.provider,model:route.model}:null};
}
export function validateDecision(raw,draft,methods){
 try{
  if(typeof raw!=='string'||raw.length>9000)throw 0;
  const v=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));
  if(!keys(v,['kind','suggestions','missing','note'])||!['suggestions','needs_context','no_suggestion','uncertain','unavailable'].includes(v.kind)||!Array.isArray(v.suggestions))throw 0;
  if(v.note!==undefined&&(typeof v.note!=='string'||v.note.length>160||/[<>]/.test(v.note)))throw 0;
  if(v.kind!=='suggestions'&&v.suggestions.length)throw 0;
  if(v.kind==='needs_context'&&!Object.hasOwn(QUESTIONS,v.missing))throw 0;
  if(v.kind!=='needs_context'&&v.missing!==undefined)throw 0;
  const {suggestions,filtered}=checkModelSuggestions(JSON.stringify({suggestions:v.suggestions}),draft,methods);
  if(v.kind==='suggestions'&&!suggestions.length)return filtered.covered===v.suggestions.length&&filtered.covered?{kind:'no_suggestion',suggestions:[],note:'所荐方法在当前文字中已体现，无需重复补入；不代表原稿已经最优。'}:{kind:'uncertain',suggestions:[],note:'本次未确认有效增量，可继续使用原稿或查看方法库；不会自动重试。'};
  return {kind:v.kind,suggestions,...(v.kind==='needs_context'?{question:QUESTIONS[v.missing],missing:v.missing,note:'只补最关键的一点即可，也可以跳过。'}:v.note?{note:v.note}: {})};
 }catch{throw new CoachError('RESULT');}
}

// Only finite categories and installed-code frame locations leave the error boundary.
export function failureFacts(e,{codeRoots=[]}={}){
 try{const allowed=new Set(['Error','TypeError','RangeError','ReferenceError','HarnessError','LlmError','CoachError']);const code=MODEL_CODES.has(e?.modelCode)?e.modelCode:MODEL_CODES.has(e?.code)?e.code:e instanceof CoachError&&e.code==='OUTPUT_LIMIT'?'OUTPUT_LIMIT':'UNKNOWN';return {type:allowed.has(e?.name)?e.name:'Error',code,frames:relativeCodeFrames(e?.stack,codeRoots)};}catch{return {type:'Error',code:'UNKNOWN',frames:[]};}
}
