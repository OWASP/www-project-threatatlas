import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { analyticsApi, diagramsApi, diagramVersionsApi, type PortfolioAnalytics } from '@/lib/api';
import { toast } from 'sonner';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Label, LineChart, Line, Legend } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Shield, AlertTriangle, Activity, Target, Layers, CheckCircle2, Grid3x3, TrendingUp, TrendingDown, Package, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function AnalyticsSkeleton() {
  return (
    <div className="flex-1 space-y-4 p-4 mx-auto animate-fadeIn">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 rounded-xl border-border/60">
          <CardHeader className="pb-2 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 rounded-xl border-border/60">
          <CardHeader className="pb-2 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <Skeleton className="h-[220px] w-[220px] rounded-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<PortfolioAnalytics | null>(null);
  const [diagrams, setDiagrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Single server-side rollup for every metric; the diagram list is only
        // needed for the per-diagram trend selector below.
        const [portfolioRes, diagRes] = await Promise.all([
          analyticsApi.portfolio(),
          diagramsApi.list(),
        ]);
        setData(portfolioRes.data);
        setDiagrams(diagRes.data);
      } catch (error) {
        console.error("Error fetching analytics data", error);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ====== METRICS (all server-aggregated) ======
  const totalThreats = data?.totals.threats ?? 0;
  const criticalThreats = data?.threats_by_severity.critical ?? 0;
  const totalMitigations = data?.totals.mitigations ?? 0;
  const activeMitigations = (data?.mitigations_by_status.implemented ?? 0) + (data?.mitigations_by_status.verified ?? 0);

  const mitigateRatio = Math.round((data?.mitigation_ratio ?? 0) * 100);
  const mitigatedThreats = Math.round((data?.mitigation_ratio ?? 0) * totalThreats);
  const activeRatio = totalMitigations > 0 ? Math.round((activeMitigations / totalMitigations) * 100) : 0;
  const riskReduction = Math.round((data?.risk_reduction ?? 0) * 100);
  const unmitigatedHighCritical = data?.unmitigated_high_critical ?? 0;

  // ====== CHART DATA ======
  const threatStatusData = useMemo(() => {
    const s = data?.threats_by_status ?? {};
    return [
      { status: 'identified', count: s['identified'] ?? 0, fill: 'var(--destructive)' },
      { status: 'mitigated', count: s['mitigated'] ?? 0, fill: 'var(--risk-low)' },
      { status: 'accepted', count: s['accepted'] ?? 0, fill: 'var(--muted-foreground)' },
    ];
  }, [data]);

  const mitigationStatusData = useMemo(() => {
    const s = data?.mitigations_by_status ?? {};
    const arr = [
      { status: 'proposed', count: s['proposed'] ?? 0, fill: 'var(--chart-4)' },
      { status: 'implemented', count: s['implemented'] ?? 0, fill: 'var(--chart-3)' },
      { status: 'verified', count: s['verified'] ?? 0, fill: 'var(--risk-low)' },
    ];
    return arr.some(d => d.count > 0) ? arr : [];
  }, [data]);

  const severityData = useMemo(() => {
    const s = data?.threats_by_severity;
    return [
      { severity: 'critical', count: s?.critical ?? 0, fill: 'var(--risk-critical)' },
      { severity: 'high', count: s?.high ?? 0, fill: 'var(--risk-high)' },
      { severity: 'medium', count: s?.medium ?? 0, fill: 'var(--risk-medium)' },
      { severity: 'low', count: s?.low ?? 0, fill: 'var(--risk-low)' },
    ];
  }, [data]);

  const categoryData = useMemo(() =>
    (data?.threats_by_category ?? [])
      .slice(0, 5)
      .map((c, idx) => ({ category: c.category, count: c.count, fill: `var(--chart-${(idx % 5) + 1})` })),
    [data]
  );

  // ====== CONFIGURATIONS ======
  const threatStatusConfig = {
    identified: { label: "Identified", color: "var(--destructive)" },
    mitigated: { label: "Mitigated", color: "var(--risk-low)" },
    accepted: { label: "Accepted", color: "var(--muted-foreground)" },
  } satisfies ChartConfig;

  const mitigationStatusConfig = {
    proposed: { label: "Proposed", color: "var(--chart-4)" },
    implemented: { label: "Implemented", color: "var(--chart-3)" },
    verified: { label: "Verified", color: "var(--risk-low)" },
  } satisfies ChartConfig;

  const severityConfig = {
    critical: { label: "Critical", color: "var(--risk-critical)" },
    high: { label: "High", color: "var(--risk-high)" },
    medium: { label: "Medium", color: "var(--risk-medium)" },
    low: { label: "Low", color: "var(--risk-low)" },
  } satisfies ChartConfig;

  const categoryConfig = {
    count: { label: "Threats" },
    "chart-1": { label: "Chart 1", color: "var(--chart-1)" },
    "chart-2": { label: "Chart 2", color: "var(--chart-2)" },
    "chart-3": { label: "Chart 3", color: "var(--chart-3)" },
    "chart-4": { label: "Chart 4", color: "var(--chart-4)" },
    "chart-5": { label: "Chart 5", color: "var(--chart-5)" },
  } satisfies ChartConfig;

  if (loading) return <AnalyticsSkeleton />;

  return (
    <div className="flex-1 space-y-4 p-4 mx-auto">

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="animate-fadeInUp shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50" style={{ animationDelay: '0ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Threats</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalThreats}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {data?.totals.products ?? 0} products</p>
          </CardContent>
        </Card>

        <Card className="animate-fadeInUp shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50" style={{ animationDelay: '60ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mitigation Ratio</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mitigateRatio}%</div>
            <Progress value={mitigateRatio} className="h-1.5 mt-2 mb-1" />
            <p className="text-xs text-muted-foreground mt-1">{mitigatedThreats} fully mitigated</p>
          </CardContent>
        </Card>

        <Card className="animate-fadeInUp shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50" style={{ animationDelay: '120ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Critical Assets at Risk</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--risk-high-muted)' }}>
              <Target className="h-4 w-4" style={{ color: 'var(--risk-high)' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{criticalThreats}</div>
            <p className="text-xs text-muted-foreground mt-1">{unmitigatedHighCritical} high/critical unmitigated</p>
          </CardContent>
        </Card>

        <Card className="animate-fadeInUp shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50" style={{ animationDelay: '180ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Reduction</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--risk-low-muted)' }}>
              <TrendingDown className="h-4 w-4" style={{ color: 'var(--risk-low)' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskReduction}%</div>
            <Progress value={riskReduction} className="h-1.5 mt-2 mb-1" />
            <p className="text-xs text-muted-foreground mt-1">{activeMitigations} active controls ({activeRatio}%)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 animate-fadeInUp" style={{ animationDelay: '240ms' }}>

        {/* Severity */}
        <Card className="shadow-sm border-border/60 lg:col-span-4 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4" style={{ color: 'var(--risk-critical)' }} />
              Risk Severities
            </CardTitle>
            <CardDescription className="text-sm">Identified threats by risk tier across all models</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[280px] w-full pt-4">
              <ChartContainer config={severityConfig} className="h-full w-full">
                <BarChart data={severityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="severity" tickLine={false} axisLine={false} tickMargin={10} textAnchor="middle" tickFormatter={(val: string) => val.charAt(0).toUpperCase() + val.slice(1)} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Mitigations Pie */}
        <Card className="shadow-sm border-border/60 lg:col-span-3 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Shield className="h-4 w-4" style={{ color: 'var(--risk-low)' }} />
              Mitigation Trajectory
            </CardTitle>
            <CardDescription className="text-sm">Tracking organizational mitigation implementations</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            <div className="h-[260px] w-full flex items-center justify-center">
              {mitigationStatusData.length > 0 ? (
                <ChartContainer config={mitigationStatusConfig} className="h-full w-full pb-0 [&_.recharts-pie-label-text]:fill-foreground">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie data={mitigationStatusData} dataKey="count" nameKey="status" innerRadius={65} outerRadius={90} strokeWidth={3} stroke="var(--background)">
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                                  {totalMitigations}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-xs">
                                  Controls
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                      {mitigationStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-sm opacity-60">
                  <Shield className="h-10 w-10 mb-2 opacity-50" />
                  <p>No mitigations recorded yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Threat Categories */}
        <Card className="shadow-sm border-border/60 lg:col-span-4 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              Top Threat Taxonomies
            </CardTitle>
            <CardDescription className="text-sm">Most frequent categorizations observed system-wide</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[280px] w-full pt-4">
              <ChartContainer config={categoryConfig} className="h-full w-full">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} tickMargin={10} width={130} tickFormatter={(val) => val.length > 18 ? val.substring(0, 18) + '...' : val} />
                  <ChartTooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={40} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Threat Status */}
        <Card className="shadow-sm border-border/60 lg:col-span-3 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--risk-high)' }} />
              Resolution Posture
            </CardTitle>
            <CardDescription className="text-sm">Status mapping of all modeled threats</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[280px] w-full pt-4">
              <ChartContainer config={threatStatusConfig} className="h-full w-full">
                <BarChart data={threatStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} textAnchor="middle" tickFormatter={(val: string) => val.charAt(0).toUpperCase() + val.slice(1)} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Org-wide watchlists */}
      <div className="grid gap-4 lg:grid-cols-2 animate-fadeInUp" style={{ animationDelay: '300ms' }}>
        <TopRiskProducts products={data?.top_risk_products ?? []} />
        <StaleDiagrams diagrams={data?.stale_diagrams ?? []} />
      </div>

      {/* Risk Matrix */}
      <RiskMatrix cells={data?.risk_matrix ?? []} />

      {/* Risk Trend Over Time */}
      <RiskTrend diagrams={diagrams} />

      {/* Cross-Product Breakdown */}
      <CrossProductBreakdown products={data?.by_product ?? []} />
    </div>
  );
}

// ── Top Risk Products ─────────────────────────────────────────────────────────
function TopRiskProducts({ products }: { products: PortfolioAnalytics['top_risk_products'] }) {
  return (
    <Card className="shadow-sm border-border/60 rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Target className="h-4 w-4" style={{ color: 'var(--risk-high)' }} />
          Top Risk Products
        </CardTitle>
        <CardDescription className="text-sm">Most open high/critical threats without active mitigation</CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm opacity-60">
            <CheckCircle2 className="h-8 w-8 mb-2 opacity-50" />
            <p>No products with unmitigated high-risk threats.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.product_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium truncate" title={p.product_name}>{p.product_name}</span>
                <Badge className="h-5 px-2 text-[10px] font-bold shrink-0" style={{ backgroundColor: 'var(--risk-high)', color: '#fff' }}>
                  {p.open_high_critical} open
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Stale Diagrams ──────────────────────────────────────────────────────────────
function StaleDiagrams({ diagrams }: { diagrams: PortfolioAnalytics['stale_diagrams'] }) {
  return (
    <Card className="shadow-sm border-border/60 rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Stale Models
        </CardTitle>
        <CardDescription className="text-sm">Diagrams not updated recently — may need review</CardDescription>
      </CardHeader>
      <CardContent>
        {diagrams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm opacity-60">
            <CheckCircle2 className="h-8 w-8 mb-2 opacity-50" />
            <p>All models are up to date.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {diagrams.map(d => (
              <div key={d.diagram_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  <span className="font-medium">{d.diagram_name}</span>
                  <span className="text-muted-foreground"> · {d.product_name}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(d.last_updated), 'MMM d, yyyy')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Risk Matrix (Likelihood x Impact heatmap) ──
function RiskMatrix({ cells }: { cells: PortfolioAnalytics['risk_matrix'] }) {
  const levels = [1, 2, 3, 4, 5];
  const levelLabels: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };

  const matrix = useMemo(() => {
    const m: Record<string, number> = {};
    cells.forEach(c => { m[`${c.likelihood}-${c.impact}`] = c.count; });
    return m;
  }, [cells]);

  const totalScored = useMemo(() => cells.reduce((sum, c) => sum + c.count, 0), [cells]);

  // Returns inline style using CSS variables defined in index.css (same system as --chart-*)
  const getCellStyle = (likelihood: number, impact: number, filled: boolean): React.CSSProperties => {
    const score = likelihood * impact;
    let varName: string;
    if (score >= 20) varName = 'risk-critical';
    else if (score >= 12) varName = 'risk-high';
    else if (score >= 6) varName = 'risk-medium';
    else varName = 'risk-low';

    return filled
      ? { backgroundColor: `var(--${varName})`, color: '#fff' }
      : { backgroundColor: `var(--${varName}-muted)` };
  };

  return (
    <Card className="animate-fadeInUp shadow-sm border-border/60 rounded-xl" style={{ animationDelay: '320ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Grid3x3 className="h-4 w-4 text-primary" />
          Risk Matrix
        </CardTitle>
        <CardDescription className="text-sm">
          Likelihood vs Impact heatmap ({totalScored} threats with risk scores)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalScored === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Grid3x3 className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No threats with risk assessments yet.</p>
            <p className="text-xs mt-1">Assign likelihood and impact to threats to populate the matrix.</p>
          </div>
        ) : (
          <div className="overflow-hidden px-2">
            <div className="w-full">
              {/* Impact header */}
              <div className="flex items-end mb-1">
                <div className="w-20 shrink-0" />
                <div className="flex-1 text-center text-xs font-bold text-muted-foreground tracking-wider mb-1">
                  IMPACT
                </div>
              </div>
              <div className="flex items-center mb-1">
                <div className="w-20 shrink-0" />
                {levels.map(imp => (
                  <div key={imp} className="flex-1 text-center text-[10px] text-muted-foreground font-medium">
                    {levelLabels[imp]}
                  </div>
                ))}
              </div>

              {/* Grid rows (likelihood high → low) */}
              <div className="flex">
                <div className="w-5 shrink-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground tracking-wider -rotate-90 whitespace-nowrap">
                    LIKELIHOOD
                  </span>
                </div>
                <div className="flex flex-col gap-1 w-15 shrink-0 justify-center">
                  {[...levels].reverse().map(lik => (
                    <div key={lik} className="h-14 flex items-center justify-end pr-2">
                      <span className="text-[10px] text-muted-foreground font-medium text-right">{levelLabels[lik]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {[...levels].reverse().map(lik => (
                    <div key={lik} className="flex gap-1">
                      {levels.map(imp => {
                        const key = `${lik}-${imp}`;
                        const count = matrix[key] || 0;

                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex-1 h-14 rounded-lg flex items-center justify-center transition-all cursor-default border',
                                  count > 0
                                    ? 'hover:brightness-110 hover:shadow-md font-bold border-transparent'
                                    : 'border-border/20'
                                )}
                                style={getCellStyle(lik, imp, count > 0)}
                              >
                                {count > 0 && (
                                  <span className="text-sm font-bold">{count}</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold text-xs mb-1">
                                Likelihood: {levelLabels[lik]} / Impact: {levelLabels[imp]}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Risk score {lik * imp} · {count} threat{count !== 1 ? 's' : ''}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground">
                {[
                  { label: 'Low (1–5)', var: '--risk-low' },
                  { label: 'Medium (6–11)', var: '--risk-medium' },
                  { label: 'High (12–19)', var: '--risk-high' },
                  { label: 'Critical (20–25)', var: '--risk-critical' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: `var(${item.var})` }} />
                    <span>{item.label}</span>
                  </div>
                ))}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Risk Trend Over Time ──────────────────────────────────────────────────────
function RiskTrend({ diagrams }: { diagrams: any[] }) {
  const [selectedDiagramId, setSelectedDiagramId] = useState<number | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    if (diagrams.length > 0 && selectedDiagramId === null) {
      setSelectedDiagramId(diagrams[0].id);
    }
  }, [diagrams]);

  useEffect(() => {
    if (!selectedDiagramId) return;
    setLoadingVersions(true);
    diagramVersionsApi.list(selectedDiagramId)
      .then(res => setVersions([...res.data].reverse()))
      .catch(() => toast.error('Failed to load version history'))
      .finally(() => setLoadingVersions(false));
  }, [selectedDiagramId]);

  const trendData = useMemo(() =>
    versions.map(v => ({
      label: `v${v.version_number}`,
      date: format(new Date(v.created_at), 'MMM d'),
      threats: v.threat_count,
      mitigations: v.mitigation_count,
      risk: v.total_risk_score,
    })),
    [versions]
  );

  const trendConfig = {
    threats: { label: 'Threats', color: 'var(--destructive)' },
    mitigations: { label: 'Mitigations', color: 'var(--risk-low)' },
  } satisfies ChartConfig;

  return (
    <Card className="animate-fadeInUp shadow-sm border-border/60 rounded-xl" style={{ animationDelay: '360ms' }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Risk Trend Over Time
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Threat and mitigation counts across diagram versions
            </CardDescription>
          </div>
          <Select
            value={selectedDiagramId ? selectedDiagramId.toString() : undefined}
            onValueChange={v => setSelectedDiagramId(Number(v))}
          >
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Select diagram" />
            </SelectTrigger>
            <SelectContent>
              {diagrams.map(d => (
                <SelectItem key={d.id} value={d.id.toString()} className="text-xs">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loadingVersions ? (
          <Skeleton className="h-[260px] w-full rounded-lg" />
        ) : trendData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Not enough versions to show a trend.</p>
            <p className="text-xs mt-1">Save at least 2 diagram versions to see progress over time.</p>
          </div>
        ) : (
          <ChartContainer config={trendConfig} className="h-[260px] w-full">
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(val, i) => trendData[i]?.date ?? val}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = trendData.find(t => t.label === label);
                  return (
                    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-1">
                      <p className="font-semibold">{label} — {d?.date}</p>
                      {payload.map(p => (
                        <p key={p.dataKey} style={{ color: p.color }}>
                          {p.name}: <strong>{p.value as number}</strong>
                        </p>
                      ))}
                      {d && <p className="text-muted-foreground">Risk score: {d.risk}</p>}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line type="monotone" dataKey="threats" stroke="var(--destructive)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="mitigations" stroke="var(--risk-low)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── Cross-Product Risk Breakdown ──────────────────────────────────────────────
function CrossProductBreakdown({ products }: { products: PortfolioAnalytics['by_product'] }) {
  const chartData = products.map(p => ({
    name: p.product_name.length > 14 ? p.product_name.slice(0, 14) + '…' : p.product_name,
    fullName: p.product_name,
    critical: p.critical,
    high: p.high,
    medium: p.medium,
    low: p.low,
    unscored: p.unscored,
    total: p.threats,
    mitigations: p.mitigations,
  }));

  const barConfig = {
    critical: { label: 'Critical', color: 'var(--risk-critical)' },
    high: { label: 'High', color: 'var(--risk-high)' },
    medium: { label: 'Medium', color: 'var(--risk-medium)' },
    low: { label: 'Low', color: 'var(--risk-low)' },
    unscored: { label: 'Unscored', color: 'var(--muted-foreground)' },
  } satisfies ChartConfig;

  if (products.length === 0) return null;

  return (
    <Card className="animate-fadeInUp shadow-sm border-border/60 rounded-xl" style={{ animationDelay: '400ms' }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Package className="h-4 w-4 text-primary" />
          Cross-Product Risk Breakdown
        </CardTitle>
        <CardDescription className="text-sm">Threat severity distribution across all products</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[260px] w-full">
          <ChartContainer config={barConfig} className="h-full w-full">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = chartData.find(c => c.name === label);
                  return (
                    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-1 min-w-[150px]">
                      <p className="font-semibold">{d?.fullName ?? label}</p>
                      {payload.map(p => p.value ? (
                        <p key={p.dataKey} style={{ color: p.color ?? p.fill }}>
                          {p.name}: <strong>{p.value as number}</strong>
                        </p>
                      ) : null)}
                      <p className="text-muted-foreground border-t pt-1 mt-1">Total: {d?.total}</p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="critical" stackId="s" fill="var(--risk-critical)" radius={[0, 0, 0, 0]} maxBarSize={48} />
              <Bar dataKey="high" stackId="s" fill="var(--risk-high)" maxBarSize={48} />
              <Bar dataKey="medium" stackId="s" fill="var(--risk-medium)" maxBarSize={48} />
              <Bar dataKey="low" stackId="s" fill="var(--risk-low)" maxBarSize={48} />
              <Bar dataKey="unscored" stackId="s" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Per-product stats table */}
        <div className="space-y-2">
          {chartData.map(p => {
            const mitRatio = p.total > 0 ? Math.round((p.mitigations / p.total) * 100) : 0;
            return (
              <div key={p.fullName} className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0 font-medium truncate" title={p.fullName}>{p.fullName}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {p.critical > 0 && <Badge className="h-4 px-1.5 text-[9px] font-bold" style={{ backgroundColor: 'var(--risk-critical)', color: '#fff' }}>{p.critical}C</Badge>}
                  {p.high > 0 && <Badge className="h-4 px-1.5 text-[9px] font-bold" style={{ backgroundColor: 'var(--risk-high)', color: '#fff' }}>{p.high}H</Badge>}
                  {p.medium > 0 && <Badge className="h-4 px-1.5 text-[9px] font-bold" style={{ backgroundColor: 'var(--risk-medium)', color: '#fff' }}>{p.medium}M</Badge>}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <Progress value={mitRatio} className="h-1.5 flex-1" />
                  <span className="text-muted-foreground whitespace-nowrap w-10 text-right">{mitRatio}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
