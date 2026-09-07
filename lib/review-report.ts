import {
  compareReviewsNewest,
  reviewTopics,
  safeProfileURL,
  type CommunityRecord,
} from './community';
import { type Range } from './analytics';
import { reviewMatchesDates, reviewDateBounds } from './review-dates';

export type ReviewReportFilters = {
  stars: number[];
  topic:
    | 'Food & drinks'
    | 'Food'
    | 'Drinks'
    | 'Service & staff'
    | 'Atmosphere'
    | 'Waiting time'
    | 'Price & value'
    | 'Cleanliness'
    | 'All topics';
  evidence: 'Criticism detected' | 'All matching reviews';
  period: 'All imported reviews' | 'Selected dates';
  search: string;
  approximateDates?: boolean;
  periodLabel?: string;
};
export type ReportReview = CommunityRecord & ReturnType<typeof reviewTopics>;
export type ReviewReport = {
  title: string;
  generatedAt: string;
  timezone: string;
  range: Range;
  filters: ReviewReportFilters;
  rows: ReportReview[];
  issues: { topic: string; count: number; excerpt: string }[];
};
export const DEFAULT_REVIEW_FILTERS: ReviewReportFilters = {
  stars: [1, 2, 3],
  topic: 'Food & drinks',
  evidence: 'Criticism detected',
  period: 'All imported reviews',
  search: '',
};
export const reviewKey = (r: CommunityRecord) => r.accountId + ':' + r.id;

export function makeReviewReport(
  records: CommunityRecord[],
  filters: ReviewReportFilters,
  range: Range,
  timezone: string,
  title = 'Food & drink review report',
  generatedAt = new Date().toISOString(),
): ReviewReport {
  const topics =
    filters.topic === 'Food & drinks'
      ? ['Food', 'Drinks']
      : filters.topic === 'Service & staff'
        ? ['Service']
        : [filters.topic];
  const rows = records
    .filter(
      (r) =>
        r.kind === 'review' &&
        r.source === 'gbp' &&
        filters.stars.includes(r.rating || 0),
    )
    .filter(
      (r) =>
        filters.period === 'All imported reviews' ||
        reviewMatchesDates(r, range, timezone, filters.approximateDates),
    )
    .map((r) => ({ ...r, ...reviewTopics(r) }))
    .filter((r) => {
      const relevant =
        filters.evidence === 'Criticism detected'
          ? r.criticisms.map((c) => c.topic)
          : r.categories;
      return (
        (filters.topic === 'All topics'
          ? filters.evidence === 'All matching reviews' || relevant.length > 0
          : topics.some((t) => relevant.includes(t))) &&
        [r.name, r.text, r.reply]
          .join(' ')
          .toLocaleLowerCase()
          .includes(filters.search.trim().toLocaleLowerCase())
      );
    })
    .sort(compareReviewsNewest);
  const counts = new Map<
    string,
    { topic: string; count: number; excerpt: string }
  >();
  for (const r of rows)
    for (const c of r.criticisms) {
      const current = counts.get(c.topic) || {
        topic: c.topic,
        count: 0,
        excerpt: c.excerpt,
      };
      current.count++;
      counts.set(c.topic, current);
    }
  return {
    title: title.trim().slice(0, 120) || 'Google review report',
    generatedAt,
    timezone,
    range: { ...range },
    filters: { ...filters, stars: [...filters.stars] },
    rows,
    issues: [...counts.values()].sort(
      (a, b) => b.count - a.count || a.topic.localeCompare(b.topic),
    ),
  };
}

