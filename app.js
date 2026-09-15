/* FNOL Triage — app autosuficiente (HTML + JS).
 * Flujo: generar 40 avisos → triaje (reglas o Azure AI Foundry) → registro de cada decisión → contadores.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constantes
  // ---------------------------------------------------------------------------
  const BATCH_SIZE = 40;
  const LOG_STORAGE_KEY = 'fnol.audit.log';
  const CFG_SESSION_KEY = 'fnol.ai.config';
  const CFG_LOCAL_KEY = 'fnol.ai.config.public'; // endpoint/deployment/version — nunca la clave

  const DECISION = { CLEARED: 'DESPEJADO', REVIEW: 'REVISION' };

  // Umbral de importe "normal" por ramo (EUR)
  const AMOUNT_THRESHOLD = { Auto: 15000, Hogar: 20000, Salud: 8000, Comercio: 40000 };

  // Reintentos para errores transitorios: base 2s, tope 32s, máx 5
  const RETRY = { base: 2000, cap: 32000, max: 5, transient: [408, 429, 500, 502, 503, 504] };
  const REQUEST_TIMEOUT_MS = 30000;

  // Latencia simulada del motor de reglas (integración con core / consulta de póliza)
  const RULES_LATENCY_MS = [60, 220];

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const rnd = (min, max) => Math.random() * (max - min) + min;
  const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
  const pick = (arr) => arr[rndInt(0, arr.length - 1)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n, w = 4) => String(n).padStart(w, '0');
  const isoDate = (d) => d.toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const fmtEur = (n) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);

  // ---------------------------------------------------------------------------
  // Generador de avisos sintéticos
  // ---------------------------------------------------------------------------
  const NAMES = ['Lucía Fernández', 'Marcos Ruiz', 'Aitana López', 'Javier Ortega', 'Carmen Díaz', 'Pablo Navarro',
    'Sofía Martín', 'Hugo Sánchez', 'Elena Torres', 'Daniel Romero', 'Paula Jiménez', 'Adrián Moreno',
    'Irene Castro', 'Sergio Vega', 'Marta Gil', 'Álvaro Serrano', 'Noa Blanco', 'Iván Molina', 'Clara Ramos', 'Diego Herrera'];
  const CITIES = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Bilbao', 'Málaga', 'Murcia', 'Valladolid', 'A Coruña'];

  const CLAIM_TYPES = {
    Auto: [
      ['Colisión en aparcamiento', [300, 2500], 'Golpe en el paragolpes trasero al maniobrar en un aparcamiento; sin heridos.'],
      ['Alcance en retención', [800, 6000], 'Alcance por detrás en retención de tráfico; daños en portón y luces traseras.'],
      ['Rotura de luna', [150, 700], 'Impacto de gravilla en autopista con rotura de luna delantera.'],
      ['Daños por granizo', [1200, 5000], 'Abolladuras en capó y techo tras tormenta de granizo.'],
    ],
    Hogar: [
      ['Daños por agua', [400, 4000], 'Fuga en la junta del lavavajillas con daños en tarima del salón.'],
      ['Rotura de cristales', [120, 600], 'Rotura accidental de la mampara de ducha.'],
      ['Robo con fuerza', [1500, 9000], 'Acceso forzando la cerradura; sustracción de electrónica y joyas. Denuncia presentada.'],
      ['Daño eléctrico', [200, 1800], 'Subida de tensión que dañó la placa de la nevera y el router.'],
    ],
    Salud: [
      ['Urgencia hospitalaria', [150, 900], 'Atención en urgencias por esguince de tobillo practicando deporte.'],
      ['Intervención ambulatoria', [600, 3500], 'Cirugía menor programada de extracción de quiste.'],
      ['Pruebas diagnósticas', [200, 1200], 'Resonancia magnética prescrita por traumatología.'],
    ],
    Comercio: [
      ['Daños por agua', [2000, 15000], 'Reventón de tubería en el local con daños en género y suelo.'],
      ['Rotura de escaparate', [800, 4000], 'Escaparate roto por acto vandálico nocturno; parte policial adjunto.'],
      ['Incendio parcial', [5000, 30000], 'Conato de incendio en cuadro eléctrico sofocado por extintor; daños en instalación.'],
    ],
  };

  // Anomalías que inyectamos en un 5-10% de los avisos
  const ANOMALIES = [
    { key: 'poliza_no_vigente', apply: (c) => { c.poliza.vigencia_fin = isoDate(addDays(new Date(c.siniestro.fecha_ocurrencia), -rndInt(5, 60))); } },
    { key: 'aviso_tardio', apply: (c) => { c.siniestro.fecha_ocurrencia = isoDate(addDays(new Date(c.siniestro.fecha_aviso), -rndInt(45, 120))); } },
    { key: 'importe_anomalo', apply: (c) => { c.siniestro.importe_estimado = Math.round(AMOUNT_THRESHOLD[c.poliza.ramo] * rnd(1.6, 3.2)); } },
    { key: 'siniestralidad_alta', apply: (c) => { c.historial.siniestros_previos_12m = rndInt(3, 5); } },
    { key: 'poliza_reciente_importe_alto', apply: (c) => { c.poliza.antiguedad_meses = 1; c.siniestro.importe_estimado = Math.round(AMOUNT_THRESHOLD[c.poliza.ramo] * rnd(0.6, 0.95)); } },
    { key: 'descripcion_incoherente', apply: (c) => { c.siniestro.descripcion = pick(['Robo de bicicleta en la vía pública sin denuncia.', 'Daños en el vehículo de un tercero que no aparece en la póliza.', 'Reclamación por pérdida de equipaje en aeropuerto.']); } },
  ];

  function generateClaim(index, today) {
    const ramo = pick(Object.keys(CLAIM_TYPES));
    const [tipo, [min, max], descripcion] = pick(CLAIM_TYPES[ramo]);
    const fechaAviso = addDays(today, -rndInt(0, 3));
    const fechaOcurrencia = addDays(fechaAviso, -rndInt(0, 12));
    const antiguedad = rndInt(3, 96);
    const inicio = addDays(fechaOcurrencia, -antiguedad * 30);
    return {
      id: `FNOL-${today.getFullYear()}-${pad(index + 1)}`,
      asegurado: { nombre: pick(NAMES), ciudad: pick(CITIES) },
      poliza: {
        numero: `${ramo.slice(0, 2).toUpperCase()}-${rndInt(100000, 999999)}`,
        ramo,
        vigencia_inicio: isoDate(inicio),
        vigencia_fin: isoDate(addDays(inicio, 365 * Math.ceil(antiguedad / 12))),
        antiguedad_meses: antiguedad,
      },
      siniestro: {
        tipo,
        fecha_ocurrencia: isoDate(fechaOcurrencia),
        fecha_aviso: isoDate(fechaAviso),
        importe_estimado: Math.round(rnd(min, max)),
        descripcion,
        documentacion_adjunta: Math.random() > 0.15,
      },
      historial: { siniestros_previos_12m: rndInt(0, 1) },
    };
  }

  function generateBatch(size) {
    const today = new Date();
    const claims = Array.from({ length: size }, (_, i) => generateClaim(i, today));
    // 5-10% con anomalía (2-4 de 40)
    const anomalyCount = rndInt(Math.ceil(size * 0.05), Math.floor(size * 0.10));
    const indices = new Set();
    while (indices.size < anomalyCount) indices.add(rndInt(0, size - 1));
    indices.forEach((i) => pick(ANOMALIES).apply(claims[i]));
    return claims;
  }

  // ---------------------------------------------------------------------------
  // Motor de reglas
  // ---------------------------------------------------------------------------
  function rulesEngine(c) {
    const flags = [];
    const { poliza: p, siniestro: s, historial: h } = c;
    const threshold = AMOUNT_THRESHOLD[p.ramo];

    if (s.fecha_ocurrencia < p.vigencia_inicio || s.fecha_ocurrencia > p.vigencia_fin) {
      flags.push(`Póliza no vigente en la fecha del siniestro (${s.fecha_ocurrencia}, vigencia hasta ${p.vigencia_fin})`);
    }
    const delay = daysBetween(s.fecha_ocurrencia, s.fecha_aviso);
    if (delay > 30) flags.push(`Aviso tardío: ${delay} días desde el suceso`);
    if (s.importe_estimado > threshold) flags.push(`Importe ${fmtEur(s.importe_estimado)} supera el umbral del ramo (${fmtEur(threshold)})`);
    if (h.siniestros_previos_12m >= 3) flags.push(`${h.siniestros_previos_12m} siniestros previos en 12 meses`);
    if (p.antiguedad_meses < 2 && s.importe_estimado > threshold * 0.5) flags.push(`Póliza reciente (${p.antiguedad_meses} mes) con importe elevado`);
    if (/tercero|equipaje|bicicleta/i.test(s.descripcion)) flags.push('Descripción incoherente con el ramo o la cobertura');
    if (!s.documentacion_adjunta && s.importe_estimado > threshold * 0.6) flags.push('Sin documentación adjunta para un importe relevante');

    if (flags.length) {
      return { decision: DECISION.REVIEW, motivo: flags.join(' · '), confianza: Math.min(0.99, 0.7 + flags.length * 0.1), flags };
    }
    return {
      decision: DECISION.CLEARED,
      motivo: `Dentro de parámetros: póliza vigente, aviso en ${delay} día(s), importe ${fmtEur(s.importe_estimado)} bajo umbral, sin siniestralidad previa relevante`,
      confianza: 0.95,
      flags,
    };
  }

  // ---------------------------------------------------------------------------
  // Cliente Azure AI Foundry (API compatible OpenAI)
  // ---------------------------------------------------------------------------
  const DEFAULT_API_VERSION = { deployments: '2024-10-21', models: '2024-05-01-preview' };

  function buildEndpointUrl(cfg) {
    const base = cfg.endpoint.trim().replace(/\/+$/, '');
    // URL completa pegada por el usuario: se usa tal cual
    if (/chat\/completions/i.test(base)) return base;
    const route = cfg.route || 'v1';
    if (route === 'v1') return `${base}/openai/v1/chat/completions`;
    const version = encodeURIComponent(cfg.apiVersion || DEFAULT_API_VERSION[route]);
    if (route === 'models') return `${base}/models/chat/completions?api-version=${version}`;
    return `${base}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${version}`;
  }

  class PermanentError extends Error {}

  // Compatibilidad de parámetros entre modelos: los modelos de razonamiento
  // (gpt-5*, o1/o3/o4) rechazan temperature y max_tokens. Empezamos con la
  // configuración más compatible y, si el modelo rechaza un parámetro, lo
  // adaptamos y recordamos el ajuste para el resto del lote.
  const paramCompat = { drop: new Set(), useMaxTokens: false };
  const isReasoningModel = (name) => /^(gpt-5|o[1-9])/i.test(String(name || '').trim());

  function buildBody(cfg, messages, { jsonMode, maxTokens }) {
    const body = { model: cfg.deployment, messages };
    if (paramCompat.useMaxTokens) body.max_tokens = maxTokens;
    else body.max_completion_tokens = maxTokens;
    if (!isReasoningModel(cfg.deployment)) body.temperature = 0;
    else body.reasoning_effort = 'low';
    if (jsonMode) body.response_format = { type: 'json_object' };
    paramCompat.drop.forEach((p) => delete body[p]);
    return body;
  }

  // Devuelve true si el error 400 describe un parámetro no soportado y hemos podido adaptarlo
  function adaptParams(errorText) {
    const msg = String(errorText);
    if (/max_completion_tokens/i.test(msg) && /unsupported|not supported|unrecognized|unknown/i.test(msg) && !paramCompat.useMaxTokens) {
      paramCompat.useMaxTokens = true;
      return true;
    }
    if (/use 'max_completion_tokens'/i.test(msg) && paramCompat.useMaxTokens) {
      paramCompat.useMaxTokens = false;
      return true;
    }
    const m = msg.match(/Unsupported (?:parameter|value): '([a-z_]+)'/i) || msg.match(/'([a-z_]+)' (?:is not supported|does not support)/i);
    if (m && !paramCompat.drop.has(m[1])) {
      paramCompat.drop.add(m[1]);
      return true;
    }
    return false;
  }

  async function callChat(cfg, messages, { jsonMode = true, maxTokens = 1200 } = {}) {
    const url = buildEndpointUrl(cfg);

    for (let attempt = 0, adaptations = 0; ; attempt++) {
      const body = buildBody(cfg, messages, { jsonMode, maxTokens });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': cfg.apiKey, Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt >= RETRY.max) throw new Error(`Red/timeout tras ${attempt + 1} intentos: ${err.message}`);
        await sleep(Math.min(RETRY.cap, RETRY.base * 2 ** attempt) + rnd(0, 500));
        continue;
      }
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const usage = data.usage || {};
        console.info('[fnol][llm] tokens', {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          reasoning: usage.completion_tokens_details?.reasoning_tokens,
        });
        const choice = data.choices?.[0];
        const content = choice?.message?.content ?? '';
        if (!content && choice?.finish_reason === 'length') {
          throw new Error('Respuesta vacía: el modelo agotó los tokens en razonamiento (sube el límite de tokens)');
        }
        return content;
      }
      const text = await res.text().catch(() => '');
      if (res.status === 400 && adaptations < 4 && adaptParams(text)) {
        adaptations++;
        console.info('[fnol][llm] parámetro adaptado', { drop: [...paramCompat.drop], useMaxTokens: paramCompat.useMaxTokens });
        attempt--; // la adaptación no consume reintento
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

  function parseDecision(raw) {
    // Tolerar bloques ```json ... ``` o texto alrededor del JSON
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) return null;
    let obj;
    try { obj = JSON.parse(match[0]); } catch { return null; }
    const decision = String(obj.decision || '').toUpperCase().replace('Ó', 'O');
    if (![DECISION.CLEARED, DECISION.REVIEW].includes(decision)) return null;
    if (typeof obj.motivo !== 'string' || !obj.motivo.trim()) return null;
    const confianza = Number(obj.confianza);
    return { decision, motivo: obj.motivo.trim().slice(0, 200), confianza: Number.isFinite(confianza) ? Math.max(0, Math.min(1, confianza)) : 0.5 };
  }

  async function aiTriage(claim, cfg) {
    const raw = await callChat(cfg, [
      { role: 'system', content: FNOL_SYSTEM_PROMPT },
      { role: 'user', content: buildFnolUserPrompt(claim) },
    ]);
    const parsed = parseDecision(raw);
    if (!parsed) throw new Error('Respuesta del modelo no válida');
    return parsed;
  }

  // ---------------------------------------------------------------------------
  // Configuración IA (persistencia)
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

  function saveConfig(cfg) {
    try {
      localStorage.setItem(CFG_LOCAL_KEY, JSON.stringify({ endpoint: cfg.endpoint, deployment: cfg.deployment, route: cfg.route, apiVersion: cfg.apiVersion }));
      if (cfg.apiKey) sessionStorage.setItem(CFG_SESSION_KEY, cfg.apiKey);
      else sessionStorage.removeItem(CFG_SESSION_KEY);
    } catch { /* almacenamiento no disponible */ }
  }

  function loadConfig() {
    try {
      const pub = JSON.parse(localStorage.getItem(CFG_LOCAL_KEY) || '{}');
      $('cfg-endpoint').value = pub.endpoint || '';
      $('cfg-deployment').value = pub.deployment || '';
      if (pub.route) $('cfg-route').value = pub.route;
      $('cfg-api-version').value = pub.apiVersion || '';
      $('cfg-api-key').value = sessionStorage.getItem(CFG_SESSION_KEY) || '';
    } catch { /* ignorar */ }
  }

  function aiEnabled(cfg) {
    return Boolean(cfg.endpoint && cfg.apiKey && (cfg.deployment || /chat\/completions/i.test(cfg.endpoint)));
  }

  // ---------------------------------------------------------------------------
  // Registro de decisiones
  // ---------------------------------------------------------------------------
  let auditLog = [];

  function loadLog() {
    try { auditLog = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'); } catch { auditLog = []; }
  }
  function persistLog() {
    try { localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(auditLog)); } catch { /* ignorar */ }
  }
  function record(entry) {
    auditLog.unshift(entry);
    persistLog();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  let currentBatchId = null;

  function batchEntries() {
    return currentBatchId ? auditLog.filter((e) => e.lote === currentBatchId) : [];
  }

  function renderCounters() {
    const entries = batchEntries();
    const cleared = entries.filter((e) => e.decision === DECISION.CLEARED).length;
    const review = entries.filter((e) => e.decision === DECISION.REVIEW).length;
    const total = entries.length;
    $('cnt-cleared').textContent = cleared;
    $('cnt-review').textContent = review;
    $('pct-cleared').textContent = total ? `${Math.round((cleared / total) * 100)} % del lote` : '—';
    $('pct-review').textContent = total ? `${Math.round((review / total) * 100)} % del lote` : '—';
    if (total) {
      const avg = entries.reduce((a, e) => a + e.duracion_ms, 0) / total;
      $('cnt-cycle').textContent = fmtMs(avg);
      $('cycle-sub').textContent = `por aviso · ${total} procesados`;
    } else {
      $('cnt-cycle').textContent = '—';
      $('cycle-sub').textContent = 'por aviso';
    }
  }

  function renderLog() {
    const onlyReview = $('filter-review').checked;
    const rows = auditLog.filter((e) => !onlyReview || e.decision === DECISION.REVIEW);
    $('log-count').textContent = auditLog.length ? `(${auditLog.length})` : '';
    $('log-empty').hidden = rows.length > 0;
    const tbody = $('log-body');
    tbody.replaceChildren(...rows.map((e) => {
      const tr = document.createElement('tr');
      tr.className = e.decision === DECISION.REVIEW ? 'row-review' : 'row-ok';
      const cells = [
        e.id, e.ramo, fmtEur(e.importe),
        `<span class="pill ${e.decision === DECISION.REVIEW ? 'pill-review' : 'pill-ok'}">${e.decision === DECISION.REVIEW ? 'Revisión' : 'Despejado'}</span>`,
        escapeHtml(e.motivo), e.origen, `${Math.round(e.confianza * 100)} %`, fmtMs(e.duracion_ms),
        new Date(e.timestamp).toLocaleString('es-ES'),
      ];
      tr.innerHTML = cells.map((c, i) => `<td${i === 4 ? ' class="motivo"' : ''}>${c}</td>`).join('');
      return tr;
    }));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function setProgress(done, total) {
    $('progress-bar').style.width = `${(done / total) * 100}%`;
  }

  function setStatus(id, text, kind = '') {
    const el = $(id);
    el.textContent = text;
    el.className = `status ${kind}`;
  }

  function updateModeBadge() {
    const cfg = readConfigFromForm();
    $('mode-badge').textContent = aiEnabled(cfg) ? `Motor: IA (${cfg.deployment || 'endpoint'}) + reglas` : 'Motor: reglas';
  }

  // ---------------------------------------------------------------------------
  // Procesamiento del lote
  // ---------------------------------------------------------------------------
  let running = false;

  async function triageOne(claim, cfg) {
    const rules = rulesEngine(claim);
    if (!aiEnabled(cfg)) {
      await sleep(rnd(RULES_LATENCY_MS[0], RULES_LATENCY_MS[1]));
      return { ...rules, origen: 'reglas' };
    }
    try {
      const ai = await aiTriage(claim, cfg);
      // Las reglas duras prevalecen: si detectan algo y la IA despeja, va a revisión
      if (rules.decision === DECISION.REVIEW && ai.decision === DECISION.CLEARED) {
        return { decision: DECISION.REVIEW, motivo: `Reglas: ${rules.motivo}`, confianza: rules.confianza, origen: 'reglas>IA' };
      }
      return { ...ai, origen: 'IA' };
    } catch (err) {
      console.warn('[fnol][llm] fallback a reglas', claim.id, err.message);
      if (err instanceof PermanentError) throw err; // credenciales/endpoint mal: abortar lote
      return { ...rules, origen: 'reglas (fallback IA)' };
    }
  }

  async function runBatch() {
    if (running) return;
    running = true;
    $('btn-run').disabled = true;
    const cfg = readConfigFromForm();
    saveConfig(cfg);
    updateModeBadge();

    currentBatchId = `L-${Date.now()}`;
    const claims = generateBatch(BATCH_SIZE);
    renderCounters();
    setProgress(0, claims.length);
    setStatus('run-status', `Procesando 0/${claims.length}…`);

    try {
      for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        const t0 = performance.now();
        const result = await triageOne(claim, cfg);
        const duration = performance.now() - t0;
        record({
          lote: currentBatchId,
          id: claim.id,
          ramo: claim.poliza.ramo,
          tipo: claim.siniestro.tipo,
          importe: claim.siniestro.importe_estimado,
          decision: result.decision,
          motivo: result.motivo,
          confianza: result.confianza,
          origen: result.origen,
          duracion_ms: Math.round(duration),
          timestamp: new Date().toISOString(),
          aviso: claim,
        });
        setProgress(i + 1, claims.length);
        setStatus('run-status', `Procesando ${i + 1}/${claims.length}…`);
        renderCounters();
        renderLog();
      }
      const review = batchEntries().filter((e) => e.decision === DECISION.REVIEW).length;
      setStatus('run-status', `Lote completado: ${claims.length - review} despejados, ${review} a revisión humana.`, 'ok');
    } catch (err) {
      setStatus('run-status', `Lote interrumpido: ${err.message}`, 'error');
    } finally {
      running = false;
      $('btn-run').disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Exportación
  // ---------------------------------------------------------------------------
  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    download(`fnol-registro-${isoDate(new Date())}.json`, JSON.stringify(auditLog, null, 2), 'application/json');
  }

  function exportCsv() {
    const cols = ['lote', 'id', 'ramo', 'tipo', 'importe', 'decision', 'motivo', 'confianza', 'origen', 'duracion_ms', 'timestamp'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(';'), ...auditLog.map((e) => cols.map((c) => esc(e[c])).join(';'))];
    download(`fnol-registro-${isoDate(new Date())}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
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
      $(id).addEventListener(id === 'cfg-route' ? 'change' : 'input', () => { saveConfig(readConfigFromForm()); updateModeBadge(); });
    });

    $('btn-test-ai').addEventListener('click', async () => {
      const cfg = readConfigFromForm();
      if (!aiEnabled(cfg)) { setStatus('ai-status', 'Faltan endpoint, deployment o clave.', 'error'); return; }
      setStatus('ai-status', 'Probando…');
      $('btn-test-ai').disabled = true;
      try {
        const raw = await callChat(cfg, [{ role: 'user', content: 'Responde solo con {"ok": true}' }], { maxTokens: 300 });
        setStatus('ai-status', `Conexión correcta. Respuesta: ${String(raw).slice(0, 60)}`, 'ok');
      } catch (err) {
        const hint = /api version/i.test(err.message) ? ' → Prueba otra «Ruta de API» (v1 no necesita api-version).' : '';
        setStatus('ai-status', `Error: ${err.message}${hint}`, 'error');
      } finally {
        $('btn-test-ai').disabled = false;
      }
    });

    $('btn-clear-ai').addEventListener('click', () => {
      $('cfg-api-key').value = '';
      saveConfig(readConfigFromForm());
      updateModeBadge();
      setStatus('ai-status', 'Clave eliminada de la sesión.');
    });

    $('btn-run').addEventListener('click', runBatch);
    $('btn-reset').addEventListener('click', () => {
      if (running) return;
      currentBatchId = null;
      renderCounters();
      setProgress(0, 1);
      setStatus('run-status', '');
    });
    $('filter-review').addEventListener('change', renderLog);
    $('btn-export-json').addEventListener('click', exportJson);
    $('btn-export-csv').addEventListener('click', exportCsv);
    $('btn-clear-log').addEventListener('click', () => {
      if (running || !auditLog.length) return;
      if (!confirm(`¿Borrar las ${auditLog.length} decisiones registradas en este navegador?`)) return;
      auditLog = [];
      persistLog();
      currentBatchId = null;
      renderCounters();
      renderLog();
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  loadConfig();
  loadLog();
  bind();
  updateModeBadge();
  renderCounters();
  renderLog();
})();
