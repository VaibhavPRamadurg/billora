
import { useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  X,
  Pencil,
  Pause,
  Play,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Repeat,
  FileText,
  TrendingUp,
  ArrowDownRight,
} from "lucide-react";

type SubscriptionStatus =
  | "Draft"
  | "Quotation"
  | "Confirmed"
  | "Active"
  | "Paused"
  | "Closed";

type BillingCycle = "Monthly" | "Yearly";

type Subscription = {
  id: number;
  number: string;
  customer: string;
  plan: string;
  planType: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: string;
  expiryDate: string;
  quantity: number;
  amount: number;
  paymentTerms: string;
};

type PlanOption = {
  name: string;
  type: string;
  interval: BillingCycle;
  price: number;
  minQty: number;
};

type SubscriptionForm = {
  customer: string;
  plan: string;
  startDate: string;
  expiryDate: string;
  quantity: string;
  paymentTerms: string;
};

const PAGE_SIZE = 6;

const customers = [
  "TechCorp Solutions",
  "DataFlow Analytics",
  "CloudSync Inc.",
  "InnovateLab",
  "NextGen Systems",
  "Digital Dynamics",
  "FutureTech Labs",
  "SmartData Group",
];

const plans: PlanOption[] = [
  {
    name: "Starter Monthly",
    type: "Starter",
    interval: "Monthly",
    price: 29,
    minQty: 1,
  },
  {
    name: "Professional Monthly",
    type: "Professional",
    interval: "Monthly",
    price: 99,
    minQty: 1,
  },
  {
    name: "Enterprise Annual",
    type: "Enterprise",
    interval: "Yearly",
    price: 1199,
    minQty: 5,
  },
  {
    name: "Premium Annual",
    type: "Premium",
    interval: "Yearly",
    price: 1499,
    minQty: 1,
  },
  {
    name: "Add-on Storage",
    type: "Add-on",
    interval: "Monthly",
    price: 20,
    minQty: 1,
  },
];

const initialSubscriptions: Subscription[] = [
  {
    id: 1,
    number: "SUB-2026-0001",
    customer: "TechCorp Solutions",
    plan: "Enterprise Annual",
    planType: "Enterprise",
    status: "Active",
    billingCycle: "Yearly",
    startDate: "2026-10-15",
    expiryDate: "2027-10-14",
    quantity: 10,
    amount: 11990,
    paymentTerms: "Net 30",
  },
  {
    id: 2,
    number: "SUB-2026-0002",
    customer: "DataFlow Analytics",
    plan: "Professional Monthly",
    planType: "Professional",
    status: "Active",
    billingCycle: "Monthly",
    startDate: "2026-10-01",
    expiryDate: "",
    quantity: 3,
    amount: 297,
    paymentTerms: "Net 15",
  },
  {
    id: 3,
    number: "SUB-2026-0003",
    customer: "CloudSync Inc.",
    plan: "Premium Annual",
    planType: "Premium",
    status: "Active",
    billingCycle: "Yearly",
    startDate: "2026-10-08",
    expiryDate: "2027-10-07",
    quantity: 1,
    amount: 1499,
    paymentTerms: "Net 30",
  },
  {
    id: 4,
    number: "SUB-2026-0004",
    customer: "InnovateLab",
    plan: "Starter Monthly",
    planType: "Starter",
    status: "Draft",
    billingCycle: "Monthly",
    startDate: "2026-11-01",
    expiryDate: "",
    quantity: 1,
    amount: 29,
    paymentTerms: "Due immediately",
  },
  {
    id: 5,
    number: "SUB-2026-0005",
    customer: "NextGen Systems",
    plan: "Professional Monthly",
    planType: "Professional",
    status: "Confirmed",
    billingCycle: "Monthly",
    startDate: "2026-11-01",
    expiryDate: "",
    quantity: 5,
    amount: 495,
    paymentTerms: "Net 15",
  },
  {
    id: 6,
    number: "SUB-2026-0006",
    customer: "Digital Dynamics",
    plan: "Starter Monthly",
    planType: "Starter",
    status: "Paused",
    billingCycle: "Monthly",
    startDate: "2026-09-15",
    expiryDate: "",
    quantity: 2,
    amount: 58,
    paymentTerms: "Net 30",
  },
  {
    id: 7,
    number: "SUB-2026-0007",
    customer: "FutureTech Labs",
    plan: "Enterprise Annual",
    planType: "Enterprise",
    status: "Active",
    billingCycle: "Yearly",
    startDate: "2026-10-20",
    expiryDate: "2027-10-19",
    quantity: 5,
    amount: 5995,
    paymentTerms: "Net 30",
  },
  {
    id: 8,
    number: "SUB-2026-0008",
    customer: "SmartData Group",
    plan: "Starter Monthly",
    planType: "Starter",
    status: "Closed",
    billingCycle: "Monthly",
    startDate: "2026-08-01",
    expiryDate: "2026-09-01",
    quantity: 1,
    amount: 29,
    paymentTerms: "Due immediately",
  },
];

