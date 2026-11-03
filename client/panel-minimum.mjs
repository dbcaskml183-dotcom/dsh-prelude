// Measure only this panel's visible chrome and one collapsed method card.
// Expanded disclosures and the remaining catalogue must never inflate the floor.
export function panelMinimum(panel){
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
