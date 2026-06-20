import { EMITTER_DATA } from '@/lib/constants';
import type { Invoice, SavedExport } from '@/lib/types';
import { getAdjustmentKind } from '@/lib/utils';

export interface ReceiptIngestPayload {
  source_system: 'studio-rm-rosania';
  event_type: 'receipt.saved';
  event_id: string;
  event_at: string;
  export: {
    id: string;
    format: 'jpeg' | 'pdf';
    file_mime_type: string;
  };
  receipt: {
    id: string;
    invoice_number: string;
    client_name: string | null;
    service_type?: string;
    issue_date: string;
    company_name: string | null;
    show_emitter: boolean;
    emitter: {
      document_type: 'cpf' | 'cnpj';
      legal_name: string;
      document_number: string;
    } | null;
    delivery_fee: number;
    adjustment: number;
    adjustment_kind: 'increase' | 'discount' | 'none';
    lines: Array<{
      line_id: string;
      line_order: number;
      ref?: string;
      tipo: string;
      descricao: string;
      line_total: number;
    }>;
    totals: {
      subtotal: number;
      delivery_fee: number;
      adjustment: number;
      grand_total: number;
      item_count: number;
    };
  };
}

function buildEmitter(invoice: Invoice) {
  if (!invoice.showEmitter || !invoice.emitterDocumentType) {
    return null;
  }

  const emitter = EMITTER_DATA[invoice.emitterDocumentType];
  return {
    document_type: invoice.emitterDocumentType,
    legal_name: emitter.name,
    document_number: emitter.document,
  };
}

export function buildReceiptIngestPayload(
  invoice: Invoice,
  saved: SavedExport
): ReceiptIngestPayload {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = subtotal + invoice.deliveryFee + invoice.adjustment;

  return {
    source_system: 'studio-rm-rosania',
    event_type: 'receipt.saved',
    event_id: saved.id,
    event_at: saved.createdAt,
    export: {
      id: saved.id,
      format: saved.format,
      file_mime_type: saved.format === 'pdf' ? 'application/pdf' : 'image/jpeg',
    },
    receipt: {
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      client_name: invoice.clientName.trim() || null,
      service_type: invoice.service?.trim() || undefined,
      issue_date: invoice.issueDate,
      company_name: invoice.companyName.trim() || null,
      show_emitter: invoice.showEmitter,
      emitter: buildEmitter(invoice),
      delivery_fee: invoice.deliveryFee,
      adjustment: invoice.adjustment,
      adjustment_kind: getAdjustmentKind(invoice.adjustment),
      lines: invoice.items.map((item, index) => ({
        line_id: item.id,
        line_order: index + 1,
        ref: item.ref?.trim() || undefined,
        tipo: item.type.trim(),
        descricao: item.description.trim(),
        line_total: item.total,
      })),
      totals: {
        subtotal,
        delivery_fee: invoice.deliveryFee,
        adjustment: invoice.adjustment,
        grand_total: grandTotal,
        item_count: invoice.items.length,
      },
    },
  };
}

export async function submitReceiptToBackend(
  invoice: Invoice,
  saved: SavedExport
): Promise<{ ok: boolean; status?: string; error?: string }> {
  try {
    const response = await fetch('/api/ingest/receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': saved.id,
      },
      body: JSON.stringify(buildReceiptIngestPayload(invoice, saved)),
    });

    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      status?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        error: body.error ?? `Erro ${response.status} ao enviar recibo`,
      };
    }

    return { ok: true, status: body.status };
  } catch (error) {
    console.error('[receipt-ingest] Falha no envio:', error);
    return { ok: false, error: 'Não foi possível conectar ao servidor de recibos' };
  }
}