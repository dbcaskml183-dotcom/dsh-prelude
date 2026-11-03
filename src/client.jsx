import {VisibleMethodList} from './method-list.jsx';
import {composeRequirements,methodChoice,toggleMethod,restoreMethods} from '../shared/method-selection.mjs';
import {ReviewControls} from './review-controls.jsx';
import {ANALYSIS_PROTOCOL,analysisReady} from '../shared/analysis-contracts.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {RewriteController} from '../client/rewrite-controller.mjs';
import {RewriteView} from './rewrite-view.jsx';
import {BundlePicker} from './bundles.jsx';
import bundleCatalog from '../bundles.json';
import {DOMAINS} from '../shared/catalog-registry.mjs';
import {BRAND} from '../shared/brand.mjs';
import {PreludeSettings} from './settings.jsx';
import {SETTINGS_SHELL_CSS} from '../client/settings-shell.mjs';
import {createSessionScope} from '../client/session-scope.mjs';
import {isBehindModal} from '@deepseek-ai/dsh-client-ui-primitives';
import React,{useEffect,useRef,useState,useMemo,useSyncExternalStore} from 'react';
import catalog from '../methods.json' with {type:'json'};
import sourceCatalog from '../sources.json';
import styles from './styles.css';
import {CATEGORIES,MAX_DRAFT} from '../shared/method-limits.mjs';
import {localSuggestions,coveredMethods} from '../shared/method-policy.mjs';
import {searchCatalog as searchMethods} from '../shared/catalog-search.mjs';
import {preflightDecision} from '../shared/policy.mjs';
import {deadlineFetch} from '../shared/async.mjs';
import {materialFacts,inputFingerprint} from '../client/input-adapter.mjs';
import {mountCoachPopover} from '../client/popover.mjs';
import {routePresentation,decisionPresentation,panelOpenPatch,hydratePanelDefaults,panelDisclosureTouch,panelDisclosureChange,panelDisclosureOpen} from '../client/presentation.mjs';
import {createSessionBuckets,taskResetPatch,taskResetToken} from '../client/session-buckets.mjs';
import {RequestController} from '../client/request-controller.mjs';
import {nativeServices,nativeStore,connectNative,getDirectory,resolveRoute} from '../client/native-adapter.mjs';
import {LibraryController} from '../client/library-controller.mjs';
import {MethodCard,RouteControls,PersonalLibrary,MaterialControls} from './components.jsx';
export const inject=['slots'];
const methods=catalog.methods,sources=Array.isArray(sourceCatalog)?sourceCatalog:sourceCatalog.sources||sourceCatalog;
const library=new LibraryController(),EMPTY_DIRECTORY={current:null,groups:[]};
const sessionScope=createSessionScope();
const buckets=createSessionBuckets(actions=>{
 let state={...taskResetPatch(0),...panelOpenPatch(),open:false,surfaceVisible:false,tab:'suggest',availableSkills:[],expanded:false,statusConfig:null,ledgerError:null,rewriteAvailable:false,analysisAvailable:false};const listeners=new Set();let disposed=false;
 const b={actions,rewrite:new RewriteController({methods,getSkills:()=>state.availableSkills}),position:{},gate:new RequestController(),span:null,ownEdit:false,generatedChoices:[],previewDirty:false,previewVersion:0,previewChanged:dirty=>{b.previewDirty=dirty;b.previewVersion++;},subscribe:fn=>{if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},get:()=>state,set:patch=>{if(disposed)return;state={...state,...patch};for(const fn of listeners)fn();},cancel:()=>{b.gate.cancel();b.set({pending:false,decision:null,decisionSource:null});},dispose:()=>{if(disposed)return;disposed=true;listeners.clear();const errors=[];for(const clean of [()=>b.gate.cancel(),()=>b.rewrite.dispose()])try{clean();}catch(e){errors.push(e);}state={...state,open:false,pending:false,decision:null,decisionSource:null};b.span=null;b.trigger=null;if(errors.length)throw new AggregateError(errors,'Prelude session cleanup failed');}};return b;
});
const bind=(actions,sessionId)=>buckets.get(sessionId,actions);

