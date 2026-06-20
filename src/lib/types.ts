
import { z } from 'zod';

export const invoiceItemSchema = z.object({
  id: z.string(),
  ref: z.string().optional(),
  type: z.string().min(1, 'Tipo é obrigatório.'),
  description: z.string().min(1, 'Descrição é obrigatória.'),
  isRisk: z.boolean().default(false),
  quantity: z.coerce.number().min(0, 'Quantidade deve ser um número válido.'),
  unitPrice: z.coerce.number().min(0, 'Preço deve ser um número válido.'),
  total: z.coerce.number().min(0, 'Total deve ser um número válido.'),
});

export const invoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string().min(1, 'Número da nota é obrigatório.'),
  clientName: z.string().min(1, 'Nome do cliente é obrigatório.'),
  service: z.string().optional(),
  issueDate: z.string().min(1, 'Data de emissão é obrigatória.'),
  items: z.array(invoiceItemSchema).min(1, 'Pelo menos um item é obrigatório.'),
  companyName: z.string().min(1, 'Nome da empresa é obrigatório.'),
  showEmitter: z.boolean().default(false),
  emitterDocumentType: z.enum(['cpf', 'cnpj']).nullable().default(null),
  pricePerMeter: z.coerce.number({invalid_type_error: "Preço inválido"}).min(0, 'Preço por metro não pode ser negativo.').default(0),
  deliveryFee: z.coerce.number({invalid_type_error: "Taxa inválida"}).default(0),
  adjustment: z.coerce.number({invalid_type_error: "Ajuste inválido"}).default(0),
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

    
