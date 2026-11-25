"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CashAccount = {
  id: string;
  name: string;
  is_active: boolean;
};

type CashMovement = {
  id: string;
  cash_account_id: string;
  movement_type: string;
  direction: "in" | "out";
  amount: number | string;
  effective_at: string;
  payment_method: string | null;
  notes: string | null;
};

type Sale = {
  id: string;
  sale_number: string | null;
  sale_date: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  minimum_stock: number | string;
  is_active: boolean;
};

type StockRow = {
  product_id: string;
  stock_quantity: number | string;
};

type Expense = {
  id: string;
  description: string;
  amount: number | string;
  record_status: string;
  payment_status: string;
};

type Receivable = {
  id: string;
  description: string;
  balance: number | string;
  record_status: string;
};

type InventoryDiscrepancy = {
  id: string;
  status: string;
};

type Activity = {
  id: string;
  date: string;
  title: string;
  detail: string;
  amount: number;
  direction: "in" | "out" | "neutral";
};

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function movementTitle(type: string) {
  const labels: Record<string, string> = {
    opening_balance: "Saldo de apertura",
    sale_receipt: "Cobro de venta",
    expense_payment: "Pago de gasto",
    receivable_collection: "Cobro de importe pendiente",
    refund: "Reembolso",
    adjustment: "Ajuste de caja",
    transfer_in: "Transferencia recibida",
    transfer_out: "Transferencia enviada",
  };
  return labels[type] ?? "Movimiento de caja";
}

function saleStatusLabel(sale: Sale) {
  if (sale.status === "cancelled") return "Cancelada";
  if (sale.payment_status === "confirmed") return "Pago confirmado";
  if (sale.status === "pending_payment") return "Pendiente de pago";
  if (sale.status === "draft") return "Borrador";
  return sale.status.replaceAll("_", " ");
}

