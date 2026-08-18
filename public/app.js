// =============================================================================
// COFERSA — APARTADO DE INTERESES — Google Apps Script v4.0
// =============================================================================
// Columnas reales verificadas del Control_Deuda_Cofersa_V5:
//
// Operaciones_Activas (encabezado fila 10):
//   Banco | N° Operación | Fecha Desembolso | Monto Original | Moneda |
//   Tasa (%) | Plazo (meses) | Fecha Vencimiento | Estado |
//   Tipo de Cambio | Monto USD | Saldo Actualizado | Saldo USD | Key_Op
//
// Pagos_Programados (encabezado fila 9):
//   Banco | N° Operación | Fecha Pago | Monto Capital | Monto Interés |
//   CRC (=Moneda) | Tipo de Cambio | Estado | Capital USD | Interés USD |
//   FechaPago_Num | Key_Op | Amortización Real Banco | Interés Real Banco |
//   Diferencia | Diferencia % | Estado.1
//
// Estado Pagos: "Cancelado" = pagado realizado | "Pendiente" = futuro
// =============================================================================

var CONFIG = {
  CONTROL_DEUDA_ID: "1eyg05U-2wi8R0OwMrNN76LCLFnAUeZlKPfNYaOjBrTI",

  HOJA_OPERACIONES: "Operaciones_Activas",
  HOJA_PAGOS:       "Pagos_Programados",

  HDR_ROW_OPS:  10,
  HDR_ROW_PAGS:  9,

  COL_BANCO:     "Banco",
  COL_OP:        "N° Operación",
  COL_MONEDA:    "Moneda",
  COL_SALDO:     "Saldo Actualizado",
  COL_TASA:      "Tasa (%)",
  COL_ESTADO:    "Estado",
  ESTADO_ACTIVO: "Activo",
  SALDO_MINIMO:  100,   // excluye residuos de cancelación (ej: -1.06, 5.48 CRC)

  COL_PAG_BANCO:    "Banco",
  COL_PAG_OP:       "N° Operación",
  COL_PAG_FECHA:    "Fecha Pago",
  COL_PAG_MONEDA:   "CRC",
  COL_PAG_INT_PROG: "Monto Interés",
  COL_PAG_INT_REAL: "Interés Real\nBanco (manual)",
  COL_PAG_ESTADO:   "Estado",
  ESTADO_PAGADO:    "Cancelado",

  CARPETA_DRIVE_ID: "",

  EMAIL_TO:        ["yugalde@cofersa.cr"],
  EMAIL_CC:        [],
  EMAIL_FROM_NAME: "Tesorería COFERSA",

  FERIADOS: [
    "2026-01-01","2026-04-02","2026-04-03","2026-04-11",
    "2026-05-01","2026-07-25","2026-08-02","2026-08-15",
    "2026-09-15","2026-12-25",
    "2027-01-01","2027-04-01","2027-04-02","2027-04-11",
    "2027-05-01","2027-07-25","2027-08-02","2027-08-15",
    "2027-09-15","2027-12-25"
  ]
};

var COLOR = {
  HEADER_BG:"#1F3864", HEADER_FG:"#FFFFFF",
  SUBHDR_BG:"#2E75B6", SUBHDR_FG:"#FFFFFF",
  COLHDR_BG:"#1F3864", COLHDR_FG:"#FFFFFF",
  CRC_NUM:"#0070C0",   USD_NUM:"#FF6600",
  ALT_ROW:"#DCE6F1",   WHITE:"#FFFFFF",
  TOTAL_BG:"#1F3864",  TOTAL_FG:"#FFE699",
  DIFF_POS:"#C00000",  DIFF_NEG:"#375623",
  AVISO_BG:"#FFFDE7",  AVISO_FG:"#7F6000"
};

var MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Setiembre","Octubre","Noviembre","Diciembre"];

// =============================================================================
// PUNTOS DE ENTRADA
// =============================================================================
function ejecutarSiPrimerDiaHabil() {
  if (!esPrimerDiaHabil_(new Date())) { Logger.log("No es primer dia habil."); return; }
  generarYEnviarReporte();
}

function ejecutarForzado() { generarYEnviarReporte(); }

// =============================================================================
// ORQUESTADOR
// =============================================================================
function generarYEnviarReporte() {
  var hoy  = new Date();
  var pAnt = mesMenos1_(hoy);
  var pSig = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };

  Logger.log("=== APARTADO DE INTERESES ===");
  Logger.log("Causado:    " + MESES[pAnt.mes] + " " + pAnt.anio);
  Logger.log("Proyeccion: " + MESES[pSig.mes] + " " + pSig.anio);

  var fuente = SpreadsheetApp.openById(CONFIG.CONTROL_DEUDA_ID);
  var ops    = leerOperaciones_(fuente);
  var pagos  = leerPagos_(fuente);

  var causado    = calcularCausado_(ops, pagos, pAnt.anio, pAnt.mes);
  var ejecutado  = calcularEjecutado_(pagos, ops, pAnt.anio, pAnt.mes);
  var proyeccion = calcularProyeccion_(ops, pagos, pSig.anio, pSig.mes);

  Logger.log("Causado: " + causado.length + " ops | Ejecutado: " + ejecutado.length + " | Proyeccion: " + proyeccion.length);

  var nombre = "Apartado_Intereses_COFERSA_"
    + MESES[pAnt.mes].substring(0,3) + pAnt.anio
    + "_Proy" + MESES[pSig.mes].substring(0,3) + pSig.anio;

  var ss = crearReporte_(nombre, causado, ejecutado, proyeccion, pAnt, pSig);
  moverADrive_(ss, nombre);
  enviarCorreo_(ss, nombre, pAnt, pSig, causado, ejecutado, proyeccion);
  Logger.log("=== COMPLETADO ===");
}

