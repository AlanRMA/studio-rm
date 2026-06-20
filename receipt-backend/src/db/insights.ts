import { config } from '../config.js';
import { getPool } from './postgres.js';
import type { AnalyticsFilters } from './analytics.js';

export interface RevenueBreakdown {
  name: string;
  revenue: number;
  line_count: number;
  share_pct: number;
}

export interface MonthlySeasonality {
  month: number;
  month_label: string;
  revenue: number;
  receipt_count: number;
  unique_clients: number;
}

export interface MonthPhaseActivity {
  phase: 'inicio' | 'meio' | 'fim';
  label: string;
  revenue: number;
  receipt_count: number;
  unique_clients: number;
  share_pct: number;
}

export interface ClientPriority {
  client_name: string;
  receipt_count: number;
  total_revenue: number;
  avg_ticket: number;
  priority_score: number;
  tier: 'estrela' | 'fiel' | 'alto_valor' | 'emergente';
  tier_label: string;
}

export interface DecisionHighlight {
  question: string;
  answer: string;
  action: string;
}

const MONTH_LABELS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function buildWhere(filters: AnalyticsFilters): {
  clause: string;
  params: (string | number)[];
} {
  const params: (string | number)[] = [config.responsavel, filters.from, filters.to];
  let clause = `WHERE r.responsavel = $1 AND r.issue_date >= $2::date AND r.issue_date <= $3::date`;

  if (filters.client) {
    params.push(filters.client);
    clause += ` AND r.client_name = $${params.length}`;
  }

  return { clause, params };
}

function addSharePct<T extends { revenue: number }>(items: T[]): (T & { share_pct: number })[] {
  const total = items.reduce((sum, item) => sum + item.revenue, 0);
  return items.map((item) => ({
    ...item,
    share_pct: total > 0 ? Math.round((item.revenue / total) * 1000) / 10 : 0,
  }));
}

