const REDACTED = '[REDACTED]';

const REDACTION_PATTERNS: RegExp[] = [
  // Authorization headers: `Authorization: Basic ...` / `Authorization: Bearer ...`
  /\b(authorization\s*[:=]\s*(?:Basic|Bearer)\s+)[^\s"'&]+/gi,
  // Credential-shaped query/body params: client_secret=..., password=..., token=...
  /\b((?:client[_-]?secret|password|access[_-]?token|refresh[_-]?token|api[_-]?key)\s*[:=]\s*)["']?[^\s"'&]+/gi,
  // URL userinfo: scheme://user:pass@host
  /(:\/\/)[^\s@/]+:[^\s@/]+(@)/g
];

export const sanitizeErrorMessage = (input: unknown): string => {
  const message = input instanceof Error ? input.message : String(input);

  return REDACTION_PATTERNS.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, (_match, prefix: string, suffix?: string) => (
      suffix === undefined ? `${prefix}${REDACTED}` : `${prefix}${REDACTED}${suffix}`
    )),
    message
  );
};
