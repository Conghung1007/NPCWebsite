import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import type { ClassSession } from "@shared/schema";

export type CartItemView = {
  id: string;
  cartId: string;
  classSessionId: string;
  classSession: ClassSession & {
    courseTitle?: string;
    courseLevel?: string;
  };
};

export type CartView = {
  id: string;
  items: CartItemView[];
  totalVnd: number;
};

export const cartKeys = {
  all: ["/api/cart"] as const,
};

export function useCart() {
  const queryClient = useQueryClient();

  const cartQuery = useQuery<CartView>({
    queryKey: cartKeys.all,
    queryFn: async () => {
      const res = await apiFetch("/api/cart");
      if (!res.ok) throw new Error("Không tải được giỏ hàng");
      return res.json();
    },
  });

  const addItem = useMutation({
    mutationFn: async (classSessionId: string) => {
      const res = await apiRequest("POST", "/api/cart/items", { classSessionId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.all, data);
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("DELETE", `/api/cart/items/${itemId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.all, data);
    },
  });

  const itemCount = cartQuery.data?.items?.length ?? 0;

  return {
    cart: cartQuery.data,
    isLoading: cartQuery.isLoading,
    itemCount,
    addItem,
    removeItem,
    refetch: cartQuery.refetch,
  };
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
