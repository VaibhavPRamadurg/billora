
import { useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  Filter,
  Pencil,
  X,
  CalendarDays,
  Pause,
  RefreshCw,
} from "lucide-react";

type Plan = {
  id: number;
  name: string;
  interval: "Monthly" | "Yearly";
  price: number;
  minQty: number;
  availableFrom: string;
  availableTo: string;
  status: "Active" | "Inactive";
  allowPause: boolean;
  allowEarlyClose: boolean;
  allowRenew: boolean;
  autoClose: boolean;
};

type PlanForm = {
  name: string;
  interval: "Monthly" | "Yearly";
  price: string;
  minQty: string;
  availableFrom: string;
  availableTo: string;
  allowPause: boolean;
  allowEarlyClose: boolean;
  allowRenew: boolean;
  autoClose: boolean;
};

const initialPlans: Plan[] = [
  {
    id: 1,
    name: "Starter Monthly",
    interval: "Monthly",
    price: 29,
    minQty: 1,
    availableFrom: "2026-01-01",
    availableTo: "",
    status: "Active",
    allowPause: false,
    allowEarlyClose: true,
    allowRenew: true,
    autoClose: false,
  },
  {
    id: 2,
    name: "Professional Monthly",
    interval: "Monthly",
    price: 99,
    minQty: 1,
    availableFrom: "2026-01-01",
    availableTo: "",
    status: "Active",
    allowPause: true,
    allowEarlyClose: true,
    allowRenew: true,
    autoClose: false,
  },
  {
    id: 3,
    name: "Enterprise Annual",
    interval: "Yearly",
    price: 1199,
    minQty: 5,
    availableFrom: "2026-01-01",
    availableTo: "",
    status: "Active",
    allowPause: true,
    allowEarlyClose: false,
    allowRenew: true,
    autoClose: false,
  },
  {
    id: 4,
    name: "Premium Annual",
    interval: "Yearly",
    price: 1499,
    minQty: 1,
    availableFrom: "2026-01-01",
    availableTo: "",
    status: "Active",
    allowPause: true,
    allowEarlyClose: true,
    allowRenew: true,
    autoClose: false,
  },
  {
    id: 5,
    name: "Add-on Storage",
    interval: "Monthly",
    price: 20,
    minQty: 1,
    availableFrom: "2026-01-01",
    availableTo: "",
    status: "Active",
    allowPause: false,
    allowEarlyClose: true,
    allowRenew: true,
    autoClose: false,
  },
  {
    id: 6,
    name: "Support Plan",
    interval: "Yearly",
    price: 99,
    minQty: 1,
    availableFrom: "2026-01-01",
    availableTo: "",
    status: "Inactive",
    allowPause: false,
    allowEarlyClose: false,
    allowRenew: false,
    autoClose: true,
  },
];

const emptyForm: PlanForm = {
  name: "",
  interval: "Monthly",
  price: "",
  minQty: "1",
  availableFrom: "",
  availableTo: "",
  allowPause: false,
  allowEarlyClose: false,
  allowRenew: true,
  autoClose: false,
};

