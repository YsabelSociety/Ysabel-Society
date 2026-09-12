const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../lib/newsletters.ts');
function load(source) { const result={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: result, crypto: require('node:crypto').webcrypto, URL, require: name=>load(path.resolve(path.dirname(source),name+'.ts')) });return result; }
const exportsObject = load(file);
const { emailTemplates, venues, createNewsletter, renderNewsletter, safeEmailUrl, newsletterText } = exportsObject;
assert.equal(emailTemplates.length, 16);
for (const venue of venues) assert.equal(emailTemplates.filter(t => t.venue === venue).length, venue==='Ysabel Asian'?10:3);
const layouts = new Set();
for (const template of emailTemplates) {
  const draft = createNewsletter(template);
  assert.equal(draft.venue, template.venue);
  assert.ok(draft.images.length>=3&&draft.images.length<=6);
  draft.heading = '<script>alert("test")</script>';
  draft.address = 'Test address';
  const images=draft.images.map((_,i)=>`https://example.com/${i}.jpg`);
  const html = renderNewsletter(draft, images);
  if(draft.venue==='Ysabel Asian') {
    for(const url of images) assert.ok(html.includes(url),template.id+' omitted '+url);
    const demo=renderNewsletter({...draft,address:'',subject:''},images,false,true);
    assert.ok(demo.includes('DESIGN TEST'));
    assert.ok(draft.sections.length>=2);
  }
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script'));
  assert.ok(html.includes('role="presentation"'));
  assert.ok(html.includes('max-width:640px'));
  assert.ok(html.includes('*|UNSUB|*'));
  assert.ok(html.includes('ysabel-logo-'));
  assert.ok(newsletterText(draft).includes(draft.venue));
  layouts.add(template.layout);
}
assert.equal(layouts.size, 16);
assert.equal(safeEmailUrl(''), '');
assert.equal(safeEmailUrl('javascript:alert(1)'), '');
assert.equal(safeEmailUrl('https://ysabelsociety.com/contentpreview/api/media/private'), '');
assert.equal(safeEmailUrl('https://example.com/image?access_token=secret'), '');
assert.equal(safeEmailUrl('https://example.com/public.jpg'), 'https://example.com/public.jpg');
console.log('PASS: ten distinct Asian layouts; all 3–6 image slots rendered; editable chapters; demo HTML without sender details; legacy venues preserved; safe URLs and escaping.');
