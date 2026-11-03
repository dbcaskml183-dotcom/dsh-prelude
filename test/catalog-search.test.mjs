import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchMethods,safeSourceUrl,localSuggestions,excluded} from '../core.mjs';
import {matchesSearch,cardTitle,methodSearchText} from '../shared/catalog-search.mjs';
import {makeSystem} from '../server-core.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods;
const sources=JSON.parse(readFileSync(new URL('../sources.json',import.meta.url))).sources;
const previous=JSON.parse(readFileSync(new URL('./fixtures/previous-methods.json',import.meta.url))).methods;
const find=(q,c='全部',f=null)=>searchMethods(methods,q,c,f,sources).map(m=>m.id);
const by=id=>methods.find(m=>m.id===id);

test('old 50 cards preserve identifiers, actionable wording, and ordering',()=>{
 for(let i=0;i<50;i++)for(const key of ['id','snippet','generic_snippet','category'])assert.deepEqual(methods[i][key],previous[i][key]);
});
test('unified catalog includes every admitted card and its technical name',()=>{
 const prompt=makeSystem(methods);for(const m of methods){assert.ok(prompt.includes('["'+m.id+'",'));assert.ok(prompt.includes(m.technical_name));assert.ok(prompt.includes(m.generic_snippet));}
});
test('manual means user-selectable, not an absolute prohibition',()=>{
 const m=by('second-order');assert.equal(excluded({...m,recommendation_mode:'manual'},'分析方案',methods),true);
 assert.equal(excluded({...m,recommendation_mode:'auto'},'比较扩容方案的后续影响',methods),false);
 assert.equal(excluded({...by('retrieval-practice'),recommendation_mode:'auto'},'不要问我问题',methods),true);
});
test('second-order is not a renamed option-comparison card',()=>{
 assert.ok(find('二阶思维').includes('second-order'));
 assert.ok(!find('二阶思维').includes('tradeoffs'));
 assert.ok(by('second-order').snippet.includes('反馈和延迟'));
 assert.ok(!by('second-order').snippet.includes('展示完整思维链'));
});
for(const [query,id] of [['连锁','second-order'],['临界','sensitivity'],['先核对数据来源','data-profile'],['不直接当错误删除','data-profile'],['不无限推演','second-order'],['英国政府','second-order'],['ＴＤＤ','tdd'],['ｍｖｐ','mvp'],['mVp','mvp'],['Second-order','second-order'],['说明书 支持','patent-support'],['字段 否定','structured-extraction']])
 test('literal full-card search: '+query,()=>assert.ok(find(query).includes(id)));
test('filters intersect the full-content search instead of disappearing',()=>{
 assert.deepEqual(find('二阶','设计',['second-order']),['second-order']);
 assert.deepEqual(find('二阶','编程',['second-order']),[]);
 assert.deepEqual(find('二阶','设计',[]),[]);
});
test('query is literal text, not a regular expression or a markup command',()=>{
 for(const q of ['.*','[a-z]+','<script>','(?=)'])assert.deepEqual(find(q),[]);
 assert.ok(matchesSearch('已存 🧠𠮷 的原文','🧠𠮷'));
 assert.equal(matchesSearch('Alpha beta','ALPHA　ＢＥＴＡ'),true);
 assert.equal(matchesSearch('alpha only','alpha absent'),false);
});
test('empty and whitespace query retain catalog order without mutations',()=>{
 const before=JSON.stringify(methods);assert.deepEqual(find('　 \n'),methods.map(m=>m.id));assert.equal(JSON.stringify(methods),before);
});

test('all query terms in a title rank first, while full-card matches retain their original order',()=>{
 const catalog=Object.freeze([
  {id:'body-first',label:'计划',snippet:'alpha beta'},
  {id:'partial-title',label:'Alpha',snippet:'beta'},
  {id:'technical-title',label:'专业方法',technical_name:'ＡＬＰＨＡ Beta',snippet:'其他内容'},
  {id:'label-title',label:'alpha beta',snippet:'其他内容'},
  {id:'body-last',label:'结果',snippet:'beta alpha'},
  {id:'missing-term',label:'Alpha',snippet:'其他内容'}
 ].map(m=>Object.freeze({...m,category:'设计',domains:['任务规划']})));
 const before=JSON.stringify(catalog),ids=(query,category='全部',favorites=null,domain='全部')=>searchMethods(catalog,query,category,favorites,[],domain).map(m=>m.id);
 assert.deepEqual(ids('alpha beta'),['technical-title','label-title','body-first','partial-title','body-last']);
 assert.deepEqual(ids('alpha beta','设计',['body-last','technical-title','body-first'],'任务规划'),['technical-title','body-first','body-last']);
 assert.deepEqual(ids('alpha beta','编程'),[]);assert.deepEqual(ids('alpha beta','全部',null,'数据分析'),[]);
 assert.deepEqual(ids('　 \n'),catalog.map(m=>m.id));assert.equal(JSON.stringify(catalog),before);
});
test('hidden internal notes and example fields do not cause unexplained hits',()=>{
 const m={id:'synthetic',label:'可见名称',snippet:'可见补句',review_note:'内部唯一审计词',negative_example:'内部反例'};
 assert.equal(methodSearchText(m).includes('内部'),false);
 assert.deepEqual(searchMethods([m],'内部'),[]);
});
test('custom personal cards use label as title and the same search semantics',()=>{
 const m={id:'custom-fixture',label:'实验对照',snippet:'保留阴性结果，区分未测与没有。'};
 assert.equal(cardTitle(m),'实验对照');assert.equal(matchesSearch([m.label,m.snippet].join(' '),'对照 未测'),true);
});
test('every linked method source is an approved HTTPS page',()=>{
 for(const m of methods)for(const id of m.reference_sources){const s=sources.find(s=>s.id===id);assert.ok(s,id);if(s.url)assert.ok(safeSourceUrl(s.url),id);}
 for(const u of ['https://www.w3.org.evil.invalid/WAI/','https://www.w3.org@evil.invalid/','http://www.w3.org/','https://user:pass@www.w3.org/','https://www.w3.org:444/'])assert.equal(safeSourceUrl(u),null);
});
for(const m of methods)test('all meaningful characters and word fragments are searchable: '+m.id,()=>{
 for(const field of ['label','technical_name','plain_explanation','snippet','generic_snippet','when_to_suggest','when_not_to_suggest','placement_hint','domain']){
  const text=m[field]||'';
  // All individual Unicode letters/numbers, plus all contiguous word groups.
  const tokens=new Set([...text].filter(ch=>/[\p{L}\p{N}]/u.test(ch)).concat(text.match(/[\p{L}\p{N}]+/gu)||[]));
  for(const token of tokens)assert.ok(matchesSearch(methodSearchText(m,sources),token),`${m.id}/${field}/${token}`);
 }
 assert.ok(find(m.technical_name).includes(m.id));
});
test('each new card is complete, bounded and tied to read primary sources',()=>{
 for(const m of methods.slice(50)){
  assert.ok(m.snippet.length<=800);assert.equal(m.generic_snippet,m.snippet);
  assert.ok(m.positive_example&&m.negative_example&&m.effects);
  assert.ok(m.reference_sources.some(id=>sources.find(s=>s.id===id)?.read_scope));
 }
});
