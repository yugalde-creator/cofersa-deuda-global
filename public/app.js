/* ================= ICONS ================= */
const ICONS = {
  dashboard: '<path d="M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 14h6v6H4z"/>',
  bank: '<path d="M3 21h18M4 10h16M12 3l9 5H3l9-5ZM5 10v9M9 10v9M15 10v9M19 10v9"/>',
  ops: '<path d="M17 3l4 4-4 4M21 7H7a4 4 0 0 0-4 4v1M7 21l-4-4 4-4M3 17h14a4 4 0 0 0 4-4v-1"/>',
  audit: '<path d="M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6l8-3Z"/><path d="M9 12l2 2 4-4"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="M20 20l-4.8-4.8"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  download: '<path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5"/><path d="M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevronLeft: '<path d="M14 5l-7 7 7 7"/>',
  chevronRight: '<path d="M10 5l7 7-7 7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  cash: '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.6"/><path d="M7 7v0M17 17v0"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-5a2 2 0 1 0 0 4h5"/>',
  percent: '<path d="M5 19L19 5M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  upload:'<path d="M12 21V9m0 0l-4.5 4.5M12 9l4.5 4.5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 9h18"/>',
  trending:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  report:'<path d="M4 19V5M4 19h16M8 15v-4M12 15V9M16 15v-7"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.9-3.4 3-5.2 6-5.2s5.1 1.8 6 5.2"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.3c2.4.3 3.9 1.9 4.5 4.2"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  sheet:'<path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
};
function ic(name, cls){ return `<svg class="icon ${cls||''}" viewBox="0 0 24 24">${ICONS[name]||''}</svg>`; }
function initials(name){
  const parts=(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return 'US';
  return parts.slice(0,2).map(w=>w[0].toUpperCase()).join('');
}

/* ================= DATOS EN VIVO (poblados desde el Google Sheet) ================= */
let SYM = { USD: '$', CRC: '₡' };
let FX = { USD: 1, CRC: 462.56 };
let bankLimits = {};
// Monto de cada línea reservado para otros usos (p.ej. disponible de tarjetas de crédito
// y leasing) y que por lo tanto NUNCA debe contarse como disponible para nuevos desembolsos.
// BAC: de los $2,000,000 de límite, $100,000 están reservados para tarjetas de crédito y leasing.
const BANK_RESERVES = { 'BAC': 100000 };

let lines = [];
let lineasCanceladas = [];
let paymentPlans = {};
let history = [];
let leasingContratos = [];
let leasingPagos = {};
let usuarios = [];
let auditLog = [];
let historicoDeuda = {};

function daysUntil(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr+'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((d-today)/86400000);
}
function lineaSaldoActual(l){
  const plan = paymentPlans[l.id]||[];
  const pagado = plan.filter(p=>p.estado==='Pagado'||p.estado==='Conciliado').reduce((s,p)=>s+p.capital,0);
  return Math.max((l.aprobado!=null?l.aprobado:0) - pagado, 0);
}
function lineaProximoPago(l){
  const plan = (paymentPlans[l.id]||[]).filter(p=>p.estado==='Pendiente').sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  if(plan.length) return plan[0].fecha;
  return null;
}
function estadoLinea(l){
  const saldo = lineaSaldoActual(l);
  const dv = daysUntil(l.vencimiento);
  const dp = daysUntil(lineaProximoPago(l));
  if(l.aprobado===0 && saldo===0 && !(paymentPlans[l.id]||[]).length) return {label:'Sin Disponer', cls:'badge-gray'};
  if(saldo<=0 && (paymentPlans[l.id]||[]).length) return {label:'Pagada', cls:'badge-green'};
  if(dv!==null && dv<0) return {label:'Vencido', cls:'badge-red', detail:'hace '+Math.abs(dv)+' día(s)'};
  if(dp!==null && dp>=0 && dp<7) return {label:'Cuota Próxima', cls:'badge-amber', detail:'en '+dp+' día(s)'};
  return {label:'Línea Activa', cls:'badge-blue', detail: dv!==null ? ('vence en '+dv+' días') : ''};
}
function leasingSaldoActual(contrato){
  const plan = leasingPagos[contrato.id]||[];
  const pagado = plan.filter(p=>p.estado==='Pagado'||p.estado==='Conciliado').reduce((s,p)=>s+p.capital,0);
  return Math.max(contrato.monto - pagado, 0);
}

/* ================= STATE ================= */
const now0 = new Date();
let state = {
  role: 'Consulta',
  email: '', nombre: '', sheetUrl: '', empresa: '',
  currency: localStorage.getItem('erp_currency') || 'USD',
  activeModule: 'dashboard',
  sidebarCollapsed: localStorage.getItem('erp_sidebar')==='1',
  bankFilter: '',
  searchQuery: '',
  historySearch: '',
  notifOpen: false,
  userMenuOpen: false,
  cargaTab: 'activas',
  calYear: now0.getFullYear(),
  calMonth: now0.getMonth(),
  calSelectedDate: null,
  proyMoneda: 'ambas',
  leasingTab: 'contratos',
  leasingSearch: '',
  datosSearch: '',
  historicoTab: 'canceladas',
  deudaGranularidad: 'mes',
  lineEstadoFilter: '', pagoEstadoFilter: '', histEstadoFilter: '', leasingEstadoFilter: '',
};

function toUSD(amount, cur){ return cur==='USD' ? amount : amount / FX[cur]; }
function fmtUSD(amountUSD){
  const val = amountUSD * FX[state.currency];
  return SYM[state.currency] + val.toLocaleString('es-CR', {maximumFractionDigits: 0});
}
function fmtNative(amountNative, nativeCur){ return fmtUSD(toUSD(amountNative, nativeCur||'USD')); }
function fmtFullNative(amountNative, nativeCur){
  const val = toUSD(amountNative, nativeCur||'USD') * FX[state.currency];
  return SYM[state.currency] + ' ' + val.toLocaleString('es-CR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function isReadOnly(){ return state.role !== 'Admin'; }
function toast(msg, isError){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (isError?' error':'');
  el.innerHTML = (isError? ic('lock'):ic('audit')) + '<span>'+msg+'</span>';
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .25s'; setTimeout(()=>el.remove(),250); }, 3200);
}
/** Bloqueo del lado del cliente para dar feedback inmediato. El servidor vuelve a validar el rol en cada acción. */
function guard(fn){
  if(isReadOnly()){ toast('Acción bloqueada: tu rol "Consulta" es de solo lectura.', true); return; }
  fn();
}
function guardedAction(fn){ guard(fn); }

/* ================= PUENTE CON EL SERVIDOR (google.script.run) ================= */
function callServer(fnName, args, onSuccess, onError){
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: fnName, args: args || [] })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) { if(onSuccess) onSuccess(res.data); }
    else {
      const msg = res.error || 'Error en el servidor.';
      toast(msg, true);
      if(onError) onError({ message: msg });
    }
  })
  .catch(err => {
    toast('Error de conexión con el servidor.', true);
    if(onError) onError(err);
  });
}
function applyBootstrap(data){
  state.email = data.email; state.nombre = data.nombre; state.role = data.rol;
  state.sheetUrl = data.sheetUrl; state.empresa = data.empresa;
  lines = data.lines; paymentPlans = data.paymentPlans; lineasCanceladas = data.lineasCanceladas; history = data.history;
  leasingContratos = data.leasingContratos; leasingPagos = data.leasingPagos; usuarios = data.usuarios; auditLog = data.auditLog;
  bankLimits = data.bankLimits; FX = data.fx; historicoDeuda = data.historicoDeuda||{};
}
function reloadData(cb, hintEmail){
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getBootstrapData', args: [] })
  })
  .then(r => r.json())
  .then(res => {
    if (!res.success) { toast(res.error || 'No se pudo actualizar la información.', true); return; }
    const data = res.data;
    if(!data.authorized){ renderDenied(data.email); return; }
    applyBootstrap(data);
    if(cb) cb();
  })
  .catch(err => { toast('No se pudo actualizar la información.', true); });
}
function renderDenied(email){
  const unknown = !email;
  document.getElementById('app').innerHTML = `<div class="boot-screen"><div class="denied-card">
    ${ic('lock','icon-lg')}
    <h2>Acceso no autorizado</h2>
    ${unknown
      ? `<p>No se pudo verificar tu identidad automáticamente. Ingresa tu correo de Google para continuar.</p>
         <input type="email" id="hintInput" placeholder="tucorreo@ejemplo.com" style="padding:8px 12px;border:1px solid #ccc;border-radius:6px;font-size:14px;width:100%;box-sizing:border-box;margin:10px 0;">
         <button onclick="loginWithEmail(document.getElementById('hintInput').value)" style="background:var(--accent,#1a5276);color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px;width:100%;">Iniciar sesión</button>`
      : `<p>La cuenta <b>${email}</b> no está registrada en el sistema. Pide al administrador que te agregue.</p>`
    }
  </div></div>`;
}
function loginWithEmail(email){
  email = (email||'').trim().toLowerCase();
  if(!email){ toast('Por favor ingresa tu correo.', true); return; }
  document.getElementById('app').innerHTML = '<div class="boot-screen"><div id="bootScreen"><div class="boot-spinner"></div><div>Verificando...</div></div></div>';
  reloadData(function(){ renderShell(); }, email);
}
function boot(){
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getBootstrapData', args: [] })
  })
  .then(r => r.json())
  .then(res => {
    if (!res.success) {
      document.getElementById('app').innerHTML = '<div class="boot-screen"><div class="denied-card"><h2>Error</h2><p>' + (res.error || 'No se pudo cargar.') + '</p></div></div>';
      return;
    }
    const data = res.data;
    if(!data.authorized){ renderDenied(data.email); return; }
    applyBootstrap(data);
    renderShell();
  })
  .catch(err => {
    document.getElementById('app').innerHTML = '<div class="boot-screen"><div class="denied-card"><h2>Error de conexión</h2><p>No se pudo cargar la información. Recarga la página.</p></div></div>';
  });
}

