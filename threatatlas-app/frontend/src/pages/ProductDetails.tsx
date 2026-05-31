import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { productsApi, diagramsApi, diagramThreatsApi, diagramMitigationsApi, modelsApi, frameworksApi, triggerDownload, jiraApi } from '@/lib/api';
import { API_BASE_URL } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Label as RechartsLabel } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Grid3x3,
  AlertTriangle,
  Shield,
  Calendar,
  ExternalLink,
  Layers,
  Plus,
  Check,
  Loader2,
  MessageSquare,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText as FileReport,
  FileCode,
  Package,
  Activity,
  BarChart3,
  Upload,
  Clock,
  ShieldCheck,
  ShieldOff,
  FilePlus,
  FileX,
  GitCommit,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { getStatusClasses } from '@/lib/risk';
import ThreatDetailsSheet from '@/components/ThreatDetailsSheet';
import ThreatCard from '@/components/ThreatCard';
import { ImportDrawioButton } from '@/components/ImportDrawioButton';
import AuditTerminal from '@/components/AuditTerminal';

interface Product {
  id: number;
  name: string;
  description: string | null;
  status: 'design' | 'development' | 'testing' | 'deployment' | 'production' | null;
  repository_url: string | null;
  confluence_url: string | null;
  application_url: string | null;
  business_area: string | null;
  owner_name: string | null;
  owner_email: string | null;
  jira_project_key: string | null;
  created_at: string;
  updated_at: string;
}

interface Diagram {
  id: number;
  product_id: number;
  name: string;
  created_at: string;
}

interface DiagramThreat {
  id: number;
  diagram_id: number;
  model_id: number;
  threat_id: number;
  element_id: string;
  element_type: string;
  status: string;
  comments: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  likelihood: number | null;
  impact: number | null;
  risk_score: number | null;
  threat: {
    id: number;
    name: string;
    description: string;
    category: string;
    framework_id: number;
  };
}

interface DiagramMitigation {
  id: number;
  diagram_id: number;
  model_id: number;
  mitigation_id: number;
  element_id: string;
  element_type: string;
  threat_id: number | null;
  status: string;
  comments: string;
  mitigation: {
    id: number;
    name: string;
    description: string;
    category: string;
  };
}

