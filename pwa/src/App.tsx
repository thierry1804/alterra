import { useEffect } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Pointage from "./pages/Pointage";
import Sync from "./pages/Sync";
import { startAutoSync, stopAutoSync } from "./sync/SyncManager";

export default function App() {
  useEffect(() => {
    startAutoSync();
    return () => stopAutoSync();
  }, []);

  return (
    <BrowserRouter>
      <nav className="flex border-b bg-white">
        <Link to="/" className="p-3 text-sm">
          Pointage
        </Link>
        <Link to="/sync" className="p-3 text-sm">
          Sync
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<Pointage />} />
        <Route path="/sync" element={<Sync />} />
      </Routes>
    </BrowserRouter>
  );
}
