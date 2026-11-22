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
const EMPLOYEE_SEXO = ['Feminino', 'Masculino', 'Outro'];
const EMPLOYEE_ESTADO_CIVIL = [
  'Solteiro(a)',
  'Casado(a)',
  'União estável',
  'Divorciado(a)',
  'Separado(a)',
  'Viúvo(a)',
];
const ESTADOS_CIVIS_COM_CONJUGE = ['Casado(a)', 'União estável'];
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
  sexo: 20,
  estado_civil: 30,
  nome_conjuge: 200,
  telefone_conjuge: 40,
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
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
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

  if (body.data_admissao !== undefined) {
    payload.data_admissao = cleanDate(body.data_admissao);
  }

  if (body.cargo_id !== undefined) {
    payload.cargo_id = cleanInt(body.cargo_id);
  }

  if (body.salario !== undefined) {
    payload.salario = cleanMoney(body.salario);
    payload.salario_personalizado = payload.salario !== null;
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

  if (body.sexo !== undefined) {
    const sexo = cleanText(body.sexo, 20);
    if (sexo && !EMPLOYEE_SEXO.includes(sexo)) {
      throw new HttpError(400, 'Sexo invalido.');
    }
    payload.sexo = sexo;
  }

  if (body.estado_civil !== undefined) {
    const estadoCivil = cleanText(body.estado_civil, 30);
    if (estadoCivil && !EMPLOYEE_ESTADO_CIVIL.includes(estadoCivil)) {
      throw new HttpError(400, 'Estado civil invalido.');
    }
    payload.estado_civil = estadoCivil;
    if (!ESTADOS_CIVIS_COM_CONJUGE.includes(estadoCivil)) {
      payload.nome_conjuge = null;
      payload.telefone_conjuge = null;
    }
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

function pickDependentFields(body) {
  const payload = {};
  if (body.id !== undefined) payload.id = cleanInt(body.id);
  if (body.nome !== undefined) payload.nome = cleanText(body.nome, 200);
  if (body.data_nascimento !== undefined) payload.data_nascimento = cleanDate(body.data_nascimento);
  if (body.rg !== undefined) payload.rg = cleanText(body.rg, 30);
  if (body.cpf !== undefined) payload.cpf = cleanText(body.cpf, 20);
  if (!payload.nome) throw new HttpError(400, 'Nome do filho e obrigatorio.');
  return payload;
}

function pickDependents(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new HttpError(400, 'Lista de filhos invalida.');
  const seenIds = new Set();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'Filho invalido.');
    }
    const dep = pickDependentFields(item);
    if (dep.id !== undefined && dep.id !== null) {
      if (seenIds.has(dep.id)) throw new HttpError(400, 'Filho duplicado na lista.');
      seenIds.add(dep.id);
    }
    return dep;
  });
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
  EMPLOYEE_SEXO,
  EMPLOYEE_ESTADO_CIVIL,
  ESTADOS_CIVIS_COM_CONJUGE,
  DOCUMENT_TYPES,
  pickEmployeeFields,
  pickPositionFields,
  pickDependents,
  pickDocumentFields,
};
