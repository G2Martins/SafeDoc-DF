// SafeDoc-DF detection engine: a line-by-line port of BackEnd/src/core/detector.py (+ models/validators.py and the
// thresholds of core/config.py). Same rules, regexes, validators, overlap resolution, scoring and anonymization.
// `npm run parity` runs it over the sample CSVs and synthetic cases and diffs against outputs of the real Python code.
// No imports on purpose: Node runs this file directly (type stripping) in scripts/parity.ts.
//
// Python `re` vs JavaScript RegExp, handled below so results match character for character:
// - `\b` and `\w` in Python are Unicode-aware ("nº123" has no boundary between º and 1); JS `\b` is ASCII-only,
//   so `\b` becomes a lookaround over [\p{L}\p{N}_].
// - Python `\s` = str.isspace(); JS `\s` differs (﻿ vs \x1c-\x1f, \x85), so `\s` becomes an explicit class.
// - Python indexes strings by code point, JS by UTF-16 unit: positions are converted, so context windows and masking
//   agree even with emoji in the text.
// ponytail: `\d` stays ASCII (Python's also matches e.g. fullwidth digits) and combining marks are removed with \p{Mn}
// (Python checks combining class > 0). Both only differ on scripts that never show up in LAI requests.

export type Status = 'PUBLICAR' | 'REVISAR' | 'BLOQUEAR';

/** One finding, exactly as the API returns it (same keys, same order). */
export interface Ocorrencia {
  tipo: string;
  valor_detectado: string;
  valor_normalizado: string | null;
  motivo: string | null;
  contexto: string;
  score: number;
}

/** Response of POST /validate/text (the API returns this object as is). */
export interface Analise {
  status: Status;
  score: number;
  total_matches: number;
  matches: Ocorrencia[];
  texto_anonimizado: string;
}

/** Code-point span of a finding in the normalized text. Not part of the API payload: used to highlight. */
export interface Span {
  start: number;
  end: number;
  tipo: string;
}

// core/config.py: only the fields the detector reads.
export const POLITICA = { score_sensivel_estrito: 6, score_bloquear: 8, score_revisar: 3 } as const;
// core/config.py TEXT_COLUMN_CANDIDATES: the CSV endpoint analyses the first column whose lowercased name is here.
export const TEXT_COLUMN_CANDIDATES = ['descricao', 'texto mascarado', 'detalhe', 'mensagem', 'conteudo'];

// ---------- Python-compatible regex building blocks ----------

const W = '[\\p{L}\\p{N}_]';
const PY_B = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;
const PY_S_BODY = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const PY_S = `[${PY_S_BODY}]`;
const IS_SPACE = new RegExp(`^${PY_S}$`, 'u');

/** re.compile(p, re.IGNORECASE | re.UNICODE), with Python's \b and \s (also inside a class, as in `[\s-]`). */
function comp(p: string): RegExp {
  let out = '';
  let inClass = false;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\') {
      const e = p.slice(i, i + 2);
      i++;
      out += e === '\\b' && !inClass ? PY_B : e === '\\s' ? (inClass ? PY_S_BODY : PY_S) : e;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    out += c;
  }
  return new RegExp(out, 'giu');
}

/** str.casefold(): toLowerCase plus the folds that differ for text that went through NFKD. */
const casefold = (s: string) => s.toLowerCase().replace(/ß/g, 'ss').replace(/ς/g, 'σ');

// ---------- Normalization ----------

/**
 * normalizar_raw (NBSP -> space, whitespace runs -> one space, strip) plus, for each code point of the result,
 * the code-point index it came from in the input. The map lets the UI highlight findings in the original layout.
 */
export function mapear(texto: string): { raw: string; mapa: number[] } {
  const src = Array.from(texto);
  const out: string[] = [];
  const mapa: number[] = [];
  let ws = -1;
  src.forEach((ch, i) => {
    if (IS_SPACE.test(ch)) {
      if (ws < 0) ws = i;
      return;
    }
    if (ws >= 0 && out.length) {
      out.push(' ');
      mapa.push(ws);
    }
    ws = -1;
    out.push(ch);
    mapa.push(i);
  });
  return { raw: out.join(''), mapa };
}

