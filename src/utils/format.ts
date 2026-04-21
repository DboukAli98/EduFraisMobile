// Format currency (XAF - CFA Franc BEAC, Congo Brazzaville)
export const formatCurrency = (amount: number): string => {
  return `${new Intl.NumberFormat("fr-CG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)} FCFA`;
};

// Congo Brazzaville timezone (WAT = UTC+1)
export const CONGO_TZ = "Africa/Brazzaville";

/**
 * Format a UTC date/datetime from the API into a human-readable string
 * displayed in the Congo Brazzaville local timezone (WAT, UTC+1).
 * Shows date + time so recent activity timestamps are meaningful.
 */
export const formatDateTimeCongo = (
  date: string | Date,
  locale = "fr",
): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    timeZone: CONGO_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

// Format date
export const formatDate = (date: string | Date, locale = "en"): string => {
  const d = new Date(date);
  return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Format date relative
export const formatRelativeDate = (date: string | Date): string => {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
};

// Format phone number
export const formatPhone = (phone: string, countryCode = "242"): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length >= 9) {
    return `${countryCode} ${cleaned.slice(-9, -6)} ${cleaned.slice(-6, -3)} ${cleaned.slice(-3)}`;
  }
  return phone;
};

/**
 * Normalize a free-form phone input to a single canonical form with the
 * country-code prefix baked in exactly once.
 *
 *   "812345678"           → "242812345678"
 *   "242812345678"        → "242812345678"
 *   "+242 812 345 678"    → "242812345678"
 *   "0812345678"          → "242812345678"
 *   "00242812345678"      → "242812345678"
 *   "242242812345678"     → "242812345678"   (collapses accidental double-prefix)
 *   ""                    → ""               (caller should treat as "no phone")
 *   "242"                 → ""               (only the prefix, no local number)
 */
export const normalizePhoneToE164 = (
  input: string,
  countryCode = "242",
): string => {
  let digits = (input || "").replace(/\D/g, "").replace(/^0+/, "");
  // Strip every leading copy of the country code so "242242…" collapses.
  while (digits.startsWith(countryCode)) {
    digits = digits.slice(countryCode.length);
  }
  if (!digits) return "";
  return `${countryCode}${digits}`;
};

/**
 * Inverse of normalizePhoneToE164 — returns just the local digits with no
 * country-code prefix and no leading zeros, suitable for prefilling an
 * input that displays the prefix as a separate label.
 *
 *   "242812345678"        → "812345678"
 *   "812345678"           → "812345678"
 *   "0812345678"          → "812345678"
 */
export const extractLocalDigits = (
  input: string,
  countryCode = "242",
): string => {
  let digits = (input || "").replace(/\D/g, "").replace(/^0+/, "");
  while (digits.startsWith(countryCode)) {
    digits = digits.slice(countryCode.length);
  }
  return digits;
};

// Format percentage
export const formatPercentage = (value: number): string => {
  return `${Math.round(value * 100) / 100}%`;
};

// Get initials from name
export const getInitials = (firstName: string, lastName?: string): string => {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return `${first}${last}`;
};

// Truncate text
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
};
