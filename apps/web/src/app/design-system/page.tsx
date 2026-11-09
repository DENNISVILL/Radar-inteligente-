import { Badge, Button, Card, PageHeader, TextField } from "@/components";
export default function DesignSystemPage() {
  return (
    <main className="rc-design-preview">
      <PageHeader
        eyebrow="Sistema visual · Radar Comercial"
        title="Componentes base"
        description="Previsualización interna de los componentes reutilizables y sus estados. Esta ruta es una herramienta de desarrollo, no la landing pública."
        actions={<Button variant="outline">Acción secundaria</Button>}
      />
      <Card title="Botones" description="Jerarquía de acciones y tamaños consistentes.">
        <div className="rc-design-preview__row">
          <Button>Acción principal</Button>
          <Button variant="secondary">Secundaria</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Discreta</Button>
          <Button variant="danger">Eliminar</Button>
          <Button size="sm">Pequeño</Button>
          <Button size="lg">Grande</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
      </Card>
      <div className="rc-design-preview__grid">
        <Card title="Estados" description="Estados semánticos sin depender solo del color.">
          <div className="rc-design-preview__row">
            <Badge>Sin iniciar</Badge>
            <Badge tone="info">En progreso</Badge>
            <Badge tone="success">Completado</Badge>
            <Badge tone="warning">Revisión</Badge>
            <Badge tone="danger">Error</Badge>
          </div>
        </Card>
        <Card title="Campos" description="Etiqueta, ayuda y validación accesible.">
          <TextField label="Nombre de la investigación" placeholder="Ej. Mercado de cafeterías" hint="Usa un nombre fácil de reconocer." />
          <div style={{ height: 14 }} />
          <TextField label="URL de referencia" placeholder="https://" error="Ingresa una URL válida." />
        </Card>
      </div>
      <Card title="Tarjeta de contenido" description="Contenedor base para resúmenes, tablas y paneles.">
        Los componentes comparten tokens de color, espaciado, bordes y estados de foco.
      </Card>
    </main>
  );
}
