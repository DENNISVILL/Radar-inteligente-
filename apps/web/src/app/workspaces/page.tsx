"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Workspace = { id?: string; workspaceId?: string; name?: string; createdAt?: string };
type Member = { id?: string; userId?: string; email?: string; role?: "owner" | "admin" | "analyst" | "viewer"; name?: string };
type Invitation = { id?: string; invitationId?: string; email?: string; role?: string; expiresAt?: string; status?: string };
type ApiEnvelope<T> = { data: T };
const API_URL = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:3000";
const roleLabels: Record<string,string> = { owner:"Propietario", admin:"Administrador", analyst:"Analista", viewer:"Solo lectura" };

async function request<T>(path:string, token:string, init:RequestInit = {}):Promise<T>{
  const response = await fetch(new URL(path,API_URL),{
    ...init, cache:"no-store",
    headers:{Accept:"application/json",Authorization:`Bearer ${token}`,...(init.body?{"Content-Type":"application/json"}:{}),...init.headers}
  });
  const body = await response.json().catch(()=>null) as {message?:string;data?:unknown}|null;
  if(!response.ok) throw new Error(body?.message ?? (response.status===403?"Tu rol no permite realizar esta acción.":response.status===404?"No se encontró el recurso solicitado.":"No fue posible completar la operación."));
  return body as T;
}

