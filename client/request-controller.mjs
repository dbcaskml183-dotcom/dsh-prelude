export class RequestController{
 seq=0;current=null;
 begin(fingerprint){this.cancel();const ticket={seq:++this.seq,fingerprint,abort:new AbortController()};this.current=ticket;return ticket;}
 valid(ticket,fingerprint){return this.current===ticket&&!ticket.abort.signal.aborted&&ticket.fingerprint===fingerprint;}
 cancel(){this.current?.abort.abort();this.current=null;}
}
