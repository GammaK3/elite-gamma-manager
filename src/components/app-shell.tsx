"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password"];

const TITLES: Record<string, string> = {
  "/": "Panel de control",
  "/productos": "Productos",
  "/inventario": "Inventario",
  "/proveedores": "Proveedores",
  "/compras": "Compras",
  "/ventas": "Ventas",
  "/pedidos": "Pedidos",
  "/clientes": "Clientes",
  "/finanzas": "Finanzas",
  "/reportes": "Reportes",
  "/configuracion": "Configuración",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isPublicPage = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/auth/");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("elite-gamma-theme");
    const savedSidebar = window.localStorage.getItem("elite-gamma-sidebar-collapsed");
    setDarkMode(savedTheme === "dark");
    setCollapsed(savedSidebar === "true");
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    window.localStorage.setItem("elite-gamma-sidebar-collapsed", String(collapsed));
  }, [collapsed, preferencesLoaded]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem("elite-gamma-theme", next ? "dark" : "light");
      window.dispatchEvent(
        new CustomEvent("elite-gamma-theme-change", { detail: { darkMode: next } })
      );
      return next;
    });
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      window.alert(`No se pudo cerrar la sesión: ${error.message}`);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  if (isPublicPage) return <>{children}</>;

  const title = TITLES[pathname] ?? "ELITE GAMMA";
  const activePath = pathname === "/" || pathname === "/productos" ? pathname : pathname;
  const surface = darkMode
    ? "border-[#293241] bg-[#141A24] text-[#E7EAF0]"
    : "border-[#EAECF0] bg-white text-[#20232B]";

  return (
    <div className={darkMode ? "min-h-screen bg-[#0D1118] text-[#E7EAF0]" : "min-h-screen bg-[#F6F7F9] text-[#20232B]"}>
      <AppSidebar
        activePath={activePath}
        darkMode={darkMode}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[245px]"}`}>
        <header className={`sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-3 border-b px-4 sm:px-7 ${surface}`}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú de navegación"
              aria-controls="elite-gamma-sidebar"
              aria-expanded={mobileOpen}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg lg:hidden ${darkMode ? "border-[#354153] bg-[#202938]" : "border-[#EAECF0] bg-white"}`}
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
              aria-controls="elite-gamma-sidebar"
              aria-expanded={!collapsed}
              title={collapsed ? "Expandir menú" : "Contraer menú"}
              className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg transition hover:border-[#E99A44] lg:inline-flex ${darkMode ? "border-[#354153] bg-[#202938]" : "border-[#EAECF0] bg-white"}`}
            >
              {collapsed ? "☰" : "⇤"}
            </button>
            <div className="min-w-0">
              <p className={`truncate text-[10px] tracking-[2px] ${darkMode ? "text-[#A0ABBC]" : "text-[#8B909C]"}`}>ELITE GAMMA / GESTIÓN</p>
              <h1 className="truncate text-lg font-bold">{title}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${darkMode ? "border-[#354153] bg-[#202938] text-[#F2C18D]" : "border-[#EAECF0] bg-white text-[#737987]"}`}
            >
              {darkMode ? "☀ Modo claro" : "☾ Modo oscuro"}
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className={`hidden rounded-lg border px-3 py-2 text-xs font-semibold sm:inline-flex ${darkMode ? "border-[#354153] text-[#A0ABBC] hover:bg-[#202938]" : "border-[#EAECF0] text-[#737987] hover:bg-[#F5F6F8]"}`}
            >
              {signingOut ? "Saliendo..." : "Cerrar sesión"}
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-68px)]">{children}</main>
      </div>
    </div>
  );
}
