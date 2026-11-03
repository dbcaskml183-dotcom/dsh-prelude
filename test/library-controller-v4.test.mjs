import test from 'node:test';import assert from 'node:assert/strict';
import {LibraryController} from '../client/library-controller.mjs';import {emptyLibrary} from '../shared/library.mjs';
test('editing captured revision cannot silently adopt a newer refresh revision',async()=>{
 let calls=0;const c=new LibraryController({fetcher:async()=>{calls++;return new Response(JSON.stringify({ok:true,state:'ready',value:{...emptyLibrary(),revision:3}}));}});
 c.publish({state:'ready',value:{...emptyLibrary(),revision:1},writable:true});
 const editRevision=c.getSnapshot().value.revision;await c.load();assert.equal(c.getSnapshot().value.revision,3);
 await assert.rejects(()=>c.mutate({kind:'favorite',id:'evidence',enabled:true},{expectedRevision:editRevision}),/编辑或预览/);assert.equal(calls,1);
});
test('write refusal retains local value and never reports saved',async()=>{
 const c=new LibraryController({fetcher:async()=>new Response(JSON.stringify({ok:false,error:'conflict'}),{status:409})});
 const value={...emptyLibrary(),revision:2};c.publish({state:'ready',value,writable:true});await assert.rejects(()=>c.mutate({kind:'favorite',id:'evidence',enabled:true}));assert.deepEqual(c.getSnapshot().value,value);assert.equal(c.getSnapshot().writable,false);
});
test('readonly principal does not acquire a writable library',async()=>{const c=new LibraryController({fetcher:async()=>new Response('',{status:403})});await c.load();assert.equal(c.getSnapshot().writable,false);assert.equal(c.getSnapshot().state,'unavailable');});

test('047 refresh waits for the in-flight save before reading a fresh snapshot',async()=>{let release,reads=0;const value={...emptyLibrary(),revision:1},next={...value,revision:2,favorites:['evidence']};const c=new LibraryController({fetcher:async(_p,o)=>{if(o?.method==='POST')return await new Promise(r=>release=r);reads++;return Response.json({ok:true,state:'ready',value:next,coordination:{state:'ready'}});}});c.publish({state:'ready',value,writable:true});const save=c.mutate({kind:'favorite',id:'evidence',enabled:true}),refresh=c.load();assert.equal(reads,0);release(Response.json({ok:true,state:'ready',value:next}));assert.equal((await save).value.revision,2);await refresh;assert.equal(reads,1);assert.equal(c.state.value.revision,2);assert.deepEqual(c.state.value.favorites,['evidence']);assert.equal(c.writeFlight,null);});
test('047 queued refresh after disposal cannot start another request',async()=>{let release,reads=0;const c=new LibraryController({fetcher:async(_p,o)=>{if(o?.method==='POST')return await new Promise(r=>release=r);reads++;throw Error('must not read');}});c.publish({state:'ready',value:emptyLibrary(),writable:true});const save=c.mutate({kind:'favorite',id:'evidence',enabled:true});const caught=save.catch(()=>{}),load=c.load();c.dispose();await caught;await load;release(Response.json({ok:true,state:'ready',value:emptyLibrary()}));assert.equal(reads,0);assert.equal(c.state.writable,false);});
test('047 stale commit result must still validate its returned library',async()=>{let release;const c=new LibraryController({fetcher:()=>new Promise(r=>release=r)});c.publish({state:'ready',value:emptyLibrary(),writable:true});const save=c.mutate({kind:'favorite',id:'evidence',enabled:true});c.serial++;release(Response.json({ok:true,state:'ready',value:{bad:true}}));await assert.rejects(save);assert.equal(c.writeFlight,null);});
