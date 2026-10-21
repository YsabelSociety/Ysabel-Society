// Preserve existing bookmarks while the native Email Marketing view replaces
// the former MailSignal embed. Authentication remains on the destination app.
export const dynamic = 'force-dynamic';
export function GET(){return new Response(null,{status:302,headers:{Location:'/marketingdata#Email%20Marketing','Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive'}});}
export const HEAD=GET;
