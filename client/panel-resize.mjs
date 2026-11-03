// Pure rectangle constraints. No DOM, persistence, SDK or model dependencies.
const clamp=(n,a,b)=>Math.max(a,Math.min(n,b));
export function usableViewport(v){
 const px=Math.min(8,Math.max(0,(v.width-1)/2)),py=Math.min(8,Math.max(0,(v.height-1)/2));
 return {x:v.left+px,y:v.top+py,width:Math.max(1,v.width-2*px),height:Math.max(1,v.height-2*py)};
}
export function constrainRect(rect,v,min={width:448,height:560},expanded=false){
 const b=usableViewport(v),width=clamp(rect.width,Math.min(min.width,b.width),b.width),height=expanded?b.height:clamp(rect.height,Math.min(min.height,b.height),b.height);
 return {x:clamp(rect.x,b.x,b.x+b.width-width),y:expanded?b.y:clamp(rect.y,b.y,b.y+b.height-height),width,height};
}
export function resizeRect(start,edge,dx,dy,v,min={width:448,height:560},expanded=false){
 const b=usableViewport(v),mw=Math.min(min.width,b.width),mh=Math.min(min.height,b.height),r=start.x+start.width,bottom=start.y+start.height;
 let x=start.x,y=start.y,width=start.width,height=start.height;
 if(edge.includes('w')){x=clamp(start.x+dx,b.x,r-mw);width=r-x;}
 if(edge.includes('e'))width=clamp(start.width+dx,mw,b.x+b.width-start.x);
 if(!expanded){
  if(edge.includes('n')){y=clamp(start.y+dy,b.y,bottom-mh);height=bottom-y;}
  if(edge.includes('s'))height=clamp(start.height+dy,mh,b.y+b.height-start.y);
 }
 return constrainRect({x,y,width,height},v,min,expanded);
}
