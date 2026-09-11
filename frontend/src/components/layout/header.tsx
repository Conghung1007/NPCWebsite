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
import { navigateAppHref } from "@/lib/navigateAppHref";
import { usePortal } from "@/contexts/PortalContext";
import {
  getNavigation,
  portalHref,
  portalPath,
  filterNavByHiddenPaths,
  hiddenPathsForPortal,
  applyNavLabelOverrides,
  stripPortalPrefix,
  resolvePortalFromPath,
  GROUP_CONTACT_PATH,
  type NavItem,
  type PortalId,
} from "@/lib/portal";
import { useHiddenCmsPages, useCmsPageLabels } from "@/hooks/useCmsPages";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { TriNhanBrand, BRAND_FULL_NAME } from "@/components/TriNhanBrand";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const roleLabel: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  user: "Người dùng",
};

function userInitials(user: AppUser) {
  const source = user.fullName?.trim() || user.username;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function isActivePath(location: string, href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) return false;
  try {
    const url = new URL(href, "http://local.invalid");
    const pathOnly = stripPortalPrefix(url.pathname || "/").internalPath;
    if (pathOnly === "/") {
      return location === "/" || location === "";
    }
    return location === pathOnly || location.startsWith(`${pathOnly}/`);
  } catch {
    const raw = href.split("#")[0]?.split("?")[0] || "/";
    const pathOnly = stripPortalPrefix(raw).internalPath;
    if (pathOnly === "/") return location === "/" || location === "";
    return location === pathOnly || location.startsWith(`${pathOnly}/`);
  }
}

