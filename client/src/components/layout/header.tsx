import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Menu, User, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function Header() {
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
    onError: (error) => {
      console.error("Logout error:", error);
      queryClient.clear();
      setLocation("/");
    }
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const services = [
    {
      title: "Dịch vụ xin thị thực",
      href: "/visa-services",
      description: "Hỗ trợ xin visa cho hơn 50 quốc gia"
    },
    {
      title: "Tư vấn du học",
      href: "/study-abroad",
      description: "Tư vấn du học Nhật, Mỹ, Canada, Châu Âu"
    },
    {
      title: "Đào tạo tiếng Nhật",
      href: "/japanese-training",
      description: "Khóa học tiếng Nhật từ cơ bản đến nâng cao"
    },
    {
      title: "Thi trực tuyến",
      href: "/online-exam",
      description: "Kiểm tra trình độ với các đề thi"
    }
  ];

  const navigation = [
    { name: "Trang chủ", href: "/", mobileName: "Trang chủ" },
    { name: "Dịch vụ xin\nthị thực", href: "/visa-services", mobileName: "Dịch vụ xin thị thực" },
    { name: "Tư vấn\ndu học", href: "/study-abroad", mobileName: "Tư vấn du học" },
    { name: "Đào tạo\ntiếng Nhật", href: "/japanese-training", mobileName: "Đào tạo tiếng Nhật" },
    { name: "Thi\ntrực tuyến", href: "/online-exam", mobileName: "Thi trực tuyến" },
    { name: "Tư vấn\nmiễn phí", href: "/contact", mobileName: "Tư vấn miễn phí" }
  ];

  return (
    <header className="bg-white/95 shadow-md fixed top-0 left-0 right-0 z-[9999] w-full max-w-full overflow-x-hidden backdrop-blur-sm border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative w-full">
        <div className="flex justify-between items-center h-16 sm:h-20 w-full lg:w-4/5 max-w-full lg:max-w-4/5 lg:mx-auto">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 sm:gap-3" data-testid="header-logo">
              <div className="flex flex-col items-center justify-center leading-tight">
                <span className="text-[clamp(0.625rem,1.5vw,0.875rem)] text-muted-foreground whitespace-nowrap">Công ty</span>
                <span className="text-[clamp(0.625rem,1.5vw,0.875rem)] text-muted-foreground whitespace-nowrap">TNHH</span>
              </div>
              <span className="text-[clamp(1.75rem,5vw,3rem)] font-bold text-primary leading-none">N&P</span>
            </Link>
          </div>

          {/* Desktop Navigation - Centered */}
          <div className="hidden lg:flex flex-1 justify-center">
            <div className="flex items-center space-x-3">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href} data-testid={`nav-link-${item.href}`}>
                  <span className={`px-3 py-2 text-base font-semibold transition-all duration-200 rounded-lg text-center leading-tight flex flex-col items-center justify-center h-12 ${
                    item.name === "Tư vấn\nmiễn phí" 
                      ? "min-w-[140px] bg-primary text-white hover:bg-primary/90 shadow-md" 
                      : location === item.href 
                        ? "min-w-[110px] text-white bg-primary shadow-md" 
                        : "min-w-[110px] text-foreground hover:text-primary hover:bg-primary/10"
                  }`}>
                    {item.name === "Tư vấn\nmiễn phí" ? (
                      <span className="whitespace-nowrap">Tư vấn miễn phí</span>
                    ) : (
                      item.name.split('\n').map((line, index) => (
                        <span key={index} className="block">
                          {line}
                        </span>
                      ))
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-3 lg:space-x-4">
            <Button variant="outline" size="sm" className="text-sm lg:text-base px-2 lg:px-3" data-testid="language-button">
              VI
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="text-base" data-testid="user-menu-button">
                    <User className="w-4 h-4 mr-2" />
                    {user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[10000]">
                  <DropdownMenuItem disabled>
                    <span className="font-medium">{user.role}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(user.role === 'manager' || user.role === 'admin') && (
                    <DropdownMenuItem asChild>
                      <Link href="/cpanel" className="flex items-center">
                        <Settings className="w-4 h-4 mr-2" />
                        Control Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="outline" className="text-base" data-testid="login-button">
                    Đăng nhập
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" className="text-base" data-testid="register-button">
                    Đăng ký
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Tablet - Show Login/Register buttons */}
          <div className="hidden md:flex lg:hidden items-center space-x-2">
            <Button variant="outline" size="sm" className="text-sm px-2" data-testid="language-button-tablet">
              VI
            </Button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-sm" data-testid="user-menu-button-tablet">
                    <User className="w-4 h-4 mr-1" />
                    {user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[10000]">
                  <DropdownMenuItem disabled>
                    <span className="font-medium">{user.role}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(user.role === 'manager' || user.role === 'admin') && (
                    <DropdownMenuItem asChild>
                      <Link href="/cpanel" className="flex items-center">
                        <Settings className="w-4 h-4 mr-2" />
                        Control Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" size="sm" className="text-sm px-3" data-testid="login-button-tablet">
                    Đăng nhập
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="sm" className="text-sm px-3" data-testid="register-button-tablet">
                    Đăng ký
                  </Button>
                </Link>
              </>
            )}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-2" data-testid="mobile-menu-button-tablet">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 sm:w-80">
                <div className="flex flex-col space-y-2 mt-6">
                  {navigation.map((item) => (
                    <Link 
                      key={item.name} 
                      href={item.href}
                      className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all text-left ${
                        item.mobileName === "Tư vấn miễn phí" 
                          ? "bg-primary text-white hover:bg-primary/90 shadow-md" 
                          : location === item.href 
                            ? "text-white bg-primary" 
                            : "text-foreground hover:text-primary hover:bg-primary/10"
                      }`}
                      onClick={() => setIsOpen(false)}
                      data-testid={`mobile-nav-${item.href}`}
                    >
                      {item.mobileName}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="mobile-menu-button">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 sm:w-80">
                <div className="flex flex-col space-y-2 mt-6">
                  {navigation.map((item) => (
                    <Link 
                      key={item.name} 
                      href={item.href}
                      className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all text-left ${
                        item.mobileName === "Tư vấn miễn phí" 
                          ? "bg-primary text-white hover:bg-primary/90 shadow-md" 
                          : location === item.href 
                            ? "text-white bg-primary" 
                            : "text-foreground hover:text-primary hover:bg-primary/10"
                      }`}
                      onClick={() => setIsOpen(false)}
                      data-testid={`mobile-nav-${item.href}`}
                    >
                      {item.mobileName}
                    </Link>
                  ))}
                  <div className="border-t pt-4 mt-4">
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full text-sm justify-start" onClick={() => setIsOpen(false)} data-testid="language-button-mobile">
                        VI
                      </Button>
                      {user ? (
                        <div className="space-y-2">
                          <div className="text-sm px-4 py-2 bg-gray-50 rounded-lg">
                            <span className="font-medium">{user.username}</span>
                            <br />
                            <span className="text-muted-foreground">({user.role})</span>
                          </div>
                          {(user.role === 'manager' || user.role === 'admin') && (
                            <Link href="/cpanel" className="block">
                              <Button 
                                variant="outline" 
                                className="w-full text-base justify-start" 
                                onClick={() => setIsOpen(false)}
                                data-testid="cpanel-button-mobile"
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                Control Panel
                              </Button>
                            </Link>
                          )}
                          <Button 
                            variant="outline" 
                            className="w-full text-base justify-start" 
                            onClick={() => {
                              handleLogout();
                              setIsOpen(false);
                            }}
                            data-testid="logout-button-mobile"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Đăng xuất
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Link href="/register" className="block">
                            <Button variant="default" className="w-full text-base" onClick={() => setIsOpen(false)} data-testid="register-button-mobile">
                              Đăng ký
                            </Button>
                          </Link>
                          <Link href="/login" className="block">
                            <Button variant="outline" className="w-full text-base" onClick={() => setIsOpen(false)} data-testid="login-button-mobile">
                              Đăng nhập
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
