import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/app/marketingdata/email-marketing/route.ts';

const original = '<!doctype html><html><head><script type="module" src="/mailsignal/app.js"></script></head><body><form id="connect-form"></form><main>Original MailSignal workspace</main></body></html>';
const sourceCsp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

test('anonymous requests never fetch MailSignal or receive its workspace', async t => {
  t.mock.method(globalThis,'fetch',()=>{throw new Error('Must not fetch');});
  const response = await GET(new Request('https://ysabelsociety.com/marketingdata/email-marketing'));
  assert.equal(response.status,401);
  assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.doesNotMatch(await response.text(),/Original MailSignal/);
});

test('the complete original app is returned after validation; credentials stay with their existing services', async t => {
  const calls = [];
  t.mock.method(globalThis,'fetch',async (target, options)=>{
    calls.push(String(target));
    if(calls.length===1){
      assert.equal(String(target),'https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/state');
      assert.deepEqual(options.headers,{cookie:'ys_marketing_session=existing'});
      assert.equal(options.redirect,'manual');
      return Response.json({ok:true});
    }
    assert.equal(String(target),'https://ysabel-mailsignal.netlify.app/mailsignal');
    assert.equal(options.headers,undefined);
    assert.equal(options.redirect,'error');
    return new Response(original,{headers:{'Content-Type':'text/html','Content-Security-Policy':sourceCsp,'X-Frame-Options':'DENY'}});
  });
  const response = await GET(new Request('https://ysabelsociety.com/marketingdata/email-marketing?source=https://untrusted.example', {headers:{cookie:'_ga=unrelated; ys_marketing_session=existing; ys_marketing_admin=private; mail-signal-key=private',Authorization:'Bearer must-not-forward'}}));
  assert.equal(response.status,200);
  assert.equal(await response.text(),original);
  assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');
  assert.equal(response.headers.get('content-security-policy'),sourceCsp.replace("frame-ancestors 'none'; ",'')+"; frame-ancestors 'self'");
  assert.equal(response.headers.get('x-ysabel-email-marketing'),'mailsignal-original');
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(calls.length,2);
});

test('invalid sessions and authentication redirects cannot expose the embedded app', async t => {
  for(const status of [401,403,302,303,307,308,500]){
    let calls=0;
    t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(null,{status});});
    const response=await GET(new Request('https://ysabelsociety.com/marketingdata/email-marketing',{headers:{cookie:'ys_marketing_session=invalid'}}));
    assert.equal(response.status,status===500?503:401);
    assert.equal(calls,1);
    t.mock.restoreAll();
  }
});

test('source failures and unexpected HTML remain explicit errors', async t => {
  for(const failure of [new Response('broken',{status:503}),new Response('<html>Unexpected sign-in</html>',{headers:{'Content-Type':'text/html'}})]){
    let calls=0;
    t.mock.method(globalThis,'fetch',async()=>++calls===1?Response.json({ok:true}):failure);
    const response=await GET(new Request('https://ysabelsociety.com/marketingdata/email-marketing',{headers:{cookie:'ys_marketing_session=existing'}}));
    assert.equal(response.status,502);
    assert.doesNotMatch(await response.text(),/Original MailSignal/);
    t.mock.restoreAll();
  }
});
