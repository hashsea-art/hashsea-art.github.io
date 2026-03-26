// CSV parsing utilities for turning raw text into normalized row objects.
function normalizeHeader(header) {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function parseCSV(text) {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field.trim());
      field = '';
      if (row.some((value) => value !== '')) records.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field.trim());
  if (row.some((value) => value !== '')) records.push(row);

  if (!records.length) return [];
  const headers = records[0].map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = values[index] ?? '';
    });
    rows.push(rowObject);
  }
  return rows;
}
