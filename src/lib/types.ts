
import { z } from 'zod';

const requiredText = (message: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, message));

export const invoiceItemSchema = z.object({
  id: z.string(),
  ref: z.string().optional(),
  type: requiredText('Tipo é obrigatório.'),
  description: requiredText('Descrição é obrigatória.'),
  isRisk: z.boolean().default(false),
  quantity: z.coerce.number().min(0, 'Quantidade deve ser um número válido.'),
  unitPrice: z.coerce.number().min(0, 'Preço deve ser um número válido.'),
  total: z.coerce
    .number({ invalid_type_error: 'Valor final inválido.' })
    .gt(0, 'Valor final é obrigatório.'),
});

export const invoiceSchema = z
  .object({
    id: z.string(),
    invoiceNumber: requiredText('Número da nota é obrigatório.'),
    clientName: requiredText('Nome do cliente é obrigatório.'),
    service: z.string().optional(),
    issueDate: requiredText('Data de emissão é obrigatória.'),
    items: z.array(invoiceItemSchema).min(1, 'Pelo menos um item é obrigatório.'),
    companyName: requiredText('Nome da empresa é obrigatório.'),
    showEmitter: z.boolean().default(false),
    emitterDocumentType: z.enum(['cpf', 'cnpj']).nullable().default(null),
    pricePerMeter: z.coerce
      .number({ invalid_type_error: 'Preço inválido' })
      .min(0, 'Preço por metro não pode ser negativo.')
      .default(0),
    deliveryFee: z.coerce.number({ invalid_type_error: 'Taxa inválida' }).default(0),
    adjustment: z.coerce.number({ invalid_type_error: 'Ajuste inválido' }).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.showEmitter && !data.emitterDocumentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione CPF ou CNPJ para exibir o emissor.',
        path: ['emitterDocumentType'],
      });
    }

    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const grandTotal = subtotal + data.deliveryFee + data.adjustment;
    if (grandTotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O valor total do recibo deve ser maior que zero.',
        path: ['items'],
      });
    }
  });

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;

export type SaveFormat = 'jpeg' | 'pdf';

export interface SavedExport {
  id: string;
  invoiceId: string;
  clientName: string;
  invoiceNumber: string;
  format: SaveFormat;
  data: string;
  createdAt: string;
}

    
