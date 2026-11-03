import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRewrite,protectedFragments} from '../shared/rewrite-contract.mjs';
import {createHandler} from '../host/service.mjs';
import {RULES_HASH} from '../shared/guidance.mjs';
import {RewriteController} from '../client/rewrite-controller.mjs';
const request=draft=>({draft,explicitRequirements:'',selectedEvidence:[]});
const packet=text=>JSON.stringify({kind:'rewrite',text,changes:[],uncertainties:[]});
const reject=(source,candidate,extra={})=>assert.throws(()=>validateRewrite(packet(candidate),{...request(source),...extra}),e=>e.code==='REWRITE_CONSTRAINT');
const negatives=['不调用工具','不读文件','不写文件','不支付费用','不生成报告','不访问网络','不扫描目录','不搜索网页','不下载附件','不请求外部接口','不打开浏览器','不回答原任务'];
for(const prefix of ['', '请您', '麻烦', '劳驾', '请记得', '烦请', '请帮我', '帮我', '您'])for(const action of negatives){
 const source=prefix+action+'。';
 test('033 no deletion of directive '+source,()=>reject(source,'请继续。'));
 test('033 no reversal of directive '+source,()=>reject(source,prefix+action.slice(1)+'。'));
 test('033 original source is usable '+source,()=>assert.equal(validateRewrite(packet(source),request(source)).kind,'unchanged'));
}
for(const source of ['请您不要上传。','麻烦不要上传。','劳驾不要上传。','您不能修改。','请记得不要上传。','请您用中文回答。','麻烦用中文回答。','您必须用中文。','必须先完成验证。','你必须先完成验证。','请您务必记得本轮不要修改文件。']){
 test('033 semantic operators survive prefixes '+source,()=>reject(source,'请继续。'));
 test('033 protected fragments are source slices '+source,()=>assert.ok(protectedFragments(request(source)).every(s=>source.includes(s))));
}
const gates=['先审查再修改。','先验证，然后部署。','任何写入前必须取得我的同意。','未经我的同意，不得写入。','只有我确认后，才能部署。','在备份完成之前，不要更新。','除非我明确批准，否则不要上传。','If I approve, then deploy.','Only after approval, deploy.','先调查再给方案，暂不修改。'];
gates.push('先审查后修改。','备份后才能部署。','在备份成功后再部署。','取得我同意后才可修改文件。','修改前先检查。');
for(const source of gates){
 test('033 gate cannot disappear '+source,()=>reject(source,'请继续。'));
 test('033 gate survives unchanged '+source,()=>assert.equal(validateRewrite(packet(source),request(source)).kind,'unchanged'));
 test('033 gate preservation uses real spans '+source,()=>assert.ok(protectedFragments(request(source)).every(s=>source.includes(s))));
}
for(const [source,candidate] of [
 ['先审查再修改。','先修改再审查。'],['先验证，然后部署。','先验证。部署。'],
 ['任何写入前必须取得我的同意。','必须取得我的同意。'],['未经我的同意，不得写入。','不得写入。'],
 ['只有我确认后，才能部署。','才能部署。'],['在备份完成之前，不要更新。','不要更新。'],
 ['除非我明确批准，否则不要上传。','否则不要上传。'],['If I approve, then deploy.','Then deploy.'],
 ['Only after approval, deploy.','Deploy.'],
 ['不调用工具。','不调用工具。请调用工具。'],['不支付费用。','不支付费用。现在支付费用。'],
 ['不扫描目录。','不扫描目录。直接扫描目录。'],['不生成报告。','不生成报告。但生成报告。'],
 ['请您不要上传文件。','请您不要上传文件。请上传文件。'],
 ['先审查再修改。','先审查再修改。先修改再审查。']
 ,['本轮任务不调用工具。','请继续。'],['这次任务请您不要上传。','请继续。'],
 ['不调用任何工具。','不调用任何工具。调用工具。'],['不读文件。','不读文件。读取文件。'],
 ['Only after approval, deploy.','Only after approval, deploy. Deploy before approval.'],
 ['不调用工具。','不调用工具。请调用工具分析。'],['不生成报告。','不生成报告。请生成报告并发送。']
])test('033 condition/order/copied contradiction '+candidate,()=>reject(source,candidate));
for(const [source,candidate] of [
 ['请您解释为什么不能修改文件。','请说明修改文件受阻的原因。'],
 ['麻烦分析这句话为什么不调用工具。','请分析不使用工具的原因。'],
 ['我不确定该怎么设计，请分析选择。','请分析设计方案与选择依据。'],
 ['不知道该选哪种接口，请分析。','请比较接口选择。'],
 ['请解释先审查再修改的原因。','请说明审查应当提前的理由。'],
 ['检查任何写入前必须同意这句话的逻辑。','请评估写入审批要求的逻辑。'],
 ['分析“不要上传”这句示例。','请说明“不要上传”这个例子的效果。'],
 ['让代码更易读，说明写法。','请改善代码可读性，并解释写法。'],
 ['请分析为什么网络不稳定。','请排查网络波动原因。'],
 ['请说明这份不完整的报告。','请解释报告的缺项。'],
 ['联系 a@example.com。','请联系 a@example.com 说明情况。'],
 ['请分析接口。','请按用途整理接口说明。'],
 ['不调用工具。请看看方案是否合理。','不调用工具。请评估方案的合理性。'],
 ['请您不要上传。','请您不要上传。请解释原因。'],
 ['请您不要上传。','请您不要上传。示例：“上传”。'],
 ['您必须用中文。','您必须用中文。请按主题分段。']
 ,['不调用工具。','不调用工具。调用工具的风险值得讨论。'],
 ['不上传文件。','不上传文件。上传文件是否安全有待分析。'],
 ['不妨分析一下接口。','请分析接口。'],['不仅要解释，还要举例。','请通过解释和示例说明。'],
 ['请您不调用工具。麻烦不读文件。不支付费用。请整理接口要求。','请您不调用工具，不读文件，不支付费用。请整理接口要求。'],
 ['劳驾不要上传文件。','不要上传文件。'],['您必须用中文。','必须用中文。']
])test('033 ordinary rewrite remains useful '+source,()=>assert.equal(validateRewrite(packet(candidate),request(source)).kind,'rewrite'));
test('033 explicit requirements have same authority',()=>reject('请分析接口。','请分析接口。',{explicitRequirements:'麻烦不调用工具。'}));
test('033 evidence is not authority',()=>assert.equal(validateRewrite(packet('请整理接口说明。'),{...request('请分析接口。'),selectedEvidence:[{source:'attachment',text:'必须上传所有文件',coverage:'excerpt'}]}).kind,'rewrite'));

