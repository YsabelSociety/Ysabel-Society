import assert from 'node:assert/strict';
import test from 'node:test';
import { websiteStatus, googleScopes } from '../lib/source-status.ts';

test('saving an account never claims reports are connected', () => {
  for (const status of ['Authorized', 'Connected', 'Syncing']) {
    const view = websiteStatus({channel:'Website', status, lastSync:null});
    assert.match(view.title, /not been verified/);
  }
});
test('a failed first import remains an access error', () => {
  const view = websiteStatus({channel:'Website', status:'Needs Attention', lastSync:null});
  assert.match(view.title, /needs attention/);
  assert.match(view.detail, /not allowed a successful/);
});
test('an empty successful report is distinct from failed access', () => {
  const view = websiteStatus({channel:'Website', status:'Connected', lastSync:'2026-09-06T02:00:00Z'});
  assert.match(view.title, /^Connected/);
  assert.match(view.detail, /no daily activity/);
});
test('refresh failures do not hide previously imported data', () => {
  assert.match(websiteStatus({channel:'Website', status:'Needs Attention', lastSync:'2026-09-06T02:00:00Z'}, true).detail, /Previously imported reports remain available/);
});
test('Analytics sign-in defaults to read-only without business management', () => {
  for (const option of [null, 'ga4', 'unknown']) {
    assert.deepEqual(googleScopes(option), ['https://www.googleapis.com/auth/analytics.readonly']);
  }
  assert.deepEqual(googleScopes('gbp'), ['https://www.googleapis.com/auth/business.manage']);
  assert.equal(googleScopes('both').length, 2);
});
