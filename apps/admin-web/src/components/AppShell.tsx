import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

const navItems = [
  { to: "/", label: "Customers", end: true },
  { to: "/inventory", label: "Inventory" },
  { to: "/collections", label: "Collection" },
  { to: "/collections/approvals", label: "Approvals" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
];

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="glass-panel-dark flex w-sidebar flex-shrink-0 flex-col bg-glass-sidebar text-white">
        <div className="px-6 py-6">
          <div className="text-title-sm font-semibold">Pro-Ledger ERP</div>
          <div className="text-body-sm text-white/60">Indus ERP Admin</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded px-3 py-2.5 text-body-md transition-colors ${
                  isActive ? "bg-white/10 font-semibold text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-container-p">
          <h1 className="text-headline-md text-ink">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-body-sm font-semibold text-ink">{session?.name}</div>
              <div className="text-body-sm text-ink-variant">{session?.role === "ADMIN" ? "Admin" : "Collector"}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-body-sm font-semibold text-primary">
              {session?.name?.slice(0, 1) ?? "?"}
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-body-sm text-ink-variant hover:text-primary"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-container-p">{children}</main>
      </div>
    </div>
  );
}
