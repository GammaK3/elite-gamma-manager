"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = { id: string; name: string; is_active: boolean };
type Product = { id: string; name: string; sku: string | null; cost_price: number; is_active: boolean };
type Purchase = {
  id: string;
  supplier_id: string | null;
  document_number: string | null;
  status: "draft" | "received" | "cancelled";
  purchase_date: string;
  original_currency_code: string;
  exchange_rate: number;
  exchange_rate_date: string | null;
  original_subtotal: number | null;
  shipping_cost_pen: number;
  other_costs_pen: number;
  allocated_shipping_pen: number | null;
  allocated_other_costs_pen: number | null;
  landed_total_pen: number | null;
  notes: string | null;
  created_at: string;
};
type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  original_currency_code: string | null;
  original_unit_cost: number | null;
  exchange_rate: number | null;
  landed_unit_cost_pen: number | null;
};
type DraftForm = {
  supplier_id: string;
  document_number: string;
  purchase_date: string;
  currency: "PEN" | "USD";
  exchange_rate: string;
  exchange_rate_date: string;
  shipping_cost: string;
  other_costs: string;
  notes: string;
};

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function money(value: number | null | undefined, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function statusLabel(status: Purchase["status"]) {
  if (status === "received") return "Recibida";
  if (status === "cancelled") return "Cancelada";
  return "Borrador";
}

function emptyDraft(): DraftForm {
  return {
    supplier_id: "",
    document_number: "",
    purchase_date: "",
    currency: "PEN",
    exchange_rate: "1",
    exchange_rate_date: "",
    shipping_cost: "0",
    other_costs: "0",
    notes: "",
  };
}

function initialDraft(): DraftForm {
  const today = localDate();
  return {
    ...emptyDraft(),
    purchase_date: today,
    exchange_rate_date: today,
  };
}

export default function ComprasPage() {
  const [businessId, setBusinessId] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [itemProductId, setItemProductId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemUnitCost, setItemUnitCost] = useState("");
  const [editShipping, setEditShipping] = useState("0");
  const [editOther, setEditOther] = useState("0");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    // La fecha local se calcula solo en el navegador, después de la hidratación.
    setDraft(initialDraft());
    setDarkMode(window.localStorage.getItem("elite-gamma-theme") === "dark");
    const listener = (event: Event) => {
      const custom = event as CustomEvent<{ darkMode: boolean }>;
      setDarkMode(Boolean(custom.detail?.darkMode));
    };
    window.addEventListener("elite-gamma-theme-change", listener);
    return () => window.removeEventListener("elite-gamma-theme-change", listener);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (businessError) throw new Error(businessError.message);
      if (!business) throw new Error("No encontramos ELITE GAMMA asociado a tu cuenta.");
      setBusinessId(business.id);

      const [supplierResult, productResult, purchaseResult] = await Promise.all([
        supabase.from("suppliers").select("id,name,is_active").eq("business_id", business.id).order("name"),
        supabase.from("products").select("id,name,sku,cost_price,is_active").eq("business_id", business.id).eq("is_active", true).order("name"),
        supabase.from("purchases").select("id,supplier_id,document_number,status,purchase_date,original_currency_code,exchange_rate,exchange_rate_date,original_subtotal,shipping_cost_pen,other_costs_pen,allocated_shipping_pen,allocated_other_costs_pen,landed_total_pen,notes,created_at").eq("business_id", business.id).order("created_at", { ascending: false }),
      ]);
      if (supplierResult.error) throw new Error(supplierResult.error.message);
      if (productResult.error) throw new Error(productResult.error.message);
      if (purchaseResult.error) throw new Error(purchaseResult.error.message);

      setSuppliers((supplierResult.data ?? []) as Supplier[]);
      setProducts((productResult.data ?? []).map((p) => ({ ...p, cost_price: Number(p.cost_price) })) as Product[]);
      setPurchases((purchaseResult.data ?? []).map((p) => ({
        ...p,
        exchange_rate: Number(p.exchange_rate ?? 1),
        shipping_cost_pen: Number(p.shipping_cost_pen ?? 0),
        other_costs_pen: Number(p.other_costs_pen ?? 0),
        original_subtotal: p.original_subtotal === null ? null : Number(p.original_subtotal),
        allocated_shipping_pen: p.allocated_shipping_pen === null ? null : Number(p.allocated_shipping_pen),
        allocated_other_costs_pen: p.allocated_other_costs_pen === null ? null : Number(p.allocated_other_costs_pen),
        landed_total_pen: p.landed_total_pen === null ? null : Number(p.landed_total_pen),
      })) as Purchase[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las compras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedPurchase = purchases.find((p) => p.id === selectedId) ?? null;

  const loadItems = useCallback(async (purchaseId: string) => {
    if (!businessId || !purchaseId) { setItems([]); return; }
    setLoadingItems(true);
    try {
      const supabase = createClient();
      const { data, error: itemsError } = await supabase
        .from("purchase_items")
        .select("id,purchase_id,product_id,quantity,unit_cost,original_currency_code,original_unit_cost,exchange_rate,landed_unit_cost_pen")
        .eq("business_id", businessId)
        .eq("purchase_id", purchaseId)
        .order("created_at");
      if (itemsError) throw new Error(itemsError.message);
      setItems((data ?? []).map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
        original_unit_cost: item.original_unit_cost === null ? null : Number(item.original_unit_cost),
        exchange_rate: item.exchange_rate === null ? null : Number(item.exchange_rate),
        landed_unit_cost_pen: item.landed_unit_cost_pen === null ? null : Number(item.landed_unit_cost_pen),
      })) as PurchaseItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las líneas de compra.");
    } finally {
      setLoadingItems(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (selectedId) void loadItems(selectedId);
    else setItems([]);
  }, [selectedId, loadItems]);

  useEffect(() => {
    if (selectedPurchase) {
      setEditShipping(String(selectedPurchase.shipping_cost_pen));
      setEditOther(String(selectedPurchase.other_costs_pen));
      setEditNotes(selectedPurchase.notes ?? "");
    }
  }, [selectedId, selectedPurchase?.shipping_cost_pen, selectedPurchase?.other_costs_pen, selectedPurchase?.notes]);

  const filteredPurchases = useMemo(() => {
    const term = search.trim().toLowerCase();
    return purchases.filter((purchase) => {
      const supplierName = suppliers.find((s) => s.id === purchase.supplier_id)?.name ?? "";
      const matchesText = !term || `${supplierName} ${purchase.document_number ?? ""} ${purchase.id}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || purchase.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [purchases, suppliers, search, statusFilter]);

  const originalSubtotal = items.reduce(
    (total, item) => total + item.quantity * Number(item.original_unit_cost ?? item.unit_cost), 0
  );
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const fxRate = selectedPurchase?.exchange_rate ?? 1;
  const extraCosts = selectedPurchase
    ? Number(editShipping) + Number(editOther)
    : 0;
  const estimatedLandedTotal = items.reduce((total, item) => {
    const sourceCost = Number(item.original_unit_cost ?? item.unit_cost);
    const share = originalSubtotal > 0
      ? (item.quantity * sourceCost) / originalSubtotal
      : totalQuantity > 0 ? item.quantity / totalQuantity : 0;
    const landedUnit = Math.round((sourceCost * fxRate + (extraCosts * share) / item.quantity) * 100) / 100;
    return total + landedUnit * item.quantity;
  }, 0);

  function updateDraft(field: keyof DraftForm, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "currency" && value === "PEN" ? { exchange_rate: "1" } : {}),
    }));
  }

  async function createPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!businessId) { setError("No se encontró el negocio."); return; }
    const rate = draft.currency === "PEN" ? 1 : Number(draft.exchange_rate);
    if (!Number.isFinite(rate) || rate <= 0) { setError("Introduce un tipo de cambio válido."); return; }
    if (draft.currency !== "PEN" && !draft.exchange_rate_date) { setError("Indica la fecha del tipo de cambio."); return; }
    if (Number(draft.shipping_cost) < 0 || Number(draft.other_costs) < 0) { setError("Los gastos no pueden ser negativos."); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_purchase_draft", {
        p_business_id: businessId,
        p_supplier_id: draft.supplier_id || null,
        p_document_number: draft.document_number.trim() || null,
        p_purchase_date: draft.purchase_date,
        p_original_currency_code: draft.currency,
        p_exchange_rate: rate,
        p_exchange_rate_date: draft.exchange_rate_date || draft.purchase_date,
        p_shipping_cost: Number(draft.shipping_cost || 0),
        p_other_costs: Number(draft.other_costs || 0),
        p_notes: draft.notes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      const newId = data as string;
      setDraft(initialDraft()); setNewPurchaseOpen(false); setSelectedId(newId);
      setSuccess("Compra creada en borrador. Ahora agrega sus productos.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la compra.");
    } finally { setSaving(false); }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!selectedPurchase || selectedPurchase.status !== "draft") return;
    if (!itemProductId) { setError("Selecciona un producto."); return; }
    if (items.some((item) => item.product_id === itemProductId)) {
      setError("Este producto ya está agregado a la compra. Elimina la línea existente para volver a registrarlo."); return;
    }
    const quantity = Number(itemQuantity);
    const cost = Number(itemUnitCost);
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(cost) || cost < 0) {
      setError("Revisa la cantidad y el costo unitario."); return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("add_purchase_item", {
        p_business_id: businessId,
        p_purchase_id: selectedPurchase.id,
        p_product_id: itemProductId,
        p_quantity: quantity,
        p_original_unit_cost: cost,
      });
      if (rpcError) throw new Error(rpcError.message);
      setItemProductId(""); setItemQuantity("1"); setItemUnitCost("");
      setSuccess("Producto agregado a la compra.");
      await loadItems(selectedPurchase.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el producto.");
    } finally { setSaving(false); }
  }

  async function removeItem(item: PurchaseItem) {
    if (!selectedPurchase) return;
    const product = products.find((p) => p.id === item.product_id);
    if (!window.confirm(`¿Quitar ${product?.name ?? "este producto"} de la compra?`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("remove_purchase_item", {
        p_business_id: businessId,
        p_purchase_item_id: item.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess("Línea retirada del borrador.");
      await loadItems(selectedPurchase.id); await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la línea.");
    } finally { setSaving(false); }
  }

  async function saveDraftCosts() {
    if (!selectedPurchase || selectedPurchase.status !== "draft") return;
    const shipping = Number(editShipping); const other = Number(editOther);
    if (!Number.isFinite(shipping) || shipping < 0 || !Number.isFinite(other) || other < 0) {
      setError("Los gastos deben ser números iguales o mayores que cero."); return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("update_purchase_draft_costs", {
        p_business_id: businessId,
        p_purchase_id: selectedPurchase.id,
        p_shipping_cost: shipping,
        p_other_costs: other,
        p_notes: editNotes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess("Gastos y notas del borrador actualizados."); await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los gastos.");
    } finally { setSaving(false); }
  }

  async function receivePurchase() {
    if (!selectedPurchase) return;
    if (items.length === 0) { setError("Agrega al menos un producto antes de recibir la compra."); return; }
    const currency = selectedPurchase.original_currency_code;
    const confirmation = window.confirm(
      `Vas a recibir esta compra.\n\n` +
      `Líneas: ${items.length}\n` +
      `Unidades: ${totalQuantity}\n` +
      `Subtotal original: ${money(originalSubtotal, currency)}\n` +
      `Costo aterrizado estimado: ${money(estimatedLandedTotal, "PEN")}\n\n` +
      `Al confirmar, las unidades ingresarán al inventario y la compra quedará bloqueada. Esta acción no se puede deshacer desde el borrador. ¿Continuar?`
    );
    if (!confirmation) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("receive_purchase", {
        p_business_id: businessId,
        p_purchase_id: selectedPurchase.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess("Compra recibida. Los movimientos de entrada se registraron en inventario.");
      await loadData(); await loadItems(selectedPurchase.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recibir la compra.");
    } finally { setSaving(false); }
  }

  async function cancelPurchase() {
    if (!selectedPurchase) return;
    if (!window.confirm("¿Cancelar este borrador? No se generarán movimientos de inventario.")) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("cancel_purchase_draft", {
        p_business_id: businessId,
        p_purchase_id: selectedPurchase.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess("Compra cancelada. Su registro se conserva en el historial.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la compra.");
    } finally { setSaving(false); }
  }

  const bg = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const card = darkMode ? "border-[#293241] bg-[#171D28]" : "border-[#EAECF0] bg-white";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#858C99]";
  const input = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[#E99A44] ${darkMode ? "border-[#354153] bg-[#101722] text-white" : "border-[#E5E7EB] bg-white text-[#20232B]"}`;
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "Sin proveedor";

  return (
    <div className={`mx-auto max-w-[1450px] px-5 py-7 sm:px-8 ${bg}`}>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className={`mb-2 text-[10px] tracking-[1.8px] ${muted}`}>ELITE GAMMA / ABASTECIMIENTO</p>
          <h2 className="text-2xl font-bold">Compras</h2>
          <p className={`mt-2 text-sm ${muted}`}>Registra adquisiciones, convierte costos y recibe mercadería.</p>
        </div>
        <button type="button" onClick={() => { setError(""); setSuccess(""); setNewPurchaseOpen(true); }} className="rounded-lg bg-[#E99A44] px-5 py-3 text-sm font-bold text-[#171D28] hover:bg-[#F3AB5C]">+ Nueva compra</button>
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
      {success && <div role="status" className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-500">{success}</div>}

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={`rounded-xl border p-5 ${card}`}><p className={`text-xs ${muted}`}>Compras totales</p><p className="mt-3 text-2xl font-bold">{purchases.length}</p><p className={`mt-1 text-[11px] ${muted}`}>Historial del negocio</p></div>
        <div className={`rounded-xl border p-5 ${card}`}><p className={`text-xs ${muted}`}>Borradores</p><p className="mt-3 text-2xl font-bold">{purchases.filter((p) => p.status === "draft").length}</p><p className={`mt-1 text-[11px] ${muted}`}>Pendientes de recepción</p></div>
        <div className={`rounded-xl border p-5 ${card}`}><p className={`text-xs ${muted}`}>Compras recibidas</p><p className="mt-3 text-2xl font-bold">{purchases.filter((p) => p.status === "received").length}</p><p className={`mt-1 text-[11px] ${muted}`}>Con entrada de inventario</p></div>
      </section>

      <section className={`mb-6 rounded-xl border p-4 ${card}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor, documento o ID..." className={input}/>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={input}>
            <option value="all">Todos los estados</option><option value="draft">Borradores</option><option value="received">Recibidas</option><option value="cancelled">Canceladas</option>
          </select>
          <button type="button" onClick={() => void loadData()} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${darkMode ? "border-[#354153]" : "border-[#E5E7EB]"}`}>↻ Actualizar</button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={`overflow-hidden rounded-xl border ${card}`}>
          <div className={`border-b px-5 py-4 ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}>
            <h3 className="text-sm font-bold">Historial de compras</h3><p className={`mt-1 text-xs ${muted}`}>{filteredPurchases.length} resultados</p>
          </div>
          {loading ? <p className={`p-8 text-center text-sm ${muted}`}>Cargando compras...</p> : filteredPurchases.length === 0 ? (
            <div className="p-10 text-center"><p className="text-sm font-semibold">Todavía no hay compras registradas.</p><p className={`mt-2 text-xs ${muted}`}>Crea un borrador para registrar tu primera adquisición.</p></div>
          ) : (
            <div className={`divide-y ${darkMode ? "divide-[#293241]" : "divide-[#EAECF0]"}`}>
              {filteredPurchases.map((purchase) => (
                <button key={purchase.id} type="button" onClick={() => { setSelectedId(purchase.id); setError(""); setSuccess(""); }} className={`w-full p-4 text-left transition ${selectedId === purchase.id ? (darkMode ? "bg-[#222B39]" : "bg-[#FFF7ED]") : (darkMode ? "hover:bg-[#202938]" : "hover:bg-[#FAFAFB]")}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{supplierName(purchase.supplier_id)}</p><p className={`mt-1 text-xs ${muted}`}>{purchase.document_number || "Sin documento"} · {purchase.purchase_date}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${purchase.status === "received" ? "bg-green-500/10 text-green-500" : purchase.status === "cancelled" ? "bg-gray-500/10 text-gray-400" : "bg-amber-500/10 text-amber-500"}`}>{statusLabel(purchase.status)}</span></div>
                  <div className="mt-3 flex items-center justify-between gap-2"><span className={`text-xs ${muted}`}>{purchase.original_currency_code} · TC {purchase.exchange_rate}</span><span className="text-sm font-bold">{purchase.landed_total_pen === null ? money(purchase.original_subtotal, purchase.original_currency_code) : money(purchase.landed_total_pen, "PEN")}</span></div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={`overflow-hidden rounded-xl border ${card}`}>
          {!selectedPurchase ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#E99A44]/10 text-2xl text-[#E99A44]">＋</div><h3 className="text-base font-bold">Selecciona una compra</h3><p className={`mt-2 max-w-sm text-xs leading-5 ${muted}`}>Elige un borrador del historial o crea una nueva compra para administrar sus productos y costos.</p></div>
          ) : (
            <>
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}>
                <div><p className={`text-[10px] tracking-wider ${muted}`}>DETALLE DE COMPRA</p><h3 className="mt-1 text-base font-bold">{supplierName(selectedPurchase.supplier_id)}</h3><p className={`mt-1 text-xs ${muted}`}>{selectedPurchase.document_number || "Sin documento"} · {selectedPurchase.purchase_date}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${selectedPurchase.status === "received" ? "bg-green-500/10 text-green-500" : selectedPurchase.status === "cancelled" ? "bg-gray-500/10 text-gray-400" : "bg-amber-500/10 text-amber-500"}`}>{statusLabel(selectedPurchase.status)}</span>
              </div>
              <div className="space-y-5 p-5">
                {selectedPurchase.status === "draft" && (
                  <>
                    <form onSubmit={addItem} className="space-y-3">
                      <h4 className="text-sm font-bold">Agregar producto</h4>
                      <div className="grid gap-3 sm:grid-cols-[1fr_90px_130px]">
                        <select required value={itemProductId} onChange={(e) => setItemProductId(e.target.value)} className={input}><option value="">Seleccionar producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</select>
                        <input required min="1" step="1" type="number" value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)} className={input} aria-label="Cantidad" placeholder="Cantidad"/>
                        <input required min="0" step="0.01" type="number" value={itemUnitCost} onChange={(e) => setItemUnitCost(e.target.value)} className={input} aria-label="Costo unitario original" placeholder={`Costo (${selectedPurchase.original_currency_code})`}/>
                      </div>
                      <button disabled={saving} className="rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28] disabled:opacity-60">{saving ? "Guardando..." : "Agregar línea"}</button>
                    </form>
                    <div className={`rounded-lg border p-3 text-xs leading-5 ${darkMode ? "border-[#354153] bg-[#101722] text-[#A0ABBC]" : "border-[#E5E7EB] bg-[#FAFAFB] text-[#737987]"}`}>
                      Los costos de los productos se registran en la moneda original ({selectedPurchase.original_currency_code}). El transporte y los otros gastos siempre se registran en soles (PEN). El tipo de cambio solo convierte el costo de los productos cuando la compra está en moneda extranjera.
                    </div>
                  </>
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-bold">Productos de la compra</h4><span className={`text-xs ${muted}`}>{items.length} líneas · {totalQuantity} unidades</span></div>
                  {loadingItems ? <p className={`py-6 text-center text-xs ${muted}`}>Cargando líneas...</p> : items.length === 0 ? <p className={`rounded-lg border border-dashed p-6 text-center text-xs ${muted}`}>Todavía no se agregaron productos.</p> : (
                    <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left"><thead><tr className={`border-b text-[10px] uppercase ${darkMode ? "border-[#354153] text-[#A0ABBC]" : "border-[#EAECF0] text-[#9297A3]"}`}><th className="py-2 pr-2">Producto</th><th className="px-2 py-2">Cantidad</th><th className="px-2 py-2">Costo unit.</th><th className="px-2 py-2">Aterrizado PEN</th>{selectedPurchase.status === "draft" && <th className="py-2 pl-2">Acción</th>}</tr></thead><tbody>{items.map((item) => { const product = products.find((p) => p.id === item.product_id); return <tr key={item.id} className={`border-b ${darkMode ? "border-[#293241]" : "border-[#F0F1F4]"}`}><td className="py-3 pr-2 text-xs font-semibold">{product?.name ?? "Producto"}<p className={`mt-1 text-[10px] font-normal ${muted}`}>{product?.sku ?? ""}</p></td><td className="px-2 py-3 text-xs">{item.quantity}</td><td className="px-2 py-3 text-xs">{money(item.original_unit_cost ?? item.unit_cost, selectedPurchase.original_currency_code)}</td><td className="px-2 py-3 text-xs">{item.landed_unit_cost_pen === null ? "Pendiente" : money(item.landed_unit_cost_pen, "PEN")}</td>{selectedPurchase.status === "draft" && <td className="py-3 pl-2"><button type="button" disabled={saving} onClick={() => void removeItem(item)} className="text-[11px] font-semibold text-red-500">Quitar</button></td>}</tr>; })}</tbody></table></div>
                  )}
                </div>

                {selectedPurchase.status === "draft" && (
                  <>
                    <div className={`rounded-xl border p-4 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFAFB]"}`}>
                      <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-bold">Transporte y otros gastos</h4><span className={`text-[10px] ${muted}`}>Transporte PEN · otros gastos PEN</span></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={`text-xs ${muted}`}>Transporte (PEN)<input type="number" min="0" step="0.01" value={editShipping} onChange={(e) => setEditShipping(e.target.value)} className={`${input} mt-1`}/></label>
                        <label className={`text-xs ${muted}`}>Otros gastos (PEN)<input type="number" min="0" step="0.01" value={editOther} onChange={(e) => setEditOther(e.target.value)} className={`${input} mt-1`}/></label>
                      </div>
                      <label className={`mt-3 block text-xs ${muted}`}>Notas internas<textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={`${input} mt-1`}/></label>
                      <button type="button" disabled={saving} onClick={() => void saveDraftCosts()} className={`mt-3 rounded-lg border px-4 py-2 text-xs font-semibold ${darkMode ? "border-[#354153]" : "border-[#E5E7EB]"}`}>Guardar gastos y notas</button>
                    </div>

                    <div className={`rounded-xl border p-4 ${darkMode ? "border-[#354153]" : "border-[#EAECF0]"}`}>
                      <h4 className="mb-3 text-sm font-bold">Resumen estimado de costos</h4>
                      <div className="space-y-2 text-xs"><div className="flex justify-between"><span className={muted}>Subtotal original</span><strong>{money(originalSubtotal, selectedPurchase.original_currency_code)}</strong></div><div className="flex justify-between"><span className={muted}>Transporte + otros gastos (PEN)</span><strong>{money(extraCosts, "PEN")}</strong></div><div className="flex justify-between"><span className={muted}>Tipo de cambio</span><strong>{selectedPurchase.exchange_rate}</strong></div><div className={`mt-3 flex justify-between border-t pt-3 text-sm ${darkMode ? "border-[#354153]" : "border-[#EAECF0]"}`}><strong>Costo aterrizado estimado</strong><strong className="text-[#E99A44]">{money(estimatedLandedTotal, "PEN")}</strong></div></div>
                      <p className={`mt-3 text-[10px] leading-4 ${muted}`}>El transporte y los otros gastos se suman directamente en PEN; solo el costo de los productos se convierte con el tipo de cambio. Los gastos se distribuyen proporcionalmente al valor de cada línea. La recepción definitiva la calcula PostgreSQL.</p>
                    </div>

                    <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
                      <button type="button" disabled={saving} onClick={() => void cancelPurchase()} className="rounded-lg border border-red-500/40 px-4 py-2.5 text-xs font-semibold text-red-500">Cancelar borrador</button>
                      <button type="button" disabled={saving || items.length === 0} onClick={() => void receivePurchase()} className="rounded-lg bg-[#E99A44] px-5 py-2.5 text-xs font-bold text-[#171D28] disabled:opacity-50">{saving ? "Procesando..." : "Recibir compra e ingresar stock"}</button>
                    </div>
                  </>
                )}

                {selectedPurchase.status === "received" && (
                  <div className={`rounded-lg border p-4 ${darkMode ? "border-green-500/30 bg-green-500/10" : "border-green-200 bg-green-50"}`}><p className="text-sm font-semibold text-green-600">Compra recibida correctamente.</p><p className="mt-1 text-xs text-green-700">El stock se registró mediante movimientos y el historial de esta compra quedó bloqueado.</p><p className="mt-3 text-sm font-bold text-green-700">Costo aterrizado total: {money(selectedPurchase.landed_total_pen, "PEN")}</p></div>
                )}
                {selectedPurchase.status === "cancelled" && <p className={`rounded-lg border p-4 text-xs ${muted}`}>Esta compra fue cancelada. Su información se conserva en el historial y no generó entradas de inventario.</p>}
              </div>
            </>
          )}
        </section>
      </div>

      {newPurchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setNewPurchaseOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="new-purchase-title" className={`my-auto w-full max-w-3xl rounded-2xl border p-6 shadow-2xl ${card}`}>
            <div className="mb-5 flex items-start justify-between"><div><h3 id="new-purchase-title" className="text-lg font-bold">Crear compra en borrador</h3><p className={`mt-1 text-xs ${muted}`}>La compra no ingresará mercadería hasta que confirmes la recepción.</p></div><button type="button" onClick={() => setNewPurchaseOpen(false)} aria-label="Cerrar" className="text-lg">×</button></div>
            {suppliers.length === 0 && <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">No tienes proveedores activos. Puedes continuar sin proveedor, pero recomendamos registrar primero Sercoplus en <a className="font-bold underline" href="/proveedores">Proveedores</a>.</div>}
            <form onSubmit={createPurchase} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`text-xs font-semibold ${muted}`}>Proveedor<select value={draft.supplier_id} onChange={(e) => updateDraft("supplier_id", e.target.value)} className={`${input} mt-1`}><option value="">Sin proveedor asignado</option>{suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label className={`text-xs font-semibold ${muted}`}>Factura / número de pedido<input value={draft.document_number} onChange={(e) => updateDraft("document_number", e.target.value)} placeholder="Ej. P007593" className={`${input} mt-1`}/></label>
                <label className={`text-xs font-semibold ${muted}`}>Fecha de compra<input required type="date" value={draft.purchase_date} onChange={(e) => updateDraft("purchase_date", e.target.value)} className={`${input} mt-1`}/></label>
                <label className={`text-xs font-semibold ${muted}`}>Moneda original<select value={draft.currency} onChange={(e) => updateDraft("currency", e.target.value)} className={`${input} mt-1`}><option value="PEN">PEN — Soles</option><option value="USD">USD — Dólares</option></select></label>
                <label className={`text-xs font-semibold ${muted}`}>Tipo de cambio (PEN por 1 {draft.currency})<input required type="number" min="0.000001" step="0.000001" value={draft.currency === "PEN" ? "1" : draft.exchange_rate} onChange={(e) => updateDraft("exchange_rate", e.target.value)} disabled={draft.currency === "PEN"} className={`${input} mt-1 disabled:opacity-60`}/></label>
                <label className={`text-xs font-semibold ${muted}`}>Fecha del tipo de cambio<input required type="date" value={draft.exchange_rate_date} onChange={(e) => updateDraft("exchange_rate_date", e.target.value)} disabled={draft.currency === "PEN"} className={`${input} mt-1 disabled:opacity-60`}/></label>
                <label className={`text-xs font-semibold ${muted}`}>Transporte (PEN)<input required type="number" min="0" step="0.01" value={draft.shipping_cost} onChange={(e) => updateDraft("shipping_cost", e.target.value)} className={`${input} mt-1`}/></label>
                <label className={`text-xs font-semibold ${muted}`}>Otros gastos (PEN)<input required type="number" min="0" step="0.01" value={draft.other_costs} onChange={(e) => updateDraft("other_costs", e.target.value)} className={`${input} mt-1`}/></label>
                <label className={`text-xs font-semibold sm:col-span-2 ${muted}`}>Notas<textarea rows={3} value={draft.notes} onChange={(e) => updateDraft("notes", e.target.value)} className={`${input} mt-1`} placeholder="Condiciones, referencia de factura, envío, etc."/></label>
              </div>
              <div className={`rounded-lg p-3 text-[11px] leading-5 ${darkMode ? "bg-[#101722] text-[#A0ABBC]" : "bg-[#F6F7F9] text-[#737987]"}`}>Convención: los productos se registran en la moneda original de la factura ({draft.currency}). El transporte y los otros gastos siempre se registran en soles (PEN). El tipo de cambio se aplica únicamente al costo de los productos.</div>
              <div className="flex justify-end gap-2 border-t border-inherit pt-4"><button type="button" onClick={() => setNewPurchaseOpen(false)} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${darkMode ? "border-[#354153]" : "border-[#E5E7EB]"}`}>Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-[#E99A44] px-5 py-2.5 text-xs font-bold text-[#171D28] disabled:opacity-60">{saving ? "Creando..." : "Crear borrador"}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
