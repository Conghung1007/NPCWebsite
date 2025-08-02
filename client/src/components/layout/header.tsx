import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

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
      title: "Bán vé máy bay",
      href: "/flight-tickets",
      description: "Vé máy bay giá tốt, hỗ trợ 24/7"
    }
  ];

  const navigation = [
    { name: "Trang chủ", href: "/" },
    { name: "Dịch vụ xin\nthị thực", href: "/visa-services" },
    { name: "Tư vấn\ndu học", href: "/study-abroad" },
    { name: "Đào tạo\ntiếng Nhật", href: "/japanese-training" },
    { name: "Bán vé\nmáy bay", href: "/flight-tickets" },
    { name: "Liên hệ", href: "/contact" }
  ];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="flex flex-col items-center justify-center">
                <span className="text-base text-muted-foreground">Công ty</span>
                <span className="text-base text-muted-foreground">TNHH</span>
              </div>
              <span className="text-3xl font-bold text-primary">N&P</span>
            </Link>
          </div>

          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2">
            <div className="flex items-center space-x-3">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <span className={`px-3 py-2 text-base font-semibold transition-all duration-200 rounded-lg text-center leading-tight min-w-[110px] flex flex-col items-center justify-center h-12 ${
                    location === item.href 
                      ? "text-white bg-primary shadow-md" 
                      : "text-foreground hover:text-primary hover:bg-primary/10"
                  }`}>
                    {item.name.split('\n').map((line, index) => (
                      <span key={index} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Button variant="outline" size="sm" className="text-base">
              VI
            </Button>
            <Link href="/contact">
              <Button className="btn-primary text-base">
                Tư vấn miễn phí
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col space-y-4 mt-8">
                  {navigation.map((item) => (
                    <Link key={item.name} href={item.href}>
                      <span 
                        className={`block px-4 py-3 text-xl font-semibold rounded-lg transition-all text-center ${
                          location === item.href 
                            ? "text-white bg-primary" 
                            : "text-foreground hover:text-primary hover:bg-primary/10"
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.name.split('\n').map((line, index) => (
                          <span key={index} className="block">
                            {line}
                          </span>
                        ))}
                      </span>
                    </Link>
                  ))}
                  <div className="border-t pt-4">
                    <Link href="/contact">
                      <Button className="w-full btn-primary" onClick={() => setIsOpen(false)}>
                        Tư vấn miễn phí
                      </Button>
                    </Link>
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
