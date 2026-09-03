import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { authRedirectParam } from "@/components/AuthShell";
import { Alert, AlertDescription } from "@/components/ui/alert";

type GoogleConfig = {
  enabled: boolean;
  clientId: string | null;
};

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

const GIS_SCRIPT_ID = "google-gis-client";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google script failed")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google script failed"));
    document.head.appendChild(script);
  });
}

type GoogleSignInButtonProps = {
  mode?: "signin" | "signup";
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({
  mode = "signin",
  disabled = false,
  onError,
}: GoogleSignInButtonProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<GoogleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCredential = useCallback(
    async (credential: string) => {
      setSubmitting(true);
      setError("");
      onError?.("");

      try {
        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ credential }),
        });
        const data = await response.json();

        if (response.ok && data.success) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          toast({
            title: data.isNew ? "Đăng ký thành công" : "Đăng nhập thành công",
            description: data.isNew
              ? "Chào mừng bạn đến với Trí Nhân Academy!"
              : `Chào mừng ${data.user?.username || "bạn"}!`,
          });
          const redirect = authRedirectParam();
          setLocation(redirect || "/");
          return;
        }

        const message = data.message || "Không thể đăng nhập bằng Google";
        setError(message);
        onError?.(message);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Không thể đăng nhập bằng Google";
        setError(message);
        onError?.(message);
      } finally {
        setSubmitting(false);
      }
    },
    [onError, queryClient, setLocation, toast],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/google/config", { credentials: "include" });
        const data = (await res.json()) as GoogleConfig;
        if (cancelled) return;
        setConfig(data);
      } catch {
        if (!cancelled) setConfig({ enabled: false, clientId: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || !config?.enabled || !config.clientId || !buttonRef.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleScript();
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: config.clientId!,
          callback: (response) => {
            if (response.credential) {
              void handleCredential(response.credential);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "continue_with",
          shape: "rectangular",
          width: buttonRef.current.offsetWidth || 320,
          locale: "vi",
        });
      } catch {
        if (!cancelled) {
          setError("Không tải được nút Google. Vui lòng thử lại sau.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config, handleCredential, loading, mode]);

  if (loading || !config?.enabled) {
    return null;
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div
        ref={buttonRef}
        className={submitting || disabled ? "pointer-events-none opacity-60" : ""}
        aria-busy={submitting}
      />
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-neutral-200" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-white px-3 text-neutral-400 font-medium">Hoặc</span>
      </div>
    </div>
  );
}
