
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Download,
  CalendarDays,
  TrendingUp,
  Users,
  Wallet,
  AlertCircle,
  FileBarChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

type RevenueRecord = {
  month: string;
  invoiced: number;
  collected: number;
};

const revenueData: RevenueRecord[] = [
  { month: "Jan", invoiced: 42000, collected: 38000 },
  { month: "Feb", invoiced: 46000, collected: 43000 },
  { month: "Mar", invoiced: 51000, collected: 47000 },
  { month: "Apr", invoiced: 55000, collected: 51000 },
  { month: "May", invoiced: 59000, collected: 55000 },
  { month: "Jun", invoiced: 62000, collected: 58000 },
  { month: "Jul", invoiced: 67000, collected: 63000 },
  { month: "Aug", invoiced: 65000, collected: 61000 },
  { month: "Sep", invoiced: 76000, collected: 71000 },
  { month: "Oct", invoiced: 92000, collected: 84500 },
];

const subscriptionStatusData = [
  { name: "Active", value: 1089, color: "#10B981" },
  { name: "Trial", value: 89, color: "#FACC15" },
  { name: "Past Due", value: 48, color: "#F97316" },
  { name: "Cancelled", value: 21, color: "#EF4444" },
];

const invoiceAgingData = [
  { period: "0–30 Days", amount: 9400 },
  { period: "31–60 Days", amount: 5300 },
  { period: "61–90 Days", amount: 2500 },
  { period: "90+ Days", amount: 1250 },
];

const planRevenueData = [
  { plan: "Enterprise", revenue: 48500 },
  { plan: "Professional", revenue: 35600 },
  { plan: "Premium", revenue: 24900 },
  { plan: "Starter", revenue: 12800 },
  { plan: "Add-ons", revenue: 7800 },
];

