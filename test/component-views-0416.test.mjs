import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sdkRequire,buildRequire} from './helpers/deps.mjs';

// Real component callbacks with page-local hooks; this is not browser E2E.
const React=sdkRequire('react'),{renderToStaticMarkup}=sdkRequire('react-dom/server');
const built=await buildRequire('esbuild').build({stdin:{contents:'export {PersonalLibrary,MethodCard,MaterialControls} from "./src/components.jsx"; export {personalEditorFor} from "./client/personal-editor.mjs";',resolveDir:fileURLToPath(new URL('..',import.meta.url)),loader:'js'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],logLevel:'silent'});
const load=react=>{const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(id=>id==='react'?react:sdkRequire(id),mod,mod.exports);return mod.exports;};
const staticComponents=load({...React,useSyncExternalStore:(sub,get,server)=>React.useSyncExternalStore(sub,get,server||get)});
const item=(id,label,deletedAt=null)=>({id,label,snippet:'合成补句：'+label,createdAt:'2026-11-02T00:00:00Z',updatedAt:'2026-11-02T00:00:00Z',deletedAt:deletedAt?'2026-11-02T00:00:00Z':null});
function owner(extra={}){
 let snapshot={state:'ready',writable:true,message:'',backups:[],value:{schemaVersion:2,revision:1,favorites:[],items:[item('custom-live','正常补句'),item('custom-trash','已回收补句',1)]},...extra};
 const writes=[];let disposed=0;
 const library={getSnapshot:()=>snapshot,subscribe:()=>()=>{},load:()=>{},dispose:()=>{disposed++;},mutate:async(...args)=>{writes.push(args);return {value:snapshot.value};},recover:async(...args)=>{writes.push(['recover',...args]);}};
 return {library,writes,set:value=>{snapshot=value;},snapshot:()=>snapshot,disposed:()=>disposed};
}
const renderLibrary=(h,view)=>renderToStaticMarkup(React.createElement(staticComponents.PersonalLibrary,{library:h.library,methods:[],message:()=>{},...(view?{view}:{})}));

test('0416 daily library retains editing and soft removal without maintenance workspace',()=>{
 const html=renderLibrary(owner());
 for(const text of ['搜索我的补句','新增自己的补句','移入回收区：正常补句','设置→Prelude→个人库维护'])assert.ok(html.includes(text),text);
 for(const text of ['导入并预览','导出个人库','永久移除：','恢复这句','共占','已回收补句'])assert.ok(!html.includes(text),text);
});
test('0416 maintenance exposes only recovery data and controls, not live snippet cards or editor',()=>{
 const html=renderLibrary(owner(),'maintenance');
 for(const text of ['导出个人库','导入并预览','搜索回收区','恢复这句','永久移除：已回收补句','共占2/200'])assert.ok(html.includes(text),text);
 for(const text of ['新增自己的补句','我的补句正文','data-method="custom-live"','移入回收区：正常补句'])assert.ok(!html.includes(text),text);
});
test('0416 daily damaged library keeps the real error and maintenance path',()=>{
 const html=renderLibrary(owner({state:'corrupt',value:null,writable:false,message:'合成：个人库损坏；原件保留。'}));
 assert.ok(html.includes('个人库损坏'));assert.ok(html.includes('设置→Prelude→个人库维护'));assert.ok(!html.includes('恢复备份'));assert.ok(!html.includes('未当作空库'));
});
test('0416 maintenance recovery uses recovery availability rather than ordinary writable state',()=>{
 const h=owner({state:'corrupt',value:null,writable:false,message:'合成损坏',backups:[{generation:1,sha256:'a'.repeat(64),items:2}],recoveryAvailable:true});
 const html=renderLibrary(h,'maintenance');
 assert.ok(html.includes('导出损坏原件'));assert.match(html,/<button[^>]*>恢复备份1/);assert.ok(!/disabled=""[^>]*>恢复备份1/.test(html));
 h.set({...h.snapshot(),recoveryAvailable:false});const unavailable=renderLibrary(h,'maintenance');
 assert.ok(!unavailable.includes('导出损坏原件'));assert.match(unavailable,/disabled=""[^>]*>恢复备份1/);assert.ok(unavailable.includes('离线核对'));
});
test('0416 compact body receives independent disclosure props while full body stays unwrapped',()=>{
 const h=owner(),m={id:'custom-body',label:'合成标题',snippet:'合成正文'};
 const props={m,methods:[],library:h.library,message:()=>{},bodyDisclosure:{open:true,'data-pc-disclosure':'methodBody:custom-body'}};
 const compact=renderToStaticMarkup(React.createElement(staticComponents.MethodCard,{...props,compact:true}));
 assert.match(compact,/<details[^>]*open=""[^>]*data-pc-disclosure="methodBody:custom-body"/);
 const full=renderToStaticMarkup(React.createElement(staticComponents.MethodCard,props));assert.ok(!full.includes('pc-method-body'));assert.ok(full.includes('合成正文'));
});

