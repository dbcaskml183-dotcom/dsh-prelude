import test from 'node:test';import assert from 'node:assert/strict';
import {resizeRect,constrainRect,usableViewport} from '../client/panel-resize.mjs';
import {mountCoachPopover} from '../client/popover.mjs';
const v={left:0,top:0,width:1600,height:1100},s={x:200,y:200,width:800,height:700},min={width:448,height:560};
const expected={e:{x:200,y:200,width:900,height:700},w:{x:300,y:200,width:700,height:700},n:{x:200,y:300,width:800,height:600},s:{x:200,y:200,width:800,height:800},nw:{x:300,y:300,width:700,height:600},ne:{x:200,y:300,width:900,height:600},sw:{x:300,y:200,width:700,height:800},se:{x:200,y:200,width:900,height:800}};
for(const edge of Object.keys(expected))test('edge '+edge+' preserves opposite sides',()=>assert.deepEqual(resizeRect(s,edge,100,100,v,min),expected[edge]));
for(const edge of ['e','w','n','s','nw','ne','sw','se'])test('edge '+edge+' hard minimum does not drift opposite edge',()=>{
 const dx=edge.includes('w')?10000:-10000,dy=edge.includes('n')?10000:-10000,r=resizeRect(s,edge,dx,dy,v,min);
 if(/[ew]/.test(edge))assert.equal(r.width,448);if(/[ns]/.test(edge))assert.equal(r.height,560);
 if(edge.includes('w'))assert.equal(r.x+r.width,1000);if(edge.includes('n'))assert.equal(r.y+r.height,900);
 if(edge.includes('e'))assert.equal(r.x,200);if(edge.includes('s'))assert.equal(r.y,200);
});
for(const edge of ['e','w'])test('expanded '+edge+' ignores vertical deltas',()=>{const start=constrainRect(s,v,min,true),a=resizeRect(start,edge,100,9999,v,min,true),b=resizeRect(start,edge,100,-9999,v,min,true);assert.deepEqual(a,b);assert.equal(a.y,8);assert.equal(a.height,1084);});
test('all edges clamp to viewport, including zoom offset, tiny viewport and keyboard',()=>{
 for(const [width,height] of [[320,568],[390,844],[844,390],[390,420],[1,1],[1600,1100]])for(const expanded of [false,true]){
  const view={left:35,top:70,width,height},b=usableViewport(view),start=constrainRect(s,view,min,expanded);
  for(const edge of ['e','w','n','s','nw','ne','sw','se'])for(const d of [-1e6,0,1e6]){
   const r=resizeRect(start,edge,d,d,view,min,expanded);assert.ok(r.width>=Math.min(448,b.width)&&r.height>=Math.min(560,b.height));assert.ok(r.x>=b.x&&r.y>=b.y);assert.ok(r.x+r.width<=b.x+b.width+.001&&r.y+r.height<=b.y+b.height+.001);
  }
 }
});
class E{listeners=new Map();dataset={};addEventListener(n,f){if(!this.listeners.has(n))this.listeners.set(n,new Set());this.listeners.get(n).add(f);}removeEventListener(n,f){this.listeners.get(n)?.delete(f);}fire(n,e={}){e.preventDefault??=()=>{};e.stopPropagation??=()=>{};for(const f of this.listeners.get(n)||[])f(e);}focus(){}setPointerCapture(id){this.pointer=id;}hasPointerCapture(id){return this.pointer===id;}releasePointerCapture(){this.pointer=null;}count(){return [...this.listeners.values()].reduce((n,s)=>n+s.size,0);}}
function fixture(expanded=false,saved={}){
 const win=new E();Object.assign(win,{innerWidth:1600,innerHeight:1100});const title=new E(),grips=['n','s','w','e','nw','ne','sw','se'].map(edge=>{const g=new E();g.dataset.pcResize=edge;return g;});
 const panel=new E();panel.style={};panel.showPopover=()=>{};panel.hidePopover=()=>{};panel.querySelector=s=>s==='[data-pc-drag-handle]'?title:null;panel.querySelectorAll=()=>grips;panel.getBoundingClientRect=()=>({left:parseFloat(panel.style.left)||0,top:parseFloat(panel.style.top)||0,width:parseFloat(panel.style.width)||744,height:parseFloat(panel.style.height)||560});
 let floor=560;const card={getBoundingClientRect:()=>{const r=panel.getBoundingClientRect();return {top:r.top+100,bottom:r.top+(typeof floor==='function'?floor(r.width):floor)-94};}},scroll={scrollTop:0,querySelector:()=>card,querySelectorAll:()=>[],getBoundingClientRect:()=>{const r=panel.getBoundingClientRect();return {top:r.top+100,height:r.height-180};}};
 panel.querySelector=s=>s==='[data-pc-drag-handle]'?title:s==='.pc-scroll'?scroll:s==='.pc-scroll .pc-card'?card:null;
 const anchor={getBoundingClientRect:()=>({left:300,top:850,width:744})},positions=structuredClone(saved),closed=[];const off=mountCoachPopover(panel,anchor,()=>closed.push(true),win,expanded,positions);return {win,title,grips,panel,positions,off,closed,setFloor(value){floor=value;off.update();}};
}
function drag(f,edge,dx,dy){const g=edge?f.grips.find(g=>g.dataset.pcResize===edge):f.title;g.fire('pointerdown',{button:0,pointerId:1,clientX:100,clientY:100});f.win.fire('pointermove',{pointerId:1,clientX:100+dx,clientY:100+dy});return g;}
test('real resize handlers remember dimensions through content updates and dispose',()=>{const f=fixture();drag(f,'se',120,150);f.win.fire('pointerup',{pointerId:1});const a=f.panel.getBoundingClientRect();assert.equal(a.width,864);assert.equal(a.height,710);f.off.update();assert.deepEqual(f.panel.getBoundingClientRect(),a);f.off();assert.equal(f.win.count()+f.panel.count()+f.title.count()+f.grips.reduce((n,g)=>n+g.count(),0),0);});
test('Escape rolls back size and pointer capture before closing',()=>{const f=fixture(),before=f.panel.getBoundingClientRect(),g=drag(f,'se',120,150);f.panel.fire('keydown',{key:'Escape'});assert.deepEqual(f.panel.getBoundingClientRect(),before);assert.equal(g.pointer,null);assert.equal(f.closed.length,0);f.panel.fire('keydown',{key:'Escape'});assert.equal(f.closed.length,1);f.off();});
test('expanded rejects top/corner grips even if stale DOM delivered them',()=>{const f=fixture(true),before=f.panel.getBoundingClientRect();drag(f,'se',120,150);assert.deepEqual(f.panel.getBoundingClientRect(),before);drag(f,'e',120,500);assert.equal(f.panel.getBoundingClientRect().width,before.width+120);assert.equal(f.panel.getBoundingClientRect().height,before.height);f.off();});
test('keyboard resize, Home reset, pointer cancellation and blur release',()=>{const f=fixture(),before=f.panel.getBoundingClientRect(),g=f.grips.find(g=>g.dataset.pcResize==='e');g.fire('keydown',{key:'ArrowRight',shiftKey:true,target:g});assert.equal(f.panel.getBoundingClientRect().width,before.width+24);g.fire('keydown',{key:'Home',target:g});assert.deepEqual(f.panel.getBoundingClientRect(),before);drag(f,'se',120,150);f.win.fire('pointercancel',{pointerId:1});assert.equal(f.panel.dataset.resizing,undefined);drag(f,'se',120,150);f.win.fire('blur');assert.equal(f.panel.dataset.resizing,undefined);f.off();});
test('viewport change ends resize and clamps the painted rectangle',()=>{const f=fixture();drag(f,'se',400,300);f.win.innerWidth=390;f.win.innerHeight=420;f.win.fire('resize');const r=f.panel.getBoundingClientRect();assert.equal(r.width,374);assert.equal(r.height,404);assert.equal(r.left,8);assert.equal(r.top,8);assert.equal(f.panel.dataset.resizing,undefined);f.off();});

