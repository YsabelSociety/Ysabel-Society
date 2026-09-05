import {
  METRICS,
  metricAvailable,
  CHANNELS,
  compact,
  number,
  total,
  series,
  type Daily,
  type Post,
  type Range,
} from './analytics';
function download(bytes: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function exportCSV(rows: Daily[], range: Range, mode = 'demo') {
  const headers = [
    'date',
    'unit',
    'channel',
    'views',
    'reach',
    'engagements',
    'followers',
    'users',
    'actions',
    'conversions',
    'search',
    'maps',
    'calls',
    'directions',
    'clicks',
    'sessions',
    'engaged',
    'pageViews',
  ];
  const escape = (v: unknown) =>
    '"' +
    String(v ?? '')
      .replace(/^[=+\-@]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  download(
    '\uFEFF' +
      [
        headers,
        ...rows.map((r) =>
          headers.map((h) =>
            r.available &&
            typeof (r as any)[h] === 'number' &&
            !r.available.includes(h)
              ? null
              : (r as any)[h],
          ),
        ),
      ]
        .map((r) => r.map(escape).join(','))
        .join('\r\n'),
    'text/csv;charset=utf-8',
    'ysabel-' + mode + '-' + range.start + '-' + range.end + '.csv',
  );
}
export function exportPNG(
  rows: Daily[],
  range: Range,
  unit: string,
  mode = 'demo',
) {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 1000;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9edf3';
  g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = '#465872';
  g.font = '22px Georgia';
  g.fillText('YSABEL SOCIETY', 70, 80);
  g.font = '13px Arial';
  g.fillText(
    'DIGITAL INTELLIGENCE  /  ' +
      (mode === 'live' ? 'LIVE SOURCE DATA' : 'DEMO DATA'),
    70,
    111,
  );
  g.fillStyle = '#26354b';
  g.font = '42px Arial';
  g.fillText('A clearer view of Ysabel Society.', 70, 190);
  g.fillStyle = '#5e6b7e';
  g.font = '19px Arial';
  g.fillText(unit + '   |   ' + range.start + ' — ' + range.end, 70, 230);
  METRICS.forEach((m, i) => {
    const x = 70 + (i % 3) * 495,
      y = 300 + Math.floor(i / 3) * 160;
    g.fillStyle = '#5e6b7e';
    g.font = '17px Arial';
    g.fillText(m.label, x, y);
    g.fillStyle = '#26354b';
    g.font = '48px Arial';
    g.fillText(
      metricAvailable(rows, m.key)
        ? compact(total(rows, m.key))
        : 'Unavailable',
      x,
      y + 60,
    );
  });
  const data = metricAvailable(rows, 'views') ? series(rows, 'views') : [],
    max = Math.max(...data.map((d) => Number(d.total)), 1);
  g.strokeStyle = '#607e9f';
  g.lineWidth = 3;
  g.beginPath();
  data.forEach((d, i) => {
    const x = 70 + (i / Math.max(data.length - 1, 1)) * 1460,
      y = 850 - (Number(d.total) / max) * 220;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  });
  g.stroke();
  g.fillStyle = '#5e6b7e';
  g.font = '15px Arial';
  g.fillText(
    'Social content views over time · Daily reach and users are additive, not unique audiences.',
    70,
    925,
  );
  c.toBlob((b) => {
    if (b) download(b, 'image/png', 'ysabel-performance-' + mode + '.png');
  }, 'image/png');
}
const ascii = (s: string) =>
  s.replace(
    /[^\x20-\x7e]/g,
    (c) =>
      (
        ({
          '—': '-',
          '–': '-',
          '·': '/',
          '×': 'x',
          '’': "'",
          ë: 'e',
        }) as Record<string, string>
      )[c] ?? '',
  );
const escapePDF = (s: string) => ascii(s).replace(/([\\()])/g, '\\$1');
export function exportPDF(
  rows: Daily[],
  posts: Post[],
  range: Range,
  unit: string,
  title = 'Performance report',
  mode = 'demo',
) {
  const pages: string[] = [];
  const W = 595,
    H = 842;
  let stream = '';
  const text = (
    s: string,
    x: number,
    y: number,
    size = 11,
    color = '0.17 0.22 0.29',
    font = 'F1',
  ) => {
    stream +=
      color +
      ' rg BT /' +
      font +
      ' ' +
      size +
      ' Tf 1 0 0 1 ' +
      x +
      ' ' +
      (H - y) +
      ' Tm (' +
      escapePDF(s) +
      ') Tj ET\n';
  };
  const line = (x: number, y: number, w: number) => {
    stream +=
      '0.79 0.82 0.87 RG .5 w ' +
      x +
      ' ' +
      (H - y) +
      ' m ' +
      (x + w) +
      ' ' +
      (H - y) +
      ' l S\n';
  };
  const paragraph = (s: string, y: number) => {
    const words = s.split(' ');
    let row = '';
    for (const word of words) {
      if ((row + ' ' + word).length > 85) {
        text(row, 48, y, 11);
        y += 17;
        row = word;
      } else row += (row ? ' ' : '') + word;
    }
    if (row) {
      text(row, 48, y, 11);
      y += 17;
    }
    return y;
  };
  const header = (n: number) => {
    text('YSABEL SOCIETY', 48, 50, 15, '0.23 0.29 0.39', 'F2');
    text('DIGITAL INTELLIGENCE', 48, 69, 8);
    text(
      mode === 'live' ? 'PRIVATE / LIVE DATA' : 'PRIVATE / DEMO DATA',
      420,
      50,
      8,
    );
    line(48, 87, 499);
    text(String(n).padStart(2, '0'), 530, 803, 9);
    text(range.start + ' - ' + range.end + '  /  ' + unit, 48, 803, 9);
  };
  header(1);
  text(title, 48, 138, 30, '0.15 0.20 0.28', 'F2');
  text('A measured view of attention, community and intent.', 48, 164, 11);
  text('EXECUTIVE PERSPECTIVE', 48, 212, 9);
  paragraph(
    'Ysabel Society generated ' +
      (metricAvailable(rows, 'views')
        ? number(total(rows, 'views'))
        : 'Unavailable') +
      ' social content views and ' +
      (metricAvailable(rows, 'engagements')
        ? number(total(rows, 'engagements'))
        : 'Unavailable') +
      ' engagements during this period. Google recorded ' +
      (metricAvailable(rows, 'actions')
        ? number(total(rows, 'actions'))
        : 'Unavailable') +
      ' customer actions. ' +
      (mode === 'live'
        ? 'Only connected sources are included. Missing sources and unavailable measures must not be interpreted as measured zero.'
        : 'These deterministic sample records demonstrate the platform and are not actual business results.'),
    237,
  );
  METRICS.forEach((m, i) => {
    const x = 48 + (i % 2) * 260,
      yy = 350 + Math.floor(i / 2) * 92;
    text(m.label, x, yy, 10);
    text(
      metricAvailable(rows, m.key)
        ? compact(total(rows, m.key))
        : 'Unavailable',
      x,
      yy + 32,
      28,
      '0.17 0.23 0.32',
      'F2',
    );
    line(x, yy + 49, 230);
  });
  text('MEASUREMENT NOTES', 48, 675, 9);
  paragraph(
    'Aggregated reach sums daily reported reach and cannot deduplicate people across dates or platforms. Website users are daily active-user sums. Google actions are clicks and direction requests, not confirmed visits. No completed reservations are attributed.',
    700,
  );
  pages.push(stream);
  stream = '';
  header(2);
  text('Channels & creative performance', 48, 138, 26, '0.15 0.20 0.28', 'F2');
  text('CHANNEL', 48, 198, 9);
  text('PRIMARY RESULT', 285, 198, 9);
  text('MEASUREMENT', 402, 198, 9);
  line(48, 210, 499);
  CHANNELS.forEach((c, i) => {
    const r = rows.filter((d) => d.channel === c);
    const metric = i < 3 ? 'views' : i === 3 ? 'actions' : 'users';
    text(c, 48, 238 + i * 38, 12);
    text(
      metricAvailable(r, metric) ? number(total(r, metric)) : 'Unavailable',
      285,
      238 + i * 38,
      12,
    );
    text(
      i < 3 ? 'Content views' : i === 3 ? 'Customer actions' : 'Daily users',
      402,
      238 + i * 38,
      10,
    );
    line(48, 253 + i * 38, 499);
  });
  text('CONTENT TO LEARN FROM', 48, 471, 9);
  const ranked = posts
    .filter(
      (p) =>
        p.status === 'Published' &&
        p.date >= range.start &&
        p.date <= range.end,
    )
    .sort((a, b) => b.views - a.views)
    .slice(0, 4);
  if (!ranked.length)
    text('No published content in the selected range.', 48, 504, 11);
  ranked.forEach((p, i) => {
    text(String(i + 1).padStart(2, '0'), 48, 507 + i * 40, 12);
    text(p.title.slice(0, 50), 78, 507 + i * 40, 12);
    text(
      p.platform +
        ' / ' +
        compact(p.views) +
        ' views / ' +
        compact(p.shares) +
        ' shares',
      78,
      523 + i * 40,
      9,
    );
  });
  text('NEXT CONSIDERATIONS', 48, 702, 9);
  paragraph(
    'Compare saves and shares alongside reach. Test creative patterns against the existing baseline. Improve reservation tracking before making claims about content-led bookings. Observed associations do not establish causation.',
    727,
  );
  pages.push(stream);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>',
  ];
  const kids: number[] = [];
  pages.forEach((p) => {
    const pageNum = objects.length + 1,
      contentNum = pageNum + 1;
    kids.push(pageNum);
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        W +
        ' ' +
        H +
        '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' +
        contentNum +
        ' 0 R >>',
    );
    objects.push('<< /Length ' + p.length + ' >>\nstream\n' + p + 'endstream');
  });
  objects[1] =
    '<< /Type /Pages /Kids [' +
    kids.map((n) => n + ' 0 R').join(' ') +
    '] /Count ' +
    kids.length +
    ' >>';
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += i + 1 + ' 0 obj\n' + o + '\nendobj\n';
  });
  const xref = pdf.length;
  pdf +=
    'xref\n0 ' +
    (objects.length + 1) +
    '\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    'trailer\n<< /Size ' +
    (objects.length + 1) +
    ' /Root 1 0 R >>\nstartxref\n' +
    xref +
    '\n%%EOF';
  download(
    pdf,
    'application/pdf',
    'ysabel-' + mode + '-report-' + range.start + '.pdf',
  );
}
