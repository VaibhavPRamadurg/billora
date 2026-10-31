
import { useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Repeat,
  FileText,
  Wallet,
  UserRound,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Pause,
  Play,
  Eye,
  ArrowUpRight,
  CreditCard,
  Building2,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

type PortalTab =
  | "Overview"
  | "My Subscriptions"
  | "Invoices"
  | "Payments"
  | "Profile";

type SubscriptionStatus = "Active" | "Paused" | "Closed";

type CustomerSubscription = {
  id: number;
  number: string;
  plan: string;
  products: string;
  status: SubscriptionStatus;
  billingCycle: string;
  amount: number;
  nextRenewal: string;
  canPause: boolean;
};

type CustomerInvoice = {
  id: number;
  number: string;
  issueDate: string;
  dueDate: string;
  subscription: string;
  total: number;
  paidAmount: number;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
};

type CustomerPayment = {
  id: number;
  reference: string;
  invoiceNumber: string;
  date: string;
  method: string;
  amount: number;
  status: "Successful";
};

type CustomerProfile = {
  name: string;
  email: string;
  company: string;
  phone: string;
  billingAddress: string;
};

type CustomerPortalProps = {
  onLogout: () => void;
};

const navigation: {
  label: PortalTab;
  icon: LucideIcon;
}[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "My Subscriptions", icon: Repeat },
  { label: "Invoices", icon: FileText },
  { label: "Payments", icon: Wallet },
  { label: "Profile", icon: UserRound },
];

const initialSubscriptions: CustomerSubscription[] = [
  {
    id: 1,
    number: "SUB-2026-0001",
    plan: "Enterprise Annual",
    products: "BrightCRM, Analytics Pro",
    status: "Active",
    billingCycle: "Yearly",
    amount: 12450,
    nextRenewal: "Dec 15, 2026",
    canPause: true,
  },
  {
    id: 2,
    number: "SUB-2026-0021",
    plan: "Professional Monthly",
    products: "Analytics Pro",
    status: "Active",
    billingCycle: "Monthly",
    amount: 149,
    nextRenewal: "Nov 15, 2026",
    canPause: true,
  },
  {
    id: 3,
    number: "SUB-2026-0035",
    plan: "Cloud Storage",
    products: "Cloud Storage Add-on",
    status: "Paused",
    billingCycle: "Monthly",
    amount: 20,
    nextRenewal: "Paused",
    canPause: true,
  },
];

const initialInvoices: CustomerInvoice[] = [
  {
    id: 1,
    number: "INV-2026-1001",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    subscription: "SUB-2026-0001",
    total: 12450,
    paidAmount: 12450,
    items: [
      {
        description: "BrightCRM Enterprise",
        quantity: 10,
        unitPrice: 995,
      },
      {
        description: "Analytics Pro",
        quantity: 5,
        unitPrice: 320,
      },
    ],
  },
  {
    id: 2,
    number: "INV-2026-1045",
    issueDate: "2026-10-15",
    dueDate: "2026-11-15",
    subscription: "SUB-2026-0021",
    total: 8900,
    paidAmount: 2000,
    items: [
      {
        description: "Professional Subscription",
        quantity: 1,
        unitPrice: 8900,
      },
    ],
  },
  {
    id: 3,
    number: "INV-2026-1062",
    issueDate: "2026-09-20",
    dueDate: "2026-10-20",
    subscription: "SUB-2026-0035",
    total: 2500,
    paidAmount: 0,
    items: [
      {
        description: "Cloud Storage Add-on",
        quantity: 1,
        unitPrice: 2500,
      },
    ],
  },
];

const initialPayments: CustomerPayment[] = [
  {
    id: 1,
    reference: "PAY-2026-0001",
    invoiceNumber: "INV-2026-1001",
    date: "2026-10-15",
    method: "Bank Transfer",
    amount: 12450,
    status: "Successful",
  },
  {
    id: 2,
    reference: "PAY-2026-0002",
    invoiceNumber: "INV-2026-1045",
    date: "2026-10-20",
    method: "UPI",
    amount: 2000,
    status: "Successful",
  },
];

const initialProfile: CustomerProfile = {
  name: "Alex Morgan",
  email: "alex@techcorp.com",
  company: "TechCorp Solutions",
  phone: "+1 555 0101",
  billingAddress: "123 Business Avenue, New York, USA",
};

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

function getTodayString() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function getBalance(invoice: CustomerInvoice) {
  return Math.max(0, invoice.total - invoice.paidAmount);
}