function Entry(props){
 const input=props.useInput(s=>s),b=bind(props.inputActions,props.sessionId),ui=useSyncExternalStore(b.subscribe,b.get);
 useEffect(()=>{b.activate();sessionScope.set(props.sessionId);},[b,props.sessionId]);
 const hits=localSuggestions({draft:input.draft,context:ui.context},methods,ui.hidden);
 return <button type="button" className="pc-entry" ref={el=>{if(el)b.trigger=el;}} data-testid="prompt-coach-entry" aria-expanded={ui.open&&ui.surfaceVisible} aria-label={BRAND.entryLabel} title={ui.open&&!ui.surfaceVisible?'Prelude暂时让位；关闭其他窗口后恢复，点击可尝试恢复':BRAND.title} onMouseDown={e=>{b.span=props.inputActions?.captureInsertion?.();e.preventDefault();}} onClick={()=>{sessionScope.set(props.sessionId);if(ui.open&&!ui.surfaceVisible){b.surface?.resume();return;}if(ui.open){b.cancel();b.rewrite.cancel();b.set({open:false,resetConfirmation:null});}else{const n=nativeStore.getSnapshot();b.set({open:true,message:'',...panelOpenPatch(n.config,n.formStatus==='ready')});}}}><span>{BRAND.short}</span>{hits.length>0&&<span className="pc-dot" aria-label="有可参考的方法"/>}</button>;
}
function Panel(props){
 const {inputActions:actions,sessionId}=props,input=props.useInput(s=>s),chat=props.useConversation?.(s=>s.views.get('chat'));
 const b=bind(actions,sessionId);useEffect(()=>{b.activate();},[b]);const ui=useSyncExternalStore(b.subscribe,b.get),rewriteState=useSyncExternalStore(b.rewrite.subscribe,b.rewrite.getSnapshot),native=useSyncExternalStore(nativeStore.subscribe,nativeStore.getSnapshot),personal=useSyncExternalStore(library.subscribe,library.getSnapshot);
 // A blank session can become resident after this panel first renders. The
 // resolver already caches real directories; never memoize a missing scope.
 const directory=getDirectory(sessionId);
 const directoryStore=directory?.store;
 const directoryBinding=useMemo(()=>directoryStore?{subscribe:directoryStore.subscribe.bind(directoryStore),getSnapshot:directoryStore.getSnapshot.bind(directoryStore)}:{subscribe:()=>()=>{},getSnapshot:()=>EMPTY_DIRECTORY},[directoryStore]);
 const modelState=useSyncExternalStore(directoryBinding.subscribe,directoryBinding.getSnapshot);
 const composition=useRef(false),[composing,setComposing]=useState(false);
 useEffect(()=>{const start=()=>{composition.current=true;setComposing(true);},end=()=>{composition.current=false;setComposing(false);};window.addEventListener('compositionstart',start,true);window.addEventListener('compositionend',end,true);return()=>{window.removeEventListener('compositionstart',start,true);window.removeEventListener('compositionend',end,true);};},[]);
 const [query,setQuery]=useState(''),[category,setCategory]=useState('全部'),[domain,setDomain]=useState('全部'),[onlyFavorite,setOnlyFavorite]=useState(false),[routeBusy,setRouteBusy]=useState(false);
 const rootRef=useRef(null),panelRef=useRef(null),scrollRef=useRef(null),positionRef=useRef(null),live=useRef(null),resetTriggerRef=useRef(null),selectedSectionRef=useRef(null),focusSelection=useRef(false);
 const config=native.formStatus==='ready'?native.config:ui.statusConfig||native.config,route=resolveRoute(config,directory);
 const routeView=routePresentation(config,route,modelState);
 const facts=materialFacts(input),selected=ui.selection?.rev===input.draftRev?ui.selection:null;
 const selectedEvidence=ui.evidence.filter(e=>!e.id.startsWith('file-')||(input.attachmentIds||[]).includes(e.id.slice(5)));
 const target=config.targetMode==='session'&&modelState.current?.provider&&modelState.current?.model?{mode:'session',provider:modelState.current.provider,model:modelState.current.model}:{mode:'generic'};
 const preferencesReady=native.formStatus==='ready'&&typeof config.autoReview==='boolean'&&['generic','session'].includes(config.targetMode);
 const baseRequest={expectedRulesHash:RULES_HASH,reviewMode:config.autoReview?'auto':'manual',target,draft:selected?.text??input.draft,explicitRequirements:ui.context,context:ui.context,selectedEvidence,materials:facts,sessionId,draftRev:input.draftRev,analysisScope:selected?'selection':'draft',route};
 const compositionResult=composeRequirements(baseRequest,ui.methodChoices,methods,ui.availableSkills);
 const request={...baseRequest,selectedMethods:compositionResult.selectedMethods};
 const analysisFingerprint=inputFingerprint(sessionId,input,JSON.stringify([ui.resetGeneration,ui.context,[...ui.availableSkills].sort(),selectedEvidence,selected,native.generation,{routeMode:config.routeMode,provider:config.provider,model:config.model,target},modelState.current]),route);
 const fingerprint=JSON.stringify([analysisFingerprint,ui.methodChoices]);
 live.current={fingerprint,sessionId,input};
 const workCurrent=()=>b.get().open&&b.get().resetGeneration===ui.resetGeneration&&live.current?.sessionId===sessionId&&b.actions===actions;
 const message=text=>{if(workCurrent())b.set({message:text});};
 const previewChanged=dirty=>{if(b.get().resetGeneration===ui.resetGeneration)b.previewChanged(dirty);};
 const disclosure=(id,instanceId)=>({open:panelDisclosureOpen(ui,id,instanceId),'data-pc-disclosure':id,onClickCapture:e=>{
  if(!workCurrent()||!e.currentTarget.isConnected||e.target.closest?.('summary')?.parentElement!==e.currentTarget||(id==='methodBody'&&!methods.some(m=>m.id===instanceId)))return;
  const patch=panelDisclosureTouch(b.get(),id,instanceId);if(patch)b.set(patch);
 },onToggle:e=>{
  if(!workCurrent()||!e.currentTarget.isConnected||!panelRef.current?.contains(e.currentTarget)||(id==='methodBody'&&!methods.some(m=>m.id===instanceId)))return;
  const patch=panelDisclosureChange(b.get(),id,e.currentTarget.open,instanceId);if(patch)b.set(patch);
 }});
 useEffect(()=>{const patch=hydratePanelDefaults(b.get(),native.config,native.formStatus==='ready');if(patch)b.set(patch);},[b,ui.open,native.config,native.formStatus]);
 useEffect(()=>{
  const navigate=focusSelection.current&&ui.tab==='suggest';
  focusSelection.current=false;
  if(navigate){
   if(!b.get().open||!b.get().surfaceVisible)return;
   selectedSectionRef.current?.scrollIntoView({block:'nearest'});
   selectedSectionRef.current?.focus({preventScroll:true});
  }else scrollRef.current?.scrollTo?.({top:0});
 },[ui.tab,b]);
 const localDecision=preflightDecision(request,methods);
 const local=localDecision?.suggestions||localSuggestions(request,methods,ui.hidden);
 const reflected=useMemo(()=>coveredMethods(baseRequest,methods),[fingerprint]);
 // Selection changes invalidate requests/candidates, but keep the completed
 // analysis visible so users can finish choosing from its original cards.
 useEffect(()=>{b.gate.cancel();b.set({pending:false});},[fingerprint]);
 useEffect(()=>{b.cancel();b.span=null;b.set({hidden:[],message:b.ownEdit?b.get().message:'',...(selectedEvidence.length!==ui.evidence.length?{evidence:selectedEvidence}:{}),...(b.get().selection?.rev!==input.draftRev?{selection:null}:{})});b.ownEdit=false;},[analysisFingerprint]);
 useEffect(()=>()=>{b.cancel();b.rewrite.cancel();b.set({open:false,resetConfirmation:null});},[b,sessionId]);
 useEffect(()=>{
  if(!ui.open)return;const ac=new AbortController();
  library.load();
  deadlineFetch('/api/prompt-coach/v4/status',{credentials:'same-origin',cache:'no-store',signal:ac.signal},5000).then(r=>r.json()).then(v=>{if(!ac.signal.aborted&&v.ok&&v.protocolVersion===4)b.set({availableSkills:v.availableSkills||[],statusConfig:v.config,ledgerError:v.ledgerError,rewriteAvailable:analysisReady(v),analysisAvailable:analysisReady(v)});}).catch(()=>{if(!ac.signal.aborted)message('智能服务暂不可用；本地方法库仍可使用。');});
  return()=>ac.abort();
 },[ui.open,native.generation]);
 const close=()=>{b.cancel();b.rewrite.cancel();b.set({open:false,resetConfirmation:null});b.trigger?.focus();};
 useEffect(()=>{if(!ui.open)return;const off=mountCoachPopover(panelRef.current,rootRef.current,close,window,ui.expanded,b.position,{isBehindModal,onVisibility:value=>{if(b.get().surfaceVisible!==value)b.set({surfaceVisible:value});}});positionRef.current=off;b.surface=off;return()=>{off();if(b.surface===off)b.surface=null;positionRef.current=null;};},[ui.open,ui.expanded]);
 useEffect(()=>{positionRef.current?.update?.();},[fingerprint,ui.tab,ui.message]);
 const refine=async()=>{
  if(!workCurrent())return;
  if(live.current.fingerprint!==fingerprint)return message('草稿或依据刚有变化，请再次操作；未发出请求。');
  if(!compositionResult.valid)return message(compositionResult.issues.join(' '));
  if(!preferencesReady||!ui.analysisAvailable)return message('AI能力或偏好尚未就绪，请刷新或稍后重试；本地方法可用。');
  if(ui.pending||routeBusy||['generating','reviewing','repairing'].includes(rewriteState.phase))return;
  if(request.draft.length>MAX_DRAFT)return message('整稿超过4000字符；请选中一段再细化，方法库和原稿发送仍可使用。');
  if(localDecision)return b.set({decision:localDecision,decisionSource:'local',message:'已在本地检查，未调用模型。'});
  if(!route)return message('当前没有可用模型路线；请选择主会话模型或固定路线，本地方法库仍可用。');
  if(ui.ledgerError)return message(ui.ledgerError);
  const ticket=b.gate.begin(fingerprint),requestId=crypto.randomUUID();
  b.set({pending:true,decision:null,message:`正在分析：仅发送${selected?'所选草稿段落':'当前草稿'}、补充要求和${selectedEvidence.length}条已选资料。`});
  try{
   const r=await deadlineFetch('/api/prompt-coach/v8/suggest',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({protocolVersion:ANALYSIS_PROTOCOL,requestId,...request}),signal:ticket.abort.signal},50000);
   const v=await r.json();if(!b.gate.valid(ticket,live.current.fingerprint))return;
   if(!v.ok||v.protocolVersion!==ANALYSIS_PROTOCOL||v.rulesHash!==RULES_HASH||v.requestId!==requestId)return b.set({pending:false,message:typeof v.error==='string'?v.error:'返回身份不符，未采用结果。'});
   b.set({pending:false,decision:v.decision,decisionSource:v.modelUsed?'model':'local',ledgerError:v.ledgerError||null,message:v.ledgerError|| (v.modelUsed?'分析已完成；请选择适用方法，不会自动改写或发送。':'已在本地检查，未调用模型。')});
  }catch{if(b.gate.valid(ticket,live.current.fingerprint))b.set({pending:false,message:'细化失败、取消或超时；已开始的调用可能计费。本地建议仍可用，不自动重试。'});}
 };
 const rewriteCurrent={sessionId,actions,input,requestKey:fingerprint,composing};
 const getCurrentRewrite=()=>({sessionId:live.current?.sessionId,actions,input:live.current?.input,requestKey:live.current?.fingerprint,composing:composition.current});
 useEffect(()=>{b.rewrite.invalidate(rewriteCurrent);},[fingerprint]);
 const generateReason=selected?'当前为选段分析，整稿改写不可用。':input.draft.length>MAX_DRAFT?'完整草稿超过4000字符；可缩短草稿，或仅分析选段。':'';
 const generateNow=async()=>{if(!workCurrent())return;if(generateReason)return message(generateReason);if(live.current.fingerprint!==fingerprint)return message('草稿或依据刚有变化，请再次操作；未发出请求。');if(!compositionResult.valid)return message(compositionResult.issues.join(' '));b.generatedChoices=structuredClone(ui.methodChoices);if(!preferencesReady||!ui.rewriteAvailable)return message('宿主整稿接口尚未就绪，请确认前后端版本匹配后重新打开面板；原稿未改动。');if(ui.pending||routeBusy||['generating','reviewing','repairing'].includes(rewriteState.phase))return;if(ui.ledgerError)return message(ui.ledgerError);const result=await b.rewrite.start({protocolVersion:ANALYSIS_PROTOCOL,requestId:crypto.randomUUID(),...request},getCurrentRewrite());if(result?.ledgerError)b.set({ledgerError:result.ledgerError});};
 const reviewCurrent=async()=>{if(!workCurrent())return;if(ui.ledgerError)return message(ui.ledgerError);const result=await b.rewrite.reviewCurrent(getCurrentRewrite());if(result?.ledgerError)b.set({ledgerError:result.ledgerError});};
 const repairCurrent=async()=>{if(!workCurrent())return;if(ui.pending||routeBusy||ui.ledgerError)return message(ui.ledgerError||'请等待当前操作完成。');try{const result=await b.rewrite.repairCurrent(getCurrentRewrite());if(result?.ledgerError)b.set({ledgerError:result.ledgerError});}catch{b.rewrite.publish({message:'修稿未能完成；保留候选和审校意见，请核对后重试。'});}};
 const resetToken=()=>taskResetToken(b.get(),b.rewrite.getSnapshot(),b.previewVersion,b.rewrite.receipt);
 const resetAllowed=()=>{
  if(!workCurrent())return false;
  if(composition.current||live.current.input.phase!=='plain'){message('请完成输入、提交或会话切换后，再重新开始；当前工作保留。');return false;}return true;
 };
 const performReset=key=>{
  if(!resetAllowed())return;
  if(key&&key!==resetToken()){b.set({resetConfirmation:null,message:'工作内容已变化，请重新核对后再开始；当前工作保留。'});resetTriggerRef.current?.focus({preventScroll:true});return;}
  const next=b.get().resetGeneration+1;
  b.gate.cancel();b.rewrite.dismiss();b.span=null;b.ownEdit=true;b.generatedChoices=[];b.previewDirty=false;b.previewVersion++;
  b.set({...taskResetPatch(next),tab:'suggest',message:'已按当前草稿重新开始；尚未调用模型。需要时可重新选择资料和方法。'});
  scrollRef.current?.scrollTo?.({top:0});resetTriggerRef.current?.focus({preventScroll:true});
 };
 const requestReset=()=>{
  if(!resetAllowed())return;
  const current=b.get(),r=b.rewrite.getSnapshot(),protectedWork=[];
  if(current.context.trim())protectedWork.push('你填写的补充要求');
  if(r.edited&&r.candidate)protectedWork.push('你手改的候选');
  if(b.previewDirty)protectedWork.push('你编辑但未采用的资料预览');
  if(b.rewrite.comparisonStatus(getCurrentRewrite())==='applied')protectedWork.push('本次替换的快捷撤回');
  if(protectedWork.length){b.set({resetConfirmation:{kind:'reset',token:resetToken(),items:protectedWork}});scrollRef.current?.scrollTo?.({top:0});}
  else performReset();
 };
 const generateRewrite=async()=>{
  if(!workCurrent())return;
  if(generateReason)return message(generateReason);
  const r=b.rewrite.getSnapshot();
  if(r.edited&&r.candidate){b.set({resetConfirmation:{kind:'generate',token:resetToken(),items:['你手改的候选']}});scrollRef.current?.scrollTo?.({top:0});return;}
  return generateNow();
 };
 const confirmWork=async()=>{
  if(!workCurrent())return;
  const intent=b.get().resetConfirmation;if(!intent)return;
  if(intent.token!==resetToken()){b.set({resetConfirmation:null,message:'工作内容已变化，请重新核对后再操作；当前工作保留。'});resetTriggerRef.current?.focus({preventScroll:true});return;}
  if(intent.kind==='reset')performReset(intent.token);
  else{b.set({resetConfirmation:null});resetTriggerRef.current?.focus({preventScroll:true});await generateNow();}
 };
 const chooseSelection=()=>{const span=actions?.captureInsertion?.();if(!span||span.draftRev!==input.draftRev||span.end<=span.start)return message('请先在输入框选中要分析的一段文字，再点此按钮。');const text=input.draft.slice(span.start,span.end);if(text.length>4000)return message('所选段落超过4000字符，请缩小选择范围；未截断。');b.set({selection:{text,rev:input.draftRev}});};
 if(!ui.open)return null;
 const decision=ui.decision||localDecision,suggestions=(decision?.suggestions??local).filter(s=>!ui.hidden.includes(s.methodId));
 const decisionView=decisionPresentation({pending:ui.pending,source:ui.decisionSource,kind:decision?.kind,count:suggestions.length});
 const list=searchMethods(methods,query,category,onlyFavorite?personal.value?.favorites||[]:null,sources,domain);
 const methodBusy=ui.pending||routeBusy||['generating','reviewing','repairing'].includes(rewriteState.phase);
 const chooseMethod=(m,variant,generic=false)=>{if(!workCurrent()||live.current.fingerprint!==fingerprint||methodBusy)return;try{const choice=b.get().methodChoices.find(x=>x.id===m.id&&x.variant===variant)||methodChoice(m,variant,generic?[]:ui.availableSkills);const next=toggleMethod(b.get().methodChoices,choice),result=composeRequirements(baseRequest,next,methods,ui.availableSkills);if(!result.valid&&next.length>=b.get().methodChoices.length)return message(result.issues.join(' '));b.set({methodChoices:next,message:next.some(x=>x.id===m.id)?'已选为本次改写依据；尚未改写或发送。':'已取消该方法；下次改写不会使用它。'});}catch(e){message(e.message);}};
 const applyRewrite=()=>{if(!workCurrent())return;if(b.rewrite.apply(getCurrentRewrite()))b.set({appliedChoices:structuredClone(b.generatedChoices||[]),methodChoices:[]});};
 const undoRewrite=()=>{if(!workCurrent())return;if(b.rewrite.undo(getCurrentRewrite()))b.set({methodChoices:restoreMethods(b.get().appliedChoices,b.get().methodChoices),appliedChoices:[]});};
 const cardProps={methods,request:baseRequest,actions,input,b,availableSkills:ui.availableSkills,sources,library,message,chosenMethods:ui.methodChoices,onChooseMethod:chooseMethod,methodBusy,workCurrent,capture:()=>{if(workCurrent())b.span=actions?.captureInsertion?.();}};
 return <section className="pc-root" ref={rootRef} aria-label={BRAND.title} data-testid="prompt-coach-panel"><div ref={panelRef} popover="manual" tabIndex={-1} className="pc-panel" aria-label={BRAND.title+'面板'}>
  {(ui.expanded?['w','e']:['n','s','w','e','nw','ne','sw','se']).map(edge=><span key={edge} className={'pc-resize pc-resize-'+edge} data-pc-resize={edge} tabIndex={0} role="button" aria-label={'调整Prelude大小：'+({n:'上边',s:'下边',w:'左边',e:'右边',nw:'左上角',ne:'右上角',sw:'左下角',se:'右下角'}[edge])} title="拖动调整大小；方向键微调，Home复位"/>)}
  <header className="pc-top"><div className="pc-drag-handle" data-pc-drag-handle="true" role="button" tabIndex={0} aria-label={ui.expanded?'移动Prelude面板：展开时仅左右；方向键移动，回车复位':'移动Prelude面板：拖动或方向键移动，回车复位'} title={ui.expanded?'拖动标题左右移动；方向键微调，回车或双击复位位置与大小':'拖动标题移动；方向键微调，回车或双击复位位置与大小'}><strong>{BRAND.title}</strong></div><div className="pc-actions"><button type="button" className="pc-button" aria-pressed={ui.expanded} onClick={()=>b.set({expanded:!ui.expanded})}>{ui.expanded?'收起':'展开'}</button><button type="button" className="pc-button pc-close" aria-label={'关闭'+BRAND.short} onClick={close}>×</button></div></header>
  <nav className="pc-tabs" aria-label={BRAND.title+'页面'}>{[['suggest','当前建议'],['library','方法库 · '+methods.length],['custom','我的补句']].map(([id,label])=><button key={id} type="button" className="pc-tab" aria-pressed={ui.tab===id} onClick={()=>b.set({tab:id,message:''})}>{label}</button>)}</nav>
   <div className="pc-work-toolbar"><button type="button" className="pc-button" ref={resetTriggerRef} onClick={requestReset} title="保留输入框内容，清除这次分析、改写及所选依据；不会发送或调用模型。">换个需求，重新开始</button>
    {(ui.context.trim()||ui.methodChoices.length>0||selectedEvidence.length>0)&&<span className="pc-reason">当前仍选有：{[ui.methodChoices.length?ui.methodChoices.length+'项方法':'',selectedEvidence.length?selectedEvidence.length+'段资料':'',ui.context.trim()?'补充要求':''].filter(Boolean).join('、')}</span>}
   </div>
  <div className="pc-scroll" ref={scrollRef} aria-busy={ui.pending}>
    {ui.disclosureDefaultsPending&&<p className="pc-reason" role="status">{native.formStatus==='unavailable'?'默认展开偏好未读取，可手动开合。':'正在读取默认展开偏好，可先手动开合。'}</p>}
   {ui.resetConfirmation&&<section className="pc-work-confirm" aria-label="确认放弃本次工作"><strong>{ui.resetConfirmation.kind==='reset'?'重新开始前请确认':'重新生成前请确认'}</strong><p>输入框内容保留。{ui.resetConfirmation.kind==='reset'?'将清除本次分析、候选、方法和已选资料，其中包括：':'新候选将替换：'}{ui.resetConfirmation.items.join('、')}。</p><p className="pc-reason">{ui.resetConfirmation.kind==='reset'?'本地清理不调用模型；已经开始的调用仍可能计费。':'确认后才会按当前草稿生成，可能计费。'}</p><div className="pc-actions"><button type="button" className="pc-button pc-primary" onClick={confirmWork}>{ui.resetConfirmation.kind==='reset'?'确认重新开始':'确认重新生成'}</button><button type="button" className="pc-button" onClick={()=>{b.set({resetConfirmation:null});resetTriggerRef.current?.focus({preventScroll:true});}}>取消，保留工作</button></div></section>}
   {ui.message&&<p className="pc-message" role="status">{ui.message}</p>}
   {ui.tab==='suggest'&&<>
    <div className="pc-summary-row"><span className="pc-badge">{decisionView.label}</span><span>{decisionView.hint}</span></div>
    {ui.decisionSource==='model'&&<p className="pc-reason">选卡不会重新分析；需要时可再次点击“分析提示词”。</p>}
     {reflected.length>0&&<details {...disclosure('reflected')} className="pc-detail"><summary>当前文字已体现的方法 · {reflected.length}</summary>{reflected.map(x=><p key={x.methodId}><strong>{x.label}</strong>：<q>{x.evidence[0]?.quote}</q>；无需重复补入。</p>)}</details>}
    <details {...disclosure('model')} className="pc-model"><summary><span className="pc-summary-label">{routeView.mode}</span><span className="pc-summary-value" title={routeView.label}>{routeView.label}</span></summary><RouteControls {...{sessionId,message}} onBusy={setRouteBusy}/><ReviewControls target targetOnly busy={ui.pending||['generating','reviewing','repairing'].includes(rewriteState.phase)} message={message}/></details>
    <p className="pc-cost-note">本地方法免费；分析、改写按模型计费。可直接改写。</p>
    <details {...disclosure('requirements')} className="pc-context"><summary>补充要求（可选）</summary><textarea className="pc-input" aria-label="补充要求" maxLength={2000} placeholder="例如：本轮只调查、不修改；不要MVP。与你的草稿一起检查，不在本插件永久保存。" value={ui.context} onChange={e=>b.set({context:e.target.value})}/></details>
    <MaterialControls disclosure={disclosure('materials')} key={'materials:'+ui.resetGeneration} workCurrent={workCurrent} onPreviewChange={previewChanged} services={nativeServices} {...{sessionId,input,chat,message}} evidence={selectedEvidence} onChange={evidence=>{if(workCurrent())b.set({evidence});}}/>
    {(input.draft.length>4000||selected)&&<div className="pc-message">{selected?`仅分析你选中的${selected.text.length}字符，不代表全稿已读。`:'草稿超过4000字符；可选段做补句细化，整稿改写暂不可用，不会截断。'}<div className="pc-actions"><button type="button" className="pc-button" onMouseDown={e=>e.preventDefault()} onClick={chooseSelection}>使用输入框选中段</button>{selected&&<button type="button" className="pc-button" onClick={()=>b.set({selection:null})}>取消选段</button>}</div></div>}
    {(!localDecision||ui.pending)&&<div className="pc-actions pc-refine"><button type="button" className="pc-button pc-primary" onClick={refine} disabled={!preferencesReady||!ui.analysisAvailable||ui.pending||routeBusy||['generating','reviewing','repairing'].includes(rewriteState.phase)||request.draft.length>4000}>{ui.pending?'正在分析…':'分析提示词'}</button>{ui.pending&&<button type="button" className="pc-button" onClick={()=>{b.cancel();message('已取消采用结果；已开始的调用可能产生费用。');}}>取消分析</button>}</div>}
    {decision?.kind==='needs_context'&&<div className="pc-question" role="status"><strong>{decision.question}</strong><p>{decision.note}</p><button type="button" className="pc-button" onClick={()=>b.set({tab:'library',decisionSource:'local',decision:{kind:'no_suggestion',suggestions:[],note:'已跳过补充；可直接发送原稿或挑选方法。'}})}>跳过，直接选方法</button></div>}
    {decision?.kind!=='needs_context'&&decision?.note&&<p className="pc-reason" role="status">{decision.note}</p>}
    {!suggestions.length&&!decision?.note&&<p className="pc-empty">{input.draft.trim().length<10?'先照常写需求，也可以去方法库挑选。':'本地未找到相关方法；不代表原稿已经充分。'}</p>}
    {suggestions.map(s=>{const m=methods.find(m=>m.id===s.methodId);return m?<MethodCard compact key={ui.resetGeneration+':'+m.id} {...cardProps} m={m} suggestion={s} bodyDisclosure={disclosure('methodBody',m.id)}/>:null;})}
    {ui.methodChoices.length>0&&<section ref={selectedSectionRef} tabIndex={-1} className="pc-method-selection" aria-label="本次改写的方法"><strong>本次改写 · 已选{ui.methodChoices.length}项</strong><div className="pc-actions">{ui.methodChoices.map(x=><button key={x.id} type="button" className="pc-button" disabled={methodBusy} aria-label={'取消用于改写：'+x.label} onClick={()=>b.set({methodChoices:ui.methodChoices.filter(c=>c.id!==x.id)})}>{x.label} ×</button>)}</div><details {...disclosure('effectiveRequirements')}><summary>本次补充要求预览</summary><pre className="pc-effective-requirements">{compositionResult.text}</pre></details><p className="pc-reason">所选方法将在下次改写时使用。</p>{compositionResult.redundant.length>0&&<p className="pc-reason">其中{compositionResult.redundant.length}项当前文字已体现，仅作核对依据，不机械追加。</p>}</section>}
    {compositionResult.issues.length>0&&<p className="pc-warning" role="status">{compositionResult.issues.join(' ')}</p>}
    <div className="pc-actions pc-rewrite-trigger"><button type="button" className="pc-button" disabled={!!generateReason||!compositionResult.valid||!preferencesReady||!ui.rewriteAvailable||ui.pending||routeBusy||['generating','reviewing','repairing'].includes(rewriteState.phase)} onClick={generateRewrite}>改写整稿</button><span className="pc-reason">{generateReason||(!compositionResult.valid?'所选方法暂不可用，请处理上方提示后再改写；原选择保留。':compositionResult.included.length?'结合已确认的'+compositionResult.included.length+'项方法生成候选。':rewriteState.phase==='applied'&&ui.appliedChoices.length?'本次已应用'+ui.appliedChoices.length+'项方法；再次改写需重新选择。':'未选方法：只整理原稿，不自动使用推荐。')}</span></div>
    <ReviewControls busy={ui.pending||['generating','reviewing','repairing'].includes(rewriteState.phase)} message={message}/>
    <RewriteView disclosure={disclosure} generateReason={generateReason} key={'rewrite:'+ui.resetGeneration} isCurrentWork={workCurrent} controller={b.rewrite} snapshot={rewriteState} current={rewriteCurrent} getCurrent={()=>(getCurrentRewrite())} onGenerate={generateRewrite} onReview={reviewCurrent} onRepair={repairCurrent} onApply={applyRewrite} onUndo={undoRewrite}/>
   </>}
   {ui.tab==='library'&&<>{ui.methodChoices.length>0&&<div className="pc-actions"><button type="button" className="pc-button" onClick={()=>{focusSelection.current=true;b.set({tab:'suggest'});}}>查看已选方法（{ui.methodChoices.length}）</button></div>}<div className="pc-tools"><input className="pc-input pc-search" aria-label="搜索方法" placeholder="搜术语、解释或补句中的字词" value={query} onChange={e=>setQuery(e.target.value)}/><select className="pc-input" aria-label="方法分类" value={category} onChange={e=>setCategory(e.target.value)}>{['全部',...CATEGORIES].map(c=><option key={c} value={c}>{c==='全部'?'全部阶段':c}</option>)}</select><select className="pc-input" aria-label="方法领域" value={domain} onChange={e=>setDomain(e.target.value)}>{['全部',...DOMAINS].map(d=><option key={d} value={d}>{d==='全部'?'全部领域':d}</option>)}</select><button type="button" className="pc-button" aria-pressed={onlyFavorite} onClick={()=>setOnlyFavorite(!onlyFavorite)}>收藏</button></div><BundlePicker disclosure={disclosure('bundles')} key={'bundles:'+ui.resetGeneration} bundles={bundleCatalog.bundles} cardProps={cardProps}/><p className="pc-search-summary" role="status">{list.length} / {methods.length} 张方法卡 · 空格分词，全部匹配</p>{list.length?<VisibleMethodList key={'catalog:'+sessionId+':'+ui.resetGeneration} items={list} cardProps={cardProps} scrollRef={scrollRef} fingerprint={fingerprint} filterKey={JSON.stringify([query,category,domain,onlyFavorite])}/>:<p className="pc-empty">暂无匹配方法，请换一个关键词。</p>}</>}
   {ui.tab==='custom'&&<PersonalLibrary view="daily" {...{library,methods,message}} cardProps={cardProps}/ >}
  </div><footer className="pc-note">{ui.tab==='suggest'&&rewriteState.phase!=='idle'?'整稿须先对比再采用；采用仅替换输入框，不自动发送。':'只补草稿，不自动发送；建议位置供参考，实际插到当前光标处。'}</footer>
 </div></section>;
}
function Settings(){const sessionId=useSyncExternalStore(sessionScope.subscribe,sessionScope.getSnapshot);return <PreludeSettings sessionId={sessionId} library={library} methods={methods}/>;}
export async function apply(ctx){
 connectNative(ctx);
 const style=document.createElement('style');style.dataset.promptCoach='v4';style.textContent=styles+'\n'+SETTINGS_SHELL_CSS;ctx.effect(()=>{document.head.append(style);return()=>style.remove();});
 const slots=ctx.get('slots');
 slots.inject('conversation.input.left',()=>slots.register({name:'conversation.input.left',id:'prompt-coach-entry',order:733},Entry));
 slots.inject('conversation.input.dock',()=>slots.register({name:'conversation.input.dock',id:'prompt-coach-panel',order:733},Panel));
 slots.inject('settings.section',()=>slots.register({name:'settings.section',id:'prompt-coach',order:742,label:BRAND.title},Settings));
 ctx.effect(()=>()=>buckets.clear());
 ctx.effect(()=>()=>library.dispose());
}