// =============================================================================
// LECTURA DE DATOS
// =============================================================================
function idx_(hdrs, nombre) {
  var n = String(nombre).trim();
  for (var i = 0; i < hdrs.length; i++) {
    if (String(hdrs[i]).trim() === n) return i;
  }
  return -1;
}

function leerOperaciones_(ss) {
  var hoja = ss.getSheetByName(CONFIG.HOJA_OPERACIONES);
  if (!hoja) throw new Error("Hoja no encontrada: " + CONFIG.HOJA_OPERACIONES);

  var datos = hoja.getRange(CONFIG.HDR_ROW_OPS, 1,
    hoja.getLastRow() - CONFIG.HDR_ROW_OPS + 1, hoja.getLastColumn()).getValues();
  var hdrs = datos[0];

  var iB = idx_(hdrs, CONFIG.COL_BANCO);
  var iO = idx_(hdrs, CONFIG.COL_OP);
  var iM = idx_(hdrs, CONFIG.COL_MONEDA);
  var iS = idx_(hdrs, CONFIG.COL_SALDO);
  var iT = idx_(hdrs, CONFIG.COL_TASA);
  var iE = idx_(hdrs, CONFIG.COL_ESTADO);

  var falt = [];
  if (iB<0) falt.push(CONFIG.COL_BANCO);
  if (iO<0) falt.push(CONFIG.COL_OP);
  if (iM<0) falt.push(CONFIG.COL_MONEDA);
  if (iS<0) falt.push(CONFIG.COL_SALDO);
  if (iT<0) falt.push(CONFIG.COL_TASA);
  if (falt.length) throw new Error(
    "Columnas no encontradas en " + CONFIG.HOJA_OPERACIONES + ": " + falt.join(", ") +
    "\nDisponibles: " + hdrs.map(function(h){return String(h).trim();}).join(" | "));

  var iD = idx_(hdrs, "Fecha Desembolso");
  var ops = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    if (!f[iO]) continue;
    if (iE >= 0 && String(f[iE]).trim().toLowerCase() !== CONFIG.ESTADO_ACTIVO.toLowerCase()) continue;
    var tasa = parseFloat(f[iT]) || 0;
    if (tasa > 1) tasa = tasa / 100;
    var saldo = parseFloat(f[iS]) || 0;
    if (saldo < CONFIG.SALDO_MINIMO) continue;  // excluir residuos de cancelación
    var fd = iD >= 0 ? f[iD] : null;
    ops.push({
      banco:     String(f[iB]).trim(),
      op:        String(f[iO]).trim(),
      moneda:    String(f[iM]).trim().toUpperCase(),
      saldo:     saldo,
      tasa:      tasa,
      desembolso: (fd instanceof Date && !isNaN(fd)) ? new Date(fd) : null
    });
  }
  Logger.log("Operaciones activas: " + ops.length);
  return ops;
}

function leerPagos_(ss) {
  var hoja = ss.getSheetByName(CONFIG.HOJA_PAGOS);
  if (!hoja) { Logger.log("Hoja pagos no encontrada."); return []; }

  var datos = hoja.getRange(CONFIG.HDR_ROW_PAGS, 1,
    hoja.getLastRow() - CONFIG.HDR_ROW_PAGS + 1, hoja.getLastColumn()).getValues();
  var hdrs = datos[0];

  var iB  = idx_(hdrs, CONFIG.COL_PAG_BANCO);
  var iO  = idx_(hdrs, CONFIG.COL_PAG_OP);
  var iF  = idx_(hdrs, CONFIG.COL_PAG_FECHA);
  var iMo = idx_(hdrs, CONFIG.COL_PAG_MONEDA);
  var iIP = idx_(hdrs, CONFIG.COL_PAG_INT_PROG);
  var iIR = idx_(hdrs, CONFIG.COL_PAG_INT_REAL);
  var iE  = idx_(hdrs, CONFIG.COL_PAG_ESTADO);

  var pagos = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    if (!f[iO]) continue;
    var fp = f[iF];
    if (!(fp instanceof Date) || isNaN(fp.getTime())) continue;
    pagos.push({
      banco:   String(f[iB]).trim(),
      op:      String(f[iO]).trim(),
      moneda:  iMo >= 0 ? String(f[iMo]).trim().toUpperCase() : "CRC",
      fecha:   new Date(fp),
      intProg: iIP >= 0 ? (parseFloat(f[iIP]) || 0) : 0,
      intReal: iIR >= 0 ? (parseFloat(f[iIR]) || 0) : 0,
      estado:  iE  >= 0 ? String(f[iE]).trim() : ""
    });
  }
  Logger.log("Pagos leidos: " + pagos.length);
  return pagos;
}

