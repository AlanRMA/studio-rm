import {
  DEFAULT_DESCRICAO_ITEMS,
  DEFAULT_EMPRESA_ITEMS,
  DEFAULT_SAVE_FORMAT,
  DEFAULT_TIPO_ITEMS,
  NOVO_PLUS_VALUE,
  STORAGE_KEYS,
} from '@/lib/constants';
import type { SaveFormat } from '@/lib/types';

export interface SettingsSnapshot {
  logo: string | null;
  saveFormat: SaveFormat;
  tipoItems: string[];
  descricaoItems: string[];
  empresaItems: string[];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function ensureNovoPlusLast(items: string[]): string[] {
  const filtered = items.filter((item) => item !== NOVO_PLUS_VALUE);
  return [...filtered, NOVO_PLUS_VALUE];
}

export function loadSettingsSnapshot(): SettingsSnapshot {
  return {
    logo: readJson<string | null>(STORAGE_KEYS.logo, null),
    saveFormat: readJson<SaveFormat>(STORAGE_KEYS.saveFormat, DEFAULT_SAVE_FORMAT),
    tipoItems: readJson(STORAGE_KEYS.tipoList, ensureNovoPlusLast(DEFAULT_TIPO_ITEMS)),
    descricaoItems: readJson(
      STORAGE_KEYS.descricaoList,
      ensureNovoPlusLast(DEFAULT_DESCRICAO_ITEMS)
    ),
    empresaItems: readJson(STORAGE_KEYS.empresaList, ensureNovoPlusLast(DEFAULT_EMPRESA_ITEMS)),
  };
}

export function saveSettingsSnapshot(snapshot: SettingsSnapshot): void {
  writeJson(STORAGE_KEYS.logo, snapshot.logo);
  writeJson(STORAGE_KEYS.saveFormat, snapshot.saveFormat);
  writeJson(STORAGE_KEYS.tipoList, ensureNovoPlusLast(snapshot.tipoItems));
  writeJson(STORAGE_KEYS.descricaoList, ensureNovoPlusLast(snapshot.descricaoItems));
  writeJson(STORAGE_KEYS.empresaList, ensureNovoPlusLast(snapshot.empresaItems));
}