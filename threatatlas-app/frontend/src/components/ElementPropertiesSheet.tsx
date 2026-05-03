import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Box,
  Database,
  Globe,
  Shield,
  Cpu,
  Trash2,
  AlertTriangle,
  Tag,
  Hash,
} from 'lucide-react';
import ThreatManagement from '@/components/ThreatManagement';
import { cn } from '@/lib/utils';
import { getElementColor } from '@/lib/designSystem';

const NODE_TYPES = [
  { value: 'process',   label: 'Process',   Icon: Cpu,      colorVar: 'var(--primary)' },
  { value: 'datastore', label: 'Data Store', Icon: Database, colorVar: 'var(--element-datastore)' },
  { value: 'external',  label: 'External',  Icon: Globe,    colorVar: 'var(--element-external)' },
  { value: 'boundary',  label: 'Boundary',  Icon: Shield,   colorVar: 'var(--element-boundary)' },
] as const;

interface ElementPropertiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedElement: {
    id: string;
    type: 'node' | 'edge';
    label: string;
    nodeType?: string;
    description?: string;
  } | null;
  diagramId: number | null;
  activeModelId: number | null;
  activeModelFrameworkId: number | null;
  onRename: (name: string) => void;
  onDescriptionChange?: (description: string) => void;
  onChangeType?: (newType: string) => void;
  onDelete: () => void;
  portalContainer?: HTMLElement | null;
}

function getNodeIcon(nodeType?: string) {
  switch (nodeType?.toLowerCase()) {
    case 'process':
    case 'service':
      return Cpu;
    case 'store':
    case 'database':
      return Database;
    case 'external':
    case 'user':
    case 'actor':
      return Globe;
    case 'boundary':
    case 'trust':
      return Shield;
    default:
      return Box;
  }
}

function getNodeColorStyle(nodeType?: string): React.CSSProperties {
  const color = getElementColor(nodeType);
  return {
    backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
    color: color,
  };
}

export default function ElementPropertiesSheet({
  open,
  onOpenChange,
  selectedElement,
  diagramId,
  activeModelId,
  activeModelFrameworkId,
  onRename,
  onDescriptionChange,
  onChangeType,
  onDelete,
  portalContainer,
}: ElementPropertiesSheetProps) {
  const [elementName, setElementName] = useState('');
  const [elementDescription, setElementDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('properties');

  useEffect(() => {
    if (selectedElement) {
      setElementName(selectedElement.label);
      setElementDescription(selectedElement.description ?? '');
    }
  }, [selectedElement]);

  useEffect(() => {
    if (!open) {
      setActiveTab('properties');
      setDeleteDialogOpen(false);
    }
  }, [open]);

  const NodeIcon = getNodeIcon(selectedElement?.nodeType);
  const nodeColorStyle = getNodeColorStyle(selectedElement?.nodeType);

  const handleDescriptionBlur = () => {
    if (onDescriptionChange && elementDescription !== (selectedElement?.description ?? '')) {
      onDescriptionChange(elementDescription);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="!w-full sm:!max-w-[700px] p-0 overflow-hidden flex flex-col"
          portalContainer={portalContainer}
        >
          {/* Header */}
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={nodeColorStyle}>
                <NodeIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-bold leading-snug mb-1.5 truncate">
                  {selectedElement?.label || 'Element Properties'}
                </SheetTitle>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedElement?.nodeType && (
                    <Badge variant="secondary" className="text-[11px] capitalize">
                      {selectedElement.nodeType}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[11px] capitalize">
                    {selectedElement?.type ?? 'node'}
                  </Badge>
                  {activeModelId ? (
                    <Badge
                      variant="outline"
                      className="text-[11px]"
                      style={{
                        color: 'var(--risk-low)',
                        borderColor: 'color-mix(in srgb, var(--risk-low) 35%, transparent)',
                        backgroundColor: 'color-mix(in srgb, var(--risk-low) 12%, transparent)',
                      }}
                    >
                      Model active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      No model selected
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          {selectedElement && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 pt-2 border-b shrink-0">
                <TabsList variant="line">
                  <TabsTrigger value="properties">Properties</TabsTrigger>
                  <TabsTrigger value="threats">Threats &amp; Mitigations</TabsTrigger>
                </TabsList>
              </div>

              {/* Properties Tab */}
              <TabsContent value="properties" className="flex-1 overflow-y-auto mt-0 px-4 py-4 space-y-4">
                {/* Name */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> ELEMENT NAME
                  </p>
                  <Input
                    value={elementName}
                    onChange={(e) => setElementName(e.target.value)}
                    onBlur={() => onRename(elementName)}
                    onKeyDown={(e) => e.key === 'Enter' && onRename(elementName)}
                    placeholder="Enter element name"
                    className="h-9 rounded-lg"
                  />
                </div>

                {/* Description (free-form notes — persisted in node.data.description) */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> DESCRIPTION
                  </p>
                  <Textarea
                    value={elementDescription}
                    onChange={(e) => setElementDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    placeholder="Describe this element: its role, trust level, data handled, owners, etc."
                    rows={3}
                    className="rounded-lg resize-y"
                  />
                </div>

                <Separator />

                {/* Element type picker — nodes only */}
                {selectedElement.type === 'node' && onChangeType && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                      <Box className="h-3 w-3" /> ELEMENT TYPE
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {NODE_TYPES.map(({ value, label, Icon, colorVar }) => {
                        const active = (selectedElement.nodeType ?? 'process') === value;
                        return (
                          <button
                            key={value}
                            onClick={() => !active && onChangeType(value)}
                            className={cn(
                              'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-[10px] font-semibold transition-all',
                              active
                                ? 'border-transparent shadow-sm'
                                : 'border-border/50 hover:border-border bg-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                            )}
                            style={active ? {
                              backgroundColor: `color-mix(in srgb, ${colorVar} 10%, transparent)`,
                              borderColor: `color-mix(in srgb, ${colorVar} 40%, transparent)`,
                              color: colorVar,
                            } : {}}
                            title={`Change to ${label}`}
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Hash className="h-3 w-3" /> ELEMENT ID
                  </p>
                  <div className="flex items-center h-9 bg-muted/50 px-3 rounded-lg border overflow-hidden">
                    <code className="text-xs font-mono truncate text-muted-foreground">
                      {selectedElement.id}
                    </code>
                  </div>
                </div>

                <Separator />

                {/* Danger Zone */}
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-sm font-semibold text-destructive">Danger Zone</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Permanently deletes this element and all associated threats and mitigations. This cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Element
                  </Button>
                </div>
              </TabsContent>

              {/* Threats & Mitigations Tab */}
              <TabsContent value="threats" className="flex-1 overflow-y-auto mt-0 px-4 py-4">
                {diagramId ? (
                  <ThreatManagement
                    diagramId={diagramId}
                    activeModelId={activeModelId}
                    modelFrameworkId={activeModelFrameworkId}
                    elementId={selectedElement.id}
                    elementType={selectedElement.type}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                      <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold mb-1">No diagram selected</p>
                    <p className="text-xs text-muted-foreground">Open a diagram to manage threats and mitigations.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Element</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold">"{selectedElement?.label}"</span>? All threats and mitigations linked to this element will also be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setDeleteDialogOpen(false); onDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
