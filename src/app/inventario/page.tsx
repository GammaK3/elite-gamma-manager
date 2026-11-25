"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDarkMode } from "@/lib/use-dark-mode";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  model_name: string | null;
  color: string | null;
  brand_id: string | null;
  minimum_stock: number;
  cost_price: number;
  inventory_status: string;
  cost_status: string;
};

type Brand = { id: string; name: string };

type StockRow = {
  product_id: string;
  stock_quantity: number;
  inventory_status: string;
  cost_status: string;
};

type Discrepancy = {
  id: string;
  product_id: string;
  source_reference: string;
  source_stock_initial: number;
  physical_stock_confirmed: number;
  difference: number;
  status: string;
  explanation: string | null;
  notes: string | null;
  created_at: string;
};

type InventoryCount = {
  id: string;
  status: "draft" | "completed" | "cancelled";
  count_date: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

type CountItem = {
  id: string;
  inventory_count_id: string;
  product_id: string;
  system_quantity: number;
  counted_quantity: number | null;
  notes: string | null;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity_delta: number;
  unit_cost: number | null;
  notes: string | null;
  source_date: string | null;
  created_at: string;
};

const movementLabels: Record<string, string> = {
  opening: "Apertura",
  purchase: "Compra",
  sale: "Venta",
  adjustment: "Ajuste",
  return: "Devolución",
  damage: "Daño",
  correction: "Corrección",
};

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function dateOnly(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export default function InventarioPage() {
  const darkMode = useDarkMode();
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("ELITE GAMMA");
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [draftCount, setDraftCount] = useState<InventoryCount | null>(null);
  const [countItems, setCountItems] = useState<CountItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [countNotes, setCountNotes] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [activeTab, setActiveTab] = useState<"stock" | "discrepancies" | "movements" | "history">("stock");

  const surface = darkMode
    ? "border-[#293241] bg-[#171D28]"
    : "border-[#EAECF0] bg-white";
  const primaryText = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const mutedText = darkMode ? "text-[#A0ABBC]" : "text-[#8B909C]";
  const inputStyle = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[#E99A44] ${
    darkMode
      ? "border-[#354153] bg-[#101722] text-white"
      : "border-[#E5E7EB] bg-white text-[#20232B]"
  }`;

  const loadCountItems = useCallback(async (id: string, currentBusinessId: string) => {
    const supabase = createClient();
    const { data, error: itemsError } = await supabase
      .from("inventory_count_items")
      .select("id, inventory_count_id, product_id, system_quantity, counted_quantity, notes")
      .eq("business_id", currentBusinessId)
      .eq("inventory_count_id", id)
      .order("created_at", { ascending: true });

    if (itemsError) throw new Error(itemsError.message);
    return (data ?? []) as CountItem[];
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id, name")
        .limit(1)
        .maybeSingle();

      if (businessError) throw new Error(businessError.message);
      if (!business) throw new Error("No encontramos un negocio asociado a tu cuenta.");

      const [productsResult, brandsResult, stockResult, discrepanciesResult, movementsResult, countsResult, draftResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, model_name, color, brand_id, minimum_stock, cost_price, inventory_status, cost_status")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("brands")
          .select("id, name")
          .eq("business_id", business.id)
          .order("name", { ascending: true }),
        supabase
          .from("product_stock")
          .select("product_id, stock_quantity, inventory_status, cost_status")
          .eq("business_id", business.id),
        supabase
          .from("inventory_discrepancies")
          .select("id, product_id, source_reference, source_stock_initial, physical_stock_confirmed, difference, status, explanation, notes, created_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("stock_movements")
          .select("id, product_id, movement_type, quantity_delta, unit_cost, notes, source_date, created_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("inventory_counts")
          .select("id, status, count_date, notes, created_at, completed_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("inventory_counts")
          .select("id, status, count_date, notes, created_at, completed_at")
          .eq("business_id", business.id)
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (productsResult.error) throw new Error(`Productos: ${productsResult.error.message}`);
      if (brandsResult.error) throw new Error(`Marcas: ${brandsResult.error.message}`);
      if (stockResult.error) throw new Error(`Stock: ${stockResult.error.message}`);
      if (discrepanciesResult.error) throw new Error(`Discrepancias: ${discrepanciesResult.error.message}`);
      if (movementsResult.error) throw new Error(`Movimientos: ${movementsResult.error.message}`);
      if (countsResult.error) throw new Error(`Historial de conteos: ${countsResult.error.message}`);
      if (draftResult.error) throw new Error(`Conteo abierto: ${draftResult.error.message}`);

      const products = (productsResult.data ?? []).map((row) => ({
        ...row,
        minimum_stock: Number(row.minimum_stock ?? 0),
        cost_price: Number(row.cost_price ?? 0),
      })) as Product[];
      const brands = (brandsResult.data ?? []) as Brand[];
      const stockRows = (stockResult.data ?? []).map((row) => ({
        ...row,
        stock_quantity: Number(row.stock_quantity ?? 0),
      })) as StockRow[];
      const discrepancies = (discrepanciesResult.data ?? []).map((row) => ({
        ...row,
        source_stock_initial: Number(row.source_stock_initial),
        physical_stock_confirmed: Number(row.physical_stock_confirmed),
        difference: Number(row.difference),
      })) as Discrepancy[];
      const movements = (movementsResult.data ?? []).map((row) => ({
        ...row,
        quantity_delta: Number(row.quantity_delta),
        unit_cost: row.unit_cost === null ? null : Number(row.unit_cost),
      })) as Movement[];
      const counts = (countsResult.data ?? []) as InventoryCount[];
      const draftCount = (draftResult.data ?? null) as InventoryCount | null;
      const countItems = draftResult.data
        ? await loadCountItems(draftResult.data.id, business.id)
        : [];

      return {
        businessId: business.id,
        businessName: business.name,
        products,
        brands,
        stockRows,
        discrepancies,
        movements,
        counts,
        draftCount,
        countItems,
      };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "No se pudo cargar el inventario.");
    }
  }, [loadCountItems]);

  const applyData = useCallback((data: Awaited<ReturnType<typeof fetchData>>) => {
    setBusinessId(data.businessId);
    setBusinessName(data.businessName);
    setProducts(data.products);
    setBrands(data.brands);
    setStockRows(data.stockRows);
    setDiscrepancies(data.discrepancies);
    setMovements(data.movements);
    setCounts(data.counts);
    setDraftCount(data.draftCount);
    setCountItems(data.countItems);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      applyData(await fetchData());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  }, [applyData, fetchData]);

  useEffect(() => {
    let active = true;
    void fetchData()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar el inventario.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyData, fetchData]);

  const refreshData = loadData;

  const stockMap = useMemo(
    () => new Map(stockRows.map((row) => [row.product_id, row.stock_quantity])),
    [stockRows]
  );
  const brandMap = useMemo(
    () => new Map(brands.map((brand) => [brand.id, brand.name])),
    [brands]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const stock = stockMap.get(product.id) ?? 0;
      const matchesSearch = !term || [product.name, product.sku, product.model_name, product.color]
        .some((value) => (value ?? "").toLowerCase().includes(term));
      const matchesBrand = brandFilter === "all" || product.brand_id === brandFilter;
      const matchesStock = stockFilter === "all"
        || (stockFilter === "positive" && stock > 0)
        || (stockFilter === "zero" && stock === 0)
        || (stockFilter === "low" && product.minimum_stock > 0 && stock <= product.minimum_stock);
      const matchesInventory = inventoryFilter === "all" || product.inventory_status === inventoryFilter;
      return matchesSearch && matchesBrand && matchesStock && matchesInventory;
    });
  }, [products, stockMap, search, brandFilter, stockFilter, inventoryFilter]);

  const totalUnits = stockRows.reduce((sum, row) => sum + row.stock_quantity, 0);
  const inventoryValue = products.reduce(
    (sum, product) => sum + (stockMap.get(product.id) ?? 0) * product.cost_price,
    0
  );
  const pendingInventory = products.filter((product) => product.inventory_status !== "verified").length;
  const pendingDiscrepancies = discrepancies.filter((row) => row.status === "pending_identification").length;
  const countedItems = countItems.filter((item) => item.counted_quantity !== null).length;
  const differenceCount = countItems.filter(
    (item) => item.counted_quantity !== null && item.counted_quantity !== item.system_quantity
  ).length;
  const allItemsCounted = countItems.length > 0 && countedItems === countItems.length;

  function updateCountItem(itemId: string, field: "counted_quantity" | "notes", value: string) {
    setCountItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
      if (field === "counted_quantity") {
        return { ...item, counted_quantity: value === "" ? null : Number(value) };
      }
      return { ...item, notes: value || null };
    }));
  }

  async function startCount() {
    if (!businessId || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const notes = countNotes.trim();
      const { data, error: rpcError } = await supabase.rpc("start_inventory_count", {
        p_business_id: businessId,
        ...(notes ? { p_notes: notes } : {}),
      });
      if (rpcError) throw new Error(rpcError.message);
      const countId = data as string;
      await refreshData();
      setCountNotes("");
      setActiveTab("stock");
      setSuccess(`Conteo iniciado correctamente. Referencia: ${countId.slice(0, 8)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el conteo.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCountItems(): Promise<boolean> {
    if (!businessId || !draftCount) return false;
    const invalid = countItems.some((item) =>
      item.counted_quantity !== null &&
      (!Number.isInteger(item.counted_quantity) || item.counted_quantity < 0)
    );
    if (invalid) {
      setError("Las cantidades físicas deben ser números enteros iguales o mayores a cero.");
      return false;
    }

    const supabase = createClient();
    for (const item of countItems) {
      // La tabla no concede UPDATE directo a authenticated.
      // Guardamos cada línea mediante la RPC que valida propietario,
      // estado draft y pertenencia del producto al conteo.
      const { error: updateError } = await supabase.rpc(
        "set_inventory_count_item",
        {
          p_business_id: businessId,
          p_count_id: draftCount.id,
          p_product_id: item.product_id,
          p_counted_quantity: item.counted_quantity,
          ...(item.notes ? { p_notes: item.notes } : {}),
        }
      );

      if (updateError) {
        const product = products.find((row) => row.id === item.product_id);
        setError(
          `No se pudo guardar el conteo de ${product?.name ?? "uno de los productos"}: ${updateError.message}`
        );
        return false;
      }
    }
    return true;
  }

  async function handleSaveCount() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveCountItems();
      if (!saved) return;
      setSuccess("Conteo guardado como borrador. Todavía no se modificó el stock.");
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el conteo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteCount() {
    if (!draftCount || !businessId || confirmationText !== "CONFIRMAR") return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveCountItems();
      if (!saved) return;

      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("complete_inventory_count", {
        p_business_id: businessId,
        p_count_id: draftCount.id,
      });
      if (rpcError) throw new Error(rpcError.message);

      setConfirmComplete(false);
      setConfirmationText("");
      setSuccess("Conteo completado. Las diferencias se registraron en el historial de movimientos.");
      setActiveTab("movements");
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el conteo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelCount() {
    if (!draftCount || !businessId) return;
    const confirmed = window.confirm(
      "¿Cancelar este conteo? Se conservará en el historial y no modificará las existencias."
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("cancel_inventory_count", {
        p_business_id: businessId,
        p_count_id: draftCount.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess("Conteo cancelado. El historial se conservó sin modificar el stock.");
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el conteo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={darkMode ? "min-h-screen bg-[#0D1118] text-[#E7EAF0]" : "min-h-screen bg-[#F6F7F9] text-[#20232B]"}>
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className={`mb-2 text-xs ${mutedText}`}>{businessName} / OPERACIONES</p>
            <h2 className="text-2xl font-bold">Control de inventario</h2>
            <p className={`mt-2 text-sm ${mutedText}`}>
              Consulta existencias, concilia conteos físicos y conserva el historial de movimientos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshData()}
            disabled={loading || saving}
            className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${surface} disabled:opacity-50`}
          >
            ↻ Actualizar datos
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-600">
            {success}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Variantes activas", value: String(products.length), detail: "Productos del catálogo" },
            { label: "Unidades registradas", value: String(totalUnits), detail: "Suma de movimientos" },
            { label: "Pendientes de verificar", value: String(pendingInventory), detail: "Estado del inventario" },
            { label: "Diferencias históricas", value: String(pendingDiscrepancies), detail: "Sin causa identificada" },
          ].map((metric) => (
            <div key={metric.label} className={`rounded-xl border p-5 ${surface}`}>
              <p className={`text-xs ${mutedText}`}>{metric.label}</p>
              <p className="mt-4 text-2xl font-bold tabular-nums">{metric.value}</p>
              <p className={`mt-1 text-[11px] ${mutedText}`}>{metric.detail}</p>
            </div>
          ))}
        </section>

        <div className={`mb-6 rounded-xl border p-5 ${surface}`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold">Valoración informativa del inventario</h3>
              <p className={`mt-1 text-xs ${mutedText}`}>
                Basada en costos registrados; no equivale a una valoración contable auditada.
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{money(inventoryValue)}</p>
          </div>
        </div>

        {draftCount ? (
          <section className={`mb-6 rounded-xl border p-5 sm:p-6 ${surface}`}>
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">Conteo físico en progreso</h3>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-500">Borrador</span>
                </div>
                <p className={`mt-1 text-xs ${mutedText}`}>Iniciado: {dateTime(draftCount.created_at)}</p>
                {draftCount.notes && <p className={`mt-2 text-xs ${mutedText}`}>Nota: {draftCount.notes}</p>}
              </div>
              <div className="text-sm">
                <strong>{countedItems} / {countItems.length}</strong>
                <span className={`ml-2 ${mutedText}`}>productos contados</span>
                <p className={`mt-1 text-xs ${mutedText}`}>{differenceCount} diferencias detectadas hasta ahora</p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className={`border-b text-[10px] uppercase tracking-wider ${darkMode ? "border-[#354153] text-[#A0ABBC]" : "border-[#EAECF0] text-[#9297A3]"}`}>
                    <th className="pb-3 pr-3">Producto</th>
                    <th className="pb-3 pr-3">Stock sistema</th>
                    <th className="pb-3 pr-3">Conteo físico</th>
                    <th className="pb-3 pr-3">Diferencia</th>
                    <th className="pb-3">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {countItems.map((item) => {
                    const product = products.find((row) => row.id === item.product_id);
                    const delta = item.counted_quantity === null ? null : item.counted_quantity - item.system_quantity;
                    return (
                      <tr key={item.id} className={`border-b ${darkMode ? "border-[#293241]" : "border-[#F0F1F4]"}`}>
                        <td className="py-3 pr-3">
                          <p className="text-sm font-semibold">{product?.name ?? "Producto no encontrado"}</p>
                          <p className={`mt-1 text-[10px] ${mutedText}`}>{product?.sku ?? "—"}</p>
                        </td>
                        <td className="py-3 pr-3 text-sm tabular-nums">{item.system_quantity}</td>
                        <td className="py-3 pr-3">
                          <input
                            aria-label={`Cantidad física de ${product?.name ?? "producto"}`}
                            type="number"
                            min="0"
                            step="1"
                            value={item.counted_quantity ?? ""}
                            onChange={(event) => updateCountItem(item.id, "counted_quantity", event.target.value)}
                            placeholder="Contar"
                            className={`${inputStyle} max-w-[130px]`}
                          />
                        </td>
                        <td className="py-3 pr-3 text-sm font-semibold tabular-nums">
                          {delta === null ? <span className={mutedText}>Pendiente</span> : (
                            <span className={delta === 0 ? "text-green-500" : "text-amber-500"}>
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <input
                            aria-label={`Observación de ${product?.name ?? "producto"}`}
                            value={item.notes ?? ""}
                            onChange={(event) => updateCountItem(item.id, "notes", event.target.value)}
                            placeholder="Opcional"
                            className={`${inputStyle} min-w-[150px]`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className={`text-xs ${mutedText}`}>Guardar mantiene el conteo como borrador. Completar registra los ajustes de stock.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleCancelCount()} disabled={saving} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${surface} disabled:opacity-50`}>
                  Cancelar conteo
                </button>
                <button type="button" onClick={() => void handleSaveCount()} disabled={saving} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${surface} disabled:opacity-50`}>
                  {saving ? "Guardando..." : "Guardar borrador"}
                </button>
                <button type="button" onClick={() => { setError(""); setConfirmationText(""); setConfirmComplete(true); }} disabled={saving || !allItemsCounted} className="rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28] disabled:cursor-not-allowed disabled:opacity-40">
                  Completar conteo
                </button>
              </div>
            </div>
            {!allItemsCounted && <p className="mt-3 text-xs text-amber-500">Debes ingresar la cantidad física de los {countItems.length - countedItems} productos pendientes antes de completar.</p>}
          </section>
        ) : (
          <section className={`mb-6 rounded-xl border p-5 sm:p-6 ${surface}`}>
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h3 className="text-base font-bold">Conteo físico</h3>
                <p className={`mt-1 max-w-2xl text-xs leading-5 ${mutedText}`}>
                  Inicia un conteo para comparar las existencias registradas con las unidades físicas. Las existencias no cambian hasta que guardes y completes el conteo.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row">
                <input
                  value={countNotes}
                  onChange={(event) => setCountNotes(event.target.value)}
                  placeholder="Nota del conteo (opcional)"
                  className={inputStyle}
                />
                <button type="button" onClick={() => void startCount()} disabled={saving || loading || products.length === 0} className="shrink-0 rounded-lg bg-[#E99A44] px-5 py-2.5 text-xs font-bold text-[#171D28] disabled:opacity-50">
                  {saving ? "Iniciando..." : "Iniciar conteo"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TABS */}
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            ["stock", "Existencias"],
            ["discrepancies", "Diferencias históricas"],
            ["movements", "Movimientos"],
            ["history", "Historial de conteos"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`rounded-lg border px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === key
                  ? "border-[#E99A44] bg-[#E99A44] text-[#171D28]"
                  : `${surface} ${mutedText}`
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "stock" && (
          <section className={`overflow-hidden rounded-xl border ${surface}`}>
            <div className="border-b border-inherit p-5">
              <h3 className="text-sm font-bold">Existencias por producto</h3>
              <p className={`mt-1 text-xs ${mutedText}`}>Consulta del stock derivado del historial de movimientos.</p>
            </div>
            <div className="grid gap-3 border-b border-inherit p-4 md:grid-cols-[1fr_210px_210px]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, SKU, modelo o color..." className={inputStyle}/>
              <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className={inputStyle}>
                <option value="all">Todas las marcas</option>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
              <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className={inputStyle}>
                <option value="all">Todo el stock</option>
                <option value="positive">Con existencias</option>
                <option value="zero">Sin existencias</option>
                <option value="low">Stock bajo</option>
              </select>
              <select value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value)} className={inputStyle}>
                <option value="all">Todos los estados</option>
                <option value="verified">Inventario verificado</option>
                <option value="pending_count">Pendiente de conteo</option>
              </select>
            </div>
            {loading ? (
              <p className={`p-12 text-center text-sm ${mutedText}`}>Cargando inventario...</p>
            ) : filteredProducts.length === 0 ? (
              <p className={`p-12 text-center text-sm ${mutedText}`}>No hay productos que coincidan con los filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead>
                    <tr className={`border-b text-[10px] uppercase tracking-wider ${darkMode ? "border-[#354153] text-[#A0ABBC]" : "border-[#EAECF0] text-[#9297A3]"}`}>
                      <th className="px-5 py-4">Producto</th>
                      <th className="px-4 py-4">Marca</th>
                      <th className="px-4 py-4">Stock</th>
                      <th className="px-4 py-4">Stock mínimo</th>
                      <th className="px-4 py-4">Costo registrado</th>
                      <th className="px-5 py-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const stock = stockMap.get(product.id) ?? 0;
                      const low = product.minimum_stock > 0 && stock <= product.minimum_stock;
                      return (
                        <tr key={product.id} className={`border-b ${darkMode ? "border-[#293241] hover:bg-[#202938]" : "border-[#F0F1F4] hover:bg-[#FAFAFB]"}`}>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold">{product.name}</p>
                            <p className={`mt-1 text-[10px] ${mutedText}`}>{product.sku ?? "Sin SKU"}{product.model_name ? ` · ${product.model_name}` : ""}{product.color ? ` · ${product.color}` : ""}</p>
                          </td>
                          <td className={`px-4 py-4 text-xs ${mutedText}`}>{brandMap.get(product.brand_id ?? "") ?? "—"}</td>
                          <td className="px-4 py-4">
                            <span className={`text-sm font-bold tabular-nums ${stock === 0 ? "text-red-500" : low ? "text-amber-500" : primaryText}`}>{stock}</span>
                            <span className={`ml-1 text-[10px] ${mutedText}`}>unid.</span>
                          </td>
                          <td className={`px-4 py-4 text-xs ${mutedText}`}>{product.minimum_stock}</td>
                          <td className={`px-4 py-4 text-xs ${mutedText}`}>{money(product.cost_price)}{product.cost_status !== "verified" && <p className="mt-1 text-[10px] text-amber-500">Costo por validar</p>}</td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${product.inventory_status === "verified" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {product.inventory_status === "verified" ? "Verificado" : "Pendiente"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "discrepancies" && (
          <section className={`overflow-hidden rounded-xl border ${surface}`}>
            <div className="border-b border-inherit p-5">
              <h3 className="text-sm font-bold">Diferencias históricas del Excel</h3>
              <p className={`mt-1 text-xs ${mutedText}`}>Estas diferencias no se atribuyen automáticamente a ventas, daños ni pérdidas.</p>
            </div>
            {discrepancies.length === 0 ? (
              <p className={`p-10 text-center text-sm ${mutedText}`}>No hay diferencias históricas registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead><tr className={`border-b text-[10px] uppercase tracking-wider ${darkMode ? "border-[#354153] text-[#A0ABBC]" : "border-[#EAECF0] text-[#9297A3]"}`}>
                    <th className="px-5 py-4">Producto</th><th className="px-4 py-4">Stock histórico</th><th className="px-4 py-4">Stock físico</th><th className="px-4 py-4">Diferencia</th><th className="px-5 py-4">Estado</th>
                  </tr></thead>
                  <tbody>{discrepancies.map((row) => {
                    const product = products.find((item) => item.id === row.product_id);
                    return (
                      <tr key={row.id} className={`border-b ${darkMode ? "border-[#293241]" : "border-[#F0F1F4]"}`}>
                        <td className="px-5 py-4"><p className="text-sm font-semibold">{product?.name ?? row.source_reference}</p><p className={`mt-1 text-[10px] ${mutedText}`}>{row.source_reference}</p></td>
                        <td className="px-4 py-4 text-sm tabular-nums">{row.source_stock_initial}</td>
                        <td className="px-4 py-4 text-sm tabular-nums">{row.physical_stock_confirmed}</td>
                        <td className={`px-4 py-4 text-sm font-bold tabular-nums ${row.difference < 0 ? "text-red-500" : "text-green-500"}`}>{row.difference > 0 ? `+${row.difference}` : row.difference}</td>
                        <td className="px-5 py-4"><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-500">{row.status === "pending_identification" ? "Sin identificar" : row.status === "explained" ? "Explicada" : "Resuelta"}</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "movements" && (
          <section className={`overflow-hidden rounded-xl border ${surface}`}>
            <div className="border-b border-inherit p-5">
              <h3 className="text-sm font-bold">Historial de movimientos</h3>
              <p className={`mt-1 text-xs ${mutedText}`}>Últimos 100 movimientos. El historial no se modifica desde esta pantalla.</p>
            </div>
            {movements.length === 0 ? (
              <p className={`p-10 text-center text-sm ${mutedText}`}>Todavía no hay movimientos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead><tr className={`border-b text-[10px] uppercase tracking-wider ${darkMode ? "border-[#354153] text-[#A0ABBC]" : "border-[#EAECF0] text-[#9297A3]"}`}>
                    <th className="px-5 py-4">Fecha</th><th className="px-4 py-4">Producto</th><th className="px-4 py-4">Tipo</th><th className="px-4 py-4">Cantidad</th><th className="px-4 py-4">Costo unitario</th><th className="px-5 py-4">Observación</th>
                  </tr></thead>
                  <tbody>{movements.map((movement) => {
                    const product = products.find((item) => item.id === movement.product_id);
                    return (
                      <tr key={movement.id} className={`border-b ${darkMode ? "border-[#293241]" : "border-[#F0F1F4]"}`}>
                        <td className={`px-5 py-4 text-xs ${mutedText}`}>{movement.source_date ? dateOnly(movement.source_date) : dateTime(movement.created_at)}</td>
                        <td className="px-4 py-4 text-sm font-semibold">{product?.name ?? "Producto archivado"}</td>
                        <td className={`px-4 py-4 text-xs ${mutedText}`}>{movementLabels[movement.movement_type] ?? movement.movement_type}</td>
                        <td className={`px-4 py-4 text-sm font-bold tabular-nums ${movement.quantity_delta < 0 ? "text-red-500" : "text-green-500"}`}>{movement.quantity_delta > 0 ? `+${movement.quantity_delta}` : movement.quantity_delta}</td>
                        <td className={`px-4 py-4 text-xs ${mutedText}`}>{movement.unit_cost === null ? "—" : money(movement.unit_cost)}</td>
                        <td className={`px-5 py-4 text-xs ${mutedText}`}>{movement.notes ?? "—"}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "history" && (
          <section className={`overflow-hidden rounded-xl border ${surface}`}>
            <div className="border-b border-inherit p-5">
              <h3 className="text-sm font-bold">Historial de conteos físicos</h3>
              <p className={`mt-1 text-xs ${mutedText}`}>Se conservan conteos completados y cancelados.</p>
            </div>
            {counts.length === 0 ? (
              <p className={`p-10 text-center text-sm ${mutedText}`}>Todavía no se han iniciado conteos desde ELITE GAMMA Manager.</p>
            ) : (
              <div className="divide-y divide-inherit">
                {counts.map((count) => (
                  <div key={count.id} className="flex flex-col justify-between gap-2 p-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold">Conteo {count.id.slice(0, 8)}</p>
                      <p className={`mt-1 text-xs ${mutedText}`}>{dateTime(count.created_at)}{count.notes ? ` · ${count.notes}` : ""}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${count.status === "completed" ? "bg-green-500/10 text-green-500" : count.status === "cancelled" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                      {count.status === "completed" ? "Completado" : count.status === "cancelled" ? "Cancelado" : "Borrador"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <p className={`mt-6 text-center text-[10px] ${mutedText}`}>
          ELITE GAMMA MANAGER · INVENTARIO BASADO EN MOVIMIENTOS
        </p>
      </div>

      {confirmComplete && draftCount && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${surface}`}>
            <h3 className="text-lg font-bold">Confirmar conteo físico</h3>
            <p className={`mt-2 text-sm leading-6 ${mutedText}`}>
              Se registrarán los ajustes para {differenceCount} productos con diferencias. Esta operación modificará las existencias y quedará en el historial de movimientos.
            </p>
            <div className={`mt-4 rounded-lg p-3 text-xs ${darkMode ? "bg-[#101722]" : "bg-[#F6F7F9]"}`}>
              Productos contados: <strong>{countItems.length}</strong><br />
              Diferencias detectadas: <strong>{differenceCount}</strong>
            </div>
            <label className="mt-5 block text-xs font-semibold">Escribe CONFIRMAR para continuar</label>
            <input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} className={`${inputStyle} mt-2`} placeholder="CONFIRMAR" />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setConfirmComplete(false); setConfirmationText(""); }} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${surface}`}>Volver</button>
              <button type="button" onClick={() => void handleCompleteCount()} disabled={saving || confirmationText !== "CONFIRMAR" || !allItemsCounted} className="rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28] disabled:opacity-40">{saving ? "Procesando..." : "Confirmar ajustes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
