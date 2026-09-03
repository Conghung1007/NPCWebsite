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
import { usePortal } from "@/contexts/PortalContext";
import { getNavigation, portalHref, portalPath, type NavItem } from "@/lib/portal";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { TriNhanBrand, BRAND_FULL_NAME } from "@/components/TriNhanBrand";

function getHeaderCta(portal: ReturnType<typeof usePortal>["portal"]) {
  if (portal === "luyenthi") {
    return null;
  }
  if (portal === "dichvu") {
    return {
      name: "Liên hệ dịch vụ",
      shortName: "Liên hệ",
      href: portalPath("dichvu", "/contact"),
    };
  }
  return {
    name: "Tư vấn miễn phí",
    shortName: "Tư vấn",
    href: "/contact",
  };
}

const roleLabel: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  user: "Người dùng",
};

function isActivePath(location: string, href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) return false;
  try {
    const url = new URL(href, "http://local.invalid");
    const pathOnly = url.pathname || "/";
    if (pathOnly === "/") {
      return location === "/" || location === "";
    }
    return location === pathOnly || location.startsWith(`${pathOnly}/`);
  } catch {
    const pathOnly = href.split("#")[0]?.split("?")[0] || "/";
    if (pathOnly === "/") return location === "/" || location === "";
    return location === pathOnly || location.startsWith(`${pathOnly}/`);
  }
}

function Brand({
  compact = false,
  showTagline = true,
  /** Sub-portal header: slightly tighter lockup */
  portal = false,
}: {
  compact?: boolean;
  showTagline?: boolean;
  portal?: boolean;
}) {
  const { portal: portalId, meta } = usePortal();
  const { data: settings } = useSiteSettings(portalId);
  const logoUrl = settings?.logoUrl?.trim() || "";
  const brandName = settings?.siteName?.trim() || BRAND_FULL_NAME;

  return (
    <Link
      href="/"
      className="flex items-center shrink-0 group"
      data-testid="header-logo"
      aria-label={`${brandName} — Trang chủ`}
    >
      <TriNhanBrand
        size={compact ? "sm" : portal ? "md" : "md"}
        imageUrl={logoUrl || undefined}
        imageAlt={brandName}
        preferDefaultImage={false}
        subtitle={
          showTagline && !compact
            ? portalId === "group"
              ? meta.tagline
              : meta.label
            : undefined
        }
      />
    </Link>
  );
}

function GroupHomeLink({ className }: { className?: string }) {
  return (
    <a
      href={portalHref("group", "/")}
      className={cn(
        "text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wide",
        className,
      )}
    >
      {BRAND_FULL_NAME}
    </a>
  );
}

