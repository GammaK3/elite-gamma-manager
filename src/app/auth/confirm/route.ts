
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";

  // Detectar errores devueltos por Supabase.
  const authError = searchParams.get("error_code");

  if (authError) {
    redirect("/login?error=expired_link");
  }

  // Validar el token.
  if (
    !tokenHash ||
    (type !== "invite" && type !== "recovery")
  ) {
    redirect("/login?error=invalid_link");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    redirect("/login?error=verification_failed");
  }

  // La sesión queda guardada en las cookies.
  redirect(safeNext);
}
