"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type SupplierForm = {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const emptyForm: SupplierForm = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function ProveedoresPage() {
  const [businessId, setBusinessId] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem("elite-gamma-theme") === "dark");
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
      if (!business) throw new Error("No encontramos ELITE GAMMA asociado a tu usuario.");
      setBusinessId(business.id);

      const { data, error: suppliersError } = await supabase
        .from("suppliers")
        .select("id,name,contact_name,phone,email,address,notes,is_active,created_at")
        .eq("business_id", business.id)
        .order("name", { ascending: true });

      if (suppliersError) throw new Error(suppliersError.message);
      setSuppliers((data ?? []) as Supplier[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los proveedores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCount = suppliers.filter((supplier) => supplier.is_active).length;
  const inactiveCount = suppliers.length - activeCount;

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (!showInactive && !supplier.is_active) return false;
      const text = [
        supplier.name,
        supplier.contact_name ?? "",
        supplier.phone ?? "",
        supplier.email ?? "",
        supplier.address ?? "",
      ].join(" ").toLowerCase();
      return !term || text.includes(term);
    });
  }, [suppliers, search, showInactive]);

  const pageBg = darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]";
  const card = darkMode ? "border-[#293241] bg-[#171D28]" : "border-[#EAECF0] bg-white";
  const primary = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#858C99]";
  const inputClass = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[#E99A44] ${darkMode ? "border-[#354153] bg-[#101722] text-white placeholder:text-[#697589]" : "border-[#E5E7EB] bg-white text-[#20232B] placeholder:text-[#9CA3AF]"}`;

  function openNewSupplier() {
    setEditingSupplier(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditSupplier(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function updateField(field: keyof SupplierForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = form.name.trim();
    if (!name) {
      setError("El nombre del proveedor es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingSupplier) {
        const { error: updateError } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("business_id", businessId)
          .eq("id", editingSupplier.id);
        if (updateError) throw new Error(updateError.message);
        setSuccess("Proveedor actualizado correctamente.");
      } else {
        const { error: insertError } = await supabase
          .from("suppliers")
          .insert({ business_id: businessId, ...payload, is_active: true });
        if (insertError) throw new Error(insertError.message);
        setSuccess("Proveedor registrado correctamente.");
      }

      setModalOpen(false);
      setEditingSupplier(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSupplier(supplier: Supplier) {
    const action = supplier.is_active ? "archivar" : "reactivar";
    const confirmation = window.confirm(
      supplier.is_active
        ? `¿Archivar al proveedor "${supplier.name}"? Se conservarán sus compras y su historial.`
        : `¿Reactivar al proveedor "${supplier.name}"?`
    );
    if (!confirmation) return;

    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("suppliers")
        .update({ is_active: !supplier.is_active })
        .eq("business_id", businessId)
        .eq("id", supplier.id);
      if (updateError) throw new Error(updateError.message);
      setSuccess(`Proveedor ${action === "archivar" ? "archivado" : "reactivado"}. Su historial se conservó.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el proveedor.");
    }
  }

  return (
    <main className={`min-h-screen ${pageBg}`}>
      <header className={`sticky top-0 z-10 flex min-h-[68px] items-center justify-between border-b px-5 sm:px-8 ${darkMode ? "border-[#293241] bg-[#141A24]" : "border-[#EAECF0] bg-white"}`}>
        <div>
          <p className={`text-[10px] tracking-[1.8px] ${muted}`}>ELITE GAMMA / COMPRAS</p>
          <h1 className={`text-lg font-bold ${primary}`}>Proveedores</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { const next = !darkMode; setDarkMode(next); window.localStorage.setItem("elite-gamma-theme", next ? "dark" : "light"); }} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${darkMode ? "border-[#354153] bg-[#202938]" : "border-[#EAECF0] bg-white"}`}>
            {darkMode ? "☀ Modo claro" : "☾ Modo oscuro"}
          </button>
          <a href="/" className="rounded-lg bg-[#191D29] px-3 py-2 text-xs font-semibold text-white">Dashboard</a>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className={`mb-2 text-xs ${muted}`}>GESTIÓN DE COMPRAS Y ABASTECIMIENTO</p>
            <h2 className={`text-2xl font-bold ${primary}`}>Directorio de proveedores</h2>
            <p className={`mt-2 text-sm ${muted}`}>Administra contactos, datos comerciales e historial de tus proveedores.</p>
          </div>
          <button type="button" onClick={openNewSupplier} className="rounded-lg bg-[#E99A44] px-5 py-3 text-sm font-bold text-[#171D28] hover:bg-[#F3AB5C]">+ Nuevo proveedor</button>
        </div>

        {error && <div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
        {success && <div role="status" className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-500">{success}</div>}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Proveedores registrados", value: suppliers.length, detail: "Total histórico" },
            { label: "Proveedores activos", value: activeCount, detail: "Disponibles para nuevas compras" },
            { label: "Proveedores archivados", value: inactiveCount, detail: "Con historial conservado" },
          ].map((metric) => (
            <div key={metric.label} className={`rounded-xl border p-5 ${card}`}>
              <p className={`text-xs ${muted}`}>{metric.label}</p>
              <p className={`mt-3 text-2xl font-bold ${primary}`}>{metric.value}</p>
              <p className={`mt-1 text-[11px] ${muted}`}>{metric.detail}</p>
            </div>
          ))}
        </section>

        <section className={`mb-5 rounded-xl border p-4 ${card}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar proveedor, contacto, teléfono o correo..." className={inputClass} />
            <label className={`flex shrink-0 items-center gap-2 text-xs ${muted}`}>
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Mostrar archivados
            </label>
            <button type="button" onClick={() => void loadData()} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${darkMode ? "border-[#354153]" : "border-[#E5E7EB]"}`}>↻ Actualizar</button>
          </div>
        </section>

        <section className={`overflow-hidden rounded-xl border ${card}`}>
          <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}>
            <div>
              <h3 className={`text-sm font-bold ${primary}`}>Proveedores</h3>
              <p className={`mt-1 text-xs ${muted}`}>{filteredSuppliers.length} resultados</p>
            </div>
          </div>

          {loading ? (
            <div className={`p-12 text-center text-sm ${muted}`}>Cargando proveedores...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center">
              <p className={`text-sm font-semibold ${primary}`}>Todavía no hay proveedores para mostrar.</p>
              <p className={`mt-2 text-xs ${muted}`}>Registra Sercoplus, tu proveedor Redragon u otros proveedores.</p>
              <button type="button" onClick={openNewSupplier} className="mt-4 rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28]">Registrar primer proveedor</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className={`border-b text-[10px] uppercase tracking-wider ${darkMode ? "border-[#354153] text-[#A0ABBC]" : "border-[#EAECF0] text-[#9297A3]"}`}>
                    <th className="px-5 py-4">Proveedor</th>
                    <th className="px-4 py-4">Contacto</th>
                    <th className="px-4 py-4">Teléfono</th>
                    <th className="px-4 py-4">Correo</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className={`border-b ${darkMode ? "border-[#293241] hover:bg-[#202938]" : "border-[#F0F1F4] hover:bg-[#FAFAFB]"}`}>
                      <td className="px-5 py-4">
                        <p className={`text-sm font-semibold ${primary}`}>{supplier.name}</p>
                        {supplier.address && <p className={`mt-1 max-w-[220px] truncate text-[10px] ${muted}`}>{supplier.address}</p>}
                      </td>
                      <td className={`px-4 py-4 text-xs ${muted}`}>{supplier.contact_name || "—"}</td>
                      <td className={`px-4 py-4 text-xs ${muted}`}>{supplier.phone || "—"}</td>
                      <td className={`px-4 py-4 text-xs ${muted}`}>{supplier.email || "—"}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${supplier.is_active ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-400"}`}>{supplier.is_active ? "Activo" : "Archivado"}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openEditSupplier(supplier)} className={`rounded-md border px-3 py-2 text-[11px] font-semibold ${darkMode ? "border-[#354153]" : "border-[#E5E7EB]"}`}>Editar</button>
                          <button type="button" onClick={() => void toggleSupplier(supplier)} className={`rounded-md border px-3 py-2 text-[11px] font-semibold ${supplier.is_active ? "border-amber-500/40 text-amber-500" : "border-green-500/40 text-green-500"}`}>{supplier.is_active ? "Archivar" : "Reactivar"}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className={`mt-5 text-center text-[10px] ${muted}`}>ELITE GAMMA MANAGER · DIRECTORIO DE PROVEEDORES</p>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title" className={`my-auto w-full max-w-2xl rounded-2xl border p-6 shadow-2xl ${card}`}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 id="supplier-modal-title" className={`text-lg font-bold ${primary}`}>{editingSupplier ? "Editar proveedor" : "Registrar proveedor"}</h3>
                <p className={`mt-1 text-xs ${muted}`}>Los datos se guardan en el negocio ELITE GAMMA.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className={`rounded-lg px-3 py-1.5 text-sm ${muted}`} aria-label="Cerrar">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={`mb-1.5 block text-xs font-semibold ${primary}`}>Nombre del proveedor *</label>
                  <input required autoFocus value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ej. Sercoplus" className={inputClass}/>
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${primary}`}>Persona de contacto</label>
                  <input value={form.contact_name} onChange={(event) => updateField("contact_name", event.target.value)} className={inputClass}/>
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${primary}`}>Teléfono</label>
                  <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className={inputClass}/>
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${primary}`}>Correo electrónico</label>
                  <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={inputClass}/>
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${primary}`}>Dirección</label>
                  <input value={form.address} onChange={(event) => updateField("address", event.target.value)} className={inputClass}/>
                </div>
                <div className="sm:col-span-2">
                  <label className={`mb-1.5 block text-xs font-semibold ${primary}`}>Notas internas</label>
                  <textarea rows={3} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} className={inputClass} placeholder="Condiciones comerciales, garantías, datos de facturación..."/>
                </div>
              </div>

              {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}

              <div className="flex flex-col-reverse justify-end gap-2 border-t border-inherit pt-4 sm:flex-row">
                <button type="button" onClick={() => setModalOpen(false)} className={`rounded-lg border px-5 py-2.5 text-sm font-semibold ${darkMode ? "border-[#354153]" : "border-[#E5E7EB]"}`}>Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#E99A44] px-5 py-2.5 text-sm font-bold text-[#171D28] disabled:opacity-60">{saving ? "Guardando..." : editingSupplier ? "Guardar cambios" : "Registrar proveedor"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
