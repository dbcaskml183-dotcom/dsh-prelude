import React,{useState} from 'react';
import {bundlePreview} from '../shared/bundles.mjs';
import {methodApplicable} from '../shared/method-policy.mjs';
import {insertSafely} from '../client/insertion.mjs';
import {editorPolicyReason} from '../shared/editor-policy.mjs';
import {DECISIONS} from '../shared/method-limits.mjs';
import {copyText} from './components.jsx';
import {cardTitle} from '../shared/catalog-search.mjs';
export function BundlePicker({bundles,cardProps,disclosure={}}){
 const [bundleId,setBundleId]=useState(''),[selected,setSelected]=useState([]),[feedback,setFeedback]=useState('');
 const {methods,request,availableSkills=[],actions,input,b,message,capture,workCurrent=()=>true}=cardProps;
 const bundle=bundles.find(x=>x.id===bundleId);
 const applicable=selected.filter(id=>{const m=methods.find(m=>m.id===id);return m&&!DECISIONS.has(id)&&methodApplicable(m,request,methods);});
 const preview=bundle?bundlePreview(bundle,applicable,methods,request,availableSkills):null;
 const insertionReason=preview?.text?editorPolicyReason(preview.text):'';
 const choose=id=>{setBundleId(id);const row=bundles.find(x=>x.id===id);setSelected(row?row.methodIds.filter(id=>{const m=methods.find(m=>m.id===id);return m&&!DECISIONS.has(id)&&methodApplicable(m,request,methods);}):[]);setFeedback('');};
 const insert=()=>{
  if(!workCurrent())return;
  const fresh=bundlePreview(bundle,applicable,methods,request,availableSkills);if(!fresh.ok)return setFeedback(fresh.reason);
  const reason=editorPolicyReason(fresh.text);if(reason)return setFeedback(reason);
  const span=b?.span||actions?.captureInsertion?.();if(b)b.ownEdit=true;
  if(insertSafely(actions,input,fresh.text,span)){if(b){b.span=null;b.cancel();}message('已插入所选搭配，尚未发送；可用输入框原生撤销。');}
  else{if(b)b.ownEdit=false;setFeedback('草稿或光标已变化，未改动文字；请重选光标或复制。');}
 };
 return <details {...disclosure} className="pc-bundles"><summary>常用搭配（可选）</summary><p className="pc-reason">按任务挑选，保留一项、两项或三项都可以。</p><select className="pc-input" aria-label="选择常用搭配" value={bundleId} onChange={e=>choose(e.target.value)}><option value="">请选择搭配</option>{bundles.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>
  {bundle&&<div className="pc-bundle-preview"><p>{bundle.explanation}</p>{bundle.methodIds.map(id=>{const m=methods.find(m=>m.id===id);if(!m)return null;const blocked=DECISIONS.has(id)||!methodApplicable(m,request,methods);return <label className="pc-bundle-choice" key={id}><input type="checkbox" aria-label={'搭配采用：'+cardTitle(m)} checked={selected.includes(id)&&!blocked} disabled={blocked} onChange={e=>{setSelected(e.target.checked?[...selected,id]:selected.filter(x=>x!==id));setFeedback('');}}/><span>{cardTitle(m)}{blocked&&<small>当前要求已表达或不适用</small>}</span></label>;})}<span className="pc-field-label">所选补句预览</span><div className="pc-snippet pc-bundle-text">{preview?.text||'选择适用的方法后，这里显示实际复制或插入的文字。'}</div><p className="pc-reason">{preview?.reason}</p>{insertionReason&&<p className="pc-warning">{insertionReason}</p>}<div className="pc-actions">{actions&&<button type="button" className="pc-button pc-primary" disabled={!preview?.ok||!!insertionReason||input?.phase!=='plain'} onPointerDown={capture} onMouseDown={e=>e.preventDefault()} onClick={insert}>插入所选搭配</button>}<button type="button" className="pc-button" disabled={!preview?.ok} onClick={()=>copyText(preview.text,setFeedback)}>复制所选搭配</button></div></div>}
  {feedback&&<p role="status" className="pc-feedback">{feedback}</p>}
 </details>;
}
