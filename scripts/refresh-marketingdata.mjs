// Imports only from existing dashboard connections. No messages, ads or profile edits.
// Call the dashboard's Worker directly so the website proxy's request timeout
// and stripped Authorization header cannot interrupt unattended imports.
const endpoint = 'https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/refresh';
const key = process.env.MARKETING_SYNC_SECRET;
if (!key || key.length < 40) throw new Error('Daily import credential is missing.');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(body) {
  for (let attempt=0; attempt<4; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method:'POST',redirect:'error',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify(body), signal:AbortSignal.timeout(65000),
      });
      if (response.status === 401 || response.status === 403) throw new Error('AUTH');
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('SERVER');
      return await response.json();
    } catch(error) {
      if (error.message==='AUTH') throw new Error('Server import authorization failed.');
      if (attempt===3) throw new Error('The import service did not respond after retries. Saved progress is retained.');
      await delay(15000);
    }
  }
}
let job=await request({op:'start',scope:process.env.MARKETING_SYNC_SCOPE==='inbox'?'inbox':'all'});
const deadline=Date.now()+25*60000;
while (job.status==='running' && Date.now()<deadline) {
  if (job.retryAfter) await delay(3000);
  job=await request({op:'step',id:job.id});
}
if (job.status==='running') throw new Error('Import did not finish within this run. Saved progress will resume on the next run.');
// Public workflow logs contain only source labels and status, never account data or provider responses.
for (const task of job.tasks) console.log(task.label+': '+task.state);
if (job.status==='partial') console.log('::warning::Available sources updated. Some sources require access or a manual export; see private dashboard Sync details.');
console.log('Scheduled import completed at '+job.updatedAt);
