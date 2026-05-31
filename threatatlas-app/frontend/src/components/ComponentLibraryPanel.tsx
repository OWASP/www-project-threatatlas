import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronRight, Search, X,
  Database, Cpu, Users, Box as BoxIcon, Network,
  Activity, ArrowRightLeft, Globe, Monitor, Smartphone,
  KeyRound, Server, Mail, Upload as UploadIcon, GitBranch,
  Shield,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { componentTemplatesApi, type ComponentTemplateGroup, type ComponentTemplateDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  database: Database,
  cpu: Cpu,
  users: Users,
  box: BoxIcon,
  network: Network,
  activity: Activity,
  'arrow-right-left': ArrowRightLeft,
  globe: Globe,
  monitor: Monitor,
  smartphone: Smartphone,
  'key-round': KeyRound,
  server: Server,
  mail: Mail,
  upload: UploadIcon,
  'git-branch': GitBranch,
  search: Search,
  shield: Shield,
};

function getIcon(key: string | null) {
  const Icon = ICON_MAP[key ?? ''] ?? Database;
  return Icon;
}

// ── Severity color ────────────────────────────────────────────────────────────
function severityColor(s?: string) {
  if (s === 'critical') return 'text-red-500';
  if (s === 'high') return 'text-orange-500';
  if (s === 'medium') return 'text-amber-500';
  return 'text-blue-500';
}

// ── Threat preview tooltip ─────────────────────────────────────────────────────
function ThreatPreview({ detail }: { detail: ComponentTemplateDetail }) {
  // Use KB threats if available, fall back to inline threats for display
  const kbThreats = detail.threats ?? [];
  const inlineThreats = detail.inline_threats ?? [];
  const kbMitigations = detail.mitigations ?? [];
  const usingKB = kbThreats.length > 0;
  const displayThreats = usingKB ? kbThreats : inlineThreats;
  const frameworkName = kbThreats[0]?.framework_name;

  return (
    <div className="w-72 bg-popover border border-border/60 rounded-xl shadow-xl p-3 space-y-2 z-50">
      <div>
        <p className="font-semibold text-xs">{detail.name}</p>
        {detail.description && <p className="text-[10px] text-muted-foreground mt-0.5">{detail.description}</p>}
        {frameworkName && (
          <p className="text-[9px] text-primary font-semibold mt-1 uppercase tracking-wide">{frameworkName} threats</p>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {usingKB ? `KB Threats (${kbThreats.length})` : `Known Threats (${inlineThreats.length})`}
        </p>
        {displayThreats.slice(0, 5).map((t, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-[9px] text-muted-foreground mt-0.5 shrink-0">{t.category.slice(0, 3).toUpperCase()}</span>
            <p className="text-[11px] leading-snug">{t.name}</p>
          </div>
        ))}
        {displayThreats.length > 5 && (
          <p className="text-[10px] text-muted-foreground">+{displayThreats.length - 5} more threats</p>
        )}
      </div>
      {kbMitigations.length > 0 && (
        <div className="border-t border-border/40 pt-2 space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mitigations ({kbMitigations.length})</p>
          {kbMitigations.slice(0, 2).map((m, i) => (
            <p key={i} className="text-[11px] leading-snug text-muted-foreground">• {m.name}</p>
          ))}
        </div>
      )}
      <div className="border-t border-border/40 pt-2">
        <p className="text-[10px] text-primary font-medium">Click to add · hover for details</p>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface ComponentLibraryPanelProps {
  onAddComponent: (name: string, nodeType: string, componentId: number) => void;
  frameworkId?: number | null;
}

export default function ComponentLibraryPanel({ onAddComponent, frameworkId }: ComponentLibraryPanelProps) {
  const [groups, setGroups] = useState<ComponentTemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // All categories start collapsed; explicitly set to false to open
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<ComponentTemplateDetail | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{ x: number; y: number } | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    componentTemplatesApi.listGrouped(frameworkId)
      .then(r => setGroups(r.data))
      .catch(() => toast.error('Failed to load component library'))
      .finally(() => setLoading(false));
  }, [frameworkId]);

  const filteredGroups = search.trim()
    ? groups.map(g => ({
        ...g,
        components: g.components.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.category.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(g => g.components.length > 0)
    : groups;

  const handleHover = (componentId: number, e: React.MouseEvent) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const itemRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Anchor to the parent panel's right edge so the preview sits flush against the menu
    const panelEl = (e.currentTarget as HTMLElement).closest('[data-tool-panel]');
    const panelRect = panelEl?.getBoundingClientRect() ?? itemRect;
    previewTimerRef.current = setTimeout(() => {
      componentTemplatesApi.get(componentId, frameworkId)
        .then(r => {
          setPreview(r.data);
          // Align left edge of preview to panel right + small gap; vertically center on item
          setPreviewAnchor({ x: panelRect.right + 4, y: itemRect.top });
        })
        .catch(() => {});
    }, 200); // reduced delay for faster feel
  };

  const handleHoverLeave = () => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
  };

  const handlePreviewLeave = () => {
    setPreview(null);
    setPreviewAnchor(null);
  };

  if (loading) return (
    <div className="px-2 py-3 text-[10px] text-muted-foreground text-center">Loading library…</div>
  );

  if (groups.length === 0) return null;

  return (
    <div className="relative text-left">
      {/* Search */}
      <div className="px-2 pb-1.5 pt-0.5 sticky top-0 bg-background/95 z-10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components…"
            className="h-7 pl-7 pr-6 text-[11px] rounded-md"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-0.5">
        {filteredGroups.map(group => {
          // Default closed (true = collapsed), explicitly opened = false
          const isOpen = collapsed[group.category] === false;
          return (
            <div key={group.category} className="border-t border-border/40 first:border-t-0">
              <button
                onClick={() => setCollapsed(c => ({ ...c, [group.category]: isOpen }))}
                className="w-full flex items-center justify-between text-left px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground hover:bg-muted/30 transition-colors rounded-md"
              >
                <span className="text-left">{group.category}</span>
                {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
              </button>
              {isOpen && (
                <div className="space-y-0.5 pb-1">
                  {group.components.map(comp => {
                    const Icon = getIcon(comp.icon);
                    const nodeColors: Record<string, string> = {
                      process: 'var(--primary)',
                      datastore: 'var(--element-datastore)',
                      external: 'var(--element-external)',
                    };
                    const color = nodeColors[comp.node_type] ?? 'var(--primary)';
                    return (
                      <button
                        key={comp.id}
                        onClick={() => onAddComponent(comp.name, comp.node_type, comp.id)}
                        onMouseEnter={e => handleHover(comp.id, e)}
                        onMouseLeave={handleHoverLeave}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                      >
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <span className="text-[11px] font-medium flex-1 min-w-0 truncate group-hover:text-foreground">{comp.name}</span>
                        {comp.threat_count > 0 && (
                          <Badge
                            className="text-[9px] h-4 px-1 shrink-0 font-bold"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--element-threat) 15%, transparent)', color: 'var(--element-threat)', border: '1px solid color-mix(in srgb, var(--element-threat) 25%, transparent)' }}
                          >
                            {comp.threat_count}T
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover preview portal */}
      {preview && previewAnchor && (
        <div
          className="fixed z-[9999]"
          style={{
            left: previewAnchor.x,
            // Clamp so the 288px-wide preview doesn't overflow the bottom of the viewport
            top: Math.min(previewAnchor.y, window.innerHeight - 420),
          }}
          onMouseLeave={handlePreviewLeave}
          onMouseEnter={() => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); }}
        >
          <ThreatPreview detail={preview} />
        </div>
      )}
    </div>
  );
}
