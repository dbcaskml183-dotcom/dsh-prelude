import {ReviewControls} from './review-controls.jsx';
import React,{useId,useState,useRef,useEffect,useSyncExternalStore} from 'react';
import {BRAND} from '../shared/brand.mjs';
import packageInfo from '../package.json';
import {RouteControls,PersonalLibrary} from './components.jsx';
import {StorageStatus} from './storage-status.jsx';
import {adaptSettingsShell} from '../client/settings-shell.mjs';
import {nativeStore,savePanelDefault} from '../client/native-adapter.mjs';
import {PANEL_SECTIONS} from '../client/presentation.mjs';

export function PanelDefaults({id}){
 const native=useSyncExternalStore(nativeStore.subscribe,nativeStore.getSnapshot),[pending,setPending]=useState(null),[status,setStatus]=useState(''),[uncertain,setUncertain]=useState(false),busy=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const ready=native.formStatus==='ready';
 const save=async(field,value)=>{
  if(busy.current||!ready||!native.formWritable||uncertain)return;
  busy.current=true;setPending({field,value});setStatus('正在保存…');
  try{await savePanelDefault(field,value);if(alive.current)setStatus('已保存，下次打开生效；当前默认值以勾选状态为准。');}
  catch(e){if(alive.current){const rejected=['CONFIG_READ_ONLY','CONFIG_REJECTED'].includes(e?.code);setStatus(rejected?e.message:'保存结果未确认，请重新载入页面后核对。');setUncertain(!rejected);}}
  finally{busy.current=false;if(alive.current)setPending(null);}
 };
 return <section className="pc-settings-card" aria-labelledby={id}>
  <h3 id={id}>面板默认展开</h3>
  <p>下次打开生效；本次手动开合优先。</p>
  <div className="pc-panel-defaults" aria-busy={!!pending}>{PANEL_SECTIONS.map(s=><label className="pc-choice" key={s.id}><input type="checkbox" aria-label={'默认展开：'+s.label} checked={pending?.field===s.field?pending.value:ready&&native.config[s.field]===true} disabled={!ready||!native.formWritable||!!pending||uncertain} onChange={e=>save(s.field,e.target.checked)}/>{s.label}</label>)}</div>
  {(!ready||!native.formWritable||status)&&<p className="pc-settings-help" role="status">{status||(!ready?(native.formStatus==='unavailable'?'默认展开设置暂不可用；面板仍可手动开合。':'正在读取默认展开设置；面板仍可手动开合。'):'宿主设置暂不可写，当前默认值未改动。')}</p>}
  <p className="pc-settings-help">只调整显示，不会读取资料、选中方法或调用模型。默认值在同一DSH配置的设备间共用。</p>
 </section>;
}

// Only compose settings here. Model routing and personal-library persistence
// continue to use the same shared controls as the input panel.
export function PreludeSettings({sessionId,library,methods}){
 const [message,setMessage]=useState(''),id=useId(),root=useRef(null);
 useEffect(()=>adaptSettingsShell(root.current),[]);
 return <section ref={root} className="pc-root pc-settings" aria-label={BRAND.title+'设置'}>
  <header className="pc-settings-heading">
   <div className="pc-settings-identity"><div><h2>{BRAND.title}</h2></div></div>
   <span className="pc-settings-project">v{packageInfo.version}</span>
  </header>
  {message&&<p className="pc-message" role="status">{message}</p>}
  <section className="pc-settings-card" aria-labelledby={id+'-model'}>
   <h3 id={id+'-model'}>智能功能默认设置</h3>
   <p className="pc-settings-help">共用设置，不改变主会话选模。模型调用按供应商计费。</p>
   <RouteControls sessionId={sessionId} message={setMessage} showScope={false}/><ReviewControls target message={setMessage}/><StorageStatus/>
  </section>
  <PanelDefaults id={id+'-context'}/>
  <section className="pc-settings-card" aria-labelledby={id+'-library'}>
   <h3 id={id+'-library'}>个人库维护</h3>
   <PersonalLibrary view="maintenance" library={library} methods={methods} message={setMessage}/>
  </section>
 </section>;
}
