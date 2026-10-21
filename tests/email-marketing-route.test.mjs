import test from 'node:test';
import assert from 'node:assert/strict';
import {GET,HEAD} from '../src/app/marketingdata/email-marketing/route.ts';
test('legacy Email Marketing bookmarks open the native authenticated category without fetching the old embed',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw new Error('No upstream fetch expected');});
 for(const handler of [GET,HEAD]){const response=await handler();assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/marketingdata#Email%20Marketing');assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(await response.text(),'');assert.equal(response.headers.get('set-cookie'),null);}
});
