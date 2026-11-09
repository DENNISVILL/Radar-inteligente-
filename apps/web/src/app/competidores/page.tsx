"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Workspace = { id?: string; workspaceId?: string; name?: string };
type Competitor = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  location?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
type Envelope<T> = { data: T };
const API = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(path, API), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as { message?: string; data?: unknown } | null;
  if (!response.ok) {
    throw new Error(body?.message ?? (response.status === 403
      ? "Tu rol no permite realizar esta acción."
      : response.status === 404
        ? "No se encontró el competidor solicitado."
        : "No fue posible completar la operación."));
  }
  return body as T;
}

const emptyForm = { name: "", websiteUrl: "", location: "", description: "" };

export default function CompetitorsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [items, setItems] = useState<Competitor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [archiveId, setArchiveId] = useState("");

  useEffect(() => {
    let active = true;
    async function initialize() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError("Conecta Supabase para acceder a tus competidores.");
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!active) return;
      setToken(session.access_token);
      try {
        const result = await request<Envelope<Workspace[]>>("/api/v1/workspaces", session.access_token);
        const spaces = result.data ?? [];
        if (!active) return;
        setWorkspaces(spaces);
        setWorkspaceId(spaces[0]?.id ?? spaces[0]?.workspaceId ?? "");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No fue posible cargar tus espacios.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let active = true;
    if (!workspaceId || !token) return;
    setLoading(true);
    setError("");
    request<Envelope<Competitor[]>>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/competitors?limit=100`, token)
      .then(result => {
        if (active) {
          setItems(result.data ?? []);
          setSelectedForCompare([]);
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "No fue posible cargar competidores.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId, token]);

  const filtered = useMemo(() => items.filter(item =>
    [item.name, item.location, item.description, item.websiteUrl]
      .join(" ").toLowerCase().includes(search.trim().toLowerCase())
  ), [items, search]);
  const comparison = items.filter(item => selectedForCompare.includes(item.id));

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
  }

  function startEdit(item: Competitor) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      websiteUrl: item.websiteUrl ?? "",
      location: item.location ?? "",
      description: item.description ?? "",
    });
    setError("");
    setNotice("");
    document.getElementById("competitor-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !token) return;
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      name: form.name.trim(),
      websiteUrl: form.websiteUrl.trim() || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
    };
    try {
      const base = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/competitors`;
      if (editingId) {
        await request(`${base}/${encodeURIComponent(editingId)}`, token, {
          method: "PATCH", body: JSON.stringify(payload),
        });
        setNotice("Competidor actualizado.");
      } else {
        await request(base, token, { method: "POST", body: JSON.stringify(payload) });
        setNotice("Competidor registrado.");
      }
      resetForm();
      const result = await request<Envelope<Competitor[]>>(`${base}?limit=100`, token);
      setItems(result.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar el competidor.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveCompetitor(id: string) {
    if (!workspaceId || !token) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/competitors/${encodeURIComponent(id)}`, token, { method: "DELETE" });
      setItems(current => current.filter(item => item.id !== id));
      setSelectedForCompare(current => current.filter(value => value !== id));
      setArchiveId("");
      if (editingId === id) resetForm();
      setNotice("Competidor archivado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible archivar el competidor.");
    } finally {
      setSaving(false);
    }
  }

  function toggleCompare(id: string) {
    setSelectedForCompare(current => {
      if (current.includes(id)) return current.filter(value => value !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></Link>
        <p className="dashboard-nav-label">INVESTIGACIÓN</p>
        <nav className="dashboard-nav" aria-label="Navegación principal">
          <Link href="/dashboard"><span>▦</span> Resumen</Link>
          <Link href="/investigaciones"><span>◎</span> Investigaciones</Link>
          <Link href="/investigaciones/nueva"><span>＋</span> Crear investigación</Link>
          <Link className="is-active" href="/competidores"><span>◇</span> Competidores</Link>
          <Link href="/workspaces"><span>⌘</span> Espacios y equipo</Link>
        </nav>
        <div className="dashboard-sidebar-bottom"><span className="dashboard-avatar">R</span><div><strong>Radar Comercial</strong><small>Competidores</small></div><button type="button" onClick={signOut} aria-label="Cerrar sesión">↗</button></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar"><span>Panel de control <b>/</b> Inteligencia de mercado <b>/</b> Competidores</span><span className="dashboard-live"><i/> Área privada</span></header>
        <div className="dashboard-content competitor-content">
          <div className="dashboard-welcome">
            <div><p className="dashboard-eyebrow">INTELIGENCIA DE MERCADO</p><h1>Competidores.</h1><p>Construye un registro ordenado de empresas y alternativas del mercado.</p></div>
            <span className="competitor-count">{items.length} registrados</span>
          </div>

          {error && <div className="dashboard-state dashboard-state--error" role="alert">{error}</div>}
          {notice && <div className="dashboard-state" role="status">{notice}</div>}

          <section className="dashboard-panel competitor-toolbar">
            <div><label htmlFor="competitor-workspace">Espacio de trabajo</label><select id="competitor-workspace" value={workspaceId} onChange={event => setWorkspaceId(event.target.value)}>{workspaces.map((space, index) => { const id = space.id ?? space.workspaceId ?? ""; return <option key={id || index} value={id}>{space.name ?? "Espacio"}</option>; })}</select></div>
            <div><label htmlFor="competitor-search">Buscar competidor</label><input id="competitor-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, ubicación o descripción…"/></div>
          </section>

          <div className="competitor-workspace-grid">
            <section className="dashboard-panel competitor-form-panel" id="competitor-form">
              <div className="competitor-section-heading"><div><h2>{editingId ? "Editar competidor" : "Registrar competidor"}</h2><p>Guarda información verificable y útil para el análisis.</p></div>{editingId && <button type="button" className="competitor-cancel" onClick={resetForm}>Cancelar</button>}</div>
              <form className="competitor-form" onSubmit={saveCompetitor}>
                <label htmlFor="competitor-name">Nombre de la empresa *</label>
                <input id="competitor-name" required minLength={1} maxLength={160} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ej. Empresa competidora"/>
                <label htmlFor="competitor-url">Sitio web</label>
                <input id="competitor-url" type="url" maxLength={2048} value={form.websiteUrl} onChange={event => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://empresa.com"/>
                <label htmlFor="competitor-location">Ubicación</label>
                <input id="competitor-location" maxLength={180} value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} placeholder="Ciudad, provincia o país"/>
                <label htmlFor="competitor-description">Descripción</label>
                <textarea id="competitor-description" rows={4} maxLength={1000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Actividad, público objetivo, propuesta de valor…"/>
                <small>El nombre es obligatorio. Los demás campos son opcionales.</small>
                <button type="submit" disabled={saving || !workspaceId || !form.name.trim()}>{saving ? "Guardando…" : editingId ? "Guardar cambios →" : "Registrar competidor →"}</button>
              </form>
            </section>

            <section className="competitor-list-area">
              <div className="competitor-list-heading"><div><h2>Registro de competidores</h2><p>Selecciona hasta dos para comparar sus datos básicos.</p></div><span>{filtered.length} resultado(s)</span></div>
              {loading ? <div className="dashboard-state">Cargando competidores…</div> : filtered.length === 0 ? (
                <div className="dashboard-panel competitor-empty"><span>◇</span><h3>{items.length ? "No hay coincidencias." : "Aún no hay competidores registrados."}</h3><p>{items.length ? "Prueba con otro término de búsqueda." : "Añade la primera empresa para comenzar tu análisis competitivo."}</p></div>
              ) : (
                <div className="competitor-card-list">
                  {filtered.map(item => <article className="dashboard-panel competitor-card" key={item.id}>
                    <div className="competitor-card-main">
                      <div className="competitor-card-mark">{item.name.trim().charAt(0).toUpperCase()}</div>
                      <div className="competitor-card-copy"><h3>{item.name}</h3><p>{item.location || "Ubicación no registrada"}</p>{item.description && <p className="competitor-description">{item.description}</p>}{item.websiteUrl && <a href={item.websiteUrl} target="_blank" rel="noreferrer">{item.websiteUrl.replace(/^https?:\/\//, "")} ↗</a>}</div>
                    </div>
                    <div className="competitor-card-actions">
                      <label className="competitor-compare"><input type="checkbox" checked={selectedForCompare.includes(item.id)} onChange={() => toggleCompare(item.id)}/> Comparar</label>
                      <button type="button" onClick={() => startEdit(item)} disabled={saving}>Editar</button>
                      {archiveId === item.id ? <><button type="button" className="is-danger" onClick={() => void archiveCompetitor(item.id)} disabled={saving}>Confirmar archivo</button><button type="button" onClick={() => setArchiveId("")}>Cancelar</button></> : <button type="button" className="is-danger" onClick={() => setArchiveId(item.id)} disabled={saving}>Archivar</button>}
                    </div>
                  </article>)}
                </div>
              )}
            </section>
          </div>

          {comparison.length > 0 && <section className="dashboard-panel competitor-comparison">
            <div className="competitor-section-heading"><div><h2>Comparación básica</h2><p>{comparison.length === 1 ? "Selecciona un segundo competidor para completar la comparación." : "Comparación descriptiva de la información registrada."}</p></div><button type="button" className="competitor-cancel" onClick={() => setSelectedForCompare([])}>Limpiar selección</button></div>
            <div className="competitor-comparison-table"><div className="competitor-comparison-label">Dato</div>{comparison.map(item => <strong key={item.id}>{item.name}</strong>)}<span>Ubicación</span>{comparison.map(item => <span key={item.id}>{item.location || "No registrada"}</span>)}<span>Sitio web</span>{comparison.map(item => <span key={item.id}>{item.websiteUrl ? <a href={item.websiteUrl} target="_blank" rel="noreferrer">Abrir sitio ↗</a> : "No registrado"}</span>)}<span>Descripción</span>{comparison.map(item => <span key={item.id}>{item.description || "No registrada"}</span>)}</div>
            <p className="competitor-comparison-note">Esta comparación utiliza únicamente los datos guardados. No representa una puntuación, ranking ni evaluación automática.</p>
          </section>}

          <footer className="dashboard-footer">Radar Comercial · Registra fuentes y evidencias antes de convertir observaciones en conclusiones.</footer>
        </div>
      </section>
    </main>
  );
}
