
import { useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  Filter,
  Pencil,
  X,
  Users,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  UserRound,
} from "lucide-react";

type CustomerStatus = "Active" | "Past Due" | "Inactive";

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  subscriptions: number;
  status: CustomerStatus;
};

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
};

const initialCustomers: Customer[] = [
  {
    id: 1,
    name: "TechCorp Solutions",
    email: "contact@techcorp.com",
    phone: "+1 555 0101",
    subscriptions: 5,
    status: "Active",
  },
  {
    id: 2,
    name: "DataFlow Analytics",
    email: "info@dataflow.com",
    phone: "+1 555 0102",
    subscriptions: 3,
    status: "Active",
  },
  {
    id: 3,
    name: "CloudSync Inc.",
    email: "hello@cloudsync.com",
    phone: "+1 555 0103",
    subscriptions: 2,
    status: "Active",
  },
  {
    id: 4,
    name: "InnovateLab",
    email: "team@innovatelab.com",
    phone: "+1 555 0104",
    subscriptions: 1,
    status: "Active",
  },
  {
    id: 5,
    name: "NextGen Systems",
    email: "contact@nextgen.com",
    phone: "+1 555 0105",
    subscriptions: 5,
    status: "Active",
  },
  {
    id: 6,
    name: "Digital Dynamics",
    email: "info@digitaldynamics.com",
    phone: "+1 555 0106",
    subscriptions: 0,
    status: "Past Due",
  },
  {
    id: 7,
    name: "FutureTech Labs",
    email: "hello@futuretech.com",
    phone: "+1 555 0107",
    subscriptions: 4,
    status: "Active",
  },
  {
    id: 8,
    name: "SmartData Group",
    email: "contact@smartdata.com",
    phone: "+1 555 0108",
    subscriptions: 1,
    status: "Inactive",
  },
];

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  status: "Active",
};

const PAGE_SIZE = 6;

function CustomerStatusBadge({
  status,
}: {
  status: CustomerStatus;
}) {
  const styles: Record<CustomerStatus, string> = {
    Active: "bg-emerald-50 text-emerald-700",
    "Past Due": "bg-red-50 text-red-600",
    Inactive: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>(
    initialCustomers
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [error, setError] = useState("");

  const filteredCustomers = customers.filter((customer) => {
    const query = search.toLowerCase().trim();

    const matchesSearch =
      customer.name.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" || customer.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / PAGE_SIZE)
  );

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeCount = customers.filter(
    (customer) => customer.status === "Active"
  ).length;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingId(customer.id);

    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
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

    const normalizedEmail = form.email.trim().toLowerCase();

    if (!form.name.trim()) {
      setError("Please enter the customer name.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    const duplicateEmail = customers.some(
      (customer) =>
        customer.email.toLowerCase() === normalizedEmail &&
        customer.id !== editingId
    );

    if (duplicateEmail) {
      setError("This email address already belongs to a customer.");
      return;
    }

    if (editingId !== null) {
      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === editingId
            ? {
                ...customer,
                name: form.name.trim(),
                email: normalizedEmail,
                phone: form.phone.trim(),
                status: form.status,
              }
            : customer
        )
      );
    } else {
      const newCustomer: Customer = {
        id: Date.now(),
        name: form.name.trim(),
        email: normalizedEmail,
        phone: form.phone.trim(),
        subscriptions: 0,
        status: "Active",
      };

      setCustomers((previous) => [newCustomer, ...previous]);
      setCurrentPage(1);
    }

    closeForm();
  };

  const toggleStatus = (customer: Customer) => {
    if (customer.status === "Past Due") return;

    setCustomers((previous) =>
      previous.map((item) =>
        item.id === customer.id
          ? {
              ...item,
              status:
                item.status === "Active" ? "Inactive" : "Active",
            }
          : item
      )
    );
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Customers
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your customers and their accounts.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      {/* Customer summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              Total Customers
            </p>
            <Users size={18} className="text-blue-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {customers.length.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              Active Customers
            </p>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {activeCount.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              Total Subscriptions
            </p>
            <Users size={18} className="text-amber-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {customers
              .reduce(
                (total, customer) => total + customer.subscriptions,
                0
              )
              .toLocaleString()}
          </p>
        </div>
      </div>

      {/* Customers table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Search customers..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />

            <select
              value={statusFilter}
              onChange={(event) => handleFilter(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Past Due">Past Due</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Customer</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Subscriptions</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedCustomers.map((customer, index) => (
                <tr
                  key={customer.id}
                  className="text-xs transition hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          [
                            "bg-blue-100 text-blue-700",
                            "bg-violet-100 text-violet-700",
                            "bg-sky-100 text-sky-700",
                            "bg-amber-100 text-amber-700",
                            "bg-emerald-100 text-emerald-700",
                            "bg-rose-100 text-rose-700",
                          ][index % 6]
                        }`}
                      >
                        {getInitials(customer.name)}
                      </div>

                      <span className="font-semibold text-slate-800">
                        {customer.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {customer.email}
                  </td>

                  <td className="px-4 py-4">
                    <span className="font-semibold text-slate-700">
                      {customer.subscriptions}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <CustomerStatusBadge status={customer.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(customer)}
                        title="Edit customer"
                        className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => toggleStatus(customer)}
                        disabled={customer.status === "Past Due"}
                        title={
                          customer.status === "Active"
                            ? "Deactivate customer"
                            : customer.status === "Inactive"
                              ? "Activate customer"
                              : "Past due status is managed through billing"
                        }
                        className="rounded-md p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <UserRound size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Users
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm font-semibold text-slate-600">
                      No customers found
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
            {filteredCustomers.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(currentPage * PAGE_SIZE, filteredCustomers.length)} of{" "}
            {filteredCustomers.length} customers
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
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
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

      {/* Add/Edit customer modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null ? "Edit Customer" : "Add Customer"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {editingId !== null
                    ? "Update customer account information."
                    : "Add a new customer to your records."}
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close customer form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Customer / Business Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. TechCorp Solutions"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    placeholder="customer@example.com"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
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
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                    placeholder="+1 555 0100"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                  />
                </div>
              </div>

              {editingId !== null && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Customer Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as CustomerStatus,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option value="Active">Active</option>
                    <option value="Past Due">Past Due</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    In the live system, past-due status should be reconciled
                    with invoice balances.
                  </p>
                </div>
              )}

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
                  {editingId !== null ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
