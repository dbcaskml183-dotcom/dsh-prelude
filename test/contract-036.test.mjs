import test from 'node:test';import assert from 'node:assert/strict';
import {validateRewrite,missingProtected,rewriteIssues} from '../shared/rewrite-contract.mjs';
import {createHandler} from '../host/service.mjs';
import {RewriteController} from '../client/rewrite-controller.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
const request=draft=>({draft,explicitRequirements:'',selectedEvidence:[]});
const check=(source,text)=>validateRewrite(JSON.stringify({kind:'rewrite',text,changes:[],uncertainties:[]}),request(source));
const good=[
 ['请分析问题。','修改建议：优先核对接口。'],
 ['请分析"文件可以上传"这个例子。','请解释该示例的含义。'],
 ['Please explain \'do not upload files\' as an example.','Please explain the example.'],
 ['可以列成有等级的问题清单。','问题可以列成有等级的问题清单。'],
 ['可以列成有等级的问题清单。','这些问题可以列成有等级的问题清单。'],
 ['问题可以列成有等级的问题清单。','可以列成有等级的问题清单。'],
 ['建议先审查接口。','接口建议先审查接口。'],
 ['不得上传文件。','文件不得上传文件。'],
 ['文件不得上传。','不允许上传文件。'],
 ['报告可以生成。','可以生成报告。'],
 ['文件可以上传。','可以上传文件。'],
 ['可以上传文件。','文件可以上传。'],
 ['网络可以访问。','可以访问网络。'],
 ['记录不需要保留。','不必保留记录。'],
 ['`/root/a`不得修改。','不得修改`/root/a`。'],
 ['不得修改`/root/a`。','`/root/a`不得修改。'],
 ['config.json不得修改。','不得修改config.json。'],
 ['报告.md不得删除。','不得删除报告.md。'],
 ['请全面检查插件。','请全面检查插件，覆盖检查范围、检查动作和输出产物。'],
 ['请测试插件。','请测试插件，覆盖测试场景及边界分支。'],
 ['请测试插件。','请测试插件，说明测试覆盖率。'],
 ['请分析问题。','请分析问题，给出修改建议。'],
 ['请分析问题。','请分析问题，列出删除文件和重启服务的风险。'],
 ['请分析问题。','请分析问题，提出关于修改代码的建议。']
];
for(const [source,text] of good)test('036 useful wording '+text,()=>{assert.ok(check(source,text));assert.deepEqual(missingProtected(request(source),text),[]);assert.deepEqual(rewriteIssues(request(source),text),[]);});
const bad=[
 ['请检查`/root/db`。','覆盖测试场景中的`/root/db`。'],
 ['请检查`config.json`。','覆盖测试场景中的`config.json`。'],
 ['请检查.env。','覆盖测试场景中的.env。'],
 ['请检查notes.csv。','覆盖检查范围内的notes.csv。'],
 ['请分析问题。','修改建议：删除现有文件。'],
 ['文件不得上传。','"文件不得上传"。请继续。'],
 ['`/root/a`不得修改。','不得修改`/root/b`。'],
 ['`/root/a`不得修改。','`/root/a`不得修改。修改`/root/a`。'],
 ['可以列成有等级的问题清单。','问题必须列成有等级的问题清单。'],
 ['可以列成有等级的问题清单。','问题可以列成有等级的问题清单。问题必须列成有等级的问题清单。'],
 ['可以列成有等级的问题清单。','如果得到批准，问题可以列成有等级的问题清单。'],
 ['可以列成有等级的问题清单。','文档中写着问题可以列成有等级的问题清单。'],
 ['可以列成有等级的问题清单。','示例：问题可以列成有等级的问题清单。'],
 ['可以列成有等级的问题清单。','我否认问题可以列成有等级的问题清单。'],
 ['可以列成有等级的问题清单。','问题不可以列成有等级的问题清单。'],
 ['用户必须支付。','必须支付用户。'],
 ['用户可以上传用户资料。','可以上传用户资料。'],
 ['张三必须通知张三。','必须通知张三。'],
 ['管理员不得删除文件。','不得删除文件。'],
 ['文件可以上传。','可以上传日志。'],
 ['网络可以访问。','可以访问数据库。'],
 ['生产文件不得上传。','临时文件不得上传。'],
 ['生产文件不得上传。','不得上传。'],
 ['文件不得上传。','文件不得上传。上传文件。'],
 ['报告不要生成。','报告不要生成。生成报告。'],
 ['问题可以列清单。','日志可以列清单。'],
 ['如果我确认，问题可以列清单。','问题可以列清单。'],
 ['请全面检查插件。','覆盖配置文件。'],
 ['请全面检查插件。','覆盖检查范围内的配置文件。'],
 ['请全面检查插件。','覆盖测试场景中的数据库。'],
 ['请全面检查插件。','覆盖检查范围，然后覆盖配置文件。'],
 ['请全面检查插件。','给出修改建议，然后修改代码。'],
 ['请分析问题。','给出删除文件的建议，然后删除文件。'],
 ['请分析问题。','提出关于修改代码的建议；覆盖现有代码。'],
 ['不要修改文件。','覆盖检查范围，并修改文件。'],
 ['不要覆盖配置文件。','不要覆盖配置文件。覆盖配置文件。']
];
for(const [source,text] of bad)test('036 real change remains blocked '+text,()=>assert.throws(()=>check(source,text),e=>e.code==='REWRITE_CONSTRAINT'));
test('036 complete real-world prompt shape can be rewritten without upgrading optional issues',()=>{
 const source='"C:\\demo\\prelude-0.3.6" 插件更新了，你继续全方位各角度仔细检查，看看还有没有不合格的地方或者有问题的地方，可以列成有等级的问题清单，有的话落成一份.md文档放到 "C:\\demo\\reports" 里。请明确可核对的完成标准；收尾时逐项说明证据和仍未验证的部分。';
 const candidate='插件已更新。请继续对 "C:\\demo\\prelude-0.3.6" 进行全方位、多角度、仔细的检查，确认是否仍有不合格或有问题的地方。问题可以列成有等级的问题清单；若发现问题，依旧将问题整理成一份 .md 文档，放到 "C:\\demo\\reports" 里。请明确可逐项核对的完成标准，覆盖检查范围、检查动作、输出产物；收尾时逐项说明证据和仍未验证的部分。';
 assert.ok(check(source,candidate));
});

