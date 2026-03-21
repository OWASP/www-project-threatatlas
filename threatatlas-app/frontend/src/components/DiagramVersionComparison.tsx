import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, ArrowDown, Plus, Minus, Edit, AlertTriangle } from 'lucide-react';
import { diagramVersionsApi } from '@/lib/api';

interface ElementChange {
  element_id: string;
  element_type: string;
  change_type: 'added' | 'removed' | 'modified';
  before?: any;
  after?: any;
}

interface ThreatChange {
  element_id: string;
  threat_id: number;
  change_type: 'added' | 'removed' | 'modified';
  before?: any;
  after?: any;
  risk_score_delta?: number;
}

interface VersionComparison {
  from_version: number;
  to_version: number;
  nodes_added: ElementChange[];
  nodes_removed: ElementChange[];
  nodes_modified: ElementChange[];
  edges_added: ElementChange[];
  edges_removed: ElementChange[];
  edges_modified: ElementChange[];
  threats_added: ThreatChange[];
  threats_removed: ThreatChange[];
  threats_modified: ThreatChange[];
  total_risk_score_delta: number;
  from_total_risk_score: number;
  to_total_risk_score: number;
}

interface DiagramVersionComparisonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: number;
  fromVersion: number;
  toVersion: number;
}

export default function DiagramVersionComparison({
  open,
  onOpenChange,
  diagramId,
  fromVersion,
  toVersion,
}: DiagramVersionComparisonProps) {
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && diagramId && fromVersion && toVersion) {
      loadComparison();
    }
  }, [open, diagramId, fromVersion, toVersion]);

  const loadComparison = async () => {
    setLoading(true);
    try {
      const response = await diagramVersionsApi.compare(diagramId, fromVersion, toVersion);
      setComparison(response.data);
    } catch (error) {
      console.error('Failed to load comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderChangeIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-red-600" />;
      case 'modified':
        return <Edit className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const renderChangeBadge = (type: string) => {
    const variants: Record<string, any> = {
      added: 'default',
      removed: 'destructive',
      modified: 'secondary',
    };

    return (
      <Badge variant={variants[type] || 'outline'} className="capitalize">
        {type}
      </Badge>
    );
  };

  const renderRiskTrend = (delta: number) => {
    if (delta > 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <ArrowUp className="h-4 w-4" />
          <span className="text-sm font-medium">+{delta}</span>
        </div>
      );
    } else if (delta < 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <ArrowDown className="h-4 w-4" />
          <span className="text-sm font-medium">{delta}</span>
        </div>
      );
    }
    return <span className="text-sm text-muted-foreground">No change</span>;
  };

  const getElementDisplayName = (item: any, id: string) => {
    if (!item) return id;
    // For nodes: data.label, data.name, or name
    const name = item.data?.label || item.data?.name || item.data?.display_name || item.label || item.name || item.display_name;
    return name || id;
  };

  const getThreatDisplayName = (change: ThreatChange) => {
    const item = change.after || change.before;
    if (!item) return `Threat #${change.threat_id}`;
    
    return item.threat_name || item.name || item.display_name || item.threat?.name || `Threat #${change.threat_id}`;
  };

  const getThreatElementLabel = (change: ThreatChange) => {
    const item = change.after || change.before;
    if (!item) return change.element_id;
    
    return item.node_label || item.element_label || item.element_name || change.element_id;
  };

  if (!comparison && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-3xl !max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Compare Versions {fromVersion} → {toVersion}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Loading comparison...</p>
          </div>
        ) : comparison ? (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="structure">Structure</TabsTrigger>
              <TabsTrigger value="threats">Threats</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Version {fromVersion}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nodes:</span>
                          <span>{comparison.nodes_removed.length + comparison.nodes_modified.length + (comparison.nodes_added.length === 0 ? 0 : -comparison.nodes_added.length)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Edges:</span>
                          <span>{comparison.edges_removed.length + comparison.edges_modified.length + (comparison.edges_added.length === 0 ? 0 : -comparison.edges_added.length)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Score:</span>
                          <span>{comparison.from_total_risk_score}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Version {toVersion}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nodes:</span>
                          <span>{comparison.nodes_added.length + comparison.nodes_modified.length + (comparison.nodes_removed.length === 0 ? 0 : -comparison.nodes_removed.length)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Edges:</span>
                          <span>{comparison.edges_added.length + comparison.edges_modified.length + (comparison.edges_removed.length === 0 ? 0 : -comparison.edges_removed.length)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Score:</span>
                          <span>{comparison.to_total_risk_score}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-accent/50">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Risk Score Change
                    </h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Total Risk Score Delta:
                      </span>
                      {renderRiskTrend(comparison.total_risk_score_delta)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Changes Overview</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3 text-green-600" />
                        <span>{comparison.nodes_added.length} nodes added</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3 text-green-600" />
                        <span>{comparison.edges_added.length} edges added</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Minus className="h-3 w-3 text-red-600" />
                        <span>{comparison.nodes_removed.length} nodes removed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Minus className="h-3 w-3 text-red-600" />
                        <span>{comparison.edges_removed.length} edges removed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Edit className="h-3 w-3 text-blue-600" />
                        <span>{comparison.nodes_modified.length} nodes modified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Edit className="h-3 w-3 text-blue-600" />
                        <span>{comparison.edges_modified.length} edges modified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="structure">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  {/* Nodes */}
                  <div>
                    <h4 className="font-medium mb-3">Nodes</h4>
                    <div className="space-y-2">
                      {comparison.nodes_added.map((change, idx) => (
                        <div key={`added-${idx}`} className="border rounded-lg p-3 border-green-200 bg-green-50">
                          <div className="flex items-center gap-2 mb-1">
                            {renderChangeIcon(change.change_type)}
                            <span className="font-medium text-sm">{getElementDisplayName(change.after, change.element_id)}</span>
                            {renderChangeBadge(change.change_type)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Type: {change.after?.type || 'unknown'}
                          </p>
                        </div>
                      ))}

                      {comparison.nodes_removed.map((change, idx) => (
                        <div key={`removed-${idx}`} className="border rounded-lg p-3 border-red-200 bg-red-50">
                          <div className="flex items-center gap-2 mb-1">
                            {renderChangeIcon(change.change_type)}
                            <span className="font-medium text-sm">{getElementDisplayName(change.before, change.element_id)}</span>
                            {renderChangeBadge(change.change_type)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Type: {change.before?.type || 'unknown'}
                          </p>
                        </div>
                      ))}

                      {comparison.nodes_modified.map((change, idx) => (
                        <div key={`modified-${idx}`} className="border rounded-lg p-3 border-blue-200 bg-blue-50">
                          <div className="flex items-center gap-2 mb-1">
                            {renderChangeIcon(change.change_type)}
                            <span className="font-medium text-sm">{getElementDisplayName(change.after || change.before, change.element_id)}</span>
                            {renderChangeBadge(change.change_type)}
                          </div>
                          <p className="text-xs text-muted-foreground">Modified properties</p>
                        </div>
                      ))}

                      {comparison.nodes_added.length === 0 &&
                        comparison.nodes_removed.length === 0 &&
                        comparison.nodes_modified.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No node changes
                          </p>
                        )}
                    </div>
                  </div>

                  {/* Edges */}
                  <div>
                    <h4 className="font-medium mb-3">Edges</h4>
                    <div className="space-y-2">
                      {comparison.edges_added.map((change, idx) => (
                        <div key={`added-${idx}`} className="border rounded-lg p-3 border-green-200 bg-green-50">
                          <div className="flex items-center gap-2 mb-1">
                            {renderChangeIcon(change.change_type)}
                            <span className="font-medium text-sm">{getElementDisplayName(change.after, change.element_id)}</span>
                            {renderChangeBadge(change.change_type)}
                          </div>
                        </div>
                      ))}

                      {comparison.edges_removed.map((change, idx) => (
                        <div key={`removed-${idx}`} className="border rounded-lg p-3 border-red-200 bg-red-50">
                          <div className="flex items-center gap-2 mb-1">
                            {renderChangeIcon(change.change_type)}
                            <span className="font-medium text-sm">{getElementDisplayName(change.before, change.element_id)}</span>
                            {renderChangeBadge(change.change_type)}
                          </div>
                        </div>
                      ))}

                      {comparison.edges_modified.map((change, idx) => (
                        <div key={`modified-${idx}`} className="border rounded-lg p-3 border-blue-200 bg-blue-50">
                          <div className="flex items-center gap-2 mb-1">
                            {renderChangeIcon(change.change_type)}
                            <span className="font-medium text-sm">{getElementDisplayName(change.after || change.before, change.element_id)}</span>
                            {renderChangeBadge(change.change_type)}
                          </div>
                        </div>
                      ))}

                      {comparison.edges_added.length === 0 &&
                        comparison.edges_removed.length === 0 &&
                        comparison.edges_modified.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No edge changes
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="threats">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {comparison.threats_added.map((change, idx) => (
                    <div key={`added-${idx}`} className="border rounded-lg p-3 border-green-200 bg-green-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {renderChangeIcon(change.change_type)}
                          <span className="font-medium text-sm">{getThreatDisplayName(change)}</span>
                          {renderChangeBadge(change.change_type)}
                        </div>
                        {change.risk_score_delta !== undefined && renderRiskTrend(change.risk_score_delta)}
                      </div>
                      <p className="text-xs text-muted-foreground">Element: {getThreatElementLabel(change)}</p>
                      {change.after && (
                        <div className="mt-2 text-xs">
                          <div>Risk Score: {change.after.risk_score || 'N/A'}</div>
                          <div>Severity: {change.after.severity || 'N/A'}</div>
                        </div>
                      )}
                    </div>
                  ))}

                  {comparison.threats_removed.map((change, idx) => (
                    <div key={`removed-${idx}`} className="border rounded-lg p-3 border-red-200 bg-red-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {renderChangeIcon(change.change_type)}
                          <span className="font-medium text-sm">{getThreatDisplayName(change)}</span>
                          {renderChangeBadge(change.change_type)}
                        </div>
                        {change.risk_score_delta !== undefined && renderRiskTrend(change.risk_score_delta)}
                      </div>
                      <p className="text-xs text-muted-foreground">Element: {getThreatElementLabel(change)}</p>
                      {change.before && (
                        <div className="mt-2 text-xs">
                          <div>Risk Score: {change.before.risk_score || 'N/A'}</div>
                          <div>Severity: {change.before.severity || 'N/A'}</div>
                        </div>
                      )}
                    </div>
                  ))}

                  {comparison.threats_modified.map((change, idx) => (
                    <div key={`modified-${idx}`} className="border rounded-lg p-3 border-blue-200 bg-blue-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {renderChangeIcon(change.change_type)}
                          <span className="font-medium text-sm">{getThreatDisplayName(change)}</span>
                          {renderChangeBadge(change.change_type)}
                        </div>
                        {change.risk_score_delta !== undefined && renderRiskTrend(change.risk_score_delta)}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Element: {getThreatElementLabel(change)}</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-medium mb-1">Before:</div>
                          {change.before && (
                            <>
                              <div>Risk: {change.before.risk_score || 'N/A'}</div>
                              <div>Severity: {change.before.severity || 'N/A'}</div>
                            </>
                          )}
                        </div>
                        <div>
                          <div className="font-medium mb-1">After:</div>
                          {change.after && (
                            <>
                              <div>Risk: {change.after.risk_score || 'N/A'}</div>
                              <div>Severity: {change.after.severity || 'N/A'}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {comparison.threats_added.length === 0 &&
                    comparison.threats_removed.length === 0 &&
                    comparison.threats_modified.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No threat changes
                      </p>
                    )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