// =============================================================================
// CÁLCULOS
// =============================================================================
function ultimoDia_(a, m)      { return new Date(a, m, 0); }
function diasEntre_(d1, d2)    { return Math.round((d2 - d1) / 86400000); }
function calcInt_(cap, tasa, dias) {
  return (!cap || !tasa || dias <= 0) ? 0 : Math.round(cap * (tasa/365) * dias * 100) / 100;
}

function mapaUltimoPago_(pagos) {
  var m = {};
  pagos.forEach(function(p) {
    if (p.estado.toLowerCase() !== CONFIG.ESTADO_PAGADO.toLowerCase()) return;
    if (!m[p.op] || p.fecha > m[p.op]) m[p.op] = p.fecha;
  });
  return m;
}

function calcularCausado_(ops, pagos, anio, mes) {
  var hasta   = ultimoDia_(anio, mes);
  var ultPago = mapaUltimoPago_(pagos);
  var filas   = [];

  ops.forEach(function(o) {
    var fp = ultPago[o.op];
    var desde;
    if (fp) {
      desde = new Date(fp); desde.setDate(desde.getDate() + 1);
    } else if (o.desembolso) {
      desde = new Date(o.desembolso);  // nueva op: desde fecha de desembolso
    } else { return; }
    if (desde > hasta) return;
    var dias = diasEntre_(desde, hasta);
    filas.push({ banco:o.banco, op:o.op, moneda:o.moneda, capital:o.saldo, tasa:o.tasa,
                 fechaPago: fp || o.desembolso, desde:desde, hasta:hasta, dias:dias, interes:calcInt_(o.saldo,o.tasa,dias) });
  });

  filas.sort(function(a,b){ return (a.moneda+a.banco+a.op).localeCompare(b.moneda+b.banco+b.op); });
  return filas;
}

function calcularProyeccion_(ops, pagos, anio, mes) {
  var primerDia = new Date(anio, mes-1, 1);
  var hasta     = ultimoDia_(anio, mes);
  var ultPago   = mapaUltimoPago_(pagos);
  var filas     = [];

  ops.forEach(function(o) {
    var fp    = ultPago[o.op];
    var desde = fp ? new Date(fp) : new Date(primerDia);
    if (fp) { desde.setDate(desde.getDate()+1); if (desde < primerDia) desde = new Date(primerDia); }
    if (desde > hasta) return;
    var dias = diasEntre_(desde, hasta);
    filas.push({ banco:o.banco, op:o.op, moneda:o.moneda, capital:o.saldo, tasa:o.tasa,
                 desde:desde, hasta:hasta, dias:dias, interes:calcInt_(o.saldo,o.tasa,dias) });
  });

  filas.sort(function(a,b){ return (a.moneda+a.banco+a.op).localeCompare(b.moneda+b.banco+b.op); });
  return filas;
}

function calcularEjecutado_(pagos, ops, anio, mes) {
  var inicio    = new Date(anio, mes-1, 1);
  var fin       = ultimoDia_(anio, mes);
  // Solo operaciones activas con saldo >= SALDO_MINIMO
  var opsActivas = {};
  ops.forEach(function(o){ opsActivas[o.op] = true; });
  var filas  = pagos.filter(function(p) {
    return p.estado.toLowerCase() === CONFIG.ESTADO_PAGADO.toLowerCase() &&
           p.fecha >= inicio && p.fecha <= fin &&
           opsActivas[p.op] &&              // solo ops activas
           (p.intReal > 0 || p.intProg > 0);
  }).map(function(p) {
    return { banco:p.banco, op:p.op, moneda:p.moneda, fecha:p.fecha,
             interes: p.intReal > 0 ? p.intReal : p.intProg };
  });
  filas.sort(function(a,b){ return (a.moneda+a.banco+a.op).localeCompare(b.moneda+b.banco+b.op); });
  return filas;
}

function totales_(filas, campo) {
  var crc=0, usd=0;
  filas.forEach(function(f){ if (f.moneda==="USD") usd+=f[campo]||0; else crc+=f[campo]||0; });
  return { crc:Math.round(crc*100)/100, usd:Math.round(usd*100)/100 };
}

// =============================================================================
// GOOGLE SHEET
// =============================================================================
function crearReporte_(nombre, causado, ejecutado, proyeccion, pAnt, pSig) {
  var ss = SpreadsheetApp.create(nombre);
  ss.getSheets()[0].setName("Resumen");
  var sA = MESES[pAnt.mes].substring(0,3)+"_"+pAnt.anio;
  var sS = MESES[pSig.mes].substring(0,3)+"_"+pSig.anio;
  var hC = ss.insertSheet("Causado_"+sA);
  var hE = ss.insertSheet("Ejecutado_"+sA);
  var hP = ss.insertSheet("Proyeccion_"+sS);
  escribirResumen_(   ss.getSheetByName("Resumen"), causado, ejecutado, proyeccion, pAnt, pSig);
  escribirCausado_(   hC, causado,    pAnt);
  escribirEjecutado_( hE, ejecutado,  pAnt);
  escribirProyeccion_(hP, proyeccion, pSig);
  ss.setActiveSheet(ss.getSheetByName("Resumen")); ss.moveActiveSheet(1);
  SpreadsheetApp.flush();
  return ss;
}

