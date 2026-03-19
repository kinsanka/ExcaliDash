export type PasswordPolicy = {
  minLength: number;
  maxLength: number;
  requiresComplexity: boolean;
  pattern?: RegExp;
  patternHtml?: string;
  requirementsText: string;
  validationMessage: string;
  translate?: (key: string, params?: Record<string, string | number>) => string;
};

export type PasswordRequirement = {
  id: "minLength" | "uppercase" | "lowercase" | "number" | "symbol";
  label: string;
  ok: boolean;
};

export const STRONG_PASSWORD_MESSAGE =
  "Password must be at least 12 characters and include upper, lower, number, and symbol";

export const strongPasswordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,100}$/;

export const strongPasswordPatternHtml =
  "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,100}";

export const getPasswordPolicy = (
  opts?: { strong?: boolean; translate?: (key: string, params?: Record<string, string | number>) => string }
): PasswordPolicy => {
  const strong = typeof opts?.strong === "boolean" ? opts.strong : true;
  const t = opts?.translate;
  if (strong) {
    return {
      minLength: 12,
      maxLength: 100,
      requiresComplexity: true,
      pattern: strongPasswordPattern,
      patternHtml: strongPasswordPatternHtml,
      requirementsText:
        "12-100 characters, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.",
      validationMessage: t ? t("password.strongMessage") : STRONG_PASSWORD_MESSAGE,
      translate: t,
    };
  }

  return {
    minLength: 8,
    maxLength: 100,
    requiresComplexity: false,
    requirementsText: "8-100 characters.",
    validationMessage: t ? t("password.atLeastCharacters", { count: 8 }) : "Password must be at least 8 characters long",
    translate: t,
  };
};

export const getPasswordRequirements = (
  password: string,
  policy: PasswordPolicy
): PasswordRequirement[] => {
  const value = typeof password === "string" ? password : "";
  const requirements: PasswordRequirement[] = [
    {
      id: "minLength",
      label: policy.translate?.("password.atLeastCharacters", { count: policy.minLength }) ?? `At least ${policy.minLength} characters`,
      ok: value.length >= policy.minLength,
    },
  ];

  if (policy.requiresComplexity) {
    requirements.push(
      { id: "uppercase", label: policy.translate?.("password.uppercase") ?? "One uppercase letter (A-Z)", ok: /[A-Z]/.test(value) },
      { id: "lowercase", label: policy.translate?.("password.lowercase") ?? "One lowercase letter (a-z)", ok: /[a-z]/.test(value) },
      { id: "number", label: policy.translate?.("password.number") ?? "One number (0-9)", ok: /\d/.test(value) },
      { id: "symbol", label: policy.translate?.("password.symbol") ?? "One symbol", ok: /[^A-Za-z0-9]/.test(value) }
    );
  }

  return requirements;
};

export const validatePassword = (password: string, policy: PasswordPolicy): string | null => {
  if (typeof password !== "string") return policy.validationMessage;
  if (password.length < policy.minLength) return policy.validationMessage;
  if (password.length > policy.maxLength)
    return (policy as PasswordPolicy & { translate?: (key: string, params?: Record<string, string | number>) => string }).translate?.("password.maxLength", { count: policy.maxLength })
      ?? `Password must be at most ${policy.maxLength} characters long`;
  if (policy.pattern && !policy.pattern.test(password)) return policy.validationMessage;
  return null;
};
