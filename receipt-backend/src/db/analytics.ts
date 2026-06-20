import { config } from '../config.js';
import { getPool } from './postgres.js';

export type Granularity = 'day' | 'week' | 'month';

export interface AnalyticsFilters {
  from: string;
  to: string;
  client?: string;
  limit?: number;
}

export interface SummaryMetrics {
  receipt_count: number;
  total_revenue: number;
  avg_ticket: number;
  unique_clients: number;
}

export interface ClientRanking {
  client_name: string;
  receipt_count: number;
  total_revenue: number;
  avg_ticket: number;
}

export interface RevenueTrendPoint {
  period: string;
  revenue: number;
  receipt_count: number;
}

function periodExpression(granularity: Granularity): string {
  switch (granularity) {
    case 'week':
      return "DATE_TRUNC('week', issue_date)::date";
    case 'month':
      return "DATE_TRUNC('month', issue_date)::date";
    default:
      return 'issue_date::date';
  }
}

function buildWhereClause(filters: AnalyticsFilters, startIndex = 1): {
  clause: string;
  params: (string | number)[];
} {
  const params: (string | number)[] = [config.responsavel, filters.from, filters.to];
  let clause = `WHERE responsavel = $1 AND issue_date >= $2::date AND issue_date <= $3::date`;

  if (filters.client) {
    params.push(filters.client);
    clause += ` AND client_name = $${params.length}`;
  }

  return { clause, params };
}

export async function getSummary(filters: AnalyticsFilters): Promise<SummaryMetrics> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhereClause(filters);
  const result = await pool.query(
    `SELECT
      COUNT(*)::INT AS receipt_count,
      COALESCE(SUM(grand_total), 0)::FLOAT AS total_revenue,
      COALESCE(AVG(grand_total), 0)::FLOAT AS avg_ticket,
      COUNT(DISTINCT client_name)::INT AS unique_clients
     FROM ${config.receiptsTable}
     ${clause}`,
    params
  );

  return result.rows[0] as SummaryMetrics;
}

export async function getTopClients(
  filters: AnalyticsFilters,
  sort: 'count' | 'revenue'
): Promise<ClientRanking[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const limit = Math.min(filters.limit ?? 10, 50);
  const { clause, params } = buildWhereClause(filters);
  const orderBy = sort === 'count' ? 'receipt_count DESC' : 'total_revenue DESC';

  const result = await pool.query(
    `SELECT
      client_name,
      COUNT(*)::INT AS receipt_count,
      SUM(grand_total)::FLOAT AS total_revenue,
      AVG(grand_total)::FLOAT AS avg_ticket
     FROM ${config.receiptsTable}
     ${clause}
     GROUP BY client_name
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  return result.rows as ClientRanking[];
}

export async function getRevenueTrend(
  filters: AnalyticsFilters,
  granularity: Granularity
): Promise<RevenueTrendPoint[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhereClause(filters);
  const periodExpr = periodExpression(granularity);

  const result = await pool.query(
    `SELECT
      ${periodExpr}::TEXT AS period,
      COALESCE(SUM(grand_total), 0)::FLOAT AS revenue,
      COUNT(*)::INT AS receipt_count
     FROM ${config.receiptsTable}
     ${clause}
     GROUP BY 1
     ORDER BY 1 ASC`,
    params
  );

  return result.rows as RevenueTrendPoint[];
}

export async function getClientOptions(filters: AnalyticsFilters): Promise<string[]> {
  const pool = getPool();
  if (!pool) throw new Error('Postgres não configurado');

  const { clause, params } = buildWhereClause(filters);
  const result = await pool.query(
    `SELECT DISTINCT client_name
     FROM ${config.receiptsTable}
     ${clause}
     ORDER BY client_name ASC`,
    params
  );

  return result.rows.map((row) => row.client_name as string);
}