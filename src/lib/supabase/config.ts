type SupabaseConfigInput = {
  url?: string;
  publishableKey?: string;
  anonKey?: string;
};

function isValidPublicKey(key: string) {
  if (key.startsWith("sb_publishable_")) {
    return key.length > "sb_publishable_".length;
  }

  const parts = key.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return false;
  }

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload)) as { role?: unknown };
    return decoded.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabaseConfig(
  input: SupabaseConfigInput = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
) {
  const urlValue = input.url?.trim();
  const keyValue = input.publishableKey?.trim() || input.anonKey?.trim();

  if (!urlValue) {
    throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlValue);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida.");
  }

  const isLocalHttp =
    parsedUrl.protocol === "http:" &&
    (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1");
  if (
    (parsedUrl.protocol !== "https:" && !isLocalHttp) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL debe usar HTTPS (HTTP solo se permite para localhost) y no incluir credenciales, query ni fragmento."
    );
  }

  if (!keyValue) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (!isValidPublicKey(keyValue)) {
    throw new Error(
      "La clave pública de Supabase no tiene un formato válido. Usa una publishable key o una anon key; no uses secret ni service_role."
    );
  }

  return { url: parsedUrl.toString().replace(/\/$/, ""), key: keyValue };
}
