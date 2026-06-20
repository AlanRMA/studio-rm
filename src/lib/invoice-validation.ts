import type { ZodError } from 'zod';
import { invoiceSchema, type Invoice } from '@/lib/types';

export function formatInvoiceValidationError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    if (path.startsWith('items.')) {
      const match = path.match(/^items\.(\d+)\.(\w+)$/);
      if (match) {
        const line = Number(match[1]) + 1;
        const field = match[2];
        const labels: Record<string, string> = {
          type: 'Tipo',
          description: 'Descrição',
          total: 'Valor final',
        };
        return `Linha ${line} — ${labels[field] ?? field}: ${issue.message}`;
      }
    }
    return issue.message;
  });

  return issues[0] ?? 'Preencha todos os campos obrigatórios.';
}

export function validateInvoiceForSave(invoice: Invoice) {
  return invoiceSchema.safeParse(invoice);
}