/**
 * Historial mensual de la deuda por acreedor para la tasa efectiva a 12 meses.
 * periodo -> banco -> [saldo en US$ equivalentes al cierre, tasa ponderada por saldo en %].
 * Oct-2025 a Ago-2026 salen de las matrices de deuda mensuales de tesoreria (archivo "Tendencia de endeudamiento").
 * Desde Set-2026 el informe guarda cada cierre en la pestana Historico_Tasa del Sheet (ver lib/historicoTasa.js).
 */
const SEED = {
  '2025-10': {"BCT":[8124274,8.18],"Davivienda":[2334834,8.34],"BAC":[1488698,8]},
  '2025-11': {"BCT":[7871106,8.15],"Davivienda":[2750630,8.01],"BAC":[1807636,8]},
  '2025-12': {"BCT":[7531936,8.01],"Davivienda":[3002143,8.03],"BAC":[1815103,8],"BCR":[1014384,6.82]},
  '2026-01': {"BCT":[6691689,8.1],"Davivienda":[3150894,8.16],"BAC":[1799161,8],"BCR":[999201,6.82]},
  '2026-02': {"BCT":[7202089,8.05],"Davivienda":[2988647,8.11],"BAC":[1804810,8],"BCR":[837151,6.82]},
  '2026-03': {"BCT":[6251267,8.07],"Davivienda":[2995336,8.15],"BAC":[1855542,8],"BCR":[789673,6.82]},
  '2026-04': {"BCT":[5999368,8.02],"Davivienda":[2735215,8.16],"BAC":[1872875,8],"BCR":[1069404,6.47]},
  '2026-05': {"BCT":[5031826,7.99],"Davivienda":[3404499,8.4],"BAC":[1898922,8],"BCR":[972633,6.46]},
  '2026-06': {"BCT":[4473442,7.95],"Davivienda":[3802742,8.41],"BAC":[1845503,8],"BCR":[840732,6.45]},
  '2026-07': {"BCT":[5148350,7.89],"Davivienda":[3902078,8.41],"BAC":[1857999,7.79],"BCR":[1062138,6.59]},
  '2026-08': {"BCT":[5282832,7.87],"Davivienda":[3892584,8.41],"BAC":[1750470,7.69],"BCR":[917010,6.59]},
};

module.exports = { SEED };
