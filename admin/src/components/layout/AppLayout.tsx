import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "./CommandPalette";
import { useAmountDecimals } from "../../lib/money";

export default function AppLayout() {
  // Menu replié en icônes sur tablette ; l'utilisateur garde la main avec le bouton.
  const [collapsed, setCollapsed] = useState(
    () => window.matchMedia("(max-width: 1023px)").matches,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Les montants se formatent via un module partagé : un changement du nombre de décimales redessine la page.
  const amountDecimals = useAmountDecimals();

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    function onChange(event: MediaQueryListEvent) {
      setCollapsed(event.matches);
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-white text-zinc-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />
        <main key={amountDecimals} className="flex-1 overflow-auto bg-surface/40 p-5">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
