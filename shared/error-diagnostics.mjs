// Log only code frames under explicitly supplied roots, always as relative paths.
function absoluteCodePath(value){
 try{let text=String(value);if(text.startsWith('file:')){const url=new URL(text);if(url.protocol!=='file:'||url.search||url.hash)return null;text=(url.hostname?'//'+url.hostname:'')+decodeURIComponent(url.pathname);if(/^\/[A-Za-z]:\//.test(text))text=text.slice(1);}text=text.replace(/\\/g,'/');if(!text.startsWith('/')&&!/^[A-Za-z]:\//.test(text))return null;if(/[\0\r\n?#]/.test(text)||text.split('/').some(x=>x==='..'))return null;return {path:text.replace(/\/$/,''),windows:/^[A-Za-z]:/.test(text)||text.startsWith('//')};}catch{return null;}
}
export function relativeCodeFrames(stack,roots=[]){
 if(typeof stack!=='string')return [];const allowed=roots.map(absoluteCodePath).filter(Boolean),out=[];
 for(const line of stack.split('\n').slice(1)){
  const match=line.trim().match(/(?:\(|\s)((?:file:\/\/|[A-Za-z]:[\\/]|\\\\|\/).*?\.(?:mjs|cjs|jsx|js)):(\d+):(\d+)\)?$/);if(!match)continue;
  const candidate=absoluteCodePath(match[1]);if(!candidate)continue;
  for(const root of allowed){const file=candidate.windows?candidate.path.toLowerCase():candidate.path,base=root.windows?root.path.toLowerCase():root.path;if(!file.startsWith(base+'/'))continue;const relative=candidate.path.slice(root.path.length+1);if(relative.length>180||relative.includes(':'))break;out.push({file:relative,line:Number(match[2]),column:Number(match[3])});break;}
  if(out.length===4)break;
 }
 return out;
}
