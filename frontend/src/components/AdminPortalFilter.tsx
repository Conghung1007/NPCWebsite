import { Button } from "@/components/ui/button";
import {
  useAdminPortal,
  type AdminPortalFilter,
} from "@/contexts/AdminPortalContext";
import { PORTAL_IDS, PORTAL_META } from "@/lib/portal";
import { cn } from "@/lib/utils";

export function AdminPortalFilter({ className }: { className?: string }) {
  const { filter, setFilter, allowedPortals } = useAdminPortal();

  const portalOptions = (allowedPortals || [...PORTAL_IDS]).map((id) => ({
    value: id as AdminPortalFilter,
    label: PORTAL_META[id].brand,
  }));

  const options: { value: AdminPortalFilter; label: string }[] = [
    ...(allowedPortals ? [] : [{ value: "all" as const, label: "Tất cả" }]),
    ...portalOptions,
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm font-medium text-gray-600 shrink-0">Portal:</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={filter === opt.value ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function portalBadgeLabel(portal: string | null | undefined): string {
  if (!portal) return "—";
  if (portal in PORTAL_META) {
    return PORTAL_META[portal as keyof typeof PORTAL_META].brand;
  }
  return portal;
}
