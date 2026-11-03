import {deadlineFetch,abortable} from '../shared/async.mjs';
import {validateLibrary} from '../shared/library.mjs';
export class LibraryController{
 constructor({fetcher=deadlineFetch}={}){this.fetcher=fetcher;this.listeners=new Set();this.state={state:'unloaded',value:null,writable:false,backups:[],recoveryAvailable:true,message:''};this.serial=0;this.requests=new Set();this.writeFlight=null;}
 getSnapshot=()=>this.state;
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 publish(patch){this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
 async fetchOwned(path,options,timeout){const controller=new AbortController();this.requests.add(controller);const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(timeout)]);
  try{const response=await abortable(this.fetcher(path,{...options,signal},timeout),signal);if(response.status===403)throw new Error('当前设备身份没有个人库写权限；本地方法库仍可用。');return await abortable(response.json(),signal);}
  finally{this.requests.delete(controller);}
 }

 async load(){
  const generation=++this.serial;this.publish({writable:false,message:''});
  try{const writing=this.writeFlight;if(writing){try{await writing;}catch{/* Explicit refresh can reconcile a failed or unknown save. */}}if(generation!==this.serial)return;const v=await this.fetchOwned('/api/prompt-coach/v4/library',{credentials:'same-origin',cache:'no-store'},5000);if(generation!==this.serial)return;
   if(!v.ok)throw new Error(v.error||'个人库不可用。');
   this.publish({state:v.state,value:v.value?validateLibrary(v.value):null,writable:!!v.value&&['ready','missing'].includes(v.state),backups:v.backups||[],recoveryAvailable:v.recoveryAvailable!==false,message:v.message|| (v.coordination?.state!=='ready'?v.coordination?.message:'')||''});
  }catch(e){if(generation===this.serial)this.publish({state:'unavailable',writable:false,message:e.message||'个人库读取失败，未重建空库。'});}
 }
 async mutate(op,{expectedRevision}={}){
  if(!this.state.writable||!this.state.value)throw new Error('个人库暂不可写，请先刷新或导出原件。');
  const revision=expectedRevision??this.state.value.revision;
  if(revision!==this.state.value.revision)throw new Error('个人库在编辑或预览期间已变化；请保留草稿，刷新并重新核对，未覆盖另一端。');
  this.publish({writable:false});
  return this.commit({expectedRevision:revision,op});
 }
 async recover(backup){return this.commit({recover:{generation:backup.generation,sha256:backup.sha256}});}
 async commit(body){
  if(this.writeFlight)throw new Error('个人库仍在提交，请等待后再试。');
  const generation=++this.serial;
  let capacityRejected=false;
  const flight=(async()=>{
   try{const v=await this.fetchOwned('/api/prompt-coach/v4/library/write',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)},10000);if(!v.ok){capacityRejected=v.code==='CAPACITY';throw new Error(v.error||'保存未确认，请刷新核对。');}
    const value=validateLibrary(v.value);
    if(generation===this.serial)this.publish({state:v.state,value,writable:true,backups:v.backups||[],recoveryAvailable:v.recoveryAvailable!==false,message:v.warning||'已保存到当前DSH宿主。'});return {...v,value};
   }catch(e){if(generation===this.serial)this.publish({writable:false,message:e.message});throw e;}
  })();this.writeFlight=flight;
  try{return await flight;}finally{if(this.writeFlight===flight)this.writeFlight=null;if(capacityRejected&&generation===this.serial&&this.state.value&&['ready','missing'].includes(this.state.state))this.publish({writable:true});}
 }
 dispose(){this.serial++;this.listeners.clear();for(const request of this.requests)request.abort();this.requests.clear();this.state={...this.state,writable:false};}
}
