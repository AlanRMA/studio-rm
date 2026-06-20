'use client';

import { useFormContext, type FieldError } from 'react-hook-form';
import type { Invoice } from '@/lib/types';

interface ItemRowErrorsProps {
  index: number;
}

function fieldMessage(error: FieldError | undefined): string | undefined {
  return error?.message;
}

export function ItemRowErrors({ index }: ItemRowErrorsProps) {
  const { formState } = useFormContext<Invoice>();
  const rowErrors = formState.errors.items?.[index];

  if (!rowErrors || typeof rowErrors !== 'object') return null;

  const messages = [
    fieldMessage(rowErrors.ref as FieldError | undefined),
    fieldMessage(rowErrors.type as FieldError | undefined),
    fieldMessage(rowErrors.description as FieldError | undefined),
    fieldMessage(rowErrors.total as FieldError | undefined),
  ].filter((msg): msg is string => Boolean(msg));

  if (messages.length === 0) return null;

  return (
    <div className="col-span-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {messages.map((msg) => (
        <p key={msg}>{msg}</p>
      ))}
    </div>
  );
}