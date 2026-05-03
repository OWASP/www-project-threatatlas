import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { productsApi, diagramsApi, type ProductStatus } from '@/lib/api';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Box,
  Grid3x3,
  Calendar,
  FileText,
  ArrowRight,
  Users,
  Eye,
} from 'lucide-react';
import ShareProductDialog from '@/components/ShareProductDialog';
import CreateProductWizard from '@/components/CreateProductWizard';

const STATUS_CLASSES: Record<string, string> = {
  design: 'border-sky-500/50 text-sky-700 dark:text-sky-300 bg-sky-500/10',
  development: 'border-indigo-500/50 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10',
  testing: 'border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10',
  deployment: 'border-purple-500/50 text-purple-700 dark:text-purple-300 bg-purple-500/10',
  production: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10',
};
const getStatusBadgeClass = (status: ProductStatus | null): string =>
  status ? STATUS_CLASSES[status] ?? '' : '';

interface Product {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  status: ProductStatus | null;
  repository_url: string | null;
  confluence_url: string | null;
  application_url: string | null;
  business_area: string | null;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
}

interface Diagram {
  id: number;
  product_id: number;
  name: string;
  diagram_data: any;
  created_at: string;
}

function ProductsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="rounded-xl border-border/60">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="rounded-xl border border-border/60 p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
          <CardFooter className="pt-3 gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 flex-1 rounded-lg" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function Products() {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [diagrams, setDiagrams] = useState<Record<number, Diagram[]>>({});
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDiagramOpen, setDeleteDiagramOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDiagramId, setSelectedDiagramId] = useState<number | null>(null);
  const [expandedDiagrams, setExpandedDiagrams] = useState<Record<number, boolean>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: '' as ProductStatus | '',
    repository_url: '',
    confluence_url: '',
    application_url: '',
    business_area: '',
    owner_name: '',
    owner_email: '',
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productsApi.list();
      setProducts(response.data);

      const diagramsMap: Record<number, Diagram[]> = {};
      await Promise.all(
        response.data.map(async (product: Product) => {
          const diagResponse = await diagramsApi.list({ product_id: product.id });
          diagramsMap[product.id] = diagResponse.data;
        })
      );
      setDiagrams(diagramsMap);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedProduct) return;
    try {
      await productsApi.update(selectedProduct.id, {
        name: formData.name,
        description: formData.description || null,
        status: formData.status || null,
        repository_url: formData.repository_url || null,
        confluence_url: formData.confluence_url || null,
        application_url: formData.application_url || null,
        business_area: formData.business_area || null,
        owner_name: formData.owner_name || null,
        owner_email: formData.owner_email || null,
      });
      setEditOpen(false);
      setSelectedProduct(null);
      loadProducts();
      toast.success('Product updated');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      await productsApi.delete(selectedProduct.id);
      setDeleteOpen(false);
      setSelectedProduct(null);
      loadProducts();
      toast.success('Product deleted');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleCreateDiagram = async (productId: number) => {
    try {
      const response = await diagramsApi.create({
        product_id: productId,
        name: 'New Diagram',
        diagram_data: { nodes: [], edges: [] },
      });
      navigate(`/diagrams?product=${productId}&diagram=${response.data.id}`);
    } catch (error) {
      console.error('Error creating diagram:', error);
      toast.error('Failed to create diagram');
    }
  };

  const openDeleteDiagramDialog = (e: React.MouseEvent, diagramId: number) => {
    e.stopPropagation();
    setSelectedDiagramId(diagramId);
    setDeleteDiagramOpen(true);
  };

  const handleDeleteDiagram = async () => {
    if (!selectedDiagramId) return;
    try {
      await diagramsApi.delete(selectedDiagramId);
      setDeleteDiagramOpen(false);
      setSelectedDiagramId(null);
      loadProducts();
      toast.success('Diagram deleted');
    } catch (error) {
      console.error('Error deleting diagram:', error);
      toast.error('Failed to delete diagram');
    }
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      status: product.status || '',
      repository_url: product.repository_url || '',
      confluence_url: product.confluence_url || '',
      application_url: product.application_url || '',
      business_area: product.business_area || '',
      owner_name: product.owner_name || '',
      owner_email: product.owner_email || '',
    });
    setEditOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setSelectedProduct(product);
    setDeleteOpen(true);
  };

  return (
    <div className="flex-1 space-y-4 mx-auto p-4">
      {/* Page Header */}
      <div className="flex justify-end">
        {canWrite && (
          <Button
            className="shadow-sm hover:shadow-md transition-all duration-200"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Product
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto">
        {loading ? (
          <ProductsSkeleton />
        ) : products.length === 0 ? (
          <Card className="border-dashed border-2 rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/40 mb-4 shadow-sm">
                <Box className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-2">No products yet</h3>
              <p className="text-sm text-muted-foreground mb-8 text-center max-w-md leading-relaxed">
                {canWrite
                  ? 'Create your first product to start threat modeling and secure your applications'
                  : 'No products available. Contact an administrator to create products.'}
              </p>
              {canWrite && (
                <Button onClick={() => setWizardOpen(true)} className="shadow-sm hover:shadow-md transition-all">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Product
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product, index) => {
              const productDiagrams = diagrams[product.id] || [];
              const diagramCount = productDiagrams.length;
              const isExpanded = !!expandedDiagrams[product.id];
              const visibleDiagrams = isExpanded ? productDiagrams : productDiagrams.slice(0, 3);

              return (
                <Card
                  key={product.id}
                  className="animate-fadeInUp group flex flex-col hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl border-border/60 overflow-hidden cursor-pointer"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-card-action], button, a, [role="menuitem"]')) return;
                    navigate(`/products/${product.id}`);
                  }}
                >
                  <CardHeader className="pb-3 pt-4 px-4">
                    {/* Title row: icon + name + menu */}
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/15 group-hover:scale-105 transition-all duration-300 cursor-pointer mt-0.5"
                        onClick={() => navigate(`/products/${product.id}`)}
                      >
                        <Box className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle
                          className="text-sm font-bold line-clamp-1 cursor-pointer hover:text-primary transition-colors leading-snug"
                          onClick={() => navigate(`/products/${product.id}`)}
                        >
                          {product.name}
                        </CardTitle>
                        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>
                            {new Date(product.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      {canWrite && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-card-action
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <ShareProductDialog
                              productId={product.id}
                              productName={product.name}
                              isPublic={product.is_public}
                              onProductUpdate={loadProducts}
                              trigger={
                                <DropdownMenuItem data-card-action onSelect={(e) => e.preventDefault()}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Share Product
                                </DropdownMenuItem>
                              }
                            />
                            <DropdownMenuSeparator />
                            <DropdownMenuItem data-card-action onClick={() => openEditDialog(product)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Product
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              data-card-action
                              onClick={() => openDeleteDialog(product)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {(product.status || product.business_area) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {product.status && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize h-5 px-2 font-semibold ${getStatusBadgeClass(product.status)}`}
                          >
                            {product.status}
                          </Badge>
                        )}
                        {product.business_area && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-2 font-medium">
                            {product.business_area}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {product.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-2.5">
                        {product.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic mt-2.5">No description</p>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 pt-0 px-4 pb-4">
                    {/* Diagrams panel */}
                    <div className="rounded-lg border border-border/60 overflow-hidden">
                      {/* Panel header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/40">
                        <div className="flex items-center gap-1.5">
                          <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold">Diagrams</span>
                        </div>
                        <Badge variant="secondary" className="text-[11px] h-5 px-1.5 font-mono">
                          {diagramCount}
                        </Badge>
                      </div>

                      {diagramCount === 0 ? (
                        <div className="flex flex-col items-center justify-center py-5 px-3 gap-2.5">
                          <FileText className="h-5 w-5 text-muted-foreground/40" />
                          <p className="text-xs text-muted-foreground font-medium">No diagrams yet</p>
                          {canWrite && (
                            <Button
                              variant="outline"
                              size="sm"
                              data-card-action
                              onClick={() => handleCreateDiagram(product.id)}
                              className="h-7 text-xs hover:bg-primary/5 hover:border-primary/30 transition-all"
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Create Diagram
                            </Button>
                          )}
                        </div>
                      ) : (
                        <>
                          {visibleDiagrams.map((diagram) => (
                            <div
                              key={diagram.id}
                              data-card-action
                              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer group/diagram border-b border-border/30 last:border-0"
                              onClick={() => navigate(`/diagrams?product=${product.id}&diagram=${diagram.id}`)}
                            >
                              <Grid3x3 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                              <span className="text-xs truncate font-medium flex-1 group-hover/diagram:text-primary transition-colors">
                                {diagram.name}
                              </span>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {canWrite && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        data-card-action
                                        className="h-5 w-5 p-0 opacity-0 group-hover/diagram:opacity-100 transition-all hover:bg-destructive/10 rounded"
                                        onClick={(e) => openDeleteDiagramDialog(e, diagram.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete diagram</TooltipContent>
                                  </Tooltip>
                                )}
                                <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover/diagram:text-primary group-hover/diagram:translate-x-0.5 transition-all" />
                              </div>
                            </div>
                          ))}
                          {diagramCount > 3 && (
                            <button
                              type="button"
                              data-card-action
                              className="w-full px-3 py-1.5 bg-muted/20 border-t border-border/30 text-center hover:bg-muted/30 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDiagrams((prev) => ({ ...prev, [product.id]: !isExpanded }));
                              }}
                            >
                              <span className="text-[11px] text-muted-foreground font-medium">
                                {isExpanded
                                  ? 'Show less'
                                  : `+${diagramCount - 3} more diagram${diagramCount - 3 > 1 ? 's' : ''}`}
                              </span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="px-4 pb-4 pt-2 flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      data-card-action
                      className="flex-1 shadow-sm hover:shadow-md transition-all"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View Details
                    </Button>
                    {canWrite && (
                      <Button
                        variant="outline"
                        size="sm"
                        data-card-action
                        className="flex-1 hover:border-primary/40 hover:bg-primary/5 transition-all shadow-sm hover:shadow"
                        onClick={() => handleCreateDiagram(product.id)}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        New Diagram
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product information. All fields except name are optional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Project status</Label>
              <Select
                value={formData.status || 'none'}
                onValueChange={(v) =>
                  setFormData({ ...formData, status: v === 'none' ? '' : (v as ProductStatus) })
                }
              >
                <SelectTrigger id="edit-status">
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-business-area">Business area</Label>
              <Input
                id="edit-business-area"
                value={formData.business_area}
                onChange={(e) => setFormData({ ...formData, business_area: e.target.value })}
                placeholder="e.g. Payments, Identity"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-owner-name">Owner name</Label>
                <Input
                  id="edit-owner-name"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-owner-email">Owner email</Label>
                <Input
                  id="edit-owner-email"
                  type="email"
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-repo">Repository URL</Label>
              <Input
                id="edit-repo"
                value={formData.repository_url}
                onChange={(e) => setFormData({ ...formData, repository_url: e.target.value })}
                placeholder="https://github.com/..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-confluence">Confluence URL</Label>
              <Input
                id="edit-confluence"
                value={formData.confluence_url}
                onChange={(e) => setFormData({ ...formData, confluence_url: e.target.value })}
                placeholder="https://company.atlassian.net/wiki/..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-app">Application URL</Label>
              <Input
                id="edit-app"
                value={formData.application_url}
                onChange={(e) => setFormData({ ...formData, application_url: e.target.value })}
                placeholder="https://app.example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Alert Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action
              cannot be undone and will delete all associated diagrams and threats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Diagram Alert Dialog */}
      <AlertDialog open={deleteDiagramOpen} onOpenChange={setDeleteDiagramOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Diagram</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this diagram? This action cannot be undone and will remove all associated threats and mitigations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDiagram} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Product Creation Wizard */}
      <CreateProductWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={loadProducts}
      />
    </div>
  );
}
