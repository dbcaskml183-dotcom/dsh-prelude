import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {sdkRequire,buildRequire} from './helpers/deps.mjs';

const React=sdkRequire('react'),esbuild=buildRequire('esbuild');
const src=fileURLToPath(new URL('../src/',import.meta.url));
const savedText='已保存，下次打开生效；当前默认值以勾选状态为准。';
const nodes=n=>!n||typeof n!=='object'?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)];

// Small event/effect harness, following ui-markup.test.mjs. It evaluates the
// actual JSX handlers, effect dependency changes, native adapter and rewrite
// controller. It is not a DOM renderer or a replacement for Chrome E2E.
function hooks(){
 const cells=[];let cursor=0,dirty=false,effects=[];
 const cell=make=>{const i=cursor++;return cells[i]??(cells[i]=make());};
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={...React,
  useRef:value=>cell(()=>({current:value})),
  useState:initial=>{const c=cell(()=>({value:typeof initial==='function'?initial():initial}));return[c.value,v=>{const next=typeof v==='function'?v(c.value):v;if(!Object.is(next,c.value)){c.value=next;dirty=true;}}];},
  useMemo:(fn,deps)=>{const c=cell(()=>({}));if(!same(c.deps,deps)){c.value=fn();c.deps=deps;}return c.value;},
  useEffect:(fn,deps)=>{const c=cell(()=>({}));if(!same(c.deps,deps)){c.deps=deps;effects.push(()=>{c.clean?.();c.clean=fn();});}},
  useSyncExternalStore:(sub,get)=>{const c=cell(()=>({}));if(c.sub!==sub){c.clean?.();c.sub=sub;c.clean=sub(()=>{dirty=true;});}return get();}
 };
 return {react,render:fn=>{let tree;for(let n=0;n<30;n++){dirty=false;cursor=0;effects=[];tree=fn();for(const effect of effects)effect();if(!dirty)return tree;}throw Error('event harness did not settle');},close:()=>{for(const c of cells)c.clean?.();}};
}

