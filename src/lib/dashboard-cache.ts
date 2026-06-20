import type {
  AnalyticsFilters,
  ClientRanking,
  Granularity,
  RevenueTrendPoint,
  SummaryMetrics,
} from '@/lib/analytics-api';

const CACHE_PREFIX = 'rosania-dashboard:';

export interface DashboardSnapshot {
  savedAt: string;
  filters: AnalyticsFilters;
  granularity: Granularity;
  summary: SummaryMetrics;
  topByCount: ClientRanking[];
  topByRevenue: ClientRanking[];
  trend: RevenueTrendPoint[];
  clientOptions: string[];
}

function cacheKey(filters: AnalyticsFilters, granularity: Granularity): string {
  return `${CACHE_PREFIX}${filters.from}|${filters.to}|${filters.client ?? ''}|${granularity}`;
}

export function readDashboardCache(
  filters: AnalyticsFilters,
  granularity: Granularity
): DashboardSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(cacheKey(filters, granularity));
    if (!raw) return null;
    return JSON.parse(raw) as DashboardSnapshot;
  } catch {
    return null;
  }
}

export function writeDashboardCache(snapshot: DashboardSnapshot): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      cacheKey(snapshot.filters, snapshot.granularity),
      JSON.stringify(snapshot)
    );
  } catch {
    // quota exceeded — ignore
  }
}

export function formatCacheAge(savedAt: string): string {
  const diffMs = Date.now() - new Date(savedAt).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}