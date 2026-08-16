import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { resolvePortal } from "@/lib/portal";

export const siteContentKeys = {
  page: (page: string, portal?: string) =>
    ["/api/site-contents", page, portal || resolvePortal()] as const,
};

export function useSiteContents(page = "home") {
  const portal = resolvePortal();
  return useQuery<Record<string, string>>({
    queryKey: siteContentKeys.page(page, portal),
    queryFn: async () => {
      const res = await apiFetch(
        `/api/site-contents?page=${encodeURIComponent(page)}`,
      );
      if (!res.ok) throw new Error("Không thể tải nội dung trang");
      return res.json();
    },
  });
}

export function useUpsertSiteContent(page = "home") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PUT", "/api/site-contents", { page, key, value });
      return res.json();
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: siteContentKeys.page(page) });
      const previous = queryClient.getQueryData<Record<string, string>>(
        siteContentKeys.page(page),
      );
      queryClient.setQueryData<Record<string, string>>(siteContentKeys.page(page), (old) => ({
        ...(old || {}),
        [key]: value,
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(siteContentKeys.page(page), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: siteContentKeys.page(page) });
    },
  });
}

export function useBulkUpsertSiteContents(page = "home") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: Array<{ key: string; value: string }>) => {
      const res = await apiRequest("PUT", "/api/site-contents/bulk", { page, entries });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siteContentKeys.page(page) });
    },
  });
}
