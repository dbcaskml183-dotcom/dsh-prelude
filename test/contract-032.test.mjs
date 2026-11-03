import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRewrite,protectedFragments} from '../shared/rewrite-contract.mjs';
import {editorPolicyReason} from '../shared/editor-policy.mjs';
import {insertSafely} from '../client/insertion.mjs';
const request=draft=>({draft,explicitRequirements:'',selectedEvidence:[]});
const packet=text=>JSON.stringify({kind:'rewrite',text,changes:[],uncertainties:[]});
const reject=(source,text)=>assert.throws(()=>validateRewrite(packet(text),request(source)),e=>e.code==='REWRITE_CONSTRAINT');
const prohibitions=['请勿上传文件','切勿重启服务','勿上传','别上传','不能修改文件','不可改写原文','不应删除数据','不宜覆盖文件','不许联网','不准执行','确保不删除数据','千万不要重启','只使用本地数据','仅使用本地资料','只用本地工具','输出：JSON','格式：JSON','语言：中文','用中文回答','请用中文回答','请以中文回答','保持中文','要求：不要重启'];
for(const source of prohibitions){
 test('032 explicit clause cannot disappear: '+source,()=>reject(source+'。','请继续。'));
 test('032 unchanged clause is usable: '+source,()=>assert.equal(validateRewrite(packet(source+'。'),request(source+'。')).kind,'unchanged'));
 test('032 preservation uses actual source spans: '+source,()=>assert.ok(protectedFragments(request(source+'。')).every(s=>(source+'。').includes(s))));
}
for(const [source,candidate] of [
 ['请勿上传文件。','上传文件。'],['切勿重启服务。','重启服务。'],['勿上传。','上传。'],['别上传。','上传。'],
 ['允许访问外部网络。','不允许访问外部网络。'],['允许访问外部网络。','请继续。'],['Allow network access.','Do not allow network access.'],
 ['请分析接口。','请分析接口。输出JSON。'],['请分析接口。','请分析接口。格式：Markdown。'],['请分析接口。','请分析接口。用英文回答。'],
 ['语言：中文。','语言：中文。用英文回答。'],['格式：JSON。','格式：JSON。返回 YAML。'],
 ['请勿上传文件。','请勿上传文件。但上传文件。'],['只使用本地数据。','只使用本地数据。允许联网。']
])test('032 removal/reversal/appended contradiction '+candidate,()=>reject(source,candidate));
for(const [source,candidate] of [
 ['请解释为什么不能修改文件。','请说明修改文件受阻的原因。'],
 ['分析这句坏例子：“输出JSON”。','请说明“输出JSON”的不足。'],
 ['请分析接口。','请按用途解释接口，并标明信息不足之处。'],
 ['把JSON转换为YAML，保留所有键。','把JSON转换为YAML，保留所有键。按用途分段。'],
 ['请分析接口。','## 接口分析\n请分析接口。'],
 ['检查是否允许联网。','请核对联网权限。'],
 ['修复 allowlist 解析器。','请排查 allowlist 的解析问题。']
])test('032 ordinary/descriptive prose remains editable '+source,()=>assert.equal(validateRewrite(packet(candidate),request(source)).kind,'rewrite'));
const uri='dsh-session:'+Buffer.from(JSON.stringify('prelude-synthetic-no-real-session')).toString('base64url');
for(const text of ['请读：@[合成]('+uri+')','（@[合成]('+uri+')）','请看@[合成]('+uri+')','参考 '+uri,'`@[合成]('+uri+')`','```text\n'+uri+'\n```','https://example.test/'+uri]){
 test('032 host session syntax is copy-only even in literal text: '+text,()=>assert.match(editorPolicyReason(text),/引用/));
 test('032 snippets cannot bypass host admission: '+text,()=>{let writes=0;assert.equal(insertSafely({insertText(){writes++;return true;}},{phase:'plain',draftRev:1},text,{end:0,draftRev:1}),false);assert.equal(writes,0);});
}
test('032 safe insertion alongside existing references remains possible',()=>{let written;assert.equal(insertSafely({insertText(t){written=t;return true;}},{phase:'plain',draftRev:1,draft:uri},'请依据证据说明。',{end:uri.length,draftRev:1}),true);assert.equal(written,'\n请依据证据说明。\n');});
for(const text of ['联系 a@example.com','https://example.com/@name','`@file`只是示例','```sh\n/clear\n```','/root/project/file.mjs'])test('032 reference controls remain plain text '+text,()=>assert.equal(editorPolicyReason(text),''));

for(const source of ['notebook needs a short review.','nothing here is final.','Please review the notebook.'])test('032 English word boundary is not a negation: '+source,()=>assert.equal(validateRewrite(packet('Please review this document.'),request(source)).kind,'rewrite'));
for(const [source,candidate] of [
 ['Please review this interface. Do not modify files. Return JSON.','Please review this interface.'],
 ['Please review this interface. Do not modify files. Return JSON.','Please review this interface. Do not modify files. Return JSON. Modify files.'],
 ['不能修改文件。','不能修改文件。但修改文件。'],
 ['请勿上传文件。','请勿上传文件。但上传文件。'],
 ['Do not upload files.','Do not upload files. Upload files.']
])test('032 copied prohibition cannot license an opposite action '+candidate,()=>reject(source,candidate));
test('032 English descriptive output remains data',()=>assert.equal(validateRewrite(packet('Please explain this output example.'),request('Please explain why JSON output failed.')).kind,'rewrite'));
