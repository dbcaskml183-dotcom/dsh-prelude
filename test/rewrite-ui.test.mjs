import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {readFileSync} from 'node:fs';import {sdkRequire,buildRequire} from './helpers/deps.mjs';import {panelMinimum} from '../client/panel-minimum.mjs';
const React=sdkRequire('react'),{renderToStaticMarkup}=sdkRequire('react-dom/server'),esbuild=buildRequire('esbuild');const result=await esbuild.build({entryPoints:[fileURLToPath(new URL('../src/rewrite-view.jsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',external:['react'],logLevel:'silent'}),mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(id=>id==='react'?React:sdkRequire(id),mod,mod.exports);const {RewriteView}=mod.exports;
function render(phase='preview',extra={}){const snapshot={phase,original:'原稿<script>attack()</script>',candidate:'候选<img src=x onerror=attack()>',edited:false,modelUsed:true,changes:[],uncertainties:[],message:'',acknowledged:false,...extra},controller={applyReason:()=>phase==='preview'?'':'不可用',undoReason:()=>'',missing:()=>[],getSnapshot:()=>snapshot};return renderToStaticMarkup(React.createElement(RewriteView,{controller,snapshot,current:{},onGenerate:()=>{}}));}
test('original and candidate are plain text, never model HTML',()=>{const s=render();assert.ok(s.includes('&lt;script&gt;'));assert.ok(s.includes('&lt;img'));assert.ok(!s.includes('<script>'));assert.ok(!s.includes('<img '));assert.ok(s.includes('改写原稿'));assert.ok(s.includes('改写候选稿'));});
test('preview exposes adoption, applied exposes undo and read-only wording',()=>{assert.ok(render().includes('采用到输入框'));const applied=render('applied');assert.ok(applied.includes('撤回本次替换'));assert.ok(!applied.includes('候选可手改'));assert.ok(applied.includes('当前对比只读'));assert.ok(applied.includes('readOnly')||applied.includes('readonly'));});
test('unknown context and failures do not present misleading adoption',()=>{for(const phase of ['needs_context','error','cancelled','generating'])assert.ok(!render(phase).includes('采用到输入框'));});
test('rewrite geometry cannot count later methods as required minimum content',()=>{const panel={querySelector:selector=>selector==='[data-pc-geometry-mode="rewrite"]'?{}:(()=>{throw new Error('must not inspect later methods');})()};assert.deepEqual(panelMinimum(panel),{width:448,height:560});});
test('rewrite sizing overrides the existing generic textarea rule and stacks in narrow containers',()=>{const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');assert.ok(css.includes('.pc-root textarea.pc-input.pc-rewrite-text{'));assert.ok(css.includes('@container(min-width:640px)'));assert.ok(css.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)'));});

test('cancelled or failed generation never claims a local-only free check',()=>{for(const phase of ['cancelled','error']){const html=render(phase,{modelUsed:false});assert.ok(html.includes('未采用结果'));assert.ok(!html.includes('本地检查'));}});

test('outdated source is collapsed read-only with copy and current regeneration only',()=>{
 const snapshot={phase:'preview',original:'旧原稿',candidate:'人手修改的旧候选',edited:true,modelUsed:true,changes:[],uncertainties:[],message:'旧结果',review:{state:'no_issue_found',findings:[],uncertainties:[]},priorFindings:[]};
 const controller={comparisonStatus:()=> 'outdated',applyReason:()=> 'old',undoReason:()=> 'old',reviewReason:()=> 'old',missing:()=>[],getSnapshot:()=>snapshot};
 const html=renderToStaticMarkup(React.createElement(RewriteView,{controller,snapshot,current:{},onGenerate:()=>{}}));
 assert.ok(html.includes('上次改写 · 已过期'));assert.ok(html.includes('仅针对旧原稿'));assert.ok(!html.includes('采用到输入框'));assert.ok(!html.includes('审校当前稿'));assert.ok(!html.includes('按意见修正并审校'));assert.ok(html.includes('按当前草稿重新生成'));assert.ok(html.includes('复制候选稿'));assert.ok(!html.includes('open=""'));
});

function disclosureView({phase='preview',relationship='current',notes=true,disclosure,generateReason=''}={}){
 const snapshot={phase,original:'原稿',candidate:'候选',edited:false,modelUsed:true,changes:notes?['说明结构']:[],uncertainties:[],message:'',review:{state:'not_requested',findings:[],uncertainties:[]},priorFindings:[{explanation:'旧意见'}]};
 const controller={comparisonStatus:()=>relationship,applyReason:()=>'',undoReason:()=>'',reviewReason:()=>'',missing:()=>[],getSnapshot:()=>snapshot};
 return renderToStaticMarkup(React.createElement(RewriteView,{controller,snapshot,current:{},onGenerate:()=>{},disclosure,generateReason}));
}
test('current preview, review, repair and still-matching applied result receive independent disclosure preferences',()=>{
 for(const phase of ['preview','reviewing','repairing','applied']){
  const called=[];
  const html=disclosureView({phase,relationship:phase==='applied'?'applied':'current',disclosure:id=>{called.push(id);return {open:id==='editNotes','data-test-section':id};}});
  assert.deepEqual(called,['diff','editNotes']);
  assert.match(html,/<details[^>]*data-test-section="diff"[^>]*class="pc-rewrite-diff"/u);
  assert.ok(!/<details[^>]*open=""[^>]*data-test-section="diff"/u.test(html));
  assert.match(html,/<details open="" data-test-section="editNotes">/u);
  assert.ok(!html.includes('<details open=""><summary>旧稿的问题'),'old findings do not inherit current preferences');
 }
});
test('old and reverted comparisons never obtain current defaults or callbacks even when every preference is open',()=>{
 for(const relationship of ['outdated','archived']){
  let calls=0;
  const html=disclosureView({phase:relationship==='archived'?'reverted':'preview',relationship,disclosure:()=>{calls++;return {open:true};}});
  assert.equal(calls,0);
  assert.ok(!html.includes('open=""'));
  assert.ok(!html.includes('采用到输入框'));
  assert.ok(!html.includes('撤回本次替换'));
 }
});
test('missing edit explanations do not produce an empty disclosure',()=>{
 const called=[];const html=disclosureView({notes:false,disclosure:id=>{called.push(id);return {open:true};}});
 assert.deepEqual(called,['diff']);
 assert.ok(!html.includes('编辑说明与待确认项'));
});
test('all retry entries expose and obey the shared generation restriction',()=>{
 const reason='当前为选段分析，整稿改写不可用。';
 for(const phase of ['error','cancelled','needs_context']){
  const html=disclosureView({phase,generateReason:reason});
  assert.match(html,/<button[^>]*disabled=""[^>]*>重新检查并生成<\/button>/u);
  assert.ok(html.includes(reason));
 }
 for(const relationship of ['outdated','archived']){
  const html=disclosureView({relationship,generateReason:reason});
  assert.match(html,/<button[^>]*disabled=""[^>]*>按当前草稿重新生成<\/button>/u);
  assert.ok(html.includes(reason));
 }
 const html=disclosureView({phase:'error'});
 assert.match(html,/<button type="button" class="pc-button">重新检查并生成<\/button>/u);
});
