"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Workspace = { id?: string; workspaceId?: string; name?: string };
type Envelope<T> = { data: T };
type CreatedResearch = { id?: string; researchId?: string; title?: string };
const API_URL = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:3000";

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(path, API_URL), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error?.message ??
      (response.status === 403 ? "No tienes permiso para crear investigaciones en este espacio." :
      response.status === 401 ? "Tu sesión expiró. Inicia sesión nuevamente." :
      "No fue posible guardar la investigación. Revisa los datos e inténtalo otra vez."));
  }
  if (response.status === 204) return undefined as T;
  return payload as T;
}

export default function NewResearchPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("Ecuador");
  const [city, setCity] = useState("");
  const [sector, setSector] = useState("");
  const [objective, setObjective] = useState("");
  const [status, setStatus] = useState<"draft" | "in_progress">("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedResearch | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (active) { setError("La autenticación todavía no está configurada. Conecta Supabase para crear investigaciones."); setLoading(false); }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (active) setToken(session.access_token);
      try {
        const result = await api<Envelope<Workspace[]>>("/api/v1/workspaces", session.access_token);
        const items = result.data ?? [];
        if (active) {
          setWorkspaces(items);
          const firstId = items[0]?.id ?? items[0]?.workspaceId ?? "";
          setWorkspaceId(firstId);
          if (!firstId) setError("Primero debes crear o recibir acceso a un espacio de trabajo.");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No fue posible cargar tus espacios.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !token || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<Envelope<CreatedResearch>>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/researches`,
        token,
        { method: "POST", body: JSON.stringify({
          title: title.trim(),
          country: country.trim(),
          city: city.trim() || null,
          sector: sector.trim(),
          objective: objective.trim(),
          status,
        }) },
      );
      setCreated(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear la investigación.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <Link className="dashboard-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></Link>
      <p className="dashboard-nav-label">INVESTIGACIÓN</p>
      <nav className="dashboard-nav" aria-label="Navegación principal">
        <Link href="/dashboard"><span>▦</span> Resumen</Link>
        <Link className="is-active" href="/investigaciones/nueva"><span>＋</span> Crear investigación</Link>
        <Link href="/workspaces"><span>⌘</span> Espacios y equipo</Link>
      </nav>
      <div className="dashboard-sidebar-bottom"><span className="dashboard-avatar">R</span><div><strong>Radar Comercial</strong><small>Nueva investigación</small></div></div>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-topbar"><span>Panel de control <b>/</b> Investigaciones <b>/</b> Nueva</span><span className="dashboard-live"><i/> Área privada</span></header>
      <div className="dashboard-content research-form-content">
        <div className="dashboard-welcome"><div><p className="dashboard-eyebrow">NUEVO PROYECTO</p><h1>Crear investigación.</h1><p>Define el mercado que deseas estudiar y deja claro qué necesitas descubrir.</p></div><Link className="research-back-link" href="/dashboard">← Volver al resumen</Link></div>
        {loading && <div className="dashboard-state" role="status">Cargando tus espacios de trabajo…</div>}
        {error && <div className="dashboard-state dashboard-state--error" role="alert">{error}</div>}
        {created ? <section className="dashboard-panel research-success" role="status">
          <span className="research-success-icon">✓</span><h2>Investigación creada.</h2>
          <p><strong>{created.title ?? title}</strong> ya quedó registrada en el espacio seleccionado.</p>
          <p className="research-created-id">Identificador: {created.id ?? created.researchId ?? "Registrada por la API"}</p>
          <div><Link className="dashboard-primary" href="/dashboard">Ir al dashboard <span>→</span></Link><button type="button" className="research-secondary-button" onClick={() => { setCreated(null); setTitle(""); setCity(""); setSector(""); setObjective(""); setStatus("draft"); }}>Crear otra</button></div>
        </section> : !loading && <form className="dashboard-panel research-form" onSubmit={submit}>
          <div className="research-form-heading"><div><h2>Información principal</h2><p>Los campos marcados con * son obligatorios.</p></div><span className="research-step-label">01 / 01</span></div>
          <div className="research-field research-field--wide"><label htmlFor="research-title">Nombre de la investigación *</label><input id="research-title" required minLength={1} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Análisis del mercado de cafeterías en Quito"/><small>Usa un nombre claro que identifique el mercado o la pregunta central.</small></div>
          <div className="research-field"><label htmlFor="research-workspace">Espacio de trabajo *</label><select id="research-workspace" required value={workspaceId} onChange={e=>setWorkspaceId(e.target.value)} disabled={workspaces.length===0}>{workspaces.map((w,index)=>{const id=w.id??w.workspaceId??"";return <option key={id||index} value={id}>{w.name??"Espacio sin nombre"}</option>})}</select></div>
          <div className="research-field"><label htmlFor="research-status">Estado inicial</label><select id="research-status" value={status} onChange={e=>setStatus(e.target.value as "draft"|"in_progress")}><option value="draft">Borrador</option><option value="in_progress">En progreso</option></select></div>
          <div className="research-form-divider"><span>Ubicación y sector</span></div>
          <div className="research-field"><label htmlFor="research-country">País *</label><input id="research-country" required maxLength={80} value={country} onChange={e=>setCountry(e.target.value)} placeholder="Ej. Ecuador"/></div>
          <div className="research-field"><label htmlFor="research-city">Ciudad o región</label><input id="research-city" maxLength={100} value={city} onChange={e=>setCity(e.target.value)} placeholder="Ej. Quito"/></div>
          <div className="research-field research-field--wide"><label htmlFor="research-sector">Sector o industria *</label><input id="research-sector" required maxLength={100} value={sector} onChange={e=>setSector(e.target.value)} placeholder="Ej. Alimentos y bebidas, tecnología, comercio minorista"/></div>
          <div className="research-form-divider"><span>Objetivo de investigación</span></div>
          <div className="research-field research-field--wide"><label htmlFor="research-objective">¿Qué necesitas conocer? *</label><textarea id="research-objective" required minLength={1} maxLength={1000} rows={5} value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Describe qué mercado deseas comprender, qué decisiones necesitas tomar y qué información sería útil reunir."/><small>{objective.length}/1000 caracteres. Evita incluir datos personales o información confidencial innecesaria.</small></div>
          <div className="research-form-actions"><Link href="/dashboard">Cancelar</Link><button type="submit" disabled={saving || !workspaceId}>{saving ? "Guardando…" : "Crear investigación"} <span>→</span></button></div>
        </form>}
        <footer className="dashboard-footer">Radar Comercial · La investigación organiza evidencia; no garantiza predicciones ni resultados de mercado.</footer>
      </div>
    </section>
  </main>;
}
