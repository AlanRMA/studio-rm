'use client';

import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  DEFAULT_DESCRICAO_ITEMS,
  DEFAULT_TIPO_ITEMS,
  MAX_CUSTOM_ITEM_LENGTH,
  NOVO_PLUS_VALUE,
  STORAGE_KEYS,
} from '@/lib/constants';

function ensureNovoPlusLast(items: string[]): string[] {
  const filtered = items.filter((item) => item !== NOVO_PLUS_VALUE);
  return [...filtered, NOVO_PLUS_VALUE];
}

function normalizeItems(items: string[], defaults: string[]): string[] {
  const unique = [...new Set(items.filter((item) => item && item !== NOVO_PLUS_VALUE))];
  if (unique.length === 0) {
    return ensureNovoPlusLast(defaults);
  }
  return ensureNovoPlusLast(unique);
}

export function useDropdownLists() {
  const [tipoItems, setTipoItems] = useLocalStorage<string[]>(
    STORAGE_KEYS.tipoList,
    ensureNovoPlusLast(DEFAULT_TIPO_ITEMS)
  );
  const [descricaoItems, setDescricaoItems] = useLocalStorage<string[]>(
    STORAGE_KEYS.descricaoList,
    ensureNovoPlusLast(DEFAULT_DESCRICAO_ITEMS)
  );

  const addItem = useCallback(
    (list: 'tipo' | 'descricao', value: string) => {
      const trimmed = value.trim().slice(0, MAX_CUSTOM_ITEM_LENGTH);
      if (!trimmed) return false;

      const setter = list === 'tipo' ? setTipoItems : setDescricaoItems;
      const current = list === 'tipo' ? tipoItems : descricaoItems;

      const withoutNovo = current.filter((item) => item !== NOVO_PLUS_VALUE);
      if (withoutNovo.includes(trimmed)) return false;

      setter(ensureNovoPlusLast([...withoutNovo, trimmed]));
      return true;
    },
    [descricaoItems, setDescricaoItems, setTipoItems, tipoItems]
  );

  const deleteItem = useCallback(
    (list: 'tipo' | 'descricao', value: string) => {
      const setter = list === 'tipo' ? setTipoItems : setDescricaoItems;
      const current = list === 'tipo' ? tipoItems : descricaoItems;
      const defaults = list === 'tipo' ? DEFAULT_TIPO_ITEMS : DEFAULT_DESCRICAO_ITEMS;

      const withoutNovo = current.filter((item) => item !== NOVO_PLUS_VALUE && item !== value);
      setter(normalizeItems(withoutNovo, defaults));
    },
    [descricaoItems, setDescricaoItems, setTipoItems, tipoItems]
  );

  const reorderItems = useCallback(
    (list: 'tipo' | 'descricao', fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const setter = list === 'tipo' ? setTipoItems : setDescricaoItems;
      const current = list === 'tipo' ? tipoItems : descricaoItems;
      const withoutNovo = current.filter((item) => item !== NOVO_PLUS_VALUE);

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
    [descricaoItems, setDescricaoItems, setTipoItems, tipoItems]
  );

  const selectableTipoItems = tipoItems.filter((item) => item !== NOVO_PLUS_VALUE);
  const selectableDescricaoItems = descricaoItems.filter((item) => item !== NOVO_PLUS_VALUE);

  return {
    tipoItems: normalizeItems(tipoItems, DEFAULT_TIPO_ITEMS),
    descricaoItems: normalizeItems(descricaoItems, DEFAULT_DESCRICAO_ITEMS),
    selectableTipoItems,
    selectableDescricaoItems,
    addItem,
    deleteItem,
    reorderItems,
  };
}