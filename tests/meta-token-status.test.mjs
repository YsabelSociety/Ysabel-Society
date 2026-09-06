import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedMetaExpiry } from '../lib/meta-token-status.ts';
const now = 1788660000000;
test('Meta zero/missing expiry is revalidated rather than treated as expired', () => {
  assert.equal(verifiedMetaExpiry({is_valid:true,app_id:'123',expires_at:0},'123',now), now + 3600000);
  assert.equal(verifiedMetaExpiry({is_valid:true,app_id:'123'},'123',now), now + 3600000);
});
test('provider token and data-access expiry are both enforced', () => {
  assert.equal(verifiedMetaExpiry({is_valid:true,app_id:'123',expires_at:now/1000+7200,data_access_expires_at:now/1000+3600},'123',now), now+3600000);
  for (const fields of [{is_valid:false,app_id:'123'}, {is_valid:true,app_id:'other'}, {is_valid:true,app_id:'123',expires_at:now/1000-1}, {is_valid:true,app_id:'123',data_access_expires_at:now/1000-1}]) assert.throws(()=>verifiedMetaExpiry(fields,'123',now));
});
