import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  Home,
  FileText,
  CreditCard,
  MessageSquare,
  Settings,
  LogOut,
  Users,
  BarChart3,
  FolderOpen,
  ClipboardList,
  UserCheck,
  Building2,
  DollarSign,
  Bell,
  HelpCircle,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { config, getLevelName } = useConfig();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) {
    return null;
  }

  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [];

    switch (user.userLevel) {
      case 1: // Applicant
        return [
          { title: "Dashboard", href: "/dashboard/applicant", icon: Home },
          { title: "Registration", href: "/dashboard/applicant/registration", icon: FileText },
          { title: "Documents", href: "/dashboard/applicant/documents", icon: FolderOpen },
          { title: "Payments", href: "/dashboard/applicant/payments", icon: CreditCard },
          { title: "Messages", href: "/dashboard/applicant/messages", icon: MessageSquare },
          { title: "Settings", href: "/dashboard/applicant/settings", icon: Settings },
        ];
      case 2: // Reviewer
        return [
          { title: "Dashboard", href: "/dashboard/reviewer", icon: Home },
          { title: "Review Queue", href: "/dashboard/reviewer/queue", icon: ClipboardList },
          { title: "Completed Reviews", href: "/dashboard/reviewer/completed", icon: UserCheck },
          { title: "Messages", href: "/dashboard/reviewer/messages", icon: MessageSquare },
          { title: "Settings", href: "/dashboard/reviewer/settings", icon: Settings },
        ];
      case 3: // Agent
        return [
          { title: "Dashboard", href: "/dashboard/agent", icon: Home },
          { title: "Work Queue", href: "/dashboard/agent/queue", icon: ClipboardList },
          { title: "My Referrals", href: "/dashboard/agent/referrals", icon: Users },
          { title: "Commissions", href: "/dashboard/agent/commissions", icon: DollarSign },
          { title: "Messages", href: "/dashboard/agent/messages", icon: MessageSquare },
          { title: "Settings", href: "/dashboard/agent/settings", icon: Settings },
        ];
      case 4: // Admin
        return [
          { title: "Dashboard", href: "/dashboard/admin", icon: Home },
          { title: "Users", href: "/dashboard/admin/users", icon: Users },
          { title: "Applications", href: "/dashboard/admin/applications", icon: FileText },
          { title: "Queue Management", href: "/dashboard/admin/queue", icon: ClipboardList },
          { title: "Packages", href: "/dashboard/admin/packages", icon: Building2 },
          { title: "Payments", href: "/dashboard/admin/payments", icon: CreditCard },
          { title: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
          { title: "Messages", href: "/dashboard/admin/messages", icon: MessageSquare },
          { title: "Settings", href: "/dashboard/admin/settings", icon: Settings },
        ];
      case 5: // Owner
        return [
          { title: "Dashboard", href: "/dashboard/owner", icon: Home },
          { title: "Users", href: "/dashboard/owner/users", icon: Users },
          { title: "Applications", href: "/dashboard/owner/applications", icon: FileText },
          { title: "Packages", href: "/dashboard/owner/packages", icon: Building2 },
          { title: "Payments", href: "/dashboard/owner/payments", icon: CreditCard },
          { title: "Commissions", href: "/dashboard/owner/commissions", icon: DollarSign },
          { title: "Analytics", href: "/dashboard/owner/analytics", icon: BarChart3 },
          { title: "Site Settings", href: "/dashboard/owner/site-settings", icon: Building2 },
          { title: "My Settings", href: "/dashboard/owner/settings", icon: Settings },
        ];
      default:
        return baseItems;
    }
  };

  const navItems = getNavItems();

  const getInitials = () => {
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const isActive = (href: string) => {
    if (href === location) return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  const Sidebar = () => (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-col border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            {config.siteName.charAt(0)}
          </div>
          <span className="font-semibold">{config.siteName}</span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="text-xs" data-testid="badge-user-level">
            {getLevelName(user.userLevel)} Dashboard
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1 px-3">
        <nav className="flex flex-col gap-1 py-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 ${isActive(item.href) ? "bg-secondary" : ""}`}
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t p-3">
        <Link href="/help">
          <Button variant="ghost" className="w-full justify-start gap-3">
            <HelpCircle className="h-4 w-4" />
            Help & Support
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r bg-sidebar">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <Button variant="ghost" size="icon" data-testid="button-notifications">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatarUrl || undefined} alt={user.firstName} />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    <Badge variant="secondary" className="mt-1 w-fit text-xs">
                      {getLevelName(user.userLevel)}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
