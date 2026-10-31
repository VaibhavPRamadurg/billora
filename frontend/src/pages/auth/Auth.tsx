
import { useState, type FormEvent } from "react";
import {
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  UserRound,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { apiErrorMessage, authApi, type CurrentUser } from "../../api/client";

type AuthProps = {
  onLogin: (user: CurrentUser) => void;
};

type AuthForm = {
  fullName: string;
  company: string;
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
};

const initialForm: AuthForm = {
  fullName: "",
  company: "",
  email: "",
  password: "",
  confirmPassword: "",
  rememberMe: false,
};

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100";

export default function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [form, setForm] = useState<AuthForm>(initialForm);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof AuthForm, value: string | boolean) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setMessage("");
  };

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setMessage("");

    const email = form.email.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      onLogin(await authApi.login(email, form.password));
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setMessage("");

    const email = form.email.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register(email, form.password);
      onLogin(await authApi.login(email, form.password));
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setError("");
    setMessage(
      "Password reset will be available after the authentication API is connected."
    );
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-2">

        {/* LEFT BRANDING PANEL */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-10 lg:flex xl:p-16">

          <div className="absolute -left-32 top-40 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl" />
          <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-yellow-100/50 blur-3xl" />

          {/* Brand */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400 text-2xl font-extrabold text-slate-900 shadow-sm">
              B
            </div>

            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Billora
            </span>
          </div>

          {/* Main content */}
          <div className="relative z-10 mx-auto w-full max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700">
              <Sparkles size={14} />
              Simplify your recurring revenue
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 xl:text-5xl">
              Powering recurring revenue for modern businesses.
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-500">
              Manage subscriptions, customers, invoices and payments
              through one simple business management platform.
            </p>

            {/* Dashboard illustration */}
            <div className="relative mt-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Revenue Overview
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Subscription performance
                  </p>
                </div>

                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  +12.5%
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] text-slate-400">
                    Total Revenue
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    $124.5k
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                    ↑ 12.5% this month
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] text-slate-400">
                    Active Subscriptions
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    1,089
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                    ↑ 5.7% this month
                  </p>
                </div>
              </div>

              <div className="mt-5 flex h-32 items-end justify-between gap-3 rounded-xl bg-slate-50 px-5 pb-3 pt-4">
                {[35, 48, 42, 65, 55, 75, 68, 88, 72, 100].map(
                  (height, index) => (
                    <div
                      key={index}
                      className={`w-full rounded-t-md ${
                        index === 9 ? "bg-yellow-400" : "bg-blue-200"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  )
                )}
              </div>

              {/* Floating card */}
              <div className="absolute -right-5 -top-7 hidden items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-lg xl:flex">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-800">
                    Payment Received
                  </p>
                  <p className="mt-1 text-xs font-bold text-emerald-600">
                    +$2,450.00
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom text */}
          <div className="relative z-10 flex items-center justify-between border-t border-slate-200 pt-5 text-[11px] text-slate-500">
            <span>© 2026 Billora. All rights reserved.</span>

            <span className="flex items-center gap-2">
              <ShieldCheck size={14} />
              Business billing management
            </span>
          </div>
        </section>

        {/* RIGHT AUTH PANEL */}
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:bg-white xl:px-16">

          <div className="w-full max-w-md">

            {/* Mobile branding */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-xl font-extrabold text-slate-900">
                B
              </div>

              <span className="text-xl font-extrabold text-slate-900">
                Billora
              </span>
            </div>

            {/* Heading */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Welcome to Billora
              </p>

              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
                {mode === "login"
                  ? "Sign in to your account"
                  : "Create your account"}
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {mode === "login"
                  ? "Enter your credentials to access your workspace."
                  : "Get started with managing your recurring revenue."}
              </p>
            </div>

            {/* Login / Register tabs */}
            <div className="mt-8 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-md py-2.5 text-xs font-semibold transition ${
                  mode === "login"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`rounded-md py-2.5 text-xs font-semibold transition ${
                  mode === "register"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={
                mode === "login" ? handleLogin : handleRegister
              }
              className="mt-7 space-y-5"
            >

              {/* Registration-only fields */}
              {mode === "register" && (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Full Name *
                    </label>

                    <div className="relative">
                      <UserRound
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        value={form.fullName}
                        onChange={(event) =>
                          updateField("fullName", event.target.value)
                        }
                        placeholder="Enter your full name"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Business Name *
                    </label>

                    <div className="relative">
                      <Building2
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        value={form.company}
                        onChange={(event) =>
                          updateField("company", event.target.value)
                        }
                        placeholder="Enter your business name"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Email Address *
                </label>

                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    placeholder="you@example.com"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Password *
                  </label>

                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <LockKeyhole
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    minLength={8}
                    value={form.password}
                    onChange={(event) =>
                      updateField("password", event.target.value)
                    }
                    placeholder="Minimum 8 characters"
                    className={`${inputClass} pl-10 pr-11`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              {mode === "register" && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Confirm Password *
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      required
                      type={
                        showConfirmPassword ? "text" : "password"
                      }
                      autoComplete="new-password"
                      minLength={8}
                      value={form.confirmPassword}
                      onChange={(event) =>
                        updateField(
                          "confirmPassword",
                          event.target.value
                        )
                      }
                      placeholder="Re-enter your password"
                      className={`${inputClass} pl-10 pr-11`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me */}
              {mode === "login" && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.rememberMe}
                    onChange={(event) =>
                      updateField("rememberMe", event.target.checked)
                    }
                    className="h-4 w-4 accent-yellow-500"
                  />

                  <span className="text-xs text-slate-600">
                    Remember me
                  </span>
                </label>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                  <p className="text-xs font-medium text-red-600">
                    {error}
                  </p>
                </div>
              )}

              {/* Informational message */}
              {message && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3">
                  <p className="text-xs leading-relaxed text-blue-700">
                    {message}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500 active:scale-[0.99]"
              >
                {submitting ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}

                <ArrowRight size={17} />
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3">
              <p className="text-[10px] leading-relaxed text-blue-800">
                Sign in with a Billora account. New registrations are created as customer accounts.
              </p>
            </div>

            {/* Footer */}
            <div className="mt-8 border-t border-slate-100 pt-5 text-center"></div>

            {/* Footer */}
            <div className="mt-8 border-t border-slate-100 pt-5 text-center">
              <p className="text-xs text-slate-500">
                {mode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}

                <button
                  type="button"
                  onClick={() =>
                    switchMode(
                      mode === "login" ? "register" : "login"
                    )
                  }
                  className="ml-2 font-bold text-blue-700 hover:text-blue-900"
                >
                  {mode === "login" ? "Register" : "Sign In"}
                </button>
              </p>

              <p className="mt-5 text-[10px] text-slate-400">
                © 2026 Billora. Subscription management made simple.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
