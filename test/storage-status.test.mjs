import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {sdkRequire,buildRequire} from './helpers/deps.mjs';
const React=sdkRequire('react'),{renderToStaticMarkup}=sdkRequire('react-dom/server'),esbuild=buildRequire('esbuild');let seeds=[];
const shim={...React,useState:()=>[seeds.shift(),()=>{}],useRef:()=>({current:null}),useEffect:()=>{}};
const code=await esbuild.build({entryPoints:[fileURLToPath(new URL('../src/storage-status.jsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',external:['react'],logLevel:'silent'}),mod={exports:{}};
new Function('require','module','exports',code.outputFiles[0].text)(id=>id==='react'?shim:sdkRequire(id),mod,mod.exports);
const render=(status,message)=>{seeds=[status,message,false];return renderToStaticMarkup(React.createElement(mod.exports.StorageStatus));};
test('failed bookkeeping retry renders identical persistent warning only once',()=>{const warning='登记暂未成功';const html=render({ledgerError:warning,pendingSettlement:true,budget:{coordination:{state:'ready'}}},warning);assert.equal(html.split(warning).length-1,1);assert.ok(html.includes('重试登记（不调用模型）'));});
test('successful bookkeeping feedback stays visible without an obsolete retry control',()=>{const html=render({ledgerError:null,pendingSettlement:false,budget:{coordination:{state:'ready'}}},'调用记录已补登记，未调用模型。');assert.ok(html.includes('调用记录已补登记，未调用模型。'));assert.ok(!html.includes('重试登记（不调用模型）'));});
