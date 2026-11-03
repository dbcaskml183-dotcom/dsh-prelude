import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {relative,join} from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),file=join(root,'SOURCE-SHA256SUMS');
const excluded=new Set(['.git','node_modules','coverage','.work','artifacts']);
function list(dir){return readdirSync(dir).sort().flatMap(name=>{if(excluded.has(name)||name==='SOURCE-SHA256SUMS')return[];const p=join(dir,name),s=lstatSync(p);if(s.isSymbolicLink())throw new Error('Source tree must not contain symbolic links');if(s.isDirectory())return list(p);if(!s.isFile()||/\.private\.|\.log$|^\.env/.test(name))throw new Error('Private or unsupported source file: '+relative(root,p));return[p];});}
const files=list(root),lines=files.map(p=>{const bytes=readFileSync(p);if(!/\.(?:tgz|png|jpe?g)$/iu.test(p)&&bytes.includes(Buffer.from('\r\n')))throw new Error('Source text must use LF before checksumming: '+relative(root,p));return createHash('sha256').update(bytes).digest('hex')+'  '+relative(root,p).replaceAll('\\','/');});
if(process.argv.includes('--write'))writeFileSync(file,lines.join('\n')+'\n');
else{
 const expected=readFileSync(file,'utf8').trimEnd().split('\n');
 if(expected.length!==lines.length||expected.some((x,i)=>x!==lines[i]))throw new Error('Source checksum or exact file coverage mismatch');
 if(process.argv.includes('--tracked')){
  const p=spawnSync('git',['-C',root,'ls-files','-z'],{encoding:'utf8'});if(p.status!==0)throw new Error('Cannot inspect tracked release files');
  const tracked=new Set(p.stdout.split('\0'));for(const line of lines){const name=line.slice(66);if(!tracked.has(name))throw new Error('Checksummed file is not tracked: '+name);}
 }
}
console.log('Source manifest verified:',files.length,'files');