let active;
const hook=make=>{const index=active.cursor++;return active.hooks[index]??(active.hooks[index]=make());};
const eventComponents=load({...React,
 useState:initial=>{const h=hook(()=>({value:typeof initial==='function'?initial():initial}));return [h.value,value=>{h.value=typeof value==='function'?value(h.value):value;}];},
 useRef:initial=>hook(()=>({current:initial})),
 useEffect:(fn,deps)=>{const h=hook(()=>({deps:undefined,cleanup:null}));if(!h.deps||!deps||deps.some((x,i)=>!Object.is(x,h.deps[i]))){active.effects.push(()=>{h.cleanup?.();h.cleanup=fn();h.deps=deps;});}},
 useSyncExternalStore:(_subscribe,get)=>get()
});
function mount(Component,props){
 const context={hooks:[],cursor:0,effects:[]};
 const render=()=>{context.cursor=0;context.effects=[];active=context;let tree;try{tree=Component(props);}finally{active=null;}for(const effect of context.effects)effect();return tree;};
 return {render,unmount:()=>{for(const h of context.hooks)h.cleanup?.();}};
}
const nodes=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(nodes)];
const textOf=node=>typeof node==='string'||typeof node==='number'?String(node):React.Children.toArray(node?.props?.children).map(textOf).join('');
const button=(tree,label)=>nodes(tree).find(x=>x.type==='button'&&textOf(x)===label);
const input=(tree,label)=>nodes(tree).find(x=>x.props?.['aria-label']===label);

for(const scenario of [
 {name:'standard card with rewrite choice',id:'synthetic-method',choose:true,insertPrimary:false},
 {name:'personal snippet keeps insertion primary',id:'custom-synthetic',choose:true,insertPrimary:true},
 {name:'standalone method without rewrite choice',id:'synthetic-standalone',choose:false,insertPrimary:true}
])test('0417 '+scenario.name+' preserves explicit actions and insertion semantics',()=>{
 const h=owner(),writes=[],choices=[],messages=[],m={id:scenario.id,label:'合成方法',snippet:'请保留原稿中的路径。'};
 const inputState={phase:'plain',draftRev:7};
 const props={m,methods:[],library:h.library,input:inputState,message:x=>messages.push(x),actions:{captureInsertion:()=>({start:1,end:4,draftRev:7}),insertText:(...args)=>{writes.push(args);return true;}},...(scenario.choose?{onChooseMethod:(...args)=>choices.push(args)}:{})};
 const ui=mount(eventComponents.MethodCard,props);
 try{
  const tree=ui.render(),insert=button(tree,'插入光标处'),choose=button(tree,'用于本次改写'),copy=button(tree,'复制补句');
  assert.ok(insert);assert.ok(copy);assert.notEqual(insert.props.disabled,true);
  assert.equal(insert.props.className.split(/\s+/u).includes('pc-primary'),scenario.insertPrimary);
  assert.ok(insert.props['aria-label'].endsWith(m.label));assert.ok(copy.props['aria-label'].endsWith(m.label));
  if(scenario.choose&&!scenario.id.startsWith('custom-')){
   assert.ok(choose);assert.ok(choose.props.className.split(/\s+/u).includes('pc-primary'));
   choose.props.onClick();assert.deepEqual(choices,[[m,'standard',false]]);assert.equal(writes.length,0,'choosing a method does not edit the draft');
  }else assert.equal(choose,undefined,'no phantom rewrite action for a personal/standalone card');
  insert.props.onClick();
  assert.deepEqual(writes,[['\n'+m.snippet+'\n',{start:4,end:4,draftRev:7}]],'insertion remains at the selection end rather than replacing selected text');
  assert.ok(messages.at(-1).includes('尚未发送'));
 }finally{ui.unmount();}
});

