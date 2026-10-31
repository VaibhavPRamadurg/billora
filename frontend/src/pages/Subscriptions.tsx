import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, FileText, Pause, Pencil, Play, Plus, X } from "lucide-react";
import { apiErrorMessage, authApi, catalogApi, subscriptionApi, type Customer, type Plan, type PlanProduct, type Product, type Subscription, type SubscriptionItemInput, type SubscriptionStatus } from "../api/client";

type ItemForm = { plan_product_id: string; quantity: string; unit_price: string };
type DraftForm = { customer_id: string; plan_id: string; items: ItemForm[] };
const emptyDraft: DraftForm = { customer_id: "", plan_id: "", items: [] };
const statusStyles: Record<SubscriptionStatus, string> = { draft: "bg-slate-100 text-slate-600", quotation: "bg-blue-50 text-blue-700", confirmed: "bg-violet-50 text-violet-700", active: "bg-emerald-50 text-emerald-700", paused: "bg-amber-50 text-amber-700", closed: "bg-red-50 text-red-600", cancelled: "bg-red-50 text-red-600", expired: "bg-slate-200 text-slate-700" };
const transitions: Record<SubscriptionStatus, Array<{ label: string; action: "quotation" | "confirm" | "activate" | "pause" | "resume" | "close" | "cancel" | "expire"; destructive?: boolean }>> = {
  draft: [{ label: "Create quotation", action: "quotation" }], quotation: [{ label: "Confirm", action: "confirm" }], confirmed: [{ label: "Activate", action: "activate" }], active: [{ label: "Pause", action: "pause" }, { label: "Close", action: "close", destructive: true }, { label: "Cancel", action: "cancel", destructive: true }, { label: "Expire", action: "expire", destructive: true }], paused: [{ label: "Resume", action: "resume" }, { label: "Close", action: "close", destructive: true }, { label: "Cancel", action: "cancel", destructive: true }, { label: "Expire", action: "expire", destructive: true }], closed: [], cancelled: [], expired: [],
};

function toLocalDate(value: string | null) { return value ? new Date(value).toLocaleString() : "—"; }
function toUtcIso(value: string) { return new Date(value).toISOString(); }

