import { useEffect, useState, type FormEvent } from "react";
import { PackagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiErrorMessage, authApi, catalogApi, type Plan, type PlanProduct, type Product, type Variant } from "../api/client";

type PlanForm = Omit<Plan, "id">;
type AssociationForm = { product_id: string; product_variant_id: string; quantity: string; unit_price: string; position: string };

const blankPlan: PlanForm = { name: "", description: "", billing_frequency: "monthly", currency: "INR", price: "0.00", trial_days: 0, is_active: true };
const blankAssociation: AssociationForm = { product_id: "", product_variant_id: "", quantity: "1.000", unit_price: "", position: "0" };

export default function Plans() {
  const currentUser = authApi.storedUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "staff";
  const canDelete = currentUser?.role === "admin";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantLabels, setVariantLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [planForm, setPlanForm] = useState<PlanForm>(blankPlan);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [associations, setAssociations] = useState<PlanProduct[]>([]);
  const [associationForm, setAssociationForm] = useState<AssociationForm>(blankAssociation);
  const [editingAssociationId, setEditingAssociationId] = useState<string | null>(null);
  const [associationsLoading, setAssociationsLoading] = useState(false);
  const [associationSaving, setAssociationSaving] = useState(false);

  const refreshPlans = async () => {
    try { setLoading(true); setPlans((await catalogApi.plans()).items); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void refreshPlans();
    if (canManage) catalogApi.products().then((response) => setProducts(response.items)).catch((requestError) => setError(apiErrorMessage(requestError)));
  }, [canManage]);

  const closePlanModal = () => { setPlanModalOpen(false); setEditingPlanId(null); setPlanForm(blankPlan); };
  const openNewPlan = () => { setError(""); setEditingPlanId(null); setPlanForm(blankPlan); setPlanModalOpen(true); };
  const openEditPlan = (plan: Plan) => {
    setError(""); setEditingPlanId(plan.id);
    setPlanForm({ name: plan.name, description: plan.description ?? "", billing_frequency: plan.billing_frequency, currency: plan.currency, price: plan.price, trial_days: plan.trial_days, is_active: plan.is_active });
    setPlanModalOpen(true);
  };
  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(""); const payload = { ...planForm, description: planForm.description || null };
      if (editingPlanId) await catalogApi.updatePlan(editingPlanId, payload); else await catalogApi.createPlan(payload);
      closePlanModal(); await refreshPlans();
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
  };
  const deletePlan = async (plan: Plan) => {
    if (!window.confirm(`Delete ${plan.name}? This cannot be undone.`)) return;
    try { setError(""); await catalogApi.deletePlan(plan.id); await refreshPlans(); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
  };

  const loadAssociations = async (planId: string) => {
    try {
      setAssociationsLoading(true);
      const loadedAssociations = (await catalogApi.planProducts(planId)).items;
      setAssociations(loadedAssociations);
      const productIds = [...new Set(loadedAssociations.map((association) => association.product_id))];
      const variantPages = await Promise.all(productIds.map((productId) => catalogApi.variants(productId)));
      setVariantLabels(Object.fromEntries(variantPages.flatMap((page) => page.items.map((variant) => [variant.id, variant.name]))));
    }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setAssociationsLoading(false); }
  };
  const openAssociations = async (plan: Plan) => {
    setError(""); setSelectedPlan(plan); setAssociationForm(blankAssociation); setEditingAssociationId(null); setVariants([]); await loadAssociations(plan.id);
  };
  const closeAssociations = () => { setSelectedPlan(null); setAssociations([]); setVariants([]); setAssociationForm(blankAssociation); setEditingAssociationId(null); };
  const loadVariants = async (productId: string) => {
    if (!productId) { setVariants([]); return; }
    try { setVariants((await catalogApi.variants(productId)).items); }
    catch (requestError) { setError(apiErrorMessage(requestError)); }
  };
  const chooseProduct = async (productId: string) => { setAssociationForm((previous) => ({ ...previous, product_id: productId, product_variant_id: "" })); await loadVariants(productId); };
  const editAssociation = async (association: PlanProduct) => {
    setEditingAssociationId(association.id);
    setAssociationForm({ product_id: association.product_id, product_variant_id: association.product_variant_id ?? "", quantity: association.quantity, unit_price: association.unit_price ?? "", position: String(association.position) });
    await loadVariants(association.product_id);
  };
  const saveAssociation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selectedPlan) return;
    try {
      setAssociationSaving(true); setError("");
      const payload = { product_id: associationForm.product_id, product_variant_id: associationForm.product_variant_id || null, quantity: associationForm.quantity, unit_price: associationForm.unit_price || null, position: Number(associationForm.position) };
      if (editingAssociationId) await catalogApi.updatePlanProduct(selectedPlan.id, editingAssociationId, payload); else await catalogApi.createPlanProduct(selectedPlan.id, payload);
      setAssociationForm(blankAssociation); setEditingAssociationId(null); setVariants([]); await loadAssociations(selectedPlan.id);
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
    finally { setAssociationSaving(false); }
  };
  const removeAssociation = async (association: PlanProduct) => {
    if (!selectedPlan || !window.confirm("Remove this product from the plan?")) return;
    try {
      setError(""); await catalogApi.deletePlanProduct(selectedPlan.id, association.id);
      if (editingAssociationId === association.id) { setEditingAssociationId(null); setAssociationForm(blankAssociation); setVariants([]); }
      await loadAssociations(selectedPlan.id);
    } catch (requestError) { setError(apiErrorMessage(requestError)); }
  };
  const productName = (productId: string) => products.find((product) => product.id === productId)?.name ?? productId;
  const variantName = (association: PlanProduct) => !association.product_variant_id ? "All variants" : variantLabels[association.product_variant_id] ?? association.product_variant_id;

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-xl font-bold tracking-tight text-slate-900">Plans</h1><p className="mt-1 text-sm text-slate-500">Create and manage subscription plans.</p></div>{canManage && <button onClick={openNewPlan} className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-yellow-500"><Plus size={16} /> Add Plan</button>}</header>
    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Plan</th><th className="px-4 py-4">Frequency</th><th className="px-4 py-4">Price</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs">
      {loading && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Loading plans…</td></tr>}
      {!loading && plans.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No plans are available.</td></tr>}
      {plans.map((plan) => <tr key={plan.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{plan.name}</p><p className="mt-1 text-[10px] text-slate-400">{plan.description || "No description"}</p></td><td className="px-4 py-4 capitalize text-slate-600">{plan.billing_frequency}</td><td className="px-4 py-4 font-semibold text-slate-700">{plan.currency} {plan.price}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${plan.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{plan.is_active ? "Active" : "Inactive"}</span></td><td className="px-4 py-4"><div className="flex items-center gap-2">{canManage && <button onClick={() => void openAssociations(plan)} className="flex items-center gap-1 rounded-md border border-yellow-200 px-2 py-1.5 text-[11px] font-semibold text-yellow-800 hover:bg-yellow-50"><PackagePlus size={14} />Manage Products</button>}{canManage && <button title="Edit plan" onClick={() => openEditPlan(plan)} className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={15} /></button>}{canDelete && <button title="Delete plan" onClick={() => void deletePlan(plan)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}</div></td></tr>)}
    </tbody></table></div></section>
    {planModalOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={savePlan} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">{editingPlanId ? "Edit Plan" : "Create Plan"}</h2><p className="mt-1 text-xs text-slate-500">Only fields supported by the subscription API are shown.</p></div><button type="button" aria-label="Close form" onClick={closePlanModal}><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-xs font-semibold">Name<input required value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="sm:col-span-2 text-xs font-semibold">Description<textarea value={planForm.description ?? ""} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-3" /></label><label className="text-xs font-semibold">Billing frequency<select value={planForm.billing_frequency} onChange={(event) => setPlanForm({ ...planForm, billing_frequency: event.target.value as PlanForm["billing_frequency"] })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label><label className="text-xs font-semibold">Currency<input maxLength={3} required value={planForm.currency} onChange={(event) => setPlanForm({ ...planForm, currency: event.target.value.toUpperCase() })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="text-xs font-semibold">Price<input required min="0" step="0.01" type="number" value={planForm.price} onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="text-xs font-semibold">Trial days<input required min="0" type="number" value={planForm.trial_days} onChange={(event) => setPlanForm({ ...planForm, trial_days: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="text-xs font-semibold sm:col-span-2"><input type="checkbox" checked={planForm.is_active} onChange={(event) => setPlanForm({ ...planForm, is_active: event.target.checked })} className="mr-2" />Active</label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closePlanModal} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button><button className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold">Save Plan</button></div></form></div>}
    {selectedPlan && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Manage Products</h2><p className="mt-1 text-xs text-slate-500">{selectedPlan.name}</p></div><button onClick={closeAssociations} aria-label="Close product associations"><X size={20} /></button></div>{associationsLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading associated products…</p> : <div className="mt-5 space-y-2">{associations.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No products have been added to this plan.</p> : associations.map((association) => <div key={association.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-3 text-xs sm:flex-row sm:items-center"><div><p className="font-semibold text-slate-800">{productName(association.product_id)}</p><p className="mt-1 text-slate-500">{variantName(association)} · Quantity {association.quantity} · {association.unit_price ? `Unit price ${selectedPlan.currency} ${association.unit_price}` : "Uses plan price"} · Position {association.position}</p></div><div className="flex gap-2">{canManage && <button onClick={() => void editAssociation(association)} className="rounded border px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">Edit</button>}{canManage && <button onClick={() => void removeAssociation(association)} className="rounded border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50">Remove</button>}</div></div>)}</div>}{canManage && <form onSubmit={saveAssociation} className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-slate-800">{editingAssociationId ? "Edit association" : "Add product"}</h3>{editingAssociationId && <button type="button" onClick={() => { setEditingAssociationId(null); setAssociationForm(blankAssociation); setVariants([]); }} className="text-xs text-slate-500">Cancel edit</button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Product<select required value={associationForm.product_id} onChange={(event) => void chooseProduct(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="text-xs font-semibold">Variant (optional)<select value={associationForm.product_variant_id} onChange={(event) => setAssociationForm({ ...associationForm, product_variant_id: event.target.value })} disabled={!associationForm.product_id} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="">No specific variant</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}{variant.sku ? ` (${variant.sku})` : ""}</option>)}</select></label><label className="text-xs font-semibold">Quantity<input required min="0.001" step="0.001" type="number" value={associationForm.quantity} onChange={(event) => setAssociationForm({ ...associationForm, quantity: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="text-xs font-semibold">Unit price (optional)<input min="0" step="0.01" type="number" value={associationForm.unit_price} onChange={(event) => setAssociationForm({ ...associationForm, unit_price: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="text-xs font-semibold">Display position<input required min="0" step="1" type="number" value={associationForm.position} onChange={(event) => setAssociationForm({ ...associationForm, position: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" /></label></div><div className="mt-4 flex justify-end"><button disabled={associationSaving} className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold disabled:opacity-50">{associationSaving ? "Saving…" : editingAssociationId ? "Save association" : "Add product"}</button></div></form>}</section></div>}
  </div>;
}
