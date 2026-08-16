import { useEffect } from "react";
import { useLocation } from "wouter";
import { usePortal } from "@/contexts/PortalContext";
import GroupHome from "@/pages/group-home";
import JapaneseTraining from "@/pages/japanese-training";
import StudyAbroad from "@/pages/study-abroad";
import DaotaoHome from "@/pages/daotao-home";

/**
 * "/" — portal-specific home.
 * group → hub | tnjs → JP training | duhoc → study abroad | daotao → soft skills shell
 */
export default function PortalHome() {
  const { portal } = usePortal();

  if (portal === "tnjs") return <JapaneseTraining />;
  if (portal === "duhoc") return <StudyAbroad />;
  if (portal === "daotao") return <DaotaoHome />;
  return <GroupHome />;
}

/** On TNJS host, /japanese-training collapses to / */
export function RedirectJapaneseTrainingToHome() {
  const { isTnjs } = usePortal();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isTnjs) setLocation("/");
  }, [isTnjs, setLocation]);

  if (isTnjs) {
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

  return <JapaneseTraining />;
}
