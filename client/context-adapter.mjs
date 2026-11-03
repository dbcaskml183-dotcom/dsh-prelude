// Only already-loaded public Chat snapshots. Never retain, follow, or page history.
export function selectedChatRows(chat,limit=40){
 if(!chat?.order||!chat.nodes?.get)return [];
 const out=[];
 for(const key of chat.order.slice(-limit)){
  const node=chat.nodes.get(key);if(!node||node.visibility!=='visible')continue;
  const d=node.data;let text='',source;
  if(['user','steering'].includes(node.kind)){text=(d?.content||[]).filter(x=>x.type==='text').map(x=>x.text||'').join('\n');source='history-user';}
  else if(node.kind==='assistant-step'&&d?.status==='settled'&&d.finalNode&&!d.finalNode.interrupted){text=(d.blocks||[]).filter(x=>x.kind==='text').map(x=>x.text||'').join('\n');source='history-assistant';}
  if(!text.trim())continue;
  const partial=text.length>4000;
  out.push({id:'chat-'+String(d.seq??d.finalNode?.seq??node.anchorSeq)+'-'+key,source,label:(source==='history-user'?'用户':'助手')+' · 已加载消息',text:text.slice(0,4000),coverage:partial?'已加载消息的前4000字符；其余未选取':'本条已加载消息的可见正文'});
 }
 return out;
}
export function draftFiles(services,sessionId,input){
 if(!sessionId||!services.sessions?.binding?.(sessionId))return {supported:false,files:[],reason:'当前会话未就绪，未读取附件。'};
 const face=services.conversation;if(typeof face?.resolveDraftAttachments!=='function')return {supported:false,files:[],reason:'当前宿主未提供已验证的只读附件面；可粘贴文字。'};
 const ids=input?.attachmentIds||[];
 const rows=face.resolveDraftAttachments(ids);
 if(!Array.isArray(rows)||rows.length!==ids.length||rows.some((r,i)=>r.id!==ids[i]||!r.file))return {supported:false,files:[],reason:'附件已变化，未读取其正文，请重新打开预览。'};
 let uploads={};try{uploads=face.fileUploads?.getSnapshot?.()||{};}catch{}
 return {supported:true,files:rows.map(r=>({id:r.id,file:r.file,name:String(r.file.name||'未命名文件'),size:r.file.size,kind:r.kind,upload:r.kind==='image'?'随主会话发送':uploads[r.id]?.status||'unknown'}))};
}
const TEXT_EXT=/\.(?:txt|md|markdown|json|jsonl|csv|tsv|ya?ml|log|[mc]?js|tsx?|jsx|py|css|html?|xml|toml|ini|c|cpp|h|hpp|rs|go|sh)$/i;
export async function previewFile(row,signal){
 if(!row?.file||(!/^text\//i.test(row.file.type||'')&&!TEXT_EXT.test(row.name)))throw new Error('当前仅预览明确的文本格式；ZIP、PDF、Office或图片请交主会话读取。');
 if(signal?.aborted)throw new Error('预览已取消。');
 const bytes=new Uint8Array(await row.file.slice(0,65536).arrayBuffer());
 if(signal?.aborted)throw new Error('预览已取消。');
 const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';
 if(encoding==='utf-8'&&bytes.includes(0))throw new Error('检测到二进制内容，未作为文字读取。');
 const decoded=new TextDecoder(encoding).decode(bytes),partial=row.size>65536||decoded.length>4000;
 return {id:'file-'+row.id,source:'attachment-text',label:row.name.slice(0,160),text:decoded.slice(0,4000),coverage:(partial?'仅预览前64KiB且采用前4000字符':'所选文本文件的可见文字')+(decoded.includes('\uFFFD')?'；存在编码替换字符，需人工核对':'')};
}
export function evidenceCapacity(current,item){
 const next=[...current.filter(x=>x.id!==item.id),item];
 const count=next.length,chars=next.reduce((n,x)=>n+x.text.length,0),valid=count<=8&&chars<=4000;
 return {count,chars,valid,reason:valid?'':'最多8条、合计4000字符；请先移除或缩短已选片段，未静默截断。',next};
}
export function addEvidence(current,item){
 const capacity=evidenceCapacity(current,item);
 if(!capacity.valid)throw new Error(capacity.reason);
 return capacity.next;
}
