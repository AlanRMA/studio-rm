export type DatePreset = '7d' | '30d' | '90d' | 'all';
export type Granularity = 'day' | 'week' | 'month';

export interface AnalyticsFilters {
  from: string;
  to: string;
  client?: string;
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

export interface DecisionInsights {
  highlights: DecisionHighlight[];
  byTipo: RevenueBreakdown[];
  byDescricao: RevenueBreakdown[];
  monthly: MonthlySeasonality[];
  monthPhase: MonthPhaseActivity[];
  priorities: ClientPriority[];
}

function buildQuery(filters: AnalyticsFilters, extra?: Record<string, string | number>) {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
  });
  if (filters.client) params.set('client', filters.client);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

async function fetchAnalytics<T>(path: string, query: string): Promise<T> {
  const response = await fetch(`/api/analytics/${path}?${query}`);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? `Erro ${response.status} ao carregar analytics`);
  }

  return body as T;
}

export function fetchSummary(filters: AnalyticsFilters) {
  return fetchAnalytics<{ summary: SummaryMetrics }>('summary', buildQuery(filters));
}

export function fetchDecisionInsights(filters: AnalyticsFilters) {
  return fetchAnalytics<DecisionInsights>('decisions', buildQuery(filters));
}

export function fetchTopClients(
  filters: AnalyticsFilters,
  sort: 'count' | 'revenue',
  limit = 10
) {
  return fetchAnalytics<{ clients: ClientRanking[] }>(
    'top-clients',
    buildQuery(filters, { sort, limit })
  );
}

export function fetchRevenueTrend(filters: AnalyticsFilters, granularity: Granularity) {
  return fetchAnalytics<{ trend: RevenueTrendPoint[] }>(
    'revenue-trend',
    buildQuery(filters, { granularity })
  );
}

export function fetchClientOptions(filters: AnalyticsFilters) {
  return fetchAnalytics<{ clients: string[] }>('clients', buildQuery(filters));
}