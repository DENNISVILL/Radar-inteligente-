# Sistema visual y componentes base

## Identidad
- Azul profundo: estructura, navegación y acciones principales.
- Turquesa: acento, foco y acciones secundarias.
- Grises y fondos claros: lectura, superficies y separación visual.
- Tipografía de sistema para evitar descargas externas y reducir dependencias.

## Tokens
Los tokens CSS viven en `src/app/globals.css` con prefijo `--rc-`: colores, radios, sombras y tipografía.

## Componentes entregados
- `Button`: primary, secondary, outline, ghost y danger; tamaños sm/md/lg; estados disabled y foco.
- `Card`: contenedor con título, descripción, acción y densidad de padding.
- `Badge`: estados neutral, info, success, warning y danger.
- `TextField`: etiqueta, hint, error, asociación accesible y estado inválido.
- `PageHeader`: encabezado de página con eyebrow, título, descripción y acciones.

## Criterios
- Componentes tipados y reutilizables; sin dependencia de librerías UI externas.
- Foco visible por teclado y contraste semántico.
- Diseño responsive con adaptación de encabezados y grillas.
- La ruta `/design-system` permite revisar los componentes durante el desarrollo.

## Validación
La finalización de esta tarea requiere typecheck y build de producción aprobados en GitHub Actions.
