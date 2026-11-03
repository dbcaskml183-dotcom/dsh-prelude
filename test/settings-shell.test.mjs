import test from 'node:test';import assert from 'node:assert/strict';
import {adaptSettingsShell,SETTINGS_SHELL_CSS} from '../client/settings-shell.mjs';
import {BRAND} from '../shared/brand.mjs';
function fixture(mobile=true){
 const element=(tag,children=[])=>({tagName:tag,children,classes:new Set(['host-original']),classList:{contains(c){return this.owner.classes.has(c)},add(c){this.owner.classes.add(c)},remove(c){this.owner.classes.delete(c)}},contains(target){return this===target||this.children.some(x=>x.contains(target))},querySelector(selector){if(selector==='h2')return this.heading;if(selector==='button')return this.children.find(x=>x.tagName==='BUTTON')||null;return null}});
 const root=element('SECTION');root.isConnected=true;root.heading={textContent:BRAND.title};
 const active=element('BUTTON');active.textContent=BRAND.title;let scrolls=0;active.scrollIntoView=()=>scrolls++;
 const list=element('DIV',[active]),nav=element('NAV',[element('DIV'),list]),options=element('DIV',[root]),header=element('DIV',[element('BUTTON')]),content=element('DIV',[header,options]),dialog=element('DIV',[nav,content]);root.closest=()=>dialog;
 const nodes=[dialog,nav,list,content,header,options,root,active];for(const n of nodes)n.classList.owner=n;
 const handlers=new Set();const media={matches:mobile,addEventListener:(ev,cb)=>handlers.add(cb),removeEventListener:(ev,cb)=>handlers.delete(cb)};
 const win={matchMedia:()=>media,requestAnimationFrame:fn=>(fn(),1),cancelAnimationFrame:()=>{}};
 return {root,dialog,nodes,win,media,handlers,scrolls:()=>scrolls};
}
test('unknown settings shells are left untouched',()=>{
 let changed=false;const stop=adaptSettingsShell({closest:()=>null},{matchMedia:()=>{changed=true}});assert.equal(typeof stop,'function');stop();assert.equal(changed,false);
});
test('mobile adapter marks only its own shell and aligns the selected page',()=>{
 const f=fixture();const off=adaptSettingsShell(f.root,f.win);assert.ok(f.dialog.classes.has('prelude-settings-shell'));assert.equal(f.scrolls(),1);assert.equal(f.handlers.size,1);off();assert.equal(f.handlers.size,0);assert.ok(f.nodes.every(x=>x.classes.size===1&&x.classes.has('host-original')));
});
test('desktop never scrolls settings navigation to fit a mobile layout',()=>{
 const f=fixture(false),off=adaptSettingsShell(f.root,f.win);assert.equal(f.scrolls(),0);f.media.matches=true;for(const cb of f.handlers)cb();assert.equal(f.scrolls(),1);off();
});
test('cleanup does not remove classes that predated this adapter',()=>{
 const f=fixture();f.dialog.classes.add('prelude-settings-shell');const off=adaptSettingsShell(f.root,f.win);off();assert.ok(f.dialog.classes.has('prelude-settings-shell'));assert.ok(f.dialog.classes.has('host-original'));
});
test('mobile shell rules use no generated host class names or global body overrides',()=>{
 assert.ok(SETTINGS_SHELL_CSS.includes('@media(max-width:640px)'));assert.ok(SETTINGS_SHELL_CSS.includes('overflow-x:auto'));
 assert.ok(!/VOzbGW|body|!important|display:none/.test(SETTINGS_SHELL_CSS));
});
