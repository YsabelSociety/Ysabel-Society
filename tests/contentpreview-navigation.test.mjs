import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('apps/contentpreview/components/ysabel-workspace.tsx', 'utf8');

test('navigation removes comparison and standalone publication calendar without removing Notes or Occasions', () => {
  const nav = source.slice(source.indexOf('  const navItems:'), source.indexOf('  const navItems:') + 850);
  for (const section of ['feed', 'media', 'occasions', 'notes', 'captions', 'archive']) assert.ok(nav.includes(`value: '${section}'`));
  for (const section of ['calendar', 'versions']) {
    assert.ok(!nav.includes(`value: '${section}'`));
    assert.ok(!source.includes(`section === '${section}'`));
  }
  assert.ok(!source.includes('Publication rhythm'));
  assert.ok(!source.includes('concept-compare'));
  assert.ok(source.includes('notes-calendar-grid'));
  assert.ok(source.includes('notes-history'));
  assert.ok(source.includes('const updateNote ='));
  assert.ok(source.includes('<OccasionsCalendar />'));
});
