"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register" | "recover" | "update";
const copy = {
  login: { eyebrow: "BIENVENIDO DE NUEVO", title: "Ingresa a tu espacio.", description: "Accede a tu cuenta para continuar organizando tu información comercial.", submit: "Iniciar sesión" },
  register: { eyebrow: "COMIENZA A ORGANIZARTE", title: "Crea tu cuenta.", description: "Registra tu acceso a Radar Comercial. La confirmación dependerá de la configuración de correo de Supabase.", submit: "Crear cuenta" },
  recover: { eyebrow: "RECUPERAR ACCESO", title: "Volvamos a conectarte.", description: "Te enviaremos un enlace para restablecer tu contraseña si el servicio de correo está configurado.", submit: "Enviar enlace" },
  update: { eyebrow: "NUEVA CONTRASEÑA", title: "Actualiza tu acceso.", description: "Elige una contraseña nueva para tu cuenta.", submit: "Guardar contraseña" },
} satisfies Record<AuthMode, { eyebrow: string; title: string; description: string; submit: string }>;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code === "auth_callback") setError("El enlace de confirmación o recuperación no es válido o ya venció. Solicita uno nuevo.");
    if (code === "supabase_not_configured") setError("La autenticación todavía no está configurada en este entorno.");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("La autenticación todavía no está conectada. Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY con los datos del proyecto Supabase.");
      return;
    }
    if ((mode === "register" || mode === "update") && password.length < 10) {
      setError("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    if ((mode === "register" || mode === "update") && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace("/dashboard");
        router.refresh();
      } else if (mode === "register") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
        });
        if (authError) throw authError;
        setMessage(data.session ? "Cuenta creada. La sesión está activa." : "Solicitud recibida. Si la confirmación por correo está habilitada, revisa tu bandeja de entrada.");
        if (data.session) router.replace("/dashboard");
      } else if (mode === "recover") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm?next=/actualizar-contrasena`,
        });
        if (authError) throw authError;
        setMessage("Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Contraseña actualizada correctamente. Tu sesión sigue activa.");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible completar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  const content = copy[mode];
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></Link>
        <p className="auth-eyebrow">{content.eyebrow}</p>
        <h1 id="auth-title">{content.title}</h1>
        <p className="auth-description">{content.description}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode !== "update" && <>
            <label className="auth-label" htmlFor="email">Correo electrónico</label>
            <input className="auth-input" id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" />
          </>}
          {mode !== "recover" && <>
            <label className="auth-label" htmlFor="password">Contraseña</label>
            <input className="auth-input" id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 10} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "login" ? "Tu contraseña" : "Mínimo 10 caracteres"} />
          </>}
          {(mode === "register" || mode === "update") && <>
            <label className="auth-label" htmlFor="confirm-password">Confirmar contraseña</label>
            <input className="auth-input" id="confirm-password" type="password" autoComplete="new-password" required minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite tu contraseña" />
          </>}
          {error && <p className="auth-alert auth-alert--error" role="alert">{error}</p>}
          {message && <p className="auth-alert auth-alert--success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Procesando…" : content.submit}<span aria-hidden="true">→</span></button>
        </form>
        <nav className="auth-links" aria-label="Opciones de acceso">
          {mode === "login" && <><Link href="/recuperar-acceso">¿Olvidaste tu contraseña?</Link><span>¿Aún no tienes cuenta? <Link href="/registro">Crear cuenta</Link></span></>}
          {mode === "register" && <span>¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link></span>}
          {mode === "recover" && <Link href="/login">Volver al inicio de sesión</Link>}
          {mode === "update" && <Link href="/login">Ir al inicio de sesión</Link>}
        </nav>
        <p className="auth-footnote">Tu acceso se valida mediante el proveedor de identidad configurado. Los permisos de cada espacio de trabajo los controla la API.</p>
      </section>
    </main>
  );
}
