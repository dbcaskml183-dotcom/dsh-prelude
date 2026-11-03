import {sdkRequire,buildRequire} from './helpers/deps.mjs';
// Actual JSX static rendering. Server-snapshot adapter is test-only; not browser E2E.
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {readFileSync} from 'node:fs';
const require=sdkRequire,React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const esbuild=buildRequire('esbuild');
const result=await esbuild.build({entryPoints:[fileURLToPath(new URL('../src/components.jsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',external:['react'],logLevel:'silent'});const mod={exports:{}};const adapted={...React,useSyncExternalStore:(sub,get,server)=>React.useSyncExternalStore(sub,get,server||get)};new Function('require','module','exports',result.outputFiles[0].text)(id=>id==='react'?adapted:require(id),mod,mod.exports);const {MethodCard,MaterialControls,PersonalLibrary}=mod.exports;
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;const m=methods.find(x=>x.id==='cohesion'),base={m,methods,request:{draft:'调查订单模块',context:''},input:{phase:'plain',draftRev:1},actions:{},capture:()=>{},b:{},message:()=>{},library:{getSnapshot:()=>({writable:true,value:{favorites:[]}}),subscribe:()=>()=>{}}};
const render=props=>renderToStaticMarkup(React.createElement(MethodCard,{...base,...props}));
test('exact snippet is visible before main action',()=>{const html=render();assert.ok(html.indexOf('补句原文')<html.indexOf(m.snippet));assert.ok(html.indexOf(m.snippet)<html.indexOf('插入光标处'));});
test('secondary reasoning remains available but collapsed',()=>{const html=render({suggestion:{reason:'特定合成原因',placement:{hint:'特定合成位置'}}});const detail=html.slice(html.indexOf('<details'));assert.ok(detail.includes('特定合成原因'));assert.ok(detail.includes('特定合成位置'));assert.ok(!/^<details[^>]*\bopen/.test(detail));assert.ok(detail.includes('实际插到当前光标处'));});
test('copy is explicit and primary insertion comes first',()=>{const html=render();assert.ok(html.includes('复制补句'));assert.ok(html.indexOf('>插入光标处</button>')<html.indexOf('>复制补句</button>'));});
test('busy insertion has visible explanation outside details',()=>{const html=render({input:{phase:'busy',draftRev:1}});assert.ok(html.includes('输入框暂不可插入，可先复制补句'));assert.ok(html.indexOf('输入框暂不可插入')<html.indexOf('<details'));});
test('scope conflicts remain visible rather than hidden for clean appearance',()=>{const html=render({request:{draft:'只读调查，不执行命令。',context:''},m:methods.find(x=>x.id==='tdd')});assert.ok(html.includes('存在冲突'));assert.ok(html.indexOf('存在冲突')<html.indexOf('<details'));});
test('materials summary distinguishes selected from previewed',()=>{const html=renderToStaticMarkup(React.createElement(MaterialControls,{services:{},sessionId:'fixture',input:{attachmentIds:[]},chat:{},evidence:[{id:'fixture',label:'file.txt',text:'hello',coverage:'仅片段'}],onChange:()=>{},message:()=>{}}));assert.ok(html.includes('参考资料 · 已选1段'));assert.ok(html.includes('点击细化时才发送所选5字符'));assert.ok(html.includes('已选：file.txt'));assert.ok(!html.includes('默认仅草稿'));});


test('repeated card actions have item-specific accessible names',()=>{const html=render();assert.ok(html.includes('aria-label="复制补句：'+m.technical_name+'"'));assert.ok(html.includes('aria-label="插入光标处：'+m.technical_name+'"'));});

test('technical term is the prominent heading, plain language remains secondary',()=>{const html=render();assert.ok(html.includes('<strong>'+m.technical_name+'</strong>'));assert.ok(html.includes('class="pc-card-subtitle">'+m.label));assert.ok(html.indexOf(m.technical_name)<html.indexOf(m.label));assert.equal((html.match(/专业名称/g)||[]).length,0);assert.ok(html.includes('何时用：'));});
test('personal cards without terminology keep a useful title',()=>{const html=render({m:{id:'custom-example',label:'自己的规则',snippet:'保留所有原始记录。'}});assert.ok(html.includes('<strong>自己的规则</strong>'));assert.ok(!html.includes('undefined'));assert.ok(!html.includes('pc-card-subtitle'));});

test('favorite action uses readable text instead of star glyphs',()=>{const html=render();assert.ok(html.includes('>收藏</button>'));assert.ok(!/[★☆]/.test(html));});
test('plain description repeated by a subtitle is rendered once',()=>{const html=render({m:{id:'synthetic-card',technical_name:'SSOT',label:'同一事实有明确入口',plain_explanation:'同一事实有明确入口。',snippet:'核对权威入口。'}});assert.equal((html.match(/同一事实有明确入口/g)||[]).length,1);});
test('selected favorite has a clear text state and inverse accessible action',()=>{const html=render({library:{getSnapshot:()=>({writable:true,value:{favorites:[m.id]}}),subscribe:()=>()=>{}}});assert.ok(html.includes('>已收藏</button>'));assert.ok(html.includes('aria-label="取消收藏：'+m.technical_name+'"'));});

for(const backups of [[{generation:1,sha256:'a'.repeat(64),items:2}],[]])test('missing-protected library renders recovery without pretending to export missing primary '+backups.length,()=>{const library={subscribe:()=>()=>{},getSnapshot:()=>({state:'missing-protected',value:null,writable:false,message:'主库缺失',backups}),load:()=>{throw new Error('SSR must not load');}};const html=renderToStaticMarkup(React.createElement(PersonalLibrary,{view:'maintenance',library,methods,message:()=>{}}));assert.ok(html.includes('个人库恢复'));assert.ok(!html.includes('导出损坏原件'));assert.ok(html.includes('暂停普通保存'));if(backups.length)assert.ok(html.includes('恢复备份1'));else assert.ok(html.includes('没有可用备份'));});

test('047 offline-only recovery never offers a broken export or enabled recovery',()=>{const library={subscribe:()=>()=>{},getSnapshot:()=>({state:'corrupt',value:null,writable:false,message:'离线处理',recoveryAvailable:false,backups:[{generation:1,sha256:'a'.repeat(64),items:2}]}),load:()=>{}};const html=renderToStaticMarkup(React.createElement(PersonalLibrary,{view:'maintenance',library,methods,message:()=>{}}));assert.ok(html.includes('离线核对'));assert.ok(!html.includes('导出损坏原件'));assert.match(html,/disabled=""[^>]*>恢复备份1/);});


// Exercise the real JSX callbacks with page-local hooks; this is an event
// integration test, not a browser substitute or a second production controller.
function personalEvents(){
 const hooks=[];let cursor=0,cleanups=[],mounted=false;
 const hook=(make)=>{const index=cursor++;return hooks[index]??(hooks[index]=make());};
 const shim={...React,useState:initial=>{const h=hook(()=>({value:typeof initial==='function'?initial():initial}));return [h.value,v=>{h.value=typeof v==='function'?v(h.value):v;}];},useRef:initial=>hook(()=>({current:initial})),useEffect:fn=>{if(!mounted){const clean=fn();if(clean)cleanups.push(clean);}},useSyncExternalStore:(_sub,get)=>get()};
 const eventMod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(id=>id==='react'?shim:require(id),eventMod,eventMod.exports);
 let snapshot={state:'ready',writable:true,value:{schemaVersion:2,revision:1,items:[],favorites:[]},backups:[]};const messages=[],writes=[];
 const library={getSnapshot:()=>snapshot,subscribe:()=>()=>{},load:()=>{},mutate:async(...args)=>{writes.push(args);return {value:snapshot.value};}};
 const render=()=>{cursor=0;const tree=eventMod.exports.PersonalLibrary({view:'maintenance',library,methods,message:x=>messages.push(x)});mounted=true;return tree;};
 const nodes=(node)=>{if(!node||typeof node!=='object')return[];return [node,...React.Children.toArray(node.props?.children).flatMap(nodes)];};
 const select=file=>nodes(render()).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:file?[file]:[],value:'fixture'}});
 const preview=()=>nodes(render()).find(n=>n.props?.['aria-label']==='导入预览');
 render();return {select,preview,messages,writes,changeRevision:()=>{snapshot={...snapshot,value:{...snapshot.value,revision:2}};},unmount:()=>{for(const f of cleanups)f();}};
}
const importRaw=favorites=>JSON.stringify({schemaVersion:2,revision:0,items:[],favorites});
test('047 file read failure has visible feedback and never writes',async()=>{const h=personalEvents();await h.select({size:8,text:async()=>{throw Error('synthetic I/O');}});assert.ok(h.messages.some(x=>x.includes('无法读取')));assert.equal(h.preview(),undefined);assert.equal(h.writes.length,0);});
test('047 a slow previous import cannot replace the newer preview',async()=>{const h=personalEvents();let finish;const a=h.select({size:8,text:()=>new Promise(r=>finish=r)});await h.select({size:8,text:async()=>importRaw(['evidence'])});const current=h.preview();assert.ok(current);finish(importRaw(['cohesion','evidence']));await a;assert.equal(renderToStaticMarkup(h.preview()),renderToStaticMarkup(current));assert.equal(h.writes.length,0);});
test('047 unmount invalidates a pending file read without late feedback',async()=>{const h=personalEvents();let finish;const a=h.select({size:8,text:()=>new Promise(r=>finish=r)});h.unmount();finish('broken');await a;assert.equal(h.preview(),undefined);assert.ok(h.messages.every(x=>x==='')); });
test('047 a concurrent library revision invalidates the file preview',async()=>{const h=personalEvents();let finish;const a=h.select({size:8,text:()=>new Promise(r=>finish=r)});h.changeRevision();finish(importRaw([]));await a;assert.equal(h.preview(),undefined);assert.ok(h.messages.some(x=>x.includes('读取期间个人库已变化')));assert.equal(h.writes.length,0);});

test('047 invalid replacement clears the previous valid import preview',async()=>{const h=personalEvents();await h.select({size:8,text:async()=>importRaw([])});assert.ok(h.preview());await h.select({size:8,text:async()=>'{broken'});assert.equal(h.preview(),undefined);assert.ok(h.messages.at(-1));assert.equal(h.writes.length,0);});
test('047 a successful new preview clears a previous import error',async()=>{const h=personalEvents();await h.select({size:8,text:async()=>'{broken'});assert.ok(h.messages.at(-1));await h.select({size:8,text:async()=>importRaw([])});assert.ok(h.preview());assert.equal(h.messages.at(-1),'');assert.equal(h.writes.length,0);});