export default function Subscriptions() {
  const currentUser = authApi.storedUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "staff";
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [planProducts, setPlanProducts] = useState<PlanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubscriptionStatus>("all");
  const [form, setForm] = useState<DraftForm>(emptyDraft);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [activation, setActivation] = useState<Subscription | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const refresh = async () => {
    try { setLoading(true); setSubscriptions((await subscriptionApi.list({ limit: 100 })).items); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void refresh();
    void catalogApi.plans().then((response) => setPlans(response.items)).catch((requestError) => setError(apiErrorMessage(requestError)));
    void catalogApi.products().then((response) => setProducts(response.items)).catch((requestError) => setError(apiErrorMessage(requestError)));
    if (canManage) void catalogApi.customers().then((response) => setCustomers(response.items)).catch((requestError) => setError(apiErrorMessage(requestError)));
  }, [canManage]);

  const customerName = (customerId: string) => customers.find((customer) => customer.id === customerId)?.email ?? (customerId === currentUser?.id ? currentUser.email : customerId);
  const planName = (planId: string) => plans.find((plan) => plan.id === planId)?.name ?? planId;
  const productName = (productId: string) => products.find((product) => product.id === productId)?.name ?? productId;
  const visibleSubscriptions = useMemo(() => subscriptions.filter((subscription) => {
    const matchesStatus = statusFilter === "all" || subscription.status === statusFilter;
    const text = `${customerName(subscription.customer_id)} ${planName(subscription.plan_id)} ${subscription.id}`.toLowerCase();
    return matchesStatus && text.includes(search.trim().toLowerCase());
  }), [subscriptions, statusFilter, search, customers, plans, currentUser]);

  const loadPlanProducts = async (planId: string) => {
    if (!planId) { setPlanProducts([]); return; }
    try { setPlanProducts((await catalogApi.planProducts(planId)).items); }
    catch (requestError) { setError(apiErrorMessage(requestError)); setPlanProducts([]); }
  };
  const closeDraft = () => { setDraftOpen(false); setEditing(null); setForm(emptyDraft); setPlanProducts([]); };
  const openCreate = () => { setError(""); setEditing(null); setForm(emptyDraft); setPlanProducts([]); setDraftOpen(true); };
  const choosePlan = async (planId: string) => {
    setForm((previous) => ({ ...previous, plan_id: planId, items: [] }));
    await loadPlanProducts(planId);
  };
  const openEdit = async (subscription: Subscription) => {
    if (subscription.status !== "draft") return;
    setError(""); setEditing(subscription);
    setForm({ customer_id: subscription.customer_id, plan_id: subscription.plan_id, items: subscription.items.filter((item): item is Subscription["items"][number] & { plan_product_id: string } => item.plan_product_id !== null).map((item) => ({ plan_product_id: item.plan_product_id, quantity: item.quantity, unit_price: item.unit_price })) });
    setDraftOpen(true); await loadPlanProducts(subscription.plan_id);
  };
  const toggleItem = (association: PlanProduct) => setForm((previous) => ({ ...previous, items: previous.items.some((item) => item.plan_product_id === association.id) ? previous.items.filter((item) => item.plan_product_id !== association.id) : [...previous.items, { plan_product_id: association.id, quantity: association.quantity, unit_price: association.unit_price ?? "" }] }));
  const changeItem = (associationId: string, key: "quantity" | "unit_price", value: string) => setForm((previous) => ({ ...previous, items: previous.items.map((item) => item.plan_product_id === associationId ? { ...item, [key]: value } : item) }));
  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.customer_id || !form.plan_id || form.items.length === 0) { setError("Select a customer, a plan, and at least one plan product."); return; }
    try {
      setSaving(true); setError("");
      const items: SubscriptionItemInput[] = form.items.map((item) => ({ plan_product_id: item.plan_product_id, quantity: item.quantity, unit_price: item.unit_price || null }));
      if (editing) await subscriptionApi.updateDraft(editing.id, { customer_id: form.customer_id, plan_id: form.plan_id, items }); else await subscriptionApi.create({ customer_id: form.customer_id, plan_id: form.plan_id, items });
      closeDraft(); await refresh();
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setSaving(false); }
  };
  const transition = async (subscription: Subscription, action: "quotation" | "confirm" | "pause" | "resume" | "close" | "cancel" | "expire") => {
    if (["close", "cancel", "expire"].includes(action) && !window.confirm(`${action[0].toUpperCase()}${action.slice(1)} this subscription?`)) return;
    try {
      setError("");
      await subscriptionApi[action](subscription.id);
      await refresh();
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
  };
  const activate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activation) return;
    if (!periodStart || !periodEnd || new Date(periodEnd) <= new Date(periodStart)) { setError("Choose a valid period end after its timezone-aware start."); return; }
    try { setSaving(true); setError(""); await subscriptionApi.activate(activation.id, { current_period_start: toUtcIso(periodStart), current_period_end: toUtcIso(periodEnd) }); setActivation(null); setPeriodStart(""); setPeriodEnd(""); await refresh(); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-xl font-bold tracking-tight text-slate-900">Subscription Management</h1><p className="mt-1 text-sm text-slate-500">View and manage customer subscriptions.</p></div>{canManage && <button onClick={openCreate} className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-yellow-500"><Plus size={16} /> Add Subscription</button>}</header>
    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | SubscriptionStatus)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs"><option value="all">All statuses</option>{Object.keys(statusStyles).map((status) => <option key={status} value={status}>{status}</option>)}</select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, plan, or subscription ID…" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /></div></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Customer / Plan</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Frequency</th><th className="px-4 py-4">Period</th><th className="px-4 py-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs">{loading && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Loading subscriptions…</td></tr>}{!loading && visibleSubscriptions.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No subscriptions found.</td></tr>}{visibleSubscriptions.map((subscription) => <tr key={subscription.id} className="align-top transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{customerName(subscription.customer_id)}</p><p className="mt-1 text-[10px] text-slate-500">{planName(subscription.plan_id)} · {subscription.currency} · {subscription.items.length} item(s)</p><p className="mt-1 break-all text-[9px] text-slate-400">{subscription.id}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[subscription.status]}`}>{subscription.status}</span></td><td className="px-4 py-4 capitalize text-slate-600">{subscription.billing_frequency}</td><td className="px-4 py-4 text-slate-600"><p>{toLocalDate(subscription.current_period_start)}</p><p className="mt-1">to {toLocalDate(subscription.current_period_end)}</p></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{canManage && subscription.status === "draft" && <button title="Edit draft" onClick={() => void openEdit(subscription)} className="rounded border px-2 py-1 text-slate-600 hover:bg-slate-50"><Pencil size={13} /></button>}{canManage && transitions[subscription.status].map((item) => item.action === "activate" ? <button key={item.action} onClick={() => { setActivation(subscription); setError(""); }} className="rounded border border-emerald-200 px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-50"><Play size={12} className="mr-1 inline" />{item.label}</button> : <button key={item.action} onClick={() => void transition(subscription, item.action as Exclude<typeof item.action, "activate">)} className={`rounded border px-2 py-1 font-semibold ${item.destructive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{item.action === "quotation" && <FileText size={12} className="mr-1 inline" />}{item.action === "confirm" && <CheckCircle2 size={12} className="mr-1 inline" />}{item.action === "pause" && <Pause size={12} className="mr-1 inline" />}{item.label}</button>)}</div></td></tr>)}</tbody></table></div></section>
    {draftOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={saveDraft} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">{editing ? "Edit Draft Subscription" : "Create Draft Subscription"}</h2><p className="mt-1 text-xs text-slate-500">The subscription will remain a draft until you explicitly move it through its lifecycle.</p></div><button type="button" onClick={closeDraft} aria-label="Close subscription form"><X /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Customer<select required value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.email}</option>)}</select></label><label className="text-xs font-semibold">Plan<select required value={form.plan_id} onChange={(event) => void choosePlan(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="">Select an active plan</option>{plans.filter((plan) => plan.is_active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.currency} {plan.price}</option>)}</select></label></div><div className="mt-5"><h3 className="font-semibold text-slate-800">Plan products</h3>{form.plan_id && planProducts.length === 0 && <p className="mt-2 rounded bg-amber-50 p-3 text-xs text-amber-800">This plan has no product associations. Add one in Plans before creating the subscription.</p>}{planProducts.map((association) => { const item = form.items.find((entry) => entry.plan_product_id === association.id); return <div className="mt-2 rounded-lg border border-slate-200 p-3" key={association.id}><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(item)} onChange={() => toggleItem(association)} />{productName(association.product_id)} · association {association.id.slice(0, 8)}</label>{item && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs">Quantity<input required min="0.001" step="0.001" type="number" value={item.quantity} onChange={(event) => changeItem(association.id, "quantity", event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 px-2" /></label><label className="text-xs">Snapshot unit price<input required min="0" step="0.01" type="number" value={item.unit_price} onChange={(event) => changeItem(association.id, "unit_price", event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 px-2" /></label></div>}</div>; })}</div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeDraft} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button><button disabled={saving} className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold disabled:opacity-50">{saving ? "Saving…" : editing ? "Save Draft" : "Create Draft"}</button></div></form></div>}
    {activation && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={activate} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">Activate Subscription</h2><p className="mt-1 text-xs text-slate-500">Dates are converted to UTC and must form a valid half-open billing period.</p></div><button type="button" onClick={() => setActivation(null)} aria-label="Close activation form"><X /></button></div><label className="mt-5 block text-xs font-semibold">Period start<input required type="datetime-local" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="mt-4 block text-xs font-semibold">Period end<input required type="datetime-local" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setActivation(null)} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button><button disabled={saving} className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold">Activate</button></div></form></div>}
  </div>;
}
