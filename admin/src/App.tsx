import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Forbidden from "./pages/Forbidden";
import SitesPage from "./pages/Sites";
import ZonesPage from "./pages/Zones";
import ActivitiesPage from "./pages/Activities";
import WorkersPage from "./pages/Workers";
import UsersPage from "./pages/Users";
import PointagesPage from "./pages/Pointages";
import PaymentsPage from "./pages/Payments";
import ReportsPage from "./pages/Reports";
import AuditLogPage from "./pages/AuditLog";
import RequestsPage from "./pages/Requests";
import ProtectedRoute, { GuestRoute } from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import RoleGuard from "./components/layout/RoleGuard";
import { Toaster } from "./components/ui/toaster";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route
                element={<RoleGuard allowedRoles={["ADMIN", "CHEF_SERVICE"]} />}
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/pointages" element={<PointagesPage />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={["ADMIN"]} />}>
                <Route path="/sites" element={<SitesPage />} />
                <Route path="/zones" element={<ZonesPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/workers" element={<WorkersPage />} />
                <Route path="/requests" element={<RequestsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
              </Route>
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
