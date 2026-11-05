// Measure only this panel's visible chrome and one collapsed method card.
// Expanded disclosures and the remaining catalogue must never inflate the floor.
export function panelMinimum(panel){
 // On a narrow touch screen the card body scrolls; a full card must not pin the window.
 const win=panel.ownerDocument?.defaultView;
 if(win?.matchMedia('(pointer: coarse) and (max-width: 640px)').matches){
  const height=win.visualViewport?.height??win.innerHeight;
  return {width:Math.min(320,Math.max(1,win.innerWidth-48)),height:Math.min(360,Math.floor(height*.5))};
 }
 // The editor result scrolls independently; later catalogue cards cannot raise its floor.
 if(panel.querySelector?.('[data-pc-geometry-mode="rewrite"]'))return {width:448,height:560};
 const scroll=panel.querySelector?.('.pc-scroll'),card=scroll?.querySelector?.('.pc-card');
 if(!scroll||!card)return {width:448,height:560};
 const sr=scroll.getBoundingClientRect(),cr=card.getBoundingClientRect(),pr=panel.getBoundingClientRect();
 let hidden=0;
 for(const d of scroll.querySelectorAll('details[open]')){
  if(d.getBoundingClientRect().top>=cr.bottom)continue;
  if(d.parentElement?.closest('details[open]'))continue;
  const summary=d.querySelector('summary');if(!summary)continue;
  const dr=d.getBoundingClientRect(),sum=summary.getBoundingClientRect();
  hidden+=Math.max(0,dr.bottom-sum.bottom);
 }
 const content=cr.bottom-sr.top+scroll.scrollTop-hidden+14;
 const chrome=pr.height-sr.height;
 return {width:448,height:Math.max(560,Math.ceil(chrome+content))};
}
