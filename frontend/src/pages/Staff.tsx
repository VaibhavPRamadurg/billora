
import { useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  Pencil,
  X,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  UserRound,
} from "lucide-react";

type StaffRole = "Admin" | "Staff";
type StaffStatus = "Active" | "Suspended";

type StaffMember = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  department: string;
  status: StaffStatus;
  joinedDate: string;
};

type StaffForm = {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  department: string;
};

const PAGE_SIZE = 6;

const initialStaff: StaffMember[] = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@billora.com",
    phone: "+1 555 0101",
    role: "Admin",
    department: "Administration",
    status: "Active",
    joinedDate: "2026-01-10",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah@billora.com",
    phone: "+1 555 0102",
    role: "Staff",
    department: "Billing",
    status: "Active",
    joinedDate: "2026-02-15",
  },
  {
    id: 3,
    name: "Michael Brown",
    email: "michael@billora.com",
    phone: "+1 555 0103",
    role: "Staff",
    department: "Sales",
    status: "Active",
    joinedDate: "2026-03-01",
  },
  {
    id: 4,
    name: "Emily Davis",
    email: "emily@billora.com",
    phone: "+1 555 0104",
    role: "Admin",
    department: "Administration",
    status: "Active",
    joinedDate: "2026-03-20",
  },
  {
    id: 5,
    name: "David Wilson",
    email: "david@billora.com",
    phone: "+1 555 0105",
    role: "Staff",
    department: "Support",
    status: "Suspended",
    joinedDate: "2026-04-12",
  },
  {
    id: 6,
    name: "Olivia Martin",
    email: "olivia@billora.com",
    phone: "+1 555 0106",
    role: "Staff",
    department: "Billing",
    status: "Active",
    joinedDate: "2026-05-05",
  },
  {
    id: 7,
    name: "James Taylor",
    email: "james@billora.com",
    phone: "+1 555 0107",
    role: "Staff",
    department: "Sales",
    status: "Active",
    joinedDate: "2026-06-18",
  },
  {
    id: 8,
    name: "Sophia Anderson",
    email: "sophia@billora.com",
    phone: "+1 555 0108",
    role: "Staff",
    department: "Support",
    status: "Active",
    joinedDate: "2026-07-22",
  },
];

