import { useEffect, type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Forbidden from "./pages/Forbidden";
import SitesPage from "./pages/Sites";
import ZonesPage from "./pages/Zones";
import ActivitiesPage from "./pages/Activities";
import UnitsPage from "./pages/Units";
import WorkersPage from "./pages/Workers";
import UsersPage from "./pages/Users";
import PointagesPage from "./pages/Pointages";
import PaymentsPage from "./pages/Payments";
import InvoicesPage from "./pages/Invoices";
import ReportsPage from "./pages/Reports";
import AuditLogPage from "./pages/AuditLog";
import RequestsPage from "./pages/Requests";
import MapPage from "./pages/Map";
import BadgesPage from "./pages/Badges";
import ProtectedRoute, { GuestRoute } from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import PermissionGuard from "./components/layout/PermissionGuard";
import AccessRolesPage from "./pages/AccessRoles";
import { Toaster } from "./components/ui/toaster";
import { LoadingRow } from "./components/ui/feedback";
import { useAuthBootstrap } from "./hooks/useAuthBootstrap";
import { useAppSettings } from "./hooks/useAppSettings";
import AppSettingsPage from "./pages/AppSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function DocumentTitleSync() {
  const { appName } = useAppSettings();
  useEffect(() => {
    document.title = `${appName} - Back-office`;
  }, [appName]);
  return null;
}

function guard(path: string, page: ReactElement) {
  return <PermissionGuard path={path}>{page}</PermissionGuard>;
}

export default function App() {
  const { ready } = useAuthBootstrap();

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingRow label="Vérification de la session…" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DocumentTitleSync />
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={guard("/", <Dashboard />)} />
              <Route path="/pointages" element={guard("/pointages", <PointagesPage />)} />
              <Route path="/badges" element={guard("/badges", <BadgesPage />)} />
              <Route path="/sites" element={guard("/sites", <SitesPage />)} />
              <Route path="/zones" element={guard("/zones", <ZonesPage />)} />
              <Route path="/activities" element={guard("/activities", <ActivitiesPage />)} />
              <Route path="/units" element={guard("/units", <UnitsPage />)} />
              <Route path="/workers" element={guard("/workers", <WorkersPage />)} />
              <Route path="/requests" element={guard("/requests", <RequestsPage />)} />
              <Route path="/map" element={guard("/map", <MapPage />)} />
              <Route path="/users" element={guard("/users", <UsersPage />)} />
              <Route path="/access" element={guard("/access", <AccessRolesPage />)} />
              <Route path="/payments" element={guard("/payments", <PaymentsPage />)} />
              <Route path="/invoices" element={guard("/invoices", <InvoicesPage />)} />
              <Route path="/reports" element={guard("/reports", <ReportsPage />)} />
              <Route path="/audit" element={guard("/audit", <AuditLogPage />)} />
              <Route path="/settings" element={guard("/settings", <AppSettingsPage />)} />
            </Route>
          </Route>

          <Route path="/forbidden" element={<Forbidden />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