test('0416 unsaved daily editing survives maintenance mount/unmount and dirty purge guard remains active',()=>{
 const h=owner(),messages=[],props={library:h.library,methods:[],message:x=>messages.push(x)};
 const daily=mount(eventComponents.PersonalLibrary,props),maintenance=mount(eventComponents.PersonalLibrary,{...props,view:'maintenance'});
 daily.render();const editor=eventComponents.personalEditorFor(h.library);editor.begin(h.snapshot().value.items[1],1);editor.update('text','未保存的合成修改');
 const tree=maintenance.render();assert.ok(!input(tree,'我的补句正文'));button(tree,'永久移除，释放名额').props.onClick();
 assert.ok(messages.at(-1).includes('未保存'));assert.equal(h.writes.length,0);maintenance.unmount();
 assert.equal(input(daily.render(),'我的补句正文').props.value,'未保存的合成修改');assert.equal(h.disposed(),0);daily.unmount();
});
test('0416 import captures preview revision and unmount leaves submitted commit under shared controller ownership',async()=>{
 const h=owner(),messages=[];let finish;
 h.library.mutate=(...args)=>{h.writes.push(args);return new Promise(resolve=>{finish=resolve;});};
 const ui=mount(eventComponents.PersonalLibrary,{library:h.library,methods:[],view:'maintenance',message:x=>messages.push(x)});
 const file=nodes(ui.render()).find(x=>x.type==='input'&&x.props.type==='file');
 const raw=JSON.stringify({schemaVersion:2,revision:0,favorites:[],items:[]});
 await file.props.onChange({target:{files:[{size:raw.length,text:async()=>raw}],value:'fixture'}});
 const preview=ui.render();assert.ok(input(preview,'导入预览'));button(preview,'确认导入').props.onClick();
 assert.equal(h.writes.length,1);assert.equal(h.writes[0][1].expectedRevision,1);ui.unmount();assert.equal(h.disposed(),0);
 finish({value:{...h.snapshot().value,revision:2}});await Promise.resolve();await Promise.resolve();assert.equal(h.writes.length,1);
});
test('0416 new library revision does not rebase an existing import preview',async()=>{
 const h=owner(),messages=[];h.library.mutate=async(op,options)=>{h.writes.push([op,options]);if(options.expectedRevision!==h.snapshot().value.revision)throw Error('版本冲突，未覆盖');};
 const ui=mount(eventComponents.PersonalLibrary,{library:h.library,methods:[],view:'maintenance',message:x=>messages.push(x)});
 const file=nodes(ui.render()).find(x=>x.type==='input'&&x.props.type==='file');const raw=JSON.stringify({schemaVersion:2,revision:0,favorites:[],items:[]});
 await file.props.onChange({target:{files:[{size:raw.length,text:async()=>raw}],value:'fixture'}});
 h.set({...h.snapshot(),value:{...h.snapshot().value,revision:2}});button(ui.render(),'确认导入').props.onClick();await Promise.resolve();await Promise.resolve();
 assert.equal(h.writes[0][1].expectedRevision,1);assert.ok(messages.at(-1).includes('版本冲突'));assert.ok(input(ui.render(),'导入预览'));ui.unmount();
});

test('0420 import mode changes repaint actual actions and stale preview disables confirmation',async()=>{
 const h=owner(),messages=[];const base=h.snapshot().value;
 const incoming={...base,revision:0,items:[{...base.items[0],snippet:base.items[1].snippet}]};
 const ui=mount(eventComponents.PersonalLibrary,{library:h.library,methods:[],view:'maintenance',message:x=>messages.push(x)});
 try{
  const file=nodes(ui.render()).find(x=>x.type==='input'&&x.props.type==='file'),raw=JSON.stringify(incoming);
  await file.props.onChange({target:{files:[{size:raw.length,text:async()=>raw}],value:'fixture'}});
  for(let i=0;i<6;i++){
   input(ui.render(),'导入冲突处理').props.onChange({target:{value:'keep-both'}});
   assert.ok(textOf(input(ui.render(),'导入预览')).includes('正文已存在，将跳过'));
   input(ui.render(),'导入冲突处理').props.onChange({target:{value:'replace'}});
   assert.ok(textOf(input(ui.render(),'导入预览')).includes('替换同ID'));
  }
  assert.equal(button(ui.render(),'确认导入').props.disabled,false);assert.equal(h.writes.length,0);
  h.set({...h.snapshot(),value:{...base,revision:2}});
  const stale=ui.render();assert.equal(button(stale,'确认导入').props.disabled,true);
  assert.ok(textOf(stale).includes('个人库已变化，请重新选择文件并预览'));
  assert.deepEqual(base.items,h.snapshot().value.items);assert.equal(h.writes.length,0);
 }finally{ui.unmount();}
});
test('0416 evidence preview shows replacement capacity and stays editable when over limit',()=>{
 let evidence=Array.from({length:8},(_,i)=>({id:'chat-'+i+'-k'+i,source:'history-user',label:'资料'+i,text:'x'.repeat(500),coverage:'合成'}));
 const chat={order:['k0'],nodes:new Map([['k0',{visibility:'visible',kind:'user',data:{seq:0,content:[{type:'text',text:'y'.repeat(500)}]}}]])};
 const props={services:{},sessionId:'fixture',input:{attachmentIds:[]},chat,evidence,message:()=>{},onChange:value=>{evidence=value;props.evidence=value;}};
 const ui=mount(eventComponents.MaterialControls,props);button(ui.render(),'选取上文').props.onClick();
 const row=nodes(ui.render()).find(x=>x.type==='button'&&textOf(x).startsWith('预览：'));row.props.onClick();
 assert.ok(textOf(ui.render()).includes('采用后：8/8 段 · 4000/4000 字符'));
 input(ui.render(),'所选资料预览').props.onChange({target:{value:'z'.repeat(501)}});
 let tree=ui.render();assert.equal(button(tree,'采用这段资料').props.disabled,true);assert.equal(input(tree,'所选资料预览').props.value.length,501);assert.ok(button(tree,'放弃预览'));
 input(tree,'所选资料预览').props.onChange({target:{value:'z'.repeat(499)}});tree=ui.render();assert.equal(button(tree,'采用这段资料').props.disabled,false);button(tree,'采用这段资料').props.onClick();
 assert.equal(evidence.length,8);assert.equal(evidence.reduce((n,x)=>n+x.text.length,0),3999);ui.unmount();
});
