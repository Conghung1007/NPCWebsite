import { Suspense, lazy, useMemo } from "react";
import LuyenthiHome from "@/pages/luyenthi-home";
import { usePageLayout } from "@/hooks/usePageLayout";

const OnlineExamPage = lazy(() =>
  import("@/pages/online-exam").then((m) => ({ default: m.OnlineExamPage })),
);

/** Portal luyenthi `/` — bố cục khối (gồm gói đề + danh sách đề khi đã thêm). */
export default function LuyenthiPortalHome() {
  const { data } = usePageLayout("luyenthi", "luyenthi");
  const hasExamList = useMemo(
    () =>
      (data?.sections ?? []).some(
        (s) => s.type === "exam_list" && s.enabled !== false,
      ),
    [data?.sections],
  );

  return (
    <>
      <LuyenthiHome />
      {/* Chưa có khối danh sách đề → fallback để neo #exam-list vẫn hoạt động */}
      {!hasExamList ? (
        <Suspense
          fallback={
            <div
              className="page-loading-shell py-24"
              role="status"
              aria-label="Đang tải đề thi"
            >
              <div className="mx-auto h-8 w-48 animate-pulse rounded bg-neutral-200" />
            </div>
          }
        >
          <OnlineExamPage embed />
        </Suspense>
      ) : null}
    </>
  );
}
