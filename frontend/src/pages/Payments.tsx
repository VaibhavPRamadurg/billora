import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, Plus, Wallet, X } from "lucide-react";
import { apiErrorMessage, authApi, catalogApi, decimalCompare, decimalSubtract, invoiceApi, paymentApi, type Customer, type Invoice, type Payment, type PaymentStatus } from "../api/client";

type PaymentForm = { invoice_id: string; provider: string; provider_reference: string; amount: string; status: Exclude<PaymentStatus, "refunded"> };
const blankForm: PaymentForm = { invoice_id: "", provider: "Manual", provider_reference: "", amount: "", status: "succeeded" };
const money = (currency: string, value: string) => `${currency} ${value}`;
const paymentStyle: Record<PaymentStatus, string> = { pending: "bg-amber-50 text-amber-700", succeeded: "bg-emerald-50 text-emerald-700", failed: "bg-red-50 text-red-700", refunded: "bg-slate-100 text-slate-600" };
const payableStatuses: Invoice["status"][] = ["draft", "confirmed", "partially_paid"];

export default function Payments() {
  const currentUser = authApi.storedUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "staff";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PaymentForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Payment | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      const invoicePage = await invoiceApi.list({ limit: 100 });
      setInvoices(invoicePage.items);
      const paymentPages = await Promise.all(invoicePage.items.map((invoice) => paymentApi.listForInvoice(invoice.id)));
      setPayments(paymentPages.flatMap((page) => page.items));
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void refresh();
    if (canManage) void catalogApi.customers().then((result) => setCustomers(result.items)).catch((requestError) => setError(apiErrorMessage(requestError)));
  }, [canManage]);

  const invoiceFor = (invoiceId: string) => invoices.find((invoice) => invoice.id === invoiceId);
  const customerName = (customerId: string) => customers.find((customer) => customer.id === customerId)?.email ?? (customerId === currentUser?.id ? currentUser.email : customerId);
  const payableInvoices = invoices.filter((invoice) => payableStatuses.includes(invoice.status) && decimalCompare(decimalSubtract(invoice.total, invoice.amount_paid), "0.00") > 0);
  const selectedInvoice = invoiceFor(form.invoice_id);
  const selectedBalance = selectedInvoice ? decimalSubtract(selectedInvoice.total, selectedInvoice.amount_paid) : "0.00";
  const visiblePayments = useMemo(() => payments.filter((payment) => {
    const invoice = invoiceFor(payment.invoice_id);
    const text = `${payment.provider_reference ?? ""} ${payment.provider} ${invoice?.invoice_number ?? ""} ${customerName(payment.customer_id)}`.toLowerCase();
    return (statusFilter === "all" || payment.status === statusFilter) && text.includes(search.trim().toLowerCase());
  }), [payments, search, statusFilter, invoices, customers, currentUser]);

  const openForm = () => { setForm(blankForm); setError(""); setFormOpen(true); };
  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invoice = selectedInvoice;
    if (!invoice) { setError("Select an invoice."); return; }
    if (!/^\d+(?:\.\d{1,2})?$/.test(form.amount) || decimalCompare(form.amount, "0.00") <= 0) { setError("Enter a positive amount with up to two decimal places."); return; }
    if (decimalCompare(form.amount, selectedBalance) > 0) { setError(`Payment exceeds the outstanding balance of ${money(invoice.currency, selectedBalance)}.`); return; }
    if (!form.provider.trim() || !form.provider_reference.trim()) { setError("Provider and provider reference are required."); return; }
    try {
      setSaving(true); setError("");
      await paymentApi.create(invoice.id, { provider: form.provider.trim(), provider_reference: form.provider_reference.trim(), currency: invoice.currency, amount: form.amount, status: form.status });
      setSuccess("Payment recorded. An identical provider reference is returned idempotently; a conflicting one is rejected.");
      setFormOpen(false); setForm(blankForm); await refresh();
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setSaving(false); }
  };
  const viewPayment = async (payment: Payment) => {
    try { setError(""); setDetail(await paymentApi.get(payment.id)); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-xl font-bold tracking-tight text-slate-900">Payments</h1><p className="mt-1 text-sm text-slate-500">Track persisted manual payments and invoice balances.</p></div>{canManage && <button onClick={openForm} className="flex items-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-yellow-500"><Plus size={16} /> Record Payment</button>}</header>
    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}{success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} className="mr-1 inline" />{success}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-bold text-slate-800">Outstanding Invoices</h2><p className="mt-1 text-xs text-slate-400">Balances are displayed individually to avoid mixing currencies.</p></div><span className="text-xs font-semibold text-slate-500">{payableInvoices.length} payable</span></div><div className="mt-4 space-y-2">{payableInvoices.slice(0, 5).map((invoice) => <div key={invoice.id} className="flex flex-col justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:flex-row sm:items-center"><div><p className="font-semibold text-slate-800">{invoice.invoice_number}</p><p className="mt-1 text-slate-500">{customerName(invoice.customer_id)} · due {invoice.due_at ? new Date(invoice.due_at).toLocaleDateString() : "—"}</p></div><p className="font-bold text-slate-800">{money(invoice.currency, decimalSubtract(invoice.total, invoice.amount_paid))}</p></div>)}{!loading && payableInvoices.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No payable invoices.</p>}</div></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-800">Payment History</h2><p className="mt-1 text-xs text-slate-400">Payments are collected from invoices visible to your account.</p></div><div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payments…" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | PaymentStatus)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs"><option value="all">All statuses</option><option value="pending">Pending</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option></select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Reference</th><th className="px-4 py-4">Customer</th><th className="px-4 py-4">Invoice</th><th className="px-4 py-4">Provider</th><th className="px-4 py-4">Amount</th><th className="px-4 py-4">Applied</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs">{loading && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">Loading payments…</td></tr>}{!loading && visiblePayments.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">No payments found.</td></tr>}{visiblePayments.map((payment) => { const invoice = invoiceFor(payment.invoice_id); return <tr key={payment.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-blue-700">{payment.provider_reference ?? "—"}</td><td className="px-4 py-4 text-slate-700">{customerName(payment.customer_id)}</td><td className="px-4 py-4 text-slate-600">{invoice?.invoice_number ?? payment.invoice_id.slice(0, 8)}</td><td className="px-4 py-4 text-slate-600">{payment.provider}</td><td className="px-4 py-4 font-semibold text-slate-800">{money(payment.currency, payment.amount)}</td><td className="px-4 py-4 text-slate-700">{money(payment.currency, payment.applied_amount)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${paymentStyle[payment.status]}`}>{payment.status}</span></td><td className="px-4 py-4"><button title="View payment" onClick={() => void viewPayment(payment)} className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye size={15} /></button></td></tr>; })}</tbody></table></div></section>
    {formOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={recordPayment} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">Record Payment</h2><p className="mt-1 text-xs text-slate-500">This creates an immutable manual payment record.</p></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Close"><X /></button></div><label className="mt-5 block text-xs font-semibold">Invoice<select required value={form.invoice_id} onChange={(event) => setForm({ ...form, invoice_id: event.target.value, amount: "" })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="">Select payable invoice</option>{payableInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {money(invoice.currency, decimalSubtract(invoice.total, invoice.amount_paid))}</option>)}</select></label>{selectedInvoice && <p className="mt-2 text-xs text-slate-500">Outstanding balance: <b>{money(selectedInvoice.currency, selectedBalance)}</b></p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Provider<input required maxLength={50} value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="text-xs font-semibold">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PaymentForm["status"] })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="succeeded">Settled (succeeded)</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label></div><label className="mt-4 block text-xs font-semibold">Provider reference<input required maxLength={255} value={form.provider_reference} onChange={(event) => setForm({ ...form, provider_reference: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="mt-4 block text-xs font-semibold">Amount<input required inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label>{selectedInvoice && <p className="mt-2 text-xs text-slate-500">Currency: {selectedInvoice.currency}; it is fixed to the selected invoice.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button><button disabled={saving} className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold disabled:opacity-50">{saving ? "Recording…" : "Record Payment"}</button></div></form></div>}
    {detail && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">Payment Details</h2><p className="mt-1 text-xs text-slate-500">{detail.provider_reference ?? "No provider reference"}</p></div><button onClick={() => setDetail(null)} aria-label="Close"><X /></button></div><dl className="mt-5 space-y-3 text-xs"><div className="flex justify-between"><dt>Provider</dt><dd className="font-semibold">{detail.provider}</dd></div><div className="flex justify-between"><dt>Status</dt><dd className="font-semibold">{detail.status}</dd></div><div className="flex justify-between"><dt>Amount</dt><dd className="font-semibold">{money(detail.currency, detail.amount)}</dd></div><div className="flex justify-between"><dt>Applied</dt><dd className="font-semibold">{money(detail.currency, detail.applied_amount)}</dd></div><div className="flex justify-between"><dt>Outstanding balance</dt><dd className="font-semibold">{money(detail.currency, detail.outstanding_balance)}</dd></div><div className="flex justify-between"><dt>Recorded</dt><dd>{new Date(detail.created_at).toLocaleString()}</dd></div></dl></section></div>}
  </div>;
}
