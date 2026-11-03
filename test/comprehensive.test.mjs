import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {localSuggestions,validateModelResult,searchMethods,excluded,safeSourceUrl} from '../core.mjs';
import {modelCatalog,validateCatalog,DOMAINS,methodForVariant} from '../shared/catalog-registry.mjs';
import {bundlePreview} from '../shared/bundles.mjs';
import {makeSystem} from '../host/service.mjs';
const methods=JSON.parse(fs.readFileSync(new URL('../methods.json',import.meta.url))).methods;
const sources=JSON.parse(fs.readFileSync(new URL('../sources.json',import.meta.url))).sources;
const bundles=JSON.parse(fs.readFileSync(new URL('../bundles.json',import.meta.url))).bundles;
const by=id=>methods.find(m=>m.id===id),ids=draft=>localSuggestions(draft,methods).map(x=>x.methodId);
const row=id=>({methodId:id,variantId:'standard',reason:'这是合成目录验收',placement:{hint:'任务要求后',quote:''}});
test('one catalog validates and exposes all ninety technical identities',()=>{
 assert.equal(validateCatalog(methods,sources),true);const directory=modelCatalog(methods);
 assert.equal(directory.length,90);assert.deepEqual(directory.map(m=>m[0]),methods.map(m=>m.id));
 for(const m of methods){assert.equal(directory.find(x=>x[0]===m.id)[1],m.technical_name);assert.equal(directory.find(x=>x[0]===m.id)[2],m.generic_snippet);assert.ok(searchMethods(methods,m.technical_name).some(x=>x.id===m.id));}
 assert.ok(Buffer.byteLength(makeSystem(methods))<40000);
});
test('maximum bounded request fits the existing byte budget',()=>assert.ok(Buffer.byteLength(makeSystem(methods)+'汉'.repeat(10000))+2048<80000));
for(const m of methods.slice(66)){
 test('new route positive '+m.id,()=>assert.ok(ids(m.positive_example).includes(m.id),JSON.stringify(ids(m.positive_example))));
 test('new route quoted text is not authority '+m.id,()=>assert.ok(!ids('请原样保存下面引文：\n> '+m.positive_example).includes(m.id)));
 test('new route explicit negation '+m.id,()=>assert.ok(!ids('不要使用'+m.technical_name.split(' / ')[0]+'。'+m.positive_example).includes(m.id)));
 test('new card wording already present '+m.id,()=>assert.deepEqual(validateModelResult(JSON.stringify({suggestions:[row(m.id)]}),m.positive_example+'\n'+m.snippet,methods),[]));
 test('new card source and boundary complete '+m.id,()=>{assert.ok(m.reference_sources.every(id=>sources.find(s=>s.id===id)?.read_scope));assert.ok(m.when_not_to_suggest.length>=15);assert.ok(m.capability_note);});
}
for(const m of methods.slice(50,66))test('former manual can be selected by model without losing constraint filter '+m.id,()=>{
 assert.equal(m.recommendation_mode,'auto');assert.ok(modelCatalog(methods).some(x=>x[0]===m.id));
 assert.equal(excluded(m,{draft:'请按实际材料分析此任务',context:'不要问我问题'},methods),m.effects.includes('ask'));
});
for(const domain of DOMAINS)test('domain discovery intersects stage and favorites '+domain,()=>{
 const all=searchMethods(methods,'','全部',null,sources,domain);assert.ok(all.length);
 assert.ok(all.every(m=>m.domains.includes(domain)));
 assert.deepEqual(searchMethods(methods,'','全部',[],sources,domain),[]);
 const one=all[0];assert.deepEqual(searchMethods(methods,one.technical_name,one.category,[one.id],sources,domain).map(m=>m.id),[one.id]);
});
test('SSOT has precise identity and is not just handoff',()=>{const got=searchMethods(methods,'SSOT').map(m=>m.id);assert.ok(got.includes('ssot'));assert.ok(!got.includes('handoff'));});
for(const [q,id] of [['MECE','mece'],['ADR','adr'],['BLUF','plain-language'],['费曼','plain-language'],['钢人','adversarial'],['输出契约','contracts']])test('new terminology search '+q,()=>assert.ok(searchMethods(methods,q).some(m=>m.id===id)));
for(const m of methods.filter(m=>m.variants))for(const v of m.variants)test('variant stays searchable and cannot cause repeat '+m.id+'/'+v.id,()=>{
 assert.ok(searchMethods(methods,v.label).some(x=>x.id===m.id));assert.ok(searchMethods(methods,v.snippet.slice(5,12)).some(x=>x.id===m.id));
 assert.equal(excluded(methodForVariant(m,v.id),'完善任务。'+v.snippet,methods),true);
});
for(const bundle of bundles)test('bundle is only an explicit bounded ID preview '+bundle.id,()=>{
 assert.equal(new Set(bundle.methodIds).size,bundle.methodIds.length);assert.ok(bundle.methodIds.length<=3);
 const request={draft:'当前有一项需要完成的工作，请保持原要求。'};
 const selected=bundle.methodIds.filter(id=>!excluded({...by(id),recommendation_mode:'auto'},request,methods));
 const preview=bundlePreview(bundle,selected,methods,request);assert.ok(preview.ok);assert.equal(preview.text,selected.map(id=>by(id).generic_snippet).join('\n'));
 assert.equal(bundlePreview(bundle,[],methods,request).ok,false);
 assert.equal(bundlePreview(bundle,['nonexistent'],methods,request).ok,false);
 const subset=selected.slice(0,1);assert.equal(bundlePreview(bundle,subset,methods,request).text,by(subset[0]).generic_snippet);
});
test('bundle respects readonly/no-question authority and inserted wording',()=>{
 const bundle=bundles.find(x=>x.id==='debug');assert.equal(bundlePreview(bundle,bundle.methodIds,methods,{draft:'只读调查，不执行测试。'}).ok,false);
 assert.equal(bundlePreview(bundle,['reproduce'],methods,{draft:by('reproduce').snippet}).ok,false);
});
test('interrupt session is not an embedded task and no quoted ISR route',()=>{
 for(const t of ['中断正在运行的会话，但保留其记录。','解释引文中的词："写一个中断驱动"。','不要局部修改，先分析整体结构。']){
  const got=ids(t);assert.ok(got.length<=3);assert.ok(!got.some(id=>/isr|embedded/.test(id)));
 }
});
test('source links are approved HTTPS and methods never execute them',()=>{for(const s of sources)if(s.url)assert.ok(safeSourceUrl(s.url),s.id);});
test('variant changes the heading, exact wording and duplicate check together',()=>{
 const m=by('plain-language'),bluf=methodForVariant(m,'bluf'),feynman=methodForVariant(m,'feynman');
 assert.equal(bluf.technical_name,'BLUF / 结论先行');assert.ok(bluf.snippet.startsWith('先给出直接结论'));
 assert.equal(excluded(bluf,'整理报告。'+bluf.snippet,methods),true);
 assert.equal(excluded(feynman,'整理报告。'+bluf.snippet,methods),false);
 assert.equal(m.variants.length,2);
});
