/* Triage de mensajes — app autosuficiente (HTML + JS), estado solo de sesión.
 * Flujo: elegir paquete → por cada mensaje: clasificar ramo + extraer datos +
 * aplicar reglas (IA o motor local) → registrar decisión → contadores.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constantes
  // ---------------------------------------------------------------------------
  const SS = {
    cfg: 'triage.cfg',
    prompts: 'triage.prompts',
    paquete: 'triage.paquete',
    log: 'triage.log',
  };
  const DECISION = { CLEARED: 'DESPEJADO', REVIEW: 'REVISION' };
  const RAMOS = ['Auto', 'Hogar', 'Salud'];

  // Reintentos para errores transitorios: base 2s, tope 32s, máx 5
  const RETRY = { base: 2000, cap: 32000, max: 5, transient: [408, 429, 500, 502, 503, 504] };
  const REQUEST_TIMEOUT_MS = 45000;
  const NETWORK_RETRIES = 2; // «Failed to fetch» suele ser CORS o URL errónea: no insistir 5 veces
  const MAX_OUTPUT_TOKENS = 2500; // el JSON de salida es largo y los modelos de razonamiento gastan tokens pensando

  // Latencia simulada del motor local (consulta de póliza / integración)
  const LOCAL_LATENCY_MS = [80, 250];

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const rnd = (min, max) => Math.random() * (max - min) + min;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isoDate = (d) => d.toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const fmtEur = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
  const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const ssGet = (k, fallback) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // ---------------------------------------------------------------------------
  // Estado (solo sesión)
  // ---------------------------------------------------------------------------
  const state = {
    paqueteId: ssGet(SS.paquete, PAQUETES[0].id),
    prompts: Object.fromEntries(Object.entries(PROMPT_BLOQUES).map(([k, v]) => [k, v.texto])),
    log: ssGet(SS.log, []),
    running: false,
    paused: false,
    cancelled: false,
    sort: { key: 'timestamp', dir: 'desc' },
  };
  Object.assign(state.prompts, ssGet(SS.prompts, {}));

  const paqueteActual = () => PAQUETES.find((p) => p.id === state.paqueteId) || PAQUETES[0];

  // ---------------------------------------------------------------------------
  // Motor local (modo degradado sin IA): ramo por palabras clave + extracción
  // por expresiones regulares + reglas heurísticas
  // ---------------------------------------------------------------------------
  const RAMO_KEYWORDS = {
    Auto: /\b(coche|veh[ií]culo|moto|parabrisas|luna|taller|parking|aparc\w*|retrovisor|chapa|paragolpes|conductor\w*|carretera|rotonda|sem[aá]foro|granizo.*(cap[oó]|techo)|\d{4} [A-Z]{3}|AU-\d{6})\b/gi,
    Hogar: /\b(vivienda|casa|cocina|ba[ñn]o|sal[oó]n|dormitorio|tuber[ií]a|latiguillo|fontanero|ventana|mampara|vitrocer[aá]mica|caldera|cerradura|humedad\w*|chalet|garaje|tarima|suelo|vecino|electrodom[eé]stico\w*|frigor[ií]fico|televisor|HO-\d{6})\b/gi,
    Salud: /\b(urgencias|hospital|m[eé]dic\w+|cl[ií]nica|cuadro m[eé]dico|radiograf[ií]a|anal[ií]tica|ecograf[ií]a|fisioterapia|rehabilitaci[oó]n|cirug[ií]a|oper\w+|reembols\w+|p[oó]liza familiar|traumat[oó]logo|ginec[oó]log\w+|f[ée]rula|puntos|antibi[oó]tico|SA-\d{6})\b/gi,
  };

  function classifyRamoLocal(text) {
    const scores = RAMOS.map((r) => [r, (text.match(RAMO_KEYWORDS[r]) || []).length]);
    scores.sort((a, b) => b[1] - a[1]);
    const [best, second] = scores;
    if (best[1] === 0 || best[1] === second[1]) return 'Indeterminado';
    return best[0];
  }

  const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

  function extractLocal(msg) {
    const t = msg.texto;
    const recepcion = new Date(msg.fecha_recepcion);
    const year = recepcion.getFullYear();

    let fecha = null;
    let m = t.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i);
    if (m) fecha = `${year}-${String(MESES[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!fecha && (m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) fecha = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!fecha && /\b(ayer|anoche)\b/i.test(t)) fecha = isoDate(new Date(recepcion.getTime() - 86400000));
    if (!fecha && /\b(hoy|esta (ma[ñn]ana|tarde|noche)|acabo de|ahora mismo)\b/i.test(t)) fecha = isoDate(recepcion);

    const importes = [...t.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)\s?€/g)].map((x) => Number(x[1].replace(/\./g, '')));
    const poliza = t.match(/\b(AU|HO|SA)-\d{6}\b/);
    // «No hubo heridos», «sin heridos», «nadie herido»: quitar antes de buscar lesionados
    const sinNegaciones = t.replace(/\b(no hubo|no hay|sin|nadie|ning[uú]n[ao]?)\s+(\w+\s+)?(herid\w+|lesion\w+)\b/gi, '');
    const docs = [...new Set((t.match(/\b(fotos?|parte amistoso|denuncia|facturas?|presupuesto|informe|atestado|volante|prescripci[oó]n)\b/gi) || []).map((d) => d.toLowerCase()))];

    return {
      nombre_cliente: msg.remitente.nombre,
      numero_poliza: poliza ? poliza[0] : null,
      tipo_siniestro: msg.asunto,
      fecha_hecho: fecha,
      importe_estimado_eur: importes.length ? Math.max(...importes) : null,
      lugar: null,
      terceros_implicados: /\b(otro (coche|conductor|veh[ií]culo)|otra conductora|un coche (me|se)|vecino de arriba)\b/i.test(t),
      lesionados: /\b(herid\w+|lesion\w+|ambulancia|ingresad\w+|fractura|costillas|clav[ií]cula|da[ñn]o en el cuello)\b/i.test(sinNegaciones),
      documentacion_mencionada: docs,
      observaciones: 'Extracción local por expresiones regulares (sin IA)',
    };
  }

  // Cada regla: [código, descripción, evaluador(texto, datos, mensaje) → 'cumple'|'incumple'|'no_aplica', evidencia]
  const LOCAL_RULES = {
    Auto: [
      ['A2', 'Comunicación en 7 días', (t, d, m) => (d.fecha_hecho ? (daysBetween(d.fecha_hecho, m.fecha_recepcion) > 7 ? 'incumple' : 'cumple') : 'no_aplica'), 'Fecha del hecho vs. recepción'],
      ['A3', 'Conductor declarado en póliza', (t) => (/\b(mi (hijo|hija|sobrin\w|amig\w|novi\w|cu[ñn]ad\w))\b[^.]*\b(cogi[oó]|conduc\w+|llevaba|sali[oó])\b/i.test(t) ? 'incumple' : 'cumple'), 'Mención de otro conductor'],
      ['A4', 'Sin alcohol, drogas ni fuga', (t) => (/\b(cervez\w+|alcohol|copas|bebid\w+|drog\w+|sin carn[eé]|sin permiso)\b/i.test(t) ? 'incumple' : 'cumple'), 'Circunstancias agravantes'],
      ['A5', 'Terceros documentados y sin lesionados', (t, d) => (d.lesionados || (d.terceros_implicados && !/parte amistoso|atestado|denuncia/i.test(t)) ? 'incumple' : 'cumple'), 'Lesionados / parte amistoso'],
      ['A6', 'Importe inferior a 6.000 €', (t, d) => (d.importe_estimado_eur == null ? 'no_aplica' : d.importe_estimado_eur > 6000 ? 'incumple' : 'cumple'), 'Importe extraído'],
      ['A7', 'Caso de despeje directo con documentación', (t, d) => (d.documentacion_mencionada.length ? 'cumple' : 'no_aplica'), 'Documentación mencionada'],
    ],
    Hogar: [
      ['H2', 'Comunicación en 7 días', (t) => (/\b(desde hace|hace (unos|varios|un par de) (meses|semanas))\b/i.test(t) ? 'incumple' : 'cumple'), 'Antigüedad del daño'],
      ['H3', 'Daño por agua súbito (no filtración)', (t) => (/\b(humedad\w*|filtraci\w+|condensaci\w+|silicona|junta)\b/i.test(t) ? 'incumple' : /\b(agua|tuber[ií]a|fuga|latiguillo|gotera)\b/i.test(t) ? 'cumple' : 'no_aplica'), 'Tipo de daño por agua'],
      ['H4', 'Robo con fuerza, denuncia y dentro de límites', (t, d) => {
        if (!/\b(rob\w+|sustra\w+|se han llevado|faltaban)\b/i.test(t)) return 'no_aplica';
        const sinFuerza = /\b(sin marcas|sin (signos|se[ñn]ales)|no sab\w+ c[oó]mo|entornad\w|abierta)\b/i.test(t);
        const joyas = /\b(joya\w*|anillo\w*|collar|reloj)\b/i.test(t) && (d.importe_estimado_eur || 0) > 3000;
        return sinFuerza || joyas || !/denuncia/i.test(t) ? 'incumple' : 'cumple';
      }, 'Fuerza, denuncia y límites de joyas'],
      ['H5', 'Cristales / eléctrico < 1.500 €', (t, d) => (/\b(cristal\w*|mampara|vitrocer[aá]mica|sobretensi[oó]n|subida de tensi[oó]n)\b/i.test(t) ? ((d.importe_estimado_eur || 0) < 1500 ? 'cumple' : 'incumple') : 'no_aplica'), 'Importe del daño'],
      ['H9', 'Importe inferior a 10.000 €', (t, d) => (d.importe_estimado_eur == null ? 'no_aplica' : d.importe_estimado_eur > 10000 ? 'incumple' : 'cumple'), 'Importe extraído'],
    ],
    Salud: [
      ['S2', 'Fuera de periodo de carencia', (t) => (/\bcontrat[ée][^.]*\b(mayo|junio|julio|agosto|septiembre) de 2026\b/i.test(t) && /\b(oper\w+|cirug[ií]a|hospitaliz\w+|ingres\w+)\b/i.test(t) ? 'incumple' : 'cumple'), 'Antigüedad de la póliza vs. prestación'],
      ['S3', 'Sin preexistencias no declaradas', (t) => (/\b(arrastraba|desde hace (a[ñn]os|un par de a[ñn]os)|ya ten[ií]a)\b/i.test(t) ? 'incumple' : 'cumple'), 'Mención de patología previa'],
      ['S4', 'Autorización previa cuando procede', (t) => {
        const ses = t.match(/(\d+)\s+sesiones/i);
        if (/\b(me operaron|ya me han operado|adjunto la factura)\b/i.test(t) && /\b(oper\w+|cirug[ií]a)\b/i.test(t)) return 'incumple';
        if (ses && Number(ses[1]) > 10) return 'incumple';
        return 'cumple';
      }, 'Prestación realizada sin autorización / sesiones'],
      ['S5', 'Centro del cuadro médico', (t) => (/\b(fuera del cuadro|no est[aá] en (vuestro|el) cuadro|cl[ií]nica privada)\b/i.test(t) ? 'incumple' : /\bcuadro\b/i.test(t) ? 'cumple' : 'no_aplica'), 'Mención del cuadro médico'],
      ['S7', 'Reembolso ≤ 2.000 € y prestación cubierta', (t, d) => (/reembols/i.test(t) && (d.importe_estimado_eur || 0) > 2000 ? 'incumple' : 'cumple'), 'Importe del reembolso'],
      ['S8', 'No corresponde a tráfico ni mutua laboral', (t) => (/\b(laboral|en el trabajo|almac[eé]n de mi empresa|mutua|accidente de tr[aá]fico)\b/i.test(t) ? 'incumple' : 'cumple'), 'Origen de la lesión'],
    ],
  };

  function localTriage(msg) {
    const text = `${msg.asunto}. ${msg.texto}`;
    const ramo = classifyRamoLocal(text);
    const datos = extractLocal(msg);
    const criterios = (LOCAL_RULES[ramo] || []).map(([regla, descripcion, evaluar, evidencia]) => ({ regla, descripcion, resultado: evaluar(text, datos, msg), evidencia }));
    const incumplidas = criterios.filter((c) => c.resultado === 'incumple');
    let decision, motivo;
    if (ramo === 'Indeterminado') {
      decision = DECISION.REVIEW; motivo = 'Ramo no determinable por palabras clave';
    } else if (incumplidas.length) {
      decision = DECISION.REVIEW; motivo = `Incumple ${incumplidas.map((c) => `${c.regla} (${c.descripcion})`).join(', ')}`;
    } else {
      decision = DECISION.CLEARED; motivo = `Ramo ${ramo}: sin incumplimientos en las reglas locales; importe ${fmtEur(datos.importe_estimado_eur)}`;
    }
    return { ramo, datos_extraidos: datos, criterios, decision, motivo, confianza: ramo === 'Indeterminado' ? 0.3 : 0.6 + Math.min(0.25, criterios.length * 0.04) };
  }

  // ---------------------------------------------------------------------------
  // Cliente Azure AI Foundry (chat/completions y Responses API)
  // ---------------------------------------------------------------------------
  const DEFAULT_API_VERSION = { deployments: '2024-10-21', models: '2024-05-01-preview' };
  class PermanentError extends Error {}

  function routeFromUrl(raw) {
    if (/\/openai\/v1\/responses/i.test(raw)) return 'responses';
    if (/\/openai\/v1\/chat\/completions/i.test(raw)) return 'v1';
    if (/\/models\/chat\/completions/i.test(raw)) return 'models';
    if (/\/openai\/deployments\//i.test(raw)) return 'deployments';
    return null;
  }

  function buildEndpointUrl(cfg) {
    const raw = cfg.endpoint.trim().replace(/\/+$/, '');
    let origin;
    try { origin = new URL(raw).origin; } catch { throw new PermanentError(`Endpoint no válido: ${raw}`); }
    const route = cfg.route || 'v1';
    if (routeFromUrl(raw) === route && /\?api-version=|\/openai\/v1\//i.test(raw)) return raw;
    if (route === 'responses') return `${origin}/openai/v1/responses`;
    if (route === 'v1') return `${origin}/openai/v1/chat/completions`;
    const version = encodeURIComponent(cfg.apiVersion || DEFAULT_API_VERSION[route]);
    if (route === 'models') return `${origin}/models/chat/completions?api-version=${version}`;
    return `${origin}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${version}`;
  }

  // Compatibilidad de parámetros: los modelos de razonamiento rechazan temperature y max_tokens.
  const paramCompat = { drop: new Set(), useMaxTokens: false };
  const isReasoningModel = (name) => /^(gpt-5|o[1-9])/i.test(String(name || '').trim());

  function buildBody(cfg, messages, { jsonMode, maxTokens }) {
    const reasoning = isReasoningModel(cfg.deployment);
    if (jsonMode && !messages.some((m) => m.role === 'user' && /json/i.test(m.content))) {
      messages = messages.map((m, i, arr) => (i === arr.length - 1 && m.role === 'user' ? { ...m, content: `${m.content}\n\nResponde únicamente con un objeto JSON.` } : m));
    }
    let body;
    if (cfg.route === 'responses') {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      body = { model: cfg.deployment, input: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })), max_output_tokens: maxTokens };
      if (system) body.instructions = system;
      if (reasoning) body.reasoning = { effort: 'low' }; else body.temperature = 0;
      if (jsonMode) body.text = { format: { type: 'json_object' } };
    } else {
      body = { model: cfg.deployment, messages };
      if (paramCompat.useMaxTokens) body.max_tokens = maxTokens; else body.max_completion_tokens = maxTokens;
      if (reasoning) body.reasoning_effort = 'low'; else body.temperature = 0;
      if (jsonMode) body.response_format = { type: 'json_object' };
    }
    paramCompat.drop.forEach((p) => delete body[p]);
    return body;
  }

  function extractContent(cfg, data) {
    if (cfg.route === 'responses') {
      const text = (data.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
      const u = data.usage || {};
      return { text, truncated: data.status === 'incomplete' && data.incomplete_details?.reason === 'max_output_tokens', usage: { input: u.input_tokens, output: u.output_tokens, reasoning: u.output_tokens_details?.reasoning_tokens } };
    }
    const choice = data.choices?.[0];
    const u = data.usage || {};
    return { text: choice?.message?.content ?? '', truncated: choice?.finish_reason === 'length', usage: { input: u.prompt_tokens, output: u.completion_tokens, reasoning: u.completion_tokens_details?.reasoning_tokens } };
  }

  function adaptParams(errorText) {
    const msg = String(errorText);
    if (/max_completion_tokens/i.test(msg) && /unsupported|not supported|unrecognized|unknown/i.test(msg) && !paramCompat.useMaxTokens) { paramCompat.useMaxTokens = true; return true; }
    if (/use 'max_completion_tokens'/i.test(msg) && paramCompat.useMaxTokens) { paramCompat.useMaxTokens = false; return true; }
    const m = msg.match(/Unsupported (?:parameter|value): '([a-z_]+)'/i) || msg.match(/'([a-z_]+)' (?:is not supported|does not support)/i);
    if (m && !paramCompat.drop.has(m[1])) { paramCompat.drop.add(m[1]); return true; }
    return false;
  }

  async function callChat(cfg, messages, { jsonMode = true, maxTokens = MAX_OUTPUT_TOKENS, onProgress = null } = {}) {
    const url = buildEndpointUrl(cfg);
    const started = performance.now();
    const progress = (label) => onProgress && onProgress(`${label} · ${((performance.now() - started) / 1000).toFixed(0)} s`);

    for (let attempt = 0, adaptations = 0; ; attempt++) {
      const body = buildBody(cfg, messages, { jsonMode, maxTokens });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const label = attempt ? `Reintento ${attempt}` : 'Esperando respuesta del modelo';
      progress(label);
      const ticker = setInterval(() => progress(label), 1000);
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': cfg.apiKey, Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer); clearInterval(ticker);
        const reason = err.name === 'AbortError' ? `sin respuesta en ${REQUEST_TIMEOUT_MS / 1000} s` : err.message;
        if (attempt >= NETWORK_RETRIES) throw new PermanentError(`Red/timeout tras ${attempt + 1} intentos (${reason}). Revisa el endpoint y la ruta de API (${url}).`);
        progress(`Sin respuesta (${reason}), reintentando`);
        await sleep(Math.min(RETRY.cap, RETRY.base * 2 ** attempt) + rnd(0, 500));
        continue;
      }
      clearTimeout(timer); clearInterval(ticker);

      if (res.ok) {
        const data = await res.json();
        const { text, truncated, usage } = extractContent(cfg, data);
        console.info('[triage][llm] tokens', usage);
        if (!text && truncated) throw new Error('Respuesta vacía: el modelo agotó los tokens en razonamiento');
        return { text, usage, truncated };
      }
      const text = await res.text().catch(() => '');
      if (res.status === 400 && adaptations < 4 && adaptParams(text)) {
        adaptations++; attempt--; // la adaptación no consume reintento
        console.info('[triage][llm] parámetro adaptado', { drop: [...paramCompat.drop], useMaxTokens: paramCompat.useMaxTokens });
        continue;
      }
      if (RETRY.transient.includes(res.status) && attempt < RETRY.max) {
        const retryAfter = Number(res.headers.get('retry-after')) * 1000;
        await sleep(retryAfter || Math.min(RETRY.cap, RETRY.base * 2 ** attempt) + rnd(0, 500));
        continue;
      }
      throw new PermanentError(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  // Validación de la respuesta del modelo: campos obligatorios con valores por defecto seguros
  function parseTriage(raw) {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) return null;
    let obj;
    try { obj = JSON.parse(match[0]); } catch { return null; }
    const decision = String(obj.decision || '').toUpperCase().replace('Ó', 'O');
    if (![DECISION.CLEARED, DECISION.REVIEW].includes(decision)) return null;
    if (typeof obj.motivo !== 'string' || !obj.motivo.trim()) return null;
    const ramoRaw = String(obj.ramo || '').trim();
    const ramo = RAMOS.find((r) => r.toLowerCase() === ramoRaw.toLowerCase()) || 'Indeterminado';
    const confianza = Number(obj.confianza);
    const datos = (obj.datos_extraidos && typeof obj.datos_extraidos === 'object') ? obj.datos_extraidos : {};
    const criterios = Array.isArray(obj.criterios) ? obj.criterios
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        regla: String(c.regla ?? '—'),
        descripcion: String(c.descripcion ?? ''),
        resultado: ['cumple', 'incumple', 'no_aplica'].includes(c.resultado) ? c.resultado : 'no_aplica',
        evidencia: String(c.evidencia ?? ''),
      })) : [];
    return {
      ramo,
      datos_extraidos: datos,
      criterios,
      decision,
      motivo: obj.motivo.trim().slice(0, 240),
      confianza: Number.isFinite(confianza) ? Math.max(0, Math.min(1, confianza)) : 0.5,
    };
  }

  async function aiTriage(msg, cfg, onProgress) {
    const { text, usage } = await callChat(cfg, [
      { role: 'system', content: buildSystemPrompt(state.prompts) },
      { role: 'user', content: buildUserPrompt(msg) },
    ], { onProgress });
    const parsed = parseTriage(text);
    if (!parsed) throw new Error('Respuesta del modelo no válida');
    return { ...parsed, raw: text, usage };
  }

  // ---------------------------------------------------------------------------
  // Configuración IA (sessionStorage)
  // ---------------------------------------------------------------------------
  function readConfigFromForm() {
    return {
      endpoint: $('cfg-endpoint').value.trim(),
      deployment: $('cfg-deployment').value.trim(),
      route: $('cfg-route').value,
      apiVersion: $('cfg-api-version').value.trim(),
      apiKey: $('cfg-api-key').value.trim(),
    };
  }
  function saveConfig(cfg) { ssSet(SS.cfg, cfg); }
  function loadConfig() {
    const c = ssGet(SS.cfg, {});
    $('cfg-endpoint').value = c.endpoint || '';
    $('cfg-deployment').value = c.deployment || '';
    if (c.route) $('cfg-route').value = c.route;
    $('cfg-api-version').value = c.apiVersion || '';
    $('cfg-api-key').value = c.apiKey || '';
  }
  const aiEnabled = (cfg) => Boolean(cfg.endpoint && cfg.apiKey && (cfg.deployment || /chat\/completions|\/responses/i.test(cfg.endpoint)));

  function updateModeBadge() {
    const cfg = readConfigFromForm();
    $('mode-badge').textContent = aiEnabled(cfg) ? `Motor: IA (${cfg.deployment || 'endpoint'})` : 'Motor: reglas locales (sin IA)';
  }

  // ---------------------------------------------------------------------------
  // Barra lateral: paquete y prompts
  // ---------------------------------------------------------------------------
  function renderPaquete() {
    const sel = $('sel-paquete');
    sel.replaceChildren(...PAQUETES.map((p) => Object.assign(document.createElement('option'), { value: p.id, textContent: `${p.nombre} — ${p.mensajes.length} mensajes` })));
    sel.value = state.paqueteId;
    const p = paqueteActual();
    $('paquete-desc').textContent = p.descripcion;
    $('paquete-lista').replaceChildren(...p.mensajes.map((m) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="msg-id">${escapeHtml(m.id)}</span> <span class="msg-canal">${escapeHtml(m.canal)}</span><br><span class="msg-asunto">${escapeHtml(m.asunto)}</span>`;
      li.title = m.texto;
      return li;
    }));
    $('btn-run').textContent = `▶ Procesar ${p.nombre} (${p.mensajes.length})`;
  }

  function renderPromptSections() {
    const wrap = $('prompt-sections');
    wrap.replaceChildren(...Object.entries(PROMPT_BLOQUES).map(([key, def]) => {
      const details = document.createElement('details');
      details.className = 'card section';
      const edited = state.prompts[key] !== def.texto;
      details.innerHTML = `
        <summary>${escapeHtml(def.titulo)} <span class="edited-flag" ${edited ? '' : 'hidden'}>editado</span></summary>
        <div class="section-body">
          <textarea data-prompt="${key}" rows="14" spellcheck="false"></textarea>
          <div class="row between">
            <small class="muted"><span data-count="${key}"></span> caracteres</small>
            <button class="btn btn-ghost btn-sm" type="button" data-restore="${key}">Restaurar original</button>
          </div>
        </div>`;
      const ta = details.querySelector('textarea');
      ta.value = state.prompts[key];
      const count = details.querySelector(`[data-count="${key}"]`);
      const flag = details.querySelector('.edited-flag');
      const sync = () => { count.textContent = ta.value.length; flag.hidden = ta.value === def.texto; };
      sync();
      ta.addEventListener('input', () => { state.prompts[key] = ta.value; ssSet(SS.prompts, state.prompts); sync(); });
      details.querySelector(`[data-restore="${key}"]`).addEventListener('click', () => { ta.value = def.texto; ta.dispatchEvent(new Event('input')); });
      return details;
    }));
  }

  // ---------------------------------------------------------------------------
  // Registro y render del panel principal
  // ---------------------------------------------------------------------------
  function persistLog() { ssSet(SS.log, state.log); }

  function renderCounters() {
    const entries = state.log;
    const cleared = entries.filter((e) => e.decision === DECISION.CLEARED).length;
    const review = entries.filter((e) => e.decision === DECISION.REVIEW).length;
    const total = entries.length;
    $('cnt-cleared').textContent = cleared;
    $('cnt-review').textContent = review;
    $('pct-cleared').textContent = total ? `${Math.round((cleared / total) * 100)} % del lote` : '—';
    $('pct-review').textContent = total ? `${Math.round((review / total) * 100)} % del lote` : '—';
    if (total) {
      $('cnt-cycle').textContent = fmtMs(entries.reduce((a, e) => a + e.duracion_ms, 0) / total);
      $('cycle-sub').textContent = `por mensaje · ${total} procesados`;
    } else {
      $('cnt-cycle').textContent = '—';
      $('cycle-sub').textContent = 'por mensaje';
    }
    const porRamo = {};
    entries.forEach((e) => { porRamo[e.ramo] = (porRamo[e.ramo] || 0) + 1; });
    $('ramo-chips').replaceChildren(...Object.entries(porRamo).map(([r, n]) => Object.assign(document.createElement('span'), { className: `chip chip-${r.toLowerCase()}`, textContent: `${r} ${n}` })));
  }

  function sortedFilteredLog() {
    const ramo = $('filter-ramo').value;
    const onlyReview = $('filter-review').checked;
    const rows = state.log.filter((e) => (!ramo || e.ramo === ramo) && (!onlyReview || e.decision === DECISION.REVIEW));
    const { key, dir } = state.sort;
    const mul = dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const va = a[key] ?? '', vb = b[key] ?? '';
      if (typeof va === 'number' || typeof vb === 'number') return ((Number(va) || 0) - (Number(vb) || 0)) * mul;
      return String(va).localeCompare(String(vb), 'es') * mul;
    });
  }

  function renderLog() {
    const rows = sortedFilteredLog();
    $('log-count').textContent = state.log.length ? `(${state.log.length})` : '';
    $('log-empty').hidden = rows.length > 0;
    document.querySelectorAll('#log-table th[data-sort]').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.sort === state.sort.key);
      th.dataset.dir = th.dataset.sort === state.sort.key ? state.sort.dir : '';
    });
    $('log-body').replaceChildren(...rows.map((e) => {
      const tr = document.createElement('tr');
      tr.className = e.decision === DECISION.REVIEW ? 'row-review' : 'row-ok';
      tr.dataset.id = e.id;
      tr.tabIndex = 0;
      const ramoMark = e.esperado?.ramo ? (e.esperado.ramo === e.ramo ? '<span class="mark ok" title="Coincide con el ramo esperado">✔</span>' : `<span class="mark ko" title="Esperado: ${escapeHtml(e.esperado.ramo)}">✖</span>`) : '';
      tr.innerHTML = [
        `<td><strong>${escapeHtml(e.id)}</strong><br><span class="muted small">${escapeHtml(e.asunto)}</span></td>`,
        `<td><span class="pill pill-ramo-${e.ramo.toLowerCase()}">${escapeHtml(e.ramo)}</span> ${ramoMark}</td>`,
        `<td>${fmtEur(e.importe)}</td>`,
        `<td><span class="pill ${e.decision === DECISION.REVIEW ? 'pill-review' : 'pill-ok'}">${e.decision === DECISION.REVIEW ? 'Revisión' : 'Despejado'}</span></td>`,
        `<td class="motivo">${escapeHtml(e.motivo)}</td>`,
        `<td>${escapeHtml(e.origen)}</td>`,
        `<td>${Math.round(e.confianza * 100)} %</td>`,
        `<td>${fmtMs(e.duracion_ms)}</td>`,
        `<td>${new Date(e.timestamp).toLocaleTimeString('es-ES')}</td>`,
      ].join('');
      return tr;
    }));
  }

  function setProgress(done, total) { $('progress-bar').style.width = `${total ? (done / total) * 100 : 0}%`; }
  function setStatus(id, text, kind = '') { const el = $(id); el.textContent = text; el.className = `status ${kind}`; }

  // ---------------------------------------------------------------------------
  // Ficha modal
  // ---------------------------------------------------------------------------
  function kv(pairs) {
    return pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${v}</dd>`).join('');
  }
  function fmtValue(v) {
    if (v === null || v === undefined || v === '') return '<span class="muted">—</span>';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (Array.isArray(v)) return v.length ? escapeHtml(v.join(', ')) : '<span class="muted">—</span>';
    if (typeof v === 'object') return `<code>${escapeHtml(JSON.stringify(v))}</code>`;
    return escapeHtml(v);
  }
  const DATOS_LABELS = {
    nombre_cliente: 'Cliente', numero_poliza: 'Nº de póliza', tipo_siniestro: 'Tipo de siniestro', fecha_hecho: 'Fecha del hecho',
    importe_estimado_eur: 'Importe estimado', lugar: 'Lugar', terceros_implicados: 'Terceros implicados', lesionados: 'Lesionados',
    documentacion_mencionada: 'Documentación mencionada', observaciones: 'Observaciones',
  };
  const RESULT_ICON = { cumple: '✔', incumple: '✖', no_aplica: '–' };

  function openModal(entry) {
    const m = entry.mensaje;
    $('modal-title').textContent = `${entry.id} · ${m.asunto}`;
    $('modal-subtitle').innerHTML = `<span class="pill pill-ramo-${entry.ramo.toLowerCase()}">${escapeHtml(entry.ramo)}</span> <span class="pill ${entry.decision === DECISION.REVIEW ? 'pill-review' : 'pill-ok'}">${entry.decision === DECISION.REVIEW ? 'Revisión humana' : 'Despejado'}</span>`;
    $('modal-mensaje').innerHTML = kv([
      ['Remitente', escapeHtml(m.remitente.nombre)],
      ['Contacto', escapeHtml(m.remitente.contacto)],
      ['Canal', escapeHtml(m.canal)],
      ['Recibido', new Date(m.fecha_recepcion).toLocaleString('es-ES')],
    ]);
    $('modal-texto').textContent = m.texto;
    const datos = entry.datos_extraidos || {};
    const keys = [...Object.keys(DATOS_LABELS), ...Object.keys(datos).filter((k) => !DATOS_LABELS[k])];
    $('modal-datos').innerHTML = kv(keys.filter((k) => k in datos).map((k) => [DATOS_LABELS[k] || k, k === 'importe_estimado_eur' ? fmtEur(datos[k]) : fmtValue(datos[k])]));

    const esperado = entry.esperado || {};
    const ramoOk = esperado.ramo ? (esperado.ramo === entry.ramo ? '<span class="mark ok">✔ coincide</span>' : `<span class="mark ko">✖ esperado ${escapeHtml(esperado.ramo)}</span>`) : '';
    $('modal-ramo').innerHTML = `Asignado por el ${entry.origen.startsWith('IA') ? 'modelo' : 'motor local'}: <strong>${escapeHtml(entry.ramo)}</strong> ${ramoOk}`;

    $('modal-criterios').replaceChildren(...(entry.criterios || []).map((c) => {
      const li = document.createElement('li');
      li.className = `crit crit-${c.resultado}`;
      li.innerHTML = `<span class="crit-icon" aria-hidden="true">${RESULT_ICON[c.resultado] || '–'}</span><div><strong>${escapeHtml(c.regla)}</strong> ${escapeHtml(c.descripcion)}<br><small>${escapeHtml(c.evidencia)}</small></div>`;
      return li;
    }));
    if (!(entry.criterios || []).length) $('modal-criterios').innerHTML = '<li class="muted">El resultado no incluye criterios.</li>';

    $('modal-resultado').innerHTML = kv([
      ['Decisión', entry.decision === DECISION.REVIEW ? 'Revisión humana' : 'Despejado automáticamente'],
      ['Motivo', escapeHtml(entry.motivo)],
      ['Confianza', `${Math.round(entry.confianza * 100)} %`],
      ['Origen', escapeHtml(entry.origen)],
      ['Ciclo', fmtMs(entry.duracion_ms)],
      ['Tokens', entry.usage ? `${entry.usage.input ?? '?'} entrada · ${entry.usage.output ?? '?'} salida${entry.usage.reasoning != null ? ` (${entry.usage.reasoning} razonamiento)` : ''}` : undefined],
      ['Referencia demo', esperado.ramo ? `${esperado.revision ? 'Revisión esperada' : 'Despeje esperado'}${esperado.nota ? ` — ${escapeHtml(esperado.nota)}` : ''}` : undefined],
    ]);
    $('modal-raw').textContent = entry.raw || '(sin respuesta cruda: decisión del motor local)';
    $('modal').showModal();
  }

  // ---------------------------------------------------------------------------
  // Procesamiento del paquete con pausa / continuar / cancelar
  // ---------------------------------------------------------------------------
  async function waitWhilePaused() {
    while (state.paused && !state.cancelled) await sleep(150);
  }

  async function triageOne(msg, cfg, onProgress) {
    if (!aiEnabled(cfg)) {
      await sleep(rnd(LOCAL_LATENCY_MS[0], LOCAL_LATENCY_MS[1]));
      return { ...localTriage(msg), origen: 'reglas locales' };
    }
    try {
      return { ...(await aiTriage(msg, cfg, onProgress)), origen: 'IA' };
    } catch (err) {
      if (err instanceof PermanentError) throw err; // credenciales/endpoint mal: abortar lote
      console.warn('[triage][llm] fallback a reglas locales', msg.id, err.message);
      return { ...localTriage(msg), origen: `reglas locales (fallback IA: ${err.message.slice(0, 60)})` };
    }
  }

  function setRunButtons() {
    $('btn-run').disabled = state.running;
    $('btn-pause').disabled = !state.running;
    $('btn-pause').textContent = state.paused ? '▶ Continuar' : '⏸ Pausar';
    $('sel-paquete').disabled = state.running;
  }

  async function runBatch() {
    if (state.running) return;
    const cfg = readConfigFromForm();
    saveConfig(cfg);
    updateModeBadge();
    const paquete = paqueteActual();
    const mensajes = paquete.mensajes;

    state.running = true; state.paused = false; state.cancelled = false;
    setRunButtons();
    setProgress(0, mensajes.length);
    setStatus('run-status', `Procesando 0/${mensajes.length}…`);

    try {
      for (let i = 0; i < mensajes.length; i++) {
        await waitWhilePaused();
        if (state.cancelled) break;
        const msg = mensajes[i];
        const t0 = performance.now();
        const result = await triageOne(msg, cfg, (p) => setStatus('run-status', `${msg.id} (${i + 1}/${mensajes.length}): ${p}…`));
        if (state.cancelled) break;
        state.log.unshift({
          id: msg.id,
          asunto: msg.asunto,
          paquete: paquete.id,
          ramo: result.ramo,
          importe: result.datos_extraidos?.importe_estimado_eur ?? null,
          decision: result.decision,
          motivo: result.motivo,
          confianza: result.confianza,
          origen: result.origen,
          criterios: result.criterios,
          datos_extraidos: result.datos_extraidos,
          raw: result.raw || null,
          usage: result.usage || null,
          duracion_ms: Math.round(performance.now() - t0),
          timestamp: new Date().toISOString(),
          esperado: msg.esperado,
          mensaje: msg,
        });
        persistLog();
        setProgress(i + 1, mensajes.length);
        if (!state.paused) setStatus('run-status', `Procesando ${i + 1}/${mensajes.length}…`);
        renderCounters();
        renderLog();
      }
      if (!state.cancelled) {
        const review = state.log.filter((e) => e.paquete === paquete.id && e.decision === DECISION.REVIEW).length;
        setStatus('run-status', `${paquete.nombre} completado: ${mensajes.length - review} despejados, ${review} a revisión humana.`, 'ok');
      }
    } catch (err) {
      setStatus('run-status', `Lote interrumpido: ${err.message}`, 'error');
    } finally {
      state.running = false; state.paused = false;
      setRunButtons();
    }
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    setRunButtons();
    setStatus('run-status', state.paused ? 'En pausa: se completará la llamada en curso y se detendrá.' : 'Reanudando…');
  }

  function resetBatch() {
    state.cancelled = true; state.paused = false;
    state.log = [];
    persistLog();
    renderCounters();
    renderLog();
    setProgress(0, 1);
    setStatus('run-status', state.running ? 'Lote cancelado y registro vaciado.' : '');
  }

  // ---------------------------------------------------------------------------
  // Exportación
  // ---------------------------------------------------------------------------
  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function exportJson() {
    const data = state.log.map(({ mensaje, ...e }) => ({ ...e, mensaje: { id: mensaje.id, canal: mensaje.canal, asunto: mensaje.asunto, texto: mensaje.texto } }));
    download(`triage-registro-${isoDate(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json');
  }
  function exportCsv() {
    const cols = ['paquete', 'id', 'asunto', 'ramo', 'importe', 'decision', 'motivo', 'confianza', 'origen', 'duracion_ms', 'timestamp'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(';'), ...state.log.map((e) => cols.map((c) => esc(e[c])).join(';'))];
    download(`triage-registro-${isoDate(new Date())}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  function bind() {
    $('btn-toggle-config').addEventListener('click', () => {
      const panel = $('config-panel');
      panel.hidden = !panel.hidden;
      $('btn-toggle-config').setAttribute('aria-expanded', String(!panel.hidden));
    });
    ['cfg-endpoint', 'cfg-deployment', 'cfg-route', 'cfg-api-version', 'cfg-api-key'].forEach((id) => {
      $(id).addEventListener(id === 'cfg-route' ? 'change' : 'input', () => {
        if (id === 'cfg-endpoint') { const r = routeFromUrl($('cfg-endpoint').value); if (r) $('cfg-route').value = r; }
        saveConfig(readConfigFromForm());
        updateModeBadge();
      });
    });
    $('btn-test-ai').addEventListener('click', async () => {
      const cfg = readConfigFromForm();
      if (!aiEnabled(cfg)) { setStatus('ai-status', 'Faltan endpoint, deployment o clave.', 'error'); return; }
      setStatus('ai-status', `Probando ${buildEndpointUrl(cfg)}…`);
      $('btn-test-ai').disabled = true;
      try {
        const { text } = await callChat(cfg, [{ role: 'user', content: 'Responde solo con este JSON: {"ok": true}' }], { maxTokens: 300, onProgress: (p) => setStatus('ai-status', `${p}…`) });
        setStatus('ai-status', `Conexión correcta. Respuesta: ${String(text).slice(0, 60)}`, 'ok');
      } catch (err) {
        const hint = /api version/i.test(err.message) ? ' → Prueba otra «Ruta de API».' : '';
        setStatus('ai-status', `Error: ${err.message}${hint}`, 'error');
      } finally {
        $('btn-test-ai').disabled = false;
      }
    });
    $('btn-clear-ai').addEventListener('click', () => { $('cfg-api-key').value = ''; saveConfig(readConfigFromForm()); updateModeBadge(); setStatus('ai-status', 'Clave eliminada de la sesión.'); });

    $('sel-paquete').addEventListener('change', () => { state.paqueteId = $('sel-paquete').value; ssSet(SS.paquete, state.paqueteId); renderPaquete(); });

    $('btn-run').addEventListener('click', runBatch);
    $('btn-pause').addEventListener('click', togglePause);
    $('btn-reset').addEventListener('click', resetBatch);
    $('filter-ramo').addEventListener('change', renderLog);
    $('filter-review').addEventListener('change', renderLog);
    $('btn-export-json').addEventListener('click', exportJson);
    $('btn-export-csv').addEventListener('click', exportCsv);

    document.querySelectorAll('#log-table th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        state.sort = { key, dir: state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc' };
        renderLog();
      });
    });
    $('log-body').addEventListener('click', (ev) => {
      const tr = ev.target.closest('tr[data-id]');
      if (!tr) return;
      const entry = state.log.find((e) => e.id === tr.dataset.id);
      if (entry) openModal(entry);
    });
    $('log-body').addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const tr = ev.target.closest('tr[data-id]');
      const entry = tr && state.log.find((e) => e.id === tr.dataset.id);
      if (entry) openModal(entry);
    });
    $('modal-close').addEventListener('click', () => $('modal').close());
    $('modal').addEventListener('click', (ev) => { if (ev.target === $('modal')) $('modal').close(); });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  loadConfig();
  renderPaquete();
  renderPromptSections();
  bind();
  updateModeBadge();
  setRunButtons();
  renderCounters();
  renderLog();
})();
