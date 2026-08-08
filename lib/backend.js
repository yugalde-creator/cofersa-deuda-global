/**
 * L√≥gica de negocio ‚Äî portada directamente de C√≥digo.gs.
 * Reemplaza SpreadsheetApp, Session, LockService con equivalentes de Node.js.
 */
const { SHEETS, readRows, appendRow, setCellValue, deleteRow, nextId, fmtDate, keyOp } = require('./sheets');

/* ============================= HELPERS ============================= */

function parseMonto(s) {
  if (typeof s === 'number') return s;
  let str = (s || '').toString().trim().replace(/[‚Ç°$]/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(str)) return parseFloat(str.replace(/\./g, ''));
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(str)) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+$/.test(str)) return parseFloat(str.replace(/,/g, ''));
  return parseFloat(str) || 0;
}

function normMoneda(m) {
  const s = (m || '').toString().trim().toLowerCase();
  return (s === 'crc' || s === 'colones' || s === 'col√≥n' || s === 'colon') ? 'CRC' : 'USD';
}

function normEstadoPago(e) {
  const s = (e || '').toString().trim().toLowerCase();
  return (s.includes('cancel') || s.includes('concil') || s.includes('pagad')) ? 'Conciliado' : 'Pendiente';
}

function nowCR() {
  return new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

/* ============================= AMORTIZACI√ìN ============================= */

function pmtSchedule(monto, tasaAnual, plazo, fechaPrimerPagoStr) {
  const r = (tasaAnual / 100) / 12;
  let saldo = monto;
  const filas = [];
  let fecha = new Date(fechaPrimerPagoStr + 'T00:00:00');
  for (let i = 1; i <= plazo; i++) {
    const interes = saldo * r;
    let cuota = r === 0 ? monto / plazo : monto * r / (1 - Math.pow(1 + r, -plazo));
    let capital = cuota - interes;
    if (i === plazo) { capital = saldo; cuota = capital + interes; }
    const saldoFinal = Math.max(saldo - capital, 0);
    filas.push({ n: i, fecha: fmtDate(fecha), saldoInicial: saldo, cuota, capital, interes, saldoFinal });
    saldo = saldoFinal;
    fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());
  }
  const totalInteres = filas.reduce((s, f) => s + f.interes, 0);
  return {
    cuotaMensual: filas[0].cuota,
    totalInteres,
    totalPagar: monto + totalInteres,
    vencimiento: filas[filas.length - 1].fecha,
    filas,
  };
}

function pmtScheduleLeasing(monto, tasaAnual, plazo, fechaPrimerPagoStr, seguroMensual, ivaPct) {
  const base = pmtSchedule(monto, tasaAnual, plazo, fechaPrimerPagoStr);
  const iva = seguroMensual * (ivaPct / 100);
  base.filas = base.filas.map(f => Object.assign({}, f, { seguro: seguroMensual, iva, totalCuota: f.cuota + seguroMensual + iva }));
  base.seguroMensual = seguroMensual;
  base.iva = iva;
  return base;
}

/* ============================= AUTH ============================= */

async function getUserRecord(email) {
  if (!email) return null;
  const usuarios = await readRows(SHEETS.USUARIOS);
  const match = usuarios.find(u => (u.Email || '').toString().trim().toLowerCase() === email.toLowerCase());
  return match ? { email, nombre: match.Nombre, rol: match.Rol } : null;
}

async function requireAdmin(email) {
  const user = await getUserRecord(email);
  if (!user) throw new Error('No autorizado: tu cuenta no est√° en la hoja Usuarios.');
  if (user.rol !== 'Admin') {
    await logAudit(user.email, 'Intento de acci√≥n restringida', 'Sistema', 'Bloqueado');
    throw new Error('Acci√≥n bloqueada: tu rol "Consulta" es de solo lectura.');
  }
  return user;
}

/* ============================= AUDITOR√çA ============================= */

async function logAudit(email, accion, modulo, resultado) {
  const now = nowCR();
  await appendRow(SHEETS.AUDITORIA, [now, email, accion, modulo, resultado]);
}

/* ============================= BOOTSTRAP ============================= */

