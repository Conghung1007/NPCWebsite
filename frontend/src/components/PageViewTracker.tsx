import { useEffect, useRef } from "react";
import { usePortal } from "@/contexts/PortalContext";
import { apiFetch } from "@/lib/queryClient";

/** Fire-and-forget daily page view counter (TNJS-style analytics). */
export function PageViewTracker() {
  const { portal } = usePortal();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void apiFetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal }),
    }).catch(() => {});
  }, [portal]);

  return null;
}
