import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { router } from "expo-router";
import i18n from "i18next";
import type { RootState } from "../../store/store";
import { logout } from "../../store/slices/authSlice";
import { API_BASE_URL } from "../../constants";

// Guard so we don't trigger multiple navigations / dispatches if many
// requests fail with 401 in quick succession.
let isHandling401 = false;

// ─── Request/response logger ────────────────────────────────────
// Wraps fetchBaseQuery so every outbound request is logged, and every
// response (success or error) is printed. Payment endpoints get extra
// verbose output so failures are easy to diagnose on the device.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("Content-Type", "application/json");
    // Tell the backend which language to localize error/success messages
    // in. Backend AuthMessages.cs reads the primary tag (fr / en) and
    // falls back to French. Defaults to 'fr' before i18n initializes.
    headers.set("Accept-Language", (i18n.language || "fr").split("-")[0]);
    return headers;
  },
});

const loggingBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const argsObj = typeof args === "string" ? { url: args } : args;
  const url = argsObj.url;
  const method = (argsObj.method || "GET").toUpperCase();
  const isPayment = /\/payments\//i.test(url);
  const tag = isPayment ? "[API][PAYMENT]" : "[API]";
  const t0 = Date.now();

  // ── Request
  if (isPayment) {
    console.log(
      `${tag} → ${method} ${API_BASE_URL}${url}`,
      "\n  body:",
      argsObj.body ? JSON.stringify(argsObj.body, null, 2) : "(none)",
      "\n  params:",
      argsObj.params ? JSON.stringify(argsObj.params) : "(none)",
    );
  } else {
    console.log(`${tag} → ${method} ${url}`);
  }

  const result = await rawBaseQuery(args, api, extraOptions);
  const ms = Date.now() - t0;

  // ── Response
  if ("error" in result && result.error) {
    const status = (result.error as any).status;
    console.log(
      `${tag} ✖ ${method} ${url} (${ms}ms)`,
      "\n  status:",
      status,
      "\n  data:",
      JSON.stringify((result.error as any).data, null, 2),
      "\n  error:",
      (result.error as any).error,
    );

    // ── Global 401 handler: token is invalid/expired — log the user
    // out and bounce them back to the sign-in screen. The guard
    // prevents multiple in-flight 401s from triggering N navigations.
    //
    // Skip this for endpoints where a 401 is an expected outcome that
    // the UI needs to surface as an error message (wrong credentials,
    // reset-password flow, etc.). Otherwise the sign-in screen's
    // "Invalid credentials" toast never fires because we force-redirect
    // back to sign-in and swallow the error data.
    const isAuthEndpoint = /\/authentication\//i.test(url);
    if (status === 401 && !isHandling401 && !isAuthEndpoint) {
      isHandling401 = true;
      try {
        api.dispatch(logout());
        router.replace("/(auth)/sign-in");
      } finally {
        // Release the guard on the next tick so subsequent (legitimate)
        // 401s after the user signs back in can still fire.
        setTimeout(() => {
          isHandling401 = false;
        }, 1000);
      }
    }
  } else if (isPayment) {
    console.log(
      `${tag} ✓ ${method} ${url} (${ms}ms)`,
      "\n  data:",
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
  InvoiceHistoryDto,
  CollectingAgent,
  CollectingAgentActivity,
  ActivityRequestStatus,
  ParentRequestableActivityType,
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
  MyLoyaltySummaryDto,
  LoyaltyLedgerEntryDto,
  MyLoyaltyRewardDto,
  LoyaltyRuleDto,
  LoyaltyRedemptionDto,
  RequestLoyaltyRedemptionPayload,
} from "../../types";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: loggingBaseQuery,
  tagTypes: [
    "Auth",
    "Parents",
    "Children",
    "Schools",
    "Payments",
    "Agents",
    "Support",
    "Notifications",
    "Reports",
    "Merchandise",
    "Invoices",
    "ActivityRequests",
    // Loyalty: split into three tags so a redemption invalidates the
    // member's balance + ledger + redemption list, but doesn't blow
    // away the (mostly static) reward catalog.
    "Loyalty",
    "LoyaltyLedger",
    "LoyaltyRewards",
  ],
  endpoints: (builder) => ({
    // ═══════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/authentication/Login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth"],
    }),
    register: builder.mutation<BaseResponse, RegisterRequest>({
      query: (data) => ({
        url: "/authentication/Register",
        method: "POST",
        body: data,
      }),
    }),
    logout: builder.mutation<BaseResponse, void>({
      query: () => ({ url: "/authentication/Logout", method: "POST" }),
      invalidatesTags: ["Auth"],
    }),
    resetPasswordInit: builder.mutation<BaseResponse, ResetPasswordInitRequest>(
      {
        query: (data) => ({
          url: "/authentication/ResetInitPassword",
          method: "POST",
          body: data,
        }),
      },
    ),
    resetPasswordFinal: builder.mutation<
      BaseResponse,
      ResetPasswordFinalRequest
    >({
      query: (data) => ({
        url: "/authentication/ResetPassword",
        method: "POST",
        body: data,
      }),
    }),
    registerPushToken: builder.mutation<BaseResponse, RegisterPushTokenRequest>(
      {
        query: (data) => ({
          url: "/authentication/RegisterDevicePushToken",
          method: "POST",
          body: data,
        }),
      },
    ),
    changePassword: builder.mutation<
      BaseResponse,
      { userId: string; currentPassword: string; newPassword: string }
    >({
      query: (data) => ({
        url: "/authentication/ChangePassword",
        method: "POST",
        body: data,
      }),
    }),

    sendTestEmail: builder.mutation<BaseResponse, { email: string }>({
      query: (data) => ({
        url: "/authentication/SendTestEmail",
        method: "POST",
        body: data,
      }),
    }),

    // ═══════════════════════════════════════════════════════════
    // PARENTS
    // ═══════════════════════════════════════════════════════════
    getParents: builder.query<
      PagedResponse<Parent>,
      PaginationRequest & { schoolId?: number }
    >({
      query: (params) => ({ url: "/parents/GetParentsListing", params }),
      providesTags: ["Parents"],
    }),
    getSingleParent: builder.query<ApiResponse<Parent>, { parentId: number }>({
      query: (params) => ({ url: "/parents/GetSingleParentDetails", params }),
      providesTags: ["Parents"],
    }),
    addParent: builder.mutation<
      BaseResponse,
      {
        firstName: string;
        lastName: string;
        fatherName?: string;
        schoolId: number;
        civilId?: string;
        countryCode?: string;
        phoneNumber?: string;
        email?: string;
      }
    >({
      query: (data) => ({
        url: "/parents/AddParent",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Parents"],
    }),
    updateParent: builder.mutation<
      BaseResponse,
      {
        parentId: number;
        firstName?: string;
        lastName?: string;
        email?: string;
        civilId?: string;
        fatherName?: string;
        countryCode?: string;
        phoneNumber?: string;
        statusId?: number;
      }
    >({
      query: (data) => ({
        url: "/parents/UpdateParent",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Parents"],
    }),
    getParentSchools: builder.query<
      ApiResponse<ParentSchoolDto[]>,
      { parentId: number }
    >({
      query: (params) => ({ url: "/parents/GetParentSchools", params }),
      providesTags: ["Parents", "Schools"],
    }),
    getParentChildren: builder.query<
      PagedResponse<ChildWithGradeDto>,
      { parentId: number } & PaginationRequest
    >({
      query: (params) => ({ url: "/parents/GetParentChildrens", params }),
      providesTags: ["Children"],
    }),
    getParentPendingRejectedChildren: builder.query<
      PagedResponse<Child>,
      { parentId: number } & PaginationRequest
    >({
      query: (params) => ({
        url: "/parents/GetParentPendingRejectedChildrens",
        params,
      }),
      providesTags: ["Children"],
    }),
    getParentInstallments: builder.query<
      PagedResponse<ParentInstallmentDto>,
      {
        parentId: number;
        childId?: number;
        schoolId?: number;
        schoolGradeSectionId?: number;
      } & PaginationRequest
    >({
      query: (params) => ({ url: "/parents/GetParentInstallments", params }),
      providesTags: ["Payments"],
    }),
    getParentInstallmentFilterData: builder.query<
      PagedResponse<any>,
      { parentId: number; filterName: string } & PaginationRequest
    >({
      query: (params) => ({
        url: "/parents/GetParentInstallmentFilterData",
        params,
      }),
      providesTags: ["Payments"],
    }),
    getParentMonthPaymentFee: builder.query<
      ApiResponse<number>,
      { parentId: number }
    >({
      query: (params) => ({ url: "/parents/GetParentMonthPaymentFee", params }),
      providesTags: ["Payments"],
    }),
    getRecentPaymentTransactions: builder.query<
      GetRecentPaymentTransactionsResponse,
      { parentId: number; timePeriod?: string; topCount?: number }
    >({
      // Backend route attribute is `[Route("GetParentRecentTrx")]` on the
      // parents controller — keep this URL in sync with that attribute.
      query: (params) => ({ url: "/parents/GetParentRecentTrx", params }),
      providesTags: ["Payments"],
    }),

    // ═══════════════════════════════════════════════════════════
    // CHILDREN
    // ═══════════════════════════════════════════════════════════
    getChildrenListing: builder.query<
      PagedResponse<Child>,
      PaginationRequest & {
        schoolId?: number;
        parentId?: number;
        onlyEnabled?: boolean;
      }
    >({
      query: (params) => ({ url: "/children/GetChildrensListing", params }),
      providesTags: ["Children"],
    }),
    getSingleChild: builder.query<ApiResponse<Child>, { childrenId: number }>({
      query: (params) => ({ url: "/children/GetSingleChildren", params }),
      providesTags: ["Children"],
    }),
    addChild: builder.mutation<BaseResponse, AddChildRequest>({
      query: (data) => ({
        url: "/children/AddChildren",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Children"],
    }),
    updateChild: builder.mutation<
      BaseResponse,
      {
        childrenId: number;
        firstName: string;
        lastName: string;
        dateOfBirth: string;
        fatherName?: string;
        parentId: number;
        schoolId: number;
      }
    >({
      query: (data) => ({
        url: "/children/UpdateChildrenDetails",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Children"],
    }),
    getChildGrade: builder.query<
      ApiResponse<ChildGrade>,
      { childrenId: number }
    >({
      query: (params) => ({ url: "/children/GetChildrenGrade", params }),
      providesTags: ["Children"],
    }),
    addChildGrade: builder.mutation<
      BaseResponse,
      {
        childrenId: number;
        schoolGradeSectionId: number;
        startDate: string;
        endDate?: string;
      }
    >({
      query: (data) => ({
        url: "/children/AddChildrenGradeToSystem",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Children"],
    }),
    updateChildGrade: builder.mutation<
      BaseResponse,
      {
        childGradeId: number;
        childrenId: number;
        schoolGradeSectionId: number;
        startDate: string;
        endDate?: string;
      }
    >({
      query: (data) => ({
        url: "/children/UpdateChildrenGrade",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Children"],
    }),

    // ═══════════════════════════════════════════════════════════
    // SCHOOLS
    // ═══════════════════════════════════════════════════════════
    getSchools: builder.query<
      PagedResponse<School>,
      PaginationRequest & { onlyEnabled?: boolean }
    >({
      query: (params) => ({
        url: "/school/SchoolsListing",
        method: "POST",
        body: params,
      }),
      providesTags: ["Schools"],
    }),
    getSchoolDetails: builder.query<ApiResponse<School>, { schoolId: number }>({
      query: (params) => ({ url: "/school/GetSchoolDetails", params }),
      providesTags: ["Schools"],
    }),
    getSchoolGradesSections: builder.query<
      PagedResponse<SchoolGradeSection>,
      { schoolId: number; onlyEnabled?: boolean } & PaginationRequest
    >({
      query: (params) => ({ url: "/school/GetSchoolGradesSections", params }),
      providesTags: ["Schools"],
    }),
    getSchoolGradeSectionDetail: builder.query<
      ApiResponse<SchoolGradeSection>,
      { schoolGradeSectionId: number }
    >({
      query: (params) => ({
        url: "/school/GetSchoolGradeSectionDetail",
        params,
      }),
      providesTags: ["Schools"],
    }),
    addSchoolSection: builder.mutation<
      BaseResponse,
      {
        schoolGradeName: string;
        schoolGradeDescription?: string;
        schoolGradeFee: number;
        schoolId: number;
        termStartDate?: string;
        termEndDate?: string;
      }
    >({
      query: (data) => ({
        url: "/school/AddSchoolSection",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Schools"],
    }),
    editSchoolSection: builder.mutation<
      BaseResponse,
      {
        schoolGradeSectionId: number;
        schoolGradeName: string;
        schoolGradeDescription?: string;
        schoolGradeFee: number;
        schoolId: number;
        termStartDate?: string;
        termEndDate?: string;
      }
    >({
      query: (data) => ({
        url: "/school/EditSchoolSection",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Schools"],
    }),
    getChildNumberBySchoolGradeSection: builder.query<
      ApiResponse<number>,
      { schoolGradeSectionId: number }
    >({
      query: (params) => ({
        url: "/school/GetChildNumberBySchoolGradeSection",
        params,
      }),
      providesTags: ["Schools"],
    }),

    // Payment Cycles
    getPaymentCycles: builder.query<
      PagedResponse<PaymentCycle>,
      { schoolGradeSectionId: number } & PaginationRequest
    >({
      query: (params) => ({ url: "/school/GetPaymentCycles", params }),
      providesTags: ["Schools"],
    }),
    getPaymentCycleDetails: builder.query<
      ApiResponse<PaymentCycle>,
      { paymentCycleId: number }
    >({
      query: (params) => ({ url: "/school/GetPaymentCycleDetails", params }),
      providesTags: ["Schools"],
    }),
    addPaymentCycle: builder.mutation<
      BaseResponse,
      {
        paymentCycleName: string;
        paymentCycleDescription?: string;
        fk_SchoolGradeSectionId: number;
        paymentCycleType: string;
        planStartDate?: string;
        intervalCount?: number;
        intervalUnit?: string;
        installmentAmounts?: string;
      }
    >({
      query: (data) => ({
        url: "/school/AddPaymentCycle",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Schools"],
    }),
    updatePaymentCycle: builder.mutation<
      BaseResponse,
      {
        paymentCycleId: number;
        paymentCycleName?: string;
        paymentCycleDescription?: string;
        paymentCycleType?: string;
        schoolGradeSectionId?: number;
      }
    >({
      query: (data) => ({
        url: "/school/UpdatePaymentCycle",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Schools"],
    }),

    // Child Cycle Selection
    selectChildCycle: builder.mutation<
      BaseResponse,
      { childGradeId: number; paymentCycleId: number }
    >({
      query: (data) => ({
        url: "/school/SelectChildCycleSelection",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Schools", "Children", "Payments"],
    }),
    getChildCycleSelection: builder.query<
      ApiResponse<ChildCycleSelection>,
      { childGradeId: number }
    >({
      query: (params) => ({ url: "/school/GetChildCycleSelection", params }),
      providesTags: ["Schools"],
    }),
    addChildGradeToSchool: builder.mutation<
      BaseResponse,
      {
        childId: number;
        schoolGradeSectionId: number;
        startDate: string;
        endDate?: string;
        statusId: number;
      }
    >({
      query: (data) => ({
        url: "/school/AddChildGrade",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Schools", "Children"],
    }),

    // ═══════════════════════════════════════════════════════════
    // MERCHANDISE
    // ═══════════════════════════════════════════════════════════
    getMerchandiseCategories: builder.query<
      PagedResponse<SchoolMerchandiseCategory>,
      PaginationRequest
    >({
      query: (params) => ({ url: "/school/GetMerchaniseCategories", params }),
      providesTags: ["Merchandise"],
    }),
    getSchoolMerchandises: builder.query<
      PagedResponse<SchoolMerchandise>,
      {
        schoolId: string;
        categoryId?: number;
        all?: boolean;
      } & PaginationRequest
    >({
      query: (params) => ({ url: "/school/GetSchoolMerchandises", params }),
      providesTags: ["Merchandise"],
    }),
    getMerchandiseById: builder.query<
      ApiResponse<SchoolMerchandise>,
      { merchandiseId: number }
    >({
      query: (params) => ({ url: "/school/GetMerchandiseById", params }),
      providesTags: ["Merchandise"],
    }),
    addMerchandiseCategory: builder.mutation<
      BaseResponse,
      {
        schoolMerchandiseCategoryName: string;
        schoolMerchandiseCategoryDescription?: string;
      }
    >({
      query: (data) => ({
        url: "/school/AddSchoolMerchandiseCategory",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Merchandise"],
    }),
    addSchoolMerchandise: builder.mutation<
      BaseResponse,
      {
        schoolMerchandiseName: string;
        schoolMerchandiseDescription?: string;
        schoolMerchandisePrice: number;
        fk_SchoolId: number;
        fk_SchoolMerchandiseCategory: number;
        logo?: { uri: string; name: string; type: string };
      }
    >({
      query: (data) => {
        const formData = new FormData();
        formData.append("SchoolMerchandiseName", data.schoolMerchandiseName);
        if (data.schoolMerchandiseDescription) {
          formData.append(
            "SchoolMerchandiseDescription",
            data.schoolMerchandiseDescription,
          );
        }
        formData.append(
          "SchoolMerchandisePrice",
          data.schoolMerchandisePrice.toString(),
        );
        formData.append("FK_SchoolId", data.fk_SchoolId.toString());
        formData.append(
          "FK_SchoolMerchandiseCategory",
          data.fk_SchoolMerchandiseCategory.toString(),
        );
        if (data.logo) {
          formData.append("Logo", data.logo as any);
        }
        return {
          url: "/school/AddSchoolMerchandise",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Merchandise"],
    }),
    updateSchoolMerchandise: builder.mutation<
      BaseResponse,
      {
        schoolMerchandiseId: number;
        schoolMerchandiseName: string;
        schoolMerchandiseDescription?: string;
        schoolMerchandisePrice: number;
        fk_SchoolId: number;
        fk_SchoolMerchandiseCategory: number;
        fk_StatusId: number;
        removeLogo?: boolean;
      }
    >({
      query: (data) => {
        const formData = new FormData();
        formData.append(
          "SchoolMerchandiseId",
          data.schoolMerchandiseId.toString(),
        );
        formData.append("SchoolMerchandiseName", data.schoolMerchandiseName);
        if (data.schoolMerchandiseDescription) {
          formData.append(
            "SchoolMerchandiseDescription",
            data.schoolMerchandiseDescription,
          );
        }
        formData.append(
          "SchoolMerchandisePrice",
          data.schoolMerchandisePrice.toString(),
        );
        formData.append("FK_SchoolId", data.fk_SchoolId.toString());
        formData.append(
          "FK_SchoolMerchandiseCategory",
          data.fk_SchoolMerchandiseCategory.toString(),
        );
        formData.append("FK_StatusId", data.fk_StatusId.toString());
        if (data.removeLogo) {
          formData.append("RemoveLogo", "true");
        }
        return {
          url: "/school/UpdateSchoolMerchandise",
          method: "PUT",
          body: formData,
        };
      },
      invalidatesTags: ["Merchandise"],
    }),

    // ═══════════════════════════════════════════════════════════
    // PAYMENTS
    // ═══════════════════════════════════════════════════════════
    getAirtelToken: builder.query<ApiResponse<string>, void>({
      query: () => "/payments/AirtelToken",
    }),
    initiatePayment: builder.mutation<
      InitiatePaymentResponse,
      InitiatePaymentRequest
    >({
      query: (data) => ({
        url: "/payments/collect",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Payments"],
    }),
    // Polls /payments/CheckPaymentStatus right after InitiatePayment with
    // the 4-char TransactionReference we generated client-side. The server
    // resolves the reference to a PaymentTransaction row and returns its
    // FK_StatusId (6=Pending, 8=Processed, 10=Failed, 11=InProgress). NOT
    // the Airtel mapId — the mobile never sees that.
    checkPaymentStatus: builder.query<
      ApiResponse<any>,
      { transactionId: string }
    >({
      query: (params) => ({ url: "/payments/CheckPaymentStatus", params }),
    }),
    getSchoolFeesPaymentHistory: builder.query<
      PagedResponse<SchoolFeesPaymentHistoryDto>,
      {
        userId: string;
        dateFilter?: string;
        statusId?: number;
        paymentType?: string;
      } & PaginationRequest
    >({
      query: (params) => ({
        url: "/payments/GetSchoolFeesPaymentHistory",
        params: {
          paymentType: "SCHOOLFEE",
          statusId: 8,
          dateFilter: "AllTime",
          ...params,
        },
      }),
      providesTags: ["Payments"],
    }),
    getMerchandisePaymentHistory: builder.query<
      PagedResponse<MerchandisePaymentHistoryDto>,
      {
        userId: string;
        dateFilter?: string;
        statusId?: number;
        paymentType?: string;
      } & PaginationRequest
    >({
      query: (params) => ({
        url: "/payments/GetMerchandisePaymentHistory",
        params: {
          paymentType: "MERCHANDISEFEE",
          statusId: 8,
          dateFilter: "AllTime",
          ...params,
        },
      }),
      providesTags: ["Payments"],
    }),

    // ═══════════════════════════════════════════════════════════
    // INVOICES
    // Receipts (PDFs) generated when a payment transaction is
    // processed (status 8). Paged list + manual regeneration.
    // Direct downloads go through getInvoicePdfUrl() below — the
    // static URL is simpler than streaming binary through RTK.
    // ═══════════════════════════════════════════════════════════
    getInvoiceHistory: builder.query<
      PagedResponse<InvoiceHistoryDto>,
      { invoiceType?: "SCHOOLFEE" | "MERCHANDISEFEE" } & PaginationRequest
    >({
      query: (params) => ({ url: "/invoice/history", params }),
      providesTags: ["Invoices"],
    }),
    generateInvoice: builder.mutation<
      {
        invoiceId: number;
        invoiceNumber: string;
        filePath: string;
        fileName: string;
        invoiceType: string;
        totalAmount: number;
        generatedOn: string;
      },
      { paymentTransactionId: number }
    >({
      query: ({ paymentTransactionId }) => ({
        url: `/invoice/generate/${paymentTransactionId}`,
        method: "POST",
      }),
      invalidatesTags: ["Invoices"],
    }),

    // ═══════════════════════════════════════════════════════════
    // COLLECTING AGENTS
    // ═══════════════════════════════════════════════════════════
    getAllAgents: builder.query<
      PagedResponse<CollectingAgent>,
      { schoolId?: number } & PaginationRequest
    >({
      query: (params) => ({
        url: "/collectingagent/GetCollectingAgents",
        params,
      }),
      providesTags: ["Agents"],
    }),
    getAgentDetails: builder.query<
      ApiResponse<CollectingAgent>,
      { agentId: number }
    >({
      query: (params) => ({
        url: "/collectingagent/GetCollectingAgentDetails",
        params,
      }),
      providesTags: ["Agents"],
    }),
    addAgent: builder.mutation<
      BaseResponse,
      {
        schoolId: number;
        firstName: string;
        lastName: string;
        email?: string;
        countryCode: string;
        phoneNumber: string;
        assignedArea?: string;
        commissionPercentage?: number;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/AddCollectingAgentToSystem",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),
    editAgent: builder.mutation<
      BaseResponse,
      {
        collectingAgentId: number;
        schoolId: number;
        firstName: string;
        lastName: string;
        email?: string;
        countryCode: string;
        phoneNumber: string;
        assignedArea?: string;
        commissionPercentage?: number;
        statusId: number;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/EditAgent",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),
    assignAgentToParent: builder.mutation<
      BaseResponse,
      {
        collectingAgentId: number;
        parentId: number;
        isActive?: boolean;
        assignmentNotes?: string;
        directorId: number;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/AssignCollectingAgentToParent",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents", "Parents"],
    }),
    unassignAgentFromParent: builder.mutation<
      BaseResponse,
      {
        collectingAgentId: number;
        parentId: number;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/UnassignCollectingAgentToParent",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents", "Parents"],
    }),
    getAgentParents: builder.query<
      PagedResponse<Parent>,
      { collectingAgentId: number } & PaginationRequest
    >({
      query: (params) => ({
        url: "/collectingagent/GetCollectingAgentParents",
        params,
      }),
      providesTags: ["Agents", "Parents"],
    }),
    getParentsCollectingAgents: builder.query<
      PagedResponse<CollectingAgentParents>,
      { parentId: number } & PaginationRequest
    >({
      query: (params) => ({
        url: "/collectingagent/GetParentsCollectingAgents",
        params,
      }),
      providesTags: ["Agents"],
    }),
    requestAgentAssignment: builder.mutation<
      BaseResponse & { collectingAgentParentId?: number },
      {
        collectingAgentId: number;
        parentId: number;
        assignmentNotes?: string;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/RequestAgentAssignment",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),
    getPendingAgentRequests: builder.query<
      PagedResponse<CollectingAgentParents>,
      { schoolId: number } & PaginationRequest
    >({
      query: (params) => ({
        url: "/collectingagent/GetPendingAgentRequests",
        params,
      }),
      providesTags: ["Agents"],
    }),
    getMyAgentRequests: builder.query<
      PagedResponse<CollectingAgentParents>,
      { parentId: number } & PaginationRequest
    >({
      query: (params) => ({
        url: "/collectingagent/GetMyAgentRequests",
        params,
      }),
      providesTags: ["Agents"],
    }),
    approveAgentRequest: builder.mutation<
      BaseResponse,
      {
        collectingAgentParentId: number;
        directorId: number;
        approvalNotes?: string;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/ApproveAgentRequest",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents", "Parents"],
    }),
    rejectAgentRequest: builder.mutation<
      BaseResponse,
      {
        collectingAgentParentId: number;
        directorId: number;
        approvalNotes?: string;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/RejectAgentRequest",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents", "Parents"],
    }),
    cancelAgentRequest: builder.mutation<
      BaseResponse,
      {
        collectingAgentParentId: number;
        parentId: number;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/CancelAgentRequest",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),
    getMyActivities: builder.query<
      PagedResponse<CollectingAgentActivity>,
      {
        startDate?: string;
        endDate?: string;
        activityType?: string;
      } & PaginationRequest
    >({
      query: (params) => ({ url: "/collectingagent/GetMyActivities", params }),
      providesTags: ["Agents"],
    }),
    logMyActivity: builder.mutation<
      ApiResponse<{ activityId: number }>,
      {
        parentId?: number;
        activityType: string;
        activityDescription: string;
        notes?: string;
        relatedTransactionId?: number;
        relatedSupportRequestId?: number;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/LogActivity",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),

    // ── Parent-initiated activity requests ────────────────────────────
    // Parent files a request → agent accepts / declines → agent completes
    // (or parent cancels). See CollectingAgentActivity on the backend for
    // the state-machine contract. `ActivityRequests` is a dedicated tag
    // so the parent's outgoing list and the agent's inbox refresh
    // without invalidating the broader 'Agents' cache.
    requestAgentActivity: builder.mutation<
      BaseResponse & { activity?: CollectingAgentActivity },
      {
        collectingAgentId: number;
        activityType: ParentRequestableActivityType;
        activityDescription: string;
        notes?: string;
      }
    >({
      query: (data) => ({
        url: "/collectingagent/RequestActivity",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["ActivityRequests", "Agents"],
    }),
    acceptActivityRequest: builder.mutation<
      BaseResponse & { activity?: CollectingAgentActivity },
      { activityId: number }
    >({
      query: (data) => ({
        url: "/collectingagent/AcceptActivityRequest",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["ActivityRequests", "Agents"],
    }),
    declineActivityRequest: builder.mutation<
      BaseResponse & { activity?: CollectingAgentActivity },
      { activityId: number; reason?: string }
    >({
      query: (data) => ({
        url: "/collectingagent/DeclineActivityRequest",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["ActivityRequests", "Agents"],
    }),
    completeActivityRequest: builder.mutation<
      BaseResponse & { activity?: CollectingAgentActivity },
      { activityId: number; completionNotes?: string }
    >({
      query: (data) => ({
        url: "/collectingagent/CompleteActivityRequest",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["ActivityRequests", "Agents"],
    }),
    cancelActivityRequest: builder.mutation<
      BaseResponse & { activity?: CollectingAgentActivity },
      { activityId: number }
    >({
      query: (data) => ({
        url: "/collectingagent/CancelActivityRequest",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["ActivityRequests", "Agents"],
    }),
    getMyActivityRequests: builder.query<
      PagedResponse<CollectingAgentActivity>,
      { status?: ActivityRequestStatus } & PaginationRequest
    >({
      query: (params) => ({
        url: "/collectingagent/GetMyActivityRequests",
        params,
      }),
      providesTags: ["ActivityRequests"],
    }),
    getAgentActivityRequests: builder.query<
      PagedResponse<CollectingAgentActivity>,
      { status?: ActivityRequestStatus } & PaginationRequest
    >({
      query: (params) => ({
        url: "/collectingagent/GetAgentActivityRequests",
        params,
      }),
      providesTags: ["ActivityRequests"],
    }),
    getMyCommissions: builder.query<
      PagedResponse<AgentCommission> & {
        totalEarnings: number;
        approvedEarnings: number;
        pendingEarnings: number;
      },
      {
        startDate?: string;
        endDate?: string;
        isApproved?: boolean;
      } & PaginationRequest
    >({
      query: (params) => ({ url: "/collectingagent/GetMyCommissions", params }),
      providesTags: ["Agents"],
    }),
    getMyPerformance: builder.query<
      AgentPerformance,
      { startDate?: string; endDate?: string }
    >({
      query: (params) => ({ url: "/collectingagent/GetMyPerformance", params }),
      providesTags: ["Agents"],
    }),
    requestCommissionApproval: builder.mutation<
      BaseResponse,
      { commissionIds: number[]; notes?: string }
    >({
      query: (data) => ({
        url: "/collectingagent/RequestCommissionApproval",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),

    // ═══════════════════════════════════════════════════════════
    // DIRECTOR
    // ═══════════════════════════════════════════════════════════
    getSchoolDirector: builder.query<
      ApiResponse<Director>,
      { schoolId: number }
    >({
      query: (params) => ({ url: "/director/GetSchoolDirector", params }),
    }),
    updateDirector: builder.mutation<
      BaseResponse,
      {
        directorId: number;
        firstname?: string;
        lastname?: string;
        email?: string;
        countryCode?: string;
        phoneNumber?: string;
        statusId?: number;
      }
    >({
      query: (data) => ({
        url: "/director/UpdateDirector",
        method: "PUT",
        body: data,
      }),
    }),
    getPendingChildren: builder.query<
      PagedResponse<Child>,
      { schoolId: number } & PaginationRequest
    >({
      query: (params) => ({ url: "/director/GetPendingChildren", params }),
      providesTags: ["Children"],
    }),
    approveChild: builder.mutation<BaseResponse, number>({
      query: (childId) => ({
        url: `/director/ApproveChildren?childId=${childId}`,
        method: "POST",
      }),
      invalidatesTags: ["Children"],
    }),
    rejectChild: builder.mutation<
      BaseResponse,
      { childId: number; reason?: string }
    >({
      query: (data) => ({
        url: "/director/RejectChildren",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Children"],
    }),
    getAgentActivities: builder.query<
      PagedResponse<CollectingAgentActivity>,
      {
        collectingAgentId: number;
        startDate?: string;
        endDate?: string;
        activityType?: string;
      } & PaginationRequest
    >({
      query: (params) => ({ url: "/director/GetAgentActivities", params }),
      providesTags: ["Agents"],
    }),
    getSchoolAgentActivities: builder.query<
      PagedResponse<CollectingAgentActivity>,
      {
        schoolId?: number;
        collectingAgentId?: number;
        activityType?: string;
        startDate?: string;
        endDate?: string;
      } & PaginationRequest
    >({
      query: (params) => ({
        url: "/director/GetSchoolAgentActivities",
        params,
      }),
      providesTags: ["Agents"],
    }),
    logAgentActivity: builder.mutation<
      BaseResponse,
      {
        collectingAgentId: number;
        parentId?: number;
        activityType: string;
        activityDescription: string;
        notes?: string;
      }
    >({
      query: (data) => ({
        url: "/director/LogAgentActivity",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),
    getAgentCommissions: builder.query<
      PagedResponse<AgentCommission> & { totalCommissionAmount: number },
      {
        collectingAgentId: number;
        startDate?: string;
        endDate?: string;
      } & PaginationRequest
    >({
      query: (params) => ({ url: "/director/GetAgentCommissions", params }),
      providesTags: ["Agents"],
    }),
    addCommission: builder.mutation<
      ApiResponse<{ commissionId: number }>,
      {
        collectingAgentId: number;
        directorId: number;
        paymentTransactionId: number;
        commissionAmount: number;
        commissionRate: number;
        description?: string;
      }
    >({
      query: (data) => ({
        url: "/director/AddCommission",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),
    approveCommission: builder.mutation<
      BaseResponse,
      {
        commissionId: number;
        directorId: number;
        isApproved: boolean;
        approvalNotes?: string;
      }
    >({
      query: (data) => ({
        url: "/director/ApproveCommission",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Agents"],
    }),

    // ═══════════════════════════════════════════════════════════
    // SUPPORT REQUESTS
    // ═══════════════════════════════════════════════════════════
    getAllSupportRequests: builder.query<
      PagedResponse<SupportRequest>,
      {
        source?: string;
        parentId?: number;
        agentId?: number;
        schoolId?: number;
        supportRequestType?: string;
        filterByCurrentUser?: boolean;
      } & PaginationRequest
    >({
      query: (params) => ({
        url: "/supportrequest/GetAllSupportRequests",
        params,
      }),
      providesTags: ["Support"],
    }),
    getSupportRequestById: builder.query<
      ApiResponse<SupportRequest>,
      { supportRequestId: number }
    >({
      query: (params) => ({
        url: "/supportrequest/GetSupportRequestById",
        params,
      }),
      providesTags: ["Support"],
    }),
    addSupportRequest: builder.mutation<BaseResponse, AddSupportRequestPayload>(
      {
        query: (data) => ({
          url: "/supportrequest/AddSupportRequest",
          method: "POST",
          body: data,
        }),
        invalidatesTags: ["Support"],
      },
    ),
    updateSupportRequestStatus: builder.mutation<
      BaseResponse,
      {
        supportRequestId: number;
        newStatusId: number;
        resultNotes?: string;
        message?: string;
      }
    >({
      query: (data) => ({
        url: "/supportrequest/UpdateSupportRequestStatus",
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Support"],
    }),

    // ═══════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════
    getNotifications: builder.query<
      PagedResponse<AppNotification>,
      { userId: string; type?: string } & PaginationRequest
    >({
      query: (params) => ({ url: "/notifications/GetNotifications", params }),
      providesTags: ["Notifications"],
    }),
    getNotificationById: builder.query<
      ApiResponse<AppNotification>,
      { notificationId: number }
    >({
      query: (params) => ({
        url: "/notifications/GetNotificationById",
        params,
      }),
      providesTags: ["Notifications"],
    }),
    markAllNotificationsAsRead: builder.mutation<
      BaseResponse,
      { userId: string; type?: string }
    >({
      query: (data) => ({
        url: "/notifications/MarkAllAsRead",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Notifications"],
    }),
    sendNotification: builder.mutation<
      BaseResponse,
      {
        userId: string;
        title: string;
        message: string;
        type: string;
        isRead?: boolean;
      }
    >({
      query: (data) => ({
        url: "/notifications/SendNotification",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Notifications"],
    }),

    // ═══════════════════════════════════════════════════════════
    // REPORTS
    // ═══════════════════════════════════════════════════════════
    getStudentCountBySchool: builder.query<
      ApiResponse<StudentCountReport>,
      { schoolId: number; statusId?: number }
    >({
      query: (params) => ({
        url: "/reports/GetStudentCountBySchool",
        params: { statusId: 1, ...params },
      }),
      providesTags: ["Reports"],
    }),
    getInstallmentsPendingPaymentsTotal: builder.query<
      ApiResponse<PendingPaymentsReport>,
      { schoolId: number; excludedStatus?: number }
    >({
      query: (params) => ({
        url: "/reports/GetInstallmentsPendingPaymentsTotal",
        params: { excludedStatus: 8, ...params },
      }),
      providesTags: ["Reports"],
    }),
    getTotalActiveParentInSchool: builder.query<
      ApiResponse<ActiveParentsReport>,
      { schoolId: number; statusId?: number }
    >({
      query: (params) => ({
        url: "/reports/GetTotalActiveParentInSchool",
        params: { statusId: 1, ...params },
      }),
      providesTags: ["Reports"],
    }),
    getSchoolPaymentTrend: builder.query<
      ApiResponse<PaymentTrendPoint[]>,
      { schoolId: number; period?: ReportPeriod; statusId?: number }
    >({
      query: (params) => ({
        url: "/reports/GetSchoolPaymentTrend",
        params: { statusId: 8, period: "month", ...params },
      }),
      providesTags: ["Reports"],
    }),
    getSchoolAgentCollectionSummary: builder.query<
      ApiResponse<AgentCollectionSummary[]>,
      { schoolId: number; period?: ReportPeriod; statusId?: number }
    >({
      query: (params) => ({
        url: "/reports/GetSchoolAgentCollectionSummary",
        params: { statusId: 8, period: "month", ...params },
      }),
      providesTags: ["Reports"],
    }),
    getSchoolPaymentMethodBreakdown: builder.query<
      ApiResponse<PaymentMethodBreakdown[]>,
      { schoolId: number; period?: ReportPeriod; statusId?: number }
    >({
      query: (params) => ({
        url: "/reports/GetSchoolPaymentMethodBreakdown",
        params: { statusId: 8, period: "month", ...params },
      }),
      providesTags: ["Reports"],
    }),

    // ═══════════════════════════════════════════════════════════
    // COMMON
    // ═══════════════════════════════════════════════════════════
    alterModuleStatus: builder.mutation<
      BaseResponse,
      {
        moduleName:
          | "schools"
          | "schoolgradesection"
          | "schoolparentssection"
          | "schoolchildrensection"
          | "schoolagentssection"
          | "schoolmerchandisessection";
        actionType: "enable" | "disable" | "deleted";
        moduleItemsIds: string;
      }
    >({
      query: (data) => ({
        url: "/common/AlterModuleStatus",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        "Schools",
        "Children",
        "Parents",
        "Agents",
        "Merchandise",
      ],
    }),

    // ─── Commission rates (platform + providers) ───────────────
    // Read-only snapshot of the currently active platform fee and the
    // active payment providers. Used everywhere we need to show a fee
    // breakdown (director fee/merchandise edit, parent payment detail,
    // agent payment detail, settings "providers" section).
    getActiveCommissionRates: builder.query<
      ApiResponse<{
        status?: string;
        platformFeePercentage: number;
        providers: {
          paymentProviderId: number;
          name: string;
          code: string;
          feePercentage: number;
          isActive: boolean;
          displayOrder: number;
          logoUrl?: string | null;
        }[];
      }>,
      void
    >({
      query: () => ({ url: "/common/GetActiveCommissionRates" }),
    }),

    // ═══════════════════════════════════════════════════════════
    // LOYALTY — self-service ("/me") endpoints
    // Backend chokepoint: Schools Fees/Controllers/LoyaltyController.cs.
    // Every endpoint here is gated on the JWT — there is no userId in
    // the body. The backend asserts FK_UserId == JWT user id on every
    // call that takes a LoyaltyMemberId.
    // ═══════════════════════════════════════════════════════════

    /**
     * Returns every loyalty membership the calling user has across
     * every school whose program is enabled. Auto-enrolls on first
     * call — the welcome bonus fires here, NOT on first payment, so
     * call this on app start (or on the home screen) for parents and
     * agents.
     */
    getMyLoyalty: builder.query<ApiResponse<MyLoyaltySummaryDto[]>, void>({
      query: () => ({ url: "/loyalty/me" }),
      providesTags: ["Loyalty"],
    }),

    getMyLoyaltyLedger: builder.query<
      PagedResponse<LoyaltyLedgerEntryDto>,
      { loyaltyMemberId: number; pageNumber?: number; pageSize?: number }
    >({
      query: ({ loyaltyMemberId, pageNumber = 1, pageSize = 20 }) => ({
        url: "/loyalty/me/ledger",
        params: {
          LoyaltyMemberId: loyaltyMemberId,
          PageNumber: pageNumber,
          PageSize: pageSize,
        },
      }),
      providesTags: ["LoyaltyLedger"],
    }),

    /**
     * Catalog filtered server-side: validity window, stock,
     * MaxRedeemPerMember, and (when memberId is passed) the member's
     * balance vs PointsCost / MinimumRedeemPoints. Each item carries
     * `isRedeemable` + `unavailableReason` so the UI doesn't need to
     * re-implement those rules.
     */
    getMyLoyaltyRewards: builder.query<
      ApiResponse<MyLoyaltyRewardDto[]>,
      { loyaltyProgramId: number; loyaltyMemberId?: number }
    >({
      query: ({ loyaltyProgramId, loyaltyMemberId }) => ({
        url: "/loyalty/me/rewards",
        params: {
          LoyaltyProgramId: loyaltyProgramId,
          ...(loyaltyMemberId ? { LoyaltyMemberId: loyaltyMemberId } : {}),
        },
      }),
      providesTags: ["LoyaltyRewards"],
    }),

    /**
     * Read-only earn rules for the caller's member type within the
     * given program. Useful for the agent screen's "you earn X for
     * each Y" summary block.
     */
    getMyLoyaltyRules: builder.query<
      ApiResponse<LoyaltyRuleDto[]>,
      { loyaltyProgramId: number }
    >({
      query: ({ loyaltyProgramId }) => ({
        url: "/loyalty/me/rules",
        params: { LoyaltyProgramId: loyaltyProgramId },
      }),
      providesTags: ["LoyaltyRewards"],
    }),

    getMyLoyaltyRedemptions: builder.query<
      PagedResponse<LoyaltyRedemptionDto>,
      { loyaltyMemberId: number; pageNumber?: number; pageSize?: number }
    >({
      query: ({ loyaltyMemberId, pageNumber = 1, pageSize = 20 }) => ({
        url: "/loyalty/me/redemptions",
        params: {
          LoyaltyMemberId: loyaltyMemberId,
          PageNumber: pageNumber,
          PageSize: pageSize,
        },
      }),
      providesTags: ["LoyaltyLedger"],
    }),

    /**
     * Self-service redemption. Backend wraps the points-deduct +
     * ledger insert + redemption row in one transaction; honors
     * program.AutoApproveRedemptions && !reward.RequiresDirectorApproval
     * to flip the initial status to Approved. On success we invalidate
     * everything that depends on the member's balance.
     */
    requestLoyaltyRedemption: builder.mutation<
      ApiResponse<LoyaltyRedemptionDto>,
      RequestLoyaltyRedemptionPayload
    >({
      query: (payload) => ({
        url: "/loyalty/me/redeem",
        method: "POST",
        body: {
          LoyaltyMemberId: payload.loyaltyMemberId,
          LoyaltyRewardId: payload.loyaltyRewardId,
          Quantity: payload.quantity ?? 1,
          RequestNotes: payload.requestNotes,
        },
      }),
      invalidatesTags: ["Loyalty", "LoyaltyLedger", "LoyaltyRewards"],
    }),

    cancelMyLoyaltyRedemption: builder.mutation<
      ApiResponse<LoyaltyRedemptionDto>,
      { loyaltyRedemptionId: number }
    >({
      query: (payload) => ({
        url: "/loyalty/me/cancel-redemption",
        method: "POST",
        body: { LoyaltyRedemptionId: payload.loyaltyRedemptionId },
      }),
      invalidatesTags: ["Loyalty", "LoyaltyLedger", "LoyaltyRewards"],
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
  // Invoices
  useGetInvoiceHistoryQuery,
  useGenerateInvoiceMutation,
  // Agents
  useGetAllAgentsQuery,
  useGetAgentDetailsQuery,
  useAddAgentMutation,
  useEditAgentMutation,
  useAssignAgentToParentMutation,
  useUnassignAgentFromParentMutation,
  useGetAgentParentsQuery,
  useGetParentsCollectingAgentsQuery,
  useRequestAgentAssignmentMutation,
  useGetPendingAgentRequestsQuery,
  useGetMyAgentRequestsQuery,
  useApproveAgentRequestMutation,
  useRejectAgentRequestMutation,
  useCancelAgentRequestMutation,
  useGetMyActivitiesQuery,
  useLogMyActivityMutation,
  // Parent-initiated activity requests
  useRequestAgentActivityMutation,
  useAcceptActivityRequestMutation,
  useDeclineActivityRequestMutation,
  useCompleteActivityRequestMutation,
  useCancelActivityRequestMutation,
  useGetMyActivityRequestsQuery,
  useGetAgentActivityRequestsQuery,
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
  useGetSchoolAgentActivitiesQuery,
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
  useGetActiveCommissionRatesQuery,
  // Loyalty (self-service)
  useGetMyLoyaltyQuery,
  useLazyGetMyLoyaltyQuery,
  useGetMyLoyaltyLedgerQuery,
  useGetMyLoyaltyRewardsQuery,
  useGetMyLoyaltyRulesQuery,
  useGetMyLoyaltyRedemptionsQuery,
  useRequestLoyaltyRedemptionMutation,
  useCancelMyLoyaltyRedemptionMutation,
} = apiSlice;

// ─── Invoice URL helpers ────────────────────────────────────────
// The PDF itself is served as a static file under wwwroot, NOT
// through /api. API_BASE_URL ends with "/api" so we strip that
// suffix to build the static origin.
const STATIC_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Full public URL for an invoice PDF, given its stored `filePath`
 * (e.g. "/invoices/2026/04/INV-2026-000123.pdf"). Use this for
 * in-app WebView / Linking open. No auth required — files are
 * obscure by InvoiceNumber but not protected at the static layer.
 */
export const getInvoicePdfUrl = (filePath: string): string => {
  if (!filePath) return "";
  const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${STATIC_ORIGIN}${normalized}`;
};

/**
 * Full URL for the authenticated download endpoint. Use this when
 * you want the backend to enforce ownership (parent can only pull
 * their own invoices) — the request needs the Bearer token set by
 * the RTK base query, so prefer calling through `fetch` with the
 * auth header or trigger a download via a library that supports
 * custom headers (e.g. expo-file-system.downloadAsync).
 */
export const getInvoiceDownloadUrl = (invoiceId: number): string =>
  `${API_BASE_URL}/invoice/download/${invoiceId}`;
