import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Don't throw on 401 errors - treat as unauthenticated
    throwOnError: false,
  });

  const hasImageEditPermission = () => {
    return user?.role === "manager" || user?.role === "admin";
  };

  const isManager = () => {
    return user?.role === "manager";
  };

  const isAdmin = () => {
    return user?.role === "admin";
  };

  const isUser = () => {
    return user?.role === "user";
  };

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