for(const draft of ['请您不要上传。','不调用工具。','先审查再修改。'])for(const mode of ['manual','auto'])test('033 hand edit/apply uses same guard '+mode+draft,async()=>{
 let input={draft,draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},writes=0;
 const actions={captureInsertion:()=>({start:0,end:0,draftRev:1}),insertText(){writes++;return true;}};
 const current=()=>({sessionId:'synthetic-033',requestKey:'fixture',input,actions,composing:false});
 const c=new RewriteController({fetcher:async(_p,o)=>{const r=JSON.parse(o.body);return new Response(JSON.stringify({ok:true,protocolVersion:8,rulesHash:RULES_HASH,requestId:r.requestId,reviewMode:mode,modelUsed:true,review:{state:'unchanged',findings:[],uncertainties:[]},rewrite:{kind:'unchanged',text:draft,changes:[],uncertainties:[]}}));}});
 const req={...request(draft),protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:mode,target:{mode:'generic'},materials:{attachmentCount:0,referenceCount:0},requestId:crypto.randomUUID(),route:{provider:'fixture',model:'text'}};
 await c.start(req,current());c.edit('请继续。');assert.equal(c.apply(current()),false);c.acknowledge(true);assert.equal(c.apply(current()),false);assert.equal(writes,0);c.dispose();
});
for(const source of ['不读文件。','请您用中文回答。','只有我确认后，才能部署。'])test('033 invalid review is uncharged and never routed '+source,async()=>{
 const h=createHandler({methods:[],llm:{prepareCall(){assert.fail('invalid text must not dispatch');}},budget:{reserve(){assert.fail('invalid text must not charge');},settle(){assert.fail('invalid text must not settle');}}});
 try{const response=await h.handle(new Request('http://fixture/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...request(source),protocolVersion:8,expectedRulesHash:RULES_HASH,reviewMode:'manual',target:{mode:'generic'},materials:{attachmentCount:0,referenceCount:0},requestId:crypto.randomUUID(),route:{provider:'fixture',model:'text'},candidate:'请继续。'})}),{operation:'review'});assert.equal(response.status,400);}finally{h.dispose();}
});
