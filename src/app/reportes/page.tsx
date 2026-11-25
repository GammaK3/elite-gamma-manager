"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Period = "7d" | "30d" | "90d" | "year";

type Sale = {
  id: string;
  sale_number: string | null;
  sale_date: string;
  payment_confirmed_at: string | null;
  channel: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  discount_amount: number | string;
};

type Payment = {
  id: string;
  sale_id: string;
  amount: number | string;
  payment_status: string;
  payment_method: string;
  received_at: string | null;
  created_at: string;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number | string;
  unit_price: number | string;
  unit_cost_snapshot: number | string;
  discount_amount: number | string;
  cost_status_snapshot: string | null;
};

type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number | string;
  expense_date: string;
  payment_status: string;
  record_status: string;
  paid_at: string | null;
};

type ProductSummary = {
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
};

type DaySummary = {
  key: string;
  label: string;
  amount: number;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "year", label: "Este año" },
];

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function number(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRange(period: Period) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start: Date;

  if (period === "7d") start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  else if (period === "30d") start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  else if (period === "90d") start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
  else start = new Date(now.getFullYear(), 0, 1);

  return { start, end };
}

function inRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp < end.getTime();
}

function inRangeMs(value: string | null | undefined, startMs: number, endMs: number) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= startMs && timestamp < endMs;
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(date);
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    facebook_marketplace: "Facebook Marketplace",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    other: "Otro canal",
  };
  return labels[channel] ?? channel.replaceAll("_", " ");
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    software_subscriptions: "Suscripciones de software",
    telecommunications: "Telecomunicaciones",
    shipping: "Transporte y envíos",
    supplies: "Suministros",
    advertising: "Publicidad",
    services: "Servicios",
    other: "Otros",
  };
  return labels[category] ?? category.replaceAll("_", " ");
}

