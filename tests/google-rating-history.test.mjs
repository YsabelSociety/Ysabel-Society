import test from 'node:test';
import assert from 'node:assert/strict';
import { previousMonthRating } from '../apps/marketingdata/lib/google-rating-snapshot.ts';
test('uses latest verified observation only in previous calendar month',()=>{
 const h=[{date:'2026-08-03',rating:4.1,reviewCount:300},{date:'2026-08-28',rating:4.2,reviewCount:325},{date:'2026-09-13',rating:4.2,reviewCount:335}];
 assert.equal(previousMonthRating('2026-09-14',h).observation.reviewCount,325);
 assert.equal(previousMonthRating('2026-10-01',h).observation.reviewCount,335);
});
test('handles January rollover and missing history without substituting another month',()=>{
 assert.equal(previousMonthRating('2027-01-04',[]).month,'2026-12');
 assert.equal(previousMonthRating('2026-09-14',[{date:'2026-09-13',rating:4.2,reviewCount:335}]).observation,null);
});
