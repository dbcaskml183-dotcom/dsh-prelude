import {cardTitle,matchesSearch} from '../shared/catalog-search.mjs';
import {methodForVariant,safeSnippet} from '../shared/catalog-registry.mjs';
import {insertSafely} from '../client/insertion.mjs';
import {editorPolicyReason} from '../shared/editor-policy.mjs';
import {DECISIONS} from '../shared/method-limits.mjs';
import {methodStatus} from '../shared/method-policy.mjs';
import {safeSourceUrl} from '../shared/source-url.mjs';
import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';

import {nativeStore,saveRoute,getDirectory,loadDirectory} from '../client/native-adapter.mjs';
import {readLegacyPrefs,exportLibrary,decodeImport,previewImport,LIBRARY_LIMIT} from '../shared/library.mjs';
import {selectedChatRows,draftFiles,previewFile,addEvidence,evidenceCapacity} from '../client/context-adapter.mjs';
import {deadlineFetch} from '../shared/async.mjs';
import {personalEditorFor} from '../client/personal-editor.mjs';
import {routePresentation,providerLabel,evidencePresentation,previewForAdoption} from '../client/presentation.mjs';

export function download(text,name,type='application/json'){
 const a=document.createElement('a'),url=URL.createObjectURL(text instanceof Blob?text:new Blob([text],{type}));
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function copyText(text,message){try{await navigator.clipboard.writeText(text);message('已复制；由你选择位置粘贴。');}catch{message('浏览器未允许复制，请选中补句手动复制。');}}
export function MethodCard({m,suggestion,library,methods,request,actions,input,capture,b,availableSkills=[],sources=[],message,onEdit,compact=false,bodyDisclosure={},chosenMethods=[],onChooseMethod,methodBusy=false,workCurrent=()=>true,viewCache}){
 const cached=viewCache?.get(m.id),sameDraft=!!cached&&cached.draftRev===input?.draftRev;
 const snap=useSyncExternalStore(library.subscribe,library.getSnapshot),[agreed,setAgreed]=useState(()=>sameDraft?cached.agreed:false),[feedback,setFeedback]=useState(()=>sameDraft?cached.feedback:'');
 const [variantId,setVariantId]=useState(()=>cached?.variantId||suggestion?.variantId||'standard'),[sourceOpen,setSourceOpen]=useState(()=>cached?.sourceOpen||false);
 const cardIdentity=useRef({id:m.id,rev:input?.draftRev});
 const sameIdentity=cardIdentity.current.id===m.id&&cardIdentity.current.rev===input?.draftRev;
 useEffect(()=>{const previous=cardIdentity.current;cardIdentity.current={id:m.id,rev:input?.draftRev};if(previous.id!==m.id||previous.rev!==input?.draftRev){setAgreed(false);setFeedback('');}},[input?.draftRev,m.id]);
 useEffect(()=>{viewCache?.set(m.id,{draftRev:input?.draftRev,variantId,agreed:sameIdentity?agreed:false,feedback:sameIdentity?feedback:'',sourceOpen});},[viewCache,m.id,input?.draftRev,variantId,agreed,feedback,sourceOpen,sameIdentity]);
 const confirmed=chosenMethods.find(x=>x.id===m.id&&x.variant===variantId);
 const effective=methodForVariant(m,variantId),title=cardTitle(effective),snippet=confirmed?.text??safeSnippet(effective,suggestion?.genericText&&variantId==='standard'?[]:availableSkills),decision=DECISIONS.has(m.id)||suggestion?.decisionRequired;
 const status=request&&!m.id.startsWith('custom-')?methodStatus(effective,request,methods):null,constrained=status?.restricted===true,covered=status?.coverage.state==='covered';
 const insertionReason=editorPolicyReason(snippet);
 const chosen=!!confirmed;
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const localMessage=text=>{if(mounted.current)setFeedback(text);else if(viewCache&&workCurrent())message(text);};
 const useSnippet=()=>{
  if(!workCurrent())return;
  if(constrained)return localMessage('这条方法与当前要求冲突；未插入。');
  if(covered)return localMessage('当前文字已体现，无需再插入同一句；仍可复制或作为改写核对依据。');
  if(insertionReason)return localMessage(insertionReason);
  const span=b?.span||actions?.captureInsertion?.();if(b)b.ownEdit=true;
  const wasPending=!!b?.get?.().pending;
  if(insertSafely(actions,input,snippet,span)){if(b){b.span=null;b.cancel();}message('已插入草稿，尚未发送；可用输入框原生撤销。'+(wasPending?' 已停止采用细化结果；已开始的调用可能计费。':''));}
  else{if(b)b.ownEdit=false;localMessage('草稿或光标已变化，未改动文字；请重选光标或复制。');}
 };
 const starred=snap.value?.favorites.includes(m.id),custom=m.id.startsWith('custom-');
 const refs=(m.reference_sources||[]).map(id=>Array.isArray(sources)?sources.find(s=>s.id===id):sources[id]).filter(Boolean);
 const body=<>
  {m.plain_explanation&&m.plain_explanation.replace(/[。.!?\s]/g,'')!==String(m.label||'').replace(/[。.!?\s]/g,'')&&<p className="pc-plain">{m.plain_explanation}</p>}
  {(m.variants||[]).length>0&&<label className="pc-variant-label">补句写法<select className="pc-input" aria-label={'补句写法：'+cardTitle(m)} value={variantId} onChange={e=>{setVariantId(e.target.value);setFeedback('');}}><option value="standard">通用写法</option>{m.variants.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>}
  <div className="pc-snippet-block"><span className="pc-field-label">补句原文</span><div className="pc-snippet">{snippet}</div></div>
 </>;
 return <article className="pc-card" data-method={m.id}>
  <div className="pc-cardhead"><div className="pc-card-title"><strong>{title}</strong>{title!==m.label&&<span className="pc-card-subtitle">{m.label}</span>}</div>{!custom&&<button type="button" className="pc-button pc-star" aria-label={(starred?'取消收藏：':'收藏：')+title} title={starred?'取消收藏':'收藏方法'} disabled={!snap.writable} onClick={()=>library.mutate({kind:'favorite',id:m.id,enabled:!starred}).catch(e=>localMessage(e.message))}>{starred?'已收藏':'收藏'}</button>}</div>
  {!custom&&<div className="pc-card-meta" role="group" aria-label="方法阶段和领域"><span className="pc-meta-tag"><span className="pc-meta-key">阶段：</span>{m.category}</span><span className="pc-meta-tag"><span className="pc-meta-key">领域：</span>{m.domains?.length?m.domains.join(' / '):m.domain}</span></div>}
  {suggestion&&<p className="pc-reason"><strong>为什么适合：</strong>{suggestion.reason}</p>}
  {constrained&&<p className="pc-warning">这条方法与当前操作限制或任务范围存在冲突。</p>}
  {covered&&!constrained&&<p className="pc-reason">当前文字已体现；选择后只作核对依据，不重复补写。</p>}
  {suggestion?.genericText&&m.generic_snippet!==m.snippet&&snippet===safeSnippet(effective,[])&&<p className="pc-reason">本条建议使用通用写法；技能写法可在方法库明确选择。</p>}
  {insertionReason&&<p className="pc-warning">{insertionReason}</p>}
  {actions&&input?.phase!=='plain'&&<p className="pc-warning">输入框暂不可插入，可先复制补句。</p>}
  {compact?<details {...bodyDisclosure} className="pc-method-body"><summary>查看补句与写法</summary>{body}</details>:body}
  {decision&&!constrained&&<label className="pc-choice"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/> 这项方法涉及取舍，我确认加入本次要求</label>}
  <div className="pc-actions pc-card-actions">
   {!custom&&onChooseMethod&&<button type="button" className="pc-button pc-primary" aria-label={(chosen?'取消用于改写：':'用于本次改写：')+title} aria-pressed={chosen} disabled={methodBusy||(!chosen&&(constrained||!!insertionReason||(decision&&!agreed)))} onClick={()=>onChooseMethod(m,variantId,!!suggestion?.genericText)}>{chosen?'已选 · 取消':'用于本次改写'}</button>}
   {actions&&<button type="button" className={!custom&&onChooseMethod?'pc-button':'pc-button pc-primary'} aria-label={"插入光标处："+title} onPointerDown={capture} onMouseDown={e=>e.preventDefault()} title="插入当前光标处，不替换原稿、不发送" disabled={constrained||covered||!!insertionReason||input?.phase!=='plain'||(decision&&!agreed)} onClick={useSnippet}>插入光标处</button>}
   <button type="button" className="pc-button pc-quiet" aria-label={"复制补句："+title} disabled={constrained||(decision&&!agreed)} onClick={()=>copyText(snippet,localMessage)}>复制补句</button>
   {suggestion&&<button type="button" className="pc-button pc-quiet" onClick={()=>b.set({hidden:[...b.get().hidden,m.id]})}>本次忽略</button>}
   {onEdit&&<button type="button" className="pc-button pc-quiet" onClick={()=>onEdit(m)}>编辑</button>}
  </div>
  {feedback&&<p className="pc-feedback" role="status">{feedback}</p>}
  {!custom&&<details className="pc-detail" open={sourceOpen} onToggle={e=>{if(e.currentTarget.isConnected)setSourceOpen(e.currentTarget.open);}}><summary>说明与来源</summary>{suggestion&&<p><strong>推荐理由：</strong>{suggestion.reason}</p>}{suggestion?.increment&&<><p><strong>本次原文依据：</strong>{suggestion.increment.sourceQuote}</p><p><strong>可补动作原文：</strong>{suggestion.increment.snippetQuote}</p><p><strong>模型解释（仅供核对）：</strong>{suggestion.modelReason}</p></>}<p><strong>建议位置：</strong>{suggestion?.placement.hint||m.placement_hint||'由你选择的位置'}。位置仅供参考，实际插到当前光标处。</p><p><strong>何时别用：</strong>{m.when_not_to_suggest}</p><p><strong>何时用：</strong>{m.when_to_suggest}</p>{m.capability_note&&<p><strong>能力边界：</strong>{m.capability_note}</p>}{m.related_installed_skill&&<p>{availableSkills.includes(m.related_installed_skill)?'关联技能已确认可用：':'未确认关联技能，采用通用表述：'}{m.related_installed_skill}</p>}<p>{refs.map((r,i)=>{const url=safeSourceUrl(r.url||r.repository||r.repo);return url?<a key={i} href={url} target="_blank" rel="noopener noreferrer">{r.name||'方法来源'} </a>:null;})}</p></details>}
 </article>;
}
export function RouteControls({sessionId,message,onBusy,showScope=true}){
 const native=useSyncExternalStore(nativeStore.subscribe,nativeStore.getSnapshot);
 const directory=sessionId?getDirectory(sessionId):undefined;
 const [snapshot,setSnapshot]=useState(()=>directory?.store.getSnapshot()||{groups:[],current:null});
 const [saving,setSaving]=useState(false);
 useEffect(()=>{
  let live=true;const sync=()=>{if(live)setSnapshot(directory?.store.getSnapshot()||{groups:[],current:null});};sync();const off=directory?.store.subscribe(sync);
  loadDirectory(directory).then(v=>{if(live)setSnapshot(v);});return()=>{live=false;off?.();};
 },[directory]);
 const cfg=native.config,actual=cfg.routeMode==='fixed'?cfg:snapshot.current,shown=routePresentation(cfg,actual,snapshot);
 const save=async patch=>{setSaving(true);onBusy?.(true);try{await saveRoute(patch);}catch(e){message(e.message);}finally{setSaving(false);onBusy?.(false);}};
 const routes=(snapshot.groups||[]).flatMap(g=>(g.models||[]).map(m=>({provider:g.id,model:m.id,label:m.name||m.id,providerLabel:providerLabel(g.id,snapshot)})));
 const saved=cfg.provider&&cfg.model?JSON.stringify([cfg.provider,cfg.model]):'';
 const found=routes.some(r=>JSON.stringify([r.provider,r.model])===saved);
 return <div className="pc-route">
  <label>模型使用方式<select className="pc-input" aria-label="模型使用方式" value={cfg.routeMode||'follow'} disabled={saving||!native.formWritable} onChange={e=>save({routeMode:e.target.value})}><option value="follow">跟随当前会话</option><option value="fixed">固定一个模型</option></select></label>
  {cfg.routeMode==='fixed'&&<label>固定模型<select className="pc-input" aria-label="固定细化模型" value={saved} disabled={saving||!native.formWritable} onChange={e=>{if(!e.target.value)return;const [provider,model]=JSON.parse(e.target.value);save({routeMode:'fixed',provider,model});}}><option value="">请选择宿主模型</option>{saved&&!found&&<option value={saved}>{cfg.model} · {cfg.provider}（已保存，目录未确认）</option>}{routes.map(r=><option key={JSON.stringify([r.provider,r.model])} value={JSON.stringify([r.provider,r.model])}>{r.label} · {r.providerLabel}</option>)}</select></label>}
  <p className="pc-reason" title={shown.detail}>当前模型：{shown.label}</p>{showScope&&<p className="pc-reason">同一 DSH 配置共用，不改变聊天模型。</p>}
  {snapshot.error&&<p className="pc-reason">{snapshot.error}</p>}
  {!native.formWritable&&<p className="pc-reason">宿主设置暂不可写，仍可使用现有路线和本地方法库。</p>}
 </div>;
}
export function PersonalLibrary({library,methods,cardProps={},message,view='daily'}){
 const maintenance=view==='maintenance',trash=maintenance;
 const snap=useSyncExternalStore(library.subscribe,library.getSnapshot);
 const editor=personalEditorFor(library),draft=useSyncExternalStore(editor.subscribe,editor.getSnapshot);
 const {id:edit,name,text,open:editorOpen,message:editorMessage}=draft;
 const [imported,setImported]=useState(null),[mode,setMode]=useState('keep-both'),[legacy]=useState(()=>readLegacyPrefs());
 const [query,setQuery]=useState('');const fileRef=useRef(null),importVersion=useRef(0);
 const [purge,setPurge]=useState(null),cancelPurge=useRef(null);
 useEffect(()=>{setPurge(null);},[trash,query,snap.value?.revision]);
 useEffect(()=>{if(purge)cancelPurge.current?.focus({preventScroll:true});},[purge]);
 useEffect(()=>{library.load();return()=>{importVersion.current++;};},[library]);
 const parse=(raw,revision=snap.value?.revision)=>{importVersion.current++;setImported(null);try{const data=decodeImport(raw);setImported({raw,data,revision,base:snap.value});message('');}catch(e){message(e.message);}};
 const choose=async e=>{const file=e.target.files?.[0];e.target.value='';const version=++importVersion.current;if(!file)return;setImported(null);message('');if(file.size>1048576)return message('导入上限1MiB，未读取超限文件。');const revision=library.getSnapshot().value?.revision;
  try{const raw=await file.text();if(version!==importVersion.current)return;if(library.getSnapshot().value?.revision!==revision)return message('读取期间个人库已变化，请重新选择并预览；未导入。');parse(raw,revision);}catch{if(version===importVersion.current)message('无法读取所选文件；个人库未改动，请检查文件后重新选择。');}
 };
 const importPreview=imported?.base?previewImport(imported.base,imported.data,mode):[];
 const importStale=!!imported&&snap.value?.revision!==imported.revision;
 const confirmImport=()=>{const version=++importVersion.current;library.mutate({kind:'import',raw:imported.raw,conflicts:mode},{expectedRevision:imported.revision}).then(()=>{if(version===importVersion.current)setImported(null);}).catch(e=>{if(version===importVersion.current)message(e.message);});};
 const startEdit=item=>editor.begin(item,snap.value?.revision);
 const save=async()=>{const captured=editor.getSnapshot(),before=new Set((library.getSnapshot().value?.items||[]).map(x=>x.id));try{const result=await library.mutate({kind:'save',...(captured.id?{id:captured.id}:{}),label:captured.name.trim(),snippet:captured.text.trim()},captured.id?{expectedRevision:captured.revision}:{});
  const items=result.value.items.filter(x=>captured.id?x.id===captured.id:!before.has(x.id));if(items.length!==1)throw new Error('保存结果无法唯一核对；草稿保留，请刷新核对。');editor.complete(captured,{item:items[0],revision:result.value.revision});
 }catch(e){if(editor.getSnapshot().epoch===captured.epoch)editor.error(e.message);}};
 const rawDownload=async()=>{try{const r=await deadlineFetch('/api/prompt-coach/v4/library?raw=1',{credentials:'same-origin'},5000);if(!r.ok)throw 0;download(await r.blob(),'Prelude-原件.json');}catch{message('无法导出原件，请保留现场并核对宿主文件权限。');}};
 const startPurge=item=>{
  if(editor.getSnapshot().id===item.id&&editor.dirty())return message('这句还有未保存的编辑，请先保存或取消编辑；未永久移除。');
  setPurge({id:item.id,label:item.label,revision:snap.value.revision});
 };
 const confirmPurge=event=>{
  // A rapid second click must not become confirmation after layout/focus changes.
  if(event?.detail>1)return;
  const captured=purge,current=library.getSnapshot(),item=current.value?.items.find(x=>x.id===captured?.id);
  if(!captured||!current.writable)return;
  if(current.value.revision!==captured.revision||!item?.deletedAt){setPurge(null);return message('个人库已变化，请刷新核对后重新确认；未永久移除。');}
  if(editor.getSnapshot().id===item.id&&editor.dirty())return message('这句还有未保存的编辑，请先保存或取消编辑；未永久移除。');
  setPurge(null);message('正在提交永久移除；关闭面板不等于撤销，请等待结果或刷新核对。');
  library.mutate({kind:'purge-item',id:captured.id},{expectedRevision:captured.revision}).then(()=>message('已从当前个人库移除「'+captured.label+'」，释放1个名额。')).catch(e=>message(e.message));
 };
 return <div className="pc-library" data-library-view={view}>
  <p className="pc-reason">{maintenance?'维护同一 DSH 的个人补句与收藏，不保存会话草稿。':'备份、导入和回收区：设置→Prelude→个人库维护。'}</p>
  {snap.message&&<p className="pc-message" role="status">{snap.message}</p>}
  <div className="pc-actions"><button type="button" className="pc-button" onClick={()=>library.load()}>刷新个人库</button>{maintenance&&<><button type="button" className="pc-button" disabled={!snap.value} onClick={()=>download(exportLibrary(snap.value),'Prelude-个人库.json')}>导出个人库</button><button type="button" className="pc-button" disabled={!snap.writable} onClick={()=>fileRef.current?.click()}>导入并预览</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={choose}/></>}</div>
  {maintenance&&<>
  {['corrupt','missing-protected'].includes(snap.state)&&<section className="pc-message" aria-label="个人库恢复">
   <p>{snap.state==='missing-protected'?'主文件缺失，已保护历史文件，暂停普通保存。':'原件已保留，不当作空库保存。'}</p>
   <p>恢复仅包含所选备份当时的内容；主文件中较新的未备份变化无法自动补回。</p>
   {snap.state==='corrupt'&&snap.recoveryAvailable!==false&&<button type="button" className="pc-button" onClick={rawDownload}>导出损坏原件</button>}
   {snap.recoveryAvailable===false&&<p>备份仍保留；请保全宿主状态目录后按 docs/operations.md 离线核对。此处不自动恢复或导出无法安全读取的原件。</p>}
    {snap.backups.length?snap.backups.map(x=><button type="button" className="pc-button" key={x.generation} disabled={snap.recoveryAvailable===false} onClick={()=>library.recover(x).catch(e=>message(e.message))}>恢复备份{x.generation} · {x.items}条</button>):<p>没有可用备份。请保留目录，按恢复文档离线核对或取回外部备份；此处不会重建空库。</p>}
  </section>}
  {legacy.state==='corrupt'&&<div className="pc-message">检测到旧浏览器库损坏，已保留原字节。<button type="button" className="pc-button" onClick={()=>download(legacy.raw||'','Prelude-旧浏览器原件.txt','text/plain')}>导出旧原件</button></div>}
  {legacy.state==='valid'&&(legacy.value.items.length>0||legacy.value.favorites.length>0)&&<div className="pc-message">本浏览器有旧收藏/补句。<button type="button" className="pc-button" disabled={!snap.writable} onClick={()=>parse(exportLibrary(legacy.value))}>预览迁移旧收藏</button><button type="button" className="pc-button" onClick={()=>download(legacy.raw,'Prelude-旧浏览器备份.json')}>备份旧原件</button></div>}
  {imported&&<section className="pc-message" aria-label="导入预览"><strong>导入预览</strong>{importStale&&<p role="status">个人库已变化，请重新选择文件并预览；未导入。</p>}<p>补句{imported.data.items.length}条，收藏{imported.data.favorites.length}项；明确替换优先；其余重复正文跳过。</p><ul>{importPreview.map(x=><li key={x.id}>{x.label}：{x.action==='replace'?'替换同ID':x.action==='skip'?'正文已存在，将跳过':x.state==='conflict'?'保留两份，新增副本':'新增'}{x.action!=='skip'&&x.deleted?'（进入回收区）':''}</li>)}</ul><label>冲突处理<select className="pc-input" aria-label="导入冲突处理" value={mode} onChange={e=>setMode(e.target.value)}><option value="keep-both">保留两份</option><option value="replace">用导入版本替换同ID</option></select></label><div className="pc-actions"><button type="button" className="pc-button" disabled={!snap.writable||importStale} onClick={confirmImport}>确认导入</button><button type="button" className="pc-button" onClick={()=>{importVersion.current++;setImported(null);}}>取消导入</button></div></section>}
  </>}
  {!maintenance&&<><button type="button" className="pc-button pc-editor-toggle" aria-expanded={editorOpen} onClick={()=>editor.toggle()}>{edit?'编辑中的补句':editorOpen?'收起新增补句':'新增自己的补句'}</button>{editorOpen&&<section className="pc-editor"><strong>{edit?'编辑补句':'新增补句'}</strong><p className="pc-reason">未保存内容在本页内保留；刷新或关闭浏览器仍会丢失。</p>{editorMessage&&<p className="pc-message" role="status">{editorMessage}</p>}<label>名称<input className="pc-input" aria-label="我的补句名称" maxLength={40} value={name} onChange={e=>editor.update('name',e.target.value)}/></label><label>补句<textarea className="pc-input" aria-label="我的补句正文" maxLength={800} value={text} onChange={e=>editor.update('text',e.target.value)}/></label><div className="pc-actions"><button type="button" className="pc-button" disabled={!snap.writable||!name.trim()||!text.trim()} onClick={save}>{edit?'保存修改':'保存这句'}</button><button type="button" className="pc-button" onClick={()=>editor.reset()} title="放弃尚未保存的修改">取消编辑</button></div></section>}</>}
  {maintenance&&<h4>回收区</h4>}
  <div className="pc-tools"><input className="pc-input" aria-label={maintenance?'搜索回收区':'搜索我的补句'} placeholder={maintenance?'搜索回收区':'搜索自己的补句'} value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {maintenance&&<>
   {snap.value&&<p className="pc-reason">已保存{snap.value.items.filter(m=>!m.deletedAt).length}条，回收{snap.value.items.filter(m=>m.deletedAt).length}条，共占{snap.value.items.length}/{LIBRARY_LIMIT.items}个名额；回收项也占名额。</p>}
   {!snap.value&&<p className="pc-reason">个人库容量暂不可核对；未当作空库。</p>}
  </>}
   {(snap.value?.items||[]).filter(m=>!!m.deletedAt===trash&&matchesSearch([m.label,m.snippet].join(' '),query)).map(m=><div className="pc-personal-item" key={m.id}>{trash?<article className="pc-card"><strong>{m.label}</strong><p className="pc-snippet">{m.snippet}</p><div className="pc-actions"><button type="button" className="pc-button" disabled={!snap.writable||purge?.id===m.id} onClick={()=>library.mutate({kind:'restore-item',id:m.id}).catch(e=>message(e.message))}>恢复这句</button><button type="button" className="pc-button pc-delete" aria-label={'永久移除：'+m.label} disabled={!snap.writable||purge!==null} onClick={()=>startPurge(m)}>永久移除，释放名额</button></div>{purge?.id===m.id&&<section className="pc-message" aria-label="确认永久移除补句"><p>永久移除「{purge.label}」？会释放1个名额，不能再从回收区恢复。旧导出件或滚动备份可能仍保留旧内容。</p><div className="pc-actions"><button ref={cancelPurge} type="button" className="pc-button" onClick={()=>setPurge(null)}>取消永久移除</button><button type="button" className="pc-button pc-delete" disabled={!snap.writable} onClick={confirmPurge}>确认永久移除这句</button></div></section>}</article>:<><MethodCard {...cardProps} {...{m,methods,library,message}} onEdit={startEdit}/><button type="button" className="pc-button pc-delete" aria-label={'移入回收区：'+m.label} disabled={!snap.writable} onClick={()=>library.mutate({kind:'remove',id:m.id}).catch(e=>message(e.message))}>移入回收区</button></>}</div>)}
 </div>;
}
export function MaterialControls({services,sessionId,input,chat,evidence,onChange,message,workCurrent=()=>true,onPreviewChange=()=>{},disclosure={}}){
 const [mode,setMode]=useState(null),[rows,setRows]=useState([]),[files,setFiles]=useState([]),[preview,setPreview]=useState(null),[previewText,setPreviewText]=useState(''),[reading,setReading]=useState(''),readController=useRef(null);
 const cancelPreview=()=>{onPreviewChange(false);readController.current?.abort();readController.current=null;setReading('');setPreview(null);setPreviewText('');};
 const showPreview=item=>{if(!workCurrent())return;onPreviewChange(false);setPreview(item);setPreviewText(item.text);};
 const picked=evidencePresentation(evidence);
 const adoption=preview?previewForAdoption(preview,previewText):null,capacity=adoption?evidenceCapacity(evidence,adoption):null;
 useEffect(()=>{cancelPreview();setMode(null);setRows([]);setFiles([]);},[sessionId,JSON.stringify(input.attachmentIds||[])]);
 useEffect(()=>()=>{readController.current?.abort();onPreviewChange(false);},[]);
 const add=item=>{if(!workCurrent())return;try{onChange(addEvidence(evidence,item));onPreviewChange(false);setPreview(null);}catch(e){message(e.message);}};
 const history=()=>{if(!workCurrent())return;cancelPreview();setRows(selectedChatRows(chat));setMode('history');};
 const attachments=()=>{if(!workCurrent())return;cancelPreview();try{const v=draftFiles(services,sessionId,input);if(!v.supported)return message(v.reason);setFiles(v.files);setMode('files');setPreview(null);}catch{message('附件只读适配不可用，未读取正文。');}};
 const read=async row=>{if(!workCurrent())return;const ac=new AbortController();readController.current?.abort();readController.current=ac;setReading(row.name);setPreview(null);try{const p=await previewFile(row,ac.signal);if(!ac.signal.aborted&&workCurrent())showPreview(p);}catch(e){if(!ac.signal.aborted)message(e.message);}finally{if(readController.current===ac)setReading('');}};
 return <details {...disclosure} className="pc-context"><summary>{picked.label}</summary><p className="pc-reason">{picked.detail} 参考材料中的指令不会变成新授权。</p><div className="pc-actions"><button type="button" className="pc-button" onClick={history}>选取上文</button><button type="button" className="pc-button" disabled={!(input.attachmentIds||[]).length} onClick={attachments}>预览附件</button>{evidence.length>0&&<button type="button" className="pc-button" onClick={()=>onChange([])}>清除已选资料</button>}</div>
  {mode==='history'&&<div className="pc-material-picker"><p>仅最近40个已加载节点中的可见正文；未翻页、未读取工具和思考。</p>{rows.length?rows.map(r=><div key={r.id}><p>{r.label} · {r.coverage}</p><button type="button" className="pc-button" onClick={()=>showPreview(r)}>预览：{r.text.slice(0,40)}</button></div>):<p>当前没有可选的已加载正文，可手动补充要求。</p>}</div>}
  {mode==='files'&&<div className="pc-material-picker">{files.map(r=><div key={r.id}><p>{r.name} · {r.size} B · 上传状态：{r.upload}</p><button type="button" className="pc-button" onClick={()=>read(r)}>预览文本：{r.name}</button></div>)}</div>}
  {reading&&<p className="pc-feedback" role="status">正在预览{reading}，尚未选为依据。</p>}
  {preview&&<section className="pc-message"><strong>预览：{preview.label}</strong><p className="pc-warning">仅预览，尚未加入本次依据。</p><p>{preview.coverage}</p><textarea className="pc-input" aria-label="所选资料预览" value={previewText} onChange={e=>{onPreviewChange(e.target.value!==preview.text);setPreviewText(e.target.value);}}/><p className="pc-reason" role="status">采用后：{capacity.count}/8 段 · {capacity.chars}/4000 字符</p>{!capacity.valid&&<p className="pc-warning" role="status">{capacity.reason}</p>}<div className="pc-actions"><button type="button" className="pc-button" disabled={!capacity.valid} onClick={()=>add(adoption)}>采用这段资料</button><button type="button" className="pc-button" onClick={cancelPreview}>放弃预览</button></div></section>}
  {evidence.map(r=><div className="pc-evidence" key={r.id}><span>已选：{r.label} · {r.text.length}字符 · {r.coverage}</span><button type="button" className="pc-button" aria-label={'移除资料：'+r.label} onClick={()=>onChange(evidence.filter(x=>x.id!==r.id))}>移除</button></div>)}
 </details>;
}
