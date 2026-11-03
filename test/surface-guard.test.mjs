import test from 'node:test';
import assert from 'node:assert/strict';
import {observeForeignSurfaces} from '../client/popover.mjs';
function fixture(){
 const events=new Map(),micro=[],observers=[];let reads=0;
 class N{
  constructor(role='',position='static'){this.nodeType=1;this.role=role;this.position=position;this.children=[];this.attrs={};this.isConnected=true;this.parentElement=null;this.hidden=false;this.inert=false;this.style={};this.open=false;}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}
  add(n){n.parentElement=this;this.children.push(n);return n;}
  getAttribute(k){return this.attrs[k]??null;}
  matches(s){if(s===':modal,:popover-open,[data-seat-panel],[aria-modal="true"]')return this.open||this.attrs['data-seat-panel']!==undefined||this.attrs['aria-modal']==='true';return this.nativeDialog||['dialog','menu','listbox'].includes(this.role)||this.attrs.popover!==undefined||this.attrs['data-seat-panel']!==undefined;}
  querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
  getBoundingClientRect(){reads++;return {width:this.hidden?0:200,height:this.hidden?0:100};}
 }
 class MO{constructor(cb){this.cb=cb;this.targets=[];this.dead=false;observers.push(this);}observe(n,o){this.targets.push([n,o]);this.dead=false;}disconnect(){this.dead=true;this.targets=[];}}
 const body=new N(),panel=body.add(new N('dialog','fixed')),history=[];
 const doc={body,querySelectorAll:body.querySelectorAll.bind(body),addEventListener:(t,f)=>events.set(t,f),removeEventListener:(t)=>events.delete(t)};panel.ownerDocument=doc;
 const win={MutationObserver:MO,queueMicrotask:f=>micro.push(f),getComputedStyle:n=>({display:n.hidden?'none':'block',visibility:n.style.visibility||'visible',position:n.position})};
 let modal=false;const guard=observeForeignSurfaces(panel,win,(b,defer)=>history.push([b,!!defer]),{isBehindModal:()=>modal});
 const flush=()=>{while(micro.length)micro.shift()();};
 const add=(n,parent=body)=>{parent.add(n);observers[0].cb([{type:'childList',target:parent,addedNodes:[n],removedNodes:[]}]);flush();return n;};
 const attr=n=>{observers[0].cb([{type:'attributes',target:n}]);flush();};
 return{N,body,panel,history,events,guard,observers,add,attr,flush,modal:v=>{modal=v;guard.refresh();},reads:()=>reads};
}
test('own dialog, nested controls and ordinary inline listbox do not suspend',()=>{const f=fixture();assert.equal(f.guard.check(),false);f.add(new f.N('listbox'));assert.equal(f.guard.check(),false);f.add(new f.N('menu','fixed'),f.panel);assert.equal(f.guard.check(),false);f.guard.release();});
test('host modal is decisive without DOM appearance and releases independently',()=>{const f=fixture();f.modal(true);assert.equal(f.guard.check(),true);f.modal(false);assert.equal(f.guard.check(),false);});
test('floating model menu, file listbox, thinking panel and fixed dialog suspend',()=>{for(const role of ['menu','listbox','dialog','seat']){const f=fixture(),n=new f.N(role,'fixed');if(role==='seat')n.attrs['data-seat-panel']='';f.add(n);assert.equal(f.guard.check(),true,role);n.isConnected=false;f.guard.refresh();assert.equal(f.guard.check(),false,role);}});
test('floating ancestor identifies menu with static role container',()=>{const f=fixture(),outer=f.add(new f.N('','absolute'));f.add(new f.N('menu'),outer);assert.equal(f.guard.check(),true);});
test('hidden, inert, aria-hidden and hidden ancestor never block',()=>{for(const kind of ['hidden','inert','aria-hidden','ancestor']){const f=fixture(),n=new f.N('dialog','fixed');if(kind==='aria-hidden')n.attrs[kind]='true';else if(kind!=='ancestor')n[kind]=true;const parent=kind==='ancestor'?f.add(new f.N()):f.body;if(kind==='ancestor')parent.style.visibility='hidden';f.add(n,parent);assert.equal(f.guard.check(),false,kind);}});
test('multiple blockers must all disappear before resuming',()=>{const f=fixture(),a=f.add(new f.N('dialog','fixed')),b=f.add(new f.N('menu','fixed'));a.isConnected=false;f.guard.refresh();assert.equal(f.guard.check(),true);b.isConnected=false;f.guard.refresh();assert.equal(f.guard.check(),false);});
test('existing candidate visibility changes refresh without rediscovering body',()=>{const f=fixture(),n=new f.N('dialog','fixed');n.hidden=true;f.add(n);n.hidden=false;f.observers[1].cb([]);f.flush();assert.equal(f.guard.check(),true);n.style.visibility='hidden';f.observers[1].cb([]);f.flush();assert.equal(f.guard.check(),false);});
test('beforetoggle conceals synchronously while native transition finishes',()=>{const f=fixture(),n=new f.N();n.attrs.popover='auto';f.add(n);f.events.get('beforetoggle')({type:'beforetoggle',newState:'open',target:n});assert.deepEqual(f.history.at(-1),[true,true]);assert.equal(f.guard.check(),true);n.open=true;f.flush();assert.equal(f.guard.check(),true);n.open=false;f.events.get('toggle')({type:'toggle',newState:'closed',target:n});f.flush();assert.equal(f.guard.check(),false);});
test('own native toggle does not suspend or schedule more work',()=>{const f=fixture(),before=f.history.length;f.events.get('beforetoggle')({type:'beforetoggle',newState:'open',target:f.panel});f.flush();assert.equal(f.history.length,before);});
test('streaming ordinary text does not repeat candidate geometry reads',()=>{const f=fixture();f.add(new f.N('dialog','fixed'));const before=f.reads();for(let i=0;i<200;i++)f.observers[0].cb([{type:'childList',target:f.body,addedNodes:[{nodeType:3}],removedNodes:[]}]);f.flush();assert.equal(f.reads(),before);});
test('queued observer work, watched nodes and event listeners released on unmount',()=>{const f=fixture();f.add(new f.N('dialog','fixed'));f.observers[1].cb([]);const before=f.history.length;f.guard.release();f.guard.release();f.flush();assert.equal(f.history.length,before);assert.equal(f.events.size,0);assert.ok(f.observers.every(n=>n.dead));assert.equal(f.guard.check(),true);});
test('observer setup failure stays closed, rather than immediately reopening',()=>{const f=fixture();f.guard.release();f.panel.ownerDocument.querySelectorAll=()=>[];f.body.querySelectorAll=()=>{throw Error('synthetic DOM failure')};const states=[],g=observeForeignSurfaces(f.panel,{...{},MutationObserver:class{disconnect(){} observe(){}},getComputedStyle:()=>({}),queueMicrotask:()=>{}},v=>states.push(v));assert.equal(g.check(),true);assert.equal(states.at(-1),true);g.release();});

