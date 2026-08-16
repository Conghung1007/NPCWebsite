import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { formatVnd } from "@/hooks/useCart";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import type { ClassSession, Course, Enrollment } from "@shared/schema";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import { portalBadgeLabel } from "@/components/AdminPortalFilter";
import { PORTAL_IDS, PORTAL_META, type PortalId } from "@/lib/portal";

const LEVELS = ["N5", "N4", "N3", "N2", "N1", "Khác"];

type SessionRow = ClassSession & { courseTitle?: string; courseLevel?: string };

const emptyCourse = {
  title: "",
  level: "N5",
  description: "",
  coverImageUrl: "",
  isPublished: false,
  sortOrder: 0,
  portal: "tnjs" as PortalId,
};

const emptySession = {
  courseId: "",
  title: "",
  startDate: "",
  endDate: "",
  scheduleText: "",
  locationNote: "",
  priceVnd: 0,
  capacity: 10,
  status: "draft" as const,
  portal: "tnjs" as PortalId,
};

function toInputDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ClassManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { listQuery, defaultPortal } = useAdminPortal();
  const [courseDialog, setCourseDialog] = useState(false);
  const [sessionDialog, setSessionDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingSession, setEditingSession] = useState<SessionRow | null>(null);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [sessionForm, setSessionForm] = useState(emptySession);
  const [enrollSessionId, setEnrollSessionId] = useState<string | null>(null);

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["/api/admin/courses", listQuery],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/courses?${listQuery}`);
      if (!res.ok) throw new Error("Không tải khóa học");
      return res.json();
    },
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionRow[]>({
    queryKey: ["/api/admin/class-sessions", listQuery],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/class-sessions?${listQuery}`);
      if (!res.ok) throw new Error("Không tải lớp học");
      return res.json();
    },
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["/api/admin/class-sessions", enrollSessionId, "enrollments"],
    enabled: !!enrollSessionId,
    queryFn: async () => {
      const res = await apiFetch(
        `/api/admin/class-sessions/${enrollSessionId}/enrollments`,
      );
      if (!res.ok) throw new Error("Không tải ghi danh");
      return res.json();
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/class-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/class-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
  };

  const saveCourse = useMutation({
    mutationFn: async () => {
      const payload = {
        title: courseForm.title.trim(),
        level: courseForm.level,
        description: courseForm.description.trim() || null,
        coverImageUrl: courseForm.coverImageUrl.trim() || null,
        isPublished: courseForm.isPublished,
        sortOrder: Number(courseForm.sortOrder) || 0,
        portal: courseForm.portal,
      };
      if (editingCourse) {
        return apiRequest("PUT", `/api/admin/courses/${editingCourse.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/courses", payload);
    },
    onSuccess: () => {
      toast({ title: "Đã lưu khóa học" });
      setCourseDialog(false);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/courses/${id}`),
    onSuccess: () => {
      toast({ title: "Đã xóa khóa học" });
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const saveSession = useMutation({
    mutationFn: async () => {
      const payload = {
        courseId: sessionForm.courseId,
        title: sessionForm.title.trim(),
        startDate: sessionForm.startDate
          ? new Date(sessionForm.startDate).toISOString()
          : null,
        endDate: sessionForm.endDate
          ? new Date(sessionForm.endDate).toISOString()
          : null,
        scheduleText: sessionForm.scheduleText.trim() || null,
        locationNote: sessionForm.locationNote.trim() || null,
        priceVnd: Number(sessionForm.priceVnd) || 0,
        capacity: Number(sessionForm.capacity) || 10,
        status: sessionForm.status,
        portal: sessionForm.portal,
      };
      if (editingSession) {
        return apiRequest("PUT", `/api/admin/class-sessions/${editingSession.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/class-sessions", payload);
    },
    onSuccess: () => {
      toast({ title: "Đã lưu lớp học" });
      setSessionDialog(false);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteSession = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/class-sessions/${id}`),
    onSuccess: () => {
      toast({ title: "Đã xóa lớp học" });
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const courseTitleById = useMemo(() => {
    const m = new Map<string, string>();
    courses.forEach((c) => m.set(c.id, c.title));
    return m;
  }, [courses]);

  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm({
      ...emptyCourse,
      portal: defaultPortal === "group" ? "tnjs" : defaultPortal,
    });
    setCourseDialog(true);
  };

  const openEditCourse = (c: Course) => {
    setEditingCourse(c);
    setCourseForm({
      title: c.title,
      level: c.level,
      description: c.description || "",
      coverImageUrl: c.coverImageUrl || "",
      isPublished: !!c.isPublished,
      sortOrder: c.sortOrder ?? 0,
      portal: (c.portal as PortalId) || "tnjs",
    });
    setCourseDialog(true);
  };

  const openCreateSession = () => {
    const course = courses[0];
    setEditingSession(null);
    setSessionForm({
      ...emptySession,
      courseId: course?.id || "",
      portal:
        (course?.portal as PortalId) ||
        (defaultPortal === "group" ? "tnjs" : defaultPortal),
    });
    setSessionDialog(true);
  };

  const openEditSession = (s: SessionRow) => {
    setEditingSession(s);
    setSessionForm({
      courseId: s.courseId,
      title: s.title,
      startDate: toInputDate(s.startDate),
      endDate: toInputDate(s.endDate),
      scheduleText: s.scheduleText || "",
      locationNote: s.locationNote || "",
      priceVnd: s.priceVnd,
      capacity: s.capacity,
      status: (s.status as any) || "draft",
      portal: (s.portal as PortalId) || "tnjs",
    });
    setSessionDialog(true);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      published: "default",
      draft: "secondary",
      full: "outline",
      closed: "destructive",
    };
    const label: Record<string, string> = {
      published: "Đang mở",
      draft: "Nháp",
      full: "Hết chỗ",
      closed: "Đóng",
    };
    return <Badge variant={map[status] || "secondary"}>{label[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Khóa học</CardTitle>
            <CardDescription>Catalog JLPT / lộ trình — gắn với các lớp mở bán</CardDescription>
          </div>
          <Button onClick={openCreateCourse}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm khóa
          </Button>
        </CardHeader>
        <CardContent>
          {coursesLoading ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : courses.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Chưa có khóa học nào</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Cấp</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{portalBadgeLabel(c.portal)}</Badge>
                    </TableCell>
                    <TableCell>{c.level}</TableCell>
                    <TableCell>
                      {c.isPublished ? (
                        <Badge>Hiển thị</Badge>
                      ) : (
                        <Badge variant="secondary">Ẩn</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditCourse(c)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Xóa khóa "${c.title}" và các lớp thuộc khóa?`)) {
                            deleteCourse.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Lớp đang mở / đợt học</CardTitle>
            <CardDescription>Giá, lịch, sức chứa — publish để hiện trên trang tiếng Nhật</CardDescription>
          </div>
          <Button onClick={openCreateSession} disabled={courses.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm lớp
          </Button>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Chưa có lớp nào</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Khóa</TableHead>
                    <TableHead>Lịch</TableHead>
                    <TableHead>Giá</TableHead>
                    <TableHead>Chỗ</TableHead>
                    <TableHead>TT</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium max-w-[180px]">
                        <span className="line-clamp-2">{s.title}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{portalBadgeLabel(s.portal)}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.courseTitle || courseTitleById.get(s.courseId) || "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px]">
                        <span className="line-clamp-2">{s.scheduleText || "—"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatVnd(s.priceVnd)}</TableCell>
                      <TableCell>
                        {s.enrolledCount}/{s.capacity}
                        {s.reservedCount > 0 ? (
                          <span className="text-xs text-muted-foreground block">
                            +{s.reservedCount} giữ chỗ
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEnrollSessionId(s.id)}
                          title="Ghi danh"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditSession(s)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Xóa lớp "${s.title}"?`)) deleteSession.mutate(s.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Course dialog */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Sửa khóa học" : "Thêm khóa học"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên khóa</Label>
              <Input
                value={courseForm.title}
                onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Cấp độ</Label>
              <Select
                value={courseForm.level}
                onValueChange={(v) => setCourseForm({ ...courseForm, level: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Portal</Label>
              <Select
                value={courseForm.portal}
                onValueChange={(v) =>
                  setCourseForm({ ...courseForm, portal: v as PortalId })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PORTAL_META[id].brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mô tả</Label>
              <Textarea
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Ảnh cover (URL)</Label>
              <Input
                value={courseForm.coverImageUrl}
                onChange={(e) => setCourseForm({ ...courseForm, coverImageUrl: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={courseForm.isPublished}
                onCheckedChange={(v) =>
                  setCourseForm({ ...courseForm, isPublished: v === true })
                }
                id="course-pub"
              />
              <Label htmlFor="course-pub">Hiển thị công khai</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialog(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => saveCourse.mutate()}
              disabled={!courseForm.title.trim() || saveCourse.isPending}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session dialog */}
      <Dialog open={sessionDialog} onOpenChange={setSessionDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Sửa lớp học" : "Thêm lớp học"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Khóa học</Label>
              <Select
                value={sessionForm.courseId}
                onValueChange={(v) => {
                  const course = courses.find((c) => c.id === v);
                  setSessionForm({
                    ...sessionForm,
                    courseId: v,
                    portal: (course?.portal as PortalId) || sessionForm.portal,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn khóa" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} ({c.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Portal</Label>
              <Select
                value={sessionForm.portal}
                onValueChange={(v) =>
                  setSessionForm({ ...sessionForm, portal: v as PortalId })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PORTAL_META[id].brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tên lớp / đợt</Label>
              <Input
                value={sessionForm.title}
                onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                placeholder="VD: N5 Khai giảng tháng 9/2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ngày bắt đầu</Label>
                <Input
                  type="date"
                  value={sessionForm.startDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Ngày kết thúc</Label>
                <Input
                  type="date"
                  value={sessionForm.endDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Lịch học</Label>
              <Input
                value={sessionForm.scheduleText}
                onChange={(e) => setSessionForm({ ...sessionForm, scheduleText: e.target.value })}
                placeholder="T2–T4 18:00–20:00"
              />
            </div>
            <div>
              <Label>Địa điểm / hình thức</Label>
              <Input
                value={sessionForm.locationNote}
                onChange={(e) => setSessionForm({ ...sessionForm, locationNote: e.target.value })}
                placeholder="Offline Hà Nội / Online Zoom"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Học phí (VND)</Label>
                <Input
                  type="number"
                  min={0}
                  value={sessionForm.priceVnd}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, priceVnd: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Sức chứa</Label>
                <Input
                  type="number"
                  min={1}
                  value={sessionForm.capacity}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, capacity: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <Select
                value={sessionForm.status}
                onValueChange={(v) =>
                  setSessionForm({ ...sessionForm, status: v as typeof sessionForm.status })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Nháp</SelectItem>
                  <SelectItem value="published">Đang mở (public)</SelectItem>
                  <SelectItem value="full">Hết chỗ</SelectItem>
                  <SelectItem value="closed">Đóng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialog(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => saveSession.mutate()}
              disabled={
                !sessionForm.title.trim() ||
                !sessionForm.courseId ||
                saveSession.isPending
              }
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrollments */}
      <Dialog open={!!enrollSessionId} onOpenChange={(o) => !o && setEnrollSessionId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Danh sách ghi danh</DialogTitle>
          </DialogHeader>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Chưa có học viên</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.fullName}</TableCell>
                    <TableCell>{e.phone}</TableCell>
                    <TableCell className="text-sm">{e.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
