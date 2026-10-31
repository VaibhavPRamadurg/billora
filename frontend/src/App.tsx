
import Products from "./pages/Products";
import Plans from "./pages/Plans";
import Customers from "./pages/Customers";
import Subscriptions from "./pages/Subscriptions";
import Quotations from "./pages/Quotations";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Discounts from "./pages/Discounts";
import Taxes from "./pages/Taxes";
import Staff from "./pages/Staff";
import SettingsPage from "./pages/Settings";
import Auth from "./pages/auth/Auth";
import CustomerPortal from "./pages/customer/CustomerPortal";
import { useState, type LucideIcon } from "react";
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  Users,
  Repeat,
  FileText,
  Receipt,
  CreditCard,
  Percent,
  Tags,
  BarChart3,
  UserCog,
  Settings as SettingsIcon,
  Bell,
  Search,
  ChevronDown,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  X,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type NavItem = {
  label: string;
  icon: LucideIcon;
};

const navigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Products", icon: Package },
  { label: "Plans", icon: CalendarDays },
  { label: "Customers", icon: Users },
  { label: "Subscriptions", icon: Repeat },
  { label: "Quotations", icon: FileText },
  { label: "Invoices", icon: Receipt },
  { label: "Payments", icon: CreditCard },
  { label: "Discounts", icon: Percent },
  { label: "Taxes", icon: Tags },
  { label: "Reports", icon: BarChart3 },
  { label: "Staff", icon: UserCog },
  { label: "Settings", icon: SettingsIcon },
];

const revenueData = [
  { month: "Jun", revenue: 38000 },
  { month: "Jul", revenue: 45000 },
  { month: "Aug", revenue: 42000 },
  { month: "Sep", revenue: 58000 },
  { month: "Oct", revenue: 68000 },
  { month: "Nov", revenue: 72000 },
  { month: "Dec", revenue: 92000 },
];

const subscriptionData = [
  { name: "Active", value: 1089, color: "#10B981" },
  { name: "Trial", value: 89, color: "#FACC15" },
  { name: "Past Due", value: 48, color: "#F97316" },
  { name: "Cancelled", value: 21, color: "#EF4444" },
];

