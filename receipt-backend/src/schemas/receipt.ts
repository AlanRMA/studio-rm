import { z } from 'zod';

const requiredText = (message: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, message));

const nullableText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  });

export const receiptLineSchema = z.object({
  line_id: z.string().min(1),
  line_order: z.number().int().positive(),
  ref: z.string().optional(),
  tipo: requiredText('tipo é obrigatório'),
  descricao: requiredText('descricao é obrigatória'),
  line_total: z.number().gt(0, 'line_total deve ser maior que zero'),
});

export const receiptTotalsSchema = z.object({
  subtotal: z.number().gt(0, 'subtotal deve ser maior que zero'),
  delivery_fee: z.number().min(0),
  adjustment: z.number(),
  grand_total: z.number().gt(0, 'grand_total deve ser maior que zero'),
  item_count: z.number().int().positive(),
});

export const ingestReceiptSchema = z
  .object({
    source_system: z.literal('studio-rm-rosania'),
    event_type: z.literal('receipt.saved'),
    event_id: z.string().uuid(),
    event_at: z.string().datetime(),
    export: z.object({
      id: z.string().uuid(),
      format: z.enum(['jpeg', 'pdf']),
      file_mime_type: z.string().min(1),
    }),
    receipt: z.object({
      id: z.string().uuid(),
      invoice_number: requiredText('invoice_number é obrigatório'),
      client_name: nullableText,
      service_type: z.string().optional(),
      issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      company_name: nullableText,
      show_emitter: z.boolean(),
      emitter: z
        .object({
          document_type: z.enum(['cpf', 'cnpj']),
          legal_name: z.string().min(1),
          document_number: z.string().min(1),
        })
        .nullable(),
      delivery_fee: z.number().min(0),
      adjustment: z.number(),
      adjustment_kind: z.enum(['increase', 'discount', 'none']),
      lines: z.array(receiptLineSchema).min(1),
      totals: receiptTotalsSchema,
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.receipt.client_name && !data.receipt.company_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'client_name ou company_name deve estar preenchido',
        path: ['receipt', 'client_name'],
      });
    }

    if (data.receipt.show_emitter && !data.receipt.emitter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emitter é obrigatório quando show_emitter é true',
        path: ['receipt', 'emitter'],
      });
    }

    if (data.receipt.adjustment_kind === 'none' && data.receipt.adjustment !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'adjustment deve ser 0 quando adjustment_kind é none',
        path: ['receipt', 'adjustment'],
      });
    }
  });

export type IngestReceiptPayload = z.infer<typeof ingestReceiptSchema>;