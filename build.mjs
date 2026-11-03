
import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const guidanceBytes=readFileSync('guidance/rules.json');writeFileSync('shared/guidance-version.mjs',"export const RULES_HASH='"+createHash('sha256').update(guidanceBytes).digest('hex')+"';\n");
const {validateGuidance}=await import('./shared/guidance.mjs');validateGuidance();
const localRequire=createRequire(import.meta.url);
let esbuild;try{esbuild=localRequire('esbuild');}catch{const supplied=process.env.DSH_COACH_BUILD_PACKAGE;if(!supplied)throw new Error('请安装声明的开发依赖，或用DSH_COACH_BUILD_PACKAGE指定已有构建依赖的package.json。');esbuild=createRequire(supplied)('esbuild');}
const result=await esbuild.build({entryPoints:['src/client.jsx'],bundle:true,write:false,format:'cjs',platform:'browser',target:'es2022',external:['react','@deepseek-ai/dsh-client-ui-primitives'],loader:{'.css':'text'},logLevel:'warning',metafile:true});
writeFileSync('client.js',"window.__ModuleLoader__.load({id:'dsh-prompt-coach',factory:(require)=>{const module={exports:{}};const exports=module.exports;\n"+result.outputFiles[0].text+"\nreturn module.exports;}});\n");
console.log('client build bytes',result.outputFiles[0].contents.length);

const host=await esbuild.build({entryPoints:["src/host.mjs"],bundle:true,outfile:"index.mjs",format:"esm",platform:"node",target:"node24",external:['@deepseek-ai/*'],logLevel:"warning",metafile:true});
if(process.env.DSH_COACH_META_DIR){writeFileSync(process.env.DSH_COACH_META_DIR+'/client-build.json',JSON.stringify(result.metafile,null,2));writeFileSync(process.env.DSH_COACH_META_DIR+'/host-build.json',JSON.stringify(host.metafile,null,2));}

await esbuild.build({entryPoints:['tools/storage-doctor.mjs'],bundle:true,outfile:'bin/storage-doctor.mjs',format:'esm',platform:'node',target:'node24',logLevel:'warning'});
