import {orderedMethods,recommendationMatch} from './catalog-registry.mjs';
import {intentOf,methodBlocked,methodRestricted,coverageOf,dataFreeText} from './intent.mjs';
import {MAX_DRAFT,DECISIONS} from './method-limits.mjs';
export const plainDraft=dataFreeText;
function taskExcluded(method,input,methods=[],view) {
 const t=(view||intentOf(input,methods)).signals;
 if(['primary-sources','citations'].includes(method.id)&&/(?:只|仅).{0,8}(?:修改|改写|润色)/.test(t)&&!/来源|引文|引用|参考文献|核实|查证/.test(t))return true;
 if(method.id==='regression'&&/文稿|段落|摘要|论文|文章/.test(t)&&!/代码|脚本|程序|接口|软件|插件|系统|测试|bug/i.test(t))return true;
 if(method.id==='bounded-revision'&&/整体重写|全篇重写|彻底重写|自由创作/.test(t))return true;
 if(method.id==='design-combinations'&&/已经定案|已批准|只要执行|只执行|按方案执行/.test(t))return true;
 if(method.id==='structured-extraction'&&/JSON|CSV|表格/i.test(t)&&/字段|列名/.test(t)&&/null|空值|缺失/.test(t)&&!/待定|未明确|缺少.{0,8}字段/.test(t))return true;
 if(method.id==='mvp'&&/维护|修复|更新|升级/.test(t))return true;
 return false;
}
export function excluded(method,input,methods=[]){return methodBlocked(method,input,methods)||taskExcluded(method,input,methods);}
export function methodStatus(method,input,methods=[],view){
 const v=view||intentOf(input,methods),restricted=methodRestricted({...method,recommendation_mode:'auto'},input,methods,v)||taskExcluded(method,input,methods,v);
 const coverage=coverageOf(method,input);
 return {restricted,coverage,selected:!!input?.selectedMethods?.some(x=>x.id===method.id),reason:restricted?'这条方法与当前操作限制或任务范围冲突。':coverage.state==='covered'?'当前文字已体现；可作为核对依据，无需再插入同一句。':coverage.state==='partial'?'可核对：'+coverage.missing.join('、'):'相关方法，尚未确认存在缺口。'};
}
export function coveredMethods(input,methods){const v=intentOf(input,methods);return methods.flatMap(m=>{const s=methodStatus(m,input,methods,v);return !s.restricted&&s.coverage.state==='covered'?[{methodId:m.id,label:m.technical_name||m.label,evidence:s.coverage.evidence}]:[];});}
export function localSuggestions(input,methods,hidden=[]) {
 const v=intentOf(input,methods),t=v.signals;
 if(/^(?:请)?(?:严格)?(?:逐字|原样)(?:复制|保存)|^(?:please\s+)?(?:copy|quote)\s+(?:verbatim|exactly)/i.test(v.draft.trim()))return [];
 if(!t||t.length<10||v.draft.length>MAX_DRAFT||/^(?:请认真处理：)?(?:继续|好的|照上面做|谢谢|你好)[。！!\s]*$/.test(t))return [];
 if(/^(?:什么是|解释一下|翻译|计算|今天|明天|几点|多少|谁是)/.test(t)&&t.length<100)return [];
 const found=[];
 for(const m of orderedMethods(methods)){
  const id=m.id,match=recommendationMatch(m,t);
  if(!m||!match||hidden.includes(id)||excluded(m,input,methods))continue;
  if(id==='acceptance'&&/验收|完成标准/.test(t))continue;
  if([m.technical_name,m.id].filter(x=>x&&x.length>3).some(x=>t.toLowerCase().includes(x.toLowerCase())))continue;
  const term=match.slice(0,24);
  const coverage=coverageOf(m,input);
  found.push({methodId:id,variantId:'standard',reason:coverage.state==='partial'?`可核对：${coverage.missing.join('、')}；未匹配到不等于确实遗漏。`:`相关方法：草稿或补充要求提到「${term}」，可按需参考，不等于发现缺陷。`,placement:{hint:m.placement_hint,quote:''},decisionRequired:DECISIONS.has(id)});
  if(found.length===3)break;
 }
 return found;
}

export const methodApplicable=(method,request,methods=[])=>!methodStatus(method,request,methods).restricted;
