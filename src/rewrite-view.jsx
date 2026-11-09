import {rewriteBadge} from '../client/presentation.mjs';
import React,{useEffect,useState} from 'react';
import {MAX_REWRITE} from '../shared/rewrite-contract.mjs';
import {textDifference} from '../shared/text-diff.mjs';
export function RewriteView({controller,snapshot,current,onGenerate,onReview,onRepair,getCurrent,onApply,onUndo,isCurrentWork=()=>true,disclosure=()=>({}),generateReason=''}){
 const s=snapshot,source=controller.source,relationship=controller.comparisonStatus?.(current)||'current',old=relationship==='outdated'||relationship==='archived';
 const [oldOpen,setOldOpen]=useState(false);
 useEffect(()=>{setOldOpen(false);},[controller.source,old]);
 if(s.phase==='idle')return null;
 const Comparison=old?'details':'div',reviewReason=controller.reviewReason?.(current)||'';
 const applyReason=controller.applyReason(current),undoReason=controller.undoReason(current),quotes=!old&&s.phase==='preview'?controller.quoteIssues?.()||[]:[],quoteMessages=new Set(quotes.map(q=>q.message)),missing=s.edited?controller.missing().filter(x=>!quoteMessages.has(x)):[];
 const copying=async text=>{if(!isCurrentWork())return;const source=controller.source,valid=()=>isCurrentWork()&&controller.source===source;try{if(!navigator.clipboard?.writeText)throw 0;await navigator.clipboard.writeText(text);if(!valid())return;controller.publish({message:'已复制；输入框原稿未被此操作修改。'});}catch{if(!valid())return;controller.publish({message:'剪贴板不可用，请在原稿或候选框中选择文字手动复制。'});}};
 const hasCandidate=['preview','reviewing','repairing','applied','reverted'].includes(s.phase);
 return <section className="pc-rewrite" data-pc-geometry-mode="rewrite" aria-label="整稿改写与对比">
  <div className="pc-rewrite-heading"><strong>整稿改写</strong><span className="pc-badge">{old?'上次结果 · 仅供查看':rewriteBadge(s)}</span></div>
  {old?<p className="pc-message" role="status">{relationship==='archived'?'本次替换已撤回；对比留作参考。':'草稿或依据已变化；上次结果不能用于当前稿。'}</p>:s.message&&<p className="pc-message" role="status">{s.message}</p>}
  {!old&&['generating','reviewing','repairing'].includes(s.phase)&&<div className="pc-actions"><button type="button" className="pc-button" onClick={()=>controller.cancel()}>{s.phase==='repairing'?'取消修稿':s.phase==='reviewing'?'取消审校':'取消整稿生成'}</button></div>}
  {hasCandidate&&<Comparison className={old?'pc-old-comparison':undefined} {...(old?{open:oldOpen,onToggle:e=>setOldOpen(e.currentTarget.open)}:{})}>
   {old&&<summary>{relationship==='archived'?'已撤回的对比':'上次改写 · 已过期'}（仅查看/复制）</summary>}
   {old&&s.message&&<p className="pc-reason">上次操作提示：{s.message}</p>}
   <div className="pc-rewrite-columns">
    <label className="pc-rewrite-column"><strong>原稿（本次生成时）</strong><textarea className="pc-input pc-rewrite-text" aria-label="改写原稿" readOnly value={s.original}/></label>
    <label className="pc-rewrite-column"><strong>改写候选{ s.edited?' · 你已手改':''}</strong><textarea className="pc-input pc-rewrite-text" aria-label="改写候选稿" maxLength={MAX_REWRITE} readOnly={old||s.phase!=='preview'} value={s.candidate} onChange={e=>controller.edit(e.target.value)}/></label>
   </div>
   <p className="pc-reason">{!old&&['preview','reviewing'].includes(s.phase)?'请核对原意与约束；候选可手改，采用只替换输入框，不自动发送。':'当前对比只读，可复制；继续编辑请使用DSH输入框。'}</p>
   <details {...(!old?disclosure('diff'):{})} className="pc-rewrite-diff"><summary>查看文字差异</summary><p className="pc-reason">新增和删除按文字比较，不代表语义已验证。</p><div className="pc-diff-text">{textDifference(s.original,s.candidate).map((part,i)=>part.kind==='added'?<ins key={i}><span className="pc-diff-label">新增：</span>{part.text}</ins>:part.kind==='removed'?<del key={i}><span className="pc-diff-label">删除：</span>{part.text}</del>:<span key={i}>{part.text}</span>)}</div></details>
   {(s.changes.length>0||s.uncertainties.length>0)&&<details {...(!old?disclosure('editNotes'):{})}><summary>编辑说明与待确认项</summary>{s.changes.length>0&&<><strong>模型说明（效果未验证）</strong><ul>{s.changes.map((x,i)=><li key={i}>{x}</li>)}</ul></>}{s.uncertainties.length>0&&<><strong>仍待确认</strong><ul>{s.uncertainties.map((x,i)=><li key={i}>{x}</li>)}</ul></>}</details>}
   {hasCandidate&&<div className="pc-review-status" role="status"><strong>{old?'上次审校（仅针对旧原稿）：':''}{({blocked:'代码检查发现要求变化，未调用额外审校',not_requested:'未额外审校',no_issue_found:'辅助审校未发现问题',unchanged:'候选与原稿相同，未运行额外审校',conflict:'辅助审校发现问题',uncertain:'辅助审校无法确认',failed:'审校未完成',stale:'你已手改，原审校不再适用'})[s.review?.state]||'审校状态未知'}</strong><p className="pc-reason">{s.review?.state==='unchanged'?'保持原样不代表原稿最优；仅使用你明确选择的方法。':'辅助审校只核对原意，不保证任务效果。'}</p>{(s.review?.findings||[]).map((f,i)=><p key={i}>{f.explanation} 原文：{f.sourceQuote}{f.candidateQuote?'；候选：'+f.candidateQuote:''}</p>)}{(s.review?.uncertainties||[]).map((x,i)=><p key={i}>{x}</p>)}{s.priorFindings?.length>0&&<details><summary>旧稿的问题（不代表已解决）</summary>{s.priorFindings.map((f,i)=><p key={i}>{f.explanation}</p>)}</details>}</div>}
   {!old&&s.phase==='preview'&&s.review?.state==='blocked'&&<div className="pc-warning"><ul>{controller.issues().filter(x=>!quotes.some(q=>x.includes(q.message.slice(0,80)))).map((x,i)=><li key={i}>{x}</li>)}</ul><p>请手改候选，或按意见修正后再检查；不会自动放行。</p></div>}
   {quotes.length>0&&<div className="pc-warning"><strong>请核对引文</strong><ul>{quotes.map((q,i)=><li key={i}>{q.message}{q.restore&&<button type="button" className="pc-button" onClick={()=>isCurrentWork()&&controller.restoreQuote(getCurrent?getCurrent():current,source,s.candidate,q.restore.start)}>恢复这处原话</button>}</li>)}</ul></div>}
   {!old&&s.phase==='preview'&&missing.length>0&&<div className="pc-warning"><p>候选缺少受保护原文，不能通过开关或确认绕过：</p><ul>{missing.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
   {!old&&s.phase==='preview'&&applyReason&&<p className="pc-reason" role="status">{applyReason}</p>}
   {!old&&s.phase==='applied'&&undoReason&&<p className="pc-reason" role="status">{undoReason}</p>}
   <div className="pc-rewrite-actions pc-actions">
    {!old&&s.phase==='preview'&&<button type="button" className="pc-button pc-primary" disabled={!!applyReason} onClick={onApply||(()=>controller.apply(getCurrent?getCurrent():current))}>采用到输入框</button>}
    {!old&&s.phase==='applied'&&<button type="button" className="pc-button pc-primary" disabled={!!undoReason} onClick={onUndo||(()=>controller.undo(getCurrent?getCurrent():current))}>撤回本次替换</button>}
    {!old&&s.phase==='preview'&&!controller.repairReason?.(current)&&controller.repairCurrent&&<button type="button" className="pc-button" onClick={onRepair||(()=>controller.repairCurrent(getCurrent?getCurrent():current))}>按意见修正并审校（可能计费）</button>}
    {!old&&s.phase==='preview'&&s.review?.state!=='blocked'&&(s.candidate!==s.original||s.methodCount>0)&&<button type="button" className="pc-button" disabled={!!reviewReason} title={reviewReason||undefined} onClick={onReview||(()=>controller.reviewCurrent(getCurrent?getCurrent():current))}>审校当前稿（可能计费）</button>}
    <button type="button" className="pc-button pc-quiet" disabled={!s.candidate} onClick={()=>copying(s.candidate)}>复制候选稿</button>
    <button type="button" className="pc-button pc-quiet" onClick={()=>copying(s.original)}>复制原稿</button>
    <button type="button" className="pc-button pc-quiet" onClick={()=>controller.dismiss()}>{old?'清除上次对比':s.phase==='preview'?'不采用':'收起对比'}</button>
   </div>
  </Comparison>}
  {old&&hasCandidate&&<div className="pc-actions"><button type="button" className="pc-button" disabled={!!generateReason} onClick={onGenerate}>按当前草稿重新生成</button>{generateReason&&<p className="pc-reason" role="status">{generateReason}</p>}</div>}
  {['error','cancelled','needs_context'].includes(s.phase)&&<div className="pc-actions"><button type="button" className="pc-button" disabled={!!generateReason} onClick={onGenerate}>重新检查并生成</button>{generateReason&&<p className="pc-reason" role="status">{generateReason}</p>}<button type="button" className="pc-button" onClick={()=>controller.dismiss()}>收起改写</button></div>}
 </section>;
}
