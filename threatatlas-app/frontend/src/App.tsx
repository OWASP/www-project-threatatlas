import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/Sidebar';
import GlobalSearch from '@/components/GlobalSearch';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import ProductDetails from '@/pages/ProductDetails';
import Diagrams from '@/pages/Diagrams';
import KnowledgeBase from '@/pages/KnowledgeBase';
import ComponentLibrary from '@/pages/ComponentLibrary';
import Analytics from '@/pages/Analytics';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import Changelog from '@/pages/Changelog';
import About from '@/pages/About';
import UserGuide from '@/pages/UserGuide';
import Approvals from '@/pages/Approvals';
import AcceptInvitation from '@/pages/AcceptInvitation';
import UserManagement from '@/pages/UserManagement';
import Settings from '@/pages/Settings';
import { Separator } from '@/components/ui/separator';
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
import { BreadcrumbProvider, useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { Input } from '@/components/ui/input';
import NotificationBell from '@/components/NotificationBell';

function HeaderBreadcrumb() {
  const location = useLocation();
  const { extra } = useBreadcrumb();

  const getPageInfo = () => {
    if (location.pathname.startsWith('/products/')) {
      return { title: 'Product Details', parent: { title: 'Products', href: '/products' } };
    }
    switch (location.pathname) {
      case '/': return { title: 'Dashboard' };
      case '/products': return { title: 'Products' };
      case '/diagrams': return { title: 'Diagrams', parent: { title: 'Products', href: '/products' } };
      case '/analytics': return { title: 'Analytics' };
      case '/approvals': return { title: 'Approvals' };
      case '/knowledge': return { title: 'Knowledge Base' };
      case '/users': return { title: 'User Management' };
      case '/settings': return { title: 'Settings' };
      case '/changelog': return { title: 'Changelog' };
      case '/user-guide': return { title: 'User Guide' };
      default: return { title: 'ThreatAtlas' };
    }
  };

  const pageInfo = getPageInfo();
  const parent = 'parent' in pageInfo ? pageInfo.parent : null;

  // When there are extra dynamic crumbs (e.g. from Diagrams page), show those instead of the static page title
  const hasExtra = extra.length > 0;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <span className="hidden sm:inline">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {/* Only show static route crumbs when there are no dynamic overrides */}
        {!hasExtra && parent && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={parent.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {parent.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        )}
        {!hasExtra && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold">{pageInfo.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
        {/* Dynamic crumbs set by child pages (e.g. Diagrams: product → diagram name) */}
        {extra.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.editable && crumb.onChange ? (
                <Input
                  value={crumb.value ?? ''}
                  onChange={e => crumb.onChange!(e.target.value)}
                  className="h-7 border-none bg-transparent hover:bg-muted focus-visible:bg-muted transition-all duration-200 w-[100px] hover:w-[180px] focus:w-[180px] font-semibold text-sm focus-visible:ring-0 px-2"
                  placeholder="Diagram name"
                />
              ) : crumb.href ? (
                <BreadcrumbLink href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {crumb.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="font-semibold">{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <BreadcrumbProvider>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <AppSidebar />
      <SidebarInset className="overflow-hidden min-h-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <HeaderBreadcrumb />
          </div>
          <div className="flex items-center gap-1 px-4">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:productId" element={<ProductDetails />} />
              <Route path="/diagrams" element={<Diagrams />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/component-library" element={<ComponentLibrary />} />
              <Route path="/users" element={<div className="flex-1 w-full p-4 md:p-6 lg:p-8"><UserManagement /></div>} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/user-guide" element={<UserGuide />} />
              <Route path="/about" element={<About />} />
              <Route path="/approvals" element={<Approvals />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </BreadcrumbProvider>
  );
}

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
            <Route path="/auth/callback" element={<ErrorBoundary><AuthCallback /></ErrorBoundary>} />
            <Route path="/accept-invitation/:token" element={<ErrorBoundary><AcceptInvitation /></ErrorBoundary>} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="h-svh overflow-hidden flex">
                    <SidebarProvider>
                      <TooltipProvider>
                        <AppContent />
                      </TooltipProvider>
                    </SidebarProvider>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster position="bottom-right" richColors closeButton={false} />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

