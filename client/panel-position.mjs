// Pure geometry; no SDK, persistence, input editing, or global layout mutation.
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
export function viewportBounds(win){const v=win.visualViewport;return {left:finite(v?.offsetLeft),top:finite(v?.offsetTop),width:Math.max(1,finite(v?.width,win.innerWidth)),height:Math.max(1,finite(v?.height,win.innerHeight))};}
export function clampPosition(point,v,size,horizontalOnly=false){
 const x0=v.left+Math.min(8,v.width/2),y0=v.top+Math.min(8,v.height/2),x1=Math.max(x0,v.left+v.width-Math.max(0,size.width)-8),y1=Math.max(y0,v.top+v.height-Math.max(0,size.height)-8);
 return {x:Math.max(x0,Math.min(finite(point?.x,x0),x1)),y:horizontalOnly?y0:Math.max(y0,Math.min(finite(point?.y,y0),y1))};
}
export function popoverLayout(a,v,expanded=false){
 const full=expanded;
 return {full,width:Math.max(1,Math.min(full?840:744,v.width-16,full?v.width-16:Math.max(a.width,Math.min(500,v.width-16)))),maxHeight:Math.max(1,full?v.height-16:Math.min(540,v.height*.68)),defaultLeft:full?null:a.left};
}
