"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Workspace = { id?: string; workspaceId?: string; name?: string };
type Research = { id?: string; title?: string; country?: string; city?: string | null; sector?: string; status?: "draft" | "in_progress" | "completed"; updatedAt?: string; createdAt?: string };

const API_URL = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:3000";

async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(new URL(path, API_URL), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? (response.status === 403 ? "No tienes permiso para consultar este espacio." : "No fue posible cargar la información. Comprueba que la API esté disponible."));
  }
  return response.json() as Promise<T>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [researches, setResearches] = useState<Research[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (active) { setError("La autenticación todavía no está configurada. Conecta el proyecto Supabase para acceder al dashboard."); setLoading(false); }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (active) setEmail(session.user.email ?? "");
      try {
        const result = await apiGet<{ data: Workspace[] }>("/api/v1/workspaces", session.access_token);
        const first = result.data?.[0] ?? null;
        if (!active) return;
        setWorkspace(first);
        if (!first) {
          setNotice("Todavía no tienes un espacio de trabajo. La creación y administración se habilitarán en la siguiente fase.");
          setLoading(false);
          return;
        }
        const workspaceId = first.id ?? first.workspaceId;
        if (!workspaceId) {
          setNotice("La API devolvió un espacio de trabajo sin identificador reconocible. Revisa el contrato de identidad antes de continuar.");
          setLoading(false);
          return;
        }
        const list = await apiGet<{ data: Research[] }>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/researches?limit=10`, session.access_token);
        if (active) setResearches(list.data ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Ocurrió un error al cargar el dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name || name.length > 120) {
      setError("El nombre del espacio debe tener entre 1 y 120 caracteres.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("La autenticación todavía no está configurada.");
      return;
    }

    setCreatingWorkspace(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const response = await fetch(new URL("/api/v1/workspaces", API_URL), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json().catch(() => null) as { data?: Workspace; message?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.message ?? "No fue posible crear el espacio de trabajo.");
      }
      setWorkspace(payload.data);
      setWorkspaceName("");
      setNotice("Espacio de trabajo creado correctamente. Ya puedes comenzar a organizar tus investigaciones.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocurrió un error al crear el espacio.");
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  const count = (status: Research["status"]) => researches.filter((item) => item.status === status).length;
  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></Link>
        <p className="dashboard-nav-label">ESPACIO DE TRABAJO</p>
        <nav className="dashboard-nav" aria-label="Navegación principal">
          <a className="is-active" href="/dashboard"><span>▦</span> Resumen</a>
          <a href="/investigaciones"><span>◎</span> Investigaciones</a>
          <a href="/investigaciones/nueva"><span>＋</span> Crear investigación</a>
          <a href="/competidores"><span>◇</span> Competidores</a>
          <a href="/productos"><span>▤</span> Productos y precios</a>
          <a href="/tendencias"><span>↗</span> Tendencias</a>
          <a href="/oportunidades"><span>◇</span> Oportunidades y riesgos</a>
          <a href="/fuentes"><span>⌁</span> Fuentes y evidencias</a>
          <a href="/informes"><span>▤</span> Informes y PDF</a>
          <a href="/historial"><span>◷</span> Historial y auditoría</a>
          <a href="/workspaces"><span>⌘</span> Espacios y equipo</a>
        </nav>
        <div className="dashboard-sidebar-bottom">
          <span className="dashboard-avatar">{email ? email.slice(0,1).toUpperCase() : "U"}</span>
          <div><strong>{email || "Cuenta"}</strong><small>Sesión activa</small></div>
          <button type="button" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">↗</button>
        </div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><span>Panel de control <b>/</b> Resumen</span><span className="dashboard-live"><i/> Área privada</span></header>
        <div className="dashboard-content">
          <div className="dashboard-welcome">
            <div><p className="dashboard-eyebrow">RADAR COMERCIAL</p><h1>Tu panorama comercial.</h1><p>Organiza investigaciones, sigue movimientos del mercado y reúne información para decidir con criterio.</p></div>
            <Link className="dashboard-primary" href="/dashboard">Explorar panel <span>→</span></Link>
          </div>
          {loading && <div className="dashboard-state" role="status">Cargando tu información…</div>}
          {error && <div className="dashboard-state dashboard-state--error" role="alert">{error}</div>}
          {!loading && !error && <>
            {notice && <div className="dashboard-state" role="status">{notice}</div>}
            {!workspace && <form className="dashboard-state" onSubmit={createWorkspace}>
              <strong>Crear tu espacio de trabajo</strong>
              <p>El espacio es el lugar donde se guardarán tus investigaciones y donde podrás incorporar a tu equipo.</p>
              <label htmlFor="workspace-name">Nombre del espacio</label>
              <input id="workspace-name" name="workspaceName" type="text" maxLength={120} required value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Ej. Mi empresa" />
              <button type="submit" disabled={creatingWorkspace}>{creatingWorkspace ? "Creando…" : "Crear espacio"}</button>
            </form>}
            <div className="dashboard-section-heading"><div><h2>Resumen de actividad</h2><p>Datos del espacio de trabajo seleccionado.</p></div><span>{workspace?.name ?? "Sin espacio de trabajo"}</span></div>
            <div className="dashboard-metrics">
              <article><span className="metric-icon">⌕</span><small>Investigaciones visibles</small><strong>{researches.length}</strong><em>Últimos 10 registros</em></article>
              <article><span className="metric-icon metric-icon--teal">◷</span><small>En progreso</small><strong>{count("in_progress")}</strong><em>Seguimiento activo</em></article>
              <article><span className="metric-icon metric-icon--gold">✓</span><small>Completadas</small><strong>{count("completed")}</strong><em>Con estado finalizado</em></article>
              <article><span className="metric-icon metric-icon--grey">▤</span><small>Borradores</small><strong>{count("draft")}</strong><em>Pendientes de avanzar</em></article>
            </div>
            <section className="dashboard-panel" id="investigaciones">
              <div className="dashboard-panel-heading"><div><h2>Investigaciones recientes</h2><p>Las últimas investigaciones registradas en tu espacio.</p></div><span>{researches.length} registros</span></div>
              {researches.length === 0 ? <div className="dashboard-empty"><span>⌕</span><h3>Tu espacio está listo para empezar</h3><p>Cuando registres una investigación, aparecerá aquí con su país, sector y estado.</p><button type="button" disabled>Crear investigación · Próxima fase</button></div> :
                <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Investigación</th><th>Ubicación</th><th>Sector</th><th>Estado</th></tr></thead><tbody>{researches.map((item, index) => <tr key={item.id ?? index}><td><strong>{item.title ?? "Investigación sin título"}</strong></td><td>{[item.city, item.country].filter(Boolean).join(", ") || "—"}</td><td>{item.sector ?? "—"}</td><td><span className={`research-status research-status--${item.status ?? "draft"}`}>{item.status === "completed" ? "Completada" : item.status === "in_progress" ? "En progreso" : "Borrador"}</span></td></tr>)}</tbody></table></div>}
            </section>
            <section className="dashboard-panel dashboard-activity" id="actividad"><div className="dashboard-panel-heading"><div><h2>Actividad reciente</h2><p>Resumen de los movimientos en el espacio.</p></div></div><div className="dashboard-activity-empty">La actividad detallada se incorporará cuando se conecte el módulo de historial y auditoría.</div></section>
          </>}
          <footer className="dashboard-footer">Radar Comercial · Información organizada para decisiones con más criterio.</footer>
        </div>
      </section>
    </main>
  );
}
