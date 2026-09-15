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

Reintentos con backoff exponencial (base 2 s, tope 32 s, máx. 5) para 429/5xx; los errores permanentes (400/401/403) abortan el lote.

## Uso

1. Abre la demo (o `index.html` en local).
2. Opcional: pulsa **⚙ Configurar IA** e introduce endpoint, deployment y API key de Azure AI Foundry. La clave se guarda solo en `sessionStorage` y se envía únicamente a tu endpoint de Azure.
3. Pulsa **Procesar 40 avisos**.

Sin clave, la demo funciona igualmente con el motor de reglas (con latencia simulada de 60-220 ms por aviso).

### Formatos de endpoint aceptados

- Recurso Azure OpenAI: `https://<recurso>.openai.azure.com` + nombre del deployment.
- Recurso Foundry (Models as a Service): `https://<recurso>.services.ai.azure.com` + nombre del modelo.
- URL completa de `chat/completions` (se usa tal cual).

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
