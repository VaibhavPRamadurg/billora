
import { useState, type ReactNode } from "react";
import {
  Building2,
  CreditCard,
  Receipt,
  Bell,
  ShieldCheck,
  Globe,
  Save,
  RotateCcw,
  CheckCircle2,
  Settings as SettingsIcon,
  Mail,
  Phone,
  LockKeyhole,
} from "lucide-react";

type SettingsTab =
  | "General"
  | "Billing"
  | "Invoices"
  | "Notifications"
  | "Security";

type AppSettings = {
  general: {
    companyName: string;
    supportEmail: string;
    phone: string;
    website: string;
    currency: string;
    timezone: string;
  };

  billing: {
    billingCycle: string;
    paymentDueDays: string;
    gracePeriod: string;
    autoRenew: boolean;
    retryFailedPayments: boolean;
    allowPause: boolean;
  };

  invoices: {
    prefix: string;
    nextNumber: string;
    dueDays: string;
    footer: string;
    taxInclusive: boolean;
    showAddress: boolean;
  };

  notifications: {
    invoiceCreated: boolean;
    paymentReceived: boolean;
    paymentFailed: boolean;
    subscriptionRenewal: boolean;
    subscriptionCancelled: boolean;
    weeklyReport: boolean;
    recipientEmail: string;
  };

  security: {
    sessionTimeout: string;
    passwordExpiry: string;
    requireTwoFactor: boolean;
    newLoginAlert: boolean;
  };
};

const initialSettings: AppSettings = {
  general: {
    companyName: "Billora",
    supportEmail: "support@billora.com",
    phone: "+91 98765 43210",
    website: "https://billora.com",
    currency: "USD",
    timezone: "UTC",
  },

  billing: {
    billingCycle: "Monthly",
    paymentDueDays: "15",
    gracePeriod: "5",
    autoRenew: true,
    retryFailedPayments: true,
    allowPause: true,
  },

  invoices: {
    prefix: "INV",
    nextNumber: "1008",
    dueDays: "15",
    footer: "Thank you for your business!",
    taxInclusive: false,
    showAddress: true,
  },

  notifications: {
    invoiceCreated: true,
    paymentReceived: true,
    paymentFailed: true,
    subscriptionRenewal: true,
    subscriptionCancelled: false,
    weeklyReport: false,
    recipientEmail: "admin@billora.com",
  },

  security: {
    sessionTimeout: "30",
    passwordExpiry: "90",
    requireTwoFactor: false,
    newLoginAlert: true,
  },
};

