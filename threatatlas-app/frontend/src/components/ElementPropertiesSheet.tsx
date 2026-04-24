import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import ThreatManagement from '@/components/ThreatManagement';

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
  onDelete: () => void;
  portalContainer?: HTMLElement | null;
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
  onDelete,
  portalContainer,
}: ElementPropertiesSheetProps) {
  const [elementName, setElementName] = useState('');
  const [elementDescription, setElementDescription] = useState('');

  useEffect(() => {
    if (selectedElement) {
      setElementName(selectedElement.label);
      setElementDescription(selectedElement.description ?? '');
    }
  }, [selectedElement]);

  const handleRename = () => {
    onRename(elementName);
  };

  const handleDescriptionBlur = () => {
    if (onDescriptionChange && elementDescription !== (selectedElement?.description ?? '')) {
      onDescriptionChange(elementDescription);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-full sm:!max-w-[700px] p-0 flex flex-col" portalContainer={portalContainer}>
        <div className="px-4 pt-4 pb-4 border-b">
          <SheetHeader className="space-y-3">
            <SheetTitle className="text-2xl font-bold">
              {selectedElement?.label || 'Element Properties'}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              {selectedElement?.nodeType && (
                <>
                  <Badge variant="secondary" className="capitalize">
                    {selectedElement.nodeType}
                  </Badge>
                  <span className="text-muted-foreground/60">•</span>
                </>
              )}
              <span>Configure properties, threats, and mitigations</span>
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Element Name Section */}
             <div className="space-y-3">
              <h3 className="text-sm font-semibold">Element Information</h3>
              <div className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor="element-name">Element Name</FieldLabel>
                  <Input
                    id="element-name"
                    value={elementName}
                    onChange={(e) => setElementName(e.target.value)}
                    onBlur={handleRename}
                    placeholder="Enter element name"
                    className="w-full"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="element-description">Description</FieldLabel>
                  <Textarea
                    id="element-description"
                    value={elementDescription}
                    onChange={(e) => setElementDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    placeholder="Describe this element: its role, trust level, data handled, owners, etc."
                    rows={3}
                    className="w-full resize-y"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  {selectedElement?.nodeType && (
                    <Field>
                      <FieldLabel>Element Type</FieldLabel>
                      <div className="flex items-center h-10 bg-muted/30 px-3 rounded-lg border border-border/40">
                        <Badge variant="secondary" className="capitalize">
                          {selectedElement.nodeType}
                        </Badge>
                      </div>
                    </Field>
                  )}

                  {selectedElement?.id && (
                    <Field>
                      <FieldLabel>Element ID</FieldLabel>
                      <div className="flex items-center h-10 bg-muted/30 px-3 rounded-lg border border-border/40">
                        <code className="text-xs font-mono">
                          {selectedElement.id}
                        </code>
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Threats Section */}
            {diagramId && selectedElement && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Threats & Mitigations</h3>
                <ThreatManagement
                  diagramId={diagramId}
                  activeModelId={activeModelId}
                  modelFrameworkId={activeModelFrameworkId}
                  elementId={selectedElement.id}
                  elementType={selectedElement.type}
                />
              </div>
            )}

            <div className="h-px bg-border" />

            {/* Danger Zone */}
            <div className="space-y-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold">Danger Zone</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Delete this element and all associated threats and mitigations. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Element
              </Button>
            </div>
          </div>
      </SheetContent>
    </Sheet>
  );
}
