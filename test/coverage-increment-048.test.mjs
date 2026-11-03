import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coverageOf,methodBlocked} from '../shared/intent.mjs';
import {localSuggestions,methodStatus} from '../shared/method-policy.mjs';
import {methodChoice,composeRequirements} from '../shared/method-selection.mjs';
import {methodForVariant,safeSnippet} from '../shared/catalog-registry.mjs';
import {validateDecision} from '../shared/contracts.mjs';
import {validateModelResult} from '../shared/result-validation.mjs';
import {parseAnalysis,ANALYSIS_PROTOCOL} from '../shared/analysis-contracts.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {rewriteIssues} from '../shared/rewrite-contract.mjs';
import {sourceBlocks} from '../shared/prompt-contract.mjs';
import {makeSystem} from '../host/prompts.mjs';
const methods=JSON.parse(readFileSync(new URL('../methods.json',import.meta.url))).methods,m=id=>methods.find(x=>x.id===id);
const cases=JSON.parse(readFileSync(new URL('./fixtures/coverage-048.json',import.meta.url)));
const req=(draft,extra={})=>({draft,explicitRequirements:'',selectedEvidence:[],...extra});
const raw=rows=>JSON.stringify({kind:'suggestions',suggestions:rows});
const row=(id,draft,quote=safeSnippet(m(id),[]))=>({methodId:id,variantId:'standard',reason:'可用真实动作补强',increment:{sourceBlockId:'draft',sourceQuote:draft.slice(0,100),snippetQuote:quote},placement:{hint:'末尾',quote:''}});
for(const r of cases.rounds)test('original full-loop replay '+r.id,()=>{
 if(r.previousRepeat){assert.equal(coverageOf(m(r.methodId),r.draft).state,'covered');assert.ok(!localSuggestions(req(r.draft),methods).some(s=>s.methodId===r.methodId));
  const decision=validateDecision(raw([row(r.methodId,r.draft)]),req(r.draft),methods);assert.equal(decision.kind,'no_suggestion');assert.match(decision.note,/已体现/u);}
});
for(const method of methods){
 for(const [label,text] of [['verbatim',method.snippet],['generic',safeSnippet(method,[])],['line-breaks',method.snippet.replace(/[，；。]/gu,'$&\r\n  ')],['numbered-layout',method.snippet.replace(/([，；。])(?=.)/gu,'$1\n1. ')]])test('catalog layout invariant '+method.id+' '+label,()=>assert.equal(coverageOf(method,text).state,'covered'));
 for(const [label,text] of [['quote','“'+method.snippet+'”'],['code','```text\n'+method.snippet+'\n```'],['past','上一轮已完成：'+method.snippet],['denied','不要'+method.snippet]])test('data is not a current directive '+method.id+' '+label,()=>assert.notEqual(coverageOf(method,text).state,'covered'));
 for(const [open,close] of [['“','”'],['"','"'],['「','」']])test('multiline quoted example is not current coverage '+method.id+' '+open,()=>{const text=open+method.snippet.replace(/[，；。]/gu,'$&\n')+close;assert.notEqual(coverageOf(method,text).state,'covered');});
 for(const variant of method.variants||[])test('variant boundary '+method.id+'/'+variant.id,()=>{const own=methodForVariant(method,variant.id);assert.equal(coverageOf(own,variant.snippet).state,'covered');assert.notEqual(coverageOf(own,method.snippet).state,'covered');});
}
test('selected guidance does not prove it was written into the draft',()=>{const r=req('请调查订单保存后闪退的问题。',{selectedMethods:[methodChoice(m('reproduce'))]});assert.notEqual(coverageOf(m('reproduce'),r).state,'covered');assert.equal(methodBlocked(m('reproduce'),r,methods),true);});
for(const [open,close] of [['“','”'],['"','"'],['「','」']])test('multiline data is not named method intent '+open,()=>{const d='请解释这份资料中的示例：\n'+open+m('acceptance').snippet.replace('；','；\n')+close;assert.equal(methodBlocked(m('acceptance'),req(d),methods),false);});
test('reference material never proves a user directive',()=>assert.notEqual(coverageOf(m('regression'),req('请看看问题。',{selectedEvidence:[{text:m('regression').snippet,source:'history-assistant'}]})).state,'covered'));
test('partial steps remain partial, not named-method completion',()=>{const r=req('重构订单模块。按职责组织模块，明确接口和依赖方向。');assert.equal(coverageOf(m('cohesion'),r).state,'partial');assert.ok(coverageOf(m('cohesion'),r).missing.some(x=>/连锁/u.test(x)));});
test('a named method is intent, not complete action evidence',()=>{const r=req('请对更新做回归验证。');assert.notEqual(coverageOf(m('regression'),r).state,'covered');assert.equal(methodBlocked(m('regression'),r,methods),true);});
test('changed requirement is re-evaluated rather than permanently hidden',()=>{const full=req(m('cohesion').snippet),changed=req('重新设计模块。请明确接口和依赖方向。');assert.equal(coverageOf(m('cohesion'),full).state,'covered');assert.notEqual(coverageOf(m('cohesion'),changed).state,'covered');assert.ok(localSuggestions(changed,methods).some(s=>s.methodId==='cohesion'));});
test('reversed action order does not count as coverage',()=>assert.notEqual(coverageOf(m('reproduce'),'再据此排查。建立能观察故障的最小反馈入口。先记录症状与触发条件。').state,'covered'));
test('future conditional method is not current completion',()=>assert.notEqual(coverageOf(m('reproduce'),'如果以后需要排查，再'+m('reproduce').snippet).state,'covered'));
test('a negation inside an action is not hidden by a permissive wildcard',()=>assert.notEqual(coverageOf(m('cohesion'),'按职责组织模块，明确接口和依赖方向，减少修改的连锁影响；结构不以当前需求为依据。').state,'covered'));
test('action matching cannot jump across an inline quotation barrier',()=>assert.notEqual(coverageOf(m('cohesion'),'按职责“随意编造”组织模块，明确接口和依赖方向，减少修改的连锁影响；必要结构以当前需求为依据。').state,'covered'));
test('an explicitly bounded short-material task does not require a long-text step',()=>{const d='仅根据以下两条短资料写说明。关键说法对应可核实的来源与定位；核对支持与反对证据；缺口明示，不补造引用或实测结果。';const c=coverageOf(m('citations'),d);assert.equal(c.state,'covered');assert.equal(c.actions.find(a=>a.id==='long-text').notApplicable,true);assert.notEqual(coverageOf(m('citations'),d.replace('仅根据以下两条短资料','根据完整附件')).state,'covered');});
test('a current prohibition wins over coverage and an explicit click',()=>{const r=req('本轮只读调查，不运行测试。'+m('regression').snippet);assert.equal(methodStatus(m('regression'),r,methods).restricted,true);assert.equal(composeRequirements(r,[methodChoice(m('regression'))],methods).valid,false);});
test('confirmed covered choice is retained and remains valid on the wire',()=>{const r=req(m('reproduce').snippet),choice=methodChoice(m('reproduce')),c=composeRequirements(r,[choice],methods);assert.equal(c.valid,true);assert.equal(c.included.length,1);assert.equal(c.redundant.length,1);const parsed=parseAnalysis({...r,protocolVersion:ANALYSIS_PROTOCOL,expectedRulesHash:RULES_HASH,requestId:'coverage-wire-048',reviewMode:'auto',target:{mode:'generic'},selectedMethods:[choice]},{methods});assert.deepEqual(parsed.selectedMethods,[choice]);});
test('missing increment is uncertainty rather than a false no-suggestion pass',()=>{const v=validateDecision(raw([{methodId:'cohesion',variantId:'standard',reason:'相关',placement:{hint:'末尾',quote:''}}]),req('请设计订单和支付的代码模块。'),methods);assert.equal(v.kind,'uncertain');});
test('one bad increment does not discard a different valid suggestion',()=>{const draft='请设计订单和支付的代码模块。',a=row('cohesion',draft),b=row('evidence',draft);b.increment.snippetQuote='不在目录中的新增授权';const v=validateDecision(raw([a,b]),req(draft),methods);assert.deepEqual(v.suggestions.map(x=>x.methodId),['cohesion']);});
test('source anchor must be in the claimed real block',()=>{const draft='请设计订单模块。',r=row('cohesion',draft);r.increment.sourceQuote='编造的原文';assert.equal(validateDecision(raw([r]),req(draft),methods).kind,'uncertain');});
test('the method cannot ground itself as task evidence',()=>{const draft='请设计订单模块。',r=row('cohesion',draft);r.increment.sourceBlockId='method-0';r.increment.sourceQuote=m('cohesion').snippet;assert.equal(validateDecision(raw([r]),req(draft,{selectedMethods:[methodChoice(m('cohesion'))]}),methods).kind,'uncertain');});
test('an already covered action cannot be proposed as the remaining increment',()=>{const draft='请设计订单模块，按职责组织模块。',r=row('cohesion',draft,'按职责组织模块');assert.equal(validateDecision(raw([r]),req(draft),methods).kind,'uncertain');});
test('only a missing action from the actual snippet can be proposed',()=>{const draft='请设计订单模块，按职责组织模块。',r=row('cohesion',draft,'明确接口和依赖方向');const v=validateDecision(raw([r]),req(draft),methods);assert.equal(v.suggestions.length,1);assert.equal(v.suggestions[0].genericText,true);assert.match(v.suggestions[0].reason,/明确接口和依赖方向/u);});
test('generic skill text is the literal text on which recommendations are based',()=>{const draft='请实现订单代码。',r=row('ponytail',draft);const v=validateModelResult(JSON.stringify({suggestions:[r]}),req(draft),methods);assert.equal(v.length,1);assert.ok(!v[0].increment.snippetQuote.includes('使用ponytail'));});
test('source method identity is preserved without inferring permission',()=>{const c=methodChoice(m('first-principles')),b=sourceBlocks(req('重新思考方案。',{selectedMethods:[c]})).find(x=>x.kind==='user-method');assert.equal(b.methodId,c.id);assert.equal(b.label,c.label);assert.equal(b.variant,c.variant);});
for(const text of ['复核仅覆盖单机条件。','覆盖范围仅为单机条件。'])test('coverage wording is not overwrite '+text,()=>assert.ok(!rewriteIssues(req('请核对资料。'),text).some(x=>x==='新增操作：覆盖')));
for(const text of ['覆盖检查范围内的配置文件。','覆盖范围内的所有文件。','覆盖单机条件中的数据库。','覆盖现有数据。'])test('real overwrite remains protected '+text,()=>assert.ok(rewriteIssues(req('请核对资料。'),text).some(x=>x==='新增操作：覆盖')));
test('actual model catalog does not increase suggest system bytes',()=>assert.ok(Buffer.byteLength(makeSystem(methods))<=34133));
test('old AI7 is refused before a model call',()=>assert.throws(()=>parseAnalysis({protocolVersion:7}),{code:'PROTOCOL'}));

