import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRewrite} from '../shared/rewrite-contract.mjs';
const request=draft=>({draft,explicitRequirements:'',selectedEvidence:[]});
const response=text=>JSON.stringify({kind:'rewrite',text,changes:[],uncertainties:[]});
for(const [source,extra] of [['只输出`JSON`。','输出`YAML`。'],['请输出“JSON”。','输出“Markdown”。'],['Return `JSON`.','Return `YAML`.']])test('a quoted format label remains a contract: '+extra,()=>assert.throws(()=>validateRewrite(response(source+extra),request(source)),e=>e.code==='REWRITE_CONSTRAINT'));
test('quoted output examples remain data rather than an output contract',()=>{const source='分析这句坏例子：“输出JSON”。';assert.equal(validateRewrite(response('请说明“输出JSON”的不足。'),request(source)).kind,'rewrite');});
test('a quoted example does not authorize an invented output format',()=>{const source='分析这句坏例子：“输出JSON”。';assert.throws(()=>validateRewrite(response(source+'输出Markdown。'),request(source)),e=>e.code==='REWRITE_CONSTRAINT');});
test('unexpected model fields remain rejected without adopting a candidate',()=>{assert.throws(()=>validateRewrite(JSON.stringify({kind:'rewrite',text:'整理接口说明。',changes:[],uncertainties:[],type:'json_object'}),request('整理接口说明。')),e=>e.code==='REWRITE_RESULT');});
