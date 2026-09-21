# Cofersa Deuda Global — Contexto del Proyecto

## Qué es
App Next.js (Pages Router) para gestionar deuda bancaria de Cofersa. Desplegada en Vercel.
- URL producción: https://cofersa-deuda-global.vercel.app
- Repo GitHub: yugalde-creator/cofersa-deuda-global
- Base de datos: Google Sheets vía Service Account

## Stack
- **Frontend**: Next.js 14 (Pages Router), React, Tailwind CSS — todo en `pages/index.js` (archivo único grande)
- **Backend**: `lib/backend.js` — toda la lógica de negocio (préstamos, pagos, leasing, usuarios)
- **Sheets**: `lib/sheets.js` — cliente de Google Sheets API
- **API routes**: `pages/api/` — endpoints REST que llaman a backend.js

## Google Sheets (SPREADSHEET_ID en .env)
| Hoja | Contenido |
|------|-----------|
| Operaciones_Activas | Líneas de crédito activas (ID, Banco, NumOp, Moneda, Aprobado, Tasa, Plazo...) |
| Pagos_Programados | Plan de cuotas (ID_Linea, Fecha, Capital, Interes, Estado) |
| Pagos_Historicos | Pagos registrados (ID, ID_Linea, Banco, Fecha, Monto, Estado, CapitalReal, InteresReal) |
| Canceladas | Líneas archivadas |
| Leasing | Contratos de leasing |
| Leasing_Pagos | Cuotas de leasing |
| Usuarios | Email, Nombre, Rol (Admin / Consulta) |
| Bancos | Banco, LimiteUSD |
| Config | TipoCambioUSD, NombreEmpresa |
| Auditoria | Log de acciones |

## Bugs conocidos y fixes aplicados (commit 31c0755)
1. **readPP()** — La columna A de Pagos_Programados tiene header `"Operaciones_Activas!A1"` en vez de `"ID_Linea"`. El fix normaliza con triple fallback: `p.ID_Linea || p.ID || p['Operaciones_Activas!A1'] || regex /^LC-\d+$/`.
2. **parseMonto()** — El regex `[₡$]` estaba corrupto por mojibake (edición en GitHub browser). Fix restaura el caracter correcto.
3. **registrarPago()** — Usaba `parseFloat()` para leer capital/interés de cuotas, que no maneja formato europeo (`37.716,66`). Fix usa `parseMonto()`.

## Formato de montos en Sheets
Formato **europeo**: punto como separador de miles, coma como decimal.
- `37.716,66` → 37716.66 — siempre usar `parseMonto()`, nunca `parseFloat()` directo.
- Moneda CRC se muestra con símbolo `₡`, USD con `$`.

## Variables de entorno (.env.local)
```
SPREADSHEET_ID=1WXw5-pbPqVtxG4BeaCe9C2wfx_ChrnRV9dbf9x9kpcQ
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
EMAIL_USER=...
EMAIL_PASS=...
```

## Deploy
Push a `main` → Vercel auto-deploys. No hay pipeline de CI/CD adicional.

## Convenciones
- IDs de líneas: `LC-001`, `LC-002`... (3 dígitos)
- IDs de pagos: `PG-0001`... (4 dígitos)
- IDs de leasing: `LS-001`...
- IDs de canceladas: `LX-001`...
- Fechas en Sheets: `YYYY-MM-DD`
- `fmtDate()` en sheets.js normaliza distintos formatos de fecha al estándar ISO.

## Roles de usuario
- **Admin**: puede crear, editar, registrar pagos, archivar líneas
- **Consulta**: solo lectura — cualquier mutación lanza error
