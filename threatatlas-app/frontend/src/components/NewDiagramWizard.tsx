import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Grid3x3, Package, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { diagramsApi, modelsApi, frameworksApi } from '@/lib/api';
import { DIAGRAM_TEMPLATES } from '@/lib/diagramTemplates';
import DiagramMiniPreview from '@/components/DiagramMiniPreview';

type Step = 'choose' | 'blank' | 'template' | 'model';

interface NewDiagramWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number | null;
  /** When true, after creating a diagram the wizard offers a Threat Model step. */
  withModelStep?: boolean;
  /** Called when the user picks "Import Draw.io" — the host page owns its import flow. */
  onRequestImport: () => void;
  /** Optional side-effect after a diagram is created (e.g. refresh a list). */
  onCreated?: (diagramId: number) => void;
}

/**
 * The single New Diagram wizard used by both the Products and Diagrams pages.
 * Steps: choose → (blank | template) → [model]. The Model step is only shown
 * when `withModelStep` is set. Navigation to the new diagram is handled here.
 */
export default function NewDiagramWizard({
  open,
  onOpenChange,
  productId,
  withModelStep = false,
  onRequestImport,
  onCreated,
}: NewDiagramWizardProps) {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('choose');
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [diagramId, setDiagramId] = useState<number | null>(null);

  const [frameworks, setFrameworks] = useState<{ id: number; name: string }[]>([]);
  const [frameworkId, setFrameworkId] = useState<number | null>(null);
  const [modelName, setModelName] = useState('');
  const [creatingModel, setCreatingModel] = useState(false);

  // Reset whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setStep('choose');
      setName('');
      setSelectedTemplate(null);
      setCreating(false);
      setDiagramId(null);
      setFrameworkId(null);
      setModelName('');
      if (withModelStep) {
        frameworksApi.list().then(r => {
          setFrameworks(r.data);
          if (r.data.length > 0) {
            setFrameworkId(r.data[0].id);
            setModelName(r.data[0].name + ' Threat Model');
          }
        }).catch(() => {});
      }
    }
  }, [open, withModelStep]);

  const finish = (id: number) => {
    onCreated?.(id);
    onOpenChange(false);
    navigate(`/diagrams?product=${productId}&diagram=${id}`);
  };

  const afterDiagramCreated = (id: number) => {
    if (withModelStep) {
      setDiagramId(id);
      setStep('model');
    } else {
      finish(id);
    }
  };

  const createBlank = async () => {
    if (!productId || !name.trim()) return;
    try {
      setCreating(true);
      const res = await diagramsApi.create({ product_id: productId, name: name.trim(), diagram_data: { nodes: [], edges: [] } });
      afterDiagramCreated(res.data.id);
    } catch {
      toast.error('Failed to create diagram.');
    } finally {
      setCreating(false);
    }
  };

  const createFromTemplate = async () => {
    const tmpl = DIAGRAM_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!productId || !tmpl || !name.trim()) return;
    try {
      setCreating(true);
      const res = await diagramsApi.create({
        product_id: productId,
        name: name.trim(),
        diagram_data: { nodes: tmpl.nodes, edges: tmpl.edges },
      });
      afterDiagramCreated(res.data.id);
    } catch {
      toast.error('Failed to create diagram from template.');
    } finally {
      setCreating(false);
    }
  };

  const finishWithModel = async (createModel: boolean) => {
    if (diagramId == null) return;
    if (createModel && frameworkId) {
      try {
        setCreatingModel(true);
        await modelsApi.create({ diagram_id: diagramId, framework_id: frameworkId, name: modelName || 'Threat Model' });
      } catch {
        toast.error('Failed to create model.');
      } finally {
        setCreatingModel(false);
      }
    }
    finish(diagramId);
  };

  const selectedTmpl = DIAGRAM_TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-lg">
        {step === 'choose' && (
          <>
            <DialogHeader>
              <DialogTitle>New Diagram</DialogTitle>
              <DialogDescription>Start with a blank canvas, a template, or import an existing Draw.io file.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 py-2">
              <button
                onClick={() => setStep('blank')}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border/60 bg-muted/30 p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Grid3x3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-center">Blank Canvas</p>
                  <p className="text-[10px] text-muted-foreground text-center mt-0.5">Start from scratch</p>
                </div>
              </button>

              <button
                onClick={() => setStep('template')}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-left hover:border-primary/60 hover:bg-primary/10 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-center text-primary">From Template</p>
                  <p className="text-[10px] text-muted-foreground text-center mt-0.5">Pre-built DFDs</p>
                </div>
              </button>

              <button
                onClick={() => { onOpenChange(false); onRequestImport(); }}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border/60 bg-muted/30 p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-center">Import Draw.io</p>
                  <p className="text-[10px] text-muted-foreground text-center mt-0.5">.drawio or .xml</p>
                </div>
              </button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </DialogFooter>
          </>
        )}

        {step === 'blank' && (
          <>
            <DialogHeader>
              <DialogTitle>Name your diagram</DialogTitle>
              <DialogDescription>Give this diagram a name — you can always change it later.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="ndw-blank-name">Diagram name</Label>
              <Input
                id="ndw-blank-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Payment Service DFD"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createBlank()}
              />
            </div>

            <DialogFooter className="gap-2">
              <button
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mr-auto"
                onClick={() => setStep('choose')}
              >
                Back
              </button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={createBlank} disabled={!name.trim() || creating}>
                {creating ? 'Creating…' : withModelStep ? 'Next →' : 'Create Diagram'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'template' && (
          <>
            <DialogHeader>
              <DialogTitle>Choose a Template</DialogTitle>
              <DialogDescription>Select a pre-built DFD to get started quickly.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 py-2">
              {DIAGRAM_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); if (!name.trim()) setName(t.name + ' DFD'); }}
                  className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    selectedTemplate === t.id
                      ? 'border-primary bg-primary/8'
                      : 'border-border/60 bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
                  }`}
                >
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedTmpl && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <DiagramMiniPreview
                    className="h-44 w-full rounded-lg border bg-muted/20 overflow-hidden"
                    nodes={selectedTmpl.nodes as any}
                    edges={selectedTmpl.edges as any}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ndw-template-name" className="text-xs">Diagram name</Label>
                  <Input
                    id="ndw-template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={selectedTmpl.name + ' DFD'}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createFromTemplate()}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <button
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mr-auto"
                onClick={() => setStep('choose')}
              >
                Back
              </button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={createFromTemplate} disabled={!selectedTemplate || !name.trim() || creating}>
                {creating ? 'Creating…' : withModelStep ? 'Next →' : 'Create from Template'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'model' && (
          <>
            <DialogHeader>
              <DialogTitle>Add a Threat Model?</DialogTitle>
              <DialogDescription>
                Set up a threat model framework to start analyzing this diagram. You can always add one later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Framework</Label>
                <Select
                  value={frameworkId ? frameworkId.toString() : undefined}
                  onValueChange={v => {
                    const id = Number(v);
                    setFrameworkId(id);
                    const fw = frameworks.find(f => f.id === id);
                    if (fw) setModelName(fw.name + ' Threat Model');
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select framework…" /></SelectTrigger>
                  <SelectContent>
                    {frameworks.map(fw => (
                      <SelectItem key={fw.id} value={fw.id.toString()}>{fw.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model name</Label>
                <Input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="e.g. STRIDE Threat Model" />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" className="mr-auto text-muted-foreground" onClick={() => finishWithModel(false)}>
                Skip
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => finishWithModel(true)} disabled={!frameworkId || !modelName.trim() || creatingModel}>
                {creatingModel ? 'Creating…' : 'Create Model & Open'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
