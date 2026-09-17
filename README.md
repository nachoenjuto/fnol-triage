# Triage de mensajes — seguros

Demo autosuficiente (HTML + JavaScript, sin backend, sin build) del **triaje de mensajes de clientes** en una aseguradora: clasificación por ramo, extracción de datos y aplicación de reglas de negocio con IA, con trazabilidad de cada decisión y un panel de **Gobierno de Agentes** (trazabilidad, Reasoning & Replay, autonomía y FinOps).

**Demo en vivo:** https://nachoenjuto.github.io/fnol-triage/

## Caso de uso

Llega un paquete de mensajes de clientes (emails, formularios web, chats, transcripciones telefónicas). Para cada mensaje el sistema:

1. **Clasifica el ramo** (Auto, Hogar, Salud).
2. **Extrae los datos** del texto libre (póliza, fecha del hecho, importe, terceros, lesionados, documentación…).
3. **Aplica el bloque de reglas** del ramo y decide: **Aprobado** (`DESPEJADO`, se tramita automáticamente) o **A revisar** (`REVISION`, revisión humana), con el motivo y cada criterio evaluado.
4. **Registra la decisión.**

La pantalla son tres contadores — **aprobados**, **a revisar**, **tiempo medio de ciclo** — más el registro. Al hacer clic en un mensaje se abre su ficha: texto original, datos extraídos y, a la derecha, los criterios que ha aplicado el modelo.

## Paquetes de mensajes

Tres paquetes fijos y mixtos en [`data/mensajes.js`](data/mensajes.js). Cada mensaje lleva un `esperado` (ramo y si debería ir a revisión) que **no se envía a la IA**; solo sirve para contrastar en la ficha y en la columna Ramo (✔/✖).

| Paquete | Mensajes | Auto / Hogar / Salud | A revisar (esperado) |
|---|---|---|---|
| A | 13 | 5 / 4 / 4 | 3 |
| B | 23 | 8 / 8 / 7 | 4 |
| C | 15 | 5 / 5 / 5 | 3 |

Canales: email, formulario web, chat, teléfono y WhatsApp (tres mensajes por paquete, con el tono informal del canal). Cada canal tiene su icono en la lista lateral y en la ficha.

## Prompts y reglas

En [`prompts.js`](prompts.js): un **prompt base** (tarea, extracción, formato JSON) y **tres bloques de reglas** de negocio de seguros (Auto, Hogar, Salud: vigencia, plazo de comunicación del art. 16 LCS, conductor declarado, alcohol, lesionados, daños por agua súbitos vs. filtraciones, robo con fuerza y límites de joyas, carencias, preexistencias, autorización previa, cuadro médico, mutua laboral…). Los cuatro textos se editan en la barra lateral y la llamada a la API usa siempre el texto vigente.

El modelo devuelve:

```json
{ "ramo": "…", "datos_extraidos": { … }, "criterios": [ { "regla": "A5", "descripcion": "…", "resultado": "cumple|incumple|no_aplica", "evidencia": "…" } ], "decision": "DESPEJADO|REVISION", "motivo": "…", "confianza": 0.9 }
```

### Estrategia de llamadas

Seleccionable en la barra lateral:

- **1 paso** (por defecto): una única llamada con el prompt base y los tres bloques de reglas.
- **2 pasos**: una llamada corta clasifica el ramo y devuelve sus indicios; la segunda extrae datos y aplica **solo el bloque de reglas de ese ramo**. Menos tokens de entrada, pero dos llamadas y dos razonamientos por mensaje. Si el paso 2 discrepa del ramo del paso 1, el mensaje va a revisión.

La ficha de cada mensaje muestra los tokens de entrada, salida y razonamiento por paso para comparar.

## Reproducción sin llamar al modelo

En la barra lateral, **Motor de triaje** permite elegir:

- **Automático**: IA si hay clave; si no, motor local.
- **Resultados guardados**: reproduce las fichas de [`data/resultados.js`](data/resultados.js), generadas con IA para los 51 mensajes con el mismo esquema que devuelve el modelo (ramo, indicios, datos extraídos, criterios con evidencia, decisión, motivo, confianza y tokens). Cada mensaje tarda entre 5 y 7 s, con el mismo estado en vivo, pausa y reinicio.
- **Archivo cargado**: con **Reproducir desde archivo** puedes cargar un JSON generado con «Exportar JSON» de un lote real y repetirlo con la misma cadencia.

## Motor local (sin IA)

Sin clave, la demo funciona en modo degradado: ramo por palabras clave, extracción por expresiones regulares y reglas heurísticas. Sirve para ver el flujo; la demo brilla con IA. Si una llamada a la IA falla por un error transitorio o una respuesta no válida, ese mensaje cae al motor local y se marca en el registro.

## Uso

1. Abre la demo.
2. Opcional: ⚙ **Configurar IA** con endpoint, deployment y clave de Azure AI Foundry. Todo se guarda solo en `sessionStorage` (se borra al cerrar la pestaña).
3. Elige un paquete en la barra lateral y, si quieres, edita los prompts.
4. **Procesar paquete**. Puedes **pausar / continuar**; **Reiniciar lote** cancela y vacía el registro.
5. Filtra por ramo o solo a revisar, ordena por columnas, abre la ficha de cualquier fila, exporta a JSON/CSV.
6. **Gobierno de Agentes** (botón de la cabecera) abre el panel de gobernanza de los agentes; con «Sesión actual» enseña las trazas del lote que acabas de procesar.

### Endpoint y ruta de API

Pega la URL base del recurso o la URL completa del portal de Foundry (p. ej. `https://<recurso>.services.ai.azure.com/openai/v1/responses`); se extrae el origen y se selecciona la ruta automáticamente.

