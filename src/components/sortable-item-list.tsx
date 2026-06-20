'use client';

import { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SortableItemListProps {
  items: string[];
  onDelete: (item: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  emptyMessage?: string;
}

export function SortableItemList({
  items,
  onDelete,
  onReorder,
  emptyMessage = 'Nenhum item cadastrado.',
}: SortableItemListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item}
          draggable
          onDragStart={() => setDraggedIndex(index)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverIndex(index);
          }}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={() => {
            if (draggedIndex !== null && draggedIndex !== index) {
              onReorder(draggedIndex, index);
            }
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          className={cn(
            'flex items-center gap-2 p-2 border rounded-md bg-card transition-colors',
            draggedIndex === index && 'opacity-50',
            dragOverIndex === index && draggedIndex !== index && 'border-primary bg-primary/5'
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
          <span className="flex-1 text-sm truncate">{item}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive shrink-0"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}