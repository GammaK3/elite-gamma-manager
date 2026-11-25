
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data: { user }, error: userError } =
        await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Tu sesión de recuperación no es válida. Solicita un nuevo enlace."
        );
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#10151F] px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#293241] bg-[#171D28] p-8">

        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#202938] text-xl font-bold text-white">
            EG<span className="text-[#F39A38]">.</span>
          </div>

          <h1 className="mt-5 text-xl font-bold text-white">
            Crear nueva contraseña
          </h1>

          <p className="mt-2 text-sm text-[#9BA7B8]">
            Configura tu contraseña para ELITE GAMMA Manager.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold text-white">
              Nueva contraseña
            </label>

            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-lg border border-[#354153] bg-[#101722] px-4 py-3 text-sm text-white outline-none focus:border-[#E99A44]"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-white">
              Confirmar contraseña
            </label>

            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              className="w-full rounded-lg border border-[#354153] bg-[#101722] px-4 py-3 text-sm text-white outline-none focus:border-[#E99A44]"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-950/40 p-3 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#E99A44] py-3.5 text-sm font-bold text-[#171D28] transition hover:bg-[#F3AB5C] disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}