const recentSubscriptions = [
  {
    customer: "TechCorp Solutions",
    plan: "Enterprise",
    status: "Active",
    startDate: "Oct 15, 2026",
    mrr: "$12,450",
    initials: "TC",
    color: "bg-blue-100 text-blue-700",
  },
  {
    customer: "DataFlow Analytics",
    plan: "Professional",
    status: "Active",
    startDate: "Nov 01, 2026",
    mrr: "$8,900",
    initials: "DA",
    color: "bg-violet-100 text-violet-700",
  },
  {
    customer: "InnovateLab",
    plan: "Starter",
    status: "Trial",
    startDate: "Nov 15, 2026",
    mrr: "$6,750",
    initials: "IL",
    color: "bg-amber-100 text-amber-700",
  },
  {
    customer: "CloudSync Inc.",
    plan: "Business",
    status: "Active",
    startDate: "Nov 20, 2026",
    mrr: "$4,200",
    initials: "CS",
    color: "bg-emerald-100 text-emerald-700",
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "bg-emerald-50 text-emerald-700",
    Trial: "bg-amber-50 text-amber-700",
    "Past Due": "bg-orange-50 text-orange-700",
    Cancelled: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function Sidebar({
  activePage,
  onNavigate,
  mobileOpen,
  onClose,
}: {
  activePage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[70px] shrink-0 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-lg font-extrabold text-slate-900">
              B
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Billora
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            Workspace
          </p>

          {navigation.map(({ label, icon: Icon }) => {
            const active = activePage === label;

            return (
              <button
                key={label}
                onClick={() => {
                  onNavigate(label);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-yellow-50 text-amber-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon
                  size={17}
                  strokeWidth={active ? 2.3 : 1.8}
                  className={active ? "text-amber-600" : "text-slate-400"}
                />
                <span>{label}</span>
                {label === "Invoices" && (
                  <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    5
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
              AD
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">
                Admin User
              </p>
              <p className="truncate text-[11px] text-slate-500">
                Administrator
              </p>
            </div>
            <ChevronDown size={15} className="text-slate-400" />
          </div>
        </div>
      </aside>
    </>
  );
}

function StatCard({
  title,
  value,
  change,
  positive = true,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string;
  change: string;
  positive?: boolean;
  icon: LucideIcon;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <div className={`rounded-lg p-2 ${iconColor}`}>
          <Icon size={17} />
        </div>
      </div>

      <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </h3>

      <div className="mt-2 flex items-center gap-1 text-[11px]">
        {positive ? (
          <ArrowUpRight size={14} className="text-emerald-600" />
        ) : (
          <ArrowDownRight size={14} className="text-red-500" />
        )}

        <span className={positive ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>
          {change}
        </span>
        <span className="text-slate-400">vs last month</span>
      </div>
    </div>
  );
}

function DashboardContent() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Welcome back, Admin!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening with your subscriptions.
          </p>
        </div>

        <button className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm sm:self-auto">
          <CalendarDays size={15} />
          Oct 1 – Oct 31, 2026
          <ChevronDown size={14} />
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Subscriptions"
          value="1,247"
          change="+8.3%"
          icon={Repeat}
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Active Subscriptions"
          value="1,089"
          change="+5.7%"
          icon={Users}
          iconColor="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value="$124,580"
          change="+12.5%"
          icon={CreditCard}
          iconColor="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Churn Rate"
          value="2.3%"
          change="-0.4%"
          icon={BarChart3}
          iconColor="bg-violet-50 text-violet-600"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Revenue Trend
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Monthly revenue overview
              </p>
            </div>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
              This year <ChevronDown className="ml-1 inline" size={13} />
            </button>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FACC15" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#FACC15" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#94A3B8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#EAB308"
                  strokeWidth={2.5}
                  fill="url(#revenueFill)"
                  activeDot={{ r: 5, fill: "#EAB308" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-slate-800">
              Subscriptions by Status
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Current subscription distribution
            </p>
          </div>

          <div className="relative h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={57}
                  outerRadius={83}
                  paddingAngle={3}
                  stroke="none"
                >
                  {subscriptionData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">1,247</span>
              <span className="text-[10px] text-slate-400">Total</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {subscriptionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[11px] text-slate-500">{item.name}</span>
                </div>
                <span className="text-xs font-semibold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Recent Subscriptions
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Latest customer subscription activity
            </p>
          </div>

          <button className="text-xs font-semibold text-amber-700 hover:text-amber-800">
            View all →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Customer</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">MRR</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {recentSubscriptions.map((item) => (
                <tr key={item.customer} className="text-xs hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold ${item.color}`}>
                        {item.initials}
                      </div>
                      <span className="font-semibold text-slate-700">
                        {item.customer}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">{item.plan}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">{item.startDate}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-700">{item.mrr}</td>
                  <td className="px-4 py-3.5">
                    <button aria-label={`More actions for ${item.customer}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Showing 1–4 of 1,247 subscriptions
        </div>
      </section>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mb-4 rounded-2xl bg-yellow-50 p-4 text-amber-600">
        <Package size={28} />
      </div>
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        This section will be implemented next, following the Billora design system.
      </p>
    </div>
  );
}

export default function App() {
  const [isDemoAuthenticated, setIsDemoAuthenticated] = useState(false);
  const [isCustomerPreview, setIsCustomerPreview] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
if (isCustomerPreview) {
    return (
      <CustomerPortal
        onLogout={() => setIsCustomerPreview(false)}
      />
    );
  }

if (!isDemoAuthenticated) {
  return (
    <Auth
      onLogin={() => setIsDemoAuthenticated(true)}
      onCustomerPreview={() => setIsCustomerPreview(true)}
    />
  );
}
  return (
    <div className="flex min-h-screen bg-[#F5F7FA] text-slate-800">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[70px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={21} />
            </button>

            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              <span>Workspace</span>
              <span>/</span>
              <span className="font-semibold text-slate-700">{activePage}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="relative hidden md:block">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                placeholder="Search anything..."
                className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <button
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <Bell size={19} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </button>

            <div className="flex cursor-pointer items-center gap-2 border-l border-slate-200 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                AD
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-800">Admin User</p>
                <p className="text-[10px] text-slate-400">Admin</p>
              </div>
              <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-7">
          <div className="mx-auto w-full max-w-[1600px]">
            {activePage === "Dashboard" ? (
              <DashboardContent />
            ) : activePage === "Products" ? (
              <Products />
            ) : activePage === "Plans" ? (
              <Plans />
            ) : activePage === "Customers" ?(
              <Customers />
            ) : activePage === "Subscriptions" ?(
              <Subscriptions />
            ) : activePage === "Quotations" ? (
              <Quotations />
            ) : activePage === "Invoices" ? (
              <Invoices />
            ) : activePage === "Payments" ? (
              <Payments />
            ) : activePage === "Reports" ? (
              <Reports />
            ) : activePage === "Discounts" ? (
              <Discounts />
            ) : activePage === "Taxes" ? (
              <Taxes />
            ) : activePage === "Staff" ? (
              <Staff />
            ) : activePage === "Settings" ? (
              <SettingsPage />
            ) : (
              <ComingSoon title={activePage} />
            )}
          </div>
        </div>

        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-[10px] text-slate-400">
          © 2026 Billora. Subscription management made simple.
        </footer>
      </main>
    </div>
  );
}