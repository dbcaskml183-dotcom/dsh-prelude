import test from 'node:test';
import assert from 'node:assert/strict';
import {PANEL_SECTIONS,panelOpenPatch,hydratePanelDefaults,panelDisclosureTouch,panelDisclosureChange,panelDisclosureOpen} from '../client/presentation.mjs';
import {taskResetPatch,taskResetToken} from '../client/session-buckets.mjs';
import {connectNative,nativeStore,savePanelDefault,saveRoute} from '../client/native-adapter.mjs';
import {Config} from '../src/host.mjs';

const configs=Array.from({length:16},(_,mask)=>Object.fromEntries(PANEL_SECTIONS.map((s,i)=>[s.field,!!(mask&(1<<i))])));
const state=(config,ready=true)=>({open:true,...taskResetPatch(0),...panelOpenPatch(config,ready)});
for(const [i,config] of configs.entries()){
 test('all four defaults independently applied, combination '+i,()=>{
  const s=state(config);for(const section of PANEL_SECTIONS)assert.equal(s.disclosures[section.id],config[section.field]);
  assert.equal(s.disclosureDefaultsPending,false);assert.equal(hydratePanelDefaults(s,configs[15],true),null);
 });
 test('reopen resets only display values, combination '+i,()=>{
  const s=state(config),original={context:'只调查',evidence:[{id:'synthetic'}],methodChoices:[{id:'evidence'}]};
  Object.assign(s,original,panelDisclosureChange(s,'materials',!s.disclosures.materials));
  const reopened={...s,...panelOpenPatch(config,true)};
  for(const section of PANEL_SECTIONS)assert.equal(reopened.disclosures[section.id],config[section.field]);
  for(const k of Object.keys(original))assert.equal(reopened[k],original[k]);
 });
}
test('legacy/missing/false-like values remain collapsed without migration writes',()=>{
 for(const config of [{},{defaultOpenMaterials:'false'},{defaultOpenMaterials:'true'},{defaultOpenMaterials:1},{defaultOpenMaterials:null}])assert.deepEqual(Object.values(panelOpenPatch(config,true).disclosures),PANEL_SECTIONS.map(()=>false));
 const parsed=Config({});for(const s of PANEL_SECTIONS){const v=parsed[s.field];assert.equal(v?.get?.()??v,false);assert.equal(Config.dict[s.field].meta.volatile,true);}
 const nil=Config({defaultOpenMaterials:null}).defaultOpenMaterials;assert.equal(nil?.get?.()??nil,false);
 for(const value of ['false','true',1])assert.throws(()=>Config({defaultOpenMaterials:value}));
});
test('slow configuration respects manual open-then-close even when native toggle coalesces',()=>{
 let s=state({},false);s={...s,...panelDisclosureTouch(s,'materials')};
 assert.equal(panelDisclosureChange(s,'materials',false),null);
 s={...s,...hydratePanelDefaults(s,configs[15],true)};
 assert.equal(s.disclosures.materials,false);for(const k of ['requirements','bundles','model'])assert.equal(s.disclosures[k],true);
 assert.equal(hydratePanelDefaults(s,configs[0],true),null);
});
test('slow configuration honors every touched region independently',()=>{
 for(const section of PANEL_SECTIONS){const instance=section.id==='methodBody'?'evidence':undefined;let s=state({},false);s={...s,...panelDisclosureChange(s,section.id,true,instance)};s={...s,...hydratePanelDefaults(s,configs[0],true)};assert.equal(panelDisclosureOpen(s,section.id,instance),true);assert.equal(Object.values(s.disclosures).filter(Boolean).length,1);}
});
test('pending/error/closed states do not hydrate or change task data',()=>{
 const s=state({},false);assert.equal(hydratePanelDefaults(s,configs[15],false),null);assert.equal(hydratePanelDefaults({...s,open:false},configs[15],true),null);
 for(const fn of [panelDisclosureTouch,(s,k)=>panelDisclosureChange(s,k,true)]){assert.equal(fn({...s,open:false},'materials'),null);assert.equal(fn(s,'bad-section'),null);}
 assert.equal(panelDisclosureChange(s,'materials','false'),null);
});
test('programmatic open notification does not mark manual choice',()=>{
 const s=state(Object.fromEntries(PANEL_SECTIONS.map(x=>[x.field,true])));for(const section of PANEL_SECTIONS)assert.equal(panelDisclosureChange(s,section.id,true,section.id==='methodBody'?'evidence':undefined),null);
 assert.deepEqual(s.disclosureTouched,{});assert.ok(Object.isFrozen(PANEL_SECTIONS));assert.ok(PANEL_SECTIONS.every(Object.isFrozen));
});
test('six topic changes and fifty task restarts preserve current disclosure state',()=>{
 let s=state(configs[15]);s={...s,...panelDisclosureChange(s,'materials',false)};const values=s.disclosures,touched=s.disclosureTouched;
 for(let n=1;n<=50;n++){s={...s,...taskResetPatch(n)};assert.equal(s.disclosures,values);assert.equal(s.disclosureTouched,touched);}
 const t=taskResetToken(s,{edited:false},0,null);s={...s,...panelDisclosureChange(s,'model',false)};assert.equal(taskResetToken(s,{edited:false},0,null),t);
});
test('one thousand legacy toggles retain bounded flags and never mutate defaults',()=>{
 const config=structuredClone(configs[5]),before=JSON.stringify(config);let s=state(config);
 for(let n=0;n<1000;n++){const id=PANEL_SECTIONS[n%4].id;s={...s,...panelDisclosureChange(s,id,!s.disclosures[id])};}
 assert.equal(Object.keys(s.disclosures).length,PANEL_SECTIONS.length);assert.equal(Object.keys(s.disclosureTouched).length,4);assert.equal(JSON.stringify(config),before);
});
function formHarness(){
 const original={routeMode:'fixed',provider:'keep-provider',model:'keep-model',autoReview:true,targetMode:'session',...configs[0]},calls=[],listeners=new Set(),clean=[];
 let snapshot={status:'ready',value:original,writable:true,revision:7},behavior='ok';
 const form={getSnapshot:()=>snapshot,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),mutate:async(ops,revision)=>{calls.push({ops,revision});if(behavior==='network')throw new Error('synthetic lost response');if(behavior==='conflict')return false;snapshot={...snapshot,value:{...snapshot.value,...Object.fromEntries(ops.map(x=>[x.path[0],x.value]))},revision:snapshot.revision+1};for(const f of listeners)f();return true;}};
 connectNative({inject:([name],run)=>{if(name==='configForms')run({get:()=>({get:()=>form}),effect:fn=>clean.push(fn())});},effect:fn=>clean.push(fn())});
 return {calls,get:()=>snapshot,set:(next)=>{snapshot={...snapshot,...next};for(const f of listeners)f();},behavior:x=>behavior=x,close:()=>clean.reverse().forEach(fn=>fn())};
}
test('new preference save writes one field by revision, retaining all model fields and generation',async()=>{
 const h=formHarness();try{const gen=nativeStore.getSnapshot().generation,old={...h.get().value};await savePanelDefault('defaultOpenMaterials',true);assert.deepEqual(h.calls,[{ops:[{op:'set',path:['defaultOpenMaterials'],value:true}],revision:7}]);assert.deepEqual(h.get().value,{...old,defaultOpenMaterials:true});assert.equal(nativeStore.getSnapshot().generation,gen);}finally{h.close();}
});
test('existing route write retains its prior allow-list, cannot write display fields',async()=>{
 const h=formHarness();try{await saveRoute({model:'new-model',autoReview:false,defaultOpenMaterials:true,unknown:'no'});assert.deepEqual(h.calls[0].ops,[{op:'set',path:['model'],value:'new-model'},{op:'set',path:['autoReview'],value:false}]);assert.equal(h.get().value.defaultOpenMaterials,false);}finally{h.close();}
});
test('invalid new field and non-boolean values are rejected before transport',async()=>{
 const h=formHarness();try{for(const [field,value] of [['model',true],['defaultOpenMaterials','false'],['defaultOpenMaterials',null]])await assert.rejects(savePanelDefault(field,value),/无效/);assert.equal(h.calls.length,0);}finally{h.close();}
});
test('CAS conflict, read-only and lost response never auto-retry or whole-config overwrite',async()=>{
 const h=formHarness();try{h.behavior('conflict');await assert.rejects(savePanelDefault('defaultOpenBundles',true),/冲突/);assert.equal(h.calls.length,1);h.behavior('network');await assert.rejects(savePanelDefault('defaultOpenBundles',true),/lost response/);assert.equal(h.calls.length,2);h.set({writable:false});await assert.rejects(savePanelDefault('defaultOpenBundles',true),/不可写/);assert.equal(h.calls.length,2);assert.equal(h.get().value.defaultOpenBundles,false);}finally{h.close();}
});

test('five added preferences save only their own field and retain routing and generation',async()=>{
 for(const section of PANEL_SECTIONS.slice(4)){
  const h=formHarness();try{
   const gen=nativeStore.getSnapshot().generation,before={...h.get().value};
   await savePanelDefault(section.field,true);
   assert.deepEqual(h.calls,[{ops:[{op:'set',path:[section.field],value:true}],revision:7}]);
   assert.deepEqual(h.get().value,{...before,[section.field]:true});
   assert.equal(nativeStore.getSnapshot().generation,gen);
   for(const value of ['false','true',1])assert.throws(()=>Config({[section.field]:value}));
  }finally{h.close();}
 }
});
