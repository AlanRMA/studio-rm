import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { closePostgres, getPool } from '../db/postgres.js';
import { buildContentHash } from '../services/hash.js';
import type { IngestReceiptPayload } from '../schemas/receipt.js';

const CLIENTS = [
  { name: 'Maria Silva', weight: 12, avgSpend: 180 },
  { name: 'Ana Costa', weight: 9, avgSpend: 220 },
  { name: 'Juliana Santos', weight: 8, avgSpend: 150 },
  { name: 'Fernanda Lima', weight: 7, avgSpend: 310 },
  { name: 'Patricia Oliveira', weight: 6, avgSpend: 95 },
  { name: 'Camila Souza', weight: 5, avgSpend: 260 },
  { name: 'Beatriz Alves', weight: 4, avgSpend: 130 },
  { name: 'Larissa Mendes', weight: 3, avgSpend: 400 },
  { name: 'Renata Dias', weight: 3, avgSpend: 175 },
  { name: 'Carla Ribeiro', weight: 2, avgSpend: 85 },
] as const;

const TIPOS = ['Modelagem', 'Ajuste', 'Costura', 'Acabamento'] as const;
const DESCRICOES = ['Vestido', 'Blusa', 'Calça', 'Saia', 'Macacão'] as const;
const FORMATS = ['jpeg', 'pdf'] as const;

function pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function randomDateInLastDays(days: number): Date {
  const now = new Date();
  const offset = Math.floor(Math.random() * days);
  const date = new Date(now);
  date.setDate(date.getDate() - offset);
  date.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  return date;
}

function buildDummyReceipt(client: (typeof CLIENTS)[number], issueDate: Date): IngestReceiptPayload {
  const eventId = randomUUID();
  const receiptId = randomUUID();
  const invoiceNumber = randomUUID();
  const lineCount = 1 + Math.floor(Math.random() * 3);
  const format = FORMATS[Math.floor(Math.random() * FORMATS.length)];

  const lines = Array.from({ length: lineCount }, (_, index) => {
    const base = client.avgSpend / lineCount;
    return {
      line_id: `item-${randomUUID().slice(0, 8)}`,
      line_order: index + 1,
      ref: String(1 + Math.floor(Math.random() * 5)),
      tipo: TIPOS[Math.floor(Math.random() * TIPOS.length)],
      descricao: DESCRICOES[Math.floor(Math.random() * DESCRICOES.length)],
      line_total: randomBetween(base * 0.6, base * 1.4),
    };
  });

  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.line_total, 0) * 100) / 100;
  const deliveryFee = Math.random() > 0.7 ? randomBetween(10, 35) : 0;
  const adjustment = Math.random() > 0.8 ? randomBetween(-30, -5) : 0;
  const grandTotal = Math.round((subtotal + deliveryFee + adjustment) * 100) / 100;
  const eventAt = issueDate.toISOString();
  const issueDateStr = issueDate.toISOString().slice(0, 10);

  return {
    source_system: 'studio-rm-rosania',
    event_type: 'receipt.saved',
    event_id: eventId,
    event_at: eventAt,
    export: {
      id: eventId,
      format,
      file_mime_type: format === 'pdf' ? 'application/pdf' : 'image/jpeg',
    },
    receipt: {
      id: receiptId,
      invoice_number: invoiceNumber,
      client_name: client.name,
      service_type: TIPOS[Math.floor(Math.random() * TIPOS.length)],
      issue_date: issueDateStr,
      company_name: 'Rosania Modelista',
      show_emitter: Math.random() > 0.3,
      emitter: {
        document_type: 'cpf',
        legal_name: 'Rosania Moreira Aragao',
        document_number: '857.154.093-49',
      },
      delivery_fee: deliveryFee,
      adjustment,
      adjustment_kind: adjustment < 0 ? 'discount' : 'increase',
      lines,
      totals: {
        subtotal,
        delivery_fee: deliveryFee,
        adjustment,
        grand_total: grandTotal,
        item_count: lines.length,
      },
    },
  };
}

async function insertDummy(payload: IngestReceiptPayload): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { receipt, export: exportMeta, event_id, event_at } = payload;
  const contentHash = buildContentHash(payload);

  await pool.query(
    `INSERT INTO ${config.receiptsTable} (
      event_id, responsavel, receipt_id, invoice_number, client_name,
      service_type, issue_date, company_name, show_emitter,
      emitter_document_type, emitter_legal_name, emitter_document,
      delivery_fee, adjustment, adjustment_kind,
      subtotal, grand_total, item_count, export_format,
      lines, content_hash, event_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22
    )
    ON CONFLICT (event_id) DO NOTHING`,
    [
      event_id,
      config.responsavel,
      receipt.id,
      receipt.invoice_number,
      receipt.client_name,
      receipt.service_type ?? null,
      receipt.issue_date,
      receipt.company_name,
      receipt.show_emitter,
      receipt.emitter?.document_type ?? null,
      receipt.emitter?.legal_name ?? null,
      receipt.emitter?.document_number ?? null,
      receipt.delivery_fee,
      receipt.adjustment,
      receipt.adjustment_kind,
      receipt.totals.subtotal,
      receipt.totals.grand_total,
      receipt.totals.item_count,
      exportMeta.format,
      JSON.stringify(receipt.lines),
      contentHash,
      event_at,
    ]
  );
}

async function seedDummy(count = 80) {
  if (!config.databaseUrl) {
    console.error('Configure DATABASE_URL no .env antes de rodar o seed.');
    process.exit(1);
  }

  if (config.appEnv === 'production') {
    console.error('Seed bloqueado em produção. Use APP_ENV=development.');
    process.exit(1);
  }

  console.log(`Gerando ${count} recibos dummy em ${config.receiptsTable}...\n`);

  let inserted = 0;
  for (let i = 0; i < count; i++) {
    const client = pickWeighted(CLIENTS);
    const issueDate = randomDateInLastDays(90);
    const payload = buildDummyReceipt(client, issueDate);

    await insertDummy(payload);
    inserted += 1;

    if (inserted % 20 === 0) {
      console.log(`  ${inserted}/${count} inseridos...`);
    }
  }

  const pool = getPool();
  const stats = await pool!.query(
    `SELECT
      COUNT(*)::INT AS total,
      COUNT(DISTINCT client_name)::INT AS clients,
      SUM(grand_total)::FLOAT AS revenue
     FROM ${config.receiptsTable}
     WHERE responsavel = $1`,
    [config.responsavel]
  );

  const row = stats.rows[0];
  console.log(`\nSeed concluído!`);
  console.log(`  Inseridos nesta execução: ${inserted}`);
  console.log(`  Total no banco: ${row.total} recibos`);
  console.log(`  Clientes únicos: ${row.clients}`);
  console.log(`  Faturamento acumulado: R$ ${Number(row.revenue).toFixed(2)}`);
  console.log(`\nAbra http://localhost:9002/dashboard para analisar.`);

  await closePostgres();
}

const count = Number(process.argv[2] ?? 80);
seedDummy(count).catch((error) => {
  console.error('Erro no seed:', error);
  process.exit(1);
});