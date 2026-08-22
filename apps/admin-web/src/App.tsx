import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { CustomersPage } from "./pages/CustomersPage";
import { InventoryPage } from "./pages/InventoryPage";
import { ProductHistoryPage } from "./pages/ProductHistoryPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReportsPage } from "./pages/ReportsPage";

function Protected({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <RequireAuth>
      <AppShell title={title}>{children}</AppShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Protected title="Customers"><CustomersPage /></Protected>} />
            <Route path="/inventory" element={<Protected title="Inventory"><InventoryPage /></Protected>} />
            <Route
              path="/inventory/:productId/history"
              element={<Protected title="Product Stock History"><ProductHistoryPage /></Protected>}
            />
            <Route path="/collections" element={<Protected title="Collections"><CollectionsPage /></Protected>} />
            <Route
              path="/collections/approvals"
              element={<Protected title="Collection Approval Portal"><ApprovalsPage /></Protected>}
            />
            <Route path="/reports" element={<Protected title="Reports & Analytics"><ReportsPage /></Protected>} />
            <Route path="/settings" element={<Protected title="Settings"><SettingsPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
