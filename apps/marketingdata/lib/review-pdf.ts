import { jsPDF } from 'jspdf';
import { reviewTopics, safeProfileURL, type CommunityRecord } from './community';
import { reviewDateLabel, reviewLink } from './review-report';
import { reviewCategoryLabel } from './review-categories';
import type { ReportBundle, ReportProgress } from './report-bundle';
import { localDate } from './community';
import { reviewRatingComparison, ratingChangeLabel, ratingPeriodNote } from './review-rating-comparison';

type ReviewAssets = {
  regular: Uint8Array;
  bold: Uint8Array;
  logo: Uint8Array;
  photos?: Map<string, Uint8Array>;
  attachments?: Map<string, Uint8Array>;
};
const key = (r: CommunityRecord) => `${r.source}:${r.accountId}:${r.id}`;
const binary = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192)
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
};

/** Review-only exports flow continuously; long comments and photo sets are never truncated. */
export async function createCompactReviewPDF(
  bundle: ReportBundle,
  reviews: CommunityRecord[],
  uncertainReviews: CommunityRecord[],
  assets: ReviewAssets,
  progress: ReportProgress,
  signal?: AbortSignal,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('Noto-Regular.ttf', binary(assets.regular));
  doc.addFont('Noto-Regular.ttf', 'Noto', 'normal');
  doc.addFileToVFS('Noto-Bold.ttf', binary(assets.bold));
  doc.addFont('Noto-Bold.ttf', 'Noto', 'bold');
  doc.setFont('Noto');
  doc.setProperties({ title: bundle.title, subject: 'Ysabel Society - guest review report', author: 'Ysabel Society', creator: 'arberhalili.com' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 36, C = W - M * 2, B = H - 45;
  let y = 148, currentGuest = '', sequence = 0;
  const framedPages = new Set<number>();
  const check = () => { if (signal?.aborted) throw new DOMException('Report cancelled', 'AbortError'); };
  const gradients = new Map<string, string>();
  // Native PDF shading stays smooth at every zoom level and reuses compact color resources.
  const gradient = (x: number, top: number, width: number, height: number, start: string, end: string, middle?: string) => {
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const colors = start + end + (middle || '');
    doc.advancedAPI(pdf => {
      let key = gradients.get(colors);
      if (!key) {
        key = `sr-gradient-${gradients.size}`; gradients.set(colors, key);
        const stops = middle ? [{ offset: 0, color: rgb(start) }, { offset: .55, color: rgb(middle) }, { offset: 1, color: rgb(end) }]
          : [{ offset: 0, color: rgb(start) }, { offset: 1, color: rgb(end) }];
        pdf.addShadingPattern(key, pdf.ShadingPattern('axial', [0, 0, 1, middle ? .3 : 0], stops));
      }
      pdf.rect(x, top, width, height); pdf.fill({ key, matrix: pdf.Matrix(width, 0, 0, height, x, top) });
    });
  };
  type Surface = { start: string; middle: string; end: string; ink: string; accent: string };
  const categorySurfaces: Record<string, Surface> = {
    overall: { start: '#CCE0D7', middle: '#E1EFE8', end: '#F6FBF8', ink: '#28533E', accent: '#4C785F' },
    food: { start: '#F2DCAF', middle: '#F9EBCF', end: '#FFF9EC', ink: '#85601E', accent: '#B88B36' },
    drinks: { start: '#EDD1DE', middle: '#F6E3EC', end: '#FFF7FA', ink: '#805069', accent: '#AC748F' },
    service: { start: '#CDDFEB', middle: '#E1EEF5', end: '#F5FAFF', ink: '#386781', accent: '#5789A5' },
    atmosphere: { start: '#DED4EB', middle: '#EEE7F6', end: '#FAF7FF', ink: '#695282', accent: '#9279AE' },
  };
  const criticismSurface: Surface = { start: '#ECD3E4', middle: '#F5E3F0', end: '#FDF6FB', ink: '#703E64', accent: '#9C5C87' };
  const reviewSurface: Surface = { start: '#EDF3EF', middle: '#F5F8F5', end: '#FEFEFC', ink: '#35463C', accent: '#52765F' };
  const commentSurface: Surface = { start: '#E4EBE3', middle: '#F0F3EA', end: '#FDFEF9', ink: '#1D3428', accent: '#52765F' };
  const mix = (a: string, b: string, amount: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
  const card = (x: number, top: number, width: number, height: number, surface: Surface, radius = 6) => {
    doc.saveGraphicsState(); doc.roundedRect(x, top, width, height, radius, radius, null); doc.clip(); doc.discardPath();
    gradient(x, top, width, height, surface.start, surface.end, surface.middle); doc.restoreGraphicsState();
    doc.setDrawColor(mix(surface.start, '#FFFFFF', .5)); doc.setLineWidth(.3);
    doc.roundedRect(x + .2, top + .2, width - .4, height - .4, radius, radius, 'S');
  };
  const clean = (value: string) => Array.from(value.normalize('NFC')).map(c => {
    if ('\n\r\t'.includes(c)) return c;
    const metadata = doc.getFont().metadata as any;
    return metadata.characterToGlyph && !metadata.characterToGlyph(c.codePointAt(0))
      ? `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]` : c;
  }).join('');
  const text = (value: string | string[], x: number, top: number, size = 9, color = '#33443c', bold = false) => {
    doc.setFont('Noto', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    doc.text(Array.isArray(value) ? value.map(clean) : clean(value), x, top, { lineHeightFactor: (size + 3) / size });
  };
  const brandLogo = (width: number) => {
    // Display the original dark artwork without its transparent outer margins.
    // The PNG remains untouched and is embedded once; PDF clipping preserves every logo detail.
    const scale = width / 972, height = 702 * scale;
    doc.saveGraphicsState(); doc.rect(M, 15, width, height, null); doc.clip(); doc.discardPath();
    doc.addImage(assets.logo, 'PNG', M - 314 * scale, 15 - 99 * scale, 1600 * scale, 900 * scale, 'ysabel-logo', 'FAST');
    doc.restoreGraphicsState();
    return height;
  };
  const frame = (cover = false) => {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (framedPages.has(page)) return;
    framedPages.add(page);
    const width = cover ? 132 : 96, height = brandLogo(width), left = M + width + 26;
    text('GOOGLE BUSINESS', left, 15 + height / 2 - 2, 11, '#1D3428', true);
    text('Ysabel Society / Guest reviews & comments', left, 15 + height / 2 + 14, 8, '#708078');
    const edge = cover ? 126 : 98;
    doc.setDrawColor('#e4e9e4'); doc.setLineWidth(.5); doc.line(M, edge, W - M, edge);
  };
  const next = () => {
    check(); doc.addPage(); frame(); y = 120;
    if (currentGuest) {
      text(`Review #${sequence} / continued`, M, y, 8, '#738177'); y += 19;
    }
  };
  const need = (height: number) => { if (y + height > B) next(); };
  const paragraph = (value: string, { size = 9, color = '#33443c', bold = false, highlight = false }: { size?: number; color?: string; bold?: boolean; highlight?: boolean } = {}) => {
    if (!value) return;
    doc.setFont('Noto', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(value), C - (highlight ? 22 : 0)) as string[];
    const leading = size + 3;
    let offset = 0;
    while (offset < lines.length) {
      need(leading + (highlight ? 18 : 4));
      const count = Math.max(1, Math.min(lines.length - offset, Math.floor((B - y - (highlight ? 18 : 4)) / leading)));
      if (highlight) {
        card(M, y - 3, C, count * leading + 12, color === criticismSurface.ink ? criticismSurface : commentSurface, 5);
        doc.setFillColor(color === criticismSurface.ink ? criticismSurface.accent : commentSurface.accent); doc.rect(M, y + 2, 2, count * leading + 2, 'F');
      }
      text(lines.slice(offset, offset + count), M + (highlight ? 11 : 0), y + size + (highlight ? 3 : 0), size, color, bold);
      y += count * leading + (highlight ? 18 : 4); offset += count;
      if (offset < lines.length) next();
    }
  };
  const label = (value: string, color = '#738177') => { need(26); text(value, M, y + 8, 7.5, color, true); y += 17; };
  const commentPanel = (comment: string, hasWrittenCriticism = false) => {
    if (!comment.trim()) comment = 'User left a rating without a written comment.';
    const size = 10.2, leading = 15.5, inset = 32;
    // Measure in the same weight used for the review so highlighted text never overruns the panel.
    doc.setFont('Noto', 'bold'); doc.setFontSize(size); const lines = doc.splitTextToSize(clean(comment), C - inset * 2) as string[];
    let offset = 0;
    // Keep short comments together; paginate longer comments without cutting or shrinking their text.
    const fullHeight = 67 + (lines.length - 1) * leading;
    if (fullHeight <= 200) need(fullHeight);
    while (offset < lines.length) {
      need(67 + (Math.min(3, lines.length - offset) - 1) * leading);
      const count = Math.min(lines.length - offset, Math.max(1, Math.floor((B - y - 67) / leading) + 1));
      const height = 58 + (count - 1) * leading;
      const surface = hasWrittenCriticism ? criticismSurface : commentSurface;
      card(M, y - 4, C, height, surface, 7);
      const accent = surface.accent;
      doc.setFillColor(accent); doc.roundedRect(M + 8, y + 10, 2, height - 28, 1, 1, 'F');
      text(offset ? 'ORIGINAL GUEST COMMENT / CONTINUED' : 'ORIGINAL GUEST COMMENT', M + inset, y + 14, 7, accent, true);
      // A small vector quotation mark separates the original voice from report metadata.
      doc.setFillColor(mix(accent, '#FFFFFF', .3));
      for (let quote = 0; quote < 2; quote++) {
        const x = M + 15 + quote * 7;
        doc.roundedRect(x, y + 28, 5, 5, 1, 1, 'F');
        doc.triangle(x, y + 31, x + 5, y + 31, x, y + 37, 'F');
      }
      lines.slice(offset, offset + count).forEach((line, i) => text(line, M + inset, y + 36 + i * leading, size, surface.ink, true));
      offset += count; y += height + 9;
      if (offset < lines.length) next();
    }
  };
  const ratingStars = (rating: number, x: number, top: number, size = 10) => {
    for (let star = 0; star < 5; star++) {
      const points = Array.from({ length: 10 }, (_, i) => {
        const angle = -Math.PI / 2 + i * Math.PI / 5, radius = size * (i % 2 ? 0.22 : 0.5);
        return [x + star * (size + 2) + size / 2 + Math.cos(angle) * radius, top + size / 2 + Math.sin(angle) * radius];
      });
      const lines = points.slice(1).map((point, i) => [point[0] - points[i][0], point[1] - points[i][1]]);
      const fraction = Math.max(0, Math.min(1, rating - star));
      doc.setFillColor('#faf6ec'); doc.setDrawColor('#d8c7a3'); doc.setLineWidth(0.45);
      doc.lines(lines, points[0][0], points[0][1], [1, 1], 'FD', true);
      if (fraction > 0) {
        doc.saveGraphicsState(); doc.rect(x + star * (size + 2), top, size * fraction, size, null); doc.clip(); doc.discardPath();
        doc.setFillColor('#c8a45d'); doc.setDrawColor('#b8934c');
        doc.lines(lines, points[0][0], points[0][1], [1, 1], 'FD', true); doc.restoreGraphicsState();
      }
    }
  };
  frame(true);
  progress(`Designing PDF · ${bundle.title}`);
  paragraph(bundle.title, { size: 26, color: '#1d3428', bold: true });
  paragraph(bundle.reviewNote || 'All selected guest reviews and identified concerns.', { size: 8, color: '#738177' });
  const asOf = localDate(bundle.generatedAt, bundle.timezone);
  const comparison = bundle.ratingComparison || reviewRatingComparison(bundle.range.end, asOf);
  need(152);
  const comparisonTop = y;
  card(M, comparisonTop, C, 140, categorySurfaces.overall, 8);
  text('GOOGLE BUSINESS RATING / PREVIOUS MONTH', M + 15, y + 18, 8, '#556c59', true);
  text('Month-to-month comparison', M + 15, y + 37, 14, '#1d3428', true);
  const deltaColor = comparison.delta !== null && comparison.delta < 0 ? '#965b4f' : '#3d6d50';
  text(ratingChangeLabel(comparison), W - M - 155, y + 35, 11, deltaColor, true);
  [comparison.previous, comparison.current].forEach((period, i) => {
    const x = M + 15 + i * (C / 2);
    text(`${i ? 'REPORT MONTH' : 'PREVIOUS MONTH'} / ${period.label}`, x, y + 57, 7, '#647767', true);
    text(period.rating === null ? 'Not recorded' : period.rating.toFixed(1), x, y + 86, period.rating === null ? 15 : 26, '#1d3428', true);
    if (period.rating !== null) {
      text('/ 5', x + 47, y + 86, 9, '#748378');
      ratingStars(period.rating, x + 76, y + 72);
    }
    doc.setFont('Noto', 'normal'); doc.setFontSize(7);
    const note = doc.splitTextToSize(clean(ratingPeriodNote(period)), C / 2 - 30) as string[];
    text(note, x, y + 102, 7, '#667b69');
    if (period.reviewCount !== null) text(`${period.reviewCount} Google reviews`, x, y + 114, 7, '#667b69');
  });
  text('Latest recorded Google rating in each month; independent of the selected reviews.', M + 15, y + 131, 7, '#667b69');
  doc.link(M, y, C, 140, { url: comparison.sourceUrl });
  y = comparisonTop + 155;
  const analyses = new Map([...reviews, ...uncertainReviews].map(r => [r, reviewTopics(r)]));

  const written = reviews.filter(r => r.text.trim()).length;
  const metrics = [
    [String(reviews.length), 'Guest responses'],
    [String(written), 'Written comments'],
    [reviews.length ? (reviews.reduce((n, r) => n + (r.rating || 0), 0) / reviews.length).toFixed(2) + ' / 5' : 'Not recorded', 'Overall guest rating'],
  ];
  need(81);
  metrics.forEach(([value, name], i) => {
    const x = M + i * ((C + 10) / 3), width = (C - 20) / 3;
    const surface = [
      { start: '#D6E3ED', middle: '#E6EFF6', end: '#F6FAFD', ink: '#355B73', accent: '#789CB6' },
      { start: '#EADDC3', middle: '#F5ECD9', end: '#FCF9F0', ink: '#725B30', accent: '#AF9462' },
      categorySurfaces.overall,
    ][i];
    card(x, y, width, 64, surface, 7);
    text(value, x + 12, y + 25, value.length > 10 ? 12 : 21, surface.ink, true);
    text(name, x + 12, y + 47, 8, surface.ink);
    doc.setFillColor(surface.accent); doc.roundedRect(x + 12, y + 57, width - 24, 1.5, .75, .75, 'F');
  });
  y += 81;
  const selectedStars = [...new Set(bundle.reviewStars || [1, 2, 3, 4, 5])].filter(s => s >= 1 && s <= 5).sort();
  const starsInScope = selectedStars.length ? selectedStars : [1, 2, 3, 4, 5];
  need(111);
  card(M, y, C, 101, { start: '#F8F1E1', middle: '#FCF8EE', end: '#FFFEFA', ink: '#715720', accent: '#B99342' }, 8);
  const heading = starsInScope.length === 1 ? starsInScope[0] + '-star feedback' : starsInScope.length === starsInScope.at(-1)! - starsInScope[0] + 1
    ? 'Feedback from ' + starsInScope[0] + ' to ' + starsInScope.at(-1) + ' stars'
    : 'Feedback / ' + starsInScope.join(', ') + ' stars';
  text(heading, M + 14, y + 18, 12, '#715720', true);
  text('Guest responses grouped by overall rating', M + 14, y + 31, 7, '#887A5F');
  const gap = 5, width = (C - 28 - gap * (starsInScope.length - 1)) / starsInScope.length;
  starsInScope.forEach((star, i) => {
    const group = reviews.filter(r => r.rating === star), x = M + 14 + i * (width + gap);
    doc.setFillColor('#FFFFFF'); doc.roundedRect(x, y + 42, width, 50, 5, 5, 'F');
    ratingStars(star, x + 8, y + 48, 5);
    const starLabel = star + (star === 1 ? ' STAR' : ' STARS');
    doc.setFont('Noto', 'bold'); doc.setFontSize(6.3);
    text(starLabel, x + width - 8 - doc.getTextWidth(starLabel), y + 55, 6.3, '#896A2A', true);
    text(String(group.length), x + 9, y + 77, 18, '#1D3428', true);
    text(group.filter(r => analyses.get(r)!.criticisms.length).length + ' with concerns', x + 9, y + 89, 6.3, '#887A5F');
  });
  y += 115;
  const topics = [...new Set(reviews.flatMap(r => analyses.get(r)!.criticisms.map(c => c.topic)))];
  if (topics.length) {
    label('CONCERNS AT A GLANCE');
    paragraph(topics.map(topic => `${reviewCategoryLabel(topic)}: ${reviews.filter(r => analyses.get(r)!.criticisms.some(c => c.topic === topic)).length}`).join('  ·  '), { size: 8 });
  }
  paragraph(`Prepared ${new Intl.DateTimeFormat('en-GB', { timeZone: bundle.timezone, dateStyle: 'medium' }).format(new Date(bundle.generatedAt))}. Counts describe the selected reviews; one review can contain several concerns. Full original comments follow.`, { size: 7.5, color: '#738177' });
  const supplied = [...reviews, ...uncertainReviews].reduce((n, r) => n + (r.avatar ? 1 : 0) + (r.reviewPhotos?.length || 0), 0);
  paragraph(supplied ? supplied + ' image references supplied; ' + ((assets.photos?.size || 0) + (assets.attachments?.size || 0)) + ' images embedded. Original image links remain available.' : 'No profile photos or attached images were supplied for this selection.', { size: 7.5, color: '#738177' });
  currentGuest = ''; next();
  const renderList = async (list: CommunityRecord[], approximate = false) => {
    for (const star of starsInScope) {
      const group = list.filter(r => r.rating === star);
      if (!group.length) continue;
      currentGuest = '';
      need(190);
      label(`${star}-STAR REVIEWS${approximate ? ' / APPROXIMATE DATES' : ''}`, '#1d3428');
      for (const r of group) {
        check(); currentGuest = '';
        need(145);
        sequence++;
        currentGuest = r.name || r.username || 'Anonymous reviewer';
        const analysis = analyses.get(r)!;
        const nameWidth = C - 123;
        doc.setFont('Noto', 'bold'); doc.setFontSize(11);
        const nameLines = doc.splitTextToSize(clean(currentGuest), nameWidth) as string[];
        doc.setFont('Noto', 'normal'); doc.setFontSize(8);
        const usernameLines = r.username ? doc.splitTextToSize(clean(r.username), nameWidth) as string[] : [];
        const dateLines = doc.splitTextToSize(clean(reviewDateLabel(r, bundle.timezone)), nameWidth) as string[];
        const headerHeight = Math.max(54, nameLines.length * 14 + dateLines.length * 11 + usernameLines.length * 11 + 14);
        doc.setFont('Noto', 'bold'); doc.setFontSize(10.2);
        const commentLines = doc.splitTextToSize(clean(r.text.trim() || 'User left a rating without a written comment.'), C - 64) as string[];
        const commentHeight = 67 + (commentLines.length - 1) * 15.5;
        // Keep the author beside their first comment lines; long reviews flow into the remaining space.
        need(headerHeight + Math.min(200, commentHeight) + 14);
        card(M, y - 3, C, headerHeight + 1, reviewSurface, 6); y += 7;
        const portrait = assets.photos?.get(key(r));
        if (portrait) {
          doc.saveGraphicsState(); doc.circle(M + 17, y + 18, 17, null); doc.clip(); doc.discardPath();
          doc.addImage(portrait, 'JPEG', M, y + 1, 34, 34, `avatar-${key(r)}`, 'FAST'); doc.restoreGraphicsState();
        } else {
          doc.setFillColor('#eef1eb'); doc.circle(M + 17, y + 18, 17, 'F');
          text(currentGuest.slice(0, 1).toUpperCase(), M + 12, y + 23, 12, '#6c8171', true);
        }
        text(nameLines, M + 45, y + 12, 11, '#1d3428', true);
        let metaY = y + nameLines.length * 14 + 10;
        if (usernameLines.length) { text(usernameLines, M + 45, metaY, 8, '#60756a'); metaY += usernameLines.length * 11; }
        text(dateLines, M + 45, metaY, 8, '#738177');
        ratingStars(star, W - M - 60, y + 3);
        text(`${star} / 5`, W - M - 43, y + 29, 10, '#1d3428', true);
        text(`#${sequence}`, W - M - 43, y + 43, 7.5, '#738177');
        y += headerHeight;
        y += 7;
        commentPanel(r.text, analysis.criticisms.length > 0);
        if (r.reviewAnalysis?.englishText && r.reviewAnalysis.englishText !== r.text) {
          label('ENGLISH TRANSLATION'); paragraph(r.reviewAnalysis.englishText);
        }
        if (analysis.criticisms.length) {
          label('CONCERNS TO REVIEW', criticismSurface.ink);
          const concerns = new Map<string, { topics: string[]; detail: string; excerpt: string; uncertain: boolean }>();
          for (const issue of analysis.criticisms) {
            const detail = 'explanation' in issue ? String(issue.explanation) : '';
            const uncertain = 'confidence' in issue && issue.confidence === 'low';
            const signature = JSON.stringify([issue.excerpt, detail, uncertain]);
            const concern = concerns.get(signature) || { topics: [], detail, excerpt: issue.excerpt, uncertain };
            concern.topics.push(reviewCategoryLabel(issue.topic)); concerns.set(signature, concern);
          }
          for (const concern of concerns.values()) {
            paragraph(`${concern.topics.join(' / ')}${concern.uncertain ? ' / needs review' : ''}${concern.detail ? ' - ' + concern.detail : ''}`, { size: 8.5, bold: true, color: criticismSurface.ink });
            paragraph(`“${concern.excerpt}”`, { size: 8.5, color: criticismSurface.ink, highlight: true });
          }
        } else paragraph('No criticism identified in the available analysis.', { size: 7.5, color: '#738177' });
        if (r.reply) { label('RESPONSE FROM YSABEL SOCIETY'); paragraph(r.reply, { size: 8.5 }); }
        const link = reviewLink(r), profile = safeProfileURL(r.profileUrl);
        need(28);
        let x = M;
        if (link) {
          text(link.label, x, y + 9, 8, '#3d7660'); doc.link(x, y - 1, 155, 14, { url: link.url }); x += 170;
        }
        if (profile && profile !== link?.url) {
          text('Original Google profile', x, y + 9, 8, '#3d7660'); doc.link(x, y - 1, 145, 14, { url: profile });
        }
        y += 22;
        if (r.reviewPhotos?.length) {
          label(`ATTACHED IMAGES / ${r.reviewPhotos.length}`);
          const width = (C - 24) / 4, height = 78;
          for (let start = 0; start < r.reviewPhotos.length; start += 4) {
            need(height + 25);
            const top = y;
            r.reviewPhotos.slice(start, start + 4).forEach((photo, i) => {
              const x = M + i * (width + 8), bytes = assets.attachments?.get(`${key(r)}:${start + i}`);
              doc.setFillColor('#f4f5f1'); doc.roundedRect(x, top, width, height, 4, 4, 'F');
              if (bytes) {
                const size = doc.getImageProperties(bytes), scale = Math.min((width - 8) / size.width, (height - 8) / size.height);
                doc.addImage(bytes, 'JPEG', x + (width - size.width * scale) / 2, top + (height - size.height * scale) / 2, size.width * scale, size.height * scale, `photo-${key(r)}-${start + i}`, 'FAST');
              } else text('Image unavailable', x + 6, top + 40, 7, '#738177');
              const url = safeProfileURL(photo.url);
              if (url) doc.link(x, top, width, height + 18, { url });
              text(`Photo ${start + i + 1}${url ? ' / original' : ''}`, x + 3, top + height + 12, 7, '#3d7660');
            });
            y += height + 24;
            for (const [i, photo] of r.reviewPhotos.slice(start, start + 4).entries())
              if (photo.caption) paragraph(`Photo ${start + i + 1}: ${photo.caption}`, { size: 7.5, color: '#738177' });
          }
        }
        y += 12;
        if (sequence % 4 === 0) { progress(`Designing reviews · ${sequence} / ${reviews.length + uncertainReviews.length}`); await new Promise<void>(resolve => setTimeout(resolve, 0)); }
      }
    }
  };
  await renderList(reviews);
  if (uncertainReviews.length) {
    currentGuest = ''; need(75); label('APPROXIMATE DATES / SEPARATE REFERENCE');
    paragraph('These reviews retain Google’s original relative date labels and are excluded from exact period totals.', { size: 8, color: '#738177' });
    await renderList(uncertainReviews, true);
  }
  const count = doc.getNumberOfPages();
  for (let n = 1; n <= count; n++) {
    doc.setPage(n); text('Ysabel Society / Internal use / arberhalili.com', M, H - 22, 7, '#859087');
    text(`${n} / ${count}`, W - M - 40, H - 22, 7, '#859087');
  }
  check(); progress(`PDF ready · ${count} pages`);
  return doc;
}
