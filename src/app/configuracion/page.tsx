"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Business = {
  id: string;
  name: string;
  currency_code: string;
  legal_name: string | null;
  tax_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
};

type BusinessSettings = {
  currency_code: string;
  timezone: string;
  source_cutoff_date: string | null;
  opened_at: string;
  delivery_payment_policy: string;
  delivery_cost_paid_by: string;
} | null;

type FormState = {
  name: string;
  legal_name: string;
  tax_id: string;
  contact_email: string;
  contact_phone: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  legal_name: "",
  tax_id: "",
  contact_email: "",
  contact_phone: "",
  address: "",
};

function dateTimeLabel(value: string | null | undefined, timeZone = "America/Lima") {
  if (!value) return "No registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "No registrado";
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return value;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#293241] py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-[#A0ABBC]">{label}</span>
      <span className="text-sm font-semibold text-[#E7EAF0] sm:text-right">{value}</span>
    </div>
  );
}

export default function ConfiguracionPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<BusinessSettings>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, currency_code, legal_name, tax_id, contact_email, contact_phone, address, created_at")
      .limit(1)
      .maybeSingle();

    if (businessError) {
      setError(`No se pudo cargar el negocio: ${businessError.message}`);
      setLoading(false);
      return;
    }
    if (!businessData) {
      setError("No se encontró un negocio asociado a la sesión actual.");
      setBusiness(null);
      setSettings(null);
      setLoading(false);
      return;
    }

    const typedBusiness = businessData as Business;
    setBusiness(typedBusiness);
    setForm({
      name: typedBusiness.name ?? "",
      legal_name: typedBusiness.legal_name ?? "",
      tax_id: typedBusiness.tax_id ?? "",
      contact_email: typedBusiness.contact_email ?? "",
      contact_phone: typedBusiness.contact_phone ?? "",
      address: typedBusiness.address ?? "",
    });

    const { data: settingsData, error: settingsError } = await supabase
      .from("business_settings")
      .select("currency_code, timezone, source_cutoff_date, opened_at, delivery_payment_policy, delivery_cost_paid_by")
      .eq("business_id", typedBusiness.id)
      .maybeSingle();

    if (settingsError) {
      setError(`Los datos del negocio cargaron, pero no se pudieron leer las políticas: ${settingsError.message}`);
      setSettings(null);
    } else {
      setSettings((settingsData as BusinessSettings) ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    setError("");
    setSuccess("");

    const cleanName = form.name.trim();
    const cleanTaxId = form.tax_id.trim();
    const cleanEmail = form.contact_email.trim();

    if (!cleanName) {
      setError("El nombre comercial es obligatorio.");
      return;
    }
    if (cleanTaxId && !/^\d{11}$/.test(cleanTaxId)) {
      setError("El RUC debe contener exactamente 11 dígitos. También puedes dejarlo vacío si aún no deseas registrarlo.");
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Revisa el formato del correo comercial.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("businesses")
      .update({
        name: cleanName,
        legal_name: form.legal_name.trim() || null,
        tax_id: cleanTaxId || null,
        contact_email: cleanEmail || null,
        contact_phone: form.contact_phone.trim() || null,
        address: form.address.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", business.id)
      .select("id, name, currency_code, legal_name, tax_id, contact_email, contact_phone, address, created_at")
      .single();
    setSaving(false);

    if (updateError) {
      setError(`No se pudieron guardar los cambios: ${updateError.message}`);
      return;
    }

    const updatedBusiness = data as Business;
    setBusiness(updatedBusiness);
    setForm({
      name: updatedBusiness.name ?? "",
      legal_name: updatedBusiness.legal_name ?? "",
      tax_id: updatedBusiness.tax_id ?? "",
      contact_email: updatedBusiness.contact_email ?? "",
      contact_phone: updatedBusiness.contact_phone ?? "",
      address: updatedBusiness.address ?? "",
    });
    setSuccess("Los datos comerciales se guardaron correctamente.");
  }

  const panel = darkMode
    ? "border-[#293241] bg-[#171D28]"
    : "border-[#E1E5EC] bg-white";
  const input = darkMode
    ? "border-[#354153] bg-[#101722] text-[#E7EAF0] placeholder:text-[#778397]"
    : "border-[#D8DEE8] bg-white text-[#20232B] placeholder:text-[#98A0AE]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#737987]";
  const heading = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";

  if (loading) {
    return <div className={`min-h-[calc(100vh-68px)] p-6 ${darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]"}`}>Cargando configuración del negocio...</div>;
  }

  return (
    <div className={`min-h-[calc(100vh-68px)] px-4 py-6 sm:px-7 lg:px-9 ${darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]"}`}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-[10px] font-bold tracking-[2px] ${muted}`}>ELITE GAMMA / SISTEMA</p>
            <h2 className={`mt-2 text-2xl font-bold ${heading}`}>Configuración</h2>
            <p className={`mt-1 text-sm ${muted}`}>Datos del negocio, preferencias y reglas operativas.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${input}`}
          >
            ↻ Actualizar
          </button>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">{success}</div>}

        {!business ? (
          <section className={`rounded-2xl border p-6 ${panel}`}>
            <h3 className={`font-bold ${heading}`}>No hay un negocio disponible</h3>
            <p className={`mt-2 text-sm ${muted}`}>La sesión actual no tiene acceso a un registro de negocio.</p>
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className={`rounded-2xl border p-5 sm:p-6 ${panel}`}>
              <div className="mb-5">
                <h3 className={`text-base font-bold ${heading}`}>Datos comerciales y fiscales</h3>
                <p className={`mt-1 text-xs ${muted}`}>Estos datos identifican a ELITE GAMMA en documentos y reportes.</p>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${muted}`} htmlFor="business-name">Nombre comercial *</label>
                  <input id="business-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} maxLength={120} required className={`w-full rounded-lg border px-3 py-3 text-sm outline-none focus:border-[#F39A38] ${input}`} />
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${muted}`} htmlFor="legal-name">Razón social</label>
                  <input id="legal-name" value={form.legal_name} onChange={(event) => updateField("legal_name", event.target.value)} maxLength={180} placeholder="Razón social registrada (opcional)" className={`w-full rounded-lg border px-3 py-3 text-sm outline-none focus:border-[#F39A38] ${input}`} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={`mb-1.5 block text-xs font-semibold ${muted}`} htmlFor="business-tax-id">RUC</label>
                    <input id="business-tax-id" value={form.tax_id} onChange={(event) => updateField("tax_id", event.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" maxLength={11} placeholder="11 dígitos" className={`w-full rounded-lg border px-3 py-3 text-sm outline-none focus:border-[#F39A38] ${input}`} />
                  </div>
                  <div>
                    <label className={`mb-1.5 block text-xs font-semibold ${muted}`} htmlFor="business-phone">Teléfono comercial</label>
                    <input id="business-phone" value={form.contact_phone} onChange={(event) => updateField("contact_phone", event.target.value)} maxLength={40} placeholder="Teléfono de contacto" className={`w-full rounded-lg border px-3 py-3 text-sm outline-none focus:border-[#F39A38] ${input}`} />
                  </div>
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${muted}`} htmlFor="business-email">Correo comercial</label>
                  <input id="business-email" type="email" value={form.contact_email} onChange={(event) => updateField("contact_email", event.target.value)} maxLength={180} placeholder="contacto@empresa.com" className={`w-full rounded-lg border px-3 py-3 text-sm outline-none focus:border-[#F39A38] ${input}`} />
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs font-semibold ${muted}`} htmlFor="business-address">Dirección comercial</label>
                  <textarea id="business-address" value={form.address} onChange={(event) => updateField("address", event.target.value)} maxLength={350} rows={3} placeholder="Dirección comercial (opcional)" className={`w-full resize-y rounded-lg border px-3 py-3 text-sm outline-none focus:border-[#F39A38] ${input}`} />
                </div>
                <div className="flex flex-col gap-3 border-t border-[#354153] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`text-[11px] ${muted}`}>Los campos fiscales y de contacto son opcionales hasta que los confirmes.</p>
                  <button type="submit" disabled={saving} className="rounded-lg bg-[#F39A38] px-5 py-3 text-xs font-bold text-[#171717] transition hover:bg-[#E88D2C] disabled:cursor-not-allowed disabled:opacity-60">
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </section>

            <div className="space-y-6">
              <section className={`rounded-2xl border p-5 sm:p-6 ${panel}`}>
                <h3 className={`text-base font-bold ${heading}`}>Preferencias del sistema</h3>
                <p className={`mt-1 text-xs ${muted}`}>Parámetros operativos aplicados al negocio.</p>
                {settings ? (
                  <div className="mt-4">
                    <InfoRow label="Moneda operativa" value={`${settings.currency_code} — Sol peruano`} />
                    <InfoRow label="Zona horaria" value={settings.timezone} />
                    <InfoRow label="Fecha de apertura del SaaS" value={dateTimeLabel(settings.opened_at, settings.timezone)} />
                    <InfoRow label="Corte del registro histórico" value={dateLabel(settings.source_cutoff_date)} />
                  </div>
                ) : (
                  <p className={`mt-4 text-sm ${muted}`}>No se encontró una configuración operativa para este negocio.</p>
                )}
                <div className={`mt-4 rounded-xl p-3 text-xs leading-5 ${darkMode ? "bg-[#101722] text-[#A0ABBC]" : "bg-[#F5F6F8] text-[#737987]"}`}>
                  La moneda, la apertura y el corte histórico se muestran como datos protegidos para evitar alterar los saldos y reportes de inicio.
                </div>
              </section>

              <section className={`rounded-2xl border p-5 sm:p-6 ${panel}`}>
                <h3 className={`text-base font-bold ${heading}`}>Reglas comerciales protegidas</h3>
                <p className={`mt-1 text-xs ${muted}`}>Estas reglas coinciden con las restricciones de la base de datos.</p>
                {settings ? (
                  <div className="mt-4">
                    <InfoRow label="Política de pago" value={settings.delivery_payment_policy === "prepaid_only" ? "Pago completo por adelantado" : settings.delivery_payment_policy} />
                    <InfoRow label="Pago del transporte" value={settings.delivery_cost_paid_by === "customer_directly_to_driver" ? "Cliente paga directamente al conductor" : settings.delivery_cost_paid_by} />
                  </div>
                ) : null}
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs leading-5 text-emerald-500">
                  El sistema mantiene estas reglas como valores fijos. No se pueden cambiar desde esta pantalla.
                </div>
              </section>

              <section className={`rounded-2xl border p-5 sm:p-6 ${panel}`}>
                <h3 className={`text-base font-bold ${heading}`}>Acceso y seguridad</h3>
                <div className="mt-3 space-y-2 text-xs leading-5">
                  <p className={muted}>El acceso a los datos del negocio está limitado por las políticas RLS de Supabase al propietario autenticado.</p>
                  <p className={muted}>La administración de colaboradores y roles no está habilitada todavía. No se muestran controles que aún no existen.</p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
