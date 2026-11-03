import test from 'node:test';import assert from 'node:assert/strict';import {modelFailure,publicError} from '../shared/contracts.mjs';
for(const code of ['TRANSPORT','REQUEST_EXTENSION','MISSING_CREDENTIAL','INVALID_PREPARED_CALL'])test('finite SDK category '+code,()=>{const text=publicError(modelFailure({code,message:'SECRET_CANARY',cause:{private:'SECRET_CANARY'}}));assert.ok(text.includes(code));assert.ok(!text.includes('SECRET_CANARY'));});
for(const code of ['SECRET_CANARY','sk-fake-secret','<script>',null])test('unknown category stays private '+code,()=>assert.ok(!publicError(modelFailure({code,message:'SECRET_CANARY'})).includes('SECRET_CANARY')));

import {failureFacts} from '../shared/contracts.mjs';
test('middleware diagnostics exclude raw message and external stack text',()=>{const e=new TypeError('SECRET_CANARY');e.stack='TypeError: SECRET_CANARY\n at run (file:///root/dsh-plugins/example/index.mjs:12:4)\n at bad (https://secret.invalid/SECRET_CANARY:1:2)';assert.deepEqual(failureFacts(e,{codeRoots:['file:///root/dsh-plugins/example/']}),{type:'TypeError',code:'UNKNOWN',frames:[{file:'index.mjs',line:12,column:4}]});assert.ok(!JSON.stringify(failureFacts(e)).includes('SECRET_CANARY'));});
test('hostile diagnostic getter cannot replace original failure',()=>{const e={get stack(){throw Error('SECRET_CANARY')}};assert.deepEqual(failureFacts(e),{type:'Error',code:'UNKNOWN',frames:[]});});

import {abortable} from '../shared/async.mjs';
test('047 already cancelled operation still consumes a later rejection',async()=>{const ac=new AbortController();ac.abort();let fail;const operation=new Promise((_,reject)=>fail=reject);await assert.rejects(abortable(operation,ac.signal));fail(new Error('synthetic late failure'));await new Promise(r=>setTimeout(r,0));});
test('047 normal resolution and rejection survive the same async helper',async()=>{const ac=new AbortController();assert.equal(await abortable(Promise.resolve(7),ac.signal),7);await assert.rejects(abortable(Promise.reject(new Error('expected')),ac.signal),/expected/);});