// =============================================================================
// FORMATO
// =============================================================================
function fmtF_(d) {
  return (d instanceof Date && !isNaN(d))
    ? Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy") : "";
}
function colLtr_(n) {
  var s=""; while(n>0){var r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);} return s;
}
function estilar_(r, bg, fg, bold, sz, align, wrap) {
  r.setBackground(bg||null).setFontColor(fg||"#000000").setFontWeight(bold?"bold":"normal")
   .setFontSize(sz||10).setFontFamily("Arial").setHorizontalAlignment(align||"left").setVerticalAlignment("middle");
  if (wrap) r.setWrap(true);
}
function borde_(r) { r.setBorder(true,true,true,true,true,true,"#B8CCE4",SpreadsheetApp.BorderStyle.SOLID); }

function encabezado_(hoja, titulo, sub, nota, nCols) {
  var ul = colLtr_(nCols);
  hoja.setRowHeight(1,36);
  var r1=hoja.getRange("A1:"+ul+"1"); r1.merge(); r1.setValue(titulo);
  estilar_(r1,COLOR.HEADER_BG,COLOR.HEADER_FG,true,13,"center");
  hoja.setRowHeight(2,22);
  var r2=hoja.getRange("A2:"+ul+"2"); r2.merge(); r2.setValue(sub);
  estilar_(r2,COLOR.SUBHDR_BG,COLOR.SUBHDR_FG,false,10,"center");
  hoja.setRowHeight(3,18);
  var r3=hoja.getRange("A3:"+ul+"3"); r3.merge(); r3.setValue(nota);
  r3.setBackground("#EBF3FC").setFontColor(COLOR.HEADER_BG).setFontSize(9).setFontFamily("Arial")
    .setFontStyle("italic").setHorizontalAlignment("center").setVerticalAlignment("middle");
  hoja.setRowHeight(4,5);
  return 5;
}

function colHdrs_(hoja, fila, hdrs, anchos) {
  hdrs.forEach(function(h,i){
    var c=hoja.getRange(fila,i+1); c.setValue(h);
    estilar_(c,COLOR.COLHDR_BG,COLOR.COLHDR_FG,true,10,"center",true); borde_(c);
    hoja.setColumnWidth(i+1,anchos[i]);
  });
  hoja.setRowHeight(fila,36);
}

function filaDatos_(hoja, fila, vals, fmts, esUsd, alt) {
  var bg = alt ? COLOR.ALT_ROW : COLOR.WHITE;
  vals.forEach(function(v,i){
    var c=hoja.getRange(fila,i+1), fmt=fmts[i];
    c.setBackground(bg).setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle"); borde_(c);
    if (fmt==="fecha") {
      c.setValue(v instanceof Date ? fmtF_(v) : (v||""));
      c.setHorizontalAlignment("center").setFontColor("#000000").setFontWeight("normal");
    } else if (fmt==="num") {
      c.setValue(v||0).setNumberFormat('#,##0.00');
      c.setHorizontalAlignment("right").setFontColor(esUsd?COLOR.USD_NUM:COLOR.CRC_NUM).setFontWeight("normal");
    } else if (fmt==="pct") {
      c.setValue(v||0).setNumberFormat('0.00%');
      c.setHorizontalAlignment("right").setFontColor("#000000").setFontWeight("normal");
    } else if (fmt==="int") {
      c.setValue(v||0).setNumberFormat('#,##0');
      c.setHorizontalAlignment("right").setFontColor("#000000").setFontWeight("normal");
    } else {
      c.setValue(v||"").setHorizontalAlignment("left").setFontColor("#000000").setFontWeight("normal");
    }
  });
  hoja.setRowHeight(fila,18);
}

function filaTotales_(hoja, fila, nCols, totCrc, totUsd, colImp) {
  ["CRC","USD"].forEach(function(mon,idx){
    var tot=mon==="CRC"?totCrc:totUsd, f=fila+idx;
    for(var c=1;c<=nCols;c++){
      var cell=hoja.getRange(f,c);
      cell.setBackground(COLOR.TOTAL_BG).setFontColor(COLOR.TOTAL_FG)
          .setFontWeight("bold").setFontFamily("Arial").setFontSize(10); borde_(cell);
      if(c===1)       { cell.setValue("TOTAL "+mon).setHorizontalAlignment("center"); }
      else if(c===colImp){ cell.setValue(tot).setNumberFormat('#,##0.00').setHorizontalAlignment("right"); }
    }
    hoja.setRowHeight(f,20);
  });
}

// =============================================================================
// HOJAS DE DETALLE
// =============================================================================
var H_CAU=["Banco","N° Operación","Moneda","Capital Causado","Tasa (%)","Fecha Pago","Desde","Hasta","Días Causados","Interés Causado"];
var A_CAU=[120,130,75,165,90,110,110,110,110,155];
var F_CAU=["txt","txt","txt","num","pct","fecha","fecha","fecha","int","num"];