test('ordinary grounding wording remains the same second-order action',()=>assert.equal(coverageOf(m('second-order'),'请先说明直接结果，再梳理随后可能引发的连锁影响、反馈和延迟；区分有依据的后果与待验证的推测，优先指出会改变决策的风险和观察信号，避免无限推演。').state,'covered'));
test('ordinary coupled-change wording remains the same cohesion action',()=>assert.equal(coverageOf(m('cohesion'),'按职责划分模块，明确接口和依赖方向；必要结构以当前需求为依据，以减少后续修改时相互牵连。').state,'covered'));
for(const source of ['给出可核对的来源','提供可核实的出处','给出验证入口'])test('source or verification entrance is a real alternative '+source,()=>assert.equal(coverageOf(m('evidence'),'把关键结论区分为实测、引用、推断和未取证，并'+source+'。').state,'covered'));
test('an evidence condition before no-fabricated-scores is not its negation',()=>assert.equal(coverageOf(m('tradeoffs'),'比较本机部署和云端部署两条路线，必要时包含维持现状；说明主要代价、后续影响，以及什么条件会改变推荐；没有依据不要编造评分。').state,'covered'));
for(const [id,text] of [['first-principles',m('first-principles').snippet.replace('区分','不区分')],['cohesion',m('cohesion').snippet.replace('组织','不组织')],['evidence','把关键结论区分为实测、引用、推断和未取证，并不给出可核对的来源。']])test('bare action negation is not current coverage '+id,()=>assert.notEqual(coverageOf(m(id),text).state,'covered'));
test('different objects and unverified states are not action negations',()=>assert.equal(coverageOf(m('acceptance'),'请明确不同模块可核对的完成标准；收尾时逐项说明证据和仍未验证的部分。').state,'covered'));
test('leading conjunction does not lose an unchanged avoid requirement',()=>{const r=req('请分析通知方案。',{selectedMethods:[methodChoice(m('second-order'))]});assert.deepEqual(rewriteIssues(r,'请分析通知方案。'+m('second-order').snippet.replace('避免无限推演','并避免无限推演')),[]);});
for(const tail of ['并不要无限推演','先完成审批并避免无限推演','“并避免无限推演”'])test('conjunction normalization never erases modality or conditions '+tail,()=>{const r=req('请分析通知方案。',{selectedMethods:[methodChoice(m('second-order'))]});assert.ok(rewriteIssues(r,'请分析通知方案。'+m('second-order').snippet.replace('避免无限推演',tail)).some(x=>x.includes('避免无限推演')));});
test('a noun beginning with a conjunction character is not rewritten',()=>assert.ok(rewriteIssues(req('并列文件不得删除。'),'列文件不得删除。').length));
test('a leading conjunction never replaces a whole permission precondition',()=>assert.ok(rewriteIssues(req('未经批准，不得联网。'),'并不得联网。').length));

