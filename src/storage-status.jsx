import React,{useEffect,useState,useRef} from 'react';
import {deadlineFetch} from '../shared/async.mjs';
import {PROTOCOL} from '../shared/contracts.mjs';
export function StorageStatus(){
 const [status,setStatus]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),life=useRef(null);
 useEffect(()=>{const ac=new AbortController();life.current=ac;refresh(ac.signal);return()=>ac.abort();},[]);
 async function refresh(signal=life.current?.signal){try{const r=await deadlineFetch('/api/prompt-coach/v4/status',{credentials:'same-origin',cache:'no-store',signal},5000),v=await r.json();if(!signal?.aborted){if(!v.ok||v.protocolVersion!==PROTOCOL)throw new Error();setStatus(v);setMessage('');}}catch{if(!signal?.aborted)setMessage('登记状态暂不可读取；未改动原有记录。');}}
 async function retry(){if(busy)return;setBusy(true);const signal=life.current?.signal;try{const r=await deadlineFetch('/api/prompt-coach/v4/reconcile',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({protocolVersion:PROTOCOL}),signal},5000),v=await r.json();if(!signal?.aborted){if(!v.ok)throw new Error(v.error);await refresh(signal);setMessage(v.reconciled?'调用记录已补登记，未调用模型。':v.note);}}catch(e){if(!signal?.aborted)setMessage(e.message||'登记仍未确认，未调用模型。');}finally{if(!signal?.aborted)setBusy(false);}}
 const coordination=status?.budget?.coordination,unsettled=status?.budget?.unsettledCalls||0;
 return <details className="pc-context pc-storage-status"><summary>调用记录与存储诊断</summary>
 <p className="pc-settings-help">这里记录调用用量，不是余额。重试登记不会再次调用模型。</p>
 {status?.ledgerError&&<p role="status" className="pc-message">{status.ledgerError}</p>}
 {coordination&&coordination.state!=='ready'&&<p role="status" className="pc-message">{coordination.message}</p>}
 {unsettled>0&&!status?.pendingSettlement&&<p role="status">有 {unsettled} 条历史调用没有完成状态，用量可能未知；不会补写成成功或据此重发。</p>}
 {message&&message!==status?.ledgerError&&<p role="status">{message}</p>}
 <div className="pc-actions"><button type="button" className="pc-button" disabled={busy} onClick={()=>refresh()}>刷新登记状态</button>{status?.pendingSettlement&&<button type="button" className="pc-button" disabled={busy} onClick={retry}>{busy?'正在登记…':'重试登记（不调用模型）'}</button>}</div>
 </details>;
}
