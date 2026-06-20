export const NOVO_PLUS_VALUE = '__NOVO_PLUS__';
export const MAX_CUSTOM_ITEM_LENGTH = 32;

export const STORAGE_KEYS = {
  logo: 'rj-notas-logo',
  invoices: 'rj-notas-invoices',
  companyName: 'rj-notas-company-name',
  empresaList: 'rj-notas-empresa-list',
  tipoList: 'rj-notas-tipo-list',
  descricaoList: 'rj-notas-descricao-list',
  saveFormat: 'rj-notas-save-format',
  savedExports: 'rj-notas-saved-exports',
} as const;

/** Valores antigos que não devem permanecer como texto preenchido */
export const LEGACY_PLACEHOLDER_VALUES = [
  'Sua Empresa',
  'Sua Empresa Inc.',
  'Serviço Prestado',
] as const;

import type { SaveFormat } from '@/lib/types';

export const DEFAULT_SAVE_FORMAT: SaveFormat = 'jpeg';

export const DEFAULT_TIPO_ITEMS = [
  'Modelagem',
  'Ajuste',
  'Costura',
  'Acabamento',
];

export const DEFAULT_DESCRICAO_ITEMS = [
  'Vestido',
  'Blusa',
  'Calça',
  'Saia',
];

export const DEFAULT_EMPRESA_ITEMS: string[] = [];

export const EMITTER_DATA = {
  cpf: {
    name: 'Rosania Moreira Aragao',
    document: '857.154.093-49',
    label: 'CPF',
  },
  cnpj: {
    name: 'Rosania Modelista',
    document: '64.539.517/0001-36',
    label: 'CNPJ',
  },
} as const;

export type EmitterDocumentType = keyof typeof EMITTER_DATA;

export const INVOICE_PREVIEW_WIDTH = 600;