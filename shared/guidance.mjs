import catalog from '../guidance/rules.json' with {type:'json'};
export {RULES_HASH} from './guidance-version.mjs';
export function validateGuidance(value=catalog){
 if(value.version!=='guidance-1'||value.rules.length!==12)throw new Error('规范版本或数量不符');
 const ids=new Set(),sources=new Set(value.sources.map(x=>x.id));
 for(const r of value.rules){if(ids.has(r.id)||!r.instruction||!r.avoid.length||!r.regressionIds.length||r.sourceIds.some(id=>!sources.has(id))||r.signals.some(x=>typeof x!=='string'||x.length>40))throw new Error('规范定义无效');ids.add(r.id);}
 return true;
}
validateGuidance();
export function guidanceFor(request){
 const text=[request.draft,request.explicitRequirements||''].join('\n');
 const chosen=catalog.rules.filter(r=>r.signals.length&&r.signals.some(s=>text.includes(s))).slice(0,3);
 const examples=catalog.examples.filter(e=>e.signals.some(s=>text.includes(s))).slice(0,2);
 let result=chosen.map(r=>({id:r.id,label:r.label,instruction:r.instruction,sourceIds:r.sourceIds}));
 let value={rules:result,examples:examples.map(e=>({id:e.id,text:e.text}))};
 const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).byteLength;
 while(bytes(value)>4096&&value.examples.length)value.examples.pop();
 while(bytes(value)>4096&&result.length){result=result.slice(0,-1);value={...value,rules:result};}
 return value;
}
export const guidanceSources=catalog.sources;
