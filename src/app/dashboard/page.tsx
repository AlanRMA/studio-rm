'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type AnalyticsFilters,
  type ClientRanking,
  type DatePreset,
  type Granularity,
  type RevenueTrendPoint,
  type SummaryMetrics,
  fetchClientOptions,
  fetchRevenueTrend,
  fetchSummary,
  fetchTopClients,
} from '@/lib/analytics-api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ALL_TIME_START = '2020-01-01';
const TOP_LIMIT = 5;

function getDateRange(preset: DatePreset): AnalyticsFilters {
  const to = format(new Date(), 'yyyy-MM-dd');
  switch (preset) {
    case '7d':
      return { from: format(subDays(new Date(), 6), 'yyyy-MM-dd'), to };
    case '30d':
      return { from: format(subDays(new Date(), 29), 'yyyy-MM-dd'), to };
    case '90d':
      return { from: format(subDays(new Date(), 89), 'yyyy-MM-dd'), to };
    default:
      return { from: ALL_TIME_START, to };
  }
}

function formatPeriodLabel(period: string, granularity: Granularity): string {
  const date = parseISO(period.slice(0, 10));
  if (granularity === 'month') return format(date, 'MMM/yy', { locale: ptBR });
  return format(date, 'dd/MM', { locale: ptBR });
}

function shortCurrency(value: number): string {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${Math.round(value)}`;
}

const revenueChartConfig = {
  revenue: { label: 'Faturamento', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const countChartConfig = {
  receipt_count: { label: 'Recibos', color: 'hsl(142 55% 45%)' },
} satisfies ChartConfig;

function KpiStrip({ summary }: { summary: SummaryMetrics }) {
  const items = [
    { label: 'Faturamento', value: formatCurrency(summary.total_revenue) },
    { label: 'Recibos', value: String(summary.receipt_count) },
    { label: 'Ticket médio', value: formatCurrency(summary.avg_ticket) },
    { label: 'Clientes', value: String(summary.unique_clients) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-card px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
          <p className="text-sm font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function ClientRank({
  title,
  data,
  dataKey,
}: {
  title: string;
  data: ClientRanking[];
  dataKey: 'receipt_count' | 'total_revenue';
}) {
  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">Sem dados.</p>;
  }

  const max = Math.max(...data.map((d) => d[dataKey]));

  return (
    <div className="space-y-2">
      {data.map((client) => {
        const value = client[dataKey];
        const pct = max > 0 ? (value / max) * 100 : 0;
        const label =
          dataKey === 'total_revenue'
            ? formatCurrency(value)
            : `${value} rec.`;

        return (
          <div key={client.client_name}>
            <div className="flex justify-between text-xs mb-0.5 gap-2">
              <span className="truncate text-muted-foreground">{client.client_name}</span>
              <span className="font-medium shrink-0">{label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${dataKey === 'receipt_count' ? 'bg-amber-400' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [clientFilter, setClientFilter] = useState('all');
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [topByCount, setTopByCount] = useState<ClientRanking[]>([]);
  const [topByRevenue, setTopByRevenue] = useState<ClientRanking[]>([]);
  const [trend, setTrend] = useState<RevenueTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseFilters = useMemo(() => getDateRange(preset), [preset]);
  const filters = useMemo<AnalyticsFilters>(
    () => ({
      ...baseFilters,
      client: clientFilter === 'all' ? undefined : clientFilter,
    }),
    [baseFilters, clientFilter]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, countRes, revenueRes, trendRes, clientsRes] = await Promise.all([
        fetchSummary(filters),
        fetchTopClients(filters, 'count', TOP_LIMIT),
        fetchTopClients(filters, 'revenue', TOP_LIMIT),
        fetchRevenueTrend(filters, granularity),
        fetchClientOptions(baseFilters),
      ]);
      setSummary(summaryRes.summary);
      setTopByCount(countRes.clients);
      setTopByRevenue(revenueRes.clients);
      setTrend(trendRes.trend);
      setClientOptions(clientsRes.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [filters, baseFilters, granularity]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const trendData = trend.map((point) => ({
    ...point,
    label: formatPeriodLabel(point.period, granularity),
  }));

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 border-b px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <h1 className="text-sm font-bold flex items-center gap-1.5 shrink-0">
            <BarChart3 className="h-4 w-4 text-primary" />
            Dashboard
          </h1>

          <div className="flex items-center gap-1.5 flex-1 flex-wrap min-w-0">
            <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">Último mês</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clientOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs px-2.5 h-6">Dia</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5 h-6">Sem</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2.5 h-6">Mês</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={loadDashboard} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-3 flex flex-col gap-2 overflow-hidden">
        {error && (
          <p className="text-xs text-destructive shrink-0">{error}</p>
        )}

        {loading && !summary ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : (
          summary && (
            <>
              <div className="shrink-0">
                <KpiStrip summary={summary} />
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2">
                <div className="lg:col-span-2 flex flex-col gap-2 min-h-0">
                  <Card className="flex-1 min-h-0 py-0 gap-0 flex flex-col">
                    <CardHeader className="py-2 px-3 shrink-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Faturamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 px-2 pb-2 pt-0">
                      {trendData.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Sem dados.</p>
                      ) : (
                        <ChartContainer config={revenueChartConfig} className="h-full min-h-[100px] w-full">
                          <LineChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={shortCurrency} width={44} tickLine={false} axisLine={false} />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
                              }
                            />
                            <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="flex-1 min-h-0 py-0 gap-0 flex flex-col">
                    <CardHeader className="py-2 px-3 shrink-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Recibos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 px-2 pb-2 pt-0">
                      {trendData.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Sem dados.</p>
                      ) : (
                        <ChartContainer config={countChartConfig} className="h-full min-h-[100px] w-full">
                          <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} width={28} tickLine={false} axisLine={false} allowDecimals={false} />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent formatter={(value) => `${value} rec.`} />
                              }
                            />
                            <Bar dataKey="receipt_count" fill="var(--color-receipt_count)" radius={[3, 3, 0, 0]} barSize={14} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-2 min-h-0">
                  <Card className="flex-1 min-h-0 py-0 gap-0 flex flex-col">
                    <CardHeader className="py-2 px-3 shrink-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Mais frequentes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 px-3 pb-2 pt-0 overflow-y-auto">
                      <ClientRank title="" data={topByCount} dataKey="receipt_count" />
                    </CardContent>
                  </Card>

                  <Card className="flex-1 min-h-0 py-0 gap-0 flex flex-col">
                    <CardHeader className="py-2 px-3 shrink-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Mais pagam
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 px-3 pb-2 pt-0 overflow-y-auto">
                      <ClientRank title="" data={topByRevenue} dataKey="total_revenue" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}