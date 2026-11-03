import {sdkRequire,buildRequire} from './helpers/deps.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {readFileSync} from 'node:fs';
import {BRAND} from '../shared/brand.mjs';
const require=sdkRequire,React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const esbuild=buildRequire('esbuild');
const built=await esbuild.build({entryPoints:[fileURLToPath(new URL('../src/settings.jsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',external:['react'],logLevel:'silent'});
const mod={exports:{}},adapted={...React,useSyncExternalStore:(sub,get,server)=>React.useSyncExternalStore(sub,get,server||get)};
new Function('require','module','exports',built.outputFiles[0].text)(id=>id==='react'?adapted:require(id),mod,mod.exports);
const {PreludeSettings}=mod.exports;
const library={getSnapshot:()=>({state:'ready',writable:true,message:'',backups:[],value:{items:[],favorites:[],revision:0}}),subscribe:()=>()=>{},load:()=>{throw new Error('SSR must not write/load')},mutate:()=>{throw new Error('render must not mutate')}};
const render=()=>renderToStaticMarkup(React.createElement(PreludeSettings,{library,methods:[],sessionId:undefined}));
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8'),client=readFileSync(new URL('../src/client.jsx',import.meta.url),'utf8');
const packageInfo=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('new public identity is explicit without changing compatibility IDs',()=>{
 assert.equal(BRAND.slug,'dsh-prelude');assert.ok(Object.isFrozen(BRAND));
 assert.equal(BRAND.title,'Prelude');assert.equal(BRAND.short,'Prelude');assert.equal(BRAND.entryLabel,'Prelude');
 const html=render();assert.ok(html.includes('<h2>Prelude</h2>'));assert.ok(!html.includes('前奏'));assert.ok(!html.includes('让意图清晰，让方法到位。'));
 assert.ok(client.includes("id:'prompt-coach'"));assert.ok(client.includes("id:'prompt-coach-entry'"));
});
test('three settings groups have separate semantic boundaries',()=>{
 const html=render();assert.equal((html.match(/class="pc-settings-card"/g)||[]).length,3);
 for(const title of ['智能功能默认设置','面板默认展开','个人库维护'])assert.ok(html.includes('>'+title+'</h3>'));
 const targets=[...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(targets).size,3);for(const id of targets)assert.ok(html.includes('id="'+id+'"'));
});
test('settings preserves shared route and library controls',()=>{
 const html=render();for(const label of ['模型使用方式','刷新个人库','导出个人库','导入并预览','个人库维护'])assert.ok(html.includes(label));
 assert.ok(html.includes('不改变主会话选模'));assert.ok(html.includes('模型调用按供应商计费'));assert.ok(!html.includes('新增自己的补句'));assert.ok(!html.includes('搜索我的补句'));assert.ok(html.includes('v'+packageInfo.version));assert.ok(!html.includes('前端 '+packageInfo.version));
});
test('context boundaries remain explicit under the new name',()=>{
 const html=render();assert.ok(html.includes('只调整显示'));assert.ok(html.includes('不会读取资料、选中方法或调用模型'));
});
test('empty personal library remains accessible without an artificial enclosing form',()=>{
 const html=render();assert.ok(html.includes('已保存'));assert.ok(html.includes('条'));assert.ok(!html.includes('<form'));
});
test('frames are scoped and use full borders with auto height',()=>{
 const rule=css.match(/\.pc-root\.pc-settings \.pc-settings-card\{([^}]+)\}/)[1];
 assert.ok(rule.includes('border:1px solid var(--pc-line)'));assert.ok(rule.includes('min-width:0'));
 assert.ok(!/(?:^|;)height:|overflow:hidden|position:absolute/.test(rule));
 assert.ok(!/\n\.pc-settings(?:\{|\s)/.test(css));
});
test('entry, panel and settings nav use one brand source',()=>{
 assert.ok(client.includes('aria-label={BRAND.entryLabel}'));assert.ok(client.includes('<span>{BRAND.short}</span>'));
 assert.ok(client.includes('label:BRAND.title'));assert.ok(client.includes('<strong>{BRAND.title}</strong>'));
});

test('entry, panel and settings branding contain no decorative star symbol',()=>{
 for(const file of ['../src/client.jsx','../src/settings.jsx','../client.js'])assert.ok(!readFileSync(new URL(file,import.meta.url),'utf8').includes('✦'),file);
 assert.ok(!css.includes('pc-settings-symbol'));
});

test('bookkeeping diagnostics stays within smart refinement and never offers unsafe force-unlock',()=>{const html=render();assert.ok(html.includes('调用记录与存储诊断'));assert.ok(html.includes('不会再次调用模型'));assert.ok(!html.includes('清除陈旧锁'));assert.ok(html.indexOf('调用记录与存储诊断')<html.indexOf('参考资料'));});
