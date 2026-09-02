import { useEffect } from "react";
import { TNJS_EXTERNAL_URL } from "@/lib/portal";

/** Legacy path → external TNJS site */
export function RedirectToTnjs() {
  useEffect(() => {
    window.location.replace(TNJS_EXTERNAL_URL);
  }, []);

  return (
    <div
      className="page-loading-shell"
      role="status"
      aria-label="Đang chuyển tới tnjs.vn"
    >
      <div className="page-loading-hero" />
    </div>
  );
}
