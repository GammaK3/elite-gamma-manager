"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Brand = { id: string; name: string };
type Category = { id: string; name: string };
type Product = {
  id: string;
  sku: string | null;
  name: string;
  model_name: string | null;
  color: string | null;
  manufacturer_sku: string | null;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  offer_price: number | null;
  min_sale_price: number | null;
  minimum_stock: number;
  condition_status: string;
  inventory_status: string;
  cost_status: string;
  is_active: boolean;
  stock_quantity: number;
};

type ProductForm = {
  name: string; sku: string; model_name: string; color: string;
  description: string; brand_id: string; category_id: string;
  manufacturer_sku: string; cost_price: string; sale_price: string;
  offer_price: string; min_sale_price: string; minimum_stock: string;
  condition_status: string;
};

const emptyForm: ProductForm = {
  name: "", sku: "", model_name: "", color: "", description: "",
  brand_id: "", category_id: "", manufacturer_sku: "",
  cost_price: "0", sale_price: "0", offer_price: "",
  min_sale_price: "", minimum_stock: "0", condition_status: "unknown",
};



function money(value: number | null) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency", currency: "PEN", minimumFractionDigits: 2,
  }).format(value ?? 0);
}

function conditionLabel(value: string) {
  const labels: Record<string, string> = {
    sealed: "Sellado", open_box_unused: "Caja abierta sin uso",
    used: "Usado", unknown: "Sin confirmar",
  };
  return labels[value] ?? value;
}

function priceValue(product: Product, key: string): number | null {
  if (key === "cost") return product.cost_price;
  if (key === "sale") return product.sale_price;
  if (key === "target") return product.offer_price;
  if (key === "minimum") return product.min_sale_price;
  if (key === "margin") return product.sale_price - product.cost_price;
  return null;
}

