import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Menu, User, LogOut, Settings, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User as AppUser } from "@shared/schema";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Trang chủ", href: "/", shortName: "Trang chủ" },
  { name: "Dịch vụ xin thị thực", href: "/visa-services", shortName: "Visa" },
  { name: "Tư vấn du học", href: "/study-abroad", shortName: "Du học" },
  { name: "Đào tạo tiếng Nhật", href: "/japanese-training", shortName: "Tiếng Nhật" },
  { name: "Thi trực tuyến", href: "/online-exam", shortName: "Thi online" },
] as const;

const CTA = { name: "Tư vấn miễn phí", href: "/contact" } as const;

const roleLabel: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  user: "Người dùng",
};

function isActivePath(location: string, href: string) {
  if (href === "/") return location === "/";
  return location === href || location.startsWith(`${href}/`);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 sm:gap-3 shrink-0 group"
      data-testid="header-logo"
      aria-label="N&P Company — Trang chủ"
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-sm group-hover:bg-[hsl(142,76%,30%)] transition-all",
          compact ? "h-9 w-9 text-xs" : "h-10 w-10 sm:h-11 sm:w-11 text-sm sm:text-base",
        )}
        aria-hidden
      >
        N&P
      </span>
      <span className="flex flex-col leading-tight min-w-0">
        <span
          className={cn(
            "font-bold text-primary tracking-tight transition-all",
            compact ? "text-base sm:text-lg" : "text-lg sm:text-xl",
          )}
        >
          N&P Company
        </span>
        {!compact && (
          <span className="hidden sm:block text-[11px] text-muted-foreground whitespace-nowrap">
            Công ty TNHH N&P
          </span>
        )}
      </span>
    </Link>
  );
}

