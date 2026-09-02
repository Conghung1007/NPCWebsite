import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import type { LayoutPageId, PageSection } from "@shared/pageSections";

export type PageLayoutResponse = {
  page: string;
  portal: string;
  sections: PageSection[];
  isDefault: boolean;
};

export const pageLayoutKeys = {
  page: (page: string, portal?: string) =>
    ["/api/page-layouts", page, portal || page] as const,
};

export function usePageLayout(page: string, portal?: string, enabled = true) {
  const p = portal || page;
  return useQuery<PageLayoutResponse>({
    queryKey: pageLayoutKeys.page(page, p),
    queryFn: async () => {
      const res = await apiFetch(
        `/api/page-layouts?page=${encodeURIComponent(page)}&portal=${encodeURIComponent(p)}`,
      );
      if (!res.ok) throw new Error("Không tải được bố cục trang");
      return res.json();
    },
    enabled: enabled && !!page,
    staleTime: 15_000,
    refetchOnMount: true,
  });
}

export function useSavePageLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      page: string;
      portal?: string;
      sections: PageSection[];
    }) => {
      const res = await apiRequest("PUT", "/api/page-layouts", body);
      return res.json() as Promise<PageLayoutResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        pageLayoutKeys.page(data.page, data.portal),
        data,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
    },
  });
}

export function useResetPageLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { page: string; portal?: string }) => {
      const res = await apiRequest("POST", "/api/page-layouts/reset", body);
      return res.json() as Promise<PageLayoutResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        pageLayoutKeys.page(data.page, data.portal),
        data,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/page-layouts"] });
    },
  });
}
