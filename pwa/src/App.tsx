import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/AuthProvider";
import { GuestRoute, ProtectedRoute } from "./components/ProtectedRoute";
import PermissionRoute from "./components/PermissionRoute";
import { ACCESS } from "./components/nav/nav-config";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
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
import MyPointages from "./pages/MyPointages";
import Notifications from "./pages/Notifications";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route element={<PermissionRoute access={ACCESS.fieldEntry} />}>
                <Route path="/" element={<ActivitySelect />} />
                <Route path="/batch" element={<BatchEntry />} />
              </Route>
              <Route element={<PermissionRoute access={ACCESS.presence} />}>
                <Route path="/nfc" element={<NfcScan />} />
              </Route>
              <Route element={<PermissionRoute access={ACCESS.myPointages} />}>
                <Route path="/my-pointages" element={<MyPointages />} />
              </Route>

              <Route element={<PermissionRoute access={ACCESS.validation} />}>
                <Route path="/validation" element={<Validation />} />
              </Route>
              <Route element={<PermissionRoute access={ACCESS.dailyClose} />}>
                <Route path="/daily-close" element={<DailyClose />} />
              </Route>
              <Route element={<PermissionRoute access={ACCESS.requests} />}>
                <Route path="/activity-requests" element={<ActivityRequest />} />
                <Route path="/worker-requests" element={<WorkerRequest />} />
              </Route>

              <Route element={<PermissionRoute access={ACCESS.teams} />}>
                <Route path="/teams" element={<TeamManagement />} />
              </Route>
              <Route element={<PermissionRoute access={ACCESS.clarifications} />}>
                <Route path="/clarifications" element={<ClarificationRequest />} />
              </Route>
              <Route path="/notifications" element={<Notifications />} />

              <Route path="/sync" element={<Sync />} />
            </Route>

            <Route path="/validation/bio/:workerId" element={<BiometricCapture />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
