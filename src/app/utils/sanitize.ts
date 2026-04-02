/**
 * Input sanitization & validation utilities.
 * Provides defense-in-depth against XSS, injection, and malformed data.
 */

// ── UUID ───────────────────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUUID = (id: string): boolean => UUID_REGEX.test(id);

// ── Email ──────────────────────────────────────────────────────────────────
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(email.trim());

// ── Strip HTML / dangerous characters ─────────────────────────────────────
/**
 * Remove all HTML tags from a string.
 * Use this before storing or rendering any user-supplied text.
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/**
 * Encode HTML entities to prevent XSS when rendering user content as HTML.
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize a plain-text user input:
 * - Strips leading/trailing whitespace
 * - Removes HTML tags
 * - Truncates to maxLength
 * - Blocks known script-injection patterns
 */
export function sanitizeText(input: unknown, maxLength = 500): string {
  if (input === null || input === undefined) return '';
  let str = String(input).trim().slice(0, maxLength);
  // Strip HTML tags
  str = str.replace(/<[^>]*>/g, '');
  // Block javascript: and data: URI schemes
  str = str.replace(/javascript\s*:/gi, '').replace(/data\s*:/gi, '');
  // Block common event-handler injections
  str = str.replace(/on\w+\s*=/gi, '');
  // Block SQL comment sequences (defense-in-depth — Supabase uses parameterized queries)
  str = str.replace(/--/g, '').replace(/;/g, '');
  return str;
}

/**
 * Sanitize a numeric value with optional min/max clamping.
 */
export function sanitizeNumber(input: unknown, min = 0, max = 999_999_999): number {
  const n = typeof input === 'number' ? input : parseFloat(String(input));
  if (!isFinite(n) || isNaN(n)) return min;
  return Math.min(Math.max(Math.round(n * 1000) / 1000, min), max);
}

/**
 * Sanitize a date string.  Returns '' if not a valid ISO date.
 */
export function sanitizeDate(input: unknown): string {
  if (typeof input !== 'string') return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  // Only allow YYYY-MM-DD format
  const iso = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  return iso.slice(0, 10);
}

/**
 * Sanitize a drug/item name:
 * - Strips HTML, limits to 200 chars
 * - Allows letters, digits, spaces, hyphens, parentheses, slashes, commas, dots
 */
export function sanitizeDrugName(input: unknown): string {
  const clean = sanitizeText(input, 200);
  return clean.replace(/[^a-zA-ZÀ-ÿ0-9 \-()\/,.'%+]/g, '').trim();
}

// ── Simple client-side rate limiter ───────────────────────────────────────
class FrontendRateLimiter {
  private counts = new Map<string, { count: number; resetAt: number }>();

  /**
   * Returns true when the action is allowed.
   * Returns false (blocked) when the limit has been exceeded.
   */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.counts.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count++;
    this.counts.set(key, entry);
    return entry.count <= limit;
  }

  /** Reset a specific key (e.g. after successful auth). */
  reset(key: string): void {
    this.counts.delete(key);
  }
}

export const rateLimiter = new FrontendRateLimiter();
