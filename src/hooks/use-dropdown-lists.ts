'use client';

import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  DEFAULT_DESCRICAO_ITEMS,
  DEFAULT_EMPRESA_ITEMS,
  DEFAULT_TIPO_ITEMS,
  LEGACY_PLACEHOLDER_VALUES,
  MAX_CUSTOM_ITEM_LENGTH,
  NOVO_PLUS_VALUE,
  STORAGE_KEYS,
} from '@/lib/constants';

export type DropdownListType = 'tipo' | 'descricao' | 'empresa';

function ensureNovoPlusLast(items: string[]): string[] {
  const filtered = items.filter((item) => item !== NOVO_PLUS_VALUE);
  return [...filtered, NOVO_PLUS_VALUE];
}

function normalizeItems(items: string[], defaults: string[]): string[] {
  const unique = [...new Set(items.filter((item) => item && item !== NOVO_PLUS_VALUE))];
  if (unique.length === 0) {
    return defaults.length > 0 ? ensureNovoPlusLast(defaults) : ensureNovoPlusLast([]);
  }
  return ensureNovoPlusLast(unique);
}

function readLegacyCompanyNames(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const legacy = window.localStorage.getItem(STORAGE_KEYS.companyName);
    if (!legacy) return [];

    const parsed = JSON.parse(legacy) as string;
    if (!parsed || LEGACY_PLACEHOLDER_VALUES.includes(parsed as (typeof LEGACY_PLACEHOLDER_VALUES)[number])) {
      return [];
    }

    return [parsed];
  } catch {
    return [];
  }
}

function getInitialEmpresaItems(): string[] {
  if (typeof window === 'undefined') {
    return ensureNovoPlusLast(DEFAULT_EMPRESA_ITEMS);
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.empresaList);
    if (stored) {
      return normalizeItems(JSON.parse(stored) as string[], DEFAULT_EMPRESA_ITEMS);
    }
  } catch {
    // ignore and fall through to migration
  }

  return normalizeItems(readLegacyCompanyNames(), DEFAULT_EMPRESA_ITEMS);
}

const LIST_CONFIG = {
  tipo: {
    storageKey: STORAGE_KEYS.tipoList,
    defaults: DEFAULT_TIPO_ITEMS,
  },
  descricao: {
    storageKey: STORAGE_KEYS.descricaoList,
    defaults: DEFAULT_DESCRICAO_ITEMS,
  },
  empresa: {
    storageKey: STORAGE_KEYS.empresaList,
    defaults: DEFAULT_EMPRESA_ITEMS,
  },
} as const;

export function useDropdownLists() {
  const [tipoItems, setTipoItems] = useLocalStorage<string[]>(
    STORAGE_KEYS.tipoList,
    ensureNovoPlusLast(DEFAULT_TIPO_ITEMS)
  );
  const [descricaoItems, setDescricaoItems] = useLocalStorage<string[]>(
    STORAGE_KEYS.descricaoList,
    ensureNovoPlusLast(DEFAULT_DESCRICAO_ITEMS)
  );
  const [empresaItems, setEmpresaItems] = useLocalStorage<string[]>(
    STORAGE_KEYS.empresaList,
    getInitialEmpresaItems()
  );

  const getListState = useCallback(
    (list: DropdownListType) => {
      switch (list) {
        case 'tipo':
          return { items: tipoItems, setter: setTipoItems, defaults: LIST_CONFIG.tipo.defaults };
        case 'descricao':
          return {
            items: descricaoItems,
            setter: setDescricaoItems,
            defaults: LIST_CONFIG.descricao.defaults,
          };
        case 'empresa':
          return {
            items: empresaItems,
            setter: setEmpresaItems,
            defaults: LIST_CONFIG.empresa.defaults,
          };
      }
    },
    [descricaoItems, empresaItems, setDescricaoItems, setEmpresaItems, setTipoItems, tipoItems]
  );

  const addItem = useCallback(
    (list: DropdownListType, value: string) => {
      const trimmed = value.trim().slice(0, MAX_CUSTOM_ITEM_LENGTH);
      if (!trimmed) return false;

      const { items, setter } = getListState(list);
      const withoutNovo = items.filter((item) => item !== NOVO_PLUS_VALUE);
      if (withoutNovo.includes(trimmed)) return false;

      setter(ensureNovoPlusLast([...withoutNovo, trimmed]));
      return true;
    },
    [getListState]
  );

  const deleteItem = useCallback(
    (list: DropdownListType, value: string) => {
      const { items, setter, defaults } = getListState(list);
      const withoutNovo = items.filter((item) => item !== NOVO_PLUS_VALUE && item !== value);
      setter(normalizeItems(withoutNovo, defaults));
    },
    [getListState]
  );

  const reorderItems = useCallback(
    (list: DropdownListType, fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const { items, setter } = getListState(list);
      const withoutNovo = items.filter((item) => item !== NOVO_PLUS_VALUE);

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= withoutNovo.length ||
        toIndex >= withoutNovo.length
      ) {
        return;
      }

      const reordered = [...withoutNovo];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      setter(ensureNovoPlusLast(reordered));
    },
    [getListState]
  );

  const selectableTipoItems = tipoItems.filter((item) => item !== NOVO_PLUS_VALUE);
  const selectableDescricaoItems = descricaoItems.filter((item) => item !== NOVO_PLUS_VALUE);
  const selectableEmpresaItems = empresaItems.filter((item) => item !== NOVO_PLUS_VALUE);

  return {
    tipoItems: normalizeItems(tipoItems, DEFAULT_TIPO_ITEMS),
    descricaoItems: normalizeItems(descricaoItems, DEFAULT_DESCRICAO_ITEMS),
    empresaItems: normalizeItems(empresaItems, DEFAULT_EMPRESA_ITEMS),
    selectableTipoItems,
    selectableDescricaoItems,
    selectableEmpresaItems,
    addItem,
    deleteItem,
    reorderItems,
  };
}