import { randomInt } from "crypto";
import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY?.trim()) return null;
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const DEFAULT_SENDER = "TNJS <support@tnjs.vn>";

function senderAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_SENDER;
}

const APP_NAME = process.env.EMAIL_APP_NAME?.trim() || "TNJS";

export function isEmailServiceConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function generateOTPCode(): string {
  return randomInt(100000, 1000000).toString();
}

export function getExpirationTime(minutes = 5): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendEmailResult> {
  const client = getResend();
  if (!client) {
    console.warn("RESEND_API_KEY missing — skip sending email to", to);
    return { success: false, error: "Email service chưa được cấu hình" };
  }

  try {
    const { error } = await client.emails.send({
      from: senderAddress(),
      to: [to],
      subject,
      html,
      text,
    });
    if (error) {
      console.error("Resend API error:", error);
      return { success: false, error: error.message || "Không thể gửi email" };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể gửi email";
    console.error("Failed to send email:", message);
    return { success: false, error: message };
  }
}

function buildOtpEmailHtml(opts: {
  title: string;
  intro: string;
  code: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Segoe UI,sans-serif;background:#f4f7fa;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#00A651,#059669);padding:28px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${opts.title}</h1>
    </div>
    <div style="padding:28px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;">${opts.intro}</p>
      <div style="background:#ecfdf5;border-radius:12px;padding:22px;text-align:center;margin:20px 0;">
        <div style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#047857;font-family:monospace;">${opts.code}</div>
      </div>
      <p style="color:#6b7280;font-size:13px;text-align:center;">Mã có hiệu lực trong <strong>5 phút</strong></p>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">${opts.footer}</p>
    </div>
  </div>
</body></html>`;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  email: string,
  maxAttempts = 3,
  windowMinutes = 5,
): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitStore.get(key);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMinutes * 60 * 1000,
    });
    return true;
  }
  if (record.count >= maxAttempts) return false;
  record.count++;
  return true;
}

export function getRateLimitRemaining(email: string): {
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(email.toLowerCase());
  if (!record || now > record.resetTime) {
    return { remaining: 3, resetInSeconds: 0 };
  }
  return {
    remaining: Math.max(0, 3 - record.count),
    resetInSeconds: Math.ceil((record.resetTime - now) / 1000),
  };
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  type: "registration",
): Promise<SendEmailResult> {
  const subject = `Mã xác minh đăng ký - ${APP_NAME}`;
  const html = buildOtpEmailHtml({
    title: APP_NAME,
    intro: `Bạn đang đăng ký tài khoản tại <strong>${APP_NAME}</strong>. Nhập mã bên dưới để hoàn tất:`,
    code,
    footer: "Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.",
  });
  const text = `Mã xác minh đăng ký ${APP_NAME}: ${code}. Mã có hiệu lực 5 phút.`;
  return sendEmail(email, subject, html, text);
}
