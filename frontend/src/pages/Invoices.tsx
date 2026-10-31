
import { useMemo, useState } from "react";
import {
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Send,
  Printer,
  Wallet,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Receipt,
} from "lucide-react";

type InvoiceStatus = "Draft" | "Confirmed" | "Cancelled";

type InvoiceItem = {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

type Invoice = {
  id: number;
  number: string;
  customer: string;
  email: string;
  address: string;
  subscription: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: InvoiceStatus;
  sent: boolean;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
};

type DisplayStatus =
  | "Draft"
  | "Confirmed"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

const PAGE_SIZE = 6;

const initialInvoices: Invoice[] = [
  {
    id: 1,
    number: "INV-2026-1001",
    customer: "TechCorp Solutions",
    email: "contact@techcorp.com",
    address: "123 Business Avenue, New York, USA",
    subscription: "SUB-2026-0001",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    currency: "USD",
    status: "Confirmed",
    sent: true,
    items: [
      {
        id: 1,
        description: "BrightCRM Enterprise",
        quantity: 10,
        unitPrice: 995,
        taxRate: 10,
      },
      {
        id: 2,
        description: "Analytics Pro",
        quantity: 5,
        unitPrice: 310,
        taxRate: 10,
      },
    ],
    subtotal: 11500,
    tax: 950,
    total: 12450,
    paidAmount: 12450,
  },
  {
    id: 2,
    number: "INV-2026-1002",
    customer: "DataFlow Analytics",
    email: "info@dataflow.com",
    address: "45 Data Street, California, USA",
    subscription: "SUB-2026-0002",
    issueDate: "2026-10-15",
    dueDate: "2026-11-15",
    currency: "USD",
    status: "Confirmed",
    sent: true,
    items: [
      {
        id: 1,
        description: "BrightCRM Professional",
        quantity: 3,
        unitPrice: 900,
        taxRate: 10,
      },
      {
        id: 2,
        description: "Cloud Storage",
        quantity: 5,
        unitPrice: 1120,
        taxRate: 10,
      },
    ],
    subtotal: 8300,
    tax: 600,
    total: 8900,
    paidAmount: 0,
  },
  {
    id: 3,
    number: "INV-2026-1003",
    customer: "InnovateLab",
    email: "team@innovatelab.com",
    address: "78 Innovation Road, Texas, USA",
    subscription: "SUB-2026-0004",
    issueDate: "2026-10-10",
    dueDate: "2026-10-20",
    currency: "USD",
    status: "Confirmed",
    sent: true,
    items: [
      {
        id: 1,
        description: "Analytics Pro",
        quantity: 5,
        unitPrice: 1050,
        taxRate: 10,
      },
    ],
    subtotal: 5250,
    tax: 1500,
    total: 6750,
    paidAmount: 2000,
  },
  {
    id: 4,
    number: "INV-2026-1004",
    customer: "CloudSync Inc.",
    email: "hello@cloudsync.com",
    address: "90 Cloud Boulevard, Seattle, USA",
    subscription: "SUB-2026-0003",
    issueDate: "2026-10-05",
    dueDate: "2026-10-25",
    currency: "USD",
    status: "Confirmed",
    sent: false,
    items: [
      {
        id: 1,
        description: "Premium Annual Subscription",
        quantity: 1,
        unitPrice: 3800,
        taxRate: 10,
      },
    ],
    subtotal: 3800,
    tax: 400,
    total: 4200,
    paidAmount: 0,
  },
  {
    id: 5,
    number: "INV-2026-1005",
    customer: "NextGen Systems",
    email: "contact@nextgen.com",
    address: "21 Technology Park, Boston, USA",
    subscription: "SUB-2026-0005",
    issueDate: "2026-10-25",
    dueDate: "2026-11-05",
    currency: "USD",
    status: "Draft",
    sent: false,
    items: [
      {
        id: 1,
        description: "Professional Monthly Plan",
        quantity: 5,
        unitPrice: 900,
        taxRate: 10,
      },
    ],
    subtotal: 4500,
    tax: 450,
    total: 4950,
    paidAmount: 0,
  },
  {
    id: 6,
    number: "INV-2026-1006",
    customer: "Digital Dynamics",
    email: "info@digitaldynamics.com",
    address: "16 Digital Lane, Chicago, USA",
    subscription: "SUB-2026-0006",
    issueDate: "2026-10-12",
    dueDate: "2026-10-27",
    currency: "USD",
    status: "Cancelled",
    sent: false,
    items: [
      {
        id: 1,
        description: "Starter Monthly Plan",
        quantity: 2,
        unitPrice: 1250,
        taxRate: 10,
      },
    ],
    subtotal: 2500,
    tax: 250,
    total: 2750,
    paidAmount: 0,
  },
  {
    id: 7,
    number: "INV-2026-1007",
    customer: "FutureTech Labs",
    email: "hello@futuretech.com",
    address: "55 Future Street, Austin, USA",
    subscription: "SUB-2026-0007",
    issueDate: "2026-10-29",
    dueDate: "2026-11-10",
    currency: "USD",
    status: "Confirmed",
    sent: false,
    items: [
      {
        id: 1,
        description: "Enterprise Annual Plan",
        quantity: 5,
        unitPrice: 1090,
        taxRate: 10,
      },
    ],
    subtotal: 5450,
    tax: 545,
    total: 5995,
    paidAmount: 0,
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

function getBalance(invoice: Invoice) {
  if (invoice.status === "Cancelled") return 0;

  return Math.max(0, invoice.total - invoice.paidAmount);
}

function getDisplayStatus(invoice: Invoice): DisplayStatus {
  if (invoice.status === "Cancelled") return "Cancelled";
  if (invoice.status === "Draft") return "Draft";

  const balance = getBalance(invoice);

  if (balance <= 0) return "Paid";

  if (invoice.dueDate < getTodayString()) return "Overdue";

  if (invoice.paidAmount > 0) return "Partially Paid";

  return "Confirmed";
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
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  const styles: Record<DisplayStatus, string> = {
    Draft: "bg-slate-100 text-slate-600",
    Confirmed: "bg-blue-50 text-blue-700",
    "Partially Paid": "bg-amber-50 text-amber-700",
    Paid: "bg-emerald-50 text-emerald-700",
    Overdue: "bg-red-50 text-red-600",
    Cancelled: "bg-slate-100 text-slate-400",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[status]}`}
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
  iconColor,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Receipt;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <div className={`rounded-lg p-2 ${iconColor}`}>
          <Icon size={18} />
        </div>
      </div>

      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </h2>

      <p className="mt-2 text-[11px] text-slate-400">{description}</p>
    </div>
  );
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
    null
  );
  const [notification, setNotification] = useState("");

  const today = getTodayString();

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

  const totalBilled = invoices
    .filter((invoice) => invoice.status !== "Cancelled")
    .reduce((total, invoice) => total + invoice.total, 0);

  const totalCollected = invoices
    .filter((invoice) => invoice.status !== "Cancelled")
    .reduce((total, invoice) => total + invoice.paidAmount, 0);

  const totalOutstanding = invoices
    .filter(
      (invoice) =>
        invoice.status === "Confirmed" && getBalance(invoice) > 0
    )
    .reduce((total, invoice) => total + getBalance(invoice), 0);

  const totalOverdue = invoices
    .filter(
      (invoice) =>
        invoice.status === "Confirmed" &&
        invoice.dueDate < today &&
        getBalance(invoice) > 0
    )
    .reduce((total, invoice) => total + getBalance(invoice), 0);

  const filteredInvoices = invoices.filter((invoice) => {
    const query = search.toLowerCase().trim();

    const matchesSearch =
      invoice.number.toLowerCase().includes(query) ||
      invoice.customer.toLowerCase().includes(query) ||
      invoice.subscription.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" ||
      getDisplayStatus(invoice) === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInvoices.length / PAGE_SIZE)
  );

  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const updateInvoice = (
    id: number,
    updater: (invoice: Invoice) => Invoice
  ) => {
    setInvoices((previous) =>
      previous.map((invoice) =>
        invoice.id === id ? updater(invoice) : invoice
      )
    );
  };

  const confirmInvoice = (invoice: Invoice) => {
    if (invoice.status !== "Draft") return;

    updateInvoice(invoice.id, (current) => ({
      ...current,
      status: "Confirmed",
    }));

    setNotification(`${invoice.number} confirmed successfully.`);
  };

  const cancelInvoice = (invoice: Invoice) => {
    if (invoice.status === "Cancelled" || invoice.paidAmount > 0) {
      setNotification(
        "This invoice cannot be cancelled because it has already received a payment."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to cancel ${invoice.number}?`
    );

    if (!confirmed) return;

    updateInvoice(invoice.id, (current) => ({
      ...current,
      status: "Cancelled",
    }));

    setNotification(`${invoice.number} cancelled.`);
  };

  const sendInvoice = (invoice: Invoice) => {
    if (invoice.status !== "Confirmed") return;

    updateInvoice(invoice.id, (current) => ({
      ...current,
      sent: true,
    }));

    setNotification(
      `Demo: ${invoice.number} marked as sent to ${invoice.email}. No actual email was sent.`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const closeDetails = () => {
    setSelectedInvoiceId(null);
  };

  const clearNotification = () => {
    setNotification("");
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredSummary = useMemo(
    () => ({
      count: filteredInvoices.length,
      paid: filteredInvoices.filter(
        (invoice) => getDisplayStatus(invoice) === "Paid"
      ).length,
      overdue: filteredInvoices.filter(
        (invoice) => getDisplayStatus(invoice) === "Overdue"
      ).length,
    }),
    [filteredInvoices]
  );

  return (
    <div className="space-y-6">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }

            .invoice-print-area,
            .invoice-print-area * {
              visibility: visible !important;
            }

            .invoice-print-area {
              position: absolute !important;
              inset: 0 !important;
              width: 100% !important;
              max-width: none !important;
              max-height: none !important;
              overflow: visible !important;
              box-shadow: none !important;
              border: none !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage invoices generated from customer subscriptions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <Receipt size={15} className="text-blue-600" />
          <span className="text-[11px] font-medium text-blue-700">
            Automatic billing enabled
          </span>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-700">{notification}</p>
          <button
            onClick={clearNotification}
            aria-label="Dismiss notification"
            className="text-blue-500 hover:text-blue-800"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Billed"
          value={currency(totalBilled)}
          description={`${invoices.filter((invoice) => invoice.status !== "Cancelled").length} invoices generated`}
          icon={Receipt}
          iconColor="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Total Collected"
          value={currency(totalCollected)}
          description={`${filteredSummary.paid} paid invoices in current view`}
          icon={Wallet}
          iconColor="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Outstanding"
          value={currency(totalOutstanding)}
          description="Confirmed invoices awaiting payment"
          icon={Clock}
          iconColor="bg-amber-50 text-amber-600"
        />

        <MetricCard
          title="Overdue Amount"
          value={currency(totalOverdue)}
          description={`${filteredSummary.overdue} overdue invoices in current view`}
          icon={AlertCircle}
          iconColor="bg-red-50 text-red-600"
        />
      </section>

      {/* Invoice table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              All Invoices
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              View and manage customer billing records.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="Search invoice / customer..."
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 sm:w-60"
              />
            </div>

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
                  "Draft",
                  "Confirmed",
                  "Partially Paid",
                  "Paid",
                  "Overdue",
                  "Cancelled",
                ] as DisplayStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Invoice Number</th>
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Issue Date</th>
                <th className="px-4 py-4">Due Date</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-4 py-4">Balance</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedInvoices.map((invoice) => {
                const status = getDisplayStatus(invoice);
                const balance = getBalance(invoice);

                return (
                  <tr
                    key={invoice.id}
                    className="text-xs transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedInvoiceId(invoice.id)}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {invoice.number}
                      </button>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {invoice.subscription}
                      </p>
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-700">
                      {invoice.customer}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                      {formatDate(invoice.issueDate)}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                      {formatDate(invoice.dueDate)}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-700">
                      {currency(invoice.total)}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-700">
                      {currency(balance)}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={status} />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setSelectedInvoiceId(invoice.id)
                          }
                          title="View invoice"
                          className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Eye size={15} />
                        </button>

                        {invoice.status === "Draft" && (
                          <button
                            onClick={() => confirmInvoice(invoice)}
                            title="Confirm invoice"
                            className="rounded-md p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}

                        {invoice.status === "Confirmed" && (
                          <button
                            onClick={() => sendInvoice(invoice)}
                            title={invoice.sent ? "Send again (demo)" : "Send invoice (demo)"}
                            className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Send size={15} />
                          </button>
                        )}

                        {invoice.status !== "Cancelled" &&
                          invoice.paidAmount === 0 && (
                            <button
                              onClick={() => cancelInvoice(invoice)}
                              title="Cancel invoice"
                              className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Receipt
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm font-semibold text-slate-600">
                      No invoices found
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
            {filteredInvoices.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(
              currentPage * PAGE_SIZE,
              filteredInvoices.length
            )}{" "}
            of {filteredInvoices.length} invoices
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
                  onClick={() => setCurrentPage(page)}
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

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="invoice-print-area flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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
                onClick={closeDetails}
                aria-label="Close invoice details"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400 text-lg font-extrabold text-slate-900">
                      B
                    </div>
                    <span className="text-xl font-bold text-slate-900">
                      Billora
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Subscription Management System
                  </p>
                </div>

                <div className="sm:text-right">
                  <h3 className="text-2xl font-bold text-slate-900">
                    INVOICE
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-blue-700">
                    {selectedInvoice.number}
                  </p>
                  <div className="mt-2">
                    <StatusBadge
                      status={getDisplayStatus(selectedInvoice)}
                    />
                  </div>
                </div>
              </div>

              <div className="my-6 grid grid-cols-1 gap-5 border-y border-slate-200 py-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Bill To
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {selectedInvoice.customer}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedInvoice.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedInvoice.address}
                  </p>
                </div>

                <div className="sm:text-right">
                  <div className="mb-3 flex justify-between gap-4 sm:justify-end">
                    <span className="text-xs text-slate-400">
                      Invoice Date
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {formatDate(selectedInvoice.issueDate)}
                    </span>
                  </div>

                  <div className="mb-3 flex justify-between gap-4 sm:justify-end">
                    <span className="text-xs text-slate-400">
                      Due Date
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {formatDate(selectedInvoice.dueDate)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 sm:justify-end">
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
                <table className="w-full min-w-[450px] text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-3">Description</th>
                      <th className="px-3 py-3">Qty</th>
                      <th className="px-3 py-3">Unit Price</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.items.map((item) => (
                      <tr key={item.id} className="text-xs">
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

              <div className="ml-auto mt-6 w-full space-y-3 sm:w-72">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-700">
                    {currency(selectedInvoice.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-semibold text-slate-700">
                    {currency(selectedInvoice.tax)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
                  <span className="font-bold text-slate-800">
                    Invoice Total
                  </span>
                  <span className="text-lg font-bold text-slate-900">
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

              <div className="mt-8 border-t border-slate-200 pt-4">
                <p className="text-[10px] leading-relaxed text-slate-400">
                  This invoice is a demonstration record for the Billora
                  Subscription Management System. Payment collection is
                  not performed from this screen.
                </p>
              </div>
            </div>

            <div className="no-print flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
              {selectedInvoice.status === "Draft" && (
                <>
                  <button
                    onClick={() => cancelInvoice(selectedInvoice)}
                    className="rounded-lg border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Cancel Invoice
                  </button>

                  <button
                    onClick={() => {
                      confirmInvoice(selectedInvoice);
                    }}
                    className="flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-yellow-500"
                  >
                    <CheckCircle2 size={14} />
                    Confirm Invoice
                  </button>
                </>
              )}

              {selectedInvoice.status === "Confirmed" && (
                <>
                  <button
                    onClick={() => cancelInvoice(selectedInvoice)}
                    className="rounded-lg border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Cancel Invoice
                  </button>

                  <button
                    onClick={() => sendInvoice(selectedInvoice)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Send size={14} />
                    {selectedInvoice.sent ? "Send Again" : "Send Invoice"}
                  </button>
                </>
              )}

              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                <Printer size={14} />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