function escribirCausado_(hoja, filas, pAnt) {
  var mal=MESES[pAnt.mes];
  var fila=encabezado_(hoja,
    "COFERSA — CONTROL DE APARTADO DE INTERESES — CAUSADO "+mal.toUpperCase()+" "+pAnt.anio,
    "Capital = Saldo Actualizado  |  Desde = Último pago (Cancelado) + 1 día  |  Hasta = último día del mes",
    "Período: 01/"+String(pAnt.mes).padStart(2,"0")+"/"+pAnt.anio+" – "+fmtF_(ultimoDia_(pAnt.anio,pAnt.mes))+
    "  |  "+filas.length+" operaciones activas  |  Base 365 días exactos", H_CAU.length);
  colHdrs_(hoja,fila,H_CAU,A_CAU); fila++;
  filas.forEach(function(r,i){
    filaDatos_(hoja,fila,[r.banco,r.op,r.moneda,r.capital,r.tasa,r.fechaPago,r.desde,r.hasta,r.dias,r.interes],
              F_CAU,r.moneda==="USD",i%2===1); fila++;
  });
  var tot=totales_(filas,"interes"); filaTotales_(hoja,fila,H_CAU.length,tot.crc,tot.usd,10);
  hoja.setFrozenRows(5); hoja.setTabColor("1F3864");
}

var H_EJE=["Banco","N° Operación","Moneda","Fecha Pago","Interés Pagado"];
var A_EJE=[120,140,75,120,165];
var F_EJE=["txt","txt","txt","fecha","num"];

function escribirEjecutado_(hoja, filas, pAnt) {
  var mal=MESES[pAnt.mes];
  var fila=encabezado_(hoja,
    "COFERSA — EJECUTADO REAL DE INTERESES — "+mal.toUpperCase()+" "+pAnt.anio,
    "Pagos con Estado = Cancelado realizados en el período  |  Usa Interés Real si disponible",
    "Período: "+mal+" "+pAnt.anio+"  |  "+filas.length+" pagos registrados", H_EJE.length);
  colHdrs_(hoja,fila,H_EJE,A_EJE); fila++;
  if (!filas.length) {
    var r=hoja.getRange(fila,1,1,5); r.merge().setValue("Sin pagos Cancelados en este período")
     .setFontColor("#888888").setFontStyle("italic").setFontFamily("Arial").setHorizontalAlignment("center"); return;
  }
  filas.forEach(function(r,i){
    filaDatos_(hoja,fila,[r.banco,r.op,r.moneda,r.fecha,r.interes],F_EJE,r.moneda==="USD",i%2===1); fila++;
  });
  var tot=totales_(filas,"interes"); filaTotales_(hoja,fila,H_EJE.length,tot.crc,tot.usd,5);
  hoja.setFrozenRows(5); hoja.setTabColor("375623");
}

var H_PRO=["Banco","N° Operación","Moneda","Capital Proyectado","Tasa (%)","Desde","Hasta","Días Proyectados","Interés Proyectado"];
var A_PRO=[120,130,75,175,90,110,110,125,165];
var F_PRO=["txt","txt","txt","num","pct","fecha","fecha","int","num"];

function escribirProyeccion_(hoja, filas, pSig) {
  var msl=MESES[pSig.mes];
  var fila=encabezado_(hoja,
    "COFERSA — PROYECCIÓN INTERESES PRÓXIMO PAGO — "+msl.toUpperCase()+" "+pSig.anio,
    "Capital = Saldo Actualizado vigente  |  Base 365 días exactos  |  * Sujeto a variación por amortizaciones",
    "Período proyectado: 01/"+String(pSig.mes).padStart(2,"0")+"/"+pSig.anio+" – "+fmtF_(ultimoDia_(pSig.anio,pSig.mes))+
    "  |  "+filas.length+" operaciones activas", H_PRO.length);
  colHdrs_(hoja,fila,H_PRO,A_PRO); fila++;
  filas.forEach(function(r,i){
    filaDatos_(hoja,fila,[r.banco,r.op,r.moneda,r.capital,r.tasa,r.desde,r.hasta,r.dias,r.interes],
              F_PRO,r.moneda==="USD",i%2===1); fila++;
  });
  var tot=totales_(filas,"interes"); filaTotales_(hoja,fila,H_PRO.length,tot.crc,tot.usd,9);
  hoja.setFrozenRows(5); hoja.setTabColor("FF6600");
}

