import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { reviewTopics, safeProfileURL, type CommunityRecord } from './community';
import { reviewDateLabel, reviewLink } from './review-report';
import { reviewCategoryLabel } from './review-categories';
import type { ReportBundle, ReportProgress } from './report-bundle';

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
  const M = 34, C = W - M * 2, B = H - 42;
  let y = 78, currentGuest = '', sequence = 0;
  const framedPages = new Set<number>();
  const check = () => { if (signal?.aborted) throw new DOMException('Report cancelled', 'AbortError'); };
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
  const frame = () => {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (framedPages.has(page)) return;
    framedPages.add(page);
    doc.addImage(assets.logo, 'PNG', M, 14, 64, 36, 'ysabel-brand', 'FAST');
    text('GOOGLE BUSINESS / GUEST REVIEWS', M + 80, 34, 8, '#546a60', true);
    text(`${bundle.range.start} - ${bundle.range.end}`, W - M - 145, 50, 8, '#7d8981');
    doc.setDrawColor('#e6ebe7'); doc.setLineWidth(0.5); doc.line(M, 61, W - M, 61);
  };
  const next = () => {
    check(); doc.addPage(); frame(); y = 80;
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
        doc.setFillColor('#f5f6f2'); doc.roundedRect(M, y - 3, C, count * leading + 12, 5, 5, 'F');
        doc.setFillColor('#809489'); doc.rect(M, y + 2, 2, count * leading + 2, 'F');
      }
      text(lines.slice(offset, offset + count), M + (highlight ? 11 : 0), y + size + (highlight ? 3 : 0), size, color, bold);
      y += count * leading + (highlight ? 18 : 4); offset += count;
      if (offset < lines.length) next();
    }
  };
  const label = (value: string, color = '#738177') => { need(26); text(value, M, y + 8, 7.5, color, true); y += 17; };
  frame();
  progress(`Designing PDF · ${bundle.title}`);
  paragraph(bundle.title, { size: 22, color: '#1d3428', bold: true });
  paragraph(bundle.reviewNote || 'All selected guest reviews and identified concerns.', { size: 8, color: '#738177' });
  const analyses = new Map([...reviews, ...uncertainReviews].map(r => [r, reviewTopics(r)]));
  const criticized = reviews.filter(r => analyses.get(r)!.criticisms.length > 0).length;
  const metrics = [['Reviews', String(reviews.length)], ['Average rating', reviews.length ? (reviews.reduce((n, r) => n + (r.rating || 0), 0) / reviews.length).toFixed(2) : '—'], ['With criticism', String(criticized)]];
  need(62);
  metrics.forEach(([name, value], i) => {
    const x = M + i * ((C + 10) / 3), width = (C - 20) / 3;
    // A few subtle bands keep the gradient light for PDF readers.
    ['#f1f4ee', '#edf2eb', '#e8efe6'].forEach((color, band) => {
      doc.setFillColor(color); doc.rect(x, y + band * 18, width, 18, 'F');
    });
    text(name.toUpperCase(), x + 12, y + 16, 7, '#6b7d70', true);
    text(value, x + 12, y + 42, 22, '#1d3428', true);
  });
  y += 69;
  label('CRITICISM BY RATING');
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: 80, bottom: 42 },
    head: [['Rating', 'Reviews', 'With criticism', 'Concerns identified']],
    body: [1, 2, 3, 4, 5].map(star => {
      const group = reviews.filter(r => r.rating === star), issues = group.flatMap(r => analyses.get(r)!.criticisms);
      return [`${star} / 5`, String(group.length), String(group.filter(r => analyses.get(r)!.criticisms.length > 0).length), [...new Set(issues.map(c => reviewCategoryLabel(c.topic)))].join(', ') || 'None identified'];
    }),
    styles: { font: 'Noto', fontSize: 8, cellPadding: 5, textColor: '#33443c', lineWidth: 0 },
    headStyles: { fillColor: '#e9eee9', textColor: '#445f50', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#f7f8f5' },
    columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 50 }, 2: { cellWidth: 78 } },
    didDrawPage: frame,
  });
  y = (doc as any).lastAutoTable.finalY + 16;
  const topics = [...new Set(reviews.flatMap(r => analyses.get(r)!.criticisms.map(c => c.topic)))];
  if (topics.length) {
    label('CONCERNS AT A GLANCE');
    paragraph(topics.map(topic => `${reviewCategoryLabel(topic)}: ${reviews.filter(r => analyses.get(r)!.criticisms.some(c => c.topic === topic)).length}`).join('  ·  '), { size: 8 });
  }
  paragraph(`Prepared ${new Intl.DateTimeFormat('en-GB', { timeZone: bundle.timezone, dateStyle: 'medium' }).format(new Date(bundle.generatedAt))}. Counts describe the selected reviews; one review can contain several concerns. Full original comments follow.`, { size: 7.5, color: '#738177' });
  y += 9;
  const renderList = async (list: CommunityRecord[], approximate = false) => {
    for (const star of [1, 2, 3, 4, 5]) {
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
        need(headerHeight + 35);
        doc.setDrawColor('#e3e8e2'); doc.line(M, y, W - M, y); y += 10;
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
        text(`${star} / 5`, W - M - 43, y + 14, 12, '#1d3428', true);
        text(`#${sequence}`, W - M - 43, y + 30, 7.5, '#738177');
        y += headerHeight;
        label('ORIGINAL REVIEW');
        paragraph(r.text || 'No written comment supplied.', { size: 9.5, highlight: true });
        if (r.reviewAnalysis?.englishText && r.reviewAnalysis.englishText !== r.text) {
          label('ENGLISH TRANSLATION'); paragraph(r.reviewAnalysis.englishText);
        }
        if (analysis.criticisms.length) {
          label('CRITICISM HIGHLIGHTS', '#93665c');
          const concerns = new Map<string, { topics: string[]; detail: string; excerpt: string; uncertain: boolean }>();
          for (const issue of analysis.criticisms) {
            const detail = 'explanation' in issue ? String(issue.explanation) : '';
            const uncertain = 'confidence' in issue && issue.confidence === 'low';
            const signature = JSON.stringify([issue.excerpt, detail, uncertain]);
            const concern = concerns.get(signature) || { topics: [], detail, excerpt: issue.excerpt, uncertain };
            concern.topics.push(reviewCategoryLabel(issue.topic)); concerns.set(signature, concern);
          }
          for (const concern of concerns.values()) {
            paragraph(`${concern.topics.join(' / ')}${concern.uncertain ? ' / needs review' : ''}${concern.detail ? ' - ' + concern.detail : ''}`, { size: 8.5, bold: true, color: '#885e55' });
            paragraph(`“${concern.excerpt}”`, { size: 8.5, color: '#885e55' });
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
