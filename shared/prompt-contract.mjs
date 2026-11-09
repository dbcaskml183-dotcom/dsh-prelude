// Finite source-preserving checks; these do not certify semantic equivalence.
export function suspiciousText(text){
 const knownSecret=/(?:sk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
 const assignedSecret=/(?:api[_-]?key|password|token)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-/.+]{12,}/i;
 const bearerHeader=/\bAuthorization["']?[ \t]*[:=][ \t]*["']?Bearer[ \t]+[A-Za-z0-9._~+/-]{12,}/i;
 return knownSecret.test(text)||assignedSecret.test(text)||bearerHeader.test(text);
}
const policyText=text=>text.normalize('NFKC').replace(/[\u200b-\u200d\u2060\ufeff]/gu,'');
// Preserve offsets and decimal/file-name dots while separating English sentences.
const sentenceText=text=>text.replace(/\.(?=\s|$)/gu,'。');
const strings=r=>[r.draft||'',r.explicitRequirements??r.context??''];
const methodTexts=r=>(r.selectedMethods||[]).map(x=>x.text);
const hardMethodConstraint=text=>{const h=instructionHead(policyText(text)),m=modalParts(h);return !descriptiveHead(h)&&(negativeHead.test(h)||['deny','avoid','unnecessary'].includes(m?.mode)||explicitFacts(h).bounds.size>0||explicitFacts(h).formats.size>0||permissionFacts(h).some(f=>!f.descriptive)||gateHead(h)&&/^(?:未经|未获|只有|除非|在|如果|若|if\b|only after\b)/iu.test(h));};
export function sourceBlocks(request,candidate){return [...strings(request).map((text,i)=>({id:i?'requirements':'draft',kind:'user',text})),...(request.selectedEvidence||[]).map((e,i)=>({id:'evidence-'+i,kind:e.source,text:e.text,coverage:e.coverage})),...(request.selectedMethods||[]).map((m,i)=>({id:'method-'+i,kind:'user-method',methodId:m.id,variant:m.variant,label:m.label,text:m.text})),...(candidate===undefined?[]:[{id:'candidate',kind:'candidate',text:candidate}])];}
const QUOTED=/```[\s\S]*?```|`[^`\n]+`|‘[^’]*’|『[^』]*』|[“「][\s\S]*?[”」]|"[^"\n]*"|(?<![A-Za-z0-9])'[^'\n]+'(?![A-Za-z0-9])/gu;
const maskLiteral=text=>text.replace(QUOTED,s=>s.replace(/[^\n]/gu,' '));
// A single quoted format name is a value, while quoted instructions stay data.
const factText=text=>text.replace(QUOTED,s=>/^[`“「"'](?:Markdown|JSON|YAML|HTML|表格|中文|英文|Chinese|English)[`”」"']$/iu.test(s)?s.slice(1,-1):s.replace(/[^\n]/gu,' '));
function clauses(text,joined=false){
 const masked=sentenceText(maskLiteral(text));
 // Keep original spans: projection must never manufacture a protected phrase.
 return [...masked.matchAll(joined?/[^。！？；;\n]+/gu:/[^。！？；;\n，,]+/gu)].map(m=>({text:text.slice(m.index,m.index+m[0].length).trim(),plain:m[0].trim()})).filter(c=>c.text);
}
function instructionHead(text){
 let t=text.replace(/^(?:[-*•]|\d+[.)、])\s*/u,'').trim();
 for(;;){
  let next=t.replace(/^(?:请帮我|请记得|请您|请|烦请|麻烦|劳驾|帮我|记得|切记|严格|确保|千万|(?:本轮|本次|这次|此次)(?:任务(?:中)?)?|您们?|你们?|我们?|模型|助手|Agent|要求|限制|注意|please\b)\s*[:：]?\s*/iu,'');
  // A clause-leading conjunction may precede the same modal operator. Never
  // strip a subject, a condition, or a word such as 并列/并发 to gain a match.
  const conjunction=/^(?:并且|同时|而且|并|且)\s*/u.exec(next);
  if(conjunction){const rest=next.slice(conjunction[0].length);if(MODALS.some(([,re])=>re.test(rest)))next=rest;}
  if(next===t)break;t=next;
 }
 return t;
}
// One vocabulary across preservation, grants and risky actions. Finite lexical
// checks do not interpret arbitrary natural-language permissions.
const NEGATION='(?:不允许|不得|不要|禁止|严禁|请勿|切勿|勿|别|不能|不可|不应|不宜|不许|不准|不需要|无需|避免|不|\\b(?:do not|don\'t|never|cannot|can\'t|must not|may not|not)\\b)';
const negativeHead=new RegExp('^'+NEGATION,'iu');
const negativeTail=new RegExp('(?:'+NEGATION+'|不|未|没有|未经|未获|拒绝|并非|不是|不代表|不构成|without|disallow)[^，,。！？；;\\n]{0,18}$','iu');
const scope=text=>text.split(/但是|但|却|然而|同时|并且|而且|然后|否则|不过|因此|所以|依然|仍然|前提下|情况下|基础上|就|\bbut\b/iu).at(-1);
const descriptiveBefore=text=>/(?:是否|能否|检查|判断|核对|解释|说明|评估|比较|讨论|研究)[^，,。！？；;\n]{0,12}$/u.test(text)||/\b(?:whether|if|explain|describe|why)\b[^.!?;\n]{0,18}$/iu.test(text);
const descriptiveAfter=text=>/^(?:(?!并|然后|再|后|且)[^，,。！？；;\n]){0,12}(?:是否|为何|为什么|的(?:风险|原因|含义|开销|方式))/u.test(text);
// These heads describe knowledge, state, or a question rather than prohibit an
// action. Do not scan through them to promote embedded examples to instructions.
const descriptiveHead=text=>/^(?:(?:我|我们|本人)\s*)?(?:不过(?!度)|不同(?!意)|(?:不管|不论|无论)(?:怎样|怎么样|如何)(?![，,\s]*(?:都)?(?:不要|不得|禁止|不许))|不确定|不知道|不清楚|不了解|不明白|不懂|不能确定|不能确认|不完整|不稳定|不一致|不太|不够|不妨|不仅|不但|不如|是否|能否|为什么|为何|检查|分析|解释|判断|核对|说明|比较|评估|讨论|研究|示例|例子|比如|例如|假如|(?:check|analy[sz]e|explain|review|describe|whether|why|example)\b)/iu.test(text);
// The same modal projection is used by preservation, strength and opposites.
// It is finite syntax, not a POS tagger or a semantic correctness certificate.
const MODALS=[
 ['unnecessary',/^(?:不必|不需要|无需)/u],['avoid',/^(?:避免|不宜|不应)/u],
 ['deny',/^(?:不允许|不可以|不得|不要|禁止|严禁|请勿|切勿|不能|不可|不许|不准|勿|别|不(?!必|需要|过|同|管))/u],
 ['optional',/^(?:(?:也|还)?(?:可以|可选择|可选地|可考虑))/u],
 ['recommend',/^建议(?!书|稿)/u],['required',/^(?:必须|务必|一定要|应当|需要)/u]
];
const modalScan=new RegExp(MODALS.map(([,re])=>re.source.slice(1)).join('|'),'gu');
const reportingPrefix=text=>/示例|例子|比如|例如|原文|原话|引用|句子|是否|能否|看看|解释|说明|讨论|比较|认为|写着|写道|表示|声称|提到|指出|否认|不代表|不构成|\b(?:example|quote[ds]?|whether|explain|describe)\b/iu.test(text);
const conditionalPrefix=text=>/(?:如果|若|只有|除非|否则|未经|之前|之后|前提|情况下|得到|取得|批准|授权|允许|[前后时](?:[，,\s]|$)|才|然后|接着|[并且])|\b(?:if|unless|before|after|only)\b/iu.test(text);
const objectActions=/^(?:修改|写入|执行|删除|清空|覆盖|格式化|卸载|上传|读取|访问|调用|支付|生成|保留|列出|扫描|下载|安装|重启|备份|审查|检查)$/u;
function literalObject(text){
 const raw=text.trim(),quoted=/^(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)'|“([^”\n]+)”|「([^」\n]+)」)$/u.exec(raw);
 const value=quoted?quoted.slice(1).find(x=>x!==undefined):raw;
 return /^(?:[A-Za-z]:[\\/]|\/(?!\/)|\.{1,2}[\\/]|https?:\/\/)/u.test(value)||/^[\p{L}\p{N}_. -]+\.[A-Za-z0-9]{1,10}$/u.test(value);
}
function resourceTopic(topic){
 return literalObject(topic)||/(?:问题|文件|报告|记录|清单|代码|配置|接口|日志|资料|图片|附件|页面|文本|目录|数据库|网络|费用)$/u.test(topic);
}
function repeatedObjectTopic(topic,body){
 if(!resourceTopic(topic))return false;
 const action=new RegExp('^(?:先|再)?'+objectActions.source.slice(1,-1),'u');
 return action.test(body)&&body.endsWith(topic)||/(?:列成|整理成|整理为|归纳为)/u.test(body)&&['清单','列表','集合'].some(end=>body.endsWith(topic+end));
}
function modalParts(text){
 const head=instructionHead(policyText(text));if(descriptiveHead(head))return null;
 const scan=maskLiteral(head);
 for(const m of scan.matchAll(modalScan)){
  const prefix=scan.slice(0,m.index).trim();
  if(prefix&&(reportingPrefix(prefix)||/(?:不|没|未)$/u.test(prefix)))return null;
  const item=MODALS.find(([,re])=>re.test(m[0]));if(!item)continue;
  if(prefix&&item[0]==='deny'&&m[0].length===1)continue;
  const body=head.slice(m.index+m[0].length).replace(/\s+/gu,'');if(!body)return null;
  const rawPrefix=head.slice(0,m.index).trim(),atomicObject=literalObject(rawPrefix);
  let topic=(atomicObject?rawPrefix:prefix).replace(/\s+/gu,'').replace(/^(?:这些|那些|上述|该|此)/u,'');
  // Conditions and predicates stay opaque: never erase them to gain a match.
  const opaque=!atomicObject&&!!prefix&&(conditionalPrefix(prefix)||prefix.length>32||/[，,:：;；。！？]/u.test(prefix)||/(?:删除|清空|修改|上传|覆盖|执行|重启|写入|取消|忽略)/u.test(prefix));
  let objectBody=body;
  if(topic&&repeatedObjectTopic(topic,body))topic='';
  else if(topic&&resourceTopic(topic)&&objectActions.test(body)){objectBody=body+topic;topic='';}
  return {mode:item[0],body:objectBody,topic,opaque,head};
 }
 // An explicit requirement heading supplies strength only when the body did
 // not already carry its own modal (e.g. 要求：可以... remains optional).
 const structural=policyText(text).replace(/^(?:[-*•]|\d+[.)、])\s*/u,'').trim();
 if(head&&/^(?:(?:请|本轮|本次)\s*)?(?:要求|必做项|必须完成项)\s*[:：]/u.test(structural))return {mode:'required',body:head.replace(/\s+/gu,''),topic:'',opaque:conditionalPrefix(head),head};
 return null;
}
function gateHead(text){
 const head=instructionHead(policyText(text));
 if(descriptiveHead(head))return false;
 if(/^(?:如果|若).+?[，,]/u.test(head)&&modalParts(head))return true;
 return /^(?:(?:不管|不论|无论).+?(?:不要|不得|禁止|不许)|先.+?(?:再|然后|后)|.{1,40}(?:之后|后)(?:才(?:能|可)|再)|在.{1,40}(?:之后|后)再|(?:任何|一切).{1,40}(?:前|之前).*(?:必须|须|需要|应)|未经.*?(?:同意|批准|授权|确认)|只有.+?(?:才|方可)|在.+?(?:之前|前)[，,\s].*(?:不|必须|须)|.{1,40}(?:之前|前)(?:必须|须|先)|除非.+?(?:否则|不)|(?:if\b.+?,|only after\b))/iu.test(head);
}
function explicitConstraint(text){
 const head=instructionHead(policyText(text));
 if(descriptiveHead(head))return false;
 return !!modalParts(head)||negativeHead.test(head)||/^(?:不(?:修改|执行|重启|联网|写入|追问|改写|替换|做|删减|缩减|用|必|需要|虚构|补造|添加|假设)|只(?:调查|读|分析|审查|检查|依据|基于|输出|返回|用|使用)|仅(?:调查|读|分析|审查|检查|依据|基于|输出|返回|用|使用)|必须|至少|最多|预算|上限|额度|范围固定|保留|保持.{0,16}(?:数据|格式|语言|口吻|受众)|(?:面向|给).{0,8}(?:新手|初学者|资深|专家)|(?:must|only|budget|preserve|retain|keep|return|output|respond)\b)/iu.test(head)||explicitFacts(head).formats.size>0||permissionFacts(head).some(f=>!f.descriptive);
}
// These are lexical atoms, not filesystem identities or semantic equivalence.
// Keep source authority unchanged: reference evidence is deliberately not scanned.
const literalPattern=String.raw`[“「"'](?:https?:\/\/|[A-Za-z]:[\\/]|\\\\|\/(?!\/)|\.{1,2}\/|~\/)[^\n“”「」"'<>|]+[”」"']|[“「"\x27](?:[\p{L}\p{N}_.-]+\/)+[^\n“”「」"\x27]+\.[A-Za-z0-9_-]{1,20}[”」"\x27]|https?:\/\/[^\s<>"'\x60，。；！？、：]+|(?<![\p{L}\p{N}_])\\\\[^\s“”「」"\x27\x60<>|，。；！？、：]+|(?<![\p{L}\p{N}_])[A-Za-z]:[\\/][^\s“”「」"'\x60<>|，。；！？、：]*|(?<![\p{L}\p{N}_:/\\.~-])(?:\/(?!\/)|\.{1,2}\/|~\/)[^\s“”「」"'\x60<>|，。；！？、：]+|(?<![\p{L}\p{N}_./])(?:[\p{L}\p{N}_.-]+\/)+[\p{L}\p{N}_.-]*\.[\p{L}\p{N}_.-]+(?![\p{L}\p{N}_.-])|(?<![A-Za-z0-9_.])[vV]?\d+(?:\.\d+)+(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?(?:\+[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?(?![A-Za-z0-9_+-]|\.\d)|(?<![A-Za-z0-9_.])(?:[¥￥$]\s*)?\d+(?:\.\d+)*(?:\s*(?:元|分钟|小时|天|次|MB|GB|ms|seconds?|minutes?))?(?![A-Za-z0-9_]|\.\d)`;
function literalAtoms(text,withCode=true){
 const pattern=new RegExp((withCode?String.raw`\x60\x60\x60[\s\S]*?\x60\x60\x60|\x60[^\x60\n]+\x60|`:'')+literalPattern,'gu');
 return [...text.matchAll(pattern)].map(m=>{
  const raw=m[0];if(raw.startsWith('`'))return {kind:'code',raw,value:raw};
  const quoted=/^[“「"']/u.test(raw);let value=quoted?raw.slice(1,-1):raw;
  const kind=/^(?:https?:\/\/|[A-Za-z]:[\\/]|\\\\|\/|\.{1,2}\/|~\/)|\//u.test(value)?'resource':'number';
  if(!quoted){
   value=value.replace(/[.,;!?:，。；！？：]+$/u,'');
   for(const [open,close] of [['(',')'],['[',']'],['{','}'],['（','）'],['【','】']])while(value.endsWith(close)&&value.split(close).length>value.split(open).length)value=value.slice(0,-1);
  }
  return {kind,raw,value:kind==='number'?value.replace(/^[vV](?=\d)/u,''):value};
 }).filter(x=>x.value);
}
function sourceAtoms(request){return [...strings(request),...methodTexts(request)].flatMap(t=>literalAtoms(t));}
// Compare quoted source material, not every pair of quotation marks in a prompt.
function sourceQuotes(text){
 // Pair delimiters once, so a long paste with unclosed quotes stays linear.
 const ends=new Map(),stacks=new Map(),pairs={'“':'”','「':'」','‘':'’','『':'』'};
 const tokens=[...text.matchAll(/\x60\x60\x60[\s\S]*?\x60\x60\x60|\x60[^\x60\n]*\x60|\\[\s\S]|[“”「」"‘’『』]/gu)];
 let nextDouble=-1;
 for(let i=tokens.length-1;i>=0;i--){
  const t=tokens[i],ch=t[0];if(ch.length!==1)continue;
  if(ch==='"'){if(nextDouble>=0)ends.set(t.index,nextDouble);nextDouble=t.index;continue;}
  if(Object.hasOwn(pairs,ch)){const end=stacks.get(pairs[ch])?.pop();if(end!==undefined)ends.set(t.index,end);}
  else{if(!stacks.has(ch))stacks.set(ch,[]);stacks.get(ch).push(t.index);}
 }
 const quotes=[];let consumed=0;
 for(const m of tokens){
  const end=ends.get(m.index);if(m.index<consumed||end===undefined)continue;
  const prefix=text.slice(Math.max(0,m.index-90),m.index);
  const mark=/(原话|原文|素材|报错|错误信息|这句话|这段话|润色|转述|翻译|回复|写道|说|反馈|表示|内容为|\bsaid|\bwrote|\bquote|\btranslate|\brewrite|\berror message)\s*[:：,，]?\s*$/iu.exec(prefix);
  if(!mark)continue;
  const words=prefix.slice(0,mark.index).split(/[：:，,。！？!?；;\n]/u).pop().trim().replace(/^(?:以下是|以下为|下面是来自|下面是|以下引自)\s*/u,'');
  const attribution=/^(?:原话|反馈|说|表示|写道|said|wrote)$/iu.test(mark[1]);
  const owner=attribution&&words.length<=32?words.replace(/的$/u,'').trim():'';
  quotes.push({start:m.index,end:end+1,raw:text.slice(m.index,end+1),body:text.slice(m.index+1,end),owner,marker:mark[1],example:/^(?:示例|虚构示例|虚构对话|假设示例|Example)[:：]\s*[^：:，,。！？!?；;\n]{0,32}$/iu.test(prefix.trim().replace(/[:：]$/u,'')),attributed:attribution});
  consumed=end+1;
 }
 return quotes;
}
export function quoteDifferences(request,text){
 const original=strings(request).flatMap(sourceQuotes),current=sourceQuotes(text);
 const strict=strings(request).some(s=>/(?:保留|保持|照抄|不得更改|不要改动)(?:原有|原文|原来的|所有|外层)?(?:引号|标点)|(?:引号|标点)(?:也|都)?(?:须|需|要)?(?:原样|保留|不变)/u.test(s));
 const same=(a,b)=>a.owner===b.owner&&(strict?a.raw===b.raw:a.body===b.body);
 const left=[...original],right=[];
 for(const now of current){const i=left.findIndex(was=>same(was,now));if(i<0)right.push(now);else left.splice(i,1);}
 const details=[],used=new Set();
 for(const was of left){
  const matches=right.filter(q=>q.owner===was.owner&&!used.has(q));
  const unique=(was.owner||!was.attributed&&matches[0]?.marker===was.marker)&&matches.length===1&&original.filter(q=>q.owner===was.owner).length===1&&current.filter(q=>q.owner===was.owner).length===1;
  const q=unique?matches[0]:null;
  // A swapped speaker is not an edit to a single piece of source text.
  const safe=q&&!original.some(x=>x.owner!==q.owner&&x.body===q.body)&&!current.some(x=>x.owner!==was.owner&&x.body===was.body);
  if(safe)used.add(q);
  details.push({message:(was.owner?was.owner+'：':'')+was.raw+(safe?' → '+q.raw:'（缺失、变动或归属不同）'),restore:safe?{start:q.start,end:q.end,raw:was.raw}:null});
 }
 const evidence=(request.selectedEvidence||[]).flatMap(e=>sourceQuotes(e.text));
 for(const q of right){
  if(used.has(q)||!q.attributed||evidence.some(x=>same(x,q)))continue;
  if(original.some(x=>same(x,q))){details.push({message:'这处原话在候选中重复出现：'+q.raw,notice:true,restore:null});continue;}
  if(q.example&&strings(request).some(s=>/(?:编写|写出|创作|提供|生成)(?:一个|一段|两段)?(?:虚构对话|虚构示例|虚构访谈)/u.test(s)))continue;
  if(!q.owner){details.push({message:'这处引文的来源需要核对：'+q.raw,notice:true,restore:null});continue;}
  details.push({message:'新增未注明来源的引文：'+q.owner+'：'+q.raw,restore:null});
 }
 return details;
}
function literalFragments(request){return [...new Set([...sourceAtoms(request).map(x=>x.raw),...strings(request).flatMap(sourceQuotes).map(q=>q.raw)])];}
function directiveFragments(request){
 const result=[];
 for(const text of strings(request)){
  for(const c of clauses(text))if(explicitConstraint(c.plain))result.push(instructionHead(c.text));
  for(const c of clauses(text,true))if(gateHead(c.plain))result.push(instructionHead(c.text));
 }
 for(const text of methodTexts(request)){for(const c of clauses(text))if(hardMethodConstraint(c.plain))result.push(instructionHead(c.text));for(const c of clauses(text,true))if(hardMethodConstraint(c.plain)&&gateHead(c.plain))result.push(instructionHead(c.text));}
 return [...new Set(result)];
}
// Only the leading operator changes. Objects, conditions, quoted atoms and
// numeric bounds are never translated, discarded or treated as synonyms.
function directiveKey(text){
 const head=instructionHead(policyText(text)).replace(/\s+/gu,'');
 const sequence=/^先(.{1,40}?)[，,]?(?:再|然后|后)(.{1,40})$/u.exec(head);
 if(sequence)return 'sequence:'+sequence[1].replace(/[，,]$/u,'')+'→'+sequence[2];
 const modal=modalParts(text);
 if(modal&&!modal.opaque)return modal.mode+':'+(modal.topic?'topic='+modal.topic+'|':'')+modal.body;
 return 'exact:'+head;
}
export function protectedLiterals(request){return [...new Set([...literalFragments(request),...directiveFragments(request)])];}
function directiveHeads(text){
 const heads=[];
 for(const c of [...clauses(text),...clauses(text,true)]){
  if(!c.plain)continue;heads.push(instructionHead(c.text));
  // A real requirement can follow a structural heading. Do not treat a quoted
  // example or explanatory question as an active directive merely after ':'.
  for(const m of c.plain.matchAll(/[:：]/gu)){
   const prefix=c.plain.slice(0,m.index),tail=c.plain.slice(m.index+1).trim();
   if(descriptiveHead(instructionHead(prefix))||reportingPrefix(prefix))continue;
   if(tail&&(explicitConstraint(tail)||gateHead(tail)))heads.push(instructionHead(c.text.slice(m.index+1)));
  }
 }
 return heads;
}
export function missingRequirements(request,text){
 const heads=directiveHeads(text);
 const atoms=literalAtoms(text,false),present=new Set(atoms.map(x=>x.kind+':'+x.value));
 const missing=sourceAtoms(request).filter(a=>a.kind==='code'?!text.includes(a.raw):!present.has(a.kind+':'+a.value)).map(a=>a.raw);
 missing.push(...quoteDifferences(request,text).filter(q=>!q.notice).map(q=>q.message));
 return [...new Set([...missing,...directiveFragments(request).filter(s=>!heads.some(h=>h===s||directiveKey(h)===directiveKey(s)))])];
}
function permissionFacts(text){
 const result=[];
 for(const rawClause of clauses(text)){
  const c={plain:policyText(rawClause.plain)};
  for(const m of c.plain.matchAll(/批准|授权|允许|准许|(?:可以|可)(?=访问|联网|读取|写入|删除|清空|执行|重启|上传|下载|调用|花费|支付|安装|卸载)|\b(?:allow(?:ed|s)?|authoriz(?:e|ed)|approv(?:e|ed))\b/giu)){
   const before=scope(c.plain.slice(Math.max(0,m.index-40),m.index));
   const descriptive=descriptiveBefore(before);
   const negative=negativeTail.test(before);
   const modal=modalParts(c.plain);
   const boundObject=!descriptive&&!negative&&/^(?:可以|可)$/u.test(m[0])&&modal?.mode==='optional'&&!modal.opaque?modal.body+(modal.topic||''):null;
   const object=(boundObject??c.plain.slice(m.index+m[0].length).replace(/^(?:你们?|我(?:们)?|助手|模型|Agent|the agent|you)\s*/iu,'')).replace(/\s+/gu,'').toLocaleLowerCase('en-US');
   result.push({object:object||'<unspecified>',positive:!descriptive&&!negative,descriptive,coveredDeny:directiveKey(c.plain).startsWith('deny:')});
  }
 }
 return result;
}
function coverageMeaning(after,rawAfter,before='',rawClause=''){
 // Only positive evidence of coverage, never a blanket exemption for 覆盖.
 const object=after.split(/[，,。！？；;\n]/u,1)[0],rawObject=rawAfter.split(/[，,。！？；;\n]/u,1)[0];
 if(/(?:`|[A-Za-z]:\\|\/[A-Za-z0-9_.-]|[.][A-Za-z][A-Za-z0-9_-]{0,15}\b)/iu.test(rawObject))return false;
 // Match the complete clause: a scope-trimmed prefix could erase an action
 // such as 然后 and accidentally turn it into a bare section title.
 if(/^(?:#{1,6}\s+)?(?:(?:\d+|[一二三四五六七八九十]+)[.)、]\s*)?覆盖(?:说明|描述|情况)\s*[:：]?\s*$/u.test(rawClause.trim()))return true;
 // An explicit document subject plus a colon introduces its contents. Keep
 // this separate from "use new content to overwrite ..." and inspect every
 // later action independently. Resource objects still fail closed.
 const subject=before.split(/[，,]/u).at(-1).trim();
 // A complete material-coverage heading names a section, not an overwrite.
 // Require both its noun subject and terminal title; later actions and file
 // objects still go through the ordinary risk scan.
 const heading=subject.replace(/^#{1,6}\s+/u,'').replace(/^(?:\d+|[一二三四五六七八九十]+)[.)、]\s*/u,'');
 if(/^(?:材料|资料|证据)(?:范围[与及和])?$/u.test(heading)&&/^说明\s*[:：]?\s*$/u.test(object))return true;
 const documentSubject=/^(?:(?:(?:交接|审查|检查|研究|技术)?(?:说明|报告|文档|材料|答复|摘要|结论))(?:的)?(?:内容|范围)?|内容)(?:应当|应该|需要|必须|应|需|须|要)?$/u;
 if(documentSubject.test(subject)&&/^\s*[:：]/u.test(object)&&!/(?:文件|目录|数据库|数据表|分区|配置|现有数据|旧数据|记录|`|[A-Za-z]:\\|\/)/u.test(object))return true;
 if(/^(?:率|度)(?:[：:\d\s%]|$)/u.test(object))return true;
 const coverage=/^(?:范围|单机(?:条件|环境|场景)|(?:检查|测试|审查|验收|分析|核对)(?:的)?(?:范围|场景|项目|环节|动作|用例|流程|路径|分支|要求|维度|边界|功能)|(?:全部|所有|主要|关键|常见|相关|正常|异常|边界)?(?:测试|用户|使用)?(?:场景|情况|分支|用例|需求|检查项|风险点))/u.exec(object);
 if(!coverage)return false;
 // "覆盖检查范围内的配置文件" is still an overwrite, even though its
 // first few words name a coverage concept. Inspect the governed object.
 return !/(?:文件|目录|数据库|数据表|分区|配置|现有数据|旧数据|记录|`|[A-Za-z]:\\|\/)/u.test(object.slice(coverage[0].length));
}
function proposalSpans(text){
 // A proposed action is not an executed action. Stop at the proposal noun;
 // a later "然后删除文件" must be checked independently.
 return [...text.matchAll(/(?:列出|提出|给出|提供|整理|汇总)(?:关于|有关)?[^，,。！？；;\n]{0,40}?(?:建议|方案|策略|风险|权限|原因|含义)(?=[，,。！？；;\s]|$)/gu)].map(m=>[m.index,m.index+m[0].length]);
}
function activeRisks(text){
 const raw=policyText(sentenceText(text)),clean=maskLiteral(raw),actions=[];
 for(const clause of clean.matchAll(/[^。！？；;\n]+/gu)){
  const c=clause[0],rawClause=raw.slice(clause.index,clause.index+c.length);
  const proposals=proposalSpans(c);
  for(const m of c.matchAll(/(?:修改|写入|执行|联网|删除|清空|重启|覆盖|格式化|卸载|上传)|\b(?:modify|write|execute|delete|erase|restart|reboot|overwrite|uninstall|upload)\b/giu)){
   const before=scope(c.slice(Math.max(0,m.index-40),m.index)),after=c.slice(m.index+m[0].length);
   // "Use the explanation to overwrite ..." is an instrumental instruction,
   // not "explain overwriting ...". A document noun must not grant an action.
   const instrument=m[0]==='覆盖'&&/^(?:用(?!例|户)|使用|拿|以|将|把)[^，,。！？；;\n]{1,30}(?:内容|说明|报告|文档|文件|材料|备份|数据)(?:来|去|直接)?$/u.test(instructionHead(before));
   if(negativeTail.test(before)||!instrument&&descriptiveBefore(before)||descriptiveAfter(after)||proposals.some(([a,b])=>m.index>=a&&m.index<b))continue;
   if(/^(?:修改|删除|重启|覆盖|写入)$/u.test(m[0])&&/^(?:建议|方案|策略|风险|原因|含义|权限)[:：]/u.test(after)&&!instructionHead(before).trim())continue;
   if(m[0]==='覆盖'&&coverageMeaning(after,rawClause.slice(m.index+m[0].length),before,rawClause))continue;
   actions.push(m[0].toLowerCase());
  }
 }
 return new Set(actions);
}

// Deliberately finite object-scope facts, bound to the same action and object.
// A global "全部" elsewhere (or a quotation) never grants a broader operation.
function objectScopes(text){
 const facts=[];
 for(const c of clauses(text)){
  let h=instructionHead(policyText(c.plain));if(descriptiveHead(h)||negativeHead.test(h))continue;
  const modal=modalParts(c.plain);if(modal&&['deny','avoid','unnecessary'].includes(modal.mode))continue;
  h=h.replace(/^(?:可以|允许|建议|必须|务必|需要|先|再|现在|立即)\s*/u,'');
  const m=/^(删除|清空|覆盖|修改|读取|阅读|访问|扫描|上传|下载)\s*(全部|所有|选中|指定|临时|当前)的?(文件夹|文件|文章|目录|配置|代码|记录|附件|数据)(?=$|[\s，,。！？；;]|并|再|后|然后)/u.exec(h);
  if(m)facts.push({key:m[1]+m[3],broad:/全部|所有/u.test(m[2]),qualifier:m[2]});
 }
 return facts;
}
function scopeExpansions(request,candidate){
 const manual=objectScopes(strings(request).join('\n')),methods=objectScopes(methodTexts(request).join('\n'));
 return objectScopes(candidate).filter(x=>x.broad).filter(x=>{const primary=manual.filter(y=>y.key===x.key),known=primary.length?primary:methods.filter(y=>y.key===x.key);return known.some(y=>!y.broad)&&!known.some(y=>y.broad);}).map(x=>'操作范围扩大为全部：'+x.key);
}

function explicitFacts(text){
 const bounds=new Set(),formats=new Map();
 for(const c of sentenceText(factText(text)).split(/[。！？；;\n，,]+/u)){
  const t=policyText(c);
  if(/^(?:检查|分析|解释|判断|核对|说明|是否|能否|(?:check|analy[sz]e|explain|review|describe|whether|if)\b)/iu.test(instructionHead(t)))continue;
  for(const m of t.matchAll(/(预算|上限|额度|最多|不超过|限额|\bbudget\b|\bmaximum\b|\bat most\b|\bno more than\b)[^\d¥￥$。！？\n]{0,12}([¥￥$]?)\s*(\d+(?:\.\d+)?)\s*(元|次|步|字|分钟|小时|秒|天|MB|GB)?/giu)){
   const currency=m[2]||(m[4]==='元'?'¥':'');
   let kind=currency==='￥'?'¥':currency||m[4]||(/预算|额度|限额|budget/iu.test(m[1])?'budget':'count'),value=Number(m[3]);
   if(['秒','分钟','小时','天'].includes(kind)){value*=({秒:1,分钟:60,小时:3600,天:86400})[kind];kind='seconds';}
   bounds.add(kind+':'+value);
  }
  const matches=[...t.matchAll(/整理成|输出(?:为)?|返回(?:为)?|转换为|转成|写成|格式(?:为|是|\s*[:：])|语言(?:为|是|\s*[:：])|\b(?:return|output|respond|format as)\b/giu)];
  const language=/^(?:(?:必须|应当|需要)\s*)?(?:用|以|保持)\s*(中文|英文|Chinese|English)/iu.exec(instructionHead(t));
  if(language){const atom=/中文|chinese/iu.test(language[1])?'中文':'英文';formats.set('language',new Set([...(formats.get('language')||[]),'positive:'+atom]));}
  if(!matches.length)continue;
  const marker=matches.at(-1),target=t.slice(marker.index+marker[0].length);
  for(const m of target.matchAll(/Markdown|JSON|YAML|HTML|表格|中文|英文|Chinese|English/giu)){
   const word=m[0].toLocaleLowerCase('en-US'),kind=/中文|英文|chinese|english/u.test(word)?'language':'format';
   const atom=word==='chinese'?'中文':word==='english'?'英文':word;
   const polarity=negativeTail.test(scope(t.slice(0,marker.index)))?'negative:':'positive:';
   if(!formats.has(kind))formats.set(kind,new Set());formats.get(kind).add(polarity+atom);
  }
 }
 return {bounds,formats};
}

// Source-directed opposite checks avoid a global list of every Chinese verb.
// Only an explicit source prohibition creates a target; quoted/descriptive text
// and a different object do not create authority or an opposite command.
function directOpposites(source,candidate){
 const target=text=>text.replace(/任何|所有|全部/gu,'').replace(/读取/gu,'读').replace(/写入/gu,'写').replace(/\s+/gu,'').toLocaleLowerCase('en-US');
 const bodies=[];
 for(const c of clauses(source)){
  const head=instructionHead(policyText(c.plain));if(descriptiveHead(head))continue;
  const modal=modalParts(c.plain),m=negativeHead.exec(head);
  if(modal&&!modal.opaque&&['deny','avoid','unnecessary'].includes(modal.mode)){const body=target(modal.body+(modal.topic||''));if(body.length>=2)bodies.push(body);}
  else if(m){const body=target(head.slice(m[0].length));if(body.length>=2)bodies.push(body);}
 }
 const heads=clauses(candidate).map(c=>instructionHead(policyText(c.plain)).replace(/^(?:(?:但是|但|然而|不过|现在|立即|直接|继续|仍然|然后|接着)\s*)+/u,'')).filter(h=>!descriptiveHead(h)&&!negativeHead.test(h)).map(h=>target(instructionHead(h)));
 return bodies.filter(body=>heads.some(head=>head.startsWith(body)&&! /^(?:的|是|指|意味着|可能|会|为何|是否|为什么|能否|和|与)/u.test(head.slice(body.length))));
}

export function contractConflicts(request,text){
 const source=[...strings(request),...methodTexts(request)].join('\n');
 const missing=missingRequirements(request,text);
 const known=activeRisks(source),added=[...activeRisks(text)].filter(x=>!known.has(x));
 const original=permissionFacts(source),candidate=permissionFacts(text);
 const key=f=>(f.positive?'positive:':'negative:')+f.object;
 const count=fs=>{const m=new Map();for(const f of fs)if(!f.descriptive&&(f.positive||!f.coveredDeny))m.set(key(f),(m.get(key(f))||0)+1);return m;};
 const oldPermissions=count(original),newPermissions=count(candidate),permissions=[];
 for(const k of new Set([...oldPermissions.keys(),...newPermissions.keys()]))if(oldPermissions.get(k)!==newPermissions.get(k))permissions.push(k);
 const oldFacts=explicitFacts(source),newFacts=explicitFacts(text),constraints=[...newFacts.bounds].filter(x=>!oldFacts.bounds.has(x));
 // Keeping an optional sentence and appending the same task as mandatory must
 // not pass merely because the original fragment survived.
 const modes=value=>{const m=new Map();for(const c of clauses(value)){const k=directiveKey(c.plain),i=k.indexOf(':'),mode=k.slice(0,i),body=k.slice(i+1);if(mode==='exact'||!body||descriptiveHead(instructionHead(c.plain)))continue;if(!m.has(body))m.set(body,new Set());m.get(body).add(mode);}return m;};
 const oldModes=modes(source),newModes=modes(text);
 for(const [body,kinds] of newModes){const known=oldModes.get(body);if(known)for(const kind of kinds)if(!known.has(kind))constraints.push('strength:'+body+':'+kind);}

 constraints.push(...directOpposites(source,text).map(x=>'opposite:'+x),...scopeExpansions(request,text));
 // Direct copied-then-reversed sequence is a contradiction, even though both
 // original fragments survived. More distant paraphrases remain a stated limit.
 const candidateClauses=clauses(text,true);
 for(const c of clauses(source,true)){
  const head=instructionHead(policyText(c.plain));if(descriptiveHead(head))continue;
  const m=/^先(.{1,40}?)[，,]?(?:再|然后|后)(.{1,40})$/u.exec(head);
  if(m&&directiveHeads(text).some(x=>directiveKey(x)===directiveKey('先'+m[2]+'再'+m[1])))constraints.push('reversed-order');
  const e=/^only after\s+(.{1,40}?),\s*(.{1,40})$/iu.exec(head);
  if(e&&candidateClauses.some(x=>instructionHead(policyText(x.plain)).toLowerCase()===(e[2]+' before '+e[1]).toLowerCase()))constraints.push('reversed-condition');
 }
 for(const [kind,values] of newFacts.formats){const knownValues=oldFacts.formats.get(kind);for(const x of values)if(!knownValues?.has(x))constraints.push(kind+':'+x);}
 return {missing,added,permissions,constraints};
}
