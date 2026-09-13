import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGoogleOwnerReviews } from '../apps/marketingdata/lib/google-owner-review-import.ts';
const profileId = '113096679873392759466';
const review = {profileId,name:'Guest',profileUrl:`https://www.google.com/maps/contrib/${profileId}/reviews`,rating:3,timeLabel:'Yesterday',text:'Food was disappointing.',details:'Food: 2/5Service: 5/5'};
const snapshot = reviews => JSON.stringify({businessId:'2654256529003455405',capturedAt:'2026-09-13T12:00:00Z',reviews});
test('matches prior import identifiers and keeps historical dates and replies',()=>{
 const old={source:'gbp',kind:'review',accountId:'file',id:'manager-legacy-id',profileUrl:review.profileUrl,time:'2026-08-01T12:00:00Z',reply:'Thank you',text:'Older text'};
 const result=prepareGoogleOwnerReviews(snapshot([review]),[old]);
 assert.equal(result.added,0); assert.equal(result.updated,1);
 assert.match(result.batches[0],/manager-legacy-id/);assert.match(result.batches[0],/2026-08-01T12:00:00Z/);assert.match(result.batches[0],/Thank you/);
});
test('new reviews retain honest relative date precision and complete criticism',()=>{
 const result=prepareGoogleOwnerReviews(snapshot([review]),[]);
 assert.equal(result.added,1);assert.match(result.batches[0],/2026-09-12T12:00:00.000Z/);
 assert.match(result.batches[0],/relative/);assert.match(result.batches[0],/Food was disappointing/);
});
test('does not duplicate API reviews or remove missing history',()=>{
 const existing=[{source:'gbp',kind:'review',accountId:'api-location',profileUrl:review.profileUrl},{source:'gbp',kind:'review',accountId:'file',profileUrl:'https://www.google.com/maps/contrib/111111111111111111111/reviews'}];
 const result=prepareGoogleOwnerReviews(snapshot([review]),existing);
 assert.equal(result.batches.length,0);assert.equal(result.skipped,1);assert.equal(result.retained,1);
});
test('rejects a different business, invalid ratings and duplicate profiles',()=>{
 assert.throws(()=>prepareGoogleOwnerReviews(snapshot([review]).replace('2654256529003455405','other'),[]));
 assert.throws(()=>prepareGoogleOwnerReviews(snapshot([{...review,rating:0}]),[]));
 assert.throws(()=>prepareGoogleOwnerReviews(snapshot([review,review]),[]));
});
