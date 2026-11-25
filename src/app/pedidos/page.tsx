"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  id: string;
  customer_id: string | null;
  sale_number: string | null;
  sale_date: string;
  channel: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  district: string | null;
};

type Delivery = {
  id: string;
  sale_id: string;
  provider: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string | null;
  address_reference: string | null;
  delivery_cost: number | string;
  delivery_paid_by: string;
  delivery_status: string;
  driver_reference: string | null;
  confirmation_code_received_at: string | null;
  delivered_at: string | null;
  notes: string | null;
};

type SaleItem = {
  id: string;
  sale_id: string;
  quantity: number;
  unit_price: number | string;
  product_name_snapshot: string | null;
  sku_snapshot: string | null;
};

type FilterKey = "active" | "payment" | "preparation" | "delivery" | "incident" | "delivered" | "all";

type DeliveryForm = {
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  address_reference: string;
  delivery_cost: string;
  notes: string;
};

const emptyDeliveryForm: DeliveryForm = {
  recipient_name: "",
  recipient_phone: "",
  delivery_address: "",
  address_reference: "",
  delivery_cost: "",
  notes: "",
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(numberValue(value));
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function saleStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    pending_payment: "Pendiente de pago",
    paid: "Pagada · por preparar",
    preparing: "En preparación",
    shipped: "En reparto",
    delivered: "Entregada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

function deliveryStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: "Pendiente de coordinación",
    requested: "Solicitada a inDrive",
    picked_up: "Recogida por conductor",
    in_transit: "En tránsito",
    delivered: "Entregada",
    failed: "Con incidencia",
    cancelled: "Cancelada",
  };
  return status ? labels[status] ?? status : "Sin entrega registrada";
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    facebook_marketplace: "Facebook Marketplace",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    other: "Otro canal",
  };
  return labels[channel] ?? channel;
}

function badgeClass(status: string, darkMode: boolean) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold";
  if (["delivered", "paid"].includes(status)) {
    return `${base} ${darkMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`;
  }
  if (["pending_payment", "draft", "requested", "pending"].includes(status)) {
    return `${base} ${darkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-700"}`;
  }
  if (["failed", "cancelled"].includes(status)) {
    return `${base} ${darkMode ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-rose-200 bg-rose-50 text-rose-700"}`;
  }
  return `${base} ${darkMode ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-sky-200 bg-sky-50 text-sky-700"}`;
}

function getOperationalGroup(sale: Sale, delivery: Delivery | undefined) {
  if (sale.status === "cancelled") return "cancelled";
  if (sale.status === "delivered" || delivery?.delivery_status === "delivered") return "delivered";
  if (delivery?.delivery_status === "failed") return "incident";
  if (sale.status === "shipped" || ["picked_up", "in_transit"].includes(delivery?.delivery_status ?? "")) return "delivery";
  if (["paid", "preparing"].includes(sale.status) && sale.payment_status === "confirmed") return "preparation";
  if (sale.status === "pending_payment" || sale.status === "draft") return "payment";
  return "other";
}

