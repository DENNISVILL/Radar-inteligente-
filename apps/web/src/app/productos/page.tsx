"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Workspace = { id?: string; workspaceId?: string; name?: string };
type Competitor = { id: string; name: string };
type Research = { id: string; title: string };
type Product = {
  id: string; name: string; category?: string | null; description?: string | null;
  productUrl?: string | null; competitorId?: string | null; researchId?: string | null;
  createdAt?: string; updatedAt?: string;
};
type Price = {
  id: string; price: number | string; currency: string; observedOn: string;
  sourceName?: string | null; sourceUrl?: string | null; notes?: string | null;
  createdAt?: string;
};
type Envelope<T> = { data: T };
const API = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(path, API), {
    ...init, cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(body?.message ?? (response.status === 403
    ? "Tu rol no permite realizar esta acción."
    : response.status === 404 ? "No se encontró el registro." : "No fue posible completar la operación."));
  return body as T;
}
const emptyProduct = { name: "", category: "", description: "", productUrl: "", competitorId: "", researchId: "" };
const emptyPrice = { price: "", currency: "USD", observedOn: new Date().toISOString().slice(0, 10), sourceName: "", sourceUrl: "", notes: "" };

export default function ProductsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [researches, setResearches] = useState<Research[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Record<string, Price[]>>({});
  const [form, setForm] = useState(emptyProduct);
  const [priceForm, setPriceForm] = useState(emptyPrice);
  const [editingId, setEditingId] = useState("");
  const [priceProductId, setPriceProductId] = useState("");
  const [historyProductId, setHistoryProductId] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [archiveId, setArchiveId] = useState("");

  const base = workspaceId ? `/api/v1/workspaces/${encodeURIComponent(workspaceId)}` : "";
  async function loadProducts(currentToken = token, currentBase = base) {
    if (!currentToken || !currentBase) return;
    const result = await request<Envelope<Product[]>>(`${currentBase}/products?limit=100`, currentToken);
    setItems(result.data ?? []);
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setError("Conecta Supabase para acceder a tus productos."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;
      setToken(session.access_token);
      try {
        const result = await request<Envelope<Workspace[]>>("/api/v1/workspaces", session.access_token);
        const spaces = result.data ?? [];
        if (!active) return;
        setWorkspaces(spaces);
        setWorkspaceId(spaces[0]?.id ?? spaces[0]?.workspaceId ?? "");
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "No fue posible cargar espacios."); }
      finally { if (active) setLoading(false); }
    }
    void initialize();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let active = true;
    if (!workspaceId || !token) return;
    setLoading(true); setError(""); setItems([]); setCompetitors([]); setResearches([]);
    Promise.all([
      request<Envelope<Product[]>>(`${base}/products?limit=100`, token),
      request<Envelope<Competitor[]>>(`${base}/competitors?limit=100`, token),
      request<Envelope<Research[]>>(`${base}/researches?limit=100`, token),
    ]).then(([products, comps, research]) => {
      if (!active) return;
      setItems(products.data ?? []); setCompetitors(comps.data ?? []); setResearches(research.data ?? []);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "No fue posible cargar el catálogo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId, token, base]);

  const categories = useMemo(() => [...new Set(items.map(item => item.category).filter((x): x is string => Boolean(x)))].sort(), [items]);
  const filtered = useMemo(() => items.filter(item =>
    (categoryFilter === "all" || item.category === categoryFilter) &&
    [item.name, item.category, item.description].join(" ").toLowerCase().includes(search.trim().toLowerCase())
  ), [items, categoryFilter, search]);

  function resetProduct() { setForm(emptyProduct); setEditingId(""); }
  function startEdit(item: Product) {
    setEditingId(item.id);
    setForm({ name: item.name, category: item.category ?? "", description: item.description ?? "",
      productUrl: item.productUrl ?? "", competitorId: item.competitorId ?? "", researchId: item.researchId ?? "" });
    setError(""); setNotice("");
    document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!base || !token) return;
    setSaving(true); setError(""); setNotice("");
    const payload = { name: form.name.trim(), category: form.category.trim() || null,
      description: form.description.trim() || null, productUrl: form.productUrl.trim() || null,
      competitorId: form.competitorId || null, researchId: form.researchId || null };
    try {
      if (editingId) {
        await request(`${base}/products/${encodeURIComponent(editingId)}`, token, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice("Producto o servicio actualizado.");
      } else {
        await request(`${base}/products`, token, { method: "POST", body: JSON.stringify(payload) });
        setNotice("Producto o servicio registrado.");
      }
      resetProduct(); await loadProducts();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar el producto."); }
    finally { setSaving(false); }
  }
  async function archiveProduct(id: string) {
    if (!base || !token) return; setSaving(true); setError(""); setNotice("");
    try {
      await request(`${base}/products/${encodeURIComponent(id)}`, token, { method: "DELETE" });
      setItems(current => current.filter(item => item.id !== id));
      setPrices(current => { const next = { ...current }; delete next[id]; return next; });
      setArchiveId(""); if (editingId === id) resetProduct();
      if (historyProductId === id) setHistoryProductId("");
      if (priceProductId === id) setPriceProductId("");
      setNotice("Producto o servicio archivado.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible archivar."); }
    finally { setSaving(false); }
  }
  async function openHistory(id: string) {
    if (!base || !token) return; setHistoryProductId(id); setError("");
    try {
      const result = await request<Envelope<Price[]>>(`${base}/products/${encodeURIComponent(id)}/prices?limit=100`, token);
      setPrices(current => ({ ...current, [id]: result.data ?? [] }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar precios."); }
  }
  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!base || !token || !priceProductId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await request(`${base}/products/${encodeURIComponent(priceProductId)}/prices`, token, {
        method: "POST", body: JSON.stringify({ price: Number(priceForm.price), currency: priceForm.currency,
          observedOn: priceForm.observedOn, sourceName: priceForm.sourceName.trim() || null,
          sourceUrl: priceForm.sourceUrl.trim() || null, notes: priceForm.notes.trim() || null }),
      });
      setNotice("Observación de precio registrada.");
      setPriceProductId(""); setPriceForm({ ...emptyPrice, observedOn: new Date().toISOString().slice(0, 10) });
      await openHistory(historyProductId || priceProductId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible registrar el precio."); }
    finally { setSaving(false); }
  }
  async function signOut() { const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); router.replace("/login"); }

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></Link>
        <p className="dashboard-nav-label">INVESTIGACIÓN</p>
        <nav className="dashboard-nav" aria-label="Navegación principal">
          <a href="/dashboard"><span>▦</span> Resumen</a>
          <a href="/investigaciones"><span>◎</span> Investigaciones</a>
          <a href="/investigaciones/nueva"><span>＋</span> Crear investigación</a>
          <a href="/competidores"><span>◇</span> Competidores</a>
          <a className="is-active" href="/productos"><span>▤</span> Productos y precios</a>
          <a href="/tendencias"><span>↗</span> Tendencias</a>
          <a href="/oportunidades"><span>◇</span> Oportunidades y riesgos</a>
          <a href="/fuentes"><span>⌁</span> Fuentes y evidencias</a>
          <a href="/informes"><span>▤</span> Informes y PDF</a>
          <a href="/historial"><span>◷</span> Historial y auditoría</a>
          <a href="/workspaces"><span>⌘</span> Espacios y equipo</a>
        </nav>
        <div className="dashboard-sidebar-bottom"><span className="dashboard-avatar">R</span><div><strong>Radar Comercial</strong><small>Productos y precios</small></div><button type="button" onClick={signOut} aria-label="Cerrar sesión">↗</button></div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><span>Panel de control <b>/</b> Inteligencia de mercado <b>/</b> Productos y precios</span><span className="dashboard-live"><i/> Área privada</span></header>
        <div className="dashboard-content product-content">
          <div className="dashboard-welcome"><div><p className="dashboard-eyebrow">CATÁLOGO DE MERCADO</p><h1>Productos y precios.</h1><p>Organiza ofertas de competidores y conserva observaciones de precios con fecha y fuente.</p></div><span className="product-count">{items.length} registrados</span></div>
          {error && <div className="dashboard-state dashboard-state--error" role="alert">{error}</div>}
          {notice && <div className="dashboard-state" role="status">{notice}</div>}
          <section className="dashboard-panel product-toolbar">
            <div><label htmlFor="product-workspace">Espacio de trabajo</label><select id="product-workspace" value={workspaceId} onChange={event => setWorkspaceId(event.target.value)}>{workspaces.map((space,index) => { const id=space.id??space.workspaceId??""; return <option key={id||index} value={id}>{space.name??"Espacio"}</option>; })}</select></div>
            <div><label htmlFor="product-search">Buscar</label><input id="product-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nombre, categoría o descripción…"/></div>
            <div><label htmlFor="product-category">Categoría</label><select id="product-category" value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}><option value="all">Todas</option>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select></div>
          </section>
          <div className="product-layout">
            <section className="dashboard-panel product-form-panel" id="product-form">
              <div className="product-heading"><div><h2>{editingId?"Editar producto o servicio":"Registrar producto o servicio"}</h2><p>Asocia cada registro con un competidor o investigación si corresponde.</p></div>{editingId&&<button type="button" onClick={resetProduct}>Cancelar</button>}</div>
              <form className="product-form" onSubmit={saveProduct}>
                <label htmlFor="product-name">Nombre *</label><input id="product-name" required maxLength={160} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nombre del producto o servicio"/>
                <label htmlFor="product-category-input">Categoría</label><input id="product-category-input" maxLength={120} value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Ej. Alimentos, tecnología, servicios"/>
                <label htmlFor="product-competitor">Competidor</label><select id="product-competitor" value={form.competitorId} onChange={e=>setForm({...form,competitorId:e.target.value})}><option value="">Sin asociar</option>{competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <label htmlFor="product-research">Investigación</label><select id="product-research" value={form.researchId} onChange={e=>setForm({...form,researchId:e.target.value})}><option value="">Sin asociar</option>{researches.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>
                <label htmlFor="product-url">URL del producto</label><input id="product-url" type="url" maxLength={2048} value={form.productUrl} onChange={e=>setForm({...form,productUrl:e.target.value})} placeholder="https://…"/>
                <label htmlFor="product-description">Descripción</label><textarea id="product-description" rows={3} maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Características, presentación o condiciones…"/>
                <button type="submit" disabled={saving||!workspaceId||!form.name.trim()}>{saving?"Guardando…":editingId?"Guardar cambios →":"Registrar producto →"}</button>
              </form>
            </section>
            <section className="product-list-area">
              <div className="product-list-heading"><div><h2>Catálogo registrado</h2><p>{filtered.length} resultado(s)</p></div></div>
              {loading?<div className="dashboard-state">Cargando catálogo…</div>:filtered.length===0?<div className="dashboard-panel product-empty"><h3>{items.length?"No hay coincidencias.":"Todavía no hay productos registrados."}</h3><p>Registra productos o servicios para empezar a guardar y comparar sus precios en el tiempo.</p></div>:<div className="product-card-list">{filtered.map(item=><article className="dashboard-panel product-card" key={item.id}>
                <div className="product-card-top"><div><span className="product-category">{item.category||"Sin categoría"}</span><h3>{item.name}</h3><p>{item.description||"Sin descripción"}</p>{item.productUrl&&<a href={item.productUrl} target="_blank" rel="noreferrer">Abrir producto ↗</a>}</div><div className="product-actions"><button type="button" onClick={()=>startEdit(item)} disabled={saving}>Editar</button><button type="button" onClick={()=>{setPriceProductId(item.id);setPriceForm({...emptyPrice,observedOn:new Date().toISOString().slice(0,10)});}}>Registrar precio</button><button type="button" onClick={()=>void openHistory(item.id)}>Historial</button>{archiveId===item.id?<><button type="button" className="product-danger" onClick={()=>void archiveProduct(item.id)} disabled={saving}>Confirmar</button><button type="button" onClick={()=>setArchiveId("")}>Cancelar</button></>:<button type="button" className="product-danger" onClick={()=>setArchiveId(item.id)} disabled={saving}>Archivar</button>}</div></div>
                {priceProductId===item.id&&<form className="price-form" onSubmit={savePrice}><div className="product-heading"><div><h4>Registrar observación de precio</h4><p>Guarda el valor observado, moneda, fecha y procedencia.</p></div><button type="button" onClick={()=>setPriceProductId("")}>Cerrar</button></div><div className="price-fields"><label>Precio *<input required type="number" min="0" step="0.01" value={priceForm.price} onChange={e=>setPriceForm({...priceForm,price:e.target.value})}/></label><label>Moneda *<select value={priceForm.currency} onChange={e=>setPriceForm({...priceForm,currency:e.target.value})}><option value="USD">USD</option><option value="EUR">EUR</option><option value="COP">COP</option><option value="PEN">PEN</option><option value="MXN">MXN</option><option value="CLP">CLP</option></select></label><label>Fecha observada *<input required type="date" value={priceForm.observedOn} onChange={e=>setPriceForm({...priceForm,observedOn:e.target.value})}/></label><label>Fuente<input maxLength={160} value={priceForm.sourceName} onChange={e=>setPriceForm({...priceForm,sourceName:e.target.value})} placeholder="Tienda, catálogo, proveedor…"/></label><label>URL de la fuente<input type="url" value={priceForm.sourceUrl} onChange={e=>setPriceForm({...priceForm,sourceUrl:e.target.value})} placeholder="https://…"/></label><label>Notas<input maxLength={1000} value={priceForm.notes} onChange={e=>setPriceForm({...priceForm,notes:e.target.value})} placeholder="Presentación, unidad, condiciones…"/></label></div><button type="submit" disabled={saving||!priceForm.price||Number(priceForm.price)<0}>{saving?"Guardando…":"Guardar precio →"}</button></form>}
                {historyProductId===item.id&&<div className="price-history"><div className="product-heading"><div><h4>Historial de precios</h4><p>Observaciones registradas, ordenadas por la fecha informada.</p></div><button type="button" onClick={()=>setHistoryProductId("")}>Cerrar</button></div>{!prices[item.id]?<p>Cargando historial…</p>:prices[item.id].length===0?<p>No existen observaciones de precio.</p>:<div className="price-history-list">{[...prices[item.id]].sort((a,b)=>b.observedOn.localeCompare(a.observedOn)).map(price=><div className="price-history-row" key={price.id}><strong>{new Intl.NumberFormat("es-EC",{style:"currency",currency:price.currency}).format(Number(price.price))}</strong><span>{price.observedOn}</span><span>{price.sourceName||"Fuente no indicada"}</span>{price.sourceUrl&&<a href={price.sourceUrl} target="_blank" rel="noreferrer">Fuente ↗</a>}<small>{price.notes}</small></div>)}</div>}</div>}
              </article>)}</div>}
            </section>
          </div>
          <footer className="dashboard-footer">Radar Comercial · Cada precio debe conservar su fecha, moneda y fuente. No se generan precios estimados.</footer>
        </div>
      </section>
    </main>
  );
}
