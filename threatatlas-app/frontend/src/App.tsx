import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/Sidebar';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import ProductDetails from '@/pages/ProductDetails';
import Diagrams from '@/pages/Diagrams';
import KnowledgeBase from '@/pages/KnowledgeBase';
import Analytics from '@/pages/Analytics';
import Login from '@/pages/Login';
import Changelog from '@/pages/Changelog';
import AcceptInvitation from '@/pages/AcceptInvitation';
import UserManagement from '@/pages/UserManagement';
import { Separator } from '@/components/ui/separator';
import { Shield } from 'lucide-react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from 'next-themes';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

function HeaderBreadcrumb() {
  const location = useLocation();

  const getPageInfo = () => {
    if (location.pathname.startsWith('/products/')) {
      return { title: 'Product Details', parent: { title: 'Products', href: '/products' } };
    }
    switch (location.pathname) {
      case '/': return { title: 'Dashboard' };
      case '/products': return { title: 'Products' };
      case '/diagrams': return { title: 'Diagrams' };
      case '/analytics': return { title: 'Analytics' };
      case '/knowledge': return { title: 'Knowledge Base' };
      case '/users': return { title: 'User Management' };
      case '/changelog': return { title: 'Changelog' };
      default: return { title: 'ThreatAtlas' };
    }
  };

  const pageInfo = getPageInfo();
  const parent = 'parent' in pageInfo ? pageInfo.parent : null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Shield className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">ThreatAtlas</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {parent && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={parent.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {parent.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-semibold">{pageInfo.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function AppContent() {
  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-4 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 px-6 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="hover:bg-muted/70 transition-all duration-200 rounded-lg p-2 -ml-2 hover:scale-105" />
            <Separator orientation="vertical" className="h-7 bg-border/60" />
            <HeaderBreadcrumb />
          </div>
        </header>
        <main className="flex-1 bg-gradient-to-br from-background via-muted/20 to-background">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:productId" element={<ProductDetails />} />
              <Route path="/diagrams" element={<Diagrams />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/changelog" element={<Changelog />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </>
  );
}

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
            <Route path="/accept-invitation/:token" element={<ErrorBoundary><AcceptInvitation /></ErrorBoundary>} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <TooltipProvider>
                      <AppContent />
                    </TooltipProvider>
                  </SidebarProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster position="bottom-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

