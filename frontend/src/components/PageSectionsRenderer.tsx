import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { EditableHeroCarousel } from "@/components/ui/editable-hero-carousel";
import { EditableContentImage } from "@/components/ui/editable-content-image";
import { ContactForm } from "@/components/ui/contact-form";
import { ArticleSection } from "@/components/ArticleSection";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { TnjsPillTitle } from "@/components/TnjsUi";
import { TNJS } from "@/lib/tnjsTheme";
import { apiFetch } from "@/lib/queryClient";
import { resolvePortal } from "@/lib/portal";
import { portalHref } from "@/lib/portal";
import {
  parsePortalHref,
  type PageSection,
  type SectionType,
} from "@shared/pageSections";
import type { Testimonial } from "@shared/schema";
import { cn } from "@/lib/utils";

function str(props: Record<string, unknown>, key: string, fallback = ""): string {
  const v = props[key];
  return typeof v === "string" ? v : fallback;
}

function num(props: Record<string, unknown>, key: string, fallback: number): number {
  const v = props[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function resolveHref(href: string | undefined): {
  href: string;
  external: boolean;
} {
  if (!href) return { href: "#", external: false };
  const portalLink = parsePortalHref(href);
  if (portalLink) {
    return {
      href: portalHref(portalLink.portal, portalLink.path),
      external: true,
    };
  }
  if (/^https?:\/\//i.test(href)) {
    return { href, external: true };
  }
  return { href, external: false };
}

function CtaLink({
  href,
  label,
  variant = "primary",
}: {
  href?: string;
  label?: string;
  variant?: "primary" | "outline";
}) {
  if (!label?.trim() || !href) return null;
  const resolved = resolveHref(href);
  const btn =
    variant === "outline" ? (
      <span className="inline-flex items-center justify-center rounded-md border-2 border-white bg-transparent px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-neutral-900">
        {label}
      </span>
    ) : (
      <span
        className="inline-flex items-center justify-center gap-2 rounded-md px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-opacity hover:opacity-95"
        style={{ backgroundColor: TNJS.orange }}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </span>
    );

  if (resolved.external) {
    return (
      <a href={resolved.href} rel="noopener noreferrer">
        {btn}
      </a>
    );
  }
  return <Link href={resolved.href}>{btn}</Link>;
}

function SectionShell({
  children,
  bg,
  className,
}: {
  children: ReactNode;
  bg?: "white" | "cream" | "green" | "charcoal";
  className?: string;
}) {
  const style =
    bg === "green"
      ? { backgroundColor: TNJS.green }
      : bg === "charcoal"
        ? { backgroundColor: TNJS.charcoal }
        : bg === "cream"
          ? { backgroundColor: TNJS.cream }
          : undefined;
  return (
    <section
      className={cn("py-16 sm:py-20", bg === "white" && "bg-white", className)}
      style={style}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

function HeroSection({ section }: { section: PageSection }) {
  const p = section.props;
  const prefix = str(p, "imageTypePrefix", "group");
  return (
    <EditableHeroCarousel
      imageTypePrefix={prefix}
      altPrefix={`${str(p, "brandName", "N&P")} hero`}
      minHeightClassName="min-h-[calc(70svh-var(--header-height))]"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-4 font-display text-4xl font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
            {str(p, "brandName", "N&P")}
          </p>
          <h1 className="mb-4 font-display text-2xl font-semibold leading-snug text-white/95 sm:text-3xl lg:text-4xl">
            {str(p, "title")}
          </h1>
          <p className="mb-8 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            {str(p, "description")}
          </p>
          <div className="flex flex-wrap gap-3">
            <CtaLink
              href={str(p, "ctaPrimaryHref")}
              label={str(p, "ctaPrimaryLabel")}
            />
            <CtaLink
              href={str(p, "ctaSecondaryHref")}
              label={str(p, "ctaSecondaryLabel")}
              variant="outline"
            />
          </div>
        </div>
      </div>
    </EditableHeroCarousel>
  );
}

function RichTextSection({ section }: { section: PageSection }) {
  const p = section.props;
  const imageType = str(p, "imageType");
  return (
    <SectionShell bg="cream">
      <TnjsPillTitle variant="onLight">{str(p, "title")}</TnjsPillTitle>
      <div
        className={
          imageType
            ? "mt-10 grid items-start gap-10 lg:grid-cols-2 lg:gap-14"
            : "mx-auto mt-6 max-w-3xl"
        }
      >
        <p className="whitespace-pre-line text-center text-neutral-700 leading-relaxed lg:text-left">
          {str(p, "body")}
        </p>
        {imageType ? (
          <div className="overflow-hidden rounded-xl shadow-lg">
            <EditableContentImage
              imageType={imageType}
              alt={str(p, "title")}
              aspectClassName="aspect-[16/10]"
            />
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

/** “Vì sao chọn chúng tôi” — nền than, chữ trắng */
function FeatureGridSection({ section }: { section: PageSection }) {
  const p = section.props;
  const items = Array.isArray(p.items) ? p.items : [];
  return (
    <SectionShell bg="charcoal">
      <TnjsPillTitle variant="onDark">{str(p, "title")}</TnjsPillTitle>
      {str(p, "description") ? (
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-white/70 sm:text-base">
          {str(p, "description")}
        </p>
      ) : (
        <div className="mb-10" />
      )}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((raw, i) => {
          const item =
            raw && typeof raw === "object"
              ? (raw as Record<string, unknown>)
              : {};
          return (
            <div key={i} className="text-center sm:text-left">
              <p
                className="mb-2 text-xs font-bold tracking-[0.2em]"
                style={{ color: TNJS.green }}
              >
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mb-2 text-lg font-bold text-white">
                {String(item.title ?? "")}
              </h3>
              <p className="text-sm leading-relaxed text-white/70">
                {String(item.body ?? "")}
              </p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

/** Thẻ khóa học tnjs — nền xanh, ruy băng vàng */
function CardsSection({ section }: { section: PageSection }) {
  const p = section.props;
  const items = Array.isArray(p.items) ? p.items : [];
  return (
    <SectionShell bg="green">
      <TnjsPillTitle variant="onGreen">{str(p, "title")}</TnjsPillTitle>
      {str(p, "description") ? (
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-white/90 sm:text-base">
          {str(p, "description")}
        </p>
      ) : (
        <div className="mb-10" />
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((raw, i) => {
          const item =
            raw && typeof raw === "object"
              ? (raw as Record<string, unknown>)
              : {};
          const title = String(item.title ?? "");
          const href = typeof item.href === "string" ? item.href : undefined;
          const imageType =
            typeof item.imageType === "string" ? item.imageType : "";
          const resolved = resolveHref(href);
          const description = String(item.description ?? "");
          const cta = String(item.cta ?? "Xem thêm");
          const label = item.label ? String(item.label) : "";

          const card = (
            <article className="group flex h-full flex-col overflow-hidden rounded-xl bg-white text-left shadow-lg transition-transform duration-300 hover:-translate-y-1.5">
              {imageType ? (
                <EditableContentImage
                  imageType={imageType}
                  alt={title}
                  aspectClassName="aspect-[16/10] rounded-none"
                  className="rounded-none"
                />
              ) : (
                <div
                  className="flex h-28 items-center justify-center text-white"
                  style={{
                    background: `linear-gradient(160deg, ${TNJS.greenDeep} 0%, ${TNJS.greenBright} 100%)`,
                  }}
                >
                  <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">
                    {label || "N&P"}
                  </span>
                </div>
              )}
              <div
                className="relative z-[1] -mt-1 px-3 py-2.5 text-center shadow-sm"
                style={{ backgroundColor: TNJS.yellow }}
              >
                <h3 className="text-[13px] font-extrabold uppercase leading-snug text-neutral-900 line-clamp-2">
                  {title}
                </h3>
              </div>
              <div
                className="flex flex-1 flex-col space-y-2 px-4 py-4"
                style={{ backgroundColor: TNJS.cream }}
              >
                {description
                  .split(/[.;]\s+/)
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((line) => (
                    <p
                      key={line}
                      className="flex items-start gap-2 text-[13px] leading-snug text-neutral-800"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: TNJS.green }}
                        strokeWidth={3}
                      />
                      <span>{line.trim()}</span>
                    </p>
                  ))}
                {!description ? (
                  <p className="text-[13px] text-neutral-600">
                    {label || "Tìm hiểu thêm về dịch vụ"}
                  </p>
                ) : null}
              </div>
              <div className="border-t border-black/5 bg-white px-4 py-4">
                <span
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-opacity group-hover:opacity-95"
                  style={{ backgroundColor: TNJS.orange }}
                >
                  {cta}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </article>
          );

          if (!href) return <div key={i}>{card}</div>;
          if (resolved.external) {
            return (
              <a
                key={i}
                href={resolved.href}
                rel="noopener noreferrer"
                className="block h-full"
              >
                {card}
              </a>
            );
          }
          return (
            <Link key={i} href={resolved.href} className="block h-full">
              {card}
            </Link>
          );
        })}
      </div>
    </SectionShell>
  );
}

function TestimonialsSection({ section }: { section: PageSection }) {
  const p = section.props;
  const limit = num(p, "limit", 3);
  const portal = resolvePortal();
  const { data: testimonials = [] } = useQuery<Testimonial[]>({
    queryKey: ["/api/testimonials", portal],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/testimonials?portal=${encodeURIComponent(portal)}`,
      );
      if (!res.ok) throw new Error("Không tải được phản hồi");
      return res.json();
    },
  });
  const list = testimonials.filter((t) => t.isActive !== false).slice(0, limit);
  if (list.length === 0) return null;
  return (
    <SectionShell bg="cream">
      <TnjsPillTitle variant="onLight">
        {str(p, "title", "Phản hồi")}
      </TnjsPillTitle>
      {str(p, "description") ? (
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-neutral-600">
          {str(p, "description")}
        </p>
      ) : (
        <div className="mb-10" />
      )}
      <div className="grid gap-8 md:grid-cols-3">
        {list.map((t) => (
          <TestimonialCard
            key={t.id}
            id={t.id}
            name={t.name}
            role={t.role || ""}
            content={t.content}
            avatar={t.avatarUrl}
            rating={t.rating ?? 5}
          />
        ))}
      </div>
    </SectionShell>
  );
}

function ArticlesBlock({ section }: { section: PageSection }) {
  const p = section.props;
  return (
    <SectionShell bg="white">
      <TnjsPillTitle variant="onLight">
        {str(p, "title", "Tin tức")}
      </TnjsPillTitle>
      {str(p, "description") ? (
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-neutral-600">
          {str(p, "description")}
        </p>
      ) : (
        <div className="mb-8" />
      )}
      <ArticleSection
        category={str(p, "category", "general")}
        title={str(p, "title", "Tin tức")}
        description={undefined}
        hideHeader
        embedded
      />
    </SectionShell>
  );
}

function CtaFormSection({ section }: { section: PageSection }) {
  const p = section.props;
  const defaultService = str(p, "defaultService");
  return (
    <SectionShell bg="green">
      <TnjsPillTitle variant="onGreen">
        {str(p, "title", "Đăng ký tư vấn")}
      </TnjsPillTitle>
      <p className="mx-auto mb-8 max-w-xl text-center text-sm text-white/90">
        {str(p, "description")}
      </p>
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl bg-white p-1 shadow-xl">
        <ContactForm
          defaultService={defaultService || undefined}
          className="!rounded-xl !shadow-none"
        />
      </div>
    </SectionShell>
  );
}

const SECTION_RENDERERS: Record<
  SectionType,
  (props: { section: PageSection }) => ReactElement | null
> = {
  hero: HeroSection,
  rich_text: RichTextSection,
  feature_grid: FeatureGridSection,
  cards: CardsSection,
  testimonials: TestimonialsSection,
  articles: ArticlesBlock,
  cta_form: CtaFormSection,
};

export function PageSectionsRenderer({
  sections,
}: {
  sections: PageSection[];
}) {
  const ordered = [...sections]
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="bg-white">
      {ordered.map((section) => {
        const Render = SECTION_RENDERERS[section.type];
        if (!Render) return null;
        return <Render key={section.id} section={section} />;
      })}
    </div>
  );
}
