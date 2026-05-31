/**
 * ComponentThreatsPanel
 * Shown when a predefined component is dropped onto the diagram.
 * Fetches KB threats/mitigations for the active framework and lets the user
 * approve them directly — no AI call required.
 */
import { useEffect, useState } from 'react';
import {
  Shield, X, CheckCheck, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  componentTemplatesApi,
  type KBThreatItem, type KBMitigationItem,
} from '@/lib/api';
import { toast } from 'sonner';

interface ComponentThreatsPanelProps {
  componentId: number;
  nodeName: string;
  nodeId: string;
  nodeType: string;
  diagramId: number;
  modelId: number | null;
  frameworkId: number | null;
  frameworkName: string | null;
  onClose: () => void;
  onApplied: () => void;
}

// Category → mitigation category mapping (same as ComponentLibrary)
const THREAT_TO_MIT_CATS: Record<string, string[]> = {
  'Tampering': ['Tampering'], 'Information Disclosure': ['Information Disclosure'],
  'Spoofing': ['Spoofing'], 'Elevation of Privilege': ['Elevation of Privilege'],
  'Denial of Service': ['Denial of Service'], 'Repudiation': ['Repudiation'],
  'Broken Access Control': ['Access Control'], 'Cryptographic Failures': ['Cryptography'],
  'Injection': ['Input Validation'], 'Insecure Design': ['Secure Design'],
  'Integrity Failures': ['Integrity'], 'Logging Failures': ['Monitoring'],
  'Security Misconfiguration': ['Configuration'], 'Vulnerable Components': ['Supply Chain'],
  'Authentication Failures': ['Authentication'], 'SSRF': ['Secure Design'],
  'Attack Simulation': ['Attack Simulation'], 'Attack Modeling': ['Attack Modeling'],
  'Business Logic Abuse': ['Business Logic Abuse'], 'Supply Chain Risk': ['Supply Chain Risk'],
};