function currency(value: number) {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function MetricCard({
  title,
  value,
  change,
  description,
  icon: Icon,
  iconColor,
  positive = true,
}: {
  title: string;
  value: string;
  change: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  positive?: boolean;
}) {
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <div className={`rounded-lg p-2 ${iconColor}`}>
          <Icon size={18} />
        </div>
      </div>

      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </h2>

      <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
        <TrendIcon
          size={14}
          className={positive ? "text-emerald-600" : "text-red-500"}
        />
        <span
          className={`font-semibold ${
            positive ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {change}
        </span>
        <span className="text-slate-400">{description}</span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Reports() {
  const [dateRange, setDateRange] = useState("6");

  const filteredRevenue =
    dateRange === "3"
      ? revenueData.slice(-3)
      : dateRange === "6"
        ? revenueData.slice(-6)
        : revenueData;

  const totalRevenue = filteredRevenue.reduce(
    (total, item) => total + item.collected,
    0
  );

  const totalInvoiced = filteredRevenue.reduce(
    (total, item) => total + item.invoiced,
    0
  );

  const overdueAmount = invoiceAgingData.reduce(
    (total, item) => total + item.amount,
    0
  );

  const totalSubscriptions = subscriptionStatusData.reduce(
    (total, item) => total + item.value,
    0
  );

  const activeSubscriptions =
    subscriptionStatusData.find((item) => item.name === "Active")?.value ?? 0;

  const collectionRate =
    totalInvoiced > 0
      ? (totalRevenue / totalInvoiced) * 100
      : 0;

  const handleExport = () => {
    const rows = [
      ["Month", "Invoiced Revenue", "Collected Revenue"],
      ...filteredRevenue.map((item) => [
        item.month,
        item.invoiced.toString(),
        item.collected.toString(),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "billora-revenue-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor revenue, subscriptions and payment performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <CalendarDays size={15} className="text-slate-400" />

            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="bg-transparent text-xs font-medium text-slate-600 outline-none"
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Year to date</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            className="flex h-10 items-center gap-2 rounded-lg bg-yellow-400 px-4 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Revenue"
          value={currency(totalRevenue)}
          change="+12.5%"
          description="vs previous period"
          icon={Wallet}
          iconColor="bg-emerald-50 text-emerald-600"
        />

        <MetricCard
          title="Active Subscriptions"
          value={activeSubscriptions.toLocaleString()}
          change="+5.7%"
          description="vs previous month"
          icon={Users}
          iconColor="bg-blue-50 text-blue-600"
        />

        <MetricCard
          title="Payments Collected"
          value={currency(totalRevenue)}
          change="+9.2%"
          description="vs previous period"
          icon={TrendingUp}
          iconColor="bg-violet-50 text-violet-600"
        />

        <MetricCard
          title="Overdue Amount"
          value={currency(overdueAmount)}
          change="-4.2%"
          description="vs previous period"
          icon={AlertCircle}
          iconColor="bg-red-50 text-red-600"
          positive={true}
        />
      </section>

      {/* Revenue Trend */}
      <ChartCard
        title="Revenue Overview"
        description="Compare invoiced revenue against successfully collected payments."
        action={
          <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
            Collection rate: {collectionRate.toFixed(1)}%
          </span>
        }
      >
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            Invoiced Revenue
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Collected Revenue
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filteredRevenue}
              margin={{ top: 10, right: 10, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="invoicedGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#FACC15"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="#FACC15"
                    stopOpacity={0.01}
                  />
                </linearGradient>

                <linearGradient
                  id="collectedGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#10B981"
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="95%"
                    stopColor="#10B981"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#F1F5F9"
                strokeDasharray="4 4"
                vertical={false}
              />

              <XAxis
                dataKey="month"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${value / 1000}k`}
              />

              <Tooltip
                formatter={(value) => [
                  currency(Number(value)),
                ]}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  fontSize: 12,
                }}
              />

              <Area
                type="monotone"
                dataKey="invoiced"
                name="Invoiced"
                stroke="#EAB308"
                strokeWidth={2.5}
                fill="url(#invoicedGradient)"
              />

              <Area
                type="monotone"
                dataKey="collected"
                name="Collected"
                stroke="#10B981"
                strokeWidth={2.5}
                fill="url(#collectedGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Subscription status and invoice aging */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard
          title="Subscription Distribution"
          description="Breakdown of subscriptions by current status."
        >
          <div className="relative h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  stroke="none"
                >
                  {subscriptionStatusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-900">
                {totalSubscriptions.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">
                Total
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {subscriptionStatusData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-slate-500">
                    {item.name}
                  </span>
                </div>

                <span className="text-xs font-semibold text-slate-800">
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Invoice Aging Report"
          description="Outstanding balances grouped by days overdue."
        >
          <div className="mb-4 rounded-lg bg-red-50 p-3">
            <p className="text-[10px] font-medium text-red-600">
              Total overdue amount
            </p>
            <p className="mt-1 text-xl font-bold text-red-700">
              {currency(overdueAmount)}
            </p>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={invoiceAgingData}
                margin={{ top: 10, right: 5, left: -15, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="#F1F5F9"
                  strokeDasharray="4 4"
                  vertical={false}
                />

                <XAxis
                  dataKey="period"
                  tick={{ fill: "#94A3B8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{ fill: "#94A3B8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />

                <Tooltip
                  formatter={(value) => [
                    currency(Number(value)),
                    "Outstanding",
                  ]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    fontSize: 12,
                  }}
                />

                <Bar
                  dataKey="amount"
                  name="Outstanding Amount"
                  fill="#F87171"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      {/* Plan revenue breakdown */}
      <ChartCard
        title="Revenue by Subscription Plan"
        description="Contribution of each plan to the demonstration revenue dataset."
      >
        <div className="h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={planRevenueData}
              layout="vertical"
              margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                stroke="#F1F5F9"
                strokeDasharray="4 4"
                horizontal={false}
              />

              <XAxis
                type="number"
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${value / 1000}k`}
              />

              <YAxis
                type="category"
                dataKey="plan"
                width={95}
                tick={{ fill: "#64748B", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                formatter={(value) => [
                  currency(Number(value)),
                  "Revenue",
                ]}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  fontSize: 12,
                }}
              />

              <Bar
                dataKey="revenue"
                fill="#FACC15"
                radius={[0, 5, 5, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Report footer */}
      <div className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <FileBarChart size={17} className="text-slate-400" />
          <p className="text-xs font-semibold text-slate-700">
            Revenue performance report
          </p>
        </div>

        <p className="text-[10px] text-slate-400">
          Showing {filteredRevenue.length} monthly records · Demo dataset
        </p>
      </div>

      <p className="text-[10px] text-slate-400">
        All figures and charts currently use demonstration data. The
        final reports will be generated using live subscription,
        invoice and payment data from the backend.
      </p>
    </div>
  );
}
