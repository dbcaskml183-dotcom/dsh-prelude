// Text admission is separate from model quality and from the host's permissions.
export function invalidEditorText(text){
 return typeof text!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffc\ufff9-\ufffb]/u.test(text);
}
export function editorPolicyReason(text){
 if(invalidEditorText(text))return '文本含输入框不支持的控制字符，不能直接采用。';
 const head=text.replace(/^[\s\u200b-\u200d\u2060\u202a-\u202e\u2066-\u2069]+/u,'');
 // A multi-segment absolute path is not a slash command. A single /word is ambiguous.
 if(/^\/(?![^\s/]+\/)/u.test(head))return '文本含命令形式的开头；仅可预览或复制，不直接替换输入框。';
 // rc.2 parses session URIs anywhere, even inside Markdown code and URLs.
 if(/dsh-session:[A-Za-z0-9_-]+|@\[(?:\\.|[^\\\]])*\]\(dsh-session:[^\s)]*\)/u.test(text))return '文本含宿主会话引用；仅可预览或复制，不直接写入输入框。';
 const prose=text.replace(/```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>]+/gu,' ');
 if(/(^|\s)@[^\s@]+/u.test(prose))return '文本含可能的宿主引用；仅可预览或复制，不直接替换输入框。';
 return '';
}
