import { Link, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
    Box,
    LayoutDashboard,
    Library,
    Network,
    Moon,
    Sun,
    Monitor,
    LogOut,
    Users,
    PieChart,
    Notebook
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
    { name: 'Changelog', href: '/changelog', icon: Notebook },
];

export default function AppSidebar() {
    const location = useLocation();
    const { state } = useSidebar();
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

    // Nav item container classes — uses sidebar tokens so they respond to light/dark.
    const navItemClass = (active: boolean) =>
        `relative transition-colors duration-150 rounded-lg group ${active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`;

    // Icon classes — primary colour for the active icon gives a clear accent.
    const navIconClass = (active: boolean) =>
        `shrink-0 h-4 w-4 transition-colors ${active
            ? 'text-primary'
            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
        }`;

    return (
        <Sidebar collapsible="icon">

            {/* ── Logo ────────────────────────────────────────────────── */}
            <SidebarHeader className="border-b border-sidebar-border group-data-[collapsible=icon]:pl-2 px-3 py-4">
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
                                    className={`flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md transition-all duration-200 ${isCollapsed ? 'h-8 w-8' : 'h-10 w-10'
                                        }`}
                                >
                                    <Network className={`transition-all duration-200 ${isCollapsed ? 'h-4 w-4' : 'h-5 w-5'}`} />
                                </div>
                                {!isCollapsed && (
                                    <div className="flex flex-col items-start gap-0 min-w-0 truncate">
                                        <span className="font-bold text-sm text-sidebar-foreground tracking-tight leading-tight truncate w-full">
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
                                            className={navItemClass(isActive)}
                                            tooltip={item.name}
                                        >
                                            <Link to={item.href} className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                                <item.icon className={navIconClass(isActive)} />
                                                {!isCollapsed && (
                                                    <span className="ml-2.5 text-sm">{item.name}</span>
                                                )}
                                                {isActive && !isCollapsed && (
                                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 h-4/6 w-0.5 rounded-l-full bg-primary" />
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
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === '/users'}
                                        className={navItemClass(location.pathname === '/users')}
                                        tooltip="User Management"
                                    >
                                        <Link to="/users" className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                            <Users className={navIconClass(location.pathname === '/users')} />
                                            {!isCollapsed && <span className="ml-2.5 text-sm">User Management</span>}
                                            {location.pathname === '/users' && !isCollapsed && (
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-4/6 w-0.5 rounded-l-full bg-primary" />
                                            )}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:pl-2 p-2 space-y-1">
                {/* User avatar + info */}
                {user && (
                    <div
                        className={`flex items-center py-2 rounded-lg ${isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2'
                            }`}
                    >
                        <Avatar size="default" className="border border-primary/25 shadow-sm">
                            <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                                {initials || '?'}
                            </AvatarFallback>
                        </Avatar>
                        {!isCollapsed && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                                    {displayName}
                                </span>
                                <span className="text-[11px] text-sidebar-foreground/50 truncate leading-tight">
                                    {user.email}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <SidebarMenu className="space-y-0.5">
                    <SidebarMenuItem className={isCollapsed ? "flex justify-center" : ""}>
                        <PasswordChangeDialog collapsed={isCollapsed} />
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={cycleTheme}
                            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 rounded-lg"
                            tooltip={themeTooltip}
                        >
                            {themeIcon}
                            {!isCollapsed && <span className="text-sm">{themeLabel}</span>}
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => setLogoutOpen(true)}
                            className="text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors duration-150 rounded-lg"
                            tooltip="Log out"
                        >
                            <LogOut className="h-4 w-4" />
                            {!isCollapsed && <span className="text-sm">Log out</span>}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
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

