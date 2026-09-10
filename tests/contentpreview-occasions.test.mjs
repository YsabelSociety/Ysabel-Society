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
const { occasions, eventsOnDate, eventsStartingOnDate, eventsStartingInMonth, eventsContinuingIntoMonth, nthWeekday } = data;

test('almanac has unique valid sourced dates through New Year 2028', () => {
  assert.ok(occasions.length >= 100);
  assert.equal(new Set(occasions.map(event => event.id)).size, occasions.length);
  for (const event of occasions) {
    assert.ok(event.date >= '2026-09-01' && event.date <= '2028-01-01');
    assert.equal(new Date(event.date).toISOString().slice(0, 10), event.date);
    assert.ok(event.source.startsWith('https://') || (event.special && event.title === 'Ysabel Society Birthday'));
    assert.ok(event.idea.length > 25);
    assert.ok(event.themes.length > 0);
    assert.ok(event.themes.every(theme => data.occasionThemes.includes(theme)));
    if (event.endDate) assert.ok(event.endDate >= event.date);
  }
  assert.ok(eventsOnDate('2028-01-01').some(event => event.title === 'New Year’s Day'));
  assert.equal(eventsOnDate('2028-01-02').length, 0);
  console.log(`${occasions.length} dated occasions verified`);
});
test('multi-day occasions render only once in calendar cells, including across months', () => {
  for (const event of occasions.filter(event => event.endDate)) {
    let tileCount = 0;
    for (let date = new Date(event.date); date <= new Date(event.endDate); date.setUTCDate(date.getUTCDate() + 1)) {
      const iso = date.toISOString().slice(0, 10);
      tileCount += eventsStartingOnDate(iso).filter(item => item.id === event.id).length;
      assert.equal(eventsOnDate(iso).filter(item => item.id === event.id).length, 1);
    }
    assert.equal(tileCount, 1, event.title);
  }
  const october = eventsStartingInMonth('2026-10');
  const carryover = eventsContinuingIntoMonth('2026-10');
  assert.ok(!october.some(event => event.title.includes('Oktoberfest')));
  assert.equal(carryover.filter(event => event.title.includes('Oktoberfest')).length, 1);
  assert.equal(new Set([...october, ...carryover].map(event => event.id)).size, october.length + carryover.length);
  assert.ok(!eventsContinuingIntoMonth('2026-11').some(event => event.title.includes('Oktoberfest')));
  const annualKeys = occasions.map(event => `${event.date.slice(0, 4)}:${event.title}`);
  assert.equal(new Set(annualKeys).size, annualKeys.length, 'No duplicate celebration within a year');
});

test('Ysabel birthday is a special annual occasion on 15 November without duplicates', () => {
  for (const year of [2026, 2027]) {
    const birthdays = eventsStartingOnDate(`${year}-11-15`).filter(event => event.title === 'Ysabel Society Birthday');
    assert.equal(birthdays.length, 1);
    assert.equal(birthdays[0].special, true);
    assert.equal(birthdays[0].themes.length, 4);
  }
  assert.ok(!data.occasionsToConfirm.some(event => event.title.includes('anniversary')));
});
test('researched cuisine dates, theme tags and variable wine dates are preserved', () => {
  for (const [date, title, theme] of [
    ['2027-01-17', 'Vera Pizza Day — Neapolitan pizza', 'Ysabel Italian'],
    ['2027-03-21', 'Tiramisù Day', 'Ysabel Italian'],
    ['2027-03-24', 'European Artisanal Gelato Day', 'Ysabel Italian'],
    ['2027-04-06', 'Carbonara Day', 'Ysabel Italian'],
    ['2027-04-13', 'Songkran — Thai New Year', 'Ysabel Asian'],
    ['2027-07-11', 'Ramen Day — Japan', 'Ysabel Asian'],
    ['2026-10-01', 'Sake Day', 'Ysabel Asian'],
    ['2027-11-24', 'Washoku Day — Japanese food culture', 'Ysabel Asian'],
    ['2026-10-23', 'Champagne Day', 'Bar & wine'],
    ['2027-10-22', 'Champagne Day', 'Bar & wine'],
  ]) assert.ok(eventsStartingOnDate(date).some(event => event.title === title && event.themes.includes(theme)), title);
  assert.ok(eventsStartingOnDate('2026-09-26').some(event => event.title === 'Dumpling Day' && event.status === 'Informal occasion'));
  assert.ok(!occasions.some(event => event.title.includes('Week of Italian Cuisine')));
  assert.ok(data.occasionsToConfirm.some(event => event.title.includes('Week of Italian Cuisine')));
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