for(const [source,candidate] of good)test('036 service → review → controller → host CAS → undo '+candidate,async()=>{
 let input={draft:source,draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},writes=0,sends=0,calls=0;
 const actions={captureInsertion:()=>({draftRev:input.draftRev}),insertText(text,span){if(span.draftRev!==input.draftRev)return false;input={...input,draft:text,draftRev:input.draftRev+1};writes++;return true;},submit(){sends++;}};
 const current=()=>({sessionId:'synthetic-036',input,actions,requestKey:'route',composing:false});
 const h=createHandler({methods:[],limits:{minIntervalMs:0},budget:{reserve:id=>id,settle(){}},llm:{prepareCall:async config=>({config,async *stream(o){calls++;assert.equal(o.maxTokens,undefined);assert.deepEqual(o.tools,[]);yield {type:'text-delta',text:JSON.stringify(o.system.includes('辅助审校器')?{verdict:'no_issue_found',findings:[],uncertainties:[]}:{kind:'rewrite',text:candidate,changes:[],uncertainties:[]})};yield {type:'finish',reason:{kind:'stop'}};}})}});
 const c=new RewriteController({fetcher:(path,options)=>h.handle(new Request('http://fixture'+path,options),{operation:path.endsWith('/review')?'review':'rewrite'})});
 try{await c.start({protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'auto',target:{mode:'generic'},requestId:crypto.randomUUID(),draft:source,explicitRequirements:'',materials:{attachmentCount:0,referenceCount:0},selectedEvidence:[],route:{provider:'fixture',model:'synthetic'}},current());assert.equal(c.state.phase,'preview');assert.equal(c.state.review.state,'no_issue_found');assert.equal(calls,2);assert.equal(writes,0);assert.equal(c.apply(current()),true);assert.equal(input.draft,candidate);assert.equal(c.undo(current()),true);assert.equal(input.draft,source);assert.equal(writes,2);assert.equal(sends,0);}finally{c.dispose();h.dispose();}
});
