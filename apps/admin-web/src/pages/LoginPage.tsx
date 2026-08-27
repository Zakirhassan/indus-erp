import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { Field, inputClass, inputErrorClass } from "../components/form/Field";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-glass-login p-4">
      <div className="glass-panel w-full max-w-md rounded-xl p-container-p">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white text-title-sm font-bold shadow-glass">
            PL
          </div>
          <h1 className="text-headline-md text-ink">Pro-Ledger ERP</h1>
          <p className="mt-1 text-body-sm text-ink-variant">
            Customer ledgers, collections and inventory in one place.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email or Username" htmlFor="email" required>
            <input
              id="email"
              type="text"
              autoComplete="username"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="password" required error={error}>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`${inputClass} pr-16 ${error ? inputErrorClass : ""}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-ink-variant hover:text-primary"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between text-body-sm">
            <label className="flex items-center gap-2 text-ink-variant">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-border"
              />
              Remember me
            </label>
            <a href="#" className="text-primary hover:underline" onClick={(e) => e.preventDefault()}>
              Forgot password?
            </a>
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-body-sm text-ink-variant">
          This portal is for Admin and Collector staff accounts only.
        </p>
      </div>
    </div>
  );
}
