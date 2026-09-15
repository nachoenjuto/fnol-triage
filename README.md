# FNOL Triage

Demo autosuficiente (HTML + JavaScript, sin backend) del triaje automático de **primeros avisos de siniestro (FNOL)** en una aseguradora.

**Demo en vivo:** https://nachoenjuto.github.io/fnol-triage/

## Caso de uso

Llegan 40 avisos de siniestro. El sistema:

1. **Despeja automáticamente** la mayoría legítima.
2. **Enruta un 5-10 % a revisión humana**, explicando el motivo.
3. **Deja registro de cada decisión** (exportable a JSON/CSV).

La pantalla no es un expediente: son tres contadores — **despejados**, **en revisión** y **tiempo medio de ciclo** — más el registro de auditoría.

## Cómo funciona

| Capa | Descripción |
|---|---|
| Generador | Crea 40 avisos sintéticos (auto, hogar, salud, comercio). Entre 2 y 4 llevan una anomalía inyectada: póliza no vigente, aviso tardío, importe anómalo, alta siniestralidad, póliza recién contratada o descripción incoherente. |
| Motor de reglas | Reglas deterministas que siempre se ejecutan. Sirven de fallback y de "red de seguridad": si una regla dura salta, el aviso va a revisión aunque la IA lo despeje. |
| IA (opcional) | Llamada directa desde el navegador a **Azure AI Foundry / Azure OpenAI** (`chat/completions`, cabecera `api-key`). El modelo devuelve `{decision, motivo, confianza}` en JSON; la respuesta se valida y, si es inválida o hay error transitorio, se usa el motor de reglas. |
| Registro | Cada decisión se guarda en `localStorage` con aviso, decisión, motivo, origen (reglas / IA), confianza y duración. |

Compatibilidad de modelos: para modelos de razonamiento (`gpt-5*`, `o1`/`o3`/`o4`) no se envían `temperature` ni `max_tokens` (se usa `max_completion_tokens` y `reasoning_effort: low`). Si el modelo rechaza algún parámetro con un 400 «Unsupported parameter», el cliente lo retira y reintenta, recordando el ajuste para el resto del lote.

Reintentos con backoff exponencial (base 2 s, tope 32 s, máx. 5) para 429/5xx; los errores permanentes (400/401/403) abortan el lote.

## Uso

1. Abre la demo (o `index.html` en local).
2. Opcional: pulsa **⚙ Configurar IA** e introduce endpoint, deployment y API key de Azure AI Foundry. La clave se guarda solo en `sessionStorage` y se envía únicamente a tu endpoint de Azure.
3. Pulsa **Procesar 40 avisos**.

Sin clave, la demo funciona igualmente con el motor de reglas (con latencia simulada de 60-220 ms por aviso).

### Endpoint y ruta de API

En **Endpoint** pon la URL base del recurso (`https://<recurso>.openai.azure.com`, `https://<recurso>.cognitiveservices.azure.com` o `https://<recurso>.services.ai.azure.com`) y en **Deployment** el nombre del despliegue. Rutas disponibles:

| Ruta | URL que se construye | api-version |
|---|---|---|
| **v1** (por defecto) | `{endpoint}/openai/v1/chat/completions` | no necesita |
| Clásica | `{endpoint}/openai/deployments/{deployment}/chat/completions` | `2024-10-21` por defecto |
| Foundry Models | `{endpoint}/models/chat/completions` | `2024-05-01-preview` por defecto |

Si pegas una URL completa que ya contenga `chat/completions`, se usa tal cual. Si Azure responde «API version not supported», cambia de ruta.

## Estructura

```
index.html   UI (config, contadores, registro)
app.js       generador, motor de reglas, cliente Azure, registro y render
prompts.js   prompt del sistema para el triaje
styles.css   estilos (claro/oscuro)
```

## Despliegue

GitHub Pages sirve la rama `main` desde la raíz. No hay build.

## Licencia

MIT
