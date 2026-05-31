import { useState, useEffect, useCallback, useRef } from 'react';
import { componentTemplatesApi, type ComponentTemplateDetail, type ComponentTemplateGroup } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, Shield, ChevronDown, ChevronRight,
  Database, Cpu, Users, Box as BoxIcon, Package, Lock, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NODE_TYPE_LABEL: Record<string, string> = {
  process: 'Process', datastore: 'Data Store', external: 'External Entity',
};

const NODE_TYPE_COLOR: Record<string, string> = {
  process: 'var(--primary)', datastore: 'var(--element-datastore)', external: 'var(--element-external)',
};

const NODE_TYPE_ICON: Record<string, React.ElementType> = {
  process: Cpu, datastore: Database, external: Users,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-500 bg-red-500/10',
  high: 'text-orange-500 bg-orange-500/10',
  medium: 'text-amber-500 bg-amber-500/10',
  low: 'text-blue-500 bg-blue-500/10',
};

// ── Detail Sheet ──────────────────────────────────────────────────────────────
function ComponentDetailDialog({
  component, open, onClose,
}: { component: ComponentTemplateDetail | null; open: boolean; onClose: () => void }) {
  const [expandedThreats, setExpandedThreats] = useState<Set<number>>(new Set());
  const toggleThreat = (id: number) => setExpandedThreats(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  useEffect(() => {
    // Expand all threats when a new component is opened
    if (component) setExpandedThreats(new Set(component.threats.map(t => t.id)));
  }, [component?.id]);

  if (!component) return null;
  const NodeIcon = NODE_TYPE_ICON[component.node_type] ?? Database;
  const color = NODE_TYPE_COLOR[component.node_type] ?? 'var(--primary)';

  // Map threat categories → mitigation categories per framework pattern
  const THREAT_TO_MIT_CATS: Record<string, string[]> = {
    // STRIDE — same category names
    'Tampering':              ['Tampering'],
    'Information Disclosure': ['Information Disclosure'],
    'Spoofing':               ['Spoofing'],
    'Elevation of Privilege': ['Elevation of Privilege'],
    'Denial of Service':      ['Denial of Service'],
    'Repudiation':            ['Repudiation'],
    // OWASP Top 10
    'Broken Access Control':    ['Access Control'],
    'Cryptographic Failures':   ['Cryptography'],
    'Injection':                ['Input Validation'],
    'Insecure Design':          ['Secure Design'],
    'Integrity Failures':       ['Integrity'],
    'Logging Failures':         ['Monitoring'],
    'Security Misconfiguration':['Configuration'],
    'Vulnerable Components':    ['Supply Chain'],
    'Authentication Failures':  ['Authentication'],
    'SSRF':                     ['Secure Design'],
    // PASTA
    'Attack Simulation':        ['Attack Simulation'],
    'Attack Modeling':          ['Attack Modeling'],
    'Business Logic Abuse':     ['Business Logic Abuse'],
    'Supply Chain Risk':        ['Supply Chain Risk'],
    'Third-Party Integration':  ['Third-Party Integration'],
    'Asset Analysis':           ['Asset Analysis'],
    'Attack Surface Analysis':  ['Attack Surface Analysis'],
    'Vulnerability Analysis':   ['Attack Modeling'],
    'Threat Analysis':          ['Attack Modeling'],
  };

  // Group threats and mitigations by framework
  const fwIds = [...new Set([
    ...component.threats.map(t => t.framework_id),
    ...component.mitigations.map(m => m.framework_id),
  ])];

  const fwNames: Record<number, string> = {};
  component.threats.forEach(t => { fwNames[t.framework_id] = t.framework_name; });
  component.mitigations.forEach(m => { fwNames[m.framework_id] = m.framework_name; });

  const mitigationsByFwAndCat: Record<number, Record<string, typeof component.mitigations>> = {};
  component.mitigations.forEach(m => {
    if (!mitigationsByFwAndCat[m.framework_id]) mitigationsByFwAndCat[m.framework_id] = {};
    const cats = mitigationsByFwAndCat[m.framework_id];
    cats[m.category] = cats[m.category] ?? [];
    cats[m.category].push(m);
  });

  const getMitigationsForThreat = (threat: typeof component.threats[0]) => {
    const fwMits = mitigationsByFwAndCat[threat.framework_id] ?? {};
    const mitCats = THREAT_TO_MIT_CATS[threat.category] ?? [threat.category];
    const result: typeof component.mitigations = [];
    const seen = new Set<number>();
    mitCats.forEach(cat => {
      (fwMits[cat] ?? []).forEach(m => {
        if (!seen.has(m.id)) { result.push(m); seen.add(m.id); }
      });
    });
    return result;
  };

  // Track which mitigations were matched to threats (unmatched shown at bottom)
  const matchedMitIds = new Set<number>();
  component.threats.forEach(t => {
    getMitigationsForThreat(t).forEach(m => matchedMitIds.add(m.id));
  });
  const unmatchedMits = component.mitigations.filter(m => !matchedMitIds.has(m.id));

  const totalThreats = component.threats.length;
  const totalMits = component.mitigations.length;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[88vh] flex flex-col overflow-hidden">
        {/* Sticky header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
            <NodeIcon className="h-5 w-5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold leading-tight">{component.name}</h2>
            {component.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{component.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px]">{NODE_TYPE_LABEL[component.node_type]}</Badge>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 rounded-lg px-2 py-1">
              <span className="font-semibold text-destructive">{totalThreats}T</span>
              <span className="text-border">·</span>
              <span className="font-semibold text-emerald-600">{totalMits}M</span>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {fwIds.map(fwId => {
            const fwThreats = component.threats.filter(t => t.framework_id === fwId);
            if (fwThreats.length === 0) return null;
            const fwMitCount = component.mitigations.filter(m => m.framework_id === fwId).length;
            return (
              <div key={fwId} className="space-y-2">
                {/* Framework section header */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{fwNames[fwId]}</span>
                  <span className="text-[10px] text-muted-foreground/60">{fwThreats.length} threats · {fwMitCount} mitigations</span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>

                {/* Threat rows */}
                <div className="space-y-1.5">
                  {fwThreats.map(threat => {
                    const relatedMits = getMitigationsForThreat(threat);
                    const isExpanded = expandedThreats.has(threat.id);
                    return (
                      <div key={threat.id} className="rounded-lg border border-border/60 overflow-hidden">
                        {/* Threat row — clickable to expand */}
                        <button
                          type="button"
                          onClick={() => toggleThreat(threat.id)}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors group"
                        >
                          <div className="flex h-5 w-5 items-center justify-center rounded-md shrink-0 mt-0.5 bg-destructive/10">
                            <Shield className="h-3 w-3 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">{threat.name}</p>
                            {threat.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{threat.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5">{threat.category}</Badge>
                            {relatedMits.length > 0 && (
                              <span className="text-[9px] font-medium text-emerald-600 bg-emerald-500/10 rounded px-1.5 py-0.5">
                                {relatedMits.length}M
                              </span>
                            )}
                            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                          </div>
                        </button>

                        {/* Mitigation rows — collapsible */}
                        {isExpanded && (
                          <div className="border-t border-border/40">
                            {relatedMits.length > 0 ? (
                              relatedMits.map((m, idx) => (
                                <div
                                  key={m.id}
                                  className={cn(
                                    'flex items-start gap-2.5 px-3 py-2',
                                    idx > 0 && 'border-t border-border/30',
                                    'bg-emerald-500/3'
                                  )}
                                >
                                  <div className="flex-none w-5 flex justify-center pt-1">
                                    <div className="w-px h-full min-h-[8px] bg-emerald-500/30" />
                                  </div>
                                  <div className="flex h-4 w-4 items-center justify-center rounded-full shrink-0 mt-0.5 bg-emerald-500/15 border border-emerald-500/25">
                                    <svg className="h-2 w-2 text-emerald-600" viewBox="0 0 10 10" fill="none">
                                      <path d="M1.5 5l2 2L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200 leading-snug">{m.name}</p>
                                    {m.description && (
                                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-10 py-2 text-[11px] text-muted-foreground/50 italic">
                                No mitigations mapped for this threat
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Unmatched mitigations */}
          {unmatchedMits.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">General Controls</span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              {unmatchedMits.map(m => (
                <div key={m.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/3">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full shrink-0 mt-0.5 bg-emerald-500/15 border border-emerald-500/25">
                    <svg className="h-2 w-2 text-emerald-600" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2 2L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">{m.name}</p>
                    {m.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{m.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{m.framework_name}</Badge>
                </div>
              ))}
            </div>
          )}

          {totalThreats === 0 && totalMits === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No threats or mitigations linked yet.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Create/Edit Dialog ────────────────────────────────────────────────────────
// ── KB Picker sub-component ───────────────────────────────────────────────────
function KBPicker({
  label, frameworkId, type, selectedIds, onChange,
}: {
  label: string;
  frameworkId: number | null;
  type: 'threats' | 'mitigations';
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const [items, setItems] = useState<{ id: number; name: string; category: string; description: string }[]>([]);
  const [query, setQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!frameworkId) { setItems([]); return; }
    const load = (q: string) => {
      const fn = type === 'threats'
        ? componentTemplatesApi.listKbThreats(frameworkId, q)
        : componentTemplatesApi.listKbMitigations(frameworkId, q);
      fn.then(r => setItems(r.data)).catch(() => toast.error('Failed to load knowledge base items'));
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(query), 300);
  }, [frameworkId, query, type]);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const toggle = (id: number) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);

  const selectedSet = new Set(selectedIds);
  const selectedItems = items.filter(i => selectedSet.has(i.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
        {selectedIds.length > 0 && (
          <span className="text-[10px] text-primary">{selectedIds.length} selected</span>
        )}
      </div>

      {!frameworkId ? (
        <div className="p-4 text-[11px] text-muted-foreground/60 italic text-center">Select a framework</div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Search */}
          <div className="px-2 py-2 border-b border-border/40 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="h-7 pl-7 text-xs" />
            </div>
          </div>
          {/* Selected chips */}
          {selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border/40 bg-primary/3 shrink-0">
              {selectedItems.map(item => (
                <span key={item.id} className="inline-flex items-center gap-0.5 text-[9px] bg-primary/10 text-primary border border-primary/20 rounded-full pl-1.5 pr-1 py-0.5">
                  <span className="max-w-[100px] truncate">{item.name}</span>
                  <button type="button" onClick={() => toggle(item.id)} className="hover:text-destructive"><X className="h-2 w-2" /></button>
                </span>
              ))}
            </div>
          )}
          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(grouped).map(([cat, catItems]) => (
              <div key={cat}>
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 sticky top-0 border-b border-border/20">{cat}</div>
                {catItems.map(item => (
                  <label key={item.id} className={cn('flex items-start gap-2 px-2 py-1.5 cursor-pointer transition-colors border-b border-border/20 last:border-0',
                    selectedSet.has(item.id) ? 'bg-primary/5' : 'hover:bg-muted/30')}>
                    <input type="checkbox" checked={selectedSet.has(item.id)} onChange={() => toggle(item.id)} className="mt-0.5 h-3 w-3 shrink-0 accent-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-snug">{item.name}</p>
                      {item.description && <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{item.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            ))}
            {items.length === 0 && query && (
              <p className="px-3 py-6 text-[11px] text-muted-foreground text-center">No results for "{query}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComponentFormDialog({
  open, onClose, onSave, initial, categories,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; slug: string; category: string; node_type: string; icon?: string; description?: string; threat_ids: number[]; mitigation_ids: number[] }) => Promise<void>;
  initial?: ComponentTemplateDetail | null;
  categories: string[];
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [nodeType, setNodeType] = useState('process');
  const [description, setDescription] = useState('');
  const [frameworks, setFrameworks] = useState<{ id: number; name: string; threat_count: number }[]>([]);
  const [activeFw, setActiveFw] = useState<number | null>(null);
  const [selectedThreatIds, setSelectedThreatIds] = useState<number[]>([]);
  const [selectedMitIds, setSelectedMitIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    componentTemplatesApi.listFrameworks().then(r => {
      setFrameworks(r.data);
      if (r.data.length > 0 && !activeFw) setActiveFw(r.data[0].id);
    }).catch(() => toast.error('Failed to load frameworks'));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name); setSlug(initial.slug); setCategory(initial.category);
      setNodeType(initial.node_type); setDescription(initial.description ?? '');
      setSelectedThreatIds(initial.threats.map(t => t.id));
      setSelectedMitIds(initial.mitigations.map(m => m.id));
    } else {
      setName(''); setSlug(''); setCategory(''); setNodeType('process'); setDescription('');
      setSelectedThreatIds([]); setSelectedMitIds([]);
    }
  }, [initial, open]);

  const handleSave = async () => {
    if (!name || !slug || !category) { toast.error('Name, slug, and category are required'); return; }
    setSaving(true);
    try {
      await onSave({ name, slug, category, node_type: nodeType, description, threat_ids: selectedThreatIds, mitigation_ids: selectedMitIds });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save component');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
          <div>
            <h2 className="text-base font-semibold">{initial ? 'Edit Component' : 'New Component'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Threats and mitigations are linked directly from the Knowledge Base</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5">
            <span className="font-semibold text-destructive">{selectedThreatIds.length}T</span>
            <span>·</span>
            <span className="font-semibold text-emerald-600">{selectedMitIds.length}M</span>
            <span className="text-muted-foreground/50">selected</span>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">

          {/* Left: basic info (fixed) */}
          <div className="w-64 shrink-0 border-r border-border/50 flex flex-col">
            <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Component Info</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AWS RDS" className="h-8 text-sm"
                  onBlur={() => !slug && setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Slug *</Label>
                <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="aws-rds" className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Category *</Label>
                <Input value={category} onChange={e => setCategory(e.target.value)} list="cat-list2" placeholder="e.g. Databases" className="h-8 text-sm" />
                <datalist id="cat-list2">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Node Type *</Label>
                <Select value={nodeType} onValueChange={setNodeType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="process">Process</SelectItem>
                    <SelectItem value="datastore">Data Store</SelectItem>
                    <SelectItem value="external">External Entity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" className="h-8 text-sm" />
              </div>
            </div>
          </div>

          {/* Right: KB browser */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Framework tabs */}
            <div className="flex items-center gap-0 border-b border-border/50 overflow-x-auto shrink-0 bg-muted/10">
              {frameworks.map(fw => (
                <button
                  key={fw.id}
                  type="button"
                  onClick={() => setActiveFw(fw.id)}
                  className={cn(
                    'px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                    activeFw === fw.id
                      ? 'border-primary text-primary bg-background'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  )}
                >
                  {fw.name}
                </button>
              ))}
            </div>

            {/* Side-by-side pickers */}
            <div className="flex flex-1 min-h-0 divide-x divide-border/50">
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="px-3 py-2 border-b border-border/40 bg-muted/10 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-destructive/80">Threats</span>
                  {selectedThreatIds.length > 0 && <span className="text-[10px] text-destructive font-semibold">{selectedThreatIds.length} selected</span>}
                </div>
                <div className="flex-1 overflow-hidden">
                  <KBPicker label="" frameworkId={activeFw} type="threats" selectedIds={selectedThreatIds} onChange={setSelectedThreatIds} />
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="px-3 py-2 border-b border-border/40 bg-muted/10 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Mitigations</span>
                  {selectedMitIds.length > 0 && <span className="text-[10px] text-emerald-700 font-semibold">{selectedMitIds.length} selected</span>}
                </div>
                <div className="flex-1 overflow-hidden">
                  <KBPicker label="" frameworkId={activeFw} type="mitigations" selectedIds={selectedMitIds} onChange={setSelectedMitIds} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 shrink-0 bg-muted/10">
          <p className="text-[11px] text-muted-foreground">
            Switch frameworks to add T&M from multiple frameworks. Selections accumulate across frameworks.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save Changes' : 'Create'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ComponentLibrary() {
  const { isAdmin } = useAuth();
  const [groups, setGroups] = useState<ComponentTemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [detailComponent, setDetailComponent] = useState<ComponentTemplateDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editComponent, setEditComponent] = useState<ComponentTemplateDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const loadGroups = useCallback(() => {
    setLoading(true);
    componentTemplatesApi.listGrouped()
      .then(r => {
        setGroups(r.data);
        // Start with all groups expanded
        const initial: Record<string, boolean> = {};
        r.data.forEach(g => { initial[g.category] = true; });
        setExpandedGroups(initial);
      })
      .catch(() => toast.error('Failed to load component library'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const handleView = async (id: number) => {
    try {
      const r = await componentTemplatesApi.get(id);
      setDetailComponent(r.data);
      setShowDetail(true);
    } catch { toast.error('Failed to load component'); }
  };

  const handleEdit = async (id: number) => {
    try {
      const r = await componentTemplatesApi.get(id);
      setEditComponent(r.data);
      setShowForm(true);
    } catch { toast.error('Failed to load component'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await componentTemplatesApi.remove(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      loadGroups();
    } catch { toast.error('Failed to delete component'); }
  };

  const handleRevert = async (id: number, name: string) => {
    try {
      await componentTemplatesApi.revert(id);
      toast.success(`"${name}" restored to original`);
      loadGroups();
    } catch { toast.error('Failed to revert component'); }
  };

  const handleSave = async (data: { name: string; slug: string; category: string; node_type: string; icon?: string; description?: string; threat_ids: number[]; mitigation_ids: number[] }) => {
    try {
      if (editComponent) {
        await componentTemplatesApi.update(editComponent.id, data);
        toast.success('Component updated');
      } else {
        await componentTemplatesApi.create(data);
        toast.success('Component created');
      }
      setEditComponent(null);
      loadGroups();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to save component');
      throw e;
    }
  };

  const allCategories = groups.map(g => g.category);

  const filteredGroups = search.trim()
    ? groups.map(g => ({
        ...g,
        components: g.components.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.category.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(g => g.components.length > 0)
    : groups;

  const totalComponents = groups.reduce((s, g) => s + g.components.length, 0);
  const customCount = groups.reduce((s, g) => s + g.components.filter(c => c.is_custom).length, 0);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Component Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-built components with known threats and mitigations. Drag them from the diagram editor sidebar.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground">{totalComponents} components across {groups.length} categories</span>
            {customCount > 0 && <Badge variant="secondary" className="text-[10px] h-4">{customCount} custom</Badge>}
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditComponent(null); setShowForm(true); }} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            New Component
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search components…"
          className="pl-9 h-9"
        />
      </div>

      {/* Category groups */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const isOpen = expandedGroups[group.category] ?? true;
            return (
              <Card key={group.category} className="border-border/60 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedGroups(e => ({ ...e, [group.category]: !isOpen }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm">{group.category}</span>
                    <Badge variant="secondary" className="text-[10px] h-4">{group.components.length}</Badge>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border/40">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Component</TableHead>
                          <TableHead className="text-xs w-[110px]">Node Type</TableHead>
                          <TableHead className="text-xs text-center w-[70px]">Threats</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.components.map(comp => {
                          const NodeIcon = NODE_TYPE_ICON[comp.node_type] ?? Database;
                          const color = NODE_TYPE_COLOR[comp.node_type] ?? 'var(--primary)';
                          return (
                            <TableRow
                              key={comp.id}
                              className="hover:bg-muted/20 cursor-pointer group/row"
                              onClick={() => handleView(comp.id)}
                            >
                              {/* Name cell — icons appear inline on hover */}
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                                    style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
                                  >
                                    <NodeIcon className="h-3.5 w-3.5" style={{ color }} />
                                  </div>

                                  {/* Name + inline action icons (appear right after the name) */}
                                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                    <p className="text-sm font-medium truncate group-hover/row:text-primary transition-colors shrink-0 max-w-[180px]">{comp.name}</p>

                                    {/* Action icons — inline, immediately after name, disappear instantly */}
                                    {isAdmin && (
                                      <div
                                        className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity duration-75 shrink-0"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <button
                                          title="Edit"
                                          onClick={() => handleEdit(comp.id)}
                                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                          <Pencil className="h-2.5 w-2.5" />
                                        </button>
                                        {!comp.is_custom && comp.is_modified && (
                                          <button
                                            title="Revert to original"
                                            onClick={() => handleRevert(comp.id, comp.name)}
                                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-amber-500/10 transition-colors text-muted-foreground hover:text-amber-600"
                                          >
                                            <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none">
                                              <path d="M3.5 7.5A4.5 4.5 0 1 1 3.5 8M3.5 7.5V4m0 3.5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                          </button>
                                        )}
                                        {comp.is_custom && (
                                          <button
                                            title="Delete"
                                            onClick={() => setDeleteTarget({ id: comp.id, name: comp.name })}
                                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                          >
                                            <Trash2 className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Status badge — right side */}
                                  {comp.is_custom ? (
                                    <Badge variant="default" className="text-[9px] h-4 px-1.5 shrink-0">Custom</Badge>
                                  ) : comp.is_modified ? (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0 gap-1" style={{ borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)', color: 'var(--risk-medium)' }}>
                                      <Pencil className="h-2.5 w-2.5" />Modified
                                    </Badge>
                                  ) : null}
                                </div>
                              </TableCell>

                              <TableCell onClick={e => e.stopPropagation()}>
                                <Badge variant="outline" className="text-[10px]">{NODE_TYPE_LABEL[comp.node_type] ?? comp.node_type}</Badge>
                              </TableCell>

                              <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                                <Badge
                                  className="text-[10px] h-5 font-bold"
                                  style={{ backgroundColor: 'color-mix(in srgb, var(--element-threat) 12%, transparent)', color: 'var(--element-threat)', border: '1px solid color-mix(in srgb, var(--element-threat) 25%, transparent)' }}
                                >
                                  {comp.threat_count}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ComponentDetailDialog component={detailComponent} open={showDetail} onClose={() => setShowDetail(false)} />
      <ComponentFormDialog
        open={showForm} onClose={() => { setShowForm(false); setEditComponent(null); }}
        onSave={handleSave} initial={editComponent} categories={allCategories}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. The component will be removed from the library.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
