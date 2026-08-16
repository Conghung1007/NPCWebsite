import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portalHref, portalPath } from "@/lib/portal";
import { DAOTAO_SECTIONS } from "@/pages/portal-sections";
import { ArticleSection } from "@/components/ArticleSection";
import { ContactForm } from "@/components/ui/contact-form";

const WHY = [
  {
    title: "Thực hành nhiều",
    body: "Ưu tiên luyện nói, thuyết trình và phản hồi — không chỉ lý thuyết.",
  },
  {
    title: "Sĩ số nhỏ",
    body: "Lớp gọn để mỗi học viên được chỉnh sửa và luyện tập đủ.",
  },
  {
    title: "Gắn với công việc",
    body: "Tình huống thực tế: họp, CV, phỏng vấn, làm việc nhóm.",
  },
];

/** Soft-skills portal home */
export default function DaotaoHome() {
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.1),_transparent_50%),linear-gradient(180deg,#f7faf8_0%,#eef5f1_45%,#ffffff_100%)]">
      <section className="relative overflow-hidden min-h-[calc(70svh-var(--header-height))] flex items-center">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(95,40%,22%)_0%,hsl(95,48%,32%)_50%,hsl(95,35%,40%)_100%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNikiLz48L3N2Zz4=')] opacity-80" />
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-white mb-4 home-fade-up">
              Đào tạo N&P
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-white/95 mb-3 home-fade-up">
              Kỹ năng mềm
            </h1>
            <p className="text-sm sm:text-base text-white/85 mb-8 max-w-xl leading-relaxed home-fade-up">
              Giao tiếp, làm việc nhóm, thuyết trình và đào tạo doanh nghiệp —
              lộ trình thực hành, sĩ số nhỏ.
            </p>
            <div className="flex flex-wrap gap-3 home-fade-up">
              <a href={portalPath("daotao", "/courses")}>
                <Button
                  size="lg"
                  className="bg-white text-primary font-semibold px-8 hover:bg-secondary"
                >
                  Xem khóa học
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </a>
              <a href={portalPath("daotao", "/#dt-tu-van")}>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-white bg-transparent text-white font-semibold px-8 hover:bg-white hover:text-primary"
                >
                  Đăng ký tư vấn
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Vì sao chọn Đào tạo N&P
        </h2>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          Tập trung kỹ năng dùng được ngay — trong học tập và công việc.
        </p>
        <div className="grid gap-8 sm:grid-cols-3">
          {WHY.map((item, i) => (
            <div
              key={item.title}
              className="border-t border-foreground/10 pt-5 home-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-8">
          Chương trình
        </h2>
        <div className="grid gap-8 sm:grid-cols-2">
          {DAOTAO_SECTIONS.map((s, i) => (
            <Link
              key={s.slug}
              href={portalPath("daotao", `/${s.slug}`)}
              className="group block border-t border-foreground/10 pt-5 home-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <h3 className="font-display text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                {s.description}
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Xem chi tiết
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
          <Link
            href={portalPath("daotao", "/news")}
            className="group block border-t border-foreground/10 pt-5 home-fade-up"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
              Tin tức
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
              Thông báo khai giảng và cập nhật từ cổng đào tạo kỹ năng mềm.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Xem tin
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>

      <section className="bg-white/60 border-y border-foreground/5 py-14 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-8">
            Lộ trình tham gia
          </h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              {
                n: "1",
                t: "Tư vấn",
                d: "Chọn khóa cá nhân hoặc gói doanh nghiệp phù hợp mục tiêu.",
              },
              {
                n: "2",
                t: "Xếp lớp",
                d: "Ghép ca tối / cuối tuần / online hoặc lịch in-house.",
              },
              {
                n: "3",
                t: "Thực hành",
                d: "Học – luyện – nhận phản hồi và áp dụng ngay.",
              },
            ].map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{s.t}</h3>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ArticleSection
        category="soft-skills"
        title="Tin nổi bật"
        description="Cập nhật từ cổng Đào tạo"
      />

      <section className="py-16 sm:py-20 bg-primary" id="dt-tu-van">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <ContactForm
            variant="hero"
            defaultService="soft-skills"
            submitMessage="Yêu cầu tư vấn kỹ năng mềm / đào tạo doanh nghiệp"
          />
        </div>
      </section>

      <p className="text-center py-8 text-sm text-muted-foreground">
        <a
          href={portalHref("group", "/")}
          className="text-primary font-medium hover:underline"
        >
          ← Về N&P Group
        </a>
      </p>
    </div>
  );
}
