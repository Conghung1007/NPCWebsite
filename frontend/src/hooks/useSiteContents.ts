import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { resolvePortal, type PortalId } from "@/lib/portal";

export const siteContentKeys = {
  page: (page: string, portal?: string) =>
    ["/api/site-contents", page, portal || resolvePortal()] as const,
};

function contentQueryUrl(page: string, portal: PortalId): string {
  return `/api/site-contents?page=${encodeURIComponent(page)}&portal=${encodeURIComponent(portal)}`;
}

export function useSiteContents(page = "home", portal?: PortalId) {
  const effectivePortal = portal || resolvePortal();
  return useQuery<Record<string, string>>({
    queryKey: siteContentKeys.page(page, effectivePortal),
    queryFn: async () => {
      const res = await apiFetch(contentQueryUrl(page, effectivePortal));
      if (!res.ok) throw new Error("Không thể tải nội dung trang");
      return res.json();
    },
  });
}

export function useUpsertSiteContent(page = "home", portal?: PortalId) {
  const queryClient = useQueryClient();
  const effectivePortal = portal || resolvePortal();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PUT", "/api/site-contents", {
        page,
        key,
        value,
        ...(portal ? { portal } : {}),
      });
      return res.json();
    },
    onMutate: async ({ key, value }) => {
      const qk = siteContentKeys.page(page, effectivePortal);
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<Record<string, string>>(qk);
      queryClient.setQueryData<Record<string, string>>(qk, (old) => ({
        ...(old || {}),
        [key]: value,
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          siteContentKeys.page(page, effectivePortal),
          ctx.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: siteContentKeys.page(page, effectivePortal),
      });
    },
  });
}

export function useBulkUpsertSiteContents(page = "home", portal?: PortalId) {
  const queryClient = useQueryClient();
  const effectivePortal = portal || resolvePortal();

  return useMutation({
    mutationFn: async (entries: Array<{ key: string; value: string }>) => {
      const res = await apiRequest("PUT", "/api/site-contents/bulk", {
        page,
        entries,
        ...(portal ? { portal } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: siteContentKeys.page(page, effectivePortal),
      });
    },
  });
}
