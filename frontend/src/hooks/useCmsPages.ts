import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import type { PageContentEntry } from "@shared/pageContentRegistry";
import type { PortalId } from "@/lib/portal";

export const cmsPageKeys = {
  all: ["/api/cms-pages"] as const,
  portal: (portal: PortalId | "all") =>
    ["/api/cms-pages", portal] as const,
};

function appendCmsPage(
  old: PageContentEntry[] | undefined,
  created: PageContentEntry,
): PageContentEntry[] {
  if (!old) return [created];
  if (old.some((p) => p.id === created.id)) return old;
  return [...old, created];
}

export function useCmsPages(portal?: PortalId | "all") {
  return useQuery<PageContentEntry[]>({
    queryKey: cmsPageKeys.portal(portal ?? "all"),
    queryFn: async () => {
      const qs =
        portal && portal !== "all"
          ? `?portal=${encodeURIComponent(portal)}`
          : "?all=1";
      const res = await apiFetch(`/api/cms-pages${qs}`);
      if (!res.ok) throw new Error("Không tải được trang tùy chỉnh");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useCreateCmsPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      portal: PortalId;
      slug: string;
      label: string;
      description?: string;
    }) => {
      const res = await apiRequest("POST", "/api/cms-pages", body);
      return res.json() as Promise<PageContentEntry>;
    },
    onSuccess: (created) => {
      queryClient.setQueriesData<PageContentEntry[]>(
        { queryKey: ["/api/cms-pages"] },
        (old) => appendCmsPage(old, created),
      );
      queryClient.invalidateQueries({ queryKey: cmsPageKeys.all });
    },
  });
}

export function useDeleteCmsPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      slug?: string;
      portal?: PortalId;
    }) => {
      const res = await apiRequest("DELETE", `/api/cms-pages/${payload.id}`);
      const body = (await res.json()) as {
        ok?: boolean;
        images?: {
          dbRemoved: number;
          r2Removed: number;
          r2Skipped: number;
        };
      };
      return { ...payload, images: body.images };
    },
    onSuccess: (payload) => {
      queryClient.setQueriesData<PageContentEntry[]>(
        { queryKey: ["/api/cms-pages"] },
        (old) => (old ? old.filter((p) => p.id !== payload.id) : old),
      );
      if (payload.slug && payload.portal) {
        queryClient.removeQueries({
          queryKey: ["/api/cms-pages/by-slug", payload.slug, payload.portal],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["/api/cms-pages/by-slug"],
        });
      }
      queryClient.invalidateQueries({ queryKey: cmsPageKeys.all });
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ui-images"] });
    },
  });
}

export function useCmsPageBySlug(slug: string, portal: PortalId) {
  return useQuery<PageContentEntry | null>({
    queryKey: ["/api/cms-pages/by-slug", slug, portal],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/cms-pages/by-slug/${encodeURIComponent(slug)}?portal=${encodeURIComponent(portal)}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Không tải được trang");
      return res.json();
    },
    enabled: !!slug && !!portal,
    retry: false,
  });
}
