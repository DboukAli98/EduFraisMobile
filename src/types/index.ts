// ─── User & Auth ────────────────────────────────────────────────
export type UserRole = 'superadmin' | 'director' | 'manager' | 'parent' | 'agent';

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

export interface ResetPasswordInitRequest {
  CountryCode: string;
  MobileNumber: string;
}

export interface ResetPasswordFinalRequest {
  CountryCode: string;
  MobileNumber: string;
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
  amountPaid: number;
  paidDate: string;
  paymentMethod: string;
  transactionReference: string;
  statusName: string;
  childName?: string;
  schoolName?: string;
  paymentType?: string;
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
export type PaymentCycleType = 'Full' | 'Monthly' | 'Weekly' | 'Quarterly' | 'Custom';

export interface PaymentCycle {
  paymentCycleId: number;
  paymentCycleName: string;
  paymentCycleDescription?: string;
  paymentCycleType: PaymentCycleType;
  fK_SchoolGradeSectionId: number;
  planStartDate: string;
  intervalCount?: number;
  intervalUnit?: string;
  installmentAmounts?: string;
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
  statusName: string;
  childName?: string;
  schoolName?: string;
  gradeName?: string;
}

export interface MerchandisePaymentHistoryDto {
  paymentTransactionId: number;
  amountPaid: number;
  paidDate: string;
  paymentMethod: string;
  transactionReference: string;
  statusName: string;
  merchandiseName?: string;
  schoolName?: string;
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

export interface CollectingAgentActivity {
  activityId: number;
  fK_CollectingAgentId: number;
  fK_ParentId?: number;
  activityType: string | number;
  activityDescription: string;
  notes?: string;
  relatedTransactionId?: number;
  relatedSupportRequestId?: number;
  activityDate: string;
  parent?: Parent | null;
  collectingAgent?: CollectingAgent | null;
  createdOn?: string;
  modifiedOn?: string;
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
  commissionType: 'Collection' | 'Bonus' | 'Incentive' | 'Penalty';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
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
  fK_AssignedByDirectorId: number;
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
export type SupportRequestType = 'General' | 'Payment' | 'Help';
export type SupportRequestPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

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

export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';

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
export type PaymentStatus = 'Pending' | 'InProgress' | 'Processed' | 'Cancelled' | 'Failed';
export type ChildApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
