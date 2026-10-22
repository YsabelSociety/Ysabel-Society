// Shared by all EmailOctopus views. Browser sessions stay same-origin; no
// provider credentials, cookies or private responses are stored on the device.
export class EmailOctopusRequestError extends Error {
 constructor(message:string,public status:number,public code=''){super(message);}
}
const endpoint='/marketingdata/api/email-octopus';
const aborted=()=>new DOMException('The request was cancelled.','AbortError');
function pause(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(aborted());return;}const abort=()=>{clearTimeout(timer);reject(aborted());};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});});}
export async function emailOctopusRequest<T>(params:Record<string,string>,signal?:AbortSignal):Promise<T>{
 for(let attempt=0;attempt<2;attempt++){
  if(signal?.aborted)throw aborted();
  const controller=new AbortController(),cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,30000);
  let retry=false;
  try{
   const response=await fetch(endpoint+'?'+new URLSearchParams(params),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401)throw new EmailOctopusRequestError('Your Ysabel session has expired. Sign in again to load email data.',401,'SESSION_EXPIRED');
   let value:any;try{value=await response.json();}catch{throw new EmailOctopusRequestError('The email service returned an incomplete response. Please retry.',502);}
   if(!response.ok)throw new EmailOctopusRequestError(value.error||value.message||'EmailOctopus could not load this view.',response.status,value.code||'');
   return value as T;
  }catch(error){
   if(signal?.aborted)throw aborted();
   const problem=error instanceof EmailOctopusRequestError?error:new EmailOctopusRequestError(controller.signal.aborted?'The connection took too long. Please retry.':'The connection was interrupted. Please retry.',0);
   retry=attempt===0&&(problem.status===0||problem.status===408||problem.status>=500);
   if(!retry)throw problem;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  if(retry)await pause(1000,signal);
 }
 throw new EmailOctopusRequestError('EmailOctopus could not be loaded. Please retry.',502);
}
