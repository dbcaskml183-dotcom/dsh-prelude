import {TransactionGate} from '../../host/transaction-gate.mjs';
import {existsSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
const [dir,mode]=process.argv.slice(2),gate=new TransactionGate(dir,'.usage.lock');
gate.run(()=>{writeFileSync(join(dir,'entered'),'yes');if(mode==='crash')process.exit(73);const end=Date.now()+5000;while(!existsSync(join(dir,'release'))&&Date.now()<end)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);});
