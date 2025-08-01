import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ChevronDown } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

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
    { name: "Giới thiệu", href: "/about-us" },
    { name: "Liên hệ", href: "/contact" }
  ];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary">N&P</span>
              <span className="ml-2 text-sm text-muted-foreground">Công ty TNHH</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <span className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                    location === item.href ? "text-primary" : "text-foreground"
                  }`}>
                    {item.name}
                  </span>
                </Link>
              ))}
              
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="text-sm font-medium">
                      Dịch vụ
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="grid w-80 gap-3 p-4">
                        {services.map((service) => (
                          <Link key={service.href} href={service.href}>
                            <NavigationMenuLink className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                              <div className="text-sm font-medium leading-none">{service.title}</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {service.description}
                              </p>
                            </NavigationMenuLink>
                          </Link>
                        ))}
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Button variant="outline" size="sm">
              VI
            </Button>
            <Link href="/contact">
              <Button className="btn-primary">
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
                        className="block px-3 py-2 text-base font-medium hover:text-primary transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        {item.name}
                      </span>
                    </Link>
                  ))}
                  <div className="border-t pt-4">
                    <p className="px-3 py-2 text-sm font-medium text-muted-foreground">Dịch vụ</p>
                    {services.map((service) => (
                      <Link key={service.href} href={service.href}>
                        <span 
                          className="block px-6 py-2 text-sm hover:text-primary transition-colors"
                          onClick={() => setIsOpen(false)}
                        >
                          {service.title}
                        </span>
                      </Link>
                    ))}
                  </div>
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