// Final real-host samples: bounded wording variants must not trigger a duplicate card.
for(const [id,text] of [
 ['regression','笔记同步丢字已修复。请先重跑原丢字故障或目标同步行为，确认修复生效，再按影响范围做相邻功能回归；若通过且无新疑点即可收口。'],
 ['citations','仅根据以下两条短资料写技术说明。关键技术说法须对应可核实的来源与定位；如需引用长文，先找到相关短原文再判断，并核对支持与反对证据。资料缺口要明示，不补造引用或实测结果。']
]) {
 test('real-host ordinary wording is fully covered '+id,()=>{assert.equal(coverageOf(m(id),req(text)).state,'covered');assert.ok(!localSuggestions(req(text),methods).some(s=>s.methodId===id));});
 for(const [label,changed] of [['negated',text.replace(id==='regression'?'重跑':'对应',id==='regression'?'不重跑':'不对应')],['quoted','“'+text+'”'],['past',text.replace(id==='regression'?'请先重跑':'关键技术说法',id==='regression'?'上一轮已完成：先重跑':'上一轮已完成：关键技术说法')]])test('real-host wording guard '+id+' '+label,()=>assert.notEqual(coverageOf(m(id),req(changed)).state,'covered'));
}

for(const prefix of ['内容','报告内容','交接说明','报告的内容','检查说明需要','审查报告应当'])test('document coverage list is not an overwrite '+prefix,()=>assert.ok(!rewriteIssues(req('请整理交接说明。'),prefix+'覆盖：当前目标、约束、产物版本、已测与未测范围、失败反例和下一步。').includes('新增操作：覆盖')));
for(const text of ['内容覆盖：现有数据。','报告内容覆盖：配置文件。','用交接说明覆盖：数据库。','内容覆盖：`/root/config.json`。','用新内容覆盖：原文件。','用报告内容覆盖：已有记录。','报告内容覆盖：目标和范围，然后覆盖数据库。'])test('a document noun does not authorize real overwrites '+text,()=>assert.ok(rewriteIssues(req('请整理交接说明。'),text).includes('新增操作：覆盖')));
test('coverage list does not hide a separate destructive action',()=>assert.ok(rewriteIssues(req('请整理交接说明。'),'内容覆盖：目标和范围，然后删除文件。').includes('新增操作：删除')));