// =============================================================================
// RESUMEN
// =============================================================================
function escribirResumen_(hoja, causado, ejecutado, proyeccion, pAnt, pSig) {
  var mal=MESES[pAnt.mes], msl=MESES[pSig.mes];
  var fila=encabezado_(hoja,
    "COFERSA — RESUMEN EJECUTIVO — APARTADO DE INTERESES",
    "Mes anterior: "+mal+" "+pAnt.anio+"   |   Mes en curso: "+msl+" "+pSig.anio,
    "Generado automáticamente el "+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"dd/MM/yyyy HH:mm")+
    "  |  Valores en moneda original", 5);

  [300,85,160,85,160].forEach(function(w,i){ hoja.setColumnWidth(i+1,w); });

  var tC=totales_(causado,"interes"), tE=totales_(ejecutado,"interes"), tP=totales_(proyeccion,"interes");
  var dCrc=Math.round((tC.crc-tE.crc)*100)/100, dUsd=Math.round((tC.usd-tE.usd)*100)/100;

  function sec(txt,f){
    hoja.setRowHeight(f,26); var r=hoja.getRange(f,1,1,5); r.merge(); r.setValue(txt);
    estilar_(r,COLOR.SUBHDR_BG,COLOR.SUBHDR_FG,true,11,"center"); borde_(r); return f+1;
  }
  function hCols(f){
    ["Concepto","Moneda","Importe CRC","Moneda","Importe USD"].forEach(function(h,i){
      var c=hoja.getRange(f,i+1); c.setValue(h);
      estilar_(c,COLOR.COLHDR_BG,COLOR.COLHDR_FG,true,10,"center"); borde_(c);
    }); hoja.setRowHeight(f,24); return f+1;
  }
  function lin(f, lbl, crc, usd, cNum, bold){
    var bg=f%2===0?COLOR.ALT_ROW:COLOR.WHITE;
    [[lbl,"left","#000000",bold],["CRC","center","#000000",true],[crc,"right",cNum,true],
     ["USD","center","#000000",true],[usd,"right",cNum,true]].forEach(function(d,i){
      var c=hoja.getRange(f,i+1);
      c.setValue(d[0]).setBackground(bg).setFontColor(d[2]).setFontWeight(d[3]?"bold":"normal")
       .setFontFamily("Arial").setFontSize(10).setHorizontalAlignment(d[1]).setVerticalAlignment("middle");
      if(i===2||i===4) c.setNumberFormat('#,##0.00'); borde_(c);
    }); hoja.setRowHeight(f,20);
  }

  fila=sec("MES ANTERIOR — "+mal.toUpperCase()+" "+pAnt.anio, fila);
  fila=hCols(fila);
  lin(fila++,"Interés Causado (devengado contablemente)",tC.crc,tC.usd,COLOR.CRC_NUM,false);
  lin(fila++,"Interés Ejecutado Real (pagado al banco)",  tE.crc,tE.usd,COLOR.CRC_NUM,false);
  var cD=(dCrc>0||dUsd>0)?COLOR.DIFF_POS:COLOR.DIFF_NEG;
  lin(fila++,"Diferencia Causado − Ejecutado",dCrc,dUsd,cD,true);
  fila++;
  fila=sec("MES EN CURSO — "+msl.toUpperCase()+" "+pSig.anio, fila);
  fila=hCols(fila);
  lin(fila++,"Interés Proyectado (apartado sugerido )",tP.crc,tP.usd,COLOR.USD_NUM,false);
  fila+=2;
  hoja.setRowHeight(fila,52);
  var rN=hoja.getRange(fila,1,1,5); rN.merge();
  rN.setValue("NOTA: La diferencia causado/ejecutado puede originarse por: (1) amortizaciones de capital dentro del período, "+
              "(2) desfase entre fecha de corte contable y bancario, (3) ajuste de días hábiles bancarios. "+
              "Interés ejecutado = 'Interés Real Banco (manual)' si > 0, de lo contrario 'Monto Interés' programado.");
  rN.setBackground(COLOR.AVISO_BG).setFontColor(COLOR.AVISO_FG).setFontSize(9).setFontFamily("Arial")
    .setFontStyle("italic").setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(true);
  borde_(rN);
  hoja.setFrozenRows(5); hoja.setTabColor("2E75B6");
}

// =============================================================================
// DRIVE + GMAIL
// =============================================================================
function moverADrive_(ss, nombre) {
  var file=DriveApp.getFileById(ss.getId()); file.setName(nombre);
  if (CONFIG.CARPETA_DRIVE_ID) {
    var c=DriveApp.getFolderById(CONFIG.CARPETA_DRIVE_ID); c.addFile(file);
    DriveApp.getRootFolder().removeFile(file); Logger.log("Movido a: "+c.getName());
  } else Logger.log("Drive raiz: "+nombre);
}

