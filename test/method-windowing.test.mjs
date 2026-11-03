import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {sdkRequire,buildRequire} from './helpers/deps.mjs';
const React=sdkRequire('react'),esbuild=buildRequire('esbuild');
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;
const nodes=n=>!n||typeof n!=='object'?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)];
const built=await esbuild.build({stdin:{contents:readFileSync(new URL('../src/method-list.jsx',import.meta.url),'utf8')+'\nexport {MethodCard} from "./components.jsx";',resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],logLevel:'silent'});
// Component event/effect harness with natural-flow, unequal row geometry.
// This checks scheduling and range correctness, not browser layout/performance.
function hooks(trace=[]){
 const cells=[];let cursor=0,dirty=false,effects=[],writes=0,commits=0;
 const cell=make=>{const i=cursor++;return cells[i]??(cells[i]=make());};
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const effect=(fn,deps)=>{const c=cell(()=>({}));if(!same(c.deps,deps)){c.deps=deps;effects.push(()=>{c.clean?.();c.clean=fn();});}};
 const react={...React,useState:initial=>{const c=cell(()=>({value:typeof initial==='function'?initial():initial}));return[c.value,next=>{writes++;trace.push('state');const v=typeof next==='function'?next(c.value):next;if(!Object.is(v,c.value)){c.value=v;dirty=true;}}];},useRef:value=>cell(()=>({current:value})),useEffect:effect,useLayoutEffect:effect,useSyncExternalStore:(_sub,get)=>get()};
 return {react,get dirty(){return dirty;},get writes(){return writes;},get commits(){return commits;},render(fn,attach=()=>{}){let tree;for(let i=0;i<20;i++){cursor=0;dirty=false;effects=[];tree=fn();attach(tree);commits++;for(const e of effects)e();if(!dirty)return tree;}throw Error('render did not settle');},close(){for(const c of cells){c.clean?.();c.clean=null;}}};
}
function fixture(supported=true){
 const trace=[],h=hooks(trace),instances={intersection:[],resize:[]},dom=new Map(),frames=new Map(),cancelled=[],heights=new Map();
 const layout={top:80,width:700,clientTop:4,clientHeight:500,before:260,scrollTop:0},bundles={dataset:{}},list={dataset:{}},listeners=new Set();
 let tick=0,scrolls=0,tree,lastItems=methods,lastFilter='',lastFingerprint='initial';
 const heightFor=id=>heights.get(id)??(260+methods.findIndex(m=>m.id===id)%5*80);
 const actualHeight=d=>d.node.firstElementChild?heightFor(d.node.dataset.pcVirtualMethod):d.placeholder;
 const root={dataset:{},get clientTop(){return layout.clientTop;},get clientHeight(){return layout.clientHeight;},getBoundingClientRect(){trace.push('root');return {top:layout.top,width:layout.width+12,height:layout.clientHeight+8};},querySelector:selector=>selector==='.pc-bundles'?bundles:null,scrollTo({top}){scrolls++;layout.scrollTop=top;},addEventListener(type,fn,options){assert.equal(type,'scroll');assert.equal(options.passive,true);listeners.add(fn);},removeEventListener(type,fn){assert.equal(type,'scroll');listeners.delete(fn);}};
 const Observer=kind=>class{constructor(cb,options){this.cb=cb;this.options=options;this.observed=new Set();this.disconnected=false;instances[kind].push(this);}observe(n){this.observed.add(n);}unobserve(n){this.observed.delete(n);}disconnect(){this.disconnected=true;this.observed.clear();}emit(entries){this.cb(entries);}};
 const win=supported?{IntersectionObserver:Observer('intersection'),ResizeObserver:Observer('resize'),requestAnimationFrame(cb){frames.set(++tick,cb);return tick;},cancelAnimationFrame(id){cancelled.push(frames.get(id));frames.delete(id);}}:{};
 const mod={exports:{}};new Function('require','module','exports','window',built.outputFiles[0].text)(id=>id==='react'?h.react:sdkRequire(id),mod,mod.exports,win);
 const scrollRef={current:root};
 const attach=next=>{
  if(next.ref)next.ref.current=list;
  const current=new Set();for(const n of nodes(next)){
   const id=n.props?.['data-pc-virtual-method'];if(!id)continue;current.add(id);let d=dom.get(id);
   if(!d){d={node:{dataset:{pcVirtualMethod:id},firstElementChild:null,getBoundingClientRect(){trace.push(id);let top=layout.top+layout.clientTop+layout.before-layout.scrollTop;for(const m of lastItems){if(m.id===id)break;top+=actualHeight(dom.get(m.id));}const height=actualHeight(d);return {top,bottom:top+height,height,width:layout.width};}},ref:null,placeholder:480};dom.set(id,d);}
   d.node.firstElementChild=n.props.children||null;d.placeholder=n.props.style?.height??480;
   if(d.ref!==n.ref){d.ref?.(null);d.ref=n.ref;d.ref?.(d.node);}
  }
  for(const [id,d] of dom)if(!current.has(id)){d.ref?.(null);dom.delete(id);}
 };
 const render=(items=lastItems,filterKey=lastFilter,fingerprint=lastFingerprint)=>{lastItems=items;lastFilter=filterKey;lastFingerprint=fingerprint;return tree=h.render(()=>mod.exports.VisibleMethodList({items,cardProps:{},scrollRef,filterKey,fingerprint}),attach);};
 const frame=()=>{const entries=[...frames];frames.clear();for(const [,fn] of entries)fn();if(h.dirty)render();return tree;};
 const settle=()=>{for(let i=0;i<60;i++){if(!frames.size&&!h.dirty)return tree;if(h.dirty)render();if(frames.size)frame();}throw Error('frames did not settle');};
 const scroll=top=>{layout.scrollTop=top;for(const fn of listeners)fn();};
 const jump=index=>{let top=layout.before;for(const m of lastItems.slice(0,index))top+=actualHeight(dom.get(m.id));scroll(top);};
 return {h,api:mod.exports,instances,dom,render,frame,settle,scroll,jump,root,scrollRef,list,bundles,layout,heights,frames,trace,cancelled,listeners,win,scrolls:()=>scrolls,get tree(){return tree;},close(){h.close();}};
}
const cards=tree=>nodes(tree).filter(n=>n.type?.name==='MethodCard');
const ids=tree=>cards(tree).map(n=>n.props.m.id);
const row=(tree,id)=>nodes(tree).find(n=>n.props?.['data-pc-virtual-method']===id);
function assertWindow(f,items=methods){
 const mounted=new Set(ids(f.tree)),top=f.layout.top+f.layout.clientTop,bottom=top+f.layout.clientHeight;
 for(const m of items){const rect=f.dom.get(m.id).node.getBoundingClientRect();if(rect.width>0&&rect.height>0&&rect.bottom>=top-600&&rect.top<=bottom+600)assert.ok(mounted.has(m.id),`missing intersecting row ${m.id}`);}
 if(items.length){assert.ok(mounted.has(items[0].id));assert.ok(mounted.has(items.at(-1).id));}
 assert.deepEqual(ids(f.tree),items.filter(m=>mounted.has(m.id)).map(m=>m.id),'natural order');
}
test('actual row rectangles follow large jumps and immediate reversal while first and last remain in place',()=>{
 const f=fixture();try{
 let tree=f.render();assert.equal(cards(tree).length,4);assert.equal(nodes(tree).filter(n=>n.props?.role==='listitem').length,90);
 f.settle();assert.equal(f.instances.intersection.length,0);assertWindow(f);
 for(const target of [3600,6000,2400,18000,34000,0]){f.scroll(target);f.settle();assertWindow(f);assert.ok(cards(f.tree).length<12);}
 f.jump(70);f.scroll(500);f.settle();assertWindow(f);assert.ok(!ids(f.tree).includes(methods[70].id),'only latest position survives');
 assert.equal(f.frames.size,0);
 }finally{f.close();}assert.ok(f.instances.resize.every(o=>o.disconnected));assert.equal(f.listeners.size,0);
});
test('scroll and resize coalesce into one batch, read all rows before state, then stop when stable',()=>{
 const f=fixture();try{
 f.render();f.settle();f.jump(40);for(let i=0;i<20;i++){f.scroll(f.layout.scrollTop);f.instances.resize[0].emit([{target:f.root}]);}
 assert.equal(f.frames.size,1);f.trace.length=0;f.frame();
 assert.deepEqual(f.trace.slice(0,91),['root',...methods.map(m=>m.id)]);assert.equal(f.trace[91],'state');
 f.settle();const commits=f.h.commits,writes=f.h.writes;f.scroll(f.layout.scrollTop);f.frame();
 assert.equal(f.h.commits,commits);assert.equal(f.h.writes,writes,'stable range does not even call setState');assert.equal(f.frames.size,0);
 }finally{f.close();}
});
test('range uses the internal viewport boundary, not the outer root rectangle',()=>{
 const f=fixture();try{
 f.layout.before=1114;f.layout.clientTop=100;f.render();f.settle();
 // Root top 80 + border 100 + height 500 + overscan 600 = 1280.
 // Put row 20 exactly on that internal lower edge, independently of cached heights.
 const node=f.dom.get(methods[20].id).node;node.getBoundingClientRect=()=>({top:1280,bottom:1380,height:100,width:700});
 f.scroll(0);f.settle();assert.ok(ids(f.tree).includes(methods[20].id));
 node.getBoundingClientRect=()=>({top:1281,bottom:1381,height:100,width:700});f.scroll(0);f.settle();assert.ok(!ids(f.tree).includes(methods[20].id));
 }finally{f.close();}
});
test('bundles and parent layout commits recompute positions without another scroll event',()=>{
 const f=fixture();try{
 f.render();f.settle();f.jump(40);f.settle();const before=ids(f.tree),ro=f.instances.resize[0];
 for(const n of [f.root,f.list,f.bundles])assert.ok(ro.observed.has(n));
 f.layout.before+=3000;ro.emit([{target:f.bundles}]);f.settle();assertWindow(f);assert.notDeepEqual(ids(f.tree),before);
 const next=ids(f.tree);f.layout.before-=2000;f.render();f.settle();assertWindow(f);assert.notDeepEqual(ids(f.tree),next);
 }finally{f.close();}
});
test('each effective commit can recheck newly corrected heights until the range settles',()=>{
 const f=fixture();try{
 for(const m of methods)f.heights.set(m.id,80);f.render();let rounds=0;
 while(f.frames.size){f.frame();rounds++;assert.ok(rounds<30);}
 assert.ok(rounds>=3,'more than a single post-jump correction is allowed');assertWindow(f);assert.ok(cards(f.tree).length<20);assert.equal(f.frames.size,0);
 }finally{f.close();}
});
test('focused card and adjacent cards remain mounted across jumps, including entry endpoints',()=>{
 const f=fixture();try{
 f.render();f.settle();f.jump(30);f.settle();row(f.tree,methods[30].id).props.onFocusCapture();f.render();f.settle();
 f.jump(75);f.settle();for(const i of [0,29,30,31,89])assert.ok(ids(f.tree).includes(methods[i].id));assert.ok(cards(f.tree).length<15);
 row(f.tree,methods[30].id).props.onBlurCapture({currentTarget:{contains:()=>true},relatedTarget:{}});f.render();f.settle();assert.ok(ids(f.tree).includes(methods[30].id));
 row(f.tree,methods[30].id).props.onBlurCapture({currentTarget:{contains:()=>false},relatedTarget:null});f.render();f.settle();assert.ok(!ids(f.tree).includes(methods[30].id));
 row(f.tree,methods[89].id).props.onFocusCapture();f.render();f.settle();assert.ok(ids(f.tree).includes(methods[88].id),'reverse entry can continue to predecessor');
 row(f.tree,methods[0].id).props.onFocusCapture();f.render();f.settle();assert.ok(ids(f.tree).includes(methods[1].id),'forward entry can continue to successor');
 }finally{f.close();}
});
test('width and fingerprint changes remeasure live rows and preserve old offscreen estimates',()=>{
 const f=fixture();try{
 f.render();f.settle();f.jump(25);f.settle();const id=methods[25].id,oldHeight=260;
 f.scroll(0);f.settle();assert.equal(row(f.tree,id).props.style.height,oldHeight);
 f.layout.width=400;for(const m of methods)f.heights.set(m.id,640);f.instances.resize[0].emit([{target:f.root}]);f.settle();
 assert.equal(row(f.tree,id).props.style.height,oldHeight,'old-width cache stays as an estimate, not 480');
 f.jump(25);f.settle();assert.ok(ids(f.tree).includes(id));f.scroll(0);f.settle();assert.equal(row(f.tree,id).props.style.height,640);
 f.jump(25);f.settle();f.heights.set(id,910);f.render(methods,'','changed fingerprint');f.settle();f.scroll(0);f.settle();assert.equal(row(f.tree,id).props.style.height,910);
 f.jump(25);f.settle();f.layout.width=0;f.heights.set(id,0);f.instances.resize[0].emit([{target:f.root}]);f.settle();
 f.layout.width=700;f.scroll(0);f.settle();assert.equal(row(f.tree,id).props.style.height,910,'hidden/zero row cannot poison a valid estimate');
 }finally{f.close();}
});
test('filters use the latest items, pin their own endpoints, reset once and permit empty results',()=>{
 const f=fixture();try{
 f.render();f.settle();f.jump(60);const before=f.scrolls(),filtered=[methods[70],methods[88]];
 f.render(filtered,'late');f.settle();assert.equal(f.scrolls(),before+1);assert.deepEqual(ids(f.tree),filtered.map(m=>m.id));
 f.render(filtered,'late');f.settle();assert.equal(f.scrolls(),before+1);
 f.render([],'empty');f.settle();assert.equal(cards(f.tree).length,0);assert.equal(f.dom.size,0);
 f.render(methods,'restored');f.settle();assertWindow(f);
 }finally{f.close();}
 const fallback=fixture(false);try{assert.equal(cards(fallback.render()).length,90);assert.equal(fallback.frames.size,0);}finally{fallback.close();}
});
test('late removed-node and disconnected callbacks cannot poison replacement rows or restart work',()=>{
 const f=fixture();try{
 const id=methods[25].id;f.render();f.settle();f.jump(25);f.settle();const old=f.dom.get(id).node,ro=f.instances.resize[0];
 f.render(methods.filter(m=>m.id!==id),'without');f.settle();f.render(methods,'restored');f.settle();const current=f.dom.get(id).node;assert.notEqual(current,old);
 old.getBoundingClientRect=()=>({top:0,bottom:9000,height:9000,width:700});ro.emit([{target:old}]);assert.equal(f.frames.size,0);assert.equal(row(f.tree,id).props.style.height,260);
 f.jump(25);const lateFrame=[...f.frames.values()][0],writes=f.h.writes;f.close();assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);assert.ok(f.cancelled.includes(lateFrame));
 lateFrame();ro.emit([{target:current},{target:f.root}]);assert.equal(f.h.writes,writes);assert.equal(f.frames.size,0);
 }finally{f.close();}
});
test('removing a focused result without changing the filter key releases its focus pin',()=>{
 const f=fixture();try{
 f.render();f.settle();f.jump(25);f.settle();row(f.tree,methods[25].id).props.onFocusCapture();f.render();f.settle();
 f.jump(75);f.settle();assert.ok(ids(f.tree).includes(methods[25].id));
 f.render(methods.filter(m=>m.id!==methods[25].id));f.settle();f.render(methods);f.settle();
 assert.ok(!ids(f.tree).includes(methods[25].id));assertWindow(f);
 }finally{f.close();}
});
test('replacing the scroll root cancels the old frame and disconnects its observer',()=>{
 const f=fixture();try{
 f.render();f.settle();f.jump(50);const lateFrame=[...f.frames.values()][0],oldObserver=f.instances.resize[0];
 f.scrollRef.current={...f.root};f.render();assert.ok(oldObserver.disconnected);assert.ok(f.cancelled.includes(lateFrame));
 const writes=f.h.writes;lateFrame();oldObserver.emit([{target:f.root}]);assert.equal(f.h.writes,writes);assert.equal(f.frames.size,1);
 assert.equal(f.listeners.size,1);f.settle();assertWindow(f);
 }finally{f.close();}
});
test('missing required scheduling capability keeps the full-list safe fallback',()=>{
 for(const capability of ['ResizeObserver','requestAnimationFrame','cancelAnimationFrame']){
 const f=fixture();try{delete f.win[capability];assert.equal(cards(f.render()).length,90);assert.equal(f.frames.size,0);assert.equal(f.instances.resize.length,0);}finally{f.close();}
 }
 const f=fixture();try{delete f.win.IntersectionObserver;f.render();f.settle();assertWindow(f);assert.ok(cards(f.tree).length<12);}finally{f.close();}
});
test('card local choice, consent and sources survive remount but draft changes reset consent',()=>{
 const cache=new Map(),base=methods.find(m=>m.id==='scope')||methods[0],m={...base,id:'scope',variants:[{id:'example',label:'示例写法',snippet:'只检查。'}]};
 const snap={value:{favorites:[]},writable:true},library={subscribe:()=>()=>{},getSnapshot:()=>snap};
 function mounted(rev){const f=fixture();const render=()=>f.h.render(()=>f.api.MethodCard({m,methods,library,input:{draftRev:rev,phase:'plain'},viewCache:cache,onChooseMethod:()=>{}}));return {f,render};}
 let c=mounted(1),tree=c.render();const select=nodes(tree).find(n=>n.type==='select');select.props.onChange({target:{value:'example'}});tree=c.render();
 // Consent applies to real decision methods. Exercise it when the catalog marks this method as such.
 const checkbox=nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox');assert.ok(checkbox);checkbox.props.onChange({target:{checked:true}});
 tree=c.render();const detail=nodes(tree).find(n=>n.type==='details');detail.props.onToggle({currentTarget:{isConnected:true,open:true}});c.render();c.f.close();
 assert.equal(cache.get('scope').agreed,true);assert.equal(cache.get('scope').variantId,'example');assert.equal(cache.get('scope').sourceOpen,true);
 c=mounted(1);tree=c.render();assert.equal(nodes(tree).find(n=>n.type==='select').props.value,'example');assert.equal(nodes(tree).find(n=>n.type==='input').props.checked,true);assert.equal(nodes(tree).find(n=>n.type==='details').props.open,true);c.f.close();
 c=mounted(2);tree=c.render();assert.equal(nodes(tree).find(n=>n.type==='input').props.checked,false);assert.equal(cache.get('scope').agreed,false);c.f.close();
});

test('ordinary cards without an input or virtualization cache still render',()=>{
 const f=fixture();try{
 const snap={value:{favorites:[]},writable:true},library={subscribe:()=>()=>{},getSnapshot:()=>snap};
 const tree=f.h.render(()=>f.api.MethodCard({m:methods[0],methods,library}));
 assert.equal(tree.type,'article');assert.equal(tree.props['data-method'],methods[0].id);
 }finally{f.close();}
});

test('late favorite failure remains visible after a row unmounts, but not in a new task',async()=>{
 for(const active of [true,false]){
 const f=fixture(),messages=[];let reject;
 const library={subscribe:()=>()=>{},getSnapshot:()=>({value:{favorites:[]},writable:true}),mutate:()=>new Promise((_resolve,no)=>{reject=no;})};
 const tree=f.h.render(()=>f.api.MethodCard({m:methods[0],methods,library,viewCache:new Map(),message:text=>messages.push(text),workCurrent:()=>active}));
 const pending=nodes(tree).find(n=>n.props?.className==='pc-button pc-star').props.onClick();f.close();reject(new Error('synthetic save failure'));await pending;
 assert.deepEqual(messages,active?['synthetic save failure']:[]);
 }
});
