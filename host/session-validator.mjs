export class SessionServiceError extends Error{constructor(){super('session service unavailable');this.code='SESSION_SERVICE';}}
export function createSessionValidator(getService,{now=Date.now,ttlMs=3000}={}){
 let ids=new Set(),at=null,owner;
 const refresh=async(service,signal)=>{
  let value;try{value=await service.list({},signal);}catch(e){if(signal?.aborted)throw signal.reason;throw new SessionServiceError();}
  signal?.throwIfAborted();const rows=Array.isArray(value)?value:value?.items??value?.sessions;
  if(!Array.isArray(rows))throw new SessionServiceError();ids=new Set(rows.map(x=>x.id??x.sessionId).filter(x=>typeof x==='string'));at=now();owner=service;
 };
 return async(id,signal)=>{
  const service=getService();if(!service?.list)throw new SessionServiceError();
  const t=now(),stale=at===null||t<at||t-at>=ttlMs||owner!==service;
  if(stale)await refresh(service,signal);
  if(ids.has(id))return true;
  // A resident session may have appeared after the cached successful list.
  if(!stale)await refresh(service,signal);
  return ids.has(id);
 };
}
