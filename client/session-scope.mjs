// React-visible session identity only; no drafts, model state or persistence.
export function createSessionScope(){
 let current;const listeners=new Set();
 return {
  getSnapshot:()=>current,
  subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  set(id){if(id===current)return;current=id;for(const listener of listeners)listener();},
 };
}
