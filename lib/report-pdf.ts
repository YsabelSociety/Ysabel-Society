import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  CHANNELS,
  COLORS,
  METRICS,
  compact,
  metricAvailable,
  total,
  type Daily,
  type Post,
} from './analytics';
import {
  SOCIAL_METRICS,
  SOCIAL_PLATFORMS,
  performanceSeries,
  seriesTotal,
  metricExplanation,
  selectContent,
  postValue,
  type MetricPoint,
  type SocialMetric,
} from './social-performance';
import {
  COMMUNITY_NAMES,
  inboxModel,
  inWindow,
  localDate,
  followerTier,
  reviewTopics,
  safeProfileURL,
  type CommunityRecord,
} from './community';
import { reviewDateLabel, reviewLink } from './review-report';
import { GBP_METRICS, GBP_SUMMARY } from './google-business';
import { websitePlot, reportLabel } from './website-report-model';
import type { ReportTable } from './reporting';
import { appPath } from './app-path';
import {
  REPORT_SECTIONS,
  type ReportBundle,
  type ReportProgress,
} from './report-bundle';

type Assets = {
  countries?: { code: string; name: string; aliases: string[]; path: string }[];
  regular: Uint8Array;
  bold: Uint8Array;
  logo: Uint8Array;
  photos?: Map<string, Uint8Array>;
};
const photoKey = (r: CommunityRecord) =>
  r.source + ':' + r.accountId + ':' + r.id;
const colorFor = (channel: string) =>
  COLORS[CHANNELS.indexOf(channel as any)] || '#667d9d';
const hex = (color: string) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
const display = (value: unknown) =>
  value === null || value === undefined
    ? 'Not supplied'
    : typeof value === 'number'
      ? value.toLocaleString('en', { maximumFractionDigits: 2 })
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
const label = (key: string) =>
  (
    ({
      profileViews: 'Profile views',
      views: 'Content views',
      reach: 'Aggregated reach',
      followers: 'Followers',
      users: 'Daily users / viewers',
      sessions: 'Website visits',
      engaged: 'Engaged visits',
      pageViews: 'Page views',
      mediaViewers: 'Unique media viewers',
      search: 'Google Search views',
      maps: 'Google Maps views',
      follows: 'New follows',
      unfollows: 'Unfollows',
    }) as Record<string, string>
  )[key] || reportLabel(key).replaceAll('_', ' ');
const binary = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
};
const yieldWork = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function reportSelection(bundle: ReportBundle) {
  const range = bundle.range,
    timezone = bundle.timezone;
  const within = (r: CommunityRecord) =>
    Number.isFinite(Date.parse(r.time)) && inWindow(r, range, timezone);
  const rows = bundle.rows.filter(
    (r) => r.date >= range.start && r.date <= range.end,
  );
  const posts = bundle.posts.filter(
    (p) =>
      p.date >= range.start && p.date <= range.end && p.status === 'Published',
  );
  const history = bundle.records.filter(
    (r) =>
      r.kind === 'profile' ||
      (Number.isFinite(Date.parse(r.time)) &&
        localDate(r.time, timezone) <= range.end),
  );
  const inbox = inboxModel(history, range, timezone);
  const messages = bundle.records
    .filter((r) => r.kind === 'message' && within(r))
    .sort((a, b) => a.time.localeCompare(b.time));
  const mentions = bundle.records.filter(
    (r) => r.kind === 'mention' && within(r),
  );
  const reviews =
    bundle.reviewSelection ||
    bundle.records.filter((r) => r.kind === 'review' && within(r));
  const uncertainReviews = bundle.reviewSelection
    ? []
    : bundle.records.filter(
        (r) => r.kind === 'review' && r.timePrecision === 'relative',
      );
  return { rows, posts, messages, mentions, reviews, uncertainReviews, inbox };
}

