const capabilities = [
  ["01", "Investiga tu mercado", "Organiza investigaciones por sector y ubicación para entender el contexto en el que compite tu negocio.", "◎"],
  ["02", "Compara competidores", "Registra empresas, productos y precios en un mismo espacio para identificar diferencias relevantes.", "⌁"],
  ["03", "Documenta evidencias", "Conserva fuentes, enlaces, fechas y observaciones para respaldar cada hallazgo.", "▤"],
  ["04", "Detecta oportunidades", "Reúne tendencias, señales, oportunidades y riesgos sin perder de vista su evidencia.", "↗"],
];
const steps = [
  ["01", "Define el objetivo", "Delimita el mercado, la ubicación y la pregunta comercial que necesitas responder."],
  ["02", "Organiza la información", "Registra competidores, productos, precios y fuentes en una estructura común."],
  ["03", "Analiza y decide", "Consulta hallazgos e informes para tomar decisiones con más contexto."],
];
export default function HomePage() {
 return <main className="landing">
  <header className="landing-header"><a className="brand" href="#inicio"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></a>
   <nav className="landing-nav" aria-label="Navegación principal"><a href="#capacidades">Capacidades</a><a href="#metodo">Cómo funciona</a><a href="#criterio">Nuestro enfoque</a></nav>
   <a className="header-access" href="#acceso">Acceso a la plataforma <span>↗</span></a>
  </header>
  <section className="hero" id="inicio"><div className="hero-copy"><div className="eyebrow"><span/> INTELIGENCIA COMERCIAL PARA NEGOCIOS</div>
   <h1>Entiende tu mercado.<br/><em>Decide con criterio.</em></h1>
   <p className="hero-description">Organiza información de tu entorno comercial, compara competidores y convierte datos dispersos en una visión más clara para tu negocio.</p>
   <div className="hero-actions"><a className="button-primary" href="#capacidades">Conoce la plataforma <b>→</b></a><a className="button-text" href="#metodo">Descubre cómo funciona <b>↓</b></a></div>
   <div className="hero-note"><span/> Información organizada. Evidencia trazable. Decisiones fundamentadas.</div>
  </div>
  <div className="hero-visual" aria-label="Vista conceptual de un panel de análisis comercial"><div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
   <div className="visual-card"><div className="visual-topline"><i/> RADAR / RESUMEN</div><h2>Panorama comercial</h2><p>Vista conceptual de investigación</p>
    <div className="visual-metrics"><div><small>Mercado</small><strong>En análisis</strong></div><div><small>Fuentes</small><strong>Organizadas</strong></div></div>
    <div className="visual-chart"><div className="chart-label"><span>Señales del mercado</span><small>REFERENCIAL</small></div><div className="chart-bars">{Array.from({length:12},(_,i)=><i key={i} style={{height:(27+i*5+(i%3)*4)+"%"}}/>)}</div><div className="chart-axis"><span>Inicio</span><span>Seguimiento</span><span>Actualidad</span></div></div>
    <div className="visual-footer"><b>✓</b> Evidencias y fuentes en un solo lugar</div>
   </div>
   <div className="floating-tag tag-top"><span>⌕</span><div><strong>Mercado</strong><small>Contexto organizado</small></div></div>
   <div className="floating-tag tag-bottom"><span>↗</span><div><strong>Oportunidades</strong><small>Hallazgos por revisar</small></div></div>
   <div className="visual-caption">Una visión más ordenada de tu entorno comercial</div>
  </div></section>
  <section className="trust-strip" id="criterio">{[["01 / CLARIDAD","Información estructurada"],["02 / CONTEXTO","Comparaciones útiles"],["03 / RESPALDO","Evidencia consultable"],["04 / DECISIÓN","Mejor criterio comercial"]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</section>
  <section className="capabilities section-wrap" id="capacidades"><div className="section-heading"><div><p className="section-kicker">QUÉ PUEDES ORGANIZAR</p><h2>Todo el contexto comercial,<br/><em>en un mismo lugar.</em></h2></div><p>Una estructura de trabajo para pasar de información dispersa a conocimiento que puedas consultar, comparar y actualizar.</p></div>
   <div className="capability-grid">{capabilities.map(([n,t,d,ic])=><article className="capability-card" key={n}><div className="capability-top"><span>{ic}</span><small>{n}</small></div><h3>{t}</h3><p>{d}</p><i/></article>)}</div>
  </section>
  <section className="method-section" id="metodo"><div className="method-inner"><div className="method-heading"><p className="section-kicker">UN PROCESO ORDENADO</p><h2>De la pregunta<br/>a una decisión <em>mejor informada.</em></h2><p>Que el análisis no dependa de archivos sueltos ni de información difícil de rastrear.</p></div>
   <div className="steps-list">{steps.map(([n,t,d])=><article key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div><b>↗</b></article>)}</div>
  </div></section>
  <section className="access-section section-wrap" id="acceso"><div className="access-panel"><div><p className="section-kicker">RADAR COMERCIAL</p><h2>La información correcta<br/>empieza con <em>orden.</em></h2><p>Estamos construyendo una plataforma para que emprendedores y pequeñas empresas organicen su investigación comercial con mayor claridad.</p></div><div className="access-status"><span/> <strong>Plataforma en desarrollo</strong><small>El acceso de usuarios estará disponible cuando se complete la etapa de autenticación.</small></div></div></section>
  <footer className="landing-footer"><a className="brand" href="#inicio"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">radar<span>comercial</span></span></a><p>Información comercial organizada para tomar decisiones con más criterio.</p><small>© {new Date().getFullYear()} Radar Comercial</small></footer>
 </main>;
}