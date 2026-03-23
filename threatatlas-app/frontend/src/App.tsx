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

function HeaderBreadcrumb() {
  const location = useLocation();

  const getPageInfo = () => {
    if (location.pathname.startsWith('/products/')) {
      return { title: 'Product Details', subtitle: 'Security analysis & overview' };
    }
    switch (location.pathname) {
      case '/': return { title: 'Dashboard', subtitle: 'Threat monitoring overview' };
      case '/products': return { title: 'Products', subtitle: 'Manage security products' };
      case '/diagrams': return { title: 'Diagrams', subtitle: 'Threat modeling canvas' };
      case '/analytics': return { title: 'Analytics', subtitle: 'Global statistics and overview' };
      case '/knowledge': return { title: 'Knowledge Base', subtitle: 'Threats & mitigations' };
      case '/users': return { title: 'User Management', subtitle: 'Manage users and invitations' };
      default: return { title: 'ThreatAtlas', subtitle: 'Security platform' };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <div className="flex items-center gap-4 animate-fadeIn">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-105">
        <Shield className="h-4 w-4 text-primary transition-transform duration-300 group-hover:rotate-12" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{pageInfo.title}</span>
        <span className="text-xs text-muted-foreground font-medium">{pageInfo.subtitle}</span>
      </div>
    </div>
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
        </main>
      </SidebarInset>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

