import {CoachError} from '../shared/contracts.mjs';
export async function prepareModel(llm,route,signal){
 if(!llm||!route)throw new CoachError('ROUTE');
 try{
  const prepared=await llm.prepareCall({provider:route.provider,model:route.model},signal);
  // Auxiliary draft analysis is not an agent-loop call in the main session.
  // Passing its sessionId can trigger archive/recall and other session middleware.
  return prepared;
 }catch{throw new CoachError(signal.aborted?'CANCELLED':'ROUTE');}
}
