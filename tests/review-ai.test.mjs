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
