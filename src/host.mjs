import {createSessionValidator} from '../host/session-validator.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import Schema from '@deepseek-ai/schemastery';
import {resolveDshHome} from '@deepseek-ai/dsh-home-paths';
import {UsageLedger} from '../host/usage-ledger.mjs';
import {createHandler,boundedBody,json} from '../host/service.mjs';
import {LibraryRepository} from '../host/library-repository.mjs';
import {LibraryError} from '../shared/library.mjs';
export const name='prompt-coach';
export const inject=['connection'];
export const Config=Schema.object({routeMode:Schema.string().default('follow').volatile(),provider:Schema.string().default('').volatile(),model:Schema.string().default('').volatile(),autoReview:Schema.boolean().default(false).volatile(),targetMode:Schema.union(['generic','session']).default('generic').volatile(),defaultOpenRequirements:Schema.boolean().default(false).volatile(),defaultOpenMaterials:Schema.boolean().default(false).volatile(),defaultOpenBundles:Schema.boolean().default(false).volatile(),defaultOpenModel:Schema.boolean().default(false).volatile(),defaultOpenMethodBody:Schema.boolean().default(false).volatile(),defaultOpenReflected:Schema.boolean().default(false).volatile(),defaultOpenEffectiveRequirements:Schema.boolean().default(false).volatile(),defaultOpenDiff:Schema.boolean().default(false).volatile(),defaultOpenEditNotes:Schema.boolean().default(false).volatile()});
const unwrap=x=>typeof x?.get==='function'?x.get():x;
export function apply(ctx,rawConfig={}) {
 const methods=JSON.parse(readFileSync(new URL('./methods.json',import.meta.url),'utf8')).methods;
 const {version}=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'));
 const root=join(resolveDshHome(),'prompt-coach');
 const budget=new UsageLedger(root),library=new LibraryRepository(join(root,'library'));
 const getConfig=()=>({routeMode:unwrap(rawConfig.routeMode)==='fixed'?'fixed':'follow',provider:String(unwrap(rawConfig.provider)||''),model:String(unwrap(rawConfig.model)||''),autoReview:unwrap(rawConfig.autoReview)??false,targetMode:unwrap(rawConfig.targetMode)||'generic',defaultOpenRequirements:unwrap(rawConfig.defaultOpenRequirements)===true,defaultOpenMaterials:unwrap(rawConfig.defaultOpenMaterials)===true,defaultOpenBundles:unwrap(rawConfig.defaultOpenBundles)===true,defaultOpenModel:unwrap(rawConfig.defaultOpenModel)===true,defaultOpenMethodBody:unwrap(rawConfig.defaultOpenMethodBody)===true,defaultOpenReflected:unwrap(rawConfig.defaultOpenReflected)===true,defaultOpenEffectiveRequirements:unwrap(rawConfig.defaultOpenEffectiveRequirements)===true,defaultOpenDiff:unwrap(rawConfig.defaultOpenDiff)===true,defaultOpenEditNotes:unwrap(rawConfig.defaultOpenEditNotes)===true});
 const validateSession=createSessionValidator(()=>ctx.get('sessionController'));
 const handler=createHandler({getLlm:()=>ctx.get('llm'),budget,methods,version,getConfig,validateSession,diagnosticRoots:[new URL('./',import.meta.url).href],onError:facts=>console.warn('[prompt-coach] model call failed',JSON.stringify(facts)),skills:async signal=>await ctx.get('skills')?.list({signal})||[]});
 ctx.effect(()=>ctx.connection.fetch.register({path:'/api/prompt-coach/v4/status',methods:['GET'],requestBody:'buffered',fetch:handler.handle}));
 for(const operation of ['suggest','rewrite','review'])ctx.effect(()=>ctx.connection.fetch.register({path:'/api/prompt-coach/v8/'+operation,methods:['POST'],requestBody:'streaming',fetch:req=>handler.handle(req,{operation})}));
 const retired=()=>json({ok:false,error:'Prelude AI协议已更新，请刷新页面；原稿未改动。',localOnly:true},409);
 for(const path of ['/api/prompt-coach/v7/suggest','/api/prompt-coach/v7/rewrite','/api/prompt-coach/v7/review','/api/prompt-coach/v4','/api/prompt-coach/v4/rewrite','/api/prompt-coach/v5/suggest','/api/prompt-coach/v5/rewrite','/api/prompt-coach/v5/review','/api/prompt-coach/v6/suggest','/api/prompt-coach/v6/rewrite','/api/prompt-coach/v6/review'])ctx.effect(()=>ctx.connection.fetch.register({path,methods:['POST'],requestBody:'streaming',fetch:retired}));
 ctx.effect(()=>ctx.connection.fetch.register({path:'/api/prompt-coach/v4/reconcile',methods:['POST'],requestBody:'streaming',fetch:handler.reconcile}));
 const libraryHandler=async req=>{
  try{
   if(req.method==='GET'){
    if(new URL(req.url).searchParams.get('raw')==='1'){if(library.read().recoveryAvailable===false)throw new LibraryError('OFFLINE_REQUIRED','原件超限或无法安全读取，不能在本页面导出；请按离线恢复文档保全处理。');return new Response(library.bytes(),{headers:{'content-type':'application/octet-stream','cache-control':'no-store','content-disposition':'attachment; filename="Prelude-original.json"'}});}
    return json({ok:true,...library.read(),coordination:library.health(),backups:library.backups()});
   }
   const body=await boundedBody(req,2200000);
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['expectedRevision','op','recover'].includes(k)))throw new LibraryError('INVALID','个人库请求格式无效。');
   const value=body.recover?library.recover(body.recover.generation,body.recover.sha256):library.write(body.expectedRevision,body.op);
   return json({ok:true,...value,backups:library.backups()});
   }catch(e){return json({ok:false,error:e instanceof LibraryError?e.message:'个人库操作未确认，请刷新后核对；原件不会被当作空库。',code:e instanceof LibraryError?e.code:'STORAGE'},['CONFLICT','CAPACITY'].includes(e?.code)?409:503);}
 };
 ctx.effect(()=>ctx.connection.fetch.register({path:'/api/prompt-coach/v4/library',methods:['GET'],requestBody:'buffered',fetch:libraryHandler}));
 ctx.effect(()=>ctx.connection.fetch.register({path:'/api/prompt-coach/v4/library/write',methods:['POST'],requestBody:'streaming',fetch:libraryHandler}));
 const refresh=()=>json({ok:false,error:'Prelude已更新，请刷新页面后使用；原草稿未改动。',localOnly:true},409);
 for(const [path,method] of [['/api/prompt-coach','POST'],['/api/prompt-coach/status','GET'],['/api/prompt-coach/v2','POST'],['/api/prompt-coach/v2/status','GET'],['/api/prompt-coach/v3','POST'],['/api/prompt-coach/v3/status','GET']])ctx.effect(()=>ctx.connection.fetch.register({path,methods:[method],requestBody:method==='POST'?'streaming':'buffered',fetch:refresh}));
 ctx.inject?.(['settings'],sctx=>{sctx.effect(()=>sctx.settings.configure({auto:false}));});
 ctx.effect(()=>()=>handler.dispose());
}
