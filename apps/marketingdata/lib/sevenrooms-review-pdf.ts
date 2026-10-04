import { jsPDF } from 'jspdf';
import { feedbackMonthLabel, groupFeedbackByMonth } from './sevenrooms-feedback';
import { appPath } from './app-path';
import { guestReviewConcerns, guestReviewRatingGroups, guestReviewVenueGroups, SEVENROOMS_VENUE_THEMES } from './sevenrooms-review-model';

export type GuestReview = {
  id: string; guest_id?: string; name?: string; date?: string; time?: string;
  venue: string; feedback: string; scores: Record<string, number | null>;
  reservation?: { reference?: string; covers?: number; status?: string; tags?: string[] };
  guest?: { reference?: string; email?: string; phone?: string; visits?: number;
    first_visit?: string; last_visit?: string; gender?: string; birthday?: string; labels?: string[] };
  profile_photo?: string; photos?: { url: string; caption?: string }[];
};
export type GuestReviewScope = { venue: string; month: string; comments: string; rating: string; count: number };
export type GuestReviewAssets = { regular: Uint8Array; bold: Uint8Array; logo: Uint8Array; images: Map<string, Uint8Array> };
const venues: Record<string, string> = { all: 'All Ysabel', asian: 'Ysabel Asian', italian: 'Ysabel Italian', garden: 'Ysabel Garden' };
const fields = ['overall', 'food', 'drinks', 'service', 'atmosphere'];
const venueLabel = (v: string) => venues[v] || v.replace(/^unmapped:/, 'Unmapped: ');
const binary = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const check = (signal?: AbortSignal) => signal?.throwIfAborted();
const yieldWork = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Download every server page in the filtered scope; never silently export only the visible page. */
export async function collectGuestReviews(scope: GuestReviewScope, progress: (s: string) => void, signal?: AbortSignal) {
  const rows: GuestReview[] = []; let total = scope.count, page = 1, month = scope.month;
  do {
    check(signal);
    const q = new URLSearchParams({ op: 'feedback-export', venue: scope.venue, month, comments: scope.comments, rating: scope.rating, page: String(page) });
    const response = await fetch(appPath('/api/sevenrooms') + '?' + q, { cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load all review details. Please retry.');
    if (page === 1) { total = data.total; month = data.month; }
    if (data.total !== total || !data.rows.length && rows.length < total) throw new Error('The review selection changed during export. Please retry.');
    rows.push(...data.rows); progress(`Preparing SevenRooms reviews: ${rows.length.toLocaleString()} / ${total.toLocaleString()}`);
    page++;
  } while (rows.length < total);
  if (rows.length !== total || new Set(rows.map(r => r.id)).size !== total) throw new Error('The review selection changed during export. Please retry.');
  return { rows, scope: { ...scope, month, count: total } };
}

export async function loadGuestReviewAssets(rows: GuestReview[], progress: (s: string) => void, signal?: AbortSignal): Promise<GuestReviewAssets> {
  const read = async (path: string) => {
    const response = await fetch(appPath(path), { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Report typography or logo could not load. Please retry.');
    return new Uint8Array(await response.arrayBuffer());
  };
  progress('Preparing report typography and images…');
  const [regular, bold, logo] = await Promise.all([read('/fonts/NotoSans-Regular.ttf'), read('/fonts/NotoSans-Bold.ttf'), read('/ysabel-loading-identity.png')]);
  const urls = [...new Set(rows.flatMap(r => [r.profile_photo, ...(r.photos || []).map(p => p.url)]).filter((v): v is string => !!v))];
  const images = new Map<string, Uint8Array>(); let cursor = 0, completed = 0;
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
    while (cursor < urls.length) {
      check(signal); const url = urls[cursor++];
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) continue;
        const response = await fetch(url, { credentials: 'omit', mode: 'cors', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
        if (!response.ok || !/^image\/(png|jpeg|webp)/i.test(response.headers.get('Content-Type') || '') || Number(response.headers.get('Content-Length')) > 8000000) continue;
        const blob = await response.blob(); if (blob.size > 8000000) continue;
        const bitmap = await createImageBitmap(blob);
        try {
          const factor = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * factor)); canvas.height = Math.max(1, Math.round(bitmap.height * factor));
          const ctx = canvas.getContext('2d'); if (!ctx) continue;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
          if (jpeg) images.set(url, new Uint8Array(await jpeg.arrayBuffer()));
        } finally { bitmap.close(); }
      } catch { check(signal); /* Preserve the image's original link if embedding is unavailable. */ }
      finally { completed++; progress(`Preparing available images: ${completed} / ${urls.length}`); }
    }
  }));
  return { regular, bold, logo, images };
}