for(const text of ['用检查说明覆盖数据库。','使用交接说明来覆盖数据库。','请用报告内容直接覆盖现有数据。'])test('instrumental document is still an overwrite '+text,()=>assert.ok(rewriteIssues(req('请整理交接说明。'),text).includes('新增操作：覆盖')));
for(const text of ['说明覆盖数据库的风险。','解释为什么覆盖文件有风险。','交接说明覆盖：数据库的职责。'])test('describing an overwrite is not executing it '+text,()=>assert.ok(!rewriteIssues(req('请整理交接说明。'),text).includes('新增操作：覆盖')));

for(const verb of ['不对应的','未对应的'])test('a negative correspondence description is not a positive source requirement '+verb,()=>assert.notEqual(coverageOf(m('citations'),'仅根据以下两条短资料写说明。关键技术说法'+verb+'来源与定位；核对支持与反对证据；缺口明示，不补造引用或实测结果。').state,'covered'));
test('different sources are not a negated correspondence action',()=>assert.equal(coverageOf(m('citations'),'仅根据以下两条短资料写说明。关键技术说法需对应不同来源与定位；核对支持与反对证据；缺口明示，不补造引用或实测结果。').state,'covered'));

// SAME-DRAFT-01: recognize current acceptance requirements, never adoption history.
const acceptanceTail='；收尾时逐项说明证据和仍未验证的部分。';
const acceptanceReal=cases.sameDraft049.actualCandidate;
const acceptanceDefinition='插件更新，以相关功能正常、原有问题未复现为通过标准';
const acceptanceChecks=[
 ['actual production candidate',acceptanceReal,true],
 ['original recognized wording',cases.sameDraft049.counterfactual,true],
 ...['明确','给出','列出','定义'].flatMap(v=>['','可核对的','可验证','可观察的'].map(q=>['positive directive '+v+q,'插件更新，请'+v+q+'通过标准'+acceptanceTail,true])),
 ['bounded definition',acceptanceDefinition+acceptanceTail,true],
 ['no error is a criterion','插件更新，以没有报错、原有功能正常为通过标准'+acceptanceTail,true],
 ['no new error is a criterion','插件更新，以没有新增错误、原有功能正常为通过标准'+acceptanceTail,true],
 ['ASCII letters digits units','插件更新，以CPU峰值低于80%、异常数为0为通过标准'+acceptanceTail,true],
 ['subsequent unrelated unknown','插件更新，以相关功能正常为通过标准，其他项目尚未明确'+acceptanceTail,true],
 ['undefined','插件更新，通过标准尚未确定'+acceptanceTail,false],
 ['merely mentioned','插件更新，文档里提到了通过标准'+acceptanceTail,false],
 ['placeholder','插件更新，以待定为通过标准'+acceptanceTail,false],
 ['not defined','插件更新，以尚未确定为通过标准'+acceptanceTail,false],
 ['deferred','插件更新，以以后再定为通过标准'+acceptanceTail,false],
 ['negated','插件更新，不以相关功能正常为通过标准'+acceptanceTail,false],
 ['negated comma','插件更新，不以相关功能正常、原有问题未复现为通过标准'+acceptanceTail,false],
 ['no-error still prohibited','插件更新，不要以没有报错为通过标准'+acceptanceTail,false],
 ['double negative remains denial','插件更新，以不是没有报错为通过标准'+acceptanceTail,false],
 ['not requested','插件更新，无需明确可核对的通过标准'+acceptanceTail,false],
 ['future condition','如果以后需要更新，再以相关功能正常为通过标准'+acceptanceTail,false],
 ['historical','上一轮已完成：插件更新，以相关功能正常为通过标准'+acceptanceTail,false],
 ['quoted','插件更新，请解释“以相关功能正常为通过标准”'+acceptanceTail,false],
 ['quote barrier','插件更新，以“相关功能正常”为通过标准'+acceptanceTail,false],
 ['code','插件更新，请解释：\n```text\n以相关功能正常为通过标准\n```'+acceptanceTail,false],
 ['missing evidence',acceptanceDefinition+'；收尾时说明仍未验证的部分。',false],
 ['missing unverified',acceptanceDefinition+'；收尾时逐项说明证据。',false]
];
for(const [label,draft,covered] of acceptanceChecks)test('SAME-DRAFT-01 '+label,()=>{
 const r=req(draft),view=coverageOf(m('acceptance'),r);
 assert.equal(view.state==='covered',covered);
 if(covered){assert.ok(!localSuggestions(r,methods).some(x=>x.methodId==='acceptance'));for(const e of view.evidence)assert.equal(r.draft.slice(e.start,e.end),e.quote);}
});
test('SAME-DRAFT-01 six resets do not need a used-method ledger',()=>{for(let i=0;i<6;i++){const r=req(acceptanceReal);assert.equal(coverageOf(m('acceptance'),r).state,'covered');assert.ok(!localSuggestions(r,methods).some(x=>x.methodId==='acceptance'));}});
test('SAME-DRAFT-01 six topic and text changes use current content',()=>{
 const r=req(acceptanceReal),changes=[acceptanceReal,'插件更新，请检查问题。'+acceptanceTail,acceptanceDefinition+acceptanceTail,'插件更新，不以相关功能正常为通过标准'+acceptanceTail,'请写一个窗边下雨的短故事。',acceptanceReal];
 for(const [i,draft] of changes.entries()){r.draft=draft;assert.equal(coverageOf(m('acceptance'),r).state==='covered',[true,false,true,false,false,true][i]);}
});
test('SAME-DRAFT-01 deleting criterion restores eligibility',()=>{const r=req('插件更新，请检查问题。'+acceptanceTail);assert.equal(coverageOf(m('acceptance'),r).state,'partial');assert.ok(localSuggestions(r,methods).some(x=>x.methodId==='acceptance'));});
test('SAME-DRAFT-01 manual requirements are authoritative, references are not',()=>{
 assert.equal(coverageOf(m('acceptance'),req('插件更新，请检查问题。',{explicitRequirements:acceptanceReal})).state,'covered');
 for(const source of ['pasted','history-user','history-assistant','attachment-text'])assert.notEqual(coverageOf(m('acceptance'),req('插件更新，请检查问题。',{selectedEvidence:[{id:'synthetic',source,text:acceptanceReal,label:'合成引用',coverage:'片段'}]})).state,'covered');
});
test('SAME-DRAFT-01 full coverage filters a repeated model suggestion',()=>{const r=req(acceptanceReal),v=validateDecision(raw([row('acceptance',r.draft)]),r,methods);assert.equal(v.kind,'no_suggestion');assert.match(v.note,/已体现/u);});
test('SAME-DRAFT-01 existing criterion alone cannot be proposed as new increment',()=>{const r=req(acceptanceDefinition+'；收尾时说明仍未验证的部分。');assert.equal(validateDecision(raw([row('acceptance',r.draft,'请明确可核对的完成标准')]),r,methods).kind,'uncertain');});
test('SAME-DRAFT-01 missing evidence stays a valid real increment',()=>{const r=req(acceptanceDefinition+'；收尾时说明仍未验证的部分。');assert.equal(validateDecision(raw([row('acceptance',r.draft,'收尾时逐项说明证据')]),r,methods).kind,'suggestions');});
test('SAME-DRAFT-01 explicit covered choice remains valid and marked redundant',()=>{const r=req(acceptanceReal),c=composeRequirements(r,[methodChoice(m('acceptance'))],methods);assert.equal(c.valid,true);assert.equal(c.redundant.length,1);assert.equal(c.included.length,1);});
test('SAME-DRAFT-01 standard does not satisfy the rubric variant',()=>assert.notEqual(coverageOf(methodForVariant(m('acceptance'),'rubric'),req(acceptanceReal)).state,'covered'));
test('SAME-DRAFT-01 well formed unicode layout does not lose exact offsets',()=>{const d='🧪\n'+acceptanceReal.replace(/，/gu,'，\n');const c=coverageOf(m('acceptance'),req(d));assert.equal(c.state,'covered');for(const e of c.evidence)assert.equal(d.slice(e.start,e.end),e.quote);});
test('SAME-DRAFT-01 no catalog guidance can establish coverage by selection alone',()=>assert.notEqual(coverageOf(m('acceptance'),req('插件更新，请检查问题。',{selectedMethods:[methodChoice(m('acceptance'))]})).state,'covered'));

