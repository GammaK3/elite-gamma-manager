"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type CashAccount = {
  id: string;
  name: string;
  account_type: string;
  currency_code: string;
  is_active: boolean;
};

type CashMovement = {
  id: string;
  cash_account_id: string;
  movement_type: string;
  direction: "in" | "out";
  amount: number | string;
  effective_at: string;
  source_date: string | null;
  payment_method: string | null;
  external_reference: string | null;
  notes: string | null;
};

type Expense = {
  id: string;
  recurring_schedule_id: string | null;
  description: string;
  category: string;
  amount: number | string;
  expense_date: string;
  due_date: string | null;
  record_status: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  source_reference: string | null;
  notes: string | null;
  created_at: string;
};

type RecurringSchedule = {
  id: string;
  schedule_code: string;
  description: string;
  category: string;
  amount: number | string;
  currency_code: string;
  frequency_months: number;
  start_date: string;
  next_due_date: string;
  is_active: boolean;
};

type Receivable = {
  id: string;
  reference_label: string | null;
  description: string;
  original_amount: number | string;
  collected_amount: number | string;
  balance: number | string;
  record_status: string;
  source_date: string | null;
  due_date: string | null;
  notes: string | null;
};

type ExpenseForm = {
  description: string;
  category: string;
  amount: string;
  expense_date: string;
  due_date: string;
  notes: string;
};

type RecurringForm = {
  description: string;
  category: string;
  amount: string;
  frequency_months: string;
  start_date: string;
};

const categories = [
  { value: "software_subscriptions", label: "Suscripciones y software" },
  { value: "telecommunications", label: "Telefonía y telecomunicaciones" },
  { value: "marketing", label: "Marketing y publicidad" },
  { value: "supplies", label: "Materiales y suministros" },
  { value: "shipping", label: "Transporte y envíos del negocio" },
  { value: "fees", label: "Comisiones y servicios" },
  { value: "taxes", label: "Impuestos y tributos" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "other", label: "Otros gastos" },
];

const emptyExpense: ExpenseForm = {
  description: "",
  category: "other",
  amount: "",
  expense_date: "",
  due_date: "",
  notes: "",
};

