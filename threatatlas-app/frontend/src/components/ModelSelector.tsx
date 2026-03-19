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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Layers, Settings, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
}

export default function ModelSelector({ diagramId, selectedModelId, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create model form state
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit model state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'in_progress' | 'completed' | 'archived'>('in_progress');
  const [updating, setUpdating] = useState(false);

  // Delete model state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
    } catch (error) {
      console.error('Error creating model:', error);
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
    } catch (error) {
      console.error('Error updating model:', error);
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
    } catch (error) {
      console.error('Error deleting model:', error);
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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <FieldTitle className="text-sm font-medium">Active Model:</FieldTitle>
      </div>

      <Select value={selectedModelId?.toString() || 'all'} onValueChange={handleModelSelect}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span>All Models</span>
              <Badge variant="secondary" className="text-xs">{models.length}</Badge>
            </div>
          </SelectItem>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id.toString()}>
              <div className="flex items-center gap-2">
                <span>{model.name}</span>
                <Badge variant="outline" className="text-xs">
                  {model.threat_count} threats
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedModel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{selectedModel.framework_name}</Badge>
          <Badge
            variant={
              selectedModel.status === 'completed' ? 'default' :
              selectedModel.status === 'archived' ? 'secondary' :
              'outline'
            }
            className="capitalize"
          >
            {selectedModel.status.replace('_', ' ')}
          </Badge>
          <span>•</span>
          <span>{selectedModel.threat_count} threats, {selectedModel.mitigation_count} mitigations</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditModel(selectedModel)}>
                <Settings className="h-4 w-4 mr-2" />
                Edit Model
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setModelToDelete(selectedModel);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Model
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Model
          </Button>
        </DialogTrigger>
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
    </div>
  );
}
