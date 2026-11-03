import test from 'node:test';import assert from 'node:assert/strict';
import {createSessionScope} from '../client/session-scope.mjs';
test('late input mount notifies settings of its real session identity',()=>{
 const s=createSessionScope(),seen=[];s.subscribe(()=>seen.push(s.getSnapshot()));assert.equal(s.getSnapshot(),undefined);s.set('fixture-session');assert.deepEqual(seen,['fixture-session']);
});
test('identical identity does not cause render loops',()=>{
 const s=createSessionScope();let n=0;s.subscribe(()=>n++);s.set('one');s.set('one');assert.equal(n,1);
});
test('unmounted settings does not retain its subscriber',()=>{
 const s=createSessionScope();let n=0;const off=s.subscribe(()=>n++);s.set('one');off();s.set('two');assert.equal(n,1);assert.equal(s.getSnapshot(),'two');
});
test('scope is instance-local and allows a return to unknown identity',()=>{
 const a=createSessionScope(),b=createSessionScope();a.set('a');assert.equal(b.getSnapshot(),undefined);a.set(undefined);assert.equal(a.getSnapshot(),undefined);
});