const tabs: {
  label: SettingsTab;
  description: string;
  icon: typeof Building2;
}[] = [
  {
    label: "General",
    description: "Company information",
    icon: Building2,
  },
  {
    label: "Billing",
    description: "Billing preferences",
    icon: CreditCard,
  },
  {
    label: "Invoices",
    description: "Invoice configuration",
    icon: Receipt,
  },
  {
    label: "Notifications",
    description: "Email and alerts",
    icon: Bell,
  },
  {
    label: "Security",
    description: "Account security",
    icon: ShieldCheck,
  },
];

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100";

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 border-b border-slate-100 pb-4">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function FormField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-slate-700">
        {label}
      </label>

      {children}

      {description && (
        <p className="mt-1.5 text-[10px] text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800">
          {title}
        </span>

        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
          {description}
        </span>
      </span>

      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />

        <span
          className={`h-5 w-9 rounded-full transition-colors ${
            checked ? "bg-yellow-400" : "bg-slate-300"
          }`}
        />

        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] =
    useState<SettingsTab>("General");

  const [settings, setSettings] =
    useState<AppSettings>(initialSettings);

  const [savedSettings, setSavedSettings] =
    useState<AppSettings>(initialSettings);

  const [notification, setNotification] = useState("");

  // GENERAL SETTINGS

  const updateGeneral = (
    field: keyof AppSettings["general"],
    value: string
  ) => {
    setSettings((previous) => ({
      ...previous,
      general: {
        ...previous.general,
        [field]: value,
      },
    }));
  };

  // BILLING SETTINGS

  const updateBilling = (
    field: "billingCycle" | "paymentDueDays" | "gracePeriod",
    value: string
  ) => {
    setSettings((previous) => ({
      ...previous,
      billing: {
        ...previous.billing,
        [field]: value,
      },
    }));
  };

  const updateBillingToggle = (
    field: "autoRenew" | "retryFailedPayments" | "allowPause",
    checked: boolean
  ) => {
    setSettings((previous) => ({
      ...previous,
      billing: {
        ...previous.billing,
        [field]: checked,
      },
    }));
  };

  // INVOICE SETTINGS

  const updateInvoices = (
    field: "prefix" | "nextNumber" | "dueDays" | "footer",
    value: string
  ) => {
    setSettings((previous) => ({
      ...previous,
      invoices: {
        ...previous.invoices,
        [field]: value,
      },
    }));
  };

  const updateInvoiceToggle = (
    field: "taxInclusive" | "showAddress",
    checked: boolean
  ) => {
    setSettings((previous) => ({
      ...previous,
      invoices: {
        ...previous.invoices,
        [field]: checked,
      },
    }));
  };

  // NOTIFICATION SETTINGS

  type NotificationToggleField = Exclude<
    keyof AppSettings["notifications"],
    "recipientEmail"
  >;

  const updateNotificationToggle = (
    field: NotificationToggleField,
    checked: boolean
  ) => {
    setSettings((previous) => ({
      ...previous,
      notifications: {
        ...previous.notifications,
        [field]: checked,
      },
    }));
  };

  const updateNotificationEmail = (value: string) => {
    setSettings((previous) => ({
      ...previous,
      notifications: {
        ...previous.notifications,
        recipientEmail: value,
      },
    }));
  };

  // SECURITY SETTINGS

  const updateSecurity = (
    field: "sessionTimeout" | "passwordExpiry",
    value: string
  ) => {
    setSettings((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        [field]: value,
      },
    }));
  };

  const updateSecurityToggle = (
    field: "requireTwoFactor" | "newLoginAlert",
    checked: boolean
  ) => {
    setSettings((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        [field]: checked,
      },
    }));
  };

  // SAVE SETTINGS

  const handleSave = () => {
    const dueDays = Number(settings.billing.paymentDueDays);
    const gracePeriod = Number(settings.billing.gracePeriod);
    const invoiceDueDays = Number(settings.invoices.dueDays);
    const nextNumber = Number(settings.invoices.nextNumber);
    const sessionTimeout = Number(settings.security.sessionTimeout);
    const passwordExpiry = Number(settings.security.passwordExpiry);

    if (!settings.general.companyName.trim()) {
      setNotification("Company name cannot be empty.");
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        settings.general.supportEmail.trim()
      )
    ) {
      setNotification("Enter a valid company support email.");
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        settings.notifications.recipientEmail.trim()
      )
    ) {
      setNotification("Enter a valid notification recipient email.");
      return;
    }

    if (
      !Number.isInteger(dueDays) ||
      dueDays < 1 ||
      !Number.isInteger(gracePeriod) ||
      gracePeriod < 0 ||
      !Number.isInteger(invoiceDueDays) ||
      invoiceDueDays < 1 ||
      !Number.isInteger(nextNumber) ||
      nextNumber < 1
    ) {
      setNotification(
        "Check your billing and invoice numeric settings."
      );
      return;
    }

    if (!settings.invoices.prefix.trim()) {
      setNotification("Invoice prefix cannot be empty.");
      return;
    }

    if (
      !Number.isInteger(sessionTimeout) ||
      sessionTimeout < 5 ||
      !Number.isInteger(passwordExpiry) ||
      passwordExpiry < 1
    ) {
      setNotification("Check your security settings.");
      return;
    }

    setSavedSettings({ ...settings });
    setNotification("Settings saved in this frontend session.");
  };

  // RESET UNSAVED CHANGES

  const handleReset = () => {
    setSettings({ ...savedSettings });
    setNotification("Unsaved changes have been reset.");
  };

  // GENERAL SECTION

  const renderGeneral = () => (
    <div>
      <SectionHeading
        title="General Information"
        description="Manage the basic information associated with your Billora workspace."
      />

      <div className="mb-6 flex items-center gap-4 rounded-xl bg-slate-50 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-yellow-400 text-2xl font-extrabold text-slate-900">
          B
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">
            Company Profile
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            This information identifies your business across the application.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label="Company Name">
          <input
            value={settings.general.companyName}
            onChange={(event) =>
              updateGeneral("companyName", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Support Email">
          <div className="relative">
            <Mail
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="email"
              value={settings.general.supportEmail}
              onChange={(event) =>
                updateGeneral("supportEmail", event.target.value)
              }
              className={`${inputClass} pl-9`}
            />
          </div>
        </FormField>

        <FormField label="Contact Phone">
          <div className="relative">
            <Phone
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={settings.general.phone}
              onChange={(event) =>
                updateGeneral("phone", event.target.value)
              }
              className={`${inputClass} pl-9`}
            />
          </div>
        </FormField>

        <FormField label="Company Website">
          <div className="relative">
            <Globe
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="url"
              value={settings.general.website}
              onChange={(event) =>
                updateGeneral("website", event.target.value)
              }
              className={`${inputClass} pl-9`}
            />
          </div>
        </FormField>

        <FormField
          label="Default Currency"
          description="Used as the default currency when creating new billing records."
        >
          <select
            value={settings.general.currency}
            onChange={(event) =>
              updateGeneral("currency", event.target.value)
            }
            className={inputClass}
          >
            <option value="USD">USD — US Dollar</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="AED">AED — UAE Dirham</option>
          </select>
        </FormField>

        <FormField label="Timezone">
          <select
            value={settings.general.timezone}
            onChange={(event) =>
              updateGeneral("timezone", event.target.value)
            }
            className={inputClass}
          >
            <option value="UTC">UTC</option>
            <option value="Asia/Kolkata">
              Asia/Kolkata (IST)
            </option>
            <option value="America/New_York">
              America/New_York
            </option>
            <option value="Europe/London">
              Europe/London
            </option>
            <option value="Asia/Dubai">
              Asia/Dubai
            </option>
            <option value="Asia/Singapore">
              Asia/Singapore
            </option>
          </select>
        </FormField>
      </div>
    </div>
  );

  // BILLING SECTION

  const renderBilling = () => (
    <div>
      <SectionHeading
        title="Billing Preferences"
        description="Configure default billing behavior and recurring subscription policies."
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Default Billing Cycle"
          description="Applied when creating a new subscription unless a plan specifies otherwise."
        >
          <select
            value={settings.billing.billingCycle}
            onChange={(event) =>
              updateBilling("billingCycle", event.target.value)
            }
            className={inputClass}
          >
            <option value="Monthly">Monthly</option>
            <option value="Yearly">Yearly</option>
          </select>
        </FormField>

        <FormField
          label="Payment Due Period (Days)"
          description="Default payment period for newly generated invoices."
        >
          <input
            type="number"
            min="1"
            value={settings.billing.paymentDueDays}
            onChange={(event) =>
              updateBilling("paymentDueDays", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Grace Period (Days)"
          description="Additional time allowed after the payment due date."
        >
          <input
            type="number"
            min="0"
            value={settings.billing.gracePeriod}
            onChange={(event) =>
              updateBilling("gracePeriod", event.target.value)
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-7 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Subscription Policies
        </h3>

        <SettingToggle
          title="Automatic Subscription Renewal"
          description="Allow eligible active subscriptions to renew automatically at the end of each billing cycle."
          checked={settings.billing.autoRenew}
          onChange={(checked) =>
            updateBillingToggle("autoRenew", checked)
          }
        />

        <SettingToggle
          title="Retry Failed Payments"
          description="Enable retry attempts for failed recurring payment collections."
          checked={settings.billing.retryFailedPayments}
          onChange={(checked) =>
            updateBillingToggle("retryFailedPayments", checked)
          }
        />

        <SettingToggle
          title="Allow Subscription Pause"
          description="Allow eligible subscriptions to be temporarily paused."
          checked={settings.billing.allowPause}
          onChange={(checked) =>
            updateBillingToggle("allowPause", checked)
          }
        />
      </div>
    </div>
  );

  // INVOICE SECTION

  const renderInvoices = () => (
    <div>
      <SectionHeading
        title="Invoice Configuration"
        description="Customize invoice numbering, payment deadlines and document appearance."
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Invoice Prefix"
          description="Prefix used to generate new invoice numbers."
        >
          <input
            value={settings.invoices.prefix}
            onChange={(event) =>
              updateInvoices("prefix", event.target.value)
            }
            placeholder="INV"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Next Invoice Number"
          description="Sequence number for the next invoice."
        >
          <input
            type="number"
            min="1"
            value={settings.invoices.nextNumber}
            onChange={(event) =>
              updateInvoices("nextNumber", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Default Payment Due Days"
          description="Number of days before a newly created invoice is due."
        >
          <input
            type="number"
            min="1"
            value={settings.invoices.dueDays}
            onChange={(event) =>
              updateInvoices("dueDays", event.target.value)
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-5">
        <FormField
          label="Invoice Footer"
          description="A short message shown at the bottom of generated invoices."
        >
          <textarea
            rows={3}
            value={settings.invoices.footer}
            onChange={(event) =>
              updateInvoices("footer", event.target.value)
            }
            className="w-full resize-none rounded-lg border border-slate-200 p-3 text-xs text-slate-700 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
          />
        </FormField>
      </div>

      <div className="mt-7 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Invoice Display
        </h3>

        <SettingToggle
          title="Tax-Inclusive Pricing"
          description="Treat displayed product prices as including applicable taxes. Actual invoice calculations must follow the backend tax policy."
          checked={settings.invoices.taxInclusive}
          onChange={(checked) =>
            updateInvoiceToggle("taxInclusive", checked)
          }
        />

        <SettingToggle
          title="Show Business Address"
          description="Display the configured company address on generated invoices. A business address field will be required before this can be applied."
          checked={settings.invoices.showAddress}
          onChange={(checked) =>
            updateInvoiceToggle("showAddress", checked)
          }
        />
      </div>
    </div>
  );

  // NOTIFICATIONS SECTION

  const renderNotifications = () => (
    <div>
      <SectionHeading
        title="Notification Preferences"
        description="Choose which application events should generate email notifications."
      />

      <FormField
        label="Notification Recipient Email"
        description="Primary email address for administrative notifications."
      >
        <div className="relative">
          <Mail
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="email"
            value={settings.notifications.recipientEmail}
            onChange={(event) =>
              updateNotificationEmail(event.target.value)
            }
            className={`${inputClass} pl-9`}
          />
        </div>
      </FormField>

      <div className="mt-7 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Email Notifications
        </h3>

        <SettingToggle
          title="Invoice Created"
          description="Send a notification when a new customer invoice is generated."
          checked={settings.notifications.invoiceCreated}
          onChange={(checked) =>
            updateNotificationToggle("invoiceCreated", checked)
          }
        />

        <SettingToggle
          title="Payment Received"
          description="Send a notification when a customer payment is successfully recorded."
          checked={settings.notifications.paymentReceived}
          onChange={(checked) =>
            updateNotificationToggle("paymentReceived", checked)
          }
        />

        <SettingToggle
          title="Payment Failed"
          description="Notify administrators when a recurring payment attempt fails."
          checked={settings.notifications.paymentFailed}
          onChange={(checked) =>
            updateNotificationToggle("paymentFailed", checked)
          }
        />

        <SettingToggle
          title="Subscription Renewal"
          description="Send alerts before eligible customer subscriptions renew."
          checked={settings.notifications.subscriptionRenewal}
          onChange={(checked) =>
            updateNotificationToggle("subscriptionRenewal", checked)
          }
        />

        <SettingToggle
          title="Subscription Cancellation"
          description="Notify administrators when a subscription is cancelled."
          checked={settings.notifications.subscriptionCancelled}
          onChange={(checked) =>
            updateNotificationToggle("subscriptionCancelled", checked)
          }
        />

        <SettingToggle
          title="Weekly Performance Summary"
          description="Send a weekly email with revenue and subscription highlights."
          checked={settings.notifications.weeklyReport}
          onChange={(checked) =>
            updateNotificationToggle("weeklyReport", checked)
          }
        />
      </div>
    </div>
  );

  // SECURITY SECTION

  const renderSecurity = () => (
    <div>
      <SectionHeading
        title="Security Settings"
        description="Configure preferred security policies for application accounts."
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4">
        <LockKeyhole
          size={18}
          className="mt-0.5 shrink-0 text-amber-600"
        />

        <div>
          <p className="text-xs font-semibold text-amber-800">
            Security policy preview
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
            These controls represent the intended application policies.
            Actual session enforcement, password expiration and
            two-factor authentication require backend and authentication
            provider support.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Session Timeout (Minutes)"
          description="Preferred inactivity period before a user session expires."
        >
          <input
            type="number"
            min="5"
            value={settings.security.sessionTimeout}
            onChange={(event) =>
              updateSecurity("sessionTimeout", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Password Expiry (Days)"
          description="Preferred password rotation interval."
        >
          <input
            type="number"
            min="1"
            value={settings.security.passwordExpiry}
            onChange={(event) =>
              updateSecurity("passwordExpiry", event.target.value)
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-7 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Account Protection
        </h3>

        <SettingToggle
          title="Require Two-Factor Authentication"
          description="Require an additional verification step during account authentication."
          checked={settings.security.requireTwoFactor}
          onChange={(checked) =>
            updateSecurityToggle("requireTwoFactor", checked)
          }
        />

        <SettingToggle
          title="New Login Alerts"
          description="Notify the configured administrator when a new login is detected."
          checked={settings.security.newLoginAlert}
          onChange={(checked) =>
            updateSecurityToggle("newLoginAlert", checked)
          }
        />
      </div>
    </div>
  );

  // DISPLAY SELECTED SETTINGS SECTION

  const renderActiveSection = () => {
    switch (activeTab) {
      case "General":
        return renderGeneral();

      case "Billing":
        return renderBilling();

      case "Invoices":
        return renderInvoices();

      case "Notifications":
        return renderNotifications();

      case "Security":
        return renderSecurity();

      default:
        return renderGeneral();
    }
  };

  // MAIN PAGE

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Settings
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure your company, billing and application preferences.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2">
          <SettingsIcon size={15} className="text-slate-400" />

          <span className="text-xs font-medium text-slate-600">
            Workspace Configuration
          </span>
        </div>
      </div>

      {/* Settings layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* Internal navigation */}
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-3 px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Configuration
          </p>

          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.label;

              return (
                <button
                  key={tab.label}
                  onClick={() => {
                    setActiveTab(tab.label);
                    setNotification("");
                  }}
                  className={`flex min-w-fit items-center gap-3 rounded-lg px-3 py-3 text-left transition lg:w-full ${
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

                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">
                      {tab.label}
                    </span>

                    <span className="mt-1 hidden text-[10px] text-slate-400 sm:block">
                      {tab.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main settings form */}
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-5 sm:p-7">
            {renderActiveSection()}
          </div>

          {/* Save and reset */}
          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
            <div className="min-w-0">
              {notification ? (
                <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <CheckCircle2
                    size={15}
                    className="shrink-0 text-emerald-600"
                  />
                  {notification}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Review your changes before saving.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={14} />
                Reset
              </button>

              <button
                onClick={handleSave}
                className="flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
              >
                <Save size={14} />
                Save Changes
              </button>
            </div>
          </div>
        </section>
      </div>

      <p className="text-[10px] text-slate-400">
        Settings currently persist only within this browser page session.
        Connect the settings API to save preferences permanently.
      </p>
    </div>
  );
}
