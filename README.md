# Radar Comercial

Plataforma de investigación e inteligencia comercial para ayudar a emprendedores y pequeñas empresas a comprender mercados, comparar competidores, analizar productos y precios, identificar tendencias y documentar oportunidades con fuentes verificables.

> **Nombre del producto:** Radar Comercial  
> **Nombre del repositorio:** Radar-inteligente- (identificador técnico de GitHub)

## Estado del proyecto

**Etapa actual:** fundación del proyecto. El repositorio comienza con documentación y un primer módulo de dominio. Todavía no es una plataforma desplegada ni recopila datos reales de mercado.

## Alcance inicial

1. Investigaciones de mercado por país, ciudad y sector.
2. Registro de competidores y comparación de información pública.
3. Registro y análisis de productos y precios publicados.
4. Seguimiento de tendencias con fecha y fuente.
5. Identificación de oportunidades y riesgos.
6. Informes con metodología, hallazgos, fuentes y fecha de consulta.
7. Historial de investigaciones.

## Principios de desarrollo

- Modularidad: cada módulo mantiene responsabilidades claras.
- Evidencia: los hallazgos deben distinguir datos observados, inferencias y recomendaciones.
- Trazabilidad: registrar fuente, URL y fecha de consulta para cada dato externo.
- Seguridad y privacidad desde el diseño.
- No presentar datos estimados como datos verificados.
- Probar cada módulo antes de integrarlo con los demás.

## Estructura inicial

```text
docs/
  architecture/
  decisions/
src/
  modules/
    research/
      domain/
tests/
  modules/
    research/
```

La estructura crecerá a medida que se implementen módulos reales; no se crearán carpetas vacías solo para aparentar avance.

## Desarrollo local

Requisito: Node.js 20 o superior.

- `npm test`: ejecuta las pruebas automatizadas.
- `npm run check`: comprueba la sintaxis de los archivos JavaScript.

## Límites de la primera entrega

El módulo inicial define y valida investigaciones. Aún no incluye autenticación, base de datos, extracción automática de sitios web, análisis con IA, dashboard ni exportación PDF. Esas capacidades se implementarán después de definir y probar sus contratos y arquitectura.
