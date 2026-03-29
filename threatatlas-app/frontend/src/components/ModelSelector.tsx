import { useState, useEffect } from 'react';
import { modelsApi, frameworksApi } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Layers, BarChart3, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

interface Model {
  id: number;
  diagram_id: number;
  framework_id: number;
  name: string;
  description: string | null;
  status: 'in_progress' | 'completed' | 'archived';
  framework_name: string;
  threat_count: number;
  mitigation_count: number;
  created_at: string;
}

interface Framework {
  id: number;
  name: string;
  description: string;
}

interface ModelSelectorProps {
  diagramId: number;
  selectedModelId: number | null;
  onModelChange: (modelId: number | null, model: Model | null) => void;
  externalCreateOpen?: boolean;
  onExternalCreateClose?: () => void;
  externalEditOpen?: boolean;
  onExternalEditClose?: () => void;
  externalDeleteOpen?: boolean;
  onExternalDeleteClose?: () => void;
}

export default function ModelSelector({
  diagramId,
  selectedModelId,
  onModelChange,
  externalCreateOpen,
  onExternalCreateClose,
  externalEditOpen,
  onExternalEditClose,
  externalDeleteOpen,
  onExternalDeleteClose
}: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Sync with external triggers
  useEffect(() => {
    if (externalCreateOpen) {
      setCreateDialogOpen(true);
    }
  }, [externalCreateOpen]);

  useEffect(() => {
    if (externalEditOpen && selectedModel) {
      handleEditModel(selectedModel);
    }
  }, [externalEditOpen]);

  useEffect(() => {
    if (externalDeleteOpen && selectedModel) {
      setModelToDelete(selectedModel);
      setDeleteDialogOpen(true);
    }
  }, [externalDeleteOpen]);

  // Sync back to parent
  useEffect(() => {
    if (!createDialogOpen && onExternalCreateClose) {
      onExternalCreateClose();
    }
  }, [createDialogOpen, onExternalCreateClose]);

  useEffect(() => {
    if (!editDialogOpen && onExternalEditClose) {
      onExternalEditClose();
    }
  }, [editDialogOpen, onExternalEditClose]);

  useEffect(() => {
    if (!deleteDialogOpen && onExternalDeleteClose) {
      onExternalDeleteClose();
    }
  }, [deleteDialogOpen, onExternalDeleteClose]);

  // Create model form state
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit model state
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'in_progress' | 'completed' | 'archived'>('in_progress');
  const [updating, setUpdating] = useState(false);

  // Delete model state
  const [modelToDelete, setModelToDelete] = useState<Model | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [diagramId]);

  const loadData = async () => {
    try {
      const [modelsRes, frameworksRes] = await Promise.all([
        modelsApi.listByDiagram(diagramId),
        frameworksApi.list()
      ]);
      setModels(modelsRes.data);
      setFrameworks(frameworksRes.data);

      // Auto-select first model if none selected
      if (!selectedModelId && modelsRes.data.length > 0) {
        onModelChange(modelsRes.data[0].id, modelsRes.data[0]);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      toast.error('Failed to load models');
    }
  };

  const handleCreateModel = async () => {
    if (!frameworkId || !modelName) return;

    try {
      setCreating(true);
      const response = await modelsApi.create({
        diagram_id: diagramId,
        framework_id: parseInt(frameworkId),
        name: modelName,
        description: modelDescription || undefined,
      });

      // Add new model to list and select it
      const newModel = response.data;
      setModels([...models, newModel]);
      onModelChange(newModel.id, newModel);

      // Reset form
      setFrameworkId('');
      setModelName('');
      setModelDescription('');
      setCreateDialogOpen(false);
      toast.success('Model created successfully');
    } catch (error) {
      console.error('Error creating model:', error);
      toast.error('Failed to create model');
    } finally {
      setCreating(false);
    }
  };

  const handleModelSelect = (value: string) => {
    const modelId = value === 'all' ? null : parseInt(value);
    const model = modelId ? models.find(m => m.id === modelId) || null : null;
    onModelChange(modelId, model);
  };

  const handleEditModel = (model: Model) => {
    setEditingModel(model);
    setEditName(model.name);
    setEditDescription(model.description || '');
    setEditStatus(model.status);
    setEditDialogOpen(true);
  };

  const handleUpdateModel = async () => {
    if (!editingModel || !editName) return;

    try {
      setUpdating(true);
      const response = await modelsApi.update(editingModel.id, {
        name: editName,
        description: editDescription || undefined,
        status: editStatus,
      });

      // Update models list
      const updatedModels = models.map(m =>
        m.id === editingModel.id
          ? { ...m, ...response.data }
          : m
      );
      setModels(updatedModels);

      // Update selected model if it's the one being edited
      if (selectedModelId === editingModel.id) {
        const updatedModel = updatedModels.find(m => m.id === editingModel.id);
        if (updatedModel) {
          onModelChange(updatedModel.id, updatedModel);
        }
      }

      setEditDialogOpen(false);
      setEditingModel(null);
      toast.success('Model updated successfully');
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!modelToDelete) return;

    try {
      setDeleting(true);
      await modelsApi.delete(modelToDelete.id);

      // Remove from models list
      const updatedModels = models.filter(m => m.id !== modelToDelete.id);
      setModels(updatedModels);

      // If deleted model was selected, select first model or null
      if (selectedModelId === modelToDelete.id) {
        if (updatedModels.length > 0) {
          onModelChange(updatedModels[0].id, updatedModels[0]);
        } else {
          onModelChange(null, null);
        }
      }

      setDeleteDialogOpen(false);
      setModelToDelete(null);
      toast.success('Model deleted successfully');
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error('Failed to delete model');
    } finally {
      setDeleting(false);
    }
  };

  // Auto-fill model name when framework changes
  useEffect(() => {
    if (frameworkId) {
      const framework = frameworks.find(f => f.id === parseInt(frameworkId));
      if (framework) {
        setModelName(`${framework.name} Analysis`);
      }
    }
  }, [frameworkId, frameworks]);

  const selectedModel = models.find(m => m.id === selectedModelId);

  return (
    <div className="flex items-center gap-1.5 w-full justify-start align-center">
      <Select value={selectedModelId?.toString() || 'all'} onValueChange={handleModelSelect}>
        <SelectTrigger className="w-fit py-5 flex items-center gap-1.5 h-10 bg-background border-muted shadow-sm px-2 rounded-lg overflow-hidden shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <SelectValue placeholder="Select a model" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="font-semibold h-10 px-2 py-2 border-b rounded-none">
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold">ALL ANALYSES</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{models.reduce((sum, m) => sum + m.threat_count, 0)}</Badge>
            </div>
          </SelectItem>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id.toString()} className="h-10 px-2 py-2 rounded-none">
              <div className="flex items-center gap-2">
                <span>{model.name}</span>
                <Badge variant="outline" className="text-[10px] opacity-70">
                  {model.threat_count}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {
        selectedModel && (
          <div className="flex w-fit items-center gap-1.5 h-10 bg-background border shadow-sm px-2 rounded-lg overflow-hidden shrink-0">
            <div className="flex items-center gap-1.5 group cursor-help pr-2 border-r h-full overflow-hidden">
              <Badge variant="secondary" className="h-6 px-1.5 text-[10px] font-black uppercase tracking-tighter shrink-0 bg-primary/10 text-primary border-primary/20">
                {selectedModel.framework_name}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 px-2 border-r h-full shrink-0">
              <Badge
                variant={
                  selectedModel.status === 'completed' ? 'default' :
                    selectedModel.status === 'archived' ? 'secondary' :
                      'outline'
                }
                className="capitalize h-6 px-1.5 text-[10px] font-bold shrink-0 shadow-sm"
              >
                {selectedModel.status.replace('_', ' ')}
              </Badge>
            </div>

            <TooltipProvider>
              <div className="flex items-center gap-3 px-2 h-full font-mono">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 hover:bg-muted/50 px-1.5 py-1 rounded transition-colors cursor-default">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      <span className="text-[14px] font-black tabular-nums">{selectedModel.threat_count}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Threats</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Detected security threats for this model</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 hover:bg-muted/50 px-1.5 py-1 rounded transition-colors cursor-default">
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                      <span className="text-[14px] font-black tabular-nums">{selectedModel.mitigation_count}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Mitigations</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Mitigations</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )
      }

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Analysis Model</DialogTitle>
            <DialogDescription>
              Create a new threat modeling analysis for this diagram using a specific framework.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="framework">Framework *</FieldLabel>
              <Select value={frameworkId} onValueChange={setFrameworkId}>
                <SelectTrigger id="framework">
                  <SelectValue placeholder="Select a framework" />
                </SelectTrigger>
                <SelectContent>
                  {frameworks.map((framework) => (
                    <SelectItem key={framework.id} value={framework.id.toString()}>
                      {framework.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="name">Model Name *</FieldLabel>
              <Input
                id="name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="STRIDE Security Analysis"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
              <Textarea
                id="description"
                value={modelDescription}
                onChange={(e) => setModelDescription(e.target.value)}
                placeholder="Initial security threat identification..."
                rows={3}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateModel} disabled={!frameworkId || !modelName || creating}>
              {creating ? 'Creating...' : 'Create Model'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Model Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>
              Update the model details. Framework cannot be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="edit-framework">Framework</FieldLabel>
              <Input
                id="edit-framework"
                value={editingModel?.framework_name || ''}
                disabled
                className="bg-muted opacity-80"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-name">Model Name *</FieldLabel>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="STRIDE Security Analysis"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-description">Description</FieldLabel>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Initial security threat identification..."
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-status">Status</FieldLabel>
              <Select value={editStatus} onValueChange={(value: any) => setEditStatus(value)}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateModel} disabled={!editName || updating}>
              {updating ? 'Updating...' : 'Update Model'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Model Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{modelToDelete?.name}"? This will permanently delete the model and all associated threats and mitigations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModel}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Model'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
