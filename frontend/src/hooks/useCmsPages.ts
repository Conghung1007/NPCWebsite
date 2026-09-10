import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import type { PageContentEntry } from "@shared/pageContentRegistry";
import type { PortalId } from "@/lib/portal";

export const cmsPageKeys = {
  all: ["/api/cms-pages"] as const,
  portal: (portal: PortalId | "all") =>
    ["/api/cms-pages", portal] as const,
  hidden: ["/api/cms-pages/hidden"] as const,
  labels: ["/api/cms-pages/labels"] as const,
};

function appendCmsPage(
  old: PageContentEntry[] | undefined,
  created: PageContentEntry,
): PageContentEntry[] {
  if (!old) return [created];
  if (old.some((p) => p.id === created.id)) return old;
  return [...old, created];
}

function replaceCmsPage(
  old: PageContentEntry[] | undefined,
  updated: PageContentEntry,
): PageContentEntry[] {
  if (!old) return [updated];
  const idx = old.findIndex((p) => p.id === updated.id);
  if (idx < 0) return [...old, updated];
  const next = old.slice();
  next[idx] = updated;
  return next;
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

export type HiddenCmsPages = {
  ids: string[];
  paths: string[];
  /** Portal-scoped hidden routes (preferred over flat `paths`). */
  entries?: Array<{ portal: string; path: string }>;
};

export type CmsPageLabels = {
  labels: Record<string, string>;
  entries: Array<{
    pageId: string;
    portal: string;
    path: string;
    label: string;
  }>;
};

export function useHiddenCmsPages() {
  return useQuery<HiddenCmsPages>({
    queryKey: cmsPageKeys.hidden,
    queryFn: async () => {
      const res = await apiFetch("/api/cms-pages/hidden");
      if (!res.ok) throw new Error("Không tải được trang đã ẩn");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useCmsPageLabels() {
  return useQuery<CmsPageLabels>({
    queryKey: cmsPageKeys.labels,
    queryFn: async () => {
      const res = await apiFetch("/api/cms-pages/labels");
      if (!res.ok) throw new Error("Không tải được tên trang");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useUpdateRegistryPageLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; label: string }) => {
      const res = await apiRequest(
        "PUT",
        `/api/cms-pages/labels/${encodeURIComponent(payload.id)}`,
        { label: payload.label },
      );
      return res.json() as Promise<{
        pageId: string;
        label: string;
        publicPath: string;
        portal: string;
      }>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CmsPageLabels>(cmsPageKeys.labels, (old) => {
        const labels = { ...(old?.labels ?? {}), [updated.pageId]: updated.label };
        const entries = [
          ...(old?.entries ?? []).filter((e) => e.pageId !== updated.pageId),
          {
            pageId: updated.pageId,
            portal: updated.portal,
            path: updated.publicPath,
            label: updated.label,
          },
        ];
        return { labels, entries };
      });
      queryClient.invalidateQueries({ queryKey: cmsPageKeys.labels });
    },
  });
}

export function useResetRegistryPageLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string }) => {
      const res = await apiRequest(
        "DELETE",
        `/api/cms-pages/labels/${encodeURIComponent(payload.id)}`,
      );
      return res.json() as Promise<{
        pageId: string;
        label: string;
        publicPath: string;
        portal: string;
        reset: boolean;
      }>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CmsPageLabels>(cmsPageKeys.labels, (old) => {
        if (!old) return { labels: {}, entries: [] };
        const labels = { ...old.labels };
        delete labels[updated.pageId];
        return {
          labels,
          entries: old.entries.filter((e) => e.pageId !== updated.pageId),
        };
      });
      queryClient.invalidateQueries({ queryKey: cmsPageKeys.labels });
    },
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

export function useUpdateCmsPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      label?: string;
      description?: string;
      slug?: string;
      previousSlug?: string;
      portal?: PortalId;
    }) => {
      const res = await apiRequest("PATCH", `/api/cms-pages/${payload.id}`, {
        label: payload.label,
        description: payload.description,
        slug: payload.slug,
      });
      const updated = (await res.json()) as PageContentEntry;
      return { ...payload, updated };
    },
    onSuccess: ({ updated, previousSlug, portal }) => {
      queryClient.setQueriesData<PageContentEntry[]>(
        { queryKey: ["/api/cms-pages"] },
        (old) => replaceCmsPage(old, updated),
      );
      queryClient.invalidateQueries({ queryKey: cmsPageKeys.all });
      queryClient.invalidateQueries({ queryKey: ["/api/cms-pages/by-slug"] });
      if (previousSlug && portal && previousSlug !== updated.slug) {
        queryClient.removeQueries({
          queryKey: ["/api/cms-pages/by-slug", previousSlug, portal],
        });
      }
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
      publicPath?: string;
    }) => {
      const res = await apiRequest("DELETE", `/api/cms-pages/${payload.id}`);
      const body = (await res.json()) as {
        ok?: boolean;
        mode?: "custom" | "hidden";
        images?: {
          dbRemoved: number;
          r2Removed: number;
          r2Skipped: number;
        };
      };
      return { ...payload, mode: body.mode, images: body.images };
    },
    onSuccess: (payload) => {
      queryClient.setQueriesData<PageContentEntry[]>(
        { queryKey: ["/api/cms-pages"] },
        (old) => (old ? old.filter((p) => p.id !== payload.id) : old),
      );
      queryClient.setQueryData<HiddenCmsPages>(cmsPageKeys.hidden, (old) => {
        if (!old) return old;
        if (old.ids.includes(payload.id)) return old;
        const paths = payload.publicPath
          ? [
              ...old.paths.filter((p) => p !== payload.publicPath),
              payload.publicPath,
            ]
          : old.paths;
        const entries = [
          ...(old.entries ?? []).filter((e) => e.path !== payload.publicPath),
          ...(payload.publicPath && payload.portal
            ? [{ portal: payload.portal, path: payload.publicPath }]
            : []),
        ];
        return {
          ids: [...old.ids, payload.id],
          paths,
          entries,
        };
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/cms-pages/by-slug"],
      });
      if (payload.slug && payload.portal) {
        queryClient.removeQueries({
          queryKey: ["/api/cms-pages/by-slug", payload.slug, payload.portal],
        });
      }
      queryClient.invalidateQueries({ queryKey: cmsPageKeys.all });
      queryClient.invalidateQueries({ queryKey: cmsPageKeys.hidden });
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
