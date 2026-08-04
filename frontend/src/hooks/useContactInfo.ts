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
      return apiRequest("POST", "/api/contact-info", contactInfo);
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
      return apiRequest("PUT", `/api/contact-info/${id}`, data);
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
      return apiRequest("DELETE", `/api/contact-info/${id}`);
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
      return apiRequest("POST", "/api/contact-info/seed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-info"] });
    },
  });
}