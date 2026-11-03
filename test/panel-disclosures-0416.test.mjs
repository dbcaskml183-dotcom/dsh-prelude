import test from 'node:test';
import assert from 'node:assert/strict';
import {PANEL_SECTIONS,panelOpenPatch,hydratePanelDefaults,panelDisclosureOpen,panelDisclosureTouch,panelDisclosureChange} from '../client/presentation.mjs';
import {taskResetPatch,taskResetToken} from '../client/session-buckets.mjs';

const all=value=>Object.fromEntries(PANEL_SECTIONS.map(s=>[s.field,value]));
const state=(config={},ready=true)=>({open:true,...taskResetPatch(0),...panelOpenPatch(config,ready)});
const patch=(s,p)=>({...s,...p});
test('nine defaults preserve legacy preferences and leave five new sections closed',()=>{
 const config={defaultOpenRequirements:true,defaultOpenMaterials:false,defaultOpenBundles:true,defaultOpenModel:true};
 const s=state(config);
 assert.equal(PANEL_SECTIONS.length,9);
 assert.deepEqual(PANEL_SECTIONS.slice(0,4).map(x=>panelDisclosureOpen(s,x.id)),[true,false,true,true]);
 for(const x of PANEL_SECTIONS.slice(4))assert.equal(panelDisclosureOpen(s,x.id),false);
 assert.equal(Object.keys(config).length,4,'initialization must not migrate saved settings');
});
test('each new singleton default hydrates independently and does not reopen a touched section',()=>{
 for(const section of PANEL_SECTIONS.filter(s=>s.id!=='methodBody')){
  let s=state({},false);s=patch(s,panelDisclosureTouch(s,section.id));
  assert.equal(panelDisclosureChange(s,section.id,false),null);
  s=patch(s,hydratePanelDefaults(s,all(true),true));
  assert.equal(panelDisclosureOpen(s,section.id),false);
  for(const other of PANEL_SECTIONS.filter(s=>s.id!==section.id))assert.equal(panelDisclosureOpen(s,other.id),true);
 }
});
test('card A open-then-close before late defaults stays closed while untouched B and new C open',()=>{
 let s=state({},false);
 s=patch(s,panelDisclosureTouch(s,'methodBody','evidence'));
 // Native toggle can coalesce the open/close pair and report only final false.
 assert.equal(panelDisclosureChange(s,'methodBody',false,'evidence'),null);
 s=patch(s,hydratePanelDefaults(s,all(true),true));
 assert.equal(panelDisclosureOpen(s,'methodBody','evidence'),false);
 assert.equal(panelDisclosureOpen(s,'methodBody','acceptance'),true);
 assert.equal(panelDisclosureOpen(s,'methodBody','cohesion'),true);
 assert.equal(s.disclosureTouched.methodBody,undefined,'one card must not touch the shared default');
 assert.equal(hydratePanelDefaults(s,all(false),true),null,'a later settings save applies only after reopening');
});
test('card choices survive tab changes, result reorder and five topic resets without growing per-result keys',()=>{
 let s=state(all(true));
 s=patch(s,panelDisclosureChange(s,'methodBody',false,'evidence'));
 s=patch(s,panelDisclosureChange(s,'methodBody',false,'acceptance'));
 s=patch(s,panelDisclosureChange(s,'methodBody',true,'acceptance'));
 const keys=Object.keys(s.disclosures).sort(),token=taskResetToken(s,{edited:false},0);
 for(let n=1;n<=5;n++){
  s={...s,...taskResetPatch(n),tab:n%2?'library':'suggest'};
  for(const id of n%2?['evidence','acceptance']:['acceptance','evidence'])assert.equal(panelDisclosureOpen(s,'methodBody',id),id==='acceptance');
  assert.deepEqual(Object.keys(s.disclosures).sort(),keys);
 }
 const tokenBeforeDisplay=taskResetToken(s,{edited:false},0);
 s=patch(s,panelDisclosureChange(s,'diff',false));
 assert.equal(taskResetToken(s,{edited:false},0),tokenBeforeDisplay,'display state must not invalidate work');
 assert.notEqual(token,tokenBeforeDisplay,'only the explicit task reset changed work identity');
 const reopened={...s,...panelOpenPatch(all(false),true)};
 assert.equal(panelDisclosureOpen(reopened,'methodBody','acceptance'),false);
 assert.equal(Object.keys(reopened.disclosures).length,PANEL_SECTIONS.length);
 assert.deepEqual(reopened.disclosureTouched,{});
});
test('programmatic card toggles do not create manual overrides and closed/invalid targets are rejected',()=>{
 const s=state(all(true));
 assert.equal(panelDisclosureChange(s,'methodBody',true,'evidence'),null);
 assert.deepEqual(s.disclosureTouched,{});
 for(const [id,instance] of [['bad'],['methodBody'],['diff','evidence'],['methodBody',''],['methodBody','evidence:42'],['methodBody','a'.repeat(81)]]){
  assert.equal(panelDisclosureTouch(s,id,instance),null);
  assert.equal(panelDisclosureChange(s,id,false,instance),null);
 }
 assert.equal(panelDisclosureTouch({...s,open:false},'methodBody','evidence'),null);
 assert.equal(panelDisclosureChange({...s,open:false},'methodBody',false,'evidence'),null);
 assert.deepEqual(s.disclosureTouched,{});
});
