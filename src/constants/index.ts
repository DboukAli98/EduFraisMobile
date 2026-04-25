// Update this to your actual API URL (e.g. local dev, staging, production)
export const API_BASE_URL =
  "https://edufrais-cnatavfte0fhdfe2.francecentral-01.azurewebsites.net/api";

export const MWANABOT_API_BASE_URL =
  "https://mwanabot-a4gefcggegdfbwah.canadacentral-01.azurewebsites.net";

// OneSignal app id (must match the AppId in the backend's
// appsettings.json → OneSignalCredentials, since the backend pushes
// to this app's player ids).
export const ONESIGNAL_APP_ID = "7a7bb505-d9c7-4366-9e85-7051fbfd2b90";

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

export const SUPPORT_REQUEST_STATUSES = {
  Pending: 6,
  InProgress: 11,
  Resolved: 14,
  Stall: 15,
  Cancelled: 9,
} as const;

export const SUPPORT_REQUEST_DIRECTIONS = {
  ParentToDirector: "PARENT_TO_DIRECTOR",
  ParentToAgent: "PARENT_TO_AGENT",
  AgentToDirector: "AGENT_TO_DIRECTOR",
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