const emptyForm: SubscriptionForm = {
  customer: "",
  plan: "Starter Monthly",
  startDate: "",
  expiryDate: "",
  quantity: "1",
  paymentTerms: "Due immediately",
};

const statusStyles: Record<SubscriptionStatus, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Quotation: "bg-blue-50 text-blue-700",
  Confirmed: "bg-violet-50 text-violet-700",
  Active: "bg-emerald-50 text-emerald-700",
  Paused: "bg-amber-50 text-amber-700",
  Closed: "bg-red-50 text-red-600",
};

const transitionActions: Record<
  SubscriptionStatus,
  { label: string; next: SubscriptionStatus; icon: typeof Play }[]
> = {
  Draft: [
    { label: "Send Quote", next: "Quotation", icon: FileText },
    { label: "Confirm", next: "Confirmed", icon: CheckCircle2 },
  ],
  Quotation: [
    { label: "Confirm", next: "Confirmed", icon: CheckCircle2 },
  ],
  Confirmed: [
    { label: "Activate", next: "Active", icon: Play },
  ],
  Active: [
    { label: "Pause", next: "Paused", icon: Pause },
    { label: "Close", next: "Closed", icon: X },
  ],
  Paused: [
    { label: "Resume", next: "Active", icon: Play },
    { label: "Close", next: "Closed", icon: X },
  ],
  Closed: [],
};

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function currency(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function MetricCard({
  title,
  value,
  change,
  icon,
  improvement = true,
}: {
  title: string;
  value: string;
  change: string;
  icon: "up" | "down";
  improvement?: boolean;
}) {
  const TrendIcon = icon === "up" ? TrendingUp : ArrowDownRight;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>

      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </h2>

      <p
        className={`mt-3 flex items-center gap-1 text-xs font-semibold ${
          improvement ? "text-emerald-600" : "text-red-500"
        }`}
      >
        <TrendIcon size={15} />
        {change}
        <span className="font-normal text-slate-400">
          vs last month
        </span>
      </p>
    </div>
  );
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(
    initialSubscriptions
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [planFilter, setPlanFilter] = useState("All");
  const [cycleFilter, setCycleFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SubscriptionForm>(emptyForm);
  const [error, setError] = useState("");

  const filteredSubscriptions = subscriptions.filter((subscription) => {
    const query = search.toLowerCase().trim();

    const matchesSearch =
      subscription.customer.toLowerCase().includes(query) ||
      subscription.number.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" || subscription.status === statusFilter;

    const matchesPlan =
      planFilter === "All" || subscription.planType === planFilter;

    const matchesCycle =
      cycleFilter === "All" || subscription.billingCycle === cycleFilter;

    const matchesFrom =
      !fromDate || subscription.startDate >= fromDate;

    const matchesTo =
      !toDate || subscription.startDate <= toDate;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPlan &&
      matchesCycle &&
      matchesFrom &&
      matchesTo
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSubscriptions.length / PAGE_SIZE)
  );

  const paginatedSubscriptions = filteredSubscriptions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selectedSubscriptions = subscriptions.filter((subscription) =>
    selectedIds.includes(subscription.id)
  );

  const allVisibleSelected =
    paginatedSubscriptions.length > 0 &&
    paginatedSubscriptions.every((subscription) =>
      selectedIds.includes(subscription.id)
    );

  const selectedHasActive = selectedSubscriptions.some(
    (item) => item.status === "Active"
  );

  const selectedHasPaused = selectedSubscriptions.some(
    (item) => item.status === "Paused"
  );

  const selectedHasClosable = selectedSubscriptions.some((item) =>
    transitionActions[item.status].some(
      (action) => action.next === "Closed"
    )
  );

  const updateFilter = (callback: () => void) => {
    callback();
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (subscription: Subscription) => {
    setEditingId(subscription.id);

    setForm({
      customer: subscription.customer,
      plan: subscription.plan,
      startDate: subscription.startDate,
      expiryDate: subscription.expiryDate,
      quantity: String(subscription.quantity),
      paymentTerms: subscription.paymentTerms,
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

  const selectedPlan = plans.find((plan) => plan.name === form.plan);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const quantity = Number(form.quantity);

    if (!form.customer) {
      setError("Please select a customer.");
      return;
    }

    if (!selectedPlan) {
      setError("Please select a valid plan.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < selectedPlan.minQty) {
      setError(
        `Quantity must be a whole number and at least ${selectedPlan.minQty} for this plan.`
      );
      return;
    }

    if (!form.startDate) {
      setError("Please select a subscription start date.");
      return;
    }

    if (form.expiryDate && form.expiryDate < form.startDate) {
      setError("Expiry date cannot be earlier than the start date.");
      return;
    }

    const previous = subscriptions.find(
      (subscription) => subscription.id === editingId
    );

    const nextId =
      Math.max(0, ...subscriptions.map((subscription) => subscription.id)) + 1;

    const savedSubscription: Subscription = {
      id: editingId ?? nextId,
      number:
        previous?.number ??
        `SUB-2026-${String(nextId).padStart(4, "0")}`,
      customer: form.customer,
      plan: selectedPlan.name,
      planType: selectedPlan.type,
      status: previous?.status ?? "Draft",
      billingCycle: selectedPlan.interval,
      startDate: form.startDate,
      expiryDate: form.expiryDate,
      quantity,
      amount: selectedPlan.price * quantity,
      paymentTerms: form.paymentTerms,
    };

    if (editingId !== null) {
      setSubscriptions((previousItems) =>
        previousItems.map((subscription) =>
          subscription.id === editingId
            ? savedSubscription
            : subscription
        )
      );
    } else {
      setSubscriptions((previousItems) => [
        savedSubscription,
        ...previousItems,
      ]);
      setCurrentPage(1);
    }

    setSelectedIds([]);
    closeForm();
  };

  const transitionSubscription = (
    id: number,
    nextStatus: SubscriptionStatus
  ) => {
    const subscription = subscriptions.find((item) => item.id === id);

    if (!subscription) return;

    const allowed = transitionActions[subscription.status].some(
      (action) => action.next === nextStatus
    );

    if (!allowed) return;

    if (
      nextStatus === "Closed" &&
      !window.confirm(
        `Close subscription ${subscription.number}? This action cannot be undone in this demo.`
      )
    ) {
      return;
    }

    setSubscriptions((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item
      )
    );
  };

  const transitionSelected = (nextStatus: SubscriptionStatus) => {
    if (selectedIds.length === 0) return;

    if (
      nextStatus === "Closed" &&
      !window.confirm(
        `Close ${selectedIds.length} selected subscriptions?`
      )
    ) {
      return;
    }

    setSubscriptions((previous) =>
      previous.map((subscription) => {
        const isSelected = selectedIds.includes(subscription.id);

        if (!isSelected) return subscription;

        const allowed = transitionActions[subscription.status].some(
          (action) => action.next === nextStatus
        );

        return allowed
          ? { ...subscription, status: nextStatus }
          : subscription;
      })
    );

    setSelectedIds([]);
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((selectedId) => selectedId !== id)
        : [...previous, id]
    );
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((previous) =>
        previous.filter(
          (id) =>
            !paginatedSubscriptions.some(
              (subscription) => subscription.id === id
            )
        )
      );
    } else {
      setSelectedIds((previous) => [
        ...new Set([
          ...previous,
          ...paginatedSubscriptions.map((subscription) => subscription.id),
        ]),
      ]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Subscription Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage all subscriptions.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Add Subscription
        </button>
      </div>

      {/* KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Subscriptions"
          value="1,247"
          change="+8.3%"
          icon="up"
        />

        <MetricCard
          title="Active Subscriptions"
          value="1,089"
          change="+5.7%"
          icon="up"
        />

        <MetricCard
          title="Monthly Recurring Revenue"
          value="$124,580"
          change="+12.5%"
          icon="up"
        />

        <MetricCard
          title="Churn Rate"
          value="2.3%"
          change="-0.8%"
          icon="down"
          improvement={true}
        />
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <select
            value={statusFilter}
            onChange={(event) =>
              updateFilter(() => setStatusFilter(event.target.value))
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
          >
            <option value="All">Status: All</option>
            {Object.keys(statusStyles).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={planFilter}
            onChange={(event) =>
              updateFilter(() => setPlanFilter(event.target.value))
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
          >
            <option value="All">Plan Type: All</option>
            {["Starter", "Professional", "Enterprise", "Premium", "Add-on"].map(
              (type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              )
            )}
          </select>

          <select
            value={cycleFilter}
            onChange={(event) =>
              updateFilter(() => setCycleFilter(event.target.value))
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
          >
            <option value="All">Billing Cycle: All</option>
            <option value="Monthly">Monthly</option>
            <option value="Yearly">Yearly</option>
          </select>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3">
            <CalendarDays size={15} className="shrink-0 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                updateFilter(() => setFromDate(event.target.value))
              }
              aria-label="Filter start date from"
              className="min-w-0 w-full text-[10px] text-slate-600 outline-none"
            />
          </div>

          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) =>
                updateFilter(() => setSearch(event.target.value))
              }
              placeholder="Search customer / number..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>To:</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) =>
                updateFilter(() => setToDate(event.target.value))
              }
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-yellow-400"
            />
          </label>

          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("All");
              setPlanFilter("All");
              setCycleFilter("All");
              setFromDate("");
              setToDate("");
              setCurrentPage(1);
              setSelectedIds([]);
            }}
            className="text-[11px] font-semibold text-amber-700 hover:text-amber-800"
          >
            Clear filters
          </button>

          <span className="ml-auto text-[11px] text-slate-400">
            {filteredSubscriptions.length} results
          </span>
        </div>
      </section>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-xs font-semibold text-slate-700">
            {selectedIds.length} subscription(s) selected
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {selectedHasActive && (
              <button
                onClick={() => transitionSelected("Paused")}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Pause size={13} className="mr-1 inline" />
                Pause
              </button>
            )}

            {selectedHasPaused && (
              <button
                onClick={() => transitionSelected("Active")}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Play size={13} className="mr-1 inline" />
                Resume
              </button>
            )}

            {selectedHasClosable && (
              <button
                onClick={() => transitionSelected("Closed")}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50"
              >
                Close Selected
              </button>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Subscription Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all visible subscriptions"
                    className="h-4 w-4 accent-yellow-500"
                  />
                </th>
                <th className="px-3 py-4">Subscription</th>
                <th className="px-3 py-4">Customer</th>
                <th className="px-3 py-4">Plan</th>
                <th className="px-3 py-4">Status</th>
                <th className="px-3 py-4">Billing Cycle</th>
                <th className="px-3 py-4">Start Date</th>
                <th className="px-3 py-4">Amount</th>
                <th className="px-3 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedSubscriptions.map((subscription) => (
                <tr
                  key={subscription.id}
                  className="text-xs transition hover:bg-slate-50/70"
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(subscription.id)}
                      onChange={() => toggleSelected(subscription.id)}
                      aria-label={`Select ${subscription.number}`}
                      className="h-4 w-4 accent-yellow-500"
                    />
                  </td>

                  <td className="px-3 py-4">
                    <p className="font-semibold text-slate-800">
                      {subscription.number}
                    </p>
                  </td>

                  <td className="px-3 py-4">
                    <span className="font-medium text-slate-700">
                      {subscription.customer}
                    </span>
                  </td>

                  <td className="px-3 py-4 text-slate-500">
                    {subscription.plan}
                  </td>

                  <td className="px-3 py-4">
                    <StatusBadge status={subscription.status} />
                  </td>

                  <td className="px-3 py-4 text-slate-500">
                    {subscription.billingCycle}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-slate-500">
                    {formatDate(subscription.startDate)}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap font-semibold text-slate-700">
                    {currency(subscription.amount)}
                    <span className="ml-1 text-[9px] font-normal text-slate-400">
                      /{subscription.billingCycle === "Monthly" ? "mo" : "yr"}
                    </span>
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1">
                      {transitionActions[subscription.status].map((action) => {
                        const Icon = action.icon;

                        return (
                          <button
                            key={action.next}
                            onClick={() =>
                              transitionSubscription(
                                subscription.id,
                                action.next
                              )
                            }
                            title={action.label}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                          >
                            <Icon size={15} />
                          </button>
                        );
                      })}

                      {subscription.status !== "Closed" && (
                        <button
                          onClick={() => openEditForm(subscription)}
                          title="Edit subscription"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <Repeat
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm font-semibold text-slate-600">
                      No subscriptions found
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
            {filteredSubscriptions.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(
              currentPage * PAGE_SIZE,
              filteredSubscriptions.length
            )}{" "}
            of {filteredSubscriptions.length} subscriptions
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={currentPage === 1}
              aria-label="Previous page"
              className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => {
                    setCurrentPage(page);
                    setSelectedIds([]);
                  }}
                  className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${
                    currentPage === page
                      ? "bg-yellow-400 text-slate-900"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
              aria-label="Next page"
              className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Add/Edit Subscription Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null
                    ? "Edit Subscription"
                    : "Create Subscription"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Configure the customer, plan and subscription details.
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close subscription form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto p-6"
            >
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Customer *
                </label>
                <select
                  required
                  value={form.customer}
                  onChange={(event) =>
                    setForm({ ...form, customer: event.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Subscription Plan *
                </label>
                <select
                  required
                  value={form.plan}
                  onChange={(event) =>
                    setForm({ ...form, plan: event.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                >
                  {plans.map((plan) => (
                    <option key={plan.name} value={plan.name}>
                      {plan.name} — {currency(plan.price)} / {plan.interval}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlan && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4">
                  <div>
                    <p className="text-[10px] text-slate-400">
                      Billing Interval
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {selectedPlan.interval}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400">
                      Minimum Quantity
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {selectedPlan.minQty}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400">
                      Unit Price
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      {currency(selectedPlan.price)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400">
                      Total Price / Cycle
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      {currency(
                        selectedPlan.price *
                          Math.max(0, Number(form.quantity) || 0)
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Quantity *
                </label>
                <input
                  type="number"
                  min={selectedPlan?.minQty ?? 1}
                  step="1"
                  required
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({ ...form, quantity: event.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                />
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
                      setForm({ ...form, startDate: event.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    min={form.startDate || undefined}
                    value={form.expiryDate}
                    onChange={(event) =>
                      setForm({ ...form, expiryDate: event.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Payment Terms
                </label>
                <select
                  value={form.paymentTerms}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      paymentTerms: event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                >
                  <option>Due immediately</option>
                  <option>Net 15</option>
                  <option>Net 30</option>
                  <option>Net 45</option>
                </select>
              </div>

              <p className="rounded-lg bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-700">
                New subscriptions are created in Draft status. They must
                progress through the authorized lifecycle before becoming
                Active.
              </p>

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
                    : "Create Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
