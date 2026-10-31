
import { useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  Plus,
  X,
  Wallet,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Building2,
  Smartphone,
  Receipt,
} from "lucide-react";

type PaymentMethod =
  | "Bank Transfer"
  | "Credit Card"
  | "UPI"
  | "Cash"
  | "Other";

type InvoiceStatus = "Confirmed" | "Draft" | "Cancelled";

type InvoiceRecord = {
  id: number;
  number: string;
  customer: string;
  total: number;
  paidAmount: number;
  dueDate: string;
  status: InvoiceStatus;
};

type Payment = {
  id: number;
  reference: string;
  invoiceNumber: string;
  customer: string;
  method: PaymentMethod;
  amount: number;
  paymentDate: string;
  note: string;
  status: "Successful";
};

type PaymentForm = {
  invoiceId: string;
  method: PaymentMethod;
  amount: string;
  paymentDate: string;
  note: string;
};

const PAGE_SIZE = 6;

const initialInvoices: InvoiceRecord[] = [
  {
    id: 1,
    number: "INV-2026-1001",
    customer: "TechCorp Solutions",
    total: 12450,
    paidAmount: 12450,
    dueDate: "2026-10-15",
    status: "Confirmed",
  },
  {
    id: 2,
    number: "INV-2026-1002",
    customer: "DataFlow Analytics",
    total: 8900,
    paidAmount: 0,
    dueDate: "2026-11-15",
    status: "Confirmed",
  },
  {
    id: 3,
    number: "INV-2026-1003",
    customer: "InnovateLab",
    total: 6750,
    paidAmount: 2000,
    dueDate: "2026-10-20",
    status: "Confirmed",
  },
  {
    id: 4,
    number: "INV-2026-1004",
    customer: "CloudSync Inc.",
    total: 4200,
    paidAmount: 0,
    dueDate: "2026-10-25",
    status: "Confirmed",
  },
  {
    id: 5,
    number: "INV-2026-1005",
    customer: "NextGen Systems",
    total: 4950,
    paidAmount: 0,
    dueDate: "2026-11-05",
    status: "Draft",
  },
  {
    id: 6,
    number: "INV-2026-1006",
    customer: "Digital Dynamics",
    total: 2750,
    paidAmount: 0,
    dueDate: "2026-10-27",
    status: "Cancelled",
  },
  {
    id: 7,
    number: "INV-2026-1007",
    customer: "FutureTech Labs",
    total: 5995,
    paidAmount: 0,
    dueDate: "2026-11-10",
    status: "Confirmed",
  },
];

const initialPayments: Payment[] = [
  {
    id: 1,
    reference: "PAY-2026-0001",
    invoiceNumber: "INV-2026-1001",
    customer: "TechCorp Solutions",
    method: "Bank Transfer",
    amount: 12450,
    paymentDate: "2026-10-15",
    note: "Full invoice settlement",
    status: "Successful",
  },
  {
    id: 2,
    reference: "PAY-2026-0002",
    invoiceNumber: "INV-2026-1003",
    customer: "InnovateLab",
    method: "UPI",
    amount: 2000,
    paymentDate: "2026-10-20",
    note: "First partial payment",
    status: "Successful",
  },
];

const emptyForm: PaymentForm = {
  invoiceId: "",
  method: "Bank Transfer",
  amount: "",
  paymentDate: "2026-10-31",
  note: "",
};

const paymentMethods: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "Credit Card", label: "Credit Card" },
  { value: "UPI", label: "UPI" },
  { value: "Cash", label: "Cash" },
  { value: "Other", label: "Other" },
];

function getTodayString() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
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

function getBalance(invoice: InvoiceRecord) {
  if (invoice.status === "Cancelled") return 0;

  return Math.max(0, invoice.total - invoice.paidAmount);
}

