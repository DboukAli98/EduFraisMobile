import type { ActivityRequestStatus } from "../types";

/**
 * The backend C# enum for the parent-request lifecycle:
 *
 *   public enum ActivityRequestStatus
 *   {
 *       Requested = 1,
 *       Accepted  = 2,
 *       Declined  = 3,
 *       Completed = 4,
 *       Cancelled = 5
 *   }
 *
 * Wire format SHOULD be the string name (the API has a global
 * `JsonStringEnumConverter`), but in practice some endpoints have been
 * observed serializing the raw numeric value — most likely because the
 * field is `ActivityRequestStatus?` (nullable enum) and the converter
 * doesn't always fire on nullable enums in every code path.
 *
 * Defensive normalization: accept either form on read so the badge
 * + button logic never silently breaks. If the value is anything we
 * don't recognise, return null so the caller can decide a fallback.
 */
const NUMERIC_TO_STRING: Record<number, ActivityRequestStatus> = {
  1: "Requested",
  2: "Accepted",
  3: "Declined",
  4: "Completed",
  5: "Cancelled",
};

const VALID_STATUSES: readonly ActivityRequestStatus[] = [
  "Requested",
  "Accepted",
  "Declined",
  "Completed",
  "Cancelled",
];

export const normalizeRequestStatus = (
  raw: unknown,
): ActivityRequestStatus | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return NUMERIC_TO_STRING[raw] ?? null;
  }
  if (typeof raw === "string") {
    // Accept the canonical PascalCase form as-is.
    if ((VALID_STATUSES as readonly string[]).includes(raw)) {
      return raw as ActivityRequestStatus;
    }
    // Fall back to a case-insensitive match in case a serializer ever
    // emits camelCase ("requested") or all-uppercase ("REQUESTED").
    const match = VALID_STATUSES.find(
      (s) => s.toLowerCase() === raw.toLowerCase(),
    );
    return match ?? null;
  }
  return null;
};
