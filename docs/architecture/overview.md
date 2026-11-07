# Arquitectura inicial — Radar Comercial

## 1. Objetivo

Construir una aplicación de inteligencia comercial que convierta información pública y aportaciones del usuario en investigaciones trazables. Cada resultado debe conservar su contexto: qué se observó, dónde, cuándo y con qué nivel de certeza.

## 2. Estilo arquitectónico

Se adopta provisionalmente un **monolito modular**. Una sola aplicación desplegable al inicio, organizada en módulos con límites explícitos. No se introducirán microservicios hasta que exista una necesidad operativa demostrable.

Cada módulo deberá separar, cuando corresponda:

- **domain:** entidades, reglas e invariantes del negocio.
- **application:** casos de uso y coordinación.
- **infrastructure:** persistencia e integraciones externas.
- **presentation:** interfaz o controladores, sin reglas de negocio.

Los módulos no deben importar implementaciones internas de otros módulos. La comunicación entre ellos se realizará mediante contratos públicos.

## 3. Módulos previstos

| Módulo | Responsabilidad |
|---|---|
| identity | Autenticación, sesiones y recuperación de acceso. |
| users | Perfil, preferencias y administración de usuarios. |
| dashboard | Resumen de actividad y métricas. |
| research | Creación, seguimiento y consulta de investigaciones. |
| competitors | Registro y comparación de competidores. |
| products-pricing | Productos, precios, moneda, unidad y observaciones. |
| data-sources | Fuentes, URL, fecha de consulta y confiabilidad. |
| data-collection | Captura de información permitida desde fuentes públicas. |
| trends | Evolución temporal y señales de mercado. |
| analysis | Análisis y separación entre hechos e inferencias. |
| opportunities | Oportunidades, riesgos y justificación. |
| reports | Composición de informes y conclusiones. |
| pdf-export | Exportación de informes a PDF. |
| history | Historial y versiones de investigaciones. |
| audit | Registro de acciones relevantes. |

## 4. Flujo principal previsto

1. El usuario crea una investigación y define ubicación, sector y objetivo.
2. Se incorporan fuentes y observaciones, manuales o mediante integraciones permitidas.
3. Cada observación conserva fuente, URL, fecha de consulta y unidad/moneda cuando aplique.
4. El análisis clasifica hallazgos como observados, calculados o inferidos.
5. El módulo de oportunidades presenta hipótesis justificadas, no garantías.
6. El informe reúne metodología, hallazgos, limitaciones, fuentes y fecha.
7. La investigación queda disponible en el historial.

## 5. Reglas de calidad de datos

- No inventar precios, competidores, tendencias ni fuentes.
- Diferenciar precio publicado, precio promocional y precio observado por el usuario.
- Guardar moneda y unidad junto al valor numérico.
- Registrar fecha de consulta y, cuando esté disponible, fecha de publicación.
- Si una fuente no puede verificarse, marcar el dato como pendiente o no verificado.
- Toda conclusión debe poder rastrearse a observaciones o declarar explícitamente que es una hipótesis.

## 6. Seguridad y cumplimiento

La implementación deberá contemplar control de acceso por usuario/espacio de trabajo, validación de entradas, gestión segura de secretos, registros de auditoría y minimización de datos personales. Antes de recopilar datos de un sitio se revisarán sus condiciones de uso, mecanismos de acceso y normativa aplicable.

## 7. Decisiones pendientes

No se fija todavía proveedor de base de datos, autenticación, hosting, proveedor de IA ni herramienta de extracción. Se documentarán en decisiones de arquitectura después de comparar coste, mantenimiento, seguridad, límites y adecuación al mercado inicial.

## 8. Secuencia de implementación

1. Fundaciones y reglas de dominio.
2. Persistencia y autenticación.
3. Casos de uso de investigación.
4. Fuentes y observaciones.
5. Competidores y productos/precios.
6. Tendencias y análisis.
7. Oportunidades e informes.
8. Dashboard, historial, exportación y endurecimiento de seguridad.

Cada etapa requiere pruebas y criterios de aceptación antes de avanzar.