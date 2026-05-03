import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { diagramThreatsApi, diagramMitigationsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Label } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Shield, AlertTriangle, Activity, Target, Layers, CheckCircle2, Grid3x3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  const [threats, setThreats] = useState<any[]>([]);
  const [mitigations, setMitigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [threatRes, mitRes] = await Promise.all([
          diagramThreatsApi.list(),
          diagramMitigationsApi.list()
        ]);
        setThreats(threatRes.data);
        setMitigations(mitRes.data);
      } catch (error) {
        console.error("Error fetching analytics data", error);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ====== METRICS ======
  const totalThreats = threats.length;
  const mitigatedThreats = threats.filter(t => t.status === 'mitigated').length;
  const criticalThreats = threats.filter(t => t.severity === 'critical').length;
  const totalMitigations = mitigations.length;
  const activeMitigations = mitigations.filter(m => m.status === 'implemented' || m.status === 'verified').length;

  const mitigateRatio = totalThreats > 0 ? Math.round((mitigatedThreats / totalThreats) * 100) : 0;
  const activeRatio = totalMitigations > 0 ? Math.round((activeMitigations / totalMitigations) * 100) : 0;

  // ====== CHART DATA ======
  const threatStatusData = useMemo(() => [
    { status: 'identified', count: threats.filter(t => t.status === 'identified').length, fill: 'var(--destructive)' },
    { status: 'mitigated', count: threats.filter(t => t.status === 'mitigated').length, fill: 'var(--risk-low)' },
    { status: 'accepted', count: threats.filter(t => t.status === 'accepted').length, fill: 'var(--muted-foreground)' },
  ], [threats]);

  const mitigationStatusData = useMemo(() => {
    const data = [
      { status: 'proposed', count: mitigations.filter(m => m.status === 'proposed').length, fill: 'var(--chart-4)' },
      { status: 'implemented', count: mitigations.filter(m => m.status === 'implemented').length, fill: 'var(--chart-3)' },
      { status: 'verified', count: mitigations.filter(m => m.status === 'verified').length, fill: 'var(--risk-low)' },
    ];
    return data.some(d => d.count > 0) ? data : [];
  }, [mitigations]);

  const severityData = useMemo(() => [
    { severity: 'critical', count: threats.filter(t => t.severity === 'critical').length, fill: 'var(--risk-critical)' },
    { severity: 'high', count: threats.filter(t => t.severity === 'high').length, fill: 'var(--risk-high)' },
    { severity: 'medium', count: threats.filter(t => t.severity === 'medium').length, fill: 'var(--risk-medium)' },
    { severity: 'low', count: threats.filter(t => t.severity === 'low').length, fill: 'var(--risk-low)' },
  ], [threats]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    threats.forEach(t => {
      const c = t.threat?.category || 'Uncategorized';
      cats[c] = (cats[c] || 0) + 1;
    });
    return Object.entries(cats)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5)
      .map(([category, count], idx) => ({
        category,
        count,
        fill: `var(--chart-${(idx % 5) + 1})`
      }));
  }, [threats]);

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
            <p className="text-xs text-muted-foreground mt-1">Identified across all models</p>
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
            <p className="text-xs text-muted-foreground mt-1">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card className="animate-fadeInUp shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50" style={{ animationDelay: '180ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Mitigations</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--risk-low-muted)' }}>
              <Shield className="h-4 w-4" style={{ color: 'var(--risk-low)' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMitigations}</div>
            <Progress value={activeRatio} className="h-1.5 mt-2 mb-1" />
            <p className="text-xs text-muted-foreground mt-1">Out of {totalMitigations} mapped controls</p>
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

      {/* Risk Matrix */}
      <RiskMatrix threats={threats} />
    </div>
  );
}

// ── Risk Matrix (Likelihood x Impact heatmap) ──
function RiskMatrix({ threats }: { threats: any[] }) {
  const levels = [1, 2, 3, 4, 5];
  const levelLabels: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };

  const matrix = useMemo(() => {
    const m: Record<string, any[]> = {};
    threats.forEach(t => {
      if (t.likelihood != null && t.impact != null) {
        const key = `${t.likelihood}-${t.impact}`;
        if (!m[key]) m[key] = [];
        m[key].push(t);
      }
    });
    return m;
  }, [threats]);

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

  const threatsWithRisk = threats.filter(t => t.likelihood != null && t.impact != null);

  return (
    <Card className="animate-fadeInUp shadow-sm border-border/60 rounded-xl" style={{ animationDelay: '320ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Grid3x3 className="h-4 w-4 text-primary" />
          Risk Matrix
        </CardTitle>
        <CardDescription className="text-sm">
          Likelihood vs Impact heatmap ({threatsWithRisk.length} threats with risk scores)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {threatsWithRisk.length === 0 ? (
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
                        const cellThreats = matrix[key] || [];
                        const count = cellThreats.length;

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
                              {count === 0 ? (
                                <p className="text-xs text-muted-foreground">No threats</p>
                              ) : (
                                <ul className="text-xs space-y-0.5">
                                  {cellThreats.slice(0, 5).map((t: any) => (
                                    <li key={t.id} className="truncate">- {t.threat?.name}</li>
                                  ))}
                                  {count > 5 && <li className="text-muted-foreground">+{count - 5} more</li>}
                                </ul>
                              )}
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