function enviarCorreo_(ss, nombre, pAnt, pSig, causado, ejecutado, proyeccion) {
  var mal=MESES[pAnt.mes], msl=MESES[pSig.mes];
  var tC=totales_(causado,"interes"), tE=totales_(ejecutado,"interes"), tP=totales_(proyeccion,"interes");
  var url="https://docs.google.com/spreadsheets/d/"+ss.getId();
  var asunto="[Tesorería COFERSA] Apartado de Intereses — Causado "+mal+" "+pAnt.anio+" | Proyección "+msl+" "+pSig.anio;
  function fN(n){ return n.toLocaleString("es-CR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function tr(l,c,u,bg){
    return '<tr style="background:'+bg+'"><td style="padding:8px 14px;">'+l+'</td>'+
           '<td style="padding:8px 14px;text-align:right;color:'+COLOR.CRC_NUM+';font-weight:bold;">₡ '+fN(c)+'</td>'+
           '<td style="padding:8px 14px;text-align:right;color:'+COLOR.USD_NUM+';font-weight:bold;">$ '+fN(u)+'</td></tr>';
  }
  var html='<div style="font-family:Arial,sans-serif;font-size:14px;">'+
    '<div style="background:'+COLOR.HEADER_BG+';color:#fff;padding:14px 20px;border-radius:6px;">'+
    '<h2 style="margin:0;">COFERSA — Apartado de Intereses</h2>'+
    '<p style="margin:4px 0 0;font-size:13px;">'+mal+' '+pAnt.anio+' (causado)  |  '+msl+' '+pSig.anio+' (proyección)</p></div>'+
    '<p>Estimados, adjunto el reporte generado automáticamente el <strong>'+
    Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"dd/MM/yyyy")+'</strong>.</p>'+
    '<table style="border-collapse:collapse;width:100%;margin:0 0 16px;">'+
    '<tr style="background:'+COLOR.HEADER_BG+';color:#fff;">'+
    '<th style="padding:8px 14px;text-align:left;">Concepto</th>'+
    '<th style="padding:8px 14px;text-align:right;">Total CRC ₡</th>'+
    '<th style="padding:8px 14px;text-align:right;">Total USD $</th></tr>'+
    tr("Causado "+mal+" "+pAnt.anio,        tC.crc,tC.usd,COLOR.ALT_ROW)+
    tr("Ejecutado Real "+mal+" "+pAnt.anio, tE.crc,tE.usd,COLOR.WHITE)+
    tr("Proyección "+msl+" "+pSig.anio,     tP.crc,tP.usd,COLOR.ALT_ROW)+
    '</table>'+
    '<a href="'+url+'" style="background:'+COLOR.HEADER_BG+';color:#fff;padding:10px 22px;'+
    'text-decoration:none;border-radius:5px;display:inline-block;font-weight:bold;">Abrir en Google Sheets</a>'+
    '<hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">'+
    '<p style="font-size:11px;color:#888;">Metodología: Saldo Actualizado × (Tasa(%)/365) × Días exactos — '+
    'Desde: último pago Cancelado + 1 — Hasta: último día del mes<br>Tesorería COFERSA · Generado automáticamente</p></div>';
  var opts={htmlBody:html,name:CONFIG.EMAIL_FROM_NAME};
  if (CONFIG.EMAIL_CC.length) opts.cc=CONFIG.EMAIL_CC.join(",");
  GmailApp.sendEmail(CONFIG.EMAIL_TO.join(","),asunto,"",opts);
  Logger.log("Correo enviado a: "+CONFIG.EMAIL_TO.join(", "));
}

// =============================================================================
// FECHAS / TRIGGER
// =============================================================================
function esPrimerDiaHabil_(fecha) {
  var feriados=CONFIG.FERIADOS.map(function(s){return new Date(s+"T12:00:00");});
  var d=new Date(fecha.getFullYear(),fecha.getMonth(),1);
  while(true){
    var dow=d.getDay();
    var esFer=feriados.some(function(f){
      return f.getFullYear()===d.getFullYear()&&f.getMonth()===d.getMonth()&&f.getDate()===d.getDate();
    });
    if(dow!==0&&dow!==6&&!esFer) break; d.setDate(d.getDate()+1);
  }
  return fecha.getDate()===d.getDate()&&fecha.getMonth()===d.getMonth()&&fecha.getFullYear()===d.getFullYear();
}

function mesMenos1_(f) {
  var m=f.getMonth()+1,a=f.getFullYear();
  return m===1?{anio:a-1,mes:12}:{anio:a,mes:m-1};
}

function instalarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==="ejecutarSiPrimerDiaHabil") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("ejecutarSiPrimerDiaHabil").timeBased().atHour(6).everyDays(1).create();
  Logger.log("✓ Trigger instalado: ejecutarSiPrimerDiaHabil @ 06:00 diario");
}

// ============================================================
// ACTUALIZAR CANCELACIONES BCT - Julio 2026 (función temporal)
// ============================================================
function actualizarCancelacionesBCT() {
  var ss    = SpreadsheetApp.openById(CONFIG.CONTROL_DEUDA_ID);
  var hoja  = ss.getSheetByName(CONFIG.HOJA_OPERACIONES);
  var hdrRow = CONFIG.HDR_ROW_OPS; // 10
  var lastRow = hoja.getLastRow();
  var numCols = 20;
  var data = hoja.getRange(hdrRow, 1, lastRow - hdrRow + 1, numCols).getValues();

  var headers = data[0];
  var colOp     = headers.indexOf(CONFIG.COL_OP);
  var colEstado = headers.indexOf(CONFIG.COL_ESTADO);
  var colSaldo  = headers.indexOf(CONFIG.COL_SALDO);

  Logger.log("Columnas → Op:" + colOp + " Estado:" + colEstado + " Saldo:" + colSaldo);

  var canceladas = ["10024562","10024605","10024733","10024849"];
  var actualizadas = [];

  for (var i = 1; i < data.length; i++) {
    var op = String(data[i][colOp]).trim();
    if (canceladas.indexOf(op) >= 0) {
      var rowNum = hdrRow + i;
      hoja.getRange(rowNum, colEstado + 1).setValue("Cancelado");
      hoja.getRange(rowNum, colSaldo  + 1).setValue(0);
      actualizadas.push(op + " (fila " + rowNum + ")");
    }
  }

  Logger.log("Canceladas actualizadas: " + actualizadas.join(", "));
  if (actualizadas.length < canceladas.length) {
    var faltantes = canceladas.filter(function(o){ return actualizadas.join("").indexOf(o) < 0; });
    Logger.log("AVISO - No encontradas: " + faltantes.join(", "));
  }

  // Verificar BAC nuevas ops
  var nuevasBac = ["200094681","200095116"];
  var encontradas = [];
  for (var i = 1; i < data.length; i++) {
    var op = String(data[i][colOp]).trim();
    if (nuevasBac.indexOf(op) >= 0) encontradas.push(op);
  }
  Logger.log("BAC nuevas ops encontradas: " + encontradas.join(", "));
  if (encontradas.length < nuevasBac.length) {
    var faltanBac = nuevasBac.filter(function(o){ return encontradas.indexOf(o) < 0; });
    Logger.log("AVISO BAC faltantes: " + faltanBac.join(", "));
  }

  SpreadsheetApp.flush();
  Logger.log("DONE - actualizarCancelacionesBCT completado");
}


