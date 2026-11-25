"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  district: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerSale = {
  id: string;
  customer_id: string | null;
  sale_number: string | null;
  sale_date: string;
  channel: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
};

type CustomerForm = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  district: "",
  notes: "",
};

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    pending_payment: "Pendiente de pago",
    paid: "Pagada",
    preparing: "En preparación",
    shipped: "En reparto",
    delivered: "Entregada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
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

export default function ClientesPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<CustomerSale[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem("elite-gamma-theme") === "dark");
    const handleTheme = (event: Event) => {
      const detail = (event as CustomEvent<{ darkMode?: boolean }>).detail;
      setDarkMode(typeof detail?.darkMode === "boolean" ? detail.darkMode : window.localStorage.getItem("elite-gamma-theme") === "dark");
    };
    window.addEventListener("elite-gamma-theme-change", handleTheme);
    return () => window.removeEventListener("elite-gamma-theme-change", handleTheme);
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
      if (businessError) throw new Error(`Negocio: ${businessError.message}`);
      if (!business) throw new Error("No encontramos ELITE GAMMA asociado a tu usuario.");
      setBusinessId(business.id);

      const [customersResult, salesResult] = await Promise.all([
        supabase
          .from("customers")
          .select("id,full_name,phone,email,address,district,notes,created_at,updated_at")
          .eq("business_id", business.id)
          .order("full_name", { ascending: true }),
        supabase
          .from("sales")
          .select("id,customer_id,sale_number,sale_date,channel,status,payment_status,total_amount")
          .eq("business_id", business.id)
          .not("customer_id", "is", null)
          .order("sale_date", { ascending: false })
          .limit(1000),
      ]);
      if (customersResult.error) throw new Error(`Clientes: ${customersResult.error.message}`);
      if (salesResult.error) throw new Error(`Historial de ventas: ${salesResult.error.message}`);

      const loadedCustomers = (customersResult.data ?? []) as Customer[];
      setCustomers(loadedCustomers);
      setSales((salesResult.data ?? []) as CustomerSale[]);
      setSelectedCustomerId((current) => current || loadedCustomers[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) => [
      customer.full_name,
      customer.phone ?? "",
      customer.email ?? "",
      customer.address ?? "",
      customer.district ?? "",
    ].join(" ").toLowerCase().includes(term));
  }, [customers, search]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const customerSales = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales
      .filter((sale) => sale.customer_id === selectedCustomer.id)
      .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
  }, [sales, selectedCustomer]);

  const customerStats = useMemo(() => {
    const salesByCustomer = new Map<string, CustomerSale[]>();
    for (const sale of sales) {
      if (!sale.customer_id) continue;
      const existing = salesByCustomer.get(sale.customer_id) ?? [];
      existing.push(sale);
      salesByCustomer.set(sale.customer_id, existing);
    }
    const buyingCustomers = [...salesByCustomer.keys()].length;
    const confirmedRevenue = sales
      .filter((sale) => sale.status !== "cancelled" && sale.payment_status === "confirmed")
      .reduce((sum, sale) => sum + Number(sale.total_amount ?? 0), 0);
    return {
      total: customers.length,
      withPurchases: buyingCustomers,
      pending: sales.filter((sale) => sale.status === "pending_payment").length,
      confirmedRevenue,
    };
  }, [customers, sales]);

  const pageBg = darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]";
  const card = darkMode ? "border-[#293241] bg-[#171D28]" : "border-[#EAECF0] bg-white";
  const primary = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#858C99]";
  const inputClass = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[#E99A44] ${darkMode ? "border-[#354153] bg-[#101722] text-white placeholder:text-[#697589]" : "border-[#E5E7EB] bg-white text-[#20232B] placeholder:text-[#9CA3AF]"}`;
  const primaryButton = "rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28] transition hover:bg-[#F3AB5C] disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton = `rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${darkMode ? "border-[#354153] bg-[#202938] text-[#DCE2EC] hover:bg-[#273244]" : "border-[#E5E7EB] bg-white text-[#505765] hover:bg-[#F8F9FB]"}`;

  function openNewCustomer() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditCustomer(customer: Customer) {
    setEditingCustomer(customer);
    setForm({
      full_name: customer.full_name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      district: customer.district ?? "",
      notes: customer.notes ?? "",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    const fullName = form.full_name.trim();
    if (!fullName) {
      setError("El nombre completo es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const payload = {
        full_name: fullName,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        district: form.district.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingCustomer) {
        const { error: updateError } = await supabase
          .from("customers")
          .update(payload)
          .eq("business_id", businessId)
          .eq("id", editingCustomer.id);
        if (updateError) throw new Error(updateError.message);
        setSelectedCustomerId(editingCustomer.id);
        setSuccess("Cliente actualizado correctamente.");
      } else {
        const { data, error: insertError } = await supabase
          .from("customers")
          .insert({ business_id: businessId, ...payload })
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        if (data?.id) setSelectedCustomerId(data.id);
        setSuccess("Cliente registrado correctamente.");
      }

      setModalOpen(false);
      setForm(emptyForm);
      setEditingCustomer(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={`flex min-h-[calc(100vh-68px)] items-center justify-center ${pageBg}`}>
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#E99A44] border-t-transparent" />
          <p className={`text-sm ${muted}`}>Cargando clientes de ELITE GAMMA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-68px)] p-4 sm:p-6 lg:p-7 ${pageBg}`}>
      <div className="mx-auto max-w-[1440px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-[10px] font-bold tracking-[2px] ${muted}`}>RELACIONES COMERCIALES</p>
            <h2 className={`mt-1 text-2xl font-bold tracking-tight ${primary}`}>Clientes</h2>
            <p className={`mt-1 text-sm ${muted}`}>Contactos e historial comercial de ELITE GAMMA.</p>
          </div>
          <button type="button" onClick={openNewCustomer} className={primaryButton}>+ Nuevo cliente</button>
        </div>

        {error && <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${darkMode ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{error}</div>}
        {success && <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${darkMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{success}</div>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-[11px] font-medium ${muted}`}>Clientes registrados</p>
            <p className={`mt-2 text-2xl font-bold ${primary}`}>{customerStats.total}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>Contactos guardados</p>
          </div>
          <div className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-[11px] font-medium ${muted}`}>Con compras</p>
            <p className={`mt-2 text-2xl font-bold ${primary}`}>{customerStats.withPurchases}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>Clientes con ventas asociadas</p>
          </div>
          <div className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-[11px] font-medium ${muted}`}>Ventas por cobrar</p>
            <p className={`mt-2 text-2xl font-bold ${primary}`}>{customerStats.pending}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>Estado pendiente de pago</p>
          </div>
          <div className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-[11px] font-medium ${muted}`}>Importe de ventas pagadas</p>
            <p className={`mt-2 text-2xl font-bold ${primary}`}>{money(customerStats.confirmedRevenue)}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>Ventas con pago confirmado</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <section className={`overflow-hidden rounded-xl border ${card}`}>
            <div className={`border-b p-4 ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className={`text-sm font-bold ${primary}`}>Directorio de clientes</h3>
                  <p className={`mt-1 text-[11px] ${muted}`}>{filteredCustomers.length} de {customers.length} clientes</p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}>⌕</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, teléfono o correo..." className={`${inputClass} pl-9`} />
                </div>
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-xl ${darkMode ? "bg-[#202938] text-[#A0ABBC]" : "bg-[#F3F4F6] text-[#858C99]"}`}>♧</div>
                <h4 className={`mt-3 text-sm font-bold ${primary}`}>{customers.length === 0 ? "Todavía no tienes clientes" : "No encontramos resultados"}</h4>
                <p className={`mx-auto mt-1 max-w-sm text-xs leading-5 ${muted}`}>{customers.length === 0 ? "Registra a tus clientes para tener sus datos de contacto e historial de compras en un solo lugar." : "Prueba con otro nombre, teléfono, correo o distrito."}</p>
                {customers.length === 0 && <button type="button" onClick={openNewCustomer} className={`${primaryButton} mt-4`}>Registrar primer cliente</button>}
              </div>
            ) : (
              <div className="max-h-[680px] overflow-y-auto">
                {filteredCustomers.map((customer) => {
                  const active = customer.id === selectedCustomerId;
                  const count = sales.filter((sale) => sale.customer_id === customer.id && sale.status !== "cancelled").length;
                  return (
                    <button
                      type="button"
                      key={customer.id}
                      onClick={() => { setSelectedCustomerId(customer.id); setError(""); setSuccess(""); }}
                      className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition ${darkMode ? "border-[#293241] hover:bg-[#202938]" : "border-[#F0F1F3] hover:bg-[#FAFBFC]"} ${active ? (darkMode ? "bg-[#202938]" : "bg-[#FFF8F0]") : ""}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${darkMode ? "bg-[#29384A] text-[#F2C18D]" : "bg-[#FFF0DF] text-[#A95C16]"}`}>{customer.full_name.trim().charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-semibold ${primary}`}>{customer.full_name}</span>
                        <span className={`mt-1 block truncate text-[11px] ${muted}`}>{customer.phone || customer.email || "Sin teléfono ni correo"}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block text-[11px] font-semibold ${primary}`}>{count} {count === 1 ? "venta" : "ventas"}</span>
                        <span className={`mt-1 block text-[10px] ${muted}`}>{dateLabel(customer.created_at)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`rounded-xl border p-4 sm:p-5 ${card}`}>
            {!selectedCustomer ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <p className={`text-sm font-semibold ${primary}`}>Selecciona un cliente</p>
                <p className={`mt-1 text-xs ${muted}`}>Aquí aparecerán sus datos e historial comercial.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${darkMode ? "bg-[#29384A] text-[#F2C18D]" : "bg-[#FFF0DF] text-[#A95C16]"}`}>{selectedCustomer.full_name.trim().charAt(0).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold tracking-[1.5px] ${muted}`}>FICHA DEL CLIENTE</p>
                      <h3 className={`mt-1 truncate text-lg font-bold ${primary}`}>{selectedCustomer.full_name}</h3>
                    </div>
                  </div>
                  <button type="button" onClick={() => openEditCustomer(selectedCustomer)} className={secondaryButton}>Editar</button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={`rounded-lg p-3 ${darkMode ? "bg-[#101722]" : "bg-[#F8F9FB]"}`}>
                    <p className={`text-[10px] ${muted}`}>Teléfono</p>
                    <p className={`mt-1 break-words text-sm font-semibold ${primary}`}>{selectedCustomer.phone || "No registrado"}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${darkMode ? "bg-[#101722]" : "bg-[#F8F9FB]"}`}>
                    <p className={`text-[10px] ${muted}`}>Correo</p>
                    <p className={`mt-1 break-words text-sm font-semibold ${primary}`}>{selectedCustomer.email || "No registrado"}</p>
                  </div>
                  <div className={`rounded-lg p-3 sm:col-span-2 ${darkMode ? "bg-[#101722]" : "bg-[#F8F9FB]"}`}>
                    <p className={`text-[10px] ${muted}`}>Dirección</p>
                    <p className={`mt-1 break-words text-sm font-semibold ${primary}`}>{[selectedCustomer.address, selectedCustomer.district].filter(Boolean).join(" · ") || "No registrada"}</p>
                  </div>
                </div>

                {selectedCustomer.notes && (
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Notas internas</p>
                    <p className={`mt-1 whitespace-pre-wrap text-xs leading-5 ${primary}`}>{selectedCustomer.notes}</p>
                  </div>
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h4 className={`text-sm font-bold ${primary}`}>Historial de compras</h4>
                      <p className={`mt-1 text-[10px] ${muted}`}>Las ventas se muestran con su estado actual.</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${darkMode ? "bg-[#202938] text-[#DCE2EC]" : "bg-[#F2F4F7] text-[#606775]"}`}>{customerSales.length} registros</span>
                  </div>
                  {customerSales.length === 0 ? (
                    <div className={`rounded-lg border border-dashed p-5 text-center ${darkMode ? "border-[#354153]" : "border-[#DDE1E7]"}`}>
                      <p className={`text-xs ${muted}`}>Este cliente todavía no tiene ventas asociadas.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerSales.slice(0, 8).map((sale) => (
                        <div key={sale.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${darkMode ? "border-[#293241] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]"}`}>
                          <div className="min-w-0">
                            <p className={`truncate text-xs font-semibold ${primary}`}>{sale.sale_number || "Venta sin número"}</p>
                            <p className={`mt-1 text-[10px] ${muted}`}>{dateLabel(sale.sale_date)} · {channelLabel(sale.channel)}</p>
                            <p className={`mt-1 text-[10px] ${muted}`}>{statusLabel(sale.status)}</p>
                          </div>
                          <p className={`shrink-0 text-xs font-bold ${primary}`}>{money(sale.total_amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className={`border-t pt-3 text-[10px] leading-4 ${darkMode ? "border-[#293241] text-[#7F8A9C]" : "border-[#EAECF0] text-[#9298A3]"}`}>Cliente registrado el {dateLabel(selectedCustomer.created_at)}. El historial se conserva aunque actualices sus datos.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <form onSubmit={handleSubmit} className={`my-8 w-full max-w-xl rounded-2xl border p-5 shadow-2xl ${card}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${primary}`}>{editingCustomer ? "Editar cliente" : "Nuevo cliente"}</h3>
                <p className={`mt-1 text-xs ${muted}`}>Los datos se podrán reutilizar al registrar ventas.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className={secondaryButton} disabled={saving}>Cerrar</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Nombre completo *</span>
                <input required autoFocus value={form.full_name} onChange={(event) => updateField("full_name", event.target.value)} className={inputClass} />
              </label>
              <label>
                <span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Teléfono</span>
                <input type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className={inputClass} placeholder="Ej. 999 999 999" />
              </label>
              <label>
                <span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Correo electrónico</span>
                <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={inputClass} placeholder="cliente@correo.com" />
              </label>
              <label className="sm:col-span-2">
                <span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Dirección</span>
                <input value={form.address} onChange={(event) => updateField("address", event.target.value)} className={inputClass} placeholder="Dirección de entrega" />
              </label>
              <label>
                <span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Distrito</span>
                <input value={form.district} onChange={(event) => updateField("district", event.target.value)} className={inputClass} placeholder="Distrito" />
              </label>
              <label>
                <span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Notas internas</span>
                <input value={form.notes} onChange={(event) => updateField("notes", event.target.value)} className={inputClass} placeholder="Preferencias o indicaciones" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className={secondaryButton} disabled={saving}>Cancelar</button>
              <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Guardando..." : editingCustomer ? "Guardar cambios" : "Registrar cliente"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
