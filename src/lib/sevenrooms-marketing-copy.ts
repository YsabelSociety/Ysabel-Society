type EmailPage = { rows: {email: unknown}[]; count: number };

/** Read every server-filtered page; fail instead of presenting a partial bulk list. */
export async function collectMarketingEmails(readPage:(page:number)=>Promise<EmailPage>){
 const emails=new Set<string>();let expected:number|undefined;
 for(let page=1;page<=100;page++){
  const result=await readPage(page);
  if(!Array.isArray(result.rows)||!Number.isInteger(result.count)||result.count<0)throw new Error('The email audience could not be verified. Please retry.');
  if(expected===undefined)expected=result.count;
  else if(expected!==result.count)throw new Error('This audience changed while preparing the list. Please retry.');
  for(const row of result.rows){
   const email=String(row.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('An invalid address was returned. Please check the guest data.');
   emails.add(email);
  }
  if(result.rows.length<1000){
   if(emails.size!==expected)throw new Error('The full email audience could not be prepared. Please retry.');
   return {emails:[...emails].sort(),count:emails.size};
  }
 }
 throw new Error('This audience is too large to copy at once. Choose a smaller segment.');
}
