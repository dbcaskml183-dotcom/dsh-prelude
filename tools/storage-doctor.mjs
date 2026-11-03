import {TransactionGate} from '../host/transaction-gate.mjs';
import {lstatSync,realpathSync} from 'node:fs';import {isAbsolute,join} from 'node:path';
const [root,flag,...extra]=process.argv.slice(2);
if(!root||!isAbsolute(root)||extra.length||(flag&&flag!=='--recover-proven-locks')){console.error('Usage: node bin/storage-doctor.mjs ABSOLUTE_STATE_DIR [--recover-proven-locks]');process.exit(2);}
if(!lstatSync(root).isDirectory()||realpathSync(root)!==root)throw new Error('state directory must be real, absolute and not redirected');
let failed=false;const rows=[];
for(const [dir,file] of [[root,'.usage.lock'],[join(root,'library'),'.write.lock']]){
 try{const st=lstatSync(dir);if(!st.isDirectory()||st.isSymbolicLink())throw new Error('not a real directory');const gate=new TransactionGate(dir,file);let recovered=false;
 if(flag&&gate.marker().state!=='absent'){gate.run(()=>{});recovered=true;}
 rows.push({directory:dir,...gate.health(),recovered});
 }catch(e){if(e.code==='ENOENT')rows.push({directory:dir,state:'absent'});else{failed=true;rows.push({directory:dir,state:'refused',message:e.message});}}
}
console.log(JSON.stringify({mode:flag?'recover-proven-locks':'read-only',dataFilesWritten:false,rows},null,2));if(failed)process.exitCode=1;
