/* Yeison Bot — ventana de chat del asistente. Depende de callServer, reloadData, renderContent y toast de app.js. */
(function () {
  const css = `
.yb-fab{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:3px solid #fff;padding:0;cursor:pointer;
  background:#dbeafe url(/bot-face.png) center/cover;box-shadow:0 6px 20px rgba(15,23,42,.25);z-index:900;}
.yb-fab:hover{transform:scale(1.05)}
.yb-panel{position:fixed;right:20px;bottom:92px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);
  background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.22);
  display:flex;flex-direction:column;overflow:hidden;z-index:900;font-size:13.5px}
.yb-panel[hidden],.yb-chips[hidden]{display:none}
.yb-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--navy-900,#0b1220);color:#fff}
.yb-head img{width:38px;height:38px;border-radius:50%;background:#dbeafe}
.yb-head b{display:block;font-size:14px}
.yb-head small{color:#94a3b8;font-size:11px}
.yb-head .yb-sp{flex:1}
.yb-icon{background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:12px;padding:6px;border-radius:6px}
.yb-icon:hover{background:rgba(255,255,255,.1);color:#fff}
.yb-icon[aria-pressed="true"]{color:#93c5fd}
.yb-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--bg,#eef1f6)}
.yb-m{max-width:88%;padding:8px 11px;border-radius:12px;line-height:1.5;white-space:normal;word-wrap:break-word}
.yb-u{align-self:flex-end;background:var(--accent,#2563eb);color:#fff;border-bottom-right-radius:4px}
.yb-a{align-self:flex-start;background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-bottom-left-radius:4px}
.yb-a ul{margin:4px 0;padding-left:18px}
.yb-a p{margin:0 0 6px}.yb-a p:last-child{margin:0}
.yb-err{align-self:flex-start;background:var(--red-bg,#fee2e2);color:var(--red,#b91c1c)}
.yb-prop{align-self:stretch;background:var(--amber-bg,#fef3c7);border:1px solid #fcd34d;border-radius:10px;padding:10px}
.yb-prop b{display:block;margin-bottom:6px;color:var(--amber,#a16207)}
.yb-prop .yb-row{display:flex;gap:6px;margin-top:8px}
.yb-btn{border:1px solid var(--border,#e2e8f0);background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12.5px}
.yb-btn.ok{background:var(--accent,#2563eb);border-color:var(--accent,#2563eb);color:#fff}
.yb-btn:disabled{opacity:.6;cursor:default}
.yb-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0;background:var(--card,#fff)}
.yb-chip{border:1px solid var(--accent-light,#dbeafe);background:#f5f8ff;color:var(--accent-dark,#1d4ed8);border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer}
.yb-form{display:flex;gap:8px;padding:10px 12px;background:var(--card,#fff);border-top:1px solid var(--border-2,#eef0f3)}
.yb-form textarea{flex:1;resize:none;border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:8px 10px;font:inherit;height:40px;max-height:120px}
.yb-form textarea:focus{outline:2px solid var(--accent,#2563eb);outline-offset:-1px}
.yb-dots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:#94a3b8;animation:ybd 1s infinite}
.yb-dots span:nth-child(2){animation-delay:.15s}.yb-dots span:nth-child(3){animation-delay:.3s}
@keyframes ybd{0%,80%,100%{opacity:.3}40%{opacity:1}}
.yb-talking .yb-head img{box-shadow:0 0 0 3px #60a5fa}
.yb-vozbar{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#f5f8ff;border-bottom:1px solid var(--border-2,#eef0f3);font-size:12px}
.yb-vozbar[hidden]{display:none}
.yb-vozbar select{flex:1;min-width:0;border:1px solid var(--border,#e2e8f0);border-radius:6px;padding:4px 6px;font:inherit}
.yb-vozbar .yb-btn{padding:4px 10px}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const SUGERENCIAS = ['Pagos de esta semana', 'Resumen de la deuda', 'Cuotas que vencen en 15 días', '¿Cuánto debemos al BCT?'];
  const KEY = 'yb-deuda-v2';
  let hist = { interactionId: null, vista: [] }; // interactionId = hilo guardado en Gemini; vista = burbujas
  try { hist = JSON.parse(sessionStorage.getItem(KEY)) || hist; } catch (e) {}
  let voz = false; try { voz = localStorage.getItem('yb-voz') === '1'; } catch (e) {}
  let notas = []; // confirmaciones para avisarle al bot en el siguiente mensaje
  let ocupado = false;

  const fab = document.createElement('button');
  fab.className = 'yb-fab'; fab.title = 'Yeison Bot'; fab.setAttribute('aria-label', 'Abrir Yeison Bot');
  const panel = document.createElement('section');
  panel.className = 'yb-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Yeison Bot');
  panel.innerHTML = `
    <div class="yb-head"><img src="/bot-face.png" alt=""><div><b>Yeison Bot</b><small>Deuda Global · asistente</small></div>
      <span class="yb-sp"></span>
      <button class="yb-icon" id="ybVoz" title="Leer respuestas en voz alta" aria-pressed="${voz}">Voz</button>
      <button class="yb-icon" id="ybNuevo" title="Nueva conversación">Nueva</button>
      <button class="yb-icon" id="ybCerrar" aria-label="Cerrar">✕</button></div>
    <div class="yb-vozbar" id="ybVozBar"><label for="ybVozSel">Voz</label><select id="ybVozSel"></select><button type="button" class="yb-btn" id="ybVozProbar">Probar</button></div>
    <div class="yb-log" id="ybLog" aria-live="polite"></div>
    <div class="yb-chips" id="ybChips"></div>
    <form class="yb-form" id="ybForm"><textarea id="ybTxt" rows="1" placeholder="Pregúntame por pagos, cuotas o saldos"></textarea>
      <button class="yb-btn ok" type="submit">Enviar</button></form>`;
  document.body.appendChild(fab); document.body.appendChild(panel);
  const $ = id => panel.querySelector('#' + id);
  const log = $('ybLog');

  function guardar() { try { sessionStorage.setItem(KEY, JSON.stringify(hist)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function md(t) {
    const out = []; let lista = null;
    for (const raw of esc(t).split('\n')) {
      const line = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      const li = line.match(/^\s*[-*•]\s+(.*)/);
      if (li) { (lista || (lista = [])).push('<li>' + li[1] + '</li>'); continue; }
      if (lista) { out.push('<ul>' + lista.join('') + '</ul>'); lista = null; }
      if (line.trim()) out.push('<p>' + line.replace(/^#+\s*/, '') + '</p>');
    }
    if (lista) out.push('<ul>' + lista.join('') + '</ul>');
    return out.join('');
  }
  function burbuja(v) {
    const el = document.createElement('div');
    if (v.tipo === 'prop') {
      el.className = 'yb-prop';
      el.innerHTML = `<b>Cambio listo para confirmar</b>${esc(v.resumen || v.action)}
        <div class="yb-row">${v.estado ? `<span>${esc(v.estado)}</span>` :
        `<button class="yb-btn ok" data-ok>Confirmar</button><button class="yb-btn" data-no>Cancelar</button>`}</div>`;
      const ok = el.querySelector('[data-ok]'), no = el.querySelector('[data-no]');
      if (ok) ok.onclick = () => confirmar(v, el);
      if (no) no.onclick = () => { v.estado = 'Cancelado'; notas.push(`Cancelé el cambio "${v.resumen}".`); guardar(); pintar(); };
    } else {
      el.className = 'yb-m ' + (v.tipo === 'u' ? 'yb-u' : v.tipo === 'err' ? 'yb-err' : 'yb-a');
      el.innerHTML = v.tipo === 'a' ? md(v.texto) : esc(v.texto);
    }
    return el;
  }
  function pintar() {
    log.innerHTML = '';
    if (!hist.vista.length) {
      log.appendChild(burbuja({ tipo: 'a', texto: `Hola${typeof state !== 'undefined' && state.nombre ? ' ' + state.nombre.split(' ')[0] : ''}. Soy tu asistente de Deuda Global. Pregúntame por pagos, cuotas, saldos o pídeme registrar un pago. Los cambios siempre te los dejo para que los confirmes.` }));
    }
    hist.vista.forEach(v => log.appendChild(burbuja(v)));
    if (ocupado) { const d = document.createElement('div'); d.className = 'yb-m yb-a yb-dots'; d.innerHTML = '<span></span><span></span><span></span>'; log.appendChild(d); }
    log.scrollTop = log.scrollHeight;
    $('ybChips').hidden = hist.vista.length > 0;
    $('ybChips').innerHTML = hist.vista.length ? '' : SUGERENCIAS.map(s => `<button type="button" class="yb-chip">${esc(s)}</button>`).join('');
    $('ybChips').querySelectorAll('.yb-chip').forEach(b => b.onclick = () => enviar(b.textContent));
  }
  // Voces masculinas comunes en Windows/Edge/Chrome/macOS. Juan es la voz de Costa Rica en Edge.
  const HOMBRES = /\b(Juan|Jorge|Ra[uú]l|Pablo|[AÁ]lvaro|Dar[ií]o|Diego|Gerardo|Carlos|Andr[eé]s|Emilio|Gonzalo|Tom[aá]s|Mateo|Federico|Lorenzo|Manuel|Sergio|Alonso|Arnau|Enrique|Cecilio|Luciano|Saul|Sa[uú]l|Rodrigo|Mario|Marcelo|Nicol[aá]s|Rafael|Alberto|Jes[uú]s|Yago|Gael|Male|Hombre)\b/i;
  const esHombre = v => HOMBRES.test(v.name);
  const vocesEs = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => /^es/i.test(v.lang));
  const rango = v => (/es-CR/i.test(v.lang) ? 0 : /es-(MX|US|419|CO|PA)/i.test(v.lang) ? 1 : 2) + (/natural|online|neural/i.test(v.name) ? 0 : 0.5);
  function vozElegida() {
    const vs = vocesEs();
    let nombre = ''; try { nombre = localStorage.getItem('yb-voz-nombre') || ''; } catch (e) {}
    return vs.find(v => v.name === nombre)
      || vs.filter(esHombre).sort((a, b) => rango(a) - rango(b))[0]
      || vs.sort((a, b) => rango(a) - rango(b))[0] || null;
  }
  function llenarVoces() {
    const sel = $('ybVozSel'), vs = vocesEs(), actual = vozElegida();
    sel.innerHTML = vs.length ? vs.map(v => `<option value="${esc(v.name)}">${esc(v.name.replace(/^Microsoft |^Google /, '').replace(/ Online \(Natural\)/, ''))} · ${esc(v.lang)}${esHombre(v) ? ' · hombre' : ''}</option>`).join('')
      : '<option value="">Voz del sistema</option>';
    if (actual) sel.value = actual.name;
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = llenarVoces;

  function hablar(t) {
    if (!voz || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t.replace(/\*\*/g, '').replace(/₡/g, ' colones ').replace(/^\s*[-*•]\s+/gm, ''));
    u.lang = 'es-CR';
    const v = vozElegida(); if (v) { u.voice = v; u.lang = v.lang; }
    if (!v || !esHombre(v)) u.pitch = 0.8; // sin voz masculina instalada, se baja el tono
    u.onstart = () => panel.classList.add('yb-talking');
    u.onend = u.onerror = () => panel.classList.remove('yb-talking');
    speechSynthesis.speak(u);
  }

  async function enviar(texto) {
    texto = (texto || '').trim();
    if (!texto || ocupado) return;
    const paraBot = notas.length ? `(Nota: ${notas.join(' ')})\n${texto}` : texto;
    notas = [];
    hist.vista.push({ tipo: 'u', texto }); ocupado = true; pintar(); guardar();
    try {
      const r = await fetch('/api/bot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionId: hist.interactionId, texto: paraBot }) });
      const data = await r.json();
      if (data.error) { hist.vista.push({ tipo: 'err', texto: data.error }); }
      else {
        hist.interactionId = data.interactionId;
        if (data.respuesta) { hist.vista.push({ tipo: 'a', texto: data.respuesta }); hablar(data.respuesta); }
        (data.propuestas || []).forEach(p => hist.vista.push({ tipo: 'prop', ...p }));
      }
    } catch (e) {
      hist.vista.push({ tipo: 'err', texto: 'No hay conexión con el servidor. Intenta de nuevo.' });
    }
    ocupado = false; guardar(); pintar();
  }

  function confirmar(v, el) {
    el.querySelectorAll('button').forEach(b => b.disabled = true);
    callServer(v.action, v.args, res => {
      v.estado = 'Hecho' + (res && res.id ? ' · ' + res.id : '');
      notas.push(`Confirmé y se ejecutó "${v.resumen}"${res && res.id ? ' (ID ' + res.id + ')' : ''}.`);
      guardar(); pintar();
      if (typeof reloadData === 'function') reloadData(() => { if (typeof renderContent === 'function') renderContent(); });
      toast('Cambio aplicado.');
    }, err => {
      v.estado = 'No se aplicó: ' + (err && err.message || 'error');
      notas.push(`Intenté confirmar "${v.resumen}" y falló: ${err && err.message}.`);
      guardar(); pintar();
    });
  }

  fab.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) { pintar(); $('ybTxt').focus(); } };
  $('ybCerrar').onclick = () => { panel.hidden = true; };
  $('ybNuevo').onclick = () => { hist = { interactionId: null, vista: [] }; notas = []; guardar(); pintar(); };
  $('ybVoz').onclick = e => { voz = !voz; e.currentTarget.setAttribute('aria-pressed', voz); $('ybVozBar').hidden = !voz; try { localStorage.setItem('yb-voz', voz ? '1' : '0'); } catch (x) {} if (voz) llenarVoces(); else if (window.speechSynthesis) speechSynthesis.cancel(); };
  $('ybVozSel').onchange = e => { try { localStorage.setItem('yb-voz-nombre', e.target.value); } catch (x) {} };
  $('ybVozProbar').onclick = () => { const was = voz; voz = true; hablar('Hola, soy Yeison Bot. Así sueno.'); voz = was; };
  $('ybVozBar').hidden = !voz; llenarVoces();
  $('ybForm').onsubmit = e => { e.preventDefault(); const t = $('ybTxt'); enviar(t.value); t.value = ''; };
  $('ybTxt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('ybForm').requestSubmit(); } });
})();
