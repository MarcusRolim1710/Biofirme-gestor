'use strict';

const { HttpError } = require('./http');

const EMPLOYEE_STATUS = [
  'Sem dados',
  'Pendente de Documentos',
  'Aprovado pelo RH',
  'Enviado para Contabilidade',
  'Ativo',
  'Inativo',
  'Afastado',
  'Férias',
];

const EMPLOYEE_VINCULO = ['Ativo', 'Inativo', 'Demitido', 'Afastado', 'Férias'];
const DOCUMENT_TYPES = ['certificado', 'doc_filho', 'outro'];

const EMPLOYEE_TEXT_FIELDS = {
  name: 200,
  cpf: 20,
  rg: 30,
  ctps_numero: 30,
  pis_pasep: 30,
  foto_url: 600,
  rg_frente_url: 600,
  rg_verso_url: 600,
  cpf_doc_url: 600,
  comprovante_endereco_url: 600,
  ctps_doc_url: 600,
  telefone: 40,
  email: 200,
  cargo: 200,
  salario_moeda: 10,
  setor: 120,
  cep: 20,
  logradouro: 200,
  numero: 30,
  complemento: 120,
  bairro: 120,
  cidade: 120,
  uf: 2,
};

function cleanText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw new HttpError(400, `Campo excede o limite de ${maxLength} caracteres.`);
  }
  return text;
}

function cleanInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new HttpError(400, 'Valor inteiro invalido.');
  }
  return number;
}

function cleanMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new HttpError(400, 'Valor monetario invalido.');
  }
  return Math.round(number * 100) / 100;
}

function cleanDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new HttpError(400, 'Data invalida (use AAAA-MM-DD).');
  }
  return text;
}

function pickEmployeeFields(body, { partial }) {
  const payload = {};

  for (const [field, maxLength] of Object.entries(EMPLOYEE_TEXT_FIELDS)) {
    if (body[field] === undefined) continue;
    let value = cleanText(body[field], maxLength);
    if (field === 'uf' && value) value = value.toUpperCase();
    payload[field] = value;
  }

  if (body.data_nascimento !== undefined) {
    payload.data_nascimento = cleanDate(body.data_nascimento);
  }

  if (body.cargo_id !== undefined) {
    payload.cargo_id = cleanInt(body.cargo_id);
  }

  if (body.status !== undefined) {
    const status = cleanText(body.status, 60);
    if (status && !EMPLOYEE_STATUS.includes(status)) {
      throw new HttpError(400, 'Status invalido.');
    }
    payload.status = status || 'Sem dados';
  }

  if (body.vinculo !== undefined) {
    const vinculo = cleanText(body.vinculo, 30);
    if (vinculo && !EMPLOYEE_VINCULO.includes(vinculo)) {
      throw new HttpError(400, 'Vinculo invalido.');
    }
    payload.vinculo = vinculo || 'Ativo';
  }

  if (!partial) {
    if (!payload.name) throw new HttpError(400, 'Nome e obrigatorio.');
    if (!payload.cpf) throw new HttpError(400, 'CPF e obrigatorio.');
  } else {
    if (payload.name === null) throw new HttpError(400, 'Nome nao pode ficar vazio.');
    if (payload.cpf === null) throw new HttpError(400, 'CPF nao pode ficar vazio.');
  }

  return payload;
}

function pickPositionFields(body, { partial }) {
  const payload = {};

  if (body.nome !== undefined) payload.nome = cleanText(body.nome, 200);
  if (body.setor !== undefined) payload.setor = cleanText(body.setor, 120);
  if (body.descricao !== undefined) payload.descricao = cleanText(body.descricao, 1000);
  if (body.salario_base !== undefined) payload.salario_base = cleanMoney(body.salario_base);

  if (!partial) {
    if (!payload.nome) throw new HttpError(400, 'Nome do cargo e obrigatorio.');
    if (payload.salario_base === undefined || payload.salario_base === null) {
      throw new HttpError(400, 'Salario base e obrigatorio.');
    }
  } else {
    if (payload.nome === null) throw new HttpError(400, 'Nome do cargo nao pode ficar vazio.');
    if (payload.salario_base === null) throw new HttpError(400, 'Salario base nao pode ficar vazio.');
  }

  return payload;
}

function pickDocumentFields(body, { partial }) {
  const payload = {};

  if (body.employee_id !== undefined) payload.employee_id = cleanInt(body.employee_id);
  if (body.titulo !== undefined) payload.titulo = cleanText(body.titulo, 200);
  if (body.url !== undefined) payload.url = cleanText(body.url, 600);
  if (body.mime !== undefined) payload.mime = cleanText(body.mime, 100);
  if (body.tamanho_bytes !== undefined) payload.tamanho_bytes = cleanInt(body.tamanho_bytes);

  if (body.tipo !== undefined) {
    const tipo = cleanText(body.tipo, 30);
    if (tipo && !DOCUMENT_TYPES.includes(tipo)) {
      throw new HttpError(400, 'Tipo de documento invalido.');
    }
    payload.tipo = tipo;
  }

  if (!partial) {
    if (!payload.employee_id) throw new HttpError(400, 'Funcionario e obrigatorio.');
    if (!payload.tipo) throw new HttpError(400, 'Tipo e obrigatorio.');
    if (!payload.titulo) throw new HttpError(400, 'Titulo e obrigatorio.');
    if (!payload.url) throw new HttpError(400, 'Arquivo e obrigatorio.');
  }

  if (payload.url && !/^(\/api\/files\?key=|https:\/\/)/.test(payload.url)) {
    throw new HttpError(400, 'URL de arquivo invalida.');
  }

  return payload;
}

module.exports = {
  EMPLOYEE_STATUS,
  EMPLOYEE_VINCULO,
  DOCUMENT_TYPES,
  pickEmployeeFields,
  pickPositionFields,
  pickDocumentFields,
};
