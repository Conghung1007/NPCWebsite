import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  MapPin,
  MessageCircle,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CpanelTab =
  | "dashboard"
  | "exams"
  | "exam-packages"
  | "results"
  | "classes"
  | "orders"
  | "stats"
  | "questions"
  | "articles"
  | "page-content"
  | "testimonials"
  | "site-settings"
  | "contact-info"
  | "messages"
  | "users";

type NavItem = {
  tab: CpanelTab;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export const CPANEL_NAV: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [{ tab: "dashboard", label: "Bảng điều khiển", icon: LayoutDashboard }],
  },
  {
    label: "Luyện thi & đào tạo",
    items: [
      { tab: "exams", label: "Quản lý bài thi", icon: FileText },
      { tab: "exam-packages", label: "Quản lý gói đề", icon: Package },
      { tab: "results", label: "Kết quả thi", icon: Trophy },
      { tab: "questions", label: "Bộ câu hỏi", icon: HelpCircle },
      { tab: "classes", label: "Lớp học", icon: GraduationCap },
    ],
  },
  {
    label: "Thương mại",
    items: [
      { tab: "orders", label: "Đơn hàng", icon: Receipt },
      { tab: "stats", label: "Thống kê", icon: BarChart3 },
    ],
  },
  {
    label: "Nội dung web",
    items: [
      { tab: "page-content", label: "Nội dung trang", icon: LayoutTemplate },
      { tab: "articles", label: "Bài viết", icon: FileText },
      { tab: "testimonials", label: "Ý kiến khách hàng", icon: MessageCircle },
      { tab: "site-settings", label: "Cấu hình chung", icon: Settings },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { tab: "messages", label: "Tin nhắn liên hệ", icon: MessageSquare },
      { tab: "contact-info", label: "Thông tin liên hệ", icon: MapPin },
      { tab: "users", label: "Người dùng", icon: Users, managerOnly: true },
    ],
  },
];

type CpanelSidebarProps = {
  activeTab: string;
  canManageUsers: boolean;
  unreadMessages?: number;
  pendingOrders?: number;
  onNavigate: (tab: CpanelTab) => void;
};

export function CpanelSidebar({
  activeTab,
  canManageUsers,
  unreadMessages = 0,
  pendingOrders = 0,
  onNavigate,
}: CpanelSidebarProps) {
  return (
    <nav className="w-56 shrink-0 space-y-5">
      {CPANEL_NAV.map((group) => {
        const items = group.items.filter((i) => !i.managerOnly || canManageUsers);
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 px-3 mb-1.5">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.tab;
                let badge: number | null = null;
                if (item.tab === "messages" && unreadMessages > 0) badge = unreadMessages;
                if (item.tab === "orders" && pendingOrders > 0) badge = pendingOrders;

                return (
                  <li key={item.tab}>
                    <Button
                      type="button"
                      variant={active ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2 h-10 px-3 font-normal",
                        active && "font-medium",
                      )}
                      onClick={() => onNavigate(item.tab)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1 text-left text-sm">{item.label}</span>
                      {badge != null ? (
                        <Badge
                          variant={active ? "secondary" : "destructive"}
                          className="h-5 min-w-5 px-1.5 text-[10px]"
                        >
                          {badge > 99 ? "99+" : badge}
                        </Badge>
                      ) : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
