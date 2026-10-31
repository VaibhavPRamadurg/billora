
import { useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  Pencil,
  X,
  Percent,
  Tag,
  CalendarDays,
  Users,
  Package,
  CheckCircle2,
  PauseCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";

type DiscountType = "Percentage" | "Fixed";
type DiscountScope = "Products" | "Subscriptions";
type DiscountStatus =
  | "Active"
  | "Scheduled"
  | "Expired"
  | "Exhausted"
  | "Disabled";

type DiscountRule = {
  id: number;
  name: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  productIds: string[];
  minSpend: number | null;
  minQuantity: number;
  startDate: string;
  endDate: string;
  maxUses: number | null;
  usedCount: number;
  enabled: boolean;
};

type DiscountForm = {
  name: string;
  type: DiscountType;
  value: string;
  scope: DiscountScope;
  productIds: string[];
  minSpend: string;
  minQuantity: string;
  startDate: string;
  endDate: string;
  maxUses: string;
  enabled: boolean;
};

const PAGE_SIZE = 6;

const products = [
  { id: "P001", name: "BrightCRM" },
  { id: "P002", name: "Analytics Pro" },
  { id: "P003", name: "Cloud Storage" },
  { id: "P004", name: "Support Package" },
  { id: "P005", name: "Odoo Integration" },
  { id: "P006", name: "Premium Support" },
];

const initialRules: DiscountRule[] = [
  {
    id: 1,
    name: "Early Bird Discount",
    type: "Percentage",
    value: 10,
    scope: "Products",
    productIds: ["P001", "P002"],
    minSpend: 100,
    minQuantity: 1,
    startDate: "2026-10-01",
    endDate: "2026-12-31",
    maxUses: 100,
    usedCount: 37,
    enabled: true,
  },
  {
    id: 2,
    name: "Enterprise Volume Discount",
    type: "Fixed",
    value: 500,
    scope: "Subscriptions",
    productIds: [],
    minSpend: 1000,
    minQuantity: 5,
    startDate: "2026-09-01",
    endDate: "2027-03-31",
    maxUses: 50,
    usedCount: 18,
    enabled: true,
  },
  {
    id: 3,
    name: "Welcome Offer",
    type: "Percentage",
    value: 15,
    scope: "Products",
    productIds: ["P003", "P004"],
    minSpend: 50,
    minQuantity: 1,
    startDate: "2026-10-01",
    endDate: "2026-11-30",
    maxUses: 200,
    usedCount: 86,
    enabled: true,
  },
  {
    id: 4,
    name: "Annual Subscription Offer",
    type: "Fixed",
    value: 250,
    scope: "Subscriptions",
    productIds: [],
    minSpend: null,
    minQuantity: 1,
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    maxUses: 75,
    usedCount: 75,
    enabled: true,
  },
  {
    id: 5,
    name: "Legacy Customer Discount",
    type: "Percentage",
    value: 5,
    scope: "Products",
    productIds: ["P001"],
    minSpend: 200,
    minQuantity: 1,
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    maxUses: null,
    usedCount: 42,
    enabled: true,
  },
  {
    id: 6,
    name: "Holiday Subscription Offer",
    type: "Percentage",
    value: 20,
    scope: "Subscriptions",
    productIds: [],
    minSpend: 500,
    minQuantity: 1,
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    maxUses: 100,
    usedCount: 0,
    enabled: true,
  },
];

const emptyForm: DiscountForm = {
  name: "",
  type: "Percentage",
  value: "",
  scope: "Products",
  productIds: [],
  minSpend: "",
  minQuantity: "1",
  startDate: "2026-10-31",
  endDate: "",
  maxUses: "",
  enabled: true,
};

function getTodayString() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function getRuleStatus(rule: DiscountRule): DiscountStatus {
  const today = getTodayString();

  if (!rule.enabled) return "Disabled";

  if (rule.maxUses !== null && rule.usedCount >= rule.maxUses) {
    return "Exhausted";
  }

  if (rule.startDate > today) return "Scheduled";

  if (rule.endDate && rule.endDate < today) return "Expired";

  return "Active";
}

function currency(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DiscountStatusBadge({ status }: { status: DiscountStatus }) {
  const styles: Record<DiscountStatus, string> = {
    Active: "bg-emerald-50 text-emerald-700",
    Scheduled: "bg-blue-50 text-blue-700",
    Expired: "bg-slate-100 text-slate-500",
    Exhausted: "bg-red-50 text-red-600",
    Disabled: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Tag;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon size={18} />
        </div>
      </div>

      <h2 className="mt-3 text-2xl font-bold text-slate-900">{value}</h2>
      <p className="mt-2 text-[11px] text-slate-400">{description}</p>
    </div>
  );
}

export default function Discounts() {
  const [rules, setRules] = useState<DiscountRule[]>(initialRules);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm);
  const [error, setError] = useState("");

  const filteredRules = rules.filter((rule) => {
    const query = search.toLowerCase().trim();

    const matchesSearch = rule.name.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" ||
      getRuleStatus(rule) === statusFilter;

    const matchesType =
      typeFilter === "All" || rule.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRules.length / PAGE_SIZE)
  );

  const paginatedRules = filteredRules.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeCount = rules.filter(
    (rule) => getRuleStatus(rule) === "Active"
  ).length;

  const totalRedemptions = rules.reduce(
    (total, rule) => total + rule.usedCount,
    0
  );

  const exhaustedCount = rules.filter(
    (rule) => getRuleStatus(rule) === "Exhausted"
  ).length;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (rule: DiscountRule) => {
    setEditingId(rule.id);

    setForm({
      name: rule.name,
      type: rule.type,
      value: String(rule.value),
      scope: rule.scope,
      productIds: [...rule.productIds],
      minSpend:
        rule.minSpend === null ? "" : String(rule.minSpend),
      minQuantity: String(rule.minQuantity),
      startDate: rule.startDate,
      endDate: rule.endDate,
      maxUses:
        rule.maxUses === null ? "" : String(rule.maxUses),
      enabled: rule.enabled,
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

  const updateProductSelection = (productId: string) => {
    setForm((previous) => ({
      ...previous,
      productIds: previous.productIds.includes(productId)
        ? previous.productIds.filter((id) => id !== productId)
        : [...previous.productIds, productId],
    }));
  };

  const handleScopeChange = (scope: DiscountScope) => {
    setForm((previous) => ({
      ...previous,
      scope,
      productIds: scope === "Products" ? previous.productIds : [],
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const value = Number(form.value);
    const minSpend =
      form.minSpend.trim() === "" ? null : Number(form.minSpend);

    const minQuantity = Number(form.minQuantity);
    const maxUses =
      form.maxUses.trim() === "" ? null : Number(form.maxUses);

    if (!form.name.trim()) {
      setError("Please enter a discount rule name.");
      return;
    }

    if (!Number.isFinite(value) || value <= 0) {
      setError("Discount value must be greater than zero.");
      return;
    }

    if (form.type === "Percentage" && value > 100) {
      setError("Percentage discount cannot exceed 100%.");
      return;
    }

    if (
      minSpend !== null &&
      (!Number.isFinite(minSpend) || minSpend < 0)
    ) {
      setError("Minimum spend must be a valid non-negative amount.");
      return;
    }

    if (!Number.isInteger(minQuantity) || minQuantity < 1) {
      setError("Minimum quantity must be a positive whole number.");
      return;
    }

    if (
      maxUses !== null &&
      (!Number.isInteger(maxUses) || maxUses < 1)
    ) {
      setError("Maximum usage must be a positive whole number.");
      return;
    }

    if (!form.startDate) {
      setError("Please select a start date.");
      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    if (form.scope === "Products" && form.productIds.length === 0) {
      setError("Select at least one product for this discount.");
      return;
    }

    const previousRule = rules.find((rule) => rule.id === editingId);

    const nextId =
      Math.max(0, ...rules.map((rule) => rule.id)) + 1;

    const savedRule: DiscountRule = {
      id: editingId ?? nextId,
      name: form.name.trim(),
      type: form.type,
      value,
      scope: form.scope,
      productIds:
        form.scope === "Products" ? form.productIds : [],
      minSpend,
      minQuantity,
      startDate: form.startDate,
      endDate: form.endDate,
      maxUses,
      usedCount: previousRule?.usedCount ?? 0,
      enabled: form.enabled,
    };

    if (editingId !== null) {
      setRules((previous) =>
        previous.map((rule) =>
          rule.id === editingId ? savedRule : rule
        )
      );
    } else {
      setRules((previous) => [savedRule, ...previous]);
      setCurrentPage(1);
    }

    closeForm();
  };

  const toggleRule = (id: number) => {
    setRules((previous) =>
      previous.map((rule) =>
        rule.id === id
          ? { ...rule, enabled: !rule.enabled }
          : rule
      )
    );
  };

  const deleteRule = (id: number) => {
    const rule = rules.find((item) => item.id === id);

    if (!rule || rule.usedCount > 0) {
      window.alert(
        "This rule has redemption history and cannot be deleted in this demo. Disable it instead."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this discount rule?"
    );

    if (!confirmed) return;

    setRules((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const getScopeLabel = (rule: DiscountRule) => {
    if (rule.scope === "Subscriptions") {
      return "Whole Subscription";
    }

    return rule.productIds
      .map(
        (id) => products.find((product) => product.id === id)?.name
      )
      .filter(Boolean)
      .join(", ");
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setTypeFilter("All");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Discounts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage discount rules for your customers.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Create Discount
        </button>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Rules"
          value={rules.length.toLocaleString()}
          description="All discount rules created"
          icon={Tag}
          color="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Active Discounts"
          value={activeCount.toLocaleString()}
          description="Currently available for redemption"
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Total Redemptions"
          value={totalRedemptions.toLocaleString()}
          description="Recorded discount uses"
          icon={Users}
          color="bg-violet-50 text-violet-600"
        />

        <MetricCard
          title="Exhausted Rules"
          value={exhaustedCount.toLocaleString()}
          description="Reached their maximum usage limit"
          icon={AlertCircle}
          color="bg-red-50 text-red-600"
        />
      </section>

      {/* Discount Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search discount rules..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All statuses</option>
              {(
                [
                  "Active",
                  "Scheduled",
                  "Expired",
                  "Exhausted",
                  "Disabled",
                ] as DiscountStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All types</option>
              <option value="Percentage">Percentage</option>
              <option value="Fixed">Fixed Amount</option>
            </select>

            <button
              onClick={resetFilters}
              className="h-10 rounded-lg px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Discount Rule</th>
                <th className="px-4 py-4">Discount</th>
                <th className="px-4 py-4">Scope</th>
                <th className="px-4 py-4">Minimum Qty</th>
                <th className="px-4 py-4">Validity</th>
                <th className="px-4 py-4">Usage</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedRules.map((rule) => {
                const status = getRuleStatus(rule);

                const usagePercent =
                  rule.maxUses === null
                    ? 0
                    : Math.min(
                        100,
                        (rule.usedCount / rule.maxUses) * 100
                      );

                return (
                  <tr
                    key={rule.id}
                    className="text-xs transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">
                        {rule.name}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Rule #{String(rule.id).padStart(4, "0")}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-amber-50 p-1.5 text-amber-600">
                          {rule.type === "Percentage" ? (
                            <Percent size={15} />
                          ) : (
                            <Tag size={15} />
                          )}
                        </div>
                        <span className="font-bold text-slate-800">
                          {rule.type === "Percentage"
                            ? `${rule.value}%`
                            : currency(rule.value)}
                        </span>
                      </div>
                    </td>

                    <td className="max-w-48 px-4 py-4">
                      <p className="truncate font-medium text-slate-600">
                        {rule.scope === "Subscriptions"
                          ? "Whole Subscription"
                          : `${rule.productIds.length} Products`}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {getScopeLabel(rule)}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {rule.minQuantity}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="text-slate-600">
                        {formatDate(rule.startDate)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Until {rule.endDate ? formatDate(rule.endDate) : "Unlimited"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-700">
                        {rule.usedCount} / {rule.maxUses ?? "∞"}
                      </p>

                      {rule.maxUses !== null && (
                        <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              usagePercent >= 100
                                ? "bg-red-500"
                                : "bg-yellow-400"
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <DiscountStatusBadge status={status} />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditForm(rule)}
                          title="Edit discount"
                          className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          onClick={() => toggleRule(rule.id)}
                          title={
                            rule.enabled
                              ? "Disable discount"
                              : "Enable discount"
                          }
                          disabled={
                            rule.maxUses !== null &&
                            rule.usedCount >= rule.maxUses
                          }
                          className="rounded-md p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {rule.enabled ? (
                            <PauseCircle size={16} />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                        </button>

                        <button
                          onClick={() => deleteRule(rule.id)}
                          title="Delete discount"
                          className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedRules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Tag
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm font-semibold text-slate-600">
                      No discount rules found
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

        {/* Pagination */}
        <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center">
          <p className="text-[11px] text-slate-400">
            Showing{" "}
            {filteredRules.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(
              currentPage * PAGE_SIZE,
              filteredRules.length
            )}{" "}
            of {filteredRules.length} discount rules
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={currentPage === 1}
              aria-label="Previous page"
              className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from(
              { length: totalPages },
              (_, index) => index + 1
            ).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${
                  currentPage === page
                    ? "bg-yellow-400 text-slate-900"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
              aria-label="Next page"
              className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Create/Edit Discount Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null
                    ? "Edit Discount Rule"
                    : "Create Discount Rule"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Configure discount amount, eligibility and usage policies.
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close discount form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto p-6"
            >
              {/* Rule name */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Discount Rule Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="e.g. Enterprise Volume Discount"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                />
              </div>

              {/* Discount type and value */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Discount Type *
                  </label>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        type: event.target.value as DiscountType,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Discount Value *
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="0.01"
                      max={
                        form.type === "Percentage" ? 100 : undefined
                      }
                      step="0.01"
                      value={form.value}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          value: event.target.value,
                        })
                      }
                      placeholder="Enter value"
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-xs outline-none focus:border-yellow-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      {form.type === "Percentage" ? "%" : "$"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Discount Scope *
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleScopeChange("Products")}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                      form.scope === "Products"
                        ? "border-yellow-400 bg-yellow-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Package
                      size={18}
                      className={
                        form.scope === "Products"
                          ? "text-amber-600"
                          : "text-slate-400"
                      }
                    />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">
                        Specific Products
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">
                        Apply to selected catalog products.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange("Subscriptions")}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                      form.scope === "Subscriptions"
                        ? "border-yellow-400 bg-yellow-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Users
                      size={18}
                      className={
                        form.scope === "Subscriptions"
                          ? "text-amber-600"
                          : "text-slate-400"
                      }
                    />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">
                        Whole Subscription
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">
                        Apply at the subscription level.
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Product selection */}
              {form.scope === "Products" && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Select Products *
                  </label>

                  <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                    {products.map((product) => (
                      <label
                        key={product.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.productIds.includes(product.id)}
                          onChange={() =>
                            updateProductSelection(product.id)
                          }
                          className="h-4 w-4 accent-yellow-500"
                        />
                        {product.name}
                      </label>
                    ))}
                  </div>

                  <p className="mt-2 text-[10px] text-slate-400">
                    {form.productIds.length} product(s) selected.
                  </p>
                </div>
              )}

              {/* Eligibility */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">
                  Eligibility Conditions
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Minimum Spend ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.minSpend}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          minSpend: event.target.value,
                        })
                      }
                      placeholder="No minimum"
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
                      value={form.minQuantity}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          minQuantity: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
              </div>

              {/* Validity period */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays size={16} className="text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Validity Period
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Start Date *
                    </label>
                    <input
                      required
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          startDate: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      End Date
                    </label>
                    <input
                      type="date"
                      min={form.startDate || undefined}
                      value={form.endDate}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          endDate: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      Leave blank for no expiry date.
                    </p>
                  </div>
                </div>
              </div>

              {/* Usage limit */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Maximum Number of Uses
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      maxUses: event.target.value,
                    })
                  }
                  placeholder="Unlimited usage"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Leave blank if the discount has no redemption limit.
                </p>
              </div>

              {/* Enable rule */}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      enabled: event.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-yellow-500"
                />
                <span>
                  <span className="block text-xs font-semibold text-slate-700">
                    Enable Discount Rule
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Allow eligible customers to use this discount during its validity period.
                  </span>
                </span>
              </label>

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
                  {editingId !== null ? "Save Changes" : "Create Discount"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
