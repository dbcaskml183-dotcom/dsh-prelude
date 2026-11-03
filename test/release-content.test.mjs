import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,copyFileSync,unlinkSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,sep,dirname} from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('ordinary git add retains the documented checksummed release attachment',()=>{
 const base=resolve(tmpdir()),dir=mkdtempSync(join(base,'prelude-release-content-'));
 assert.ok(resolve(dir).startsWith(base+sep));
 try{
  writeFileSync(join(dir,'.gitignore'),readFileSync(new URL('../.gitignore',import.meta.url)));
  mkdirSync(join(dir,'release'));writeFileSync(join(dir,'release','fixture.tgz'),'synthetic archive');
  writeFileSync(join(dir,'SOURCE-SHA256SUMS'),'synthetic source checksum');
  for(const args of [['init','--quiet'],['add','-A']]){const r=spawnSync('git',['-C',dir,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  const r=spawnSync('git',['-C',dir,'ls-files','-z'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.ok(r.stdout.split('\0').includes('release/fixture.tgz'));
 }finally{assert.ok(resolve(dir).startsWith(base+sep));rmSync(dir,{recursive:true,force:true});}
});

test('source checksum rejects CRLF before Git can silently normalize it',()=>{
 const base=resolve(tmpdir()),dir=mkdtempSync(join(base,'prelude-source-lines-'));
 try{
  mkdirSync(join(dir,'tools'));writeFileSync(join(dir,'tools/source-manifest.mjs'),readFileSync(new URL('../tools/source-manifest.mjs',import.meta.url)));
  writeFileSync(join(dir,'fixture.md'),'Windows\r\n');
  let r=spawnSync(process.execPath,['tools/source-manifest.mjs','--write'],{cwd:dir,encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/must use LF/);
  writeFileSync(join(dir,'fixture.md'),'Windows\n');r=spawnSync(process.execPath,['tools/source-manifest.mjs','--write'],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 }finally{assert.ok(resolve(dir).startsWith(base+sep));rmSync(dir,{recursive:true,force:true});}
});

const source=fileURLToPath(new URL('../',import.meta.url)),pkg=JSON.parse(readFileSync(join(source,'package.json'))),archive=pkg.name+'-'+pkg.version+'.tgz';
const runtime=[...new Set(['package.json',...pkg.files])];
function releaseFixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'prelude-release-0411-'));
 try{for(const n of [...runtime,'tools/manifest.mjs','release/'+archive,'release/SHA256SUMS']){mkdirSync(dirname(join(dir,n)),{recursive:true});copyFileSync(join(source,n),join(dir,n));}return fn(dir);}finally{rmSync(dir,{recursive:true});}
}
const verify=(dir,args=['--release'])=>spawnSync(process.execPath,['tools/manifest.mjs',...args],{cwd:dir,encoding:'utf8'});
function repack(dir,mutate=()=>{}){
 const stage=join(dir,'stage');mkdirSync(stage);for(const n of runtime){mkdirSync(dirname(join(stage,'package',n)),{recursive:true});copyFileSync(join(dir,n),join(stage,'package',n));}mutate(stage);
 const r=spawnSync('tar',['-czf',join(dir,'release',archive),'-C',stage,...runtime.map(n=>'package/'+n)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
}
test('0411 actual release archive is bound to current runtime and docs',()=>{const before=readFileSync(join(source,'release/SHA256SUMS'));const r=verify(source);assert.equal(r.status,0,r.stderr);assert.deepEqual(readFileSync(join(source,'release/SHA256SUMS')),before);});
test('0411 missing release checksum fails verification without creating it',()=>releaseFixture(dir=>{unlinkSync(join(dir,'release/SHA256SUMS'));const r=verify(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/attachment set/u);}));
test('0411 wrong checksum is never rewritten by verification',()=>releaseFixture(dir=>{const bad='0'.repeat(64)+'  '+archive+'\n';writeFileSync(join(dir,'release/SHA256SUMS'),bad);assert.notEqual(verify(dir).status,0);assert.equal(readFileSync(join(dir,'release/SHA256SUMS'),'utf8'),bad);}));
test('0411 extra attachment fails verification',()=>releaseFixture(dir=>{writeFileSync(join(dir,'release/old.tgz'),'old');assert.notEqual(verify(dir).status,0);}));
test('0411 renamed old package cannot obtain a freshly signed checksum',()=>releaseFixture(dir=>{const before=readFileSync(join(dir,'release/SHA256SUMS'));repack(dir,stage=>{const path=join(stage,'package/package.json'),p=JSON.parse(readFileSync(path));p.version='0.0.1';writeFileSync(path,JSON.stringify(p));});const r=verify(dir,['--release','--write']);assert.notEqual(r.status,0);assert.match(r.stderr,/archive content mismatch/u);assert.deepEqual(readFileSync(join(dir,'release/SHA256SUMS')),before);}));
test('0411 same-version stale built code cannot get a new release checksum',()=>releaseFixture(dir=>{repack(dir,stage=>writeFileSync(join(stage,'package/client.js'),'stale code'));const r=verify(dir,['--release','--write']);assert.notEqual(r.status,0);assert.match(r.stderr,/archive content mismatch/u);}));
test('0411 self-consistent stale install documentation still fails release gate',()=>releaseFixture(dir=>{
 const path=join(dir,'README.md'),text=readFileSync(path,'utf8'),parts=text.split('<!-- prelude-current:start -->');parts[1]=parts[1].replaceAll(pkg.version,'0.0.1');writeFileSync(path,parts.join('<!-- prelude-current:start -->'));
 assert.equal(verify(dir,['--write']).status,0);repack(dir);const r=verify(dir,['--release','--write']);assert.notEqual(r.status,0);assert.match(r.stderr,/documentation version mismatch/u);
}));