export async function createReportPDF(
  bundle: ReportBundle,
  assets: Assets,
  progress: ReportProgress = () => {},
  signal?: AbortSignal,
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });
  doc.addFileToVFS('Noto-Regular.ttf', binary(assets.regular));
  doc.addFont('Noto-Regular.ttf', 'Noto', 'normal');
  doc.addFileToVFS('Noto-Bold.ttf', binary(assets.bold));
  doc.addFont('Noto-Bold.ttf', 'Noto', 'bold');
  doc.setFont('Noto');
  doc.setProperties({
    title: bundle.title,
    subject: 'Ysabel Society - all-platform marketing report',
    author: 'Ysabel Society',
    creator: 'arberhalili.com',
  });
  const W = doc.internal.pageSize.getWidth(),
    H = doc.internal.pageSize.getHeight(),
    M = 40,
    C = W - 80,
    B = H - 44;
  const selected = reportSelection(bundle),
    { rows, posts, inbox, messages, mentions, reviews, uncertainReviews } =
      selected;
  const sections: { name: string; page: number }[] = [];
  const framePages = new Set<number>();
  let y = 88,
    section = 'Overview',
    accent = '#497d72';
  const check = () => {
    if (signal?.aborted)
      throw new DOMException('Report cancelled', 'AbortError');
  };
  // Unsupported font glyphs remain identifiable instead of silently losing text.
  const textValue = (value: unknown) =>
    Array.from(display(value).normalize('NFC'))
      .map((c) => {
        if (c === '\n' || c === '\r' || c === '\t') return c;
        const metadata = doc.getFont().metadata as any;
        return metadata.characterToGlyph &&
          !metadata.characterToGlyph(c.codePointAt(0))
          ? '[U+' + c.codePointAt(0)!.toString(16).toUpperCase() + ']'
          : c;
      })
      .join('');
  const text = (
    value: unknown,
    x: number,
    top: number,
    size = 10,
    color = '#33404c',
    bold = false,
  ) => {
    doc.setFont('Noto', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(textValue(value), x, top);
  };
  const frame = () => {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (framePages.has(page)) return;
    framePages.add(page);
    doc.setFillColor('#f5f6f8');
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor('#ffffff');
    doc.roundedRect(20, 18, W - 40, H - 36, 16, 16, 'F');
    doc.addImage(assets.logo, 'PNG', M, 23, 82, 46, 'ysabel-logo', 'FAST');
    text(section, 146, 47, 11, '#394752', true);
    text(
      bundle.range.start + ' - ' + bundle.range.end,
      W - 236,
      45,
      9,
      '#657180',
    );
    doc.setDrawColor('#e1e5e9');
    doc.setLineWidth(0.6);
    doc.line(M, 73, W - M, 73);
  };
  const next = () => {
    doc.addPage();
    frame();
    y = 94;
  };
  const need = (height: number) => {
    if (y + height > B) next();
  };
  const paragraph = (
    value: unknown,
    size = 10,
    color = '#62707c',
    width = C,
  ) => {
    doc.setFont('Noto', 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(textValue(value), width) as string[];
    for (const line of lines) {
      need(size * 1.5);
      text(line, M, y, size, color);
      y += size * 1.5;
    }
    y += 7;
  };
  const heading = (name: string, note = '', color = '#497d72') => {
    section = name;
    accent = color;
    if (sections.length) doc.addPage();
    sections.push({ name, page: doc.getNumberOfPages() });
    frame();
    y = 104;
    text(name, M, y, 25, '#293b46', true);
    y += 25;
    if (note) paragraph(note);
    progress('Designing PDF · ' + name);
    check();
  };
  const sub = (name: string, note = '') => {
    doc.setFont('Noto', 'bold');
    doc.setFontSize(15);
    const lines = doc.splitTextToSize(textValue(name), C) as string[];
    need(lines.length * 22 + 43);
    for (const line of lines) {
      text(line, M, y, 15, '#354858', true);
      y += 22;
    }
    if (note) paragraph(note, 9);
  };
  const gradient = (
    x: number,
    top: number,
    w: number,
    h: number,
    color: string,
  ) => {
    doc.saveGraphicsState();
    doc.roundedRect(x, top, w, h, 12, 12, null);
    doc.clip();
    doc.discardPath();
    const c = hex(color);
    for (let i = 0; i < 36; i++) {
      const mix = 0.04 + 0.29 * (i / 35);
      doc.setFillColor(
        ...(c.map((v, j) =>
          Math.round([239, 242, 246][j] * (1 - mix) + v * mix),
        ) as [number, number, number]),
      );
      doc.rect(x, top + (i * h) / 36, w, h / 36 + 0.5, 'F');
    }
    doc.restoreGraphicsState();
    doc.setDrawColor('#d8dfe6');
    doc.setLineWidth(0.5);
    doc.roundedRect(x, top, w, h, 12, 12, 'S');
  };
  const cards = (
    items: {
      name: string;
      value: number | null | string;
      color?: string;
      note?: string;
    }[],
  ) => {
    for (let i = 0; i < items.length; i += 3) {
      need(90);
      const top = y,
        w = (C - 24) / 3;
      items.slice(i, i + 3).forEach((item, j) => {
        const x = M + j * (w + 12),
          c = item.color || accent;
        gradient(x, top, w, 76, c);
        text(item.name, x + 14, top + 20, 9, '#4b5e6b', true);
        text(
          item.value === null
            ? 'Not supplied'
            : typeof item.value === 'number'
              ? compact(item.value)
              : item.value,
          x + 14,
          top + 48,
          item.value === null ? 17 : 24,
          '#293f4c',
          true,
        );
        if (item.note) text(item.note, x + 14, top + 65, 7.5, '#52616c');
        doc.setDrawColor(c);
        doc.setLineWidth(1.4);
        doc.line(x + w - 40, top + 23, x + w - 32, top + 17);
        doc.line(x + w - 32, top + 17, x + w - 25, top + 20);
        doc.line(x + w - 25, top + 20, x + w - 17, top + 11);
      });
      y += 90;
    }
  };
  const chart = (
    title: string,
    points: MetricPoint[],
    keys: readonly string[],
    note = '',
  ) => {
    need(205);
    const top = y,
      h = 180;
    doc.setFillColor('#f7f9fb');
    doc.setDrawColor('#e0e5eb');
    doc.roundedRect(M, top, C, h, 12, 12, 'FD');
    text(title, M + 17, top + 23, 12, '#344c5c', true);
    const numeric = points.flatMap((p) =>
      keys
        .map((k) => p[k])
        .filter(
          (v): v is number => typeof v === 'number' && Number.isFinite(v),
        ),
    );
    const min = Math.min(0, ...numeric),
      max = Math.max(1, ...numeric),
      left = M + 62,
      right = W - M - 22,
      bottom = top + 137,
      ph = 83;
    for (let i = 0; i < 3; i++) {
      const value = min + ((max - min) * i) / 2,
        yy = bottom - (ph * i) / 2;
      doc.setDrawColor('#dce3eb');
      doc.setLineWidth(0.4);
      doc.line(left, yy, right, yy);
      text(compact(value), M + 12, yy + 3, 8, '#778695');
    }
    keys.forEach((key, ki) => {
      doc.setDrawColor(colorFor(key));
      doc.setFillColor(colorFor(key));
      doc.setLineWidth(1.6);
      let last: { x: number; y: number } | null = null;
      points.forEach((p, i) => {
        const v = p[key];
        if (typeof v !== 'number') {
          last = null;
          return;
        }
        const point = {
          x: left + ((right - left) * i) / Math.max(1, points.length - 1),
          y: bottom - ((v - min) / (max - min)) * ph,
        };
        if (last) doc.line(last.x, last.y, point.x, point.y);
        if (points.length < 36) doc.circle(point.x, point.y, 1.6, 'F');
        last = point;
      });
      const xx = M + 18 + ki * 142;
      doc.setFillColor(colorFor(key));
      doc.circle(xx, top + 163, 3, 'F');
      text(
        key.length > 23 ? key.slice(0, 21) + '…' : key,
        xx + 8,
        top + 166,
        8,
      );
    });
    if (!numeric.length)
      text(
        'No observations supplied for these dates',
        left + 110,
        top + 100,
        11,
        '#8793a0',
      );
    if (points.length) {
      text(points[0].date, left, bottom + 15, 8, '#778695');
      text(points.at(-1)!.date, right - 55, bottom + 15, 8, '#778695');
    }
    y += h + 13;
    if (note) paragraph(note, 8);
  };
  const bars = (
    name: string,
    values: { name: string; value: number }[],
    color = accent,
  ) => {
    if (!values.length) {
      paragraph(name + ': no numeric observations supplied.');
      return;
    }
    const shown = values.slice(0, 10),
      height = shown.length * 23 + 43;
    need(height + 15);
    const top = y;
    doc.setFillColor('#f7f9fb');
    doc.setDrawColor('#e0e5eb');
    doc.roundedRect(M, top, C, height, 12, 12, 'FD');
    text(name, M + 16, top + 24, 12, '#344c5c', true);
    const max = Math.max(1, ...shown.map((v) => Math.abs(v.value)));
    shown.forEach((v, i) => {
      const yy = top + 45 + i * 23;
      doc.setFontSize(9);
      const s = doc.splitTextToSize(textValue(v.name), 210)[0];
      text(s, M + 16, yy + 3, 9);
      doc.setFillColor(color);
      doc.roundedRect(
        M + 244,
        yy - 7,
        Math.max(1, (Math.abs(v.value) / max) * (C - 334)),
        10,
        3,
        3,
        'F',
      );
      text(display(v.value), W - M - 75, yy + 3, 9);
    });
    y += height + 14;
    if (values.length > 10)
      paragraph(
        'Chart shows the top 10; the table below includes every row.',
        8,
      );
  };
  const table = (
    columns: string[],
    body: unknown[][],
    options: {
      widths?: Record<number, number>;
      links?: Map<number, string>;
      photos?: Map<number, Uint8Array>;
    } = {},
  ) => {
    if (!body.length) {
      paragraph('No imported records for this selection.');
      return;
    }
    need(60);
    autoTable(doc, {
      startY: y,
      head: [columns],
      body: body.map((row) => row.map(textValue)),
      margin: { left: M, right: M, top: 88, bottom: 48 },
      tableWidth: C,
      theme: 'plain',
      styles: {
        font: 'Noto',
        fontSize: 9,
        cellPadding: 7,
        textColor: '#3d4a57',
        overflow: 'linebreak',
        lineColor: '#e4e8ed',
        lineWidth: { bottom: 0.4 },
      },
      headStyles: {
        fillColor: hex(accent),
        textColor: '#ffffff',
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: '#f3f6f9' },
      columnStyles: Object.fromEntries(
        Object.entries(options.widths || {}).map(([k, w]) => [
          k,
          { cellWidth: w },
        ]),
      ),
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      willDrawPage: () => frame(),
      didParseCell: (d) => {
        if (
          d.section === 'body' &&
          d.column.index === 0 &&
          options.photos?.has(d.row.index)
        ) {
          d.cell.styles.cellPadding = { top: 44, bottom: 7, left: 7, right: 7 };
        }
      },
      didDrawCell: (d) => {
        if (d.section !== 'body' || d.column.index !== 0) return;
        const photo = options.photos?.get(d.row.index);
        if (photo)
          try {
            doc.addImage(
              photo,
              'JPEG',
              d.cell.x + 7,
              d.cell.y + 6,
              32,
              32,
              undefined,
              'FAST',
            );
          } catch {}
        const url = options.links?.get(d.row.index);
        if (url)
          doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url });
      },
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  };
  const worldMap = (t: ReportTable) => {
    if (
      !assets.countries?.length ||
      !t.columns.some((k) => k === 'country' || k === 'location')
    )
      return;
    const measure = ['followers', 'activeUsers', 'percentage', 'sessions'].find(
      (k) => t.columns.includes(k),
    );
    if (!measure) return;
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    const lookup = new Map<string, string>();
    for (const c of assets.countries)
      for (const alias of [c.code, c.name, ...c.aliases])
        lookup.set(normalize(alias), c.code);
    const values = new Map<string, number>();
    for (const r of t.rows) {
      const key = lookup.get(normalize(String(r.country ?? r.location ?? ''))),
        value = r[measure];
      if (key && typeof value === 'number')
        values.set(key, (values.get(key) || 0) + value);
    }
    need(235);
    const top = y;
    const mapHeight = Math.min(338, B - y - 15);
    doc.setFillColor('#f6f8fb');
    doc.roundedRect(M, top, C, mapHeight, 12, 12, 'F');
    text(
      'Audience around the world · ' + label(measure),
      M + 16,
      top + 24,
      12,
      '#344c5c',
      true,
    );
    const scale = Math.min((C - 42) / 900, (mapHeight - 78) / 430),
      offset = M + (C - 900 * scale) / 2,
      max = Math.max(1, ...values.values()),
      palette = [
        '#b8dfdb',
        '#64bfba',
        '#319fbd',
        '#4271b8',
        '#7954a6',
        '#ab467e',
      ];
    for (const c of assets.countries) {
      const v = values.get(c.code);
      doc.setFillColor(
        v === undefined
          ? '#e0e6ee'
          : palette[
              Math.min(5, Math.floor(Math.sqrt(Math.max(0, v) / max) * 6))
            ],
      );
      doc.setDrawColor('#ffffff');
      doc.setLineWidth(0.25);
      const ops = [...c.path.matchAll(/([MLZ])([^MLZ]*)/g)].map((m) => ({
        op: m[1] === 'M' ? 'm' : m[1] === 'L' ? 'l' : 'h',
        c:
          m[1] === 'Z'
            ? []
            : m[2]
                .split(',')
                .map(
                  (n, i) => Number(n) * scale + (i === 0 ? offset : top + 36),
                ),
      }));
      doc.path(ops);
      doc.fillStrokeEvenOdd();
    }
    text('Lower', M + 18, top + mapHeight - 14, 8);
    palette.forEach((c, i) => {
      doc.setFillColor(c);
      doc.rect(M + 55 + i * 18, top + mapHeight - 22, 18, 9, 'F');
    });
    text('Higher', M + 170, top + mapHeight - 14, 8);
    text(
      'Grey: no supplied country value',
      M + 244,
      top + mapHeight - 14,
      8,
      '#687988',
    );
    y += mapHeight + 15;
  };
  const sourceTable = async (t: ReportTable) => {
    need(240);
    sub(
      t.title,
      `${t.period.start} - ${t.period.end} · ${t.observedAt ? 'Imported ' + t.observedAt.slice(0, 16).replace('T', ' ') : 'Imported source report'}`,
    );
    paragraph(t.scope, 9);
    if (
      t.period.start !== bundle.range.start ||
      t.period.end !== bundle.range.end
    )
      paragraph(
        'Source period differs from the report selection. Snapshot and period totals are shown in their original period, without prorating.',
        9,
      );
    if (t.truncated)
      paragraph(
        'PARTIAL SOURCE REPORT: the provider import was truncated. The PDF includes every stored row.',
        9,
        '#92593b',
      );
    worldMap(t);
    const metrics = t.columns.filter((k) =>
      t.rows.some((r) => typeof r[k] === 'number'),
    );
    for (const metric of metrics) {
      const plot = websitePlot(t, metric);
      bars(label(metric), plot.ranked, accent);
      if (plot.series.length > 1)
        chart(
          label(metric) + ' · over time',
          plot.series as MetricPoint[],
          plot.keys.slice(0, 5),
          'Leading categories shown; every supplied row is included in the table.',
        );
    }
    // Split wide records into readable column groups, repeating their identifier.
    const columns = [
      ...new Set([...t.columns, ...t.rows.flatMap((r) => Object.keys(r))]),
    ];
    for (let i = 1; i < columns.length; i += 6) {
      const keys = [columns[0], ...columns.slice(i, i + 6)];
      table(
        keys.map(label),
        t.rows.map((r) => keys.map((k) => r[k])),
      );
    }
    if (columns.length === 1)
      table(
        columns.map(label),
        t.rows.map((r) => [r[columns[0]]]),
      );
    await yieldWork();
    check();
  };
  const dailyPoints = (key: string, channels: readonly string[]) => {
    const result = new Map<string, MetricPoint>();
    for (
      let day = Date.parse(bundle.range.start + 'T12:00:00Z');
      day <= Date.parse(bundle.range.end + 'T12:00:00Z');
      day += 86400000
    ) {
      const date = new Date(day).toISOString().slice(0, 10);
      result.set(date, {
        date,
        ...Object.fromEntries(channels.map((c) => [c, null])),
      });
    }
    for (const row of rows) {
      if (!channels.includes(row.channel) || !metricAvailable([row], key))
        continue;
      const value = (row as any)[key],
        point = result.get(row.date);
      if (point && typeof value === 'number')
        point[row.channel] = Number(point[row.channel] ?? 0) + value;
    }
    return [...result.values()];
  };

  heading(
    'Overview',
    'All platforms · ' +
      bundle.timezone +
      ' · Generated ' +
      bundle.generatedAt.slice(0, 16).replace('T', ' '),
  );
  paragraph(bundle.title, 17, '#314853');
  if (bundle.mode !== 'live')
    paragraph(
      'DEMO DATA - illustrative records, not business results.',
      12,
      '#92593b',
    );
  cards(
    METRICS.map((m) => ({
      name: m.label,
      value: metricAvailable(rows, m.key) ? total(rows, m.key) : null,
      color: colorFor(
        m.key === 'sessions'
          ? 'Website'
          : m.key === 'search'
            ? 'Google Business'
            : 'Instagram',
      ),
      note:
        m.key === 'followers'
          ? 'Latest available snapshot'
          : m.key === 'reach'
            ? 'Daily sum; not unique people'
            : 'Selected reporting period',
    })),
  );
  paragraph('Included: ' + REPORT_SECTIONS.join(' / '), 9);
  paragraph(
    'Charts and cards use the same imported records and definitions as the app. Missing values remain unavailable; a measured zero remains zero. Detailed records and source periods follow each section.',
    9,
  );

  doc.addPage();
  const contentsPage = doc.getNumberOfPages();
  section = 'Contents';
  frame();
  heading(
    'Performance',
    'Separate metric charts across all social platforms, with website users and visits shown in their own units.',
  );
  for (const metric of [
    'profileViews',
    'views',
    'reach',
    'engagements',
    'followers',
    'users',
  ] as SocialMetric[]) {
    chart(
      label(metric),
      performanceSeries(
        rows,
        posts,
        SOCIAL_PLATFORMS,
        bundle.range,
        metric,
        'Daily activity',
      ),
      SOCIAL_PLATFORMS,
      metricExplanation(metric, 'Daily activity'),
    );
    await yieldWork();
    check();
  }
  for (const metric of SOCIAL_METRICS.filter(
    (m) => !['profileViews', 'followers', 'users'].includes(m.key),
  )) {
    const points = performanceSeries(
      rows,
      posts,
      SOCIAL_PLATFORMS,
      bundle.range,
      metric.key,
      'Published content',
    );
    if (
      points.some((p) => SOCIAL_PLATFORMS.some((c) => typeof p[c] === 'number'))
    ) {
      chart(
        metric.label + ' · published content',
        points,
        SOCIAL_PLATFORMS,
        metricExplanation(metric.key, 'Published content'),
      );
      await yieldWork();
      check();
    }
  }
  chart(
    'Website visits',
    dailyPoints('sessions', ['Website']),
    ['Website'],
    'GA4 sessions on ysabelsociety.com; separate from social content views.',
  );
  chart(
    'Website active users',
    dailyPoints('users', ['Website']),
    ['Website'],
    'Daily active users; repeat users across dates are not deduplicated.',
  );
  for (const channel of SOCIAL_PLATFORMS) {
    sub(channel + ' · daily activity');
    const own = rows.filter((r) => r.channel === channel);
    cards(
      [
        'profileViews',
        'views',
        'reach',
        'engagements',
        'followers',
        'users',
      ].map((k) => ({
        name: label(k),
        value: metricAvailable(own, k) ? total(own, k as keyof Daily) : null,
        color: colorFor(channel),
      })),
    );
    sub(
      channel + ' · published content',
      'Lifetime metrics on posts published in the selected period. These totals are separate from daily activity.',
    );
    const ownPosts = selectContent(posts, [channel], bundle.range);
    cards(
      SOCIAL_METRICS.filter(
        (m) => !['profileViews', 'followers', 'users'].includes(m.key),
      ).map((m) => {
        const vals = ownPosts
          .map((p) => postValue(p, m.key))
          .filter((n): n is number => n !== null);
        return {
          name: m.label,
          value: vals.length ? vals.reduce((a, b) => a + b, 0) : null,
          color: colorFor(channel),
        };
      }),
    );
  }
  const audience = bundle.tables.filter((t) => t.key.startsWith('audience'));
  heading(
    'Audience',
    'Country, city, age and gender breakdowns supplied by each platform. Snapshot periods stay visible.',
    '#8171ae',
  );
  for (const channel of SOCIAL_PLATFORMS) {
    sub(channel);
    const matches = audience.filter(
      (t) =>
        COMMUNITY_NAMES[t.source as keyof typeof COMMUNITY_NAMES] === channel,
    );
    if (!matches.length)
      paragraph('No audience breakdown has been supplied for this platform.');
    for (const t of matches) await sourceTable(t);
  }

  heading(
    'Website',
    'Google Analytics 4 · ysabelsociety.com · Visits, users, acquisition, pages, events and devices.',
    '#407b78',
  );
  const website = rows.filter((r) => r.channel === 'Website');
  cards(
    [
      'sessions',
      'users',
      'newUsers',
      'pageViews',
      'engaged',
      'engagementSeconds',
    ].map((k) => ({
      name: label(k),
      value: metricAvailable(website, k)
        ? total(website, k as keyof Daily)
        : null,
    })),
  );
  const websiteTables = bundle.tables.filter((t) => t.source === 'ga4');
  if (!websiteTables.length)
    paragraph('No website source tables have been supplied for this period.');
  for (const t of websiteTables) await sourceTable(t);

  heading(
    'Google Business',
    'Reports from your Business Profile · Google Search, Maps and customer interactions.',
    '#49916a',
  );
  const google = rows.filter((r) => r.channel === 'Google Business');
  const exactGoogle = bundle.tables.find(
    (t) =>
      t.source === 'gbp' &&
      t.key === GBP_SUMMARY &&
      t.period.start === bundle.range.start &&
      t.period.end === bundle.range.end,
  )?.rows[0];
  cards(
    GBP_METRICS.slice(0, 8).map((m) => ({
      name: m.label,
      value:
        typeof exactGoogle?.[m.key] === 'number'
          ? (exactGoogle[m.key] as number)
          : metricAvailable(google, m.key)
            ? total(google, m.key as keyof Daily)
            : null,
      color: m.color,
    })),
  );
  const googleTables = bundle.tables.filter((t) => t.source === 'gbp');
  if (!googleTables.length)
    paragraph('No Business Profile source reports have been supplied.');
  for (const t of googleTables) await sourceTable(t);

  heading(
    'Posts & reels',
    'Every imported published image, video, reel and story in the selected dates. Post metrics retain their source-defined lifetime or period scope.',
    '#b83d83',
  );
  for (const channel of SOCIAL_PLATFORMS) {
    sub(channel);
    const list = posts
      .filter((p) => p.platform === channel)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!list.length)
      paragraph('No published content imported for this period.');
    for (const p of list) {
      sub(
        p.title || 'Published content',
        p.date +
          ' · ' +
          p.format +
          ' · ' +
          (p.metricScope || 'lifetime') +
          ' metrics · ' +
          (p.observedAt
            ? 'Observed ' + p.observedAt.slice(0, 10)
            : 'Observation date not supplied'),
      );
      paragraph(p.caption || '', 10);
      const metrics = [
        ...new Set([
          ...(p.available || [
            'views',
            'reach',
            'likes',
            'comments',
            'shares',
            'saves',
          ]),
          ...SOCIAL_METRICS.map((m) => m.key),
        ]),
      ].filter(
        (k) =>
          typeof (p as any)[k] === 'number' &&
          (!p.available || p.available.includes(k)),
      );
      table(
        ['Metric', 'Value'],
        metrics.map((k) => [label(k), (p as any)[k]]),
        { widths: { 0: 340 } },
      );
      if (p.permalink && safeProfileURL(p.permalink)) {
        text('Open original post', M, y, 10, colorFor(channel));
        doc.link(M, y - 10, 140, 16, { url: p.permalink });
        y += 25;
      }
      if (p.sourceMetrics && Object.keys(p.sourceMetrics).length)
        paragraph(
          'Additional source details: ' + JSON.stringify(p.sourceMetrics),
          8,
        );
      await yieldWork();
      check();
    }
  }

  heading(
    'Inbox',
    'Imported conversations and all message folders. Unanswered counts use captured conversation history up to the report end date.',
    '#3f87a8',
  );
  cards([
    { name: 'Messages received', value: inbox.received.length },
    { name: 'Unanswered messages in period', value: inbox.unanswered.length },
    {
      name: 'Conversations awaiting reply',
      value: inbox.waiting.length,
      note: 'Backlog as of period end',
    },
  ]);
  for (const source of ['instagram', 'facebook', 'tiktok'] as const) {
    const own = messages.filter((r) => r.source === source);
    sub(COMMUNITY_NAMES[source]);
    bars(
      'Messages by folder',
      ['primary', 'general', 'requests', 'archived', 'unknown'].map((name) => ({
        name,
        value: own.filter(
          (r) => (r.folder || 'unknown') === name && r.direction === 'in',
        ).length,
      })),
      colorFor(COMMUNITY_NAMES[source]),
    );
    table(
      ['Time / profile', 'Folder', 'Direction', 'Message'],
      own.map((r) => [
        r.time + '\n' + (r.username || r.name || r.participantId || 'Unknown'),
        r.folder || 'unknown',
        r.direction === 'in' ? 'Received' : 'Sent',
        r.text || '(Attachment or empty message)',
      ]),
      { widths: { 0: 175, 1: 70, 2: 68 } },
    );
    await yieldWork();
    check();
  }
  heading(
    'Mentions',
    'All captured story mentions, story reposts, post mentions and tagged posts in the selected dates.',
    '#8870a9',
  );
  for (const source of ['instagram', 'facebook', 'tiktok'] as const) {
    sub(COMMUNITY_NAMES[source]);
    const own = mentions.filter((r) => r.source === source);
    bars(
      'Mentions by type',
      ['story_mention', 'story_repost', 'post_mention', 'post_tag'].map(
        (name) => ({
          name: label(name),
          value: own.filter((r) => r.mentionType === name).length,
        }),
      ),
      colorFor(COMMUNITY_NAMES[source]),
    );
    table(
      ['Date / profile', 'Type', 'Content'],
      own.map((r) => [
        r.time + '\n' + (r.username || r.name || 'Unknown'),
        label(r.mentionType || 'unknown'),
        r.text,
      ]),
      {
        widths: { 0: 190, 1: 120 },
        links: new Map(
          own
            .map((r, i) => [i, safeProfileURL(r.profileUrl)])
            .filter((x): x is [number, string] => !!x[1]),
        ),
      },
    );
  }

  heading(
    'Potential clients',
    'Awaiting-reply profiles flagged by the team, showing booking/collaboration intent, or with more than 5,000 followers. Profile details are the latest captured information.',
    '#9b7187',
  );
  table(
    [
      'Profile / platform',
      'Followers / location',
      'Why included',
      'Unanswered messages',
    ],
    inbox.priority.map((c) => [
      `${c.person.username || c.person.name || 'Unknown'}\n${COMMUNITY_NAMES[c.source]}`,
      `${display(c.person.followers)} · ${followerTier(c.person.followers)}\n${c.person.locationGroup || 'unknown'} · ${c.person.city || ''} ${c.person.country || ''}`,
      c.selectedClient
        ? 'Selected by team'
        : c.possibleClient
          ? 'Possible booking / collaboration'
          : 'Follower count above 5K',
      c.unanswered.length,
    ]),
    {
      widths: { 0: 200, 1: 200 },
      links: new Map(
        inbox.priority
          .map((c, i) => [i, safeProfileURL(c.person.profileUrl)])
          .filter((x): x is [number, string] => !!x[1]),
      ),
    },
  );

  heading(
    'Reviews',
    bundle.reviewNote ||
      'Google Business reviews and criticism themes. Period statistics use exact dates; reviews with approximate dates are listed separately.',
    '#49916a',
  );
  cards([
    {
      name: bundle.reviewSelection
        ? 'Reviews in selection'
        : 'Reviews in period',
      value: reviews.length,
    },
    {
      name: 'Average rating',
      value: reviews.length
        ? (
            reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
          ).toFixed(2)
        : null,
    },
    {
      name: '1-3 star reviews',
      value: reviews.filter((r) => (r.rating || 5) <= 3).length,
    },
  ]);
  bars(
    'Rating distribution',
    [1, 2, 3, 4, 5].map((star) => ({
      name: star + ' stars',
      value: reviews.filter((r) => r.rating === star).length,
    })),
  );
  const criticism = reviews.flatMap((r) =>
    reviewTopics(r).criticisms.map((c) => c.topic),
  );
  bars(
    'Criticism themes',
    [...new Set(criticism)]
      .map((name) => ({
        name,
        value: criticism.filter((t) => t === name).length,
      }))
      .sort((a, b) => b.value - a.value),
    '#b87b73',
  );
  const reviewList = async (list: CommunityRecord[], title: string) => {
    sub(title);
    for (const star of [1, 2, 3, 4, 5]) {
      const group = list.filter((r) => r.rating === star);
      if (!group.length) continue;
      sub(star + '-star reviews');
      const links = new Map<number, string>(),
        photos = new Map<number, Uint8Array>();
      group.forEach((r, i) => {
        const link = reviewLink(r);
        if (link) links.set(i, link.url);
        const photo = assets.photos?.get(photoKey(r));
        if (photo) photos.set(i, photo);
      });
      table(
        ['Reviewer / date', 'Review and response', 'Criticism / original link'],
        group.map((r) => [
          `${r.name || r.username || 'Anonymous'}\n${reviewDateLabel(r, bundle.timezone)}${!assets.photos?.has(photoKey(r)) ? '\nProfile photo unavailable' : ''}`,
          `${r.text || '(No written comment)'}${r.reply ? '\n\nBusiness response: ' + r.reply : ''}`,
          reviewTopics(r)
            .criticisms.map((c) => c.topic + ': ' + c.excerpt)
            .join('\n') +
            '\n' +
            (reviewLink(r)?.url || 'Direct review link not supplied'),
        ]),
        { widths: { 0: 165, 2: 220 }, links, photos },
      );
      await yieldWork();
      check();
    }
  };
  await reviewList(
    reviews,
    bundle.reviewSelection
      ? 'All filtered reviews'
      : 'All reviews in the selected period',
  );
  if (uncertainReviews.length) {
    paragraph(
      'The following ' +
        uncertainReviews.length +
        ' imported reviews have approximate dates and are excluded from the period totals above. They are included for reference rather than assigned to an exact day.',
      10,
    );
    await reviewList(
      uncertainReviews,
      'Approximate dates · separate reference',
    );
  }

  heading(
    'Source details',
    'All daily observations, additional source reports, and platform coverage for this report.',
    '#627c9a',
  );
  const handled = new Set([...audience, ...websiteTables, ...googleTables]);
  for (const t of bundle.tables.filter((t) => !handled.has(t)))
    await sourceTable(t);
  sub(
    'Daily observations',
    'Every available metric is included. Empty cells mean not supplied. Followers are snapshots; reach and users are daily counts that can overlap.',
  );
  const keys = [
    ...new Set(
      rows.flatMap(
        (r) =>
          r.available ||
          Object.keys(r).filter((k) => typeof (r as any)[k] === 'number'),
      ),
    ),
  ];
  for (let i = 0; i < keys.length; i += 6) {
    const group = keys.slice(i, i + 6);
    table(
      ['Date / platform', ...group.map(label)],
      rows.map((r) => [
        r.date + '\n' + r.channel,
        ...group.map((k) => (metricAvailable([r], k) ? (r as any)[k] : null)),
      ]),
      { widths: { 0: 125 } },
    );
    await yieldWork();
    check();
  }
  const extra = rows.filter(
    (r) => r.sourceMetrics && Object.keys(r.sourceMetrics).length,
  );
  if (extra.length) {
    sub('Additional daily source details');
    table(
      ['Date / platform', 'Source values'],
      extra.map((r) => [
        r.date + '\n' + r.channel,
        JSON.stringify(r.sourceMetrics),
      ]),
      { widths: { 0: 150 } },
    );
  }
  sub('Connection coverage');
  table(
    ['Platform', 'Status', 'Last imported'],
    CHANNELS.map((c) => {
      const s = bundle.sourceStatus.find((s) => s.channel === c);
      return [
        c,
        s?.status || 'No connection reported',
        s?.lastSync || 'Not supplied',
      ];
    }),
  );
  sub('Community coverage');
  table(
    ['Platform / category', 'Status', 'Details'],
    bundle.communityStatus.map((s) => [
      `${s.source} / ${s.kind}`,
      s.state,
      `${s.detail}\n${s.syncedAt || ''}`,
    ]),
    { widths: { 0: 160, 1: 95 } },
  );
  paragraph(
    'Unimported, expired, permission-restricted or provider-unavailable data cannot be reconstructed by a report. Captured mentions and messages are not proof of complete platform history. Latest snapshots and native exports retain their original dates. Each download reads the current stored data for the saved selection.',
    9,
  );
  doc.setPage(contentsPage);
  y = 107;
  text('Contents', M, y, 25, '#293b46', true);
  y += 32;
  paragraph('Choose a section below to jump to its pages.', 10);
  sections.forEach((s, i) => {
    text(String(i + 1).padStart(2, '0'), M, y, 10, '#718797');
    text(s.name, M + 35, y, 12, '#354858', true);
    text(String(s.page), W - M - 26, y, 10);
    doc.link(M, y - 14, C, 22, { pageNumber: s.page });
    doc.setDrawColor('#e1e7ed');
    doc.line(M, y + 9, W - M, y + 9);
    y += 30;
  });
  const count = doc.getNumberOfPages();
  for (let n = 1; n <= count; n++) {
    doc.setPage(n);
    text(
      'Ysabel Society · Internal use · arberhalili.com',
      M,
      H - 25,
      8,
      '#74818d',
    );
    text(n + ' / ' + count, W - M - 50, H - 25, 8, '#74818d');
  }
  progress('PDF ready · ' + count + ' pages');
  return doc;
}

