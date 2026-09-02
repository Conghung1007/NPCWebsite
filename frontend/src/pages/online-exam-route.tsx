import { useEffect } from "react";
import { useLocation } from "wouter";
import { usePortal } from "@/contexts/PortalContext";
import OnlineExam from "@/pages/online-exam";

/** /online-exam → trang chủ luyện thi (/) */
export default function OnlineExamOrHome() {
  const { isLuyenthi } = usePortal();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLuyenthi) setLocation("/");
  }, [isLuyenthi, setLocation]);

  if (isLuyenthi) {
    return (
      <div
        className="page-loading-shell"
        role="status"
        aria-label="Đang chuyển hướng"
      >
        <div className="page-loading-hero" />
      </div>
    );
  }

  return <OnlineExam />;
}
