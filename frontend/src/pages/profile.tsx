import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Play,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import type { User as AppUser, UpdateProfile } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { formatScore } from "@/lib/examPass";
import { profileKeys } from "@/lib/queryKeys";
import { TNJS } from "@/lib/tnjsTheme";
import { cn } from "@/lib/utils";
import { portalHref } from "@/lib/portal";

type ProfileTab = "exams" | "results" | "info";

const TABS: { id: ProfileTab; label: string; icon: typeof BookOpen }[] = [
  { id: "exams", label: "Đề của bạn", icon: BookOpen },
  { id: "results", label: "Kết quả thi", icon: Trophy },
  { id: "info", label: "Thông tin cá nhân", icon: User },
];

type PurchasedExam = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  isDemo: boolean | null;
  isLevelTrial: boolean | null;
  timeLimit: number;
  questionCount: number;
};

type PurchasedPackage = {
  entitlementId: string;
  packageId: string | null;
  name: string;
  level: string | null;
  status: string;
  exams: PurchasedExam[];
};

type ProfileAttempt = {
  id: string;
  examId: string;
  examTitle: string;
  examLevel: string | null;
  status: string;
  totalScore: number;
  totalTimeSpent: number;
  completedAt: string | null;
  startedAt: string;
  passed: boolean | null;
};

function isProfileTab(value: string | undefined): value is ProfileTab {
  return value === "exams" || value === "results" || value === "info";
}

