// Only public InputState fields. No File/Blob, private controller, DOM scraping or history reads.
export function materialFacts(input){return {attachmentCount:Array.isArray(input?.attachmentIds)?input.attachmentIds.length:0,referenceCount:Array.isArray(input?.occurrences)?input.occurrences.length:0};}
export function inputFingerprint(sessionId,input,context='',route=null){return JSON.stringify([sessionId,input?.draftRev,input?.draft,input?.phase,input?.attachmentIds||[],(input?.occurrences||[]).map(x=>[x.occurrenceId,x.source,x.ref,x.offset,x.length]),context,route]);}
