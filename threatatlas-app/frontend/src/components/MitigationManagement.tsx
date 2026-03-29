import { useState, useEffect } from 'react';
import { diagramMitigationsApi, mitigationsApi, frameworksApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Plus, Trash2, Search, X } from 'lucide-react';
import { CommentSection } from '@/components/CommentSection';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Mitigation {
  id: number;
  framework_id: number;
  name: string;
  description: string;
  category: string;
  is_custom: boolean;
}

interface Framework {
  id: number;
  name: string;
}

interface DiagramMitigation {
  id: number;
  mitigation_id: number;
  element_id: string;
  status: string;
  comments: string;
  mitigation: Mitigation;
}

interface MitigationManagementProps {
  diagramId: number;
  activeModelId?: number | null;
  elementId: string;
  elementType: string;
}

export default function MitigationManagement({ diagramId, activeModelId, elementId, elementType }: MitigationManagementProps) {
  const { user, canWrite } = useAuth();
  const authorName = user?.full_name || user?.email || 'Unknown User';
  const [attachedMitigations, setAttachedMitigations] = useState<DiagramMitigation[]>([]);
  const [availableMitigations, setAvailableMitigations] = useState<Mitigation[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [diagramId, elementId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mitigationsRes, availableRes, frameworksRes] = await Promise.all([
        diagramMitigationsApi.list({ diagram_id: diagramId }),
        mitigationsApi.list(),
        frameworksApi.list(),
      ]);

      // Filter mitigations for this element
      const elementMitigations = mitigationsRes.data.filter(
        (dm: DiagramMitigation) => dm.element_id === elementId
      );
      setAttachedMitigations(elementMitigations);
      setAvailableMitigations(availableRes.data);
      setFrameworks(frameworksRes.data);
    } catch (error) {
      console.error('Error loading mitigations:', error);
      toast.error('Failed to load mitigations');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachMitigation = async (mitigation: Mitigation) => {
    try {
      await diagramMitigationsApi.create({
        diagram_id: diagramId,
        model_id: activeModelId ?? 1,
        mitigation_id: mitigation.id,
        element_id: elementId,
        element_type: elementType,
        status: 'proposed',
        comments: '',
      });
      setAddDialogOpen(false);
      setSearchQuery('');
      loadData();
      toast.success('Mitigation attached successfully');
    } catch (error) {
      console.error('Error attaching mitigation:', error);
      toast.error('Failed to attach mitigation');
    }
  };

  const handleUpdateMitigation = async (diagramMitigationId: number, updates: Partial<DiagramMitigation>) => {
    try {
      await diagramMitigationsApi.update(diagramMitigationId, updates);
      loadData();
      toast.success('Mitigation updated');
    } catch (error) {
      console.error('Error updating mitigation:', error);
      toast.error('Failed to update mitigation');
    }
  };

  const handleRemoveMitigation = async (diagramMitigationId: number) => {
    try {
      await diagramMitigationsApi.delete(diagramMitigationId);
      loadData();
      toast.success('Mitigation removed');
    } catch (error) {
      console.error('Error removing mitigation:', error);
      toast.error('Failed to remove mitigation');
    }
  };

  const filteredAvailableMitigations = availableMitigations.filter((mitigation) => {
    const matchesFramework = selectedFramework === 'all' || mitigation.framework_id === parseInt(selectedFramework);
    const matchesSearch = mitigation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mitigation.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mitigation.category.toLowerCase().includes(searchQuery.toLowerCase());

    // Don't show already attached mitigations
    const isAttached = attachedMitigations.some(dm => dm.mitigation_id === mitigation.id);

    return matchesFramework && matchesSearch && !isAttached;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed':
        return 'outline';
      case 'implemented':
        return 'default';
      case 'verified':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-sm">Mitigations ({attachedMitigations.length})</h3>
          </div>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

      {loading ? (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Loading mitigations...
          </CardContent>
        </Card>
      ) : attachedMitigations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No mitigations attached</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Mitigation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {attachedMitigations.map((dm) => (
            <Card key={dm.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{dm.mitigation.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {dm.mitigation.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {dm.mitigation.description}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => handleRemoveMitigation(dm.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Status:</Label>
                      <Select
                        value={dm.status}
                        onValueChange={(value) =>
                          handleUpdateMitigation(dm.id, { status: value })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proposed">Proposed</SelectItem>
                          <SelectItem value="implemented">Implemented</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant={getStatusColor(dm.status)} className="text-xs">
                        {dm.status}
                      </Badge>
                    </div>

                    <div className="pt-2">
                      <CommentSection
                        comments={dm.comments}
                        canWrite={canWrite}
                        authorName={authorName}
                        onSave={(newComments) => handleUpdateMitigation(dm.id, { comments: newComments })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Mitigation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Mitigation</DialogTitle>
            <DialogDescription>
              Select a mitigation from the knowledge base to attach to this element.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mitigations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {frameworks.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id.toString()}>
                      {fw.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4 space-y-2">
                {filteredAvailableMitigations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No mitigations found matching your criteria
                  </div>
                ) : (
                  filteredAvailableMitigations.map((mitigation) => (
                    <Card
                      key={mitigation.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleAttachMitigation(mitigation)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{mitigation.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {mitigation.category}
                              </Badge>
                              {mitigation.is_custom && (
                                <Badge variant="secondary" className="text-xs">
                                  Custom
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {mitigation.description}
                            </p>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </CardContent>
    </Card>
  );
}
