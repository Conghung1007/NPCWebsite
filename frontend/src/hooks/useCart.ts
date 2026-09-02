import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import type { ClassSession } from "@shared/schema";

export type CartClassItemView = {
  id: string;
  cartId: string;
  itemType: "class";
  classSessionId: string;
  classSession: ClassSession & {
    courseTitle?: string;
    courseLevel?: string;
  };
};

export type CartExamPackageItemView = {
  id: string;
  cartId: string;
  itemType: "exam_package";
  packageId: string;
  examPackage: {
    id: string;
    name: string;
    level: string | null;
    priceVnd: number;
    compareAtPriceVnd?: number | null;
    examCount: number;
    linkedExamCount?: number;
  };
};

export type CartItemView = CartClassItemView | CartExamPackageItemView;

export type CartView = {
  id: string;
  items: CartItemView[];
  totalVnd: number;
  hasExamPackages?: boolean;
  hasClasses?: boolean;
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

  const addClass = useMutation({
    mutationFn: async (classSessionId: string) => {
      const res = await apiRequest("POST", "/api/cart/items", { classSessionId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.all, data);
    },
  });

  const addPackage = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await apiRequest("POST", "/api/cart/items", { packageId });
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
    addClass,
    addPackage,
    /** @deprecated use addClass */
    addItem: addClass,
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

export function isExamPackageCartItem(
  item: CartItemView,
): item is CartExamPackageItemView {
  return item.itemType === "exam_package";
}

export function isClassCartItem(item: CartItemView): item is CartClassItemView {
  return item.itemType === "class" || !item.itemType;
}
