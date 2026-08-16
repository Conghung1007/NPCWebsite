import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { resolvePortal } from "@/lib/portal";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    try {
      const json = JSON.parse(text);
      if (typeof json?.message === "string" && json.message.trim()) {
        throw new Error(json.message);
      }
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) {
        throw e;
      }
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

/** Merge X-Portal (and optional extras) for API calls */
export function portalHeaders(extra?: HeadersInit): HeadersInit {
  const base: Record<string, string> = { "X-Portal": resolvePortal() };
  if (!extra) return base;
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      base[k] = v;
    });
    return base;
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) base[k] = v;
    return base;
  }
  return { ...base, ...(extra as Record<string, string>) };
}

/** fetch with credentials + X-Portal — prefer this over raw fetch for /api */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = portalHeaders(init?.headers);
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers,
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await apiFetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await apiFetch(queryKey.join("/") as string);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