| Ruta | URL que se construye | api-version |
|---|---|---|
| v1 | `{origen}/openai/v1/chat/completions` | no necesita |
| Responses API | `{origen}/openai/v1/responses` | no necesita |
| Clásica | `{origen}/openai/deployments/{deployment}/chat/completions` | `2024-10-21` |
| Foundry Models | `{origen}/models/chat/completions` | `2024-05-01-preview` |

Compatibilidad: para modelos de razonamiento (`gpt-5*`, `o*`) no se envían `temperature` ni `max_tokens`; cualquier parámetro que el modelo rechace con 400 se retira y se reintenta. Reintentos con backoff exponencial (base 2 s, tope 32 s, máx. 5) para 429/5xx; errores permanentes (400/401/403) abortan el lote.

## Estructura

```
index.html        UI del triaje: conexión IA, barra lateral, contadores, registro, ficha modal
app.js            motor local, cliente Azure, procesamiento con pausa, registro, render
prompts.js        prompt base + bloques de reglas Auto / Hogar / Salud
icons.js          iconos Lucide compartidos (lucide(name) + hidratación de [data-lucide])
styles.css        estilos del triaje (claro/oscuro, responsive)
gobierno.html     panel «Gobierno de Agentes» (seis pestañas)
gobierno.js       render del panel: fuentes de datos, trazas, replay, gráficos SVG
gobierno.css      estilos del panel (mismos tokens que styles.css)
data/mensajes.js  tres paquetes de mensajes
data/resultados.js fichas de triaje guardadas para reproducción
data/gobierno.js  dataset de demostración del panel (Paquete A + 14 días)
data/gobierno-paquete-A.json      el mismo dataset, para «Cargar JSON» en el panel
data/triage-registro-paquete-A.json  13 fichas del Paquete A en formato «Exportar JSON», para «Reproducir desde archivo»
_docs/            arquitectura (C4 en Mermaid)
```

## Gobierno de Agentes

`gobierno.html` es el panel de control agéntico del triaje: gobernanza con trazabilidad y observabilidad de los cuatro agentes (Multicanalidad, Clasificación por ramo, Extracción de datos, Reglas de negocio). Seis pestañas:

| Pestaña | Qué muestra |
|---|---|
| **Resumen** | KPI (mensajes, autonomía efectiva, escalados, overrides, coste vs cap mensual, alertas), tarjetas de agentes (modelo, prompt, nivel de autonomía, estado, coste del día vs cap, **kill switch** funcional), coste diario frente al cap, alertas activas y últimas trazas; clic en una traza abre su **ficha explicada** (qué llegó, qué hizo cada agente, decisión, coste) |
| **Trazabilidad** | panel de detalle **fijo bajo las pestañas** (waterfall de spans por agente, guardrail disparado, override humano) que no se oculta al recorrer la lista; lista de trazas filtrable por agente, canal, decisión y resultado; «Ver razonamiento» y «Replay» abren Reasoning & Replay con esa traza |
| **Reasoning & Replay** | la misma lista de trazas (colapsable, con filtros) y, para la seleccionada, el razonamiento estructurado por agente (entrada → pasos → salida) y el replay idéntico o what-if (otro modelo o versión de prompt) con diff de decisión, coste y latencia; histórico de replays |
| **Autonomía** | niveles L0 Manual · L1 Asistido · L2 Supervisado · L3 Autónomo coloreados de rojo a verde, tarjetas de agentes con umbrales y tasas; clic en un agente abre su **ficha** (histórico de autonomía, cambios de modelo y prompt, comportamiento por modelo, variables que le afectan); auditoría de cambios de nivel |
| **Guardrails** | condiciones que limitan la autonomía (G-01…G-09): agente, condición, acción, severidad, disparos por día y toggle activo/inactivo; últimos disparos enlazados a su traza. Cualquier referencia a un guardrail o cap (G-04, CAP-03) en el panel muestra su descripción al pasar el ratón |
| **FinOps** | caps de consumo (global, por agente, por traza) con consumo y acción al superar, coste diario por agente, tokens por agente, sección de **modelos** (proveedor, precio, agentes que lo usan, llamadas, tokens, coste, latencia y éxito: JSON válido, sin reintento, estable en replay, precisión) con coste por modelo × agente y tokens por modelo; las leyendas de los gráficos activan y desactivan series; recomendaciones de ahorro |
| **Histórico** | línea de tiempo de alertas, políticas, replays, overrides, despliegues, incidentes y operaciones (kill switch, guardrails) |

Fuentes de datos (selector de la cabecera):

- **Demo**: `data/gobierno.js`, datos inventados coherentes con los 13 mensajes del Paquete A (mismos ids, ramo, decisión, confianza y tokens que `data/resultados.js`) más 14 días de histórico.
- **Sesión actual**: convierte el registro del triaje de esta pestaña (`sessionStorage`) en trazas reales: tokens y pasos → spans, ciclo, decisión, confianza, fallback como incidencia y coste según la tabla de precios por modelo. Histórico, caps y guardrails siguen siendo de demostración.
- **Archivo JSON**: «Cargar JSON» con el esquema de `data/gobierno-paquete-A.json` (`agentes[]` con `historial`, `modelos` y `variables`; `trazas[]` con `spans` y `motivo`; y opcionalmente `caps`, `politicas` con `descripcion`, `severidad`, `disparos_dia` y `ultimos`, `razonamiento`, `replays`, `diario`, `eventos`, `modelos`…); las secciones ausentes se toman de la demo. «Exportar trazas» descarga el dataset activo con ese mismo esquema.

Todos los iconos de la web (triaje y panel) son [Lucide](https://lucide.dev) (licencia ISC), inline desde `icons.js`.

## Despliegue

GitHub Pages sirve la rama `main` desde la raíz.

## Licencia

MIT
