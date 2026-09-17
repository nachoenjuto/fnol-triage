# Triage de mensajes — seguros

Demo autosuficiente (HTML + JavaScript, sin backend, sin build) del **triaje de mensajes de clientes** en una aseguradora: clasificación por ramo, extracción de datos y aplicación de reglas de negocio con IA, con registro de cada decisión.

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

| Paquete | Mensajes | Auto / Hogar / Salud | Revisión esperada |
|---|---|---|---|
| A | 10 | 4 / 3 / 3 | 2 |
| B | 20 | 7 / 7 / 6 | 3 |
| C | 12 | 4 / 4 / 4 | 2 |

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
- **Resultados guardados**: reproduce las fichas de [`data/resultados.js`](data/resultados.js), generadas con IA para los 42 mensajes con el mismo esquema que devuelve el modelo (ramo, indicios, datos extraídos, criterios con evidencia, decisión, motivo, confianza y tokens). Cada mensaje tarda entre 5 y 7 s, con el mismo estado en vivo, pausa y reinicio.
- **Archivo cargado**: con **Reproducir desde archivo** puedes cargar un JSON generado con «Exportar JSON» de un lote real y repetirlo con la misma cadencia.

## Motor local (sin IA)

Sin clave, la demo funciona en modo degradado: ramo por palabras clave, extracción por expresiones regulares y reglas heurísticas. Sirve para ver el flujo; la demo brilla con IA. Si una llamada a la IA falla por un error transitorio o una respuesta no válida, ese mensaje cae al motor local y se marca en el registro.

## Uso

1. Abre la demo.
2. Opcional: ⚙ **Configurar IA** con endpoint, deployment y clave de Azure AI Foundry. Todo se guarda solo en `sessionStorage` (se borra al cerrar la pestaña).
3. Elige un paquete en la barra lateral y, si quieres, edita los prompts.
4. **Procesar paquete**. Puedes **pausar / continuar**; **Reiniciar lote** cancela y vacía el registro.
5. Filtra por ramo o solo a revisar, ordena por columnas, abre la ficha de cualquier fila, exporta a JSON/CSV.

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
index.html        UI: conexión IA, barra lateral, contadores, registro, ficha modal
app.js            motor local, cliente Azure, procesamiento con pausa, registro, render
prompts.js        prompt base + bloques de reglas Auto / Hogar / Salud
data/mensajes.js  tres paquetes de mensajes
data/resultados.js fichas de triaje guardadas para reproducción
styles.css        estilos (claro/oscuro, responsive)
```

## Despliegue

GitHub Pages sirve la rama `main` desde la raíz.

## Licencia

MIT
