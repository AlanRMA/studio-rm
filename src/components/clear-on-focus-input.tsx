'use client';

import { forwardRef, type ComponentProps, type FocusEvent } from 'react';
import { Input } from '@/components/ui/input';

type ClearOnFocusInputProps = ComponentProps<typeof Input> & {
  /** Valores legados ou de exemplo que devem sumir ao focar o campo */
  clearOnFocusValues?: string[];
};

export const ClearOnFocusInput = forwardRef<HTMLInputElement, ClearOnFocusInputProps>(
  function ClearOnFocusInput(
    { onFocus, onChange, value, placeholder, clearOnFocusValues = [], ...props },
    ref
  ) {
    const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
      const current = String(value ?? '');
      const shouldClear =
        (placeholder && current === placeholder) ||
        clearOnFocusValues.some((item) => item === current);

      if (shouldClear) {
        onChange?.({
          ...event,
          target: { ...event.target, value: '' },
        } as FocusEvent<HTMLInputElement>);
      }

      onFocus?.(event);
    };

    return (
      <Input
        ref={ref}
        value={value ?? ''}
        placeholder={placeholder}
        onFocus={handleFocus}
        onChange={onChange}
        {...props}
      />
    );
  }
);