// ── Product Analytics Charts ──
function ProductAnalytics({ threats, mitigations }: { threats: DiagramThreat[]; mitigations: DiagramMitigation[] }) {
  const severityData = useMemo(() => [
    { severity: 'Critical', count: threats.filter(t => t.severity === 'critical').length, fill: 'var(--chart-1)' },
    { severity: 'High', count: threats.filter(t => t.severity === 'high').length, fill: 'var(--chart-5)' },
    { severity: 'Medium', count: threats.filter(t => t.severity === 'medium').length, fill: 'var(--chart-3)' },
    { severity: 'Low', count: threats.filter(t => t.severity === 'low').length, fill: 'var(--chart-2)' },
  ], [threats]);

  const threatStatusData = useMemo(() => [
    { status: 'Identified', count: threats.filter(t => t.status === 'identified').length, fill: 'var(--chart-1)' },
    { status: 'Mitigated', count: threats.filter(t => t.status === 'mitigated').length, fill: 'var(--chart-2)' },
    { status: 'Accepted', count: threats.filter(t => t.status === 'accepted').length, fill: 'var(--chart-3)' },
  ], [threats]);

  const mitigationStatusData = useMemo(() => {
    const data = [
      { status: 'Proposed', count: mitigations.filter(m => m.status === 'proposed').length, fill: 'var(--chart-1)' },
      { status: 'Implemented', count: mitigations.filter(m => m.status === 'implemented').length, fill: 'var(--chart-2)' },
      { status: 'Verified', count: mitigations.filter(m => m.status === 'verified').length, fill: 'var(--chart-3)' },
    ];
    return data.some(d => d.count > 0) ? data : [];
  }, [mitigations]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    threats.forEach(t => {
      const c = t.threat?.category || 'Uncategorized';
      cats[c] = (cats[c] || 0) + 1;
    });
    return Object.entries(cats)
      .map(([category, count], idx) => ({ category, count, fill: `var(--chart-${(idx % 5) + 1})` }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [threats]);

  const severityConfig = {
    Critical: { label: "Critical", color: "var(--risk-critical)" },
    High: { label: "High", color: "var(--risk-high)" },
    Medium: { label: "Medium", color: "var(--risk-medium)" },
    Low: { label: "Low", color: "var(--risk-low)" },
  } satisfies ChartConfig;

  const threatStatusConfig = {
    Identified: { label: "Identified", color: "var(--destructive)" },
    Mitigated: { label: "Mitigated", color: "var(--risk-low)" },
    Accepted: { label: "Accepted", color: "var(--muted-foreground)" },
  } satisfies ChartConfig;

  const mitigationStatusConfig = {
    Proposed: { label: "Proposed", color: "var(--chart-1)" },
    Implemented: { label: "Implemented", color: "var(--chart-2)" },
    Verified: { label: "Verified", color: "var(--risk-low)" },
  } satisfies ChartConfig;

  const categoryConfig = {
    count: { label: "Threats" },
    ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`chart-${i + 1}`, { label: `Chart ${i + 1}`, color: `var(--chart-${i + 1})` }])),
  } satisfies ChartConfig;

  const totalMitigations = mitigations.length;

  if (threats.length === 0 && mitigations.length === 0) {
    return (
      <Card className="border-dashed border-2 rounded-xl">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-3">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1.5">No data yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Analytics will appear once threats and mitigations are added to this product's diagrams.
          </p>
        </CardContent>
      </Card>
    );
  }

  const levelLabels: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };
  const levels = [1, 2, 3, 4, 5];

  const riskMatrix = useMemo(() => {
    const m: Record<string, DiagramThreat[]> = {};
    threats.forEach(t => {
      if (t.likelihood != null && t.impact != null) {
        const key = `${t.likelihood}-${t.impact}`;
        if (!m[key]) m[key] = [];
        m[key].push(t);
      }
    });
    return m;
  }, [threats]);

  const getCellStyle = (lik: number, imp: number, filled: boolean) => {
    const score = lik * imp;
    let v: string;
    if (score >= 20) v = 'risk-critical';
    else if (score >= 12) v = 'risk-high';
    else if (score >= 6) v = 'risk-medium';
    else v = 'risk-low';
    return filled
      ? { backgroundColor: `var(--${v})`, color: '#fff' }
      : { backgroundColor: `var(--${v}-muted)` };
  };

  const threatsWithRisk = threats.filter(t => t.likelihood != null && t.impact != null);

  return (
    <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      {/* Severity Distribution */}
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4" style={{ color: 'var(--risk-critical)' }} />
            Risk Severity
          </CardTitle>
          <CardDescription className="text-xs">Threats by severity level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ChartContainer config={severityConfig} className="h-full w-full">
              <BarChart data={severityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="severity" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Threat Status Pie */}
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" style={{ color: 'var(--risk-high)' }} />
            Threat Status
          </CardTitle>
          <CardDescription className="text-xs">Resolution status of all threats</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <div className="h-[220px] w-full">
            <ChartContainer config={threatStatusConfig} className="h-full w-full [&_.recharts-pie-label-text]:fill-foreground">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={threatStatusData} dataKey="count" nameKey="status" innerRadius={55} outerRadius={80} strokeWidth={3} stroke="var(--background)">
                  <RechartsLabel
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                              {threats.length}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                              Threats
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                  {threatStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Mitigation Status Pie */}
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4" style={{ color: 'var(--risk-low)' }} />
            Mitigation Status
          </CardTitle>
          <CardDescription className="text-xs">Implementation progress of controls</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <div className="h-[220px] w-full">
            {mitigationStatusData.length > 0 ? (
              <ChartContainer config={mitigationStatusConfig} className="h-full w-full [&_.recharts-pie-label-text]:fill-foreground">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie data={mitigationStatusData} dataKey="count" nameKey="status" innerRadius={55} outerRadius={80} strokeWidth={3} stroke="var(--background)">
                    <RechartsLabel
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                                {totalMitigations}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                                Controls
                              </tspan>
                            </text>
                          );
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
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <Shield className="h-8 w-8 mb-2 opacity-50" />
                <p>No mitigations yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Threat Categories */}
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-primary" />
            Threat Categories
          </CardTitle>
          <CardDescription className="text-xs">Most frequent threat categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            {categoryData.length > 0 ? (
              <ChartContainer config={categoryConfig} className="h-full w-full">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} tickMargin={8} width={110} tickFormatter={(val) => val.length > 14 ? val.substring(0, 14) + '...' : val} />
                  <ChartTooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={30} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <Layers className="h-8 w-8 mb-2 opacity-50" />
                <p>No categories yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Risk Matrix */}
    <Card className="rounded-xl border-border/60 shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Grid3x3 className="h-4 w-4 text-primary" />
          Risk Matrix
        </CardTitle>
        <CardDescription className="text-xs">
          Likelihood vs Impact heatmap ({threatsWithRisk.length} threats with risk scores)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {threatsWithRisk.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Grid3x3 className="h-7 w-7 mb-2 opacity-50" />
            <p className="text-sm">No threats with risk assessments yet.</p>
            <p className="text-xs mt-1">Assign likelihood and impact to threats to populate the matrix.</p>
          </div>
        ) : (
          <div className="overflow-hidden px-2">
            <div className="w-full">
              <div className="flex items-end mb-1">
                <div className="w-20 shrink-0" />
                <div className="flex-1 text-center text-[10px] font-bold text-muted-foreground tracking-wider mb-1">IMPACT</div>
              </div>
              <div className="flex items-center mb-1">
                <div className="w-20 shrink-0" />
                {levels.map(imp => (
                  <div key={imp} className="flex-1 text-center text-[10px] text-muted-foreground font-medium">{levelLabels[imp]}</div>
                ))}
              </div>
              <div className="flex">
                <div className="w-5 shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wider -rotate-90 whitespace-nowrap">LIKELIHOOD</span>
                </div>
                <div className="flex flex-col gap-1 w-15 shrink-0 justify-center">
                  {[...levels].reverse().map(lik => (
                    <div key={lik} className="h-12 flex items-center justify-end pr-2">
                      <span className="text-[10px] text-muted-foreground font-medium text-right">{levelLabels[lik]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {[...levels].reverse().map(lik => (
                    <div key={lik} className="flex gap-1">
                      {levels.map(imp => {
                        const key = `${lik}-${imp}`;
                        const cellThreats = riskMatrix[key] || [];
                        const count = cellThreats.length;
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex-1 h-12 rounded-lg flex items-center justify-center transition-all cursor-default border',
                                  count > 0 ? 'hover:brightness-110 hover:shadow-md font-bold border-transparent' : 'border-border/20'
                                )}
                                style={getCellStyle(lik, imp, count > 0)}
                              >
                                {count > 0 && <span className="text-sm font-bold">{count}</span>}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold text-xs mb-1">Likelihood: {levelLabels[lik]} / Impact: {levelLabels[imp]}</p>
                              {count === 0 ? (
                                <p className="text-xs text-muted-foreground">No threats</p>
                              ) : (
                                <ul className="text-xs space-y-0.5">
                                  {cellThreats.slice(0, 5).map((t) => (
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
              <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
                {[
                  { label: 'Low (1–5)', v: '--risk-low' },
                  { label: 'Medium (6–11)', v: '--risk-medium' },
                  { label: 'High (12–19)', v: '--risk-high' },
                  { label: 'Critical (20–25)', v: '--risk-critical' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: `var(${item.v})` }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

function ProductDetailsSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 animate-fadeIn">
      {/* Back button */}
      <Skeleton className="h-9 w-40 rounded-lg" />

      {/* Product info card */}
      <Card className="rounded-xl border-border/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-4 w-64" />
        </CardFooter>
      </Card>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-xl border-border/60">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Diagrams */}
      <Card className="rounded-xl border-border/60">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((i) => (
              <Card key={i} className="rounded-xl border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Threats */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        {[1, 2].map((i) => (
          <Card key={i} className="rounded-xl border-border/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Mitigations Tab ──────────────────────────────────────────────────────────
function MitigationsTab({
  mitigations,
  diagrams,
  threats,
}: {
  mitigations: DiagramMitigation[];
  diagrams: Diagram[];
  threats: DiagramThreat[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return mitigations;
    return mitigations.filter(m => m.status === statusFilter);
  }, [mitigations, statusFilter]);

  const getDiagramName = (diagramId: number) =>
    diagrams.find(d => d.id === diagramId)?.name ?? 'Unknown';

  const getLinkedThreat = (threatId: number | null) => {
    if (threatId == null) return null;
    return threats.find(t => t.id === threatId) ?? null;
  };

  if (mitigations.length === 0) {
    return (
      <Card className="border-dashed border-2 rounded-xl">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-3"
            style={{ backgroundColor: 'var(--risk-low-muted)' }}
          >
            <Shield className="h-8 w-8" style={{ color: 'var(--risk-low)' }} />
          </div>
          <h3 className="text-lg font-medium mb-1.5">No mitigations yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
            Mitigations are added from within diagram threat models.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter strip */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filter</p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="proposed">Proposed</SelectItem>
            <SelectItem value="implemented">Implemented</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} of {mitigations.length}</span>
      </div>

      {/* Table */}
      <Card className="rounded-xl border-border/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Mitigation
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Category
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Element
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Diagram
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Linked Threat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((m) => {
                const linkedThreat = getLinkedThreat(m.threat_id);
                return (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Shield
                          className="h-3.5 w-3.5 shrink-0"
                          style={{
                            color: m.status === 'verified'
                              ? 'var(--risk-low)'
                              : m.status === 'implemented'
                              ? 'var(--matcha-300)'
                              : 'var(--muted-foreground)',
                          }}
                        />
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {m.mitigation.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{m.mitigation.category || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px] block">
                        {m.element_id || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground truncate max-w-[140px] block">
                        {getDiagramName(m.diagram_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5 py-0 capitalize', getStatusClasses(m.status))}
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {linkedThreat ? (
                        <span className="text-xs text-muted-foreground truncate max-w-[160px] block">
                          {linkedThreat.threat.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function ProductDetails() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [threats, setThreats] = useState<DiagramThreat[]>([]);
  const [mitigations, setMitigations] = useState<DiagramMitigation[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraGlobalProjectKey, setJiraGlobalProjectKey] = useState<string | null>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // New Diagram dialog state
  const [newDiagramOpen, setNewDiagramOpen] = useState(false);
  const [newDiagramMode, setNewDiagramMode] = useState<'choose' | 'blank'>('choose');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newDiagramStep, setNewDiagramStep] = useState(1);
  const [newDiagramName, setNewDiagramName] = useState('New Diagram');
  const [newDiagramNameError, setNewDiagramNameError] = useState('');
  const [newDiagramFrameworks, setNewDiagramFrameworks] = useState<number[]>([]);
  const [newDiagramFrameworkError, setNewDiagramFrameworkError] = useState('');
  const [newDiagramSubmitting, setNewDiagramSubmitting] = useState(false);

  useEffect(() => {
    if (productId) {
      loadProductData(true);
    }
    // Check JIRA configuration once on mount — capture global default project key too
    jiraApi.get()
      .then(r => {
        setJiraConfigured(r.data.configured === true);
        setJiraGlobalProjectKey(r.data.jira_project_key || null);
      })
      .catch(() => setJiraConfigured(false));
  }, [productId]);

  const loadProductData = async (showLoading = false) => {
    if (!productId) return;

    try {
      if (showLoading) setLoading(true);
      const [productRes, diagramsRes] = await Promise.all([
        productsApi.get(parseInt(productId)),
        diagramsApi.list({ product_id: parseInt(productId) }),
      ]);

      setProduct(productRes.data);
      setDiagrams(diagramsRes.data);

      const diagramIds = diagramsRes.data.map((d: Diagram) => d.id);

      let freshMitigations: DiagramMitigation[] = [];

      if (diagramIds.length > 0) {
        const [threatsRes, mitigationsRes, modelsRes, frameworksRes] = await Promise.all([
          Promise.all(diagramIds.map((id: number) => diagramThreatsApi.list({ diagram_id: id }))),
          Promise.all(diagramIds.map((id: number) => diagramMitigationsApi.list({ diagram_id: id }))),
          Promise.all(diagramIds.map((id: number) => modelsApi.listByDiagram(id))),
          frameworksApi.list(),
        ]);

        freshMitigations = mitigationsRes.flatMap(res => res.data);

        setThreats(threatsRes.flatMap(res => res.data));
        setMitigations(freshMitigations);
        setModels(modelsRes.flatMap(res => res.data));
        setFrameworks(frameworksRes.data);
      } else {
        const frameworksRes = await frameworksApi.list();
        setFrameworks(frameworksRes.data);
      }

      // Keep selectedItem in sync so the sheet reflects fresh mitigations without closing
      setSelectedItem((prev: any) => {
        if (!prev) return null;
        const linkedMits = freshMitigations.filter((m: DiagramMitigation) => m.threat_id === prev.id);
        return { ...prev, linkedMitigations: linkedMits };
      });
    } catch (error) {
      console.error('Error loading product data:', error);
      toast.error('Failed to load product data');
    } finally {
      setLoading(false);
    }
  };

  const getDiagramName = (diagramId: number) => {
    return diagrams.find(d => d.id === diagramId)?.name || 'Unknown Diagram';
  };

  const getModelInfo = (threat: DiagramThreat) => {
    const model = models.find(m => m.id === threat.model_id);
    if (model) {
      return { modelName: model.name, frameworkName: model.framework_name };
    }
    const framework = frameworks.find(f => f.id === threat.threat.framework_id);
    return { modelName: null, frameworkName: framework?.name || 'Unknown' };
  };

  const navigateToDiagram = (item: any) => {
    const diagramId = item?.diagram_id ?? item;
    navigate(`/diagrams?product=${productId}&diagram=${diagramId}`);
  };

  const handleOpenThreat = (threat: DiagramThreat) => {
    const linkedMits = mitigations.filter(m => m.threat_id === threat.id);
    setSelectedItem({ ...threat, linkedMitigations: linkedMits });
    setSheetOpen(true);
  };

  const handleUpdateItem = async (comments: string) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, comments } : null);
      await diagramThreatsApi.update(selectedItem.id, { comments });
      await loadProductData();
      toast.success('Comments updated');
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Failed to update comments');
    }
  };

  const handleUpdateStatus = async (status: string, acceptanceData?: { justification: string; approver_id?: number; review_date?: string }) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, status } : null);
      await diagramThreatsApi.update(selectedItem.id, {
        status,
        ...(acceptanceData ? {
          acceptance_justification: acceptanceData.justification,
          acceptance_approver_id: acceptanceData.approver_id ?? null,
          acceptance_review_date: acceptanceData.review_date ?? null,
        } : {}),
      });
      await loadProductData();
      toast.success(status === 'accepted' ? 'Risk acceptance submitted' : status === 'mitigated' ? 'Threat marked as mitigated' : 'Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleUpdateRisk = async (threatId: number, data: { likelihood?: number; impact?: number }) => {
    try {
      setSelectedItem((prev: any) => prev && prev.id === threatId ? { ...prev, ...data } : prev);
      await diagramThreatsApi.update(threatId, data);
      await loadProductData();
    } catch (error) {
      console.error('Error updating risk:', error);
      toast.error('Failed to update risk assessment');
    }
  };

  // Inline status update from ThreatCard expanded view
  const handleInlineThreatStatusUpdate = async (threat: DiagramThreat, status: string) => {
    try {
      await diagramThreatsApi.update(threat.id, { status });
      await loadProductData();
      toast.success(status === 'accepted' ? 'Risk acceptance submitted' : status === 'mitigated' ? 'Threat marked as mitigated' : 'Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getMitigationsForThreat = (threat: DiagramThreat) => {
    return mitigations.filter(m => m.threat_id === threat.id);
  };

  const openNewDiagramDialog = () => {
    setNewDiagramMode('choose');
    setNewDiagramStep(1);
    setNewDiagramName('New Diagram');
    setNewDiagramNameError('');
    setNewDiagramFrameworks([]);
    setNewDiagramFrameworkError('');
    setNewDiagramSubmitting(false);
    setNewDiagramOpen(true);
  };

  const handleNewDiagramNext = () => {
    if (!newDiagramName.trim()) {
      setNewDiagramNameError('Diagram name is required.');
      return;
    }
    setNewDiagramNameError('');
    setNewDiagramStep(2);
  };

  const toggleNewDiagramFramework = (id: number) => {
    setNewDiagramFrameworkError('');
    setNewDiagramFrameworks(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleNewDiagramSubmit = async () => {
    if (newDiagramFrameworks.length === 0) {
      setNewDiagramFrameworkError('Select at least one framework.');
      return;
    }
    if (!productId) return;
    setNewDiagramSubmitting(true);
    try {
      const diagramRes = await diagramsApi.create({
        product_id: parseInt(productId),
        name: newDiagramName.trim(),
        diagram_data: { nodes: [], edges: [] },
      });
      const diagramId: number = diagramRes.data.id;
      await Promise.all(
        newDiagramFrameworks.map(fwId => {
          const fw = frameworks.find((f: any) => f.id === fwId);
          return modelsApi.create({
            diagram_id: diagramId,
            framework_id: fwId,
            name: fw ? `${fw.name} Analysis` : 'Analysis',
          });
        })
      );
      setNewDiagramOpen(false);
      toast.success('Diagram created');
      navigate(`/diagrams?product=${productId}&diagram=${diagramId}`);
    } catch (err) {
      console.error('Error creating diagram:', err);
      toast.error('Failed to create diagram');
    } finally {
      setNewDiagramSubmitting(false);
    }
  };

  // Stats
  const criticalThreats = threats.filter(t => t.severity === 'critical').length;
  const highThreats = threats.filter(t => t.severity === 'high').length;
  const mitigatedThreats = threats.filter(t => t.status === 'mitigated').length;
  const coveragePercent = threats.length > 0 ? Math.round((mitigatedThreats / threats.length) * 100) : 0;
  const implementedMitigations = mitigations.filter(m => m.status === 'implemented' || m.status === 'verified').length;

  if (loading) return <ProductDetailsSkeleton />;

  if (!product) {
    return (
      <div className="flex-1 space-y-6 p-4">
        <Card className="border-dashed border-2 rounded-xl">
          <CardContent className="flex flex-col items-center justify-center p-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/40 mb-4 shadow-xs">
              <Box className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium mb-2">Product not found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              The requested product could not be found.
            </p>
            <Button onClick={() => navigate('/products')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 mx-auto">
      {/* ── Top navigation bar ── */}
      <div className="flex items-center justify-between animate-fadeIn">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/products')}
          className="-ml-2 hover:bg-muted/70 rounded-lg cursor-pointer transition-colors h-9"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shadow-xs h-9">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Export this product</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/diagrams`)}
            >
              <FileJson className="mr-2 h-4 w-4" />
              Diagrams (JSON)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/threats-mitigations`)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Threats & Mitigations (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/report`)}
            >
              <FileReport className="mr-2 h-4 w-4" />
              Full report (HTML)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/report.md`)}
            >
              <FileCode className="mr-2 h-4 w-4" />
              Threat model report (Markdown)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/report.docx`)}
            >
              <FileReport className="mr-2 h-4 w-4" />
              Full report (Word .docx)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/bundle`)}
            >
              <Package className="mr-2 h-4 w-4" />
              All files (ZIP bundle)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Product info card (compact) ── */}
      <Card className="rounded-xl border-border/60 shadow-xs animate-fadeInUp" style={{ animationDelay: '50ms' }}>
        <CardHeader className="py-3">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-xs shrink-0">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold tracking-tight">{product.name}</CardTitle>
              {product.description && (
                <CardDescription className="mt-0.5 text-sm leading-relaxed line-clamp-2">
                  {product.description}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>

        {!product.description && (
          <CardContent className="pt-0 pb-3">
            <Empty className="border rounded-xl py-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Box className="h-4 w-4 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>No description</EmptyTitle>
                <EmptyDescription>Edit this product to add a description.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        )}

        {(product.status ||
          product.business_area ||
          product.owner_name ||
          product.owner_email ||
          product.repository_url ||
          product.confluence_url ||
          product.application_url ||
          product.jira_project_key) && (
          <CardContent className="pt-0 pb-3">
            <div className="p-3 border border-border/60 rounded-lg bg-muted/20 space-y-2 text-sm">
              {product.status && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0">Status</span>
                  <Badge
                    variant="outline"
                    className={`capitalize font-semibold ${
                      product.status === 'design' ? 'border-sky-500/50 text-sky-700 dark:text-sky-300 bg-sky-500/10' :
                      product.status === 'development' ? 'border-indigo-500/50 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10' :
                      product.status === 'testing' ? 'border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10' :
                      product.status === 'deployment' ? 'border-purple-500/50 text-purple-700 dark:text-purple-300 bg-purple-500/10' :
                      'border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                    }`}
                  >
                    {product.status}
                  </Badge>
                </div>
              )}
              {product.business_area && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Business area</span>
                  <span>{product.business_area}</span>
                </div>
              )}
              {(product.owner_name || product.owner_email) && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Owner</span>
                  <span>
                    {product.owner_name}
                    {product.owner_name && product.owner_email && ' · '}
                    {product.owner_email && (
                      <a href={`mailto:${product.owner_email}`} className="text-primary hover:underline">
                        {product.owner_email}
                      </a>
                    )}
                  </span>
                </div>
              )}
              {product.repository_url && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Repository</span>
                  <a href={product.repository_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {product.repository_url}
                  </a>
                </div>
              )}
              {product.confluence_url && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Confluence</span>
                  <a href={product.confluence_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {product.confluence_url}
                  </a>
                </div>
              )}
              {product.application_url && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Application</span>
                  <a href={product.application_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {product.application_url}
                  </a>
                </div>
              )}
              {product.jira_project_key && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Jira Project</span>
                  <Badge variant="outline" className="font-mono text-xs">{product.jira_project_key}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        )}

        <CardFooter className="border-t flex items-center justify-end py-2 px-4 mt-auto">
          <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-medium">
                Created {new Date(product.created_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-medium">
                Updated {new Date(product.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* ── KPI stat strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fadeInUp" style={{ animationDelay: '80ms' }}>
        <Card className="rounded-xl border-border/60 shadow-xs hover:shadow-md transition-all group py-0">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Threats</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--risk-high-muted)' }}>
                <AlertTriangle className="h-4 w-4" style={{ color: 'var(--risk-high)' }} />
              </div>
            </div>
            <p className="text-2xl font-bold">{threats.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {criticalThreats + highThreats > 0 ? (
                <span className="font-medium" style={{ color: 'var(--risk-high)' }}>{criticalThreats + highThreats} critical/high</span>
              ) : (
                'No high-risk threats'
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 shadow-xs hover:shadow-md transition-all group py-0">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Critical</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--risk-critical-muted)' }}>
                <AlertTriangle className="h-4 w-4" style={{ color: 'var(--risk-critical)' }} />
              </div>
            </div>
            <p className="text-2xl font-bold">{criticalThreats}</p>
            <p className="text-xs text-muted-foreground mt-1">Require immediate action</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 shadow-xs hover:shadow-md transition-all group py-0">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mitigation Ratio</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                <Layers className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold">{coveragePercent}%</p>
            <Progress value={coveragePercent} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 shadow-xs hover:shadow-md transition-all group py-0">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Mitigations</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--risk-low-muted)' }}>
                <Shield className="h-4 w-4" style={{ color: 'var(--risk-low)' }} />
              </div>
            </div>
            <p className="text-2xl font-bold">{implementedMitigations}</p>
            <p className="text-xs text-muted-foreground mt-1">{mitigations.length} total controls</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Hub navigation + tab content ── */}
      <Tabs defaultValue="overview" className="animate-fadeInUp" style={{ animationDelay: '120ms' }}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <Grid3x3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="threats" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Threats {threats.length > 0 && <span className="ml-0.5 text-[10px] opacity-70">({threats.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="mitigations" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Mitigations {mitigations.length > 0 && <span className="ml-0.5 text-[10px] opacity-70">({mitigations.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab: diagrams only ── */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          <Card className="rounded-xl border-border/60 shadow-xs">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Grid3x3 className="h-5 w-5 text-primary" />
                    Diagrams ({diagrams.length})
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Data flow diagrams for this product
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-9" onClick={openNewDiagramDialog}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    New Diagram
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {diagrams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed rounded-xl">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-3">
                    <Grid3x3 className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">No diagrams yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create your first diagram to start threat modeling</p>
                  <Button size="sm" variant="outline" className="h-8" onClick={openNewDiagramDialog}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create Diagram
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {diagrams.map((diagram) => {
                    const diagramThreats = threats.filter(t => t.diagram_id === diagram.id);
                    const diagramMitigations = mitigations.filter(m => m.diagram_id === diagram.id);
                    const diagramModels = models.filter(m => m.diagram_id === diagram.id);

                    return (
                      <Card
                        key={diagram.id}
                        className="hover:shadow-lg hover:border-primary/30 transition-all duration-300 rounded-xl cursor-pointer group"
                        onClick={() => navigateToDiagram(diagram.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-xs group-hover:shadow-md transition-all">
                              <Grid3x3 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm mb-1.5 truncate flex items-center gap-2">
                                {diagram.name}
                                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </h4>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1">
                                      <Layers className="h-3 w-3 text-primary" />
                                      {diagramModels.length}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{diagramModels.length} {diagramModels.length === 1 ? 'model' : 'models'}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" style={{ color: 'var(--risk-high)' }} />
                                      {diagramThreats.length}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{diagramThreats.length} threats</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1">
                                      <Shield className="h-3 w-3" style={{ color: 'var(--risk-low)' }} />
                                      {diagramMitigations.length}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{diagramMitigations.length} mitigations</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Threats Tab ── */}
        <TabsContent value="threats" className="space-y-3 mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--risk-high)' }} />
              Threats ({threats.length})
            </h2>
          </div>

          {threats.length === 0 ? (
            <Card className="border-dashed border-2 rounded-xl">
              <CardContent className="flex flex-col items-center justify-center p-12">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl mb-3 shadow-xs"
                  style={{ backgroundColor: 'var(--risk-high-muted)' }}
                >
                  <AlertTriangle className="h-8 w-8" style={{ color: 'var(--risk-high)' }} />
                </div>
                <h3 className="text-lg font-medium mb-1.5">No threats found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                  Start by creating diagrams and attaching threats to elements.
                </p>
              </CardContent>
            </Card>
          ) : (
            threats.map((threat, index) => {
              const linkedMitigations = getMitigationsForThreat(threat);
              const { modelName, frameworkName } = getModelInfo(threat);

              return (
                <ThreatCard
                  key={threat.id}
                  threat={threat}
                  linkedMitigations={linkedMitigations}
                  index={index}
                  repoUrl={product.repository_url}
                  jiraConfigured={jiraConfigured}
                  jiraProjectKey={product.jira_project_key ?? jiraGlobalProjectKey}
                  onOpen={() => handleOpenThreat(threat)}
                  onNavigateToDiagram={() => navigateToDiagram(threat)}
                  onUpdateStatus={(status) => handleInlineThreatStatusUpdate(threat, status)}
                  contextItems={[
                    { icon: <Grid3x3 className="h-3 w-3" />, label: getDiagramName(threat.diagram_id) },
                    ...(modelName ? [{ icon: <Layers className="h-3 w-3" />, label: modelName }] : []),
                    { icon: <Layers className="h-3 w-3" />, label: frameworkName },
                  ]}
                />
              );
            })
          )}
        </TabsContent>

        {/* ── Mitigations Tab ── */}
        <TabsContent value="mitigations" className="mt-0">
          <MitigationsTab
            mitigations={mitigations}
            diagrams={diagrams}
            threats={threats}
          />
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics" className="mt-0">
          <ProductAnalytics threats={threats} mitigations={mitigations} />
        </TabsContent>

        {/* ── Audit Log Tab ── */}
      </Tabs>

      {/* Threat Details Sheet */}
      <ThreatDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedItem={selectedItem}
        itemType="threat"
        productId={product?.id}
        onUpdateStatus={handleUpdateStatus}
        onUpdateNotes={handleUpdateItem}
        onNavigateToDiagram={navigateToDiagram}
        onUpdateRisk={handleUpdateRisk}
        onMitigationsChange={loadProductData}
      />

      {/* New Diagram Dialog */}
      <Dialog open={newDiagramOpen} onOpenChange={setNewDiagramOpen}>
        <DialogContent className="sm:max-w-[480px]">

          {/* ── Choose mode ── */}
          {newDiagramMode === 'choose' && (
            <>
              <DialogHeader>
                <DialogTitle>New Diagram</DialogTitle>
                <DialogDescription>Start with a blank canvas or import an existing Draw.io file.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 py-2">
                <button
                  onClick={() => setNewDiagramMode('blank')}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-border/60 bg-muted/30 p-6 hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Grid3x3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-center">Blank Canvas</p>
                    <p className="text-xs text-muted-foreground text-center mt-0.5">Start from scratch</p>
                  </div>
                </button>

                <button
                  onClick={() => { setNewDiagramOpen(false); setImportDialogOpen(true); }}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-border/60 bg-muted/30 p-6 hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-center">Import Draw.io</p>
                    <p className="text-xs text-muted-foreground text-center mt-0.5">.drawio or .xml file</p>
                  </div>
                </button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setNewDiagramOpen(false)}>Cancel</Button>
              </DialogFooter>
            </>
          )}

          {/* ── Blank mode: existing name + framework steps ── */}
          {newDiagramMode === 'blank' && (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-1 mb-1">
                {['Diagram', 'Framework'].map((label, i) => {
                  const num = i + 1;
                  const done = newDiagramStep > num;
                  const current = newDiagramStep === num;
                  return (
                    <div key={label} className="flex items-center gap-1">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${done ? 'bg-primary text-primary-foreground'
                          : current ? 'border border-primary bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                        {done ? <Check className="h-3 w-3" /> : num}
                      </div>
                      <span className={`text-xs font-medium ${current ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                      {i < 1 && (
                        <div className={`mx-1 h-px w-6 transition-colors ${newDiagramStep > num ? 'bg-primary' : 'bg-border'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogHeader>
                <DialogTitle>{newDiagramStep === 1 ? 'New Diagram' : 'Select Frameworks'}</DialogTitle>
                <DialogDescription>
                  {newDiagramStep === 1 ? 'Give your diagram a name.' : 'Choose the threat modeling frameworks to apply.'}
                </DialogDescription>
              </DialogHeader>

              <div className="py-2 min-h-[140px]">
                {newDiagramStep === 1 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="nd-name">Diagram name <span className="text-destructive">*</span></Label>
                    <Input
                      id="nd-name"
                      value={newDiagramName}
                      onChange={e => { setNewDiagramName(e.target.value); setNewDiagramNameError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleNewDiagramNext()}
                      autoFocus
                    />
                    {newDiagramNameError && <p className="text-xs text-destructive">{newDiagramNameError}</p>}
                  </div>
                )}

                {newDiagramStep === 2 && (
                  <div className="space-y-2">
                    <div className="grid gap-2">
                      {frameworks.map((fw: any) => {
                        const selected = newDiagramFrameworks.includes(fw.id);
                        return (
                          <div
                            key={fw.id}
                            onClick={() => toggleNewDiagramFramework(fw.id)}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${selected
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border hover:border-border/80 hover:bg-muted/40'
                              }`}
                          >
                            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-background'
                              }`}>
                              {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-tight">{fw.name}</p>
                              {fw.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{fw.description}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {newDiagramFrameworkError && (
                      <p className="text-xs text-destructive">{newDiagramFrameworkError}</p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-row items-center gap-2">
                <Button variant="ghost" onClick={() => setNewDiagramOpen(false)} disabled={newDiagramSubmitting} className="mr-auto">
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => newDiagramStep === 1 ? setNewDiagramMode('choose') : setNewDiagramStep(1)}
                  disabled={newDiagramSubmitting}
                  className="h-9"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
                {newDiagramStep === 1 ? (
                  <Button onClick={handleNewDiagramNext} className="h-9">
                    Next
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleNewDiagramSubmit} disabled={newDiagramSubmitting} className="h-9">
                    {newDiagramSubmitting ? (
                      <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</>
                    ) : (
                      <>Create &amp; Open<ArrowRight className="ml-1.5 h-4 w-4" /></>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Controlled ImportDrawioButton (opened from New Diagram wizard) */}
      {productId && (
        <ImportDrawioButton
          productId={parseInt(productId)}
          onImportSuccess={(diagramId) => {
            loadProductData();
            navigate(`/diagrams?product=${productId}&diagram=${diagramId}`);
          }}
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
        />
      )}
    </div>
  );
}

// ── Audit Log Tab — replaced by AuditTerminal ─────────────────────────────────
// legacy ACTION_META kept for reference but no longer rendered
const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  threat_added:              { label: 'Threat added',            icon: <FilePlus className="h-3.5 w-3.5" />,   color: 'text-destructive' },
  threat_removed:            { label: 'Threat removed',          icon: <FileX className="h-3.5 w-3.5" />,      color: 'text-muted-foreground' },
  threat_status_changed:     { label: 'Threat status changed',   icon: <ShieldCheck className="h-3.5 w-3.5" />,color: 'var(--risk-medium)' },
  mitigation_added:          { label: 'Mitigation added',        icon: <ShieldCheck className="h-3.5 w-3.5" />,color: 'text-emerald-500' },
  mitigation_removed:        { label: 'Mitigation removed',      icon: <ShieldOff className="h-3.5 w-3.5" />,  color: 'text-muted-foreground' },
  mitigation_status_changed: { label: 'Mitigation updated',      icon: <ShieldCheck className="h-3.5 w-3.5" />,color: 'text-primary' },
  diagram_created:           { label: 'Diagram created',         icon: <FilePlus className="h-3.5 w-3.5" />,   color: 'text-primary' },
  diagram_saved:             { label: 'Diagram saved',           icon: <GitCommit className="h-3.5 w-3.5" />,  color: 'text-muted-foreground' },
};

function AuditLogTab({ productId }: { productId: number }) {
  return <AuditTerminal productId={productId} height={520} />;
}
