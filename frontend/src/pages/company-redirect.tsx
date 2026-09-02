import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy /company → portal home */
export default function CompanyRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/", { replace: true });
  }, [setLocation]);
  return (
    <div className="page-loading-shell" role="status" aria-label="Đang chuyển hướng">
      <div className="page-loading-hero" />
    </div>
  );
}