export const normalizarRaw = (texto: unknown) => (texto == null ? '' : mapear(String(texto)).raw);

/** normalizar_busca: NFKD, drop combining marks, collapse spaces, casefold. */
export function normalizarBusca(texto: unknown): string {
  const s = normalizarRaw(texto);
  if (!s) return '';
  return casefold(normalizarRaw(s.normalize('NFKD').replace(/\p{Mn}/gu, '')));
}

// ---------- Context keywords (verbatim from detector.py, including the ones that can never match) ----------

const PALAVRAS_CHAVE_RISCO = [
  'cpf', 'cnpj', 'rg', 'identidade', 'pis', 'pasep', 'nis', 'nit', 'cns', 'sus', 'cnh',
  'passaporte', 'titulo de eleitor', 'título de eleitor', 'ctps', 'oab',
  'telefone', 'celular', 'contato', 'whatsapp', 'wpp', 'zap', 'email', 'e-mail',
  'endereco', 'endereço', 'rua', 'avenida', 'av', 'travessa', 'bairro', 'cep', 'logradouro',
  'numero', 'número', 'complemento', 'quadra', 'lote', 'setor',
  'nascimento', 'data de nascimento', 'nasc', 'dn', 'filiação', 'filiacao', 'mae', 'mãe', 'pai',
  'processo', 'sei', 'cnj', 'protocolo', 'autos', 'matricula', 'matrícula', 'siape',
  'inscricao', 'inscrição', 'inscricao imobiliaria', 'inscrição imobiliária',
  'inscricao municipal', 'inscrição municipal', 'inscricao estadual', 'inscrição estadual',
  'numero interno', 'número interno', 'autuacao', 'autuação', 'auto de infracao', 'auto de infração',
  'nota fiscal', 'nf', 'empenho', 'cda', 'nire', 'registro', 'ri', 'registro de imoveis', 'registro de imóveis',
  'paciente', 'aluno', 'servidor',
  'ppg',
];

const PALAVRAS_NEGATIVAS_TELEFONE = [
  'nire', 'protocolo', 'processo', 'sei', 'cnj', 'matricula', 'matrícula',
  'cda', 'empenho', 'nota fiscal', 'nf', 'id', 'inscricao', 'inscrição',
];

const PALAVRAS_ENDERECO = [
  'endereco', 'endereço', 'rua', 'avenida', 'av', 'travessa',
  'bairro', 'cep', 'logradouro', 'quadra', 'lote', 'setor', 'residencia', 'residência',
];

const GATILHOS_NOME = [
  'nome:', 'nome do requerente:', 'requerente:', 'interessado:', 'interessada:',
  'servidor:', 'servidora:', 'paciente:', 'aluno:', 'aluna:', 'responsavel:', 'responsável:',
  'representante:', 'advogado:', 'advogada:',
];

const KW_ORGAO_ENTIDADE = [
  'secretaria', 'ministerio', 'ministério', 'governo', 'prefeitura', 'camara', 'câmara',
  'tribunal', 'universidade', 'instituto', 'fundacao', 'fundação', 'departamento',
  'coordenacao', 'coordenação', 'diretoria', 'superintendencia', 'superintendência',
];

const STOP_PHRASES_NOME = [
  'parte representada', 'parte requerente', 'parte interessada', 'nome do requerente', 'nome da parte',
  'nome do interessado', 'nome do servidor', 'dados do requerente', 'dados do interessado',
];

const KW_MATRICULA = ['matricula', 'matrícula', 'registro', 'ri', 'registro de imoveis', 'registro de imóveis', 'inscricao imobiliaria', 'inscrição imobiliária'];
const KW_INSCRICAO = ['inscricao', 'inscrição', 'inscricao municipal', 'inscrição municipal', 'inscricao estadual', 'inscrição estadual', 'ppg'];
const KW_SIAPE = ['siape', 'servidor', 'matricula siape', 'matrícula siape'];
const KW_NIS_PIS = ['nis', 'pis', 'pasep', 'nit'];
const KW_CNH = ['cnh', 'carteira nacional de habilitacao', 'carteira nacional de habilitação'];
const KW_TITULO = ['titulo de eleitor', 'título de eleitor'];

