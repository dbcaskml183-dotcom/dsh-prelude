import {safeSnippet} from './catalog-registry.mjs';
import {methodApplicable} from './method-policy.mjs';
import {coverageOf} from './intent.mjs';
// A bundle is a preview of existing IDs, never a prompt that changes authority.
export function bundlePreview(bundle,selected,methods,request,skills=[]){
 const ids=[...new Set(selected)].filter(id=>bundle.methodIds.includes(id));
 const rows=ids.map(id=>methods.find(m=>m.id===id));
 if(rows.some(m=>!m))return {ok:false,text:'',reason:'搭配目录已变化，请重新选择。'};
 if(!rows.length)return {ok:false,text:'',reason:'请至少保留一种方法。'};
 if(rows.some(m=>!methodApplicable(m,request,methods)))return {ok:false,text:'',reason:'所选方法与当前要求冲突或已表达；请取消对应选项。'};
 if(rows.some(m=>coverageOf(m,request).state==='covered'))return {ok:false,text:'',reason:'所选方法已在当前文字中体现，无需重复插入；可在方法库查看或作为核对依据。'};
 const text=rows.map(m=>safeSnippet(m,skills)).join('\n');
 if(text.length>1000)return {ok:false,text:'',reason:'组合补句过长，请减少选项。'};
 return {ok:true,text,reason:'预览后再复制或插入；不会自动发送。'};
}
