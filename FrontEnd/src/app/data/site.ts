// Site constants, labels and demo content. No imports: scripts/seo.ts and scripts/check.ts read this file directly.

export const SITE_URL = 'https://g2martins.github.io/SafeDoc-DF';
export const SITE_NAME = 'SafeDoc-DF';
export const AUTHOR = 'Gustavo Martins Gripaldi';
export const COAUTHOR = 'Mayron Oliveira Malaquias';
export const PORTFOLIO_URL = 'https://g2portfolio.grovicdata.com/';
export const PROJECT_URL = 'https://g2portfolio.grovicdata.com/projetos/safedoc-df/';
export const REPO_URL = 'https://github.com/G2Martins/SafeDoc-DF';
export const OG_IMAGE = '/og/safedoc-df.png';
export const DISCLAIMER = 'Projeto de portfólio de Gustavo Martins Gripaldi. Demo estática: a análise roda no seu navegador e nenhum dado é enviado.';
/** core/config.py MAX_TEXT_LENGTH: also keeps the text box responsive. */
export const MAX_TEXT_LENGTH = 20_000;

/** Prerendered pages, in sitemap order. */
export const PAGES = [
  { path: '/', priority: '1.0' },
  { path: '/lote/', priority: '0.8' },
  { path: '/como-funciona/', priority: '0.7' },
];

/** Label and plain-language rule for each detector rule (keys = REGRAS[].nome). */
export const TIPOS: Record<string, { label: string; regra: string }> = {
  cpf: { label: 'CPF', regra: '11 dígitos, com ou sem pontuação. Confere o dígito verificador; se ele falhar, marca mesmo assim como "cpf_suspeito_dv".' },
  cnpj: { label: 'CNPJ', regra: '14 dígitos. Confere o dígito verificador; inválido só conta com a palavra "cnpj" por perto.' },
  email: { label: 'E-mail', regra: 'Endereço de e-mail. Domínio incomum fica marcado como suspeito, mas conta.' },
  processo_cnj: { label: 'Processo CNJ', regra: 'Numeração única do CNJ (0000000-00.0000.0.00.0000).' },
  processo_sei: { label: 'Processo SEI', regra: 'Processo SEI no formato 00000.000000/0000-00.' },
  processo_sei_generico: { label: 'Processo', regra: 'Variações de numeração de processo usadas por órgãos (0000-000000/0000-00).' },
  telefone: { label: 'Telefone', regra: 'Fixo ou celular com DDD (+55 opcional); celular precisa do 9. Descartado se houver protocolo, processo, matrícula ou "id" a até 60 caracteres.' },
  cep: { label: 'CEP', regra: '8 dígitos, só com contexto de endereço (rua, quadra, lote, setor, bairro...).' },
  placa_veiculo: { label: 'Placa', regra: 'Placa antiga ou Mercosul. Peso 1 sem contexto, 3 com contexto.' },
  data: { label: 'Data', regra: 'Data dd/mm/aaaa. Peso 1 sem contexto, 3 com contexto (nascimento, por exemplo).' },
  rg: { label: 'RG', regra: 'Número no formato de RG, só com "rg" ou "identidade" a até 140 caracteres.' },
  matricula: { label: 'Matrícula', regra: 'Número só com "matrícula" ou "registro" a até 140 caracteres.' },
  inscricao: { label: 'Inscrição', regra: 'Número só com "inscrição" a até 140 caracteres.' },
  siape: { label: 'SIAPE', regra: '7 ou 8 dígitos com "siape" ou "servidor" por perto.' },
  nis_pis_pasep: { label: 'NIS/PIS', regra: '11 dígitos com NIS, PIS, PASEP ou NIT por perto.' },
  cnh_numero: { label: 'CNH', regra: '9 a 11 dígitos com "CNH" por perto.' },
  titulo_eleitor_numero: { label: 'Título de eleitor', regra: '12 dígitos com "título de eleitor" por perto.' },
  nire: { label: 'NIRE', regra: '"NIRE" seguido de 8 a 12 dígitos.' },
  id_documental_rotulado: { label: 'ID documental', regra: 'Número rotulado como protocolo, CDA, nota fiscal, empenho ou número interno.' },
  nome_completo: { label: 'Nome', regra: 'Duas ou mais palavras logo após um gatilho como "Nome:", "Requerente:" ou "Servidor:". Ignora órgãos e expressões como "parte representada".' },
};

export const tipoLabel = (tipo: string) => TIPOS[tipo]?.label ?? tipo;

/** Synthetic requests (fictitious people and numbers) for the text analyzer. */
export const EXEMPLOS = [
  {
    label: 'Pedido completo',
    texto: `Prezados, solicito cópia integral do processo SEI 00015-01234567/2023-11 sobre a obra na minha quadra.
Requerente: Juliana Costa Albuquerque, CPF 529.982.247-25, RG 2.345.678-9 SSP/DF, nascida em 14/03/1988.
Contato: juliana.albuquerque@email.com ou (61) 99876-5432.
Endereço: Quadra 205, Lote 12, CEP 70040-010, Asa Sul.
Agradeço a atenção.`,
  },
  { label: 'Servidor', texto: 'Solicito a ficha funcional do servidor: Carlos Eduardo Nogueira, matrícula 1.234.567-8.' },
  { label: 'Empresa e processo', texto: 'Peço informações sobre o contrato com a empresa de CNPJ 11.222.333/0001-81, a nota fiscal 456789 e o processo 0701234-56.2023.8.07.0001.' },
  { label: 'Veículo e endereço', texto: 'Denuncio o veículo de placa JKL1A23 estacionado na Rua das Flores, 123, CEP 72000-000, Taguatinga, desde 02/09/2024.' },
  { label: 'Pedido sem dados', texto: 'Solicito o número de vagas ofertadas nas creches públicas do Distrito Federal em 2024, por região administrativa.' },
  {
    label: 'Limites da regra',
    texto: 'Servidor: Paulo Henrique Duarte, telefone funcional (61) 3344-5566, matrícula 1.234.567-8. Moro na cidade de Ceilândia, celular (61) 99876-5432.',
  },
];

/** Sample CSVs bundled with the site (copied from BackEnd/data/input by scripts/seo.ts). */
export const AMOSTRAS = [
  { arquivo: 'amostras/amostra-e-sic.csv', origem: 'AMOSTRA_e-SIC - Amostra - SIC.csv', label: 'Amostra e-SIC', descricao: '99 pedidos de acesso à informação da amostra do desafio (dados sintéticos).' },
  { arquivo: 'amostras/analise-hackathon.csv', origem: 'analise_hackathon.csv', label: 'Amostra rotulada', descricao: 'Os mesmos 99 pedidos com a coluna y_true (rótulo de referência): mostra precisão e recall.' },
];