function initialsOf(user: AppUser) {
  const source = user.fullName?.trim() || user.username;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function ExamsTab() {
  const { data, isLoading, isError } = useQuery<{ packages: PurchasedPackage[] }>({
    queryKey: profileKeys.exams,
    queryFn: async () => {
      const res = await apiFetch("/api/profile/exams");
      if (!res.ok) throw new Error("Không tải được đề đã mua");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Đang tải đề của bạn...
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-10 text-center text-sm text-destructive">
        Không tải được danh sách đề. Thử lại sau.
      </p>
    );
  }

  const packages = data?.packages ?? [];
  if (packages.length === 0) {
    return (
      <div className="py-12 text-center">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
        <h2 className="text-lg font-semibold">Chưa có đề đã mua</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Mua gói đề để mở toàn bộ đề thi trong gói và luyện không giới hạn lượt.
        </p>
        <Link href={portalHref("luyenthi", "/online-exam#exam-packages")}>
          <Button className="mt-5" style={{ backgroundColor: TNJS.orange }}>
            Xem gói đề
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {packages.map((pkg) => {
        const pending = pkg.status === "pending";
        return (
          <section key={pkg.entitlementId}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold sm:text-lg">{pkg.name}</h2>
              {pkg.level ? (
                <Badge variant="secondary">{pkg.level.toUpperCase()}</Badge>
              ) : null}
              <Badge
                className={
                  pending
                    ? "border-0 bg-amber-100 text-amber-800"
                    : "border-0 bg-emerald-100 text-emerald-800"
                }
              >
                {pending ? "Chờ thanh toán" : "Đã mở"}
              </Badge>
            </div>
            {pending ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Gói đang chờ xác nhận. Sau khi thanh toán xong bạn có thể vào thi các đề bên dưới.
              </p>
            ) : null}
            {pkg.exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Gói này chưa được gắn đề thi.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
                {pkg.exams.map((exam) => (
                  <li
                    key={exam.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{exam.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {exam.timeLimit || "—"} phút · {exam.questionCount || "—"} câu
                        {exam.level ? ` · ${exam.level.toUpperCase()}` : ""}
                      </p>
                    </div>
                    {pending ? (
                      <Button variant="outline" disabled>
                        Chưa mở
                      </Button>
                    ) : (
                      <Link href={portalHref("luyenthi", `/exam/${exam.id}`)}>
                        <Button
                          className="w-full sm:w-auto"
                          style={{ backgroundColor: TNJS.orange }}
                        >
                          <Play className="mr-1.5 h-4 w-4" />
                          Vào thi
                        </Button>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ResultsTab() {
  const { data, isLoading, isError } = useQuery<{ items: ProfileAttempt[] }>({
    queryKey: profileKeys.attempts,
    queryFn: async () => {
      const res = await apiFetch("/api/profile/attempts");
      if (!res.ok) throw new Error("Không tải được kết quả thi");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Đang tải kết quả thi...
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-10 text-center text-sm text-destructive">
        Không tải được kết quả thi. Thử lại sau.
      </p>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
        <h2 className="text-lg font-semibold">Chưa có lượt thi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kết quả sẽ hiện ở đây sau khi bạn nộp bài.
        </p>
        <Link href={portalHref("luyenthi", "/online-exam")}>
          <Button className="mt-5" variant="outline">
            Chọn đề để thi
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
      {items.map((item) => {
        const inProgress = item.status !== "completed";
        return (
          <li
            key={item.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{item.examTitle}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{formatDateTime(item.completedAt || item.startedAt)}</span>
                {inProgress ? (
                  <span className="font-medium text-amber-700">Đang làm</span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {formatScore(item.totalScore)} điểm
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(item.totalTimeSpent)}
                    </span>
                    {item.passed ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Đạt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-rose-700">
                        <XCircle className="h-3.5 w-3.5" />
                        Không đạt
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            {inProgress ? (
              <Link href={portalHref("luyenthi", `/exam/${item.examId}`)}>
                <Button variant="outline" className="w-full sm:w-auto">
                  Tiếp tục
                </Button>
              </Link>
            ) : (
              <Link href={portalHref("luyenthi", `/exam-result/${item.id}`)}>
                <Button variant="outline" className="w-full sm:w-auto">
                  Xem kết quả
                </Button>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function InfoTab({ user }: { user: AppUser }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user.fullName || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.fullName || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
  }, [user.id, user.fullName, user.email, user.phone]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const saveMutation = useMutation({
    mutationFn: async (payload: UpdateProfile) => {
      const res = await apiRequest("PUT", "/api/profile", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({ title: "Đã lưu", description: "Cập nhật thông tin thành công." });
    },
    onError: (error: Error) => {
      toast({
        title: "Không lưu được",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("avatar", file);
      const res = await apiFetch("/api/profile/avatar", { method: "POST", body });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Không tải được ảnh đại diện");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      toast({ title: "Đã cập nhật ảnh đại diện" });
    },
    onError: (error: Error) => {
      toast({
        title: "Không tải được ảnh",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5 text-center">
        <div className="relative">
          <Avatar className="h-32 w-32 ring-4 ring-muted">
            <AvatarImage
              src={avatarPreview || user.avatarUrl || ""}
              alt={user.username}
            />
            <AvatarFallback className="text-3xl font-bold text-primary">
              {initialsOf(user)}
            </AvatarFallback>
          </Avatar>
          {avatarMutation.isPending ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="h-7 w-7 animate-spin text-white" />
            </div>
          ) : null}
          <Label
            htmlFor="avatar-upload"
            className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white text-white"
            style={{ backgroundColor: TNJS.green }}
            title="Đổi ảnh đại diện"
          >
            <Camera className="h-4 w-4" />
          </Label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => onPickAvatar(e.target.files?.[0])}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">JPG, PNG, GIF, WebP — tối đa 5MB</p>
        {avatarFile ? (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => avatarMutation.mutate(avatarFile)}
              disabled={avatarMutation.isPending}
              style={{ backgroundColor: TNJS.green }}
            >
              Lưu ảnh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
                setAvatarFile(null);
                setAvatarPreview(null);
              }}
            >
              Hủy
            </Button>
          </div>
        ) : null}
      </div>

      <form
        className="space-y-4 rounded-xl border border-border bg-white p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate({
            fullName: fullName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="profile-username">Tên đăng nhập</Label>
          <Input id="profile-username" value={user.username} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-fullname">Họ và tên</Label>
          <Input
            id="profile-fullname"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
            placeholder="Tên hiển thị trên chứng chỉ"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Số điện thoại</Label>
          <Input
            id="profile-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            placeholder="10–11 chữ số"
          />
        </div>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu
            </>
          ) : (
            "Lưu thông tin"
          )}
        </Button>
      </form>
    </div>
  );
}

export default function ProfilePage({ tab }: { tab?: string }) {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const activeTab: ProfileTab = isProfileTab(tab) ? tab : "exams";

  useEffect(() => {
    document.title = "Hồ sơ của tôi";
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation(`/login?redirect=${encodeURIComponent("/profile/exams")}`);
      return;
    }
    if (!isProfileTab(tab)) {
      setLocation("/profile/exams", { replace: true });
    }
  }, [isLoading, isAuthenticated, tab, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <div
        className="relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(155deg, ${TNJS.greenDeep} 0%, ${TNJS.green} 55%, ${TNJS.greenBright} 100%)`,
        }}
      >
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-8 sm:flex-row sm:px-6 sm:py-10">
          <Avatar className="h-20 w-20 border-4 border-white/80 shadow-lg sm:h-24 sm:w-24">
            <AvatarImage src={user.avatarUrl || ""} alt={user.username} />
            <AvatarFallback className="bg-white text-2xl font-bold text-primary">
              {initialsOf(user)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {user.fullName || user.username}
            </h1>
            <p className="mt-1 text-white/85">@{user.username}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav className="h-fit overflow-hidden rounded-xl border border-border bg-white p-1.5 lg:sticky lg:top-24">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLocation(`/profile/${item.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                  active
                    ? "text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={active ? { backgroundColor: TNJS.green } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <h2 className="mb-4 text-xl font-bold">
            {TABS.find((item) => item.id === activeTab)?.label}
          </h2>
          {activeTab === "exams" ? <ExamsTab /> : null}
          {activeTab === "results" ? <ResultsTab /> : null}
          {activeTab === "info" ? <InfoTab user={user} /> : null}
        </div>
      </div>
    </div>
  );
}