export default function ProductosPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<Product | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  // Filtros
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [costFilter, setCostFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [priceBasis, setPriceBasis] = useState("sale");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  const [form, setForm] = useState<ProductForm>(emptyForm);

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
        .from("businesses").select("id, name").limit(1).maybeSingle();
      if (businessError) throw new Error(businessError.message);
      if (!business) throw new Error("No encontramos un negocio asociado a tu cuenta.");
      setBusinessId(business.id);

      const [productsResult, brandsResult, categoriesResult, stockResult] = await Promise.all([
        supabase.from("products").select(`
          id, sku, name, model_name, color, manufacturer_sku, description,
          brand_id, category_id, cost_price, sale_price, offer_price,
          min_sale_price, minimum_stock, condition_status, inventory_status,
          cost_status, is_active
        `).eq("business_id", business.id).eq("is_active", !showArchived).order("name"),
        supabase.from("brands").select("id, name").eq("business_id", business.id).order("name"),
        supabase.from("categories").select("id, name").eq("business_id", business.id).order("name"),
        supabase.from("product_stock").select("product_id, stock_quantity").eq("business_id", business.id),
      ]);

      if (productsResult.error) throw new Error(productsResult.error.message);
      if (brandsResult.error) throw new Error(brandsResult.error.message);
      if (categoriesResult.error) throw new Error(categoriesResult.error.message);
      if (stockResult.error) throw new Error(stockResult.error.message);

      const stockMap = new Map((stockResult.data ?? []).map((item) => [item.product_id, Number(item.stock_quantity)]));
      const loaded: Product[] = (productsResult.data ?? []).map((p) => ({
        ...p,
        cost_price: Number(p.cost_price), sale_price: Number(p.sale_price),
        offer_price: p.offer_price === null ? null : Number(p.offer_price),
        min_sale_price: p.min_sale_price === null ? null : Number(p.min_sale_price),
        minimum_stock: Number(p.minimum_stock),
        stock_quantity: stockMap.get(p.id) ?? 0,
      }));
      setProducts(loaded);
      setBrands(brandsResult.data ?? []);
      setCategories(categoriesResult.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);

    const filtered = products.filter((p) => {
      const matchesSearch = !term || [p.name, p.sku, p.model_name, p.color, p.manufacturer_sku]
        .some((value) => (value ?? "").toLowerCase().includes(term));
      const matchesBrand = brandFilter === "all" || p.brand_id === brandFilter;
      const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter;
      const matchesStock = stockFilter === "all"
        || (stockFilter === "available" && p.stock_quantity > 0)
        || (stockFilter === "zero" && p.stock_quantity === 0)
        || (stockFilter === "low" && p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock)
        || (stockFilter === "below_minimum" && p.stock_quantity < p.minimum_stock);
      const matchesInventory = inventoryFilter === "all" || p.inventory_status === inventoryFilter;
      const matchesCost = costFilter === "all" || p.cost_status === costFilter;
      const matchesCondition = conditionFilter === "all" || p.condition_status === conditionFilter;
      const price = priceValue(p, priceBasis);
      const matchesMin = min === null || (price !== null && price >= min);
      const matchesMax = max === null || (price !== null && price <= max);
      return matchesSearch && matchesBrand && matchesCategory && matchesStock
        && matchesInventory && matchesCost && matchesCondition && matchesMin && matchesMax;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "stock") comparison = a.stock_quantity - b.stock_quantity;
      else if (sortBy === "sale") comparison = a.sale_price - b.sale_price;
      else if (sortBy === "cost") comparison = a.cost_price - b.cost_price;
      else if (sortBy === "margin") comparison = (a.sale_price - a.cost_price) - (b.sale_price - b.cost_price);
      else comparison = a.name.localeCompare(b.name, "es");
      return sortDirection === "desc" ? -comparison : comparison;
    });
    return filtered;
  }, [products, search, brandFilter, categoryFilter, stockFilter, inventoryFilter, costFilter, conditionFilter, priceBasis, minPrice, maxPrice, sortBy, sortDirection]);

  const activeFilterCount = [
    search.trim() !== "",
    brandFilter !== "all",
    categoryFilter !== "all",
    stockFilter !== "all",
    inventoryFilter !== "all",
    costFilter !== "all",
    conditionFilter !== "all",
    priceBasis !== "sale",
    minPrice !== "",
    maxPrice !== "",
    sortBy !== "name",
    sortDirection !== "asc",
  ].filter(Boolean).length;

  const totalUnits = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const inventoryValue = products.reduce((sum, p) => sum + p.stock_quantity * p.cost_price, 0);
  const pendingInventory = products.filter((p) => p.inventory_status !== "verified").length;
  const pendingCosts = products.filter((p) => p.cost_status !== "verified" && p.cost_status !== "documented").length;

  function updateField(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setSearch(""); setBrandFilter("all"); setCategoryFilter("all");
    setStockFilter("all"); setInventoryFilter("all"); setCostFilter("all");
    setConditionFilter("all"); setPriceBasis("sale"); setMinPrice("");
    setMaxPrice(""); setSortBy("name"); setSortDirection("asc");
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!businessId) { setError("No se encontró el negocio."); return; }
    const cost = Number(form.cost_price); const sale = Number(form.sale_price);
    const minimum = Number(form.minimum_stock);
    if (!Number.isFinite(cost) || !Number.isFinite(sale) || cost < 0 || sale < 0) {
      setError("Revisa los costos y precios."); return;
    }
    if (!Number.isInteger(minimum) || minimum < 0) { setError("El stock mínimo debe ser un entero igual o mayor a cero."); return; }
    if (form.offer_price !== "" && (!Number.isFinite(Number(form.offer_price)) || Number(form.offer_price) < 0)) { setError("El precio objetivo no es válido."); return; }
    if (form.min_sale_price !== "" && (!Number.isFinite(Number(form.min_sale_price)) || Number(form.min_sale_price) < 0)) { setError("El precio mínimo interno no es válido."); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("create_product_catalog_item", {
        p_business_id: businessId,
        p_name: form.name.trim(),
        p_sku: form.sku.trim() || null,
        p_model_name: form.model_name.trim() || null,
        p_color: form.color.trim() || null,
        p_description: form.description.trim() || null,
        p_brand_id: form.brand_id || null,
        p_category_id: form.category_id || null,
        p_manufacturer_sku: form.manufacturer_sku.trim() || null,
        p_cost_price: cost,
        p_sale_price: sale,
        p_offer_price: form.offer_price === "" ? null : Number(form.offer_price),
        p_min_sale_price: form.min_sale_price === "" ? null : Number(form.min_sale_price),
        p_minimum_stock: minimum,
        p_condition_status: form.condition_status,
      });
      if (rpcError) throw new Error(rpcError.message);
      setForm(emptyForm); setFormOpen(false);
      setSuccess("Producto creado. El inventario queda pendiente de conteo.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el producto.");
    } finally { setSaving(false); }
  }

  async function handleDeleteOrArchive() {
    if (!pendingAction || !businessId) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("delete_or_archive_product", {
        p_business_id: businessId,
        p_product_id: pendingAction.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (data === "deleted") setSuccess(`Se eliminó definitivamente “${pendingAction.name}” porque no tenía historial relacionado.`);
      else if (data === "archived") setSuccess(`“${pendingAction.name}” se archivó para conservar su historial.`);
      else setSuccess(`“${pendingAction.name}” ya estaba archivado.`);
      setPendingAction(null); setTypedConfirmation("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar o archivar el producto.");
    } finally { setSaving(false); }
  }

  async function handleRestore(product: Product) {
    if (!businessId) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("restore_product_catalog_item", {
        p_business_id: businessId, p_product_id: product.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess(`“${product.name}” se restauró correctamente.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restaurar el producto.");
    } finally { setSaving(false); }
  }

  const page = darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]";
  const surface = darkMode ? "bg-[#171D28] border-[#293241]" : "bg-white border-[#EAECF0]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#8B909C]";
  const title = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const field = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[#E99A44] ${darkMode ? "border-[#354153] bg-[#101722] text-white" : "border-[#E5E7EB] bg-white text-[#20232B]"}`;

  return (
    <div className={`min-h-screen ${page}`}>
      <div className="mx-auto max-w-[1550px] px-5 py-7 sm:px-8">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className={`mb-2 text-xs ${muted}`}>{showArchived ? "CATÁLOGO / ARCHIVADOS" : "CATÁLOGO / ACTIVOS"}</p><h2 className={`text-2xl font-bold ${title}`}>{showArchived ? "Productos archivados" : "Catálogo de productos"}</h2><p className={`mt-2 text-sm ${muted}`}>Busca, filtra y administra tus variantes, precios y existencias.</p></div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="product-filters-panel"
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition ${surface} ${filtersOpen ? "border-[#E99A44]" : ""}`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 18h16M4 12h16" />
                  <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
                  <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
                </svg>
                Filtros
                {activeFilterCount > 0 && <span className="rounded-full bg-[#E99A44] px-2 py-0.5 text-[10px] font-bold text-[#171D28]">{activeFilterCount}</span>}
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {filtersOpen ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
                </svg>
              </button>
              <button type="button" onClick={() => { setShowArchived((v) => !v); clearFilters(); setFiltersOpen(false); setError(""); setSuccess(""); }} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${surface}`}>{showArchived ? "Ver activos" : "Ver archivados"}</button>
              {!showArchived && <button type="button" onClick={() => { setFormOpen((v) => !v); setError(""); setSuccess(""); }} className="rounded-lg bg-[#E99A44] px-5 py-2.5 text-xs font-bold text-[#171D28] hover:bg-[#F3AB5C]">{formOpen ? "Cerrar formulario" : "+ Nuevo producto"}</button>}
            </div>
          </div>

          {error && <div role="alert" className="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
          {success && <div role="status" className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-500">{success}</div>}

          {!showArchived && <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Productos activos", value: products.length, sub: "Variantes registradas" },
              { label: "Unidades en stock", value: totalUnits, sub: "Según movimientos" },
              { label: "Inventario pendiente", value: pendingInventory, sub: "Requieren conteo" },
              { label: "Valor a costo histórico", value: money(inventoryValue), sub: `${pendingCosts} productos con costo por revisar` },
            ].map((m) => <div key={m.label} className={`rounded-xl border p-5 ${surface}`}><p className={`text-xs ${muted}`}>{m.label}</p><p className={`mt-4 text-2xl font-bold ${title}`}>{m.value}</p><p className={`mt-1 text-[11px] ${muted}`}>{m.sub}</p></div>)}
          </section>}

          {/* FORMULARIO */}
          {formOpen && !showArchived && <section className={`mb-6 rounded-xl border p-5 sm:p-7 ${surface}`}>
            <h3 className={`mb-1 text-lg font-bold ${title}`}>Registrar nuevo producto</h3><p className={`mb-6 text-xs ${muted}`}>El producto se crea sin stock inicial; las unidades se registran mediante conteo físico.</p>
            <form onSubmit={handleCreateProduct} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className={`text-xs font-semibold ${title}`}>Nombre del producto *<input required value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Ej. Logitech G203 negro" className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>SKU interno<input value={form.sku} onChange={(e) => updateField("sku", e.target.value)} placeholder="EG-LOG-G203-BK" className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>Marca<select value={form.brand_id} onChange={(e) => updateField("brand_id", e.target.value)} className={`${field} mt-2`}><option value="">Seleccionar marca</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                <label className={`text-xs font-semibold ${title}`}>Modelo<input value={form.model_name} onChange={(e) => updateField("model_name", e.target.value)} placeholder="Ej. G203" className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>Color / variante<input value={form.color} onChange={(e) => updateField("color", e.target.value)} placeholder="Ej. Negro" className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>Categoría<select value={form.category_id} onChange={(e) => updateField("category_id", e.target.value)} className={`${field} mt-2`}><option value="">Seleccionar categoría</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className={`text-xs font-semibold ${title}`}>SKU del fabricante<input value={form.manufacturer_sku} onChange={(e) => updateField("manufacturer_sku", e.target.value)} className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>Condición<select value={form.condition_status} onChange={(e) => updateField("condition_status", e.target.value)} className={`${field} mt-2`}><option value="unknown">Sin confirmar</option><option value="sealed">Sellado</option><option value="open_box_unused">Caja abierta sin uso</option><option value="used">Usado</option></select></label>
                <label className={`text-xs font-semibold ${title}`}>Descripción<input value={form.description} onChange={(e) => updateField("description", e.target.value)} className={`${field} mt-2`} /></label>
              </div>
              <div className={`border-t pt-5 ${darkMode ? "border-[#354153]" : "border-[#EAECF0]"}`}><h4 className={`mb-4 text-sm font-bold ${title}`}>Precios y costos (S/)</h4><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className={`text-xs font-semibold ${title}`}>Costo histórico<input type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => updateField("cost_price", e.target.value)} className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>Precio publicado<input type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => updateField("sale_price", e.target.value)} className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>Precio objetivo<input type="number" min="0" step="0.01" value={form.offer_price} onChange={(e) => updateField("offer_price", e.target.value)} className={`${field} mt-2`} /></label>
                <label className={`text-xs font-semibold ${title}`}>Mínimo interno<input type="number" min="0" step="0.01" value={form.min_sale_price} onChange={(e) => updateField("min_sale_price", e.target.value)} className={`${field} mt-2`} /></label>
              </div></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className={`text-xs font-semibold ${title}`}>Stock mínimo<input type="number" min="0" step="1" value={form.minimum_stock} onChange={(e) => updateField("minimum_stock", e.target.value)} className={`${field} mt-2`} /></label><div className={`rounded-lg border p-3 text-xs leading-5 ${darkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-700"}`}>El stock inicial no se captura aquí. Se registrará mediante el proceso de conteo físico.</div></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => { setForm(emptyForm); setFormOpen(false); }} className={`rounded-lg border px-5 py-3 text-sm ${surface}`}>Cancelar</button><button disabled={saving} className="rounded-lg bg-[#E99A44] px-6 py-3 text-sm font-bold text-[#171D28] disabled:opacity-60">{saving ? "Guardando..." : "Guardar producto"}</button></div>
            </form>
          </section>}

          {/* FILTROS DESPLEGABLES */}
          {filtersOpen && <section id="product-filters-panel" className={`mb-5 overflow-hidden rounded-xl border ${surface}`}>
            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
              <div>
                <div className={`mb-4 flex items-center gap-2 border-b pb-3 ${darkMode ? "border-[#354153]" : "border-[#EAECF0]"}`}>
                  <span className={muted} aria-hidden="true">☷</span>
                  <h3 className={`text-sm font-bold ${title}`}>Filtros básicos</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={`text-[11px] font-semibold ${muted}`}>Marca<select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className={`${field} mt-1.5`}><option value="all">Todas las marcas</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Categoría<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${field} mt-1.5`}><option value="all">Todas las categorías</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Stock<select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className={`${field} mt-1.5`}><option value="all">Cualquier stock</option><option value="available">Con existencias</option><option value="zero">Sin existencias (0)</option><option value="low">Stock bajo (positivo y ≤ mínimo)</option><option value="below_minimum">Por debajo del mínimo</option></select></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Estado de inventario<select value={inventoryFilter} onChange={(e) => setInventoryFilter(e.target.value)} className={`${field} mt-1.5`}><option value="all">Todos</option><option value="verified">Verificado</option><option value="pending_count">Pendiente de conteo</option></select></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Estado del costo<select value={costFilter} onChange={(e) => setCostFilter(e.target.value)} className={`${field} mt-1.5`}><option value="all">Todos</option><option value="verified">Verificado</option><option value="documented">Documentado</option><option value="pending_review">Pendiente de revisión</option></select></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Condición<select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className={`${field} mt-1.5`}><option value="all">Todas</option><option value="sealed">Sellado</option><option value="open_box_unused">Caja abierta sin uso</option><option value="used">Usado</option><option value="unknown">Sin confirmar</option></select></label>
                </div>
              </div>

              <div>
                <div className={`mb-4 flex items-center gap-2 border-b pb-3 ${darkMode ? "border-[#354153]" : "border-[#EAECF0]"}`}>
                  <span className={muted} aria-hidden="true">⌕</span>
                  <h3 className={`text-sm font-bold ${title}`}>Filtros de búsqueda</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={`text-[11px] font-semibold sm:col-span-2 ${muted}`}>Buscar producto<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, SKU, modelo o color..." className={`${field} mt-1.5`} /></label>
                  <label className={`text-[11px] font-semibold sm:col-span-2 ${muted}`}>Filtrar precio por<select value={priceBasis} onChange={(e) => setPriceBasis(e.target.value)} className={`${field} mt-1.5`}><option value="sale">Precio publicado</option><option value="cost">Costo</option><option value="target">Precio objetivo</option><option value="minimum">Precio mínimo interno</option><option value="margin">Margen bruto unitario</option></select></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Precio desde (S/)<input type="number" min="0" step="0.01" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Sin mínimo" className={`${field} mt-1.5`} /></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Precio hasta (S/)<input type="number" min="0" step="0.01" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Sin máximo" className={`${field} mt-1.5`} /></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Ordenar por<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${field} mt-1.5`}><option value="name">Nombre</option><option value="stock">Stock</option><option value="sale">Precio publicado</option><option value="cost">Costo</option><option value="margin">Margen bruto unitario</option></select></label>
                  <label className={`text-[11px] font-semibold ${muted}`}>Dirección<select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)} className={`${field} mt-1.5`}><option value="asc">Ascendente</option><option value="desc">Descendente</option></select></label>
                </div>
              </div>
            </div>
            <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFAFB]"}`}>
              <button type="button" onClick={clearFilters} className="text-xs font-semibold text-[#D98B3C] hover:underline">Limpiar filtros</button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-lg bg-[#168BD2] px-4 py-2 text-xs font-bold text-white hover:bg-[#0878BC]">✓ Aplicar</button>
            </div>
          </section>}

          {/* TABLA */}
          <section className={`overflow-hidden rounded-xl border ${surface}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-inherit px-5 py-4"><div><h3 className={`text-sm font-bold ${title}`}>{showArchived ? "Productos archivados" : "Productos registrados"}</h3><p className={`mt-1 text-xs ${muted}`}>{filteredProducts.length} resultados de {products.length}</p></div><button onClick={() => void loadData()} type="button" className={`rounded-lg border px-3 py-2 text-xs font-medium ${surface}`}>↻ Actualizar</button></div>
            {loading ? <div className={`p-12 text-center text-sm ${muted}`}>Cargando productos...</div> : filteredProducts.length === 0 ? <div className="p-12 text-center"><p className={`text-sm font-semibold ${title}`}>No encontramos productos.</p><p className={`mt-2 text-xs ${muted}`}>Prueba otros filtros o registra un producto nuevo.</p></div> :
              <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left"><thead><tr className={`border-b text-[10px] uppercase tracking-wider ${darkMode ? "border-[#354153] text-[#A0ABBC]" : "border-[#EAECF0] text-[#9297A3]"}`}>
                <th className="px-5 py-4">Producto</th><th className="px-3 py-4">SKU</th><th className="px-3 py-4">Costo</th><th className="px-3 py-4">Publicado</th><th className="px-3 py-4">Objetivo</th><th className="px-3 py-4">Mínimo</th><th className="px-3 py-4">Stock</th><th className="px-3 py-4">Condición</th><th className="px-3 py-4">Validación</th><th className="px-5 py-4">Acciones</th>
              </tr></thead><tbody>{filteredProducts.map((p) => {
                const brand = brands.find((b) => b.id === p.brand_id);
                const category = categories.find((c) => c.id === p.category_id);
                const targetBelowCost = p.offer_price !== null && p.offer_price < p.cost_price;
                return <tr key={p.id} className={`border-b ${darkMode ? "border-[#293241] hover:bg-[#202938]" : "border-[#F0F1F4] hover:bg-[#FAFAFB]"}`}>
                  <td className="px-5 py-4"><p className={`text-sm font-semibold ${title}`}>{p.name}</p><p className={`mt-1 text-[10px] ${muted}`}>{brand?.name ?? "Sin marca"} · {p.model_name ?? "Sin modelo"}{p.color ? ` · ${p.color}` : ""}{category ? ` · ${category.name}` : ""}</p></td>
                  <td className={`px-3 py-4 text-xs ${muted}`}>{p.sku ?? "—"}</td>
                  <td className={`px-3 py-4 text-xs ${title}`}>{money(p.cost_price)}<p className={`mt-1 text-[10px] ${p.cost_status === "verified" ? "text-green-500" : "text-amber-500"}`}>{p.cost_status === "verified" ? "Verificado" : p.cost_status === "documented" ? "Documentado" : "Por revisar"}</p></td>
                  <td className={`px-3 py-4 text-xs ${title}`}>{money(p.sale_price)}</td>
                  <td className={`px-3 py-4 text-xs ${title}`}>{money(p.offer_price)}{targetBelowCost && <p className="mt-1 text-[10px] text-red-500">Bajo costo</p>}</td>
                  <td className={`px-3 py-4 text-xs ${title}`}>{p.min_sale_price === null ? "—" : money(p.min_sale_price)}</td>
                  <td className={`px-3 py-4 text-sm font-bold ${title}`}>{p.stock_quantity}<p className={`mt-1 text-[10px] ${muted}`}>Mín.: {p.minimum_stock}</p></td>
                  <td className={`px-3 py-4 text-xs ${muted}`}>{conditionLabel(p.condition_status)}</td>
                  <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${p.inventory_status === "verified" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"}`}>{p.inventory_status === "verified" ? "Verificado" : "Pendiente"}</span></td>
                  <td className="px-5 py-4">{showArchived ? <button disabled={saving} type="button" onClick={() => void handleRestore(p)} className="rounded-lg border border-green-500/30 px-3 py-2 text-[11px] font-semibold text-green-500 hover:bg-green-500/10">Restaurar</button> : <button type="button" onClick={() => { setPendingAction(p); setTypedConfirmation(""); setError(""); }} className="rounded-lg border border-red-500/30 px-3 py-2 text-[11px] font-semibold text-red-500 hover:bg-red-500/10">Eliminar</button>}</td>
                </tr>;
              })}</tbody></table></div>}
          </section>
          <footer className={`py-7 text-center text-[10px] ${muted}`}>ELITE GAMMA MANAGER · CATÁLOGO DE PRODUCTOS</footer>
      </div>

      {/* MODAL DE CONFIRMACION: LA BD DECIDE BORRAR O ARCHIVAR */}
      {pendingAction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="delete-title" className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${surface}`}>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-xl text-red-500">!</div>
          <h2 id="delete-title" className={`text-lg font-bold ${title}`}>Confirmar eliminación</h2>
          <p className={`mt-2 text-sm leading-6 ${muted}`}>Vas a retirar <strong className={title}>{pendingAction.name}</strong> del catálogo activo.</p>
          <div className={`mt-4 rounded-lg p-3 text-xs leading-5 ${darkMode ? "bg-[#101722] text-[#B6C0CE]" : "bg-[#F6F7F9] text-[#687080]"}`}>
            Si el producto no tiene movimientos ni referencias históricas, se eliminará definitivamente. Si tiene compras, ventas, movimientos, conteos o precios históricos, se archivará para conservar el historial. No se eliminarán esos registros.
          </div>
          <label className={`mt-5 block text-xs font-semibold ${title}`}>Escribe exactamente el nombre del producto para confirmar:<input autoComplete="off" value={typedConfirmation} onChange={(e) => setTypedConfirmation(e.target.value)} placeholder={pendingAction.name} className={`${field} mt-2`} /></label>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setPendingAction(null); setTypedConfirmation(""); }} className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${surface}`}>Cancelar</button><button type="button" disabled={saving || typedConfirmation.trim() !== pendingAction.name} onClick={() => void handleDeleteOrArchive()} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Procesando..." : "Confirmar eliminación"}</button></div>
        </section>
      </div>}
    </div>
  );
}