function getInvoicePaymentStatus(invoice: InvoiceRecord) {
  if (invoice.status === "Cancelled") return "Cancelled";

  const balance = getBalance(invoice);

  if (balance <= 0) return "Paid";
  if (invoice.paidAmount > 0) return "Partially Paid";
  if (invoice.dueDate < getTodayString()) return "Overdue";

  return "Unpaid";
}

function PaymentStatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    Successful: "bg-emerald-50 text-emerald-700",
    Paid: "bg-emerald-50 text-emerald-700",
    Unpaid: "bg-slate-100 text-slate-600",
    "Partially Paid": "bg-amber-50 text-amber-700",
    Overdue: "bg-red-50 text-red-600",
    Cancelled: "bg-slate-100 text-slate-400",
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

function getMethodIcon(method: PaymentMethod): LucideIcon {
  switch (method) {
    case "Bank Transfer":
      return Building2;
    case "Credit Card":
      return CreditCard;
    case "UPI":
      return Smartphone;
    case "Cash":
      return Banknote;
    default:
      return Wallet;
  }
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
  icon: LucideIcon;
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

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(
    null
  );

  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState("");

  const today = getTodayString();

  const totalCollected = payments
    .filter((payment) => payment.status === "Successful")
    .reduce((total, payment) => total + payment.amount, 0);

  const outstandingInvoices = invoices.filter(
    (invoice) =>
      invoice.status === "Confirmed" && getBalance(invoice) > 0
  );

  const totalOutstanding = outstandingInvoices.reduce(
    (total, invoice) => total + getBalance(invoice),
    0
  );

  const overdueInvoices = outstandingInvoices.filter(
    (invoice) => invoice.dueDate < today
  );

  const totalOverdue = overdueInvoices.reduce(
    (total, invoice) => total + getBalance(invoice),
    0
  );

  const filteredPayments = payments.filter((payment) => {
    const query = search.toLowerCase().trim();

    const matchesSearch =
      payment.reference.toLowerCase().includes(query) ||
      payment.invoiceNumber.toLowerCase().includes(query) ||
      payment.customer.toLowerCase().includes(query);

    const matchesMethod =
      methodFilter === "All" || payment.method === methodFilter;

    return matchesSearch && matchesMethod;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / PAGE_SIZE)
  );

  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selectedInvoice = invoices.find(
    (invoice) => String(invoice.id) === form.invoiceId
  );

  const selectedBalance = selectedInvoice
    ? getBalance(selectedInvoice)
    : 0;

  const openForm = () => {
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotification("");

    const invoice = invoices.find(
      (item) => String(item.id) === form.invoiceId
    );

    const amount = Number(form.amount);

    if (!invoice) {
      setError("Please select an invoice.");
      return;
    }

    if (invoice.status !== "Confirmed") {
      setError(
        "Payments can only be allocated to confirmed invoices."
      );
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }

    const amountInCents = Math.round(amount * 100);
    const balanceInCents = Math.round(getBalance(invoice) * 100);

    if (amountInCents > balanceInCents) {
      setError(
        `Payment exceeds the remaining balance of ${currency(getBalance(invoice))}.`
      );
      return;
    }

    if (!form.paymentDate) {
      setError("Please select the payment date.");
      return;
    }

    if (form.paymentDate > today) {
      setError("Payment date cannot be in the future.");
      return;
    }

    const nextId =
      Math.max(0, ...payments.map((payment) => payment.id)) + 1;

    const payment: Payment = {
      id: nextId,
      reference: `PAY-2026-${String(nextId).padStart(4, "0")}`,
      invoiceNumber: invoice.number,
      customer: invoice.customer,
      method: form.method,
      amount: amountInCents / 100,
      paymentDate: form.paymentDate,
      note: form.note.trim(),
      status: "Successful",
    };

    setPayments((previous) => [payment, ...previous]);

    setInvoices((previous) =>
      previous.map((item) =>
        item.id === invoice.id
          ? {
              ...item,
              paidAmount:
                item.paidAmount + amountInCents / 100,
            }
          : item
      )
    );

    setCurrentPage(1);
    setNotification(
      `Payment ${payment.reference} recorded successfully.`
    );

    closeForm();
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleMethodFilter = (value: string) => {
    setMethodFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Payments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track payments, invoice allocations and outstanding balances.
          </p>
        </div>

        <button
          onClick={openForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Record Payment
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium text-emerald-700">
            <CheckCircle2 size={15} className="mr-2 inline" />
            {notification}
          </p>

          <button
            onClick={() => setNotification("")}
            aria-label="Dismiss notification"
            className="text-emerald-600"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Collected"
          value={currency(totalCollected)}
          description="Successfully recorded payments"
          icon={Wallet}
          iconColor="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Payments Recorded"
          value={payments.length.toLocaleString()}
          description="Total payment transactions"
          icon={CreditCard}
          iconColor="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Outstanding Balance"
          value={currency(totalOutstanding)}
          description={`${outstandingInvoices.length} confirmed invoices unpaid`}
          icon={Clock}
          iconColor="bg-amber-50 text-amber-600"
        />

        <MetricCard
          title="Overdue Amount"
          value={currency(totalOverdue)}
          description={`${overdueInvoices.length} overdue invoices`}
          icon={AlertCircle}
          iconColor="bg-red-50 text-red-600"
        />
      </section>

      {/* Invoice balance summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Outstanding Invoices
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Confirmed invoices awaiting payment.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {outstandingInvoices.length} outstanding
          </span>
        </div>

        <div className="space-y-3">
          {outstandingInvoices.slice(0, 3).map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-col justify-between gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {invoice.number}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {invoice.customer}
                </p>
              </div>

              <div className="flex items-center gap-5">
                <div>
                  <p className="text-[10px] text-slate-400">
                    Due Date
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {formatDate(invoice.dueDate)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400">
                    Balance
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-800">
                    {currency(getBalance(invoice))}
                  </p>
                </div>

                <PaymentStatusBadge
                  status={getInvoicePaymentStatus(invoice)}
                />
              </div>
            </div>
          ))}

          {outstandingInvoices.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">
              No outstanding invoices.
            </p>
          )}
        </div>
      </section>

      {/* Payment history */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Payment History
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              All recorded customer transactions.
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
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Search payments..."
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 sm:w-60"
              />
            </div>

            <select
              value={methodFilter}
              onChange={(event) =>
                handleMethodFilter(event.target.value)
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All methods</option>
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Payment Reference</th>
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Invoice</th>
                <th className="px-4 py-4">Payment Method</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedPayments.map((payment) => {
                const MethodIcon = getMethodIcon(payment.method);

                return (
                  <tr
                    key={payment.id}
                    className="text-xs transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-blue-700">
                        {payment.reference}
                      </p>
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-700">
                      {payment.customer}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {payment.invoiceNumber}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-slate-100 p-1.5 text-slate-500">
                          <MethodIcon size={14} />
                        </div>
                        <span className="text-slate-600">
                          {payment.method}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                      {formatDate(payment.paymentDate)}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-800">
                      {currency(payment.amount)}
                    </td>

                    <td className="px-4 py-4">
                      <PaymentStatusBadge status={payment.status} />
                    </td>

                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        title="View payment details"
                        className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Wallet
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />

                    <p className="text-sm font-semibold text-slate-600">
                      No payments found
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Try changing your search or payment method filter.
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
            {filteredPayments.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(
              currentPage * PAGE_SIZE,
              filteredPayments.length
            )}{" "}
            of {filteredPayments.length} payments
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
              className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Record Payment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Record Payment
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Record a manual payment against an invoice.
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close payment form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto p-6"
            >
              {/* Invoice selection */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Select Invoice *
                </label>

                <select
                  required
                  value={form.invoiceId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      invoiceId: event.target.value,
                      amount: "",
                    })
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                >
                  <option value="">Choose an invoice</option>

                  {invoices
                    .filter(
                      (invoice) =>
                        invoice.status === "Confirmed" &&
                        getBalance(invoice) > 0
                    )
                    .map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.number} — {invoice.customer}
                      </option>
                    ))}
                </select>
              </div>

              {/* Selected invoice balance */}
              {selectedInvoice && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div>
                    <p className="text-[10px] text-blue-500">
                      Invoice Total
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {currency(selectedInvoice.total)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-blue-500">
                      Amount Already Paid
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-700">
                      {currency(selectedInvoice.paidAmount)}
                    </p>
                  </div>

                  <div className="col-span-2 border-t border-blue-100 pt-3">
                    <p className="text-[10px] font-medium text-blue-600">
                      Remaining Balance
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {currency(selectedBalance)}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment amount */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Payment Amount *
                </label>

                <div className="flex h-11 items-center rounded-lg border border-slate-200 focus-within:border-yellow-400">
                  <span className="px-3 text-sm text-slate-400">$</span>

                  <input
                    required
                    type="number"
                    min="0.01"
                    max={selectedBalance || undefined}
                    step="0.01"
                    disabled={!selectedInvoice}
                    value={form.amount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        amount: event.target.value,
                      })
                    }
                    placeholder="Enter amount"
                    className="h-full min-w-0 flex-1 rounded-r-lg pr-3 text-sm outline-none disabled:bg-slate-50"
                  />
                </div>

                {selectedInvoice && selectedBalance > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        amount: selectedBalance.toFixed(2),
                      })
                    }
                    className="mt-2 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Pay full remaining balance
                  </button>
                )}
              </div>

              {/* Method */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Payment Method *
                </label>

                <select
                  value={form.method}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      method: event.target.value as PaymentMethod,
                    })
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Date */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Payment Date *
                </label>

                <input
                  required
                  type="date"
                  max={today}
                  value={form.paymentDate}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      paymentDate: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Payment Note
                </label>

                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      note: event.target.value,
                    })
                  }
                  placeholder="Enter transaction reference or additional notes..."
                  className="w-full resize-none rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-yellow-400"
                />
              </div>

              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-[11px] leading-relaxed text-amber-800">
                  <strong>Demo payment:</strong> This records a simulated
                  manual payment in the frontend. It does not charge a
                  card, contact a bank or transfer actual funds.
                </p>
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
                  disabled={!selectedInvoice}
                  className="rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Payment Details
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedPayment.reference}
                </p>
              </div>

              <button
                onClick={() => setSelectedPayment(null)}
                aria-label="Close payment details"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-xl bg-emerald-50 p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={25} />
                </div>

                <p className="text-xs font-medium text-emerald-700">
                  Payment Recorded
                </p>

                <h3 className="mt-2 text-3xl font-bold text-slate-900">
                  {currency(selectedPayment.amount)}
                </h3>

                <p className="mt-2 text-[10px] text-emerald-700">
                  Simulated / Manual Payment
                </p>
              </div>

              <div className="space-y-4">
                {[
                  ["Payment Reference", selectedPayment.reference],
                  ["Customer", selectedPayment.customer],
                  ["Invoice Number", selectedPayment.invoiceNumber],
                  ["Payment Method", selectedPayment.method],
                  ["Payment Date", formatDate(selectedPayment.paymentDate)],
                  ["Status", selectedPayment.status],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3"
                  >
                    <span className="text-xs text-slate-400">
                      {label}
                    </span>
                    <span className="text-right text-xs font-semibold text-slate-800">
                      {value}
                    </span>
                  </div>
                ))}

                <div>
                  <p className="text-xs text-slate-400">
                    Payment Note
                  </p>
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    {selectedPayment.note || "No additional notes."}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPayment(null)}
                className="w-full rounded-lg border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        All payment records displayed here are demonstration data.
        Actual payment verification, allocation transactions and
        idempotency must be handled by the backend.
      </p>
    </div>
  );
}