export default function PedidosPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("ELITE GAMMA");
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deliveryEditing, setDeliveryEditing] = useState(false);
  const [driverReference, setDriverReference] = useState("");
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(emptyDeliveryForm);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem("elite-gamma-theme") === "dark");
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ darkMode: boolean }>;
      setDarkMode(Boolean(customEvent.detail?.darkMode));
    };
    window.addEventListener("elite-gamma-theme-change", handleThemeChange);
    return () => window.removeEventListener("elite-gamma-theme-change", handleThemeChange);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: business, error: businessError } = await supabase
        .from("businesses").select("id,name").limit(1).maybeSingle();
      if (businessError) throw new Error(`Negocio: ${businessError.message}`);
      if (!business) throw new Error("No encontramos ELITE GAMMA asociado a tu usuario.");
      setBusinessId(business.id);
      setBusinessName(business.name ?? "ELITE GAMMA");

      const [salesResult, customersResult, deliveriesResult] = await Promise.all([
        supabase.from("sales")
          .select("id,customer_id,sale_number,sale_date,channel,status,payment_status,total_amount,notes,created_at,updated_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(250),
        supabase.from("customers")
          .select("id,full_name,phone,address,district")
          .eq("business_id", business.id)
          .order("full_name", { ascending: true }),
        supabase.from("deliveries")
          .select("id,sale_id,provider,recipient_name,recipient_phone,delivery_address,address_reference,delivery_cost,delivery_paid_by,delivery_status,driver_reference,confirmation_code_received_at,delivered_at,notes")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(250),
      ]);

      if (salesResult.error) throw new Error(`Pedidos / ventas: ${salesResult.error.message}`);
      if (customersResult.error) throw new Error(`Clientes: ${customersResult.error.message}`);
      if (deliveriesResult.error) throw new Error(`Entregas: ${deliveriesResult.error.message}`);

      const nextSales = (salesResult.data ?? []) as Sale[];
      const nextDeliveries = (deliveriesResult.data ?? []) as Delivery[];
      setSales(nextSales);
      setCustomers((customersResult.data ?? []) as Customer[]);
      setDeliveries(nextDeliveries);
      setSelectedSaleId((current) => current && nextSales.some((sale) => sale.id === current)
        ? current
        : nextSales.find((sale) => !["cancelled", "delivered"].includes(sale.status))?.id ?? nextSales[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId]
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedSale?.customer_id) ?? null,
    [customers, selectedSale]
  );
  const selectedDelivery = useMemo(
    () => deliveries.find((delivery) => delivery.sale_id === selectedSaleId),
    [deliveries, selectedSaleId]
  );

  const loadItems = useCallback(async (saleId: string) => {
    if (!businessId || !saleId) { setItems([]); return; }
    setDetailLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase.from("sale_items")
        .select("id,sale_id,quantity,unit_price,product_name_snapshot,sku_snapshot")
        .eq("business_id", businessId)
        .eq("sale_id", saleId)
        .order("created_at", { ascending: true });
      if (queryError) throw new Error(`Productos del pedido: ${queryError.message}`);
      setItems((data ?? []) as SaleItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el detalle del pedido.");
    } finally {
      setDetailLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId && selectedSaleId) void loadItems(selectedSaleId);
    else setItems([]);
  }, [businessId, selectedSaleId, loadItems]);

  useEffect(() => {
    if (!selectedSale) {
      setDeliveryForm(emptyDeliveryForm);
      setDriverReference("");
      setDeliveryEditing(false);
      return;
    }
    const delivery = deliveries.find((item) => item.sale_id === selectedSale.id);
    setDeliveryForm({
      recipient_name: delivery?.recipient_name ?? selectedCustomer?.full_name ?? "",
      recipient_phone: delivery?.recipient_phone ?? selectedCustomer?.phone ?? "",
      delivery_address: delivery?.delivery_address ?? [selectedCustomer?.address, selectedCustomer?.district].filter(Boolean).join(", "),
      address_reference: delivery?.address_reference ?? "",
      delivery_cost: delivery ? numberValue(delivery.delivery_cost).toFixed(2) : "",
      notes: delivery?.notes ?? "",
    });
    setDriverReference(delivery?.driver_reference ?? "");
    setDeliveryEditing(false);
  }, [selectedSaleId, selectedSale, selectedCustomer, deliveries]);

  const stats = useMemo(() => {
    const groups = sales.map((sale) => ({ sale, group: getOperationalGroup(sale, deliveries.find((delivery) => delivery.sale_id === sale.id)) }));
    return {
      payment: groups.filter(({ group }) => group === "payment").length,
      preparation: groups.filter(({ group }) => group === "preparation").length,
      delivery: groups.filter(({ group }) => group === "delivery").length,
      incident: groups.filter(({ group }) => group === "incident").length,
      delivered: groups.filter(({ group }) => group === "delivered").length,
    };
  }, [sales, deliveries]);

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((sale) => {
      const delivery = deliveries.find((item) => item.sale_id === sale.id);
      const group = getOperationalGroup(sale, delivery);
      if (filter === "active" && !["payment", "preparation", "delivery", "incident"].includes(group)) return false;
      if (filter === "payment" && group !== "payment") return false;
      if (filter === "preparation" && group !== "preparation") return false;
      if (filter === "delivery" && group !== "delivery") return false;
      if (filter === "incident" && group !== "incident") return false;
      if (filter === "delivered" && group !== "delivered") return false;
      if (!term) return true;
      const customer = customers.find((item) => item.id === sale.customer_id);
      return [sale.sale_number ?? "", customer?.full_name ?? "", customer?.phone ?? "", channelLabel(sale.channel), delivery?.recipient_name ?? ""]
        .join(" ").toLowerCase().includes(term);
    });
  }, [sales, deliveries, customers, filter, search]);

  // Keep the detail panel synchronized with the visible queue. A cancelled or
  // otherwise filtered-out sale must never remain selected in an active view.
  useEffect(() => {
    if (filteredSales.length === 0) {
      if (selectedSaleId) setSelectedSaleId("");
      return;
    }
    if (!filteredSales.some((sale) => sale.id === selectedSaleId)) {
      setSelectedSaleId(filteredSales[0].id);
    }
  }, [filteredSales, selectedSaleId]);

  async function refreshSelected(saleId: string) {
    await loadData();
    if (saleId) await loadItems(saleId);
  }

  async function markPreparing() {
    if (!businessId || !selectedSale) return;
    if (selectedSale.payment_status !== "confirmed" || selectedSale.status !== "paid") {
      setError("Solo puedes preparar pedidos con el pago completo confirmado.");
      return;
    }
    if (!window.confirm(`¿Marcar ${selectedSale.sale_number ?? "este pedido"} como en preparación?`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("mark_sale_preparing", {
        p_business_id: businessId,
        p_sale_id: selectedSale.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await refreshSelected(selectedSale.id);
      setSuccess("Pedido marcado en preparación. El pago ya estaba confirmado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el pedido.");
    } finally { setSaving(false); }
  }

  async function saveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !selectedSale) return;
    if (!["paid", "preparing"].includes(selectedSale.status) || selectedSale.payment_status !== "confirmed") {
      setError("La entrega solo se puede coordinar después de confirmar el pago completo.");
      return;
    }
    const cost = Number(deliveryForm.delivery_cost);
    if (!deliveryForm.recipient_name.trim() || !deliveryForm.recipient_phone.trim() || !deliveryForm.delivery_address.trim()) {
      setError("Completa nombre, teléfono y dirección del destinatario.");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setError("El costo de inDrive debe ser un importe válido en soles.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("save_sale_delivery", {
        p_business_id: businessId,
        p_sale_id: selectedSale.id,
        p_recipient_name: deliveryForm.recipient_name.trim(),
        p_recipient_phone: deliveryForm.recipient_phone.trim(),
        p_delivery_address: deliveryForm.delivery_address.trim(),
        p_address_reference: deliveryForm.address_reference.trim() || null,
        p_delivery_cost: cost,
        p_notes: deliveryForm.notes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setDeliveryEditing(false);
      await refreshSelected(selectedSale.id);
      setSuccess("Entrega inDrive guardada. El cliente paga directamente al conductor; no se registró en caja.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la entrega.");
    } finally { setSaving(false); }
  }

  async function updateDeliveryStatus(nextStatus: "picked_up" | "in_transit" | "failed" | "requested") {
    if (!businessId || !selectedDelivery) return;
    const labels: Record<string, string> = {
      requested: "solicitada", picked_up: "recogida por el conductor", in_transit: "en tránsito", failed: "con incidencia",
    };
    if (!window.confirm(`¿Actualizar la entrega a «${labels[nextStatus]}»?`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("update_sale_delivery_status", {
        p_business_id: businessId,
        p_delivery_id: selectedDelivery.id,
        p_delivery_status: nextStatus,
        p_driver_reference: driverReference.trim() || null,
        p_notes: deliveryForm.notes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      await refreshSelected(selectedSaleId);
      setSuccess("Estado de entrega actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la entrega.");
    } finally { setSaving(false); }
  }

  async function confirmDelivery() {
    if (!businessId || !selectedDelivery) return;
    const accepted = window.confirm("Confirma solo cuando el destinatario te haya comunicado el código de entrega de inDrive. No escribas ni guardes el código aquí. ¿Confirmar entrega?");
    if (!accepted) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("confirm_sale_delivery", {
        p_business_id: businessId,
        p_delivery_id: selectedDelivery.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await refreshSelected(selectedSaleId);
      setSuccess("Entrega confirmada. Solo se guardó la fecha y hora; no se almacenó el código.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar la entrega.");
    } finally { setSaving(false); }
  }

  const pageBg = darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]";
  const surface = darkMode ? "border-[#293241] bg-[#171D28]" : "border-[#EAECF0] bg-white";
  const inner = darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#858C99]";
  const title = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const field = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[#E99A44] ${darkMode ? "border-[#354153] bg-[#101722] text-white placeholder:text-[#697589]" : "border-[#E5E7EB] bg-white text-[#20232B] placeholder:text-[#9CA3AF]"}`;
  const primaryButton = "rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28] transition hover:bg-[#F3AB5C] disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton = `rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "border-[#354153] text-[#A0ABBC] hover:bg-[#202938]" : "border-[#E5E7EB] text-[#596170] hover:bg-[#F5F6F8]"}`;

  if (loading) {
    return <div className={`flex min-h-[calc(100vh-68px)] items-center justify-center ${pageBg}`}><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#E99A44] border-t-transparent" /><p className={`text-sm ${muted}`}>Cargando pedidos de {businessName}...</p></div></div>;
  }

  return (
    <div className={`min-h-[calc(100vh-68px)] ${pageBg}`}>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className={`mb-2 text-[10px] font-bold tracking-[1.8px] ${muted}`}>ELITE GAMMA / OPERACIONES</p>
            <h2 className={`text-2xl font-bold ${title}`}>Pedidos y entregas</h2>
            <p className={`mt-2 max-w-2xl text-sm ${muted}`}>Prepara los pedidos con pago confirmado y controla su recorrido hasta la entrega.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/ventas" className={secondaryButton}>Ir a ventas ↗</a>
            <button type="button" onClick={() => void loadData()} className={primaryButton}>↻ Actualizar</button>
          </div>
        </div>

        {error && <div role="alert" className="mb-5 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-400">{error}</div>}
        {success && <div role="status" className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{success}</div>}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Pendientes de pago", value: String(stats.payment), detail: "Se gestionan en Ventas" },
            { label: "Por preparar", value: String(stats.preparation), detail: "Pago completo confirmado" },
            { label: "En reparto", value: String(stats.delivery), detail: "Con conductor de inDrive" },
            { label: "Con incidencia", value: String(stats.incident), detail: "Requieren seguimiento" },
            { label: "Entregados", value: String(stats.delivered), detail: "Entrega confirmada" },
          ].map((metric) => <div key={metric.label} className={`rounded-xl border p-4 ${surface}`}><p className={`text-[11px] ${muted}`}>{metric.label}</p><p className={`mt-2 text-2xl font-bold tabular-nums ${title}`}>{metric.value}</p><p className={`mt-1 text-[10px] ${muted}`}>{metric.detail}</p></div>)}
        </section>

        <section className={`mb-5 rounded-xl border p-3 ${surface}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número de pedido, cliente o teléfono..." className={`${field} lg:max-w-md`} />
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {([
                ["active", "Activos"], ["payment", "Por pagar"], ["preparation", "Por preparar"],
                ["delivery", "En reparto"], ["incident", "Incidencias"], ["delivered", "Entregados"], ["all", "Todos"],
              ] as [FilterKey, string][]).map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-semibold ${filter === key ? "border-[#E99A44] bg-[#E99A44] text-[#171D28]" : darkMode ? "border-[#354153] text-[#A0ABBC] hover:bg-[#202938]" : "border-[#E5E7EB] text-[#737987] hover:bg-[#F6F7F9]"}`}>{label}</button>)}
            </div>
          </div>
        </section>

        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(360px,0.9fr)_minmax(600px,1.35fr)]">
          <section className={`overflow-hidden rounded-xl border ${surface}`}>
            <div className={`border-b p-4 ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}>
              <h3 className={`text-sm font-bold ${title}`}>Cola de pedidos</h3>
              <p className={`mt-1 text-[11px] ${muted}`}>{filteredSales.length} resultado(s) · ordenados del más reciente al más antiguo</p>
            </div>
            <div className="max-h-[760px] overflow-y-auto">
              {filteredSales.length === 0 ? <div className="px-5 py-14 text-center">
                <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-xl ${darkMode ? "bg-[#202938]" : "bg-[#F5F6F8]"}`}>▣</div>
                <p className={`text-sm font-semibold ${title}`}>{sales.length === 0 ? "Todavía no hay pedidos" : "No hay pedidos en este filtro"}</p>
                <p className={`mx-auto mt-2 max-w-xs text-xs leading-5 ${muted}`}>{sales.length === 0 ? "Cuando registres ventas en Ventas, aparecerán aquí para coordinar su preparación y entrega." : "Prueba otra categoría o término de búsqueda."}</p>
                {sales.length === 0 && <a href="/ventas" className={`${primaryButton} mt-4 inline-flex`}>Ir a registrar una venta</a>}
              </div> : filteredSales.map((sale) => {
                const customer = customers.find((item) => item.id === sale.customer_id);
                const delivery = deliveries.find((item) => item.sale_id === sale.id);
                const group = getOperationalGroup(sale, delivery);
                const isSelected = sale.id === selectedSaleId;
                const groupStatus = group === "payment" ? sale.status : group === "delivery" ? (delivery?.delivery_status ?? sale.status) : group === "incident" ? "failed" : group === "delivered" ? "delivered" : sale.status;
                return <button key={sale.id} type="button" onClick={() => { setSelectedSaleId(sale.id); setError(""); setSuccess(""); }} className={`block w-full border-b px-4 py-4 text-left transition last:border-b-0 ${darkMode ? "border-[#293241]" : "border-[#F0F1F3]"} ${isSelected ? (darkMode ? "bg-[#222B39]" : "bg-[#FFF7EE]") : (darkMode ? "hover:bg-[#1D2532]" : "hover:bg-[#FAFBFC]")}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-bold ${title}`}>{sale.sale_number ?? "Pedido sin número"}</p>
                      <p className={`mt-1 truncate text-xs ${muted}`}>{customer?.full_name ?? "Cliente no especificado"}</p>
                      <p className={`mt-1 text-[10px] ${muted}`}>{channelLabel(sale.channel)} · {dateTime(sale.sale_date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold tabular-nums ${title}`}>{money(sale.total_amount)}</p>
                      <span className={badgeClass(groupStatus, darkMode)}>{group === "incident" ? "Incidencia" : group === "delivered" ? "Entregado" : group === "delivery" ? deliveryStatusLabel(delivery?.delivery_status) : group === "preparation" ? saleStatusLabel(sale.status) : saleStatusLabel(sale.status)}</span>
                    </div>
                  </div>
                </button>;
              })}
            </div>
          </section>

          <section className={`min-h-[540px] rounded-xl border p-5 ${surface}`}>
            {!selectedSale ? <div className="flex min-h-[500px] flex-col items-center justify-center text-center"><div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-xl ${darkMode ? "bg-[#202938]" : "bg-[#F5F6F8]"}`}>＋</div><h3 className={`text-sm font-bold ${title}`}>Selecciona un pedido</h3><p className={`mt-2 max-w-sm text-xs ${muted}`}>El detalle operativo y los controles de preparación aparecerán aquí.</p></div> : <div className="space-y-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className={`text-[10px] font-bold tracking-[1.5px] ${muted}`}>DETALLE DEL PEDIDO</p>
                  <h3 className={`mt-1 text-xl font-bold ${title}`}>{selectedSale.sale_number ?? "Pedido sin número"}</h3>
                  <p className={`mt-1 text-xs ${muted}`}>{dateTime(selectedSale.sale_date)} · {channelLabel(selectedSale.channel)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={badgeClass(selectedSale.status, darkMode)}>{saleStatusLabel(selectedSale.status)}</span>
                  <span className={badgeClass(selectedSale.payment_status === "confirmed" ? "paid" : "pending_payment", darkMode)}>{selectedSale.payment_status === "confirmed" ? "Pago confirmado" : "Pago no confirmado"}</span>
                </div>
              </div>

              <div className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-3 ${inner}`}>
                <div><p className={`text-[10px] ${muted}`}>Cliente</p><p className={`mt-1 text-xs font-semibold ${title}`}>{selectedCustomer?.full_name ?? "No especificado"}</p><p className={`mt-1 text-[10px] ${muted}`}>{selectedCustomer?.phone ?? "Sin teléfono"}</p></div>
                <div><p className={`text-[10px] ${muted}`}>Total de productos</p><p className={`mt-1 text-sm font-bold ${title}`}>{money(selectedSale.total_amount)}</p></div>
                <div><p className={`text-[10px] ${muted}`}>Estado operativo</p><p className={`mt-1 text-xs font-semibold ${title}`}>{deliveryStatusLabel(selectedDelivery?.delivery_status) || "Sin entrega"}</p></div>
              </div>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3"><h4 className={`text-xs font-bold uppercase tracking-wide ${title}`}>Productos del pedido</h4>{detailLoading && <span className={`text-[10px] ${muted}`}>Cargando...</span>}</div>
                {items.length === 0 ? <p className={`rounded-lg border p-3 text-xs ${muted} ${inner}`}>No hay líneas de productos visibles en este pedido.</p> : <div className={`overflow-hidden rounded-lg border ${darkMode ? "border-[#354153]" : "border-[#EAECF0]"}`}>
                  {items.map((item) => <div key={item.id} className={`flex items-center justify-between gap-3 border-b p-3 last:border-b-0 ${darkMode ? "border-[#293241]" : "border-[#F0F1F3]"}`}><div className="min-w-0"><p className={`truncate text-xs font-semibold ${title}`}>{item.product_name_snapshot ?? "Producto"}</p><p className={`mt-1 text-[10px] ${muted}`}>{item.sku_snapshot ?? "SKU no disponible"} · Cantidad: {item.quantity}</p></div><p className={`shrink-0 text-xs font-semibold ${title}`}>{money(numberValue(item.unit_price) * item.quantity)}</p></div>)}
                </div>}
              </section>

              {selectedSale.payment_status !== "confirmed" ? <div className={`rounded-lg border p-4 ${darkMode ? "border-amber-500/30 bg-amber-500/5" : "border-amber-200 bg-amber-50"}`}><p className={`text-xs font-bold ${darkMode ? "text-amber-300" : "text-amber-800"}`}>El pedido todavía no está listo para preparación</p><p className={`mt-1 text-xs ${darkMode ? "text-amber-200/80" : "text-amber-700"}`}>Primero verifica el pago completo desde el módulo Ventas. No se puede coordinar el despacho ni marcarlo como preparado antes de confirmar el dinero recibido.</p><a href="/ventas" className="mt-3 inline-flex text-xs font-bold text-[#D9862D]">Abrir Ventas para revisar el pago ↗</a></div> : null}

              {selectedSale.status === "paid" && selectedSale.payment_status === "confirmed" && <div className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${inner}`}><div><p className={`text-xs font-bold ${title}`}>Pago completo confirmado</p><p className={`mt-1 text-[11px] ${muted}`}>Puedes comenzar a preparar el producto para su despacho.</p></div><button type="button" disabled={saving} onClick={() => void markPreparing()} className={primaryButton}>Marcar en preparación</button></div>}

              {(["paid", "preparing"].includes(selectedSale.status) && selectedSale.payment_status === "confirmed") || selectedDelivery ? <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className={`text-xs font-bold uppercase tracking-wide ${title}`}>Entrega por inDrive</h4><p className={`mt-1 text-[10px] ${muted}`}>El cliente paga el transporte directamente al conductor. No es ingreso ni gasto de ELITE GAMMA.</p></div>{selectedDelivery && <span className={badgeClass(selectedDelivery.delivery_status, darkMode)}>{deliveryStatusLabel(selectedDelivery.delivery_status)}</span>}</div>

                {selectedDelivery && !deliveryEditing ? <div className={`rounded-lg border p-3 ${inner}`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><p className={`text-[10px] ${muted}`}>Destinatario</p><p className={`mt-1 text-xs font-semibold ${title}`}>{selectedDelivery.recipient_name ?? "—"}</p></div>
                    <div><p className={`text-[10px] ${muted}`}>Teléfono</p><p className={`mt-1 text-xs font-semibold ${title}`}>{selectedDelivery.recipient_phone ?? "—"}</p></div>
                    <div className="sm:col-span-2"><p className={`text-[10px] ${muted}`}>Dirección</p><p className={`mt-1 text-xs font-semibold ${title}`}>{selectedDelivery.delivery_address ?? "—"}</p>{selectedDelivery.address_reference && <p className={`mt-1 text-[10px] ${muted}`}>{selectedDelivery.address_reference}</p>}</div>
                    <div><p className={`text-[10px] ${muted}`}>Costo de inDrive (cliente)</p><p className={`mt-1 text-xs font-semibold ${title}`}>{money(selectedDelivery.delivery_cost)}</p></div>
                    <div><p className={`text-[10px] ${muted}`}>Conductor / referencia</p><p className={`mt-1 text-xs font-semibold ${title}`}>{selectedDelivery.driver_reference ?? "Sin referencia"}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!["delivered", "cancelled"].includes(selectedDelivery.delivery_status) && ["paid", "preparing"].includes(selectedSale.status) && <button type="button" onClick={() => setDeliveryEditing(true)} className={secondaryButton}>Editar datos</button>}
                    {selectedDelivery.delivery_status === "requested" && <button type="button" disabled={saving} onClick={() => void updateDeliveryStatus("picked_up")} className={primaryButton}>Conductor recogió</button>}
                    {selectedDelivery.delivery_status === "picked_up" && <button type="button" disabled={saving} onClick={() => void updateDeliveryStatus("in_transit")} className={primaryButton}>Marcar en tránsito</button>}
                    {!(["delivered", "cancelled", "failed"].includes(selectedDelivery.delivery_status)) && <button type="button" disabled={saving} onClick={() => void updateDeliveryStatus("failed")} className={`${secondaryButton} !text-rose-500`}>Registrar incidencia</button>}
                    {selectedDelivery.delivery_status === "failed" && <button type="button" disabled={saving} onClick={() => void updateDeliveryStatus("requested")} className={primaryButton}>Reprogramar entrega</button>}
                    {["picked_up", "in_transit"].includes(selectedDelivery.delivery_status) && <button type="button" disabled={saving} onClick={() => void confirmDelivery()} className={primaryButton}>Confirmar código recibido</button>}
                  </div>
                  {selectedDelivery.delivery_status === "delivered" && <p className="mt-3 text-[10px] text-emerald-500">Entrega confirmada {dateTime(selectedDelivery.delivered_at)}. No se almacenó el código de inDrive.</p>}
                  {selectedDelivery.delivery_status === "failed" && <p className="mt-3 text-[10px] text-rose-500">Entrega con incidencia. Corrige la referencia y solicita nuevamente.</p>}
                </div> : null}

                {(["paid", "preparing"].includes(selectedSale.status) && selectedSale.payment_status === "confirmed") && (!selectedDelivery || deliveryEditing) && <form onSubmit={saveDelivery} className={`rounded-lg border p-3 ${inner}`}>
                  <div className="mb-3 flex items-center justify-between gap-2"><p className={`text-[11px] font-bold ${title}`}>{selectedDelivery ? "Editar datos de entrega" : "Coordinar entrega"}</p>{selectedDelivery && <button type="button" onClick={() => setDeliveryEditing(false)} className={`text-[10px] ${muted}`}>Cancelar edición</button>}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label><span className={`mb-1 block text-[10px] ${muted}`}>Nombre del destinatario *</span><input required value={deliveryForm.recipient_name} onChange={(event) => setDeliveryForm((current) => ({ ...current, recipient_name: event.target.value }))} className={field} /></label>
                    <label><span className={`mb-1 block text-[10px] ${muted}`}>Teléfono *</span><input required value={deliveryForm.recipient_phone} onChange={(event) => setDeliveryForm((current) => ({ ...current, recipient_phone: event.target.value }))} className={field} /></label>
                    <label className="sm:col-span-2"><span className={`mb-1 block text-[10px] ${muted}`}>Dirección de entrega *</span><input required value={deliveryForm.delivery_address} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_address: event.target.value }))} className={field} /></label>
                    <label><span className={`mb-1 block text-[10px] ${muted}`}>Referencia / distrito</span><input value={deliveryForm.address_reference} onChange={(event) => setDeliveryForm((current) => ({ ...current, address_reference: event.target.value }))} className={field} /></label>
                    <label><span className={`mb-1 block text-[10px] ${muted}`}>Costo de inDrive (PEN) *</span><input required type="number" min="0" step="0.01" value={deliveryForm.delivery_cost} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_cost: event.target.value }))} className={field} /></label>
                    <label className="sm:col-span-2"><span className={`mb-1 block text-[10px] ${muted}`}>Notas</span><textarea rows={2} value={deliveryForm.notes} onChange={(event) => setDeliveryForm((current) => ({ ...current, notes: event.target.value }))} className={field} /></label>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className={`max-w-md text-[10px] leading-4 ${muted}`}>Este importe es informativo: lo paga el cliente directamente al conductor y no se suma a la venta ni a caja.</p><button type="submit" disabled={saving} className={primaryButton}>{saving ? "Guardando..." : "Guardar entrega"}</button></div>
                </form>}
                {selectedDelivery && <label className="block"><span className={`mb-1 block text-[10px] ${muted}`}>Referencia de conductor (opcional)</span><input value={driverReference} onChange={(event) => setDriverReference(event.target.value)} placeholder="Nombre o referencia de inDrive" className={field} /><p className={`mt-1 text-[10px] ${muted}`}>Se guardará al cambiar el estado de la entrega.</p></label>}
              </section> : null}

              {selectedSale.notes && <div><p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${muted}`}>Notas de venta</p><p className={`text-xs leading-5 ${title}`}>{selectedSale.notes}</p></div>}
              <div className={`rounded-lg border p-3 ${inner}`}>
                <p className={`text-[10px] font-semibold ${title}`}>Reglas de operación</p>
                <ul className={`mt-2 space-y-1.5 text-[10px] leading-4 ${muted}`}>
                  <li>• La preparación y el despacho requieren pago completo confirmado.</li>
                  <li>• El cliente paga inDrive directamente al conductor; no se registra como ingreso ni gasto de la tienda.</li>
                  <li>• El código de entrega no se almacena; solo se registra la fecha y hora de confirmación.</li>
                </ul>
              </div>
            </div>}
          </section>
        </div>
      </div>
    </div>
  );
}
