"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ConfirmAuthPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Verificando el enlace seguro…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function confirm() {
      const supabase = getSupabaseBrowserClient();
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const next = params.get("next") === "/actualizar-contrasena" ? "/actualizar-contrasena" : "/login";
      if (!supabase || !tokenHash || !type || !["signup", "recovery", "invite", "email"].includes(type)) {
        if (active) { setFailed(true); setStatus("El enlace no es válido o la autenticación aún no está configurada."); }
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "signup" | "recovery" | "invite" | "email" });
      if (!active) return;
      if (error) { setFailed(true); setStatus(error.message); return; }
      setStatus("Enlace verificado correctamente. Redirigiendo…");
      router.replace(next);
    }
    void confirm();
    return () => { active = false; };
  }, [router]);

  return <main className="auth-shell"><section className="auth-card" aria-live="polite">
    <Link className="auth-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></Link>
    <p className="auth-eyebrow">VERIFICACIÓN DE ACCESO</p><h1>{failed ? "No se pudo verificar." : "Un momento."}</h1><p className="auth-description">{status}</p>
    {failed && <Link className="auth-submit auth-submit--link" href="/login">Volver al inicio de sesión <span>→</span></Link>}
  </section></main>;
}
