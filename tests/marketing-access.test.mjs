import test from 'node:test';
import assert from 'node:assert/strict';
import { appPath, safeReturnPath } from '../lib/app-path.ts';
import { passwordHash, constantEqual } from '../lib/password.ts';
import { websiteReportFilter, websiteStreamFilter } from '../lib/website-source.ts';

test('dashboard paths stay inside the website mount', () => {
  assert.equal(appPath('/api/analytics'), '/marketingdata/api/analytics');
  assert.equal(appPath('/marketingdata/admin'), '/marketingdata/admin');
  assert.equal(appPath('https://www.instagram.com/ysabelsociety'), 'https://www.instagram.com/ysabelsociety');
  for (const bad of ['//evil.com', '/marketingdataevil', '/marketingdata/../../outside', '/marketingdata/\\evil.com', '/marketingdata/api/session', '/marketingdata/login']) assert.equal(safeReturnPath(bad), '/marketingdata/');
  assert.equal(safeReturnPath('/marketingdata/connections?connect=meta'), '/marketingdata/connections?connect=meta');
});
test('password verification uses a salted derivation', async () => {
  const a = await passwordHash('example-for-tests', 'salt-one');
  assert.equal(a.length, 128);
  assert.equal(constantEqual(a, await passwordHash('example-for-tests', 'salt-one')), true);
  assert.equal(constantEqual(a, await passwordHash('wrong', 'salt-one')), false);
  assert.notEqual(a, await passwordHash('example-for-tests', 'salt-two'));
});
test('every website report preserves host and stream restrictions with extra filters', () => {
  const eventFilter = { filter: { fieldName: 'eventName', stringFilter: { value: 'reservation' } } };
  const filters = websiteReportFilter(eventFilter).andGroup.expressions;
  assert.deepEqual(filters[0], websiteStreamFilter);
  assert.deepEqual(filters[1].filter.inListFilter.values, ['ysabelsociety.com', 'www.ysabelsociety.com']);
  assert.equal(filters[2].notExpression.filter.stringFilter.value, '/marketingdata');
  assert.equal(filters[3], eventFilter);
});
