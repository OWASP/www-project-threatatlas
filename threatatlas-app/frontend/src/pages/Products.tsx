import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { productsApi, diagramsApi, type ProductStatus } from '@/lib/api';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      await productsApi.delete(selectedProduct.id);
      setDeleteOpen(false);
      setSelectedProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
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
    } catch (error) {
      console.error('Error deleting diagram:', error);
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
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-dashed animate-pulse rounded-xl">
                <CardHeader className="space-y-2">
                  <div className="h-5 bg-muted rounded-lg" />
                  <div className="h-4 bg-muted rounded-lg w-2/3" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded-lg" />
                    <div className="h-3 bg-muted rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="border-dashed border-2 rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/40 mb-4 shadow-sm">
                <Box className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No products yet</h3>
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

              return (
                <Card
                  key={product.id}
                  className="group flex flex-col hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl border-border/60"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animation: 'fadeInUp 0.5s ease-out forwards',
                    opacity: 0,
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 shrink-0 shadow-sm group-hover:shadow-md transition-all duration-300 cursor-pointer"
                        onClick={() => navigate(`/products/${product.id}`)}
                      >
                        <Box className="h-5 w-5 text-primary" />
                      </div>
                      {canWrite && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <ShareProductDialog
                              productId={product.id}
                              productName={product.name}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Share Product
                                </DropdownMenuItem>
                              }
                            />
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(product)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Product
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
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
                    <CardTitle
                      className="text-base font-bold line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      {product.name}
                    </CardTitle>
                    {(product.status || product.business_area) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
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
                    <CardDescription className="text-sm line-clamp-2 leading-relaxed">
                      {product.description || 'No description provided'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 pt-0 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        {new Date(product.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/20 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold">Diagrams</span>
                        </div>
                        <Badge variant="secondary" className="text-xs h-5 px-2 shadow-sm">
                          {diagramCount}
                        </Badge>
                      </div>

                      {diagramCount === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/60 p-3 text-center bg-background/50">
                          <FileText className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
                          <p className="text-xs text-muted-foreground mb-2.5 font-medium">
                            No diagrams yet
                          </p>
                          {canWrite && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreateDiagram(product.id)}
                              className="w-full h-7 text-xs hover:bg-primary/5 hover:border-primary/30 transition-all"
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Create Diagram
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {productDiagrams.slice(0, 3).map((diagram) => (
                            <div
                              key={diagram.id}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-background/80 transition-all duration-200 group/diagram cursor-pointer border border-transparent hover:border-border/60"
                              onClick={() =>
                                navigate(`/diagrams?product=${product.id}&diagram=${diagram.id}`)
                              }
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs truncate font-medium">{diagram.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {canWrite && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover/diagram:opacity-100 transition-all hover:bg-destructive/10"
                                    onClick={(e) => openDeleteDiagramDialog(e, diagram.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover/diagram:text-primary shrink-0 transition-colors" />
                              </div>
                            </div>
                          ))}
                          {diagramCount > 3 && (
                            <p className="text-xs text-muted-foreground text-center py-1 font-medium">
                              +{diagramCount - 3} more diagram{diagramCount - 3 > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-3 flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 shadow-sm hover:shadow-md transition-all"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 group-hover:border-primary/50 group-hover:bg-primary/5 transition-all shadow-sm hover:shadow"
                      onClick={() => handleCreateDiagram(product.id)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      New Diagram
                    </Button>
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

      {/* Delete Product Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action
              cannot be undone and will delete all associated diagrams and threats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