async function fixture(kind='normal'){
 let code=readFileSync(src+'client.jsx','utf8');
 if(kind==='clear-analysis'){
  const original='},[analysisFingerprint]);';assert.ok(code.includes(original));
  code=code.replace(original,'},[fingerprint]);'); // Reintroduce the old dependency bug only in memory.
 }
 if(kind==='navigation-scroll-conflict'){
  const anchor=' const localDecision=preflightDecision(request,methods);';assert.ok(code.includes(anchor));
  code=code.replace(anchor," useEffect(()=>{scrollRef.current?.scrollTo?.({top:0});},[ui.tab]);\n"+anchor);
 }
 const built=await esbuild.build({stdin:{contents:code+'\nexport {Entry,Panel,bind,connectNative,nativeStore}; export {PanelDefaults} from "./settings.jsx";',resolveDir:src,loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',loader:{'.css':'text'},external:['react','@deepseek-ai/dsh-client-ui-primitives'],logLevel:'silent',plugins:kind==='lose-saved-hint'?[{name:'test-only-regression',setup(build){build.onLoad({filter:/settings\.jsx$/u},args=>({contents:readFileSync(args.path,'utf8').replace("setStatus('"+savedText+"')","setStatus('')"),loader:'jsx'}));}}]:[]});
 const h=hooks(),mod={exports:{}},requests=[],clean=[],listeners=new Set();
 const config={routeMode:'fixed',provider:'fixture',model:'synthetic',autoReview:false,targetMode:'generic',defaultOpenRequirements:false};
 let snapshot={status:'ready',writable:true,revision:1,value:config},releaseSave;
 const form={getSnapshot:()=>snapshot,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),mutate:async ops=>{await new Promise(resolve=>{releaseSave=resolve;});snapshot={...snapshot,revision:snapshot.revision+1,value:{...snapshot.value,...Object.fromEntries(ops.map(x=>[x.path[0],x.value]))}};for(const fn of listeners)fn();return true;}};
 const fetch=async url=>{requests.push(url);return new Response(JSON.stringify({ok:false,error:'synthetic offline fixture'}));};
 new Function('require','module','exports','window','fetch',built.outputFiles[0].text)(id=>id==='react'?h.react:id==='@deepseek-ai/dsh-client-ui-primitives'?{isBehindModal:()=>false}:sdkRequire(id),mod,mod.exports,{addEventListener(){},removeEventListener(){}},fetch);
 const api=mod.exports;
 api.connectNative({inject:([name],run)=>{if(name==='configForms')run({get:()=>({get:()=>form}),effect:fn=>clean.push(fn())});},effect:fn=>clean.push(fn())});
 return {api,h,requests,releaseSave:()=>{assert.ok(releaseSave);releaseSave();},native:()=>snapshot,close(){h.close();for(const fn of clean.reverse())fn?.();}};
}

async function selectionAssertions(kind='normal'){
 const f=await fixture(kind);const input={draft:'请检查示例代码。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]};let writes=0;
 const actions={captureInsertion:()=>({start:0,end:0,draftRev:1}),insertText(){writes++;return true;}};
 const props={sessionId:'synthetic-selection',inputActions:actions,useInput:select=>select(input)};
 const b=f.api.bind(props.inputActions,props.sessionId); // bind takes actions, sessionId.
 const render=()=>f.h.render(()=>f.api.Panel(props));
 try{
  render();b.set({open:true});render();await Promise.resolve();await Promise.resolve();render();
  const decision={kind:'suggestions',note:'synthetic completed analysis',suggestions:[{methodId:'evidence',reason:'synthetic evidence gap'}]};
  b.set({decision,decisionSource:'model'});let tree=render();
  const card=nodes(tree).find(n=>n.type?.name==='MethodCard');assert.ok(card,'completed analysis has a rendered card');
  let view=nodes(tree).find(n=>n.type?.name==='RewriteView');assert.ok(view);
  b.rewrite.fetcher=async(_url,options)=>{const request=JSON.parse(options.body);return new Response(JSON.stringify({ok:true,protocolVersion:8,requestId:request.requestId,rulesHash:request.expectedRulesHash,reviewMode:'manual',modelUsed:true,review:{state:'not_requested',findings:[],uncertainties:[]},rewrite:{kind:'rewrite',text:input.draft+'请说明关键结论依据。',changes:[],uncertainties:[]}}));};
  await b.rewrite.start({...card.props.request,protocolVersion:8,requestId:'synthetic-'+crypto.randomUUID(),reviewMode:'manual',route:{provider:'fixture',model:'synthetic'}},view.props.current);
  tree=render();view=nodes(tree).find(n=>n.type?.name==='RewriteView');assert.equal(b.rewrite.applyReason(view.props.current),'');
  const calls=f.requests.length;
  card.props.onChooseMethod(card.props.m,'standard');tree=render();
  assert.equal(b.get().methodChoices.length,1,'actual JSX selection callback ran');
  assert.equal(b.get().decision,decision,'completed analysis must survive method choice');
  assert.equal(nodes(tree).filter(n=>n.type?.name==='MethodCard').length,1,'analyzed card remains rendered');
  assert.equal(f.requests.length,calls,'selection must not send another analysis request');
  view=nodes(tree).find(n=>n.type?.name==='RewriteView');assert.equal(b.rewrite.comparisonStatus(view.props.current),'outdated');
  assert.notEqual(b.rewrite.applyReason(view.props.current),'');assert.equal(b.rewrite.apply(view.props.current),false);assert.equal(writes,0);
 }finally{f.close();b.dispose();}
}

async function settingsAssertions(kind='normal'){
 const f=await fixture(kind),render=()=>f.h.render(()=>f.api.PanelDefaults({id:'synthetic-defaults'}));
 try{
  const box=()=>nodes(render()).find(n=>n.props?.['aria-label']==='默认展开：补充要求');
  assert.equal(box().props.checked,false);
  const save=box().props.onChange({target:{checked:true}});
  assert.equal(box().props.disabled,true,'pending write disables concurrent edits');
  assert.equal(nodes(render()).find(n=>n.props?.role==='status').props.children,'正在保存…');
  f.releaseSave();await save;
  assert.equal(f.native().value.defaultOpenRequirements,true);assert.equal(box().props.checked,true);assert.equal(box().props.disabled,false);
  assert.equal(nodes(render()).find(n=>n.props?.role==='status')?.props.children,savedText,'resolved save must retain its visible success hint');
 }finally{f.close();}
}

test('0412 actual JSX selection preserves analysis and invalidates an adoptable candidate',()=>selectionAssertions());
test('0412 actual JSX save completion retains success hint and native checkbox value',()=>settingsAssertions());
test('negative control detects the previous selection dependency bug',()=>assert.rejects(selectionAssertions('clear-analysis'),/completed analysis must survive/));
test('negative control detects a lost saved hint',()=>assert.rejects(settingsAssertions('lose-saved-hint'),/resolved save must retain/));

test('0417 Prelude entry keeps its accessible name and opens without editing or submitting the draft',async()=>{
 const f=await fixture(),input={draft:'请检查合成示例。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]};
 let captured=0,prevented=0;
 const actions={captureInsertion:()=>{captured++;return {start:0,end:0,draftRev:1};},insertText(){throw Error('opening must not edit');},submit(){throw Error('opening must not submit');}};
 const props={sessionId:'synthetic-0417-entry',inputActions:actions,useInput:select=>select(input)},b=f.api.bind(actions,props.sessionId);
 try{
  const tree=f.h.render(()=>f.api.Entry(props));assert.equal(tree.type,'button');assert.equal(tree.props['aria-label'],'Prelude');assert.equal(tree.props.title,'Prelude');
  assert.equal(nodes(tree).find(n=>n.type==='span')?.props.children,'Prelude');
  tree.props.onMouseDown({preventDefault:()=>{prevented++;}});tree.props.onClick();
  assert.equal(captured,1);assert.equal(prevented,1);assert.equal(b.get().open,true);assert.equal(input.draft,'请检查合成示例。');assert.equal(f.requests.length,0);
 }finally{f.close();b.dispose();}
});

test('0417 removing the panel slogan preserves named keyboard handles, resize edges and close action',async()=>{
 const f=await fixture(),input={draft:'请检查合成示例。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]};
 const actions={captureInsertion:()=>({start:0,end:0,draftRev:1}),insertText(){throw Error('chrome controls must not edit');}};
 const props={sessionId:'synthetic-0417-panel-chrome',inputActions:actions,useInput:select=>select(input)},b=f.api.bind(actions,props.sessionId),render=()=>f.h.render(()=>f.api.Panel(props));
 try{
  render();
  for(const expanded of [false,true]){
   b.set({open:true,surfaceVisible:true,expanded});const tree=render(),all=nodes(tree);
   const drag=all.find(n=>n.props?.['data-pc-drag-handle']==='true');assert.ok(drag);assert.equal(drag.props.role,'button');assert.equal(drag.props.tabIndex,0);
   assert.ok(drag.props['aria-label'].includes('Prelude'));assert.ok(drag.props['aria-label'].includes('方向键'));assert.ok(drag.props['aria-label'].includes('回车复位'));
   assert.ok(nodes(drag).some(n=>n.type==='strong'&&n.props.children==='Prelude'));assert.ok(!nodes(drag).some(n=>n.type==='p'),'removed slogan does not leave an empty paragraph');
   const grips=all.filter(n=>n.props?.['data-pc-resize']);assert.deepEqual(grips.map(n=>n.props['data-pc-resize']),expanded?['w','e']:['n','s','w','e','nw','ne','sw','se']);
   for(const grip of grips){assert.equal(grip.props.role,'button');assert.equal(grip.props.tabIndex,0);assert.ok(grip.props['aria-label'].startsWith('调整Prelude大小：'));}
   const close=all.find(n=>n.type==='button'&&n.props['aria-label']==='关闭Prelude');assert.ok(close);close.props.onClick();assert.equal(b.get().open,false);
  }
  assert.equal(input.draft,'请检查合成示例。');
 }finally{f.close();b.dispose();}
});

async function navigationAssertions(kind='normal'){
 const f=await fixture(kind),input={draft:'请检查示例代码并说明结论。',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]};let writes=0;
 const actions={captureInsertion:()=>({start:0,end:0,draftRev:1}),insertText(){writes++;return true;}};
 const props={sessionId:'synthetic-navigation',inputActions:actions,useInput:select=>select(input)},b=f.api.bind(actions,props.sessionId),events=[];
 const viewport={scrollTop:0,scrollTo({top}){this.scrollTop=top;events.push('top');}};
 const selected={scrollIntoView(options){assert.deepEqual(options,{block:'nearest'});viewport.scrollTop=1200;events.push('selected');},focus(options){assert.deepEqual(options,{preventScroll:true});events.push('focus');}};
 const render=()=>f.h.render(()=>{
  const tree=f.api.Panel(props);
  // Assign only the real view refs relevant to navigation before its effects.
  // The mount/popover ref stays absent: this is not a fabricated browser E2E.
  for(const n of nodes(tree)){
   if(n.props?.className==='pc-scroll'&&n.ref)n.ref.current=viewport;
   if(n.props?.className==='pc-method-selection'&&n.ref)n.ref.current=selected;
  }
  return tree;
 });
 const findButton=(tree,prefix)=>nodes(tree).find(n=>n.type==='button'&&React.Children.toArray(n.props.children).join('').startsWith(prefix));
 try{
  render();b.set({open:true,surfaceVisible:true,tab:'library'});let tree=render();await Promise.resolve();await Promise.resolve();tree=render();
  const list=nodes(tree).find(n=>n.type?.name==='VisibleMethodList');assert.ok(list);
  const method=list.props.items.find(m=>m.id==='evidence');assert.ok(method);
  // Exercise the real parent callback passed into the windowed list. Row mounting is tested separately.
  list.props.cardProps.onChooseMethod(method,'standard');tree=render();assert.equal(b.get().methodChoices.length,1);
  const original=input.draft,calls=f.requests.length,nav=findButton(tree,'查看已选方法');assert.ok(nav);
  events.length=0;nav.props.onClick();tree=render();
  assert.equal(viewport.scrollTop,1200,'navigation must land on the selected region, not be reset to the top');
  assert.deepEqual(events,['selected','focus']);
  assert.equal(b.get().tab,'suggest');assert.equal(input.draft,original);assert.equal(writes,0);assert.equal(f.requests.length,calls);
  events.length=0;findButton(tree,'方法库 · ').props.onClick();tree=render();
  assert.deepEqual(events,['top'],'ordinary tab navigation still resets its scroll');assert.equal(viewport.scrollTop,0);
  b.set({surfaceVisible:false});tree=render();events.length=0;findButton(tree,'查看已选方法').props.onClick();render();
  assert.deepEqual(events,[],'navigation must not steal focus while the panel yields to another surface');
 }finally{f.close();b.dispose();}
}

test('0416 actual JSX selected-method navigation retains target scroll and respects hidden surfaces',()=>navigationAssertions());
test('negative control catches a second tab effect undoing selected-method navigation',()=>assert.rejects(navigationAssertions('navigation-scroll-conflict'),/navigation must land on the selected region/));

test('0416 actual Panel wiring blocks every generation callback for valid selection and keeps the full-draft limit after cancellation',async()=>{
 const f=await fixture(),input={draft:'文'.repeat(4500),draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]};let starts=0,request;
 const actions={captureInsertion:()=>({start:0,end:100,draftRev:input.draftRev}),insertText(){throw Error('this test must not write the draft');}};
 const props={sessionId:'synthetic-selection-generation',inputActions:actions,useInput:select=>select(input)},b=f.api.bind(actions,props.sessionId),render=()=>f.h.render(()=>f.api.Panel(props));
 const button=(tree,text)=>nodes(tree).find(n=>n.type==='button'&&n.props.children===text);
 const view=tree=>nodes(tree).find(n=>n.type?.name==='RewriteView');
 try{
  render();b.set({open:true});render();await Promise.resolve();await Promise.resolve();render();
  b.set({analysisAvailable:true,rewriteAvailable:true});let tree=render();
  b.rewrite.start=async body=>{starts++;request=body;return {};};
  button(tree,'使用输入框选中段').props.onClick();tree=render();
  assert.equal(b.get().selection.text.length,100);
  assert.equal(button(tree,'改写整稿').props.disabled,true);
  assert.match(view(tree).props.generateReason,/当前为选段分析/u);
  const calls=f.requests.length;
  await button(tree,'改写整稿').props.onClick();
  for(const phase of ['error','cancelled','needs_context']){
   b.rewrite.publish({phase});tree=render();assert.match(view(tree).props.generateReason,/当前为选段分析/u);
   await view(tree).props.onGenerate();
  }
  assert.equal(starts,0,'UI and retry callbacks must not start a generation for an excerpt');assert.equal(f.requests.length,calls);
  tree=render();button(tree,'取消选段').props.onClick();tree=render();
  assert.equal(button(tree,'改写整稿').props.disabled,true);assert.match(view(tree).props.generateReason,/完整草稿超过4000/u);
  await view(tree).props.onGenerate();assert.equal(starts,0);
  input.draft='请检查示例代码。';input.draftRev=2;tree=render();
  b.set({selection:{text:'旧选段',rev:1}});tree=render();
  assert.equal(view(tree).props.generateReason,'','a stale selection must not block the current full draft');
  assert.equal(button(tree,'改写整稿').props.disabled,false);
  await button(tree,'改写整稿').props.onClick();assert.equal(starts,1);assert.equal(request.analysisScope,'draft');assert.equal(request.draft,input.draft);
 }finally{f.close();b.dispose();}
});
