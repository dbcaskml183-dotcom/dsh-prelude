export function abortable(promise,signal){
 const operation=Promise.resolve(promise);
 if(signal?.aborted){void operation.catch(()=>{});return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));}
 if(!signal)return operation;
 return new Promise((resolve,reject)=>{const off=()=>signal.removeEventListener('abort',stop);const stop=()=>{off();reject(signal.reason||new DOMException('Aborted','AbortError'));};signal.addEventListener('abort',stop,{once:true});operation.then(v=>{off();resolve(v);},e=>{off();reject(e);});});
}
export function deadlineFetch(url,options={},milliseconds=5000){return fetch(url,{...options,signal:AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(milliseconds)])});}