export default function ReportesPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [dateWindow, setDateWindow] = useState<{ startMs: number; endMs: number } | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
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
    else setRefreshing(true);
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

      const [salesResult, paymentsResult, expensesResult] = await Promise.all([
        supabase
          .from("sales")
          .select("id,sale_number,sale_date,payment_confirmed_at,channel,status,payment_status,total_amount,discount_amount")
          .eq("business_id", business.id)
          .order("sale_date", { ascending: false })
          .limit(2000),
        supabase
          .from("payments")
          .select("id,sale_id,amount,payment_status,payment_method,received_at,created_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("expenses")
          .select("id,description,category,amount,expense_date,payment_status,record_status,paid_at")
          .eq("business_id", business.id)
          .order("expense_date", { ascending: false })
          .limit(2000),
      ]);

      const failed = [
        ["Ventas", salesResult.error],
        ["Pagos", paymentsResult.error],
        ["Gastos", expensesResult.error],
      ] as const;
      const firstFailure = failed.find(([, queryError]) => queryError);
      if (firstFailure) throw new Error(`${firstFailure[0]}: ${firstFailure[1]?.message}`);

      const loadedSales = (salesResult.data ?? []) as Sale[];
      const range = getRange(period);
      setDateWindow({ startMs: range.start.getTime(), endMs: range.end.getTime() });
      const paidSaleIds = loadedSales
        .filter((sale) => sale.payment_status === "confirmed" && inRange(sale.payment_confirmed_at, range.start, range.end))
        .map((sale) => sale.id);

      let loadedItems: SaleItem[] = [];
      if (paidSaleIds.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("sale_items")
          .select("id,sale_id,product_id,product_name_snapshot,sku_snapshot,quantity,unit_price,unit_cost_snapshot,discount_amount,cost_status_snapshot")
          .eq("business_id", business.id)
          .in("sale_id", paidSaleIds)
          .limit(10000);
        if (itemError) throw new Error(`Productos vendidos: ${itemError.message}`);
        loadedItems = (itemData ?? []) as SaleItem[];
      }

      setSales(loadedSales);
      setPayments((paymentsResult.data ?? []) as Payment[]);
      setExpenses((expensesResult.data ?? []) as Expense[]);
      setItems(loadedItems);
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const report = useMemo(() => {
    const isInSelectedRange = (value: string | null | undefined) =>
      dateWindow ? inRangeMs(value, dateWindow.startMs, dateWindow.endMs) : false;
    const paidPayments = payments.filter(
      (payment) => payment.payment_status === "confirmed" && isInSelectedRange(payment.received_at)
    );
    const collected = paidPayments.reduce((sum, payment) => sum + number(payment.amount), 0);

    const paidSales = sales.filter(
      (sale) => sale.payment_status === "confirmed" && isInSelectedRange(sale.payment_confirmed_at)
    );
    const paidSalesTotal = paidSales.reduce((sum, sale) => sum + number(sale.total_amount), 0);

    const pendingSales = sales.filter((sale) => ["pending_payment", "draft"].includes(sale.status));
    const confirmedBySale = new Map<string, number>();
    payments
      .filter((payment) => payment.payment_status === "confirmed")
      .forEach((payment) => confirmedBySale.set(
        payment.sale_id,
        (confirmedBySale.get(payment.sale_id) ?? 0) + number(payment.amount)
      ));
    const pendingBalance = pendingSales
      .filter((sale) => sale.status === "pending_payment")
      .reduce((sum, sale) => sum + Math.max(0, number(sale.total_amount) - (confirmedBySale.get(sale.id) ?? 0)), 0);

    const paidExpenses = expenses.filter(
      (expense) => expense.record_status === "recorded" && expense.payment_status === "confirmed" && isInSelectedRange(expense.paid_at)
    );
    const paidExpenseTotal = paidExpenses.reduce((sum, expense) => sum + number(expense.amount), 0);

    const productsMap = new Map<string, ProductSummary>();
    for (const item of items) {
      const key = item.product_id;
      const current = productsMap.get(key) ?? {
        name: item.product_name_snapshot || "Producto sin nombre",
        sku: item.sku_snapshot || "—",
        quantity: 0,
        revenue: 0,
      };
      const quantity = number(item.quantity);
      current.quantity += quantity;
      current.revenue += Math.max(0, quantity * number(item.unit_price) - number(item.discount_amount));
      productsMap.set(key, current);
    }
    const topProducts = Array.from(productsMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const channelMap = new Map<string, number>();
    for (const sale of paidSales) {
      channelMap.set(sale.channel, (channelMap.get(sale.channel) ?? 0) + number(sale.total_amount));
    }
    const channels = Array.from(channelMap.entries())
      .map(([channel, amount]) => ({ label: channelLabel(channel), amount }))
      .sort((a, b) => b.amount - a.amount);

    const expenseMap = new Map<string, number>();
    for (const expense of paidExpenses) {
      expenseMap.set(expense.category, (expenseMap.get(expense.category) ?? 0) + number(expense.amount));
    }
    const expenseCategories = Array.from(expenseMap.entries())
      .map(([category, amount]) => ({ label: categoryLabel(category), amount }))
      .sort((a, b) => b.amount - a.amount);

    const dayMap = new Map<string, number>();
    for (const sale of paidSales) {
      const date = new Date(sale.payment_confirmed_at || sale.sale_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      dayMap.set(key, (dayMap.get(key) ?? 0) + number(sale.total_amount));
    }
    const dailySales: DaySummary[] = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([key, amount]) => ({
        key,
        label: shortDate(`${key}T12:00:00`),
        amount,
      }));

    return {
      collected,
      paidSalesTotal,
      paidSalesCount: paidSales.length,
      pendingBalance,
      pendingSalesCount: pendingSales.filter((sale) => sale.status === "pending_payment").length,
      paidExpenseTotal,
      paidExpenseCount: paidExpenses.length,
      operatingDifference: collected - paidExpenseTotal,
      topProducts,
      channels,
      expenseCategories,
      dailySales,
    };
  }, [dateWindow, sales, payments, items, expenses]);

  const card = darkMode
    ? "border-[#293241] bg-[#171D28] text-[#E7EAF0]"
    : "border-[#E5E7EB] bg-white text-[#20232B]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#667085]";
  const inset = darkMode ? "bg-[#111722]" : "bg-[#F7F8FA]";
  const accentText = darkMode ? "text-[#F4A340]" : "text-[#C87916]";
  const formatUpdated = lastUpdated
    ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(lastUpdated))
    : "—";
  const maxDaily = Math.max(1, ...report.dailySales.map((day) => day.amount));
  const maxProduct = Math.max(1, ...report.topProducts.map((product) => product.quantity));
  const maxChannel = Math.max(1, ...report.channels.map((channel) => channel.amount));
  const maxExpense = Math.max(1, ...report.expenseCategories.map((category) => category.amount));

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-7 sm:px-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className={`text-[10px] font-bold tracking-[2px] ${muted}`}>ELITE GAMMA / INTELIGENCIA DEL NEGOCIO</p>
          <h1 className="mt-2 text-2xl font-bold">Reportes y análisis</h1>
          <p className={`mt-1 text-sm ${muted}`}>Ventas cobradas, gastos pagados y comportamiento comercial.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex rounded-xl border p-1 ${darkMode ? "border-[#293241] bg-[#111722]" : "border-[#E5E7EB] bg-white"}`}>
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  period === item.value
                    ? "bg-[#F39A38] text-[#1B1D22]"
                    : `${muted} hover:text-current`
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadData(false)}
            disabled={refreshing || loading}
            className="rounded-xl bg-[#F39A38] px-4 py-2.5 text-xs font-bold text-[#1B1D22] disabled:opacity-60"
          >
            {refreshing ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          <strong className="block">No se pudieron cargar los reportes</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void loadData(true)} className="ml-2 underline">Reintentar</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className={`rounded-2xl border p-5 ${card}`}>
          <p className={`text-xs ${muted}`}>Cobros de ventas confirmados</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{loading ? "—" : money(report.collected)}</p>
          <p className={`mt-2 text-[11px] ${muted}`}>{report.paidSalesCount} ventas completadas en el periodo</p>
        </section>
        <section className={`rounded-2xl border p-5 ${card}`}>
          <p className={`text-xs ${muted}`}>Ventas pendientes de pago</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{loading ? "—" : money(report.pendingBalance)}</p>
          <p className={`mt-2 text-[11px] ${muted}`}>{report.pendingSalesCount} operaciones pendientes</p>
        </section>
        <section className={`rounded-2xl border p-5 ${card}`}>
          <p className={`text-xs ${muted}`}>Gastos pagados</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{loading ? "—" : money(report.paidExpenseTotal)}</p>
          <p className={`mt-2 text-[11px] ${muted}`}>{report.paidExpenseCount} pagos confirmados en el periodo</p>
        </section>
        <section className={`rounded-2xl border p-5 ${card}`}>
          <p className={`text-xs ${muted}`}>Cobros menos gastos pagados</p>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${report.operatingDifference >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {loading ? "—" : money(report.operatingDifference)}
          </p>
          <p className={`mt-2 text-[11px] ${muted}`}>No representa utilidad neta ni incluye todos los movimientos de caja.</p>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Ventas completadas</h2>
              <p className={`mt-1 text-xs ${muted}`}>Importe de ventas con el 100 % del pago confirmado.</p>
            </div>
            <span className={`text-xs ${muted}`}>{report.paidSalesCount} ventas · {money(report.paidSalesTotal)}</span>
          </div>
          {loading ? (
            <div className={`mt-5 h-40 animate-pulse rounded-xl ${inset}`} />
          ) : report.dailySales.length === 0 ? (
            <div className={`mt-5 flex min-h-40 items-center justify-center rounded-xl border border-dashed p-6 text-center ${darkMode ? "border-[#344052]" : "border-[#D0D5DD]"}`}>
              <div>
                <p className="text-sm font-semibold">Sin ventas completadas en este periodo</p>
                <p className={`mt-1 text-xs ${muted}`}>El gráfico aparecerá cuando existan ventas pagadas y confirmadas.</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex h-44 items-end gap-2">
              {report.dailySales.map((day) => (
                <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className={`truncate text-[10px] ${muted}`} title={money(day.amount)}>{day.amount > 0 ? money(day.amount).replace("PEN", "S/").replace(",", "") : ""}</span>
                  <div className="flex h-28 w-full items-end overflow-hidden rounded-t-md bg-[#F39A38]/10">
                    <div className="w-full rounded-t-md bg-[#F39A38]" style={{ height: `${Math.max(4, (day.amount / maxDaily) * 100)}%` }} />
                  </div>
                  <span className={`text-[10px] ${muted}`}>{day.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-5 ${card}`}>
          <div>
            <h2 className="font-bold">Canales de venta</h2>
            <p className={`mt-1 text-xs ${muted}`}>Distribución por ventas completamente pagadas.</p>
          </div>
          {report.channels.length === 0 ? (
            <p className={`mt-8 rounded-xl ${inset} p-6 text-center text-sm ${muted}`}>Todavía no hay ventas por canal.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {report.channels.map((channel) => (
                <div key={channel.label}>
                  <div className="mb-1.5 flex justify-between gap-3 text-xs">
                    <span className="font-medium">{channel.label}</span>
                    <span className={muted}>{money(channel.amount)}</span>
                  </div>
                  <div className={`h-2 overflow-hidden rounded-full ${inset}`}>
                    <div className="h-full rounded-full bg-[#F39A38]" style={{ width: `${Math.min(100, (channel.amount / maxChannel) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div>
            <h2 className="font-bold">Productos más vendidos</h2>
            <p className={`mt-1 text-xs ${muted}`}>Unidades de ventas completamente pagadas.</p>
          </div>
          {report.topProducts.length === 0 ? (
            <p className={`mt-5 rounded-xl ${inset} p-6 text-center text-sm ${muted}`}>Todavía no hay productos vendidos en el periodo.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {report.topProducts.map((product) => (
                <div key={product.sku + product.name}>
                  <div className="mb-1 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{product.name}</p>
                      <p className={muted}>{product.sku}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold">{product.quantity} un.</p>
                      <p className={muted}>{money(product.revenue)}</p>
                    </div>
                  </div>
                  <div className={`h-2 overflow-hidden rounded-full ${inset}`}>
                    <div className="h-full rounded-full bg-[#F39A38]" style={{ width: `${Math.max(4, (product.quantity / maxProduct) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-5 ${card}`}>
          <div>
            <h2 className="font-bold">Gastos por categoría</h2>
            <p className={`mt-1 text-xs ${muted}`}>Solo pagos efectivamente confirmados.</p>
          </div>
          {report.expenseCategories.length === 0 ? (
            <p className={`mt-5 rounded-xl ${inset} p-6 text-center text-sm ${muted}`}>No hay gastos pagados en este periodo.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {report.expenseCategories.map((category) => (
                <div key={category.label}>
                  <div className="mb-1 flex justify-between gap-3 text-xs">
                    <span className="font-medium">{category.label}</span>
                    <span className={muted}>{money(category.amount)}</span>
                  </div>
                  <div className={`h-2 overflow-hidden rounded-full ${inset}`}>
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, (category.amount / maxExpense) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold">Rentabilidad y utilidad</h2>
            <p className={`mt-1 text-xs ${muted}`}>Este indicador se habilitará cuando terminemos de conciliar los costos de adquisición y definamos el método de valoración del inventario.</p>
          </div>
          <span className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${darkMode ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
            En conciliación
          </span>
        </div>
        <div className={`mt-4 rounded-xl ${inset} p-4`}>
          <p className="text-sm font-semibold">No mostraremos una ganancia estimada todavía.</p>
          <p className={`mt-1 text-xs ${muted}`}>Los costos históricos y algunos gastos de adquisición aún requieren revisión. Esta precaución evita presentar márgenes o utilidades que podrían ser incorrectos.</p>
        </div>
      </section>

      <div className={`flex flex-col gap-1 border-t pt-4 text-[11px] ${darkMode ? "border-[#293241] text-[#7F8A9C]" : "border-[#E5E7EB] text-[#667085]"}`}>
        <span>Los reportes utilizan cobros y gastos confirmados. Los pagos pendientes y los importes por verificar no se consideran ingresos ni egresos efectivos.</span>
        <span>Última actualización: {formatUpdated} · Moneda: PEN</span>
      </div>
    </main>
  );
}
