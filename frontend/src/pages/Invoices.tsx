import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FilePlus2, Receipt, X } from "lucide-react";
import { apiErrorMessage, authApi, catalogApi, decimalSubtract, invoiceApi, subscriptionApi, type Customer, type Invoice, type Subscription } from "../api/client";

const money = (currency: string, value: string) => `${currency} ${value}`;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
const statusStyle: Record<Invoice["status"], string> = { draft: "bg-slate-100 text-slate-600", confirmed: "bg-blue-50 text-blue-700", partially_paid: "bg-amber-50 text-amber-700", paid: "bg-emerald-50 text-emerald-700", cancelled: "bg-slate-100 text-slate-500" };

export default function Invoices() {
  const currentUser = authApi.storedUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "staff";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Invoice["status"]>("all");
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    try { setLoading(true); setInvoices((await invoiceApi.list({ limit: 100 })).items); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void refresh();
    void subscriptionApi.list({ limit: 100 }).then((result) => setSubscriptions(result.items)).catch((requestError) => setError(apiErrorMessage(requestError)));
    if (canManage) void catalogApi.customers().then((result) => setCustomers(result.items)).catch((requestError) => setError(apiErrorMessage(requestError)));
  }, [canManage]);

  const customerName = (id: string) => customers.find((customer) => customer.id === id)?.email ?? (id === currentUser?.id ? currentUser.email : id);
  const subscriptionLabel = (id: string) => subscriptions.find((subscription) => subscription.id === id)?.id.slice(0, 8) ?? id.slice(0, 8);
  const eligibleSubscriptions = subscriptions.filter((subscription) => subscription.status === "active" && subscription.current_period_start && subscription.current_period_end);
  const visible = useMemo(() => invoices.filter((invoice) => {
    const matchesStatus = status === "all" || invoice.status === status;
    const text = `${invoice.invoice_number} ${customerName(invoice.customer_id)} ${subscriptionLabel(invoice.subscription_id)}`.toLowerCase();
    return matchesStatus && text.includes(search.trim().toLowerCase());
  }), [invoices, status, search, customers, subscriptions, currentUser]);

  const openDetail = async (invoice: Invoice) => {
    try { setError(""); setDetail(await invoiceApi.get(invoice.id)); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
  };
  const generateInvoice = async () => {
    if (!subscriptionId) { setError("Choose an active subscription."); return; }
    try { setWorking(true); setError(""); const invoice = await invoiceApi.generate(subscriptionId, discountCode.trim() || undefined); setSuccess(`Invoice ${invoice.invoice_number} is ready.`); setGenerateOpen(false); setSubscriptionId(""); setDiscountCode(""); await refresh(); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setWorking(false); }
  };
  const downloadPdf = async (invoice: Invoice) => {
    try {
      setError(""); const pdf = await invoiceApi.pdf(invoice.id); const url = URL.createObjectURL(pdf); const link = document.createElement("a"); link.href = url; link.download = `invoice-${invoice.invoice_number}.pdf`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-xl font-bold tracking-tight text-slate-900">Invoices</h1><p className="mt-1 text-sm text-slate-500">View persisted invoices and their payment balances.</p></div>{canManage && <button onClick={() => { setGenerateOpen(true); setError(""); }} className="flex items-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-yellow-500"><FilePlus2 size={16} /> Generate Invoice</button>}</header>
    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}{success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{success}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2"><select value={status} onChange={(event) => setStatus(event.target.value as "all" | Invoice["status"])} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs"><option value="all">All statuses</option>{Object.keys(statusStyle).map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, customer, or subscription…" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /></div></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Invoice</th><th className="px-4 py-4">Customer</th><th className="px-4 py-4">Period</th><th className="px-4 py-4">Total</th><th className="px-4 py-4">Paid</th><th className="px-4 py-4">Outstanding</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs">{loading && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">Loading invoices…</td></tr>}{!loading && visible.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">No invoices found.</td></tr>}{visible.map((invoice) => <tr key={invoice.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><button onClick={() => void openDetail(invoice)} className="font-semibold text-blue-700 hover:underline">{invoice.invoice_number}</button><p className="mt-1 text-[10px] text-slate-400">Subscription {subscriptionLabel(invoice.subscription_id)}</p></td><td className="px-4 py-4 text-slate-700">{customerName(invoice.customer_id)}</td><td className="px-4 py-4 text-slate-500"><p>{dateTime(invoice.period_start)}</p><p>to {dateTime(invoice.period_end)}</p></td><td className="px-4 py-4 font-semibold text-slate-800">{money(invoice.currency, invoice.total)}</td><td className="px-4 py-4 text-slate-700">{money(invoice.currency, invoice.amount_paid)}</td><td className="px-4 py-4 font-semibold text-slate-800">{money(invoice.currency, decimalSubtract(invoice.total, invoice.amount_paid))}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle[invoice.status]}`}>{invoice.status.replace("_", " ")}</span></td><td className="px-4 py-4"><div className="flex gap-1"><button title="View invoice" onClick={() => void openDetail(invoice)} className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye size={15} /></button><button title="Download PDF" onClick={() => void downloadPdf(invoice)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Download size={15} /></button></div></td></tr>)}</tbody></table></div></section>
    {generateOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">Generate Invoice</h2><p className="mt-1 text-xs text-slate-500">Only active subscriptions with a persisted billing period are eligible.</p></div><button onClick={() => setGenerateOpen(false)} aria-label="Close"><X /></button></div><label className="mt-5 block text-xs font-semibold">Subscription<select value={subscriptionId} onChange={(event) => setSubscriptionId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="">Select an active subscription</option>{eligibleSubscriptions.map((subscription) => <option key={subscription.id} value={subscription.id}>{customerName(subscription.customer_id)} · {subscription.id.slice(0, 8)}</option>)}</select></label><label className="mt-4 block text-xs font-semibold">Discount code (optional)<input value={discountCode} onChange={(event) => setDiscountCode(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><div className="mt-6 flex justify-end gap-3"><button onClick={() => setGenerateOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button><button disabled={working} onClick={() => void generateInvoice()} className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold disabled:opacity-50">{working ? "Generating…" : "Generate"}</button></div></section></div>}
    {detail && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">{detail.invoice_number}</h2><p className="mt-1 text-xs text-slate-500">{customerName(detail.customer_id)} · {detail.currency}</p></div><button onClick={() => setDetail(null)} aria-label="Close"><X /></button></div><div className="mt-5 space-y-2">{detail.items.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs"><div className="flex justify-between gap-4"><div><p className="font-semibold text-slate-800">{item.description}</p><p className="mt-1 text-slate-500">Quantity {item.quantity} · Unit price {money(detail.currency, item.unit_price)} · Discount {money(detail.currency, item.discount_amount)} · Tax {money(detail.currency, item.tax_amount)}</p></div><p className="font-bold text-slate-800">{money(detail.currency, item.line_total)}</p></div></div>)}</div><div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-xs"><p>Subtotal <b className="float-right">{money(detail.currency, detail.subtotal)}</b></p><p>Discount <b className="float-right">{money(detail.currency, detail.discount_total)}</b></p><p>Tax <b className="float-right">{money(detail.currency, detail.tax_total)}</b></p><p>Total <b className="float-right">{money(detail.currency, detail.total)}</b></p><p>Amount paid <b className="float-right">{money(detail.currency, detail.amount_paid)}</b></p><p>Outstanding <b className="float-right">{money(detail.currency, decimalSubtract(detail.total, detail.amount_paid))}</b></p></div><div className="mt-6 flex justify-end"><button onClick={() => void downloadPdf(detail)} className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white"><Download size={14} />Download PDF</button></div></section></div>}
  </div>;
}
