/** Default copy for legacy site_contents pages — shared by public pages and admin editor. */

export const ONLINE_EXAM_CONTENT_DEFAULTS: Record<string, string> = {
  brandName: "Luyện thi Trí Nhân",
  heroTitle: "Thi thử & luyện đề trực tuyến",
  heroDescription:
    "Luyện đề miễn phí ngay, hoặc đăng nhập để làm đề chính thức và lưu kết quả — đồng hành cùng lộ trình tiếng Nhật Trí Nhân Academy.",
  "process-title": "Cách luyện thi tại Trí Nhân",
  "process-description":
    "Ba bước rõ ràng — đề thử không cần tài khoản; đề chính thức lưu kết quả sau khi đăng nhập",
  "process-0-title": "Chọn đề",
  "process-0-description": "Thi thử miễn phí hoặc đề chính thức theo mục tiêu",
  "process-1-title": "Làm bài",
  "process-1-description": "Theo thời gian và phần thi của đề đã chọn",
  "process-2-title": "Xem kết quả",
  "process-2-description":
    "Đề chính thức lưu điểm; đề thử giúp tự đánh giá",
  "list-title": "Danh sách đề thi",
  "list-description": "Lọc miễn phí / chính thức hoặc tìm theo tên đề",
  "login-banner":
    "Đề chính thức cần tài khoản để lưu kết quả. Đăng nhập rồi quay lại trang này hoặc vào thẳng đề bạn chọn.",
  "eco-title": "Luyện thi gắn với khóa tiếng Nhật",
  "eco-description":
    "Đề online giúp đo trình độ; lớp Trí Nhân Academy đồng hành từ sơ cấp đến JLPT với sensei bản ngữ và lớp nhỏ.",
};

export const CLASSES_CONTENT_DEFAULTS: Record<string, string> = {
  eyebrow: "Đào tạo tiếng Nhật",
  heroTitle: "Lớp đang tuyển sinh",
  heroDescription:
    "Chọn lớp phù hợp lịch và cấp độ — thanh toán online qua PayOS.",
  "empty-title": "Chưa có lớp đang mở",
  "empty-description": "Vui lòng quay lại sau hoặc liên hệ tư vấn.",
  "empty-cta": "Tư vấn miễn phí",
};

export function getSiteContentDefaults(
  page: string,
  _portal?: string,
): Record<string, string> | undefined {
  switch (page) {
    case "online-exam":
      return ONLINE_EXAM_CONTENT_DEFAULTS;
    case "classes":
      return CLASSES_CONTENT_DEFAULTS;
    default:
      return undefined;
  }
}
