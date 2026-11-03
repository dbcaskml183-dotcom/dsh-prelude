// Targeted real-browser regression for the 0.4.12 UI fixes. These functions
// receive an already-authorized CUA tab; they never create a browser, send a
// conversation task, call a model, or access private browser state.
import assert from 'node:assert/strict';

// Precondition: a completed real analysis with method cards and a visible
// current rewrite candidate. The caller owns a disposable draft and supplies
// the exact visible method title. This test intentionally invalidates that
// candidate; it does not adopt or send it.
export async function selectionRegression(tab,title){
 const cards=()=>tab.playwright.locator('.pc-card[data-method]').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-method'),reason:n.querySelector('.pc-reason')?.textContent||'',title:n.querySelector('strong')?.textContent||''})));
 const before=await cards();assert.ok(before.length>0,'requires completed analysis');
 assert.equal(await tab.playwright.getByRole('textbox',{name:'改写候选稿',exact:true}).count(),1,'requires current candidate');
 assert.equal(await tab.playwright.getByRole('button',{name:'采用到输入框',exact:true}).isEnabled(),true,'requires an adoptable candidate before changing methods');
 await tab.playwright.getByLabel('用于本次改写：'+title,{exact:true}).click();
 const state=await tab.getAXState({emit:false});
 assert.deepEqual(await cards(),before,'selecting a method must preserve analyzed cards');
 assert.equal(await tab.playwright.locator('.pc-card[data-method]').getByLabel('取消用于改写：'+title,{exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await tab.playwright.getByRole('button',{name:'分析提示词',exact:true}).isEnabled(),true,'selection must not start a new analysis');
 assert.equal(await tab.playwright.getByRole('button',{name:'正在分析…',exact:true}).count(),0);
 assert.equal(await tab.playwright.getByRole('button',{name:'采用到输入框',exact:true}).count(),0,'old candidate must not remain adoptable');
 assert.equal(await tab.playwright.getByRole('button',{name:'按当前草稿重新生成',exact:true}).isVisible(),true);
 return {cards:before,selected:title,oldCandidateDisabled:true,state};
}

// Precondition: Prelude settings visible and no concurrent editor. Restore
// the original preference even when an assertion fails; no other setting is
// touched. Host persistence is separately checked by reopening the page.
export async function settingsRegression(tab,label='补充要求'){
 const box=tab.playwright.getByLabel('默认展开：'+label,{exact:true});
 const initial=await box.evaluate(el=>el.checked);
 const saved=tab.playwright.getByText('已保存，下次打开生效；当前默认值以勾选状态为准。',{exact:true});
 const set=async value=>{
  await box.setChecked(value);
  await tab.getAXState({emit:false});
  await box.and(tab.playwright.locator(':enabled')).waitFor({state:'visible',timeoutMs:10000});
  await saved.waitFor({state:'visible',timeoutMs:10000});
  assert.equal(await box.isEnabled(),true,'save must finish');
  assert.equal(await box.evaluate(el=>el.checked),value,'native preference and checkbox must agree');
 };
 let changed;
 try{await set(!initial);changed=await tab.getAXState({emit:false});}
 finally{await set(initial);}
 return {label,initial,changed,restored:await box.evaluate(el=>el.checked),savedHintVisible:await saved.isVisible()};
}
