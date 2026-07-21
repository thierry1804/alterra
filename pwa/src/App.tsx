import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { GuestRoute, ProtectedRoute } from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import InactivityGuard from "./components/InactivityGuard";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import UnlockPin from "./pages/UnlockPin";
import ActivitySelect from "./pages/ActivitySelect";
import BatchEntry from "./pages/BatchEntry";
import Validation from "./pages/Validation";
import TeamManagement from "./pages/TeamManagement";
import NfcScan from "./pages/NfcScan";
import BiometricCapture from "./pages/BiometricCapture";
import Sync from "./pages/Sync";
import ClarificationRequest from "./pages/ClarificationRequest";
import ActivityRequest from "./pages/ActivityRequest";
import WorkerRequest from "./pages/WorkerRequest";
import DailyClose from "./pages/DailyClose";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <InactivityGuard />
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route path="/unlock" element={<UnlockPin />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route element={<RoleRoute allowedRoles={["CHEF_EQUIPE", "ADMIN"]} />}>
                <Route path="/" element={<ActivitySelect />} />
                <Route path="/batch" element={<BatchEntry />} />
                <Route path="/nfc" element={<NfcScan />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={["CHEF_SERVICE", "ADMIN"]} />}>
                <Route path="/validation" element={<Validation />} />
                <Route path="/daily-close" element={<DailyClose />} />
                <Route path="/activity-requests" element={<ActivityRequest />} />
                <Route path="/worker-requests" element={<WorkerRequest />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={["CHEF_SERVICE", "CHEF_EQUIPE", "ADMIN"]} />}>
                <Route path="/teams" element={<TeamManagement />} />
                <Route path="/clarifications" element={<ClarificationRequest />} />
              </Route>

              <Route path="/sync" element={<Sync />} />
            </Route>

            <Route path="/validation/bio/:workerId" element={<BiometricCapture />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
