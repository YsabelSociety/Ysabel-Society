import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnalysis,analysisKey} from '../src/lib/review-ai.ts';
import {classifyReview} from '../apps/marketingdata/lib/review-language.ts';
const original='Fantastic view, but our booking was lost.';
const analysis={language:'en',englishText:original,categories:['Atmosphere','Reservations'],criticisms:[{topic:'Reservations',excerpt:'our booking was lost',explanation:'The guest reports a lost booking.',severity:'concern',confidence:'high'}]};
test('requires original evidence rather than invented allegations',()=>{
 assert.equal(validateAnalysis(analysis,original).criticisms.length,1);
 assert.throws(()=>validateAnalysis({...analysis,criticisms:[{...analysis.criticisms[0],excerpt:'the food was rotten'}]},original));
 assert.throws(()=>validateAnalysis({...analysis,englishText:''},original));
});
test('five-star reviews use AI findings and preserve mixed praise',()=>{
 assert.deepEqual(classifyReview({text:original,rating:5,reviewAnalysis:analysis}).criticisms,analysis.criticisms);
 assert.deepEqual(classifyReview({text:'The service was not bad',rating:5,reviewAnalysis:{...analysis,criticisms:[]}}).criticisms,[]);
});
test('changed text and rating invalidate AI cache while avatar updates do not',()=>{
 const r={id:'abc',accountId:'file',text:original,rating:5};
 assert.notEqual(analysisKey(r),analysisKey({...r,text:original+' Updated.'}));
 assert.notEqual(analysisKey(r),analysisKey({...r,rating:4}));
 assert.equal(analysisKey(r),analysisKey({...r,avatar:'https://example.com/a.png'}));
});
test('new hospitality detector invalidates cached analysis for rechecking',()=>{
 const r={id:'abc',accountId:'file',text:original,rating:5};
 assert.notEqual(analysisKey(r),analysisKey(r,'review-v1'));
});
const concerns=text=>classifyReview({text,rating:5}).criticisms.map(c=>c.topic);
test('hospitality detects team treatment in mixed reviews, regardless of stars',()=>{
 for(const text of [
  'The food was great but the waiters were very rude. They ruined my day.',
  'The security check was so mean and the behaviour was extremely bad.',
  'The servant was disrespectful while clearing the table.',
  'The servant cleared our table. Nothing less than disrespect!',
  'They treated us like an inconvenience.',
  'Stafi na trajtoi shumë keq.',
  'Our hostess was condescending and dismissive.',
 ]) assert(concerns(text).includes('Hospitality'),text);
});
test('hospitality preserves praise, negation and attribution to other guests',()=>{
 for(const text of [
  'Our waiter was extremely polite, professional and friendly. His attitude was excellent.',
  'The staff were not rude and never dismissive.',
  'The security team was not mean or hostile.',
  'There was no disrespect from our waiter.',
  'Other guests were rude but the staff were friendly.',
  'The waiter was friendly, but another guest was rude.',
  'The staff were lovely. They were never insulting.',
  'Our waiter brought the wrong dish.',
 ]) assert(!concerns(text).includes('Hospitality'),text);
 assert(concerns('Our waiter brought the wrong dish.').includes('Service'));
});
test('AI hospitality findings require original guest-treatment evidence',()=>{
 const text='Great food, but the hostess talked down to us.';
 const finding={topic:'Hospitality',excerpt:'the hostess talked down to us',explanation:'The guest reports condescending treatment by the hostess.',severity:'concern',confidence:'high'};
 const result=validateAnalysis({...analysis,englishText:text,categories:[],criticisms:[finding]},text);
 assert(result.categories.includes('Hospitality'));
 assert.throws(()=>validateAnalysis({...analysis,englishText:text,criticisms:[{...finding,excerpt:'the manager shouted at us'}]},text));
});