function NavLinks({
  location,
  className,
  onNavigate,
  compact = false,
  showCta = true,
}: {
  location: string;
  className?: string;
  onNavigate?: () => void;
  compact?: boolean;
  showCta?: boolean;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      {navigation.map((item) => {
        const active = isActivePath(location, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-testid={`nav-link-${item.href}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap",
              compact ? "block w-full text-left" : "text-center",
              active
                ? "text-white bg-primary shadow-sm"
                : "text-foreground hover:text-primary hover:bg-primary/10",
            )}
          >
            {compact ? item.name : item.shortName}
          </Link>
        );
      })}
      {showCta && (
        <Link
          href={CTA.href}
          onClick={onNavigate}
          data-testid={`nav-link-${CTA.href}`}
          aria-current={isActivePath(location, CTA.href) ? "page" : undefined}
          className={cn(
            "px-3 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shadow-sm",
            compact ? "block w-full text-left mt-1" : "ml-1",
            isActivePath(location, CTA.href)
              ? "bg-primary text-white hover:bg-[hsl(142,76%,30%)]"
              : "bg-primary text-primary-foreground hover:bg-[hsl(142,76%,30%)]",
          )}
        >
          {CTA.name}
        </Link>
      )}
    </div>
  );
}

function ContactCta({
  location,
  size = "default",
  className,
  onNavigate,
}: {
  location: string;
  size?: "default" | "sm";
  className?: string;
  onNavigate?: () => void;
}) {
  const active = isActivePath(location, CTA.href);
  return (
    <Link href={CTA.href} onClick={onNavigate} data-testid={`nav-link-${CTA.href}`}>
      <Button
        size={size}
        aria-current={active ? "page" : undefined}
        className={cn(
          "shadow-sm whitespace-nowrap",
          className,
        )}
      >
        {CTA.name}
      </Button>
    </Link>
  );
}

function UserMenu({
  user,
  onLogout,
  size = "default",
}: {
  user: AppUser;
  onLogout: () => void;
  size?: "default" | "sm";
}) {
  const isStaff = user.role === "manager" || user.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className="text-sm"
          data-testid="user-menu-button"
          aria-label={`Tài khoản ${user.username}`}
        >
          <User className="w-4 h-4 mr-1.5" />
          <span className="max-w-[8rem] truncate">{user.username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100]">
        <DropdownMenuItem disabled>
          <span className="font-medium">{roleLabel[user.role] || user.role}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isStaff && (
          <DropdownMenuItem asChild>
            <Link href="/cpanel" className="flex items-center cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              Quản trị
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CartButton({ size = "default" }: { size?: "default" | "sm" }) {
  const { itemCount } = useCart();
  return (
    <Link href="/cart" data-testid="nav-cart">
      <Button
        variant="outline"
        size={size}
        className="relative"
        aria-label={`Giỏ hàng${itemCount ? `, ${itemCount} mục` : ""}`}
      >
        <ShoppingCart className="w-4 h-4" />
        {itemCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {itemCount > 9 ? "9+" : itemCount}
          </span>
        )}
      </Button>
    </Link>
  );
}

function AuthActions({
  user,
  onLogout,
  size = "default",
}: {
  user: AppUser | null | undefined;
  onLogout: () => void;
  size?: "default" | "sm";
}) {
  if (user) {
    return <UserMenu user={user} onLogout={onLogout} size={size} />;
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/login">
        <Button variant="outline" size={size} data-testid="login-button">
          Đăng nhập
        </Button>
      </Link>
      <Link href="/register">
        <Button size={size} data-testid="register-button">
          Đăng ký
        </Button>
      </Link>
    </div>
  );
}

function MobileAuth({
  user,
  onLogout,
  onNavigate,
}: {
  user: AppUser | null | undefined;
  onLogout: () => void;
  onNavigate: () => void;
}) {
  if (user) {
    const isStaff = user.role === "manager" || user.role === "admin";
    return (
      <div className="space-y-2">
        <div className="px-4 py-2 bg-muted/60 rounded-lg text-sm">
          <span className="font-medium">{user.username}</span>
          <br />
          <span className="text-muted-foreground">
            ({roleLabel[user.role] || user.role})
          </span>
        </div>
        {isStaff && (
          <Link href="/cpanel" className="block" onClick={onNavigate}>
            <Button
              variant="outline"
              className="w-full justify-start"
              data-testid="cpanel-button-mobile"
            >
              <Settings className="w-4 h-4 mr-2" />
              Quản trị
            </Button>
          </Link>
        )}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => {
            onLogout();
            onNavigate();
          }}
          data-testid="logout-button-mobile"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Đăng xuất
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Link href="/register" className="block" onClick={onNavigate}>
        <Button className="w-full" data-testid="register-button-mobile">
          Đăng ký
        </Button>
      </Link>
      <Link href="/login" className="block" onClick={onNavigate}>
        <Button variant="outline" className="w-full" data-testid="login-button-mobile">
          Đăng nhập
        </Button>
      </Link>
    </div>
  );
}

export function Header() {
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
    onError: () => {
      queryClient.clear();
      setLocation("/");
    },
  });

  const handleLogout = () => logoutMutation.mutate();
  const closeMobile = () => setIsOpen(false);

  return (
    <header
      className={cn(
        "site-header bg-white/95 border-b border-border/80 backdrop-blur-sm transition-all duration-200",
        scrolled ? "shadow-md" : "shadow-sm",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[110] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Bỏ qua điều hướng
      </a>

      <nav
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 transition-[height] duration-200",
          scrolled ? "h-14" : "h-[var(--header-height)]",
        )}
        aria-label="Điều hướng chính"
      >
        <Brand compact={scrolled} />

        <NavLinks
          location={location}
          showCta={false}
          className="hidden lg:flex flex-1 justify-center gap-0.5"
        />

        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <CartButton />
          <ContactCta location={location} />
          <AuthActions user={user} onLogout={handleLogout} />
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <CartButton size="sm" />
          <div className="hidden md:flex items-center gap-2">
            <ContactCta location={location} size="sm" />
            <AuthActions user={user} onLogout={handleLogout} size="sm" />
          </div>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                data-testid="mobile-menu-button"
                aria-expanded={isOpen}
                aria-controls="mobile-navigation"
                aria-label={isOpen ? "Đóng menu" : "Mở menu"}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              id="mobile-navigation"
              className="w-72 sm:w-80 flex flex-col"
            >
              <div className="mt-8 mb-4">
                <Brand />
              </div>
              <NavLinks
                location={location}
                compact
                showCta={false}
                onNavigate={closeMobile}
                className="flex-col items-stretch gap-1"
              />
              <div className="border-t mt-4 pt-4 space-y-3">
                <ContactCta
                  location={location}
                  className="w-full md:hidden"
                  onNavigate={closeMobile}
                />
                <div className="md:hidden">
                  <MobileAuth
                    user={user}
                    onLogout={handleLogout}
                    onNavigate={closeMobile}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
