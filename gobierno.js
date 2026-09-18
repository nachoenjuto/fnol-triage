/* Panel «Gobierno de Agentes»: trazabilidad, Reasoning & Replay, autonomía, guardrails
 * y FinOps de los agentes del triaje. Sin backend: renderiza un dataset (demo embebida
 * en data/gobierno.js, un JSON cargado con el mismo esquema, o el registro de la sesión
 * actual del triaje leído de sessionStorage). Iconos: icons.js (Lucide).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n, d = 2) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d });
  const num = (n) => Number(n || 0).toLocaleString('es-ES');
  const pct = (n) => `${Math.round(n * 100)} %`;
  const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(v)} ms`);
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  const fechaHora = (iso) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const ic = (name, cls = 'i') => lucide(name, cls);
  const ssGet = (k, fallback) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // ---------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------
  let G = GOBIERNO_DEMO;   // dataset activo (mismo esquema que data/gobierno-paquete-A.json)
  let AG = {};             // agentes por id (se recalcula en cada render)
  let POL = {};            // guardrails y caps por id (tooltips)
  let selId = null;        // traza seleccionada (compartida por Trazabilidad y Reasoning & Replay)
  let filtroTipo = '';     // filtro del histórico
  let periodoDias = 14;    // periodo visible en los gráficos
  let archivo = null;      // { nombre, datos } del JSON cargado
  const ocultos = new Set();      // agentes ocultos en los gráficos (leyendas interactivas)
  const tokOcultos = new Set();   // tipos de token ocultos (entrada / salida / razonamiento)
  const estados = ssGet('gobierno.estados', {}); // kill switch por agente: { id: 'activo' | 'pausado' }
  const grOverrides = {};         // guardrails activados / desactivados en la sesión

  const agColor = (id) => `var(--ag-${id}, var(--primary))`;
  const agNombre = (id) => (AG[id] ? AG[id].nombre : id);
  const agTag = (id) => `<span class="ag" style="--c:${agColor(id)}"><i class="dot"></i>${esc(agNombre(id))}</span>`;
  const CANAL = { email: ['mail', 'Email'], web: ['globe', 'Formulario web'], chat: ['messages-square', 'Chat'], telefono: ['phone', 'Teléfono'], whatsapp: ['message-circle', 'WhatsApp'] };
  const canalInfo = (c) => CANAL[c] || ['messages-square', c];
  const canal = (c) => { const [i, l] = canalInfo(c); return `<span title="${esc(l)}" style="display:inline-flex;align-items:center;gap:.3rem">${ic(i)}<span class="muted small">${esc(l)}</span></span>`; };
  const ramoPill = (r) => `<span class="pill pill-${esc(String(r || 'indeterminado').toLowerCase())}">${esc(r)}</span>`;
  const decPill = (d) => (d === 'REVISION' ? `<span class="pill pill-review">${ic('user-check')} A revisar</span>` : `<span class="pill pill-ok">${ic('circle-check')} Aprobado</span>`);
  const resPill = (t) => ({ auto: `<span class="pill pill-ok">${ic('zap')} Autónomo</span>`, humano: `<span class="pill pill-review">${ic('user-check')} Escalado</span>`, override: `<span class="pill pill-time">${ic('repeat')} Override</span>` }[t.resultado] || '');
  const lvlBadge = (n, title) => `<span class="lvl l${n}" title="${esc(title || (G.niveles[n] || {}).desc || '')}">L${n}</span>`;
  const SEV_ICON = { crit: 'triangle-alert', warn: 'circle-alert', info: 'info', ok: 'circle-check' };

  // Guardrails y caps: tooltip con la descripción en cualquier referencia (G-04, CAP-03)
  const grTip = (id) => { const p = POL[id]; if (!p) return ''; return p.tipo ? `${id} · ${p.tipo} · ${p.ambito} · límite ${p.limite} ${p.unidad} → ${p.accion}` : `${id} · ${p.condicion} → ${p.accion}${p.descripcion ? `. ${p.descripcion}` : ''}`; };
  const grRef = (id) => (POL[id] ? `<span class="gr" data-tip="${esc(grTip(id))}">${esc(id)}</span>` : esc(id));
  // Aplica sobre texto YA escapado: envuelve los códigos de guardrail / cap
  const conGuardrails = (html) => String(html).replace(/\b(G-\d{2}|CAP-\d{2})\b/g, (m) => grRef(m));

  // Coste de un span según la tabla de precios (€ por millón de tokens; razonamiento se cobra como salida)
  const spanCost = ([, , , modelo, tin, tout, treas]) => { const p = G.precios[modelo] || { in: 0, out: 0 }; return (tin * p.in + (tout + treas) * p.out) / 1e6; };
  const tr = (t) => ({ dur: Math.max(...t.spans.map((s) => s[1] + s[2])), tokens: t.spans.reduce((a, s) => a + s[4] + s[5] + s[6], 0), coste: t.spans.reduce((a, s) => a + spanCost(s), 0) });
  const diarioVisible = () => G.diario.slice(-periodoDias);
  const costeDia = (d) => d[2].reduce((a, b) => a + b, 0);
  const capDiario = () => (G.caps.find((c) => c.id === 'CAP-01') || { limite: 20 }).limite;
  const agentesPrincipales = () => G.agentes.filter((a) => a.cap_hoy != null);
  const estadoAgente = (a) => estados[a.id] || a.estado;
  const politicaActiva = (p) => (grOverrides[p.id] != null ? grOverrides[p.id] : p.activa);

  // ---------------------------------------------------------------------------
  // Fuentes de datos: demo · sesión actual del triaje · archivo JSON
  // ---------------------------------------------------------------------------
  // Convierte el registro del triaje (sessionStorage «triage.log») en trazas del panel.
  // 1 paso: un único span de IA; 2 pasos: clasificación + extracción/reglas; sin IA: motor local.
  function trazasDesdeSesion() {
    const log = ssGet('triage.log', []);
    if (!Array.isArray(log) || !log.length) return null;
    const cfg = ssGet('triage.cfg', {});
    const dep = String(cfg.deployment || '').toLowerCase();
    const modelo = /nano/.test(dep) ? 'gpt-5-nano' : /mini/.test(dep) ? 'gpt-5-mini' : 'gpt-5';
    return [...log].reverse().map((e, i) => {
      const dur = Math.max(1, e.duracion_ms || 1);
      const ia = /^IA/.test(e.origen || '');
      const u = e.usage || {};
      const tok = (x) => [x?.input || 0, x?.output || 0, x?.reasoning || 0];
      let spans;
      if (ia && e.pasos && e.pasos.length > 1) {
        const d1 = Math.round(dur * 0.3);
        spans = [['multicanal', 0, 40, 'local', 0, 0, 0], ['clasificacion', 40, d1, modelo, ...tok(e.pasos[0].usage)], ['reglas', 40 + d1, dur - 40 - d1, modelo, ...tok(e.pasos[1].usage)]];
      } else if (ia) {
        spans = [['multicanal', 0, 40, 'local', 0, 0, 0], ['ia', 40, dur - 40, modelo, ...tok(u)]];
      } else {
        spans = [['multicanal', 0, 40, 'local', 0, 0, 0], ['local', 40, dur - 40, 'local', 0, 0, 0]];
      }
      const incumple = (e.criterios || []).filter((c) => c.resultado === 'incumple').map((c) => c.regla);
      const incidencias = /fallback/i.test(e.origen || '') ? [`Fallback al motor local: ${e.origen.replace(/^.*fallback IA:\s*/i, '').replace(/\)$/, '')}`] : [];
      return {
        id: `TRZ-S${String(i + 1).padStart(3, '0')}`, mensaje: e.id, asunto: e.asunto, canal: e.mensaje?.canal || 'chat',
        inicio: new Date(new Date(e.timestamp).getTime() - dur).toISOString(), ramo: e.ramo, decision: e.decision, confianza: e.confianza ?? 0, motivo: e.motivo,
        resultado: e.decision === 'REVISION' ? 'humano' : 'auto', guardrail: incumple.length ? `${incumple.join(', ')} incumple → escalado` : undefined,
        incidencias: incidencias.length ? incidencias : undefined, spans, origen: e.origen,
      };
    });
  }

  function setFuente(f) {
    const status = $('fuente-status');
    if (f === 'sesion') {
      const trazas = trazasDesdeSesion();
      if (!trazas) { status.textContent = 'La sesión actual no tiene decisiones registradas: procesa un paquete en el triaje y vuelve a este panel (misma pestaña).'; $('fuente').value = 'demo'; return setFuente('demo'); }
      const extra = [{ id: 'ia', nombre: 'IA · clasificación + extracción + reglas (1 paso)', icono: 'sparkles', modelo: '—', prompt: '—', nivel: 2, estado: 'activo' }, { id: 'local', nombre: 'Motor local (sin IA)', icono: 'workflow', modelo: 'reglas', prompt: '—', nivel: 3, estado: 'activo' }];
      G = { ...GOBIERNO_DEMO, agentes: [...GOBIERNO_DEMO.agentes, ...extra], precios: { ...GOBIERNO_DEMO.precios, local: { in: 0, out: 0 } }, trazas, razonamiento: {} };
      status.textContent = `Trazas de la sesión actual: ${trazas.length} decisiones del registro del triaje. Histórico, caps, guardrails y modelos siguen siendo datos de demostración.`;
    } else if (f === 'archivo' && archivo) {
      G = { ...GOBIERNO_DEMO, ...archivo.datos };
      status.textContent = `Archivo ${archivo.nombre}: ${G.trazas.length} trazas, ${(G.eventos || []).length} eventos, ${(G.caps || []).length} caps.`;
    } else {
      G = GOBIERNO_DEMO;
      status.textContent = '';
    }
    selId = null;
    renderAll();
  }

  async function cargarArchivo(file) {
    try {
      const datos = JSON.parse(await file.text());
      if (!datos || typeof datos !== 'object' || !Array.isArray(datos.agentes) || !Array.isArray(datos.trazas) || !datos.trazas.every((t) => t && t.id && Array.isArray(t.spans))) throw new Error('no tiene el esquema del panel (agentes[], trazas[] con spans)');
      archivo = { nombre: file.name, datos };
      const op = $('fuente').querySelector('[value="archivo"]');
      op.disabled = false; op.textContent = `Archivo JSON · ${file.name}`;
      $('fuente').value = 'archivo';
      setFuente('archivo');
    } catch (err) {
      $('fuente-status').textContent = `No se pudo cargar el archivo: ${err.message}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Resumen: KPI, agentes, alertas, últimas trazas
  // ---------------------------------------------------------------------------
  const kpi = (t) => `<article class="card kpi kpi-${t.cls}"><span class="l">${ic(t.icono)} ${esc(t.etiqueta)}</span><span class="v">${esc(t.valor)}</span><span class="s">${conGuardrails(esc(t.sub))}</span>${t.medidor != null ? `<div class="meter" style="--c:var(--${t.cls})"><i style="width:${Math.min(100, t.medidor)}%"></i></div>` : ''}</article>`;

  function renderResumen() {
    const dias = diarioVisible();
    const totalMsgs = dias.reduce((a, d) => a + d[1], 0);
    const coste = dias.reduce((a, d) => a + costeDia(d), 0);
    const capMes = G.kpis.cap_mensual || 500;
    const [aut, esc1, ovr, alr] = G.kpis.resumen;
    $('kpis').innerHTML = [
      kpi({ cls: 'primary', icono: 'activity', etiqueta: 'Mensajes procesados', valor: num(totalMsgs), sub: `${dias.length} día${dias.length > 1 ? 's' : ''} · ${num(Math.round(totalMsgs / dias.length))} / día de media` }),
      kpi(aut), kpi(esc1), kpi(ovr),
      kpi({ cls: 'warn', icono: 'euro', etiqueta: 'Coste del periodo', valor: eur(coste, coste < 10 ? 2 : 0), sub: `${Math.round((coste / capMes) * 100)} % del cap mensual (${eur(capMes, 0)}) · ${eur(totalMsgs ? coste / totalMsgs : 0, 4)} por mensaje`, medidor: (coste / capMes) * 100 }),
      kpi(alr),
    ].join('');
    $('agents').innerHTML = agentesPrincipales().map((a) => agentCard(a, false)).join('');
    $('alerts').innerHTML = (G.alertas || []).map((a) => `<div class="alert ${a.sev}"><span class="ico">${ic(SEV_ICON[a.sev] || 'info')}</span><div><b>${conGuardrails(esc(a.titulo))}</b><small>${conGuardrails(esc(a.detalle))}</small></div><span class="muted small" style="white-space:nowrap">${esc(a.cuando || '')}</span></div>`).join('') || '<p class="muted">Sin alertas activas.</p>';
    $('ultimas').innerHTML = G.trazas.slice(-5).reverse().map((t) => rowTraza(t, false)).join('');
    $('h-ultimas').innerHTML = `${ic('route')} Últimas trazas`;
    $('coste-sub').textContent = `€/día · línea discontinua = cap diario ${eur(capDiario(), 0)}`;
    $('chart-coste').innerHTML = chartCoste();
    $('legend-coste').innerHTML = `<span><i style="background:var(--primary)"></i>Coste total / día</span><span><i style="background:var(--warn)"></i>Día ≥ 80 % del cap</span><span><i style="background:var(--crit);height:2px"></i>Cap diario global (CAP-01)</span>`;
  }

  const ESTADO = { activo: ['pill-ok', 'circle-check', 'Activo'], degradado: ['pill-warn', 'triangle-alert', 'Degradado (gpt-5-mini)'], pausado: ['pill-muted', 'pause', 'Pausado'] };
  function agentCard(a, aut) {
    const estado = estadoAgente(a);
    const [pc, pi, pl] = ESTADO[estado] || ESTADO.activo;
    const uso = a.cap_hoy ? a.coste_hoy / a.cap_hoy : 0;
    const lvl = G.niveles[a.nivel] || { nombre: '—', desc: '' };
    const guardrails = G.politicas.filter((p) => p.agente === a.id).map((p) => grRef(p.id)).join(', ') || '—';
    return `<article class="card agent${estado === 'pausado' ? ' is-off' : ''}" style="--c:${agColor(a.id)}" data-agente="${esc(a.id)}" role="button" tabindex="0" title="Ver ficha del agente">
      <div class="top"><span class="ag-ico" style="--c:${agColor(a.id)}">${ic(a.icono || 'cpu')}</span><div><strong>${esc(a.nombre)}</strong><br><span class="muted small">${esc(a.descripcion || '')}</span></div></div>
      <div class="row"><span class="pill ${pc}">${ic(pi)} ${pl}</span>${lvlBadge(a.nivel)}<span class="small muted">${esc(lvl.nombre)}</span><label class="switch${estado === 'pausado' ? ' off' : ''}" title="${estado === 'pausado' ? 'Reanudar el agente' : 'Pausar el agente (kill switch)'}" data-switch="${esc(a.id)}"><i></i>${ic('power')}</label></div>
      ${aut
        ? `<dl><dt>Umbral confianza</dt><dd>${conGuardrails(esc(a.umbral || '—'))}</dd><dt>Guardrails</dt><dd>${guardrails}</dd><dt>Escalado 14 d</dt><dd>${esc(a.escalado_14d || '—')}</dd><dt>Override 14 d</dt><dd>${esc(a.override_14d || '—')}</dd></dl>`
        : `<dl><dt>Modelo</dt><dd class="mono">${esc(a.modelo)}</dd><dt>Prompt</dt><dd class="mono">${esc(a.prompt)}</dd><dt>Latencia p95</dt><dd>${ms(a.p95_ms || 0)}</dd><dt>Coste hoy</dt><dd>${eur(a.coste_hoy)} / ${eur(a.cap_hoy, 0)} <span class="${uso >= 1 ? 'delta up' : 'muted'}">(${Math.round(uso * 100)} %)</span><div class="meter" style="--c:${uso >= 1 ? 'var(--crit)' : uso >= .8 ? 'var(--warn)' : agColor(a.id)}"><i style="width:${Math.min(100, uso * 100)}%"></i></div></dd></dl>`}
    </article>`;
  }

  // Kill switch: pausa / reanuda un agente, lo oscurece y deja rastro en el histórico
  function toggleAgente(id) {
    const a = AG[id]; if (!a) return;
    const nuevo = estadoAgente(a) === 'pausado' ? (a.estado === 'pausado' ? 'activo' : a.estado) : 'pausado';
    estados[id] = nuevo; ssSet('gobierno.estados', estados);
    G.eventos.unshift({ fecha: new Date().toISOString(), tipo: 'operacion', sev: nuevo === 'pausado' ? 'warn' : 'ok', agente: id, titulo: `${a.nombre}: ${nuevo === 'pausado' ? 'pausado con el kill switch' : 'reanudado'}`, detalle: nuevo === 'pausado' ? 'Los mensajes que dependen de este agente se encolan hasta reanudarlo; no se pierde ninguno.' : 'Se procesa la cola acumulada durante la pausa.', usuario: 'Operador (esta sesión)' });
    renderAll();
  }

  const rowTraza = (t, full) => {
    const m = tr(t);
    return `<tr class="clickable${t.id === selId ? ' is-sel' : ''}" data-id="${esc(t.id)}"><td class="mono">${esc(t.id)}</td><td class="tnum">${hora(t.inicio)}</td><td class="wrap"><strong>${esc(t.mensaje)}</strong><br><span class="muted small">${esc(t.asunto)}</span></td><td>${canal(t.canal)}</td><td>${ramoPill(t.ramo)}</td><td>${decPill(t.decision)}</td><td>${resPill(t)}</td>${full ? `<td class="tnum">${pct(t.confianza)}</td>` : ''}<td class="tnum">${ms(m.dur)}</td>${full ? `<td class="tnum">${num(m.tokens)}</td>` : ''}<td class="tnum ${m.coste > .05 ? 'delta up' : ''}">${eur(m.coste, 4)}</td>${full ? `<td class="wrap">${(t.incidencias || []).map((i) => `<span class="pill pill-warn">${ic('circle-alert')} ${conGuardrails(esc(i))}</span>`).join(' ') || '<span class="muted">—</span>'}</td>` : ''}</tr>`;
  };

  // ---------------------------------------------------------------------------
  // Lista de trazas con filtros (compartida por Trazabilidad «t-» y Reasoning & Replay «r-»)
  // ---------------------------------------------------------------------------
  function listaTrazas(pre) {
    const v = (k) => ($(`${pre}-${k}`) || {}).value || '';
    const fa = v('agente'), fc = v('canal'), fd = v('dec'), fr = v('res');
    const rows = G.trazas.filter((t) => (!fc || t.canal === fc) && (!fd || t.decision === fd) && (!fr || (fr === 'incidencia' ? (t.incidencias || []).length : t.resultado === fr)) && (!fa || t.spans.some((s) => s[0] === fa)));
    $(`${pre}-trazas`).innerHTML = rows.length ? rows.map((t) => rowTraza(t, true)).join('') : '<tr><td colspan="12" class="muted" style="text-align:center">Ninguna traza cumple el filtro.</td></tr>';
  }
  function markSel() { document.querySelectorAll('#t-trazas tr, #r-trazas tr, #ultimas tr').forEach((r) => r.classList.toggle('is-sel', r.dataset.id === selId)); }
  function selectTraza(id) { selId = id; markSel(); renderDetalle(); renderSteps(); }

  // ---------------------------------------------------------------------------
  // Ficha de una traza: mismo renderizador para el panel fijo y la modal explicada
  // ---------------------------------------------------------------------------
  function waterfall(t) {
    const total = tr(t).dur;
    return `<div class="spans">${t.spans.map((s) => `<div class="span"><span>${agTag(s[0])}</span><div class="bar" style="--c:${agColor(s[0])}" data-tip="${esc(agNombre(s[0]))}: ${ms(s[2])} · ${esc(s[3])} · ${num(s[4] + s[5] + s[6])} tokens · ${eur(spanCost(s), 4)}"><i style="left:${(s[1] / total) * 100}%;width:${Math.max(1.2, (s[2] / total) * 100)}%"></i><em style="left:${Math.min(80, ((s[1] + s[2]) / total) * 100 + 1)}%">${ms(s[2])}</em></div><span class="r mono">${esc(s[3])} · ${num(s[4])}↑ ${num(s[5])}↓${s[6] ? ` ${num(s[6])}⟳` : ''}</span></div>`).join('')}</div>`;
  }

  // Frase explicativa por agente (usa el razonamiento registrado si existe)
  function explicaSpan(t, s, i) {
    const raz = ((G.razonamiento || {})[t.id] || [])[i];
    const tok = s[4] + s[5] + s[6];
    const conModelo = tok ? ` con <span class="mono">${esc(s[3])}</span> en ${ms(s[2])} (${num(tok)} tokens${s[6] ? `, ${num(s[6])} de razonamiento` : ''}, ${eur(spanCost(s), 4)})` : ` en ${ms(s[2])}${s[3] === 'stt-es' ? ' (transcripción de voz)' : ' (sin modelo de lenguaje)'}`;
    const que = { multicanal: 'normalizó el mensaje', clasificacion: 'asignó el ramo', extraccion: 'extrajo los datos', reglas: 'evaluó las reglas del ramo', ia: 'clasificó, extrajo y aplicó las reglas', local: 'decidió con el motor local de reglas' }[s[0]] || 'procesó el mensaje';
    return `<li><span class="ag-ico" style="--c:${agColor(s[0])}">${ic((AG[s[0]] || {}).icono || 'cpu')}</span><div><strong>${esc(agNombre(s[0]))}</strong> ${que}${conModelo}.${raz ? ` <span class="muted">${esc(raz.salida)}</span>` : ''}</div></li>`;
  }

  function fichaTraza(t, modo) {
    const m = tr(t);
    const versiones = t.origen ? '—' : agentesPrincipales().map((a) => `${a.id} ${a.prompt}`).join(' · ') || '—';
    const botones = `<button class="btn btn-sm" type="button" data-goto="replay">${ic('brain')} Ver razonamiento</button><button class="btn btn-sm" type="button" data-goto="replay" data-replay="1">${ic('repeat')} Replay</button>`;
    const pills = `${ramoPill(t.ramo)} ${decPill(t.decision)} ${resPill(t)}`;
    const datos = `<dl class="kv"><dt>Inicio</dt><dd>${new Date(t.inicio).toLocaleString('es-ES')}</dd><dt>Canal</dt><dd>${canal(t.canal)}</dd><dt>Confianza</dt><dd>${pct(t.confianza)}</dd><dt>Guardrail</dt><dd>${t.guardrail ? `<span class="policy fail">${ic('shield-check')} ${conGuardrails(esc(t.guardrail))}</span>` : `<span class="policy pass">${ic('check')} Ninguno disparado</span>`}</dd><dt>Versiones</dt><dd class="mono">${esc(versiones)}</dd>${t.origen ? `<dt>Origen</dt><dd>${esc(t.origen)}</dd>` : ''}<dt>Ciclo · tokens · coste</dt><dd>${ms(m.dur)} · ${num(m.tokens)} · ${eur(m.coste, 4)}</dd><dt>Incidencias</dt><dd>${(t.incidencias || []).map((i) => `<span class="pill pill-warn">${ic('circle-alert')} ${conGuardrails(esc(i))}</span>`).join(' ') || '<span class="muted">—</span>'}</dd></dl>`;
    const override = t.override ? `<div class="box" style="border-color:var(--time)"><b>${ic('repeat')} Override humano · ${esc(t.override.usuario)} · ${hora(t.override.fecha)}</b><br><span class="pill pill-review">A revisar</span> → <span class="pill pill-ok">Aprobado</span><br><span class="small">${esc(t.override.motivo)}</span><br><span class="muted small">Se registra como «dato no accesible al modelo»: candidato a integrar la consulta de conductores declarados como herramienta del agente de Extracción.</span></div>` : '';
    if (modo === 'panel') {
      return `<div class="card-head"><h2>${ic('route')} ${esc(t.id)} · ${esc(t.mensaje)} <span class="muted" style="font-weight:400">· ${esc(t.asunto)}</span></h2><div class="row">${pills} ${botones}</div></div>
        <div class="two">
          <div><h3 style="margin-bottom:.5rem">Cadena de agentes (waterfall)</h3>${waterfall(t)}<p class="muted small" style="margin-top:.6rem">↑ tokens de entrada · ↓ salida · ⟳ razonamiento.</p>${t.motivo ? `<p class="small" style="margin-top:.5rem"><b>Motivo:</b> ${esc(t.motivo)}</p>` : ''}</div>
          <div class="detail">${datos}${override}</div>
        </div>`;
    }
    // Modal: ficha explicada paso a paso
    const [ci, cl] = canalInfo(t.canal);
    return `<div class="row">${pills} ${botones}</div>
      <div><h3>Qué llegó</h3><p class="small">${ic(ci)} <b>${esc(t.mensaje)}</b> · «${esc(t.asunto)}» · recibido por <b>${esc(cl)}</b> · procesado el ${new Date(t.inicio).toLocaleString('es-ES')}.</p></div>
      <div><h3>Qué hizo cada agente</h3><div class="explica"><ul>${t.spans.map((s, i) => explicaSpan(t, s, i)).join('')}</ul></div></div>
      <div><h3>Cadena de agentes (waterfall)</h3>${waterfall(t)}<p class="muted small" style="margin-top:.4rem">↑ tokens de entrada · ↓ salida · ⟳ razonamiento · ciclo total ${ms(m.dur)} · ${num(m.tokens)} tokens · ${eur(m.coste, 4)}.</p></div>
      <div><h3>Decisión</h3><p class="small">${decPill(t.decision)} con confianza ${pct(t.confianza)} · ${t.resultado === 'auto' ? 'ejecutada de forma autónoma, sin intervención humana' : t.resultado === 'override' ? 'escalada a una persona, que cambió la decisión (override)' : 'escalada a una persona por un guardrail'}.${t.motivo ? ` <b>Motivo:</b> ${esc(t.motivo)}` : ''}</p>${t.guardrail ? `<p class="small" style="margin-top:.4rem"><span class="policy fail">${ic('shield-check')} ${conGuardrails(esc(t.guardrail))}</span> <span class="muted">— pasa el ratón por el código para ver la regla</span></p>` : ''}</div>
      ${override}
      <div class="two"><div><h3>Datos de la traza</h3>${datos}</div><div><h3>Coste</h3><div class="kpi-mini"><div class="box"><span class="muted small">Coste</span><b>${eur(m.coste, 4)}</b></div><div class="box"><span class="muted small">Tokens</span><b>${num(m.tokens)}</b></div><div class="box"><span class="muted small">Ciclo</span><b>${ms(m.dur)}</b></div></div>${m.coste > 0.05 ? `<p class="small" style="margin-top:.5rem;color:var(--crit)">${ic('triangle-alert')} Por encima del cap por traza (${grRef('CAP-04')}).</p>` : ''}</div></div>`;
  }

  function renderDetalle() {
    const t = G.trazas.find((x) => x.id === selId) || G.trazas[G.trazas.length - 1];
    if (!t) { $('traza-detalle').innerHTML = '<p class="muted">Sin trazas.</p>'; return; }
    selId = t.id;
    $('traza-detalle').innerHTML = fichaTraza(t, 'panel');
    $('r-summary-sel').innerHTML = `· seleccionada <span class="mono">${esc(t.id)}</span> · ${esc(t.mensaje)}`;
    $('r-traza-sel').innerHTML = `<span class="mono">${esc(t.id)}</span> · ${esc(t.mensaje)} · ${esc(t.asunto)}`;
    markSel();
  }

  function abrirModalTraza(id) {
    const t = G.trazas.find((x) => x.id === id); if (!t) return;
    selId = id; markSel(); renderDetalle(); renderSteps();
    $('modal-traza-title').innerHTML = `${ic('route')} ${esc(t.id)} · ${esc(t.mensaje)} <span class="muted" style="font-weight:400">· ${esc(t.asunto)}</span>`;
    $('modal-traza-body').innerHTML = fichaTraza(t, 'modal');
    $('modal-traza').showModal();
  }

  // ---------------------------------------------------------------------------
  // Reasoning & Replay
  // ---------------------------------------------------------------------------
  function renderSteps() {
    const t = G.trazas.find((x) => x.id === selId);
    const steps = t && (G.razonamiento || {})[t.id];
    if (!t) { $('steps').innerHTML = '<p class="muted">Sin trazas.</p>'; renderDiff(false); return; }
    if (!steps) {
      $('steps').innerHTML = `<div class="box"><b>${ic('info')} ${esc(t.id)} · ${esc(t.mensaje)}</b><br><span class="small">Esta traza no tiene razonamiento registrado por agente (solo lo llevan las fichas de demostración). En producción cada agente devolvería su registro estructurado: entrada, pasos y salida.</span>${t.guardrail ? `<br><span class="policy fail" style="margin-top:.4rem">${ic('shield-check')} ${conGuardrails(esc(t.guardrail))}</span>` : ''}</div>`;
      renderDiff(false); return;
    }
    $('steps').innerHTML = steps.map((s, i) => { const sp = t.spans[i] || ['', 0, 0, '—', 0, 0, 0]; return `<div class="step" style="--c:${agColor(s.agente)}">
      <div class="h"><span class="ag-ico" style="--c:${agColor(s.agente)}">${ic((AG[s.agente] || {}).icono || 'cpu')}</span><strong>${esc(agNombre(s.agente))}</strong><span class="muted small mono">${esc(sp[3])} · ${ms(sp[2])} · ${num(sp[4] + sp[5] + sp[6])} tok</span></div>
      <div class="io"><div class="box"><span class="muted small">Entrada</span><br>${esc(s.entrada)}</div><div class="box"><span class="muted small">Salida</span><br>${esc(s.salida)}</div></div>
      <ul>${s.pasos.map((p) => `<li>${conGuardrails(esc(p))}</li>`).join('')}</ul>
    </div>`; }).join('');
    renderDiff(false);
  }

  // Replay simulado: «idéntico» reproduce la decisión; «what-if» estima coste/latencia con otro modelo o prompt de Reglas
  function renderDiff(run) {
    const t = G.trazas.find((x) => x.id === selId);
    if (!t) { $('rp-diff').innerHTML = ''; return; }
    const m = tr(t);
    const whatif = $('rp-modo').value === 'whatif'; const modelo = $('rp-modelo').value.split(' ')[0]; const prompt = $('rp-prompt').value.split(' ')[0];
    if (!run) { $('rp-diff').innerHTML = `<div class="box" style="grid-column:1/-1"><b>${ic('info')} Replay de ${esc(t.id)} · ${esc(t.mensaje)}</b><br><span class="small">El replay vuelve a ejecutar la cadena de agentes con el mensaje original congelado. <b>Idéntico</b> verifica que la decisión es reproducible (mismos prompts, modelos y semilla). <b>What-if</b> permite cambiar el modelo o la versión del prompt de un agente y comparar decisión, motivo, coste y latencia con la ejecución original. Ningún replay altera la decisión registrada: se guarda como ejecución aparte en el histórico.</span></div>`; return; }
    const chg = whatif && (modelo !== 'gpt-5' || prompt !== 'v2.3');
    const factor = !chg ? 1 : modelo === 'gpt-5-mini' ? .18 : modelo === 'gpt-5-nano' ? .04 : .82;
    const lat = !chg ? 1.06 : modelo === 'gpt-5-mini' ? .59 : modelo === 'gpt-5-nano' ? .45 : .88;
    const cambia = chg && modelo === 'gpt-5-nano' && t.decision === 'REVISION';
    const dec2 = cambia ? 'DESPEJADO' : t.decision;
    const motivo2 = !chg ? 'Idéntico al original' : cambia ? 'gpt-5-nano no detecta la regla incumplida: pasa a Aprobado (regresión)' : prompt === 'v2.4' ? 'Misma decisión; el motivo cita el guardrail por su código (G-04) y es 18 % más corto' : 'Misma decisión y mismas reglas incumplidas';
    const d = (v) => `<span class="delta ${Math.abs(v) < .005 ? 'same' : v < 0 ? 'down' : 'up'}">${v > 0 ? '+' : ''}${Math.round(v * 100)} %</span>`;
    $('rp-diff').innerHTML = `
      <div class="box"><h4>Original · ${hora(t.inicio)}</h4><dl class="kv"><dt>Ramo</dt><dd>${ramoPill(t.ramo)}</dd><dt>Decisión</dt><dd>${decPill(t.decision)}</dd><dt>Confianza</dt><dd>${pct(t.confianza)}</dd><dt>Coste</dt><dd>${eur(m.coste, 4)}</dd><dt>Ciclo</dt><dd>${ms(m.dur)}</dd><dt>Reglas · modelo</dt><dd class="mono">gpt-5 · v2.3</dd></dl></div>
      <div class="box" style="border-color:${cambia ? 'var(--crit)' : 'var(--ok)'}"><h4>Replay · ${whatif ? 'what-if' : 'idéntico'} · ahora</h4><dl class="kv"><dt>Ramo</dt><dd>${ramoPill(t.ramo)} <span class="delta same">igual</span></dd><dt>Decisión</dt><dd>${decPill(dec2)} ${cambia ? '<span class="delta up">DISTINTA</span>' : '<span class="delta same">igual</span>'}</dd><dt>Confianza</dt><dd>${pct(cambia ? .71 : chg ? Math.max(0, t.confianza - .02) : t.confianza)}</dd><dt>Coste</dt><dd>${eur(m.coste * factor, 4)} ${d(factor - 1)}</dd><dt>Ciclo</dt><dd>${ms(Math.round(m.dur * lat))} ${d(lat - 1)}</dd><dt>Reglas · modelo</dt><dd class="mono">${esc(modelo)} · ${esc(prompt)}</dd></dl><p class="small" style="margin-top:.5rem"><b>Motivo:</b> ${conGuardrails(esc(motivo2))}</p>${cambia ? `<p class="small" style="color:var(--crit)"><b>${ic('triangle-alert')} Regresión:</b> el cambio no es seguro para este tipo de mensaje.</p>` : ''}</div>`;
  }

  function renderReplays() {
    const delta = (v) => `<span class="delta ${v < -0.01 ? 'down' : v > 0.01 ? 'up' : 'same'}">${v > 0 ? '+' : ''}${Math.round(v * 100)} %</span>`;
    $('replays').innerHTML = (G.replays || []).map((r) => `<tr><td class="mono">${esc(r.id)}</td><td class="tnum">${fechaHora(r.fecha)}</td><td class="mono">${esc(r.traza)}</td><td>${esc(r.modo)}</td><td>${esc(r.cambio)}</td><td><span class="delta same">${esc(r.ramo)}</span></td><td>${String(r.decision).startsWith('DISTINTA') ? `<span class="delta up">${esc(r.decision)}</span>` : `<span class="delta same">${esc(r.decision)}</span>`}</td><td>${delta(r.dcoste)}</td><td>${delta(r.dlat)}</td><td>${esc(r.usuario)}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">Sin replays registrados.</td></tr>';
  }

  // ---------------------------------------------------------------------------
  // Autonomía (niveles, agentes, auditoría) y ficha modal del agente
  // ---------------------------------------------------------------------------
  const CAMBIO_ICON = { nivel: 'sliders-horizontal', modelo: 'cpu', prompt: 'file-text', guardrail: 'shield-check', incidencia: 'activity' };
  function renderAutonomia() {
    $('kpis-aut').innerHTML = G.kpis.autonomia.map(kpi).join('');
    $('levels').innerHTML = G.niveles.map((l) => `<div class="level l${l.n}"><b>${lvlBadge(l.n, l.desc)} ${esc(l.nombre)}</b><span class="muted">${esc(l.desc)}</span><span class="small">${agentesPrincipales().filter((a) => a.nivel === l.n).map((a) => agTag(a.id)).join(' ') || '<span class="muted">sin agentes</span>'}</span></div>`).join('');
    $('agents-aut').innerHTML = agentesPrincipales().map((a) => agentCard(a, true)).join('');
    $('cambios').innerHTML = (G.cambios_autonomia || []).map((c) => `<tr><td class="tnum">${fechaHora(c.fecha)}</td><td>${agTag(c.agente)}</td><td>${c.de === c.a ? `${lvlBadge(c.a)} <span class="muted small">sin cambio</span>` : `${lvlBadge(c.de)} → ${lvlBadge(c.a)}`}</td><td class="wrap">${conGuardrails(esc(c.motivo))}</td><td>${esc(c.usuario)}</td></tr>`).join('');
  }

  function abrirModalAgente(id) {
    const a = AG[id]; if (!a) return;
    const estado = estadoAgente(a); const [pc, pi, pl] = ESTADO[estado] || ESTADO.activo;
    const lvl = G.niveles[a.nivel] || { nombre: '—', desc: '' };
    const hist = [...(a.historial || [])].sort((x, y) => y.fecha.localeCompare(x.fecha));
    const tl = (items) => items.length ? `<ul class="mini-tl">${items.map((h) => `<li><span class="t">${fechaHora(h.fecha)}</span><span class="ico" style="--c:${agColor(a.id)}">${ic(CAMBIO_ICON[h.tipo] || 'info')}</span><div><b>${esc(h.tipo === 'nivel' ? 'Nivel' : h.tipo === 'modelo' ? 'Modelo' : h.tipo === 'prompt' ? 'Prompt' : h.tipo === 'guardrail' ? 'Guardrail' : 'Incidencia')}: ${conGuardrails(esc(h.de))} → ${conGuardrails(esc(h.a))}</b><small>${conGuardrails(esc(h.motivo))} · ${esc(h.usuario)}</small></div></li>`).join('')}</ul>` : '<p class="muted small">Sin registros.</p>';
    $('modal-agente-title').innerHTML = `<span class="ag-ico" style="--c:${agColor(a.id)}">${ic(a.icono || 'cpu')}</span> ${esc(a.nombre)} <span class="pill ${pc}">${ic(pi)} ${pl}</span> ${lvlBadge(a.nivel)} <span class="muted small" style="font-weight:400">${esc(lvl.nombre)}</span>`;
    $('modal-agente-body').innerHTML = `
      <p class="small muted">${esc(a.descripcion || '')}</p>
      <div class="kpi-mini">
        <div class="box"><span class="muted small">Modelo actual</span><b class="mono" style="font-size:.95rem">${esc(a.modelo)}</b></div>
        <div class="box"><span class="muted small">Prompt</span><b class="mono" style="font-size:.95rem">${esc(a.prompt)}</b></div>
        <div class="box"><span class="muted small">Escalado 14 d</span><b>${esc(a.escalado_14d || '—')}</b></div>
        <div class="box"><span class="muted small">Override 14 d</span><b>${esc(a.override_14d || '—')}</b></div>
        <div class="box"><span class="muted small">Coste hoy / cap</span><b>${eur(a.coste_hoy || 0)} / ${eur(a.cap_hoy || 0, 0)}</b></div>
        <div class="box"><span class="muted small">Latencia p95</span><b>${ms(a.p95_ms || 0)}</b></div>
      </div>
      <div class="two">
        <div><h3>Histórico de autonomía</h3>${tl(hist.filter((h) => h.tipo === 'nivel' || h.tipo === 'guardrail'))}</div>
        <div><h3>Cambios de modelo, prompt e incidencias</h3>${tl(hist.filter((h) => h.tipo === 'modelo' || h.tipo === 'prompt' || h.tipo === 'incidencia'))}</div>
      </div>
      <div><h3>Comportamiento según el modelo</h3><div class="tw"><table><thead><tr><th>Modelo</th><th>Periodo</th><th>Precisión</th><th>Escalado</th><th>Override</th><th>Coste / mensaje</th><th>p95</th></tr></thead><tbody>${(a.modelos || []).map((mo) => `<tr><td class="mono">${esc(mo.modelo)}</td><td>${esc(mo.periodo)}</td><td>${esc(mo.precision)}</td><td class="tnum">${esc(mo.escalado)}</td><td class="tnum">${esc(mo.override)}</td><td class="tnum">${esc(mo.coste_msg)}</td><td class="tnum">${ms(mo.p95_ms)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin datos por modelo.</td></tr>'}</tbody></table></div></div>
      <div><h3>Variables que afectan a su comportamiento</h3><div class="tw"><table><thead><tr><th>Variable</th><th>Valor</th><th>Efecto</th></tr></thead><tbody>${(a.variables || []).map((v) => `<tr><td><b>${esc(v.nombre)}</b></td><td class="wrap">${conGuardrails(esc(v.valor))}</td><td class="wrap">${conGuardrails(esc(v.efecto))}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sin variables registradas.</td></tr>'}</tbody></table></div></div>
      <div><h3>Guardrails que lo limitan</h3><p class="small">${G.politicas.filter((p) => p.agente === a.id).map((p) => `${grRef(p.id)} ${politicaActiva(p) ? '' : '<span class="muted small">(inactivo)</span>'}`).join(' · ') || '<span class="muted">Ninguno</span>'}</p></div>`;
    $('modal-agente').showModal();
  }

  // ---------------------------------------------------------------------------
  // Guardrails
  // ---------------------------------------------------------------------------
  const SEV = { humano: 'Escala a persona', degradar: 'Degrada el modelo', marcar: 'Marca la traza' };
  function renderGuardrails() {
    const P = G.politicas;
    const activos = P.filter(politicaActiva).length;
    const disparos = P.reduce((a, p) => a + (p.disparos || 0), 0);
    const escaladosGr = P.filter((p) => p.severidad === 'humano').reduce((a, p) => a + (p.disparos || 0), 0);
    $('kpis-gr').innerHTML = [
      kpi({ cls: 'ok', icono: 'shield-check', etiqueta: 'Guardrails activos', valor: `${activos} / ${P.length}`, sub: `${P.length - activos} inactivo${P.length - activos === 1 ? '' : 's'}` }),
      kpi({ cls: 'review', icono: 'bell', etiqueta: 'Disparos en 14 días', valor: num(disparos), sub: `${num(escaladosGr)} escalados a persona · resto degradaciones y marcas` }),
      kpi({ cls: 'time', icono: 'user-check', etiqueta: 'Escalados que vienen de un guardrail', valor: `${Math.round((escaladosGr / 3180) * 100)} %`, sub: 'de los 3.180 escalados del periodo; el resto por confianza o discrepancia' }),
      kpi({ cls: 'primary', icono: 'gauge', etiqueta: 'Más disparado', valor: [...P].sort((x, y) => y.disparos - x.disparos)[0]?.id || '—', sub: [...P].sort((x, y) => y.disparos - x.disparos)[0]?.condicion || '' }),
    ].join('');
    $('policies').innerHTML = P.map((p) => { const max = Math.max(1, ...(p.disparos_dia || [1])); const activa = politicaActiva(p); return `<tr class="${activa ? '' : 'muted'}"><td class="mono"><b>${esc(p.id)}</b></td><td>${agTag(p.agente)}</td><td class="wrap">${esc(p.condicion)}<br><small class="muted">${esc(p.descripcion || '')}</small></td><td class="wrap">${esc(p.accion)}</td><td><span class="sev sev-${esc(p.severidad || 'humano')}">${SEV[p.severidad] || esc(p.severidad)}</span></td><td><span class="tnum" style="display:inline-block;min-width:2.2rem"><b>${num(p.disparos)}</b></span> <span class="bars" style="--c:${agColor(p.agente)}" data-tip="Disparos por día (últimos 14 días): ${(p.disparos_dia || []).join(' · ')}">${(p.disparos_dia || []).map((v) => `<i style="height:${Math.max(2, (v / max) * 18)}px"></i>`).join('')}</span></td><td><label class="switch${activa ? '' : ' off'}" data-guardrail="${esc(p.id)}" title="${activa ? 'Desactivar' : 'Activar'} ${esc(p.id)}"><i></i>${activa ? 'Activo' : 'Inactivo'}</label></td></tr>`; }).join('');
    const ultimos = P.flatMap((p) => (p.ultimos || []).map(([f, traza, res]) => ({ f, id: p.id, agente: p.agente, traza, res }))).sort((x, y) => y.f.localeCompare(x.f));
    $('h-disparos').innerHTML = `${ic('history')} Últimos disparos`;
    $('disparos').innerHTML = ultimos.map((u) => { const tid = (u.traza.match(/TRZ-[0-9A-Z]+/) || [])[0]; const existe = tid && G.trazas.some((t) => t.id === tid); return `<tr><td class="tnum">${fechaHora(u.f)}</td><td>${grRef(u.id)}</td><td>${agTag(u.agente)}</td><td class="mono">${existe ? `<button class="btn btn-sm" type="button" data-traza="${esc(tid)}">${ic('route')} ${esc(u.traza)}</button>` : esc(u.traza)}</td><td>${esc(u.res)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Sin disparos registrados.</td></tr>';
  }
  function toggleGuardrail(id) {
    const p = G.politicas.find((x) => x.id === id); if (!p) return;
    const nuevo = !politicaActiva(p); grOverrides[id] = nuevo;
    G.eventos.unshift({ fecha: new Date().toISOString(), tipo: 'politica', sev: nuevo ? 'ok' : 'warn', agente: p.agente, titulo: `${p.id} ${nuevo ? 'activado' : 'desactivado'}: ${p.condicion}`, detalle: nuevo ? `Vuelve a aplicarse «${p.accion}».` : `Deja de aplicarse «${p.accion}» hasta reactivarlo.`, usuario: 'Operador (esta sesión)' });
    renderAll();
  }

  // ---------------------------------------------------------------------------
  // Gráficos SVG inline (sin librerías) con tooltip y leyendas interactivas
  // ---------------------------------------------------------------------------
  const ticksDe = (ymax) => [...new Set([0, .25, .5, .75, 1].map((f) => Math.round((ymax * f) / 5) * 5))];
  const legendBtn = (key, kind, color, label) => `<button type="button" class="${(kind === 'agente' ? ocultos : tokOcultos).has(key) ? 'off' : ''}" data-legend="${esc(kind)}" data-key="${esc(key)}"><i style="background:${color}"></i>${esc(label)}</button>`;

  function chartCoste() {
    const D = diarioVisible(), cap = capDiario();
    const W = 640, H = 220, pl = 40, pr = 16, pt = 14, pb = 28;
    const ymax = Math.max(cap * 1.25, ...D.map(costeDia)) * 1.05;
    const xs = (i) => (D.length > 1 ? pl + (i / (D.length - 1)) * (W - pl - pr) : (W + pl - pr) / 2), ys = (v) => pt + (1 - v / ymax) * (H - pt - pb);
    const pts = D.map((d, i) => [xs(i), ys(costeDia(d))]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${ys(0)} L${pts[0][0].toFixed(1)},${ys(0)} Z`;
    const last = pts[pts.length - 1];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coste diario total frente al cap diario">
      <g class="grid">${ticksDe(ymax).map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${ys(v)}" y2="${ys(v)}"/><text x="${pl - 6}" y="${ys(v) + 4}" text-anchor="end">${v} €</text>`).join('')}</g>
      <path d="${area}" fill="var(--primary)" opacity=".1"/>
      <line x1="${pl}" x2="${W - pr}" y1="${ys(cap)}" y2="${ys(cap)}" stroke="var(--crit)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - pr}" y="${ys(cap) - 5}" text-anchor="end" style="fill:var(--crit);font-weight:700">cap ${eur(cap, 0)}</text>
      <path d="${line}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="${costeDia(D[i]) >= cap * .8 ? 'var(--warn)' : 'var(--primary)'}" stroke="var(--surface)" stroke-width="2"/><rect x="${p[0] - 18}" y="${pt}" width="36" height="${H - pt - pb}" fill="transparent" data-tip="${fecha(D[i][0])} · ${eur(costeDia(D[i]))} · ${num(D[i][1])} mensajes"/>`).join('')}
      <text x="${last[0]}" y="${last[1] - 10}" text-anchor="end" style="fill:var(--text);font-weight:700">${eur(costeDia(D[D.length - 1]))} hoy (parcial)</text>
      ${D.map((d, i) => (D.length > 8 && i % 2 ? '' : `<text x="${xs(i)}" y="${H - 8}" text-anchor="middle">${fecha(d[0])}</text>`)).join('')}
    </svg>`;
  }

  function chartStack() {
    const D = diarioVisible(), cap = capDiario(), n = D.length;
    const ids = G.agentes.slice(0, 4).map((a) => a.id);
    const vis = (d) => d[2].reduce((a, v, k) => a + (ocultos.has(ids[k]) ? 0 : v), 0);
    const W = 640, H = 240, pl = 40, pr = 16, pt = 14, pb = 28;
    const ymax = Math.max(cap * 1.25, ...D.map(vis)) * 1.05;
    const bw = Math.min(24, ((W - pl - pr) / n) * .62), xs = (i) => pl + ((i + .5) / n) * (W - pl - pr), ys = (v) => pt + (1 - v / ymax) * (H - pt - pb);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coste diario apilado por agente">
      <g class="grid">${ticksDe(ymax).map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${ys(v)}" y2="${ys(v)}"/><text x="${pl - 6}" y="${ys(v) + 4}" text-anchor="end">${v} €</text>`).join('')}</g>
      ${D.map((d, i) => { let acc = 0; const segs = d[2].map((v, k) => [ids[k], v]).filter(([id]) => !ocultos.has(id)); return segs.map(([id, v], k) => { const y0 = ys(acc), y1 = ys(acc + v); acc += v; const top = k === segs.length - 1; return `<rect x="${xs(i) - bw / 2}" y="${y1 + (top ? 0 : 1)}" width="${bw}" height="${Math.max(0, y0 - y1 - 1)}" rx="${top ? 3 : 0}" fill="${agColor(id)}" data-tip="${fecha(d[0])} · ${esc(agNombre(id))}: ${eur(v)} de ${eur(vis(d))}"/>`; }).join(''); }).join('')}
      <line x1="${pl}" x2="${W - pr}" y1="${ys(cap)}" y2="${ys(cap)}" stroke="var(--crit)" stroke-width="1.5" stroke-dasharray="5 4"/>
      ${D.map((d, i) => (n > 8 && i % 2 ? '' : `<text x="${xs(i)}" y="${H - 8}" text-anchor="middle">${fecha(d[0])}</text>`)).join('')}
    </svg>`;
  }

  const TOK = [['in', 'Entrada', 'var(--primary)'], ['out', 'Salida', 'var(--ag-clasificacion)'], ['reasoning', 'Razonamiento', 'var(--ag-extraccion)']];
  function chartTokens() {
    const tot = G.agentes.filter((a) => !ocultos.has(a.id)).map((a) => { const s = G.trazas.flatMap((t) => t.spans.filter((x) => x[0] === a.id)); return [a, [s.reduce((v, x) => v + x[4], 0), s.reduce((v, x) => v + x[5], 0), s.reduce((v, x) => v + x[6], 0)].map((v, k) => (tokOcultos.has(TOK[k][0]) ? 0 : v))]; }).filter((t) => t[1][0] + t[1][1] + t[1][2] > 0);
    if (!tot.length) return '<p class="muted small">Sin tokens que mostrar con los filtros actuales.</p>';
    const W = 640, rowH = 44, H = 14 + tot.length * rowH, pl = 170, pr = 60, max = Math.max(...tot.map((t) => t[1][0] + t[1][1] + t[1][2]));
    const xs = (v) => pl + (v / max) * (W - pl - pr);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tokens del lote por agente: entrada, salida y razonamiento">
      ${tot.map(([a, vals], i) => { const y = 14 + i * rowH; let acc = 0; const segs = vals.map((v, k) => [k, v]).filter(([, v]) => v > 0); return `<text x="${pl - 10}" y="${y + 15}" text-anchor="end" style="fill:var(--text);font-weight:600">${esc(a.nombre.length > 24 ? `${a.nombre.slice(0, 22)}…` : a.nombre)}</text>${segs.map(([k, v], j) => { const x0 = xs(acc); acc += v; const w = Math.max(0, xs(acc) - x0 - 2); return `<rect x="${x0}" y="${y}" width="${w}" height="22" rx="${j === segs.length - 1 ? 4 : 0}" fill="${TOK[k][2]}" data-tip="${esc(a.nombre)} · ${TOK[k][1]}: ${num(v)} tokens"/>`; }).join('')}<text x="${xs(acc) + 6}" y="${y + 15}" class="tnum">${(acc / 1000).toFixed(1).replace('.', ',')}k</text>`; }).join('')}
    </svg>`;
  }

  // Coste por modelo apilado por agente (barras horizontales)
  function chartModelos() {
    const M = (G.modelos || []).map((mo) => [mo, Object.entries(mo.coste_por_agente || {}).filter(([id]) => !ocultos.has(id))]).filter(([, segs]) => segs.length);
    if (!M.length) return '<p class="muted small">Sin modelos que mostrar con los filtros actuales.</p>';
    const W = 640, rowH = 40, H = 14 + M.length * rowH, pl = 100, pr = 70, max = Math.max(...M.map(([, segs]) => segs.reduce((a, [, v]) => a + v, 0)));
    const xs = (v) => pl + (v / max) * (W - pl - pr);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coste de 14 días por modelo, apilado por agente">
      ${M.map(([mo, segs], i) => { const y = 14 + i * rowH; let acc = 0; return `<text x="${pl - 10}" y="${y + 15}" text-anchor="end" style="fill:var(--text);font-weight:600" class="mono">${esc(mo.id)}</text>${segs.map(([id, v], j) => { const x0 = xs(acc); acc += v; const w = Math.max(0, xs(acc) - x0 - 2); return `<rect x="${x0}" y="${y}" width="${w}" height="22" rx="${j === segs.length - 1 ? 4 : 0}" fill="${agColor(id)}" data-tip="${esc(mo.id)} · ${esc(agNombre(id))}: ${eur(v)}"/>`; }).join('')}<text x="${xs(acc) + 6}" y="${y + 15}" class="tnum">${eur(acc, 0)}</text>`; }).join('')}
    </svg>`;
  }

  // Tokens por modelo (entrada / salida / razonamiento, en millones)
  function chartModelosTok() {
    const M = (G.modelos || []).filter((mo) => mo.tokens && (mo.tokens.in + mo.tokens.out + mo.tokens.reasoning) > 0);
    const keys = TOK.filter(([k]) => !tokOcultos.has(k));
    if (!M.length || !keys.length) return '<p class="muted small">Sin tokens que mostrar con los filtros actuales.</p>';
    const W = 640, H = 220, pl = 44, pr = 16, pt = 14, pb = 28, n = M.length;
    const max = Math.max(...M.flatMap((mo) => keys.map(([k]) => mo.tokens[k]))) / 1e6;
    const ymax = Math.max(1, Math.ceil(max * 1.1));
    const gw = (W - pl - pr) / n, bw = Math.min(22, (gw * .7) / keys.length);
    const ys = (v) => pt + (1 - v / ymax) * (H - pt - pb);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tokens por modelo en millones: entrada, salida y razonamiento">
      <g class="grid">${[0, .25, .5, .75, 1].map((f) => { const v = Math.round(ymax * f * 10) / 10; return `<line x1="${pl}" x2="${W - pr}" y1="${ys(v)}" y2="${ys(v)}"/><text x="${pl - 6}" y="${ys(v) + 4}" text-anchor="end">${v} M</text>`; }).join('')}</g>
      ${M.map((mo, i) => { const cx = pl + gw * (i + .5); const x0 = cx - (bw * keys.length + 2 * (keys.length - 1)) / 2; return keys.map(([k, label, color], j) => { const v = mo.tokens[k] / 1e6; return `<rect x="${x0 + j * (bw + 2)}" y="${ys(v)}" width="${bw}" height="${Math.max(0, ys(0) - ys(v))}" rx="3" fill="${color}" data-tip="${esc(mo.id)} · ${label}: ${num(mo.tokens[k])} tokens"/>`; }).join('') + `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="mono">${esc(mo.id)}</text>`; }).join('')}
    </svg>`;
  }

  function renderCharts() {
    const ids = G.agentes.slice(0, 4);
    $('chart-stack').innerHTML = chartStack();
    $('legend-stack').innerHTML = ids.map((a) => legendBtn(a.id, 'agente', agColor(a.id), a.nombre)).join('') + `<span><i style="background:var(--crit);height:2px"></i>Cap diario global</span>`;
    $('chart-tokens').innerHTML = chartTokens();
    $('legend-tokens').innerHTML = TOK.map(([k, l, c]) => legendBtn(k, 'token', c, l)).join('');
    $('chart-modelos').innerHTML = chartModelos();
    $('legend-modelos').innerHTML = ids.map((a) => legendBtn(a.id, 'agente', agColor(a.id), a.nombre)).join('');
    $('chart-modelos-tok').innerHTML = chartModelosTok();
    $('legend-modelos-tok').innerHTML = TOK.map(([k, l, c]) => legendBtn(k, 'token', c, l)).join('');
  }

  // ---------------------------------------------------------------------------
  // FinOps: KPI, caps, modelos, recomendaciones
  // ---------------------------------------------------------------------------
  const CAP_ESTADO = { ok: ['pill-ok', 'check', 'Dentro'], aviso: ['pill-warn', 'circle-alert', 'Aviso ≥ 80 %'], superado: ['pill-crit', 'triangle-alert', 'Superado'] };
  function renderFinops() {
    const dias = diarioVisible(), hoy = G.diario[G.diario.length - 1], cap = capDiario();
    const totalMsgs = dias.reduce((a, d) => a + d[1], 0), coste = dias.reduce((a, d) => a + costeDia(d), 0);
    const porAgente = G.agentes.slice(0, 4).map((a, k) => [a.nombre, dias.reduce((s, d) => s + (d[2][k] || 0), 0)]);
    const reparto = porAgente.sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n.split(' ')[0]} ${Math.round((v / coste) * 100)} %`).join(' · ');
    $('kpis-fin').innerHTML = [
      kpi({ cls: 'warn', icono: 'euro', etiqueta: 'Coste hoy (parcial)', valor: eur(costeDia(hoy)), sub: `${Math.round((costeDia(hoy) / cap) * 100)} % del cap diario (${eur(cap, 0)}) · ${num(hoy[1])} mensajes`, medidor: (costeDia(hoy) / cap) * 100 }),
      ...G.kpis.finops.map(kpi),
      kpi({ cls: 'time', icono: 'cpu', etiqueta: 'Coste medio por mensaje', valor: eur(totalMsgs ? coste / totalMsgs : 0, 4), sub: reparto }),
    ].join('');
    $('caps').innerHTML = G.caps.map((c) => { const u = c.consumo / c.limite; const [pc, pi, pl] = CAP_ESTADO[c.estado] || CAP_ESTADO.ok; const f = (v) => (c.unidad === '€' ? eur(v, v < 1 ? 3 : 2) : `${num(v)} ${esc(c.unidad)}`); return `<tr><td class="mono"><b>${esc(c.id)}</b></td><td>${esc(c.ambito)}</td><td>${esc(c.tipo)}</td><td class="tnum">${f(c.limite)}</td><td class="tnum">${f(c.consumo)}</td><td><div class="meter" style="--c:${u >= 1 ? 'var(--crit)' : u >= .8 ? 'var(--warn)' : 'var(--ok)'};margin:0"><i style="width:${Math.min(100, u * 100)}%"></i></div><span class="small muted tnum">${Math.round(u * 100)} %</span></td><td class="wrap">${conGuardrails(esc(c.accion))}</td><td><span class="pill ${pc}">${ic(pi)} ${pl}</span></td></tr>`; }).join('');
    const totalModelos = (G.modelos || []).reduce((a, mo) => a + (mo.coste || 0), 0);
    $('modelos').innerHTML = (G.modelos || []).map((mo) => { const p = G.precios[mo.id]; const share = totalModelos ? mo.coste / totalModelos : 0; return `<tr><td class="mono"><b>${esc(mo.id)}</b></td><td>${esc(mo.proveedor)}</td><td class="tnum">${p ? `${eur(p.in)} / ${eur(p.out)} por M` : '—'}</td><td>${(mo.agentes || []).map(agTag).join('<br>')}</td><td class="tnum">${num(mo.llamadas)}</td><td class="tnum">${(mo.tokens.in / 1e6).toFixed(1).replace('.', ',')} M · ${(mo.tokens.out / 1e6).toFixed(1).replace('.', ',')} M · ${(mo.tokens.reasoning / 1e6).toFixed(1).replace('.', ',')} M</td><td class="tnum"><b>${eur(mo.coste)}</b></td><td><div class="meter" style="--c:var(--primary);margin:0"><i style="width:${share * 100}%"></i></div><span class="small muted tnum">${Math.round(share * 100)} %</span></td><td class="tnum">${ms(mo.p95_ms)}</td><td class="tnum">${esc(mo.exito.json_valido)}</td><td class="tnum">${esc(mo.exito.sin_reintento)}</td><td class="tnum">${esc(mo.exito.estable_replay)}</td><td>${esc(mo.exito.precision)}</td></tr>`; }).join('') || '<tr><td colspan="13" class="muted">Sin modelos en el dataset.</td></tr>';
    renderCharts();
    $('recos').innerHTML = (G.recomendaciones || []).map((r) => `<div class="alert ${r.sev}"><span class="ico">${ic(r.sev === 'info' ? 'lightbulb' : SEV_ICON[r.sev])}</span><div><b>${esc(r.id)} · ${conGuardrails(esc(r.titulo))}</b><small>${conGuardrails(esc(r.detalle))}</small></div><button class="btn btn-sm" type="button" data-goto="replay" data-replay="1">${ic('play')} Simular con replay</button></div>`).join('');
  }

  // ---------------------------------------------------------------------------
  // Histórico
  // ---------------------------------------------------------------------------
  const TIPOS = { alerta: ['bell', 'Alertas', 'var(--crit)'], politica: ['sliders-horizontal', 'Políticas y niveles', 'var(--time)'], replay: ['repeat', 'Replays', 'var(--ag-clasificacion)'], override: ['user-check', 'Overrides', 'var(--review)'], despliegue: ['rocket', 'Despliegues', 'var(--primary)'], incidente: ['activity', 'Incidentes', 'var(--warn)'], operacion: ['power', 'Operación', 'var(--muted)'] };
  function renderHistorico() {
    const evs = G.eventos || [];
    $('hist-chips').innerHTML = `<button class="chip${filtroTipo ? '' : ' is-active'}" type="button" data-t="">Todo</button>` + Object.entries(TIPOS).filter(([k]) => k !== 'operacion' || evs.some((e) => e.tipo === 'operacion')).map(([k, [i, l]]) => `<button class="chip${filtroTipo === k ? ' is-active' : ''}" type="button" data-t="${k}">${ic(i)} ${l} (${evs.filter((e) => e.tipo === k).length})</button>`).join('');
    const lista = evs.filter((e) => !filtroTipo || e.tipo === filtroTipo).sort((a, b) => b.fecha.localeCompare(a.fecha));
    let day = ''; let out = '';
    lista.forEach((e) => {
      const d = e.fecha.slice(0, 10);
      if (d !== day) { day = d; out += `<div class="day">${new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>`; }
      const [i, , c] = TIPOS[e.tipo] || ['info', '', 'var(--muted)'];
      out += `<div class="ev"><span class="t">${hora(e.fecha).slice(0, 5)}</span><span class="ico" style="--c:${c}">${ic(i)}</span><div><b>${conGuardrails(esc(e.titulo))}</b><small>${conGuardrails(esc(e.detalle))}</small></div><div class="row" style="justify-content:flex-end">${e.agente ? agTag(e.agente) : ''}<span class="pill pill-muted">${esc(e.usuario)}</span></div></div>`;
    });
    $('timeline').innerHTML = out || '<p class="muted">Sin eventos de este tipo.</p>';
  }

  // ---------------------------------------------------------------------------
  // Render completo, navegación y eventos
  // ---------------------------------------------------------------------------
  function renderAll() {
    AG = Object.fromEntries(G.agentes.map((a) => [a.id, a]));
    POL = Object.fromEntries([...(G.politicas || []), ...(G.caps || [])].map((p) => [p.id, p]));
    if (!G.trazas.some((t) => t.id === selId)) selId = G.trazas.length ? G.trazas[G.trazas.length - 1].id : null;
    renderResumen();
    $('h-trazas').innerHTML = `${ic('route')} Trazas (${G.trazas.length})`;
    $('r-summary').innerHTML = `${ic('route')} Trazas (${G.trazas.length}) · filtros`;
    listaTrazas('t'); listaTrazas('r');
    renderDetalle();
    renderSteps();
    renderReplays();
    renderAutonomia();
    renderGuardrails();
    renderFinops();
    renderHistorico();
    $('tabs').querySelector('[data-view="finops"] .n').textContent = G.caps.filter((c) => c.estado === 'superado').length || '';
  }

  const TABS = [['resumen', 'layout-dashboard', 'Resumen'], ['trazas', 'route', 'Trazabilidad'], ['replay', 'brain', 'Reasoning & Replay'], ['autonomia', 'sliders-horizontal', 'Autonomía'], ['guardrails', 'shield-check', 'Guardrails'], ['finops', 'coins', 'FinOps'], ['historico', 'history', 'Histórico']];
  function goto(v, opts = {}) {
    document.querySelectorAll('.tab').forEach((b) => { b.classList.toggle('is-active', b.dataset.view === v); b.setAttribute('aria-selected', String(b.dataset.view === v)); });
    document.querySelectorAll('.view').forEach((s) => s.classList.toggle('is-active', s.dataset.view === v));
    if (opts.replay) { const card = $('card-replay'); card.scrollIntoView({ block: 'start', behavior: 'smooth' }); card.style.outline = '2px solid var(--primary)'; setTimeout(() => { card.style.outline = ''; }, 1600); }
    else window.scrollTo({ top: 0 });
  }

  // Alturas reales de cabecera y pestañas para los elementos fijos (la cabecera puede ocupar varias líneas)
  function medirFijos() {
    document.documentElement.style.setProperty('--top-h', `${document.querySelector('.topbar').offsetHeight}px`);
    document.documentElement.style.setProperty('--tabs-h', `${$('tabs').offsetHeight}px`);
  }

  function bind() {
    $('tabs').innerHTML = TABS.map(([v, i, l]) => `<button class="tab${v === 'resumen' ? ' is-active' : ''}" type="button" role="tab" data-view="${v}" aria-selected="${v === 'resumen'}">${ic(i)} ${l}${v === 'finops' ? ' <span class="n"></span>' : ''}</button>`).join('');
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) goto(b.dataset.view); });
    // Navegación, modales, kill switch, guardrails y leyendas: un único delegado de clic
    document.addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (go) { const dlg = go.closest('dialog'); if (dlg) dlg.close(); goto(go.dataset.goto, { replay: !!go.dataset.replay }); return; }
      const cl = e.target.closest('[data-close]'); if (cl) { $(cl.dataset.close).close(); return; }
      const sw = e.target.closest('[data-switch]'); if (sw) { e.preventDefault(); e.stopPropagation(); toggleAgente(sw.dataset.switch); return; }
      const gr = e.target.closest('[data-guardrail]'); if (gr) { e.preventDefault(); toggleGuardrail(gr.dataset.guardrail); return; }
      const lg = e.target.closest('[data-legend]'); if (lg) { const set = lg.dataset.legend === 'agente' ? ocultos : tokOcultos; set.has(lg.dataset.key) ? set.delete(lg.dataset.key) : set.add(lg.dataset.key); renderCharts(); return; }
      const tz = e.target.closest('[data-traza]'); if (tz) { goto('trazas'); selectTraza(tz.dataset.traza); return; }
      const ag = e.target.closest('.agent[data-agente]'); if (ag) { abrirModalAgente(ag.dataset.agente); return; }
      const ult = e.target.closest('#ultimas tr[data-id]'); if (ult) { abrirModalTraza(ult.dataset.id); return; }
      const row = e.target.closest('#t-trazas tr[data-id], #r-trazas tr[data-id]'); if (row) { selectTraza(row.dataset.id); return; }
      const chip = e.target.closest('#hist-chips .chip'); if (chip) { filtroTipo = chip.dataset.t; renderHistorico(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('.agent[data-agente]')) abrirModalAgente(e.target.dataset.agente); });
    document.querySelectorAll('dialog.modal').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
    $('btn-back').innerHTML = `${ic('arrow-left')} Volver al triaje`;
    $('btn-json').innerHTML = `${ic('upload')} Cargar JSON`;
    $('btn-json').addEventListener('click', () => $('file-json').click());
    $('file-json').addEventListener('change', () => { const f = $('file-json').files[0]; if (f) cargarArchivo(f); $('file-json').value = ''; });
    $('fuente').addEventListener('change', () => setFuente($('fuente').value));
    $('periodo').addEventListener('change', () => { periodoDias = Number($('periodo').value); renderResumen(); renderFinops(); });
    const H = { 'h-agentes': ['cpu', 'Agentes'], 'h-coste': ['euro', 'Coste diario frente al cap'], 'h-alertas': ['bell', 'Alertas activas'], 'h-reasoning': ['brain', 'Razonamiento registrado'], 'h-replay': ['repeat', 'Replay'], 'h-replays': ['history', 'Replays anteriores'], 'h-niveles': ['sliders-horizontal', 'Niveles de autonomía'], 'h-guardrails': ['shield-check', 'Guardrails'], 'h-cambios': ['history', 'Cambios de nivel (auditoría)'], 'h-caps': ['scale', 'Caps configurados'], 'h-coste-ag': ['euro', 'Coste diario por agente'], 'h-tokens': ['cpu', 'Tokens por agente'], 'h-modelos': ['database', 'Modelos'], 'h-reco': ['lightbulb', 'Recomendaciones de ahorro'], 'h-hist': ['history', 'Histórico de gobierno'] };
    Object.entries(H).forEach(([id, [i, t]]) => { $(id).innerHTML = `${ic(i)} ${t}`; });
    document.querySelectorAll('[data-close]').forEach((b) => { b.innerHTML = ic('x'); });
    $('btn-export-trazas').innerHTML = `${ic('download')} Exportar trazas`;
    $('btn-export-trazas').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(G, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `gobierno-agentes-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
    $('btn-replay').innerHTML = `${ic('play')} Ejecutar replay`;
    $('btn-replay').addEventListener('click', () => renderDiff(true));
    ['rp-modo', 'rp-modelo', 'rp-prompt'].forEach((id) => $(id).addEventListener('change', () => renderDiff(false)));
    $('btn-new-policy').innerHTML = `${ic('plus')} Nuevo guardrail`;
    $('btn-new-cap').innerHTML = `${ic('plus')} Nuevo cap`;
    ['t', 'r'].forEach((pre) => ['agente', 'canal', 'dec', 'res'].forEach((k) => $(`${pre}-${k}`).addEventListener('change', () => listaTrazas(pre))));
    // Tooltip de gráficos, waterfall y referencias a guardrails
    const tip = $('tip');
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) { tip.style.display = 'none'; return; }
      tip.textContent = el.dataset.tip; tip.style.display = 'block';
      const w = tip.offsetWidth; tip.style.left = `${Math.min(e.clientX + 12, window.innerWidth - w - 8)}px`; tip.style.top = `${e.clientY - 28 - (tip.offsetHeight > 30 ? tip.offsetHeight - 22 : 0)}px`;
    });
    medirFijos();
    window.addEventListener('resize', medirFijos);
  }

  bind();
  renderAll();
})();