// ============================================================
// AGREGAR BAC 200095116 a Operaciones_Activas (función temporal)
// ============================================================
function agregarBAC200095116() {
  var ss   = SpreadsheetApp.openById(CONFIG.CONTROL_DEUDA_ID);
  var hoja = ss.getSheetByName(CONFIG.HOJA_OPERACIONES);

  var hdrRow  = CONFIG.HDR_ROW_OPS; // 10
  var lastRow = hoja.getLastRow();
  var data    = hoja.getRange(hdrRow, 1, lastRow - hdrRow + 1, 20).getValues();
  var headers = data[0];

  // Verificar que no existe ya
  var colOp = headers.indexOf(CONFIG.COL_OP);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colOp]).trim() === "200095116") {
      Logger.log("AVISO: 200095116 ya existe en fila " + (hdrRow + i));
      return;
    }
  }

  // Construir fila con misma estructura de headers
  // Banco | N° Operación | Fecha Desembolso | Monto Original | Moneda |
  // Tasa (%) | Plazo (meses) | Fecha Vencimiento | Estado |
  // Tipo de Cambio | Monto USD | Saldo Actualizado | Saldo USD | Key_Op
  var numCols = headers.length;
  var fila = new Array(numCols).fill("");

  function setCol(name, val) {
    var idx = headers.indexOf(name);
    if (idx >= 0) fila[idx] = val;
    else Logger.log("Col no encontrada: " + name);
  }

  var tc = 462.56;
  var monto = 150000000;
  var saldo = 150000000;

  setCol("Banco",              "BAC");
  setCol("N° Operación",       "200095116");
  setCol("Fecha Desembolso",   new Date(2026, 6, 24));  // julio=6
  setCol("Monto Original",     monto);
  setCol("Moneda",             "CRC");
  setCol("Tasa (%)",           7.35);
  setCol("Plazo (meses)",      12);
  setCol("Fecha Vencimiento",  new Date(2027, 6, 24));
  setCol("Estado",             "Activo");
  setCol("Tipo de Cambio",     tc);
  setCol("Monto USD",          monto / tc);
  setCol("Saldo Actualizado",  saldo);
  setCol("Saldo USD",          saldo / tc);
  setCol("Key_Op",             "BAC|200095116");

  var newRow = lastRow + 1;
  hoja.getRange(newRow, 1, 1, fila.length).setValues([fila]);
  SpreadsheetApp.flush();
  Logger.log("BAC 200095116 agregada en fila " + newRow);
  Logger.log("Saldo: " + saldo + " CRC | Tasa: 7.35% | Vence: 24/07/2027");
}


function verificarYAgregarBAC() {
  var ss   = SpreadsheetApp.openById(CONFIG.CONTROL_DEUDA_ID);
  var hoja = ss.getSheetByName(CONFIG.HOJA_OPERACIONES);
  var lastRow = hoja.getLastRow();
  // Leer ultimas 5 filas para ver estado
  var tail = hoja.getRange(lastRow - 4, 1, 5, 14).getValues();
  var found200095116 = false;
  tail.forEach(function(r){ 
    Logger.log("Fila: " + JSON.stringify(r.slice(0,4)) + " Op:" + r[1] + " Estado:" + r[8]);
    if (String(r[1]).trim() === "200095116") found200095116 = true;
  });
  Logger.log("lastRow=" + lastRow + " | 200095116 encontrada: " + found200095116);
  
  if (!found200095116) {
    var headers = hoja.getRange(10, 1, 1, 20).getValues()[0];
    var numCols = headers.length;
    var fila = new Array(numCols).fill("");
    function setH(name,val){ var i=headers.indexOf(name); if(i>=0) fila[i]=val; }
    var tc=462.56, m=150000000;
    setH("Banco","BAC"); setH("N\u00b0 Operaci\u00f3n","200095116");
    setH("Fecha Desembolso",new Date(2026,6,24)); setH("Monto Original",m);
    setH("Moneda","CRC"); setH("Tasa (%)","7.35"); setH("Plazo (meses)",12);
    setH("Fecha Vencimiento",new Date(2027,6,24)); setH("Estado","Activo");
    setH("Tipo de Cambio",tc); setH("Monto USD",m/tc);
    setH("Saldo Actualizado",m); setH("Saldo USD",m/tc); setH("Key_Op","BAC|200095116");
    hoja.getRange(lastRow+1,1,1,fila.length).setValues([fila]);
    SpreadsheetApp.flush();
    Logger.log("AGREGADA en fila "+(lastRow+1));
  } else {
    Logger.log("Ya existe, no se agrega");
  }
}
