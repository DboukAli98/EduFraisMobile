import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../store/store';
import { API_BASE_URL } from '../../constants';

// ─── Request/response logger ────────────────────────────────────
// Wraps fetchBaseQuery so every outbound request is logged, and every
// response (success or error) is printed. Payment endpoints get extra
// verbose output so failures are easy to diagnose on the device.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

const loggingBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const argsObj = typeof args === 'string' ? { url: args } : args;
  const url = argsObj.url;
  const method = (argsObj.method || 'GET').toUpperCase();
  const isPayment = /\/payments\//i.test(url);
  const tag = isPayment ? '[API][PAYMENT]' : '[API]';
  const t0 = Date.now();

  // ── Request
  if (isPayment) {
    console.log(
      `${tag} → ${method} ${API_BASE_URL}${url}`,
      '\n  body:',
      argsObj.body ? JSON.stringify(argsObj.body, null, 2) : '(none)',
      '\n  params:',
      argsObj.params ? JSON.stringify(argsObj.params) : '(none)',
    );
  } else {
    console.log(`${tag} → ${method} ${url}`);
  }

  const result = await rawBaseQuery(args, api, extraOptions);
  const ms = Date.now() - t0;

  // ── Response
  if ('error' in result && result.error) {
    console.log(
      `${tag} ✖ ${method} ${url} (${ms}ms)`,
      '\n  status:',
      (result.error as any).status,
      '\n  data:',
      JSON.stringify((result.error as any).data, null, 2),
      '\n  error:',
      (result.error as any).error,
    );
  } else if (isPayment) {
    console.log(
      `${tag} ✓ ${method} ${url} (${ms}ms)`,
      '\n  data:',
      JSON.stringify((result as any).data, null, 2),
    );
  } else {
    console.log(`${tag} ✓ ${method} ${url} (${ms}ms)`);
  }

  return result;
};
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetPasswordInitRequest,
  ResetPasswordFinalRequest,
  RegisterPushTokenRequest,
  BaseResponse,
  ApiResponse,
  PagedResponse,
  PaginationRequest,
  Parent,
  ParentSchoolDto,
  ParentInstallmentDto,
  GetRecentPaymentTransactionsResponse,
  Child,
  ChildWithGradeDto,
  ChildGrade,
  AddChildRequest,
  ChildCycleSelection,
  School,
  SchoolGradeSection,
  SchoolMerchandiseCategory,
  SchoolMerchandise,
  PaymentCycle,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  SchoolFeesPaymentHistoryDto,
  MerchandisePaymentHistoryDto,
  CollectingAgent,
  CollectingAgentActivity,
  AgentCommission,
  AgentPerformance,
  CollectingAgentParents,
  Director,
  SupportRequest,
  AddSupportRequestPayload,
  AppNotification,
  StudentCountReport,
  PendingPaymentsReport,
  ActiveParentsReport,
  PaidInstallmentsReport,
  PaymentTrendPoint,
  AgentCollectionSummary,
  PaymentMethodBreakdown,
  ReportPeriod,
} from '../../types';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: loggingBaseQuery,
  tagTypes: [
    'Auth', 'Parents', 'Children', 'Schools', 'Payments',
    'Agents', 'Support', 'Notifications', 'Reports', 'Merchandise',
  ],
  endpoints: (builder) => ({
    // ═══════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/authentication/Login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),
    register: builder.mutation<BaseResponse, RegisterRequest>({
      query: (data) => ({ url: '/authentication/Register', method: 'POST', body: data }),
    }),
    logout: builder.mutation<BaseResponse, void>({
      query: () => ({ url: '/authentication/Logout', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),
    resetPasswordInit: builder.mutation<BaseResponse, ResetPasswordInitRequest>({
      query: (data) => ({ url: '/authentication/ResetInitPassword', method: 'POST', body: data }),
    }),
    resetPasswordFinal: builder.mutation<BaseResponse, ResetPasswordFinalRequest>({
      query: (data) => ({ url: '/authentication/ResetPassword', method: 'POST', body: data }),
    }),
    registerPushToken: builder.mutation<BaseResponse, RegisterPushTokenRequest>({
      query: (data) => ({ url: '/authentication/RegisterDevicePushToken', method: 'POST', body: data }),
    }),
    changePassword: builder.mutation<BaseResponse, { userId: string; currentPassword: string; newPassword: string }>({
      query: (data) => ({ url: '/authentication/ChangePassword', method: 'POST', body: data }),
    }),

    sendTestEmail: builder.mutation<BaseResponse, { email: string }>({
      query: (data) => ({ url: '/authentication/SendTestEmail', method: 'POST', body: data }),
    }),

    // ═══════════════════════════════════════════════════════════
    // PARENTS
    // ═══════════════════════════════════════════════════════════
    getParents: builder.query<PagedResponse<Parent>, PaginationRequest & { schoolId?: number }>({
      query: (params) => ({ url: '/parents/GetParentsListing', params }),
      providesTags: ['Parents'],
    }),
    getSingleParent: builder.query<ApiResponse<Parent>, { parentId: number }>({
      query: (params) => ({ url: '/parents/GetSingleParentDetails', params }),
      providesTags: ['Parents'],
    }),
    addParent: builder.mutation<BaseResponse, {
      firstName: string; lastName: string; fatherName?: string;
      schoolId: number; civilId?: string; countryCode?: string;
      phoneNumber?: string; email?: string;
    }>({
      query: (data) => ({ url: '/parents/AddParent', method: 'POST', body: data }),
      invalidatesTags: ['Parents'],
    }),
    updateParent: builder.mutation<BaseResponse, {
      parentId: number; firstName?: string; lastName?: string;
      email?: string; civilId?: string; fatherName?: string;
      countryCode?: string; phoneNumber?: string; statusId?: number;
    }>({
      query: (data) => ({ url: '/parents/UpdateParent', method: 'PUT', body: data }),
      invalidatesTags: ['Parents'],
    }),
    getParentSchools: builder.query<ApiResponse<ParentSchoolDto[]>, { parentId: number }>({
      query: (params) => ({ url: '/parents/GetParentSchools', params }),
      providesTags: ['Parents', 'Schools'],
    }),
    getParentChildren: builder.query<
      PagedResponse<ChildWithGradeDto>,
      { parentId: number } & PaginationRequest
    >({
      query: (params) => ({ url: '/parents/GetParentChildrens', params }),
      providesTags: ['Children'],
    }),
    getParentPendingRejectedChildren: builder.query<
      PagedResponse<Child>,
      { parentId: number } & PaginationRequest
    >({
      query: (params) => ({ url: '/parents/GetParentPendingRejectedChildrens', params }),
      providesTags: ['Children'],
    }),
    getParentInstallments: builder.query<
      PagedResponse<ParentInstallmentDto>,
      { parentId: number; childId?: number; schoolId?: number; schoolGradeSectionId?: number } & PaginationRequest
    >({
      query: (params) => ({ url: '/parents/GetParentInstallments', params }),
      providesTags: ['Payments'],
    }),
    getParentInstallmentFilterData: builder.query<
      PagedResponse<any>,
      { parentId: number; filterName: string } & PaginationRequest
    >({
      query: (params) => ({ url: '/parents/GetParentInstallmentFilterData', params }),
      providesTags: ['Payments'],
    }),
    getParentMonthPaymentFee: builder.query<ApiResponse<number>, { parentId: number }>({
      query: (params) => ({ url: '/parents/GetParentMonthPaymentFee', params }),
      providesTags: ['Payments'],
    }),
    getRecentPaymentTransactions: builder.query<
      GetRecentPaymentTransactionsResponse,
      { parentId: number; timePeriod?: string; topCount?: number }
    >({
      query: (params) => ({ url: '/parents/GetRecentPaymentTransactions', params }),
      providesTags: ['Payments'],
    }),

    // ═══════════════════════════════════════════════════════════
    // CHILDREN
    // ═══════════════════════════════════════════════════════════
    getChildrenListing: builder.query<
      PagedResponse<Child>,
      PaginationRequest & { schoolId?: number; parentId?: number; onlyEnabled?: boolean }
    >({
      query: (params) => ({ url: '/children/GetChildrensListing', params }),
      providesTags: ['Children'],
    }),
    getSingleChild: builder.query<ApiResponse<Child>, { childrenId: number }>({
      query: (params) => ({ url: '/children/GetSingleChildren', params }),
      providesTags: ['Children'],
    }),
    addChild: builder.mutation<BaseResponse, AddChildRequest>({
      query: (data) => ({ url: '/children/AddChildren', method: 'POST', body: data }),
      invalidatesTags: ['Children'],
    }),
    updateChild: builder.mutation<BaseResponse, {
      childrenId: number; firstName: string; lastName: string;
      dateOfBirth: string; fatherName?: string; parentId: number; schoolId: number;
    }>({
      query: (data) => ({ url: '/children/UpdateChildrenDetails', method: 'PUT', body: data }),
      invalidatesTags: ['Children'],
    }),
    getChildGrade: builder.query<ApiResponse<ChildGrade>, { childrenId: number }>({
      query: (params) => ({ url: '/children/GetChildrenGrade', params }),
      providesTags: ['Children'],
    }),
    addChildGrade: builder.mutation<BaseResponse, {
      childrenId: number; schoolGradeSectionId: number; startDate: string; endDate?: string;
    }>({
      query: (data) => ({ url: '/children/AddChildrenGradeToSystem', method: 'POST', body: data }),
      invalidatesTags: ['Children'],
    }),
    updateChildGrade: builder.mutation<BaseResponse, {
      childGradeId: number; childrenId: number; schoolGradeSectionId: number;
      startDate: string; endDate?: string;
    }>({
      query: (data) => ({ url: '/children/UpdateChildrenGrade', method: 'PUT', body: data }),
      invalidatesTags: ['Children'],
    }),

    // ═══════════════════════════════════════════════════════════
    // SCHOOLS
    // ═══════════════════════════════════════════════════════════
    getSchools: builder.query<PagedResponse<School>, PaginationRequest & { onlyEnabled?: boolean }>({
      query: (params) => ({ url: '/school/SchoolsListing', method: 'POST', body: params }),
      providesTags: ['Schools'],
    }),
    getSchoolDetails: builder.query<ApiResponse<School>, { schoolId: number }>({
      query: (params) => ({ url: '/school/GetSchoolDetails', params }),
      providesTags: ['Schools'],
    }),
    getSchoolGradesSections: builder.query<
      PagedResponse<SchoolGradeSection>,
      { schoolId: number; onlyEnabled?: boolean } & PaginationRequest
    >({
      query: (params) => ({ url: '/school/GetSchoolGradesSections', params }),
      providesTags: ['Schools'],
    }),
    getSchoolGradeSectionDetail: builder.query<ApiResponse<SchoolGradeSection>, { schoolGradeSectionId: number }>({
      query: (params) => ({ url: '/school/GetSchoolGradeSectionDetail', params }),
      providesTags: ['Schools'],
    }),
    addSchoolSection: builder.mutation<BaseResponse, {
      schoolGradeName: string; schoolGradeDescription?: string;
      schoolGradeFee: number; schoolId: number;
      termStartDate?: string; termEndDate?: string;
    }>({
      query: (data) => ({ url: '/school/AddSchoolSection', method: 'POST', body: data }),
      invalidatesTags: ['Schools'],
    }),
    editSchoolSection: builder.mutation<BaseResponse, {
      schoolGradeSectionId: number; schoolGradeName: string;
      schoolGradeDescription?: string; schoolGradeFee: number;
      schoolId: number; termStartDate?: string; termEndDate?: string;
    }>({
      query: (data) => ({ url: '/school/EditSchoolSection', method: 'POST', body: data }),
      invalidatesTags: ['Schools'],
    }),
    getChildNumberBySchoolGradeSection: builder.query<ApiResponse<number>, { schoolGradeSectionId: number }>({
      query: (params) => ({ url: '/school/GetChildNumberBySchoolGradeSection', params }),
      providesTags: ['Schools'],
    }),

    // Payment Cycles
    getPaymentCycles: builder.query<
      PagedResponse<PaymentCycle>,
      { schoolGradeSectionId: number } & PaginationRequest
    >({
      query: (params) => ({ url: '/school/GetPaymentCycles', params }),
      providesTags: ['Schools'],
    }),
    getPaymentCycleDetails: builder.query<ApiResponse<PaymentCycle>, { paymentCycleId: number }>({
      query: (params) => ({ url: '/school/GetPaymentCycleDetails', params }),
      providesTags: ['Schools'],
    }),
    addPaymentCycle: builder.mutation<BaseResponse, {
      paymentCycleName: string; paymentCycleDescription?: string;
      fk_SchoolGradeSectionId: number; paymentCycleType: string;
      planStartDate?: string; intervalCount?: number;
      intervalUnit?: string; installmentAmounts?: string;
    }>({
      query: (data) => ({ url: '/school/AddPaymentCycle', method: 'POST', body: data }),
      invalidatesTags: ['Schools'],
    }),
    updatePaymentCycle: builder.mutation<BaseResponse, {
      paymentCycleId: number; paymentCycleName?: string;
      paymentCycleDescription?: string; paymentCycleType?: string;
      schoolGradeSectionId?: number;
    }>({
      query: (data) => ({ url: '/school/UpdatePaymentCycle', method: 'PUT', body: data }),
      invalidatesTags: ['Schools'],
    }),

    // Child Cycle Selection
    selectChildCycle: builder.mutation<BaseResponse, { childGradeId: number; paymentCycleId: number }>({
      query: (data) => ({ url: '/school/SelectChildCycleSelection', method: 'POST', body: data }),
      invalidatesTags: ['Schools', 'Children', 'Payments'],
    }),
    getChildCycleSelection: builder.query<ApiResponse<ChildCycleSelection>, { childGradeId: number }>({
      query: (params) => ({ url: '/school/GetChildCycleSelection', params }),
      providesTags: ['Schools'],
    }),
    addChildGradeToSchool: builder.mutation<BaseResponse, {
      childId: number; schoolGradeSectionId: number;
      startDate: string; endDate?: string; statusId: number;
    }>({
      query: (data) => ({ url: '/school/AddChildGrade', method: 'POST', body: data }),
      invalidatesTags: ['Schools', 'Children'],
    }),

    // ═══════════════════════════════════════════════════════════
    // MERCHANDISE
    // ═══════════════════════════════════════════════════════════
    getMerchandiseCategories: builder.query<PagedResponse<SchoolMerchandiseCategory>, PaginationRequest>({
      query: (params) => ({ url: '/school/GetMerchaniseCategories', params }),
      providesTags: ['Merchandise'],
    }),
    getSchoolMerchandises: builder.query<
      PagedResponse<SchoolMerchandise>,
      { schoolId: string; categoryId?: number; all?: boolean } & PaginationRequest
    >({
      query: (params) => ({ url: '/school/GetSchoolMerchandises', params }),
      providesTags: ['Merchandise'],
    }),
    getMerchandiseById: builder.query<ApiResponse<SchoolMerchandise>, { merchandiseId: number }>({
      query: (params) => ({ url: '/school/GetMerchandiseById', params }),
      providesTags: ['Merchandise'],
    }),
    addMerchandiseCategory: builder.mutation<BaseResponse, {
      schoolMerchandiseCategoryName: string;
      schoolMerchandiseCategoryDescription?: string;
    }>({
      query: (data) => ({ url: '/school/AddSchoolMerchandiseCategory', method: 'POST', body: data }),
      invalidatesTags: ['Merchandise'],
    }),
    addSchoolMerchandise: builder.mutation<BaseResponse, {
      schoolMerchandiseName: string; schoolMerchandiseDescription?: string;
      schoolMerchandisePrice: number; fk_SchoolId: number;
      fk_SchoolMerchandiseCategory: number;
      logo?: { uri: string; name: string; type: string };
    }>({
      query: (data) => {
        const formData = new FormData();
        formData.append('SchoolMerchandiseName', data.schoolMerchandiseName);
        if (data.schoolMerchandiseDescription) {
          formData.append('SchoolMerchandiseDescription', data.schoolMerchandiseDescription);
        }
        formData.append('SchoolMerchandisePrice', data.schoolMerchandisePrice.toString());
        formData.append('FK_SchoolId', data.fk_SchoolId.toString());
        formData.append('FK_SchoolMerchandiseCategory', data.fk_SchoolMerchandiseCategory.toString());
        if (data.logo) {
          formData.append('Logo', data.logo as any);
        }
        return { url: '/school/AddSchoolMerchandise', method: 'POST', body: formData };
      },
      invalidatesTags: ['Merchandise'],
    }),
    updateSchoolMerchandise: builder.mutation<BaseResponse, {
      schoolMerchandiseId: number; schoolMerchandiseName: string;
      schoolMerchandiseDescription?: string; schoolMerchandisePrice: number;
      fk_SchoolId: number; fk_SchoolMerchandiseCategory: number;
      fk_StatusId: number; removeLogo?: boolean;
    }>({
      query: (data) => {
        const formData = new FormData();
        formData.append('SchoolMerchandiseId', data.schoolMerchandiseId.toString());
        formData.append('SchoolMerchandiseName', data.schoolMerchandiseName);
        if (data.schoolMerchandiseDescription) {
          formData.append('SchoolMerchandiseDescription', data.schoolMerchandiseDescription);
        }
        formData.append('SchoolMerchandisePrice', data.schoolMerchandisePrice.toString());
        formData.append('FK_SchoolId', data.fk_SchoolId.toString());
        formData.append('FK_SchoolMerchandiseCategory', data.fk_SchoolMerchandiseCategory.toString());
        formData.append('FK_StatusId', data.fk_StatusId.toString());
        if (data.removeLogo) {
          formData.append('RemoveLogo', 'true');
        }
        return { url: '/school/UpdateSchoolMerchandise', method: 'PUT', body: formData };
      },
      invalidatesTags: ['Merchandise'],
    }),

    // ═══════════════════════════════════════════════════════════
    // PAYMENTS
    // ═══════════════════════════════════════════════════════════
    getAirtelToken: builder.query<ApiResponse<string>, void>({
      query: () => '/payments/AirtelToken',
    }),
    initiatePayment: builder.mutation<InitiatePaymentResponse, InitiatePaymentRequest>({
      query: (data) => ({ url: '/payments/collect', method: 'POST', body: data }),
      invalidatesTags: ['Payments'],
    }),
    checkPaymentStatus: builder.query<ApiResponse<any>, { transactionId: string }>({
      query: (params) => ({ url: '/payments/CheckCollectionStatus', params }),
    }),
    getSchoolFeesPaymentHistory: builder.query<
      PagedResponse<SchoolFeesPaymentHistoryDto>,
      { userId: string; dateFilter?: string; statusId?: number; paymentType?: string } & PaginationRequest
    >({
      query: (params) => ({
        url: '/payments/GetSchoolFeesPaymentHistory',
        params: { paymentType: 'SCHOOLFEE', statusId: 8, dateFilter: 'AllTime', ...params },
      }),
      providesTags: ['Payments'],
    }),
    getMerchandisePaymentHistory: builder.query<
      PagedResponse<MerchandisePaymentHistoryDto>,
      { userId: string; dateFilter?: string; statusId?: number; paymentType?: string } & PaginationRequest
    >({
      query: (params) => ({
        url: '/payments/GetMerchandisePaymentHistory',
        params: { paymentType: 'MERCHANDISEFEE', statusId: 8, dateFilter: 'AllTime', ...params },
      }),
      providesTags: ['Payments'],
    }),

    // ═══════════════════════════════════════════════════════════
    // COLLECTING AGENTS
    // ═══════════════════════════════════════════════════════════
    getAllAgents: builder.query<PagedResponse<CollectingAgent>, { schoolId?: number } & PaginationRequest>({
      query: (params) => ({ url: '/collectingagent/GetCollectingAgents', params }),
      providesTags: ['Agents'],
    }),
    getAgentDetails: builder.query<ApiResponse<CollectingAgent>, { agentId: number }>({
      query: (params) => ({ url: '/collectingagent/GetCollectingAgentDetails', params }),
      providesTags: ['Agents'],
    }),
    addAgent: builder.mutation<BaseResponse, {
      schoolId: number; firstName: string; lastName: string;
      email?: string; countryCode: string; phoneNumber: string;
      assignedArea?: string; commissionPercentage?: number;
    }>({
      query: (data) => ({ url: '/collectingagent/AddCollectingAgentToSystem', method: 'POST', body: data }),
      invalidatesTags: ['Agents'],
    }),
    editAgent: builder.mutation<BaseResponse, {
      collectingAgentId: number; schoolId: number;
      firstName: string; lastName: string; email?: string;
      countryCode: string; phoneNumber: string;
      assignedArea?: string; commissionPercentage?: number; statusId: number;
    }>({
      query: (data) => ({ url: '/collectingagent/EditAgent', method: 'PUT', body: data }),
      invalidatesTags: ['Agents'],
    }),
    assignAgentToParent: builder.mutation<BaseResponse, {
      collectingAgentId: number; parentId: number;
      isActive?: boolean; assignmentNotes?: string; directorId: number;
    }>({
      query: (data) => ({ url: '/collectingagent/AssignCollectingAgentToParent', method: 'POST', body: data }),
      invalidatesTags: ['Agents', 'Parents'],
    }),
    unassignAgentFromParent: builder.mutation<BaseResponse, {
      collectingAgentId: number; parentId: number;
    }>({
      query: (data) => ({ url: '/collectingagent/UnassignCollectingAgentToParent', method: 'POST', body: data }),
      invalidatesTags: ['Agents', 'Parents'],
    }),
    getAgentParents: builder.query<PagedResponse<Parent>, { collectingAgentId: number } & PaginationRequest>({
      query: (params) => ({ url: '/collectingagent/GetCollectingAgentParents', params }),
      providesTags: ['Agents', 'Parents'],
    }),
    getParentsCollectingAgents: builder.query<PagedResponse<CollectingAgentParents>, { parentId: number } & PaginationRequest>({
      query: (params) => ({ url: '/collectingagent/GetParentsCollectingAgents', params }),
      providesTags: ['Agents'],
    }),
    getMyActivities: builder.query<
      PagedResponse<CollectingAgentActivity>,
      { startDate?: string; endDate?: string; activityType?: string } & PaginationRequest
    >({
      query: (params) => ({ url: '/collectingagent/GetMyActivities', params }),
      providesTags: ['Agents'],
    }),
    logMyActivity: builder.mutation<ApiResponse<{ activityId: number }>, {
      parentId?: number; activityType: string;
      activityDescription: string; notes?: string;
      relatedTransactionId?: number; relatedSupportRequestId?: number;
    }>({
      query: (data) => ({ url: '/collectingagent/LogActivity', method: 'POST', body: data }),
      invalidatesTags: ['Agents'],
    }),
    getMyCommissions: builder.query<
      PagedResponse<AgentCommission> & { totalEarnings: number; approvedEarnings: number; pendingEarnings: number },
      { startDate?: string; endDate?: string; isApproved?: boolean } & PaginationRequest
    >({
      query: (params) => ({ url: '/collectingagent/GetMyCommissions', params }),
      providesTags: ['Agents'],
    }),
    getMyPerformance: builder.query<AgentPerformance, { startDate?: string; endDate?: string }>({
      query: (params) => ({ url: '/collectingagent/GetMyPerformance', params }),
      providesTags: ['Agents'],
    }),
    requestCommissionApproval: builder.mutation<BaseResponse, { commissionIds: number[]; notes?: string }>({
      query: (data) => ({ url: '/collectingagent/RequestCommissionApproval', method: 'POST', body: data }),
      invalidatesTags: ['Agents'],
    }),

    // ═══════════════════════════════════════════════════════════
    // DIRECTOR
    // ═══════════════════════════════════════════════════════════
    getSchoolDirector: builder.query<ApiResponse<Director>, { schoolId: number }>({
      query: (params) => ({ url: '/director/GetSchoolDirector', params }),
    }),
    updateDirector: builder.mutation<BaseResponse, {
      directorId: number; firstname?: string; lastname?: string;
      email?: string; countryCode?: string; phoneNumber?: string; statusId?: number;
    }>({
      query: (data) => ({ url: '/director/UpdateDirector', method: 'PUT', body: data }),
    }),
    getPendingChildren: builder.query<PagedResponse<Child>, { schoolId: number } & PaginationRequest>({
      query: (params) => ({ url: '/director/GetPendingChildren', params }),
      providesTags: ['Children'],
    }),
    approveChild: builder.mutation<BaseResponse, number>({
      query: (childId) => ({ url: `/director/ApproveChildren?childId=${childId}`, method: 'POST' }),
      invalidatesTags: ['Children'],
    }),
    rejectChild: builder.mutation<BaseResponse, { childId: number; reason?: string }>({
      query: (data) => ({ url: '/director/RejectChildren', method: 'POST', body: data }),
      invalidatesTags: ['Children'],
    }),
    getAgentActivities: builder.query<
      PagedResponse<CollectingAgentActivity>,
      { collectingAgentId: number; startDate?: string; endDate?: string } & PaginationRequest
    >({
      query: (params) => ({ url: '/director/GetAgentActivities', params }),
      providesTags: ['Agents'],
    }),
    logAgentActivity: builder.mutation<BaseResponse, {
      collectingAgentId: number; parentId?: number; activityType: string;
      activityDescription: string; notes?: string;
    }>({
      query: (data) => ({ url: '/director/LogAgentActivity', method: 'POST', body: data }),
      invalidatesTags: ['Agents'],
    }),
    getAgentCommissions: builder.query<
      PagedResponse<AgentCommission> & { totalCommissionAmount: number },
      { collectingAgentId: number; startDate?: string; endDate?: string } & PaginationRequest
    >({
      query: (params) => ({ url: '/director/GetAgentCommissions', params }),
      providesTags: ['Agents'],
    }),
    addCommission: builder.mutation<ApiResponse<{ commissionId: number }>, {
      collectingAgentId: number; directorId: number;
      paymentTransactionId: number; commissionAmount: number;
      commissionRate: number; description?: string;
    }>({
      query: (data) => ({ url: '/director/AddCommission', method: 'POST', body: data }),
      invalidatesTags: ['Agents'],
    }),
    approveCommission: builder.mutation<BaseResponse, {
      commissionId: number; directorId: number;
      isApproved: boolean; approvalNotes?: string;
    }>({
      query: (data) => ({ url: '/director/ApproveCommission', method: 'PUT', body: data }),
      invalidatesTags: ['Agents'],
    }),

    // ═══════════════════════════════════════════════════════════
    // SUPPORT REQUESTS
    // ═══════════════════════════════════════════════════════════
    getAllSupportRequests: builder.query<
      PagedResponse<SupportRequest>,
      {
        source?: string; parentId?: number; agentId?: number;
        schoolId?: number; supportRequestType?: string;
        filterByCurrentUser?: boolean;
      } & PaginationRequest
    >({
      query: (params) => ({ url: '/supportrequest/GetAllSupportRequests', params }),
      providesTags: ['Support'],
    }),
    getSupportRequestById: builder.query<ApiResponse<SupportRequest>, { supportRequestId: number }>({
      query: (params) => ({ url: '/supportrequest/GetSupportRequestById', params }),
      providesTags: ['Support'],
    }),
    addSupportRequest: builder.mutation<BaseResponse, AddSupportRequestPayload>({
      query: (data) => ({ url: '/supportrequest/AddSupportRequest', method: 'POST', body: data }),
      invalidatesTags: ['Support'],
    }),
    updateSupportRequestStatus: builder.mutation<BaseResponse, {
      supportRequestId: number; newStatusId: number;
      resultNotes?: string; message?: string;
    }>({
      query: (data) => ({ url: '/supportrequest/UpdateSupportRequestStatus', method: 'PUT', body: data }),
      invalidatesTags: ['Support'],
    }),

    // ═══════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════
    getNotifications: builder.query<
      PagedResponse<AppNotification>,
      { userId: string; type?: string } & PaginationRequest
    >({
      query: (params) => ({ url: '/notifications/GetNotifications', params }),
      providesTags: ['Notifications'],
    }),
    getNotificationById: builder.query<ApiResponse<AppNotification>, { notificationId: number }>({
      query: (params) => ({ url: '/notifications/GetNotificationById', params }),
      providesTags: ['Notifications'],
    }),
    markAllNotificationsAsRead: builder.mutation<BaseResponse, { userId: string; type?: string }>({
      query: (data) => ({ url: '/notifications/MarkAllAsRead', method: 'POST', body: data }),
      invalidatesTags: ['Notifications'],
    }),
    sendNotification: builder.mutation<BaseResponse, {
      userId: string; title: string; message: string; type: string; isRead?: boolean;
    }>({
      query: (data) => ({ url: '/notifications/SendNotification', method: 'POST', body: data }),
      invalidatesTags: ['Notifications'],
    }),

    // ═══════════════════════════════════════════════════════════
    // REPORTS
    // ═══════════════════════════════════════════════════════════
    getStudentCountBySchool: builder.query<ApiResponse<StudentCountReport>, { schoolId: number; statusId?: number }>({
      query: (params) => ({ url: '/reports/GetStudentCountBySchool', params: { statusId: 1, ...params } }),
      providesTags: ['Reports'],
    }),
    getInstallmentsPendingPaymentsTotal: builder.query<ApiResponse<PendingPaymentsReport>, { schoolId: number; excludedStatus?: number }>({
      query: (params) => ({ url: '/reports/GetInstallmentsPendingPaymentsTotal', params: { excludedStatus: 8, ...params } }),
      providesTags: ['Reports'],
    }),
    getTotalActiveParentInSchool: builder.query<ApiResponse<ActiveParentsReport>, { schoolId: number; statusId?: number }>({
      query: (params) => ({ url: '/reports/GetTotalActiveParentInSchool', params: { statusId: 1, ...params } }),
      providesTags: ['Reports'],
    }),
    getSchoolPaymentTrend: builder.query<
      ApiResponse<PaymentTrendPoint[]>,
      { schoolId: number; period?: ReportPeriod; statusId?: number }
    >({
      query: (params) => ({ url: '/reports/GetSchoolPaymentTrend', params: { statusId: 8, period: 'month', ...params } }),
      providesTags: ['Reports'],
    }),
    getSchoolAgentCollectionSummary: builder.query<
      ApiResponse<AgentCollectionSummary[]>,
      { schoolId: number; period?: ReportPeriod; statusId?: number }
    >({
      query: (params) => ({ url: '/reports/GetSchoolAgentCollectionSummary', params: { statusId: 8, period: 'month', ...params } }),
      providesTags: ['Reports'],
    }),
    getSchoolPaymentMethodBreakdown: builder.query<
      ApiResponse<PaymentMethodBreakdown[]>,
      { schoolId: number; period?: ReportPeriod; statusId?: number }
    >({
      query: (params) => ({ url: '/reports/GetSchoolPaymentMethodBreakdown', params: { statusId: 8, period: 'month', ...params } }),
      providesTags: ['Reports'],
    }),

    // ═══════════════════════════════════════════════════════════
    // COMMON
    // ═══════════════════════════════════════════════════════════
    alterModuleStatus: builder.mutation<BaseResponse, {
      moduleName: string; actionType: string; moduleItemsIds: string;
    }>({
      query: (data) => ({ url: '/common/AlterModuleStatus', method: 'POST', body: data }),
      invalidatesTags: ['Schools', 'Children', 'Parents'],
    }),
  }),
});

export const {
  // Auth
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useResetPasswordInitMutation,
  useResetPasswordFinalMutation,
  useRegisterPushTokenMutation,
  useChangePasswordMutation,
  useSendTestEmailMutation,
  // Parents
  useGetParentsQuery,
  useGetSingleParentQuery,
  useAddParentMutation,
  useUpdateParentMutation,
  useGetParentSchoolsQuery,
  useGetParentChildrenQuery,
  useGetParentPendingRejectedChildrenQuery,
  useGetParentInstallmentsQuery,
  useGetParentInstallmentFilterDataQuery,
  useGetParentMonthPaymentFeeQuery,
  useGetRecentPaymentTransactionsQuery,
  // Children
  useGetChildrenListingQuery,
  useGetSingleChildQuery,
  useAddChildMutation,
  useUpdateChildMutation,
  useGetChildGradeQuery,
  useAddChildGradeMutation,
  useUpdateChildGradeMutation,
  // Schools
  useGetSchoolsQuery,
  useGetSchoolDetailsQuery,
  useGetSchoolGradesSectionsQuery,
  useGetSchoolGradeSectionDetailQuery,
  useAddSchoolSectionMutation,
  useEditSchoolSectionMutation,
  useGetChildNumberBySchoolGradeSectionQuery,
  // Payment Cycles
  useGetPaymentCyclesQuery,
  useGetPaymentCycleDetailsQuery,
  useAddPaymentCycleMutation,
  useUpdatePaymentCycleMutation,
  // Child Cycle
  useSelectChildCycleMutation,
  useGetChildCycleSelectionQuery,
  useAddChildGradeToSchoolMutation,
  // Merchandise
  useGetMerchandiseCategoriesQuery,
  useGetSchoolMerchandisesQuery,
  useGetMerchandiseByIdQuery,
  useAddMerchandiseCategoryMutation,
  useAddSchoolMerchandiseMutation,
  useUpdateSchoolMerchandiseMutation,
  // Payments
  useGetAirtelTokenQuery,
  useInitiatePaymentMutation,
  useCheckPaymentStatusQuery,
  useLazyCheckPaymentStatusQuery,
  useGetSchoolFeesPaymentHistoryQuery,
  useGetMerchandisePaymentHistoryQuery,
  // Agents
  useGetAllAgentsQuery,
  useGetAgentDetailsQuery,
  useAddAgentMutation,
  useEditAgentMutation,
  useAssignAgentToParentMutation,
  useUnassignAgentFromParentMutation,
  useGetAgentParentsQuery,
  useGetParentsCollectingAgentsQuery,
  useGetMyActivitiesQuery,
  useLogMyActivityMutation,
  useGetMyCommissionsQuery,
  useGetMyPerformanceQuery,
  useRequestCommissionApprovalMutation,
  // Director
  useGetSchoolDirectorQuery,
  useUpdateDirectorMutation,
  useGetPendingChildrenQuery,
  useApproveChildMutation,
  useRejectChildMutation,
  useGetAgentActivitiesQuery,
  useLogAgentActivityMutation,
  useGetAgentCommissionsQuery,
  useAddCommissionMutation,
  useApproveCommissionMutation,
  // Support
  useGetAllSupportRequestsQuery,
  useGetSupportRequestByIdQuery,
  useAddSupportRequestMutation,
  useUpdateSupportRequestStatusMutation,
  // Notifications
  useGetNotificationsQuery,
  useGetNotificationByIdQuery,
  useMarkAllNotificationsAsReadMutation,
  useSendNotificationMutation,
  // Reports
  useGetStudentCountBySchoolQuery,
  useGetInstallmentsPendingPaymentsTotalQuery,
  useGetTotalActiveParentInSchoolQuery,
  useGetSchoolPaymentTrendQuery,
  useGetSchoolAgentCollectionSummaryQuery,
  useGetSchoolPaymentMethodBreakdownQuery,
  // Common
  useAlterModuleStatusMutation,
} = apiSlice;
