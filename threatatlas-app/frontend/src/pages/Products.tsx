import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { productsApi, diagramsApi } from '@/lib/api';
import { toast } from 'sonner';
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

interface Product {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
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
      await productsApi.update(selectedProduct.id, formData);
      setEditOpen(false);
      setSelectedProduct(null);
      setFormData({ name: '', description: '' });
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
                  className="animate-fadeInUp group flex flex-col hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl border-border/60 overflow-hidden"
                  style={{ animationDelay: `${index * 50}ms` }}
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
                          {productDiagrams.slice(0, 3).map((diagram) => (
                            <div
                              key={diagram.id}
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
                            <div className="px-3 py-1.5 bg-muted/20 border-t border-border/30 text-center">
                              <span className="text-[11px] text-muted-foreground font-medium">
                                +{diagramCount - 3} more diagram{diagramCount - 3 > 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="px-4 pb-4 pt-2 flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
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
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
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
