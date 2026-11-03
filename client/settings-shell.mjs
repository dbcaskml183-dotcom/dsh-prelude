// DSH 0.2.1 exposes a settings-section slot but no compact-navigation API.
// Keep this optional shell adapter separate from settings content and storage.
// It recognises semantic structure, never generated CSS hashes; unknown shells
// are left untouched. Only our own class names are added and later removed.
export const SETTINGS_SHELL_CSS=`
@media(max-width:640px){
 .prelude-settings-shell{flex-direction:column}
 .prelude-settings-shell>.prelude-settings-nav{width:auto;flex:0 0 auto;min-width:0;max-width:100%;height:auto;display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 12px 0;border-right:0}
 .prelude-settings-nav> :not(.prelude-settings-nav-list){flex:none;padding:0;margin:0;font-size:13px}
 .prelude-settings-nav>.prelude-settings-nav-list{display:flex;flex:1;flex-direction:row;gap:5px;min-width:0;max-width:100%;overflow-x:auto;overflow-y:hidden;white-space:nowrap;padding:0 0 4px;scrollbar-width:thin}
 .prelude-settings-nav-list>button{flex:0 0 auto;width:auto;min-height:44px;margin:0;white-space:nowrap;font-size:12px;padding:8px 10px}
 .prelude-settings-shell>.prelude-settings-content{width:100%;min-width:0;min-height:0;flex:1 1 auto}
 .prelude-settings-content>.prelude-settings-header{padding:8px 12px}
 .prelude-settings-content>.prelude-settings-options{padding:0 12px 16px;min-width:0}
}
`;
export function adaptSettingsShell(root,win=globalThis.window){
 const dialog=root?.closest?.('[role="dialog"]');
 const nav=dialog&&[...dialog.children].find(e=>e.tagName==='NAV');
 const content=dialog&&[...dialog.children].find(e=>e!==nav&&e.contains(root));
 const list=nav&&[...nav.children].find(e=>[...e.children].some(x=>x.tagName==='BUTTON'));
 const options=content&&[...content.children].find(e=>e.contains(root));
 const header=content&&[...content.children].find(e=>e!==options&&e.querySelector('button'));
 if(!nav||!content||!list||!header||!options)return()=>{};
 const markers=[[dialog,'prelude-settings-shell'],[nav,'prelude-settings-nav'],[list,'prelude-settings-nav-list'],[content,'prelude-settings-content'],[header,'prelude-settings-header'],[options,'prelude-settings-options']];
 const added=markers.filter(([e,c])=>!e.classList.contains(c));
 for(const [e,c] of added)e.classList.add(c);
 const media=win.matchMedia('(max-width:640px)');let frame;
 const align=()=>{if(!media.matches)return;win.cancelAnimationFrame(frame);frame=win.requestAnimationFrame(()=>{if(!root.isConnected)return;const current=[...list.children].find(e=>e.tagName==='BUTTON'&&e.textContent.trim()===root.querySelector('h2')?.textContent);current?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});});};
 media.addEventListener('change',align);align();
 return()=>{media.removeEventListener('change',align);win.cancelAnimationFrame(frame);for(const [e,c] of added)e.classList.remove(c);};
}
