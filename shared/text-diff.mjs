// Bounded line comparison: never feed arbitrary model output into an HTML renderer.
export function textDifference(original,candidate){
 if(typeof original!=='string'||typeof candidate!=='string'||original.length>6000||candidate.length>6000)return [{kind:'notice',text:'文本较长，请直接对照原稿与候选。'}];
 const a=original.match(/.*(?:\n|$)/g).filter(Boolean),b=candidate.match(/.*(?:\n|$)/g).filter(Boolean);
 if(a.length*b.length>14400){let first=0,last=0;const aa=Array.from(original),bb=Array.from(candidate);while(first<aa.length&&first<bb.length&&aa[first]===bb[first])first++;while(last<aa.length-first&&last<bb.length-first&&aa[aa.length-1-last]===bb[bb.length-1-last])last++;return [{kind:'same',text:aa.slice(0,first).join('')},{kind:'removed',text:aa.slice(first,aa.length-last).join('')},{kind:'added',text:bb.slice(first,bb.length-last).join('')},{kind:'same',text:aa.slice(aa.length-last).join('')}].filter(x=>x.text);}
 const rows=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)rows[i][j]=a[i]===b[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
 const out=[];let i=0,j=0;const add=(kind,text)=>{if(out.at(-1)?.kind===kind)out.at(-1).text+=text;else out.push({kind,text});};
 while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){add('same',a[i]);i++;j++;}else if(j<b.length&&(i===a.length||rows[i][j+1]>=rows[i+1][j]))add('added',b[j++]);else add('removed',a[i++]);}return out;
}
