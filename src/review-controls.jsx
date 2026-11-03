import React,{useState,useSyncExternalStore} from 'react';
import {nativeStore,saveRoute} from '../client/native-adapter.mjs';
export function ReviewControls({busy=false,message=()=>{},target=false,targetOnly=false}){
 const native=useSyncExternalStore(nativeStore.subscribe,nativeStore.getSnapshot),[saving,setSaving]=useState(false);
 const ready=native.formStatus==='ready'&&typeof native.config.autoReview==='boolean'&&['generic','session'].includes(native.config.targetMode);
 const save=async patch=>{setSaving(true);try{await saveRoute(patch);}catch(e){message(e.message);}finally{setSaving(false);}};
 return <div className="pc-review-controls">
 {!targetOnly&&<><label className="pc-choice"><input type="checkbox" role="switch" aria-label="生成后自动审校" checked={ready&&native.config.autoReview===true} disabled={busy||saving||!ready||!native.formWritable} onChange={e=>save({autoReview:e.target.checked})}/>生成后自动审校</label>
 <p className="pc-reason">共用设置。改写后按需额外审校，可能增加费用和等待；关闭仍保留代码检查。</p></>}
 {!ready&&<p className="pc-reason">正在读取审校偏好，暂不发起AI请求；本地方法可用。</p>}
 {target&&<label>用途<select className="pc-input" aria-label="提示词目标用途" disabled={busy||saving||!ready||!native.formWritable} value={native.config.targetMode||'generic'} onChange={e=>save({targetMode:e.target.value})}><option value="generic">通用（默认）</option><option value="session">参照当前会话模型</option></select><span className="pc-reason">参照目标模型的规范；身份不明时用通用规范。</span></label>}
 </div>;
}