function PlanStatus({ status }: { status: Plan["status"] }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        status === "Active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      }`}
    >
      {status}
    </span>
  );
}

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [error, setError] = useState("");

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch = plan.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || plan.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const currency = (amount: number) =>
    `$${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (plan: Plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      interval: plan.interval,
      price: String(plan.price),
      minQty: String(plan.minQty),
      availableFrom: plan.availableFrom,
      availableTo: plan.availableTo,
      allowPause: plan.allowPause,
      allowEarlyClose: plan.allowEarlyClose,
      allowRenew: plan.allowRenew,
      autoClose: plan.autoClose,
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const price = Number(form.price);
    const minQty = Number(form.minQty);

    if (!form.name.trim()) {
      setError("Please enter a plan name.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Please enter a valid non-negative price.");
      return;
    }

    if (!Number.isInteger(minQty) || minQty < 1) {
      setError("Minimum quantity must be a positive whole number.");
      return;
    }

    if (
      form.availableFrom &&
      form.availableTo &&
      form.availableTo < form.availableFrom
    ) {
      setError("Availability end date cannot be before the start date.");
      return;
    }

    const previousPlan = plans.find((plan) => plan.id === editingId);

    const savedPlan: Plan = {
      id: editingId ?? Date.now(),
      name: form.name.trim(),
      interval: form.interval,
      price,
      minQty,
      availableFrom: form.availableFrom,
      availableTo: form.availableTo,
      status: previousPlan?.status ?? "Active",
      allowPause: form.allowPause,
      allowEarlyClose: form.allowEarlyClose,
      allowRenew: form.allowRenew,
      autoClose: form.autoClose,
    };

    if (editingId !== null) {
      setPlans((previous) =>
        previous.map((plan) =>
          plan.id === editingId ? savedPlan : plan
        )
      );
    } else {
      setPlans((previous) => [savedPlan, ...previous]);
    }

    closeForm();
  };

  const toggleStatus = (id: number) => {
    setPlans((previous) =>
      previous.map((plan) =>
        plan.id === id
          ? {
              ...plan,
              status: plan.status === "Active" ? "Inactive" : "Active",
            }
          : plan
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Plans
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage subscription plans.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Add Plan
        </button>
      </div>

      {/* Plans table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Plan Name</th>
                <th className="px-4 py-4">Interval</th>
                <th className="px-4 py-4">Price</th>
                <th className="px-4 py-4">Min Qty</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredPlans.map((plan) => (
                <tr
                  key={plan.id}
                  className="text-xs transition hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800">
                      {plan.name}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {plan.autoClose ? "Auto-close enabled" : "Standard renewal"}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                      {plan.interval}
                    </span>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {currency(plan.price)}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {plan.minQty}
                  </td>

                  <td className="px-4 py-4">
                    <PlanStatus status={plan.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(plan)}
                        title="Edit plan"
                        className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => toggleStatus(plan.id)}
                        title={
                          plan.status === "Active"
                            ? "Deactivate plan"
                            : "Activate plan"
                        }
                        className="rounded-md p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                      >
                        {plan.status === "Active" ? (
                          <Pause size={15} />
                        ) : (
                          <RefreshCw size={15} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPlans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <CalendarDays
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm font-semibold text-slate-600">
                      No plans found
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Showing {filteredPlans.length} of {plans.length} plans
        </div>
      </section>

      {/* Add/Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null ? "Edit Plan" : "Create Plan"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Configure pricing, availability and subscription policies.
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto p-6"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Plan Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    placeholder="e.g. Professional Monthly"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Billing Interval *
                  </label>
                  <select
                    value={form.interval}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        interval: event.target.value as PlanForm["interval"],
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Plan Price ($) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: event.target.value })
                    }
                    placeholder="99.00"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Minimum Quantity *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.minQty}
                    onChange={(event) =>
                      setForm({ ...form, minQty: event.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              {/* Availability */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays size={16} className="text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Availability Period
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600">
                      Available From
                    </label>
                    <input
                      type="date"
                      value={form.availableFrom}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          availableFrom: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600">
                      Available Until
                    </label>
                    <input
                      type="date"
                      min={form.availableFrom || undefined}
                      value={form.availableTo}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          availableTo: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  Leave the end date empty for an unlimited availability period.
                </p>
              </div>

              {/* Subscription policies */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">
                  Subscription Policies
                </h3>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    {
                      key: "allowPause" as const,
                      label: "Allow Subscription Pause",
                      description: "Customers can temporarily pause billing.",
                    },
                    {
                      key: "allowEarlyClose" as const,
                      label: "Allow Early Closure",
                      description: "Subscriptions may end before expiry.",
                    },
                    {
                      key: "allowRenew" as const,
                      label: "Allow Renewal",
                      description: "Subscriptions can be renewed.",
                    },
                    {
                      key: "autoClose" as const,
                      label: "Automatic Closure",
                      description: "Close subscriptions at their end date.",
                    },
                  ].map((option) => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={form[option.key]}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            [option.key]: event.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4 accent-yellow-500"
                      />
                      <span>
                        <span className="block text-xs font-semibold text-slate-700">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-yellow-500"
                >
                  {editingId !== null ? "Save Changes" : "Save Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
