// Parity check (npm run parity): the in-browser TypeScript engine must return exactly what the Python API returns.
// Expected outputs come from the real backend code (scripts/parity_expected.py). Exits 1 on the first mismatches.
import { readFileSync } from 'node:fs';
import { TEXT_COLUMN_CANDIDATES, analisarTexto } from '../src/app/engine/detector.ts';
import { lerCsv } from '../src/app/engine/csv.ts';

const here = new URL('./parity/', import.meta.url);
const input = new URL('../../BackEnd/data/input/', import.meta.url);
const expected = JSON.parse(readFileSync(new URL('expected.json', here), 'utf8')) as { csv: Record<string, unknown[]>; cases: unknown[] };
const cases = JSON.parse(readFileSync(new URL('cases.json', here), 'utf8')) as string[];

const fails: string[] = [];
let total = 0;
const compare = (label: string, texto: string, want: unknown) => {
  total++;
  const got = JSON.stringify(analisarTexto(texto));
  if (got !== JSON.stringify(want)) fails.push(`${label}\n  texto: ${texto.slice(0, 120)}\n  ts:    ${got.slice(0, 600)}\n  py:    ${JSON.stringify(want).slice(0, 600)}`);
};

for (const [name, rows] of Object.entries(expected.csv)) {
  const [header, ...body] = lerCsv(readFileSync(new URL(encodeURIComponent(name), input), 'utf8'), ',');
  const col = header.findIndex((c) => TEXT_COLUMN_CANDIDATES.includes(c.toLowerCase()));
  if (body.length !== rows.length) fails.push(`${name}: ${body.length} rows parsed, pandas read ${rows.length}`);
  // pandas turns an empty cell into NaN and the API analyses str(NaN) == "nan".
  body.forEach((r, i) => compare(`${name} row ${i + 1}`, r[col] === '' || r[col] === undefined ? 'nan' : r[col], rows[i]));
}
cases.forEach((t, i) => compare(`case ${i + 1}`, t, expected.cases[i]));

if (fails.length) {
  console.error(`parity: ${fails.length}/${total} mismatch(es)\n` + fails.slice(0, 8).join('\n'));
  process.exit(1);
}
console.log(`parity: ${total}/${total} identical to the Python API (${Object.keys(expected.csv).length} CSVs + ${cases.length} cases)`);
