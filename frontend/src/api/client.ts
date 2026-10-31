import axios from "axios";

const TOKEN_KEY = "billora_access_token";
const USER_KEY = "billora_current_user";

export type UserRole = "admin" | "staff" | "customer";

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(", ");
  }
  return "Unable to reach Billora. Please try again.";
}

export const authApi = {
  async register(email: string, password: string): Promise<CurrentUser> {
    const { data } = await api.post<CurrentUser>("/auth/register", { email, password });
    return data;
  },
  async login(email: string, password: string): Promise<CurrentUser> {
    const { data } = await api.post<{ access_token: string; token_type: string }>("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    const user = await this.me();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },
  async me(): Promise<CurrentUser> {
    const { data } = await api.get<CurrentUser>("/auth/me");
    return data;
  },
  storedUser(): CurrentUser | null {
    try {
      const value = localStorage.getItem(USER_KEY);
      return value ? (JSON.parse(value) as CurrentUser) : null;
    } catch {
      return null;
    }
  },
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export type Page<T> = { items: T[]; offset: number; limit: number };
export type Product = { id: string; name: string; description: string | null; is_active: boolean };
export type Variant = { id: string; product_id: string; name: string; sku: string | null; attributes: Record<string, unknown> | null; is_active: boolean };
export type Plan = { id: string; name: string; description: string | null; billing_frequency: "monthly" | "quarterly" | "yearly"; currency: string; price: string; trial_days: number; is_active: boolean };
export type PlanProduct = { id: string; plan_id: string; product_id: string; product_variant_id: string | null; quantity: string; unit_price: string | null; position: number };
export type Customer = { id: string; email: string; is_active: boolean; created_at: string };
export type SubscriptionStatus = "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed" | "cancelled" | "expired";
export type SubscriptionItem = { id: string; plan_product_id: string | null; product_id: string; product_variant_id: string | null; quantity: string; unit_price: string };
export type SubscriptionItemInput = { plan_product_id: string; quantity?: string; unit_price?: string | null };
export type Subscription = { id: string; customer_id: string; plan_id: string; status: SubscriptionStatus; billing_frequency: "monthly" | "quarterly" | "yearly"; currency: string; started_at: string; billing_anchor_at: string | null; current_period_start: string | null; current_period_end: string | null; next_billing_at: string | null; paused_at: string | null; resume_at: string | null; cancel_at: string | null; cancel_at_period_end: boolean; auto_renew: boolean; created_at: string; updated_at: string; items: SubscriptionItem[] };
export type InvoiceStatus = "draft" | "confirmed" | "partially_paid" | "paid" | "cancelled";
export type InvoiceItem = { id: string; product_id: string | null; product_variant_id: string | null; description: string; quantity: string; unit_price: string; tax_rate: string; tax_amount: string; discount_amount: string; line_total: string; position: number };
export type Invoice = { id: string; invoice_number: string; subscription_id: string; customer_id: string; status: InvoiceStatus; currency: string; period_start: string; period_end: string; issued_at: string | null; due_at: string | null; subtotal: string; tax_total: string; discount_total: string; total: string; amount_paid: string; created_at: string; updated_at: string; items: InvoiceItem[] };
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type Payment = { id: string; invoice_id: string; customer_id: string; status: PaymentStatus; provider: string; provider_reference: string | null; currency: string; amount: string; applied_amount: string; paid_at: string | null; created_at: string; updated_at: string; outstanding_balance: string };
export type CurrencyAmount = { currency: string; amount: string };
export type AnalyticsOverview = { total_customers: number; total_subscriptions: number; active_subscriptions: number; paused_subscriptions: number; total_invoiced: CurrencyAmount[]; total_collected: CurrencyAmount[]; outstanding_balance: CurrencyAmount[]; overdue_invoice_count: number };
export type RevenueTrend = { start_date: string | null; end_date: string | null; invoiced: Array<CurrencyAmount & { month: string }>; collected: Array<CurrencyAmount & { month: string }> };
export type SubscriptionAnalytics = { by_status: Array<{ status: SubscriptionStatus; count: number }>; by_billing_frequency: Array<{ billing_frequency: "monthly" | "quarterly" | "yearly"; count: number }>; active_count: number; inactive_count: number };
export type InvoiceAnalytics = { by_status: Array<{ status: InvoiceStatus; count: number }>; balances: Array<CurrencyAmount & { paid: string; partially_paid: string; unpaid: string; overdue: string }>; recent_invoices: Array<{ id: string; invoice_number: string; customer_id: string; customer_email: string; status: InvoiceStatus; currency: string; total: string; amount_paid: string; outstanding_balance: string; due_at: string | null; created_at: string }> };

function minorUnits(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Invalid decimal amount");
  const fraction = (match[3] ?? "").padEnd(2, "0");
  const units = BigInt(`${match[2]}${fraction}`);
  return match[1] === "-" ? -units : units;
}
function fromMinorUnits(value: bigint): string {
  const negative = value < 0n;
  const absolute = (negative ? -value : value).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${absolute.slice(0, -2)}.${absolute.slice(-2)}`;
}
export const decimalSubtract = (total: string, paid: string): string => fromMinorUnits(minorUnits(total) - minorUnits(paid));
export const decimalAdd = (left: string, right: string): string => fromMinorUnits(minorUnits(left) + minorUnits(right));
export const decimalCompare = (left: string, right: string): number => {
  const difference = minorUnits(left) - minorUnits(right);
  return difference === 0n ? 0 : difference > 0n ? 1 : -1;
};

export const catalogApi = {
  products: () => api.get<Page<Product>>("/products", { params: { limit: 100 } }).then(r => r.data),
  createProduct: (payload: Pick<Product, "name" | "description" | "is_active">) => api.post<Product>("/products", payload).then(r => r.data),
  updateProduct: (id: string, payload: Partial<Pick<Product, "name" | "description" | "is_active">>) => api.patch<Product>(`/products/${id}`, payload).then(r => r.data),
  deleteProduct: (id: string) => api.delete(`/products/${id}`),
  variants: (id: string) => api.get<Page<Variant>>(`/products/${id}/variants`, { params: { limit: 100 } }).then(r => r.data),
  createVariant: (id: string, payload: Omit<Variant, "id" | "product_id">) => api.post<Variant>(`/products/${id}/variants`, payload).then(r => r.data),
  updateVariant: (productId: string, id: string, payload: Partial<Omit<Variant, "id" | "product_id">>) => api.patch<Variant>(`/products/${productId}/variants/${id}`, payload).then(r => r.data),
  deleteVariant: (productId: string, id: string) => api.delete(`/products/${productId}/variants/${id}`),
  plans: () => api.get<Page<Plan>>("/plans", { params: { limit: 100 } }).then(r => r.data),
  createPlan: (payload: Omit<Plan, "id">) => api.post<Plan>("/plans", payload).then(r => r.data),
  updatePlan: (id: string, payload: Partial<Omit<Plan, "id">>) => api.patch<Plan>(`/plans/${id}`, payload).then(r => r.data),
  deletePlan: (id: string) => api.delete(`/plans/${id}`),
  planProducts: (id: string) => api.get<Page<PlanProduct>>(`/plans/${id}/products`, { params: { limit: 100 } }).then(r => r.data),
  createPlanProduct: (id: string, payload: Omit<PlanProduct, "id" | "plan_id">) => api.post<PlanProduct>(`/plans/${id}/products`, payload).then(r => r.data),
  updatePlanProduct: (planId: string, id: string, payload: Partial<Omit<PlanProduct, "id" | "plan_id">>) => api.patch<PlanProduct>(`/plans/${planId}/products/${id}`, payload).then(r => r.data),
  deletePlanProduct: (planId: string, id: string) => api.delete(`/plans/${planId}/products/${id}`),
  customers: () => api.get<Page<Customer>>("/customers", { params: { limit: 100 } }).then(r => r.data),
};

export const subscriptionApi = {
  list: (params?: { offset?: number; limit?: number; status?: SubscriptionStatus }) => api.get<Page<Subscription>>("/subscriptions", { params }).then(r => r.data),
  create: (payload: { customer_id: string; plan_id: string; items: SubscriptionItemInput[] }) => api.post<Subscription>("/subscriptions", payload).then(r => r.data),
  updateDraft: (id: string, payload: { customer_id?: string; plan_id?: string; items?: SubscriptionItemInput[] }) => api.patch<Subscription>(`/subscriptions/${id}`, payload).then(r => r.data),
  quotation: (id: string) => api.post<Subscription>(`/subscriptions/${id}/quotation`).then(r => r.data),
  confirm: (id: string) => api.post<Subscription>(`/subscriptions/${id}/confirm`).then(r => r.data),
  activate: (id: string, payload: { current_period_start: string; current_period_end: string }) => api.post<Subscription>(`/subscriptions/${id}/activate`, payload).then(r => r.data),
  pause: (id: string) => api.post<Subscription>(`/subscriptions/${id}/pause`).then(r => r.data),
  resume: (id: string) => api.post<Subscription>(`/subscriptions/${id}/resume`).then(r => r.data),
  close: (id: string) => api.post<Subscription>(`/subscriptions/${id}/close`).then(r => r.data),
  cancel: (id: string) => api.post<Subscription>(`/subscriptions/${id}/cancel`).then(r => r.data),
  expire: (id: string) => api.post<Subscription>(`/subscriptions/${id}/expire`).then(r => r.data),
};

export const invoiceApi = {
  list: (params?: { offset?: number; limit?: number; status?: InvoiceStatus; subscription_id?: string }) => api.get<Page<Invoice>>("/invoices", { params }).then(r => r.data),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`).then(r => r.data),
  generate: (subscriptionId: string, discountCode?: string) => api.post<Invoice>(`/subscriptions/${subscriptionId}/invoices/generate`, discountCode ? { discount_code: discountCode } : undefined).then(r => r.data),
  pdf: (id: string) => api.get<Blob>(`/invoices/${id}/pdf`, { responseType: "blob" }).then(r => r.data),
};

export const paymentApi = {
  listForInvoice: (invoiceId: string) => api.get<Page<Payment>>(`/invoices/${invoiceId}/payments`, { params: { limit: 100 } }).then(r => r.data),
  get: (id: string) => api.get<Payment>(`/payments/${id}`).then(r => r.data),
  create: (invoiceId: string, payload: { provider: string; provider_reference: string; currency: string; amount: string; status: Exclude<PaymentStatus, "refunded"> }) => api.post<Payment>(`/invoices/${invoiceId}/payments`, payload).then(r => r.data),
};

export const analyticsApi = {
  overview: () => api.get<AnalyticsOverview>("/analytics/overview").then(r => r.data),
  revenue: (params?: { start_date?: string; end_date?: string }) => api.get<RevenueTrend>("/analytics/revenue", { params }).then(r => r.data),
  subscriptions: () => api.get<SubscriptionAnalytics>("/analytics/subscriptions").then(r => r.data),
  invoices: () => api.get<InvoiceAnalytics>("/analytics/invoices").then(r => r.data),
};

export default api;
