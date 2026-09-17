# Arquitectura (C4)

Demo estática servida por GitHub Pages: dos páginas HTML que comparten iconos y datos, sin backend. La única dependencia externa es Azure AI Foundry cuando el usuario configura una clave.

## Nivel 1 · Contexto

```mermaid
C4Context
  title Triage de mensajes — contexto
  Person(usuario, "Usuario de la demo", "Tramitador, responsable de IA o comercial")
  System(demo, "Triage de mensajes + Gobierno de Agentes", "Demo estática HTML/JS")
  System_Ext(foundry, "Azure AI Foundry", "Modelos gpt-5* vía chat/completions o Responses API")
  Rel(usuario, demo, "Procesa paquetes, consulta fichas y gobierna los agentes", "navegador")
  Rel(demo, foundry, "Clasificación, extracción y reglas", "HTTPS, clave en sessionStorage")
```

## Nivel 2 · Contenedores

```mermaid
C4Container
  title Triage de mensajes — contenedores (todo en el navegador)
  Person(usuario, "Usuario de la demo")
  Container_Boundary(pages, "GitHub Pages (rama main)") {
    Container(triage, "Triage · index.html + app.js", "HTML/JS", "Paquetes, prompts editables, motor local o IA, registro de decisiones y ficha")
    Container(gobierno, "Gobierno de Agentes · gobierno.html + gobierno.js", "HTML/JS", "Resumen, trazabilidad, Reasoning & Replay, autonomía, FinOps, histórico")
    Container(icons, "icons.js", "JS", "Iconos Lucide compartidos")
    ContainerDb(datos, "data/", "JS + JSON estáticos", "mensajes.js, resultados.js, gobierno.js, JSON de prueba")
    ContainerDb(session, "sessionStorage", "navegador", "configuración IA, prompts editados, registro del triaje (triage.log)")
  }
  System_Ext(foundry, "Azure AI Foundry")
  Rel(usuario, triage, "usa")
  Rel(usuario, gobierno, "usa")
  Rel(triage, gobierno, "botón «Gobierno de Agentes»")
  Rel(gobierno, triage, "«Volver al triaje»")
  Rel(triage, datos, "lee paquetes y fichas guardadas")
  Rel(gobierno, datos, "lee el dataset de demo / carga JSON")
  Rel(triage, session, "escribe registro y configuración")
  Rel(gobierno, session, "lee triage.log (fuente «Sesión actual»)")
  Rel(triage, icons, "lucide()")
  Rel(gobierno, icons, "lucide()")
  Rel(triage, foundry, "llamadas al modelo", "HTTPS")
```

## Nivel 3 · Componentes del panel de gobierno

```mermaid
flowchart LR
  subgraph fuentes[Fuentes de datos]
    demo[data/gobierno.js · GOBIERNO_DEMO]
    json[Archivo JSON cargado]
    sesion[sessionStorage triage.log]
  end
  demo --> G[(dataset activo G)]
  json --> G
  sesion -->|trazasDesdeSesion| G
  G --> resumen[Resumen · KPI, agentes, alertas, coste vs cap]
  G --> trazas[Trazabilidad · panel fijo + lista filtrable]
  G --> replay[Reasoning & Replay · lista + pasos por agente + diff]
  G --> autonomia[Autonomía · niveles L0–L3, agentes, auditoría]
  G --> guardrails[Guardrails · condiciones, disparos, toggles]
  G --> finops[FinOps · caps, coste por agente, modelos, recomendaciones]
  G --> historico[Histórico · línea de tiempo por tipo de evento]
  resumen -. clic en traza .-> mTraza([Modal · ficha explicada de la traza])
  resumen -. clic en agente .-> mAgente([Modal · ficha del agente])
  autonomia -. clic en agente .-> mAgente
  resumen -. kill switch .-> estado[(sessionStorage gobierno.estados)]
```

Esquema del dataset (`data/gobierno-paquete-A.json`): `version`, `periodo`, `precios{modelo:{in,out}}`, `agentes[]` (con `historial[]`, `modelos[]`, `variables[]`), `niveles[]`, `politicas[]` (con `descripcion`, `severidad`, `disparos_dia[]`, `ultimos[]`), `cambios_autonomia[]`, `caps[]`, `kpis`, `alertas[]`, `modelos[]` (consumo, `coste_por_agente`, `exito`), `trazas[]` (cada una con `motivo` y `spans: [[agente, inicio_ms, duracion_ms, modelo, tok_in, tok_out, tok_reasoning]]`), `razonamiento{trazaId: pasos[]}`, `replays[]`, `diario[[fecha, mensajes, [€ por agente]]]`, `eventos[]`, `recomendaciones[]`.