/* ================= LAYOUT SHELL ================= */
function renderShell(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="sidebar ${state.sidebarCollapsed?'collapsed':''}" id="sidebar">
      <div class="brand">
        <div class="brand-mark">DG</div>
        <div><div class="brand-name">Deuda Global</div><div class="brand-sub">${state.empresa||'Nivel Institucional'}</div></div>
      </div>
      <nav>
        <div class="nav-item ${state.activeModule==='dashboard'?'active':''}" data-mod="dashboard">${ic('dashboard')}<span class="nav-label">Panel de Control</span></div>
        <div class="nav-item ${state.activeModule==='lines'?'active':''}" data-mod="lines">${ic('bank')}<span class="nav-label">Operaciones</span></div>
        <div class="nav-item ${state.activeModule==='calendario'?'active':''}" data-mod="calendario">${ic('calendar')}<span class="nav-label">Calendario de Pagos</span></div>
        <div class="nav-item ${state.activeModule==='proyecciones'?'active':''}" data-mod="proyecciones">${ic('trending')}<span class="nav-label">Proyecciones</span></div>
        <div class="nav-item ${state.activeModule==='leasing'?'active':''}" data-mod="leasing">${ic('doc')}<span class="nav-label">Leasing Financiero</span></div>
        <div class="nav-item ${state.activeModule==='ops'?'active':''}" data-mod="ops">${ic('ops')}<span class="nav-label">Conciliación</span></div>
        <div class="nav-item ${state.activeModule==='historico'?'active':''}" data-mod="historico">${ic('history')}<span class="nav-label">Histórico</span></div>
        <div class="nav-item ${state.activeModule==='intereses'?'active':''}" data-mod="intereses">${ic('percent')}<span class="nav-label">Apartado Intereses</span></div>
        <div class="nav-item ${state.activeModule==='reportes'?'active':''}" data-mod="reportes">${ic('report')}<span class="nav-label">Reportes</span></div>
        <div class="nav-group-label">Datos</div>
        <div class="nav-item ${state.activeModule==='centrodatos'?'active':''}" data-mod="centrodatos">${ic('database')}<span class="nav-label">Centro de Datos</span></div>
        <div class="nav-item ${state.activeModule==='carga'?'active':''}" data-mod="carga">${ic('upload')}<span class="nav-label">Importar histórico</span></div>
        <div class="nav-item ${state.activeModule==='usuarios'?'active':''}" data-mod="usuarios">${ic('users')}<span class="nav-label">Usuarios</span></div>
        <div class="nav-group-label">Control</div>
        <div class="nav-item ${state.activeModule==='audit'?'active':''}" data-mod="audit">${ic('audit')}<span class="nav-label">Seguridad y Auditoría</span></div>
      </nav>
      <div class="sidebar-footer">
        <button class="collapse-btn" id="collapseBtn">${ic(state.sidebarCollapsed?'chevronRight':'chevronLeft')}<span class="nav-label">Colapsar</span></button>
      </div>
    </div>
    <div class="main">
      <div class="topbar">
        <div class="topbar-left"><b>${moduleTitle()}</b></div>
        <div class="topbar-right">
          <span class="fx-note">1 USD = ₡${FX.CRC.toFixed(2)}</span>
          <button class="btn btn-primary" id="currencyToggle">${ic('cash')} Ver en ${state.currency==='USD'?'Colones (₡)':'Dólares ($)'}</button>
          <button class="btn" id="reloadBtn" title="Traer los datos más recientes del Sheet">${ic('history')} Actualizar</button>
          <div style="position:relative;">
            <button class="icon-btn" id="notifBtn">${ic('bell','icon-lg')}<span class="badge-dot"></span></button>
            <div class="dropdown ${state.notifOpen?'open':''}" id="notifDrop">
              <div class="dropdown-header">Centro de Notificaciones</div>
              ${notifItemsHtml()}
            </div>
          </div>
          <div style="position:relative;">
            <div class="user-chip" id="userChip">
              <div class="avatar">${initials(state.nombre)}</div>
              <div>
                <div style="font-weight:700;font-size:12px;line-height:1.2;">${state.nombre||state.email}</div>
                <span class="role-pill ${state.role==='Admin'?'admin':'consulta'}">${state.role}</span>
              </div>
            </div>
            <div class="dropdown ${state.userMenuOpen?'open':''}" id="userDrop" style="width:250px;">
              <div class="dropdown-header">${state.email}</div>
              <div class="user-menu-item" id="openSheetBtn">${ic('sheet')} Abrir Google Sheet (datos)</div>
              <div class="user-menu-item" style="color:var(--text-muted);cursor:default;">${ic('lock')} Rol asignado por administrador en la hoja Usuarios</div>
              <div class="user-menu-item" onclick="window.location='/api/auth/signout?callbackUrl=/login'" style="color:var(--red,#b91c1c)">${ic('x')} Cerrar sesión</div>
            </div>
          </div>
        </div>
      </div>
      <div class="content" id="content"></div>
    </div>`;

  document.getElementById('sidebar').querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click', ()=>{ state.activeModule = el.dataset.mod; state.notifOpen=false; state.userMenuOpen=false; renderShell(); });
  });
  document.getElementById('collapseBtn').addEventListener('click', ()=>{
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem('erp_sidebar', state.sidebarCollapsed?'1':'0');
    renderShell();
  });
  document.getElementById('currencyToggle').addEventListener('click', ()=>{
    state.currency = state.currency==='USD' ? 'CRC' : 'USD';
    localStorage.setItem('erp_currency', state.currency);
    renderShell();
  });
  document.getElementById('reloadBtn').addEventListener('click', ()=>{
    toast('Actualizando desde el Sheet…');
    reloadData(()=> renderContent());
  });
  document.getElementById('notifBtn').addEventListener('click', ()=>{ state.notifOpen=!state.notifOpen; state.userMenuOpen=false; syncDropdowns(); });
  document.getElementById('userChip').addEventListener('click', ()=>{ state.userMenuOpen=!state.userMenuOpen; state.notifOpen=false; syncDropdowns(); });
  document.getElementById('openSheetBtn').addEventListener('click', ()=>{ if(state.sheetUrl) window.open(state.sheetUrl, '_blank'); });
  renderContent();
}
function syncDropdowns(){
  document.getElementById('notifDrop').className = 'dropdown ' + (state.notifOpen?'open':'');
  document.getElementById('userDrop').className = 'dropdown ' + (state.userMenuOpen?'open':'');
}
function notifItemsHtml(){
  const upcoming = lines.filter(l=>{const d=daysUntil(lineaProximoPago(l)); return d!==null && d>=0 && d<10;}).sort((a,b)=>daysUntil(lineaProximoPago(a))-daysUntil(lineaProximoPago(b)));
  if(upcoming.length===0) return '<div class="empty-state">Sin alertas activas</div>';
  return upcoming.map(l=>{
    const d = daysUntil(lineaProximoPago(l));
    const color = d<3 ? 'var(--red)' : 'var(--amber)';
    return `<div class="notif-item"><div class="notif-dot" style="background:${color}"></div><div><div class="notif-title">${l.id} · ${l.banco}</div><div class="notif-sub">Pago programado en ${d} día(s).</div></div></div>`;
  }).join('');
}

/* ================= CONTENT ROUTER ================= */
function renderContent(){
  const c = document.getElementById('content');
  if(state.activeModule==='dashboard') c.innerHTML = dashboardHtml();
  else if(state.activeModule==='lines') c.innerHTML = linesHtml();
  else if(state.activeModule==='calendario') c.innerHTML = calendarioHtml();
  else if(state.activeModule==='proyecciones') c.innerHTML = proyeccionesHtml();
  else if(state.activeModule==='leasing') c.innerHTML = leasingHtml();
  else if(state.activeModule==='ops') c.innerHTML = opsHtml();
  else if(state.activeModule==='historico') c.innerHTML = historicoHtml();
  else if(state.activeModule==='intereses') { c.innerHTML = interesesLoadingHtml(); loadIntereses(); }
  else if(state.activeModule==='reportes') c.innerHTML = reportesHtml();
  else if(state.activeModule==='centrodatos') c.innerHTML = centroDatosHtml();
  else if(state.activeModule==='carga') c.innerHTML = cargaHtml();
  else if(state.activeModule==='usuarios') c.innerHTML = usuariosHtml();
  else if(state.activeModule==='audit') c.innerHTML = auditHtml();
  bindContentEvents();
}

/* ================= DASHBOARD ================= */
function computeKPIs(){
  const linesUSD = lines.reduce((s,l)=>s+toUSD(lineaSaldoActual(l),l.moneda),0);
  const leasingUSD = leasingContratos.reduce((s,l)=>s+toUSD(leasingSaldoActual(l),l.moneda),0);
  const dispuestoUSD = linesUSD + leasingUSD;
  const bankRows = bankExposureRows();
  const disponibleUSD = bankRows.reduce((s,r)=>s+r.disponibleUSD,0);
  const tasaPonderada = lines.reduce((s,l)=>s+l.tasa*toUSD(lineaSaldoActual(l),l.moneda),0) / (linesUSD||1);
  const proximos = lines.filter(l=>lineaSaldoActual(l)>0 && daysUntil(lineaProximoPago(l))!==null && daysUntil(lineaProximoPago(l))>=0).sort((a,b)=>daysUntil(lineaProximoPago(a))-daysUntil(lineaProximoPago(b)));
  const prox = proximos[0];
  return { dispuestoUSD, disponibleUSD, tasaPonderada, prox };
}
function debtByCurrencyRows(){
  const map = {};
  lines.forEach(l=>{
    if(!map[l.moneda]) map[l.moneda]={dispuesto:0};
    map[l.moneda].dispuesto += lineaSaldoActual(l);
  });
  const totalUSD = Object.entries(map).reduce((s,[cur,v])=>s+toUSD(v.dispuesto,cur),0);
  return Object.entries(map).map(([cur,v])=>({
    moneda:cur, nativo:v.dispuesto, equivalenteUSD:toUSD(v.dispuesto,cur),
    pct: totalUSD ? (toUSD(v.dispuesto,cur)/totalUSD*100) : 0
  })).sort((a,b)=>b.equivalenteUSD-a.equivalenteUSD);
}
function bankExposureRows(){
  const map = {};
  lines.forEach(l=>{
    if(!map[l.banco]) map[l.banco]={dispuestoUSD:0};
    map[l.banco].dispuestoUSD += toUSD(lineaSaldoActual(l),l.moneda);
  });
  Object.keys(bankLimits).forEach(b=>{ if(!map[b]) map[b]={dispuestoUSD:0}; });
  return Object.entries(map).map(([banco,v])=>{
    const limiteUSD = bankLimits[banco] ?? v.dispuestoUSD;
        const reservaUSD = BANK_RESERVES[banco] || 0;
            return {
                  banco, aprobadoUSD:limiteUSD, dispuestoUSD:v.dispuestoUSD, disponibleUSD:limiteUSD-v.dispuestoUSD-reservaUSD,
                        util: limiteUSD ? Math.round((v.dispuestoUSD+reservaUSD)/limiteUSD*100) : 0
    };
  }).sort((a,b)=>b.dispuestoUSD-a.dispuestoUSD);
}
function paymentsLastMonth(){
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-1);
  return history.filter(h=> new Date(h.fecha+'T00:00:00') >= cutoff).sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
}
function upcomingEvents(){
  const events = [];
  Object.entries(paymentPlans).forEach(([lid,plan])=>{
    const line = lines.find(l=>l.id===lid);
    if(!line) return;
    plan.filter(p=>p.estado==='Pendiente').forEach(p=>{
      events.push({ tipo:'Cuota', linea:lid, banco:line.banco, fecha:p.fecha, montoUSD: toUSD(p.capital+p.interes, line.moneda), dias: daysUntil(p.fecha) });
    });
  });
  lines.forEach(l=>{
    const d = daysUntil(l.vencimiento);
    if(d!==null && d>=0 && d<=180){
      events.push({ tipo:'Vencimiento de Línea', linea:l.id, banco:l.banco, fecha:l.vencimiento, montoUSD: toUSD(lineaSaldoActual(l),l.moneda), dias:d });
    }
  });
  return events.sort((a,b)=>a.dias-b.dias);
}
function saldosPorBancoHtml(){
  const rows = bankExposureRows();
  const leasingTotalUSD = leasingContratos.reduce((s,l)=>{ const sal=leasingSaldoActual(l); return sal>0?s+toUSD(sal,l.moneda):s; },0);
  const totalAprobado = rows.reduce((s,r)=>s+r.aprobadoUSD,0);
  const totalDispuesto = rows.reduce((s,r)=>s+r.dispuestoUSD,0) + leasingTotalUSD;
  const totalDisponible = rows.reduce((s,r)=>s+r.disponibleUSD,0);
  const totalUtil = totalAprobado ? Math.round(totalDispuesto/totalAprobado*100) : 0;
  const leasingRow = leasingTotalUSD>0 ? `<tr style="opacity:0.85;"><td><b>🏷 Leasing</b></td><td class="text-right mono">${fmtUSD(leasingTotalUSD)}</td><td class="text-right mono text-muted">—</td><td class="text-right mono text-muted">—</td><td><span class="text-muted">—</span></td></tr>` : '';
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('bank')}<span>Saldos y Límites por Banco (${state.currency})</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table><thead><tr><th>Banco</th><th class="text-right">Saldo</th><th class="text-right">Límite</th><th class="text-right">Disponible</th><th>% Uso</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr><td><b>${r.banco}</b></td><td class="text-right mono">${fmtUSD(r.dispuestoUSD)}</td><td class="text-right mono">${fmtUSD(r.aprobadoUSD)}</td><td class="text-right mono" style="color:var(--green);font-weight:700;">${fmtUSD(r.disponibleUSD)}</td><td><span class="progress-bar-track"><span class="progress-bar-fill" style="width:${r.util}%"></span></span><span class="text-muted">${r.util}%</span></td></tr>`).join('')}
          ${leasingRow}
          <tr class="total-row"><td>TOTAL</td><td class="text-right mono">${fmtUSD(totalDispuesto)}</td><td class="text-right mono">${fmtUSD(totalAprobado)}</td><td class="text-right mono">${fmtUSD(totalDisponible)}</td><td>${totalUtil}%</td></tr>
        </tbody></table>
      </div>
    </div>`;
}
function tendenciaTasasPorBancoHtml(){
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-6);
  const map = {};
  lines.forEach(l=>{ if(!map[l.banco]) map[l.banco]=[]; map[l.banco].push(l); });
  const avgTasa = arr => arr.length ? arr.reduce((s,l)=>s+l.tasa,0)/arr.length : null;
  const rows = Object.entries(map).map(([banco,arr])=>{
    const tasas = arr.map(l=>l.tasa);
    const min = Math.min(...tasas), max = Math.max(...tasas);
    const recientes = arr.filter(l=> new Date(l.inicio+'T00:00:00') >= cutoff);
    const anteriores = arr.filter(l=> new Date(l.inicio+'T00:00:00') < cutoff);
    const tasaReciente = avgTasa(recientes);
    const tasaAnterior = avgTasa(anteriores);
    let tendClass='badge-gray', tendIcon='—', tendLabel='Sin comparación', ref = tasaReciente!=null ? tasaReciente : tasaAnterior;
    if(tasaReciente!=null && tasaAnterior!=null){
      const delta = tasaReciente - tasaAnterior;
      if(delta > 0.05){ tendClass='badge-red'; tendIcon='↑'; tendLabel='Subiendo'; }
      else if(delta < -0.05){ tendClass='badge-green'; tendIcon='↓'; tendLabel='Bajando'; }
      else { tendClass='badge-gray'; tendIcon='→'; tendLabel='Estable'; }
    }
    return { banco, min, max, ref, tendIcon, tendLabel, tendClass };
  }).sort((a,b)=>(b.ref||0)-(a.ref||0));
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('percent')}<span>Tendencia de Tasas por Banco</span><div class="spacer"></div><span style="text-transform:none;font-weight:600;opacity:.8;">Prom. últimos 6 meses vs. anteriores</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table><thead><tr><th>Banco</th><th class="text-right">Tasa Mín.</th><th class="text-right">Prom. 6 meses</th><th class="text-right">Tasa Máx.</th><th>Tendencia</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr><td><b>${r.banco}</b></td><td class="text-right mono">${r.min.toFixed(2)}%</td><td class="text-right mono"><b>${r.ref!=null?r.ref.toFixed(2)+'%':'—'}</b></td><td class="text-right mono">${r.max.toFixed(2)}%</td><td><span class="badge ${r.tendClass}">${r.tendIcon} ${r.tendLabel}</span></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty-state">Sin líneas activas.</div></td></tr>'}
        </tbody></table>
      </div>
    </div>`;
}
function distribucionPorMonedaHtml(){
  const map = {};
  Object.keys(bankLimits).forEach(b=>{ map[b] = {crcUSD:0, usdUSD:0}; });
  lines.forEach(l=>{
    if(!map[l.banco]) map[l.banco] = {crcUSD:0, usdUSD:0};
    const usdEq = toUSD(lineaSaldoActual(l), l.moneda);
    if(l.moneda==='CRC') map[l.banco].crcUSD += usdEq; else map[l.banco].usdUSD += usdEq;
  });
  const leasingCRC = leasingContratos.reduce((s,l)=>{ const sal=leasingSaldoActual(l); return (sal>0&&l.moneda==='CRC')?s+toUSD(sal,l.moneda):s; },0);
  const leasingUSDv = leasingContratos.reduce((s,l)=>{ const sal=leasingSaldoActual(l); return (sal>0&&l.moneda!=='CRC')?s+toUSD(sal,l.moneda):s; },0);
  const rows = Object.entries(map).map(([banco,v])=>({banco, crcUSD:v.crcUSD, usdUSD:v.usdUSD, totalUSD:v.crcUSD+v.usdUSD}));
  const totalCRC = rows.reduce((s,r)=>s+r.crcUSD,0) + leasingCRC;
  const totalUSDv = rows.reduce((s,r)=>s+r.usdUSD,0) + leasingUSDv;
  const colCRC = state.currency==='USD' ? 'Saldo CRC (USD)' : 'Saldo CRC';
  const colUSD = state.currency==='USD' ? 'Saldo USD' : 'Saldo USD (₡)';
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('dashboard')}<span>Distribución por Moneda</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table><thead><tr><th>Banco</th><th class="text-right">${colCRC}</th><th class="text-right">${colUSD}</th><th class="text-right">Total ${state.currency}</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr><td><b>${r.banco}</b></td><td class="text-right mono">${fmtUSD(r.crcUSD)}</td><td class="text-right mono">${fmtUSD(r.usdUSD)}</td><td class="text-right mono"><b>${fmtUSD(r.totalUSD)}</b></td></tr>`).join('')}
          ${(leasingCRC+leasingUSDv)>0?`<tr style="opacity:0.85;"><td><b>🏷 Leasing</b></td><td class="text-right mono">${fmtUSD(leasingCRC)}</td><td class="text-right mono">${fmtUSD(leasingUSDv)}</td><td class="text-right mono"><b>${fmtUSD(leasingCRC+leasingUSDv)}</b></td></tr>`:''}
          <tr class="total-row"><td>TOTAL</td><td class="text-right mono">${fmtUSD(totalCRC)}</td><td class="text-right mono">${fmtUSD(totalUSDv)}</td><td class="text-right mono">${fmtUSD(totalCRC+totalUSDv)}</td></tr>
        </tbody></table>
      </div>
    </div>`;
}
function indicadoresFinancierosHtml(){
  const k = computeKPIs();
  const byCur = debtByCurrencyRows();
  const pctCRC = (byCur.find(r=>r.moneda==='CRC')||{pct:0}).pct;
  const pctUSD = (byCur.find(r=>r.moneda==='USD')||{pct:0}).pct;
  const totalAprobadoUSD = k.dispuestoUSD + k.disponibleUSD;
  const usoTotal = totalAprobadoUSD ? (k.dispuestoUSD/totalAprobadoUSD*100) : 0;
  const rows = [
    ['% Deuda en CRC', pctCRC.toFixed(1)+'%'],
    ['% Deuda en USD', pctUSD.toFixed(1)+'%'],
    ['Tasa promedio ponderada', k.tasaPonderada.toFixed(2)+'%'],
    ['% Uso total de líneas', usoTotal.toFixed(1)+'%'],
    ['Tipo de cambio', '₡'+FX.CRC.toFixed(2)+' = $1.00'],
    ['Próximo vencimiento', k.prox ? (daysUntil(lineaProximoPago(k.prox))+' días · '+k.prox.id) : 'Sin pagos programados'],
  ];
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('percent')}<span>Indicadores Financieros</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table class="kv-table"><tbody>
          ${rows.map(([k2,v])=>`<tr><td class="k">${k2}</td><td class="v">${v}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>`;
}
function limitesLineasHtml(){
  const rows = bankExposureRows();
  const totalLimite = rows.reduce((s,r)=>s+r.aprobadoUSD,0);
  const totalUsado = rows.reduce((s,r)=>s+r.dispuestoUSD,0);
  const totalDisponible = rows.reduce((s,r)=>s+r.disponibleUSD,0);
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('wallet')}<span>Límites de Líneas Habilitadas</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table><thead><tr><th>Banco</th><th class="text-right">Límite</th><th class="text-right">Usado</th><th class="text-right">Disponible</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr><td><b>${r.banco}</b></td><td class="text-right mono">${fmtUSD(r.aprobadoUSD)}</td><td class="text-right mono">${fmtUSD(r.dispuestoUSD)}</td><td class="text-right mono" style="color:var(--green);font-weight:700;">${fmtUSD(r.disponibleUSD)}</td></tr>`).join('')}
          <tr class="total-row"><td>TOTAL</td><td class="text-right mono">${fmtUSD(totalLimite)}</td><td class="text-right mono">${fmtUSD(totalUsado)}</td><td class="text-right mono">${fmtUSD(totalDisponible)}</td></tr>
        </tbody></table>
      </div>
    </div>`;
}
function pagosUltimoMesHtml(){
  const pagos = paymentsLastMonth();
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('cash')}<span>Pagos del Último Mes</span><div class="spacer"></div><span style="text-transform:none;font-weight:600;opacity:.8;">${pagos.length} pagos</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table><thead><tr><th>ID Pago</th><th>Línea</th><th>Banco</th><th>Fecha</th><th class="text-right">Monto</th><th>Estado</th></tr></thead>
        <tbody>${pagos.map(h=>{ const line=lines.find(l=>l.id===h.linea); const cur=line?line.moneda:'USD'; return `<tr><td><b>${h.id}</b></td><td>${line?.numOp||h.linea}</td><td>${h.banco}</td><td>${h.fecha}</td><td class="text-right mono">${fmtNative(h.monto,cur)}</td><td><span class="badge ${h.estado==='Conciliado'?'badge-green':'badge-amber'}">${h.estado}</span></td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty-state">Sin pagos en el último mes.</div></td></tr>'}</tbody></table>
      </div>
    </div>`;
}
function amortizacionProximosHtml(){
  const eventos = upcomingEvents();
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('clock')}<span>Amortización y Vencimientos Próximos</span><div class="spacer"></div><span style="text-transform:none;font-weight:600;opacity:.8;">180 días</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table><thead><tr><th>Tipo</th><th>Línea</th><th>Banco</th><th>Fecha</th><th class="text-right">Monto</th><th>Días</th><th>Prioridad</th></tr></thead>
        <tbody>${eventos.map(e=>{ const cls = e.dias<7?'badge-red':(e.dias<30?'badge-amber':'badge-blue'); const label = e.dias<7?'Urgente':(e.dias<30?'Próximo':'Programado'); return `<tr><td>${e.tipo}</td><td><b>${e.linea}</b></td><td>${e.banco}</td><td>${e.fecha}</td><td class="text-right mono">${fmtUSD(e.montoUSD)}</td><td class="mono">${e.dias}</td><td><span class="badge ${cls}">${label}</span></td></tr>`; }).join('') || '<tr><td colspan="7"><div class="empty-state">Sin eventos próximos.</div></td></tr>'}</tbody></table>
      </div>
    </div>`;
}
function dashboardHtml(){
  return `
    <div class="panel-grid">${saldosPorBancoHtml()}${distribucionPorMonedaHtml()}</div>
    <div class="panel-grid">${indicadoresFinancierosHtml()}${tendenciaTasasPorBancoHtml()}</div>
        ${tendenciaDeudaHtml()}`;
}

/* ================= LÍNEAS Y BANCOS ================= */
function lineasCanceladasComoFilas(){ return lineasCanceladas.map(l=> ({ id:l.id, numOp:l.numOp, banco:l.banco, tipo:l.tipo||'—', moneda:l.moneda, aprobado:l.monto, tasa:l.tasa, vencimiento:l.vencimiento, _cancelada:true })); }
function filteredLines(){ const usarCanceladas = state.lineEstadoFilter==='Cancelada'; const base = usarCanceladas ? lineasCanceladasComoFilas() : lines; return base.filter(l=>{ const matchBank = !state.bankFilter || l.banco===state.bankFilter; const q = state.searchQuery.toLowerCase(); const matchQ = !q || l.id.toLowerCase().includes(q) || (l.numOp||'').toLowerCase().includes(q) || l.banco.toLowerCase().includes(q) || (l.tipo||'').toLowerCase().includes(q); const estadoActual = usarCanceladas ? 'Cancelada' : estadoLinea(l).label; const matchEstado = state.lineEstadoFilter ? estadoActual===state.lineEstadoFilter : estadoActual!=='Pagada'; return matchBank && matchQ && matchEstado; }); }

function linesHtml(){
  const banks = Object.keys(bankLimits);
  const rows = filteredLines();
  const ro = isReadOnly();
  return `
    <div class="table-card">
      <div class="table-toolbar">
        <div class="tb-search">${ic('search')}<input id="searchInput" placeholder="Buscar por ID, banco o tipo..." value="${state.searchQuery}"></div>
        <select class="tb-select" id="bankFilterSel">
          <option value="">${ic('filter')} Todos los bancos</option>
          ${banks.map(b=>`<option value="${b}" ${state.bankFilter===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="tb-select" id="lineEstadoSel"><option value="">${ic('filter')} Todos los estados</option>${['Línea Activa','Cuota Próxima','Vencido','Pagada','Sin Disponer','Cancelada'].map(s=>`<option value="${s}" ${state.lineEstadoFilter===s?'selected':''}>${s}</option>`).join('')}</select>
        <div class="spacer"></div>
        <button class="btn" id="exportLinesBtn">${ic('download')} Exportar</button>
        <button class="btn btn-primary" id="newLineBtn" ${ro?'disabled title="Requiere rol Administrador"':''}>${ic('plus')} Nueva Línea</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr>
            <th>N° Operación</th><th>Banco</th><th>Tipo</th><th>Moneda</th><th class="text-right">Aprobado</th><th class="text-right">Saldo Actual</th><th>% Pendiente</th><th class="text-right">Tasa</th><th>Vencimiento</th><th>Estado</th>
          </tr></thead>
          <tbody id="linesBody">
            ${rows.map(l=>lineRowHtml(l)).join('') || '<tr><td colspan="10"><div class="empty-state">No se encontraron líneas de crédito con ese criterio.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}
function lineRowHtml(l){
  if(l._cancelada){ return `<tr data-id="${l.id}" data-cancelada="1"<td><b>${l.numOp||l.id}</b><div class="text-muted" style="font-size:10.5px;">${l.id}</div></td>>d><td>${l.banco}</td><td>${l.tipo}</td><td><span class="badge badge-gray">${l.moneda}</span></td><td class="text-right mono">${fmtNative(l.aprobado,l.moneda)}</td><td class="text-right mono">${fmtNative(0,l.moneda)}</td><td><span class="progress-bar-track"><span class="progress-bar-fill" style="width:100%"></span></span><span class="text-muted">100%</span></td><td class="text-right mono">${(l.tasa||0).toFixed(2)}%</td><td>${l.vencimiento}</td><td><span class="badge badge-gray">Cancelada</span></td></tr>`; }
  const est = estadoLinea(l);
  const saldo = lineaSaldoActual(l);
  const util = l.aprobado ? Math.round((saldo/l.aprobado)*100) : 0;
  return `<tr data-id="${l.id}">
    <td><b>${l.numOp||l.id}</b><div class="text-muted" style="font-size:10.5px;">${l.id}</div></td>>
    <td>${l.banco}</td>
    <td>${l.tipo}</td>
    <td><span class="badge badge-gray">${l.moneda}</span></td>
    <td class="text-right mono">${fmtNative(l.aprobado,l.moneda)}</td>
    <td class="text-right mono">${fmtNative(saldo,l.moneda)}</td>
    <td><span class="progress-bar-track"><span class="progress-bar-fill" style="width:${util}%"></span></span><span class="text-muted">${util}%</span></td>
    <td class="text-right mono">${l.tasa.toFixed(2)}%</td>
    <td>${l.vencimiento}</td>
    <td><span class="badge ${est.cls}">${est.label}</span>${est.detail?'<div class="text-muted" style="font-size:10.5px;margin-top:2px;">'+est.detail+'</div>':''}</td>>
  </tr>`;
}

/* ================= CONCILIACIÓN ================= */
function opsHtml(){
    const q = (state.historySearch||'').toLowerCase();
      const rows = history.filter(h=> (!q || h.id.toLowerCase().includes(q) || h.banco.toLowerCase().includes(q) || h.linea.toLowerCase().includes(q)) && (!state.histEstadoFilter || h.estado===state.histEstadoFilter));
        const planEntries = Object.entries(paymentPlans).flatMap(([lid,plan])=> plan.map(p=>({lid,p}))).filter(({p})=> !state.pagoEstadoFilter || p.estado===state.pagoEstadoFilter);
          const ro = isReadOnly();
            return `
                <div class="module-grid">
                      <div class="table-card">
                              <div class="table-toolbar">
                                        <b style="font-size:13px;">Planes de Pago y Amortización</b>
                                                  <select class="tb-select" id="pagoEstadoSel">
                                                              <option value="">${ic('filter')} Todos los estados</option>
                                                                          <option value="Pendiente" ${state.pagoEstadoFilter==='Pendiente'?'selected':''}>Pendiente</option>
                                                                                      <option value="Pagado" ${state.pagoEstadoFilter==='Pagado'?'selected':''}>Pagado</option>
                                                                                                </select>
                                                                                                          <div class="spacer"></div>
                                                                                                                    <button class="btn" id="bulkUploadBtn" ${ro?'disabled title="Requiere rol Administrador"':''}>${ic('upload')} Carga masiva</button>
                                                                                                                              <button class="btn btn-primary" id="newPaymentBtn" ${ro?'disabled title="Requiere rol Administrador"':''}>${ic('plus')} Registrar Pago</button>
                                                                                                                                      </div>
                                                                                                                                              <div class="table-scroll" style="max-height:260px;">
                                                                                                                                                        <table>
                                                                                                                                                                    <thead><tr><th>Línea</th><th>Fecha</th><th class="text-right">Capital</th><th class="text-right">Interés</th><th>Estado</th></tr></thead>
                                                                                                                                                                                <tbody>
                                                                                                                                                                                              ${planEntries.map(({lid,p})=>{ const line=lines.find(l=>l.id===lid); const cur=line?line.moneda:'USD'; return `
                                                                                                                                                                                                              <tr><td><b>${line?.numOp||lid}</b></td><td>${p.fecha}</td><td class="text-right mono">${fmtNative(p.capital,cur)}</td><td class="text-right mono">${fmtNative(p.interes,cur)}</td>
                                                                                                                                                                                                                              <td><span class="badge ${p.estado==='Pagado'?'badge-green':'badge-amber'}">${p.estado}</span></td></tr>`; }).join('') || '<tr><td colspan="5"><div class="empty-state">Sin planes de pago que coincidan con el filtro.</div></td></tr>'}
                                                                                                                                                                                                                                          </tbody>
                                                                                                                                                                                                                                                    </table>
                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                        <div class="table-card">
                                                                                                                                                                                                                                                                                <div class="table-toolbar">
                                                                                                                                                                                                                                                                                          <div class="tb-search">${ic('search')}<input id="historySearchInput" placeholder="Buscar en histórico de pagos..." value="${state.historySearch}"></div>
                                                                                                                                                                                                                                                                                                    <select class="tb-select" id="histEstadoSel">
                                                                                                                                                                                                                                                                                                                <option value="">${ic('filter')} Todos los estados</option>
                                                                                                                                                                                                                                                                                                                            <option value="Conciliado" ${state.histEstadoFilter==='Conciliado'?'selected':''}>Conciliado</option>
                                                                                                                                                                                                                                                                                                                                        <option value="Pendiente" ${state.histEstadoFilter==='Pendiente'?'selected':''}>Pendiente</option>
                                                                                                                                                                                                                                                                                                                                                    <option value="Duplicado" ${state.histEstadoFilter==='Duplicado'?'selected':''}>Duplicado</option></select>
                  <div class="spacer"></div><button class="btn" id="exportHistoryBtn">${ic('download')} Exportar CSV</button>
                </div>
                <div class="table-scroll" style="max-height:400px;">
                  <table>
                    <thead><tr><th>ID Pago</th><th>Línea</th><th>Banco</th><th>Fecha</th><th class="text-right">Monto</th><th>Estado</th></tr></thead>
                    <tbody>${rows.map(h=>{ const line=lines.find(l=>l.id===h.linea); const cur=line?line.moneda:'USD'; return `<tr><td><b>${h.id}</b></td><td>${line?.numOp||h.linea}</td><td>${h.banco}</td><td>${h.fecha}</td><td class="text-right mono">${fmtNative(h.monto,cur)}</td><td><span class="badge ${h.estado==='Conciliado'?'badge-green':'badge-amber'}">${h.estado}</span></td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty-state">Sin pagos registrados.</div></td></tr>'}</tbody>
                  </table>
                </div>
              </div>
            </div>
`; }
function calcularAmortizacion(monto, tasaAnual, plazo, fechaPrimerPago){
  const tasaMes = tasaAnual / 100 / 12;
  const cuota = tasaMes === 0 ? monto / plazo : monto * tasaMes / (1 - Math.pow(1 + tasaMes, -plazo));
  let saldo = monto;
  const filas = [];
  let d = new Date(fechaPrimerPago + 'T00:00:00');
  for(let i = 0; i < plazo; i++){
    const interes = Math.round(saldo * tasaMes * 100) / 100;
    const capital = Math.round((cuota - interes) * 100) / 100;
    saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100);
    const dd = new Date(d);
    filas.push({ fecha: dd.toISOString().slice(0,10), capital, interes, cuota: Math.round(cuota*100)/100, saldo, estado: 'Pendiente' });
    d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return { filas, cuota: Math.round(cuota * 100) / 100 };
}
function openNewLineScheduleModal(){
  openModal(`
    <div class="modal-header"><div><h2>Crear Nueva Línea de Crédito</h2><div class="sub">Plan de Amortización</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field"><label>Banco</label><input type="text" id="s_banco" placeholder="Ej: BAC San José"></div>
        <div class="form-field"><label>N° Operación</label><input type="text" id="s_numop" placeholder="Ej: 10026911"></div>
        <div class="form-field"><label>Fecha Desembolso</label><input type="date" id="s_desembolso"></div>
        <div class="form-field"><label>Monto Original</label><input type="number" id="s_monto" placeholder="0.00"></div>
        <div class="form-field"><label>Moneda</label><select id="s_moneda"><option value="USD">USD— Ólar</option><option value="CRC">CRC — Colón</option></select></div>
        <div class="form-field"><label>Tasa Anual (%)</label><input type="number" step="0.01" id="s_tasa" placeholder="8.00"></div>
        <div class="form-field"><label>Plazo (meses)</label><input type="number" id="s_plazo" placeholder="12" value="12"></div>
        <div class="form-field"><label>Fecha 1° Pago</label><input type="date" id="s_primerpago"></div>
      </div>
      <div style="margin-top:14px;"><button class="btn" id="calcScheduleBtn">${ic('percent')} Calcular Plan de Pagos</button></div>
      <div id="scheduleResult" style="margin-top:14px;"></div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="saveScheduleBtn" disabled>${ic('plus')} Guardar Línea y Plan de Pagos</button></div>`);

  let scheduleData = null;

  document.getElementById('calcScheduleBtn').addEventListener('click', ()=>{
    const banco = document.getElementById('s_banco').value;
    const numOp = document.getElementById('s_numop').value.trim();
    const monto = parseFloat(document.getElementById('s_monto').value)||0;
    const moneda = document.getElementById('s_moneda').value;
    const tasa = parseFloat(document.getElementById('s_tasa').value)||0;
    const plazo = parseInt(document.getElementById('s_plazo').value)||0;
    const primerPago = document.getElementById('s_primerpago').value;
    const desembolso = document.getElementById('s_desembolso').value;
    if(!numOp){ toast('Ingresa el N° de Operación.', true); return; }
    if(monto<=0){ toast('Ingresa un monto válido.', true); return; }
    if(plazo<=0 || plazo>60){ toast('El plazo debe estar entre 1 y 60 meses.', true); return; }
    if(!primerPago || !desembolso){ toast('Completa las fechas de desembolso y primer pago.', true); return; }
    scheduleData = calcularAmortizacion(monto, tasa, plazo, primerPago);
    scheduleData.banco = banco; scheduleData.numOp = numOp; scheduleData.monto = monto; scheduleData.moneda = moneda; scheduleData.tasa = tasa; scheduleData.plazo = plazo; scheduleData.desembolso = desembolso; scheduleData.primerPago = primerPago;
    const fls = scheduleData.filas || [];
    document.getElementById('scheduleResult').innerHTML = `<div class="table-scroll" style="max-height:260px;"><table><thead><tr><th>Mes</th><th>Fecha</th><th class="text-right">Capital</th><th class="text-right">Interés</th><th class="text-right">Cuota</th><th class="text-right">Saldo</th></tr></thead><tbody>${fls.map((r,i)=>`<tr><td>${i+1}</td><td>${r.fecha}</td><td class="text-right mono">${fmtNative(r.capital,moneda)}</td><td class="text-right mono">${fmtNative(r.interes,moneda)}</td><td class="text-right mono">${fmtNative(r.cuota,moneda)}</td><td class="text-right mono">${fmtNative(r.saldo||0,moneda)}</td></tr>`).join('') || '<tr><td colspan="6">Sin datos.</td></tr>'}</tbody></table></div>`;
    document.getElementById('saveScheduleBtn').disabled = false;
  });
  document.getElementById('saveScheduleBtn').addEventListener('click', ()=> guard(()=>{
    callServer('crearLinea', [scheduleData], res=>{
      closeModal(); reloadData(()=>{ renderContent(); toast('Línea '+(res.numOp||res.id||'')+' creada con plan de pagos.'); });
    });
  }));
}

/* ================= AUDITORÍA ================= */
function auditHtml(){
  return `
    <div class="readonly-notice" style="background:var(--blue-bg);color:var(--blue);">
      ${ic('audit')} Rol activo: <b>&nbsp;${state.role}</b>&nbsp;(${state.email}) — ${state.role!=='Admin' ? 'los elementos de escritura del sistema están bloqueados para este rol.' : 'tienes permisos completos de lectura y escritura.'} Para cambiar roles, edita la hoja <b>Usuarios</b> o usa el módulo Usuarios.
    </div>
    <div class="table-card">
      <div class="table-toolbar"><b style="font-size:13px;">Bitácora de Auditoría</b><div class="spacer"></div><span class="text-muted">${auditLog.length} eventos registrados</span></div>
      <div class="table-scroll" style="max-height:calc(100vh - 260px);">
        <table>
          <thead><tr><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Fecha</th><th>Resultado</th></tr></thead>
          <tbody>
            ${auditLog.map(a=>`<tr><td>${a.usuario}</td><td>${a.accion}</td><td>${a.modulo}</td><td class="mono">${a.fecha}</td><td><span class="badge ${a.resultado==='Éxito'?'badge-green':'badge-red'}">${a.resultado}</span></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty-state">Sin eventos registrados.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ================= CUOTAS CONSOLIDADAS (Operaciones + Leasing) ================= */
function allCuotasConMeta(){
  const arr = [];
  Object.entries(paymentPlans).forEach(([lid,plan])=>{
    const line = lines.find(l=>l.id===lid);
    if(!line) return;
    plan.forEach(p=>arr.push({ origen:'Operación', ref:lid, banco:line.banco, moneda:line.moneda, fecha:p.fecha, capital:p.capital, interes:p.interes, extra:0, estado:p.estado }));
  });
  Object.entries(leasingPagos).forEach(([lid,plan])=>{
    const contrato = leasingContratos.find(l=>l.id===lid);
    if(!contrato) return;
    plan.forEach(p=>arr.push({ origen:'Leasing', ref:lid, banco:contrato.banco, moneda:contrato.moneda, fecha:p.fecha, capital:p.capital, interes:p.interes, extra:(p.seguro||0)+(p.iva||0), estado:p.estado }));
  });
  return arr;
}

/* ================= CALENDARIO DE PAGOS ================= */
function calMonthLabel(){
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[state.calMonth]+' '+state.calYear;
}
function calEventsAll(){
  const cuotas = allCuotasConMeta().filter(c=>c.estado==='Pendiente');
  const vencLineas = lines.filter(l=>l.vencimiento).map(l=>({origen:'Vencimiento Operación', ref:l.id, banco:l.banco, moneda:l.moneda, fecha:l.vencimiento, capital:0, interes:0, extra:0, estado:'Vencimiento'}));
  const vencLeasing = leasingContratos.filter(l=>l.vencimiento).map(l=>({origen:'Vencimiento Leasing', ref:l.id, banco:l.banco, moneda:l.moneda, fecha:l.vencimiento, capital:0, interes:0, extra:0, estado:'Vencimiento'}));
  return [...cuotas, ...vencLineas, ...vencLeasing];
}
function calendarioHtml(){
  const events = calEventsAll();
  const byDate = {};
  events.forEach(e=>{ if(!byDate[e.fecha]) byDate[e.fecha]=[]; byDate[e.fecha].push(e); });
  const first = new Date(state.calYear, state.calMonth, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(state.calYear, state.calMonth+1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0,10);
  let cells = '';
  for(let i=0;i<startWeekday;i++) cells += '<div class="cal-cell empty"></div>';
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = state.calYear+'-'+String(state.calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const dayEvents = byDate[dateStr]||[];
    const dias = daysUntil(dateStr);
    let dotCls = 'badge-blue';
    if(dias<0) dotCls='badge-red'; else if(dias<7) dotCls='badge-amber';
    const isToday = dateStr===todayStr;
    cells += '<div class="cal-cell '+(isToday?'today':'')+' '+(state.calSelectedDate===dateStr?'selected':'')+'" data-date="'+dateStr+'">'
      +'<div class="cal-daynum">'+d+'</div>'
      +(dayEvents.length?'<span class="badge '+dotCls+'" style="font-size:10px;padding:1px 6px;">'+dayEvents.length+'</span>':'')
      +'</div>';
  }
  const weekdays = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const selected = state.calSelectedDate ? (byDate[state.calSelectedDate]||[]) : [];
  return `
    <div class="table-card">
      <div class="panel-header-dark">${ic('calendar')}<span>Calendario de Pagos y Vencimientos</span><div class="spacer"></div>
        <button class="btn" id="calPrevBtn" style="background:transparent;border-color:rgba(255,255,255,.3);color:#fff;">${ic('chevronLeft')}</button>
        <span style="min-width:150px;text-align:center;text-transform:none;font-weight:700;">${calMonthLabel()}</span>
        <button class="btn" id="calNextBtn" style="background:transparent;border-color:rgba(255,255,255,.3);color:#fff;">${ic('chevronRight')}</button>
      </div>
      <div class="cal-grid-header">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>
    <div class="table-card" style="margin-top:14px;">
      <div class="panel-header-dark">${ic('clock')}<span>${state.calSelectedDate ? 'Eventos del '+state.calSelectedDate : 'Selecciona un día para ver el detalle'}</span></div>
      <div class="table-scroll" style="max-height:260px;">
        <table><thead><tr><th>Origen</th><th>Referencia</th><th>Banco</th><th class="text-right">Monto</th><th>Estado</th></tr></thead>
        <tbody>${selected.map(e=>`<tr><td>${e.origen}</td><td><b>${e.ref}</b></td><td>${e.banco}</td><td class="text-right mono">${fmtNative(e.capital+e.interes+e.extra, e.moneda)}</td><td><span class="badge ${e.estado==='Vencimiento'?'badge-red':'badge-amber'}">${e.estado}</span></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty-state">Sin eventos este día.</div></td></tr>'}</tbody></table>
      </div>
    </div>`;
}

/* ================= PROYECCIONES ================= */
function monthKey(dateStr){ return dateStr.slice(0,7); }
function proyeccionesRows(){
  const cuotas = allCuotasConMeta();
  const map = {};
  cuotas.forEach(c=>{
    const mk = monthKey(c.fecha);
    if(!map[mk]) map[mk] = { capitalCRC:0, interesCRC:0, capitalUSD:0, interesUSD:0, pendientes:0, total:0 };
    map[mk].total++;
    if(c.estado==='Pendiente') map[mk].pendientes++;
    if(c.moneda==='CRC'){ map[mk].capitalCRC+=c.capital; map[mk].interesCRC+=c.interes; }
    else { map[mk].capitalUSD+=c.capital; map[mk].interesUSD+=c.interes; }
  });
  return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).map(([mk,v])=>({
    mes:mk, ...v, estado: v.pendientes===0 ? 'Pagado' : (v.pendientes===v.total ? 'Proyectado' : 'Parcial')
  }));
}
function proyeccionesHtml(){
    const rows = proyeccionesRows();
      return `
          <div class="table-card">
                <div class="panel-header-dark">${ic('trending')}<span>Proyección Mensual de Servicio de Deuda</span><div class="spacer"></div><span style="text-transform:none;font-weight:600;opacity:.8;">Capital + Interés por mes y moneda</span></div>
                      <div class="table-scroll" style="max-height:calc(100vh - 220px);">
                              <table><thead><tr><th>Mes</th><th class="text-right">Capital CRC</th><th class="text-right">Interés CRC</th><th class="text-right">Capital USD</th><th class="text-right">Interés USD</th><th class="text-right">Total (${state.currency})</th><th>Estado</th></tr></thead>
                                      <tbody>${rows.map(r=>{
                                                const totalUSD = toUSD(r.capitalCRC+r.interesCRC,'CRC') + toUSD(r.capitalUSD+r.interesUSD,'USD');
                                                          return `<tr><td><b>${r.mes}</b></td><td class="text-right mono">₡${r.capitalCRC.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono">₡${r.interesCRC.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono">$${r.capitalUSD.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono">$${r.interesUSD.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono"><b>${fmtUSD(totalUSD)}</b></td><td><span class="badge ${r.estado==='Pagado'?'badge-green':(r.estado==='Parcial'?'badge-amber':'badge-blue')}">${r.estado}</span></td></tr>`;
                                                                  }).join('') || '<tr><td colspan="7"><div class="empty-state">Sin cuotas cargadas todavía. Importa historial o crea líneas/leasing con plan de pagos para ver la proyección.</div></td></tr>'}</tbody></table>
                                                                        </div>
                                                                            </div>`;
                                                                            }
                                                                            function tendenciaDeudaPeriods(gran){ const periods = []; const now = new Date(); now.setHours(0,0,0,0); if(gran==='anio'){ const curYear = now.getFullYear(); for(let y=curYear-4; y<=curYear; y++){ const start = new Date(y,0,1); const end = (y===curYear) ? now : new Date(y,11,31); periods.push({ label: String(y), start, end }); } } else { const base = new Date(now.getFullYear(), now.getMonth(), 1); for(let i=11;i>=0;i--){ const d = new Date(base.getFullYear(), base.getMonth()-i, 1); const end = new Date(d.getFullYear(), d.getMonth()+1, 0); periods.push({ label: end.toISOString().slice(0,7), start: d, end }); } } return periods; }
                                                                            function tendenciaDeudaRows(gran){ const now = new Date(); now.setHours(0,0,0,0); const curPeriodo = now.toISOString().slice(0,7); const periods = tendenciaDeudaPeriods(gran||'mes'); return periods.map(p=>{ if(gran!=='anio' && historicoDeuda[p.label] && p.label < curPeriodo){ return { periodo: p.label, totalUSD: historicoDeuda[p.label], esReal: true }; } const cutoff = new Date(p.end); let totalUSD = 0; lines.forEach(l=>{ const inicio = new Date(l.inicio+'T00:00:00'); if(inicio > cutoff) return; const plan = paymentPlans[l.id]||[]; const pagadoHasta = plan.filter(x=> (x.estado==='Pagado'||x.estado==='Conciliado') && new Date(x.fecha+'T00:00:00') <= cutoff).reduce((s,x)=>s+x.capital,0); const saldo = Math.max((l.aprobado||0) - pagadoHasta, 0); totalUSD += toUSD(saldo, l.moneda); }); lineasCanceladas.forEach(l=>{ const inicio = new Date(l.inicio+'T00:00:00'); const fin = new Date(l.vencimiento+'T00:00:00'); if(inicio > cutoff) return; if(fin <= cutoff) return; const pagadoHasta = history.filter(h=>h.linea===l.id && new Date(h.fecha+'T00:00:00') <= cutoff).reduce((s,h)=>s+h.monto,0); const saldo = Math.max((l.monto||0) - pagadoHasta, 0); totalUSD += toUSD(saldo, l.moneda); }); leasingContratos.forEach(l=>{ const inicio = new Date(l.inicio+'T00:00:00'); if(inicio > cutoff) return; const fin = new Date(l.vencimiento+'T00:00:00'); if(fin <= cutoff) return; const plan = leasingPagos[l.id]||[]; const pagadoHasta = plan.filter(x=> (x.estado==='Pagado'||x.estado==='Conciliado') && new Date(x.fecha+'T00:00:00') <= cutoff).reduce((s,x)=>s+x.capital,0); const saldo = Math.max((l.monto||0) - pagadoHasta, 0); totalUSD += toUSD(saldo, l.moneda); }); return { periodo: p.label, totalUSD, esReal: false }; }); }
                                                                            function tendenciaDeudaHtml(){
                                                                                                                                                                                                          const gran = state.deudaGranularidad || 'mes';
                                                                                                                                                                                                            const rows = tendenciaDeudaRows(gran);
                                                                                                                                                                                                              return `
                                                                                                                                                                                                                  <div class="table-card">
                                                                                                                                                                                                                        <div class="panel-header-dark">${ic('trending')}<span>Tendencia de Deuda Total</span><div class="spacer"></div>
                                                                                                                                                                                                                                <select class="tb-select" id="deudaGranSel" style="min-width:140px;margin:0;">
                                                                                                                                                                                                                                          <option value="mes" ${gran==='mes'?'selected':''}>Vista Mensual</option>
                                                                                                                                                                                                                                                    <option value="anio" ${gran==='anio'?'selected':''}>Vista Anual</option>
                                                                                                                                                                                                                                                            </select>
                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                        <div class="table-scroll" style="max-height:150px;">
                                                                                                                                                                                                                                                                                <table>
                                                                                                                                                                                                                                                                                          <thead><tr><th style="min-width:180px;">Concepto</th>${rows.map(r=>`<th class="text-right">${r.periodo}</th>`).join('')}</tr></thead>
                                                                                                                                                                                                                                                                                                    <tbody><tr><td><b>Saldo Total de Deuda (${state.currency})</b></td>${rows.map(r=>`<td class="text-right mono">${fmtUSD(r.totalUSD)}</td>`).join('') || `<td><div class="empty-state">Sin datos.</div></td>`}</tr></tbody>
                                                                                                                                                                                                                                                                                                            </table>
                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                      </div>`;
                                                                                                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                                                                                                      /* ================= LEASING FINANCIERO ================= */
function calcularAmortizacionLeasing(monto, tasaAnual, plazo, fechaPrimerPago, seguroMensual, ivaPct){
  const base = calcularAmortizacion(monto, tasaAnual, plazo, fechaPrimerPago);
  const iva = seguroMensual*(ivaPct/100);
  base.filas = base.filas.map(f=>({...f, seguro:seguroMensual, iva, totalCuota:f.cuota+seguroMensual+iva}));
  base.seguroMensual = seguroMensual; base.iva = iva;
  return base;
}
function leasingEstado(l){
    const saldo = leasingSaldoActual(l);
      const d = daysUntil(l.vencimiento);
        if(saldo<=0) return {label:'Cancelado', cls:'badge-gray'};
          if(d!==null && d<0) return {label:'Vencido', cls:'badge-red'};
            return {label:'Activo', cls:'badge-blue'};
            }
            function filteredLeasing(){
  const q=(state.leasingSearch||'').toLowerCase();
  return leasingContratos.filter(l=> (!q || l.banco.toLowerCase().includes(q) || l.numOp.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) && (!state.leasingEstadoFilter || leasingEstado(l).label===state.leasingEstadoFilter));
}
function leasingRowHtml(l){
  const saldo = leasingSaldoActual(l);
    const badge = leasingEstado(l);
  return `<tr data-id="${l.id}"><td><b>${l.id}</b></td><td>${l.banco}</td><td class="mono">${l.numOp}</td><td><span class="badge badge-gray">${l.moneda}</span></td><td class="text-right mono">${fmtNative(l.monto,l.moneda)}</td><td class="text-right mono">${fmtNative(saldo,l.moneda)}</td><td class="text-right mono">${l.tasa.toFixed(2)}%</td><td>${l.vencimiento}</td><td><span class="badge ${badge.cls}">${badge.label}</span></td></tr>`;
}
function leasingHtml(){
  const ro=isReadOnly();
  const rows=filteredLeasing();
  return `
    <div class="table-card">
      <div class="table-toolbar">
        <div class="tb-search">${ic('search')}<input id="leasingSearchInput" placeholder="Buscar por banco, ID o N° operación..." value="${state.leasingSearch}"></div>
        <select class="tb-select" id="leasingEstadoSel"><option value="">${ic('filter')} Todos los estados</option>${['Activo','Vencido','Cancelado'].map(s=>`<option value="${s}" ${state.leasingEstadoFilter===s?'selected':''}>${s}</option>`).join('')}</select>
        <div class="spacer"></div>
        <button class="btn" id="importLeasingBtn" ${ro?'disabled title="Requiere rol Administrador"':''}>${ic('upload')} Importar Historial</button>
        <button class="btn" id="exportLeasingBtn">${ic('download')} Exportar</button>
        <button class="btn btn-primary" id="newLeasingBtn" ${ro?'disabled title="Requiere rol Administrador"':''}>${ic('plus')} Nuevo Contrato</button>
      </div>
      <div class="table-scroll" style="max-height:calc(100vh - 260px);">
        <table><thead><tr><th>ID</th><th>Banco</th><th>N° Operación</th><th>Moneda</th><th class="text-right">Monto Original</th><th class="text-right">Saldo Actual</th><th class="text-right">Tasa</th><th>Vencimiento</th><th>Estado</th></tr></thead>
        <tbody id="leasingBody">${rows.map(leasingRowHtml).join('') || '<tr><td colspan="9"><div class="empty-state">Sin contratos de leasing. Impórtalos o crea uno nuevo.</div></td></tr>'}</tbody></table>
      </div>
    </div>`;
}
function openLeasingDetailModal(id){
  const l = leasingContratos.find(x=>x.id===id);
  if(!l) return;
  const plan = leasingPagos[id]||[];
  const saldo = leasingSaldoActual(l);
  const ro = isReadOnly();
  openModal(`
    <div class="modal-header"><div><h2>${l.numOp||l.id} — ${l.banco}</h2><div class="sub">Contrato de Leasing N° ${l.numOp}</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="detail-row"><span class="k">Monto Original</span><span class="v">${fmtFullNative(l.monto,l.moneda)}</span></div>
      <div class="detail-row"><span class="k">Saldo Actual</span><span class="v">${fmtFullNative(saldo,l.moneda)}</span></div>
      <div class="detail-row"><span class="k">Tasa</span><span class="v">${l.tasa.toFixed(2)}% anual</span></div>
      <div class="detail-row"><span class="k">Plazo</span><span class="v">${l.plazo} meses</span></div>
      <div class="detail-row"><span class="k">Vencimiento</span><span class="v">${l.vencimiento}</span></div>
      <div class="table-scroll" style="max-height:220px;border:1px solid var(--border);border-radius:8px;margin-top:12px;">
        <table><thead><tr><th>Fecha</th><th class="text-right">Capital</th><th class="text-right">Interés</th><th class="text-right">Seguro</th><th class="text-right">IVA</th><th class="text-right">Total Cuota</th><th>Estado</th><th></th></tr></thead>
        <tbody>${plan.map(p=>`<tr><td>${p.fecha}</td><td class="text-right mono">${fmtNative(p.capital,l.moneda)}</td><td class="text-right mono">${fmtNative(p.interes,l.moneda)}</td><td class="text-right mono">${fmtNative(p.seguro||0,l.moneda)}</td><td class="text-right mono">${fmtNative(p.iva||0,l.moneda)}</td><td class="text-right mono"><b>${fmtNative(p.capital+p.interes+(p.seguro||0)+(p.iva||0),l.moneda)}</b></td><td><span class="badge ${p.estado==='Pagado'?'badge-green':'badge-amber'}">${p.estado}</span></td><td>${p.estado==='Pendiente'?`<button class="btn" data-pay-row="${p._row}" ${ro?'disabled':''} style="padding:4px 8px;font-size:11px;">Marcar pagada</button>`:''}</td></tr>`).join('') || '<tr><td colspan="8"><div class="empty-state">Sin cuotas registradas.</div></td></tr>'}</tbody></table>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cerrar</button></div>`);
  document.querySelectorAll('[data-pay-row]').forEach(btn=>{
    btn.addEventListener('click', ()=> guard(()=>{
      callServer('registrarPagoLeasing', [{ contratoId:id, cuotaRow:Number(btn.dataset.payRow) }], ()=>{
        closeModal(); reloadData(()=>{ renderContent(); toast('Cuota conciliada.'); });
      });
    }));
  });
}
function openNewLeasingModal(){
  const banks = Object.keys(bankLimits);
  openModal(`
    <div class="modal-header"><div><h2>Nuevo Contrato de Leasing</h2><div class="sub">Genera el plan de pagos con capital, interés, seguro e IVA por cuota</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field"><label>Banco</label><select id="ls_banco">${banks.map(b=>`<option>${b}</option>`).join('')}</select></div>
        <div class="form-field"><label>N° Operación</label><input type="text" id="ls_numop" placeholder="Ej: 120003216"></div>
        <div class="form-field"><label>Fecha Desembolso</label><input type="date" id="ls_desembolso"></div>
        <div class="form-field"><label>Monto Original</label><input type="number" id="ls_monto" placeholder="0.00"></div>
        <div class="form-field"><label>Moneda</label><select id="ls_moneda"><option value="USD">USD — Dólar</option><option value="CRC">CRC — Colón</option></select></div>
        <div class="form-field"><label>Tasa Anual (%)</label><input type="number" step="0.01" id="ls_tasa" placeholder="8.00"></div>
        <div class="form-field"><label>Plazo (meses)</label><input type="number" id="ls_plazo" value="60"></div>
        <div class="form-field"><label>Fecha 1° Pago</label><input type="date" id="ls_primerpago"></div>
        <div class="form-field"><label>Seguro Mensual</label><input type="number" step="0.01" id="ls_seguro" value="0"></div>
        <div class="form-field"><label>IVA sobre Seguro (%)</label><input type="number" step="0.01" id="ls_iva" value="13"></div>
      </div>
      <div style="margin-top:14px;"><button class="btn" id="calcLeasingBtn">${ic('percent')} Calcular Plan de Pagos</button></div>
      <div id="leasingScheduleResult" style="margin-top:14px;"></div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="saveLeasingBtn" disabled>${ic('plus')} Guardar Contrato</button></div>`);
  let scheduleData=null;
  document.getElementById('calcLeasingBtn').addEventListener('click', ()=>{
    const banco=document.getElementById('ls_banco').value;
    const numOp=document.getElementById('ls_numop').value.trim();
    const monto=parseFloat(document.getElementById('ls_monto').value)||0;
    const moneda=document.getElementById('ls_moneda').value;
    const tasa=parseFloat(document.getElementById('ls_tasa').value)||0;
    const plazo=parseInt(document.getElementById('ls_plazo').value)||0;
    const primerPago=document.getElementById('ls_primerpago').value;
    const desembolso=document.getElementById('ls_desembolso').value;
    const seguro=parseFloat(document.getElementById('ls_seguro').value)||0;
    const ivaPct=parseFloat(document.getElementById('ls_iva').value)||0;
    if(!numOp){ toast('Ingresa el N° de Operación.', true); return; }
    if(monto<=0){ toast('Ingresa un monto válido.', true); return; }
    if(plazo<=0||plazo>60){ toast('El plazo debe estar entre 1 y 60 meses.', true); return; }
    if(!primerPago || !desembolso){ toast('Completa las fechas.', true); return; }
    scheduleData = calcularAmortizacionLeasing(monto,tasa,plazo,primerPago,seguro,ivaPct);
    scheduleData.banco=banco; scheduleData.numOp=numOp; scheduleData.monto=monto; scheduleData.moneda=moneda; scheduleData.tasa=tasa; scheduleData.plazo=plazo; scheduleData.desembolso=desembolso; scheduleData.primerPago=primerPago; scheduleData.seguro=seguro; scheduleData.ivaPct=ivaPct;
    document.getElementById('leasingScheduleResult').innerHTML = `
      <div class="detail-row"><span class="k">Cuota Base (capital+interés)</span><span class="v">${SYM[moneda]}${scheduleData.cuotaMensual.toLocaleString('es-CR',{maximumFractionDigits:2})}</span></div>
      <div class="detail-row"><span class="k">Cuota Total (con seguro+IVA)</span><span class="v">${SYM[moneda]}${scheduleData.filas[0].totalCuota.toLocaleString('es-CR',{maximumFractionDigits:2})}</span></div>
      <div class="detail-row"><span class="k">Fecha de Vencimiento</span><span class="v">${scheduleData.vencimiento}</span></div>
      <div class="table-scroll" style="max-height:220px;border:1px solid var(--border);border-radius:8px;margin-top:10px;">
        <table><thead><tr><th>#</th><th>Fecha</th><th class="text-right">Capital</th><th class="text-right">Interés</th><th class="text-right">Seguro</th><th class="text-right">IVA</th><th class="text-right">Total</th></tr></thead>
        <tbody>${scheduleData.filas.map(f=>`<tr><td>${f.n}</td><td>${f.fecha}</td><td class="text-right mono">${f.capital.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono">${f.interes.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono">${f.seguro.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono">${f.iva.toLocaleString('es-CR',{maximumFractionDigits:0})}</td><td class="text-right mono">${f.totalCuota.toLocaleString('es-CR',{maximumFractionDigits:0})}</td></tr>`).join('')}</tbody></table>
      </div>`;
    document.getElementById('saveLeasingBtn').disabled=false;
  });
  document.getElementById('saveLeasingBtn').addEventListener('click', ()=>{
    if(!scheduleData){ toast('Primero calcula el plan de pagos.', true); return; }
    const btn = document.getElementById('saveLeasingBtn'); btn.disabled = true;
    const payload = { banco:scheduleData.banco, numOp:scheduleData.numOp, desembolso:scheduleData.desembolso, monto:scheduleData.monto, moneda:scheduleData.moneda, tasa:scheduleData.tasa, plazo:scheduleData.plazo, primerPago:scheduleData.primerPago, seguro:sscheduleData.seguro, ivaPct:scheduleData.ivaPct };
    callServer('crearLeasing', [payload], res=>{
      closeModal(); reloadData(()=>{ renderContent(); toast('Contrato '+res.id+' guardado con '+scheduleData.plazo+' cuotas.'); });
    }, ()=>{ btn.disabled = false; });
  });
}
function openImportLeasingModal(){
  openModal(`
    <div class="modal-header"><div><h2>Importar Historial de Leasing</h2><div class="sub">Pega los contratos y sus cuotas según el formato de tu archivo</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="import-hint">Contratos — Columnas: <code>Banco,N° Operación,Fecha Desembolso,Monto Original,Moneda,Tasa (%),Plazo,Fecha Vencimiento,Estado</code></div>
      <textarea class="csv-textarea" id="leasingContratosArea" rows="4" placeholder="BCT,120002694,2024-03-25,51360,USD,10,60,2029-03-02,Activo"></textarea>
      <div class="import-hint" style="margin-top:12px;">Cuotas — Columnas: <code>Banco,N° Operación,Fecha Pago,Capital,Interés,Seguro,IVA,Estado</code></div>
      <textarea class="csv-textarea" id="leasingCuotasArea" rows="4" placeholder="BCT,120002694,2024-04-02,1035,0,211.5,27.5,Cancelado"></textarea>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="importLeasingConfirmBtn">${ic('upload')} Validar y Cargar</button></div>`);
  document.getElementById('importLeasingConfirmBtn').addEventListener('click', ()=>{
    const btn = document.getElementById('importLeasingConfirmBtn'); btn.disabled = true;
    const rawC = document.getElementById('leasingContratosArea').value;
    const rawP = document.getElementById('leasingCuotasArea').value;
    const contratosRows = rawC.trim() ? parseCSV(rawC) : [];
    const cuotasRows = rawP.trim() ? parseCSV(rawP) : [];
    callServer('importarLeasing', [contratosRows, cuotasRows], res=>{
      toast(res.addedC+' contrato(s) y '+res.addedP+' cuota(s) agregadas ('+res.dupC+res.dupP+' duplicadas, '+(res.invalidC+res.invalidP)+' inválidas).');
      closeModal(); reloadData(()=> renderContent());
    }, ()=>{ btn.disabled = false; });
  });
}

/* ================= HISTÓRI��O ================= */
function historicoHtml(){
  const tabs = [['canceladas','Líneas Canceladas'],['pagos','Pagos Históricos']];
  const tabBar = `<div class="tab-bar">${tabs.map(([k,label])=>`<div class="tab-btn ${state.historicoTab===k?'active':''}" data-htab="${k}">${label}</div>`).join('')}</div>`;
  let body='';
  if(state.historicoTab==='canceladas'){
    body = `<div class="table-scroll" style="max-height:calc(100vh - 320px);">
      <table><thead><tr><th>ID</th><th>Banco</th><th>N° Operación</th><th>Moneda</th><th class="text-right">Monto</th><th class="text-right">Tasa</th><th>Desembolso</th><th>Vencimiento</th></tr></thead>
      <tbody>${lineasCanceladas.map(l=>`<tr><td><b>${l.id}</b></td><td>${l.banco}</td><td class="mono">${l.numOp}</td><td>${l.moneda}</td><td class="text-right mono">${fmtNative(l.monto,l.moneda)}</td><td class="text-right mono">${l.tasa.toFixed(2)}%</td><td>${l.inicio}</td><td>${l.vencimiento}</td></tr>`).join('') || '<tr><td colspan="8"><div class="empty-state">Sin líneas canceladas registradas.</div></td></tr>'}</tbody></table>
    </div>`;
  } else {
    body = `<div class="table-scroll" style="max-height:calc(100vh - 320px);">
      <table><thead><tr><th>ID Pago</th><th>Línea</th><th>Banco</th><th>Fecha</th><th class="text-right">Monto</th><th>Estado</th><th></th></tr></thead>
      <tbody>${history.map(h=>{ const line=lines.find(l=>l.id===h.linea); const cur=line?line.moneda:'USD'; return `<tr><td><b>${h.id}</b></td><td>${line?.numOp||h.linea}</td><td>${h.banco}</td><td>${h.fecha}</td><td class="text-right mono">${fmtNative(h.monto,cur)}</td><td><span class="badge ${h.estado==='Conciliado'?'badge-green':'badge-amber'}">${h.estado}</span></td><td>${isReadOnly()?'':'<button class="btn" style="padding:3px 8px;font-size:11px;" data-delp="${h.id}">Eliminar</button>'}</td></tr>`; }).join('') || '<tr><td colspan="7"><div class="empty-state">Sin pagos históricos registrados.</div></td></tr>'}</tbody></table>
    </div>`;
  }
  return `<div class="table-card">
    <div class="panel-header-dark">${ic('history')}<span>Histórico de Deuda</span><div class="spacer"></div>
      <button class="btn" id="exportHistoricoBtn" style="background:transparent;border-color:rgba(255,255,255,.3);color:#fff;">${ic('download')} Exportar</button>
    </div>
    ${tabBar}
    ${body}
  </div>`;
}

/* ================= APARTADO DE INTERESES ================= */
let _interesesData = null;

function interesesLoadingHtml(){
  return `<div class="table-card" style="padding:32px;text-align:center;">
    <div class="spinner" style="margin:0 auto 12px;"></div>
    <span class="text-muted">Calculando intereses causados y proyección…</span>
  </div>`;
}

async function loadIntereses(){
  try {
    const r = await fetch('/api/intereses');
    const d = await r.json();
    if(!d.ok) throw new Error(d.error);
    _interesesData = d;
    const c = document.getElementById('moduleContent');
    if(c && state.activeModule==='intereses') c.innerHTML = interesesHtml(d);
  } catch(e) {
    const c = document.getElementById('moduleContent');
    if(c) c.innerHTML = `<div class="table-card" style="padding:24px;"><div class="alert alert-error">Error al cargar intereses: ${e.message}</div></div>`;
  }
}

function interesesHtml(d){
  const {periodos, totales: tot, causado, ejecutado, proyeccion} = d;
  const pAnt = periodos.causado.label;
  const pSig = periodos.proyeccion.label;

  function fmtNum(n, moneda){
    if(!n) return '—';
    const sym = moneda==='USD' ? '$' : '₡';
    return sym + ' ' + n.toLocaleString('es-CR', {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  function pct(t){ return t > 1 ? (t*100).toFixed(2)+'%' : (t*100).toFixed(2)+'%'; }

  const diffSign = (tot.diferencia.crc >= 0 && tot.diferencia.usd >= 0) ? 'color:#C00000' : 'color:#375623';

  // KPIs
  const kpis = `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
    <div class="kpi-card">
      <span class="kpi-label">Causado ${pAnt}</span>
      <div class="kpi-value" style="font-size:18px;color:#0070C0;">${fmtNum(tot.causado.crc,'CRC')}</div>
      ${tot.causado.usd ? `<div class="kpi-sub" style="color:#FF6600;">${fmtNum(tot.causado.usd,'USD')}</div>` : ''}
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Ejecutado Real ${pAnt}</span>
      <div class="kpi-value" style="font-size:18px;color:#0070C0;">${fmtNum(tot.ejecutado.crc,'CRC')}</div>
      ${tot.ejecutado.usd ? `<div class="kpi-sub" style="color:#FF6600;">${fmtNum(tot.ejecutado.usd,'USD')}</div>` : ''}
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Proyección ${pSig}</span>
      <div class="kpi-value" style="font-size:18px;color:#FF6600;">${fmtNum(tot.proyeccion.crc,'CRC')}</div>
      ${tot.proyeccion.usd ? `<div class="kpi-sub" style="color:#FF6600;">${fmtNum(tot.proyeccion.usd,'USD')}</div>` : ''}
    </div>
  </div>`;

  // Tabla diferencia causado vs ejecutado
  const difNote = `<div class="table-card" style="margin-bottom:16px;">
    <div class="panel-header-dark" style="display:flex;justify-content:space-between;align-items:center;">
      ${ic('cash')}<span>Resumen Ejecutivo — ${pAnt}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--border);">
      ${[['Causado (devengado)', fmtNum(tot.causado.crc,'CRC'), fmtNum(tot.causado.usd,'USD'), ''],
         ['Ejecutado Real (pagado)', fmtNum(tot.ejecutado.crc,'CRC'), fmtNum(tot.ejecutado.usd,'USD'), ''],
         ['Diferencia Causado − Ejecutado', fmtNum(Math.abs(tot.diferencia.crc),'CRC'), fmtNum(Math.abs(tot.diferencia.usd),'USD'), diffSign]
        ].map(([lbl,crc,usd,style])=>`<div style="padding:12px 16px;border-right:1px solid var(--border);">
          <div class="text-muted" style="font-size:11px;margin-bottom:4px;">${lbl}</div>
          <div class="mono" style="font-size:14px;font-weight:600;color:#0070C0;">${crc}</div>
          ${usd && usd!=='—' ? `<div class="mono" style="font-size:12px;color:#FF6600;">${usd}</div>` : ''}
        </div>`).join('')}
    </div>
    <div style="padding:10px 16px;font-size:11px;font-style:italic;color:#7F6000;background:#FFFDE7;">
      La diferencia puede originarse por amortizaciones dentro del período, desfase contable/bancario o ajustes de días hábiles.
    </div>
  </div>`;

  // Tabla intereses — sin template literals anidados >2 niveles
  function tablaIntereses(filas, cols, title, color){
    if(!filas.length) return '<div class="table-card" style="margin-bottom:16px;"><div class="panel-header-dark">' + ic('percent') + '<span>' + title + '</span></div><div style="padding:24px;text-align:center;" class="text-muted">Sin datos para este período.</div></div>';
    var ths = cols.map(function(c){ return '<th class="' + (c.cls||'') + '">' + c.label + '</th>'; }).join('');
    var trs = filas.map(function(f,i){
      var isUsd = f.moneda === 'USD';
      var intColor = isUsd ? '#FF6600' : '#0070C0';
      var extraCols = '';
      if(cols.length > 5){
        extraCols += '<td class="text-right mono" style="color:#0070C0;">' + fmtNum(f.capital, f.moneda) + '</td>';
        extraCols += '<td class="text-right mono">' + (f.tasa * 100).toFixed(2) + '%</td>';
        if(f.fechaPago !== undefined) extraCols += '<td class="text-center">' + (f.fechaPago||'—') + '</td>';
        extraCols += '<td class="text-center">' + (f.desde||'') + '</td>';
        extraCols += '<td class="text-center">' + (f.hasta||'') + '</td>';
        extraCols += '<td class="text-right mono">' + (f.dias||0) + '</td>';
      } else {
        extraCols += '<td class="text-center">' + (f.fecha||'') + '</td>';
      }
      return '<tr class="' + (i%2?'alt-row':'') + '">'
        + '<td>' + f.banco + '</td>'
        + '<td class="mono">' + f.op + '</td>'
        + '<td><span class="badge badge-blue">' + f.moneda + '</span></td>'
        + extraCols
        + '<td class="text-right mono" style="font-weight:600;color:' + intColor + ';">' + fmtNum(f.interes, f.moneda) + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="table-card" style="margin-bottom:16px;">'
      + '<div class="panel-header-dark" style="background:' + color + ';">' + ic('percent') + '<span>' + title + '</span></div>'
      + '<div class="table-scroll" style="max-height:360px;">'
      + '<table><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>'
      + '</div></div>';
  }

  const colsCausado = [{label:'Banco'},{label:'N° Operación',cls:'mono'},{label:'Moneda'},{label:'Capital',cls:'text-right'},{label:'Tasa',cls:'text-right'},{label:'Últ. Pago',cls:'text-center'},{label:'Desde',cls:'text-center'},{label:'Hasta',cls:'text-center'},{label:'Días',cls:'text-right'},{label:'Interés Causado',cls:'text-right'}];
  const colsEjec   = [{label:'Banco'},{label:'N° Operación',cls:'mono'},{label:'Moneda'},{label:'Fecha Pago',cls:'text-center'},{label:'Interés Pagado',cls:'text-right'}];
  const colsProy   = [{label:'Banco'},{label:'N° Operación',cls:'mono'},{label:'Moneda'},{label:'Capital',cls:'text-right'},{label:'Tasa',cls:'text-right'},{label:'Desde',cls:'text-center'},{label:'Hasta',cls:'text-center'},{label:'Días',cls:'text-right'},{label:'Interés Proyectado',cls:'text-right'}];

  const tCausado    = tablaIntereses(causado,    colsCausado, `Interés Causado — ${pAnt}`,    '#1F3864');
  const tEjecutado  = tablaIntereses(ejecutado,  colsEjec,   `Ejecutado Real — ${pAnt}`,     '#375623');
  const tProyeccion = tablaIntereses(proyeccion, colsProy,   `Proyección Próximo Pago — ${pSig}`, '#C55A11');

  return kpis + difNote + tCausado + tEjecutado + tProyeccion;
}

function moduleTitle(){
  return {dashboard:'Panel de Control', lines:'Operaciones', calendario:'Calendario de Pagos', proyecciones:'Proyecciones', leasing:'Leasing Financiero', ops:'Conciliación', historico:'Histórico', intereses:'Apartado de Intereses', reportes:'Reportes', centrodatos:'Centro de Datos', carga:'Importar histórico', usuarios:'Usuarios', audit:'Seguridad y Auditoría'}[state.activeModule];
}

/* ================= REPORTES ================= */
function reportesHtml(){
  const reports = [
    { id:'r_operaciones', nombre:'Operaciones Activas', desc:'Listado completo de líneas activas con saldos y condiciones.' },
    { id:'r_canceladas', nombre:'Operaciones Canceladas', desc:'Histórico completo de líneas finalizadas.' },
    { id:'r_pagos', nombre:'Pagos Históricos', desc:'Todos los pagos registrados y su estado de conciliación.' },
    { id:'r_leasing', nombre:'Contratos de Leasing', desc:'Listado de contratos de leasing con saldo actual.' },
    { id:'r_exposicion', nombre:'Exposición por Banco', desc:'Límite, usado y disponible por banco (moneda actual).' },
    { id:'r_auditoria', nombre:'Bitácora de Auditoría', desc:'Historial de acciones del sistema.' },
  ];
  return `<div class="table-card">
    <div class="panel-header-dark">${ic('report')}<span>Reportes</span></div>
    <div class="import-panel" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${reports.map(r=>`<div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <b style="font-size:13px;">${r.nombre}</b><span class="text-muted" style="font-size:11.5px;">${r.desc}</span>
        <button class="btn" data-report="${r.id}" style="align-self:flex-start;">${ic('download')} Exportar CSV</button>
      </div>`).join('')}
    </div>
  </div>`;
}
function runReport(id){
  if(id==='r_operaciones') exportCSV(lines, ['id','numOp','banco','tipo','moneda','aprobado','tasa','plazo','vencimiento'], 'operaciones_activas.csv');
  if(id==='r_canceladas') exportCSV(lineasCanceladas, ['id','numOp','banco','moneda','monto','tasa','plazo','inicio','vencimiento'], 'operaciones_canceladas.csv');
  if(id==='r_pagos') exportCSV(history, ['id','linea','banco','fecha','monto','estado'], 'pagos_historicos.csv');
  if(id==='r_leasing') exportCSV(leasingContratos, ['id','numOp','banco','moneda','monto','tasa','plazo','vencimiento','estado'], 'leasing_contratos.csv');
  if(id==='r_exposicion') exportCSV(bankExposureRows(), ['banco','aprobadoUSD','dispuestoUSD','disponibleUSD','util'], 'exposicion_por_banco.csv');
  if(id==='r_auditoria') exportCSV(auditLog, ['usuario','accion','modulo','fecha','resultado'], 'bitacora_auditoria.csv');
  toast('Reporte exportado.');
}

/* ================= CENTRO DE DATOS ================= */
function centroDatosHtml(){
  const q = (state.datosSearch||'').toLowerCase();
  const results = [];
  lines.forEach(l=>{ if(!q || l.banco.toLowerCase().includes(q) || (l.numOp||'').toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) results.push({tipo:'Operación Activa', id:l.id, banco:l.banco, numOp:l.numOp, monto:fmtNative(lineaSaldoActual(l),l.moneda), estado: estadoLinea(l).label}); });
  lineasCanceladas.forEach(l=>{ if(!q || l.banco.toLowerCase().includes(q) || l.numOp.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) results.push({tipo:'Operación Cancelada', id:l.id, banco:l.banco, numOp:l.numOp, monto:fmtNative(l.monto,l.moneda), estado:'Cancelada'}); });
  leasingContratos.forEach(l=>{ if(!q || l.banco.toLowerCase().includes(q) || l.numOp.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) results.push({tipo:'Leasing', id:l.id, banco:l.banco, numOp:l.numOp, monto:fmtNative(l.monto,l.moneda), estado:l.estado}); });
  return `
    <div class="kpi-grid">
      <div class="kpi-card"><span class="kpi-label">Operaciones Activas</span><div class="kpi-value">${lines.length}</div></div>
      <div class="kpi-card"><span class="kpi-label">Operaciones Canceladas</span><div class="kpi-value">${lineasCanceladas.length}</div></div>
      <div class="kpi-card"><span class="kpi-label">Contratos de Leasing</span><div class="kpi-value">${leasingContratos.length}</div></div>
      <div class="kpi-card"><span class="kpi-label">Usuarios Registrados</span><div class="kpi-value">${usuarios.length}</div></div>
    </div>
    <div class="table-card">
      <div class="table-toolbar"><div class="tb-search">${ic('search')}<input id="datosSearchInput" placeholder="Buscar en todos los datos maestros (banco, N° operación, ID)..." value="${state.datosSearch}"></div></div>
      <div class="table-scroll" style="max-height:calc(100vh - 380px);">
        <table><thead><tr><th>Tipo</th><th>ID</th><th>Banco</th><th>N° Operación</th><th class="text-right">Monto</th><th>Estado</th></tr></thead>
        <tbody>${results.map(r=>`<tr><td><span class="badge badge-blue">${r.tipo}</span></td><td><b>${r.id}</b></td><td>${r.banco}</td><td class="mono">${r.numOp||'—'}</td><td class="text-right mono">${r.monto}</td><td>${r.estado}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty-state">Sin resultados.</div></td></tr>'}</tbody></table>
      </div>
    </div>`;
}

/* ================= USUARIOS ================= */
function usuariosHtml(){
  const ro = isReadOnly();
  return `
    <div class="table-card">
      <div class="table-toolbar"><b style="font-size:13px;">Directorio de Usuarios</b><div class="spacer"></div><button class="btn btn-primary" id="newUserBtn" ${ro?'disabled title="Requiere rol Administrador"':''}>${ic('plus')} Nuevo Usuario</button></div>
      <div class="import-hint" style="padding:10px 14px 0;">El rol se asigna aquí o directamente en la hoja <b>Usuarios</b> del Sheet. Solo cuentas de Google presentes en esa hoja pueden entrar al sistema.</div>
      <div class="table-scroll" style="max-height:calc(100vh - 300px);">
        <table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th></th></tr></thead>
        <tbody>${usuarios.map(u=>`<tr><td><b>${u.nombre}</b></td><td>${u.email}</td><td><span class="role-pill ${u.rol==='Admin'?'admin':'consulta'}">${u.rol}</span></td><td>${isReadOnly()?'':'<button class="btn" style="padding:3px 8px;font-size:11px;" data-editu="${u.email}">Editar</button>'}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty-state">Sin usuarios.</div></td></tr>'}</tbody></table>
      </div>
    </div>`;
}
function openNewUserModal(){
  openModal(`
    <div class="modal-header"><div><h2>Nuevo Usuario</h2><div class="sub">Agrega una cuenta de Google autorizada para entrar al sistema</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field full"><label>Nombre</label><input type="text" id="u_nombre" placeholder="Nombre completo"></div>
        <div class="form-field full"><label>Email (cuenta de Google)</label><input type="email" id="u_email" placeholder="usuario@cofersa.cr"></div>
        <div class="form-field"><label>Rol</label><select id="u_rol"><option value="Consulta">Consulta</option><option value="Admin">Admin</option></select></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="saveUserBtn">${ic('plus')} Guardar</button></div>`);
  document.getElementById('saveUserBtn').addEventListener('click', ()=>{
    const nombre=document.getElementById('u_nombre').value.trim();
    const email=document.getElementById('u_email').value.trim();
    const rol=document.getElementById('u_rol').value;
    if(!nombre||!email){ toast('Completa nombre y correo.', true); return; }
    const btn = document.getElementById('saveUserBtn'); btn.disabled = true;
    callServer('crearUsuario', [{nombre, email, rol}], ()=>{
      closeModal(); reloadData(()=>{ renderContent(); toast('Usuario agregado.'); });
    }, ()=>{ btn.disabled = false; });
  });
}

/* ================= EVENTS PER CONTENT ================= */
function bindContentEvents(){
  if(state.activeModule==='dashboard'){
  const gsel = document.getElementById('deudaGranSel');
  if(gsel) gsel.addEventListener('change', e=>{ state.deudaGranularidad = e.target.value; renderContent(); });
  }
  if(state.activeModule==='lines'){
    document.getElementById('searchInput').addEventListener('input', e=>{ state.searchQuery=e.target.value; document.getElementById('linesBody').innerHTML = filteredLines().map(lineRowHtml).join('') || '<tr><td colspan="10"><div class="empty-state">No se encontraron líneas de crédito con ese criterio.</div></td></tr>'; bindRowClicks(); });
    document.getElementById('bankFilterSel').addEventListener('change', e=>{ state.bankFilter=e.target.value; renderContent(); });
    document.getElementById('lineEstadoSel').addEventListener('change', e=>{ state.lineEstadoFilter=e.target.value; renderContent();})
    document.getElementById('exportLinesBtn').addEventListener('click', ()=>{ exportCSV(filteredLines(), ['id','banco','tipo','moneda','aprobado','tasa','vencimiento'], 'lineas_credito.csv'); toast('Archivo CSV exportado.'); });
    document.getElementById('newLineBtn').addEventListener('click', ()=> guard(openNewLineScheduleModal));
    bindRowClicks();
  }
  if(state.activeModule==='ops'){
    document.getElementById('bulkUploadBtn').addEventListener('click', ()=> guard(openBulkUploadModal));
    document.getElementById('newPaymentBtn').addEventListener('click', ()=> guard(openNewPaymentModal));
    document.getElementById('historySearchInput').addEventListener('input', e=>{ state.historySearch = e.target.value; renderContent(); });
    document.getElementById('exportHistoryBtn').addEventListener('click', ()=>{ exportCSV(history, ['id','linea','banco','fecha','monto','estado'], 'historico_pagos.csv'); toast('Archivo CSV exportado.'); });
    document.getElementById('pagoEstadoSel').addEventListener('change', e=>{ state.pagoEstadoFilter=e.target.value; renderContent(); }); document.getElementById('histEstadoSel').addEventListener('change', e=>{ state.histEstadoFilter=e.target.value; renderContent(); });
  }
  if(state.activeModule==='carga'){
    document.querySelectorAll('.tab-bar .tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ state.cargaTab = btn.dataset.tab; renderContent(); });
    });
    const aBtn = document.getElementById('importActivasBtn'); if(aBtn) aBtn.addEventListener('click', ()=> guard(importActivas));
    const cBtn = document.getElementById('importCanceladasBtn'); if(cBtn) cBtn.addEventListener('click', ()=> guard(importCanceladas));
    const pBtn = document.getElementById('importPagosBtn'); if(pBtn) pBtn.addEventListener('click', ()=> guard(importPagos));
    document.getElementById('openScheduleModalBtn').addEventListener('click', ()=> guard(openNewLineScheduleModal));
  }
  if(state.activeModule==='calendario'){
    const prevB=document.getElementById('calPrevBtn'); if(prevB) prevB.addEventListener('click', ()=>{ state.calMonth--; if(state.calMonth<0){state.calMonth=11; state.calYear--;} state.calSelectedDate=null; renderContent(); });
    const nextB=document.getElementById('calNextBtn'); if(nextB) nextB.addEventListener('click', ()=>{ state.calMonth++; if(state.calMonth>11){state.calMonth=0; state.calYear++;} state.calSelectedDate=null; renderContent(); });
    document.querySelectorAll('.cal-cell[data-date]').forEach(cell=>{
      cell.addEventListener('click', ()=>{ state.calSelectedDate = cell.dataset.date; renderContent(); });
    });
  }
  if(state.activeModule==='leasing'){
    document.getElementById('leasingSearchInput').addEventListener('input', e=>{ state.leasingSearch=e.target.value; renderContent(); });
    document.getElementById('leasingEstadoSel').addEventListener('change', e=>{ state.leasingEstadoFilter=e.target.value; renderContent(); });
    document.getElementById('importLeasingBtn').addEventListener('click', ()=> guard(openImportLeasingModal));
    document.getElementById('exportLeasingBtn').addEventListener('click', ()=>{ exportCSV(leasingContratos, ['id','numOp','banco','moneda','monto','tasa','plazo','vencimiento','estado'], 'leasing_contratos.csv'); toast('Archivo CSV exportado.'); });
    document.getElementById('newLeasingBtn').addEventListener('click', ()=> guard(openNewLeasingModal));
    document.querySelectorAll('#leasingBody tr[data-id]').forEach(tr=>{ tr.addEventListener('click', ()=> openLeasingDetailModal(tr.dataset.id)); });
  }
  if(state.activeModule==='historico'){
    document.querySelectorAll('.tab-bar .tab-btn[data-htab]').forEach(btn=>{ btn.addEventListener('click', ()=>{ state.historicoTab=btn.dataset.htab; renderContent(); }); });
    document.getElementById('exportHistoricoBtn').addEventListener('click', ()=>{
      if(state.historicoTab==='canceladas') exportCSV(lineasCanceladas, ['id','numOp','banco','moneda','monto','tasa','plazo','inicio','vencimiento'], 'lineas_canceladas.csv');
      else exportCSV(history, ['id','linea','banco','fecha','monto','estado'], 'pagos_historicos.csv');
      toast('Archivo CSV exportado.');
    });
  }
    document.querySelectorAll('[data-delp]').forEach(btn=>{ btn.addEventListener('click', e=>{ e.stopPropagation(); guard(()=>{ if(!confirm('¿Eliminar este pago? Esta acción no se puede deshacer.')) return; callServer('eliminarPago', [btn.dataset.delp], ()=>{ reloadData(()=>{ renderContent(); toast('Pago eliminado.'); }); }); }); }); });
  if(state.activeModule==='reportes'){
    document.querySelectorAll('[data-report]').forEach(btn=>{ btn.addEventListener('click', ()=> runReport(btn.dataset.report)); });
  }
  if(state.activeModule==='centrodatos'){
    document.getElementById('datosSearchInput').addEventListener('input', e=>{ state.datosSearch=e.target.value; renderContent(); });
  }
  if(state.activeModule==='usuarios'){
    document.getElementById('newUserBtn').addEventListener('click', ()=> guard(openNewUserModal));
    document.querySelectorAll('[data-editu]').forEach(btn=>{ btn.addEventListener('click', e=>{ e.stopPropagation(); guard(()=> openEditUserModal(btn.dataset.editu)); }); });
  }
}
function bindRowClicks(){
  document.querySelectorAll('#linesBody tr[data-id]').forEach(tr=>{
    if(tr.dataset.cancelada) return; tr.addEventListener('click', ()=> openLineDetailModal(tr.dataset.id));
  });
}

/* ================= EXPORT ================= */
function exportCSV(rows, cols, filename){
  const header = cols.join(',');
  const body = rows.map(r=>cols.map(c=>String(r[c]??'').replace(/,/g,';')).join(',')).join('\n');
  const blob = new Blob([header+'\n'+body], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ================= MODALS ================= */
function openModal(innerHtml){
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" id="modalBackdrop"><div class="modal">${innerHtml}</div></div>`;
  requestAnimationFrame(()=> document.getElementById('modalBackdrop').classList.add('open'));
  document.getElementById('modalBackdrop').addEventListener('click', e=>{ if(e.target.id==='modalBackdrop') closeModal(); });
}
function closeModal(){
  const bd = document.getElementById('modalBackdrop');
  if(!bd) return;
  bd.classList.remove('open');
  setTimeout(()=>{ document.getElementById('modal-root').innerHTML=''; }, 160);
}
function openLineDetailModal(id){
  const l = lines.find(x=>x.id===id);
  if(!l) return;
  const est = estadoLinea(l);
  const saldo = lineaSaldoActual(l);
  const plan = paymentPlans[l.id]||[];
  const puedeArchivar = saldo<=0 && plan.length>0;
  openModal(`
    <div class="modal-header"><div><h2>${l.id} — ${l.banco}</h2><div class="sub">${l.tipo}</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div style="margin-bottom:12px;"><span class="badge ${est.cls}">${est.label}</span></div>
      <div class="detail-row"><span class="k">Moneda</span><span class="v">${l.moneda}</span></div>
      <div class="detail-row"><span class="k">Monto Aprobado</span><span class="v">${fmtFullNative(l.aprobado,l.moneda)}</span></div>
      <div class="detail-row"><span class="k">Saldo Actual</span><span class="v">${fmtFullNative(saldo,l.moneda)}</span></div>
      <div class="detail-row"><span class="k">Total Amortizado</span><span class="v">${fmtFullNative(l.aprobado-saldo,l.moneda)}</span></div>
      <div class="detail-row"><span class="k">Tasa de Interés</span><span class="v">${l.tasa.toFixed(2)}% anual</span></div>
      <div class="detail-row"><span class="k">Plazo</span><span class="v">${l.plazo} meses</span></div>
      <div class="detail-row"><span class="k">Fecha de Inicio</span><span class="v">${l.inicio}</span></div>
      <div class="detail-row"><span class="k">Fecha de Vencimiento</span><span class="v">${l.vencimiento}</span></div>
      <div class="detail-row"><span class="k">Garantía</span><span class="v">${l.garantia}</span></div>
      <div class="detail-row"><span class="k">Próximo Pago</span><span class="v">${lineaProximoPago(l)||'—'}</span></div>
      ${plan.length ? `<div class="table-scroll" style="max-height:180px;border:1px solid var(--border);border-radius:8px;margin-top:12px;">
        <table><thead><tr><th>Fecha</th><th class="text-right">Capital</th><th class="text-right">Interés</th><th>Estado</th></tr></thead>
        <tbody>${plan.map(p=>`<tr><td>${p.fecha}</td><td class="text-right mono">${fmtNative(p.capital,l.moneda)}</td><td class="text-right mono">${fmtNative(p.interes,l.moneda)}</td><td><span class="badge ${p.estado==='Pagado'?'badge-green':'badge-amber'}">${p.estado}</span></td></tr>`).join('')}</tbody></table>
      </div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cerrar</button>
      <button class="btn" id="editLineBtn" ${isReadOnly()?'disabled title="Requiere rol Administrador"':''}>${ic('edit')} Editar</button>
      ${puedeArchivar ? `<button class="btn" id="archiveLineBtn" ${isReadOnly()?'disabled title="Requiere rol Administrador"':''}>${ic('history')} Archivar como Cancelada</button>` : ''}
    </div>`);
  document.getElementById('editLineBtn').addEventListener('click', ()=> guard(()=>{ closeModal(); openEditLineModal(l.id); }));
  if(puedeArchivar){
    document.getElementById('archiveLineBtn').addEventListener('click', ()=> guard(()=>{
      callServer('archivarLinea', [l.id], res=>{
        closeModal(); reloadData(()=>{ renderContent(); toast('Línea '+(l.numOp||l.id)+' archivada en Histórico.'); });
      });
    }));
  }
}
function openEditUserModal(targetEmail){
  const u = usuarios.find(x=>x.email===targetEmail); if(!u) return;
  openModal(`
    <div class="modal-header"><div><h2>Editar Usuario</h2><div class="sub">${u.email}</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field full"><label>Nombre</label><input id="eu_nombre" value="${u.nombre}"></div>
        <div class="form-field full"><label>Rol</label><select id="eu_rol"><option ${u.rol==='Admin'?'selected':''}>Admin</option><option ${u.rol==='Consulta'?'selected':''}>Consulta</option></select></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="saveEditUserBtn">${ic('check')} Guardar</button></div>`);
  document.getElementById('saveEditUserBtn').addEventListener('click', ()=> guard(()=>{
    const nombre = document.getElementById('eu_nombre').value.trim();
    const rol = document.getElementById('eu_rol').value;
    callServer('editarUsuario', [targetEmail, { Nombre: nombre, Rol: rol }], ()=>{
      closeModal(); reloadData(()=>{ renderContent(); toast('Usuario actualizado.'); });
    });
  }));
}
function openEditLineModal(lineaId){
  const l = lines.find(x=>x.id===lineaId); if(!l) return;
  openModal(`
    <div class="modal-header"><div><h2>Editar Línea ${l.id}</h2><div class="sub">Modifica los campos de esta operación activa</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field"><label>Banco</label><input id="el_banco" value="${l.banco}"></div>
        <div class="form-field"><label>N° Operación</label><input id="el_numOp" value="${l.numOp}"></div>
        <div class="form-field"><label>Moneda</label><select id="el_moneda"><option ${l.moneda==='USD'?'selected':''}>USD</option><option ${l.moneda==='CRC'?'selected':''}>CRC</option></select></div>
        <div class="form-field"><label>Monto Aprobado</label><input id="el_aprobado" type="number" value="${l.aprobado}"></div>
        <div class="form-field"><label>Tasa Anual (%)</label><input id="el_tasa" type="number" step="0.01" value="${l.tasa}"></div>
        <div class="form-field"><label>Plazo (meses)</label><input id="el_plazo" type="number" value="${l.plazo}"></div>
        <div class="form-field"><label>Fecha Inicio</label><input id="el_inicio" type="date" value="${l.inicio}"></div>
        <div class="form-field"><label>Fecha Vencimiento</label><input id="el_vencimiento" type="date" value="${l.vencimiento}"></div>
        <div class="form-field full"><label>Garantía</label><input id="el_garantia" value="${l.garantia==='—'?'':l.garantia}"></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="saveEditLineBtn">${ic('check')} Guardar Cambios</button></div>`);
  document.getElementById('saveEditLineBtn').addEventListener('click', ()=> guard(()=>{
    const payload = { Banco: document.getElementById('el_banco').value.trim(), NumOp: document.getElementById('el_numOp').value.trim(), Moneda: document.getElementById('el_moneda').value, Aprobado: document.getElementById('el_aprobado').value, Tasa: document.getElementById('el_tasa').value, Plazo: document.getElementById('el_plazo').value, FechaInicio: document.getElementById('el_inicio').value, FechaVencimiento: document.getElementById('el_vencimiento').value, Garantia: document.getElementById('el_garantia').value.trim()||'—' };
    callServer('editarLinea', [lineaId, payload], res=>{
      closeModal(); reloadData(()=>{ renderContent(); toast('Línea actualizada ('+(res.changed||[]).length+' campo(s) modificado(s)).'); });
    });
  }));
}
function pendingCuotaOptionsHtml(lineaId){
  const plan = (paymentPlans[lineaId]||[]).filter(p=>p.estado==='Pendiente');
  const line = lines.find(l=>l.id===lineaId);
  const cur = line?line.moneda:'USD';
  return '<option value="">— Pago manual (sin cuota asociada) —</option>' + plan.map(p=>`<option value="${p._row}">${p.fecha} · ${fmtNative(p.capital+p.interes,cur)}</option>`).join('');
}
function openNewPaymentModal(){
  if(!lines.length){ toast('No hay líneas activas para registrar un pago.', true); return; }
  openModal(`
    <div class="modal-header"><div><h2>Registrar Pago</h2><div class="sub">Concilia un pago contra una cuota pendiente o regístralo manualmente</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field full"><label>Línea de Crédito</label><select id="p_linea">${lines.map(l=>`<option value="${l.id}">${l.numOp||l.id} — ${l.banco}</option>`).join('')}</select></div>
        <div class="form-field full"><label>Cuota Pendiente</label><select id="p_cuota">${pendingCuotaOptionsHtml(lines[0].id)}</select></div>
        <div class="form-field"><label>Fecha de Pago</label><input type="date" id="p_fecha"></div>
        <div class="form-field"><label>Monto (moneda de la línea)</label><input type="number" id="p_monto" placeholder="0.00"></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="savePaymentBtn">${ic('plus')} Registrar</button></div>`);
  function refreshCuotaOptions(){
    const lineaId = document.getElementById('p_linea').value;
    document.getElementById('p_cuota').innerHTML = pendingCuotaOptionsHtml(lineaId);
  }
  function applySelectedCuota(){
    const lineaId = document.getElementById('p_linea').value;
    const cuotaRow = document.getElementById('p_cuota').value;
    if(cuotaRow===''){ return; }
    const plan = paymentPlans[lineaId]||[];
    const cuota = plan.find(p=>String(p._row)===String(cuotaRow));
    if(!cuota) return;
    document.getElementById('p_fecha').value = cuota.fecha;
    document.getElementById('p_monto').value = (cuota.capital+cuota.interes).toFixed(2);
  }
  document.getElementById('p_linea').addEventListener('change', ()=>{ refreshCuotaOptions(); applySelectedCuota(); });
  document.getElementById('p_cuota').addEventListener('change', applySelectedCuota);
  applySelectedCuota();
  document.getElementById('savePaymentBtn').addEventListener('click', ()=>{
    const lineaId = document.getElementById('p_linea').value;
    const fecha = document.getElementById('p_fecha').value;
    const monto = parseFloat(document.getElementById('p_monto').value)||0;
    const cuotaRow = document.getElementById('p_cuota').value;
    if(!fecha){ toast('Selecciona la fecha de pago.', true); return; }
    if(monto<=0){ toast('Ingresa un monto válido.', true); return; }
    const btn = document.getElementById('savePaymentBtn'); btn.disabled = true;
    callServer('registrarPago', [{ lineaId, fecha, monto, cuotaRow: cuotaRow ? Number(cuotaRow) : null }], res=>{
      closeModal(); reloadData(()=>{ renderContent(); toast('Pago '+res.id+' registrado.'); });
    }, ()=>{ btn.disabled = false; });
  });
}
function openBulkUploadModal(){
  if(!lines.length){ toast('No hay líneas activas para cargar cuotas.', true); return; }
  openModal(`
    <div class="modal-header"><div><h2>Carga Masiva de Amortización</h2><div class="sub">Pega el detalle del plan de pagos</div></div><button class="modal-close" onclick="closeModal()">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="form-field full" style="margin-bottom:12px;"><label>Línea de Crédito</label><select id="b_linea">${lines.map(l=>`<option value="${l.id}">${l.numOp||l.id} — ${l.banco}</option>`).join('')}</select></div>
      <div class="form-field full"><label>Datos (CSV: fecha,capital,interes)</label><textarea id="b_data" rows="6" style="border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:12px;font-family:monospace;" placeholder="2026-08-20,39300,12401&#10;2026-09-20,39700,12000"></textarea></div>
    </div>
    <div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="uploadPlanBtn">${ic('upload')} Validar y Cargar</button></div>`);
  document.getElementById('uploadPlanBtn').addEventListener('click', ()=>{
    const lineaId = document.getElementById('b_linea').value;
    const raw = document.getElementById('b_data').value.trim();
    if(!raw){ toast('Pega o carga al menos una fila.', true); return; }
    const rows = parseCSV(raw);
    const btn = document.getElementById('uploadPlanBtn'); btn.disabled = true;
    callServer('cargaMasivaCuotas', [lineaId, rows], res=>{
      if(res.dup>0) toast(res.dup+' fila(s) duplicada(s) omitida(s).', true);
      closeModal(); reloadData(()=>{ renderContent(); toast(res.added+' cuota(s) cargada(s) correctamente.'); });
    }, ()=>{ btn.disabled = false; });
  });
}

/* ================= INIT ================= */
document.addEventListener('click', e=>{
  if(!e.target.closest('#notifBtn') && !e.target.closest('#notifDrop')) { if(state.notifOpen){ state.notifOpen=false; const d=document.getElementById('notifDrop'); if(d) d.classList.remove('open'); } }
  if(!e.target.closest('#userChip') && !e.target.closest('#userDrop')) { if(state.userMenuOpen){ state.userMenuOpen=false; const d=document.getElementById('userDrop'); if(d) d.classList.remove('open'); } }
});
boot();
