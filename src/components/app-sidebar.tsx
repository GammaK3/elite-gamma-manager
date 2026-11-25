"use client";

type AppSidebarProps = {
  activePath: string;
  darkMode: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const navigation = [
  { label: "Resumen general", href: "/", icon: "▦", path: "/" },
  { label: "Productos", href: "/productos", icon: "◇", path: "/productos" },
  { label: "Inventario", href: "/inventario", icon: "▤", path: "/inventario" },
  { label: "Proveedores", href: "/proveedores", icon: "▣", path: "/proveedores" },
  { label: "Compras", href: "/compras", icon: "🛍", path: "/compras" },
  { label: "Ventas", href: "/ventas", icon: "🛒", path: "/ventas" },
  { label: "Pedidos", href: "/pedidos", icon: "▣", path: "/pedidos" },
  { label: "Clientes", href: "/clientes", icon: "♧", path: "/clientes" },
  { label: "Finanzas", href: "/finanzas", icon: "▱", path: "/finanzas" },
  { label: "Reportes", href: "/reportes", icon: "⌁", path: "/reportes" },
];

export default function AppSidebar({
  activePath,
  darkMode,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const surface = darkMode
    ? "bg-[#171D28] border-[#293241]"
    : "bg-white border-[#EAECF0]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#737987]";

  return (
    <>
      <aside
        id="elite-gamma-sidebar"
        aria-label="Navegación principal de ELITE GAMMA"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r py-6 transition-all duration-200 ${surface} ${
          collapsed ? "w-[270px] px-5 lg:w-[76px] lg:px-3" : "w-[270px] px-5 lg:w-[245px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <a
          href="/"
          onClick={onCloseMobile}
          title="ELITE GAMMA — Dashboard"
          className={`flex items-center gap-3 px-2 ${collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#191D29] text-lg font-bold text-white">
            EG<span className="text-[#F39A38]">.</span>
          </span>
          <span className={collapsed ? "lg:hidden" : ""}>
            <strong className={`block text-sm tracking-wider ${darkMode ? "text-[#E7EAF0]" : "text-[#20232B]"}`}>
              ELITE GAMMA
            </strong>
            <small className="text-[9px] tracking-[2px] text-[#9297A3]">BUSINESS MANAGER</small>
          </span>
        </a>

        <p className={`mb-3 mt-10 px-3 text-[10px] font-bold tracking-[1.7px] text-[#9CA1AC] ${collapsed ? "lg:hidden" : ""}`}>
          MENÚ PRINCIPAL
        </p>

        <nav className="space-y-1" aria-label="Menú principal">
          {navigation.map((item) => {
            const active = item.path === activePath;
            return (
              <a
                key={item.label}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium transition ${collapsed ? "lg:justify-center lg:px-2" : ""} ${
                  active
                    ? "bg-[#191D29] text-white"
                    : darkMode
                      ? "text-[#A0ABBC] hover:bg-[#222B39] hover:text-white"
                      : "text-[#737987] hover:bg-[#F5F6F8] hover:text-[#20232B]"
                }`}
              >
                <span className="w-5 shrink-0 text-center text-base">{item.icon}</span>
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                {active && <span className={`ml-auto h-1.5 w-1.5 rounded-full bg-[#F39A38] ${collapsed ? "lg:hidden" : ""}`} />}
              </a>
            );
          })}
        </nav>

        <p className={`mb-3 mt-9 px-3 text-[10px] font-bold tracking-[1.7px] text-[#9CA1AC] ${collapsed ? "lg:hidden" : ""}`}>
          SISTEMA
        </p>
        <a
          href="/configuracion"
          onClick={onCloseMobile}
          title={collapsed ? "Configuración" : undefined}
          aria-current={activePath === "/configuracion" ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition ${collapsed ? "lg:justify-center lg:px-2" : ""} ${activePath === "/configuracion" ? "bg-[#191D29] text-white" : muted + " hover:bg-[#222B39] hover:text-white"}`}
        >
          <span className="w-5 shrink-0 text-center">⚙</span>
          <span className={collapsed ? "lg:hidden" : ""}>Configuración</span>
          {activePath === "/configuracion" && <span className={`ml-auto h-1.5 w-1.5 rounded-full bg-[#F39A38] ${collapsed ? "lg:hidden" : ""}`} />}
        </a>

        <div className={`mt-auto rounded-xl p-4 ${darkMode ? "bg-[#202938]" : "bg-[#F6F7F9]"} ${collapsed ? "lg:hidden" : ""}`}>
          <p className={`text-[11px] font-semibold ${muted}`}>Panel de gestión</p>
          <p className={`mt-2 text-[11px] leading-5 ${muted}`}>Controla tu negocio desde un solo lugar.</p>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}
    </>
  );
}