for(const value of ['以以后再定为通过标准','以后再定为通过标准','以此以后再定为通过标准','将来再定为通过标准'])test('SAME-DRAFT-01 no internal restart '+value,()=>assert.notEqual(coverageOf(m('acceptance'),req('插件更新，'+value+acceptanceTail)).state,'covered'));
for(const prefix of ['请以','并以','并且以','本轮以','要求以','把','将'])test('SAME-DRAFT-01 clause directive '+prefix,()=>assert.equal(coverageOf(m('acceptance'),req('插件更新，'+prefix+'相关功能正常为通过标准'+acceptanceTail)).state,'covered'));

for(const prior of ['没有要求做额外测试','不要扩大检查范围','其他部分尚未明确'])test('SAME-DRAFT-01 prior clause does not negate the criterion '+prior,()=>{const d='插件更新，'+prior+'，以相关功能正常为通过标准'+acceptanceTail;assert.equal(coverageOf(m('acceptance'),req(d)).state,'covered');});

for(const d of ['请检查是否已明确可核对的通过标准','请解释为什么要给出可核对的通过标准','请比较是否已经列出通过标准','请说明怎样定义通过标准'])test('SAME-DRAFT-01 question or explanation is not a current directive '+d,()=>assert.notEqual(coverageOf(m('acceptance'),req('插件更新，'+d+acceptanceTail)).state,'covered'));
for(const d of ['请先明确通过标准','先给出可核对的通过标准','本轮请定义可验证的通过标准','然后列出通过标准'])test('SAME-DRAFT-01 affirmative directive '+d,()=>assert.equal(coverageOf(m('acceptance'),req('插件更新，'+d+acceptanceTail)).state,'covered'));

