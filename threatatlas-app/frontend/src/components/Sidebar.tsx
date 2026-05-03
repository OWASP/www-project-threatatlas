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
    Settings,
} from 'lucide-react';
import { useState } from 'react';
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
    { name: 'Knowledge Base', href: '/knowledge', icon: Library },
];

export default function AppSidebar() {
    const location = useLocation();
    const { state, isMobile } = useSidebar();
    const { user, logout, isAdmin } = useAuth();
    const { theme, setTheme } = useTheme();

    const [logoutOpen, setLogoutOpen] = useState(false);

    const cycleTheme = () => {
        if (theme === 'light') setTheme('dark');
        else if (theme === 'dark') setTheme('system');
        else setTheme('light');
    };

    const themeIcon = theme === 'light' ? <Sun className="h-4 w-4" /> : theme === 'dark' ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
    const themeLabel = theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'System mode';
    const themeTooltip = theme === 'light' ? 'Switch to dark mode' : theme === 'dark' ? 'Switch to system mode' : 'Switch to light mode';

    const isCollapsed = state === 'collapsed';

    const displayName = user?.full_name || user?.username || '';
    const initials = displayName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const navButtonClass =
        'group relative rounded-lg text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground data-[active=true]:text-sidebar-accent-foreground';

    return (
        <Sidebar collapsible="icon">

            {/* ── Logo ────────────────────────────────────────────────── */}
            <SidebarHeader className="border-b border-sidebar-border group-data-[collapsible=icon]:pl-2 px-3 py-4 min-h-[81px] justify-center">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="hover:bg-sidebar-accent rounded-xl transition-all"
                            tooltip={isCollapsed ? "ThreatAtlas" : undefined}
                        >
                            <Link to="/" className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                                    <div
                                    className={`flex items-center justify-center shrink-0 rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-md transition-all duration-200 ${isCollapsed ? 'h-8 w-8' : 'h-10 w-10'
                                        }`}
                                >
                                    <Network className={`transition-all duration-200 ${isCollapsed ? 'h-4 w-4' : 'h-5 w-5'}`} />
                                </div>
                                {!isCollapsed && (
                                    <div className="flex flex-col items-start gap-0 min-w-0 truncate">
                                        <span className="font-semibold text-sm text-sidebar-foreground tracking-tight leading-tight truncate w-full">
                                            ThreatAtlas
                                        </span>
                                        <span className="text-[11px] text-sidebar-foreground/50 font-medium leading-tight truncate w-full">
                                            OWASP Project
                                        </span>
                                    </div>
                                )}
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {/* ── Main Navigation ──────────────────────────────────────── */}
            <SidebarContent className="py-4 group-data-[collapsible=icon]:pl-0 px-2">
                <SidebarGroup>
                    {!isCollapsed && (
                        <SidebarGroupLabel className="px-2 text-[10px] font-bold text-sidebar-foreground/40 tracking-widest mb-1">
                            NAVIGATION
                        </SidebarGroupLabel>
                    )}
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-0.5">
                            {navigation.map((item) => {
                                const isActive =
                                    location.pathname === item.href ||
                                    (item.href === '/products' &&
                                        location.pathname.startsWith('/products'));
                                return (
                                    <SidebarMenuItem key={item.name}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            className={navButtonClass}
                                            tooltip={item.name}
                                        >
                                            <Link to={item.href} className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                                <item.icon className="shrink-0 h-4 w-4" />
                                                {!isCollapsed && (
                                                    <span className="ml-2.5 text-sm">{item.name}</span>
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
                    <SidebarGroup className="mt-4">
                        {!isCollapsed && (
                            <SidebarGroupLabel className="px-2 text-[10px] font-bold text-sidebar-foreground/40 tracking-widest mb-1">
                                ADMIN
                            </SidebarGroupLabel>
                        )}
                        <SidebarGroupContent>
                            <SidebarMenu className="space-y-0.5">
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === '/settings'}
                                        className={navButtonClass}
                                        tooltip="Settings"
                                    >
                                        <Link to="/settings" className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                            <Settings className="shrink-0 h-4 w-4" />
                                            {!isCollapsed && <span className="ml-2.5 text-sm">Settings</span>}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* Changelog above footer */}
                <SidebarGroup className="mt-auto">
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-0.5">
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === '/changelog'}
                                    className={navButtonClass}
                                    tooltip="Changelog"
                                >
                                    <Link to="/changelog" className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                        <Notebook className="shrink-0 h-4 w-4" />
                                        {!isCollapsed && <span className="ml-2.5 text-sm">Changelog</span>}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:pl-2 p-2">
                <SidebarMenu className="space-y-0.5">
                    {user && (
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                        size="lg"
                                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                        tooltip={isCollapsed ? (displayName || user.email) : undefined}
                                    >
                                        <Avatar size="default" className="border border-primary/25 shadow-sm rounded-lg">
                                            <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold rounded-lg">
                                                {initials || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        {!isCollapsed && (
                                            <>
                                                <div className="grid flex-1 text-left text-sm leading-tight">
                                                    <span className="truncate font-medium text-sidebar-foreground">{displayName}</span>
                                                    <span className="truncate text-xs text-sidebar-foreground/60">{user.email}</span>
                                                </div>
                                                <ChevronsUpDown className="ml-auto h-4 w-4" />
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
                                            <Avatar size="default" className="border border-primary/25 shadow-sm rounded-lg">
                                                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold rounded-lg">
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
                                    <DropdownMenuItem onClick={cycleTheme}>
                                        {themeIcon}
                                        {themeLabel}
                                    </DropdownMenuItem>
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

