import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { TaskLoader } from "./TaskLoader";
import NZBritanniaLogo from "../assets/nz-britannia-logo.png";
import { BrandRail } from "./BrandRail";

const demoAccounts = [
  { label: "Super Admin", role: "Owner Access", email: "ngawangg927@gmail.com", password: "Admin@123" },
  { label: "Admin", role: "Control Center", email: "admin@counttale.bt", password: "Admin@123" },
  { label: "Employee", role: "Data Entry", email: "employee@counttale.bt", password: "Employee@123" },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage({ onLogin, isLoading }) {
  const [email, setEmail] = useState("ngawangg927@gmail.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState("");

  const selectedAccount = demoAccounts.find((account) => account.email === email);

  const validate = () => {
    const nextErrors = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailPattern.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!validate()) return;
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message || "Login failed.");
    }
  };

  return (
    <div className="login-shell min-h-screen text-slate-900">
      <div className="login-grid-layer" aria-hidden="true" />
      <div className="login-ribbon login-ribbon-a" aria-hidden="true" />
      <div className="login-ribbon login-ribbon-b" aria-hidden="true" />

      <main className="login-page-shell relative z-10 mx-auto grid min-h-screen w-full max-w-[1180px] items-center gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.82fr] lg:px-8">
        <section className="login-story-panel hidden min-h-[42rem] flex-col justify-between overflow-hidden lg:flex" aria-label="NZ Britannia identity">
          <div>
            <div className="login-story-brand">
              <div className="login-story-logo">
                <img src={NZBritanniaLogo} alt="NZ Britannia — Retire Better" />
              </div>
            </div>
            <h2 className="mt-8 text-4xl font-black tracking-tight text-white">Control today. Retire better.</h2>
            <p className="mt-6 max-w-md text-sm font-medium leading-7 text-white/68">
              A controlled workspace for invoice entry, payment verification, record ownership, and trusted financial traceability.
            </p>
          </div>

          <div className="login-story-ledger">
            {[
              ["Entry", "Who recorded it"],
              ["Verify", "What was checked"],
              ["Payment", "What is still due"],
              ["Trace", "What can be trusted"],
            ].map(([label, detail], index) => (
              <div key={label} className="login-story-step">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>{label}</p>
                  <small>{detail}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="login-story-proof">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-[var(--ct-gold)]">
                <ShieldCheck size={19} />
              </div>
              <div>
                <p className="text-sm font-black text-white">Secure financial record</p>
                <p className="text-xs font-medium text-white/58">Entries, payments, and corrections remain accountable.</p>
              </div>
            </div>
            <CheckCircle2 className="text-[var(--ct-gold)]" size={22} />
          </div>
        </section>

        <form onSubmit={submit} className="login-card h-fit" noValidate aria-busy={isLoading}>
          <div className="mb-7 text-center">
            <div className="login-brand-mark">
              <img src={NZBritanniaLogo} alt="NZ Britannia — Retire Better" />
            </div>
            <div className="mt-5">
              <h1 className="text-3xl font-black tracking-tight text-slate-950">Login</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Secure access to your financial workspace.</p>
            </div>
          </div>

          <BrandRail className="login-brand-rail" />

          <div className="space-y-5">
            <div>
              <div
                className={cn(
                  "login-floating-field login-email-field",
                  (focusedField === "email" || email) && "login-floating-active",
                  focusedField === "email" && "login-floating-focused",
                  fieldErrors.email && "login-input-error",
                )}
              >
                <Mail className="login-floating-icon" size={18} aria-hidden="true" />
                <label htmlFor="login-email" className="login-floating-label">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors((current) => ({ ...current, email: "" }));
                    setError("");
                  }}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField("")}
                  className="login-floating-input"
                  placeholder="authorized@email.com"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                  required
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" className="login-field-message">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <div
                className={cn(
                  "login-floating-field",
                  (focusedField === "password" || password) && "login-floating-active",
                  focusedField === "password" && "login-floating-focused",
                  fieldErrors.password && "login-input-error",
                )}
              >
                <LockKeyhole className="login-floating-icon" size={18} aria-hidden="true" />
                <label htmlFor="login-password" className="login-floating-label">
                  Password
                </label>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: "" }));
                    setError("");
                  }}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField("")}
                  className="login-floating-input pr-10"
                  placeholder="Enter secure password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="login-icon-button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="login-field-message">
                  {fieldErrors.password}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="login-error-message" role="alert" aria-live="polite">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="login-submit-button"
          >
            {isLoading ? (
              <TaskLoader type="login" compact className="login-inline-loader" />
            ) : (
              <>
                Login
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <fieldset className="mt-6">
            <legend className="mb-3 text-[10px] font-black uppercase text-slate-500">Role Access</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {demoAccounts.map((account) => {
                const isSelected = selectedAccount?.email === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setFieldErrors({});
                      setError("");
                    }}
                    className={cn("login-role-button", isSelected && "login-role-button-active")}
                    aria-pressed={isSelected}
                  >
                    <span className="flex items-center gap-2">
                      <span className="login-role-dot" />
                      {account.label}
                    </span>
                    <span>{account.role}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </form>
      </main>
    </div>
  );
}
