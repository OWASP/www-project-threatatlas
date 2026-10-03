import { Link, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
    Box,
    ChevronsUpDown,
    LayoutDashboard,
    Library,
    Network,
    Moon,
    Sun,
    Monitor,
    LogOut,
    PieChart,
    Notebook,
    BookOpen,
    Settings,
    Package,
    ShieldCheck,
    Info,
    FileCode,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { approvalsApi } from '@/lib/api';
import PasswordChangeDialog from '@/components/PasswordChangeDialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarFooter,
    useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Products', href: '/products', icon: Box },
    { name: 'Analytics', href: '/analytics', icon: PieChart },
    { name: 'Approvals', href: '/approvals', icon: ShieldCheck },
    { name: 'Knowledge Base', href: '/knowledge', icon: Library },
    { name: 'Component Library', href: '/component-library', icon: Package },
];

export default function AppSidebar() {
    const location = useLocation();
    const { state, isMobile } = useSidebar();
    const { user, logout, isAdmin } = useAuth();
    const { theme, setTheme } = useTheme();

    const [logoutOpen, setLogoutOpen] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState(0);

    useEffect(() => {
        let cancelled = false;
        async function fetchCount() {
            try {
                const res = await approvalsApi.getCount();
                if (!cancelled) setPendingApprovals(res.data.count);
            } catch {
                // silently ignore — badge is non-critical
            }
        }
        fetchCount();
        const interval = setInterval(fetchCount, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const isCollapsed = state === 'collapsed';

    const displayName = user?.full_name || user?.username || '';
    const initials = displayName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <Sidebar collapsible="icon" variant="inset">

            {/* ── Logo ────────────────────────────────────────────────── */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild tooltip="ThreatAtlas">
                            <Link to="/">
                                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <Network className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">ThreatAtlas</span>
                                    <span className="truncate text-xs">OWASP Project</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {/* ── Main Navigation ──────────────────────────────────────── */}
            <SidebarContent>
                <SidebarGroup>
                    {!isCollapsed && (
                        <SidebarGroupLabel>
                            Navigation
                        </SidebarGroupLabel>
                    )}
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navigation.map((item) => {
                                const isActive =
                                    location.pathname === item.href ||
                                    (item.href === '/products' &&
                                        location.pathname.startsWith('/products'));
                                const showBadge = item.href === '/approvals' && pendingApprovals > 0;
                                return (
                                    <SidebarMenuItem key={item.name}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            tooltip={item.name}
                                        >
                                            <Link to={item.href}>
                                                <div className="relative shrink-0">
                                                    <item.icon />
                                                    {showBadge && isCollapsed && (
                                                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-white leading-none">
                                                            {pendingApprovals > 9 ? '9+' : pendingApprovals}
                                                        </span>
                                                    )}
                                                </div>
                                                {!isCollapsed && (
                                                    <span className="flex-1">{item.name}</span>
                                                )}
                                                {!isCollapsed && showBadge && (
                                                    <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-warning text-white text-[11px] font-bold leading-none">
                                                        {pendingApprovals > 99 ? '99+' : pendingApprovals}
                                                    </span>
                                                )}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Admin section */}
                {isAdmin && (
                    <SidebarGroup>
                        {!isCollapsed && (
                            <SidebarGroupLabel>
                                Admin
                            </SidebarGroupLabel>
                        )}
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === '/settings'}
                                        tooltip="Settings"
                                    >
                                        <Link to="/settings">
                                            <Settings />
                                            {!isCollapsed && <span >Settings</span>}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* Changelog + About above footer */}
                <SidebarGroup className="mt-auto">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === '/user-guide'}
                                    tooltip="User Guide"
                                >
                                    <Link to="/user-guide">
                                        <BookOpen />
                                        {!isCollapsed && <span>User Guide</span>}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="API Docs">
                                    <a href="/docs" target="_blank" rel="noopener noreferrer">
                                        <FileCode />
                                        {!isCollapsed && <span>API Docs</span>}
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === '/changelog'}
                                    tooltip="Changelog"
                                >
                                    <Link to="/changelog">
                                        <Notebook />
                                        {!isCollapsed && <span >Changelog</span>}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === '/about'}
                                    tooltip="About"
                                >
                                    <Link to="/about">
                                        <Info />
                                        {!isCollapsed && <span >About</span>}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <SidebarFooter>
                <SidebarMenu>
                    {user && (
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                        size="lg"
                                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                        tooltip={isCollapsed ? (displayName || user.email) : undefined}
                                    >
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarFallback className="rounded-lg">
                                                {initials || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        {!isCollapsed && (
                                            <>
                                                <div className="grid flex-1 text-left text-sm leading-tight">
                                                    <span className="truncate font-medium">{displayName}</span>
                                                    <span className="truncate text-xs">{user.email}</span>
                                                </div>
                                                <ChevronsUpDown className="ml-auto size-4" />
                                            </>
                                        )}
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="min-w-56 rounded-lg"
                                    side={isMobile ? 'bottom' : 'right'}
                                    align="end"
                                    sideOffset={4}
                                >
                                    <DropdownMenuLabel className="p-0 font-normal">
                                        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                            <Avatar className="h-8 w-8 rounded-lg">
                                                <AvatarFallback className="rounded-lg">
                                                    {initials || '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-medium">{displayName}</span>
                                                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <PasswordChangeDialog
                                        trigger={(
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                Change password
                                            </DropdownMenuItem>
                                        )}
                                    />
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Theme</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
                                        <DropdownMenuRadioItem value="light"><Sun className="h-4 w-4" />Light</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="dark"><Moon className="h-4 w-4" />Dark</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="system"><Monitor className="h-4 w-4" />System</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => setLogoutOpen(true)}
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Log out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />

            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Log out</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to log out? Any unsaved changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={logout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Log out
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sidebar>
    );
}