/** Search text as code points: Python slices by code point. */
type Cp = string[];

const fragmento = (t: Cp, start: number, end: number, window = 80) =>
  t.slice(Math.max(0, start - window), Math.min(t.length, end + window)).join('');

const temKw = (t: Cp, start: number, end: number, kws: string[], window = 80) => {
  const frag = fragmento(t, start, end, window);
  return kws.some((kw) => frag.includes(kw));
};

const temGatilhoNome = (t: Cp, start: number, window = 120) => {
  const frag = t.slice(Math.max(0, start - window), start).join('');
  return GATILHOS_NOME.some((g) => frag.includes(g));
};

const temStopphraseNome = (t: Cp, start: number, end: number, window = 80) =>
  temKw(t, start, end, STOP_PHRASES_NOME, window);

// ---------- models/validators.py ----------

export const apenasDigitos = (s: string) => (s || '').replace(/\D+/g, '');

export function validarCpf(cpf: string): boolean {
  cpf = apenasDigitos(cpf);
  if (cpf.length !== 11 || cpf === cpf[0].repeat(11)) return false;
  const dv = (nums: string) => {
    let soma = 0;
    let peso = nums.length + 1;
    for (const ch of nums) soma += Number(ch) * peso--;
    const resto = soma % 11;
    return resto < 2 ? '0' : String(11 - resto);
  };
  const d1 = dv(cpf.slice(0, 9));
  const d2 = dv(cpf.slice(0, 9) + d1);
  return cpf.slice(-2) === d1 + d2;
}