function NavLinkItem({
  item,
  location,
  mobile,
  onNavigate,
  respectHideBelowXl = true,
  stacked = false,
}: {
  item: NavItem;
  location: string;
  mobile?: boolean;
  onNavigate?: () => void;
  respectHideBelowXl?: boolean;
  /** Bottom row of sub-portal header: larger type, no side padding (align with N&P Group) */
  stacked?: boolean;
}) {
  const active = !item.external && isActivePath(location, item.href);
  const tnjsNav = !mobile;
  const className = cn(
    "relative font-medium transition-colors duration-200 whitespace-nowrap",
    mobile
      ? "block w-full text-left px-4 py-3 text-[15px] rounded-xl"
      : stacked
        ? cn(
            "inline-flex shrink-0 items-center py-1.5 text-sm tracking-[0.01em]",
            respectHideBelowXl && item.hideBelowXl && "hidden xl:inline-flex",
            tnjsNav &&
              "rounded-full px-2.5 font-semibold uppercase tracking-[0.04em] text-[12px] xl:px-3.5 xl:text-[13px]",
            tnjsNav && active && "bg-[#00A651] text-white",
          )
        : cn(
            "inline-flex items-center px-3.5 py-2 text-sm tracking-[0.01em]",
            respectHideBelowXl && item.hideBelowXl && "hidden xl:inline-flex",
            tnjsNav && active && "rounded-full bg-[#00A651] px-3.5 text-white font-semibold",
          ),
    mobile
      ? active
        ? "text-primary bg-primary/8"
        : "text-foreground/85 hover:bg-muted/70 hover:text-foreground"
      : active && !tnjsNav
        ? "text-foreground"
        : !active
          ? "text-muted-foreground hover:text-foreground"
          : undefined,
  );

  const label = mobile ? item.name : item.shortName;

  if (item.children?.length && !mobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(className, "cursor-pointer")}
            data-testid={`nav-link-${item.shortName}`}
          >
            {label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[11rem]">
          <DropdownMenuItem asChild>
            <a href={item.href}>{item.name}</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {item.children.map((child) => (
            <DropdownMenuItem key={`${child.href}-${child.shortName}`} asChild>
              <a href={child.href}>{child.name}</a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (item.children?.length && mobile) {
    return (
      <div className="w-full">
        <a
          href={item.href}
          onClick={onNavigate}
          className={className}
          data-testid={`nav-link-${item.shortName}`}
        >
          {item.name}
        </a>
        <div className="ml-3 border-l border-border/60 pl-2 space-y-0.5">
          {item.children.map((child) => (
            <NavLinkItem
              key={`${child.href}-${child.shortName}`}
              item={child}
              location={location}
              mobile
              onNavigate={onNavigate}
              respectHideBelowXl={false}
            />
          ))}
        </div>
      </div>
    );
  }

  const inner = <>{label}</>;

  if (item.external || /^https?:\/\//i.test(item.href) || item.href.includes("?") || item.href.includes("#")) {
    return (
      <a
        href={item.href}
        onClick={onNavigate}
        data-testid={`nav-link-${item.shortName}`}
        className={className}
        aria-current={active ? "page" : undefined}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-testid={`nav-link-${item.href}`}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {inner}
    </Link>
  );
}

function NavLinks({
  location,
  className,
  onNavigate,
  mobile = false,
  respectHideBelowXl = true,
  stacked = false,
}: {
  location: string;
  className?: string;
  onNavigate?: () => void;
  mobile?: boolean;
  respectHideBelowXl?: boolean;
  stacked?: boolean;
}) {
  const { portal } = usePortal();
  const navigation = getNavigation(portal);

  return (
    <div className={cn("flex items-center", className)}>
      {navigation.map((item) => (
        <NavLinkItem
          key={`${item.href}-${item.shortName}`}
          item={item}
          location={location}
          mobile={mobile}
          onNavigate={onNavigate}
          respectHideBelowXl={respectHideBelowXl}
          stacked={stacked}
        />
      ))}
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
  const { portal } = usePortal();
  const cta = getHeaderCta(portal);
  if (!cta) return null;
  const active = isActivePath(location, cta.href);
  const classNames = cn(
    "font-semibold shadow-none whitespace-nowrap",
    size === "default" && "h-10 px-5",
    size === "sm" && "h-8 px-3.5 text-xs",
    "bg-[#FF8800] hover:bg-[#E67700] text-white uppercase tracking-wide font-bold",
    className,
  );
  const usesAnchor = cta.href.includes("?") || cta.href.includes("#");

  if (usesAnchor) {
    return (
      <a href={cta.href} onClick={onNavigate} data-testid={`nav-link-${cta.name}`}>
        <Button size={size} className={classNames}>
          <span className="sm:hidden">{cta.shortName}</span>
          <span className="hidden sm:inline">{cta.name}</span>
        </Button>
      </a>
    );
  }

  return (
    <Link href={cta.href} onClick={onNavigate} data-testid={`nav-link-${cta.href}`}>
      <Button
        size={size}
        aria-current={active ? "page" : undefined}
        className={classNames}
      >
        <span className="sm:hidden">{cta.shortName}</span>
        <span className="hidden sm:inline">{cta.name}</span>
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
          variant="ghost"
          size={size}
          className={cn(
            "text-sm font-medium text-muted-foreground hover:text-foreground",
            size === "default" && "h-10 px-3",
          )}
          data-testid="user-menu-button"
          aria-label={`Tài khoản ${user.username}`}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="mr-1.5 h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 mr-1.5 opacity-70" />
          )}
          <span className="max-w-[7.5rem] truncate">{user.username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100] w-48">
        <DropdownMenuItem disabled>
          <span className="font-medium">{roleLabel[user.role] || user.role}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile/exams" className="flex items-center cursor-pointer">
            <User className="w-4 h-4 mr-2" />
            Hồ sơ
          </Link>
        </DropdownMenuItem>
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
    <Link href="/cart" data-testid="nav-cart" className="shrink-0">
      <Button
        variant="outline"
        size={size}
        className={cn(
          "relative border-border/80 bg-transparent hover:bg-muted/50",
          size === "default" && "h-10 w-10 px-0",
          size === "sm" && "h-9 w-9 px-0",
        )}
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
    <div className="flex items-center gap-3">
      <Link href="/login">
        <Button
          variant="ghost"
          size={size}
          data-testid="login-button"
          className={cn(
            "font-medium text-muted-foreground hover:text-foreground",
            size === "default" && "h-10 px-3.5",
          )}
        >
          Đăng nhập
        </Button>
      </Link>
      <Link href="/register">
        <Button
          variant="outline"
          size={size}
          data-testid="register-button"
          className={cn(
            "font-medium border-border/80 bg-transparent hover:bg-muted/50",
            size === "default" && "h-10 px-3.5",
          )}
        >
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
        <div className="px-4 py-3 bg-muted/50 rounded-xl text-sm">
          <span className="font-medium">{user.username}</span>
          <br />
          <span className="text-muted-foreground text-xs">
            {roleLabel[user.role] || user.role}
          </span>
        </div>
        <Link href="/profile/exams" className="block" onClick={onNavigate}>
          <Button
            variant="outline"
            className="w-full justify-start h-11"
          >
            <User className="w-4 h-4 mr-2" />
            Hồ sơ
          </Button>
        </Link>
        {isStaff && (
          <Link href="/cpanel" className="block" onClick={onNavigate}>
            <Button
              variant="outline"
              className="w-full justify-start h-11"
              data-testid="cpanel-button-mobile"
            >
              <Settings className="w-4 h-4 mr-2" />
              Quản trị
            </Button>
          </Link>
        )}
        <Button
          variant="outline"
          className="w-full justify-start h-11"
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
        <Button className="w-full h-11" data-testid="register-button-mobile">
          Đăng ký
        </Button>
      </Link>
      <Link href="/login" className="block" onClick={onNavigate}>
        <Button
          variant="outline"
          className="w-full h-11"
          data-testid="login-button-mobile"
        >
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
  const { portal } = usePortal();
  const queryClient = useQueryClient();
  const isSubPortal = portal !== "group";
  const isLuyenthi = portal === "luyenthi";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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

  const mobileActions = (
    <div className="flex lg:hidden items-center gap-1.5">
      {isLuyenthi && <CartButton size="sm" />}
      <div className="hidden md:flex items-center gap-1.5">
        <AuthActions user={user} onLogout={handleLogout} size="sm" />
        {!isSubPortal && <ContactCta location={location} size="sm" />}
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 px-0"
            data-testid="mobile-menu-button"
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            aria-label={isOpen ? "Đóng menu" : "Mở menu"}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          id="mobile-navigation"
          className="w-[min(100%,20rem)] sm:w-80 flex flex-col px-5"
        >
          <div className="mt-6 mb-4 pb-4 border-b border-border/70 space-y-3">
            <Brand />
            {isSubPortal && (
              <GroupHomeLink className="inline-flex" />
            )}
          </div>
          <NavLinks
            location={location}
            mobile
            onNavigate={closeMobile}
            className="flex-col items-stretch gap-0.5"
          />
          <div className="border-t border-border/70 mt-auto pt-5 space-y-3 pb-2">
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
  );

  return (
    <header
      className={cn(
        "site-header transition-[background-color,box-shadow,border-color] duration-300 ease-out",
        isSubPortal && "site-header--stacked",
        scrolled
          ? "bg-white/90 border-b border-border/60 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl"
          : "bg-white/80 border-b border-transparent backdrop-blur-md",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[110] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Bỏ qua điều hướng
      </a>

      {/* Desktop: stacked layout for TNJS / Du học / Đào tạo */}
      {isSubPortal ? (
        <nav
          className={cn(
            "mx-auto hidden lg:grid w-full max-w-[90rem] px-5 sm:px-8 lg:px-10",
            "grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-2 gap-x-8 xl:gap-x-12 items-center",
            "transition-[padding] duration-300 ease-out",
            scrolled ? "py-1.5" : "py-2.5",
          )}
          aria-label="Điều hướng chính"
        >
          <div className="row-span-2 self-center">
            <Brand
              portal
              compact={scrolled}
              showTagline={!scrolled}
            />
          </div>

          <div className="flex items-center min-h-10 pl-6 xl:pl-10">
            <GroupHomeLink />
          </div>

          {/* Hàng trên: giỏ + auth; hàng dưới: CTA (ẩn trên cổng luyện thi — đã có trong nav) */}
          <div className="row-span-2 self-center flex items-start gap-3 shrink-0">
            {portal === "luyenthi" && (
              <div className="flex h-10 items-center">
                <CartButton />
              </div>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <AuthActions user={user} onLogout={handleLogout} />
              <ContactCta location={location} size="sm" />
            </div>
          </div>

          <div className="flex min-h-11 min-w-0 items-center pl-6 xl:pl-10">
            <NavLinks
              location={location}
              respectHideBelowXl={false}
              stacked
              className="flex w-full min-w-0 flex-nowrap items-center gap-x-2.5 overflow-x-auto overscroll-x-contain xl:gap-x-4 2xl:gap-x-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            />
          </div>
        </nav>
      ) : (
        <nav
          className={cn(
            "mx-auto hidden lg:flex w-full max-w-[90rem] items-center justify-between gap-6 sm:gap-8 px-5 sm:px-8 lg:px-10 transition-[height,padding] duration-300 ease-out",
            scrolled
              ? "h-[var(--header-height-scrolled)]"
              : "h-[var(--header-height)]",
          )}
          aria-label="Điều hướng chính"
        >
          <Brand compact={scrolled} />
          <NavLinks
            location={location}
            className="flex flex-1 justify-center gap-1 xl:gap-1.5"
          />
          <div className="flex items-center gap-4 shrink-0">
            <AuthActions user={user} onLogout={handleLogout} />
            <ContactCta location={location} />
          </div>
        </nav>
      )}

      {/* Mobile / tablet bar */}
      <nav
        className={cn(
          "mx-auto flex lg:hidden w-full max-w-[90rem] items-center justify-between gap-4 px-5 sm:px-8",
          scrolled
            ? "h-[var(--header-height-scrolled)]"
            : "h-[var(--header-height)]",
        )}
        aria-label="Điều hướng chính"
      >
        <Brand compact={scrolled} showTagline={false} />
        {mobileActions}
      </nav>
    </header>
  );
}
