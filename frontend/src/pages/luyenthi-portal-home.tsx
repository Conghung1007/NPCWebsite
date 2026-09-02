import { Suspense, lazy } from "react";
import LuyenthiHome from "@/pages/luyenthi-home";

const OnlineExamPage = lazy(() =>
  import("@/pages/online-exam").then((m) => ({ default: m.OnlineExamPage })),
);

/** Portal luyenthi `/` — block intro + danh sách đề / gói thi */
export default function LuyenthiPortalHome() {
  return (
    <>
      <LuyenthiHome />
      <Suspense
        fallback={
          <div className="page-loading-shell py-24" role="status" aria-label="Đang tải đề thi">
            <div className="mx-auto h-8 w-48 animate-pulse rounded bg-neutral-200" />
          </div>
        }
      >
        <OnlineExamPage embed />
      </Suspense>
    </>
  );
}
