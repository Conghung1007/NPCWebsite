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

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Clear all queries in cache
      queryClient.clear();
      setLocation("/");
    },
    onError: (error) => {
      console.error("Logout error:", error);
      // Even if logout API fails, clear cache and redirect
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
    { name: "Trang chủ", href: "/" },
    { name: "Dịch vụ xin\nthị thực", href: "/visa-services" },
    { name: "Tư vấn\ndu học", href: "/study-abroad" },
    { name: "Đào tạo\ntiếng Nhật", href: "/japanese-training" },
    { name: "Thi\ntrực tuyến", href: "/online-exam" },
    { name: "Tư vấn\nmiễn phí", href: "/contact" }
  ];

  return (
    <header className="bg-white/95 shadow-sm fixed top-0 left-0 right-0 z-[9999] w-full max-w-full overflow-x-hidden backdrop-blur-sm border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative w-full">
        <div className="flex justify-between items-center h-16 sm:h-20 w-4/5 max-w-4/5 mx-auto">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex flex-col items-center justify-center">
                <span className="text-xs sm:text-sm lg:text-base text-muted-foreground">Công ty</span>
                <span className="text-xs sm:text-sm lg:text-base text-muted-foreground">TNHH</span>
              </div>
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary">N&P</span>
            </Link>
          </div>

          {/* Desktop Navigation - Centered */}
          <div className="hidden lg:flex flex-1 justify-center">
            <div className="flex items-center space-x-3">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
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
            <Button variant="outline" size="sm" className="text-sm lg:text-base px-2 lg:px-3">
              VI
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="text-base">
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
                  <Button variant="outline" className="text-base">
                    Đăng nhập
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" className="text-base">
                    Đăng ký
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Tablet - Show Login/Register buttons */}
          <div className="hidden md:flex lg:hidden items-center space-x-2">
            <Button variant="outline" size="sm" className="text-sm px-2">
              VI
            </Button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-sm">
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
                  <Button variant="outline" size="sm" className="text-sm px-3">
                    Đăng nhập
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="sm" className="text-sm px-3">
                    Đăng ký
                  </Button>
                </Link>
              </>
            )}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-2">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 sm:w-80">
                <div className="flex flex-col space-y-3 mt-6">
                  {navigation.map((item) => (
                    <Link key={item.name} href={item.href}>
                      <span 
                        className={`block px-3 py-2.5 text-lg font-semibold rounded-lg transition-all text-center ${
                          item.name === "Tư vấn\nmiễn phí" 
                            ? "bg-primary text-white hover:bg-primary/90 shadow-md" 
                            : location === item.href 
                              ? "text-white bg-primary" 
                              : "text-foreground hover:text-primary hover:bg-primary/10"
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.name === "Tư vấn\nmiễn phí" ? (
                          <span>Tư vấn miễn phí</span>
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
              </SheetContent>
            </Sheet>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 sm:w-80">
                <div className="flex flex-col space-y-3 mt-6">
                  {navigation.map((item) => (
                    <Link key={item.name} href={item.href}>
                      <span 
                        className={`block px-3 py-2.5 text-lg font-semibold rounded-lg transition-all text-center ${
                          item.name === "Tư vấn\nmiễn phí" 
                            ? "bg-primary text-white hover:bg-primary/90 shadow-md" 
                            : location === item.href 
                              ? "text-white bg-primary" 
                              : "text-foreground hover:text-primary hover:bg-primary/10"
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.name === "Tư vấn\nmiễn phí" ? (
                          <span>Tư vấn miễn phí</span>
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
                  <div className="border-t pt-3 mt-4">
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="text-sm" onClick={() => setIsOpen(false)}>
                        VI
                      </Button>
                      {user ? (
                        <div className="flex-1 space-y-2">
                          <div className="text-sm text-center">
                            <span className="font-medium">{user.username}</span>
                            <br />
                            <span className="text-muted-foreground">({user.role})</span>
                          </div>
                          {(user.role === 'manager' || user.role === 'admin') && (
                            <Link href="/cpanel" className="block">
                              <Button 
                                variant="outline" 
                                className="w-full text-base" 
                                onClick={() => setIsOpen(false)}
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                Control Panel
                              </Button>
                            </Link>
                          )}
                          <Button 
                            variant="outline" 
                            className="w-full text-base" 
                            onClick={() => {
                              handleLogout();
                              setIsOpen(false);
                            }}
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Đăng xuất
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-1 space-y-2">
                          <Link href="/register" className="block">
                            <Button variant="default" className="w-full text-base" onClick={() => setIsOpen(false)}>
                              Đăng ký
                            </Button>
                          </Link>
                          <Link href="/login" className="block">
                            <Button variant="outline" className="w-full text-base" onClick={() => setIsOpen(false)}>
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
