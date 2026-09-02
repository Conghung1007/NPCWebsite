import { eq } from "drizzle-orm";
import { db } from "./db";
import { paymentSettings, type PaymentSetting } from "@shared/schema";
import {
  applyTransferTemplate,
  buildVietQrImageUrl,
  type PaymentSettingsInput,
} from "@shared/paymentSettings";

const DEFAULT_TEMPLATE = "LT {level} {username}";

export async function ensurePaymentSettingsTable(): Promise<void> {
  // Tables created via ensurePaymentSettings script; no-op for runtime safety
}

export async function getPaymentSettings(
  portal = "luyenthi",
): Promise<PaymentSetting | undefined> {
  const [row] = await db
    .select()
    .from(paymentSettings)
    .where(eq(paymentSettings.portal, portal))
    .limit(1);
  return row;
}

export async function upsertPaymentSettings(
  portal: string,
  input: PaymentSettingsInput,
): Promise<PaymentSetting> {
  const existing = await getPaymentSettings(portal);
  const values = {
    bankCode: input.bankCode.trim().toUpperCase(),
    bankName: input.bankName.trim(),
    accountNumber: input.accountNumber.replace(/\s/g, ""),
    accountName: input.accountName.trim(),
    transferTemplate: input.transferTemplate.trim() || DEFAULT_TEMPLATE,
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(paymentSettings)
      .set(values)
      .where(eq(paymentSettings.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(paymentSettings)
    .values({ portal, ...values })
    .returning();
  return row;
}

export function hasBankDisplay(settings?: PaymentSetting | null): boolean {
  return Boolean(
    settings?.bankCode?.trim() &&
      settings?.accountNumber?.trim() &&
      settings?.accountName?.trim(),
  );
}

export type PaymentDisplayPayload = {
  portal: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferTemplate: string;
  transferContent: string;
  configured: boolean;
  qrImageUrl: string | null;
};

export function buildPaymentDisplay(
  settings: PaymentSetting | undefined,
  opts?: {
    amount?: number;
    level?: string;
    username?: string;
    packageName?: string;
  },
): PaymentDisplayPayload {
  const portal = settings?.portal ?? "luyenthi";
  const configured = hasBankDisplay(settings);
  const transferTemplate =
    settings?.transferTemplate?.trim() || DEFAULT_TEMPLATE;

  const transferContent = configured
    ? applyTransferTemplate(transferTemplate, {
        level: opts?.level ?? "",
        username: opts?.username ?? "",
        package: opts?.packageName ?? "",
        amount: opts?.amount ? String(opts.amount) : "",
      }).trim()
    : "";

  const qrImageUrl =
    configured && settings
      ? buildVietQrImageUrl({
          bankCode: settings.bankCode,
          accountNumber: settings.accountNumber,
          accountName: settings.accountName,
          amount: opts?.amount,
          addInfo: transferContent,
        })
      : null;

  return {
    portal,
    bankCode: settings?.bankCode ?? "",
    bankName: settings?.bankName ?? "",
    accountNumber: settings?.accountNumber ?? "",
    accountName: settings?.accountName ?? "",
    transferTemplate,
    transferContent,
    configured,
    qrImageUrl,
  };
}
