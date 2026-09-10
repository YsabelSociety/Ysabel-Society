import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../apps/contentpreview/package.json', import.meta.url));
const ts = require('typescript');
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const data = {};
vm.runInNewContext(compile(readFileSync('apps/contentpreview/lib/occasions.ts', 'utf8')), { exports: data });
const { occasions, eventsOnDate, nthWeekday } = data;

test('almanac has unique valid sourced dates through New Year 2028', () => {
  assert.ok(occasions.length >= 100);
  assert.equal(new Set(occasions.map(event => event.id)).size, occasions.length);
  for (const event of occasions) {
    assert.ok(event.date >= '2026-09-01' && event.date <= '2028-01-01');
    assert.equal(new Date(event.date).toISOString().slice(0, 10), event.date);
    assert.ok(event.source.startsWith('https://'));
    assert.ok(event.idea.length > 25);
    if (event.endDate) assert.ok(event.endDate >= event.date);
  }
  assert.ok(eventsOnDate('2028-01-01').some(event => event.title === 'New Year’s Day'));
  assert.equal(eventsOnDate('2028-01-02').length, 0);
  console.log(`${occasions.length} dated occasions verified`);
});
test('moving weekday dates and multi-day events are accurate', () => {
  assert.equal(nthWeekday(2027, 6, 6, 2), '2027-06-12');
  assert.equal(nthWeekday(2027, 6, 6, 3), '2027-06-19');
  assert.equal(nthWeekday(2027, 5, 6, 3), '2027-05-15');
  assert.equal(nthWeekday(2027, 8, 5, 1), '2027-08-06');
  assert.ok(eventsOnDate('2027-10-03').some(event => event.title.includes('Oktoberfest')));
  assert.ok(!eventsOnDate('2027-10-04').some(event => event.title.includes('Oktoberfest')));
  assert.ok(eventsOnDate('2027-03-10').some(event => event.title.includes('Eid') && event.status === 'Tentative'));
  assert.ok(!occasions.some(event => event.title.includes('Sunny Hill')));
});
test('calendar renders semantic navigation, source links and uncertainty labels', () => {
  const component = {};
  const localRequire = id => id === '@/lib/occasions' ? data : id.endsWith('.css') ? {} : require(id);
  vm.runInNewContext(compile(readFileSync('apps/contentpreview/components/occasions-calendar.tsx', 'utf8')), { exports: component, require: localRequire });
  const html = require('react-dom/server').renderToStaticMarkup(require('react').createElement(component.default));
  for (const text of ['Occasions &amp; celebrations', 'All dates', 'Choose occasion month', 'January 2028', 'Dates to confirm', 'Check source', 'Search occasions']) assert.ok(html.includes(text), text);
  const workspace = readFileSync('apps/contentpreview/components/ysabel-workspace.tsx', 'utf8');
  assert.ok(workspace.includes("{ label: 'Occasions', value: 'occasions', icon: CalendarHeart }"));
  assert.ok(workspace.includes("{section === 'occasions' && <OccasionsCalendar />}"));
  assert.ok(readFileSync('apps/contentpreview/components/occasions-calendar.css', 'utf8').includes('overflow-y:auto'));
});