// 0.4.13: a material-coverage section title is not an overwrite instruction.
for(const title of ['材料范围与覆盖说明','资料范围及覆盖说明','证据范围和覆盖说明','材料覆盖说明','资料覆盖说明：','证据覆盖说明',
 '二、材料范围与覆盖说明','2. 材料范围与覆盖说明','3) 资料覆盖说明','## 二、材料范围与覆盖说明','### 2. 证据覆盖说明'])test('0413 material coverage title '+title,()=>assert.deepEqual(rewriteIssues(req('请核对材料。'),title+'\n请核对材料。'),[]));
for(const text of ['覆盖说明文件。','覆盖说明.md。','覆盖说明中的配置文件。','覆盖说明数据库。','覆盖说明：现有数据。',
 '材料范围与覆盖说明文件。','材料覆盖说明中的旧数据。','用材料覆盖说明。','用材料覆盖说明文件。','把材料覆盖说明。',
 '二、材料范围与覆盖说明\n覆盖配置文件。','二、材料范围与覆盖说明，覆盖数据库。','材料覆盖说明；覆盖记录。',
 '材料覆盖说明：`/root/config.json`。','材料覆盖说明 /root/config.json。'])test('0413 title cannot authorize overwrite '+text,()=>assert.ok(rewriteIssues(req('请核对材料。'),text).includes('新增操作：覆盖')));
