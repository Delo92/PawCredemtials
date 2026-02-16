import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  User,
  LogOut,
  Settings,
  Bell,
  Menu,
  X,
  LayoutDashboard,
  Mail,
  Phone,
} from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { config, getLevelName } = useConfig();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const getDashboardPath = () => {
    if (!user) return "/";
    switch (user.userLevel) {
      case 1: return "/dashboard/applicant";
      case 2: return "/dashboard/reviewer";
      case 3: return "/dashboard/agent";
      case 4: return "/dashboard/admin";
      case 5: return "/dashboard/owner";
      default: return "/";
    }
  };

  const getInitials = () => {
    if (!user) return "?";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Services", href: "/packages" },
    { label: "About", href: "/#about" },
    { label: "Contact", href: "/#contact" },
  ];

  return (
    <header className="sticky top-0 z-[997] w-full">
      <div className="bg-primary text-primary-foreground">
        <div className="container flex items-center justify-between h-10 text-sm">
          <div className="flex items-center gap-4">
            <a href={`mailto:${config.contactEmail || "contact@medilab.com"}`} className="flex items-center gap-1.5 text-primary-foreground/90 hover:text-primary-foreground transition-colors" data-testid="link-topbar-email">
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{config.contactEmail || "contact@medilab.com"}</span>
            </a>
            <a href={`tel:${config.contactPhone || "+1 5589 55488 55"}`} className="flex items-center gap-1.5 text-primary-foreground/90 hover:text-primary-foreground transition-colors" data-testid="link-topbar-phone">
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{config.contactPhone || "+1 5589 55488 55"}</span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="bg-background border-b shadow-sm">
        <div className="container flex items-center justify-between h-16">
          {showMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMenuClick}
              data-testid="button-menu-toggle"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
            <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--heading-color))' }} data-testid="text-site-name">
              {config.siteName}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" style={{ fontFamily: 'var(--font-nav)' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-[15px] font-normal transition-colors relative
                  ${location === link.href ? 'text-primary' : 'text-foreground hover:text-primary'}`}
                data-testid={`link-nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <Button variant="ghost" size="icon" data-testid="button-notifications">
                  <Bell className="h-5 w-5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-9 w-9 rounded-full"
                      data-testid="button-user-menu"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.firstName} />
                        <AvatarFallback>{getInitials()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none" data-testid="text-user-name">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground" data-testid="text-user-email">
                          {user.email}
                        </p>
                        <Badge variant="secondary" className="mt-1 w-fit text-xs">
                          {getLevelName(user.userLevel)}
                        </Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={getDashboardPath()} className="flex items-center gap-2 cursor-pointer" data-testid="link-dashboard">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2 cursor-pointer" data-testid="link-profile">
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2 cursor-pointer" data-testid="link-settings">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
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
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild data-testid="button-login" className="hidden sm:inline-flex">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild data-testid="button-register">
                  <Link href="/register">Get Started</Link>
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-nav"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t">
            <nav className="container py-4 flex flex-col gap-1" style={{ fontFamily: 'var(--font-nav)' }}>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-3 text-[15px] rounded-md transition-colors
                    ${location === link.href ? 'text-primary bg-primary/5' : 'text-foreground hover:text-primary hover:bg-primary/5'}`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`link-mobile-nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <Link
                  href="/login"
                  className="px-4 py-3 text-[15px] rounded-md transition-colors text-foreground hover:text-primary hover:bg-primary/5 sm:hidden"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="link-mobile-login"
                >
                  Log in
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
