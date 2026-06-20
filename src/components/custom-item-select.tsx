'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MAX_CUSTOM_ITEM_LENGTH, NOVO_PLUS_VALUE } from '@/lib/constants';

interface CustomItemSelectProps {
  label: string;
  value: string;
  items: string[];
  onChange: (value: string) => void;
  onAddItem: (value: string) => boolean;
  placeholder?: string;
  hideLabel?: boolean;
}

export function CustomItemSelect({
  label,
  value,
  items,
  onChange,
  onAddItem,
  placeholder = 'Selecione...',
  hideLabel = false,
}: CustomItemSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newItemValue, setNewItemValue] = useState('');
  const [error, setError] = useState('');

  const selectableItems = items.filter((item) => item !== NOVO_PLUS_VALUE);

  const handleSelectChange = (selected: string) => {
    if (selected === NOVO_PLUS_VALUE) {
      setNewItemValue('');
      setError('');
      setDialogOpen(true);
      return;
    }
    onChange(selected);
  };

  const handleCreateItem = () => {
    const trimmed = newItemValue.trim();
    if (!trimmed) {
      setError('Digite um nome para o item.');
      return;
    }
    if (trimmed.length > MAX_CUSTOM_ITEM_LENGTH) {
      setError(`Máximo de ${MAX_CUSTOM_ITEM_LENGTH} caracteres.`);
      return;
    }
    const added = onAddItem(trimmed);
    if (!added) {
      setError('Este item já existe na lista.');
      return;
    }
    onChange(trimmed);
    setDialogOpen(false);
    setNewItemValue('');
    setError('');
  };

  return (
    <>
      <div className="space-y-1">
        {!hideLabel && <Label>{label}</Label>}
        <Select value={value || undefined} onValueChange={handleSelectChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {selectableItems.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
            <SelectItem value={NOVO_PLUS_VALUE} className="text-primary font-medium">
              NOVO+
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo item — {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={newItemValue}
              onChange={(e) => {
                setNewItemValue(e.target.value.slice(0, MAX_CUSTOM_ITEM_LENGTH));
                setError('');
              }}
              placeholder={`Máximo ${MAX_CUSTOM_ITEM_LENGTH} caracteres`}
              maxLength={MAX_CUSTOM_ITEM_LENGTH}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()}
            />
            <p className="text-xs text-muted-foreground text-right">
              {newItemValue.length}/{MAX_CUSTOM_ITEM_LENGTH}
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateItem}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}