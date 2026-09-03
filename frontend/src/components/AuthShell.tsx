import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { TNJS } from "@/lib/tnjsTheme";
import { TriNhanBrand, BRAND_FULL_NAME } from "@/components/TriNhanBrand";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  steps?: { label: string; active: boolean; done?: boolean }[];
  narrow?: boolean;
  /** Bullet hints on green panel (OTP, etc.) */
  showHints?: boolean;
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  steps,
  narrow = false,
  showHints = true,
}: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside
        className="relative overflow-hidden px-6 py-10 lg:w-[42%] lg:min-h-screen lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14"
        style={{
          background: `linear-gradient(155deg, ${TNJS.greenDeep} 0%, ${TNJS.green} 45%, ${TNJS.greenBright} 100%)`,
        }}
      >
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center group">
            <TriNhanBrand
              size="md"
              tone="onGreen"
              preferDefaultImage={false}
              subtitle="Luyện thi · Đào tạo tiếng Nhật"
            />
          </Link>
        </div>

        <div className="relative z-10 mt-10 lg:mt-0 max-w-md">
          <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 text-base text-white/85 leading-relaxed">{subtitle}</p>
          ) : null}
          {showHints ? (
            <ul className="mt-8 space-y-3 text-sm text-white/90">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5C518]" />
                Tư vấn luyện thi miễn phí
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5C518]" />
                Xem kết quả ngay khi thi xong
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5C518]" />
                Kho đề thi phong phú, cập nhật liên tục
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5C518]" />
                Luyện tập mọi lúc trên mọi thiết bị
              </li>
            </ul>
          ) : null}
        </div>

        <p className="relative z-10 mt-10 lg:mt-0 text-xs text-white/60">
          © {new Date().getFullYear()} {BRAND_FULL_NAME}
        </p>

        <div
          className="pointer-events-none absolute -right-16 top-1/4 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: TNJS.yellow }}
          aria-hidden
        />
      </aside>

      <main className="flex flex-1 flex-col justify-center bg-[#FAFAF8] px-5 py-10 sm:px-8 lg:px-14">
        <div className={cn("mx-auto w-full", narrow ? "max-w-md" : "max-w-lg")}>
          {steps && steps.length > 0 ? (
            <div className="mb-8 flex items-center gap-3">
              {steps.map((step, i) => (
                <div key={step.label} className="flex flex-1 items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      step.done
                        ? "bg-[#00A651] text-white"
                        : step.active
                          ? "bg-[#FF8800] text-white"
                          : "bg-neutral-200 text-neutral-500",
                    )}
                  >
                    {step.done ? "✓" : i + 1}
                  </span>
                  <span
                    className={cn(
                      "truncate text-xs font-semibold sm:text-sm",
                      step.active || step.done ? "text-neutral-900" : "text-neutral-400",
                    )}
                  >
                    {step.label}
                  </span>
                  {i < steps.length - 1 ? (
                    <div
                      className={cn(
                        "hidden sm:block h-px flex-1 min-w-[1rem]",
                        step.done ? "bg-[#00A651]" : "bg-neutral-200",
                      )}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-lg shadow-neutral-200/50 sm:p-8">
            {children}
          </div>

          {footer ? <div className="mt-6 text-center">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

export function authRedirectParam(): string {
  if (typeof window === "undefined") return "";
  const raw = new URLSearchParams(window.location.search).get("redirect");
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "";
}

export function authLinkWithRedirect(base: string): string {
  const redirect = authRedirectParam();
  return redirect ? `${base}?redirect=${encodeURIComponent(redirect)}` : base;
}
