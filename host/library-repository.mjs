import {TransactionGate,CoordinationError} from './transaction-gate.mjs';
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync,renameSync,unlinkSync,fsyncSync,lstatSync,fstatSync,readdirSync,constants} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateLibrary,serializeLibrary,emptyLibrary,mutateLibrary,LibraryError,LIBRARY_LIMIT} from '../shared/library.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export class LibraryRepository{
 constructor(dir,{fs={}}={}){
  this.dir=dir;this.fs={renameSync,...fs};
  mkdirSync(dir,{recursive:true,mode:0o700});if(lstatSync(dir).isSymbolicLink())throw new LibraryError('PATH','个人库目录不能是跳转链接。');
  this.path=join(dir,'library-v2.json');this.lock=join(dir,'.write.lock');this.gate=new TransactionGate(dir,'.write.lock');
 }
 bytes(file=this.path){
  const before=lstatSync(file);if(!before.isFile()||before.isSymbolicLink()||before.size>LIBRARY_LIMIT.bytes)throw Object.assign(new Error('invalid file'),{code:'INVALID_FILE',regular:before.isFile()&&!before.isSymbolicLink()});
  const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|(constants.O_NONBLOCK||0));
  try{const st=fstatSync(fd);if(!st.isFile()||st.size>LIBRARY_LIMIT.bytes||st.dev!==before.dev||st.ino!==before.ino)throw Object.assign(new Error('invalid or changed file'),{code:'INVALID_FILE',regular:false});return readFileSync(fd);}finally{closeSync(fd);}
 }
 historyPresent(){return readdirSync(this.dir).some(name=>/^library-v2\.json\.bak[12](?:$|\.corrupt-)/.test(name)||/^corrupt-[a-f0-9]{64}\.json$/.test(name));}

 read(){
  try{const raw=this.bytes();return {state:'ready',value:validateLibrary(JSON.parse(raw.toString('utf8'))),sha256:hash(raw)};}
  catch(e){if(e.code==='ENOENT'){if(this.historyPresent()){const backups=this.backups();return {state:'missing-protected',value:null,sha256:null,backups,message:backups.length?'个人库主文件缺失，已保护历史备份；请先选择备份恢复，不会创建空库。':'个人库主文件缺失且检测到历史文件，但没有可用备份；已保留现场，请按恢复文档离线核对。'};}return {state:'missing',value:emptyLibrary(),sha256:null};}const sha256=this.rawHash();return {state:'corrupt',value:null,sha256,recoveryAvailable:sha256!==null,message:sha256!==null?'个人库损坏；已保留原件，不自动重建。':'个人库超限或无法安全读取；原件和备份保留，本页面不能安全恢复或导出，请按离线恢复文档保全后处理。',backups:this.backups()};}
 }
 rawHash(){try{return hash(this.bytes());}catch{return null;}}
 backups(){
  const out=[];for(const generation of [1,2])try{const b=this.bytes(this.path+'.bak'+generation),v=validateLibrary(JSON.parse(b.toString('utf8')));out.push({generation,sha256:hash(b),revision:v.revision,items:v.items.length});}catch{}
  return out;
 }
 locked(fn){
  try{return this.gate.run(fn);}catch(e){if(e instanceof CoordinationError)throw new LibraryError(['GATE_BUSY','GATE_LEGACY'].includes(e.code)?'LOCKED':'STORAGE',e.message);throw e;}
 }
 health(){return this.gate.health();}

 atomic(file,data){
  const tmp=join(this.dir,'.'+randomUUID()+'.tmp');let created=false;
  try{const fd=openSync(tmp,'wx',0o600);created=true;try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}this.fs.renameSync(tmp,file);created=false;const d=openSync(this.dir,'r');try{fsyncSync(d);}finally{closeSync(d);}}
  finally{if(created)try{unlinkSync(tmp);}catch{}}
 }
 write(expectedRevision,op){
  return this.locked(()=>{
   const current=this.read();if(!current.value)throw new LibraryError(current.state==='missing-protected'?'RECOVERY_REQUIRED':'CORRUPT',current.message);
   if(!Number.isSafeInteger(expectedRevision)||current.value.revision!==expectedRevision)throw new LibraryError('CONFLICT','另一端已经修改个人库；已保留双方内容，请刷新后再保存。');
   const next=mutateLibrary(current.value,op),nextBytes=Buffer.from(serializeLibrary(next,'CAPACITY'));let warning=null;
   const raw=this.bytesIfPresent();
   if(current.state==='ready'&&(!raw||hash(raw)!==current.sha256))throw new LibraryError('CONFLICT','主库在保存期间变化或消失，未覆盖；请刷新并先核对恢复状态。');
   if(raw){
    let one;
    try{one=this.bytes(this.path+'.bak1');validateLibrary(JSON.parse(one));}
    catch(e){
     if(e.code==='ENOENT')one=null;
     else if(e instanceof SyntaxError||e.code==='INVALID'||(e.code==='INVALID_FILE'&&e.regular)){
      // Only invalid readable regular backups are quarantined. Permission, I/O,
      // symlink/directory and failed backup publication errors must stay visible.
      renameSync(this.path+'.bak1',this.path+'.bak1.corrupt-'+randomUUID());one=null;warning='一份旧备份损坏，已隔离保留原件；本次保存成功，备份已重新生成。';
     }else throw new LibraryError('STORAGE','备份无法安全读取，未覆盖主库；请检查权限、磁盘和备份路径。');
    }
    if(one)this.atomic(this.path+'.bak2',one);
    this.atomic(this.path+'.bak1',raw);
   }
   // Seed a recovery copy before publishing the very first primary.
   if(current.state==='missing')this.atomic(this.path+'.bak1',nextBytes);
   this.atomic(this.path,nextBytes);
   return {...this.read(),...(warning?{warning}:{})};
  });
 }
 bytesIfPresent(){try{return this.bytes();}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 recover(generation,expectedSha){
  if(![1,2].includes(generation)||!/^([a-f0-9]{64})$/.test(expectedSha||''))throw new LibraryError('INVALID','恢复参数无效。');
  return this.locked(()=>{
   const current=this.read();if(!['corrupt','missing-protected'].includes(current.state))throw new LibraryError('CONFLICT',current.state==='ready'?'当前库可用，不执行故障恢复；需要时请走导入预览。':'当前没有可恢复的历史库，请刷新后核对。');
   if(current.recoveryAvailable===false)throw new LibraryError('OFFLINE_REQUIRED','原件超限或无法安全读取；请先正常停用写入者，保全状态目录后按离线恢复文档处理。未改动原件和备份。');
   const bytes=this.bytes(this.path+'.bak'+generation);if(hash(bytes)!==expectedSha)throw new LibraryError('CONFLICT','备份已变化，请重新预览。');
   const v=validateLibrary(JSON.parse(bytes));v.revision=Math.max(Date.now(),v.revision+1);
   const restoredBytes=Buffer.from(serializeLibrary(v,'CAPACITY'));validateLibrary(v);
   const bad=this.bytesIfPresent();if(bad)this.atomic(join(this.dir,'corrupt-'+hash(bad)+'.json'),bad);
   this.atomic(this.path,restoredBytes);return {...this.read(),warning:'已恢复所选备份中的内容；缺失主文件中尚未备份的变化无法凭空恢复。'};
  });
 }
}