test('automatic floor and viewport constraints preserve intent and restore the original rectangle',()=>{
 const saved={compact:{x:200,y:200,width:800,height:700}},f=fixture(false,saved),before=f.panel.getBoundingClientRect();
 f.setFloor(900);assert.equal(f.panel.getBoundingClientRect().height,900);assert.deepEqual(f.positions,saved);
 f.win.innerWidth=390;f.win.innerHeight=420;f.win.fire('resize');assert.equal(f.panel.getBoundingClientRect().height,404);assert.deepEqual(f.positions,saved);
 f.win.innerWidth=1600;f.win.innerHeight=1100;f.win.fire('resize');f.setFloor(560);assert.deepEqual(f.panel.getBoundingClientRect(),before);assert.deepEqual(f.positions,saved);f.off();
});
for(const keyboard of [false,true])test(`${keyboard?'keyboard':'pointer'} title movement preserves temporarily constrained dimensions`,()=>{
 const f=fixture(false,{compact:{x:200,y:200,width:800,height:700}});f.win.innerHeight=650;f.win.fire('resize');assert.equal(f.panel.getBoundingClientRect().height,634);
 if(keyboard)f.title.fire('keydown',{key:'ArrowRight',target:f.title});else{drag(f,'',40,50);f.win.fire('pointerup',{pointerId:1});}
 assert.deepEqual(f.positions.compact,{x:keyboard?208:240,y:200,width:800,height:700});
 f.win.innerHeight=1100;f.win.fire('resize');assert.equal(f.panel.getBoundingClientRect().height,700);f.off();
});
test('moving an unsized panel saves only the position axes actually moved',()=>{
 const f=fixture();drag(f,'',40,0);f.win.fire('pointerup',{pointerId:1});assert.deepEqual(f.positions.compact,{x:340});
 f.title.fire('keydown',{key:'ArrowUp',target:f.title});assert.deepEqual(f.positions.compact,{x:340,y:274});f.off.update();assert.equal(f.panel.getBoundingClientRect().height,560);f.off();
});
for(const saved of [{},{compact:{x:200,y:200,width:800,height:700}}])test(`horizontal resize does not save the wrapping floor with ${saved.compact?'existing':'default'} height`,()=>{
 const f=fixture(false,saved),before=f.panel.getBoundingClientRect();f.setFloor(width=>width<before.width?900:560);drag(f,'e',-120,0);f.win.fire('pointerup',{pointerId:1});
 assert.equal(f.panel.getBoundingClientRect().height,900);assert.deepEqual(f.positions.compact,{...saved.compact,x:before.left,width:before.width-120});
 f.setFloor(560);assert.equal(f.panel.getBoundingClientRect().height,before.height);f.off();
});
test('vertical resize does not save the temporary narrow viewport width or its clamped position',()=>{
 const f=fixture(false,{compact:{x:200,y:200,width:800,height:700}});f.win.innerWidth=650;f.win.fire('resize');assert.equal(f.panel.getBoundingClientRect().width,634);
 drag(f,'n',0,50);f.win.fire('pointerup',{pointerId:1});assert.deepEqual(f.positions.compact,{x:200,y:250,width:800,height:650});
 f.win.innerWidth=1600;f.win.fire('resize');assert.equal(f.panel.getBoundingClientRect().width,800);assert.equal(f.panel.getBoundingClientRect().left,200);f.off();
});
for(const dy of [-8,8])test(`corner vertical delta ${dy} absorbed by a new wrapping floor does not save that floor`,()=>{
 const saved={compact:{x:200,y:100,width:800,height:700}},f=fixture(false,saved);f.setFloor(width=>width<800?900:560);drag(f,'se',-120,dy);f.win.fire('pointerup',{pointerId:1});
 assert.equal(f.panel.getBoundingClientRect().height,900);assert.deepEqual(f.positions.compact,{...saved.compact,width:680});f.setFloor(560);assert.equal(f.panel.getBoundingClientRect().height,700);f.off();
});
test('corner vertical adjustment beyond a new wrapping floor still saves the effective height',()=>{
 const f=fixture(false,{compact:{x:200,y:100,width:800,height:700}});f.setFloor(width=>width<800?900:560);drag(f,'se',-120,220);f.win.fire('pointerup',{pointerId:1});
 assert.deepEqual(f.positions.compact,{x:200,y:100,width:680,height:920});f.setFloor(560);assert.equal(f.panel.getBoundingClientRect().height,920);f.off();
});
for(const edge of ['nw','ne','sw','se'])for(const axis of ['horizontal','vertical'])test(`${edge} corner saves only a changed ${axis} axis`,()=>{
 const f=fixture(),before=f.panel.getBoundingClientRect(),dx=axis==='horizontal'?(edge.includes('w')?-50:50):0,dy=axis==='vertical'?(edge.includes('n')?-50:50):0;
 drag(f,edge,dx,dy);f.win.fire('pointerup',{pointerId:1});
 assert.deepEqual(f.positions.compact,axis==='horizontal'?{x:before.left+(edge.includes('w')?-50:0),width:before.width+50}:{y:before.top+(edge.includes('n')?-50:0),height:before.height+50});f.off();
});
for(const edge of ['e','w','n','s'])test(`${edge} wrong-axis arrows preserve temporarily constrained intent`,()=>{
 const saved={compact:{x:200,y:200,width:800,height:700}},f=fixture(false,saved);f.win.innerWidth=390;f.win.innerHeight=420;f.win.fire('resize');const g=f.grips.find(g=>g.dataset.pcResize===edge);
 for(const key of /[ew]/.test(edge)?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight']){g.fire('keydown',{key,target:g});assert.deepEqual(f.positions,saved);}f.off();
});
for(const edge of ['','e','se'])test(`${edge||'title'} zero motion does not specify dimensions or position`,()=>{
 const f=fixture();f.setFloor(900);drag(f,edge,0,0);f.win.fire('pointerup',{pointerId:1});assert.deepEqual(f.positions,{});f.off();
});
for(const edge of ['e','w','n','s','nw','ne','sw','se'])test(`${edge} resize fully clamped by the viewport leaves saved dimensions intact`,()=>{
 const saved={compact:{x:200,y:200,width:800,height:700}},f=fixture(false,saved);f.win.innerWidth=390;f.win.innerHeight=420;f.win.fire('resize');
 drag(f,edge,edge.includes('w')?-50:50,edge.includes('n')?-50:50);f.win.fire('pointerup',{pointerId:1});assert.deepEqual(f.positions,saved);f.off();
});
for(const saved of [{},{compact:{height:650}},{compact:{x:200,y:200,width:800,height:700}}])test(`resize back to its start restores ${Object.keys(saved.compact||{}).length} prior fields, including unspecified ones`,()=>{
 const f=fixture(false,saved);f.setFloor(800);f.win.innerWidth=650;f.win.fire('resize');const before=f.panel.getBoundingClientRect();drag(f,'se',-50,100);assert.notDeepEqual(f.positions,saved);
 f.win.fire('pointermove',{pointerId:1,clientX:100,clientY:100});assert.deepEqual(f.positions,saved);assert.deepEqual(f.panel.getBoundingClientRect(),before);
 f.win.fire('pointerup',{pointerId:1});f.win.innerWidth=1600;f.win.fire('resize');f.setFloor(560);assert.equal(f.panel.getBoundingClientRect().height,saved.compact?.height??560);assert.equal(f.panel.getBoundingClientRect().width,saved.compact?.width??744);f.off();
});
test('a corner axis returning to start drops only that intermediate intent',()=>{
 const f=fixture(),before=f.panel.getBoundingClientRect();drag(f,'se',80,100);f.win.fire('pointermove',{pointerId:1,clientX:100,clientY:200});
 assert.deepEqual(f.positions.compact,{y:before.top,height:before.height+100});f.win.fire('pointerup',{pointerId:1});assert.equal(f.panel.getBoundingClientRect().width,before.width);f.off();
});
test('title drag back to start restores missing fields and Escape restores a partial prior intent',()=>{
 const saved={compact:{height:650}},f=fixture(false,saved),before=f.panel.getBoundingClientRect();drag(f,'',40,30);assert.notDeepEqual(f.positions,saved);
 f.win.fire('pointermove',{pointerId:1,clientX:100,clientY:100});assert.deepEqual(f.positions,saved);f.win.fire('pointerup',{pointerId:1});assert.deepEqual(f.panel.getBoundingClientRect(),before);
 drag(f,'se',80,80);f.panel.fire('keydown',{key:'Escape'});assert.deepEqual(f.positions,saved);assert.deepEqual(f.panel.getBoundingClientRect(),before);f.off();
});
test('expanded operations save horizontal intent only and keep compact state independent',()=>{
 const saved={compact:{x:200,y:200,width:800,height:700}},f=fixture(true,saved),before=f.panel.getBoundingClientRect();
 f.title.fire('keydown',{key:'ArrowDown',target:f.title});assert.deepEqual(f.positions,saved);drag(f,'',40,80);f.win.fire('pointerup',{pointerId:1});assert.deepEqual(f.positions.expanded,{x:before.left+40});
 drag(f,'e',80,80);f.win.fire('pointerup',{pointerId:1});assert.deepEqual(f.positions.expanded,{x:before.left+40,width:before.width+80});assert.deepEqual(f.positions.compact,saved.compact);
 const intent=structuredClone(f.positions),rect=f.panel.getBoundingClientRect();for(const edge of ['n','s','nw','ne','sw','se']){const g=f.grips.find(g=>g.dataset.pcResize===edge);g.fire('keydown',{key:'ArrowRight',target:g});}assert.deepEqual(f.panel.getBoundingClientRect(),rect);assert.deepEqual(f.positions,intent);
 f.win.innerHeight=650;f.win.fire('resize');assert.equal(f.panel.getBoundingClientRect().height,634);assert.deepEqual(f.positions,intent);f.off();
});
test('pointer cancellation and blur commit the existing gesture while reset clears only its mode',()=>{
 const saved={expanded:{x:100,width:900}},f=fixture(false,saved);drag(f,'e',80,0);f.win.fire('pointercancel',{pointerId:1});const first=structuredClone(f.positions.compact);assert.equal(first.width,824);
 drag(f,'e',40,0);f.win.fire('blur');assert.equal(f.positions.compact.width,864);assert.equal(f.panel.dataset.resizing,undefined);
 f.title.fire('keydown',{key:'Home',target:f.title});assert.deepEqual(f.positions,saved);f.off();
});

test('content observer recomputes one-card floor on replacement and releases observations',()=>{
 const win=new E();Object.assign(win,{innerWidth:1600,innerHeight:1100});let resizeObserver,mutationObserver;
 class R{observed=new Set();constructor(cb){this.cb=cb;resizeObserver=this;}observe(x){this.observed.add(x);}unobserve(x){this.observed.delete(x);}disconnect(){this.observed.clear();}}
 class M{constructor(cb){this.cb=cb;mutationObserver=this;}observe(){}disconnect(){this.disconnected=true;}}
 win.ResizeObserver=R;win.MutationObserver=M;const title=new E(),panel=new E();panel.style={};panel.showPopover=()=>{};panel.hidePopover=()=>{};panel.querySelectorAll=()=>[];
 const rect=()=>({left:parseFloat(panel.style.left)||0,top:parseFloat(panel.style.top)||0,width:parseFloat(panel.style.width)||744,height:parseFloat(panel.style.height)||560});panel.getBoundingClientRect=rect;
 let bottom=400;const mkCard=()=>({getBoundingClientRect:()=>({top:100,bottom:rect().top+bottom})});let card=mkCard();const scroll={scrollTop:0,querySelector:()=>card,querySelectorAll:()=>[],getBoundingClientRect:()=>({top:rect().top+100,height:rect().height-180})};
 panel.querySelector=s=>s==='[data-pc-drag-handle]'?title:s==='.pc-scroll'?scroll:s==='.pc-scroll .pc-card'?card:null;
 const off=mountCoachPopover(panel,{getBoundingClientRect:()=>({left:100,top:900,width:744})},()=>{},win,false,{});assert.equal(rect().height,560);const oldCard=card;card=mkCard();bottom=700;mutationObserver.cb();assert.equal(rect().height,794);assert.ok(!resizeObserver.observed.has(oldCard)&&resizeObserver.observed.has(card));off();assert.equal(resizeObserver.observed.size,0);assert.equal(mutationObserver.disconnected,true);
});
