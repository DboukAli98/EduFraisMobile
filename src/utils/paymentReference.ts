/**
 * Shared Airtel-ESB-compatible payment reference generator.
 *
 * Airtel Money's ESB validates `reference` against [A-Za-z0-9]{4,64}
 * (no dashes / dots / underscores). Operationally we keep it at the
 * lower bound — 4 characters — because that is what the DigiPay UAT
 * expects and what shows cleanly on merchant reports / SMS receipts.
 *
 * 36^4 = 1,679,616 combinations. We mix Date.now(), a rolling counter,
 * and a random value, then base-36 encode to ensure a uniform spread
 * across the keyspace. A short-lived in-memory Set prevents same-app-
 * session duplicates; the backend still enforces uniqueness in the
 * PaymentTransactions table.
 */

const generatedReferences = new Set<string>();
let referenceCounter = 0;

/**
 * Returns a unique 4-character uppercase alphanumeric reference.
 * Safe to call from any payment flow (school fees or merchandise).
 */
export const generatePaymentReference = (): string => {
  const maxAttempts = 64;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    referenceCounter = (referenceCounter + 1) % 1296;

    const mixedValue =
      (Date.now() + referenceCounter + Math.floor(Math.random() * 1_000_000)) %
      1_679_616;

    const candidate = mixedValue.toString(36).toUpperCase().padStart(4, "0");

    if (!generatedReferences.has(candidate)) {
      generatedReferences.add(candidate);
      return candidate;
    }
  }

  // Extremely unlikely fallback — if the Set is somehow saturated
  // in-memory we still return a fresh value rather than loop forever.
  const fallback = Math.floor(Math.random() * 1_679_616)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  generatedReferences.add(fallback);
  return fallback;
};