for(const title of ['材料覆盖说明','二、材料范围与覆盖说明'])test('0413 title cannot hide deletion '+title,()=>assert.ok(rewriteIssues(req('请核对材料。'),title+'\n删除所有文件。').includes('新增操作：删除')));
test('0413 real candidate title fixed but execution-to-report scope remains protected',()=>{
 const draft='请核对材料。先明确可核对的完成标准，最后说明实际问题、证据和剩余边界。';
 const candidate='二、材料范围与覆盖说明\n请核对材料。报告先明确可核对的完成标准，最后说明实际问题、证据和剩余边界。';
 const issues=rewriteIssues(req(draft),candidate);
 assert.ok(!issues.includes('新增操作：覆盖'));
 assert.ok(issues.some(x=>x.startsWith('原要求未保留')));
 assert.deepEqual(rewriteIssues(req(draft),candidate.replace('报告先明确','先明确')),[]);
});
for(const prefix of ['报告','报告中','文档里','回答中'])test('0413 report subject must not erase execution order '+prefix,()=>assert.ok(rewriteIssues(req('先备份，再删除文件。'),prefix+'先备份，再删除文件。').some(x=>x.startsWith('原要求未保留'))));


// 0.4.14: complete bare section titles, not scope-trimmed imperative fragments.
for(const title of ['覆盖说明','二、覆盖说明','2. 覆盖说明','## 覆盖说明','### 二、覆盖描述','覆盖情况：','  覆盖说明  '])test('0414 bare coverage heading '+title,()=>assert.deepEqual(rewriteIssues(req('请核对材料。'),title+'\n请核对材料。'),[]));
for(const text of ['然后覆盖说明','用新内容覆盖说明','用新材料，覆盖说明','请覆盖说明','覆盖说明文件','覆盖说明.md','覆盖说明中的配置文件','覆盖描述中的旧数据','覆盖说明：现有数据','覆盖说明 `/root/config.json`','二、覆盖说明\n覆盖配置文件','覆盖说明；覆盖数据库','覆盖说明：然后覆盖文件'])test('0414 bare heading cannot grant overwrite '+text,()=>assert.ok(rewriteIssues(req('请核对材料。'),text).includes('新增操作：覆盖')));
test('0414 bare heading cannot hide an independent deletion',()=>assert.ok(rewriteIssues(req('请核对材料。'),'覆盖说明\n删除所有文件').includes('新增操作：删除')));