export function reviewDateLabel(r: CommunityRecord, timezone: string) {
  if (r.timePrecision === 'relative')
    return `${r.timeLabel || 'Date not supplied'} when captured on ${new Intl.DateTimeFormat('en-GB', { timeZone: timezone, dateStyle: 'medium' }).format(new Date(r.time))}${reviewDateBounds(r, timezone) ? ' · Approximate interval ' + reviewDateBounds(r, timezone)!.start + ' – ' + reviewDateBounds(r, timezone)!.end : ''}`;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    dateStyle: 'medium',
  }).format(new Date(r.time));
}
export function reviewLink(r: CommunityRecord) {
  if (safeProfileURL(r.reviewUrl))
    return {
      url: safeProfileURL(r.reviewUrl),
      label: 'Open original review',
      direct: true,
    };
  if (safeProfileURL(r.profileUrl))
    return {
      url: safeProfileURL(r.profileUrl),
      label: 'Reviewer’s Google reviews',
      direct: false,
    };
  return null;
}
export function reviewFilterLabel(report: ReviewReport) {
  return `${[...report.filters.stars].sort().join(', ')} stars · ${report.filters.topic} · ${report.filters.evidence} · ${report.filters.periodLabel || (report.filters.period === 'Selected dates' ? report.range.start + ' – ' + report.range.end : 'All imported reviews')}${report.filters.period === 'Selected dates' ? (report.filters.approximateDates ? ' · Includes possible matches from approximate date intervals; these may overlap adjacent periods' : ' · Exact dates only') : ''}${report.filters.search ? ' · Search: ' + report.filters.search : ''}`;
}
export function reportCSV(report: ReviewReport) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const headers = [
    'Stars',
    'Reviewer',
    'Review date',
    'Exact timestamp',
    'Captured at',
    'Topics',
    'Suggested criticism',
    'Full comment',
    'Owner reply',
    'Review link',
    'Link type',
    'Profile photo URL',
    'Source',
    'Record ID',
    'Report filters',
    'Report generated at',
  ];
  return (
    '\uFEFF' +
    [
      headers,
      ...report.rows.map((r) => {
        const link = reviewLink(r);
        return [
          r.rating,
          r.name,
          reviewDateLabel(r, report.timezone),
          r.timePrecision === 'relative' ? '' : r.time,
          r.timePrecision === 'relative' ? r.time : '',
          r.categories.join('; '),
          r.criticisms.map((c) => c.topic + ': ' + c.excerpt).join('\n'),
          r.text,
          r.reply,
          link?.url,
          link?.label || 'Link not supplied',
          safeProfileURL(r.avatar),
          r.origin === 'api' ? 'Google API' : 'Imported record',
          reviewKey(r),
          reviewFilterLabel(report),
          report.generatedAt,
        ];
      }),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  );
}

