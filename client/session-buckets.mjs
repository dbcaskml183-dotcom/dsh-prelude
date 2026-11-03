// Allocate during render; activate and release only after ownership is committed.
export function createSessionBuckets(make,{limit=64}={}){
 const sessions=new Map(),absent={};let generation=0;
 const release=row=>{const owned=row.active;row.active=null;if(owned)(owned.dispose||owned.cancel).call(owned);};
 return {
  get(sessionId,actions){
   let row=sessions.get(sessionId);if(!row){row={buckets:new WeakMap(),active:null,generation};sessions.set(sessionId,row);}
   const key=actions&&['object','function'].includes(typeof actions)?actions:absent;let b=row.buckets.get(key);
   if(!b){b=make(actions);row.buckets.set(key,b);b.activate=()=>{
    if(row.generation!==generation||sessions.get(sessionId)!==row)return false;
    if(row.active!==b){row.active?.cancel();row.active=b;}
    for(const [id,old] of sessions){if(sessions.size<=limit)break;if(id!==sessionId&&!old.active?.get().open&&!old.active?.get().pending){try{release(old);}finally{sessions.delete(id);}}}
    return true;
   };}
   return b;
  },
  clear(){const owned=[...sessions.values()];generation++;sessions.clear();const errors=[];
   for(const row of owned)try{release(row);}catch(e){errors.push(e);}
   if(errors.length)throw new AggregateError(errors,'Some Prelude session resources could not be released');
  }
 };
}

// One current task per existing session bucket. No persistence or model access.
export function taskResetPatch(resetGeneration){
 return {resetGeneration,resetConfirmation:null,hidden:[],message:'',decision:null,decisionSource:null,pending:false,context:'',evidence:[],selection:null,methodChoices:[],appliedChoices:[]};
}
// Guard only work the user can lose; natural analysis/status updates are not edits.
export function taskResetToken(state,rewrite,previewVersion=0,receipt=null){
 return JSON.stringify([state.resetGeneration,state.context,state.methodChoices,state.evidence,state.selection,rewrite.edited?rewrite.candidate:null,previewVersion,receipt?[receipt.sessionId,receipt.revision,receipt.text]:null]);
}
