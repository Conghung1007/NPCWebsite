export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SPECIAL_CHARS = "@$!%*?&";

export type PasswordRuleCheck = {
  ok: boolean;
  label: string;
};

export type PasswordStrength = {
  score: number;
  label: string;
  barClass: string;
};

export function validatePasswordRules(password: string) {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[@$!%*?&]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const rules = validatePasswordRules(password);
  return rules.minLength && rules.hasUppercase && rules.hasDigit && rules.hasSpecial;
}

export const PASSWORD_VALIDATION_MESSAGE =
  "Mật khẩu phải có ít nhất 8 ký tự, 1 chữ hoa, 1 số và 1 ký tự đặc biệt (@$!%*?&)";

export function getPasswordRuleChecks(
  password: string,
  confirmPassword?: string,
): PasswordRuleCheck[] {
  const rules = validatePasswordRules(password);
  const checks: PasswordRuleCheck[] = [
    { ok: rules.minLength, label: "Ít nhất 8 ký tự" },
    { ok: rules.hasUppercase, label: "Có chữ hoa" },
    { ok: rules.hasDigit, label: "Có chữ số" },
    { ok: rules.hasSpecial, label: `Có ký tự đặc biệt (${PASSWORD_SPECIAL_CHARS})` },
  ];

  if (confirmPassword !== undefined) {
    checks.push({
      ok: !!confirmPassword && password === confirmPassword,
      label: "Xác nhận khớp",
    });
  }

  return checks;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "", barClass: "bg-neutral-200" };
  }

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[@$!%*?&]/.test(password)) score += 1;

  if (score <= 2) return { score, label: "Yếu", barClass: "bg-red-500" };
  if (score <= 3) return { score, label: "Trung bình", barClass: "bg-amber-500" };
  if (score <= 4) return { score, label: "Khá", barClass: "bg-emerald-500" };
  return { score, label: "Mạnh", barClass: "bg-green-600" };
}
