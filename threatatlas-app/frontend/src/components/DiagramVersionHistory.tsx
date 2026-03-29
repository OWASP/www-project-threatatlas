import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, ArrowUp, ArrowDown, Minus, RotateCcw, GitCompare } from 'lucide-react';
import { diagramVersionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface DiagramVersionSummary {
  id: number;
  diagram_id: number;
  version_number: number;
  name: string;
  comment: string | null;
  created_at: string;
  node_count: number;
  edge_count: number;
  threat_count: number;
  total_risk_score: number;
}

interface DiagramVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: number;
  currentVersion: number;
  onRestore: () => void;
  onCompare?: (fromVersion: number, toVersion: number) => void;
}

export default function DiagramVersionHistory({
  open,
  onOpenChange,
  diagramId,
  currentVersion,
  onRestore,
  onCompare,
}: DiagramVersionHistoryProps) {
  const [versions, setVersions] = useState<DiagramVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, diagramId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await diagramVersionsApi.list(diagramId);
      setVersions(response.data);
    } catch (error) {
      console.error('Failed to load versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (versionNumber: number) => {
    setSelectedVersion(versionNumber);
    setRestoreDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (selectedVersion === null) return;

    try {
      await diagramVersionsApi.restore(diagramId, selectedVersion);
      setRestoreDialogOpen(false);
      setSelectedVersion(null);
      onRestore();
      loadVersions();
      toast.success('Version restored successfully');
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast.error('Failed to restore version');
    }
  };

  const handleCompareToggle = (versionNumber: number) => {
    setSelectedForCompare(prev => {
      if (prev.includes(versionNumber)) {
        return prev.filter(v => v !== versionNumber);
      } else if (prev.length < 2) {
        return [...prev, versionNumber];
      } else {
        // Replace the first selected version
        return [prev[1], versionNumber];
      }
    });
  };

  const handleCompare = () => {
    if (selectedForCompare.length === 2 && onCompare) {
      const [v1, v2] = selectedForCompare.sort((a, b) => a - b);
      onCompare(v1, v2);
    }
  };

  const getRiskTrend = (current: DiagramVersionSummary, previous?: DiagramVersionSummary) => {
    if (!previous) return null;

    const delta = current.total_risk_score - previous.total_risk_score;

    if (delta > 0) {
      return <ArrowUp className="h-4 w-4 text-red-500" />;
    } else if (delta < 0) {
      return <ArrowDown className="h-4 w-4 text-green-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="!w-full sm:!max-w-[700px] p-0 flex flex-col">
          <div className="px-4 pt-4 pb-4 border-b">
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-2xl font-bold">Version History</SheetTitle>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {selectedForCompare.length === 2 && (
              <div className="mb-4">
                <Button
                  onClick={handleCompare}
                  variant="outline"
                  className="w-full"
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare Versions {selectedForCompare[0]} and {selectedForCompare[1]}
                </Button>
              </div>
            )}

            <div className="relative pl-8 space-y-6">
              {/* Vertical Timeline Line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border/60" />

              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <p className="text-sm text-muted-foreground">Loading history...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <p className="text-sm text-muted-foreground">No history available</p>
                </div>
              ) : (
                versions.map((version, index) => {
                  const previousVersion = versions[index + 1];
                  const isSelected = selectedForCompare.includes(version.version_number);
                  const isCurrent = version.version_number === currentVersion;

                  return (
                    <div key={version.id} className="relative">
                      {/* Timeline Marker */}
                      <div className={`absolute -left-[25px] top-1.5 h-4 w-4 rounded-full border-2 bg-background z-10 transition-colors ${
                        isCurrent ? 'border-primary ring-4 ring-primary/10' : 'border-muted-foreground/30'
                      }`} />

                      <div
                        className={`group border rounded-xl p-3 hover:shadow-md transition-all ${
                          isSelected ? 'border-primary bg-primary/[0.02]' : 'hover:border-primary/20'
                        } ${isCurrent ? 'bg-muted/30 border-primary/20 shadow-sm' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tracking-tight">V.{version.version_number}</span>
                            {isCurrent && (
                              <Badge variant="default" className="h-5 px-1.5 text-[9px] font-black uppercase tracking-tighter bg-primary text-primary-foreground">
                                Active
                              </Badge>
                            )}
                            <div className="flex items-center text-[11px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                              <Clock className="h-3 w-3 mr-1 opacity-70" />
                              {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {getRiskTrend(version, previousVersion)}
                            <div className="h-4 w-px bg-border/60 mx-1" />
                            <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleCompareToggle(version.version_number)}
                                title="Compare"
                              >
                                <GitCompare className={`h-3.5 w-3.5 ${isSelected ? 'text-primary' : ''}`} />
                              </Button>
                              {!isCurrent && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleRestoreClick(version.version_number)}
                                  title="Restore"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {version.comment && (
                          <div className="mb-3 px-3 py-2 bg-muted/20 border-l-2 border-primary/30 rounded-r-lg">
                            <p className="text-[13px] leading-relaxed text-muted-foreground italic font-medium">
                              "{version.comment}"
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest pl-1">
                          <span className="flex items-center gap-1">
                            <span className="text-foreground">{version.node_count}</span> Nodes
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-foreground">{version.edge_count}</span> Edges
                          </span>
                          <div className="h-3 w-px bg-border/40" />
                          <span className="flex items-center gap-1">
                            <span className={version.threat_count > 0 ? 'text-red-500' : 'text-foreground'}>
                              {version.threat_count}
                            </span> Threats
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-foreground">{version.total_risk_score}</span> Risk
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the diagram to version {selectedVersion}. A new version will be created
              preserving the current state. This action can be undone by restoring another version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>
              Restore Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
