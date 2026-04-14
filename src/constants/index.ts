// Update this to your actual API URL (e.g. local dev, staging, production)
export const API_BASE_URL = "http://192.168.10.230:5149/api";

// Congo Brazzaville
export const COUNTRY_CODE = "242";
export const COUNTRY_NAME = "Congo Brazzaville";
export const CURRENCY = "XAF"; // CFA Franc BEAC
export const CURRENCY_SYMBOL = "FCFA";
export const LOCALE = "fr-CG";

export const PAYMENT_STATUSES = {
  Pending: 6,
  InProgress: 11,
  Processed: 8,
  Cancelled: 9,
  Failed: 10,
} as const;

export const ROLES = {
  SuperAdmin: "superadmin",
  Director: "director",
  Manager: "manager",
  Parent: "parent",
  CollectingAgent: "agent",
} as const;

export const PAYMENT_METHODS = {
  MobileMoney: "MobileMoney",
  AirtelMoney: "AirtelMoney",
} as const;

export const SUPPORT_PRIORITIES = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Urgent: "Urgent",
} as const;

export const ANIMATION_DURATION = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

export const PAGINATION_DEFAULT = {
  pageNumber: 1,
  pageSize: 10,
} as const;
