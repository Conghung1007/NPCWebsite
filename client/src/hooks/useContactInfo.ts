import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContactInfo, InsertContactInfo } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useContactInfo() {
  return useQuery<ContactInfo[]>({
    queryKey: ["/api/contact-info"],
  });
}

export function useCreateContactInfo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contactInfo: InsertContactInfo) => {
      return apiRequest("/api/contact-info", {
        method: "POST",
        body: JSON.stringify(contactInfo),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
    },
  });
}

export function useUpdateContactInfo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertContactInfo> }) => {
      return apiRequest(`/api/contact-info/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
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
      return apiRequest(`/api/contact-info/${id}`, {
        method: "DELETE",
      });
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
      return apiRequest("/api/contact-info/seed", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
    },
  });
}