import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, diagramsApi, frameworksApi, modelsApi, type ProductStatus } from '@/lib/api';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Loader2, Check, Package, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';

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
  const [productError, setProductError] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [confluenceUrl, setConfluenceUrl] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [businessArea, setBusinessArea] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

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
    setProductError('');
    setShowMore(false);
    setStatus('');
    setRepositoryUrl('');
    setConfluenceUrl('');
    setApplicationUrl('');
    setBusinessArea('');
    setOwnerName('');
    setOwnerEmail('');
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
        description: productDescription.trim() || null,
        status: status || null,
        repository_url: repositoryUrl.trim() || null,
        confluence_url: confluenceUrl.trim() || null,
        application_url: applicationUrl.trim() || null,
        business_area: businessArea.trim() || null,
        owner_name: ownerName.trim() || null,
        owner_email: ownerEmail.trim() || null,
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
      navigate(`/diagrams?product=${productId}&diagram=${diagramId}`);
    } catch (err) {
      console.error('Wizard submit error:', err);
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

              <button
                type="button"
                onClick={() => setShowMore((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showMore ? 'Hide additional details' : 'Show additional details (optional)'}
              </button>

              {showMore && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <Field>
                    <FieldLabel htmlFor="wiz-status">Project status</FieldLabel>
                    <Select value={status || 'none'} onValueChange={(v) => setStatus(v === 'none' ? '' : (v as ProductStatus))}>
                      <SelectTrigger id="wiz-status">
                        <SelectValue placeholder="Not specified" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="testing">Testing</SelectItem>
                        <SelectItem value="deployment">Deployment</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="wiz-business-area">Business area</FieldLabel>
                    <Input
                      id="wiz-business-area"
                      placeholder="e.g. Payments, Identity, Marketing"
                      value={businessArea}
                      onChange={(e) => setBusinessArea(e.target.value)}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="wiz-owner-name">Owner name</FieldLabel>
                      <Input
                        id="wiz-owner-name"
                        placeholder="Jane Doe"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="wiz-owner-email">Owner email</FieldLabel>
                      <Input
                        id="wiz-owner-email"
                        type="email"
                        placeholder="jane@example.com"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="wiz-repo-url">Repository URL</FieldLabel>
                    <Input
                      id="wiz-repo-url"
                      placeholder="https://github.com/org/repo"
                      value={repositoryUrl}
                      onChange={(e) => setRepositoryUrl(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="wiz-confluence-url">Confluence URL</FieldLabel>
                    <Input
                      id="wiz-confluence-url"
                      placeholder="https://company.atlassian.net/wiki/..."
                      value={confluenceUrl}
                      onChange={(e) => setConfluenceUrl(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="wiz-app-url">Application URL</FieldLabel>
                    <Input
                      id="wiz-app-url"
                      placeholder="https://app.example.com"
                      value={applicationUrl}
                      onChange={(e) => setApplicationUrl(e.target.value)}
                    />
                  </Field>
                </div>
              )}
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
