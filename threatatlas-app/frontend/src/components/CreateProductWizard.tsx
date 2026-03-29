import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, diagramsApi, frameworksApi, modelsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Package,
  Globe,
  Lock,
  FileText,
} from 'lucide-react';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { toast } from 'sonner';

interface Framework {
  id: number;
  name: string;
  description: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STEPS = ['Product', 'Diagram', 'Framework'];

export default function CreateProductWizard({ open, onOpenChange, onSuccess }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loadingFrameworks, setLoadingFrameworks] = useState(false);

  // Step 1
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [productError, setProductError] = useState('');

  // Step 2
  const [diagramName, setDiagramName] = useState('Main Architecture');
  const [diagramError, setDiagramError] = useState('');

  // Step 3
  const [selectedFrameworks, setSelectedFrameworks] = useState<number[]>([]);
  const [frameworkError, setFrameworkError] = useState('');

  // Reset and fetch frameworks when dialog opens
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setProductName('');
    setProductDescription('');
    setIsPublic(false);
    setProductError('');
    setDiagramName('Main Architecture');
    setDiagramError('');
    setSelectedFrameworks([]);
    setFrameworkError('');
    setSubmitting(false);

    setLoadingFrameworks(true);
    frameworksApi
      .list()
      .then((res) => setFrameworks(res.data))
      .catch(() => setFrameworks([]))
      .finally(() => setLoadingFrameworks(false));
  }, [open]);

  const goNext = () => {
    if (step === 1) {
      if (!productName.trim()) {
        setProductError('Product name is required.');
        return;
      }
      setProductError('');
      setStep(2);
    } else if (step === 2) {
      if (!diagramName.trim()) {
        setDiagramError('Diagram name is required.');
        return;
      }
      setDiagramError('');
      setStep(3);
    }
  };

  const goBack = () => setStep((s) => s - 1);

  const toggleFramework = (id: number) => {
    setFrameworkError('');
    setSelectedFrameworks((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selectedFrameworks.length === 0) {
      setFrameworkError('Select at least one framework.');
      return;
    }
    setSubmitting(true);
    try {
      const productRes = await productsApi.create({
        name: productName.trim(),
        description: productDescription.trim() || undefined,
        is_public: isPublic,
      });
      const productId: number = productRes.data.id;

      const diagramRes = await diagramsApi.create({
        product_id: productId,
        name: diagramName.trim(),
        diagram_data: { nodes: [], edges: [] },
      });
      const diagramId: number = diagramRes.data.id;

      await Promise.all(
        selectedFrameworks.map((fwId) => {
          const fw = frameworks.find((f) => f.id === fwId);
          return modelsApi.create({
            diagram_id: diagramId,
            framework_id: fwId,
            name: fw ? `${fw.name} Analysis` : 'Analysis',
          });
        })
      );

      onSuccess();
      onOpenChange(false);
      toast.success('Product created successfully');
      navigate(`/diagrams?product=${productId}&diagram=${diagramId}`);
    } catch (err) {
      console.error('Wizard submit error:', err);
      toast.error('Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-1 mb-1">
          {STEPS.map((label, i) => {
            const num = i + 1;
            const done = step > num;
            const current = step === num;
            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    done
                      ? 'bg-primary text-primary-foreground'
                      : current
                      ? 'border border-primary bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : num}
                </div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    current ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-px w-6 transition-colors ${
                      step > num ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Header ── */}
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'New Product'}
            {step === 2 && 'Create a Diagram'}
            {step === 3 && 'Select Frameworks'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Give your product a name and optional description.'}
            {step === 2 && 'Name the first diagram for this product. You can add more later.'}
            {step === 3 && 'Choose the threat modeling frameworks to apply to this diagram.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step content ── */}
        <div className="py-2 min-h-[160px]">

          {/* Step 1: Product */}
          {step === 1 && (
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="wiz-product-name">
                  <Package className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  Product Name
                  <span className="text-destructive ml-1">*</span>
                </FieldLabel>
                <Input
                  id="wiz-product-name"
                  placeholder="e.g. Payment API, Mobile App"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setProductError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && goNext()}
                  autoFocus
                />
                <FieldError>{productError}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="wiz-product-desc">
                  Description
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </FieldLabel>
                <Textarea
                  id="wiz-product-desc"
                  placeholder="What does this product do?"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  rows={3}
                />
                <FieldDescription>
                  Briefly describe the purpose of this product.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Visibility</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                      !isPublic
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                    }`}
                  >
                    <Lock className="h-4 w-4 shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">Private</div>
                      <div className="text-xs text-muted-foreground">Only shared users</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                      isPublic
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                    }`}
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">Public</div>
                      <div className="text-xs text-muted-foreground">All users can view</div>
                    </div>
                  </button>
                </div>
              </Field>
            </div>
          )}

          {/* Step 2: Diagram */}
          {step === 2 && (
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="wiz-diagram-name">
                  <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  Diagram Name
                  <span className="text-destructive ml-1">*</span>
                </FieldLabel>
                <Input
                  id="wiz-diagram-name"
                  value={diagramName}
                  onChange={(e) => {
                    setDiagramName(e.target.value);
                    setDiagramError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && goNext()}
                  autoFocus
                />
                <FieldError>{diagramError}</FieldError>
                <FieldDescription>
                  A data flow diagram lets you visually map your system and attach threats to specific components.
                </FieldDescription>
              </Field>
            </div>
          )}

          {/* Step 3: Frameworks */}
          {step === 3 && (
            <div className="space-y-2">
              {loadingFrameworks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-2">
                  {frameworks.map((fw) => {
                    const selected = selectedFrameworks.includes(fw.id);
                    return (
                      <div
                        key={fw.id}
                        onClick={() => toggleFramework(fw.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
                          selected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:border-border/80 hover:bg-muted/40'
                        }`}
                      >
                        {/* Custom checkbox */}
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            selected
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/40 bg-background'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight">{fw.name}</p>
                          {fw.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {fw.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {frameworkError && (
                <p className="text-xs text-destructive">{frameworkError}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="flex-row items-center gap-2">
          {/* Cancel — far left */}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="mr-auto"
          >
            Cancel
          </Button>

          {step > 1 && (
            <Button variant="outline" onClick={goBack} disabled={submitting}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          )}

          {step < 3 ? (
            <Button onClick={goNext}>
              Next
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || loadingFrameworks}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  Create &amp; Open
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