export default function DashboardPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [monthAnchor, setMonthAnchor] = useState<Date | null>(null);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [discrepancies, setDiscrepancies] = useState<InventoryDiscrepancy[]>([]);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    setMonthAnchor(new Date());
    setDarkMode(window.localStorage.getItem("elite-gamma-theme") === "dark");
    const handleTheme = (event: Event) => {
      const detail = (event as CustomEvent<{ darkMode?: boolean }>).detail;
      setDarkMode(
        typeof detail?.darkMode === "boolean"
          ? detail.darkMode
          : window.localStorage.getItem("elite-gamma-theme") === "dark"
      );
    };
    window.addEventListener("elite-gamma-theme-change", handleTheme);
    return () => window.removeEventListener("elite-gamma-theme-change", handleTheme);
  }, []);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (businessError) throw new Error(`Negocio: ${businessError.message}`);
      if (!business) throw new Error("No encontramos ELITE GAMMA asociado a tu usuario.");

      const [
        accountsResult,
        movementsResult,
        salesResult,
        productsResult,
        stockResult,
        expensesResult,
        receivablesResult,
        discrepanciesResult,
        customersResult,
      ] = await Promise.all([
        supabase
          .from("cash_accounts")
          .select("id,name,is_active")
          .eq("business_id", business.id),
        supabase
          .from("cash_movements")
          .select("id,cash_account_id,movement_type,direction,amount,effective_at,payment_method,notes")
          .eq("business_id", business.id)
          .order("effective_at", { ascending: false })
          .limit(500),
        supabase
          .from("sales")
          .select("id,sale_number,sale_date,status,payment_status,total_amount,created_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("products")
          .select("id,name,sku,minimum_stock,is_active")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("product_stock")
          .select("product_id,stock_quantity")
          .eq("business_id", business.id),
        supabase
          .from("expenses")
          .select("id,description,amount,record_status,payment_status")
          .eq("business_id", business.id)
          .eq("record_status", "recorded"),
        supabase
          .from("accounts_receivable")
          .select("id,description,balance,record_status")
          .eq("business_id", business.id),
        supabase
          .from("inventory_discrepancies")
          .select("id,status")
          .eq("business_id", business.id),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id),
      ]);

      const failures = [
        ["Cuentas de caja", accountsResult.error],
        ["Movimientos de caja", movementsResult.error],
        ["Ventas", salesResult.error],
        ["Productos", productsResult.error],
        ["Existencias", stockResult.error],
        ["Gastos", expensesResult.error],
        ["Importes por verificar", receivablesResult.error],
        ["Diferencias de inventario", discrepanciesResult.error],
        ["Clientes", customersResult.error],
      ] as const;
      const failed = failures.find(([, queryError]) => queryError);
      if (failed) throw new Error(`${failed[0]}: ${failed[1]?.message}`);

      setAccounts((accountsResult.data ?? []) as CashAccount[]);
      setMovements((movementsResult.data ?? []) as CashMovement[]);
      setSales((salesResult.data ?? []) as Sale[]);
      setProducts((productsResult.data ?? []) as Product[]);
      setStockRows((stockResult.data ?? []) as StockRow[]);
      setExpenses((expensesResult.data ?? []) as Expense[]);
      setReceivables((receivablesResult.data ?? []) as Receivable[]);
      setDiscrepancies((discrepanciesResult.data ?? []) as InventoryDiscrepancy[]);
      setCustomerCount(customersResult.count ?? 0);
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el resumen general.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const stockMap = useMemo(
    () => new Map(stockRows.map((row) => [row.product_id, Number(row.stock_quantity ?? 0)])),
    [stockRows]
  );

  const metrics = useMemo(() => {
    const activeAccountIds = new Set(accounts.filter((account) => account.is_active).map((account) => account.id));
    const cash = movements
      .filter((movement) => activeAccountIds.has(movement.cash_account_id))
      .reduce((total, movement) => total + (movement.direction === "in" ? 1 : -1) * Number(movement.amount ?? 0), 0);

    const monthStart = monthAnchor
      ? new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1).getTime()
      : Number.POSITIVE_INFINITY;
    const nextMonthStart = monthAnchor
      ? new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1).getTime()
      : Number.POSITIVE_INFINITY;
    const paidThisMonth = monthAnchor ? sales.filter((sale) => {
      const timestamp = new Date(sale.sale_date).getTime();
      return sale.payment_status === "confirmed" && timestamp >= monthStart && timestamp < nextMonthStart;
    }) : [];
    const pendingSales = sales.filter(
      (sale) => sale.status === "pending_payment" && sale.payment_status === "pending"
    );
    const stockTotal = products.reduce((total, product) => total + (stockMap.get(product.id) ?? 0), 0);
    const zeroStock = products.filter((product) => (stockMap.get(product.id) ?? 0) <= 0);
    const lowStock = products
      .filter((product) => {
        const available = stockMap.get(product.id) ?? 0;
        return available > 0 && Number(product.minimum_stock ?? 0) > 0 && available <= Number(product.minimum_stock);
      })
      .sort((a, b) => (stockMap.get(a.id) ?? 0) - (stockMap.get(b.id) ?? 0));
    const pendingExpenses = expenses.filter((expense) => expense.payment_status === "pending_confirmation");
    const unverifiedAmounts = receivables.filter((item) => item.record_status === "pending_confirmation");
    const pendingDiscrepancies = discrepancies.filter((item) => item.status === "pending_identification");

    return {
      cash,
      monthlySales: paidThisMonth.reduce((total, sale) => total + Number(sale.total_amount ?? 0), 0),
      paidSaleCount: paidThisMonth.length,
      pendingSalesAmount: pendingSales.reduce((total, sale) => total + Number(sale.total_amount ?? 0), 0),
      pendingSaleCount: pendingSales.length,
      stockTotal,
      productsWithStock: products.filter((product) => (stockMap.get(product.id) ?? 0) > 0).length,
      activeProducts: products.length,
      zeroStock,
      lowStock,
      pendingExpensesAmount: pendingExpenses.reduce((total, expense) => total + Number(expense.amount ?? 0), 0),
      pendingExpensesCount: pendingExpenses.length,
      unverifiedAmount: unverifiedAmounts.reduce((total, item) => total + Number(item.balance ?? 0), 0),
      unverifiedCount: unverifiedAmounts.length,
      pendingDiscrepancyCount: pendingDiscrepancies.length,
    };
  }, [accounts, movements, sales, products, stockMap, expenses, receivables, discrepancies, monthAnchor]);

  const activity = useMemo<Activity[]>(() => {
    const cashEvents: Activity[] = movements.slice(0, 8).map((movement) => ({
      id: `cash-${movement.id}`,
      date: movement.effective_at,
      title: movementTitle(movement.movement_type),
      detail: movement.notes?.trim() || movement.payment_method?.replaceAll("_", " ") || "Movimiento confirmado",
      amount: Number(movement.amount ?? 0),
      direction: movement.direction,
    }));
    const saleEvents: Activity[] = sales
      .filter((sale) => !["draft", "cancelled"].includes(sale.status))
      .slice(0, 8)
      .map((sale) => ({
        id: `sale-${sale.id}`,
        date: sale.created_at,
        title: sale.sale_number ? `Venta ${sale.sale_number}` : "Venta registrada",
        detail: saleStatusLabel(sale),
        amount: Number(sale.total_amount ?? 0),
        direction: sale.payment_status === "confirmed" ? "in" : "neutral",
      }));
    return [...cashEvents, ...saleEvents]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7);
  }, [movements, sales]);

  const isDark = darkMode;
  const page = isDark ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]";
  const panel = isDark ? "border-[#293241] bg-[#171D28]" : "border-[#EAECF0] bg-white";
  const muted = isDark ? "text-[#A0ABBC]" : "text-[#78808E]";
  const inset = isDark ? "bg-[#111824]" : "bg-[#F7F8FA]";

  const metricCards = [
    { label: "Caja disponible", value: money(metrics.cash), detail: "Cuentas activas · movimientos confirmados", icon: "▱", href: "/finanzas", tone: "orange" },
    { label: "Ventas con pago confirmado", value: money(metrics.monthlySales), detail: `${metrics.paidSaleCount} ventas este mes`, icon: "↗", href: "/ventas", tone: "green" },
    { label: "Ventas pendientes de pago", value: money(metrics.pendingSalesAmount), detail: `${metrics.pendingSaleCount} operaciones pendientes`, icon: "◷", href: "/ventas", tone: "blue" },
    { label: "Unidades en inventario", value: String(metrics.stockTotal), detail: `${metrics.productsWithStock} de ${metrics.activeProducts} variantes con stock`, icon: "◇", href: "/inventario", tone: "purple" },
  ];

  return (
    <div className={`min-h-full px-5 py-7 sm:px-8 lg:px-10 ${page}`}>
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className={`mb-2 text-[10px] font-semibold tracking-[2px] ${muted}`}>ELITE GAMMA / CENTRO DE OPERACIONES</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">Resumen general</h2>
            <p className={`mt-2 text-sm ${muted}`}>Indicadores actualizados desde tus registros de inventario, ventas y finanzas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-lg border px-3 py-2 text-xs ${panel} ${muted}`}>PEN · Soles peruanos</span>
            <button
              type="button"
              onClick={() => { setRefreshing(true); void loadData(false); }}
              disabled={loading || refreshing}
              className="rounded-lg bg-[#F39A38] px-4 py-2.5 text-xs font-bold text-[#1C2028] transition hover:bg-[#E88B2E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Actualizando…" : "↻ Actualizar"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <p className="font-semibold">No se pudo actualizar el resumen</p>
            <p className="mt-1 text-xs">{error}</p>
            <button type="button" onClick={() => void loadData(true)} className="mt-2 text-xs font-bold underline">Reintentar</button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <a key={metric.label} href={metric.href} className={`rounded-xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${panel}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${muted}`}>{metric.label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF1E2] text-lg font-bold text-[#D98B3C]">{metric.icon}</span>
              </div>
              <p className="mt-5 text-[25px] font-bold tracking-tight tabular-nums">{loading ? "—" : metric.value}</p>
              <p className={`mt-1 text-[11px] ${muted}`}>{loading ? "Cargando datos…" : metric.detail}</p>
            </a>
          ))}
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <div className={`rounded-xl border p-5 sm:p-6 ${panel}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Operación comercial</h3>
                <p className={`mt-1 text-xs ${muted}`}>Ventas cuyo pago fue confirmado y operaciones por cobrar.</p>
              </div>
              <a href="/ventas" className="text-xs font-bold text-[#D98B3C] hover:underline">Ir a ventas →</a>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className={`rounded-lg p-4 ${inset}`}>
                <p className={`text-[11px] ${muted}`}>Ventas confirmadas este mes</p>
                <p className="mt-2 text-xl font-bold tabular-nums">{loading ? "—" : metrics.paidSaleCount}</p>
              </div>
              <div className={`rounded-lg p-4 ${inset}`}>
                <p className={`text-[11px] ${muted}`}>Pendientes de pago</p>
                <p className="mt-2 text-xl font-bold tabular-nums">{loading ? "—" : metrics.pendingSaleCount}</p>
              </div>
              <div className={`rounded-lg p-4 ${inset}`}>
                <p className={`text-[11px] ${muted}`}>Clientes registrados</p>
                <p className="mt-2 text-xl font-bold tabular-nums">{loading ? "—" : customerCount}</p>
              </div>
            </div>
            {!loading && metrics.paidSaleCount === 0 && metrics.pendingSaleCount === 0 && (
              <div className={`mt-4 rounded-lg border border-dashed p-5 text-center ${isDark ? "border-[#354153]" : "border-[#E4E7EC]"}`}>
                <p className="text-sm font-semibold">Todavía no hay ventas en curso</p>
                <p className={`mt-1 text-xs ${muted}`}>Cuando registres operaciones reales, sus pagos confirmados y pendientes aparecerán aquí.</p>
              </div>
            )}
          </div>

          <div className={`rounded-xl border p-5 sm:p-6 ${panel}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Estado del inventario</h3>
                <p className={`mt-1 text-xs ${muted}`}>Existencias físicas y alertas de reposición.</p>
              </div>
              <a href="/inventario" className="text-xs font-bold text-[#D98B3C] hover:underline">Ver inventario →</a>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className={`text-[11px] ${muted}`}>Unidades disponibles</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{loading ? "—" : metrics.stockTotal}</p>
              </div>
              <p className={`text-right text-xs ${muted}`}>{loading ? "" : `${metrics.productsWithStock} variantes con existencias`}</p>
            </div>
            {!loading && metrics.zeroStock.length === 0 && metrics.lowStock.length === 0 ? (
              <div className={`mt-4 rounded-lg p-3 text-xs ${inset}`}>No hay alertas de stock mínimo configurado.</div>
            ) : (
              <div className="mt-4 space-y-2">
                {loading ? <p className={`text-xs ${muted}`}>Cargando existencias…</p> : [...metrics.zeroStock, ...metrics.lowStock].slice(0, 4).map((product) => {
                  const quantity = stockMap.get(product.id) ?? 0;
                  return (
                    <div key={product.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${inset}`}>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{product.name}</p>
                        <p className={`mt-0.5 truncate text-[10px] ${muted}`}>{product.sku ?? "Sin SKU"}</p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${quantity <= 0 ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                        {quantity <= 0 ? "Sin stock" : `${quantity} u.`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.3fr]">
          <div className={`rounded-xl border p-5 sm:p-6 ${panel}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Pendientes de atención</h3>
                <p className={`mt-1 text-xs ${muted}`}>Importes y diferencias que requieren revisión.</p>
              </div>
              <a href="/finanzas" className="text-xs font-bold text-[#D98B3C] hover:underline">Ver finanzas →</a>
            </div>
            <div className="mt-5 space-y-3">
              <div className={`flex items-center justify-between gap-3 rounded-lg p-3 ${inset}`}>
                <div>
                  <p className="text-xs font-semibold">Gastos pendientes de confirmar</p>
                  <p className={`mt-1 text-[10px] ${muted}`}>{metrics.pendingExpensesCount} registros · no descuentan caja</p>
                </div>
                <p className="text-sm font-bold tabular-nums">{loading ? "—" : money(metrics.pendingExpensesAmount)}</p>
              </div>
              <div className={`flex items-center justify-between gap-3 rounded-lg p-3 ${inset}`}>
                <div>
                  <p className="text-xs font-semibold">Importes por verificar</p>
                  <p className={`mt-1 text-[10px] ${muted}`}>{metrics.unverifiedCount} registros · sin clasificación confirmada</p>
                </div>
                <p className="text-sm font-bold tabular-nums">{loading ? "—" : money(metrics.unverifiedAmount)}</p>
              </div>
              <div className={`flex items-center justify-between gap-3 rounded-lg p-3 ${inset}`}>
                <div>
                  <p className="text-xs font-semibold">Diferencias de inventario por identificar</p>
                  <p className={`mt-1 text-[10px] ${muted}`}>Sin causa asignada; requieren conciliación</p>
                </div>
                <p className="text-sm font-bold tabular-nums">{loading ? "—" : metrics.pendingDiscrepancyCount}</p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-5 sm:p-6 ${panel}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Actividad reciente</h3>
                <p className={`mt-1 text-xs ${muted}`}>Movimientos confirmados y ventas registradas.</p>
              </div>
              <a href="/finanzas" className="text-xs font-bold text-[#D98B3C] hover:underline">Libro de caja →</a>
            </div>
            {loading ? (
              <p className={`mt-6 text-xs ${muted}`}>Cargando actividad…</p>
            ) : activity.length === 0 ? (
              <div className={`mt-5 rounded-lg border border-dashed p-7 text-center ${isDark ? "border-[#354153]" : "border-[#E4E7EC]"}`}>
                <p className="text-sm font-semibold">Todavía no hay actividad registrada</p>
                <p className={`mt-1 text-xs ${muted}`}>Los movimientos aparecerán aquí cuando se registren operaciones.</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-[#667085]/15">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.title}</p>
                      <p className={`mt-1 truncate text-[10px] ${muted}`}>{formatDateTime(item.date)} · {item.detail}</p>
                    </div>
                    <p className={`shrink-0 text-xs font-bold tabular-nums ${item.direction === "in" ? "text-emerald-500" : item.direction === "out" ? "text-red-400" : muted}`}>
                      {item.direction === "in" ? "+" : item.direction === "out" ? "−" : ""}{money(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 pb-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">Accesos rápidos</h3>
              <p className={`mt-1 text-xs ${muted}`}>Continúa administrando tu negocio.</p>
            </div>
            {lastUpdated && <p className={`text-[10px] ${muted}`}>Actualizado: {formatDateTime(lastUpdated)}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Productos", detail: "Catálogo, costos y precios", href: "/productos", icon: "◇" },
              { title: "Compras", detail: "Adquisiciones y recepción", href: "/compras", icon: "▤" },
              { title: "Ventas", detail: "Cobros, pedidos y entregas", href: "/ventas", icon: "↗" },
              { title: "Clientes", detail: "Contactos e historial", href: "/clientes", icon: "♧" },
              { title: "Inventario", detail: "Stock y conteos físicos", href: "/inventario", icon: "▦" },
              { title: "Finanzas", detail: "Caja, gastos y obligaciones", href: "/finanzas", icon: "▱" },
              { title: "Proveedores", detail: "Directorio de abastecimiento", href: "/proveedores", icon: "▣" },
              { title: "Reportes", detail: "Próximamente", href: "/#reportes", icon: "⌁" },
            ].map((item) => (
              <a key={item.title} href={item.href} className={`group flex items-center gap-3 rounded-xl border p-4 transition hover:border-[#E4B47D] ${panel}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF1E2] text-lg font-bold text-[#D98B3C]">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{item.title}</span>
                  <span className={`mt-1 block truncate text-[10px] ${muted}`}>{item.detail}</span>
                </span>
                <span className="ml-auto text-xs text-[#D98B3C] opacity-0 transition group-hover:opacity-100">→</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