export default function WorkspacesPage(){
  const router=useRouter();
  const [token,setToken]=useState("");
  const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
  const [selected,setSelected]=useState("");
  const [members,setMembers]=useState<Member[]>([]);
  const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [newName,setNewName]=useState("");
  const [inviteEmail,setInviteEmail]=useState("");
  const [inviteRole,setInviteRole]=useState("analyst");
  const [inviteToken,setInviteToken]=useState("");

  const selectedWorkspace=workspaces.find(w=>(w.id??w.workspaceId)===selected);
  const loadWorkspaceData=useCallback(async(id:string,accessToken:string)=>{
    setSelected(id);setMembers([]);setInvitations([]);setError("");setNotice("");
    try{
      const [m,i]=await Promise.all([
        request<ApiEnvelope<Member[]>>(`/api/v1/workspaces/${encodeURIComponent(id)}/members`,accessToken),
        request<ApiEnvelope<Invitation[]>>(`/api/v1/workspaces/${encodeURIComponent(id)}/invitations?limit=100`,accessToken)
      ]);
      setMembers(m.data??[]);setInvitations(i.data??[]);
    }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible cargar los miembros.");}
  },[]);

  const load=useCallback(async()=>{
    const supabase=getSupabaseBrowserClient();
    if(!supabase){setError("La autenticación no está configurada. Conecta Supabase para administrar espacios.");setLoading(false);return;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace("/login");return;}
    setToken(session.access_token);
    try{
      const result=await request<ApiEnvelope<Workspace[]>>("/api/v1/workspaces",session.access_token);
      const items=result.data??[];setWorkspaces(items);
      const first=items[0];const id=first?.id??first?.workspaceId;
      if(id) await loadWorkspaceData(id,session.access_token);
    }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible cargar los espacios de trabajo.");}
    finally{setLoading(false);}
  },[loadWorkspaceData,router]);

  useEffect(()=>{void load();},[load]);

  async function createWorkspace(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!newName.trim()||!token)return;
    setSaving(true);setError("");setNotice("");
    try{
      await request("/api/v1/workspaces",token,{method:"POST",body:JSON.stringify({name:newName.trim()})});
      setNewName("");setNotice("Espacio de trabajo creado.");await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible crear el espacio.");}
    finally{setSaving(false);}
  }

  async function createInvitation(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!selected||!token)return;
    setSaving(true);setError("");setNotice("");setInviteToken("");
    try{
      const result=await request<ApiEnvelope<{token?:string}>>(`/api/v1/workspaces/${encodeURIComponent(selected)}/invitations`,token,{method:"POST",body:JSON.stringify({email:inviteEmail.trim(),role:inviteRole})});
      setInviteToken(result.data?.token??"");
      setInviteEmail("");setNotice(result.data?.token?"Invitación creada. Copia el token y compártelo de forma segura: el envío automático por correo no está configurado.":"Invitación creada.");
      await loadWorkspaceData(selected,token);
    }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible crear la invitación.");}
    finally{setSaving(false);}
  }

  async function revokeInvitation(invitation:Invitation){
    const id=invitation.id??invitation.invitationId;if(!id||!selected)return;
    setSaving(true);setError("");setNotice("");
    try{
      await request(`/api/v1/workspaces/${encodeURIComponent(selected)}/invitations/${encodeURIComponent(id)}`,token,{method:"DELETE"});
      setNotice("Invitación revocada.");await loadWorkspaceData(selected,token);
    }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible revocar la invitación.");}
    finally{setSaving(false);}
  }

  async function changeRole(member:Member,role:string){
    const id=member.userId??member.id;if(!id||!selected)return;
    setSaving(true);setError("");setNotice("");
    try{
      await request(`/api/v1/workspaces/${encodeURIComponent(selected)}/members/${encodeURIComponent(id)}`,token,{method:"PATCH",body:JSON.stringify({role})});
      setNotice("Rol actualizado.");await loadWorkspaceData(selected,token);
    }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible actualizar el rol.");}
    finally{setSaving(false);}
  }

  async function removeMember(member:Member){
    const id=member.userId??member.id;if(!id||!selected)return;
    setSaving(true);setError("");setNotice("");
    try{
      await request(`/api/v1/workspaces/${encodeURIComponent(selected)}/members/${encodeURIComponent(id)}`,token,{method:"DELETE"});
      setNotice("Miembro eliminado del espacio.");await loadWorkspaceData(selected,token);
    }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible eliminar al miembro.");}
    finally{setSaving(false);}
  }

  async function signOut(){const supabase=getSupabaseBrowserClient();if(supabase)await supabase.auth.signOut();router.replace("/login");}

  return <main className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <Link className="dashboard-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></Link>
      <p className="dashboard-nav-label">ADMINISTRACIÓN</p>
      <nav className="dashboard-nav" aria-label="Navegación principal">
          <a href="/dashboard"><span>▦</span> Resumen</a>
          <a href="/investigaciones"><span>◎</span> Investigaciones</a>
          <a href="/investigaciones/nueva"><span>＋</span> Crear investigación</a>
          <a href="/competidores"><span>◇</span> Competidores</a>
          <a href="/productos"><span>▤</span> Productos y precios</a>
          <a href="/tendencias"><span>↗</span> Tendencias</a>
          <a href="/oportunidades"><span>◇</span> Oportunidades y riesgos</a>
          <a href="/fuentes"><span>⌁</span> Fuentes y evidencias</a>
          <a href="/informes"><span>▤</span> Informes y PDF</a>
          <a href="/historial"><span>◷</span> Historial y auditoría</a>
          <a className="is-active" href="/workspaces"><span>⌘</span> Espacios y equipo</a>
        </nav>
      <div className="dashboard-sidebar-bottom"><span className="dashboard-avatar">R</span><div><strong>Radar Comercial</strong><small>Administración</small></div><button type="button" onClick={signOut} aria-label="Cerrar sesión">↗</button></div>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-topbar"><span>Panel de control <b>/</b> Espacios y equipo</span><span className="dashboard-live"><i/> Área privada</span></header>
      <div className="dashboard-content workspace-content">
        <div className="dashboard-welcome"><div><p className="dashboard-eyebrow">ORGANIZACIÓN</p><h1>Espacios de trabajo.</h1><p>Administra tus espacios, revisa quién tiene acceso y gestiona invitaciones y roles.</p></div></div>
        {loading&&<div className="dashboard-state" role="status">Cargando espacios y equipo…</div>}
        {error&&<div className="dashboard-state dashboard-state--error" role="alert">{error}</div>}
        {notice&&<div className="dashboard-state" role="status">{notice}</div>}
        {inviteToken&&<div className="workspace-token"><div><strong>Token de invitación</strong><p>Compártelo con la persona invitada. Este valor se muestra una sola vez.</p><code>{inviteToken}</code></div><button type="button" onClick={()=>void navigator.clipboard?.writeText(inviteToken)}>Copiar token</button></div>}
        {!loading&&<>
          <div className="workspace-layout">
            <section className="dashboard-panel workspace-list-panel">
              <div className="dashboard-panel-heading"><div><h2>Tus espacios</h2><p>Selecciona el espacio que deseas administrar.</p></div><span>{workspaces.length} espacios</span></div>
              {workspaces.length===0?<div className="workspace-no-data">Aún no tienes espacios de trabajo.</div>:<div className="workspace-list">{workspaces.map((w,index)=>{const id=w.id??w.workspaceId??"";return <button key={id||index} className={selected===id?"workspace-choice is-selected":"workspace-choice"} type="button" onClick={()=>void loadWorkspaceData(id,token)}><span className="workspace-choice-icon">⌂</span><span><strong>{w.name??"Espacio sin nombre"}</strong><small>{id}</small></span><b>›</b></button>})}</div>}
              <form className="workspace-create-form" onSubmit={createWorkspace}><label htmlFor="workspace-name">Crear un nuevo espacio</label><input id="workspace-name" required maxLength={120} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre del espacio"/><button type="submit" disabled={saving||!newName.trim()}>{saving?"Guardando…":"Crear espacio"}</button></form>
            </section>
            <section className="dashboard-panel workspace-detail-panel">
              <div className="dashboard-panel-heading"><div><h2>{selectedWorkspace?.name??"Equipo del espacio"}</h2><p>Miembros y permisos del espacio seleccionado.</p></div><span>{members.length} miembros</span></div>
              {!selected?<div className="workspace-no-data">Selecciona un espacio para consultar sus miembros e invitaciones.</div>:<>
                <div className="workspace-subheading"><h3>Miembros</h3><span>Los cambios dependen de tu rol y permisos en la API.</span></div>
                {members.length===0?<div className="workspace-no-data">No hay miembros visibles o no tienes permisos para consultarlos.</div>:<div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Persona</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>{members.map((m,index)=>{const id=m.userId??m.id??String(index);return <tr key={id}><td><strong>{m.name??m.email??"Miembro"}</strong><small className="workspace-email">{m.email??""}</small></td><td>{roleLabels[m.role??""]??m.role??"—"}</td><td>{m.role==="owner"?<span className="workspace-owner">No modificable</span>:<div className="workspace-row-actions"><select aria-label={`Cambiar rol de ${m.email??"miembro"}`} value={m.role??"analyst"} disabled={saving} onChange={e=>void changeRole(m,e.target.value)}><option value="admin">Administrador</option><option value="analyst">Analista</option><option value="viewer">Solo lectura</option></select><button type="button" disabled={saving} onClick={()=>void removeMember(m)}>Quitar</button></div>}</td></tr>})}</tbody></table></div>}
                <div className="workspace-subheading workspace-invite-heading"><h3>Invitar a una persona</h3><span>Se requiere un rol autorizado.</span></div>
                <form className="workspace-invite-form" onSubmit={createInvitation}><label htmlFor="invite-email">Correo electrónico</label><input id="invite-email" type="email" required maxLength={254} value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="persona@empresa.com"/><label htmlFor="invite-role">Rol</label><select id="invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="admin">Administrador</option><option value="analyst">Analista</option><option value="viewer">Solo lectura</option></select><button type="submit" disabled={saving}>{saving?"Procesando…":"Crear invitación"}</button></form>
                <div className="workspace-subheading workspace-invite-heading"><h3>Invitaciones pendientes</h3><span>{invitations.length} pendientes</span></div>
                {invitations.length===0?<div className="workspace-no-data">No hay invitaciones pendientes.</div>:<div className="workspace-invites">{invitations.map((inv,index)=>{const id=inv.id??inv.invitationId??String(index);return <div className="workspace-invite-row" key={id}><span><strong>{inv.email??"Correo no disponible"}</strong><small>{roleLabels[inv.role??""]??inv.role??"Invitado"} · {inv.expiresAt?new Date(inv.expiresAt).toLocaleDateString("es-EC"):"Vigencia no disponible"}</small></span><button type="button" disabled={saving} onClick={()=>void revokeInvitation(inv)}>Revocar</button></div>})}</div>}
              </>}
            </section>
          </div>
        </>}
        <footer className="dashboard-footer">Radar Comercial · La API controla los permisos y la seguridad de cada espacio.</footer>
      </div>
    </section>
  </main>;
}
