import {abortable} from '../shared/async.mjs';
import {PANEL_SECTIONS} from './presentation.mjs';
export const NAMESPACE='prompt-coach';
export const nativeServices={};
let snapshot={generation:0,config:{routeMode:'follow',provider:'',model:'',autoReview:false,targetMode:'generic'},formWritable:false,formStatus:'pending'};
const listeners=new Set();
const emit=patch=>{snapshot={...snapshot,...patch};for(const fn of listeners)fn();};
export const nativeStore={getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
let form;
export function connectNative(ctx){
 for(const name of ['sessions','conversation','modelDirectories','configForms','connection']){
  ctx.inject([name],sctx=>{
   const service=sctx.get(name);nativeServices[name]=service;emit({generation:snapshot.generation+1});
   let off=()=>{};
   if(name==='connection'){const update=()=>emit({generation:snapshot.generation+1});const a=service.generation.subscribe(update),b=service.state.subscribe(update);off=()=>{a();b();};}
   if(name==='configForms'){
    form=service.get(NAMESPACE);const update=()=>{const s=form.getSnapshot();emit({config:s.value||snapshot.config,formWritable:s.writable===true,formStatus:s.status});};
    off=form.subscribe(update);update();
   }
   sctx.effect(()=>()=>{off();if(nativeServices[name]===service)delete nativeServices[name];if(name==='configForms')form=undefined;emit({generation:snapshot.generation+1,...(name==='configForms'?{formWritable:false}:{})});});
  });
 }
 ctx.effect(()=>()=>{listeners.clear();});
}
async function mutateFields(config,fields){
 if(!form||!form.getSnapshot().writable)throw Object.assign(new Error('宿主设置暂不可写；原设置未改动，请稍后重试。'),{code:'CONFIG_READ_ONLY'});
 const s=form.getSnapshot();
 const ok=await form.mutate(Object.entries(config).filter(([k])=>fields.includes(k)).map(([k,value])=>({op:'set',path:[k],value})),s.revision);
 if(!ok)throw Object.assign(new Error('设置有冲突或被宿主拒绝，请刷新后核对。'),{code:'CONFIG_REJECTED'});
}
export async function saveRoute(config){return mutateFields(config,['routeMode','provider','model','autoReview','targetMode']);}
export async function savePanelDefault(field,value){
 if(!PANEL_SECTIONS.some(s=>s.field===field)||typeof value!=='boolean')throw new Error('默认展开设置无效；未提交。');
 return mutateFields({[field]:value},PANEL_SECTIONS.map(s=>s.field));
}
export function getDirectory(sessionId){try{return nativeServices.modelDirectories?.directoryFor?.(sessionId);}catch{return undefined;}}
export async function loadDirectory(directory,milliseconds=5000){
 if(!directory)return {groups:[],current:null,error:'模型目录服务缺席；已保存固定路线仍可尝试，本地方法库可用。'};
 const current=directory.store.getSnapshot();
 try{return await abortable(directory.load(),AbortSignal.timeout(milliseconds));}catch{return {...directory.store.getSnapshot(),error:'模型目录等待超时或不可用；未换用其他供应商。',current:directory.store.getSnapshot().current||current.current};}
}
export function resolveRoute(config,directory){
 const v=config||{};
 if(v.routeMode==='fixed')return v.provider&&v.model?{provider:v.provider,model:v.model}:null;
 const current=directory?.store?.getSnapshot?.()?.current;
 return current?.provider&&current?.model?{provider:current.provider,model:current.model}:null;
}
