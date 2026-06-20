import { createHash } from 'node:crypto';
import type { IngestReceiptPayload } from '../schemas/receipt.js';

export function buildContentHash(payload: IngestReceiptPayload): string {
  const { receipt } = payload;
  const fingerprint = {
    responsavel: 'Rosania',
    receipt_id: receipt.id,
    invoice_number: receipt.invoice_number,
    client_name: receipt.client_name.trim().toLowerCase(),
    issue_date: receipt.issue_date,
    delivery_fee: receipt.delivery_fee,
    adjustment: receipt.adjustment,
    grand_total: receipt.totals.grand_total,
    lines: receipt.lines.map((line) => ({
      line_id: line.line_id,
      tipo: line.tipo,
      descricao: line.descricao,
      line_total: line.line_total,
    })),
  };

  return createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');
}