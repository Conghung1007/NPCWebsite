import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Don't throw on 401 errors - treat as unauthenticated
    throwOnError: false,
    // Custom query function to handle 401 properly
    queryFn: async () => {
      const res = await fetch("/api/auth/user", {
        credentials: "include",
      });
      
      if (res.status === 401) {
        return null; // Return null for 401, which means not authenticated
      }
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    },
  });

  const hasImageEditPermission = user?.role === "manager" || user?.role === "admin";
  const isManager = user?.role === "manager";
  const isAdmin = user?.role === "admin";
  const isUser = user?.role === "user";

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    hasImageEditPermission,
    isManager,
    isAdmin,
    isUser,
  };
}