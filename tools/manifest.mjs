import {readFileSync,writeFileSync,lstatSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),pkg=JSON.parse(readFileSync(new URL('package.json',root)));const files=[...new Set(['package.json',...pkg.files.filter(n=>n!=='MANIFEST.sha256')])].sort();
if(files.some(name=>name.startsWith('/')||name.includes('\\')||name.split('/').some(part=>!part||part==='.'||part==='..')||!lstatSync(new URL(name,root)).isFile()))throw new Error('Runtime manifest contains invalid paths');
const sha=name=>createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex');
const expected=files.map(name=>sha(name)+'  '+name+'\n').join('');const manifest=new URL('MANIFEST.sha256',root);
if(process.argv.includes('--release')){
 if(readFileSync(manifest,'utf8')!==expected)throw new Error('Runtime manifest mismatch before release verification');
 const filename=pkg.name.replace(/^@/u,'').replaceAll('/','-')+'-'+pkg.version+'.tgz';
 if(!/^[a-z0-9][a-z0-9.-]+\.tgz$/u.test(filename))throw new Error('Invalid release filename');
 const dir=new URL('release/',root),archive=new URL(filename,dir),checksum=new URL('SHA256SUMS',dir);
 const names=readdirSync(dir).sort(),writing=process.argv.includes('--write');
 if(names.some(n=>![filename,'SHA256SUMS'].includes(n))||!names.includes(filename)||!writing&&!names.includes('SHA256SUMS'))throw new Error('Release attachment set mismatch');
 for(const n of names)if(!lstatSync(new URL(n,dir)).isFile())throw new Error('Release attachment must be a regular file');
 const run=(args,bytes=false,maxBuffer=2*1024*1024)=>{const r=spawnSync('tar',args,{encoding:bytes?null:'utf8',maxBuffer,env:{...process.env,LC_ALL:'C'}});if(r.status!==0||r.error)throw new Error('Cannot inspect release archive: '+(r.error?.message||String(r.stderr)));return r.stdout;};
 const path=fileURLToPath(archive),members=run(['-tzf',path]).trimEnd().split('\n'),allowed=[...files,'MANIFEST.sha256'].map(n=>'package/'+n).sort();
 if(members.length!==allowed.length||new Set(members).size!==members.length||[...members].sort().some((n,i)=>n!==allowed[i]))throw new Error('Release archive member set mismatch');
 const types=run(['-tvzf',path]).trimEnd().split('\n');if(types.length!==members.length||types.some(line=>!line.startsWith('-')))throw new Error('Release archive contains non-regular members');
 // Published archives stay immutable when the repository's installation instructions change.
 const archiveDigest=sha('release/'+filename);
 const docExceptions={
  '50ce75c0c1ae3514af59f5e8b02779c0879ffac41a9623e720922331820efa18':['README.md','docs/compatibility.md'],
  '1be2e18ff81e9f31e18623c805f852c57cef1f3516261a6b257f3bba21d23370':['README.md','README.en.md']
 };
 const docs=docExceptions[archiveDigest]??[];
 const runtimeRows=bytes=>bytes.toString().split('\n').filter(line=>!docs.includes(line.slice(66))).join('\n');
 for(const name of allowed){
  const rel=name.slice(8),original=readFileSync(new URL(rel,root)),packed=run(['-xOzf',path,'--',name],true,Math.max(original.length+1024,1024*1024));
  if(docs.includes(rel))continue;
  if(rel==='MANIFEST.sha256'&&runtimeRows(original)===runtimeRows(packed))continue;
  if(!original.equals(packed))throw new Error('Release archive content mismatch: '+rel);
 }
 const readme=readFileSync(new URL('README.md',root),'utf8'),parts=readme.split('<!-- prelude-current:start -->');
 if(parts.length!==2||parts[1].split('<!-- prelude-current:end -->').length!==2)throw new Error('Current installation documentation boundary missing');
 const current=parts[1].split('<!-- prelude-current:end -->')[0],links=[...current.matchAll(/dsh-prompt-coach-([0-9]+\.[0-9]+\.[0-9]+)\.tgz/gu)];
 if(links.length<1||links.some(m=>m[1]!==pkg.version)||!current.includes('当前 **'+pkg.version+' '))throw new Error('Current installation documentation version mismatch');
 const digest=createHash('sha256').update(readFileSync(archive)).digest('hex'),line=digest+'  '+filename+'\n';
 if(writing)writeFileSync(checksum,line);else if(readFileSync(checksum,'utf8')!==line)throw new Error('Release checksum mismatch');
 console.log((writing?'Wrote':'Verified')+' release checksum and '+allowed.length+' identical archive members');
}else if(process.argv.includes('--write')){writeFileSync(manifest,expected);console.log('Wrote runtime manifest for '+files.length+' files');}else{if(readFileSync(manifest,'utf8')!==expected)throw new Error('Runtime manifest mismatch; rebuild the release candidate');console.log('Verified '+files.length+' runtime files');}
