import React,{useLayoutEffect,useRef,useState} from 'react';
import {MethodCard} from './components.jsx';

const sameIds=(a,b)=>a.size===b.size&&[...a].every(id=>b.has(id));
const pinnedIds=(items,focusedId)=>{
 const ids=new Set();if(items.length){ids.add(items[0].id);ids.add(items[items.length-1].id);}
 const index=items.findIndex(m=>m.id===focusedId);
 if(index>=0)for(let i=Math.max(0,index-1);i<=Math.min(items.length-1,index+1);i++)ids.add(items[i].id);
 return ids;
};

// Natural-flow rows are the sole position source. Cached full-row heights are
// only placeholder estimates; old-width/content records remain useful estimates.
export function VisibleMethodList({items,cardProps,scrollRef,filterKey,fingerprint}){
 const rows=useRef(new Map()),refs=useRef(new Map()),heights=useRef(new Map()),cardStates=useRef(new Map());
 const listRef=useRef(null),controller=useRef(null),current=useRef(null);
 const [visible,setVisible]=useState(()=>new Set(items.slice(0,3).map(m=>m.id))),[focusedId,setFocusedId]=useState(null);
 const supported=typeof window.ResizeObserver==='function'&&typeof window.requestAnimationFrame==='function'&&typeof window.cancelAnimationFrame==='function';
 const active=pinnedIds(items,focusedId);
 for(const m of items)if(!supported||visible.has(m.id))active.add(m.id);
 const refFor=id=>{
  if(!refs.current.has(id))refs.current.set(id,node=>{
   const old=rows.current.get(id);if(old)controller.current?.unobserve(old);
   if(node)rows.current.set(id,node);else rows.current.delete(id);
   controller.current?.schedule();
  });
  return refs.current.get(id);
 };
 useLayoutEffect(()=>{scrollRef.current?.scrollTo?.({top:0});setFocusedId(null);},[filterKey,scrollRef]);
 useLayoutEffect(()=>{
  current.current={items,active,visible,focusedId,fingerprint};
  if(focusedId&&!items.some(m=>m.id===focusedId))setFocusedId(null);
  const root=scrollRef.current;
  if(controller.current?.root!==root||!supported){controller.current?.stop();controller.current=null;}
  if(!supported||!root)return;
  if(!controller.current){
   let live=true,frame=null;const observed=new Set();
   const schedule=()=>{if(live&&frame===null)frame=window.requestAnimationFrame(update);};
   const update=()=>{
    frame=null;if(!live||scrollRef.current!==root)return;
    const latest=current.current,viewport=root.getBoundingClientRect();
    const top=viewport.top+root.clientTop,bottom=top+root.clientHeight;
    // Read the entire batch before changing any cache or React state.
    const measured=latest.items.map(m=>{const node=rows.current.get(m.id);return {id:m.id,node,rect:node?.getBoundingClientRect()};});
    if(viewport.width<=0||root.clientHeight<=0)return;
    const next=pinnedIds(latest.items,latest.focusedId);
    for(const {id,node,rect} of measured){
     if(!rect||rows.current.get(id)!==node||rect.width<=0||rect.height<=0)continue;
     if(rect.bottom>=top-600&&rect.top<=bottom+600)next.add(id);
     if(latest.active.has(id)&&node.firstElementChild){
      const old=heights.current.get(id);
      if(!old||old.height!==rect.height||old.width!==rect.width||old.fingerprint!==latest.fingerprint)
       heights.current.set(id,{height:rect.height,width:rect.width,fingerprint:latest.fingerprint});
     }
    }
    if(!sameIds(next,latest.visible))setVisible(next);
   };
   const resize=new window.ResizeObserver(entries=>{
    if(!live)return;
    if(entries.some(({target})=>observed.has(target)&&(!target.dataset?.pcVirtualMethod||rows.current.get(target.dataset.pcVirtualMethod)===target)))schedule();
   });
   const unobserve=node=>{if(observed.delete(node))resize.unobserve(node);};
   controller.current={root,schedule,unobserve,sync(){
    const targets=new Set([root,listRef.current,root.querySelector('.pc-bundles')].filter(Boolean));
    for(const id of current.current.active){const node=rows.current.get(id);if(node)targets.add(node);}
    for(const node of observed)if(!targets.has(node))unobserve(node);
    for(const node of targets)if(!observed.has(node)){observed.add(node);resize.observe(node);}
   },stop(){live=false;if(frame!==null)window.cancelAnimationFrame(frame);frame=null;root.removeEventListener('scroll',schedule);resize.disconnect();observed.clear();}};
   root.addEventListener('scroll',schedule,{passive:true});
  }
  controller.current.sync();
  // Covers parent commits that move the list without changing its own size.
  // A changed range gets another post-commit check; a stable batch schedules none.
  controller.current.schedule();
 });
 useLayoutEffect(()=>()=>{controller.current?.stop();controller.current=null;current.current=null;},[]);
 return <div ref={listRef} className="pc-virtual-list" role="list" aria-label="方法卡列表">
  {items.map((m,index)=><div key={m.id} ref={refFor(m.id)} data-pc-virtual-method={m.id} className="pc-virtual-row" role="listitem" aria-posinset={index+1} aria-setsize={items.length}
   style={active.has(m.id)?undefined:{height:heights.current.get(m.id)?.height||480}}
   onFocusCapture={()=>setFocusedId(m.id)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocusedId(current=>current===m.id?null:current);}}>
   {active.has(m.id)&&<MethodCard {...cardProps} m={m} viewCache={cardStates.current}/>}
  </div>)}
 </div>;
}