/** Vector text and stars, continuous pagination, full comments and every supplied attachment. */
export async function createGuestReviewPDF(rows: GuestReview[], scope: GuestReviewScope, assets: GuestReviewAssets, progress: (s: string) => void, signal?: AbortSignal) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  for (const [filename, bytes, weight] of [['regular', assets.regular, 'normal'], ['bold', assets.bold, 'bold']] as const) {
    doc.addFileToVFS(filename + '.ttf', binary(bytes)); doc.addFont(filename + '.ttf', 'Noto', weight);
  }
  doc.setProperties({ title: 'SevenRooms - Ysabel Society guest reviews', subject: 'Monthly guest reviews and comments from SevenRooms', author: 'Ysabel Society', creator: 'arberhalili.com' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36, C = W - M * 2, bottom = H - 45;
  let y = 148, continuing = '', activeVenue = '';
  const neutral = { name: 'Ysabel Society', color: '#1D3428', end: '#6B8774', tint: '#EDF3EE', ink: '#FFFFFF' };
  const theme = () => SEVENROOMS_VENUE_THEMES[activeVenue] || { ...neutral, name: activeVenue ? venueLabel(activeVenue) : neutral.name };
  const concerns = new Map(rows.map(row => [row.id, guestReviewConcerns(row)]));
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
  const clean = (s: string) => Array.from(s.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')).map(c => {
    const font = doc.getFont().metadata as any;
    return '\n\r\t'.includes(c) || !font.characterToGlyph || font.characterToGlyph(c.codePointAt(0)) ? c : `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`;
  }).join('');
  const font = (size = 9, bold = false, color = '#35463c') => { doc.setFont('Noto', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color); };
  const text = (s: string, x: number, top: number, size = 9, bold = false, color = '#35463c') => { font(size, bold, color); doc.text(clean(s), x, top); };
  const brandLogo = (width: number) => {
    // Display the original dark artwork without its transparent outer margins.
    // The PNG remains untouched and is embedded once; PDF clipping preserves every logo detail.
    const scale = width / 972, height = 702 * scale;
    doc.saveGraphicsState(); doc.rect(M, 15, width, height, null); doc.clip(); doc.discardPath();
    doc.addImage(assets.logo, 'PNG', M - 314 * scale, 15 - 99 * scale, 1600 * scale, 900 * scale, 'ysabel-logo', 'FAST');
    doc.restoreGraphicsState();
    return height;
  };
  const header = (cover = false) => {
    const width = cover ? 132 : 96, height = brandLogo(width), left = M + width + 26;
    text('SEVENROOMS', left, 15 + height / 2 - 2, 11, true, '#1D3428');
    text(`${theme().name} / Guest reviews & comments`, left, 15 + height / 2 + 14, 8, false, '#708078');
    const edge = cover ? 126 : 98;
    doc.setDrawColor('#e4e9e4'); doc.setLineWidth(.5); doc.line(M, edge, W - M, edge);
  };
  const next = () => { check(signal); doc.addPage(); header(); y = 120; if (continuing) { text(continuing + ' / continued', M, y, 8, false, '#708078'); y += 20; } };
  const need = (height: number) => { if (y + height > bottom) next(); };
  const paragraph = (s: string, size = 9, bold = false, muted = false) => {
    if (!s) return; font(size, bold); const lines: string[] = doc.splitTextToSize(clean(s), C - 20);
    for (const line of lines) { need(size + 5); text(line, M + 10, y, size, bold, muted ? '#708078' : '#35463c'); y += size + 4; }
    y += 4;
  };
  const link = (label: string, url: string) => { need(17); font(8); doc.textWithLink(label, M + 10, y, { url }); y += 17; };
  const stars = (rating: number, x: number, top: number, radius = 6) => {
    for (let s = 0; s < 5; s++) {
      const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .45 : radius; return [Math.cos(a) * r, Math.sin(a) * r]; });
      doc.setLineWidth(radius <= 4 ? .35 : .5);
      doc.setDrawColor('#b99342'); doc.setFillColor(s < Math.round(rating) ? '#b99342' : '#f4f1e9');
      doc.lines(pts.map((p, i) => { const prev = pts[(i + 9) % 10]; return [p[0] - prev[0], p[1] - prev[1]]; }), x + s * (radius * 2 + 4) + pts[9][0], top + pts[9][1], [1, 1], 'FD', true);
    }
  };
  const ratingTabs = (scores: GuestReview['scores']) => {
    const keys = fields.filter(key => scores[key] != null);
    if (!keys.length) return;
    const colors: Record<string, [string, string]> = {
      overall: [theme().tint, activeVenue === 'italian' ? '#766019' : theme().color],
      food: ['#FAF3E3', '#866820'], drinks: ['#F6EDF0', '#7B465B'],
      service: ['#EDF3EF', '#365C46'], atmosphere: ['#EDF1F5', '#4C6073'],
    };
    const gap = 5, columns = Math.max(4, keys.length), width = (C - 20 - gap * (columns - 1)) / columns;
    need(46);
    keys.forEach((key, i) => {
      const x = M + 10 + i * (width + gap), [tint, ink] = colors[key];
      doc.saveGraphicsState(); doc.roundedRect(x, y - 4, width, 38, 5, 5, null); doc.clip(); doc.discardPath();
      gradient(x, y - 4, width, 38, tint, '#FEFEFC'); doc.restoreGraphicsState();
      text(key.toUpperCase(), x + 9, y + 8, 6.4, true, ink);
      stars(scores[key]!, x + 12, y + 23, 3.1);
      font(8, true, ink); const score = `${scores[key]}/5`;
      text(score, x + width - 9 - doc.getTextWidth(score), y + 26, 8, true, ink);
    });
    y += 44;
  };
  const photo = (url: string, width = C - 20, height = 150) => {
    const bytes = assets.images.get(url); if (!bytes) { link('Image unavailable to embed - open original image', url); return; }
    need(height + 12); const props = doc.getImageProperties(bytes), factor = Math.min(width / props.width, height / props.height);
    const w = props.width * factor, h = props.height * factor;
    doc.addImage(bytes, 'JPEG', M + 10, y - 3, w, h, undefined, 'FAST'); y += h + 12;
  };
  const labels = (title: string, values: string[] = []) => {
    const unique = [...new Set(values.map(value => value.trim()).filter(Boolean))];
    if (!unique.length) return;
    paragraph(title, 8, true); let x = M + 10;
    font(7.5);
    for (const value of unique) {
      const lines: string[] = doc.splitTextToSize(clean(value), C - 38);
      for (const line of lines) {
        const width = Math.min(C - 20, doc.getTextWidth(line) + 16);
        if (x + width > W - M - 10) { x = M + 10; y += 21; }
        if (y + 21 > bottom) { next(); x = M + 10; }
        doc.setFillColor(theme().tint); doc.roundedRect(x, y - 10, width, 18, 4, 4, 'F');
        text(line, x + 8, y + 2, 7.5, true, activeVenue === 'italian' ? '#766019' : theme().color);
        x += width + 5;
      }
    }
    y += 24;
  };
  const dateLabel = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    const date = new Date(value.slice(0, 10) + 'T12:00:00Z');
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  };
  type Detail = { label: string; value: string | number | undefined; span?: number; url?: string };
  const detailCards = (items: Detail[], reference = false) => {
    const available = items.filter(item => item.value !== '' && item.value != null);
    if (!available.length) return;
    const columns = 3, gap = 5, width = (C - 20 - gap * (columns - 1)) / columns;
    let batch: Detail[] = [], used = 0;
    const draw = () => {
      if (!batch.length) return;
      const cells = batch.map(item => {
        const span = item.span || 1, w = width * span + gap * (span - 1);
        font(reference ? 7 : 8);
        return { item, w, lines: doc.splitTextToSize(clean(String(item.value)), w - 16) as string[] };
      });
      const height = Math.max(...cells.map(cell => 24 + cell.lines.length * (reference ? 9 : 10)));
      need(height + gap); let x = M + 10;
      for (const { item, w, lines } of cells) {
        doc.setFillColor(reference ? '#F8F9F7' : '#F2F5F2'); doc.roundedRect(x, y - 4, w, height, 4, 4, 'F');
        text(item.label.toUpperCase(), x + 8, y + 7, 6.3, false, '#738078');
        lines.forEach((line, index) => text(line, x + 8, y + 21 + index * (reference ? 9 : 10), reference ? 7 : 8, false, '#1D3428'));
        if (item.url) doc.link(x, y - 4, w, height, { url: item.url });
        x += w + gap;
      }
      y += height + gap; batch = []; used = 0;
    };
    for (const item of available) {
      const span = item.span || 1;
      if (used + span > columns) draw();
      batch.push(item); used += span;
      if (used === columns) draw();
    }
    draw(); y += 3;
  };
  const feedbackLink = (row: GuestReview) => {
    need(28); const label = 'Open feedback in Ysabel Society'; font(7.5, true);
    const width = doc.getTextWidth(label) + 33, x = M + 10;
    doc.setFillColor('#EDF2ED'); doc.roundedRect(x, y - 5, width, 23, 5, 5, 'F');
    text(label, x + 9, y + 9, 7.5, true, '#1D3428');
    doc.setDrawColor('#1D3428'); doc.setLineWidth(.65);
    doc.line(x + width - 16, y + 10, x + width - 10, y + 4); doc.line(x + width - 15, y + 4, x + width - 10, y + 4); doc.line(x + width - 10, y + 4, x + width - 10, y + 9);
    doc.link(x, y - 5, width, 23, { url: 'https://ysabelsociety.com/marketingdata?' + new URLSearchParams({ sr_tab: 'Reviews & Comments', sr_venue: row.venue }) + '#Seven%20Rooms' });
    y += 30;
  };
  const venueBanner = (name: string, detail: string, height: number, large = false) => {
    const t = SEVENROOMS_VENUE_THEMES[name] || { ...neutral, name: venueLabel(name) };
    const palette: Record<string, [string, string, string]> = {
      garden: ['#132A20', '#345646', '#799080'],
      asian: ['#6D1024', '#AD1731', '#D66570'],
      italian: ['#C6A21E', '#EAC426', '#F6E6A5'],
    };
    const [start, middle, end] = palette[name] || [t.color, t.color, t.end];
    need(height + 12);
    doc.saveGraphicsState(); doc.roundedRect(M, y - 7, C, height, large ? 9 : 6, large ? 9 : 6, null); doc.clip(); doc.discardPath();
    gradient(M, y - 7, C, height, start, end, middle);
    // A fine inset line adds depth without introducing texture or raster artwork.
    doc.setDrawColor(large ? middle : start); doc.setLineWidth(.35); doc.roundedRect(M + 1, y - 6, C - 2, height - 2, large ? 8 : 5, large ? 8 : 5, 'S');
    doc.restoreGraphicsState();
    text(t.name, M + (large ? 16 : 12), y + (large ? 19 : 7), large ? 23 : 11, true, t.ink);
    text(detail, M + (large ? 16 : 12), y + (large ? 43 : 22), large ? 9 : 7.5, false, t.ink);
    y += height + (large ? 14 : 9);
  };
  const concernPanel = (row: GuestReview) => {
    const issues = concerns.get(row.id) || [];
    if (!issues.length) { paragraph('No specific criticism identified in the available feedback.', 7.5, false, true); return; }
    need(45); paragraph('Concerns to review', 9, true);
    for (const issue of issues) {
      need(36); text(`${issue.topic.toUpperCase()} / ${issue.evidence}`, M + 10, y, 7, true, '#896A2A'); y += 14;
      font(8); const lines: string[] = doc.splitTextToSize(clean(issue.excerpt), C - 42);
      for (const line of lines) {
        need(16); doc.setFillColor('#FAF5E9'); doc.rect(M + 10, y - 9, C - 20, 15, 'F');
        doc.setFillColor('#B99342'); doc.rect(M + 10, y - 9, 2, 15, 'F');
        text(line, M + 20, y + 1, 8, false, '#604E2C'); y += 14;
      }
      y += 10;
    }
  };
  const commentPanel = (comment: string) => {
    if (!comment.trim()) { paragraph('Rating only. No written comment was supplied.', 8, false, true); return; }
    const size = 9.5, leading = 14, inset = 18;
    font(size); const lines = doc.splitTextToSize(clean(comment), C - inset * 2) as string[];
    let offset = 0;
    // Keep short comments together; paginate longer comments without cutting or shrinking their text.
    const fullHeight = 67 + (lines.length - 1) * leading;
    if (fullHeight <= bottom - 140) need(fullHeight);
    while (offset < lines.length) {
      need(67 + (Math.min(3, lines.length - offset) - 1) * leading);
      const count = Math.min(lines.length - offset, Math.max(1, Math.floor((bottom - y - 67) / leading) + 1));
      const height = 58 + (count - 1) * leading;
      doc.saveGraphicsState(); doc.roundedRect(M, y - 4, C, height, 7, 7, null); doc.clip(); doc.discardPath();
      gradient(M, y - 4, C, height, theme().tint, '#FEFEFC');
      doc.restoreGraphicsState();
      const accent = activeVenue === 'italian' ? '#927323' : theme().color;
      doc.setFillColor(accent); doc.roundedRect(M + 8, y + 10, 2, height - 28, 1, 1, 'F');
      text(offset ? 'ORIGINAL GUEST COMMENT / CONTINUED' : 'ORIGINAL GUEST COMMENT', M + inset, y + 14, 6.8, true, accent);
      lines.slice(offset, offset + count).forEach((line, i) => text(line, M + inset, y + 36 + i * leading, size, false, '#20372A'));
      offset += count; y += height + 9;
      if (offset < lines.length) next();
    }
  };
  const ratingSummary = (list: GuestReview[]) => {
    const groups = guestReviewRatingGroups(list); need(80);
    const width = C / 5;
    groups.slice(0, 5).forEach((group, i) => {
      const x = M + i * width; doc.setFillColor('#F5F6F3'); doc.roundedRect(x, y, width - 5, 58, 5, 5, 'F');
      text(`${group.star}-star`, x + 10, y + 17, 8, true, '#896A2A');
      text(String(group.rows.length), x + 10, y + 37, 17, true);
      text(`${group.rows.filter(row => concerns.get(row.id)?.length).length} with concerns`, x + 10, y + 50, 6.5, false, '#708078');
    });
    y += 73;
    if (groups[5].rows.length) paragraph(`${groups[5].rows.length} responses without an overall rating are included separately.`, 8, false, true);
  };
  header(true);
  text('Guest voices.', M, y, 26, true, '#1d3428'); y += 27;
  text(`${feedbackMonthLabel(scope.month)} / ${venueLabel(scope.venue)}`, M, y, 11); y += 21;
  const selected = `${scope.comments === 'written' ? 'Written comments only' : 'All reviews and comments'} - ${scope.rating === 'critical' ? 'Any score of 3 or below' : 'All ratings'}`;
  font(8); const scopeLines: string[] = doc.splitTextToSize(selected, C); doc.text(scopeLines, M, y); y += scopeLines.length * 12 + 14;
  const rated = rows.filter(r => r.scores.overall != null), written = rows.filter(r => r.feedback.trim());
  const mean = rated.length ? (rated.reduce((sum, r) => sum + r.scores.overall!, 0) / rated.length).toFixed(2) + ' / 5' : 'Not recorded';
  for (const [i, item] of [[String(rows.length), 'Guest responses'], [String(written.length), 'Written comments'], [mean, 'Overall guest rating']].entries()) {
    const x = M + i * (C + 10) / 3, w = (C - 20) / 3;
    doc.setFillColor(i === 2 ? '#edf2ec' : '#f5f6f3'); doc.roundedRect(x, y - 6, w, 64, 6, 6, 'F');
    text(item[0], x + 12, y + 19, item[0].length > 10 ? 12 : 21, true); text(item[1], x + 12, y + 41, 8);
  }
  y += 81;
  paragraph('Generated ' + new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Tirane' }).format(new Date()) + ' / Europe/Tirane', 8, false, true);
  paragraph('Source: SevenRooms imported reservation feedback. Months use reservation dates; review submission times were not supplied. Internal staff notes are excluded.', 8, false, true);
  const imagesSupplied = rows.reduce((sum, r) => sum + (r.profile_photo ? 1 : 0) + (r.photos?.length || 0), 0);
  paragraph(imagesSupplied ? `${imagesSupplied} image references supplied; ${assets.images.size} unique images embedded. Original image links remain available.` : 'No profile photos or review attachments were supplied in these imported records.', 8, false, true);
  paragraph('Category averages in this selection', 10, true);
  for (const key of fields.slice(1)) { const values = rows.map(r => r.scores[key]).filter((v): v is number => v != null); paragraph(`${key[0].toUpperCase() + key.slice(1)}: ${values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) + ' / 5 (' + values.length + ' scores)' : 'Not recorded'}`, 8); }
  paragraph('Feedback from 1 to 5 stars', 10, true);
  ratingSummary(rows);
  paragraph('Written concerns use the same contextual detector as Google review reports. Category ratings of 3 or below are shown as separate score evidence. An overall rating alone does not identify a complaint. Check the full original comment before acting.', 8, false, true);
  const venueGroups = guestReviewVenueGroups(rows, scope.venue);
  if (scope.venue === 'all') {
    paragraph('Venue chapters', 10, true);
    for (const group of venueGroups) {
      venueBanner(group.venue, `${group.rows.length} responses / ${group.rows.filter(row => concerns.get(row.id)?.length).length} with concerns`, 39);
    }
  }
  if (scope.month === 'all') {
    paragraph('Monthly summary', 10, true);
    for (const [month, list] of groupFeedbackByMonth(rows)) paragraph(`${feedbackMonthLabel(month)}: ${list.length} responses, ${list.filter(r => r.feedback.trim()).length} written comments`, 8);
  }
  let sequence = 0;
  for (const venueGroup of venueGroups) {
    activeVenue = venueGroup.venue; continuing = ''; next();
    const t = theme();
    venueBanner(venueGroup.venue, `${venueGroup.rows.length} guest responses / ${venueGroup.rows.filter(row => concerns.get(row.id)?.length).length} with concerns`, 70, true);
    if (!venueGroup.rows.length) { paragraph('No guest feedback is available for this venue in the selected period. This does not mean there were no reservations or visits.', 9, false, true); continue; }
    ratingSummary(venueGroup.rows);
    for (const [month, list] of groupFeedbackByMonth(venueGroup.rows).sort(([a], [b]) => a === 'undated' ? 1 : b === 'undated' ? -1 : b.localeCompare(a))) {
     need(80); text(feedbackMonthLabel(month), M, y + 12, 15, true, activeVenue === 'italian' ? '#766019' : t.color); y += 36;
     for (const ratingGroup of guestReviewRatingGroups(list)) {
      if (!ratingGroup.rows.length) continue;
      need(240);
      text(ratingGroup.star == null ? 'Overall rating not recorded' : `${ratingGroup.star}-star feedback`, M + 10, y + 10, 11, true);
      text(`${ratingGroup.rows.length} responses / ${ratingGroup.rows.filter(row => concerns.get(row.id)?.length).length} with concerns`, M + 10, y + 25, 7.5, false, '#708078');
      if (ratingGroup.star != null) stars(ratingGroup.star, W - M - 95, y + 7);
      y += 45;
      for (const r of ratingGroup.rows) {
      check(signal); continuing = ''; need(180); sequence++;
      const name = r.name || 'Unnamed guest'; font(11, true); const nameLines = doc.splitTextToSize(clean(name), C - 150) as string[];
      const headingHeight = Math.max(44, nameLines.length * 14 + 18); need(headingHeight + 68); const top = y;
      gradient(M, y - 7, C, headingHeight, t.tint, '#FFFFFF');
      doc.setFillColor(t.color); doc.rect(M, y - 7, 3, headingHeight, 'F');
      text(`#${sequence}`, M + 10, y + 8, 8, false, '#708078');
      font(11, true); doc.text(nameLines, M + 40, y + 8); y += headingHeight;
      if (r.scores.overall != null) { stars(r.scores.overall, W - M - 86, top + 4, 4.25); text(`${r.scores.overall} / 5`, W - M - 25, top + 7, 7.5); }
      continuing = `Review #${sequence}`;
      paragraph(`${venueLabel(r.venue)} - ${r.date || 'Date not recorded'}${r.time ? ' at ' + r.time : ''}${r.reservation?.covers != null ? ' - ' + r.reservation.covers + ' guests' : ''}${r.reservation?.status ? ' - ' + r.reservation.status : ''}`, 8, false, true);
      ratingTabs(r.scores);
      labels('Reservation labels', r.reservation?.tags);
      commentPanel(r.feedback);
      concernPanel(r);
      // Keep the compact contact/history/reference group together when it fits on one page.
      need(165 + (r.guest?.gender || r.guest?.birthday ? 40 : 0));
      if (r.guest) {
        detailCards([{ label: 'Email', value: r.guest.email, span: 2, url: r.guest.email ? 'mailto:' + r.guest.email : undefined }, { label: 'Phone', value: r.guest.phone, url: r.guest.phone ? 'tel:' + r.guest.phone : undefined }]);
        detailCards([{ label: 'Recorded visits', value: r.guest.visits }, { label: 'First visit', value: dateLabel(r.guest.first_visit) }, { label: 'Last visit', value: dateLabel(r.guest.last_visit) }, { label: 'Gender', value: r.guest.gender }, { label: 'Birthday', value: dateLabel(r.guest.birthday) }]);
      }
      detailCards([{ label: 'Reservation ID', value: r.reservation?.reference || 'Not supplied' }, { label: 'Guest ID', value: r.guest?.reference || 'Not supplied' }, { label: 'Ysabel record', value: r.id }], true);
      if (r.profile_photo) { need(110); paragraph('Guest profile photo', 8, true); photo(r.profile_photo, 64, 64); link('Open original profile photo', r.profile_photo); }
      for (const [i, p] of (r.photos || []).entries()) { need(190); paragraph(`Attached image ${i + 1}${p.caption ? ': ' + p.caption : ''}`, 8, true); photo(p.url); link('Open original attachment', p.url); }
      feedbackLink(r);
      need(12); doc.setDrawColor('#e4e9e4'); doc.line(M, y, W - M, y); y += 20; continuing = '';
      if (sequence % 15 === 0) { progress(`Laying out review ${sequence} / ${rows.length}`); await yieldWork(); }
      }
     }
    }
  }
  const count = doc.getNumberOfPages();
  for (let p = 1; p <= count; p++) { doc.setPage(p); text('SEVENROOMS / YSABEL SOCIETY / INTERNAL USE', M, H - 22, 7, false, '#708078'); text(`${p} / ${count}`, W - M - 45, H - 22, 7, false, '#708078'); }
  check(signal); progress(`PDF ready - ${rows.length} responses, ${count} pages`);
  return doc;
}
