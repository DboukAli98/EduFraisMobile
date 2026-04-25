// ─── User & Auth ────────────────────────────────────────────────
export type UserRole =
  | "superadmin"
  | "director"
  | "manager"
  | "parent"
  | "agent";

export interface LoginRequest {
  CountryCode: string;
  MobileNumber: string;
  Password: string;
  CivilId?: string;
  LoginByType?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  // Backend sets this to true when the user (typically a freshly-created
  // collecting agent) logged in with an auto-generated password and must
  // change it before using the app.
  mustChangePassword?: boolean;
  userId?: string;
}

export interface RegisterRequest {
  FirstName: string;
  LastName: string;
  Role: string;
  Password: string;
  SchoolId: number;
  CivilId?: string;
  CountryCode?: string;
  PhoneNumber?: string;
  Email?: string;
}

// Init step of the OTP-based password reset. Caller identifies the
// account by EITHER (CountryCode + MobileNumber) OR Email, and picks
// the delivery channel. No SMS — only "email" or "whatsapp".
export interface ResetPasswordInitRequest {
  CountryCode?: string;
  MobileNumber?: string;
  Email?: string;
  Channel: "email" | "whatsapp";
}

// Final step: same identifier + the 6-digit OTP the user received,
// plus the new password. `Token` is kept for backwards compat — the
// server treats the value as the 6-digit OTP code.
export interface ResetPasswordFinalRequest {
  CountryCode?: string;
  MobileNumber?: string;
  Email?: string;
  Token: string;
  NewPassword: string;
}

export interface RegisterPushTokenRequest {
  UserId: string;
  Role: string;
  DevicePushToken: string;
}

// Decoded JWT user
export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  entityUserId: string;
  schoolId: string;
}

// ─── Base API Response Types ────────────────────────────────────
export interface BaseResponse {
  status: string;
  error?: string;
  message?: string;
}

export interface ApiResponse<T = any> extends BaseResponse {
  data?: T;
}

