const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN_X = 28;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 32;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLUMN_WIDTHS = {
  '#': 28,
  Status: 52,
  Vitals: 70,
  Name: 148,
  Systolic: 52,
  Diastolic: 56,
  Pulse: 42,
  Glucose: 52,
  Weight: 48,
  'Last Upload': 72,
  '# Readings': 62,
  Time: 42,
};

const ascii = (value) => String(value ?? '')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/\u2026/g, '...')
  .replace(/[^\x20-\x7E]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const escapePdf = (value) => ascii(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const fitText = (value, width, fontSize) => {
  const clean = ascii(value);
  const maxChars = Math.max(1, Math.floor(width / (fontSize * 0.52)));
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 3) return clean.slice(0, maxChars);
  return `${clean.slice(0, maxChars - 3)}...`;
};

const columnWidths = (headers) => {
  const widths = headers.map((header) => COLUMN_WIDTHS[header] || 60);
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= USABLE_WIDTH) {
    const nameIndex = headers.indexOf('Name');
    if (nameIndex >= 0) widths[nameIndex] += USABLE_WIDTH - total;
    return widths;
  }
  const scale = USABLE_WIDTH / total;
  return widths.map((width) => Math.max(24, Math.floor(width * scale)));
};

const drawText = (x, y, size, text, color = '0 0 0') => (
  `${color} rg\nBT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdf(text)}) Tj ET\n`
);

const drawRect = (x, y, width, height, color) => (
  `${color} rg\n${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`
);

const buildPageStream = ({ title, metaLines, headers, rows, widths, pageNumber, pageCount, continued }) => {
  const ops = [];
  let cursor = PAGE_HEIGHT - MARGIN_TOP;

  if (!continued) {
    ops.push(drawText(MARGIN_X, cursor - 12, 14, title || 'Look up Patient', '0 0.467 0.714'));
    cursor -= 22;
    metaLines.forEach((line) => {
      const text = fitText(line, USABLE_WIDTH, 8);
      if (!text) return;
      ops.push(drawText(MARGIN_X, cursor - 8, 8, text, '0.33 0.33 0.33'));
      cursor -= 11;
    });
    cursor -= 8;
  }

  const headerHeight = 16;
  const rowHeight = 14;
  const tableTop = cursor;
  let x = MARGIN_X;
  ops.push(drawRect(MARGIN_X, tableTop - headerHeight, USABLE_WIDTH, headerHeight, '0 0.467 0.714'));
  headers.forEach((header, index) => {
    ops.push(drawText(x + 3, tableTop - 11, 7, fitText(header, widths[index] - 6, 7), '1 1 1'));
    x += widths[index];
  });
  cursor = tableTop - headerHeight;

  const bodyBottom = MARGIN_BOTTOM + 14;
  const fittedRows = [];
  rows.forEach((row) => {
    if (cursor - rowHeight < bodyBottom) return;
    let cellX = MARGIN_X;
    if (fittedRows.length % 2 === 1) {
      ops.push(drawRect(MARGIN_X, cursor - rowHeight, USABLE_WIDTH, rowHeight, '0.96 0.97 0.98'));
    }
    headers.forEach((_, index) => {
      ops.push(drawText(cellX + 3, cursor - 10, 7, fitText(row[index], widths[index] - 6, 7)));
      cellX += widths[index];
    });
    cursor -= rowHeight;
    fittedRows.push(row);
  });

  ops.push(drawText(
    MARGIN_X,
    16,
    8,
    `Page ${pageNumber} of ${pageCount}`,
    '0.4 0.4 0.4',
  ));

  return {
    stream: ops.join(''),
    consumed: fittedRows.length,
  };
};

const assemblePdf = (streams) => {
  const pageCount = streams.length;
  const objects = new Map();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const pageIds = streams.map((_, index) => 4 + index * 2);
  const contentIds = streams.map((_, index) => 5 + index * 2);
  objects.set(2, `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  streams.forEach((stream, index) => {
    objects.set(pageIds[index], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentIds[index]} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    objects.set(contentIds[index], `<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });

  const maxId = 3 + pageCount * 2;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefPosition = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id <= maxId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
  return pdf;
};

export function buildLookupPdf({ title = 'Look up Patient', metaLines = [], headers = [], rows = [] }) {
  const safeHeaders = headers.length > 0 ? headers : ['#'];
  const widths = columnWidths(safeHeaders);
  const safeRows = rows.map((row) => safeHeaders.map((_, index) => row?.[index] ?? ''));
  const pages = [];
  let remaining = safeRows;
  let continued = false;

  while (remaining.length > 0 || pages.length === 0) {
    const draft = buildPageStream({
      title,
      metaLines,
      headers: safeHeaders,
      rows: remaining,
      widths,
      pageNumber: pages.length + 1,
      pageCount: 1,
      continued,
    });
    pages.push(draft);
    if (draft.consumed <= 0) break;
    remaining = remaining.slice(draft.consumed);
    continued = true;
    if (remaining.length === 0) break;
  }

  const pageCount = pages.length;
  const streams = pages.map((page, index) => buildPageStream({
    title,
    metaLines,
    headers: safeHeaders,
    rows: safeRows.slice(
      pages.slice(0, index).reduce((sum, item) => sum + item.consumed, 0),
      pages.slice(0, index + 1).reduce((sum, item) => sum + item.consumed, 0),
    ),
    widths,
    pageNumber: index + 1,
    pageCount,
    continued: index > 0,
  }).stream);

  return assemblePdf(streams);
}