export async function getRevenueByTipo(
  filters: AnalyticsFilters,
  limit = 6
): Promise<RevenueBreakdown[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhere(filters);
  const result = await pool.query(
    `SELECT
      COALESCE(NULLIF(TRIM(line->>'tipo'), ''), 'Sem tipo') AS name,
      SUM((line->>'line_total')::NUMERIC)::FLOAT AS revenue,
      COUNT(*)::INT AS line_count
     FROM ${config.receiptsTable} r,
     LATERAL jsonb_array_elements(r.lines) AS line
     ${clause}
     GROUP BY 1
     ORDER BY revenue DESC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  return addSharePct(result.rows as Omit<RevenueBreakdown, 'share_pct'>[]);
}

export async function getRevenueByDescricao(
  filters: AnalyticsFilters,
  limit = 6
): Promise<RevenueBreakdown[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhere(filters);
  const result = await pool.query(
    `SELECT
      COALESCE(NULLIF(TRIM(line->>'descricao'), ''), 'Sem descrição') AS name,
      SUM((line->>'line_total')::NUMERIC)::FLOAT AS revenue,
      COUNT(*)::INT AS line_count
     FROM ${config.receiptsTable} r,
     LATERAL jsonb_array_elements(r.lines) AS line
     ${clause}
     GROUP BY 1
     ORDER BY revenue DESC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  return addSharePct(result.rows as Omit<RevenueBreakdown, 'share_pct'>[]);
}

export async function getMonthlySeasonality(
  filters: AnalyticsFilters
): Promise<MonthlySeasonality[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhere(filters);
  const result = await pool.query(
    `SELECT
      EXTRACT(MONTH FROM r.issue_date)::INT AS month,
      SUM(r.grand_total)::FLOAT AS revenue,
      COUNT(*)::INT AS receipt_count,
      COUNT(DISTINCT r.client_name)::INT AS unique_clients
     FROM ${config.receiptsTable} r
     ${clause}
     GROUP BY 1
     ORDER BY month ASC`,
    params
  );

  return result.rows.map((row) => ({
    month: row.month as number,
    month_label: MONTH_LABELS[(row.month as number) - 1],
    revenue: row.revenue as number,
    receipt_count: row.receipt_count as number,
    unique_clients: row.unique_clients as number,
  }));
}

export async function getMonthPhaseActivity(
  filters: AnalyticsFilters
): Promise<MonthPhaseActivity[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhere(filters);
  const result = await pool.query(
    `SELECT
      CASE
        WHEN EXTRACT(DAY FROM r.issue_date) <= 10 THEN 'inicio'
        WHEN EXTRACT(DAY FROM r.issue_date) <= 20 THEN 'meio'
        ELSE 'fim'
      END AS phase,
      CASE
        WHEN EXTRACT(DAY FROM r.issue_date) <= 10 THEN 'Início (dias 1–10)'
        WHEN EXTRACT(DAY FROM r.issue_date) <= 20 THEN 'Meio (dias 11–20)'
        ELSE 'Fim (dias 21–31)'
      END AS label,
      SUM(r.grand_total)::FLOAT AS revenue,
      COUNT(*)::INT AS receipt_count,
      COUNT(DISTINCT r.client_name)::INT AS unique_clients
     FROM ${config.receiptsTable} r
     ${clause}
     GROUP BY 1, 2`,
    params
  );

  const phaseOrder: Record<string, number> = { inicio: 1, meio: 2, fim: 3 };
  const rows = (result.rows as Omit<MonthPhaseActivity, 'share_pct'>[]).sort(
    (a, b) => (phaseOrder[a.phase] ?? 0) - (phaseOrder[b.phase] ?? 0)
  );
  const totalClients = rows.reduce((sum, row) => sum + row.unique_clients, 0);

  return rows.map((row) => ({
    ...row,
    phase: row.phase as MonthPhaseActivity['phase'],
    share_pct:
      totalClients > 0
        ? Math.round((row.unique_clients / totalClients) * 1000) / 10
        : 0,
  }));
}

export async function getClientPriorities(
  filters: AnalyticsFilters,
  limit = 6
): Promise<ClientPriority[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhere(filters);
  const result = await pool.query(
    `WITH base AS (
      SELECT
        client_name,
        COUNT(*)::INT AS receipt_count,
        SUM(grand_total)::FLOAT AS total_revenue,
        AVG(grand_total)::FLOAT AS avg_ticket
      FROM ${config.receiptsTable} r
      ${clause}
      GROUP BY client_name
    ),
    ranked AS (
      SELECT
        *,
        receipt_count::FLOAT / NULLIF(MAX(receipt_count) OVER (), 0) AS freq_norm,
        total_revenue / NULLIF(MAX(total_revenue) OVER (), 0) AS rev_norm
      FROM base
    )
    SELECT
      client_name,
      receipt_count,
      total_revenue,
      avg_ticket,
      ROUND((freq_norm * 0.45 + rev_norm * 0.55)::NUMERIC, 3)::FLOAT AS priority_score
    FROM ranked
    ORDER BY priority_score DESC
    LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  return result.rows.map((row) => {
    const score = row.priority_score as number;
    let tier: ClientPriority['tier'] = 'emergente';
    let tier_label = 'Emergente';

    const receiptCount = row.receipt_count as number;
    const avgTicket = row.avg_ticket as number;

    if (score >= 0.7) {
      tier = 'estrela';
      tier_label = 'Cliente estrela';
    } else if (receiptCount >= 4) {
      tier = 'fiel';
      tier_label = 'Cliente fiel';
    } else if (avgTicket >= 200) {
      tier = 'alto_valor';
      tier_label = 'Alto valor';
    }

    return {
      client_name: row.client_name as string,
      receipt_count: row.receipt_count as number,
      total_revenue: row.total_revenue as number,
      avg_ticket: row.avg_ticket as number,
      priority_score: score,
      tier,
      tier_label,
    };
  });
}

export function buildDecisionHighlights(data: {
  byTipo: RevenueBreakdown[];
  byDescricao: RevenueBreakdown[];
  monthly: MonthlySeasonality[];
  monthPhase: MonthPhaseActivity[];
  priorities: ClientPriority[];
}): DecisionHighlight[] {
  const highlights: DecisionHighlight[] = [];

  const topTipo = data.byTipo[0];
  if (topTipo) {
    highlights.push({
      question: 'O que priorizar nos serviços?',
      answer: `${topTipo.name} responde por ${topTipo.share_pct}% da receita de linhas.`,
      action: `Invista tempo em divulgar e agilizar ${topTipo.name.toLowerCase()}.`,
    });
  }

  const topPeca = data.byDescricao[0];
  if (topPeca) {
    highlights.push({
      question: 'De onde entra mais renda?',
      answer: `${topPeca.name} é a peça/serviço mais rentável (${topPeca.share_pct}% do faturamento).`,
      action: 'Mantenha portfólio e prazo competitivo para esse tipo de trabalho.',
    });
  }

  const bestMonth = [...data.monthly].sort((a, b) => b.revenue - a.revenue)[0];
  if (bestMonth) {
    highlights.push({
      question: 'Qual época do ano rende mais?',
      answer: `${bestMonth.month_label} concentrou o maior faturamento (R$ ${bestMonth.revenue.toFixed(0)}).`,
      action: 'Planeje agenda e promoções antes desse mês chegar.',
    });
  }

  const bestPhase = [...data.monthPhase].sort((a, b) => b.unique_clients - a.unique_clients)[0];
  if (bestPhase) {
    highlights.push({
      question: 'Quando os clientes mais aparecem no mês?',
      answer: `${bestPhase.label} reúne ${bestPhase.share_pct}% dos clientes únicos.`,
      action: 'Reserve capacidade e follow-up para essa janela do mês.',
    });
  }

  const topClient = data.priorities[0];
  if (topClient) {
    highlights.push({
      question: 'Quem merece atenção especial?',
      answer: `${topClient.client_name} — ${topClient.tier_label.toLowerCase()} (${topClient.receipt_count} recibos).`,
      action: 'Priorize retorno rápido e contato proativo com esse cliente.',
    });
  }

  return highlights.slice(0, 4);
}

export async function getDecisionInsights(filters: AnalyticsFilters) {
  const [byTipo, byDescricao, monthly, monthPhase, priorities] = await Promise.all([
    getRevenueByTipo(filters),
    getRevenueByDescricao(filters),
    getMonthlySeasonality(filters),
    getMonthPhaseActivity(filters),
    getClientPriorities(filters),
  ]);

  const highlights = buildDecisionHighlights({
    byTipo,
    byDescricao,
    monthly,
    monthPhase,
    priorities,
  });

  return { byTipo, byDescricao, monthly, monthPhase, priorities, highlights };
}