test('action-time fresh check rejects a floating menu before MutationObserver delivery',()=>{const f=fixture();f.body.add(new f.N('menu','fixed'));assert.equal(f.guard.check(true),true);});

test('native dialog without ARIA role is discovered and blocks only while modal',()=>{const f=fixture(),n=new f.N();n.nativeDialog=true;n.open=true;f.add(n);assert.equal(f.guard.check(),true);n.open=false;f.guard.refresh();assert.equal(f.guard.check(),false);});
test('removing a role stops a cached candidate from blocking forever',()=>{const f=fixture(),n=f.add(new f.N('dialog','fixed'));assert.equal(f.guard.check(),true);n.role='';f.attr(n);assert.equal(f.guard.check(),false);});


test('047 current native observers avoid full rediscovery on ordinary actions',()=>{const f=fixture();f.observers[0].takeRecords=()=>[];f.observers[1].takeRecords=()=>[];let scans=0;const scan=f.body.querySelectorAll.bind(f.body);f.body.querySelectorAll=s=>{scans++;return scan(s);};for(let i=0;i<200;i++)assert.equal(f.guard.check(true),false);assert.equal(scans,0);f.guard.release();});
test('047 an undelivered new modal still blocks the first action',()=>{const f=fixture(),queued=[];f.observers[0].takeRecords=()=>queued.splice(0);f.observers[1].takeRecords=()=>[];const modal=f.body.add(new f.N('dialog','fixed'));queued.push({type:'childList',target:f.body,addedNodes:[modal],removedNodes:[]});assert.equal(f.guard.check(true),true);modal.isConnected=false;queued.push({type:'childList',target:f.body,addedNodes:[],removedNodes:[modal]});assert.equal(f.guard.check(true),false);f.guard.release();});
test('047 queued role changes are recognized before observer callback',()=>{const f=fixture(),queued=[],n=f.body.add(new f.N());f.observers[0].takeRecords=()=>queued.splice(0);n.role='menu';n.position='fixed';queued.push({type:'attributes',target:n});assert.equal(f.guard.check(true),true);n.role='';queued.push({type:'attributes',target:n});assert.equal(f.guard.check(true),false);f.guard.release();});
test('047 a broken observer drain fails closed and release remains safe',()=>{const f=fixture();f.observers[0].takeRecords=()=>{throw Error('synthetic drain failure');};assert.equal(f.guard.check(true),true);f.guard.release();f.guard.release();});

test('049 draining a closing menu preserves the deferred resume notification',()=>{
 const f=fixture(),queued=[],menu=f.add(new f.N('menu','fixed'));
 f.observers[0].takeRecords=()=>queued.splice(0);f.observers[1].takeRecords=()=>[];
 assert.equal(f.history.at(-1)[0],true);
 menu.isConnected=false;queued.push({type:'childList',target:f.body,addedNodes:[],removedNodes:[menu]});
 assert.equal(f.guard.check(true),false);f.flush();assert.equal(f.history.at(-1)[0],false);
 f.guard.release();
});
test('049 draining visibility changes preserves resume and respects other blockers',()=>{
 const f=fixture(),queued=[],menu=f.add(new f.N('menu','fixed')),other=f.add(new f.N('dialog','fixed'));
 f.observers[0].takeRecords=()=>[];f.observers[1].takeRecords=()=>queued.splice(0);
 menu.hidden=true;queued.push({type:'attributes',target:menu});assert.equal(f.guard.check(true),true);f.flush();assert.equal(f.history.at(-1)[0],true);
 other.hidden=true;queued.push({type:'attributes',target:other});assert.equal(f.guard.check(true),false);f.flush();assert.equal(f.history.at(-1)[0],false);
 f.guard.release();
});
test('049 releasing after a fresh drain cancels its queued notification',()=>{
 const f=fixture(),queued=[];f.observers[0].takeRecords=()=>queued.splice(0);f.observers[1].takeRecords=()=>[];
 const menu=f.body.add(new f.N('menu','fixed'));queued.push({type:'childList',target:f.body,addedNodes:[menu],removedNodes:[]});
 assert.equal(f.guard.check(true),true);const count=f.history.length;f.guard.release();f.flush();assert.equal(f.history.length,count);
});