export interface PagedResponse<T> extends BaseResponse {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export interface PaginationRequest {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
}

// ─── MwanaBot ───────────────────────────────────────────────────
export type MwanaBotChatRole = "user" | "model";

export interface MwanaBotChatMessage {
  role: MwanaBotChatRole;
  text: string;
}

export type MwanaBotSource = Record<string, unknown>;

// ─── School ─────────────────────────────────────────────────────
export interface School {
  schoolId: number;
  schoolName: string;
  schoolAddress: string;
  schoolPhoneNumber: string;
  schoolEmail: string;
  schoolEstablishedYear?: number;
  schoolDescription?: string;
  schoolWebsite?: string;
  schoolLogo?: string;
  fK_StatusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface SchoolGradeSection {
  schoolGradeSectionId: number;
  schoolGradeName: string;
  schoolGradeDescription?: string;
  schoolGradeFee: number;
  fK_SchoolId: number;
  fK_StatusId: number;
  termStartDate: string;
  termEndDate: string;
  createdOn?: string;
  modifiedOn?: string;
}

// ─── Parent ─────────────────────────────────────────────────────
export interface Parent {
  parentId: number;
  firstName: string;
  lastName: string;
  fatherName: string;
  countryCode: string;
  phoneNumber: string;
  civilId: string;
  email: string;
  oneSignalPlayerId?: string;
  fK_StatusId: number;
  fK_UserId: string;
  createdOn?: string;
  modifiedOn?: string;
}

export interface ParentSchoolDto {
  schoolId: number;
  schoolName: string;
}

export interface ParentInstallmentDto {
  installmentId: number;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  paidDate?: string;
  lateFee: number;
  statusId: number;
  childName: string;
  schoolName: string;
  gradeName: string;
  paymentCycleName: string;
}

export interface RecentPaymentTransactionDto {
  paymentTransactionId: number;
  fK_InstallmentId?: number;
  amountPaid: number;
  paidDate: string;
  paymentMethod: string;
  transactionReference: string;
  fK_StatusId?: number;
  statusName?: string;
  isPaid?: boolean;
  childId?: number;
  childFirstName?: string;
  childLastName?: string;
  childFullName?: string;
  childName?: string;
  gradeName?: string;
  schoolName?: string;
  paymentType?: string;
  daysAgo?: number;
}

export interface PaymentTransactionsSummary {
  totalTransactions: number;
  totalAmountPaid: number;
  timePeriod: string;
  parentId: number;
  dateRange: { from?: string; to?: string };
}

export interface GetRecentPaymentTransactionsResponse extends BaseResponse {
  data: RecentPaymentTransactionDto[];
  summary: PaymentTransactionsSummary;
}

// ─── Children ───────────────────────────────────────────────────
export interface Child {
  childId: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  fatherName: string;
  fK_ParentId: number;
  fK_SchoolId: number;
  fK_StatusId: number;
  createdByUserId?: string;
  rejectionReason?: string;
  approvedDate?: string;
  approvedByUserId?: string;
  createdOn?: string;
  modifiedOn?: string;
  // Resolved from the School navigation by GetSingleChildren so the
  // detail screen can display a name instead of relying on a route
  // param (which was missing when opened from notifications).
  schoolName?: string;
}

export interface ChildWithGradeDto {
  childId: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolName: string;
  schoolGradeName?: string;
  fK_ParentId: number;
  fK_SchoolId: number;
  fK_StatusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface ChildGrade {
  childGradeId: number;
  fK_ChildId: number;
  fK_SchoolGradeSectionId: number;
  fK_StatusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface AddChildRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  fatherName?: string;
  parentId: number;
  schoolId: number;
}

// ─── Payment Cycle & Installments ───────────────────────────────
// Backend enum order: Full=0, Monthly=1, Weekly=2, Quarterly=3, Custom=4.
// The API serializes this as its numeric value, so consumers must accept
// both the raw number and the string name they can derive from it.
export type PaymentCycleType =
  | "Full"
  | "Monthly"
  | "Weekly"
  | "Quarterly"
  | "Custom";
// Backend IntervalUnit enum: Day=0, Week=1, Month=2, Year=3.
export type IntervalUnitName = "Day" | "Week" | "Month" | "Year";

export interface PaymentCycle {
  paymentCycleId: number;
  paymentCycleName: string;
  paymentCycleDescription?: string | null;
  paymentCycleType: PaymentCycleType | number;
  fK_SchoolGradeSectionId: number;
  planStartDate: string;
  intervalCount?: number | null;
  intervalUnit?: IntervalUnitName | number | null;
  installmentAmounts?: string | null;
  createdOn?: string;
  modifiedOn?: string;
}

export interface Installment {
  installmentId: number;
  fK_ChildCycleSelectionId: number;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  paidDate?: string;
  lateFee?: number;
  statusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface ChildCycleSelection {
  childCycleSelectionId: number;
  fK_ChildGradeId: number;
  fK_PaymentCycleId: number;
  totalFee: number;
  createdOn?: string;
  modifiedOn?: string;
}

// ─── Payment Transactions ───────────────────────────────────────
export interface PaymentTransaction {
  paymentTransactionId: number;
  fK_InstallmentId?: number;
  amountPaid: number;
  paidDate: string;
  paymentMethod: string;
  transactionReference: string;
  transactionMapId?: string;
  fK_StatusId: number;
  fK_CollectingAgentId?: number;
  processedByAgent: boolean;
  agentCommission?: number;
  collectionMethod?: string;
  agentNotes?: string;
  fK_UserId?: string;
  paymentType?: string;
  createdOn?: string;
  modifiedOn?: string;
}

export interface InitiatePaymentRequest {
  reference: string;
  subscriberMsisdn: string;
  amount: number;
  callbackUrl?: string;
  installmentId?: number;
  paymentType: string;
  merchandiseItems?: MerchandiseItemDto[];
  userId: string;
}

export interface MerchandiseItemDto {
  merchandiseId: number;
  quantity: number;
}

export interface InitiatePaymentResponse extends BaseResponse {
  reference: string;
  requestToPayStatus: string;
  paymentTransactionId?: number;
}

export interface SchoolFeesPaymentHistoryDto {
  paymentTransactionId: number;
  amountPaid: number;
  paidDate: string;
  paymentMethod: string;
  transactionReference: string;
  // Backend returns the numeric status id (fK_StatusId). statusName is not
  // serialised on this envelope, so the client resolves the label locally.
  fK_StatusId?: number;
  statusName?: string;
  childFullName?: string;
  firstName?: string;
  lastName?: string;
  childName?: string;
  schoolName?: string;
  schoolGradeName?: string;
  gradeName?: string;
}

export interface MerchandisePaymentHistoryDto {
  paymentTransactionId: number;
  amountPaid: number;
  paidDate: string;
  paymentMethod: string;
  transactionReference: string;
  fK_StatusId?: number;
  statusName?: string;
  merchandiseName?: string;
  schoolName?: string;
}

// ─── Invoices ───────────────────────────────────────────────────
// PDF receipt record generated by the backend whenever a payment
// transaction lands on status 8 (Processed). Same shape for both
// SCHOOLFEE and MERCHANDISEFEE flows — `invoiceType` distinguishes.
export interface InvoiceHistoryDto {
  invoiceId: number;
  invoiceNumber: string;
  paymentTransactionId: number;
  invoiceType: "SCHOOLFEE" | "MERCHANDISEFEE" | string;
  totalAmount: number;
  filePath: string; // Public path under wwwroot, e.g. /invoices/2026/04/INV-2026-000123.pdf
  fileName: string;
  generatedOn: string;
  paymentMethod?: string;
  transactionReference?: string;
  paidDate?: string;
}

// ─── School Merchandise ─────────────────────────────────────────
export interface SchoolMerchandiseCategory {
  schoolMerchandiseCategoryId: number;
  schoolMerchandiseCategoryName: string;
  schoolMerchandiseCategoryDescription?: string;
  fK_StatusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface SchoolMerchandise {
  schoolMerchandiseId: number;
  schoolMerchandiseName: string;
  schoolMerchandiseDescription?: string;
  schoolMerchandisePrice: number;
  schoolMerchandiseLogo?: string;
  fK_SchoolId: number;
  fK_SchoolMerchandiseCategory: number;
  fK_StatusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

// ─── Collecting Agent ───────────────────────────────────────────
export interface CollectingAgent {
  collectingAgentId: number;
  firstName: string;
  lastName: string;
  email?: string;
  countryCode: string;
  phoneNumber: string;
  assignedArea?: string;
  commissionPercentage?: number;
  oneSignalPlayerId?: string;
  fK_SchoolId: number;
  fK_StatusId: number;
  fK_UserId: string;
  createdOn?: string;
  modifiedOn?: string;
}

// Parent-initiated request lifecycle states. Keeps in sync with the
// backend enum ActivityRequestStatus (1..5). The mobile code generally
// uses the string form — numeric form is only emitted by the older
// get-my-activities endpoint which serializes the raw model.
export type ActivityRequestStatus =
  | "Requested"
  | "Accepted"
  | "Declined"
  | "Completed"
  | "Cancelled";

// Activity types a parent is allowed to ask an agent to perform. Kept
// separate from the full CollectingAgentActivityType so the
// RequestActivityScreen chip picker can't emit agent-only types
// (PaymentCollected/Attempted etc.).
export type ParentRequestableActivityType =
  | "FieldVisit"
  | "PhoneCall"
  | "ParentContact"
  | "PaymentHelp"
  | "Other";

export interface CollectingAgentActivity {
  activityId: number;
  // Both shapes are accepted because the backend exposes this entity
  // through two different response paths:
  //   - Model-based (director GetAgentActivities) emits fK_* columns.
  //   - DTO-based (GetMyActivities / GetMyActivityRequests) emits the
  //     flattened collectingAgentId / parentId / agentName / parentName.
  fK_CollectingAgentId?: number;
  collectingAgentId?: number;
  fK_ParentId?: number;
  parentId?: number;
  agentName?: string;
  parentName?: string;
  activityType: string | number;
  activityTypeDisplayName?: string;
  activityDescription: string;
  notes?: string;
  relatedTransactionId?: number;
  relatedSupportRequestId?: number;
  activityDate: string;
  parent?: Parent | null;
  collectingAgent?: CollectingAgent | null;
  createdOn?: string;
  modifiedOn?: string;

  // --- Parent-initiated request lifecycle -------------------------------
  // All null/undefined on classic agent-logged rows. Present on rows the
  // parent filed via RequestActivity.
  requestStatus?: ActivityRequestStatus | null;
  requestStatusDisplayName?: string | null;
  requestedByParent?: boolean;
  requestedAt?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  declineReason?: string | null;
}

export interface AgentCommission {
  commissionId: number;
  fK_CollectingAgentId: number;
  fK_PaymentTransactionId: number;
  commissionAmount: number;
  commissionRate: number;
  isApproved: boolean;
  approvedBy?: string;
  approvedDate?: string;
  description?: string;
  approvalNotes?: string;
  commissionType: "Collection" | "Bonus" | "Incentive" | "Penalty";
  status: "Pending" | "Approved" | "Rejected" | "Paid";
  createdOn?: string;
  modifiedOn?: string;
}

export interface AgentPerformance extends BaseResponse {
  agentId: number;
  agentName: string;
  periodStart: string;
  periodEnd: string;
  assignedParentsCount: number;
  totalActivitiesCount: number;
  paymentCollectedCount: number;
  paymentAttemptedCount: number;
  successRate: number;
  totalCommissionsEarned: number;
  totalAmountCollected: number;
  commissionPercentage: number;
  averageCollectionAmount: number;
  performanceGrade: string;
}

export interface CollectingAgentParents {
  collectingAgentParentId: number;
  fK_CollectingAgentId: number;
  fK_ParentId: number;
  assignedDate: string;
  unassignedDate?: string;
  isActive: boolean;
  assignmentNotes?: string;
  fK_AssignedByDirectorId?: number | null;
  approvalStatus?: "Pending" | "Approved" | "Rejected" | null;
  requestedByParent?: boolean;
  approvalNotes?: string | null;
  reviewedDate?: string | null;
  fK_ReviewedByDirectorId?: number | null;
  collectingAgent?: CollectingAgent;
  parent?: Parent;
}

// ─── Director ───────────────────────────────────────────────────
export interface Director {
  directorId: number;
  firstName: string;
  lastName: string;
  email?: string;
  countryCode: number;
  phoneNumber: string;
  fK_SchoolId: number;
  fK_StatusId: number;
  fK_UserId: string;
  createdOn?: string;
  modifiedOn?: string;
}

// ─── Support Requests ───────────────────────────────────────────
export type SupportRequestType = "General" | "Payment" | "Help";
export type SupportRequestPriority = "Low" | "Medium" | "High" | "Urgent";

export interface SupportRequest {
  supportRequestId: number;
  title: string;
  description: string;
  resultNotes?: string;
  supportRequestType: SupportRequestType;
  fK_StatusId: number;
  fK_SchoolId: number;
  fK_ParentId?: number;
  fK_AssignedCollectingAgentId?: number;
  fK_DirectorId?: number;
  assignedToAgentDate?: string;
  priority: SupportRequestPriority;
  expectedResolutionDate?: string;
  resolvedDate?: string;
  isAgentAssigned: boolean;
  createdByUserId: string;
  createdOn?: string;
  modifiedOn?: string;
}

export interface SupportRequestStatusLog {
  supportRequestStatusLogId: number;
  fK_SupportRequestId: number;
  fK_StatusId: number;
  message?: string;
  createdOn?: string;
}

export interface AddSupportRequestPayload {
  requestDirection: string;
  supportRequestModel: {
    title: string;
    description: string;
    supportRequestType: SupportRequestType;
    statusId: number;
    schoolId: number;
    parentId?: number;
    collectingAgentId?: number;
    directorId?: number;
    priority: SupportRequestPriority;
    expectedResolutionDate?: string;
  };
}

// ─── Notifications ──────────────────────────────────────────────
export interface AppNotification {
  notificationId: number;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  scheduledFor?: string;
  // Optional deep-link metadata. Frontend uses these when present to
  // navigate to the exact entity detail screen instead of a section.
  // The backend may not populate them yet for every notification kind —
  // when missing, the router falls back to type-based section routing.
  relatedEntityId?: number;
  relatedEntityType?: string; // e.g. "Child", "Parent", "SupportRequest", "AgentRequest", "Payment"
}

// ─── Reports ────────────────────────────────────────────────────
export interface StudentCountReport {
  totalStudents: number;
  activeStudents: number;
  schoolId: number;
}

export interface PendingPaymentsReport {
  totalPendingAmount: number;
  totalPendingCount: number;
  schoolId: number;
}

export interface ActiveParentsReport {
  totalActiveParents: number;
  schoolId: number;
}

export interface PaidInstallmentsReport {
  totalPaidAmount: number;
  totalPaidCount: number;
  schoolId: number;
}

export type ReportPeriod = "week" | "month" | "quarter" | "year";

export interface PaymentTrendPoint {
  label: string;
  totalAmount: number;
  totalTransactions: number;
}

export interface AgentCollectionSummary {
  collectingAgentId: number;
  agentName: string;
  totalCollectedAmount: number;
  totalTransactions: number;
  sharePercentage: number;
}

export interface PaymentMethodBreakdown {
  paymentMethod: string;
  totalAmount: number;
  totalTransactions: number;
  percentage: number;
}

// ─── Status Constants ───────────────────────────────────────────
export type PaymentStatus =
  | "Pending"
  | "InProgress"
  | "Processed"
  | "Cancelled"
  | "Failed";
export type ChildApprovalStatus = "Pending" | "Approved" | "Rejected";

// ─── Loyalty ────────────────────────────────────────────────────
// String unions match the backend enums (serialized as their .ToString()
// names). The backend self-service envelopes are documented in
// CLAUDE.md → "Loyalty / Self-service".

export type LoyaltyMemberType = "Parent" | "CollectingAgent";
export type LoyaltyTriggerType =
  | "SchoolFeePaymentProcessed"
  | "MerchandisePaymentProcessed"
  | "AgentCollectionProcessed"
  | "ManualEnrollmentBonus"
  | "ManualAdjustment";
export type LoyaltyRulePeriodType =
  | "None"
  | "Daily"
  | "Weekly"
  | "Monthly"
  | "ProgramLifetime";
export type LoyaltyRewardType =
  | "Merchandise"
  | "SchoolFeeCredit"
  | "CustomBenefit";
export type LoyaltyLedgerEntryType =
  | "Earn"
  | "Redeem"
  | "Reverse"
  | "ManualCredit"
  | "ManualDebit";
export type LoyaltyReferenceType =
  | "PaymentTransaction"
  | "Redemption"
  | "Rule"
  | "Manual";
export type LoyaltyRedemptionStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Fulfilled"
  | "Cancelled";

export interface LoyaltyProgramDto {
  loyaltyProgramId: number;
  schoolId: number;
  programName: string;
  programDescription?: string | null;
  pointsLabel: string; // defaults to "Points" — render via this so directors can rebrand
  welcomeBonusPoints: number;
  minimumRedeemPoints: number;
  autoApproveRedemptions: boolean;
  allowParentParticipation: boolean;
  allowAgentParticipation: boolean;
  termsAndConditions?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  statusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface LoyaltyMemberDto {
  loyaltyMemberId: number;
  loyaltyProgramId: number;
  schoolId: number;
  memberType: LoyaltyMemberType;
  memberEntityId: number; // ParentId or CollectingAgentId — never display
  userId: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  currentPointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  lastActivityOn?: string | null;
  statusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface LoyaltyRuleDto {
  loyaltyRuleId: number;
  loyaltyProgramId: number;
  ruleName: string;
  ruleDescription?: string | null;
  memberType: LoyaltyMemberType;
  triggerType: LoyaltyTriggerType;
  pointsAwarded: number;
  minimumAmount?: number | null;
  requiresOnTimePayment: boolean;
  requiresFullPayment: boolean;
  maxAwardsPerMember?: number | null;
  periodType: LoyaltyRulePeriodType;
  executionOrder: number;
  canStackWithOtherRules: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  statusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

export interface LoyaltyRewardDto {
  loyaltyRewardId: number;
  loyaltyProgramId: number;
  rewardName: string;
  rewardDescription?: string | null;
  rewardType: LoyaltyRewardType;
  pointsCost: number;
  monetaryValue?: number | null;
  schoolMerchandiseId?: number | null;
  schoolMerchandiseName?: string | null;
  stockQuantity?: number | null; // null = unlimited
  maxRedeemPerMember?: number | null;
  requiresDirectorApproval: boolean;
  fulfillmentInstructions?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  statusId: number;
  createdOn?: string;
  modifiedOn?: string;
}

/**
 * Reward enriched with member-scoped availability — the /me/rewards
 * endpoint computes IsRedeemable + UnavailableReason server-side, so the
 * mobile UI can disable the button without re-implementing the rules.
 * UnavailableReason values map to i18n keys under loyalty.unavailable.*.
 */
export interface MyLoyaltyRewardDto extends LoyaltyRewardDto {
  memberRedemptionCount: number;
  isRedeemable: boolean;
  unavailableReason?: string | null;
}

export interface LoyaltyLedgerEntryDto {
  loyaltyPointLedgerId: number;
  loyaltyMemberId: number;
  loyaltyRuleId?: number | null;
  paymentTransactionId?: number | null;
  loyaltyRedemptionId?: number | null;
  entryType: LoyaltyLedgerEntryType;
  referenceType: LoyaltyReferenceType;
  pointsDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  monetaryAmount?: number | null;
  description?: string | null;
  createdByUserId?: string | null;
  createdOn?: string;
}

export interface LoyaltyRedemptionDto {
  loyaltyRedemptionId: number;
  loyaltyMemberId: number;
  loyaltyRewardId: number;
  rewardName: string; // snapshotted on the row
  rewardType: string; // snapshotted ToString of LoyaltyRewardType
  memberType: LoyaltyMemberType;
  memberFullName: string;
  quantity: number;
  pointsSpent: number;
  status: LoyaltyRedemptionStatus;
  requestNotes?: string | null;
  reviewNotes?: string | null;
  reviewedByUserId?: string | null;
  reviewedOn?: string | null;
  fulfillmentReference?: string | null;
  fulfilledOn?: string | null;
  createdOn?: string;
}

/**
 * Wire shape of GET /api/loyalty/me — the calling user's memberships
 * across every school they're enrolled in. Auto-enrollment happens
 * server-side, so first-time callers always get at least one entry per
 * eligible school.
 */
export interface MyLoyaltySummaryDto {
  member: LoyaltyMemberDto;
  program: LoyaltyProgramDto;
  schoolName: string;
}

export interface RequestLoyaltyRedemptionPayload {
  loyaltyMemberId: number;
  loyaltyRewardId: number;
  quantity?: number; // default 1
  requestNotes?: string;
}
