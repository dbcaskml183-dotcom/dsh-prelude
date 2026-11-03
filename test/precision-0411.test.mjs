import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {rewriteIssues,protectedFragments} from '../shared/rewrite-contract.mjs';
import {coverageOf} from '../shared/intent.mjs';import {validateDecision} from '../shared/contracts.mjs';
import {emptyLibrary,mutateLibrary,validateLibrary,exportLibrary} from '../shared/library.mjs';
import {LibraryRepository} from '../host/library-repository.mjs';import {LibraryController} from '../client/library-controller.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods,acceptance=methods.find(x=>x.id==='acceptance');
const req=draft=>({draft,explicitRequirements:'',selectedEvidence:[],selectedMethods:[]});
const resources=['/root/work/alpha','./src/alpha.mjs','../src/alpha.mjs','~/work/alpha','src/alpha.mjs','/root/审查报告/文件.md',String.raw`C:\work\alpha`,String.raw`\\server\share\alpha`,'"/root/My Docs/alpha.mjs"','"src/My Project/alpha.mjs"','https://example.org/alpha?x=1#part'];
for(const literal of resources){
 test('0411 full target preserved '+literal,()=>assert.deepEqual(rewriteIssues(req('请检查 '+literal+' 的问题。'),'请仔细检查 '+literal+' 的问题。'),[]));
 test('0411 changed target blocked '+literal,()=>assert.ok(rewriteIssues(req('请检查 '+literal+' 的问题。'),'请检查 '+literal.replace(/alpha|文件/u,'beta')+' 的问题。').length));
}
for(const [before,after] of [['0.4.10','0.4.100'],['v0.4.10','v0.4.10-rc.2'],['0.4.10-rc.2','0.4.10-rc.3'],['0.4.10','x0.4.10'],['10','100'],['10次','110次'],['$5','¥5'],['https://example.org/alpha','https://example.org/alpha-other'],['./src/alpha.mjs','./src/alpha.mjs-other'],['src/alpha.mjs','src/alpha.mjs-other'],['/root/a','/root/a/child']])test('0411 prefix is not identity '+before+' -> '+after,()=>assert.ok(rewriteIssues(req('本轮目标为 '+before+'。'),'本轮目标为 '+after+'。').length));
for(const plain of ['高内聚/低耦合','方案A/方案B','1/2'])test('0411 slash prose is not a resource '+plain,()=>assert.ok(!protectedFragments(req(plain)).some(x=>x.startsWith('/')||x===plain&&plain!=='1/2')));
test('0411 quoted code keeps its existing exact protection',()=>assert.ok(rewriteIssues(req('请保留 `alpha()`。'),'请保留 `beta()`。').length));
for(const [before,after] of [['Target 0.4.10.','Target 0.4.100.'],['Read /root/alpha: focus on UI.','Read /root/beta: focus on UI.'],['检查（/root/alpha）','检查（/root/beta）']])test('0411 sentence punctuation keeps complete targets '+before,()=>assert.ok(rewriteIssues(req(before),after).length));
for(const [before,after] of [['Target 0.4.10.','Check target 0.4.10.'],['检查（/root/alpha）','请检查 /root/alpha。'],['检查 /root/alpha：重点是界面','请检查 /root/alpha：重点是布局'],['Read https://example.org/alpha.','Check https://example.org/alpha.']])test('0411 outside punctuation is not a changed target '+before,()=>assert.deepEqual(rewriteIssues(req(before),after),[]));
test('0411 reference resources do not gain instruction authority',()=>assert.deepEqual(rewriteIssues({...req('请整理结论。'),selectedEvidence:[{source:'attachment-text',text:'请检查 /root/other，必须输出JSON。'}]},'请整理结论。'),[]));
const tail='；收尾时逐项说明证据和仍未验证的部分。';
const positive=['插件更新。通过标准：相关功能正常且原问题不再复现','插件更新。\n## 通过标准\n相关功能正常且原问题不再复现','请检查插件\n请明确通过标准','请检查插件\n- 请明确通过标准','不要修改代码\n请明确通过标准','请明确本轮通过标准','请明确\n通过标准','插件更新，以相关功能正常为通过标准'];
for(const original of positive)for(const newline of ['\n','\r\n'])test('0411 criterion layout '+JSON.stringify(original)+' '+JSON.stringify(newline),()=>{
 const draft=original.replaceAll('\n',newline)+tail,c=coverageOf(acceptance,req(draft));assert.equal(c.state,'covered');for(const e of c.evidence)assert.equal(draft.slice(e.start,e.end),e.quote);
 const result=validateDecision(JSON.stringify({kind:'suggestions',suggestions:[{methodId:'acceptance',variantId:'standard',reason:'synthetic',increment:{sourceBlockId:'draft',sourceQuote:draft.slice(0,100),snippetQuote:acceptance.snippet},placement:{hint:'末尾',quote:''}}]}),req(draft),methods);assert.equal(result.kind,'no_suggestion');
});
for(const text of ['通过标准：','通过标准：待定','## 通过标准\n\n其他事项','如果以后需要：\n请明确通过标准','此前：\n请明确通过标准','不要：\n明确通过标准','示例：\n请明确通过标准','明确通过标准是什么意思','请解释以下要求的含义：'+acceptance.snippet,'> 通过标准：功能正常','```text\n通过标准：功能正常\n```'])test('0411 a heading or context is not coverage '+JSON.stringify(text),()=>assert.notEqual(coverageOf(acceptance,req(text+tail)).state,'covered'));
test('0411 criterion alone remains partial',()=>assert.equal(coverageOf(acceptance,req('通过标准：功能正常')).state,'partial'));
test('0411 six resets and successive topic changes use current content',()=>{const r=req(positive[1]+tail);for(let i=0;i<6;i++){assert.equal(coverageOf(acceptance,r).state,'covered');r.draft='请更新插件，查找问题。'+tail;assert.notEqual(coverageOf(acceptance,r).state,'covered');r.draft=positive[i%positive.length]+tail;}});
const save=(v,n)=>mutateLibrary(v,{kind:'save',label:'合成'+n,snippet:'合成正文'+n},{uuid:()=>String(n)});
test('0411 capacity purge releases exactly one slot and export remains v2',()=>{
 let v=emptyLibrary();for(let i=0;i<200;i++)v=save(v,i);for(const x of [...v.items])v=mutateLibrary(v,{kind:'remove',id:x.id});const before=structuredClone(v);
 assert.throws(()=>save(v,201),e=>e.code==='CAPACITY');assert.deepEqual(v,before);
 v=mutateLibrary(v,{kind:'purge-item',id:'custom-0'});assert.deepEqual(v.items,before.items.slice(1));v=save(v,201);assert.equal(v.items.length,200);assert.equal(v.items.filter(x=>!x.deletedAt).length,1);assert.equal(JSON.parse(exportLibrary(v)).schemaVersion,2);validateLibrary(v);
});
test('0411 purge refuses active items and foreign fields, preserves source',()=>{const v=save(emptyLibrary(),1),copy=structuredClone(v);for(const op of [{kind:'purge-item',id:'custom-1'},{kind:'purge-item',id:'custom-none'},{kind:'purge-item',id:'custom-1',all:true}])assert.throws(()=>mutateLibrary(v,op));assert.deepEqual(v,copy);});
test('0411 purge uses repository backup and stale confirmation cannot delete restored item',()=>{
 const dir=mkdtempSync(join(tmpdir(),'prelude-0411-library-'));try{const r=new LibraryRepository(dir);let v=r.write(0,{kind:'save',label:'合成',snippet:'合成正文'}).value,id=v.items[0].id;v=r.write(v.revision,{kind:'remove',id}).value;const captured=v.revision;v=r.write(v.revision,{kind:'restore-item',id}).value;assert.throws(()=>r.write(captured,{kind:'purge-item',id}),e=>e.code==='CONFLICT');assert.equal(r.read().value.items.length,1);v=r.write(v.revision,{kind:'remove',id}).value;const bytes=readFileSync(r.path);r.write(v.revision,{kind:'purge-item',id});assert.deepEqual(readFileSync(r.path+'.bak1'),bytes);assert.equal(r.read().value.items.length,0);}finally{rmSync(dir,{recursive:true});}
});
test('0411 merge over capacity is atomic; old export needs explicit import to return purged item',()=>{let v=emptyLibrary();for(let i=0;i<200;i++)v=save(v,i);const exported=exportLibrary(v);assert.throws(()=>mutateLibrary(v,{kind:'import',raw:exportLibrary(save(emptyLibrary(),201)),conflicts:'keep-both'}),e=>e.code==='CAPACITY');v=mutateLibrary(v,{kind:'remove',id:'custom-0'});v=mutateLibrary(v,{kind:'purge-item',id:'custom-0'});assert.equal(v.items.length,199);v=mutateLibrary(v,{kind:'import',raw:exported,conflicts:'keep-both'});assert.equal(v.items.length,200);});
test('0411 capacity rejection is writable only after own flight ends',async()=>{
 const c=new LibraryController({fetcher:async()=>Response.json({ok:false,code:'CAPACITY',error:'full'},{status:409})});c.publish({state:'ready',value:emptyLibrary(),writable:true});const observations=[];c.subscribe(()=>{if(c.state.writable)observations.push(c.writeFlight);});await assert.rejects(()=>c.mutate({kind:'save',label:'合成',snippet:'合成正文'}));assert.deepEqual(observations,[null]);assert.equal(c.state.writable,true);c.dispose();
});
test('0411 unknown write and disposal do not acquire writable state',async()=>{
 for(const mode of ['transport','unknown','dispose']){let release;const c=new LibraryController({fetcher:()=>new Promise(r=>release=r)});c.publish({state:'ready',value:emptyLibrary(),writable:true});const p=c.mutate({kind:'save',label:'合成',snippet:'合成正文'});const caught=assert.rejects(p);if(mode==='dispose')c.dispose();release(mode==='dispose'?Response.json({ok:false,code:'CAPACITY',error:'full'}):Response.json({ok:false,error:'unknown'}));await caught;assert.equal(c.state.writable,false);assert.equal(c.writeFlight,null);c.dispose();}
});
