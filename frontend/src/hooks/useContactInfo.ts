import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContactInfo, InsertContactInfo } from "@shared/schema";
import { apiFetch, apiRequest } from "@/lib/queryClient";

export function useContactInfo(opts?: { all?: boolean }) {
  const all = !!opts?.all;
  return useQuery<ContactInfo[]>({
    queryKey: all ? ["/api/contact-info", "all"] : ["/api/contact-info"],
    queryFn: async () => {
      const res = await apiFetch(
        all ? "/api/contact-info?all=1" : "/api/contact-info",
      );
      if (!res.ok) throw new Error("Không tải được thông tin liên hệ");
      return res.json();
    },
  });
}

export function useCreateContactInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactInfo: InsertContactInfo) => {
      const res = await apiRequest("POST", "/api/contact-info", contactInfo);
      return res.json() as Promise<ContactInfo>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
    },
  });
}

export function useUpdateContactInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertContactInfo>;
    }) => {
      const res = await apiRequest("PUT", `/api/contact-info/${id}`, data);
      return res.json() as Promise<ContactInfo>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
    },
  });
}

export function useDeleteContactInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contact-info/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
    },
  });
}

export function useSeedContactInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contact-info/seed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
    },
  });
}
