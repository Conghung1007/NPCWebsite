import { ArrowRight, GraduationCap, Languages, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { portalHref } from "@/lib/portal";

export default function GroupHome() {
  const tnjsHome = portalHref("tnjs", "/");
  const duhocHome = portalHref("duhoc", "/");
  const daotaoHome = portalHref("daotao", "/");
  const pillars = [
    {
      id: "tnjs",
      label: "TNJS",
      title: "Đào tạo tiếng Nhật",
      description:
        "Khóa học N5–N1, lớp khai giảng, thi trực tuyến JLPT và đăng ký học online.",
      href: tnjsHome,
      external: true,
      icon: Languages,
      cta: "Vào cổng TNJS",
      ready: true,
    },
    {
      id: "duhoc",
      label: "Du học",
      title: "Tư vấn du học",
      description:
        "Định hướng quốc gia, trường học, hồ sơ, visa và lộ trình du học cùng N&P.",
      href: duhocHome,
      external: true,
      icon: GraduationCap,
      cta: "Vào cổng Du học",
      ready: true,
    },
    {
      id: "daotao",
      label: "Đào tạo",
      title: "Kỹ năng mềm",
      description:
        "Giao tiếp, thuyết trình, làm việc nhóm và đào tạo doanh nghiệp — sĩ số nhỏ, thực hành nhiều.",
      href: daotaoHome,
      external: true,
      icon: Sparkles,
      cta: "Vào cổng Đào tạo",
      ready: true,
    },
  ] as const;

  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%),linear-gradient(180deg,#f8faf9_0%,#eef5f1_45%,#f7faf8_100%)]">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310b981' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-14 sm:pb-20">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-primary mb-4 home-fade-up">
            N&P Group
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight max-w-3xl leading-[1.1] home-fade-up">
            Một thương hiệu.
            <br />
            Ba cổng chuyên môn.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl home-fade-up">
            Trang chủ N&P Group kết nối đào tạo tiếng Nhật (TNJS), tư vấn du học
            và đào tạo kỹ năng — cùng tiêu chuẩn dịch vụ, cùng đội ngũ hỗ trợ.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 home-fade-up">
            <a href={tnjsHome}>
              <Button size="lg" className="gap-2 shadow-md">
                Vào TNJS
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Tư vấn miễn phí
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="pb-20 sm:pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Chọn cổng phù hợp
            </h2>
            <p className="mt-2 text-muted-foreground">
              Mỗi subdomain là một mặt tiền chuyên sâu — quản trị chung bởi N&P.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              const body = (
                <article
                  className="group h-full flex flex-col rounded-2xl border border-emerald-100/80 bg-white/80 backdrop-blur-sm p-6 sm:p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    {!pillar.ready && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                        Sắp ra mắt
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-primary mb-1">
                    {pillar.label}
                  </p>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-muted-foreground flex-1 mb-6">
                    {pillar.description}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                    {pillar.cta}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </article>
              );

              if (pillar.external) {
                return (
                  <a
                    key={pillar.id}
                    href={pillar.href}
                    className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                  >
                    {body}
                  </a>
                );
              }
              return (
                <Link
                  key={pillar.id}
                  href={pillar.href}
                  className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
