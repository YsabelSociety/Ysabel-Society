const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/carousel-cover.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { replaceCarouselCover, replaceCoverInFeed, saveCoverChange } = moduleUnderTest.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const post = Object.freeze({ id: 'cover', name: 'Italian evening', format: 'Carousel', category: 'Italian', status: 'Published', plannedDate: '2026-11-15', caption: 'Our evening together.', notes: 'Keep the dishes in this order', slides: Object.freeze(['food', 'video', 'room']), url: 'old.jpg', cropX: 20, cropY: 60, cropZoom: 125 });
const media = Object.freeze({ id: 'new', name: 'New upload', format: 'Photo', category: 'Other', status: 'Concept', plannedDate: null, caption: '', notes: '', slides: Object.freeze([]), url: 'new.jpg', cropX: 50, cropY: 50, cropZoom: 100 });
const feed = Object.freeze(['cover', 'other', null, ...Array(9).fill(null)]);
const publication = JSON.stringify({ positions: feed, assets: [post] });
const replaced = replaceCarouselCover(post, media);
assert.deepEqual(plain(replaced.slides), ['food', 'video', 'room']);
for (const key of ['name','format','category','status','plannedDate','caption','notes']) assert.equal(replaced[key], post[key]);
for (const key of ['id','url','cropX','cropY','cropZoom']) assert.equal(replaced[key], media[key]);
assert.deepEqual(plain(replaceCarouselCover(post, media, 'video').slides), ['food','cover','room'], 'Existing slide becomes the cover; old cover takes its place');
assert.deepEqual(plain(replaceCoverInFeed(feed,'cover','new')), ['new','other',null,...Array(9).fill(null)]);
assert.equal(feed[0], 'cover'); assert.equal(post.url, 'old.jpg'); assert.equal(media.name, 'New upload');
for (const count of [1,2,7,21,40]) {
  const original = {...post, slides: Array.from({length:count-1},(_,i)=>`slide-${i}`)};
  assert.equal(replaceCarouselCover(original,media).slides.length + 1, count);
  for (const id of original.slides) {
    const next = replaceCarouselCover(original,media,id);
    assert.equal(next.slides.length + 1,count); assert.ok(next.slides.includes(post.id)); assert.ok(!next.slides.includes(id));
    assert.equal(new Set(next.slides).size, count-1);
  }
}
(async () => {
  const events = [];
  const result = await saveCoverChange({post,media,readFeed:()=>feed,saveAsset:async asset=>events.push(['asset',plain(asset)]),savePositions:async positions=>events.push(['positions',plain(positions)])});
  assert.equal(events[0][0], 'asset'); assert.deepEqual(events[0][1].slides, ['food','video','room']);
  assert.equal(events[1][0], 'positions'); assert.equal(result.previousFeed,feed);
  for (const failedStep of ['asset','positions']) {
    const calls = [];
    await assert.rejects(saveCoverChange({post,media,readFeed:()=>feed,saveAsset:async()=>{calls.push('asset'); if(failedStep==='asset') throw Error('offline');},savePositions:async()=>{calls.push('positions'); throw Error('offline');}}),/offline/);
    assert.deepEqual(calls,failedStep==='asset'?['asset']:['asset','positions']); assert.equal(feed[0],'cover');
  }
  assert.equal(JSON.stringify({positions:feed,assets:[post]}),publication,'Published snapshot must remain unchanged until explicit Publish');
  let changes = 0;
  await saveCoverChange({post,media,readFeed:()=>['other'],saveAsset:async()=>{},savePositions:async()=>{changes++;}});
  assert.equal(changes,0,'A removed post must never be silently inserted into another slot');
  const workspace = fs.readFileSync(path.resolve(__dirname,'../components/ysabel-workspace.tsx'),'utf8');
  assert.match(workspace,/if \(record.replacementId\) \{[\s\S]*?await saveCoverChange/);
  assert.match(workspace,/ref=\{coverInput\}[^>]*type="file"(?! multiple)/);
  assert.doesNotMatch(workspace,/replaceTarget/);
  assert.match(workspace,/coverUploadTarget\.current = null/);
  assert.match(workspace,/latestActiveBoardId\.current === record.boardId/);
  assert.match(workspace,/postAsset && !presentation && <div className="post-edit-cover"/);
  console.log('PASS: 1–40 slides preserved, existing slide promotion, metadata/framing, save order, failures, unchanged publication, board isolation and dedicated cover input.');
})().catch(error=>{console.error(error);process.exitCode=1;});