async function getBootstrapData(email) {
  const user = await getUserRecord(email);
  if (!user) {
    return { authorized: false, email: email || '' };
  }

  const [activas, pagosProg, canceladas, pagosHist, leasing, leasingPagosRows, usuarios, auditoria, bancos, config] = await Promise.all([
    readRows(SHEETS.ACTIVAS),
    readRows(SHEETS.PAGOS_PROG),
    readRows(SHEETS.CANCELADAS),
    readRows(SHEETS.PAGOS_HIST),
    readRows(SHEETS.LEASING),
    readRows(SHEETS.LEASING_PAGOS),
    readRows(SHEETS.USUARIOS),
    readRows(SHEETS.AUDITORIA),
    readRows(SHQUÀêêSê”‘ KàôXYõ›‹ “QUÀê””ëíQ KàJN¬Çà€€ú›[ô\»HX›]ò\ÀõX\
HOà
¬àYàKíQù[S‹àKìù[S‹ò[ò€ŒàKêò[ò€À\ŒàKï\À[€ôYNàKì[€ôYKà\õÿòYŒàù[Xô\äKê\õÿòY H\ÿNàù[Xô\äKï\ÿJH^õŒàù[Xô\äKî^õ Hà[öX⁄[Œàõ]]JKëôX⁄R[öX⁄[ Kô[ò⁄[ZY[ùŒàõ]]JKëôX⁄Uô[ò⁄[ZY[ù Kÿ\ò[ùXNàKëÿ\ò[ùXH	¯†%	ÀàJJN¬Çà€€ú›^[Y[ù[ú»HﬂN¬àY€‹‘õŸÀôõ‹ëXX⁄
Oà¬à€€ú›YHíQ”[ôXN¬àYà
\^[Y[ù[ú÷€YJH^[Y[ù[ú÷€YHH◊N¬à^[Y[ù[ú÷€YKú\⁄
»‹õ›Œàó‹õ›ÀôX⁄Nàõ]]JëôX⁄JKÿ\][àù[Xô\äêÿ\][
H[ù\ô\Œàù[Xô\äí[ù\ô\ H\›YŒàë\›Y»JN¬àJN¬Çà€€ú›[ôX\–ÿ[òŸ[Y\»Hÿ[òŸ[Y\ÀõX\
»Oà
¬àYàÀíQù[S‹àÀìù[S‹ò[ò€ŒàÀêò[ò€À[€ôYNàÀì[€ôYK[€ùŒàù[Xô\äÀì[€ù Hà\ÿNàù[Xô\äÀï\ÿJH^õŒàù[Xô\äÀî^õ H[öX⁄[Œàõ]]JÀëôX⁄R[öX⁄[ Kô[ò⁄[ZY[ùŒàõ]]JÀëôX⁄Uô[ò⁄[ZY[ù KàJJN¬Çà€€ú›\›‹ûHHY€‹“\›õX\
Oà
¬àYàíQ[ôXNàíQ”[ôXKò[ò€Œàêò[ò€ÀôX⁄Nàõ]]JëôX⁄JK[€ùŒàù[Xô\äì[€ù H\›YŒàë\›YÀàJJKú€‹ù

KäHOàô]»]JãôôX⁄JHHô]»]JKôôX⁄JJN¬Çà€€ú›X\⁄[ô–€€ùò]‹»HX\⁄[ôÀõX\
Oà
¬àYàíQù[S‹àìù[S‹ò[ò€Œàêò[ò€À[€ôYNàì[€ôYK[€ùŒàù[Xô\äì[€ù Hà\ÿNàù[Xô\äï\ÿJH^õŒàù[Xô\äî^õ H[öX⁄[Œàõ]]JëôX⁄R[öX⁄[ Kô[ò⁄[ZY[ùŒàõ]]JëôX⁄Uô[ò⁄[ZY[ù K\›YŒàë\›YÀàJJN¬Çà€€ú›X\⁄[ô‘Y€‹»HﬂN¬àX\⁄[ô‘Y€‹‘õ›‹Àôõ‹ëXX⁄
Oà¬à€€ú›YHíQ–€€ùò]Œ¬àYà
[X\⁄[ô‘Y€‹÷€YJHX\⁄[ô‘Y€‹÷€YHH◊N¬àX\⁄[ô‘Y€‹÷€YKú\⁄
»‹õ›Œàó‹õ›ÀôX⁄Nàõ]]JëôX⁄JKÿ\][àù[Xô\äêÿ\][
H[ù\ô\Œàù[Xô\äí[ù\ô\ HŸY›\õŒàù[Xô\äîŸY›\õ H]òNàù[Xô\äíUêJH\›YŒàë\›Y»JN¬àJN¬Çà€€ú›ò[ö”[Z]»HﬂN¬àò[ò€‹Àôõ‹ëXX⁄
àOà»ò[ö”[Z]÷ÿãêò[ò€◊HHù[Xô\äãì[Z]UT—
H»JN¬Çà€€ú›Ÿô»HﬂN¬à€€ôöYÀôõ‹ëXX⁄
»Oà»Ÿô÷ÿÀê€]ôWHHÀïò[‹é»JN¬Çà]ÿZ]Ÿ–]Y]
\Ÿ\ãô[XZ[	–€€ú›[HH[ô[H€€ùõ€	À	—\⁄õÿ\ô	À	‚^]… N¬Çàô]\õà¬à]]‹ö^ôYàùYKà[XZ[à\Ÿ\ãô[XZ[àõ€XúôNà\Ÿ\ãõõ€XúôKàõ€à\Ÿ\ãúõ€à[ô\À^[Y[ù[úÀ[ôX\–ÿ[òŸ[Y\À\›‹ûKàX\⁄[ô–€€ùò]‹ÀX\⁄[ô‘Y€‹Àà\›X\ö[‹Œà\›X\ö[‹ÀõX\
HOà
»[XZ[àKë[XZ[õ€XúôNàKìõ€XúôKõ€àKîõ€JJKà]Y]ŸŒà]Y]‹öXKõX\
HOà
»ôX⁄Nàõ]]JKëôX⁄JK\›X\ö[ŒàKï\›X\ö[ÀXÿ⁄[€éàKêXÿ⁄[€ã[Ÿ[ŒàKì[Ÿ[Àô\›[YŒàKîô\›[Y»JJKúô]ô\úŸJ
Kàò[ö”[Z]Ààûà»‘êŒàù[Xô\äŸôÀï\–ÿ[Xö[’T—
HMKT—àHKà[\ô\ÿNàŸôÀìõ€XúôQ[\ô\ÿH	—[\ô\ÿIÀà⁄Y]\õàŒãÀŸÿ‹Àô€€Ÿ€Kò€€K‹‹ôXY⁄Y]ÀŸ…‹õÿŸ\‹Àô[ùãî‘ëPQ“QU“Q	ÃU÷ÕK\îUùÕôXPŸNPÃùŸû–⁄õîïéYôé^Z‹‘IﬂKŸY]àN¬üBÇã àOOOOOOOOOOOOOOOOOOOOOOOOOOOOH‘TêP“S”ëT»OOOOOOOOOOOOOOOOOOOOOOOOOOOOH
ã¬Çò\ﬁ[ò»ù[ò›[€à‹ôX\ì[ôXJ[XZ[^[ÿY
H¬à€€ú›\Ÿ\àH]ÿZ]ô\]Z\ôPYZ[ä[XZ[
N¬à€€ú›»ò[ò€Àù[S‹\Ÿ[Xõ€€À[€ùÀ[€ôYK\ÿK^õÀö[Y\îY€»HH^[ÿY¬àYà
Xò[ò€»[ù[S‹
Hõ›»ô]»\úõ‹ä	–ò[ò€»H∞¨H‹\òX⁄pÏ€à€€àô\]Y\öY‹Àâ N¬àYà
J[€ù»à
JHõ›»ô]»\úõ‹ä	”[€ù»[ù∞Ë[YÀâ N¬àYà
J^õ»à	âà^õ»Hå
JHõ›»ô]»\úõ‹ä	—[^õ»XôH\›\à[ùôHHHåY\Ÿ\Àâ N¬Çà€€ú›»HŸ^S‹
ò[ò€Àù[S‹
N¬à€€ú›ÿX›]ò\‘õ›‹Àÿ[òŸ[Y\‘õ›‹◊HH]ÿZ]õ€Z\ŸKò[
‹ôXYõ›‹ “QUÀêP’UêT KôXYõ›‹ “QUÀê–Sê—SQT WJN¬à€€ú›^\›[ù\»HX›]ò\‘õ›‹Àò€€òÿ]
ÿ[òŸ[Y\‘õ›‹ N¬àYà
^\›[ù\Àú€€YJàOàŸ^S‹
ãêò[ò€Àãìù[S‹
HOOH JH¬àõ›»ô]»\úõ‹ä	÷XH^\›H[òH‹\òX⁄pÏ€à€€à\ŸHò[ò€»H∞ÓõY\õÀâ N¬àBÇà€€ú›ÿ⁄Y[HH]ÿ⁄Y[J[€ùÀ\ÿK^õÀö[Y\îY€ N¬à€€ú›ô]“YH]ÿZ]ô^Y
	”…À“QUÀêP’UêTÀ N¬Çà]ÿZ]\[ôõ› “QUÀêP’UêTÀ€ô]“Yò[ò€Àù[S‹	‘∞Í\›[[»H^õ…À[€ôYK[€ùÀ\ÿK^õÀ\Ÿ[Xõ€€Àÿ⁄Y[Kùô[ò⁄[ZY[ùÀ	¯†%	◊JN¬àõ‹à
€€ú›àŸàÿ⁄Y[Kôö[\ H¬à]ÿZ]\[ôõ› “QUÀîQ”‘◊‘ì—À€ô]“YãôôX⁄Kãòÿ\][ãö[ù\ô\À	‘[ôY[ùI◊JN¬àBÇà]ÿZ]Ÿ–]Y]
\Ÿ\ãô[XZ[ùY]òH0Î[ôXH€€à[àHY€‹»	€ô]“YH
	‹^õﬂH›[›\ X	”‹\òX⁄[€ô\…À	‚^]… N¬àô]\õà»Yàô]“YN¬üBÇò\ﬁ[ò»ù[ò›[€àôY⁄\›ò\îY€ [XZ[^[ÿY
H¬à€€ú›\Ÿ\àH]ÿZ]ô\]Z\ôPYZ[ä[XZ[
N¬à€€ú›»[ôXRYôX⁄K[€ùÀ›[›Tõ›»HH^[ÿY¬àYà
J[€ù»à
JHõ›»ô]»\úõ‹ä	”[€ù»[ù∞Ë[YÀâ N¬Çà€€ú›\›‹öX€‹»H]ÿZ]ôXYõ›‹ “QUÀîQ”‘◊“T’
N¬à€€ú›\H\›‹öX€‹Àú€€YJOàíQ”[ôXHOOH[ôXRY	âàõ]]JëôX⁄JHOOHôX⁄H	âàX]òXú ù[Xô\äì[€ù HH[€ù HåJN¬àYà
\
H¬à]ÿZ]Ÿ–]Y]
\Ÿ\ãô[XZ[[ù[ù»HY€»\XÿY»	€[ôXRYX	–€€ò⁄[XX⁄pÏ€âÀ	–õ‹]YXY… N¬àõ›»ô]»\úõ‹ä	‘Y€»\XÿY»]X›Y»\òH\›H0Î[ôXHHôX⁄Kâ N¬àBÇà€€ú›X›]ò\»H]ÿZ]ôXYõ›‹ “QUÀêP’UêT N¬à€€ú›[ôXHHX›]ò\Àôö[ô
OàíQOOH[ôXRY
N¬à€€ú›ò[ò€»H[ôXH»[ôXKêò[ò€»à	…Œ¬à]\›Y»H	‘[ôY[ùIŒ¬àYà
›[›Tõ› H¬à]ÿZ]Ÿ]Ÿ[ò[YJ“QUÀîQ”‘◊‘ì—À›[›Tõ›À	—\›Y…À	‘YÿY… N¬à\›Y»H	–€€ò⁄[XY…Œ¬àBà€€ú›ô]“YH]ÿZ]ô^Y
	‘…À“QUÀîQ”‘◊“T’
N¬à]ÿZ]\[ôõ› “QUÀîQ”‘◊“T’€ô]“Y[ôXRYò[ò€ÀôX⁄K[€ùÀ\›Y◊JN¬Çà]ÿZ]Ÿ–]Y]
\Ÿ\ãô[XZ[ôY⁄\›õ»HY€»	€ô]“YH€ÿúôH	€[ôXRYIŸ\›Y»OOH	–€€ò⁄[XY…»»	»
›[›H€€ò⁄[XYJI»à	…ﬂX	–€€ò⁄[XX⁄pÏ€âÀ	‚^]… N¬àô]\õà»Yàô]“YN¬üBÇò\»ù[ò›[€àÿ\ôÿSX\⁄]òP›[›\ [XZ[[ôXRYõ›‹‘ò] H¬à€€ú›\Ÿ\àH]ÿZ]ô\]Z\ôPYZ[ä[XZ[
N¬à€€ú›^\›[ù\»H
]ÿZ]ôXYõ›‹ “QUÀîQ”‘◊‘ì— JKôö[\äOàíQ”[ôXHOOH[ôXRY
N¬à]YYH\H¬àõ‹à
€€ú›àŸàõ›‹‘ò] H¬àYà
ãõ[ô› H€€ù[ùYN¬à€€ú›ŸôX⁄Kÿ\][[ù\ô\◊HHé¬àYà
^\›[ù\Àú€€YJOàõ]]JëôX⁄JHOOHôX⁄JJH»\
 Œ»€€ù[ùYN»Bà]ÿZ]\[ôõ› “QUÀîQ”‘◊‘ì—À€[ôXRYôX⁄Kù[Xô\äÿ\][
Hù[Xô\ä[ù\ô\ H	‘[ôY[ùI◊JN¬àYY
 Œ¬àBà]ÿZ]Ÿ–]Y]
\Ÿ\ãô[XZ[ÿ\ôÿHX\⁄]òHH	ÿYYH›[›J H[à	€[ôXRYX	–€€ò⁄[XX⁄pÏ€âÀ	‚^]… N¬àô]\õà»YY\N¬üBä}

async function archivarLinea(email, lineaId) {
  const user = await requireAdmin(email);
  const activas = await readRows(SHEETS.ACTIVAS);
  const linea = activas.find(l => l.ID === lineaId);
  if (!linea) throw new Error('L√≠nea no encontrada.');

  const newId = await nextId('LX', SHEETS.CANCELADAS, 3);
  await appendRow(SHEETS.CANCELADAS, [newId, linea.Banco, linea.NumOp, linea.Moneda, linea.Aprobado, linea.Tasa, linea.Plazo, fmtDate(linea.FechaInicio), fmtDate(linea.FechaVencimiento)]);
  await deleteRow(SHEETS.ACTIVAS, linea._row);

  await logAudit(user.email, `Archivado de l√≠nea ${lineaId} como cancelada`, 'Operaciones', '√âxito');
  return { id: newId };
}

/* ============================= IMPORTAR HISTORIAL ============================= */

async function importarActivas(email, rowsRaw) {
  const user = await requireAdmin(email);
  const existentes = await readRows(SHEETS.ACTIVAS);
  let added = 0, dupCount = 0, invalid = 0;
  for (const r of rowsRaw) {
    if (r.length < 8) { invalid++; continue; }
    const [banco, numOp, fechaDesembolso, monto, monedaRaw, tasa, plazo, vencimiento] = r;
    const moneda = normMoneda(monedaRaw);
    const montoNum = parseMonto(monto);
    if (!banco || !numOp || montoNum <= 0) { invalid++; continue; }
    const k = keyOp(banco, numOp);
    if (existentes.some(l => keyOp(l.Banco, l.NumOp) === k)) { dupCount++; continue; }
    const newId = await nextId('LC', SHEETS.ACTIVAS, 3);
    await appendRow(SHEETS.ACTIVAS, [newId, banco, numOp, 'Pr√©stamo a Plazo', moneda, montoNum, parseFloat(tasa) || 0, parseInt(plazo, 10) || 12, fechaDesembolso, vencimiento, '‚Äî']);
    existentes.push({ Banco: banco, NumOp: numOp });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} l√≠nea(s) activa(s)`, 'Importar hist√≥rico', added > 0 ? '√âxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

async function importarCanceladas(email, rowsRaw) {
  const user = await requireAdmin(email);
  const [canceladasRows, activasRows] = await Promise.all([readRows(SHEETS.CANCELADAS), readRows(SHEETS.ACTIVAS)]);
  const existentes = canceladasRows.concat(activasRows);
  let added = 0, dupCount = 0, invalid = 0;
  for (const r of rowsRaw) {
    if (r.length < 7) { invalid++; continue; }
    const [banco, numOp, fechaDesembolso, monto, monedaRaw, tasa, plazo, vencimiento] = r;
    const moneda = normMoneda(monedaRaw);
    const montoNum = parseMonto(monto);
    if (!banco || !numOp || montoNum <= 0) { invalid++; continue; }
    const k = keyOp(banco, numOp);
    if (existentes.some(l => keyOp(l.Banco, l.NumOp) === k)) { dupCount++; continue; }
    const newId = await nextId('LX', SHEETS.CANCELADAS, 3);
    await appendRow(SHEETS.CANCELADAS, [newId, banco, numOp, moneda, montoNum, parseFloat(tasa) || 0, parseInt(plazo, 10) || 12, fechaDesembolso, vencimiento || fechaDesembolso]);
    existentes.push({ Banco: banco, NumOp: numOp });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} l√≠nea(s) cancelada(s)`, 'Importar hist√≥rico', added > 0 ? '√âxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

async function importarPagos(email, rowsRaw) {
  const user = await requireAdmin(email);
  const [activas, canceladas, historicos, pagosProg] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readRows(SHEETS.CANCELADAS), readRows(SHEETS.PAGOS_HIST), readRows(SHEETS.PAGOS_PROG),
  ]);
  let added = 0, dupCount = 0, invalid = 0;

  for (const r of rowsRaw) {
    if (r.length < 5) { invalid++; continue; }
    const [banco, numOp, fecha, capitalRaw, interesRaw, estadoRaw] = r;
    const capital = parseMonto(capitalRaw);
    const interes = parseMonto(interesRaw);
    if (!banco || !numOp || !fecha) { invalid++; continue; }
    const lineaActiva = activas.find(l => keyOp(l.Banco, l.NumOp) === keyOp(banco, numOp));
    const lineaCancelada = canceladas.find(l => keyOp(l.Banco, l.NumOp) === keyOp(banco, numOp));
    const lineaId = lineaActiva ? lineaActiva.ID : (lineaCancelada ? lineaCancelada.ID : numOp);
    const montoTotal = capital + interes;
    const esDup = historicos.some(h => h.ID_Linea === lineaId && fmtDate(h.Fecha) === fecha && Math.abs(Number(h.Monto) - montoTotal) < 1);
    if (esDup) { dupCount++; continue; }
    const estadoFinal = normEstadoPago(estadoRaw);
    if (estadoFinal === 'Conciliado' && lineaActiva) {
      const cuota = pagosProg.find(p => p.ID_Linea === lineaActiva.ID && fmtDate(p.Fecha) === fecha && p.Estado === 'Pendiente');
      if (cuota) {
        await setCellValue(SHEETS.PAGOS_PROG, cuota._row, 'Estado', 'Pagado');
        cuota.Estado = 'Pagado';
      }
    }
    const newId = await nextId('PG', SHEETS.PAGOS_HIST, 4);
    await appendRow(SHEETS.PAGOS_HIST, [newId, lineaId, banco, fecha, montoTotal, estadoFinal]);
    historicos.push({ ID_Linea: lineaId, Fecha: fecha, Monto: montoTotal });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} pago(s)`, 'Importar hist√≥rico', added > 0 ? '√âxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

/* ============================= LEASING ============================= */

async function crearLeasing(email, payload) {
  const user = await requireAdmin(email);
  const { banco, numOp, desembolso, monto, moneda, tasa, plazo, primerPago, seguro, ivaPct } = payload;
  if (!banco || !numOp) throw new Error('Banco y N¬∞ de Operaci√≥n son requeridos.');
  if (!(monto > 0)) throw new Error('Monto inv√°lido.');
  if (!(plazo > 0 && plazo <= 60)) throw new Error('El plazo debe estar entre 1 y 60 meses.');

  const k = keyOp(banco, numOp);
  const leasingRows = await readRows(SHEETS.LEASING);
  if (leasingRows.some(l => keyOp(l.Banco, l.NumOp) === k)) {
    throw new Error('Ya existe un contrato con ese banco y n√∫mero.');
  }

  const schedule = pmtScheduleLeasing(monto, tasa, plazo, primerPago, seguro || 0, ivaPct || 0);
  const newId = await nextId('LS', SHEETS.LEASING, 3);
  await appendRow(SHEETS.LEASING, [newId, banco, numOp, moneda, monto, tasa, plazo, desembolso, schedule.vencimiento, 'Activo']);
  for (const f of schedule.filas) {
    await appendRow(SHEETS.LEASING_PAGOS, [newId, f.fecha, f.capital, f.interes, f.seguro, f.iva, 'Pendiente']);
  }

  await logAudit(user.email, `Nuevo contrato de leasing ${newId} (${plazo} cuotas)`, 'Leasing Financiero', '√âxito');
  return { id: newId };
}

async function importarLeasing(email, contratosRaw, cuotasRaw) {
  const user = await requireAdmin(email);
  const contratosExistentes = await readRows(SHEETS.LEASING);
  let addedC = 0, dupC = 0, invalidC = 0;

  for (const r of (contratosRaw || [])) {
    if (r.length < 8) { invalidC++; continue; }
    const [banco, numOp, fechaDesembolso, monto, monedaRaw, tasa, plazo, vencimiento] = r;
    const moneda = normMoneda(monedaRaw);
    const montoNum = parseMonto(monto);
    if (!banco || !numOp || montoNum <= 0) { invalidC++; continue; }
    const k = keyOp(banco, numOp);
    if (contratosExistentes.some(l => keyOp(l.Banco, l.NumOp) === k)) { dupC++; continue; }
    const newId = await nextId('LS', SHEETS.LEASING, 3);
    await appendRow(SHEETS.LEASING, [newId, banco, numOp, moneda, montoNum, parseFloat(tasa) || 0, parseInt(plazo, 10) || 12, fechaDesembolso, vencimiento || fechaDesembolso, 'Activo']);
    contratosExistentes.push({ Banco: banco, NumOp: numOp, ID: newId });
    addedC++;
  }

  const contratosActuales = await readRows(SHEETS.LEASING);
  const pagosExistentes = await readRows(SHEETS.LEASING_PAGOS);
  let addedP = 0, dupP = 0, invalidP = 0;

  for (const r of (cuotasRaw || [])) {
    if (r.length < 5) { invalidP++; continue; }
    const [banco, numOp, fecha, capitalRaw, interesRaw, seguroRaw, ivaRaw, estadoRaw] = r;
    const capital = parseMonto(capitalRaw);
    const interes = parseMonto(interesRaw);
    const seguro = parseMonto(seguroRaw || 0);
    const iva = parseMonto(ivaRaw || 0);
    if (!banco || !numOp || !fecha) { invalidP++; continue; }
    const contrato = contratosActuales.find(l => keyOp(l.Banco, l.NumOp) === keyOp(banco, numOp));
    const lid = contrato ? contrato.ID : numOp;
    const dup = pagosExistentes.some(p => p.ID_Contrato === lid && fmtDate(p.Fecha) === fecha && Math.abs(Number(p.Capital) - capital) < 1);
    if (dup) { dupP++; continue; }
    await appendRow(SHEETS.LEASING_PAGOS, [lid, fecha, capital, interes, seguro, iva, normEstadoPago(estadoRaw)]);
    pagosExistentes.push({ ID_Contrato: lid, Fecha: fecha, Capital: capital });
    addedP++;
  }

  await logAudit(user.email, `Importaci√≥n de leasing: ${addedC} contrato(s), ${addedP} cuota(s)`, 'Leasing Financiero', '√âxito');
  return { addedC, dupC, invalidC, addedP, dupP, invalidP };
}

async function registrarPagoLeasing(email, payload) {
  const user = await requireAdmin(email);
  const { contratoId, cuotaRow } = payload;
  if (!cuotaRow) throw new Error('Selecciona una cuota pendiente.');
  await setCellValue(SHEETS.LEASING_PAGOS, cuotaRow, 'Estado', 'Pagado');
  await logAudit(user.email, `Conciliaci√≥n de cuota de leasing sobre ${contratoId}`, 'Leasing Financiero', '√âxito');
  return { ok: true };
}

/* ============================= USUARIOS ============================= */

async function crearUsuario(email, payload) {
  const user = await requireAdmin(email);
  const { nombre, email: newEmail, rol } = payload;
  if (!nombre || !newEmail) throw new Error('Completa nombre y correo.');
  const existentes = await readRows(SHEETS.USUARIOS);
  if (existentes.some(u => (u.Email || '').toLowerCase() === newEmail.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese correo.');
  }
  await appendRow(SHEETS.USUARIOS, [newEmail, nombre, rol || 'Consulta']);
  await logAudit(user.email, `Creaci√≥n de usuario ${newEmail} (${rol})`, 'Usuarios', '√âxito');
  return { ok: true };
}

module.exports = {
  getBootstrapData,
  crearLinea,
  registrarPago,
  cargaMasivaCuotas,
  archivarLinea,
  importarActivas,
  importarCanceladas,
  importarPagos,
  crearLeasing,
  importarLeasing,
  registrarPagoLeasing,
  crearUsuario,
  getUserRecord,
};