const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function reportHTML(
  report: ReviewReport,
  photos: Record<string, string> = {},
) {
  const groups = [...report.filters.stars]
    .sort()
    .map((star) => {
      const rows = report.rows.filter((r) => r.rating === star);
      return `<section class="rating-group"><h2>${star}-star reviews <span>${rows.length}</span></h2>${
        rows.length
          ? rows
              .map((r) => {
                const link = reviewLink(r),
                  photo = photos[reviewKey(r)];
                const safePhoto =
                  photo &&
                  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
                    photo,
                  )
                    ? photo
                    : '';
                return `<article><div class="author">${safePhoto ? `<img src="${safePhoto}" alt="Profile photo of ${esc(r.name || 'reviewer')}" width="56" height="56">` : '<span class="photo-empty">Photo unavailable</span>'}<div><h3>${esc(r.name || 'Anonymous reviewer')}</h3><p>${esc(reviewDateLabel(r, report.timezone))}</p></div><b class="stars">${'★'.repeat(star)}${'☆'.repeat(5 - star)}</b></div><div class="tags">${r.categories.map((t) => `<span>${esc(t)}</span>`).join('')}</div>${r.criticisms.length ? `<aside><b>Suggested criticism</b>${r.criticisms.map((c) => `<p><strong>${esc(c.topic)}</strong> · ${esc(c.excerpt)}</p>`).join('')}</aside>` : ''}<h4>Full comment</h4><p class="comment">${esc(r.text || 'Rating without written feedback.')}</p>${r.reply ? `<div class="reply"><h4>Ysabel Society’s reply</h4><p class="comment">${esc(r.reply)}</p></div>` : '<p class="muted">No owner reply supplied in this record.</p>'}<footer>${link ? `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)}</a>${!link.direct ? '<small>A direct review permalink was not supplied; this opens the reviewer’s Google reviews.</small>' : ''}` : '<small>Review link not supplied.</small>'}<small>${r.origin === 'api' ? 'Google API' : 'Imported record'}</small></footer></article>`;
              })
              .join('')
          : '<p>No matching reviews for this rating.</p>'
      }</section>`;
    })
    .join('');
  const missingPhotos = report.rows.filter((r) => !photos[reviewKey(r)]).length;
  const issues = report.issues
    .map(
      (v) =>
        `<div class="issue"><span>${esc(v.topic)}</span><b>${v.count} review${v.count === 1 ? '' : 's'}</b><div class="bar"><i style="width:${Math.round((v.count / report.rows.length) * 100)}%"></i></div></div>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-ysabel-print'; base-uri 'none'; form-action 'none'"><title>${esc(report.title)} — Ysabel Society</title><style>
  *{box-sizing:border-box}body{margin:0;background:#edf0ed;color:#28352f;font:16px/1.6 Arial,sans-serif}main{max-width:980px;margin:auto;padding:52px 36px}header{border-bottom:2px solid #718066;padding-bottom:28px}.eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:bold}h1{font-family:Georgia,serif;font-size:38px;line-height:1.15;margin:18px 0}h2{font-size:24px;margin:32px 0 18px}h2 span{font-size:16px;color:#536957;margin-left:12px}h3,h4,p{margin:0}h3{font-size:18px}h4{margin:18px 0 8px;font-size:14px}.muted,small,.author p{color:#596961;font-size:13px}.summary{display:flex;flex-wrap:wrap;gap:24px;margin:24px 0}.summary strong{font-size:30px;display:block}.summary div{min-width:120px}.issues{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.issue{padding:16px;border:1px solid #cad3ca;border-radius:14px}.issue b{float:right;font-size:14px}.bar{height:5px;background:#dce3dc;margin-top:10px;border-radius:8px}.bar i{display:block;height:100%;background:#677b63;border-radius:8px}article{background:white;border:1px solid #d2d9d2;border-radius:18px;padding:26px;margin:18px 0;break-inside:avoid}.author{display:flex;gap:14px;align-items:center}.author img{border-radius:50%;object-fit:cover;flex-shrink:0}.author>div{flex:1}.photo-empty{width:56px;font-size:10px;text-align:center;color:#777}.stars{color:#956631;white-space:nowrap}.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:16px}.tags span{padding:3px 10px;border-radius:20px;background:#eef2ed;font-size:12px}aside{background:#f7f2e8;border-left:3px solid #ae8e58;padding:14px;margin:18px 0;font-size:14px}aside p{margin-top:8px}.comment{white-space:pre-wrap;overflow-wrap:anywhere}.reply{margin-top:20px;padding:0 16px 16px;background:#f3f6f2}footer{border-top:1px solid #e1e7e1;margin-top:20px;padding-top:14px}footer small{display:block;margin-top:6px}a{color:#31594d;text-underline-offset:3px;overflow-wrap:anywhere}.notice{font-size:13px;line-height:1.6;margin-top:18px}button{font:inherit;border:0;background:#415b4c;color:white;padding:10px 18px;border-radius:30px;cursor:pointer}.screen{display:flex;justify-content:flex-end;margin-bottom:18px}@media(max-width:600px){main{padding:24px 16px}.issues{grid-template-columns:1fr}.author{flex-wrap:wrap}h1{font-size:30px}}@media print{@page{size:A4;margin:15mm}body{background:white}main{padding:0;max-width:none}.screen{display:none}article{border-radius:0;padding:18px;box-shadow:none}.rating-group{break-before:page}.rating-group:first-of-type{break-before:auto}header{break-inside:avoid}.notice{font-size:10pt}h1{font-size:26pt}a{color:#28352f}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><main><div class="screen"><button id="print-report">Print / Save as PDF</button></div><header><div class="eyebrow">Ysabel Society · Internal use</div><h1>${esc(report.title)}</h1><p>${esc(reviewFilterLabel(report))}</p><p class="muted">Created ${esc(new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: report.timezone }).format(new Date(report.generatedAt)))} · ${esc(report.timezone)}</p></header><div class="summary"><div><strong>${report.rows.length}</strong>Matching reviews</div>${[
    ...report.filters.stars,
  ]
    .sort()
    .map(
      (s) =>
        `<div><strong>${report.rows.filter((r) => r.rating === s).length}</strong>${s}-star reviews</div>`,
    )
    .join(
      '',
    )}</div><h2>Most frequent criticism in this selection</h2><div class="issues">${issues || '<p>No explicit criticism matched the supported wording.</p>'}</div><p class="notice">Topic and criticism labels are context-based suggestions. Verify the full comment before acting. Counts are reviews mentioning an issue; one review can mention several. A low rating alone is not proof of a food or drink complaint. Relative dates retain Google’s original label. When enabled, approximate interval matches may overlap neighbouring periods; they are not exact daily counts.${missingPhotos ? ` ${missingPhotos} profile photo${missingPhotos === 1 ? ' was' : 's were'} not available to embed.` : ' Profile photos are embedded for offline use.'}</p>${groups}</main><script nonce="ysabel-print">document.getElementById('print-report').addEventListener('click',function(){window.print()});</script></body></html>`;
}