const emptyRecurring: RecurringForm = {
  description: "",
  category: "other",
  amount: "",
  frequency_months: "1",
  start_date: "",
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
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function localDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function categoryLabel(value: string) {
  return categories.find((category) => category.value === value)?.label ?? value;
}

function movementLabel(value: string) {
  const labels: Record<string, string> = {
    opening_balance: "Saldo de apertura",
    sale_receipt: "Cobro de venta",
    expense_payment: "Pago de gasto",
    receivable_collection: "Cobro de cuenta pendiente",
    refund: "Reembolso",
    adjustment: "Ajuste de caja",
    transfer_in: "Transferencia recibida",
    transfer_out: "Transferencia enviada",
  };
  return labels[value] ?? value;
}

function methodLabel(value: string | null) {
  const labels: Record<string, string> = {
    yape: "Yape",
    plin: "Plin",
    bank_transfer: "Transferencia bancaria",
    cash: "Efectivo",
    other: "Otro",
  };
  return value ? (labels[value] ?? value) : "—";
}

export default function FinanzasPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense);
  const [recurringForm, setRecurringForm] = useState<RecurringForm>(emptyRecurring);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashAccountId, setCashAccountId] = useState("");

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
    const today = localDateInputValue();
    setExpenseForm((current) => ({ ...current, expense_date: current.expense_date || today }));
    setRecurringForm((current) => ({ ...current, start_date: current.start_date || today }));
    return () => window.removeEventListener("elite-gamma-theme-change", handleTheme);
  }, []);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
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

      const { error: recurringError } = await supabase.rpc("generate_due_recurring_expenses", {
        p_business_id: business.id,
      });
      if (recurringError) throw new Error(`Obligaciones recurrentes: ${recurringError.message}`);

      const [accountsResult, movementsResult, expensesResult, schedulesResult, receivablesResult] = await Promise.all([
        supabase
          .from("cash_accounts")
          .select("id,name,account_type,currency_code,is_active")
          .eq("business_id", business.id)
          .order("name", { ascending: true }),
        supabase
          .from("cash_movements")
          .select("id,cash_account_id,movement_type,direction,amount,effective_at,source_date,payment_method,external_reference,notes")
          .eq("business_id", business.id)
          .order("effective_at", { ascending: false })
          .limit(500),
        supabase
          .from("expenses")
          .select("id,recurring_schedule_id,description,category,amount,expense_date,due_date,record_status,payment_status,payment_method,paid_at,source_reference,notes,created_at")
          .eq("business_id", business.id)
          .order("expense_date", { ascending: false })
          .limit(500),
        supabase
          .from("recurring_expense_schedules")
          .select("id,schedule_code,description,category,amount,currency_code,frequency_months,start_date,next_due_date,is_active")
          .eq("business_id", business.id)
          .order("is_active", { ascending: false })
          .order("description", { ascending: true }),
        supabase
          .from("accounts_receivable")
          .select("id,reference_label,description,original_amount,collected_amount,balance,record_status,source_date,due_date,notes")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false }),
      ]);

      if (accountsResult.error) throw new Error(`Cuentas de caja: ${accountsResult.error.message}`);
      if (movementsResult.error) throw new Error(`Movimientos de caja: ${movementsResult.error.message}`);
      if (expensesResult.error) throw new Error(`Gastos: ${expensesResult.error.message}`);
      if (schedulesResult.error) throw new Error(`Gastos recurrentes: ${schedulesResult.error.message}`);
      if (receivablesResult.error) throw new Error(`Cuentas por cobrar: ${receivablesResult.error.message}`);

      const loadedAccounts = (accountsResult.data ?? []) as CashAccount[];
      setAccounts(loadedAccounts);
      setMovements((movementsResult.data ?? []) as CashMovement[]);
      setExpenses((expensesResult.data ?? []) as Expense[]);
      setSchedules((schedulesResult.data ?? []) as RecurringSchedule[]);
      setReceivables((receivablesResult.data ?? []) as Receivable[]);
      setCashAccountId((current) => current || loadedAccounts.find((account) => account.is_active)?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Finanzas.");
    } finally {
      if (showSpinner) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);

  const accountBalances = useMemo(() => {
    return accounts.map((account) => {
      const balance = movements
        .filter((movement) => movement.cash_account_id === account.id)
        .reduce((sum, movement) => sum + (movement.direction === "in" ? 1 : -1) * Number(movement.amount ?? 0), 0);
      return { ...account, balance };
    });
  }, [accounts, movements]);

  const totals = useMemo(() => {
    const activeExpenses = expenses.filter((expense) => expense.record_status === "recorded");
    const pendingExpenses = activeExpenses.filter((expense) => expense.payment_status === "pending_confirmation");
    const confirmedExpenses = activeExpenses.filter((expense) => expense.payment_status === "confirmed");
    const unverifiedReceivables = receivables.filter((item) => item.record_status === "pending_confirmation");
    const confirmedReceivables = receivables.filter((item) => ["confirmed", "settled"].includes(item.record_status));
    return {
      cash: accountBalances.filter((account) => account.is_active).reduce((sum, account) => sum + account.balance, 0),
      pendingExpenses: pendingExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
      pendingExpenseCount: pendingExpenses.length,
      confirmedExpenses: confirmedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
      unverifiedReceivables: unverifiedReceivables.reduce((sum, item) => sum + Number(item.balance), 0),
      unverifiedReceivableCount: unverifiedReceivables.length,
      confirmedReceivables: confirmedReceivables.reduce((sum, item) => sum + Number(item.balance), 0),
      activeSchedules: schedules.filter((schedule) => schedule.is_active).length,
    };
  }, [accountBalances, expenses, receivables, schedules]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (expenseFilter === "pending") return expense.record_status === "recorded" && expense.payment_status === "pending_confirmation";
      if (expenseFilter === "paid") return expense.record_status === "recorded" && expense.payment_status === "confirmed";
      if (expenseFilter === "cancelled") return expense.record_status === "cancelled" || expense.payment_status === "cancelled";
      return true;
    });
  }, [expenses, expenseFilter]);

  const pageBg = darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]";
  const card = darkMode ? "border-[#293241] bg-[#171D28]" : "border-[#EAECF0] bg-white";
  const primary = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#858C99]";
  const inputClass = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[#E99A44] ${darkMode ? "border-[#354153] bg-[#101722] text-white placeholder:text-[#697589]" : "border-[#E5E7EB] bg-white text-[#20232B] placeholder:text-[#9CA3AF]"}`;
  const primaryButton = "rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28] transition hover:bg-[#F3AB5C] disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton = `rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${darkMode ? "border-[#354153] bg-[#202938] text-[#DCE2EC] hover:bg-[#273244]" : "border-[#E5E7EB] bg-white text-[#505765] hover:bg-[#F8F9FB]"}`;
  const statusPill = (kind: "pending" | "paid" | "cancelled" | "neutral") => {
    const styles = {
      pending: darkMode ? "bg-amber-500/15 text-amber-300" : "bg-amber-50 text-amber-700",
      paid: darkMode ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700",
      cancelled: darkMode ? "bg-slate-500/15 text-slate-300" : "bg-slate-100 text-slate-600",
      neutral: darkMode ? "bg-sky-500/15 text-sky-300" : "bg-sky-50 text-sky-700",
    };
    return styles[kind];
  };

  function openExpenseModal() {
    setExpenseForm({ ...emptyExpense, expense_date: localDateInputValue() });
    setError("");
    setSuccess("");
    setExpenseModalOpen(true);
  }

  function openRecurringModal() {
    setRecurringForm({ ...emptyRecurring, start_date: localDateInputValue() });
    setError("");
    setSuccess("");
    setRecurringModalOpen(true);
  }

  async function refreshData() {
    setRefreshing(true);
    await loadData(false);
  }

  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    const amount = Number(expenseForm.amount);
    if (!expenseForm.description.trim() || !expenseForm.expense_date || !Number.isFinite(amount) || amount <= 0) {
      setError("Completa la descripcion, fecha e importe del gasto.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("create_expense_record", {
        p_business_id: businessId,
        p_description: expenseForm.description.trim(),
        p_category: expenseForm.category,
        p_amount: amount,
        p_expense_date: expenseForm.expense_date,
        p_due_date: expenseForm.due_date || null,
        p_notes: expenseForm.notes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setExpenseModalOpen(false);
      setSuccess("Gasto registrado como pendiente. No se descontó dinero de caja.");
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el gasto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    const amount = Number(recurringForm.amount);
    const months = Number(recurringForm.frequency_months);
    if (!recurringForm.description.trim() || !recurringForm.start_date || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(months) || months < 1 || months > 12) {
      setError("Completa la descripcion, importe, frecuencia y fecha de inicio.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("create_recurring_expense_schedule", {
        p_business_id: businessId,
        p_schedule_code: "",
        p_description: recurringForm.description.trim(),
        p_category: recurringForm.category,
        p_amount: amount,
        p_frequency_months: months,
        p_start_date: recurringForm.start_date,
      });
      if (rpcError) throw new Error(rpcError.message);
      const { error: generateError } = await supabase.rpc("generate_due_recurring_expenses", {
        p_business_id: businessId,
      });
      if (generateError) throw new Error(generateError.message);
      setRecurringModalOpen(false);
      setSuccess("Obligacion recurrente creada. Sus vencimientos se registran como pendientes, nunca como pagos automaticos.");
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la obligacion recurrente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmExpensePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !payingExpense || !cashAccountId) {
      setError("Selecciona una cuenta de caja activa.");
      return;
    }
    const confirmed = window.confirm(`¿Confirmas que verificaste el pago de ${money(payingExpense.amount)} por “${payingExpense.description}” en tu aplicación bancaria o billetera? Esta acción registrará una salida real de caja.`);
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("confirm_expense_payment", {
        p_business_id: businessId,
        p_expense_id: payingExpense.id,
        p_cash_account_id: cashAccountId,
        p_payment_method: paymentMethod,
      });
      if (rpcError) throw new Error(rpcError.message);
      setPayingExpense(null);
      setSuccess("Pago confirmado y salida registrada en caja.");
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar el pago.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelExpense(expense: Expense) {
    if (!businessId) return;
    const confirmed = window.confirm(`¿Cancelar el gasto pendiente “${expense.description}”? Se conservará en el historial y no afectará caja.`);
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("cancel_expense_record", {
        p_business_id: businessId,
        p_expense_id: expense.id,
        p_reason: "Cancelado desde Finanzas",
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess("Gasto cancelado. El registro se conserva en el historial.");
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el gasto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSchedule(schedule: RecurringSchedule) {
    if (!businessId) return;
    const next = !schedule.is_active;
    const message = next
      ? `¿Reactivar “${schedule.description}”? Los vencimientos pendientes desde la fecha siguiente podrán generarse.`
      : `¿Pausar “${schedule.description}”? No se generarán nuevas obligaciones mientras esté pausada.`;
    if (!window.confirm(message)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("set_recurring_expense_schedule_active", {
        p_business_id: businessId,
        p_schedule_id: schedule.id,
        p_is_active: next,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess(next ? "Obligacion recurrente reactivada." : "Obligacion recurrente pausada.");
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la obligacion.");
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: "overview", label: "Resumen" },
    { id: "expenses", label: "Gastos" },
    { id: "recurring", label: "Recurrentes" },
    { id: "receivables", label: "Cartera / por verificar" },
    { id: "movements", label: "Movimientos de caja" },
  ];

  return (
    <main className={`min-h-full ${pageBg} px-4 py-6 sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-[1450px] space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-[10px] font-bold tracking-[1.8px] ${muted}`}>ELITE GAMMA / CONTROL FINANCIERO</p>
            <h1 className={`mt-2 text-2xl font-bold ${primary}`}>Finanzas</h1>
            <p className={`mt-1 text-sm ${muted}`}>Caja, gastos, obligaciones y cuentas pendientes en soles.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refreshData} disabled={refreshing || loading} className={secondaryButton}>
              {refreshing ? "Actualizando…" : "↻ Actualizar"}
            </button>
            <button type="button" onClick={openExpenseModal} className={primaryButton}>+ Registrar gasto</button>
          </div>
        </header>

        {error && <div className={`rounded-lg border px-4 py-3 text-sm ${darkMode ? "border-red-900 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>{error}</div>}
        {success && <div className={`rounded-lg border px-4 py-3 text-sm ${darkMode ? "border-emerald-900 bg-emerald-950/30 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{success}</div>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <section className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-xs ${muted}`}>Saldo disponible en caja</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${primary}`}>{money(totals.cash)}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>Suma de cuentas activas · movimientos confirmados</p>
          </section>
          <section className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-xs ${muted}`}>Gastos pendientes de pago</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${primary}`}>{money(totals.pendingExpenses)}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>{totals.pendingExpenseCount} obligaciones sin salida de caja</p>
          </section>
          <section className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-xs ${muted}`}>Gastos pagados registrados</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${primary}`}>{money(totals.confirmedExpenses)}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>Pagos confirmados desde este módulo</p>
          </section>
          <section className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-xs ${muted}`}>Importes por verificar</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${primary}`}>{money(totals.unverifiedReceivables)}</p>
            <p className={`mt-1 text-[10px] ${muted}`}>{totals.unverifiedReceivableCount} registros · excluidos de caja y cartera confirmada</p>
          </section>
        </div>

        <div className={`flex gap-1 overflow-x-auto rounded-xl border p-1 ${card}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setError(""); setSuccess(""); }}
              className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${activeTab === tab.id ? "bg-[#E99A44] text-[#171D28]" : darkMode ? "text-[#A0ABBC] hover:bg-[#222B39] hover:text-white" : "text-[#737987] hover:bg-[#F5F6F8] hover:text-[#20232B]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <section className={`rounded-xl border p-10 text-center text-sm ${card} ${muted}`}>Cargando información financiera…</section>
        ) : (
          <>
            {activeTab === "overview" && (
              <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
                <section className={`rounded-xl border p-5 ${card}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div><h2 className={`text-sm font-bold ${primary}`}>Cuentas de caja</h2><p className={`mt-1 text-xs ${muted}`}>Saldo calculado desde el libro de movimientos.</p></div>
                    <span className={`text-[10px] ${muted}`}>{activeAccounts.length} activas</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {accountBalances.length === 0 ? <p className={`py-8 text-center text-xs ${muted}`}>No hay cuentas de caja registradas.</p> : accountBalances.map((account) => (
                      <div key={account.id} className={`flex items-center justify-between gap-3 rounded-lg p-3 ${darkMode ? "bg-[#101722]" : "bg-[#F8F9FB]"}`}>
                        <div><p className={`text-sm font-semibold ${primary}`}>{account.name}</p><p className={`mt-1 text-[10px] ${muted}`}>{account.account_type === "cash" ? "Efectivo" : account.account_type === "mobile_wallet" ? "Billetera móvil" : "Banco"} · {account.is_active ? "Activa" : "Inactiva"}</p></div>
                        <p className={`text-base font-bold tabular-nums ${primary}`}>{money(account.balance)}</p>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-5 border-t pt-4 ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}>
                    <p className={`text-xs ${muted}`}>Obligaciones recurrentes activas</p>
                    <p className={`mt-1 text-lg font-bold ${primary}`}>{totals.activeSchedules}</p>
                    <button type="button" onClick={() => setActiveTab("recurring")} className="mt-2 text-xs font-semibold text-[#E99A44]">Administrar recurrencias →</button>
                  </div>
                </section>

                <section className={`rounded-xl border p-5 ${card}`}>
                  <div className="flex items-center justify-between gap-3"><div><h2 className={`text-sm font-bold ${primary}`}>Últimos movimientos</h2><p className={`mt-1 text-xs ${muted}`}>Solo entradas y salidas efectivamente confirmadas.</p></div><button type="button" onClick={() => setActiveTab("movements")} className="text-xs font-semibold text-[#E99A44]">Ver todos →</button></div>
                  <div className="mt-4 divide-y divide-[#293241]/70">
                    {movements.slice(0, 6).length === 0 ? <p className={`py-8 text-center text-xs ${muted}`}>Todavía no hay movimientos de caja.</p> : movements.slice(0, 6).map((movement) => {
                      const account = accounts.find((item) => item.id === movement.cash_account_id);
                      return <div key={movement.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0"><p className={`truncate text-xs font-semibold ${primary}`}>{movementLabel(movement.movement_type)}</p><p className={`mt-1 truncate text-[10px] ${muted}`}>{account?.name ?? "Cuenta"} · {dateTimeLabel(movement.effective_at)}</p></div>
                        <p className={`shrink-0 text-sm font-bold tabular-nums ${movement.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>{movement.direction === "in" ? "+" : "−"}{money(movement.amount)}</p>
                      </div>;
                    })}
                  </div>
                </section>

                <section className={`rounded-xl border p-5 xl:col-span-2 ${card}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className={`text-sm font-bold ${primary}`}>Pendientes de atención</h2><p className={`mt-1 text-xs ${muted}`}>Estos importes no reducen ni aumentan la caja hasta su confirmación.</p></div><button type="button" onClick={() => setActiveTab("expenses")} className="text-xs font-semibold text-[#E99A44]">Ir a gastos →</button></div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {expenses.filter((expense) => expense.record_status === "recorded" && expense.payment_status === "pending_confirmation").slice(0, 4).map((expense) => <div key={expense.id} className={`flex items-center justify-between gap-3 rounded-lg p-3 ${darkMode ? "bg-[#101722]" : "bg-[#F8F9FB]"}`}><div className="min-w-0"><p className={`truncate text-xs font-semibold ${primary}`}>{expense.description}</p><p className={`mt-1 text-[10px] ${muted}`}>Vence: {dateLabel(expense.due_date || expense.expense_date)}</p></div><p className={`shrink-0 text-sm font-bold ${primary}`}>{money(expense.amount)}</p></div>)}
                    {expenses.filter((expense) => expense.record_status === "recorded" && expense.payment_status === "pending_confirmation").length === 0 && <p className={`py-5 text-xs ${muted}`}>No hay gastos pendientes de pago.</p>}
                    {receivables.filter((item) => item.record_status === "pending_confirmation").map((item) => <div key={item.id} className={`rounded-lg border border-dashed p-3 ${darkMode ? "border-amber-700/50 bg-amber-950/10" : "border-amber-200 bg-amber-50/50"}`}><p className="text-xs font-semibold">{item.record_status === "pending_confirmation" ? "Importe por verificar" : (item.reference_label || "Cuenta por cobrar")}</p><p className={`mt-1 text-[10px] ${muted}`}>{item.description}</p><p className="mt-2 text-sm font-bold">{money(item.balance)}</p></div>)}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "expenses" && (
              <section className={`overflow-hidden rounded-xl border ${card}`}>
                <div className="flex flex-col gap-3 border-b border-[#293241]/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className={`text-sm font-bold ${primary}`}>Registro de gastos</h2><p className={`mt-1 text-xs ${muted}`}>{filteredExpenses.length} registros mostrados · moneda PEN</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={expenseFilter} onChange={(event) => setExpenseFilter(event.target.value)} className={inputClass + " sm:w-48"}>
                      <option value="all">Todos los estados</option><option value="pending">Pendientes de pago</option><option value="paid">Pagados</option><option value="cancelled">Cancelados</option>
                    </select>
                    <button type="button" onClick={openExpenseModal} className={primaryButton}>+ Nuevo gasto</button>
                  </div>
                </div>
                {filteredExpenses.length === 0 ? <div className={`p-12 text-center text-sm ${muted}`}>No hay gastos para este filtro.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className={darkMode ? "bg-[#101722] text-[#A0ABBC]" : "bg-[#F8F9FB] text-[#737987]"}><tr><th className="px-4 py-3">GASTO</th><th className="px-4 py-3">CATEGORÍA</th><th className="px-4 py-3">FECHA</th><th className="px-4 py-3">IMPORTE</th><th className="px-4 py-3">ESTADO</th><th className="px-4 py-3 text-right">ACCIONES</th></tr></thead><tbody>{filteredExpenses.map((expense) => {
                  const isPending = expense.record_status === "recorded" && expense.payment_status === "pending_confirmation";
                  const isPaid = expense.record_status === "recorded" && expense.payment_status === "confirmed";
                  return <tr key={expense.id} className={`border-t ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}><td className="px-4 py-3"><p className={`font-semibold ${primary}`}>{expense.description}</p><p className={`mt-1 text-[10px] ${muted}`}>{expense.recurring_schedule_id ? "Obligación recurrente" : expense.source_reference ? "Registro importado" : "Gasto manual"}</p></td><td className={`px-4 py-3 ${muted}`}>{categoryLabel(expense.category)}</td><td className={`px-4 py-3 ${muted}`}>{dateLabel(expense.expense_date)}{expense.due_date ? <span className="block mt-1">Vence {dateLabel(expense.due_date)}</span> : null}</td><td className={`px-4 py-3 font-bold tabular-nums ${primary}`}>{money(expense.amount)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isPending ? statusPill("pending") : isPaid ? statusPill("paid") : statusPill("cancelled")}`}>{isPending ? "Pendiente" : isPaid ? "Pagado" : "Cancelado"}</span>{expense.payment_method && <p className={`mt-1 text-[10px] ${muted}`}>{methodLabel(expense.payment_method)}</p>}</td><td className="px-4 py-3 text-right">{isPending ? <div className="flex justify-end gap-2"><button type="button" onClick={() => { setPayingExpense(expense); setError(""); setPaymentMethod("cash"); }} disabled={!activeAccounts.length || saving} className={primaryButton}>Confirmar pago</button><button type="button" onClick={() => void handleCancelExpense(expense)} disabled={saving} className={secondaryButton}>Cancelar</button></div> : <span className={muted}>—</span>}</td></tr>;
                })}</tbody></table></div>}
                <div className={`border-t p-3 text-[10px] ${darkMode ? "border-[#293241] text-[#A0ABBC]" : "border-[#EAECF0] text-[#858C99]"}`}>Registrar un gasto no significa pagarlo. Solo «Confirmar pago» crea una salida de caja, y debe usarse después de verificar el movimiento en Yape, Plin, banco o efectivo.</div>
              </section>
            )}

            {activeTab === "recurring" && (
              <section className={`overflow-hidden rounded-xl border ${card}`}>
                <div className="flex flex-col gap-3 border-b border-[#293241]/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className={`text-sm font-bold ${primary}`}>Obligaciones recurrentes</h2><p className={`mt-1 text-xs ${muted}`}>{schedules.length} programaciones · {totals.activeSchedules} activas</p></div><button type="button" onClick={openRecurringModal} className={primaryButton}>+ Nueva recurrencia</button></div>
                {schedules.length === 0 ? <div className={`p-12 text-center text-sm ${muted}`}>No hay obligaciones recurrentes programadas.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className={darkMode ? "bg-[#101722] text-[#A0ABBC]" : "bg-[#F8F9FB] text-[#737987]"}><tr><th className="px-4 py-3">OBLIGACIÓN</th><th className="px-4 py-3">IMPORTE</th><th className="px-4 py-3">FRECUENCIA</th><th className="px-4 py-3">PRÓXIMO VENCIMIENTO</th><th className="px-4 py-3">ESTADO</th><th className="px-4 py-3 text-right">ACCIÓN</th></tr></thead><tbody>{schedules.map((schedule) => <tr key={schedule.id} className={`border-t ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}><td className="px-4 py-3"><p className={`font-semibold ${primary}`}>{schedule.description}</p><p className={`mt-1 text-[10px] ${muted}`}>{categoryLabel(schedule.category)}</p></td><td className={`px-4 py-3 font-bold ${primary}`}>{money(schedule.amount)}</td><td className={`px-4 py-3 ${muted}`}>{schedule.frequency_months === 1 ? "Mensual" : `Cada ${schedule.frequency_months} meses`}</td><td className={`px-4 py-3 ${muted}`}>{dateLabel(schedule.next_due_date)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${schedule.is_active ? statusPill("paid") : statusPill("cancelled")}`}>{schedule.is_active ? "Activa" : "Pausada"}</span></td><td className="px-4 py-3 text-right"><button type="button" disabled={saving} onClick={() => void handleToggleSchedule(schedule)} className={secondaryButton}>{schedule.is_active ? "Pausar" : "Reactivar"}</button></td></tr>)}</tbody></table></div>}
                <div className={`border-t p-3 text-[10px] ${darkMode ? "border-[#293241] text-[#A0ABBC]" : "border-[#EAECF0] text-[#858C99]"}`}>El sistema genera cada vencimiento como gasto pendiente. Nunca realiza un pago automático ni crea una salida de caja.</div>
              </section>
            )}

            {activeTab === "receivables" && (
              <section className={`overflow-hidden rounded-xl border ${card}`}>
                <div className="border-b border-[#293241]/70 p-4"><h2 className={`text-sm font-bold ${primary}`}>Cartera y registros por verificar</h2><p className={`mt-1 text-xs ${muted}`}>Los importes sin origen confirmado se conservan separados de las cuentas confirmadas y del efectivo.</p></div>
                {receivables.length === 0 ? <div className={`p-12 text-center text-sm ${muted}`}>No hay registros de cuentas por cobrar.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className={darkMode ? "bg-[#101722] text-[#A0ABBC]" : "bg-[#F8F9FB] text-[#737987]"}><tr><th className="px-4 py-3">REFERENCIA</th><th className="px-4 py-3">ORIGEN</th><th className="px-4 py-3">FECHA</th><th className="px-4 py-3">IMPORTE</th><th className="px-4 py-3">COBRADO</th><th className="px-4 py-3">SALDO</th><th className="px-4 py-3">ESTADO</th></tr></thead><tbody>{receivables.map((item) => {
                  const pending = item.record_status === "pending_confirmation";
                  const settled = item.record_status === "settled";
                  return <tr key={item.id} className={`border-t ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}><td className={`px-4 py-3 font-semibold ${primary}`}>{pending ? "Importe por verificar" : (item.reference_label || "Sin referencia")}</td><td className={`max-w-sm px-4 py-3 ${muted}`}>{item.description}</td><td className={`px-4 py-3 ${muted}`}>{dateLabel(item.source_date)}</td><td className={`px-4 py-3 ${primary}`}>{money(item.original_amount)}</td><td className={`px-4 py-3 ${primary}`}>{money(item.collected_amount)}</td><td className={`px-4 py-3 font-bold ${primary}`}>{money(item.balance)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${pending ? statusPill("pending") : settled ? statusPill("paid") : statusPill("neutral")}`}>{pending ? "Por verificar" : settled ? "Cobrada" : item.record_status === "confirmed" ? "Confirmada" : item.record_status === "cancelled" ? "Cancelada" : item.record_status}</span></td></tr>;
                })}</tbody></table></div>}
                <div className={`border-t p-3 text-[10px] ${darkMode ? "border-[#293241] text-[#A0ABBC]" : "border-[#EAECF0] text-[#858C99]"}`}>El importe histórico de S/100 permanece «Por verificar». No se clasifica como pagaré, venta ni cuenta por cobrar confirmada; tampoco está vinculado a un cliente o venta. Se excluye de caja y de la cartera confirmada hasta validar su origen.</div>
              </section>
            )}

            {activeTab === "movements" && (
              <section className={`overflow-hidden rounded-xl border ${card}`}>
                <div className="border-b border-[#293241]/70 p-4"><h2 className={`text-sm font-bold ${primary}`}>Libro de caja</h2><p className={`mt-1 text-xs ${muted}`}>Historial de movimientos confirmados de todas las cuentas.</p></div>
                {movements.length === 0 ? <div className={`p-12 text-center text-sm ${muted}`}>No hay movimientos de caja.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className={darkMode ? "bg-[#101722] text-[#A0ABBC]" : "bg-[#F8F9FB] text-[#737987]"}><tr><th className="px-4 py-3">FECHA Y CONCEPTO</th><th className="px-4 py-3">CUENTA</th><th className="px-4 py-3">MÉTODO</th><th className="px-4 py-3">REFERENCIA</th><th className="px-4 py-3 text-right">IMPORTE</th></tr></thead><tbody>{movements.map((movement) => { const account = accounts.find((item) => item.id === movement.cash_account_id); return <tr key={movement.id} className={`border-t ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}><td className="px-4 py-3"><p className={`font-semibold ${primary}`}>{movementLabel(movement.movement_type)}</p><p className={`mt-1 text-[10px] ${muted}`}>{dateTimeLabel(movement.effective_at)}</p><p className={`mt-1 max-w-md truncate text-[10px] ${muted}`}>{movement.notes || ""}</p></td><td className={`px-4 py-3 ${muted}`}>{account?.name ?? "Cuenta"}</td><td className={`px-4 py-3 ${muted}`}>{methodLabel(movement.payment_method)}</td><td className={`px-4 py-3 ${muted}`}>{movement.source_date ? dateLabel(movement.source_date) : movement.external_reference || "—"}</td><td className={`px-4 py-3 text-right font-bold tabular-nums ${movement.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>{movement.direction === "in" ? "+" : "−"}{money(movement.amount)}</td></tr>; })}</tbody></table></div>}
              </section>
            )}
          </>
        )}
      </div>

      {expenseModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpenseModalOpen(false); }}>
          <form onSubmit={handleCreateExpense} className={`my-6 w-full max-w-2xl rounded-2xl border p-5 shadow-2xl sm:p-6 ${card}`}>
            <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className={`text-lg font-bold ${primary}`}>Registrar gasto</h2><p className={`mt-1 text-xs ${muted}`}>El gasto quedará pendiente hasta que confirmes su pago.</p></div><button type="button" onClick={() => setExpenseModalOpen(false)} className={secondaryButton}>Cerrar</button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={`mb-1 block text-xs font-semibold ${muted}`}>Descripción *</span><input required value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} placeholder="Ej. Suscripción de software" /></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Categoría *</span><select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} className={inputClass}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Importe (PEN) *</span><input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} className={inputClass} placeholder="0.00" /></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Fecha del gasto *</span><input required type="date" value={expenseForm.expense_date} onChange={(event) => setExpenseForm((current) => ({ ...current, expense_date: event.target.value }))} className={inputClass} /></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Fecha de vencimiento</span><input type="date" value={expenseForm.due_date} min={expenseForm.expense_date || undefined} onChange={(event) => setExpenseForm((current) => ({ ...current, due_date: event.target.value }))} className={inputClass} /></label>
              <label className="sm:col-span-2"><span className={`mb-1 block text-xs font-semibold ${muted}`}>Notas internas</span><textarea rows={3} value={expenseForm.notes} onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))} className={inputClass} placeholder="Referencia, periodo o comentario…" /></label>
            </div>
            <div className={`mt-4 rounded-lg p-3 text-[11px] leading-5 ${darkMode ? "bg-[#101722] text-[#A0ABBC]" : "bg-[#F8F9FB] text-[#737987]"}`}>Registrar el gasto no modifica el saldo de caja. La salida se crea únicamente al confirmar un pago que ya verificaste.</div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setExpenseModalOpen(false)} className={secondaryButton}>Cancelar</button><button type="submit" disabled={saving} className={primaryButton}>{saving ? "Guardando…" : "Guardar gasto pendiente"}</button></div>
          </form>
        </div>
      )}

      {recurringModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setRecurringModalOpen(false); }}>
          <form onSubmit={handleCreateRecurring} className={`my-6 w-full max-w-xl rounded-2xl border p-5 shadow-2xl sm:p-6 ${card}`}>
            <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className={`text-lg font-bold ${primary}`}>Nueva obligación recurrente</h2><p className={`mt-1 text-xs ${muted}`}>Genera gastos pendientes con frecuencia fija; nunca realiza pagos automáticos.</p></div><button type="button" onClick={() => setRecurringModalOpen(false)} className={secondaryButton}>Cerrar</button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={`mb-1 block text-xs font-semibold ${muted}`}>Descripción *</span><input required value={recurringForm.description} onChange={(event) => setRecurringForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} placeholder="Ej. Servicio de internet" /></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Categoría *</span><select value={recurringForm.category} onChange={(event) => setRecurringForm((current) => ({ ...current, category: event.target.value }))} className={inputClass}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Importe (PEN) *</span><input required type="number" min="0.01" step="0.01" value={recurringForm.amount} onChange={(event) => setRecurringForm((current) => ({ ...current, amount: event.target.value }))} className={inputClass} placeholder="0.00" /></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Frecuencia</span><select value={recurringForm.frequency_months} onChange={(event) => setRecurringForm((current) => ({ ...current, frequency_months: event.target.value }))} className={inputClass}><option value="1">Cada mes</option><option value="2">Cada 2 meses</option><option value="3">Cada 3 meses</option><option value="6">Cada 6 meses</option><option value="12">Cada 12 meses</option></select></label>
              <label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Primera fecha de vencimiento *</span><input required type="date" value={recurringForm.start_date} onChange={(event) => setRecurringForm((current) => ({ ...current, start_date: event.target.value }))} className={inputClass} /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRecurringModalOpen(false)} className={secondaryButton}>Cancelar</button><button type="submit" disabled={saving} className={primaryButton}>{saving ? "Guardando…" : "Crear recurrencia"}</button></div>
          </form>
        </div>
      )}

      {payingExpense && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4">
          <form onSubmit={handleConfirmExpensePayment} className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${card}`}>
            <div className="mb-4"><h2 className={`text-lg font-bold ${primary}`}>Confirmar pago</h2><p className={`mt-1 text-xs ${muted}`}>Estás por registrar una salida real de caja.</p></div>
            <div className={`rounded-lg p-3 ${darkMode ? "bg-[#101722]" : "bg-[#F8F9FB]"}`}><p className={`text-xs font-semibold ${primary}`}>{payingExpense.description}</p><p className={`mt-1 text-xl font-bold ${primary}`}>{money(payingExpense.amount)}</p></div>
            <label className="mt-4 block"><span className={`mb-1 block text-xs font-semibold ${muted}`}>Cuenta de salida *</span><select required value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)} className={inputClass}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · PEN</option>)}</select></label>
            <label className="mt-4 block"><span className={`mb-1 block text-xs font-semibold ${muted}`}>Medio de pago *</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={inputClass}><option value="cash">Efectivo</option><option value="yape">Yape</option><option value="plin">Plin</option><option value="bank_transfer">Transferencia bancaria</option><option value="other">Otro</option></select></label>
            <p className={`mt-4 text-[11px] leading-5 ${muted}`}>Solo continúa después de comprobar el cargo en tu propia aplicación o registro de efectivo.</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPayingExpense(null)} className={secondaryButton}>Volver</button><button type="submit" disabled={saving || !activeAccounts.length} className={primaryButton}>{saving ? "Confirmando…" : "Confirmar pago verificado"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
