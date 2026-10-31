
import { useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  Plus,
  Pencil,
  X,
  Percent,
  CalendarDays,
  Package,
  Layers,
  CheckCircle2,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

type TaxScope =
  | "All Products"
  | "Selected Products"
  | "Subscriptions";

type TaxStatus = "Active" | "Scheduled" | "Expired" | "Disabled";

type TaxRule = {
  id: number;
  name: string;
  rate: number;
  scope: TaxScope;
  productIds: string[];
  effectiveFrom: string;
  effectiveTo: string;
  enabled: boolean;
};

type TaxForm = {
  name: string;
  rate: string;
  scope: TaxScope;
  productIds: string[];
  effectiveFrom: string;
  effectiveTo: string;
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

const initialRules: TaxRule[] = [
  {
    id: 1,
    name: "Standard Product Tax",
    rate: 10,
    scope: "All Products",
    productIds: [],
    effectiveFrom: "2026-01-01",
    effectiveTo: "",
    enabled: true,
  },
  {
    id: 2,
    name: "Software Services Tax",
    rate: 8,
    scope: "Selected Products",
    productIds: ["P001", "P002"],
    effectiveFrom: "2026-01-01",
    effectiveTo: "2027-03-31",
    enabled: true,
  },
  {
    id: 3,
    name: "Subscription Tax",
    rate: 12,
    scope: "Subscriptions",
    productIds: [],
    effectiveFrom: "2026-06-01",
    effectiveTo: "",
    enabled: true,
  },
  {
    id: 4,
    name: "Storage Service Tax",
    rate: 5,
    scope: "Selected Products",
    productIds: ["P003"],
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    enabled: true,
  },
  {
    id: 5,
    name: "Premium Services Tax",
    rate: 15,
    scope: "Selected Products",
    productIds: ["P004", "P006"],
    effectiveFrom: "2026-12-01",
    effectiveTo: "2027-12-31",
    enabled: true,
  },
  {
    id: 6,
    name: "Legacy Tax Rule",
    rate: 6,
    scope: "All Products",
    productIds: [],
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-09-30",
    enabled: true,
  },
];

function getTodayString() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function getTaxStatus(rule: TaxRule): TaxStatus {
  const today = getTodayString();

  if (!rule.enabled) return "Disabled";

  if (rule.effectiveFrom > today) return "Scheduled";

  if (rule.effectiveTo && rule.effectiveTo < today) {
    return "Expired";
  }

  return "Active";
}

function formatDate(date: string) {
  if (!date) return "Unlimited";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TaxStatusBadge({ status }: { status: TaxStatus }) {
  const styles: Record<TaxStatus, string> = {
    Active: "bg-emerald-50 text-emerald-700",
    Scheduled: "bg-blue-50 text-blue-700",
    Expired: "bg-slate-100 text-slate-500",
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
  icon: LucideIcon;
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

      <h2 className="mt-3 text-2xl font-bold text-slate-900">
        {value}
      </h2>

      <p className="mt-2 text-[11px] text-slate-400">
        {description}
      </p>
    </div>
  );
}

export default function Taxes() {
  const [rules, setRules] = useState<TaxRule[]>(initialRules);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaxForm>({
    name: "",
    rate: "",
    scope: "All Products",
    productIds: [],
    effectiveFrom: getTodayString(),
    effectiveTo: "",
    enabled: true,
  });

  const [error, setError] = useState("");

  const filteredRules = rules.filter((rule) => {
    const query = search.toLowerCase().trim();

    const matchesSearch = rule.name.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" ||
      getTaxStatus(rule) === statusFilter;

    const matchesScope =
      scopeFilter === "All" || rule.scope === scopeFilter;

    return matchesSearch && matchesStatus && matchesScope;
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
    (rule) => getTaxStatus(rule) === "Active"
  ).length;

  const scheduledCount = rules.filter(
    (rule) => getTaxStatus(rule) === "Scheduled"
  ).length;

  const disabledCount = rules.filter(
    (rule) => getTaxStatus(rule) === "Disabled"
  ).length;

  const openAddForm = () => {
    setEditingId(null);

    setForm({
      name: "",
      rate: "",
      scope: "All Products",
      productIds: [],
      effectiveFrom: getTodayString(),
      effectiveTo: "",
      enabled: true,
    });

    setError("");
    setShowForm(true);
  };

  const openEditForm = (rule: TaxRule) => {
    setEditingId(rule.id);

    setForm({
      name: rule.name,
      rate: String(rule.rate),
      scope: rule.scope,
      productIds: [...rule.productIds],
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      enabled: rule.enabled,
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setError("");
  };

  const handleScopeChange = (scope: TaxScope) => {
    setForm((previous) => ({
      ...previous,
      scope,
      productIds:
        scope === "Selected Products"
          ? previous.productIds
          : [],
    }));
  };

  const toggleProduct = (productId: string) => {
    setForm((previous) => ({
      ...previous,
      productIds: previous.productIds.includes(productId)
        ? previous.productIds.filter((id) => id !== productId)
        : [...previous.productIds, productId],
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const rate = Number(form.rate);

    if (!form.name.trim()) {
      setError("Please enter a tax rule name.");
      return;
    }

    if (
      form.rate.trim() === "" ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      setError("Enter a valid tax rate between 0% and 100%.");
      return;
    }

    if (!form.effectiveFrom) {
      setError("Please select an effective start date.");
      return;
    }

    if (
      form.effectiveTo &&
      form.effectiveTo < form.effectiveFrom
    ) {
      setError("The end date cannot be before the start date.");
      return;
    }

    if (
      form.scope === "Selected Products" &&
      form.productIds.length === 0
    ) {
      setError("Select at least one product for this tax rule.");
      return;
    }

    const nextId =
      Math.max(0, ...rules.map((rule) => rule.id)) + 1;

    const savedRule: TaxRule = {
      id: editingId ?? nextId,
      name: form.name.trim(),
      rate,
      scope: form.scope,
      productIds:
        form.scope === "Selected Products"
          ? form.productIds
          : [],
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo,
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

  const getScopeDescription = (rule: TaxRule) => {
    if (rule.scope === "All Products") {
      return "Applies to all products";
    }

    if (rule.scope === "Subscriptions") {
      return "Applies to subscriptions";
    }

    return rule.productIds
      .map(
        (id) => products.find((product) => product.id === id)?.name
      )
      .filter(Boolean)
      .join(", ");
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setScopeFilter("All");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Taxes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure tax rules and their applicability.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Create Tax Rule
        </button>
      </div>

      {/* Demonstration notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <AlertCircle size={17} className="mt-0.5 shrink-0 text-blue-600" />
        <div>
          <p className="text-xs font-semibold text-blue-800">
            Tax configuration
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-blue-700">
            The displayed tax rates are demonstration values. Configure
            the applicable rates according to your business's tax
            jurisdiction. Actual tax calculation will be performed by
            the billing backend.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Tax Rules"
          value={rules.length.toLocaleString()}
          description="All configured tax rules"
          icon={Layers}
          color="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Active Rules"
          value={activeCount.toLocaleString()}
          description="Currently effective and enabled"
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Scheduled Rules"
          value={scheduledCount.toLocaleString()}
          description="Waiting for their effective date"
          icon={CalendarDays}
          color="bg-amber-50 text-amber-600"
        />

        <MetricCard
          title="Disabled Rules"
          value={disabledCount.toLocaleString()}
          description="Currently switched off"
          icon={PauseCircle}
          color="bg-violet-50 text-violet-600"
        />
      </section>

      {/* Tax rules table */}
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
              placeholder="Search tax rules..."
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
                ["Active", "Scheduled", "Expired", "Disabled"] as TaxStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={scopeFilter}
              onChange={(event) => {
                setScopeFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All scopes</option>
              <option value="All Products">All Products</option>
              <option value="Selected Products">Selected Products</option>
              <option value="Subscriptions">Subscriptions</option>
            </select>

            <button
              onClick={clearFilters}
              className="h-10 rounded-lg px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Tax Rule</th>
                <th className="px-4 py-4">Tax Rate</th>
                <th className="px-4 py-4">Scope</th>
                <th className="px-4 py-4">Effective From</th>
                <th className="px-4 py-4">Effective Until</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedRules.map((rule) => {
                const status = getTaxStatus(rule);

                return (
                  <tr
                    key={rule.id}
                    className="text-xs transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                          <Percent size={16} />
                        </div>

                        <div>
                          <p className="font-semibold text-slate-800">
                            {rule.name}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Rule #{String(rule.id).padStart(4, "0")}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-slate-800">
                        {rule.rate.toFixed(2)}%
                      </span>
                    </td>

                    <td className="max-w-52 px-4 py-4">
                      <span className="font-medium text-slate-600">
                        {rule.scope}
                      </span>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {getScopeDescription(rule)}
                      </p>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                      {formatDate(rule.effectiveFrom)}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                      {formatDate(rule.effectiveTo)}
                    </td>

                    <td className="px-4 py-4">
                      <TaxStatusBadge status={status} />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditForm(rule)}
                          title="Edit tax rule"
                          className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          onClick={() => toggleRule(rule.id)}
                          title={
                            rule.enabled
                              ? "Disable tax rule"
                              : "Enable tax rule"
                          }
                          className="rounded-md p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        >
                          {rule.enabled ? (
                            <PauseCircle size={16} />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedRules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Percent
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />

                    <p className="text-sm font-semibold text-slate-600">
                      No tax rules found
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
            of {filteredRules.length} tax rules
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

      {/* Create/Edit Tax Rule Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null
                    ? "Edit Tax Rule"
                    : "Create Tax Rule"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Configure tax percentage, scope and effective dates.
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close tax rule form"
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
                  Tax Rule Name *
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
                  placeholder="e.g. Standard Product Tax"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                />
              </div>

              {/* Tax rate */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Tax Rate *
                </label>

                <div className="relative">
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.rate}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        rate: event.target.value,
                      })
                    }
                    placeholder="Enter percentage"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-xs outline-none focus:border-yellow-400"
                  />

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    %
                  </span>
                </div>

                <p className="mt-1 text-[10px] text-slate-400">
                  Enter a rate between 0 and 100.
                </p>
              </div>

              {/* Tax scope */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Tax Applicability *
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      {
                        value: "All Products",
                        label: "All Products",
                        description: "Entire product catalog",
                        icon: Layers,
                      },
                      {
                        value: "Selected Products",
                        label: "Selected Products",
                        description: "Choose individual products",
                        icon: Package,
                      },
                      {
                        value: "Subscriptions",
                        label: "Subscriptions",
                        description: "Subscription charges",
                        icon: CalendarDays,
                      },
                    ] as const
                  ).map((option) => {
                    const Icon = option.icon;
                    const selected = form.scope === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleScopeChange(option.value)}
                        className={`flex items-start gap-2 rounded-lg border p-3 text-left transition ${
                          selected
                            ? "border-yellow-400 bg-yellow-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Icon
                          size={17}
                          className={
                            selected
                              ? "text-amber-600"
                              : "text-slate-400"
                          }
                        />

                        <span>
                          <span className="block text-[11px] font-semibold text-slate-800">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-[9px] leading-relaxed text-slate-500">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product selection */}
              {form.scope === "Selected Products" && (
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
                          onChange={() => toggleProduct(product.id)}
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

              {/* Effective dates */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays
                    size={16}
                    className="text-slate-500"
                  />
                  <h3 className="text-sm font-bold text-slate-800">
                    Effective Period
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Effective From *
                    </label>

                    <input
                      required
                      type="date"
                      value={form.effectiveFrom}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          effectiveFrom: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Effective Until
                    </label>

                    <input
                      type="date"
                      min={form.effectiveFrom || undefined}
                      value={form.effectiveTo}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          effectiveTo: event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                    />

                    <p className="mt-1 text-[10px] text-slate-400">
                      Leave empty for an indefinite period.
                    </p>
                  </div>
                </div>
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
                    Enable Tax Rule
                  </span>

                  <span className="mt-1 block text-[10px] text-slate-400">
                    Allow the billing engine to consider this rule
                    during its effective period.
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
                  {editingId !== null
                    ? "Save Changes"
                    : "Create Tax Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
