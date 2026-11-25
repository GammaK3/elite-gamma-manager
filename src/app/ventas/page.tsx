"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  district: string | null;
  notes: string | null;
};

type Product = {
  id: string;
  sku: string | null;
  name: string;
  model_name: string | null;
  color: string | null;
  cost_price: number;
  sale_price: number;
  offer_price: number | null;
  min_sale_price: number | null;
  stock_quantity: number;
};

type Sale = {
  id: string;
  customer_id: string | null;
  sale_number: string | null;
  sale_date: string;
  channel: string;
  status: string;
  payment_status: string;
  product_subtotal: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  payment_confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | string;
  unit_cost_snapshot: number | string;
  discount_amount: number | string;
  product_name_snapshot: string | null;
  sku_snapshot: string | null;
  cost_status_snapshot: string | null;
  min_sale_price_snapshot: number | string | null;
  created_at: string;
};

type Payment = {
  id: string;
  sale_id: string;
  amount: number | string;
  payment_method: string;
  payment_status: string;
  reference: string | null;
  received_at: string | null;
  created_at: string;
  cash_account_id: string | null;
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

type CashAccount = {
  id: string;
  name: string;
  account_type: string;
  currency_code: string;
  is_active: boolean;
};

type SaleFilter = "active" | "all" | "draft" | "pending_payment" | "paid" | "preparing" | "shipped" | "delivered" | "cancelled";

type CustomerForm = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  notes: string;
};

type DeliveryForm = {
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  address_reference: string;
  delivery_cost: string;
  notes: string;
};

const emptyCustomerForm: CustomerForm = {
  full_name: "", phone: "", email: "", address: "", district: "", notes: "",
};

const emptyDeliveryForm: DeliveryForm = {
  recipient_name: "", recipient_phone: "", delivery_address: "",
  address_reference: "", delivery_cost: "", notes: "",
};

const saleFilters: { value: SaleFilter; label: string }[] = [
  { value: "active", label: "Activas" },
  { value: "all", label: "Todas" },
  { value: "draft", label: "Borradores" },
  { value: "pending_payment", label: "Por cobrar" },
  { value: "paid", label: "Pagadas" },
  { value: "preparing", label: "Preparación" },
  { value: "shipped", label: "En reparto" },
  { value: "delivered", label: "Entregadas" },
  { value: "cancelled", label: "Canceladas" },
];

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-PE", {
    style: "currency", currency: "PEN", minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador", pending_payment: "Pendiente de pago", paid: "Pagada",
    preparing: "En preparación", shipped: "En reparto", delivered: "Entregada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendiente", confirmed: "Confirmado", rejected: "Rechazado", refunded: "Reembolsado",
  };
  return labels[status] ?? status;
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    yape: "Yape", plin: "Plin", bank_transfer: "Transferencia bancaria",
  };
  return labels[method] ?? method;
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    facebook_marketplace: "Facebook Marketplace", whatsapp: "WhatsApp",
    instagram: "Instagram", other: "Otro canal",
  };
  return labels[channel] ?? channel;
}

function statusClasses(status: string, darkMode: boolean) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold";
  if (status === "delivered" || status === "paid") {
    return `${base} ${darkMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`;
  }
  if (status === "pending_payment" || status === "draft") {
    return `${base} ${darkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-700"}`;
  }
  if (status === "cancelled" || status === "failed") {
    return `${base} ${darkMode ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-rose-200 bg-rose-50 text-rose-700"}`;
  }
  return `${base} ${darkMode ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-sky-200 bg-sky-50 text-sky-700"}`;
}

