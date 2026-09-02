/** VietQR acquirer codes (img.vietqr.io) */
export const VIETQR_BANKS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "MB", name: "MB Bank" },
  { code: "BIDV", name: "BIDV" },
  { code: "TCB", name: "Techcombank" },
  { code: "VPB", name: "VPBank" },
  { code: "ACB", name: "ACB" },
  { code: "STB", name: "Sacombank" },
  { code: "HDB", name: "HDBank" },
  { code: "MSB", name: "MSB" },
  { code: "OCB", name: "OCB" },
  { code: "KLB", name: "Kienlongbank" },
  { code: "TPB", name: "TPBank" },
  { code: "VIB", name: "VIB" },
  { code: "SHB", name: "SHB" },
] as const;

export type PaymentSettingsInput = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferTemplate: string;
};

export function applyTransferTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function buildVietQrImageUrl(opts: {
  bankCode: string;
  accountNumber: string;
  accountName?: string;
  amount?: number;
  addInfo?: string;
}): string | null {
  const bank = opts.bankCode.trim().toUpperCase();
  const acc = opts.accountNumber.replace(/\s/g, "");
  if (!bank || !acc) return null;
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(acc)}-compact2.png`;
  const params = new URLSearchParams();
  if (opts.amount && opts.amount > 0) {
    params.set("amount", String(Math.floor(opts.amount)));
  }
  if (opts.addInfo?.trim()) {
    params.set("addInfo", opts.addInfo.trim().slice(0, 100));
  }
  if (opts.accountName?.trim()) {
    params.set("accountName", opts.accountName.trim().slice(0, 50));
  }
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}
