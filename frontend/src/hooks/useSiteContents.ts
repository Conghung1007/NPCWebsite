import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const siteContentKeys = {
  page: (page: string) => ["/api/site-contents", page] as const,
};

export function useSiteContents(page = "home") {
  return useQuery<Record<string, string>>({
    queryKey: siteContentKeys.page(page),
    queryFn: async () => {
      const res = await fetch(`/api/site-contents?page=${encodeURIComponent(page)}`, {
        credentials: "include",
      });
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
