// Minimal RFC 4180 CSV reader/writer for the in-browser batch mode. No imports (scripts/parity.ts runs it in Node).
// Reads like pandas.read_csv does for the API: quoted fields with "" escapes and line breaks, CRLF or LF,
// blank lines skipped. One extra over the API: a header with more ";" (or tabs) than "," switches the separator,
// since Brazilian Excel exports use ";".

export function detectarSeparador(texto: string): string {
  const header = texto.slice(0, texto.search(/\r?\n|$/));
  const conta = (s: string) => header.split(s).length - 1;
  return [';', '\t'].find((s) => conta(s) > conta(',')) ?? ',';
}

export function lerCsv(texto: string, sep = detectarSeparador(texto)): string[][] {
  texto = texto.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (texto[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  if (field || row.length) endRow();
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

/** CSV with BOM (Excel opens UTF-8 right) and CRLF. Cells starting with = + - @ get a leading ' (formula injection). */
export function escreverCsv(rows: string[][], sep = ','): string {
  const cell = (v: string) => {
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(sep)).join('\r\n') + '\r\n';
}
