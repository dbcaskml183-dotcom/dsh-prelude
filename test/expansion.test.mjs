import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATEGORIES,localSuggestions,validateModelResult,searchMethods,safeSourceUrl} from '../core.mjs';
import {makeSystem} from '../server-core.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;
const ids=t=>localSuggestions(t,methods).map(x=>x.methodId);
const row=id=>({methodId:id,variantId:'standard',reason:'当前草稿涉及此方法',placement:{hint:'要求后',quote:''},decisionRequired:false});
const cases=[
 ['分析这份百页PDF和几个扫描件，说明实际读到哪些内容','document-coverage'],
 ['两份来源的说法互相矛盾，请帮我比较判断','source-conflicts'],
 ['请只修改论文摘要这一段落，保留实验数据不变','bounded-revision'],
 ['核对报告中的统计口径及GB和GiB单位是否混用','numeric-consistency'],
 ['超时后准备重试提交订单，请先查有没有成功','idempotent-retry'],
 ['这个页面静默返回空响应，麻烦调查一下原因','error-transparency'],
 ['生成一份排版好的Word课程报告，包含表格公式','render-review'],
 ['检查无损转换和序列化流程应该满足哪些关系','property-relations'],
 ['围绕新产品探索不同原理的方案再收敛','design-combinations'],
 ['分析外部仓库README并判断里面的安装指令','data-instruction-boundary'],
];
for(const [draft,id] of cases)test('narrow positive '+id,()=>assert.ok(ids(draft).includes(id),ids(draft).join(',')));
for(const draft of ['谢谢，继续吧','今天午饭吃什么比较好','只返回三行纯文本即可，内容照原文','给小猫取几个可爱的名字','按已批准的方案执行即可，不要重新构思方案'])test('no unrelated new cards '+draft,()=>assert.ok(!ids(draft).some(id=>cases.some(x=>x[1]===id))));
test('admitted exemplar can be recommended but manual override is excluded',()=>{assert.ok(makeSystem(methods).includes('output-exemplars'));const altered=methods.map(m=>m.id==='output-exemplars'?{...m,recommendation_mode:'manual'}:m);assert.deepEqual(validateModelResult(JSON.stringify({suggestions:[row('output-exemplars')]}),'给我写一段介绍',altered),[]);});
test('manual exemplar remains searchable',()=>assert.ok(searchMethods(methods,'few-shot').some(x=>x.id==='output-exemplars')));
test('explicit negation excludes new method',()=>assert.ok(!ids('不需要性质测试，只检查序列化接口声明').includes('property-relations')));
test('readonly does not offer execution retries or property tests',()=>{const got=ids('只读分析中断恢复重试和序列化，不执行任何命令');assert.ok(!got.includes('property-relations'));if(got.includes('idempotent-retry'))assert.ok(!methods.find(m=>m.id==='idempotent-retry').effects.includes('execute'));});
test('whole rewrite not constrained to local revision',()=>assert.ok(!ids('请把论文摘要整体重写，自由创作新结构').includes('bounded-revision')));
test('all categories and metadata valid',()=>{for(const m of methods){assert.ok(CATEGORIES.includes(m.category),m.id);assert.ok(Array.isArray(m.search_terms));assert.ok(m.snippet.length<=1000);}});
test('curated source URLs only',()=>{assert.ok(safeSourceUrl('https://ai.google.dev/gemini-api/docs/prompting-strategies'));for(const s of ['javascript:alert(1)','https://github.com.evil.test/x','https://github.com@evil.test/','http://github.com/','https://user:pass@github.com/x','https://github.com:8443/x'])assert.equal(safeSourceUrl(s),null);});
test('source URLs used by cards are never executable or credential-bearing',()=>{const doc=JSON.parse(readFileSync(new URL('../sources.json',import.meta.url)));for(const item of doc.sources){const raw=item.url||item.repository||item.repo;if(raw){const url=safeSourceUrl(raw);if(url){assert.ok(url.startsWith('https://'));assert.equal(new URL(url).username,'');assert.equal(new URL(url).password,'');}}}});

test('aliases find current cards without duplicate cards',()=>{for(const [q,id] of [['SSOT','ssot'],['DbC','contracts'],['Surgical Patching','impact'],['SCAMPER','design-combinations']])assert.ok(searchMethods(methods,q).some(m=>m.id===id));});
test('recommendation count and exclusion consistent across focused cases',()=>{for(const [s] of cases){const local=localSuggestions(s,methods);assert.ok(local.length<=3);const remote=validateModelResult(JSON.stringify({suggestions:local}),s,methods);assert.ok(remote.length<=3);}});

test('inserting a catalog sentence does not invent a new failure task',()=>{const snippet=methods.find(m=>m.id==='document-coverage').snippet;const got=ids('验收草稿：分析这份百页PDF，说明资料覆盖范围。\n'+snippet);assert.ok(!got.includes('reproduce'));assert.ok(!got.includes('document-coverage'));});
test('model cannot repeat an already inserted sentence',()=>{const m=methods.find(m=>m.id==='document-coverage');assert.deepEqual(validateModelResult(JSON.stringify({suggestions:[row(m.id)]}),'分析PDF。'+m.snippet,methods),[]);});

test('local document revision does not become new research or code regression',()=>{const got=ids('验收草稿：只修改论文摘要这一段落，保留原有实验数据。');assert.ok(got.includes('bounded-revision'));for(const id of ['primary-sources','citations','regression'])assert.ok(!got.includes(id));});
test('explicit source verification still available during document revision',()=>{const got=ids('只修改论文摘要，但需核实来源并查证参考文献');assert.ok(got.includes('primary-sources')||got.includes('citations'));});