function getInvoiceStatus(invoice: CustomerInvoice) {
  const balance = getBalance(invoice);

  if (balance === 0) return "Paid";
  if (invoice.dueDate < getTodayString()) return "Overdue";
  if (invoice.paidAmount > 0) return "Partially Paid";

  return "Unpaid";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "bg-emerald-50 text-emerald-700",
    Paid: "bg-emerald-50 text-emerald-700",
    Successful: "bg-emerald-50 text-emerald-700",
    Paused: "bg-amber-50 text-amber-700",
    "Partially Paid": "bg-amber-50 text-amber-700",
    Overdue: "bg-red-50 text-red-600",
    Closed: "bg-slate-100 text-slate-500",
    Unpaid: "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
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

export default function CustomerPortal({
  onLogout,
}: CustomerPortalProps) {
  const [activeTab, setActiveTab] = useState<PortalTab>("Overview");

  const [subscriptions, setSubscriptions] = useState(
    initialSubscriptions
  );

  const [invoices] = useState(initialInvoices);
  const [payments] = useState(initialPayments);

  const [profile, setProfile] = useState(initialProfile);

  const [editingProfile, setEditingProfile] = useState(false);
  const [selectedInvoice, setSelectedInvoice] =
    useState<CustomerInvoice | null>(null);

  const [notification, setNotification] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileError, setProfileError] = useState("");

  const activeSubscriptions = subscriptions.filter(
    (item) => item.status === "Active"
  );

  const pausedSubscriptions = subscriptions.filter(
    (item) => item.status === "Paused"
  );

  const outstandingAmount = invoices.reduce(
    (total, invoice) => total + getBalance(invoice),
    0
  );

  const paidAmount = payments.reduce(
    (total, payment) => total + payment.amount,
    0
  );

  const nextRenewal = activeSubscriptions
    .map((item) => item.nextRenewal)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  const showNotification = (message: string) => {
    setNotification(message);
  };

  const changeTab = (tab: PortalTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setNotification("");
    setProfileError("");
    setSelectedInvoice(null);
  };

  // PAUSE / RESUME SUBSCRIPTION

  const handleSubscriptionToggle = (subscription: CustomerSubscription) => {
    if (!subscription.canPause || subscription.status === "Closed") {
      return;
    }

    const nextStatus =
      subscription.status === "Active" ? "Paused" : "Active";

    const confirmed = window.confirm(
      `${nextStatus === "Paused" ? "Pause" : "Resume"} ${subscription.number}?`
    );

    if (!confirmed) return;

    setSubscriptions((previous) =>
      previous.map((item) =>
        item.id === subscription.id
          ? { ...item, status: nextStatus }
          : item
      )
    );

    showNotification(
      `Demo: ${subscription.number} marked as ${nextStatus.toLowerCase()}. This change has not been saved to a server.`
    );
  };

  // PROFILE UPDATE

  const handleProfileSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");

    if (!profile.name.trim() || !profile.company.trim()) {
      setProfileError("Name and business name are required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      setProfileError("Please enter a valid email address.");
      return;
    }

    setEditingProfile(false);

    showNotification(
      "Profile updated in this frontend demo. Changes are not yet saved to the backend."
    );
  };

  // INVOICE PRINT

  const handlePrintInvoice = () => {
    window.print();
  };

  // SECTION: OVERVIEW

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Welcome back, {profile.name.split(" ")[0]}!
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Here's an overview of your subscriptions and billing activity.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
          <Building2 size={15} className="text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">
            {profile.company}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Subscriptions"
          value={String(activeSubscriptions.length)}
          description="Currently active plans"
          icon={Repeat}
          color="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Outstanding Balance"
          value={currency(outstandingAmount)}
          description="Balance across your invoices"
          icon={Wallet}
          color="bg-amber-50 text-amber-600"
        />

        <MetricCard
          title="Total Payments"
          value={currency(paidAmount)}
          description="Recorded successful payments"
          icon={CreditCard}
          color="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Paused Subscriptions"
          value={String(pausedSubscriptions.length)}
          description="Temporarily paused plans"
          icon={Pause}
          color="bg-violet-50 text-violet-600"
        />
      </section>

      {/* Renewal notice */}
      {nextRenewal && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-yellow-100 p-2 text-amber-700">
              <CalendarDays size={19} />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800">
                Your next renewal
              </p>

              <p className="mt-1 text-xs text-slate-600">
                Your upcoming subscription renewal is scheduled for{" "}
                <strong>{nextRenewal}</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={() => changeTab("My Subscriptions")}
            className="flex items-center gap-1 self-start text-xs font-bold text-amber-800 hover:text-amber-950 sm:self-center"
          >
            View subscriptions
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Recent subscriptions */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              My Subscriptions
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Your recently active plans.
            </p>
          </div>

          <button
            onClick={() => changeTab("My Subscriptions")}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            View all
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {subscriptions.slice(0, 3).map((subscription) => (
            <div
              key={subscription.id}
              className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
                  <PackageIcon />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {subscription.plan}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    {subscription.number}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-5 sm:justify-end">
                <div>
                  <p className="text-[10px] text-slate-400">
                    Billing
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {currency(subscription.amount)}/
                    {subscription.billingCycle === "Monthly" ? "mo" : "yr"}
                  </p>
                </div>

                <StatusBadge status={subscription.status} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent invoices */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Recent Invoices
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Your latest billing documents.
            </p>
          </div>

          <button
            onClick={() => changeTab("Invoices")}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            View all
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {invoices.slice(0, 3).map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-xs font-semibold text-blue-700">
                  {invoice.number}
                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  Issued {formatDate(invoice.issueDate)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-5">
                <p className="text-xs font-bold text-slate-800">
                  {currency(invoice.total)}
                </p>

                <StatusBadge status={getInvoiceStatus(invoice)} />

                <button
                  onClick={() => setSelectedInvoice(invoice)}
                  title="View invoice"
                  className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Eye size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  // SECTION: SUBSCRIPTIONS

  const renderSubscriptions = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          My Subscriptions
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          View and manage your subscribed plans.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="Total"
          value={String(subscriptions.length)}
          description="All your subscriptions"
          icon={Repeat}
          color="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Active"
          value={String(activeSubscriptions.length)}
          description="Currently running"
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Paused"
          value={String(pausedSubscriptions.length)}
          description="Temporarily inactive"
          icon={Pause}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-800">
            Subscription Details
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Subscription</th>
                <th className="px-4 py-4">Plan</th>
                <th className="px-4 py-4">Billing</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Next Renewal</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} className="text-xs">
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {subscription.number}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {subscription.plan}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {subscription.billingCycle}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {currency(subscription.amount)}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {subscription.nextRenewal}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={subscription.status} />
                  </td>

                  <td className="px-4 py-4">
                    {subscription.status !== "Closed" &&
                      subscription.canPause && (
                        <button
                          onClick={() =>
                            handleSubscriptionToggle(subscription)
                          }
                          title={
                            subscription.status === "Active"
                              ? "Request pause"
                              : "Resume subscription"
                          }
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-semibold ${
                            subscription.status === "Active"
                              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {subscription.status === "Active" ? (
                            <Pause size={13} />
                          ) : (
                            <Play size={13} />
                          )}

                          {subscription.status === "Active" ? "Pause" : "Resume"}
                        </button>
                      )}

                    {subscription.status === "Closed" && (
                      <span className="text-[10px] text-slate-400">
                        No actions available
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-semibold text-blue-800">
          About subscription management
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-blue-700">
          Pause and resume actions are demonstration interactions.
          Actual availability depends on the policies configured for
          each plan and must be validated by the server.
        </p>
      </div>
    </div>
  );

  // SECTION: INVOICES

  const renderInvoices = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          My Invoices
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Access your billing documents and payment balances.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="Total Invoiced"
          value={currency(
            invoices.reduce((total, item) => total + item.total, 0)
          )}
          description="All issued invoices"
          icon={FileText}
          color="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Amount Paid"
          value={currency(
            invoices.reduce((total, item) => total + item.paidAmount, 0)
          )}
          description="Successfully allocated"
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Balance Due"
          value={currency(outstandingAmount)}
          description="Remaining amount"
          icon={Wallet}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-800">
            Invoice History
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Invoice Number</th>
                <th className="px-4 py-4">Issue Date</th>
                <th className="px-4 py-4">Due Date</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-4 py-4">Balance</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="text-xs">
                  <td className="px-5 py-4 font-semibold text-blue-700">
                    {invoice.number}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {formatDate(invoice.issueDate)}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {formatDate(invoice.dueDate)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {currency(invoice.total)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {currency(getBalance(invoice))}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={getInvoiceStatus(invoice)} />
                  </td>

                  <td className="px-4 py-4">
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-2 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  // SECTION: PAYMENTS

  const renderPayments = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Payment History
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Review payments recorded against your invoices.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          title="Total Payments"
          value={String(payments.length)}
          description="Recorded transactions"
          icon={CreditCard}
          color="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Total Paid"
          value={currency(paidAmount)}
          description="Successful payment allocations"
          icon={Wallet}
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-800">
            Transaction History
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Reference</th>
                <th className="px-4 py-4">Invoice</th>
                <th className="px-4 py-4">Payment Date</th>
                <th className="px-4 py-4">Method</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id} className="text-xs">
                  <td className="px-5 py-4 font-semibold text-blue-700">
                    {payment.reference}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {payment.invoiceNumber}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {formatDate(payment.date)}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {payment.method}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {currency(payment.amount)}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={payment.status} />
                  </td>
                </tr>
              ))}

              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center text-xs text-slate-400"
                  >
                    No payment records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  // SECTION: PROFILE

  const renderProfile = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          My Profile
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Manage your contact and business information.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-white">
            {profile.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0].toUpperCase())
              .join("")}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              {profile.name}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {profile.company}
            </p>

            <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
              Customer Account
            </span>
          </div>

          <button
            onClick={() => {
              setEditingProfile(!editingProfile);
              setProfileError("");
              setNotification("");
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:ml-auto"
          >
            {editingProfile ? "Cancel Editing" : "Edit Profile"}
          </button>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Full Name
              </label>

              <div className="relative">
                <UserRound
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  required
                  disabled={!editingProfile}
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({ ...profile, name: event.target.value })
                  }
                  className={`h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 disabled:bg-slate-50 disabled:text-slate-500`}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Email Address
              </label>

              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  required
                  type="email"
                  disabled={!editingProfile}
                  value={profile.email}
                  onChange={(event) =>
                    setProfile({ ...profile, email: event.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Business Name
              </label>

              <div className="relative">
                <Building2
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  required
                  disabled={!editingProfile}
                  value={profile.company}
                  onChange={(event) =>
                    setProfile({ ...profile, company: event.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Phone Number
              </label>

              <div className="relative">
                <Phone
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  disabled={!editingProfile}
                  value={profile.phone}
                  onChange={(event) =>
                    setProfile({ ...profile, phone: event.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Billing Address
            </label>

            <div className="relative">
              <MapPin
                size={15}
                className="absolute left-3 top-3 text-slate-400"
              />

              <textarea
                rows={3}
                disabled={!editingProfile}
                value={profile.billingAddress}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    billingAddress: event.target.value,
                  })
                }
                className="w-full resize-none rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          {profileError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {profileError}
            </p>
          )}

          {editingProfile && (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-yellow-500"
              >
                Save Profile
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );

  // MAIN CONTENT

  const renderActiveContent = () => {
    switch (activeTab) {
      case "Overview":
        return renderOverview();

      case "My Subscriptions":
        return renderSubscriptions();

      case "Invoices":
        return renderInvoices();

      case "Payments":
        return renderPayments();

      case "Profile":
        return renderProfile();

      default:
        return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }

            .customer-invoice-print,
            .customer-invoice-print * {
              visibility: visible !important;
            }

            .customer-invoice-print {
              position: absolute !important;
              inset: 0 !important;
              max-height: none !important;
              width: 100% !important;
              overflow: visible !important;
              box-shadow: none !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="flex min-h-screen">
        {/* DESKTOP SIDEBAR */}
        <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex h-[72px] items-center gap-3 border-b border-slate-100 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-xl font-extrabold text-slate-900">
              B
            </div>

            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Billora
            </span>
          </div>

          <div className="px-5 pb-3 pt-7">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Customer Workspace
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.label;

              return (
                <button
                  key={item.label}
                  onClick={() => changeTab(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                    active
                      ? "bg-yellow-50 text-amber-800"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      active ? "text-amber-600" : "text-slate-400"
                    }
                  />

                  <span className="text-xs font-semibold">
                    {item.label}
                  </span>

                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                AM
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">
                  {profile.name}
                </p>
                <p className="truncate text-[10px] text-slate-400">
                  Customer
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* MAIN COLUMN */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* TOP HEADER */}
          <header className="no-print sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle customer navigation"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div>
                <p className="text-[10px] text-slate-400">
                  Customer Workspace
                </p>

                <h1 className="text-sm font-bold text-slate-900">
                  {activeTab}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-slate-800">
                  {profile.company}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Customer Account
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                {profile.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0].toUpperCase())
                  .join("")}
              </div>

              <button
                onClick={onLogout}
                title="Sign out"
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 lg:hidden"
              >
                <LogOut size={17} />
              </button>
            </div>
          </header>

          {/* MOBILE NAV */}
          {mobileMenuOpen && (
            <div className="no-print absolute left-0 right-0 top-[72px] z-40 border-b border-slate-200 bg-white p-3 shadow-lg lg:hidden">
              {navigation.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    onClick={() => changeTab(item.label)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-xs font-semibold ${
                      activeTab === item.label
                        ? "bg-yellow-50 text-amber-800"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={17} />
                    {item.label}
                  </button>
                );
              })}

              <button
                onClick={onLogout}
                className="mt-2 flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-xs font-semibold text-red-600"
              >
                <LogOut size={17} />
                Sign Out
              </button>
            </div>
          )}

          {/* PAGE BODY */}
          <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
            {notification && (
              <div className="no-print flex items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs leading-relaxed text-blue-700">
                  {notification}
                </p>

                <button
                  onClick={() => setNotification("")}
                  aria-label="Dismiss notification"
                  className="shrink-0 text-blue-500 hover:text-blue-800"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Demo account banner */}
            <div className="no-print flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-blue-600" />
                <p className="text-[11px] text-blue-800">
                  <strong>Customer portal preview</strong>
                  <span className="hidden sm:inline">
                    {" "}— displaying sample customer records.
                  </span>
                </p>
              </div>

              <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-blue-700">
                DEMO
              </span>
            </div>

            {renderActiveContent()}
          </main>

          <footer className="no-print border-t border-slate-200 bg-white px-6 py-4">
            <p className="text-[10px] text-slate-400">
              © 2026 Billora. Subscription management made simple.
            </p>
          </footer>
        </div>
      </div>

      {/* INVOICE DETAILS MODAL */}
      {selectedInvoice && (
        <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="customer-invoice-print flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="no-print flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Invoice Details
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedInvoice.number}
                </p>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                aria-label="Close invoice details"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400 text-xl font-extrabold text-slate-900">
                    B
                  </div>
                  <span className="text-xl font-extrabold text-slate-900">
                    Billora
                  </span>
                </div>

                <div className="sm:text-right">
                  <h3 className="text-2xl font-bold text-slate-900">
                    INVOICE
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-blue-700">
                    {selectedInvoice.number}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={getInvoiceStatus(selectedInvoice)} />
                  </div>
                </div>
              </div>

              <div className="my-6 grid grid-cols-1 gap-5 border-y border-slate-200 py-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Bill To
                  </p>

                  <p className="text-sm font-bold text-slate-800">
                    {profile.company}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {profile.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {profile.email}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {profile.billingAddress}
                  </p>
                </div>

                <div className="space-y-3 sm:text-right">
                  <div className="flex justify-between gap-3 sm:justify-end">
                    <span className="text-xs text-slate-400">
                      Invoice Date
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {formatDate(selectedInvoice.issueDate)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 sm:justify-end">
                    <span className="text-xs text-slate-400">
                      Due Date
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {formatDate(selectedInvoice.dueDate)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 sm:justify-end">
                    <span className="text-xs text-slate-400">
                      Subscription
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {selectedInvoice.subscription}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-3">Description</th>
                      <th className="px-3 py-3">Qty</th>
                      <th className="px-3 py-3">Unit Price</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.items.map((item, index) => (
                      <tr key={index} className="text-xs">
                        <td className="px-3 py-4 font-medium text-slate-700">
                          {item.description}
                        </td>

                        <td className="px-3 py-4 text-slate-500">
                          {item.quantity}
                        </td>

                        <td className="px-3 py-4 text-slate-500">
                          {currency(item.unitPrice)}
                        </td>

                        <td className="px-3 py-4 text-right font-semibold text-slate-700">
                          {currency(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto mt-6 w-full space-y-3 sm:w-64">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Invoice Total</span>
                  <span className="font-semibold text-slate-800">
                    {currency(selectedInvoice.total)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-semibold text-emerald-600">
                    {currency(selectedInvoice.paidAmount)}
                  </span>
                </div>

                <div className="flex justify-between rounded-lg bg-slate-50 p-3">
                  <span className="text-xs font-bold text-slate-800">
                    Balance Due
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {currency(getBalance(selectedInvoice))}
                  </span>
                </div>
              </div>

              <p className="mt-8 border-t border-slate-200 pt-4 text-[10px] text-slate-400">
                This is a demonstration invoice. Payment processing is
                not performed from this portal.
              </p>
            </div>

            <div className="no-print flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>

              <button
                onClick={handlePrintInvoice}
                className="rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageIcon() {
  return <Repeat size={19} />;
}