export function validarCnpj(cnpj: string): boolean {
  cnpj = apenasDigitos(cnpj);
  if (cnpj.length !== 14 || cnpj === cnpj[0].repeat(14)) return false;
  const dv = (nums: string, pesos: number[]) => {
    const resto = [...nums].reduce((s, n, i) => s + Number(n) * pesos[i], 0) % 11;
    return resto < 2 ? '0' : String(11 - resto);
  };
  const d1 = dv(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(cnpj.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.slice(-2) === d1 + d2;
}

const SEQUENCIAS_PROIBIDAS = new Set(['0000000000', '1111111111', '1234567890', '0123456789']);

export function validarTelefoneBr(matchStr: string): [boolean, string, string] {
  const digits = apenasDigitos(matchStr);
  if (!digits) return [false, '', 'telefone_sem_digitos'];
  if (![10, 11, 12, 13].includes(digits.length)) return [false, digits, 'telefone_tamanho_invalido'];
  let d = digits;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return [false, digits, 'telefone_sem_ddd'];
  const ddd = Number(d.slice(0, 2));
  const num = d.slice(2);
  if (ddd < 11 || ddd > 99) return [false, digits, 'telefone_ddd_invalido'];
  if (SEQUENCIAS_PROIBIDAS.has(digits)) return [false, digits, 'telefone_sequencia_obvia'];
  if (num.length === 9 && !num.startsWith('9')) return [false, digits, 'telefone_celular_sem_9'];
  if (num.length !== 8 && num.length !== 9) return [false, digits, 'telefone_numero_invalido'];
  return [true, digits, 'ok'];
}

// ---------- Rule validators (detector.py) ----------

interface M {
  raw: string;
  start: number;
  end: number;
}
type Resultado = [ok: boolean, norm: string | null, motivo: string | null];
type Validator = (m: M, t: Cp) => Resultado;

const validatorCpf: Validator = (m) => {
  const dig = apenasDigitos(m.raw);
  if (dig.length !== 11) return [false, null, 'cpf_tamanho_invalido'];
  if (validarCpf(m.raw)) return [true, dig, null];
  // The API accepts any 11-digit CPF and flags a bad check digit (recall over precision on noisy real data).
  return [true, dig, 'cpf_suspeito_dv'];
};

const validatorCnpj: Validator = (m, t) => {
  const dig = apenasDigitos(m.raw);
  if (dig.length !== 14) return [false, null, 'cnpj_tamanho_invalido'];
  if (validarCnpj(m.raw)) return [true, dig, null];
  if (temKw(t, m.start, m.end, ['cnpj'], 80)) return [true, dig, 'cnpj_suspeito_dv'];
  return [false, null, 'cnpj_invalido'];
};

const validatorTelefone: Validator = (m, t) => {
  let dig = apenasDigitos(m.raw);
  if (temKw(t, m.start, m.end, PALAVRAS_NEGATIVAS_TELEFONE, 60)) return [false, null, 'telefone_contexto_negativo'];
  if (dig.startsWith('55') && (dig.length === 12 || dig.length === 13)) dig = dig.slice(2);
  if (dig.length !== 10 && dig.length !== 11) return [false, null, 'telefone_tamanho_invalido'];
  const ddd = Number(dig.slice(0, 2));
  if (!(ddd >= 11 && ddd <= 99)) return [false, null, 'telefone_ddd_invalido'];
  if (dig.length === 11 && dig[2] !== '9') return [false, null, 'telefone_celular_sem_9'];
  const [ok, norm, motivo] = validarTelefoneBr(m.raw);
  return [ok, ok ? norm : null, motivo];
};

const validatorCep: Validator = (m, t) => {
  const dig = apenasDigitos(m.raw);
  if (dig.length !== 8) return [false, null, 'cep_tamanho_invalido'];
  if (!temKw(t, m.start, m.end, PALAVRAS_ENDERECO, 90)) return [false, null, 'cep_sem_contexto_endereco'];
  return [true, dig, null];
};

const validatorEmail: Validator = (m) => {
  const lower = casefold(m.raw);
  const dot = lower.lastIndexOf('.');
  if (dot >= 0) {
    const tld = lower.slice(dot + 1);
    if (!/^[a-z]{2,24}$/.test(tld)) return [true, lower, 'email_tld_suspeito'];
    if (['.com.br', '.gov.br', '.org.br', '.net.br', '.edu.br'].some((s) => lower.endsWith(s))) return [true, lower, null];
    if (!['com', 'org', 'net', 'edu', 'gov', 'br'].includes(tld)) return [true, lower, 'email_tld_incomum'];
  }
  return [true, lower, null];
};

const validatorData: Validator = (m) => [true, m.raw, null];

/** IDs accepted only with keywords of their own type nearby (avoids a CPF turning into a matrícula). */
const validatorIdContextual = (kws: string[], motivoSemCtx: string): Validator => (m, t) => {
  const norm = m.raw.trim().replace(/[^\p{L}\p{N}_]+/gu, '').replaceAll('_', '');
  if (Array.from(norm).length < 4) return [false, null, 'id_curto'];
  if (/^(19|20)\d{2}$/.test(norm)) return [false, null, 'ano_isolado'];
  if (!temKw(t, m.start, m.end, kws, 140)) return [false, null, motivoSemCtx];
  return [true, norm, null];
};

const validatorNome: Validator = (m, t) => {
  const raw = m.raw.trim();
  if (!temGatilhoNome(t, m.start, 140)) return [false, null, 'nome_sem_gatilho'];
  if (temStopphraseNome(t, m.start, m.end, 90)) return [false, null, 'nome_stopphrase'];
  if (temKw(t, m.start, m.end, KW_ORGAO_ENTIDADE, 90)) return [false, null, 'nome_contexto_orgao'];
  if (raw.split(new RegExp(`${PY_S}+`, 'u')).filter(Boolean).length < 2) return [false, null, 'nome_curto'];
  return [true, raw, null];
};

// ---------- Rules ----------

export interface Regra {
  nome: string;
  padrao: RegExp;
  tipo: 'hard' | 'soft';
  peso: number;
  /** Lower wins on overlap. */
  prioridade: number;
  validator?: Validator;
  peso_min_sem_contexto: number;
  boost_contexto: number;
  min_len: number;
  exige_contexto: boolean;
}

const regra = (r: Omit<Regra, 'peso_min_sem_contexto' | 'boost_contexto' | 'min_len' | 'exige_contexto'> & Partial<Regra>): Regra => ({
  peso_min_sem_contexto: 1,
  boost_contexto: 2,
  min_len: 0,
  exige_contexto: false,
  ...r,
});

const ctx = { exige_contexto: true, peso_min_sem_contexto: 0, boost_contexto: 0 };
const L = 'A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ';
const l = 'a-záàâãéèêíìîóòôõúùûç';

export const REGRAS: Regra[] = [
  // --- HARD ---
  regra({ nome: 'cpf', padrao: comp(String.raw`\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})\b`), tipo: 'hard', peso: POLITICA.score_sensivel_estrito, prioridade: 1, validator: validatorCpf, min_len: 11 }),
  regra({ nome: 'cnpj', padrao: comp(String.raw`\b(?:\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}|\d{14})\b`), tipo: 'hard', peso: POLITICA.score_sensivel_estrito, prioridade: 1, validator: validatorCnpj, min_len: 14 }),
  regra({ nome: 'email', padrao: comp(String.raw`\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\b`), tipo: 'hard', peso: 5, prioridade: 1, validator: validatorEmail, min_len: 6 }),
  // --- PROCESSOS ---
  regra({ nome: 'processo_cnj', padrao: comp(String.raw`\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b`), tipo: 'hard', peso: 5, prioridade: 3 }),
  regra({ nome: 'processo_sei', padrao: comp(String.raw`\b\d{5}\.\d{6}/\d{4}-\d{2}\b`), tipo: 'hard', peso: 4, prioridade: 3 }),
  regra({ nome: 'processo_sei_generico', padrao: comp(String.raw`\b\d{4,6}-\d{6,8}/\d{4}-\d{2}\b`), tipo: 'hard', peso: 4, prioridade: 3 }),
  // --- TELEFONE ---
  regra({ nome: 'telefone', padrao: comp(String.raw`\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[\s-]?\d{4}\b`), tipo: 'hard', peso: 4, prioridade: 2, validator: validatorTelefone, min_len: 8 }),
  // --- ENDEREÇO / SOFT ---
  regra({ nome: 'cep', padrao: comp(String.raw`\b\d{5}-?\d{3}\b(?!/\d{4}-\d{2})`), tipo: 'soft', peso: 3, prioridade: 4, validator: validatorCep, min_len: 8, ...ctx }),
  regra({ nome: 'placa_veiculo', padrao: comp(String.raw`\b[A-Z]{3}\d[A-Z0-9]\d{2}\b`), tipo: 'soft', peso: 2, prioridade: 4, min_len: 7, peso_min_sem_contexto: 1, boost_contexto: 1 }),
  regra({ nome: 'data', padrao: comp(String.raw`\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](19|20)\d{2}\b`), tipo: 'soft', peso: 1, prioridade: 4, validator: validatorData, min_len: 8, peso_min_sem_contexto: 1, boost_contexto: 2 }),
  regra({ nome: 'rg', padrao: comp(String.raw`\b(?:\d{1,2}\.?\d{3}\.?\d{3}-?\d|[1-9]\d{6,8}-?\d)\b`), tipo: 'soft', peso: 2, prioridade: 4, validator: validatorIdContextual(['rg', 'identidade', 'ssP', 'orgao expedidor', 'órgão expedidor'], 'rg_sem_contexto'), min_len: 7, ...ctx }),
  // --- Matrículas / inscrições / IDs (keywords of their own type) ---
  regra({ nome: 'matricula', padrao: comp(String.raw`\b\d{1,3}(?:\.\d{3}){1,3}-?\d{1,2}[A-Z]?\b|\b\d{6,10}[A-Z]?\b`), tipo: 'soft', peso: 3, prioridade: 4, validator: validatorIdContextual(KW_MATRICULA, 'matricula_sem_contexto'), min_len: 6, ...ctx }),
  regra({ nome: 'inscricao', padrao: comp(String.raw`\b\d{4,10}-\d\b|\b\d{6,12}\b`), tipo: 'soft', peso: 3, prioridade: 4, validator: validatorIdContextual(KW_INSCRICAO, 'inscricao_sem_contexto'), min_len: 6, ...ctx }),
  regra({ nome: 'siape', padrao: comp(String.raw`\b\d{7,8}\b`), tipo: 'soft', peso: 3, prioridade: 4, validator: validatorIdContextual(KW_SIAPE, 'siape_sem_contexto'), min_len: 7, ...ctx }),
  regra({ nome: 'nis_pis_pasep', padrao: comp(String.raw`\b\d{11}\b`), tipo: 'soft', peso: 3, prioridade: 4, validator: validatorIdContextual(KW_NIS_PIS, 'nis_pis_sem_contexto'), min_len: 11, ...ctx }),
  regra({ nome: 'cnh_numero', padrao: comp(String.raw`\b\d{9,11}\b`), tipo: 'soft', peso: 2, prioridade: 4, validator: validatorIdContextual(KW_CNH, 'cnh_sem_contexto'), min_len: 9, ...ctx }),
  regra({ nome: 'titulo_eleitor_numero', padrao: comp(String.raw`\b\d{12}\b`), tipo: 'soft', peso: 2, prioridade: 4, validator: validatorIdContextual(KW_TITULO, 'titulo_sem_contexto'), min_len: 12, ...ctx }),
  regra({ nome: 'nire', padrao: comp(String.raw`\bNIRE\s*[:\-]?\s*\d{8,12}(?:-\d)?\b`), tipo: 'soft', peso: 2, prioridade: 4, validator: validatorIdContextual(['nire'], 'nire_sem_contexto'), min_len: 8, ...ctx }),
  regra({
    nome: 'id_documental_rotulado',
    padrao: comp(String.raw`\b(?:CDA|PROTOCOLO|N[ÚU]MERO\s+INTERNO|AUTUA[ÇC][AÃ]O|NOTA\s+FISCAL|EMPENHO|DOCUMENTO/EMPENHO)\s*[:#º°\-]?\s*[A-Z]?\d{3,20}\b`),
    tipo: 'soft', peso: 2, prioridade: 4,
    validator: validatorIdContextual(['cda', 'protocolo', 'número interno', 'numero interno', 'autuacao', 'autuação', 'nota fiscal', 'empenho', 'documento/empenho'], 'id_doc_sem_contexto'),
    min_len: 6, ...ctx,
  }),
  // --- Nome completo (only after an explicit trigger such as "nome:" or "requerente:") ---
  // Python: \b(?:WORD(?:\s+(?:de|da|do|dos|das|e))?){1,}\s+WORD(?:\s+WORD){0,3}\b with WORD = [L][l]{2,}.
  // Under IGNORECASE [L] and [l] are the same letter set, so `(?:WORD)+` can split one long word in exponentially
  // many ways before failing (Python too: ~50 ms at 44 letters, seconds past 50). Here WORD ends with (?![l]):
  // a split that stops mid-word can only fail or reach a state the greedy path already tried, so the first match
  // found is the same (parity cases cover it) and the cost is linear.
  regra({
    nome: 'nome_completo',
    padrao: comp(String.raw`\b(?:[${L}][${l}]{2,}(?![${l}])(?:\s+(?:de|da|do|dos|das|e))?){1,}\s+[${L}][${l}]{2,}(?![${l}])(?:\s+[${L}][${l}]{2,}(?![${l}])){0,3}\b`),
    tipo: 'soft', peso: 3, prioridade: 4, validator: validatorNome, min_len: 8, ...ctx,
  }),
];

// ---------- Overlap resolution ----------

interface MatchInfo extends M {
  regra: string;
  prioridade: number;
  norm: string | null;
  motivo: string | null;
  peso: number;
}

/** Python tuple comparison for (prioridade, -peso, -len). */
const chave = (x: MatchInfo) => [x.prioridade, -x.peso, -(x.end - x.start)];
const cmp = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

function resolverOverlaps(matches: MatchInfo[]): MatchInfo[] {
  if (!matches.length) return [];
  // Array.prototype.sort is stable, like Python's sorted().
  const ordenados = [...matches].sort((a, b) => cmp([a.start, ...chave(a)], [b.start, ...chave(b)]));
  const resultado: MatchInfo[] = [];
  let current = ordenados[0];
  for (const nxt of ordenados.slice(1)) {
    if (nxt.start >= current.end) {
      resultado.push(current);
      current = nxt;
      continue;
    }
    if (cmp(chave(nxt), chave(current)) < 0) current = nxt;
  }
  resultado.push(current);
  return resultado;
}

const decidirAcao = (score: number): Status =>
  score >= POLITICA.score_bloquear ? 'BLOQUEAR' : score >= POLITICA.score_revisar ? 'REVISAR' : 'PUBLICAR';

// ---------- Core ----------

export interface Detalhe {
  analise: Analise;
  /** Findings as code-point spans of the normalized text, in order. */
  spans: Span[];
  /** Normalized code point -> code point of the input (see mapear). */
  mapa: number[];
}

/** analisar_texto plus where each finding sits, for highlighting. */
export function analisarDetalhado(texto: unknown): Detalhe {
  const { raw: rawText, mapa } = texto == null ? { raw: '', mapa: [] } : mapear(String(texto));
  const search = Array.from(normalizarBusca(rawText));
  if (!rawText) return { analise: { status: 'PUBLICAR', score: 0, total_matches: 0, matches: [], texto_anonimizado: '' }, spans: [], mapa };

  const cps = Array.from(rawText);
  // UTF-16 index -> code-point index (identity unless the text has astral characters such as emoji).
  let u2c: number[] | null = null;
  if (cps.length !== rawText.length) {
    u2c = [];
    let u = 0;
    cps.forEach((ch, c) => {
      for (let k = 0; k < ch.length; k++) u2c![u + k] = c;
      u += ch.length;
    });
    u2c[u] = cps.length;
  }
  const pos = (i: number) => (u2c ? u2c[i] : i);

  // 1) scan
  const encontrados: MatchInfo[] = [];
  for (const r of REGRAS) {
    for (const found of rawText.matchAll(r.padrao)) {
      const raw = found[0];
      if (r.min_len && Array.from(raw).length < r.min_len) continue;
      const m: M = { raw, start: pos(found.index), end: pos(found.index + raw.length) };

      let ok = true;
      let norm: string | null = raw;
      let motivo: string | null = 'padrao_direto';
      if (r.validator) [ok, norm, motivo] = r.validator(m, search);
      if (!ok) continue;

      let peso = r.peso;
      if (r.tipo === 'soft') {
        const hasCtx = temKw(search, m.start, m.end, PALAVRAS_CHAVE_RISCO, 110);
        if (r.exige_contexto && !hasCtx) continue;
        if (hasCtx) {
          peso = Math.max(peso, r.peso_min_sem_contexto) + r.boost_contexto;
          if (motivo === null || motivo === 'padrao_direto') motivo = 'soft_com_contexto';
        } else {
          if (r.peso_min_sem_contexto <= 0) continue;
          peso = r.peso_min_sem_contexto;
          if (motivo === null || motivo === 'padrao_direto') motivo = 'soft_sem_contexto';
        }
      }
      encontrados.push({ ...m, regra: r.nome, prioridade: r.prioridade, norm, motivo, peso });
    }
  }

  // 2) overlaps
  const limpos = resolverOverlaps(encontrados);

  // 3) score + anonymization
  const score = limpos.reduce((s, x) => s + x.peso, 0);
  const anon = [...cps];
  const matches: Ocorrencia[] = [];
  for (const x of limpos) {
    for (let i = x.start; i < x.end; i++) anon[i] = '*';
    matches.push({
      tipo: x.regra,
      valor_detectado: x.raw,
      valor_normalizado: x.norm,
      motivo: x.motivo,
      contexto: cps.slice(Math.max(0, x.start - 60), Math.min(cps.length, x.end + 60)).join(''),
      score: x.peso,
    });
  }

  return {
    analise: { status: decidirAcao(score), score, total_matches: limpos.length, matches, texto_anonimizado: anon.join('') },
    spans: limpos.map((x) => ({ start: x.start, end: x.end, tipo: x.regra })),
    mapa,
  };
}

/** analisar_texto: the exact payload of POST /validate/text. */
export const analisarTexto = (texto: unknown): Analise => analisarDetalhado(texto).analise;
