
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
         email.trim(),
         {
          redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
         }
);

      if (error) {
        setError(error.message);
        return;
      }

      setMessage(
        "Solicitud enviada. Revisa tu correo y también la carpeta de spam."
      );
    } catch {
      setError("No se pudo enviar la solicitud. Intenta nuevamente.");
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
            Recuperar contraseña
          </h1>

          <p className="mt-2 text-sm text-[#9BA7B8]">
            Introduce tu correo para recuperar tu acceso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-xs font-semibold text-white"
            >
              Correo electrónico
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-lg border border-[#354153] bg-[#101722] px-4 py-3 text-sm text-white outline-none placeholder:text-[#697589] focus:border-[#E99A44]"
            />
          </div>

          {message && (
            <p role="status" className="rounded-lg bg-green-950/40 p-3 text-xs leading-5 text-green-300">
              {message}
            </p>
          )}

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
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-xs font-medium text-[#E99A44] hover:underline"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
