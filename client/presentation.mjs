// Presentation only: no model calls, persistence, host access or new authorization.
export const PANEL_SECTIONS=Object.freeze([
 {id:'requirements',field:'defaultOpenRequirements',label:'补充要求'},
 {id:'materials',field:'defaultOpenMaterials',label:'参考资料'},
 {id:'bundles',field:'defaultOpenBundles',label:'常用搭配（方法库）'},
 {id:'model',field:'defaultOpenModel',label:'模型设置'},
 {id:'methodBody',field:'defaultOpenMethodBody',label:'推荐卡片正文'},
 {id:'reflected',field:'defaultOpenReflected',label:'当前文字已体现的方法'},
 {id:'effectiveRequirements',field:'defaultOpenEffectiveRequirements',label:'本次补充要求预览'},
 {id:'diff',field:'defaultOpenDiff',label:'文字差异'},
 {id:'editNotes',field:'defaultOpenEditNotes',label:'编辑说明与待确认项'}
].map(Object.freeze));
// Callers pass only current catalogue IDs. Each card shares the default,
// never its manual state or a draft/result-specific identity.
function disclosureKey(id,instanceId){
 if(!PANEL_SECTIONS.some(s=>s.id===id))return null;
 if(instanceId===undefined)return id;
 return id==='methodBody'&&typeof instanceId==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/u.test(instanceId)?id+':'+instanceId:null;
}
export function panelDisclosureOpen(state,id,instanceId){
 const key=disclosureKey(id,instanceId);if(!key)return false;
 return (Object.hasOwn(state.disclosures||{},key)?state.disclosures[key]:state.disclosures?.[id])===true;
}
export function panelOpenPatch(config={},ready=false){
 return {disclosures:Object.fromEntries(PANEL_SECTIONS.map(s=>[s.id,ready&&config[s.field]===true])),disclosureTouched:{},disclosureDefaultsPending:!ready};
}
export function hydratePanelDefaults(state,config,ready){
 if(!state.open||!state.disclosureDefaultsPending||!ready)return null;
 const defaults=panelOpenPatch(config,true).disclosures;
 return {disclosures:{...state.disclosures,...Object.fromEntries(PANEL_SECTIONS.map(s=>[s.id,state.disclosureTouched[s.id]?state.disclosures[s.id]:defaults[s.id]]))},disclosureDefaultsPending:false};
}
export function panelDisclosureTouch(state,id,instanceId){
 const key=disclosureKey(id,instanceId);
 if(!state.open||!key||(id==='methodBody'&&instanceId===undefined)||state.disclosureTouched[key])return null;
 return {disclosureTouched:{...state.disclosureTouched,[key]:true},...(instanceId===undefined?{}:{disclosures:{...state.disclosures,[key]:panelDisclosureOpen(state,id,instanceId)}})};
}
export function panelDisclosureChange(state,id,open,instanceId){
 const key=disclosureKey(id,instanceId);
 if(!state.open||typeof open!=='boolean'||!key||(id==='methodBody'&&instanceId===undefined)||panelDisclosureOpen(state,id,instanceId)===open)return null;
 return {disclosures:{...state.disclosures,[key]:open},disclosureTouched:{...state.disclosureTouched,[key]:true}};
}
export function providerLabel(provider,snapshot={groups:[]}){
 const groups=snapshot.groups||[],group=groups.find(g=>g.id===provider),label=group?.name||provider;
 return groups.some(g=>g.id!==provider&&(g.name||g.id)===label)?label+'（'+provider+'）':label;
}
export function routePresentation(config={},route,snapshot={groups:[]}){
 const mode=config.routeMode==='fixed'?'固定模型':'跟随会话';
 if(!route?.provider||!route?.model)return {mode,label:'尚未选择可用模型',detail:'可先使用本地方法库。'};
 const group=(snapshot.groups||[]).find(g=>g.id===route.provider),model=group?.models?.find(m=>m.id===route.model);
 const provider=providerLabel(route.provider,snapshot),name=model?.name||route.model;
 return {mode,label:provider+' / '+name,detail:route.provider+' / '+route.model};
}
export function evidencePresentation(evidence=[]){const count=evidence.length,chars=evidence.reduce((n,x)=>n+(x.text?.length||0),0);return {count,chars,label:count?'参考资料 · 已选'+count+'段':'参考资料（可选）',detail:count?'点击细化时才发送所选'+chars+'字符，不代表已读完整资料。':'当前只用草稿；展开后可预览并选择资料。'};}
export function previewForAdoption(original,text){return {...original,text,coverage:original.coverage+(text!==original.text?'；用户编辑片段':'')};}

export function decisionPresentation({pending=false,source,kind,count=0}={}){
 if(pending)return {label:'分析中',hint:'只提交你明确选择的内容'};
 if(source==='model')return {label:({no_suggestion:'未发现必要补充',suggestions:'可考虑补充',needs_context:'目标待明确',uncertain:'依据有限',unavailable:'分析不可用'})[kind]||'模型分析',hint:'模型分析 · 仅依据本次所选内容'};
 if(kind==='needs_context')return {label:'目标待补',hint:'可补充，也可以跳过'};
 if(kind==='uncertain')return {label:'依据有限',hint:'可补充相关资料，也可继续使用方法库'};
 if(kind==='no_suggestion')return {label:'本地预检查',hint:'仅根据当前草稿，不代表完整质量判断'};
 return {label:'本地参考',hint:count?'根据当前草稿本地匹配，供你选择':'照常写需求，或去方法库挑选'};
}

// Cancellation/error does not prove that a paid call never started.
export function rewriteBadge(snapshot){if(snapshot.phase==='generating')return '生成中';if(snapshot.phase==='reviewing')return '审校中';if(snapshot.phase==='repairing')return '修稿并审校中';if(snapshot.phase==='needs_context')return '待补充目标';if(['error','cancelled'].includes(snapshot.phase))return '未采用结果';return snapshot.modelUsed?'模型候选':'本地检查';}

export function statusFailure(code){
 if(code===401)return 'DSH 登录已失效，请重新登录。';
 if(code===403)return 'DSH 拒绝访问 Prelude，请核对当前登录身份。';
 if(code===404)return '找不到 Prelude 后端，请检查插件是否已加载。';
 return 'Prelude 后端返回 HTTP '+code+'。';
}
