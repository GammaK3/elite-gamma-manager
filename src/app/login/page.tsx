
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError("Correo o contraseña incorrectos. Verifica tu cuenta.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#10151F] px-5 py-10">
      <div className="w-full max-w-md">

        <div className="mb-9 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#202938] text-2xl font-bold text-white">
            EG<span className="text-[#F39A38]">.</span>
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-[2px] text-white">
            ELITE GAMMA
          </h1>

          <p className="mt-2 text-xs tracking-[3px] text-[#929EAF]">
            BUSINESS MANAGER
          </p>
        </div>

        <div className="rounded-2xl border border-[#293241] bg-[#171D28] p-7 shadow-2xl sm:p-9">
          <h2 className="text-xl font-bold text-white">
            Bienvenido de nuevo
          </h2>

          <p className="mt-2 text-sm text-[#9BA7B8]">
            Inicia sesión para administrar tu negocio.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold text-[#D5DCE7]">
                Correo electrónico
              </label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-lg border border-[#354153] bg-[#101722] px-4 py-3 text-sm text-white outline-none placeholder:text-[#697589] focus:border-[#E99A44]"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold text-[#D5DCE7]">
                Contraseña
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="w-full rounded-lg border border-[#354153] bg-[#101722] px-4 py-3 text-sm text-white outline-none placeholder:text-[#697589] focus:border-[#E99A44]"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#E99A44] py-3.5 text-sm font-bold text-[#171D28] transition hover:bg-[#F3AB5C] disabled:opacity-60"
            >
              {loading ? "Verificando acceso..." : "Iniciar sesión"}
            </button>
          </form>

          <div className="mt-7 border-t border-[#303A49] pt-6 text-center">
            <p className="text-[11px] text-[#8490A2]">
              Acceso privado · ELITE GAMMA
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] tracking-wide text-[#697589]">
          ELITE GAMMA MANAGER © 2026
        </p>
      </div>
    </main>
  );
}