/** Which hub portal a top-row link represents (null = external / contact-only). */
function hubItemPortal(item: NavItem): PortalId | "contact" | null {
  if (item.external || /^https?:\/\//i.test(item.href)) return null;
  const path = item.href.split("?")[0]?.split("#")[0] || "/";
  const hash = item.href.includes("#")
    ? item.href.slice(item.href.indexOf("#") + 1)
    : "";
  if (
    path === GROUP_CONTACT_PATH ||
    path === "/contact" ||
    (path === "/" && hash === "tu-van")
  ) {
    return "contact";
  }
  return resolvePortalFromPath(path);
}

function isHubItemActive(
  item: NavItem,
  portal: PortalId,
  location: string,
): boolean {
  const kind = hubItemPortal(item);
  if (kind === "contact") {
    if (portal !== "group") return false;
    if (location === "/contact" || location === GROUP_CONTACT_PATH) return true;
    if (typeof window !== "undefined" && window.location.hash === "#tu-van") {
      return location === "/" || location === "";
    }
    return false;
  }
  if (!kind) return false;
  return portal === kind;
}

function Brand({
  compact = false,
  showTagline = true,
  portal = false,
}: {
  compact?: boolean;
  showTagline?: boolean;
  portal?: boolean;
}) {
  const { portal: portalId, meta } = usePortal();
  const { data: settings } = useSiteSettings(portalId);
  const brandName = settings?.siteName?.trim() || BRAND_FULL_NAME;

  return (
    <Link
      href={portalHref("group", "/")}
      className="flex items-center shrink-0 group"
      data-testid="header-logo"
      aria-label={`${brandName} — Trang chủ`}
    >
      <TriNhanBrand
        size={compact ? "sm" : portal ? "md" : "md"}
        imageAlt={brandName}
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

function NavLinkItem({
  item,
  location,
  mobile,
  onNavigate,
  respectHideBelowXl = true,
  stacked = false,
  forceActive,
  emphasize = false,
}: {
  item: NavItem;
  location: string;
  mobile?: boolean;
  onNavigate?: () => void;
  respectHideBelowXl?: boolean;
  stacked?: boolean;
  /** Override path-based active (used for hub portal pills). */
  forceActive?: boolean;
  /** Hub CTA (Tư vấn miễn phí) — stronger accent treatment */
  emphasize?: boolean;
}) {
  const active =
    forceActive ?? (!item.external && isActivePath(location, item.href));
  const [, setLocation] = useLocation();

  const ctaText =
    "font-semibold text-[#FF8800] hover:text-[#E67700]";

  const className = cn(
    "relative font-medium transition-[color,background,filter,box-shadow] duration-200 whitespace-nowrap",
    mobile
      ? cn(
          "block w-full text-left px-4 py-3 text-[15px] rounded-xl",
          emphasize
            ? cn(
                ctaText,
                active ? "bg-[#FF8800]/10" : "hover:bg-muted/70",
              )
            : active
              ? "text-primary bg-primary/8"
              : "text-foreground/85 hover:bg-muted/70 hover:text-foreground",
        )
      : stacked
        ? cn(
            "inline-flex shrink-0 items-center py-1.5 text-sm tracking-[0.01em]",
            respectHideBelowXl && item.hideBelowXl && "hidden xl:inline-flex",
            "rounded-full px-2.5 font-semibold text-[12px] xl:px-3.5 xl:text-[13px]",
            emphasize
              ? cn("normal-case tracking-[0.02em]", ctaText)
              : cn(
                  "uppercase tracking-[0.04em]",
                  active
                    ? "bg-[#00A651] text-white"
                    : "text-muted-foreground hover:text-foreground",
                ),
          )
        : cn(
            "inline-flex items-center px-3.5 py-2 text-[15px] xl:text-base font-semibold tracking-[0.01em]",
            respectHideBelowXl && item.hideBelowXl && "hidden xl:inline-flex",
            emphasize
              ? ctaText
              : active
                ? "rounded-full bg-[#00A651] px-3.5 text-white"
                : "text-muted-foreground hover:text-foreground",
          ),
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

  if (
    item.external ||
    /^https?:\/\//i.test(item.href) ||
    item.href.includes("?") ||
    item.href.includes("#")
  ) {
    const isExternal = item.external || /^https?:\/\//i.test(item.href);
    return (
      <a
        href={item.href}
        onClick={(e) => {
          if (isExternal) {
            onNavigate?.();
            return;
          }
          // Same-origin hash / query links: SPA navigate (avoid full reload freeze)
          e.preventDefault();
          onNavigate?.();
          navigateAppHref(item.href, setLocation);
        }}
        data-testid={`nav-link-${item.shortName}`}
        className={className}
        aria-current={active ? "page" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
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

/** Top row — always hub portals (Đào tạo → tnjs.vn). */
function HubNavLinks({
  location,
  className,
  onNavigate,
  mobile = false,
  respectHideBelowXl = true,
}: {
  location: string;
  className?: string;
  onNavigate?: () => void;
  mobile?: boolean;
  respectHideBelowXl?: boolean;
}) {
  const { portal } = usePortal();
  const { data: hidden } = useHiddenCmsPages();
  const { data: pageLabels } = useCmsPageLabels();
  const navigation = applyNavLabelOverrides(
    filterNavByHiddenPaths(
      getNavigation("group"),
      hiddenPathsForPortal(hidden?.entries, "group"),
    ),
    pageLabels?.entries,
    "group",
  );

  if (mobile) {
    return (
      <div className={cn("flex flex-col", className)}>
        {navigation.map((item) => {
          const kind = hubItemPortal(item);
          const active = isHubItemActive(item, portal, location);
          const showChildren =
            kind &&
            kind !== "contact" &&
            portal === kind &&
            portal !== "group";
          const children = showChildren
            ? applyNavLabelOverrides(
                filterNavByHiddenPaths(
                  getNavigation(portal),
                  hiddenPathsForPortal(hidden?.entries, portal),
                ),
                pageLabels?.entries,
                portal,
              )
            : [];

          return (
            <div key={`${item.href}-${item.shortName}`} className="w-full">
              <NavLinkItem
                item={item}
                location={location}
                mobile
                onNavigate={onNavigate}
                respectHideBelowXl={false}
                forceActive={active}
                emphasize={kind === "contact"}
              />
              {children.length > 0 && (
                <div className="ml-3 border-l border-border/60 pl-2 space-y-0.5 mb-1">
                  {children.map((child) => (
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
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      {navigation.map((item) => (
        <NavLinkItem
          key={`${item.href}-${item.shortName}`}
          item={item}
          location={location}
          onNavigate={onNavigate}
          respectHideBelowXl={respectHideBelowXl}
          forceActive={isHubItemActive(item, portal, location)}
          emphasize={hubItemPortal(item) === "contact"}
        />
      ))}
    </div>
  );
}

/** Second row — child pages of the active product portal. */
function PortalChildNavLinks({
  location,
  className,
  stacked = true,
}: {
  location: string;
  className?: string;
  stacked?: boolean;
}) {
  const { portal } = usePortal();
  const { data: hidden } = useHiddenCmsPages();
  const { data: pageLabels } = useCmsPageLabels();
  if (portal === "group") return null;

  const navigation = applyNavLabelOverrides(
    filterNavByHiddenPaths(
      getNavigation(portal),
      hiddenPathsForPortal(hidden?.entries, portal),
    ),
    pageLabels?.entries,
    portal,
  );

  return (
    <div className={cn("flex items-center", className)} aria-label="Trang trong cổng">
      {navigation.map((item) => (
        <NavLinkItem
          key={`${item.href}-${item.shortName}`}
          item={item}
          location={location}
          respectHideBelowXl={false}
          stacked={stacked}
        />
      ))}
    </div>
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
          <Avatar className="mr-1.5 h-6 w-6">
            <AvatarImage src={user.avatarUrl || undefined} alt="" />
            <AvatarFallback className="text-[10px] font-semibold text-primary">
              {userInitials(user)}
            </AvatarFallback>
          </Avatar>
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
    <Link href={portalPath("luyenthi", "/cart")} data-testid="nav-cart" className="shrink-0">
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
          <Button variant="outline" className="w-full justify-start h-11">
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
  }, [location, portal]);

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
              <a
                href={portalHref("group", "/")}
                className="inline-flex text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wide"
              >
                {BRAND_FULL_NAME}
              </a>
            )}
          </div>
          <HubNavLinks
            location={location}
            mobile
            onNavigate={closeMobile}
            className="flex-col items-stretch gap-0.5"
          />
          <div className="border-t border-border/70 mt-auto pt-5 space-y-3 pb-2">
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

      {/* Desktop: fixed primary row; child row expands downward only */}
      <nav className="mx-auto hidden w-full lg:block" aria-label="Điều hướng chính">
        <div
          className={cn(
            "mx-auto grid w-full max-w-[90rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-6 xl:gap-x-10 px-5 sm:px-8 lg:px-10 transition-[height] duration-300 ease-out",
            scrolled
              ? "h-[var(--header-primary-height-scrolled)]"
              : "h-[var(--header-primary-height)]",
          )}
        >
          <div className="flex min-w-0 items-center justify-start">
            <Brand
              portal={isSubPortal}
              compact={scrolled}
              showTagline={!scrolled && !isSubPortal}
            />
          </div>

          <div className="flex min-w-0 items-center justify-center">
            <HubNavLinks
              location={location}
              respectHideBelowXl={false}
              className="flex flex-nowrap items-center justify-center gap-x-0.5 xl:gap-x-1"
            />
          </div>

          <div className="flex items-center justify-end gap-3 shrink-0">
            {portal === "luyenthi" && (
              <div className="flex h-10 items-center">
                <CartButton />
              </div>
            )}
            <AuthActions user={user} onLogout={handleLogout} />
          </div>
        </div>

        <div
          className={cn(
            "grid w-full border-border/35 transition-[grid-template-rows,opacity,border-color] duration-300 ease-out",
            isSubPortal
              ? "grid-rows-[1fr] opacity-100 border-t"
              : "grid-rows-[0fr] opacity-0 border-t border-transparent pointer-events-none",
          )}
          aria-hidden={!isSubPortal}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className="mx-auto flex h-[var(--header-child-row-height)] w-full max-w-[90rem] items-center justify-center px-5 sm:px-8 lg:px-10"
            >
              {isSubPortal ? (
                <PortalChildNavLinks
                  location={location}
                  stacked
                  className="flex max-w-[min(100vw-12rem,42rem)] flex-nowrap items-center justify-center gap-x-1.5 overflow-x-auto overscroll-x-contain xl:gap-x-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                />
              ) : null}
            </div>
          </div>
        </div>
      </nav>

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