export async function downloadReportPDF(
  bundle: ReportBundle,
  progress: ReportProgress,
  signal?: AbortSignal,
) {
  const read = async (path: string) => {
    const r = await fetch(appPath(path), {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error('Report artwork could not load. Please retry.');
    return new Uint8Array(await r.arrayBuffer());
  };
  progress('Preparing logo and typography…');
  const [regular, bold, logo, mapBytes] = await Promise.all([
    read('/fonts/NotoSans-Regular.ttf'),
    read('/fonts/NotoSans-Bold.ttf'),
    read('/ysabel-society-logo.png'),
    read('/maps/world-countries.json'),
  ]);
  const photos = new Map<string, Uint8Array>(),
    selected = reportSelection(bundle),
    reviews = [...selected.reviews, ...selected.uncertainReviews];
  for (let i = 0; i < reviews.length; i += 5) {
    if (signal?.aborted)
      throw new DOMException('Report cancelled', 'AbortError');
    await Promise.all(
      reviews.slice(i, i + 5).map(async (r) => {
        if (!r.avatar) return;
        try {
          const response = await fetch(
            appPath(
              '/api/review-photo?' +
                new URLSearchParams({ accountId: r.accountId, id: r.id }),
            ),
            {
              signal: signal
                ? AbortSignal.any([signal, AbortSignal.timeout(9000)])
                : AbortSignal.timeout(9000),
            },
          );
          if (!response.ok) return;
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob),
            canvas = document.createElement('canvas');
          canvas.width = 80;
          canvas.height = 80;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 80, 80);
          const scale = Math.min(80 / bitmap.width, 80 / bitmap.height);
          ctx.drawImage(
            bitmap,
            (80 - bitmap.width * scale) / 2,
            (80 - bitmap.height * scale) / 2,
            bitmap.width * scale,
            bitmap.height * scale,
          );
          bitmap.close();
          const jpeg = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.82),
          );
          if (jpeg)
            photos.set(photoKey(r), new Uint8Array(await jpeg.arrayBuffer()));
        } catch {}
      }),
    );
    progress(
      'Preparing review photos · ' +
        Math.min(i + 5, reviews.length) +
        ' / ' +
        reviews.length,
    );
  }
  const doc = await createReportPDF(
    bundle,
    {
      regular,
      bold,
      logo,
      photos,
      countries: JSON.parse(new TextDecoder().decode(mapBytes)),
    },
    progress,
    signal,
  );
  if (signal?.aborted) throw new DOMException('Report cancelled', 'AbortError');
  doc.save(
    'Ysabel-Society-All-Platforms-' +
      bundle.range.start +
      '-' +
      bundle.range.end +
      '.pdf',
  );
}
