import { usePortal } from "@/contexts/PortalContext";
import GroupHome from "@/pages/group-home";
import HuongnghiepHome from "@/pages/huongnghiep-home";
import DichvuHome from "@/pages/dichvu-home";
import LuyenthiPortalHome from "@/pages/luyenthi-portal-home";

/**
 * "/" — portal-specific home.
 * group → hub | huongnghiep | dichvu | luyenthi → block intro + đề thi
 * Đào tạo tiếng Nhật → https://tnjs.vn (site TNJS)
 */
export default function PortalHome() {
  const { portal } = usePortal();

  if (portal === "huongnghiep") return <HuongnghiepHome />;
  if (portal === "dichvu") return <DichvuHome />;
  if (portal === "luyenthi") return <LuyenthiPortalHome />;
  return <GroupHome />;
}
