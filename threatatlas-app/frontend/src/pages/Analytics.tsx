import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { diagramThreatsApi, diagramMitigationsApi } from '@/lib/api';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Label } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Shield, AlertTriangle, Activity, Target, Layers, CheckCircle2 } from 'lucide-react';

export default function Analytics() {
  const [threats, setThreats] = useState<any[]>([]);
  const [mitigations, setMitigations] = useState<any[]>([]);

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

  // ====== CHART DATA ======
  const threatStatusData = useMemo(() => [
    { status: 'identified', count: threats.filter(t => t.status === 'identified').length, fill: 'var(--chart-1)' },
    { status: 'mitigated', count: threats.filter(t => t.status === 'mitigated').length, fill: 'var(--chart-2)' },
    { status: 'accepted', count: threats.filter(t => t.status === 'accepted').length, fill: 'var(--chart-3)' },
  ], [threats]);

  const mitigationStatusData = useMemo(() => {
    const data = [
      { status: 'proposed', count: mitigations.filter(m => m.status === 'proposed').length, fill: 'var(--chart-1)' },
      { status: 'implemented', count: mitigations.filter(m => m.status === 'implemented').length, fill: 'var(--chart-2)' },
      { status: 'verified', count: mitigations.filter(m => m.status === 'verified').length, fill: 'var(--chart-3)' },
    ];
    // don't render empty pie charts
    return data.some(d => d.count > 0) ? data : [];
  }, [mitigations]);

  const severityData = useMemo(() => [
    { severity: 'critical', count: threats.filter(t => t.severity === 'critical').length, fill: 'var(--chart-1)' },
    { severity: 'high', count: threats.filter(t => t.severity === 'high').length, fill: 'var(--chart-2)' },
    { severity: 'medium', count: threats.filter(t => t.severity === 'medium').length, fill: 'var(--chart-3)' },
    { severity: 'low', count: threats.filter(t => t.severity === 'low').length, fill: 'var(--chart-4)' },
  ], [threats]);

  // Derive top categories
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    threats.forEach(t => {
      const c = t.threat?.category || 'Uncategorized';
      cats[c] = (cats[c] || 0) + 1;
    });
    return Object.entries(cats)
      .map(([category, count], idx) => ({
        category,
        count,
        fill: `var(--chart-${(idx % 5) + 1})`
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5
  }, [threats]);

  // ====== CONFIGURATIONS (Mapping perfectly to index.css) ======
  const threatStatusConfig = {
    identified: { label: "Identified", color: "hsl(var(--destructive))" },
    mitigated: { label: "Mitigated", color: "hsl(var(--primary))" },
    accepted: { label: "Accepted", color: "hsl(var(--muted-foreground))" },
  } satisfies ChartConfig;

  const mitigationStatusConfig = {
    proposed: { label: "Proposed", color: "hsl(var(--chart-4))" },
    implemented: { label: "Implemented", color: "hsl(var(--chart-3))" },
    verified: { label: "Verified", color: "hsl(var(--chart-2))" },
  } satisfies ChartConfig;

  const severityConfig = {
    critical: { label: "Critical", color: "hsl(var(--destructive))" },
    high: { label: "High", color: "hsl(var(--chart-1))" },
    medium: { label: "Medium", color: "hsl(var(--chart-5))" },
    low: { label: "Low", color: "hsl(var(--chart-2))" },
  } satisfies ChartConfig;

  const categoryConfig = {
    count: { label: "Threats" }, // Base tooltip label for generic bar chart
    "chart-1": { label: "Chart 1", color: "hsl(var(--chart-1))" },
    "chart-2": { label: "Chart 2", color: "hsl(var(--chart-2))" },
    "chart-3": { label: "Chart 3", color: "hsl(var(--chart-3))" },
    "chart-4": { label: "Chart 4", color: "hsl(var(--chart-4))" },
    "chart-5": { label: "Chart 5", color: "hsl(var(--chart-5))" },
  } satisfies ChartConfig;

  return (
    <div className="flex-1 space-y-4 p-4 mx-auto">

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-slideUp" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
        <Card className="shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalThreats}</div>
            <p className="text-xs text-muted-foreground mt-1">Identified across all models</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mitigation Ratio</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mitigateRatio}%</div>
            <p className="text-xs text-muted-foreground mt-1">{mitigatedThreats} fully mitigated</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Critical Assets at Risk</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{criticalThreats}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Mitigations</CardTitle>
            <Shield className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMitigations}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of {totalMitigations} mapped controls</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 animate-slideUp" style={{ animationDelay: '160ms', animationFillMode: 'both' }}>

        {/* Severity */}
        <Card className="shadow-sm border-border/60 lg:col-span-4 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4 text-rose-500" />
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
              <Shield className="h-4 w-4 text-emerald-500" />
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
                    <Pie data={mitigationStatusData} dataKey="count" nameKey="status" innerRadius={65} outerRadius={90} strokeWidth={3} stroke="hsl(var(--background))">
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

        {/* Top Threat Categories Horizontal Bar Chart */}
        <Card className="shadow-sm border-border/60 lg:col-span-4 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4 text-blue-500" />
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

        {/* Threat Status Base */}
        <Card className="shadow-sm border-border/60 lg:col-span-3 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
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
    </div>
  );
}