export default function VentasPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("ELITE GAMMA");
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [filter, setFilter] = useState<SaleFilter>("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createSaleOpen, setCreateSaleOpen] = useState(false);
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleChannel, setSaleChannel] = useState("facebook_marketplace");
  const [saleNotes, setSaleNotes] = useState("");

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomerForm);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discountValue, setDiscountValue] = useState("0");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("yape");
  const [paymentReference, setPaymentReference] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");

  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(emptyDeliveryForm);
  const [driverReference, setDriverReference] = useState("");
  const [deliveryEditing, setDeliveryEditing] = useState(false);

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
        .from("businesses")
        .select("id,name")
        .limit(1)
        .maybeSingle();
      if (businessError) throw new Error(`Negocio: ${businessError.message}`);
      if (!business) throw new Error("No encontramos ELITE GAMMA asociado a tu usuario.");
      setBusinessId(business.id);
      setBusinessName(business.name ?? "ELITE GAMMA");

      const [salesResult, customersResult, productsResult, stockResult, cashResult] = await Promise.all([
        supabase
          .from("sales")
          .select("id,customer_id,sale_number,sale_date,channel,status,payment_status,product_subtotal,discount_amount,total_amount,payment_confirmed_at,notes,created_at,updated_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("customers")
          .select("id,full_name,phone,email,address,district,notes")
          .eq("business_id", business.id)
          .order("full_name", { ascending: true }),
        supabase
          .from("products")
          .select("id,sku,name,model_name,color,cost_price,sale_price,offer_price,min_sale_price")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("product_stock")
          .select("product_id,stock_quantity")
          .eq("business_id", business.id),
        supabase
          .from("cash_accounts")
          .select("id,name,account_type,currency_code,is_active")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (salesResult.error) throw new Error(`Ventas: ${salesResult.error.message}`);
      if (customersResult.error) throw new Error(`Clientes: ${customersResult.error.message}`);
      if (productsResult.error) throw new Error(`Productos: ${productsResult.error.message}`);
      if (stockResult.error) throw new Error(`Stock: ${stockResult.error.message}`);
      if (cashResult.error) throw new Error(`Cuentas de caja: ${cashResult.error.message}`);

      const stockMap = new Map((stockResult.data ?? []).map((row) => [row.product_id, Number(row.stock_quantity)]));
      const loadedProducts: Product[] = (productsResult.data ?? []).map((row) => ({
        ...row,
        cost_price: numeric(row.cost_price),
        sale_price: numeric(row.sale_price),
        offer_price: row.offer_price === null ? null : numeric(row.offer_price),
        min_sale_price: row.min_sale_price === null ? null : numeric(row.min_sale_price),
        stock_quantity: stockMap.get(row.id) ?? 0,
      }));

      setSales((salesResult.data ?? []) as Sale[]);
      setCustomers((customersResult.data ?? []) as Customer[]);
      setProducts(loadedProducts);
      setCashAccounts((cashResult.data ?? []) as CashAccount[]);
      setCashAccountId((current) => current || cashResult.data?.[0]?.id || "");
      setSelectedSaleId((current) => current || salesResult.data?.[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las ventas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadSaleDetails = useCallback(async (saleId: string) => {
    if (!businessId || !saleId) {
      setSaleItems([]);
      setPayments([]);
      setDelivery(null);
      return;
    }
    setDetailLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const [itemsResult, paymentsResult, deliveryResult] = await Promise.all([
        supabase
          .from("sale_items")
          .select("id,sale_id,product_id,quantity,unit_price,unit_cost_snapshot,discount_amount,product_name_snapshot,sku_snapshot,cost_status_snapshot,min_sale_price_snapshot,created_at")
          .eq("business_id", businessId)
          .eq("sale_id", saleId)
          .order("created_at", { ascending: true }),
        supabase
          .from("payments")
          .select("id,sale_id,amount,payment_method,payment_status,reference,received_at,created_at,cash_account_id")
          .eq("business_id", businessId)
          .eq("sale_id", saleId)
          .order("created_at", { ascending: true }),
        supabase
          .from("deliveries")
          .select("id,sale_id,provider,recipient_name,recipient_phone,delivery_address,address_reference,delivery_cost,delivery_paid_by,delivery_status,driver_reference,confirmation_code_received_at,delivered_at,notes")
          .eq("business_id", businessId)
          .eq("sale_id", saleId)
          .maybeSingle(),
      ]);
      if (itemsResult.error) throw new Error(`Detalle de productos: ${itemsResult.error.message}`);
      if (paymentsResult.error) throw new Error(`Pagos: ${paymentsResult.error.message}`);
      if (deliveryResult.error) throw new Error(`Entrega: ${deliveryResult.error.message}`);
      setSaleItems((itemsResult.data ?? []) as SaleItem[]);
      setPayments((paymentsResult.data ?? []) as Payment[]);
      const nextDelivery = (deliveryResult.data ?? null) as Delivery | null;
      setDelivery(nextDelivery);
      setDriverReference(nextDelivery?.driver_reference ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el detalle de la venta.");
    } finally {
      setDetailLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId && selectedSaleId) void loadSaleDetails(selectedSaleId);
    else {
      setSaleItems([]);
      setPayments([]);
      setDelivery(null);
    }
  }, [businessId, selectedSaleId, loadSaleDetails]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId]
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedSale?.customer_id) ?? null,
    [customers, selectedSale]
  );
  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (filter === "active" && sale.status === "cancelled") return false;
      if (filter !== "all" && filter !== "active" && sale.status !== filter) return false;
      if (!term) return true;
      const customer = customers.find((item) => item.id === sale.customer_id);
      return [sale.sale_number ?? "", customer?.full_name ?? "", customer?.phone ?? "", channelLabel(sale.channel)]
        .join(" ").toLowerCase().includes(term);
    });
  }, [sales, customers, filter, search]);

  useEffect(() => {
    if (filteredSales.length === 0) {
      if (selectedSaleId) setSelectedSaleId("");
      return;
    }
    if (!filteredSales.some((sale) => sale.id === selectedSaleId)) {
      setSelectedSaleId(filteredSales[0].id);
    }
  }, [filteredSales, selectedSaleId]);

  const stats = useMemo(() => {
    const active = sales.filter((sale) => sale.status !== "cancelled");
    return {
      total: active.length,
      pending: sales.filter((sale) => sale.status === "pending_payment").length,
      preparing: sales.filter((sale) => sale.status === "preparing").length,
      delivery: sales.filter((sale) => sale.status === "shipped").length,
      revenue: active
        .filter((sale) => sale.payment_status === "confirmed")
        .reduce((sum, sale) => sum + numeric(sale.total_amount), 0),
    };
  }, [sales]);

  const confirmedPayments = payments.filter((payment) => payment.payment_status === "confirmed");
  const pendingPayments = payments.filter((payment) => payment.payment_status === "pending");
  const confirmedTotal = confirmedPayments.reduce((sum, payment) => sum + numeric(payment.amount), 0);
  const pendingTotal = pendingPayments.reduce((sum, payment) => sum + numeric(payment.amount), 0);
  const totalCommitted = confirmedTotal + pendingTotal;
  const remainingToRegister = Math.max(0, numeric(selectedSale?.total_amount) - totalCommitted);
  const remainingToConfirm = Math.max(0, numeric(selectedSale?.total_amount) - confirmedTotal);

  useEffect(() => {
    if (!selectedSale) {
      setPaymentAmount("");
      setDiscountValue("0");
      return;
    }
    setDiscountValue(numeric(selectedSale.discount_amount).toFixed(2));
    setPaymentAmount(remainingToRegister > 0 ? remainingToRegister.toFixed(2) : "");
  }, [selectedSaleId, selectedSale?.discount_amount, selectedSale?.total_amount, remainingToRegister]);

  useEffect(() => {
    if (!selectedSale) {
      setDeliveryForm(emptyDeliveryForm);
      setDeliveryEditing(false);
      return;
    }
    if (delivery) {
      setDeliveryForm({
        recipient_name: delivery.recipient_name ?? "",
        recipient_phone: delivery.recipient_phone ?? "",
        delivery_address: delivery.delivery_address ?? "",
        address_reference: delivery.address_reference ?? "",
        delivery_cost: numeric(delivery.delivery_cost).toFixed(2),
        notes: delivery.notes ?? "",
      });
      setDeliveryEditing(false);
    } else {
      setDeliveryForm({
        recipient_name: selectedCustomer?.full_name ?? "",
        recipient_phone: selectedCustomer?.phone ?? "",
        delivery_address: selectedCustomer?.address ?? "",
        address_reference: selectedCustomer?.district ?? "",
        delivery_cost: "",
        notes: "",
      });
    }
  }, [selectedSaleId, delivery, selectedCustomer, selectedSale]);

  const pageBg = darkMode ? "bg-[#0D1118] text-[#E7EAF0]" : "bg-[#F6F7F9] text-[#20232B]";
  const surface = darkMode ? "border-[#293241] bg-[#171D28]" : "border-[#EAECF0] bg-white";
  const muted = darkMode ? "text-[#A0ABBC]" : "text-[#858C99]";
  const title = darkMode ? "text-[#E7EAF0]" : "text-[#20232B]";
  const field = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-[#E99A44] ${darkMode ? "border-[#354153] bg-[#101722] text-white placeholder:text-[#697589]" : "border-[#E5E7EB] bg-white text-[#20232B] placeholder:text-[#9CA3AF]"}`;
  const subtleButton = `rounded-lg border px-3 py-2 text-xs font-semibold transition ${darkMode ? "border-[#354153] bg-[#202938] text-[#DCE2EC] hover:bg-[#273244]" : "border-[#E5E7EB] bg-white text-[#505765] hover:bg-[#F8F9FB]"}`;
  const primaryButton = "rounded-lg bg-[#E99A44] px-4 py-2.5 text-xs font-bold text-[#171D28] transition hover:bg-[#F3AB5C] disabled:cursor-not-allowed disabled:opacity-50";

  async function handleCreateSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_sale_draft", {
        p_business_id: businessId,
        p_customer_id: saleCustomerId || null,
        p_channel: saleChannel,
        p_notes: saleNotes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      const newSaleId = String(data);
      setCreateSaleOpen(false);
      setSaleCustomerId(""); setSaleChannel("facebook_marketplace"); setSaleNotes("");
      await loadData();
      setSelectedSaleId(newSaleId);
      setFilter("all");
      setSuccess("Borrador de venta creado. Ahora agrega los productos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el borrador.");
    } finally { setSaving(false); }
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    if (!customerForm.full_name.trim()) { setError("El nombre del cliente es obligatorio."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("customers")
        .insert({
          business_id: businessId,
          full_name: customerForm.full_name.trim(),
          phone: customerForm.phone.trim() || null,
          email: customerForm.email.trim() || null,
          address: customerForm.address.trim() || null,
          district: customerForm.district.trim() || null,
          notes: customerForm.notes.trim() || null,
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      setCustomerModalOpen(false);
      setCustomerForm(emptyCustomerForm);
      await loadData();
      if (data?.id) setSaleCustomerId(data.id);
      setSuccess("Cliente registrado correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el cliente.");
    } finally { setSaving(false); }
  }

  function chooseProduct(nextId: string) {
    setProductId(nextId);
    const product = products.find((item) => item.id === nextId);
    if (!product) { setUnitPrice(""); return; }
    const suggested = product.offer_price !== null && product.offer_price > 0
      ? product.offer_price : product.sale_price;
    setUnitPrice(suggested.toFixed(2));
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !selectedSale || !productId) return;
    const parsedQuantity = Number(quantity);
    const parsedPrice = Number(unitPrice);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) { setError("La cantidad debe ser un número entero mayor que cero."); return; }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) { setError("Ingresa un precio unitario válido."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("add_sale_item", {
        p_business_id: businessId,
        p_sale_id: selectedSale.id,
        p_product_id: productId,
        p_quantity: parsedQuantity,
        p_unit_price: parsedPrice,
      });
      if (rpcError) throw new Error(rpcError.message);
      setProductId(""); setQuantity("1"); setUnitPrice("");
      await loadSaleDetails(selectedSale.id);
      await loadData();
      setSuccess("Producto agregado a la venta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el producto.");
    } finally { setSaving(false); }
  }

  async function handleRemoveItem(item: SaleItem) {
    if (!businessId || !selectedSale) return;
    if (!window.confirm(`¿Quitar ${item.product_name_snapshot ?? "este producto"} de la venta?`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("remove_sale_item", {
        p_business_id: businessId,
        p_sale_item_id: item.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadSaleDetails(selectedSale.id);
      await loadData();
      setSuccess("Producto retirado del borrador.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el producto.");
    } finally { setSaving(false); }
  }

  async function handleDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !selectedSale) return;
    const amount = Number(discountValue);
    if (!Number.isFinite(amount) || amount < 0) { setError("El descuento no es válido."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("set_sale_discount", {
        p_business_id: businessId,
        p_sale_id: selectedSale.id,
        p_discount_amount: amount,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadSaleDetails(selectedSale.id);
      await loadData();
      setSuccess("Descuento actualizado. El sistema valida los precios mínimos internos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar el descuento.");
    } finally { setSaving(false); }
  }

  async function handleSubmitForPayment() {
    if (!businessId || !selectedSale) return;
    if (!window.confirm("¿Enviar esta venta a pendiente de pago? Después ya no podrás cambiar sus productos ni su descuento.")) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("submit_sale_for_payment", {
        p_business_id: businessId, p_sale_id: selectedSale.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadData();
      await loadSaleDetails(selectedSale.id);
      setSuccess("Venta enviada a pendiente de pago.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la venta.");
    } finally { setSaving(false); }
  }

  async function handleRegisterPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !selectedSale) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Ingresa un importe de pago válido."); return; }
    if (amount > remainingToRegister + 0.001) { setError("El importe supera el saldo que todavía no está registrado."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("register_sale_payment", {
        p_business_id: businessId,
        p_sale_id: selectedSale.id,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_reference: paymentReference.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setPaymentReference("");
      await loadSaleDetails(selectedSale.id);
      setSuccess("Pago registrado como pendiente de verificación. Todavía no es un ingreso confirmado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    } finally { setSaving(false); }
  }

  async function handleConfirmPayment(payment: Payment) {
    if (!businessId || !cashAccountId) { setError("Selecciona una cuenta de caja activa en PEN."); return; }
    if (!window.confirm(`Confirma únicamente si ya verificaste ${money(payment.amount)} en tu aplicación de Yape, Plin o banco. ¿El dinero ingresó realmente?`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("confirm_sale_payment", {
        p_business_id: businessId,
        p_payment_id: payment.id,
        p_cash_account_id: cashAccountId,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadData();
      await loadSaleDetails(payment.sale_id);
      setSuccess("Pago verificado. El ingreso se registró en caja; el stock se descuenta únicamente cuando la venta llega al 100% pagado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar el pago.");
    } finally { setSaving(false); }
  }

  async function handleCancelSale() {
    if (!businessId || !selectedSale) return;
    if (!window.confirm("¿Cancelar este borrador o venta pendiente? Los pagos sin confirmar se marcarán como rechazados. Esta acción conserva el historial.")) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("cancel_sale_draft", {
        p_business_id: businessId, p_sale_id: selectedSale.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadData();
      await loadSaleDetails(selectedSale.id);
      setSuccess("Venta cancelada. El historial se conservó y no se modificó el stock.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la venta.");
    } finally { setSaving(false); }
  }

  async function handlePreparing() {
    if (!businessId || !selectedSale) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("mark_sale_preparing", {
        p_business_id: businessId, p_sale_id: selectedSale.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadData();
      await loadSaleDetails(selectedSale.id);
      setSuccess("Venta marcada como en preparación.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado de la venta.");
    } finally { setSaving(false); }
  }

  async function handleSaveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !selectedSale) return;
    const deliveryCost = Number(deliveryForm.delivery_cost);
    if (!deliveryForm.recipient_name.trim() || !deliveryForm.recipient_phone.trim() || !deliveryForm.delivery_address.trim()) {
      setError("Completa el nombre, teléfono y dirección del destinatario."); return;
    }
    if (!Number.isFinite(deliveryCost) || deliveryCost < 0) { setError("El costo de inDrive debe ser un importe válido en soles."); return; }
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
        p_delivery_cost: deliveryCost,
        p_notes: deliveryForm.notes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setDeliveryEditing(false);
      await loadData();
      await loadSaleDetails(selectedSale.id);
      setSuccess("Entrega inDrive guardada. El transporte lo paga el cliente directamente al conductor y no se registró en caja.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la entrega.");
    } finally { setSaving(false); }
  }

  async function handleDeliveryStatus(nextStatus: string) {
    if (!businessId || !delivery) return;
    const labels: Record<string, string> = {
      requested: "Solicitada", picked_up: "Recogida por el conductor",
      in_transit: "En tránsito", failed: "Incidencia de entrega",
    };
    if (!window.confirm(`¿Actualizar el estado de la entrega a «${labels[nextStatus] ?? nextStatus}»?`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("update_sale_delivery_status", {
        p_business_id: businessId,
        p_delivery_id: delivery.id,
        p_delivery_status: nextStatus,
        p_driver_reference: driverReference.trim() || null,
        p_notes: deliveryForm.notes.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadData();
      await loadSaleDetails(delivery.sale_id);
      setSuccess("Estado de entrega actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la entrega.");
    } finally { setSaving(false); }
  }

  async function handleConfirmDelivery() {
    if (!businessId || !delivery) return;
    if (!window.confirm("Confirma solo cuando el destinatario te haya comunicado el código de entrega de inDrive. No escribas ni guardes el código aquí. ¿Confirmar entrega?")) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("confirm_sale_delivery", {
        p_business_id: businessId, p_delivery_id: delivery.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadData();
      await loadSaleDetails(delivery.sale_id);
      setSuccess("Entrega confirmada. Solo se guardó la fecha y hora de confirmación, no el código.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar la entrega.");
    } finally { setSaving(false); }
  }

  const canEditDraft = selectedSale?.status === "draft";
  const canReceivePayment = selectedSale?.status === "pending_payment";
  const canPrepare = selectedSale?.status === "paid" && selectedSale.payment_status === "confirmed";
  const canManageDelivery = Boolean(selectedSale && ["paid", "preparing"].includes(selectedSale.status));
  const canCancel = Boolean(selectedSale && ["draft", "pending_payment"].includes(selectedSale.status));

  if (loading) {
    return (
      <div className={`flex min-h-[calc(100vh-68px)] items-center justify-center ${pageBg}`}>
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#E99A44] border-t-transparent" />
          <p className={`text-sm ${muted}`}>Cargando ventas de {businessName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-68px)] ${pageBg}`}>
      <div className="mx-auto max-w-[1680px] px-4 py-7 sm:px-6 xl:px-8 2xl:px-10">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-[2px] ${muted}`}>ELITE GAMMA <span className="mx-1 text-[#E99A44]">/</span> Comercial</p>
            <h2 className={`text-3xl font-bold tracking-tight ${title}`}>Ventas</h2>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>Administra operaciones, verifica los pagos y sigue cada pedido hasta su entrega.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setCustomerForm(emptyCustomerForm); setCustomerModalOpen(true); setError(""); }} className={`${subtleButton} !rounded-xl !px-4 !py-3`}>＋ Nuevo cliente</button>
            <button type="button" onClick={() => { setCreateSaleOpen(true); setError(""); setSuccess(""); }} className={`${primaryButton} !rounded-xl !px-5 !py-3`}>＋ Nueva venta</button>
          </div>
        </div>

        {error && <div role="alert" className="mb-5 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-400">{error}</div>}
        {success && <div role="status" className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{success}</div>}

        <section className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {[
            { label: "Ventas activas", value: String(stats.total), detail: "No incluye canceladas" },
            { label: "Pendientes de pago", value: String(stats.pending), detail: "Esperando confirmación" },
            { label: "En preparación", value: String(stats.preparing), detail: "Pago completo confirmado" },
            { label: "En reparto", value: String(stats.delivery), detail: "Con el conductor" },
            { label: "Ingresos confirmados", value: money(stats.revenue), detail: "Ventas con pago completo", wide: true },
          ].map((metric) => (
            <div key={metric.label} className={`group relative min-w-0 overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${surface}`}>
              <div className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-[#E99A44] opacity-80" />
              <p className={`text-xs font-medium ${muted}`}>{metric.label}</p>
              <p className={`mt-3 truncate text-2xl font-bold tracking-tight tabular-nums ${title}`}>{metric.value}</p>
              <p className={`mt-1.5 text-[11px] ${muted}`}>{metric.detail}</p>
            </div>
          ))}
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.92fr)_minmax(0,1.38fr)] 2xl:gap-6">
          <section className={`min-w-0 overflow-hidden rounded-2xl border shadow-sm ${surface}`}>
            <div className={`border-b p-5 ${darkMode ? "border-[#293241]" : "border-[#EAECF0]"}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-base font-bold ${title}`}>Ventas registradas</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${darkMode ? "bg-[#273244] text-[#A0ABBC]" : "bg-[#F1F3F6] text-[#667085]"}`}>{filteredSales.length}</span>
                  </div>
                  <p className={`mt-1 text-xs ${muted}`}>Busca y filtra por estado</p>
                </div>
                <button type="button" onClick={() => void loadData()} className={`${subtleButton} shrink-0 !rounded-xl`} aria-label="Actualizar ventas">↻</button>
              </div>
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_155px]">
                <label className="block min-w-0">
                  <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Buscar</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número de venta, cliente o teléfono…" className={field} aria-label="Buscar ventas" />
                </label>
                <label className="relative block">
                  <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Estado</span>
                  <select value={filter} onChange={(event) => setFilter(event.target.value as SaleFilter)} className={`${field} cursor-pointer !py-[11px]`} aria-label="Filtrar ventas por estado">
                    {saleFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="max-h-[760px] overflow-y-auto p-2">
              {filteredSales.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${darkMode ? "bg-[#202938] text-[#E99A44]" : "bg-[#FFF3E5] text-[#C97824]"}`}>↗</div>
                  <p className={`text-base font-semibold ${title}`}>{sales.length === 0 ? "Todavía no hay ventas" : filter === "active" ? "No hay ventas activas" : "No hay resultados"}</p>
                  <p className={`mx-auto mt-2 max-w-xs text-sm leading-6 ${muted}`}>{sales.length === 0 ? "Crea una venta para comenzar. Se guardará como borrador y no afectará la caja ni el inventario." : "Prueba otro estado o cambia el término de búsqueda. Las ventas canceladas siguen disponibles en «Todas»."}</p>
                  {sales.length === 0 && <button type="button" onClick={() => setCreateSaleOpen(true)} className={`${primaryButton} mt-5 !rounded-xl`}>Crear primera venta</button>}
                </div>
              ) : filteredSales.map((sale) => {
                const customer = customers.find((item) => item.id === sale.customer_id);
                const active = sale.id === selectedSaleId;
                return (
                  <button key={sale.id} type="button" onClick={() => { setSelectedSaleId(sale.id); setError(""); setSuccess(""); }} className={`mb-2 block w-full rounded-xl border px-4 py-4 text-left transition duration-150 last:mb-0 ${active ? (darkMode ? "border-[#E99A44]/50 bg-[#242D3B] shadow-sm" : "border-[#E99A44]/60 bg-[#FFF8F0] shadow-sm") : (darkMode ? "border-[#293241] bg-[#141B25] hover:border-[#46546A] hover:bg-[#1B2431]" : "border-[#EAECF0] bg-white hover:border-[#D9DEE7] hover:bg-[#FCFCFD]")}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${active ? "bg-[#E99A44] text-[#171D28]" : darkMode ? "bg-[#263244] text-[#DCE2EC]" : "bg-[#F1F3F6] text-[#667085]"}`}>EG</span>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-bold ${title}`}>{sale.sale_number ?? "Venta sin número"}</p>
                          <p className={`mt-1 truncate text-xs ${muted}`}>{customer?.full_name ?? "Cliente no especificado"}</p>
                          <p className={`mt-1 truncate text-[11px] ${muted}`}>{channelLabel(sale.channel)} · {dateOnly(sale.sale_date)}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums ${title}`}>{money(sale.total_amount)}</p>
                        <span className={statusClasses(sale.status, darkMode)}>{statusLabel(sale.status)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`min-w-0 overflow-hidden rounded-2xl border shadow-sm ${surface}`}>
            {!selectedSale ? (
              <div className="flex min-h-[440px] flex-col items-center justify-center px-6 py-16 text-center">
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${darkMode ? "bg-[#202938] text-[#E99A44]" : "bg-[#FFF3E5] text-[#C97824]"}`}>↖</div>
                <p className={`text-base font-semibold ${title}`}>Selecciona una venta</p>
                <p className={`mt-2 max-w-sm text-sm leading-6 ${muted}`}>El detalle, los pagos y el seguimiento aparecerán aquí. Selecciona una operación de la lista o crea una nueva venta.</p>
                <button type="button" onClick={() => setCreateSaleOpen(true)} className={`${primaryButton} mt-5 !rounded-xl`}>＋ Nueva venta</button>
              </div>
            ) : (
              <>
                <div className={`border-b p-5 sm:p-6 ${darkMode ? "border-[#293241] bg-[#141B25]" : "border-[#EAECF0] bg-[#FCFCFD]"}`}>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className={`mb-2 text-[10px] font-bold uppercase tracking-[1.6px] ${muted}`}>Detalle de operación</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-xl font-bold tracking-tight ${title}`}>{selectedSale.sale_number ?? "Venta"}</h3>
                        <span className={statusClasses(selectedSale.status, darkMode)}>{statusLabel(selectedSale.status)}</span>
                      </div>
                      <p className={`mt-2 text-sm ${title}`}>{selectedCustomer?.full_name ?? "Cliente no especificado"}</p>
                      <p className={`mt-1 text-xs ${muted}`}>{channelLabel(selectedSale.channel)} · Creada {dateTime(selectedSale.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Total de la venta</span>
                      <p className={`text-2xl font-bold tracking-tight tabular-nums ${title}`}>{money(selectedSale.total_amount)}</p>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {canCancel && <button type="button" disabled={saving} onClick={() => void handleCancelSale()} className={`${subtleButton} !border-rose-400/40 !text-rose-500`}>Cancelar venta</button>}
                        {canPrepare && <button type="button" disabled={saving} onClick={() => void handlePreparing()} className={`${primaryButton} !rounded-xl`}>Marcar preparada</button>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 p-5 sm:p-6">
                  {detailLoading && <p className={`text-xs ${muted}`}>Actualizando detalle...</p>}

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h4 className={`text-sm font-bold ${title}`}>Productos de la venta</h4>
                      {canEditDraft && <span className={`text-[10px] ${muted}`}>Solo borrador editable</span>}
                    </div>

                    {saleItems.length === 0 ? (
                      <div className={`rounded-lg border border-dashed p-5 text-center ${darkMode ? "border-[#354153]" : "border-[#DDE1E7]"}`}>
                        <p className={`text-xs ${muted}`}>Todavía no has agregado productos.</p>
                      </div>
                    ) : (
                      <div className={`overflow-hidden rounded-lg border ${darkMode ? "border-[#354153]" : "border-[#EAECF0]"}`}>
                        {saleItems.map((item) => {
                          const lineSubtotal = numeric(item.quantity) * numeric(item.unit_price) - numeric(item.discount_amount);
                          return (
                            <div key={item.id} className={`flex items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0 ${darkMode ? "border-[#293241]" : "border-[#F0F1F3]"}`}>
                              <div className="min-w-0">
                                <p className={`truncate text-xs font-semibold ${title}`}>{item.product_name_snapshot ?? "Producto"}</p>
                                <p className={`mt-1 text-[10px] ${muted}`}>{item.sku_snapshot ?? "Sin SKU"} · {item.quantity} × {money(item.unit_price)}</p>
                                {numeric(item.discount_amount) > 0 && <p className="mt-1 text-[10px] text-emerald-500">Descuento asignado: {money(item.discount_amount)}</p>}
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <p className={`text-xs font-bold tabular-nums ${title}`}>{money(lineSubtotal)}</p>
                                {canEditDraft && <button type="button" disabled={saving} onClick={() => void handleRemoveItem(item)} className="rounded-md px-2 py-1 text-xs text-rose-500 hover:bg-rose-500/10" title="Quitar producto">Quitar</button>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {canEditDraft && (
                      <form onSubmit={handleAddItem} className={`mt-3 rounded-lg border p-3 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]"}`}>
                        <p className={`mb-2 text-[11px] font-bold ${title}`}>Agregar producto disponible</p>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_125px_auto]">
                          <select required value={productId} onChange={(event) => chooseProduct(event.target.value)} className={field}>
                            <option value="">Selecciona producto…</option>
                            {products.filter((product) => product.stock_quantity > 0).map((product) => (
                              <option key={product.id} value={product.id}>{product.name} · Stock {product.stock_quantity}</option>
                            ))}
                          </select>
                          <input type="number" required min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={field} aria-label="Cantidad" />
                          <input type="number" required min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="Precio unitario" className={field} aria-label="Precio unitario en soles" />
                          <button type="submit" disabled={saving || !productId} className={primaryButton}>Agregar</button>
                        </div>
                        {productId && (() => {
                          const p = products.find((item) => item.id === productId);
                          return p ? <p className={`mt-2 text-[10px] ${muted}`}>Precio de referencia: {money(p.sale_price)}{p.offer_price ? ` · Oferta: ${money(p.offer_price)}` : ""}{p.min_sale_price !== null ? ` · Mínimo interno: ${money(p.min_sale_price)}` : " · Sin mínimo configurado"}. Este mínimo es información interna y no se muestra al cliente.</p> : null;
                        })()}
                        {products.every((product) => product.stock_quantity <= 0) && <p className={`mt-2 text-[10px] ${muted}`}>No hay productos activos con stock disponible para agregar.</p>}
                      </form>
                    )}
                  </section>

                  <section className={`rounded-xl border p-5 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]"}`}>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-3 text-xs"><span className={muted}>Subtotal</span><span className={`font-medium tabular-nums ${title}`}>{money(selectedSale.product_subtotal)}</span></div>
                      <div className="flex justify-between gap-3 text-xs"><span className={muted}>Descuento</span><span className="font-medium tabular-nums text-emerald-500">− {money(selectedSale.discount_amount)}</span></div>
                      <div className={`flex justify-between gap-3 border-t pt-3 ${darkMode ? "border-[#354153]" : "border-[#E5E7EB]"}`}><span className={`text-sm font-bold ${title}`}>Total de productos</span><span className={`text-lg font-bold tabular-nums ${title}`}>{money(selectedSale.total_amount)}</span></div>
                    </div>
                    {canEditDraft && (
                      <form onSubmit={handleDiscount} className="mt-4 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end" style={{ borderColor: darkMode ? "#354153" : "#E5E7EB" }}>
                        <label className="flex-1"><span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Descuento total (S/)</span><input type="number" min="0" step="0.01" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className={field} /></label>
                        <button type="submit" disabled={saving || saleItems.length === 0} className={subtleButton}>Aplicar descuento</button>
                      </form>
                    )}
                    {canEditDraft && <button type="button" disabled={saving || saleItems.length === 0} onClick={() => void handleSubmitForPayment()} className={`${primaryButton} mt-3 w-full`}>Enviar a pendiente de pago</button>}
                    {canEditDraft && <p className={`mt-2 text-[10px] leading-4 ${muted}`}>Al enviar, la venta queda bloqueada para edición. El stock todavía no se descuenta y no se registra ningún ingreso.</p>}
                  </section>

                  {canReceivePayment && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-2"><h4 className={`text-xs font-bold uppercase tracking-wide ${title}`}>Pagos y verificación</h4><span className={statusClasses(selectedSale.payment_status, darkMode)}>{paymentStatusLabel(selectedSale.payment_status)}</span></div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className={`rounded-lg border p-3 ${surface}`}><p className={`text-[10px] ${muted}`}>Confirmado</p><p className={`mt-1 text-sm font-bold ${title}`}>{money(confirmedTotal)}</p></div>
                        <div className={`rounded-lg border p-3 ${surface}`}><p className={`text-[10px] ${muted}`}>Pendiente de verificar</p><p className={`mt-1 text-sm font-bold ${title}`}>{money(pendingTotal)}</p></div>
                        <div className={`rounded-lg border p-3 ${surface}`}><p className={`text-[10px] ${muted}`}>Por registrar</p><p className={`mt-1 text-sm font-bold ${title}`}>{money(remainingToRegister)}</p></div>
                      </div>
                      <form onSubmit={handleRegisterPayment} className={`rounded-lg border p-3 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]"}`}>
                        <p className={`mb-2 text-[11px] font-bold ${title}`}>Registrar un pago reportado</p>
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
                          <input type="number" required min="0.01" max={remainingToRegister} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Importe S/" className={field} />
                          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={field}>
                            <option value="yape">Yape</option><option value="plin">Plin</option><option value="bank_transfer">Transferencia</option>
                          </select>
                          <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="N.º operación (opcional)" className={field} />
                          <button type="submit" disabled={saving || remainingToRegister <= 0} className={primaryButton}>Registrar</button>
                        </div>
                        <p className={`mt-2 text-[10px] leading-4 ${muted}`}>Registrar no significa confirmar. Primero registra el pago que el cliente reporta; después verifica el abono en tu propia aplicación.</p>
                      </form>

                      {payments.length > 0 && (
                        <div className="space-y-2">
                          {payments.map((payment) => (
                            <div key={payment.id} className={`flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${surface}`}>
                              <div>
                                <p className={`text-xs font-semibold ${title}`}>{paymentMethodLabel(payment.payment_method)} · {money(payment.amount)}</p>
                                <p className={`mt-1 text-[10px] ${muted}`}>{payment.reference ? `Operación ${payment.reference} · ` : ""}{dateTime(payment.created_at)} · {paymentStatusLabel(payment.payment_status)}</p>
                              </div>
                              {payment.payment_status === "pending" && (
                                <button type="button" disabled={saving || !cashAccounts.length} onClick={() => void handleConfirmPayment(payment)} className={`${primaryButton} shrink-0`}>
                                  Ya verifiqué el abono
                                </button>
                              )}
                              {payment.payment_status === "confirmed" && <span className={statusClasses("confirmed", darkMode)}>Confirmado en caja</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {pendingPayments.length > 0 && (
                        <div className={`rounded-lg border p-3 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]"}`}>
                          <label className={`mb-2 block text-[10px] font-semibold ${muted}`}>Cuenta de caja donde se registrará el dinero recibido</label>
                          <select value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)} className={field}>
                            <option value="">Selecciona cuenta de caja…</option>
                            {cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency_code}</option>)}
                          </select>
                          {!cashAccounts.length && <p className="mt-2 text-[10px] text-rose-500">No hay una cuenta de caja activa en PEN. Configura una cuenta antes de confirmar pagos.</p>}
                          <p className={`mt-2 text-[10px] leading-4 ${muted}`}>Confirma solo después de comprobar el abono real. Cada confirmación se registra como ingreso de caja. El inventario se descuenta al completar el 100% del total.</p>
                        </div>
                      )}
                    </section>
                  )}

                  {selectedSale.status !== "draft" && selectedSale.status !== "pending_payment" && selectedSale.status !== "cancelled" && (
                    <section className="space-y-3">
                      <h4 className={`text-xs font-bold uppercase tracking-wide ${title}`}>Resumen de pago</h4>
                      <div className={`rounded-lg border p-3 ${surface}`}>
                        <div className="flex justify-between gap-3 text-xs"><span className={muted}>Estado</span><span className={title}>{paymentStatusLabel(selectedSale.payment_status)}</span></div>
                        <div className="mt-2 flex justify-between gap-3 text-xs"><span className={muted}>Total confirmado</span><span className={`font-bold ${title}`}>{money(confirmedTotal)}</span></div>
                        <p className={`mt-2 text-[10px] ${muted}`}>El pago total fue confirmado y el inventario se descontó al completar la venta.</p>
                      </div>
                      {payments.map((payment) => <div key={payment.id} className={`flex justify-between gap-3 rounded-lg border p-3 text-xs ${surface}`}><span className={muted}>{paymentMethodLabel(payment.payment_method)} · {dateTime(payment.received_at ?? payment.created_at)}</span><span className={`font-semibold ${title}`}>{money(payment.amount)} · {paymentStatusLabel(payment.payment_status)}</span></div>)}
                    </section>
                  )}

                  {(canManageDelivery || Boolean(delivery) || selectedSale.status === "shipped" || selectedSale.status === "delivered") && (
                    <section className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><h4 className={`text-xs font-bold uppercase tracking-wide ${title}`}>Entrega por inDrive</h4><p className={`mt-1 text-[10px] ${muted}`}>Se registra como coordinación externa, no como ingreso de ELITE GAMMA.</p></div>
                        {delivery && <span className={statusClasses(delivery.delivery_status, darkMode)}>{delivery.delivery_status === "delivered" ? "Entregada" : delivery.delivery_status === "in_transit" ? "En tránsito" : delivery.delivery_status === "picked_up" ? "Recogida" : delivery.delivery_status === "failed" ? "Con incidencia" : "Solicitada"}</span>}
                      </div>

                      {delivery && !deliveryEditing ? (
                        <div className={`rounded-lg border p-3 ${surface}`}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div><p className={`text-[10px] ${muted}`}>Destinatario</p><p className={`mt-1 text-xs font-semibold ${title}`}>{delivery.recipient_name}</p></div>
                            <div><p className={`text-[10px] ${muted}`}>Teléfono</p><p className={`mt-1 text-xs font-semibold ${title}`}>{delivery.recipient_phone}</p></div>
                            <div className="sm:col-span-2"><p className={`text-[10px] ${muted}`}>Dirección</p><p className={`mt-1 text-xs font-semibold ${title}`}>{delivery.delivery_address}</p>{delivery.address_reference && <p className={`mt-1 text-[10px] ${muted}`}>{delivery.address_reference}</p>}</div>
                            <div><p className={`text-[10px] ${muted}`}>Costo inDrive (cliente)</p><p className={`mt-1 text-xs font-semibold ${title}`}>{money(delivery.delivery_cost)}</p></div>
                            <div><p className={`text-[10px] ${muted}`}>Conductor / referencia</p><p className={`mt-1 text-xs font-semibold ${title}`}>{delivery.driver_reference ?? "Sin referencia"}</p></div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {canManageDelivery && delivery.delivery_status !== "delivered" && delivery.delivery_status !== "cancelled" && <button type="button" onClick={() => setDeliveryEditing(true)} className={subtleButton}>Editar datos</button>}
                            {delivery.delivery_status === "requested" && <button type="button" disabled={saving} onClick={() => void handleDeliveryStatus("picked_up")} className={primaryButton}>Conductor recogió</button>}
                            {delivery.delivery_status === "picked_up" && <button type="button" disabled={saving} onClick={() => void handleDeliveryStatus("in_transit")} className={primaryButton}>Marcar en tránsito</button>}
                            {delivery.delivery_status !== "delivered" && delivery.delivery_status !== "cancelled" && delivery.delivery_status !== "failed" && <button type="button" disabled={saving} onClick={() => void handleDeliveryStatus("failed")} className={`${subtleButton} !text-rose-500`}>Registrar incidencia</button>}
                            {delivery.delivery_status === "failed" && <button type="button" disabled={saving} onClick={() => void handleDeliveryStatus("requested")} className={primaryButton}>Reprogramar entrega</button>}
                            {(delivery.delivery_status === "picked_up" || delivery.delivery_status === "in_transit") && <button type="button" disabled={saving} onClick={() => void handleConfirmDelivery()} className={primaryButton}>Confirmar código recibido</button>}
                          </div>
                          {delivery.delivery_status === "delivered" && <p className="mt-3 text-[10px] text-emerald-500">Entrega confirmada {dateTime(delivery.delivered_at)}. No se almacenó el código de inDrive.</p>}
                          {delivery.delivery_status === "failed" && <p className="mt-3 text-[10px] text-rose-500">Entrega con incidencia. Puedes actualizar los datos y solicitar nuevamente.</p>}
                        </div>
                      ) : null}

                      {canManageDelivery && (!delivery || deliveryEditing) && (
                        <form onSubmit={handleSaveDelivery} className={`rounded-lg border p-3 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]"}`}>
                          <div className="mb-3 flex items-center justify-between gap-2"><p className={`text-[11px] font-bold ${title}`}>{delivery ? "Editar datos de entrega" : "Preparar entrega"}</p>{delivery && <button type="button" onClick={() => setDeliveryEditing(false)} className={`text-[10px] ${muted}`}>Cancelar edición</button>}</div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label><span className={`mb-1 block text-[10px] ${muted}`}>Nombre del destinatario *</span><input required value={deliveryForm.recipient_name} onChange={(event) => setDeliveryForm((current) => ({ ...current, recipient_name: event.target.value }))} className={field} /></label>
                            <label><span className={`mb-1 block text-[10px] ${muted}`}>Teléfono *</span><input required value={deliveryForm.recipient_phone} onChange={(event) => setDeliveryForm((current) => ({ ...current, recipient_phone: event.target.value }))} className={field} /></label>
                            <label className="sm:col-span-2"><span className={`mb-1 block text-[10px] ${muted}`}>Dirección de entrega *</span><input required value={deliveryForm.delivery_address} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_address: event.target.value }))} className={field} /></label>
                            <label><span className={`mb-1 block text-[10px] ${muted}`}>Referencia / distrito</span><input value={deliveryForm.address_reference} onChange={(event) => setDeliveryForm((current) => ({ ...current, address_reference: event.target.value }))} className={field} /></label>
                            <label><span className={`mb-1 block text-[10px] ${muted}`}>Costo inDrive en soles (S/)</span><input required type="number" min="0" step="0.01" value={deliveryForm.delivery_cost} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_cost: event.target.value }))} className={field} /></label>
                            <label className="sm:col-span-2"><span className={`mb-1 block text-[10px] ${muted}`}>Notas</span><textarea rows={2} value={deliveryForm.notes} onChange={(event) => setDeliveryForm((current) => ({ ...current, notes: event.target.value }))} className={field} /></label>
                          </div>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className={`max-w-md text-[10px] leading-4 ${muted}`}>El cliente paga el transporte directamente al conductor. No sumes este importe a la venta ni lo registres en caja.</p><button type="submit" disabled={saving} className={primaryButton}>Guardar entrega</button></div>
                        </form>
                      )}

                      {delivery && <label className="block"><span className={`mb-1 block text-[10px] ${muted}`}>Referencia del conductor (opcional)</span><input value={driverReference} onChange={(event) => setDriverReference(event.target.value)} onBlur={() => { /* se guarda al actualizar el estado */ }} placeholder="Nombre o referencia de inDrive" className={field} /></label>}
                    </section>
                  )}

                  {selectedSale.notes && <section><h4 className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${muted}`}>Notas</h4><p className={`text-xs leading-5 ${title}`}>{selectedSale.notes}</p></section>}

                  <div className={`rounded-lg border p-3 ${darkMode ? "border-[#354153] bg-[#101722]" : "border-[#EAECF0] bg-[#FAFBFC]"}`}>
                    <p className={`text-[10px] font-semibold ${title}`}>Reglas de operación</p>
                    <ul className={`mt-2 space-y-1.5 text-[10px] leading-4 ${muted}`}>
                      <li>• El pago se confirma únicamente después de verificar el abono en tu propia aplicación.</li>
                      <li>• El stock se descuenta cuando el pago confirmado alcanza el 100% de la venta.</li>
                      <li>• El cliente paga inDrive directamente al conductor; ese importe no es ingreso de la tienda.</li>
                      <li>• El código de entrega no se guarda; solo se registra cuándo confirmaste haberlo recibido.</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {createSaleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateSaleOpen(false); }}>
          <form onSubmit={handleCreateSale} className={`my-8 w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${surface}`}>
            <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className={`text-lg font-bold ${title}`}>Nueva venta</h3><p className={`mt-1 text-xs ${muted}`}>Se creará como borrador. Todavía no afecta caja ni inventario.</p></div><button type="button" onClick={() => setCreateSaleOpen(false)} className={subtleButton}>Cerrar</button></div>
            <div className="space-y-3">
              <label className="block"><span className={`mb-1 block text-[11px] font-semibold ${muted}`}>Cliente (opcional)</span><select value={saleCustomerId} onChange={(event) => setSaleCustomerId(event.target.value)} className={field}><option value="">Sin cliente asociado</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
              <label className="block"><span className={`mb-1 block text-[11px] font-semibold ${muted}`}>Canal de venta</span><select value={saleChannel} onChange={(event) => setSaleChannel(event.target.value)} className={field}><option value="facebook_marketplace">Facebook Marketplace</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="other">Otro</option></select></label>
              <label className="block"><span className={`mb-1 block text-[11px] font-semibold ${muted}`}>Notas internas (opcional)</span><textarea rows={3} value={saleNotes} onChange={(event) => setSaleNotes(event.target.value)} className={field} placeholder="Detalles útiles para preparar el pedido..." /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreateSaleOpen(false)} className={subtleButton}>Cancelar</button><button type="submit" disabled={saving} className={primaryButton}>{saving ? "Creando..." : "Crear borrador"}</button></div>
          </form>
        </div>
      )}

      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomerModalOpen(false); }}>
          <form onSubmit={handleCreateCustomer} className={`my-8 w-full max-w-xl rounded-2xl border p-5 shadow-2xl ${surface}`}>
            <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className={`text-lg font-bold ${title}`}>Nuevo cliente</h3><p className={`mt-1 text-xs ${muted}`}>Guarda los datos de contacto para utilizarlos en próximas ventas.</p></div><button type="button" onClick={() => setCustomerModalOpen(false)} className={subtleButton}>Cerrar</button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Nombre completo *</span><input required value={customerForm.full_name} onChange={(event) => setCustomerForm((current) => ({ ...current, full_name: event.target.value }))} className={field} /></label>
              <label><span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Teléfono</span><input value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} className={field} /></label>
              <label><span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Correo</span><input type="email" value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} className={field} /></label>
              <label className="sm:col-span-2"><span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Dirección</span><input value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} className={field} /></label>
              <label><span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Distrito</span><input value={customerForm.district} onChange={(event) => setCustomerForm((current) => ({ ...current, district: event.target.value }))} className={field} /></label>
              <label><span className={`mb-1 block text-[10px] font-semibold ${muted}`}>Notas</span><input value={customerForm.notes} onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))} className={field} /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCustomerModalOpen(false)} className={subtleButton}>Cancelar</button><button type="submit" disabled={saving} className={primaryButton}>{saving ? "Guardando..." : "Guardar cliente"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
