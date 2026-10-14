/** Bounded concurrency; wait for active batches before reporting a resumable failure. */
export async function importSevenRoomsBatches(batches:number,process:(batch:number)=>Promise<unknown>,progress:(completed:number)=>void){
 for(let offset=0;offset<batches;offset+=3){
  const end=Math.min(batches,offset+3);
  const results=await Promise.allSettled(Array.from({length:end-offset},(_,index)=>process(offset+index)));
  const failed=results.find(result=>result.status==='rejected');
  if(failed?.status==='rejected')throw failed.reason;
  progress(end);
 }
}
