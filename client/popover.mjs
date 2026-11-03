import {viewportBounds,clampPosition,popoverLayout} from './panel-position.mjs';
import {constrainRect,resizeRect,usableViewport} from './panel-resize.mjs';
import {panelMinimum} from './panel-minimum.mjs';
// Only observes external floating surfaces while this panel is logically open.
// Candidate discovery and visibility are separate: streaming chat text is not rescanned.
export function observeForeignSurfaces(panel,win,onChange,host={}){
 const doc=panel.ownerDocument,selector='dialog,[role="dialog"],[role="menu"],[role="listbox"],[popover],[data-seat-panel]';
 if(!doc?.querySelectorAll)return {check:()=>false,refresh:()=>{},release:()=>{}};
 const candidates=new Set(),pending=new Set(),watched=new Set();let stopped=false,queued=false,visibility=null,failed=false;
 const owns=n=>n===panel||panel.contains(n);
 const discover=n=>{if(!n||owns(n))return false;let found=false;if(n.matches?.(selector)){candidates.add(n);found=true;}for(const x of n.querySelectorAll?.(selector)||[])if(!owns(x)){candidates.add(x);found=true;}return found;};
 const visible=n=>{
  if(!n.isConnected||owns(n))return false;
  for(let a=n;a&&a.nodeType===1;a=a.parentElement){
   if(a.hidden||a.inert||a.getAttribute('aria-hidden')==='true')return false;
   const s=win.getComputedStyle(a);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse')return false;
  }
  const r=n.getBoundingClientRect();return r.width>0&&r.height>0;
 };
 const floats=n=>{for(let a=n;a&&a!==doc.body;a=a.parentElement)if(['absolute','fixed'].includes(win.getComputedStyle(a).position))return true;return false;};
 const qualifies=n=>n.matches(selector)&&visible(n)&&(n.matches(':modal,:popover-open,[data-seat-panel],[aria-modal="true"]')||floats(n));
 const check=(fresh=false)=>{
  if(stopped||failed)return true;
  try{if(fresh){
   // Drain not-yet-delivered records before reusing discovery; a newly opened
   // modal must still block the very first action. Legacy shims fall back.
   if(typeof mutations?.takeRecords==='function'){
    const changed=consume(mutations.takeRecords()),visibilityChanged=Boolean(visibility?.takeRecords?.().length);
    if(changed)watch();
    // Draining records prevents their observer callback. Preserve its deferred
    // notification too, including when focus returns while a menu is removed.
    if(changed||visibilityChanged)schedule();
   }
   else{discover(doc.body);watch();}
  }return pending.size>0||Boolean(host.isBehindModal?.(panel))||[...candidates].some(qualifies);}catch{return true;}
 };
 const watch=()=>{
  const next=new Set();for(const n of candidates){if(!n.isConnected){candidates.delete(n);continue;}for(let a=n;a;a=a.parentElement)next.add(a);}
  if(next.size===watched.size&&[...next].every(n=>watched.has(n)))return;
  visibility?.disconnect();watched.clear();for(const n of next){watched.add(n);visibility?.observe(n,{attributes:true,attributeFilter:['class','style','hidden','inert','aria-hidden']});}
 };
 const refresh=()=>{if(stopped)return;watch();onChange(check());};
 const schedule=()=>{if(stopped||queued)return;queued=true;win.queueMicrotask(()=>{queued=false;if(!stopped){pending.clear();refresh();}});};
 const consume=records=>{
  let relevant=false;for(const r of records){if(owns(r.target))continue;
   if(r.type==='childList'){for(const n of r.addedNodes)if(discover(n))relevant=true;if([...r.removedNodes].some(n=>n.nodeType===1)&&[...candidates].some(n=>!n.isConnected))relevant=true;}
   else{discover(r.target);relevant=true;}
  }return relevant;
 };
 const mutations=typeof win.MutationObserver==='function'?new win.MutationObserver(records=>{if(consume(records))schedule();}):null;
 visibility=typeof win.MutationObserver==='function'?new win.MutationObserver(schedule):null;
 const toggle=e=>{if(owns(e.target))return;discover(e.target);if(e.type==='beforetoggle'&&e.newState==='open'){pending.add(e.target);onChange(true,true);}schedule();};
 const focus=()=>{if(check())onChange(true);};
 try{
  discover(doc.body);mutations?.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['role','aria-modal','aria-hidden','hidden','inert','popover','open','data-seat-panel']});
  doc.addEventListener('beforetoggle',toggle,true);doc.addEventListener('toggle',toggle,true);doc.addEventListener('focusin',focus,true);refresh();
 }catch{failed=true;onChange(true);}
 return {check,refresh,release:()=>{if(stopped)return;stopped=true;mutations?.disconnect();visibility?.disconnect();pending.clear();candidates.clear();watched.clear();doc.removeEventListener('beforetoggle',toggle,true);doc.removeEventListener('toggle',toggle,true);doc.removeEventListener('focusin',focus,true);}};
}
// Owns one surface's geometry, transient pointer transaction and listeners.
// Position / size intent is session-local and separate for compact / expanded modes.
export function mountCoachPopover(panel,anchor,onClose,win=window,expanded=false,positions={},surface={}){
 if(!panel||!anchor)return()=>{};
 const originalPopover=panel.getAttribute?.('popover')??null;let supported=typeof panel.showPopover==='function';const handle=panel.querySelector?.('[data-pc-drag-handle]'),grips=Array.from(panel.querySelectorAll?.('[data-pc-resize]')||[]),mode=expanded?'expanded':'compact';
 let stopped=false,interaction=null,placing=false,observer=null,observedCard=null,suspended=false,visible=false,guard=null,returnFocus=null,lastOwnedFocus=null;
 const previous={inert:panel.inert,visibility:panel.style.visibility,pointerEvents:panel.style.pointerEvents};
 const assign=(name,value)=>{if(panel.style[name]!==value)panel.style[name]=value;};
 const read=()=>{const r=panel.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};};
 const paint=r=>{for(const [key,value] of Object.entries({left:r.x,top:r.y,width:r.width,height:r.height}))assign(key,value+'px');};
 // Start each pointer frame from the pre-gesture intent, so returning to the
 // starting rectangle also restores fields that were previously unspecified.
 const remember=(prior,changes)=>{const next={...prior,...changes};if(Object.keys(next).length)positions[mode]=next;else delete positions[mode];};
 const watchCard=()=>{
  const card=panel.querySelector?.('.pc-scroll .pc-card');
  if(card!==observedCard){if(observedCard)observer?.unobserve(observedCard);observedCard=card;if(card)observer?.observe(card);}
 };
 const place=()=>{
  if(stopped||suspended||placing||interaction)return;placing=true;
  try{
   const a=anchor.getBoundingClientRect(),v=viewportBounds(win),layout=popoverLayout(a,v,expanded),bounds=usableViewport(v),saved=positions[mode];
   panel.dataset.focusView=String(expanded);assign('maxHeight',bounds.height+'px');
   const width=Math.min(bounds.width,Math.max(Math.min(448,bounds.width),saved?.width??layout.width));
   assign('width',width+'px');
   const height=expanded?bounds.height:Math.max(panelMinimum(panel).height,saved?.height??layout.maxHeight);
   const r=constrainRect({x:saved?.x??layout.defaultLeft??v.left+(v.width-width)/2,y:saved?.y??a.top-height-8,width,height},v,panelMinimum(panel),expanded);
   paint(r);watchCard();
  }finally{placing=false;}
 };
 const finish=()=>{
  const old=interaction;interaction=null;delete panel.dataset.resizing;if(handle)delete handle.dataset.dragging;
  if(old?.target?.hasPointerCapture?.(old.id))try{old.target.releasePointerCapture(old.id);}catch{}
 };
 const begin=(e,edge,target)=>{
  if(stopped||suspended||interaction||e.button!==0||e.isPrimary===false)return;
  if(!edge&&e.target?.closest?.('button,input,select,a,summary,textarea'))return;
  if(expanded&&edge&&!['e','w'].includes(edge))return;
  interaction={id:e.pointerId,edge,target,start:read(),startX:e.clientX,startY:e.clientY,prior:positions[mode]?{...positions[mode]}:null};
  e.preventDefault();target?.focus?.({preventScroll:true});if(edge)panel.dataset.resizing=edge;else if(handle)handle.dataset.dragging='true';
  try{target?.setPointerCapture?.(e.pointerId);}catch{}
 };
 const down=e=>begin(e,'',handle);
 const resizeTo=(start,edge,dx,dy,prior)=>{
  if(expanded&&!['e','w'].includes(edge))return;
  const v=viewportBounds(win);let r=resizeRect(start,edge,dx,dy,v,panelMinimum(panel),expanded);
  // Horizontal wrapping changes the one-card floor; resolve it at the new width.
  assign('width',r.width+'px');const minimum=panelMinimum(panel);r=resizeRect(start,edge,dx,dy,v,minimum,expanded);paint(r);
  // A corner's small vertical delta can be swallowed by a new wrapping floor.
  // Compare against the same layout without user deltas before saving that axis.
  const constrained=resizeRect(start,edge,0,0,v,minimum,expanded);
  const changes={};
  if(/[ew]/.test(edge)&&dx!==0&&r.width!==start.width&&r.width!==constrained.width){changes.x=r.x;changes.width=r.width;}
  if(!expanded&&/[ns]/.test(edge)&&dy!==0&&r.height!==start.height&&r.height!==constrained.height){changes.y=r.y;changes.height=r.height;}
  remember(prior,changes);
 };
 const moveTo=(start,dx,dy,prior)=>{
  const p=clampPosition({x:start.x+dx,y:start.y+(expanded?0:dy)},viewportBounds(win),start,expanded);
  paint({...start,x:p.x,y:p.y});const changes={};
  if(dx!==0&&p.x!==start.x)changes.x=p.x;if(!expanded&&dy!==0&&p.y!==start.y)changes.y=p.y;
  remember(prior,changes);
 };
 const pointerMove=e=>{
  const op=interaction;if(!op||e.pointerId!==op.id)return;e.preventDefault();
  if(op.edge)resizeTo(op.start,op.edge,e.clientX-op.startX,e.clientY-op.startY,op.prior);
  else moveTo(op.start,e.clientX-op.startX,e.clientY-op.startY,op.prior);
 };
 const pointerEnd=e=>{if(interaction&&e.pointerId===interaction.id){finish();place();}};
 const reset=()=>{finish();delete positions[mode];place();};
 const handleKey=e=>{
  if(suspended||e.defaultPrevented||e.target!==handle||e.isComposing)return;const step=e.shiftKey?24:8,d={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
  if(d){e.preventDefault();e.stopPropagation();moveTo(read(),...d,positions[mode]);}
  else if(['Home','Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();reset();}
 };
 const key=e=>{if(suspended||e.defaultPrevented||e.key!=='Escape'||e.isComposing)return;e.stopPropagation();if(interaction){const op=interaction;finish();if(op.prior)positions[mode]=op.prior;else delete positions[mode];paint(op.start);place();e.preventDefault();}else onClose();};
 const owned=grips.map(g=>{
  const edge=g.dataset.pcResize,down=e=>begin(e,edge,g),key=e=>{
   if(suspended||e.defaultPrevented||e.target!==g||e.isComposing)return;const step=e.shiftKey?24:8,d={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
   if(d){e.preventDefault();e.stopPropagation();resizeTo(read(),edge,...d,positions[mode]);}else if(e.key==='Home'){e.preventDefault();e.stopPropagation();reset();}
  };
  g.addEventListener('pointerdown',down);g.addEventListener('keydown',key);g.addEventListener('lostpointercapture',finish);return {g,down,key};
 });
 const viewportChange=()=>{finish();guard?.refresh();place();};
 const notify=()=>surface.onVisibility?.(visible&&!suspended);
 const conceal=deferNative=>{
  if(!suspended){const active=panel.ownerDocument?.activeElement;returnFocus=panel.contains?.(active)?active:lastOwnedFocus;}
  suspended=true;finish();panel.inert=true;assign('visibility','hidden');assign('pointerEvents','none');notify();
  if(!deferNative&&supported&&visible)try{panel.hidePopover();visible=false;}catch{/* Still inert and invisible; explicit resume can retry. */}
 };
 const reveal=()=>{
  suspended=false;
  try{if(supported&&(!visible||(panel.matches&&!panel.matches(':popover-open'))))panel.showPopover();else if(!supported)panel.removeAttribute('popover');visible=true;}
  catch{conceal(false);return;}
  panel.inert=previous.inert;assign('visibility',previous.visibility);assign('pointerEvents',previous.pointerEvents);place();notify();
  const target=returnFocus;returnFocus=null;
  if(target?.isConnected&&!target.disabled&&panel.contains(target)&&panel.ownerDocument.activeElement===panel.ownerDocument.body)target.focus({preventScroll:true});
 };
 guard=observeForeignSurfaces(panel,win,(blocked,deferNative)=>{if(blocked)conceal(deferNative);else if(suspended||!visible)reveal();},surface);
 if(!guard.check()){reveal();if(visible&&!suspended)panel.focus({preventScroll:true});}
 const protect=e=>{if(guard.check(true)){conceal(false);e.preventDefault();e.stopImmediatePropagation?.();}};
 const rememberFocus=e=>{lastOwnedFocus=e.target;};
 const leaveFocus=e=>{if(!panel.contains(e.target)&&!guard.check(true)){lastOwnedFocus=null;returnFocus=null;}};
 panel.addEventListener('focusin',rememberFocus,true);panel.ownerDocument?.addEventListener('focusin',leaveFocus,true);
 panel.addEventListener('pointerdown',protect,true);panel.addEventListener('click',protect,true);panel.addEventListener('keydown',protect,true);
 panel.addEventListener('keydown',key);handle?.addEventListener('pointerdown',down);handle?.addEventListener('keydown',handleKey);handle?.addEventListener('dblclick',reset);handle?.addEventListener('lostpointercapture',finish);
 win.addEventListener('pointermove',pointerMove,{passive:false});win.addEventListener('pointerup',pointerEnd);win.addEventListener('pointercancel',pointerEnd);win.addEventListener('blur',finish);
 win.addEventListener('resize',viewportChange);win.visualViewport?.addEventListener('resize',viewportChange);win.visualViewport?.addEventListener('scroll',viewportChange);
 observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(place):null;observer?.observe(panel);observer?.observe(anchor);watchCard();
 // Query/variant changes may replace a card without resizing the outer surface.
 // Observe content, never style attributes: painting cannot trigger a feedback loop.
 const content=panel.querySelector?.('.pc-scroll'),mutations=content&&typeof win.MutationObserver==='function'?new win.MutationObserver(place):null;
 mutations?.observe(content,{childList:true,characterData:true,subtree:true});
 const release=()=>{
  if(stopped)return;stopped=true;guard?.release();finish();observer?.disconnect();mutations?.disconnect();
  panel.removeEventListener('focusin',rememberFocus,true);panel.ownerDocument?.removeEventListener('focusin',leaveFocus,true);lastOwnedFocus=null;returnFocus=null;
  panel.removeEventListener('pointerdown',protect,true);panel.removeEventListener('click',protect,true);panel.removeEventListener('keydown',protect,true);
  for(const {g,down,key} of owned){g.removeEventListener('pointerdown',down);g.removeEventListener('keydown',key);g.removeEventListener('lostpointercapture',finish);}
  panel.removeEventListener('keydown',key);handle?.removeEventListener('pointerdown',down);handle?.removeEventListener('keydown',handleKey);handle?.removeEventListener('dblclick',reset);handle?.removeEventListener('lostpointercapture',finish);
  win.removeEventListener('pointermove',pointerMove);win.removeEventListener('pointerup',pointerEnd);win.removeEventListener('pointercancel',pointerEnd);win.removeEventListener('blur',finish);win.removeEventListener('resize',viewportChange);
  panel.inert=previous.inert;assign('visibility',previous.visibility);assign('pointerEvents',previous.pointerEvents);
  win.visualViewport?.removeEventListener('resize',viewportChange);win.visualViewport?.removeEventListener('scroll',viewportChange);if(supported)try{panel.hidePopover();}catch{}else if(originalPopover!==null&&panel.getAttribute?.('popover')===null)panel.setAttribute?.('popover',originalPopover);
 };
 release.update=()=>{guard.refresh();place();};release.resume=()=>{guard.refresh();if(!suspended)panel.focus({preventScroll:true});};return release;
}