function getMitigationsForThreat(
  threat: KBThreatItem,
  mitigations: KBMitigationItem[],
): KBMitigationItem[] {
  const cats = THREAT_TO_MIT_CATS[threat.category] ?? [threat.category];
  const seen = new Set<number>();
  return mitigations.filter(m => {
    if (m.framework_id !== threat.framework_id) return false;
    if (!cats.includes(m.category)) return false;
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export default function ComponentThreatsPanel({
  componentId, nodeName, nodeId, nodeType,
  diagramId, modelId, frameworkId, frameworkName,
  onClose, onApplied,
}: ComponentThreatsPanelProps) {
  const [threats, setThreats] = useState<KBThreatItem[]>([]);
  const [mitigations, setMitigations] = useState<KBMitigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreatIds, setSelectedThreatIds] = useState<Set<number>>(new Set());
  const [selectedMitIds, setSelectedMitIds] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [expandedThreats, setExpandedThreats] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    componentTemplatesApi.get(componentId, frameworkId)
      .then(r => {
        setThreats(r.data.threats);
        setMitigations(r.data.mitigations);
        // Pre-select all by default
        setSelectedThreatIds(new Set(r.data.threats.map(t => t.id)));
        setSelectedMitIds(new Set(r.data.mitigations.map(m => m.id)));
        setExpandedThreats(new Set(r.data.threats.map(t => t.id)));
      })
      .catch(() => toast.error('Failed to load component threats'))
      .finally(() => setLoading(false));
  }, [componentId, frameworkId]);

  const toggleThreat = (id: number) => {
    setSelectedThreatIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleMit = (id: number) => {
    setSelectedMitIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedThreats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    if (!modelId) {
      toast.error('No active model — create or select a threat model first');
      return;
    }
    setApplying(true);
    try {
      // Single transactional call — the server attaches all selected threats and
      // mitigations atomically and skips any already present on this element.
      const { data } = await componentTemplatesApi.apply(componentId, {
        diagram_id: diagramId,
        model_id: modelId,
        element_id: nodeId,
        element_type: nodeType,
        threat_ids: [...selectedThreatIds],
        mitigation_ids: [...selectedMitIds],
      });
      const addedT = data.threats_added;
      const addedM = data.mitigations_added;
      toast.success(`Added ${addedT} threat${addedT !== 1 ? 's' : ''} and ${addedM} mitigation${addedM !== 1 ? 's' : ''} for ${nodeName}`);
      onApplied();
    } catch (e) {
      toast.error('Failed to apply threats/mitigations');
    } finally {
      setApplying(false);
    }
  };

  const noModel = !modelId;

  // Group threats by framework
  const fwIds = [...new Set(threats.map(t => t.framework_id))];
  const fwNames: Record<number, string> = {};
  threats.forEach(t => { fwNames[t.framework_id] = t.framework_name; });

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[380px] max-h-[70vh] flex flex-col rounded-xl border border-border/70 bg-background/98 backdrop-blur-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{nodeName}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {loading ? 'Loading KB threats…' : (
              frameworkName
                ? `${threats.length} threats · ${mitigations.length} mitigations (${frameworkName})`
                : `${threats.length} threats · ${mitigations.length} mitigations`
            )}
          </p>
        </div>
        <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* No model warning */}
      {noModel && !loading && threats.length > 0 && (
        <div className="px-4 py-2 bg-amber-500/8 border-b border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
          No active model selected — create or select a threat model to add these to the diagram.
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threats.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No threats linked to this component for the active framework.
          </div>
        ) : (
          <div className="space-y-3">
            {fwIds.map(fwId => {
              const fwThreats = threats.filter(t => t.framework_id === fwId);
              return (
                <div key={fwId} className="space-y-1.5">
                  {fwIds.length > 1 && (
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">{fwNames[fwId]}</p>
                  )}
                  {fwThreats.map(threat => {
                    const relatedMits = getMitigationsForThreat(threat, mitigations);
                    const isExpanded = expandedThreats.has(threat.id);
                    const isSelected = selectedThreatIds.has(threat.id);
                    return (
                      <div key={threat.id} className={cn('rounded-lg border overflow-hidden transition-colors', isSelected ? 'border-destructive/30' : 'border-border/50 opacity-60')}>
                        {/* Threat row */}
                        <div className="flex items-start gap-2 px-2.5 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleThreat(threat.id)}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-destructive"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-snug">{threat.name}</p>
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 mt-0.5">{threat.category}</Badge>
                          </div>
                          {relatedMits.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(threat.id)}
                              className="flex items-center gap-0.5 text-[9px] text-emerald-600 font-semibold shrink-0 hover:text-emerald-700 transition-colors"
                            >
                              <span>{relatedMits.length}M</span>
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                          )}
                        </div>

                        {/* Mitigation rows */}
                        {isExpanded && relatedMits.length > 0 && (
                          <div className="border-t border-border/30 bg-emerald-500/3 divide-y divide-border/20">
                            {relatedMits.map(m => (
                              <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-emerald-500/5 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={selectedMitIds.has(m.id)}
                                  onChange={() => toggleMit(m.id)}
                                  disabled={!isSelected}
                                  className="h-3 w-3 shrink-0 accent-emerald-600"
                                />
                                <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full shrink-0 bg-emerald-500/15">
                                  <svg className="h-2 w-2 text-emerald-600" viewBox="0 0 10 10" fill="none">
                                    <path d="M1.5 5l2 2L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                                <span className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 leading-snug flex-1 min-w-0 truncate">{m.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && threats.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 shrink-0 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-destructive">{selectedThreatIds.size}T</span>
            {' · '}
            <span className="font-semibold text-emerald-600">{selectedMitIds.size}M</span>
            {' '}selected
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Skip</Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleApply}
              disabled={applying || noModel || (selectedThreatIds.size === 0 && selectedMitIds.size === 0)}
            >
              {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              {applying ? 'Adding…' : 'Add to diagram'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
