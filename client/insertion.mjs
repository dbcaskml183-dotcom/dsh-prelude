import {editorPolicyReason} from '../shared/editor-policy.mjs';
export function insertSafely(actions,input,text,span) {
 if(!actions||typeof actions.insertText!=='function'||input?.phase!=='plain'||!span||span.draftRev!==input.draftRev||typeof text!=='string'||text.length>1000)return false;
 if(!Number.isInteger(span.end)||span.end<0||editorPolicyReason(text))return false;
 // Inserting never deletes a non-collapsed user selection.
 return actions.insertText('\n'+text+'\n',{start:span.end,end:span.end,draftRev:span.draftRev})===true;
}
