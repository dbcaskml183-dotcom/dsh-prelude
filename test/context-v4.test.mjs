import test from 'node:test';import assert from 'node:assert/strict';
import {selectedChatRows,draftFiles,previewFile,addEvidence,evidenceCapacity} from '../client/context-adapter.mjs';
import {resolveRoute,loadDirectory} from '../client/native-adapter.mjs';
const node=(kind,data,visibility='visible')=>({kind,data,visibility,anchorSeq:1});
test('history only exposes selected public visible user and settled assistant text',()=>{
 const nodes=new Map([['a',node('user',{seq:1,content:[{type:'text',text:'user visible'},{type:'image',data:'private-image-canary'}]})],['b',node('assistant-step',{status:'settled',finalNode:{seq:2},blocks:[{kind:'text',text:'assistant visible'},{kind:'reasoning',text:'private-reasoning-canary'}]})],['c',node('tool',{text:'private-tool-canary'})],['d',node('assistant-step',{status:'running',blocks:[{kind:'text',text:'partial canary'}]})],['e',node('user',{seq:3,content:[{type:'text',text:'hidden-canary'}]},'hidden')]]);
 const rows=selectedChatRows({order:[...nodes.keys()],nodes});assert.equal(rows.length,2);assert.ok(!JSON.stringify(rows).includes('canary'));
});
test('history long-message coverage is explicit',()=>{const rows=selectedChatRows({order:['a'],nodes:{get:()=>node('user',{seq:1,content:[{type:'text',text:'文'.repeat(4500)}]})}});assert.equal(rows[0].text.length,4000);assert.ok(rows[0].coverage.includes('其余未选取'));});
test('history adapter does not open a missing view',()=>assert.deepEqual(selectedChatRows(undefined),[]));
const input={attachmentIds:['draft-one']},file=new File(['hello synthetic'],'example.txt',{type:'text/plain'});
const services={sessions:{binding:id=>id==='session-one'?{}:undefined},conversation:{resolveDraftAttachments:ids=>ids.map(id=>({id,kind:'file',file})),fileUploads:{getSnapshot:()=>({'draft-one':{status:'uploading'}})}}};
test('attachment lookup is limited to current retained session and exact input ids',()=>{assert.equal(draftFiles(services,'other-session',input).supported,false);const r=draftFiles(services,'session-one',input);assert.equal(r.files[0].upload,'uploading');assert.equal(r.files[0].file,file);});
test('missing or reordered attachment lookup fails closed',()=>{assert.equal(draftFiles({...services,conversation:{resolveDraftAttachments:()=>[]}},'session-one',input).supported,false);assert.equal(draftFiles({...services,conversation:{resolveDraftAttachments:()=>[{id:'other',file}]}},'session-one',input).supported,false);});
test('text preview does not require pretending upload completed',async()=>{const row=draftFiles(services,'session-one',input).files[0];const v=await previewFile(row);assert.equal(v.text,'hello synthetic');assert.equal(v.source,'attachment-text');});
test('large text preview declares byte/character coverage',async()=>{const f=new File(['字'.repeat(30000)],'large.md',{type:'text/markdown'});const p=await previewFile({id:'x',name:f.name,file:f,size:f.size});assert.equal(p.text.length,4000);assert.ok(p.coverage.includes('仅预览'));});
for(const name of ['project.zip','scan.pdf','brief.docx','photo.png'])test('unsupported material is not silently decoded '+name,async()=>{const f=new File(['binary fixture'],name);await assert.rejects(()=>previewFile({id:'x',name,file:f,size:f.size}));});
test('binary nul and aborted preview are rejected',async()=>{const f=new File([new Uint8Array([0,1,2])],'sneaky.txt');await assert.rejects(()=>previewFile({id:'x',name:f.name,file:f,size:f.size}));const ac=new AbortController();ac.abort();await assert.rejects(()=>previewFile({id:'x',name:file.name,file,size:file.size},ac.signal));});
test('UTF16 BOM decoded without running parser or code',async()=>{const f=new File([new Uint8Array([255,254,65,0,66,0])],'a.txt');assert.equal((await previewFile({id:'x',name:f.name,file:f,size:f.size})).text,'AB');});
test('evidence limits reject excess without mutating selection',()=>{const e={id:'a',text:'a'.repeat(3000)};const original=[e];assert.throws(()=>addEvidence(original,{id:'b',text:'b'.repeat(2000)}));assert.equal(original.length,1);});

test('evidence preview and adoption use the same replacement capacity at count and character boundaries',()=>{
 const current=Object.freeze(Array.from({length:8},(_,i)=>Object.freeze({id:'item-'+i,text:'文'.repeat(500)}))),before=JSON.stringify(current);
 const same={id:'item-3',text:'新'.repeat(500)},replacement=evidenceCapacity(current,same);
 assert.equal(replacement.count,8);assert.equal(replacement.chars,4000);assert.equal(replacement.valid,true);assert.equal(replacement.reason,'');
 assert.deepEqual(replacement.next,addEvidence(current,same));assert.equal(replacement.next.filter(x=>x.id===same.id).length,1);assert.equal(replacement.next.at(-1),same);
 const shortened={id:'item-3',text:'新'},smaller=evidenceCapacity(current,shortened);
 assert.equal(smaller.count,8);assert.equal(smaller.chars,3501);assert.equal(smaller.valid,true);assert.deepEqual(addEvidence(current,shortened),smaller.next);
 for(const item of [{id:'item-3',text:'新'.repeat(501)},{id:'ninth',text:'新'}]){
  const capacity=evidenceCapacity(current,item);assert.equal(capacity.valid,false);assert.ok(capacity.reason);
  assert.throws(()=>addEvidence(current,item),error=>error.message===capacity.reason);
  assert.equal(capacity.next.at(-1),item);
 }
 assert.equal(evidenceCapacity(current,{id:'ninth',text:'新'}).count,9);
 assert.equal(JSON.stringify(current),before);
});
test('follow model is read-only and fixed model is independent',()=>{const dir={store:{getSnapshot:()=>({current:{provider:'native',model:'m'}})}};assert.deepEqual(resolveRoute({routeMode:'follow'},dir),{provider:'native',model:'m'});assert.deepEqual(resolveRoute({routeMode:'fixed',provider:'fixed',model:'f'},dir),{provider:'fixed',model:'f'});});
test('hung native catalogue returns bounded last-known current',async()=>{const dir={store:{getSnapshot:()=>({current:{provider:'p',model:'m'},groups:[]})},load:()=>new Promise(()=>{})};const v=await Promise.race([loadDirectory(dir,10),new Promise((_,reject)=>setTimeout(()=>reject(new Error('deadline failure')),200))]);assert.equal(v.current.model,'m');assert.ok(v.error);});
