export const LIBRARY_LIMIT=Object.freeze({items:200,bytes:1048576});
export class LibraryError extends Error{constructor(code,message){super(message);this.code=code;}}
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const only=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
const fail=()=>{throw new LibraryError('INVALID','个人库格式或大小不符合要求；原文件未改动。');};
export function serializeLibrary(v,code='INVALID'){
 const text=JSON.stringify(v);if(new TextEncoder().encode(text).length>LIBRARY_LIMIT.bytes){if(code==='CAPACITY')throw new LibraryError(code,'个人库文件容量不足（上限1MiB）；本次未写入，原库和编辑内容保留。');fail();}return text;
}
const idOK=s=>typeof s==='string'&&/^custom-[\w-]{1,100}$/.test(s);
export const emptyLibrary=()=>({schemaVersion:2,revision:0,favorites:[],items:[]});
export function validateLibrary(v){
 if(!only(v,['schemaVersion','revision','favorites','items'])||v.schemaVersion!==2||!Number.isSafeInteger(v.revision)||v.revision<0||!Array.isArray(v.favorites)||v.favorites.length>200||v.favorites.some(x=>typeof x!=='string'||!/^[-\w]{1,100}$/.test(x)||['__proto__','constructor','prototype'].includes(x))||new Set(v.favorites).size!==v.favorites.length||!Array.isArray(v.items)||v.items.length>LIBRARY_LIMIT.items)fail();
 const ids=new Set();
 for(const x of v.items){
  if(!only(x,['id','label','snippet','createdAt','updatedAt','deletedAt'])||!idOK(x.id)||ids.has(x.id)||typeof x.label!=='string'||!x.label.trim()||x.label.length>40||typeof x.snippet!=='string'||!x.snippet.trim()||x.snippet.length>800||[x.createdAt,x.updatedAt].some(s=>typeof s!=='string'||!Number.isFinite(Date.parse(s)))||(x.deletedAt!==null&&(typeof x.deletedAt!=='string'||!Number.isFinite(Date.parse(x.deletedAt)))))fail();
  ids.add(x.id);
 }
 serializeLibrary(v);
 return structuredClone(v);
}
export function decodeImport(raw,now=new Date().toISOString()){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>LIBRARY_LIMIT.bytes)fail();
 let v;try{v=JSON.parse(raw);}catch{fail();}
 if(v?.version===1){
  if(!only(v,['version','favorites','custom'])||!Array.isArray(v.custom)||v.custom.length>200)fail();
  return validateLibrary({schemaVersion:2,revision:0,favorites:v.favorites||[],items:v.custom.map(x=>({id:x.id,label:x.label,snippet:x.snippet,createdAt:now,updatedAt:now,deletedAt:null}))});
 }
 if(v?.format==='dsh-prompt-coach-library'){
  if(!only(v,['format','schemaVersion','revision','favorites','items']))fail();
  const {format,...rest}=v;return validateLibrary(rest);
 }
 return validateLibrary(v);
}
export function exportLibrary(v){const value=validateLibrary(v),pretty=JSON.stringify({format:'dsh-prompt-coach-library',...value},null,2);return new TextEncoder().encode(pretty).length<=LIBRARY_LIMIT.bytes?pretty:serializeLibrary(value);}
const sameText=(a,b)=>a.snippet.normalize('NFC').trim()===b.snippet.normalize('NFC').trim();
// One decision order for preview and mutation. Explicit replacement owns only
// its ID; a matching text elsewhere never authorizes touching that other row.
function importStep(items,item,mode){
 const index=items.findIndex(x=>x.id===item.id),conflict=index>=0&&!sameText(items[index],item);
 if(conflict&&mode==='replace')return {index,action:'replace',state:'conflict'};
 if(items.some(x=>sameText(x,item)))return {index,action:'skip',state:'duplicate'};
 return {index,action:'append',state:conflict?'conflict':'new'};
}
export function previewImport(current,incoming,mode='keep-both'){
 const working=validateLibrary(current);validateLibrary(incoming);if(!['keep-both','replace'].includes(mode))fail();
 return incoming.items.map(item=>{const step=importStep(working.items,item,mode);
  if(step.action==='replace')working.items[step.index]={...item};
  else if(step.action==='append')working.items.push({...item,id:step.index>=0?Symbol('preview-copy'):item.id});
  return {id:item.id,label:item.label,state:step.state,action:step.action,deleted:item.deletedAt!==null};
 });
}
export function mutateLibrary(current,op,{now=new Date().toISOString(),uuid=()=>crypto.randomUUID()}={}){
 const v=validateLibrary(current);
 if(!object(op))fail();
 if(op.kind==='favorite'){
  if(!only(op,['kind','id','enabled'])||typeof op.id!=='string'||!/^[-\w]{1,100}$/.test(op.id)||typeof op.enabled!=='boolean')fail();
  v.favorites=op.enabled?[...new Set([...v.favorites,op.id])]:v.favorites.filter(x=>x!==op.id);
 }else if(op.kind==='save'){
  if(!only(op,['kind','id','label','snippet']))fail();
  if(op.id!==undefined&&!idOK(op.id))fail();
  const existing=op.id?v.items.find(x=>x.id===op.id):undefined;
  if(op.id&&!existing)throw new LibraryError('MISSING','这条补句已变化，请刷新个人库。');
  const item={id:existing?.id||'custom-'+uuid(),label:op.label,snippet:op.snippet,createdAt:existing?.createdAt||now,updatedAt:now,deletedAt:null};
  if(existing)v.items[v.items.indexOf(existing)]=item;else v.items.push(item);
 }else if(op.kind==='remove'||op.kind==='restore-item'){
  if(!only(op,['kind','id']))fail();
  const item=v.items.find(x=>x.id===op.id);if(!item)throw new LibraryError('MISSING','找不到这条补句，请刷新。');
  item.deletedAt=op.kind==='remove'?now:null;item.updatedAt=now;
 }else if(op.kind==='purge-item'){
  if(!only(op,['kind','id'])||!idOK(op.id))fail();
  const item=v.items.find(x=>x.id===op.id);if(!item)throw new LibraryError('MISSING','找不到这条补句，请刷新。');
  if(item.deletedAt===null)throw new LibraryError('CONFLICT','这条补句已恢复或变化，未永久移除；请刷新后重新核对。');
  v.items=v.items.filter(x=>x.id!==op.id);v.favorites=v.favorites.filter(id=>id!==op.id);
 }else if(op.kind==='import'){
  if(!only(op,['kind','raw','conflicts'])||!['keep-both','replace'].includes(op.conflicts))fail();
  const incoming=decodeImport(op.raw,now);
  v.favorites=[...new Set([...v.favorites,...incoming.favorites])];
  for(const item of incoming.items){
   const step=importStep(v.items,item,op.conflicts);
   if(step.action==='skip')continue;
   if(step.action==='replace')v.items[step.index]={...item,createdAt:v.items[step.index].createdAt,updatedAt:now};
   else v.items.push({...item,id:step.index>=0?'custom-'+uuid():item.id});
  }
 }else fail();
 // A definitive operation rejection, before Repository starts any publication.
 // Keep persisted-file validation INVALID for recovery/backups compatibility.
 if(v.items.length>LIBRARY_LIMIT.items)throw new LibraryError('CAPACITY','个人库已保存与回收区共用200个名额；本次未写入。请在回收区确认永久移除不再需要的条目后再保存，或先导出保留。');
 v.revision++;
 serializeLibrary(v,'CAPACITY');
 return validateLibrary(v);
}
export function readLegacyPrefs(storage,key='dsh-prompt-coach:v1'){
 let raw=null;
 try{
  storage??=globalThis.localStorage;raw=storage.getItem(key);if(raw===null)return {state:'missing',raw:null,value:null};
  const v=JSON.parse(raw);const normalized={version:1,favorites:v.favorites||[],custom:v.custom||[]};
  const value=decodeImport(JSON.stringify(normalized));return {state:'valid',raw,value};
 }catch{return {state:raw===null?'unavailable':'corrupt',raw,value:null};}
}
