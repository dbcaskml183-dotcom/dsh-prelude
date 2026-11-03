import {spawnSync} from 'node:child_process';import {readdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),files=readdirSync(new URL('../test/',import.meta.url)).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'test/'+n);
const result=spawnSync(process.execPath,['--test','--test-timeout=15000',...files],{cwd:root,env:process.env,stdio:'inherit'});process.exit(result.status??1);
