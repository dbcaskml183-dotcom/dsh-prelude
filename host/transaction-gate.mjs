import {DatabaseSync} from 'node:sqlite';
import {lstatSync,fstatSync,openSync,closeSync,readFileSync,writeFileSync,fsyncSync,linkSync,unlinkSync,renameSync,chmodSync,constants} from 'node:fs';
import {join,basename} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
const PROTOCOL='prelude-json-gate/v1';
export class CoordinationError extends Error{
 constructor(code,message){super(message);this.name='CoordinationError';this.code=code;}
}
const busy=e=>[5,6].includes(e?.errcode)||/database (?:is )?(?:locked|busy)/i.test(e?.message||'');
const missing=e=>e?.code==='ENOENT';
const hash=b=>createHash('sha256').update(b).digest('hex');
// SQLite coordinates processes; the legacy pathname also fences old-version writers.
// A complete owner marker is hard-linked atomically, never published as an empty file.
export class TransactionGate{
 constructor(dir,legacyName){this.dir=dir;this.path=join(dir,'.coordination.sqlite');this.legacy=join(dir,legacyName);}
 marker(){
  try{
   const st=lstatSync(this.legacy);if(!st.isFile()||st.isSymbolicLink()||st.size>4096)return {state:'unknown',message:'旧版锁归属无法确认，已保留；请停用共享此目录的写入者后离线检查。'};
   const fd=openSync(this.legacy,constants.O_RDONLY|constants.O_NOFOLLOW);let bytes;try{const opened=fstatSync(fd);if(opened.dev!==st.dev||opened.ino!==st.ino||opened.size>4096)throw new CoordinationError('GATE_CHANGED','锁在读取期间发生变化，已停止。');bytes=readFileSync(fd);}finally{closeSync(fd);}
   let value;try{value=JSON.parse(bytes);}catch{return {state:'unknown',message:'检测到空白或损坏的旧版锁；不会据此抢锁，请离线检查。'};}
   return {state:'present',value,dev:st.dev,ino:st.ino,sha256:hash(bytes)};
  }catch(e){if(missing(e))return {state:'absent'};throw e;}
 }
 health(){
  try{const m=this.marker();if(m.state==='absent')return {state:'ready',file:basename(this.legacy)};
   if(m.state==='present'&&m.value?.protocol===PROTOCOL)return {state:'pending',file:basename(this.legacy),message:'检测到事务标记；写入时会在系统互斥下确认归属，不能仅按时间判定。'};
   return {state:'legacy-lock',file:basename(this.legacy),message:m.message||'检测到旧版锁；写入会核验归属，无法确认时保留现场。'};
  }catch{return {state:'storage-error',file:basename(this.legacy),message:'存储协调状态不可读取，请核对文件权限和磁盘；未重建数据。'};}
 }
 open(){
  try{const st=lstatSync(this.path);if(!st.isFile()||st.isSymbolicLink())throw new CoordinationError('GATE_STORAGE','协调文件不是普通文件，已停止写入。');}catch(e){if(!missing(e))throw e;}
  let db;
  try{
   db=new DatabaseSync(this.path);chmodSync(this.path,0o600);db.exec('PRAGMA busy_timeout=0; PRAGMA synchronous=FULL;');
   // Commit the identity before any marker can refer to it: a first-write crash
   // must not roll back the identity and turn our own marker into an unknown one.
   db.exec('BEGIN IMMEDIATE');db.exec('CREATE TABLE IF NOT EXISTS gate_identity (id INTEGER PRIMARY KEY CHECK (id=1), nonce TEXT NOT NULL)');
   db.prepare('INSERT OR IGNORE INTO gate_identity (id,nonce) VALUES (1,?)').run(randomUUID());db.exec('COMMIT');
   db.exec('BEGIN IMMEDIATE');const row=db.prepare('SELECT nonce FROM gate_identity WHERE id=1').get();
   if(!row||!/^[-a-f0-9]{36}$/.test(row.nonce))throw new Error('invalid coordination identity');
   return {db,nonce:row.nonce};
  }catch(e){try{db?.close();}catch{}if(e instanceof CoordinationError)throw e;throw new CoordinationError(busy(e)?'GATE_BUSY':'GATE_STORAGE',busy(e)?'另一写入者正在提交，请稍后手动重试；没有抢锁。':'存储协调不可用，请核对权限、磁盘或协调文件；原数据未重建。');}
 }
 retire(marker,nonce){
  let proven=marker.value?.protocol===PROTOCOL&&marker.value?.gateNonce===nonce&&marker.value?.resource===basename(this.legacy);
  // Older library locks have an owner PID; old empty usage locks do not.
  // A live/unknown owner is never displaced, regardless of age.
  if(!proven&&marker.state==='present'&&!marker.value?.protocol&&Number.isSafeInteger(marker.value?.pid)&&marker.value.pid>0){
   try{process.kill(marker.value.pid,0);}catch(e){if(e.code==='ESRCH')proven=true;}
  }
  if(!proven)throw new CoordinationError('GATE_LEGACY',marker.message||'旧版锁仍在且不能确认已失效；已保留，请先停止旧版写入者并离线检查。');
  const current=this.marker();if(current.state!=='present'||current.dev!==marker.dev||current.ino!==marker.ino||current.sha256!==marker.sha256)throw new CoordinationError('GATE_CHANGED','锁在核对期间发生变化，已停止；请刷新检查。');
  renameSync(this.legacy,this.legacy+'.retired-'+randomUUID());
 }
 run(fn){
  let db,nonce,claim,tmp;
  try{
   ({db,nonce}=this.open());const marker=this.marker();if(marker.state!=='absent')this.retire(marker,nonce);
   tmp=join(this.dir,'.prelude-lock-'+randomUUID()+'.tmp');const fd=openSync(tmp,'wx',0o600);
   try{writeFileSync(fd,JSON.stringify({protocol:PROTOCOL,gateNonce:nonce,resource:basename(this.legacy),pid:process.pid,createdAt:new Date().toISOString()}));fsyncSync(fd);}finally{closeSync(fd);}
   try{linkSync(tmp,this.legacy);}catch(e){if(e.code==='EEXIST')throw new CoordinationError('GATE_BUSY','另一旧版写入者已取得文件锁；本次未写入。');throw e;}
   claim=lstatSync(this.legacy);unlinkSync(tmp);tmp=null;
   const result=fn();if(result&&typeof result.then==='function')throw new TypeError('transaction callback must be synchronous');
   const after=lstatSync(this.legacy);if(after.dev!==claim.dev||after.ino!==claim.ino)throw new CoordinationError('GATE_CHANGED','提交期间写入屏障发生变化；请刷新核对，不自动重试。');
   unlinkSync(this.legacy);claim=null;db.exec('COMMIT');return result;
  }catch(e){if(e instanceof CoordinationError)throw e;if(busy(e))throw new CoordinationError('GATE_BUSY','另一写入者正在提交，请稍后手动重试。');throw e;}
  finally{
   if(claim)try{const after=lstatSync(this.legacy);if(after.dev===claim.dev&&after.ino===claim.ino)unlinkSync(this.legacy);}catch{}
   if(tmp)try{unlinkSync(tmp);}catch{}
   try{db?.close();}catch{}
  }
 }
}
