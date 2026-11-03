import {TransactionGate} from './transaction-gate.mjs';
import {readFileSync,writeFileSync,renameSync,mkdirSync,openSync,closeSync,unlinkSync,fsyncSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const LIMIT={maxRecords:2000};
export class UsageLedger {
 constructor(dir){this.dir=dir;mkdirSync(dir,{recursive:true,mode:0o700});this.path=join(dir,'usage-v2.json');this.legacyPath=join(dir,'budget-v1.json');this.lock=join(dir,'.usage.lock');this.gate=new TransactionGate(dir,'.usage.lock');}
 load() {
  try {
   const v=JSON.parse(readFileSync(this.path,'utf8'));
   if(v.version!==2||v.policy!=='unlimited'||!Number.isSafeInteger(v.calls)||v.calls<0||!Array.isArray(v.records)||v.records.length!==Math.min(v.calls,LIMIT.maxRecords)||v.records.some(r=>!r||!/^([a-f0-9]{64})$/.test(r.id)||typeof r.time!=='string'||typeof r.state!=='string')||new Set(v.records.map(r=>r.id)).size!==v.records.length)throw new Error('invalid usage ledger');
   return v;
  }catch(e){
   if(e.code!=='ENOENT')throw new Error('调用记录异常，智能细化暂不可用；本地方法库可用');
  }
  try {
   const bytes=readFileSync(this.legacyPath),v=JSON.parse(bytes.toString('utf8'));
   if(v.version!==1||v.grant!==5||!Number.isSafeInteger(v.calls)||v.calls<0||v.calls>50||!Number.isFinite(v.reserved)||Math.abs(v.reserved-v.calls*.1)>1e-6||!Array.isArray(v.records)||v.records.length!==v.calls||v.records.some(r=>!r||!/^([a-f0-9]{64})$/.test(r.id)||typeof r.time!=='string'||typeof r.state!=='string')||new Set(v.records.map(r=>r.id)).size!==v.records.length)throw new Error('invalid historical ledger');
   return {version:2,policy:'unlimited',calls:v.calls,records:v.records,legacy:{source:'budget-v1.json',sha256:createHash('sha256').update(bytes).digest('hex'),calls:v.calls,historicalReservation:v.reserved,note:'历史预留值，不是实际账单或新的余额'}};
  }catch(e){if(e.code==='ENOENT')return {version:2,policy:'unlimited',calls:0,records:[]};throw new Error('历史调用记录异常，请先核对；本地方法库可用');}
 }
 save(v){const tmp=this.path+'.'+randomUUID()+'.tmp';let created=false;
  try{const fd=openSync(tmp,'wx',0o600);created=true;try{writeFileSync(fd,JSON.stringify(v,null,2));fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,this.path);created=false;const directory=openSync(this.dir,'r');try{fsyncSync(directory);}finally{closeSync(directory);}}
  finally{if(created)try{unlinkSync(tmp);}catch{}}
 }

 transact(fn){return this.gate.run(()=>{const v=this.load();const out=fn(v);this.save(v);return out;});}
 health(){return this.gate.health();}

 migrate(){this.transact(()=>{});return this.status();}
 reserve(id) {
  if(typeof id!=='string'||!/^[\w-]{8,100}$/.test(id))throw new Error('请求身份无效');
  return this.transact(v=>{
   const h=createHash('sha256').update(id).digest('hex');
   if(v.records.some(r=>r.id===h))throw new Error('请求已处理，不重复调用');
   if(!Number.isSafeInteger(v.calls+1))throw new Error('调用记录计数异常');
   v.calls++;
   v.records.push({id:h,time:new Date().toISOString(),state:'started'});
   v.records=v.records.slice(-LIMIT.maxRecords);
   return h;
  });
 }
 settle(id,usage,state) {
  this.transact(v=>{const r=v.records.find(r=>r.id===id);if(!r)throw new Error('无调用记录');r.state=state;
   const input=usage?.inputTokens,output=usage?.outputTokens;
   if(Number.isFinite(input)&&Number.isFinite(output)&&input>=0&&output>=0){r.inputTokens=input;r.outputTokens=output;r.cacheReadTokens=Math.max(0,Number(usage.cacheReadTokens)||0);r.cacheWriteTokens=Math.max(0,Number(usage.cacheWriteTokens)||0);}
  });
 }
 status(){const v=this.load();return {coordination:this.health(),unsettledCalls:v.records.filter(r=>r.state==='started').length,mode:'unlimited',limit:null,remaining:null,calls:v.calls,reservationPerCall:0,billing:'provider_api',recentRecordLimit:LIMIT.maxRecords};}
}