const emptyForm: StaffForm = {
  name: "",
  email: "",
  phone: "",
  role: "Staff",
  department: "Billing",
};

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        role === "Admin"
          ? "bg-violet-50 text-violet-700"
          : "bg-blue-50 text-blue-700"
      }`}
    >
      {role === "Admin" ? (
        <ShieldCheck size={12} />
      ) : (
        <UserRound size={12} />
      )}
      {role}
    </span>
  );
}

function StaffStatusBadge({ status }: { status: StaffStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        status === "Active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
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
  icon: typeof Users;
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

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [error, setError] = useState("");

  const [notification, setNotification] = useState("");

  const filteredStaff = staff.filter((member) => {
    const query = search.toLowerCase().trim();

    const matchesSearch =
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" || member.status === statusFilter;

    const matchesRole =
      roleFilter === "All" || member.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStaff.length / PAGE_SIZE)
  );

  const paginatedStaff = filteredStaff.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeCount = staff.filter(
    (member) => member.status === "Active"
  ).length;

  const suspendedCount = staff.filter(
    (member) => member.status === "Suspended"
  ).length;

  const adminCount = staff.filter(
    (member) => member.role === "Admin"
  ).length;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (member: StaffMember) => {
    setEditingId(member.id);

    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      department: member.department,
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
    setNotification("");

    const normalizedEmail = form.email.trim().toLowerCase();

    if (!form.name.trim()) {
      setError("Please enter the staff member's name.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    const duplicateEmail = staff.some(
      (member) =>
        member.email.toLowerCase() === normalizedEmail &&
        member.id !== editingId
    );

    if (duplicateEmail) {
      setError("This email address is already registered.");
      return;
    }

    if (editingId !== null) {
      setStaff((previous) =>
        previous.map((member) =>
          member.id === editingId
            ? {
                ...member,
                name: form.name.trim(),
                email: normalizedEmail,
                phone: form.phone.trim(),
                role: form.role,
                department: form.department,
              }
            : member
        )
      );

      setNotification("Staff details updated successfully.");
    } else {
      const newMember: StaffMember = {
        id: Math.max(0, ...staff.map((member) => member.id)) + 1,
        name: form.name.trim(),
        email: normalizedEmail,
        phone: form.phone.trim(),
        role: form.role,
        department: form.department,
        status: "Active",
        joinedDate: new Date().toLocaleDateString("en-CA"),
      };

      setStaff((previous) => [newMember, ...previous]);
      setCurrentPage(1);

      setNotification(
        "Staff record created. Account credentials must be provisioned by the authentication service."
      );
    }

    closeForm();
  };

  const toggleStatus = (member: StaffMember) => {
    const nextStatus: StaffStatus =
      member.status === "Active" ? "Suspended" : "Active";

    const confirmed = window.confirm(
      `${nextStatus === "Suspended" ? "Suspend" : "Reactivate"} ${member.name}'s account?`
    );

    if (!confirmed) return;

    setStaff((previous) =>
      previous.map((item) =>
        item.id === member.id
          ? { ...item, status: nextStatus }
          : item
      )
    );

    setNotification(
      `${member.name}'s account has been marked ${nextStatus.toLowerCase()}.`
    );
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setRoleFilter("All");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage internal users, roles and account access.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Add Staff
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
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

      {/* Permission notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-600" />

        <div>
          <p className="text-xs font-semibold text-blue-800">
            Administrator access
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-blue-700">
            Staff account creation and role management are restricted
            to administrators. These permissions must also be verified
            by the backend API.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Staff"
          value={staff.length.toLocaleString()}
          description="Registered internal accounts"
          icon={Users}
          color="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Active Staff"
          value={activeCount.toLocaleString()}
          description="Accounts currently active"
          icon={UserCheck}
          color="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Administrators"
          value={adminCount.toLocaleString()}
          description="Accounts with admin role"
          icon={ShieldCheck}
          color="bg-violet-50 text-violet-600"
        />

        <MetricCard
          title="Suspended Accounts"
          value={suspendedCount.toLocaleString()}
          description="Accounts currently suspended"
          icon={UserX}
          color="bg-red-50 text-red-600"
        />
      </section>

      {/* Staff table */}
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
              placeholder="Search staff by name or email..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All roles</option>
              <option value="Admin">Admin</option>
              <option value="Staff">Staff</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
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
                <th className="px-5 py-4">Staff Member</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Department</th>
                <th className="px-4 py-4">Role</th>
                <th className="px-4 py-4">Joined Date</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedStaff.map((member, index) => (
                <tr
                  key={member.id}
                  className="text-xs transition hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          [
                            "bg-blue-100 text-blue-700",
                            "bg-violet-100 text-violet-700",
                            "bg-emerald-100 text-emerald-700",
                            "bg-amber-100 text-amber-700",
                            "bg-rose-100 text-rose-700",
                            "bg-sky-100 text-sky-700",
                          ][index % 6]
                        }`}
                      >
                        {getInitials(member.name)}
                      </div>

                      <span className="font-semibold text-slate-800">
                        {member.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {member.email}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {member.department}
                  </td>

                  <td className="px-4 py-4">
                    <RoleBadge role={member.role} />
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                    {formatDate(member.joinedDate)}
                  </td>

                  <td className="px-4 py-4">
                    <StaffStatusBadge status={member.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditForm(member)}
                        title="Edit staff details"
                        className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => toggleStatus(member)}
                        title={
                          member.status === "Active"
                            ? "Suspend account"
                            : "Reactivate account"
                        }
                        className="rounded-md p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                      >
                        {member.status === "Active" ? (
                          <UserX size={15} />
                        ) : (
                          <UserCheck size={15} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedStaff.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Users
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />

                    <p className="text-sm font-semibold text-slate-600">
                      No staff members found
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
            {filteredStaff.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(currentPage * PAGE_SIZE, filteredStaff.length)}{" "}
            of {filteredStaff.length} staff members
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

      {/* Add/Edit Staff Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null ? "Edit Staff Member" : "Add Staff Member"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Manage staff information and account role.
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close staff form"
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
                  Full Name *
                </label>

                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Enter full name"
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
                    placeholder="staff@example.com"
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
                    placeholder="Enter phone number"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Role *
                  </label>

                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        role: event.target.value as StaffRole,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Department
                  </label>

                  <select
                    value={form.department}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        department: event.target.value,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option>Administration</option>
                    <option>Billing</option>
                    <option>Sales</option>
                    <option>Support</option>
                    <option>Operations</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-[11px] leading-relaxed text-amber-800">
                  {editingId !== null
                    ? "Changing a role affects the account's intended access level. The backend must validate the acting administrator's permission."
                    : "This creates a staff record in the frontend demo. A real account invitation and password setup must be handled by the authentication service."}
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
                  className="rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-yellow-500"
                >
                  {editingId !== null ? "Save Changes" : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
