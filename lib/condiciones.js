/**
 * Condición de tasa (referencia + spread) y garantía por operación. Hoy no viven en el Sheet:
 * BCT y Davivienda salen de los planes PDF del banco; BAC y BCR de la matriz anterior.
 * Una operación nueva que no esté aquí sale con la condición en blanco en el informe.
 */
const CONDICION = {
  "6141293": "TBP +3.68",
  "6159873": "TBP +3.68",
  "6171315": "TBP +3.68",
  "6178787": "TBP +3.68",
  "10024937": "PRIME+0.25",
  "10024938": "TBP+4.63",
  "10025051": "PRIME+0.25",
  "10025234": "PRIME+0.75",
  "10025269": "PRIME+0.75",
  "10025858": "PRIME+0.75",
  "10025923": "PRIME+0.75",
  "10025976": "PRIME+0.75",
  "10026299": "PRIME+0.75",
  "10026801": "PRIME+1.00",
  "10026846": "PRIME+1.00",
  "10026946": "PRIME+1.00",
  "10026983": "TBP+4.36",
  "10027186": "PRIME+1.00",
  "10027203": "PRIME+1.00",
  "10027339": "PRIME+1.00",
  "200080237": "TBP + 4.18%",
  "200091564": "TBP + 4.18%",
  "200091579": "TERM SOFR (3 meses) + 4.16",
  "200094681": "TBP + 4.18%",
  "200095116": "TBP + 4.18%",
  "200095282": "TBP + 4.18%",
  "200095914": "TBP + 4.18%",
  "10410129972706105": "TRI 6 MESES +3.61",
  "10410129972706507": "TRI 6 MESES +3.71",
  "10410129972706714": "TERM SOFR 6 MESES +4.27",
  "10410129972706803": "TRI 6 MESES +3.89",
  "10410129972706909": "TRI 6 MESES +3.82",
  "10410129972707004": "TRI 6 MESES +3.81",
  "10410129972707205": "TRI 6 MESES +3.85",
  "10410129972707300": "TRI 6 MESES +3.80",
  "10410129972707406": "TRI 6 MESES +3.81",
  "10410129972707501": "TRI 6 MESES +3.86",
  "10410129972707607": "TRI 6 MESES +3.78"
};

const GARANTIA = { BCT: 'Inventario-CxC', Davivienda: 'Codeudor', BAC: 'Codeudor', BCR: 'Codeudor' };

module.exports = { CONDICION, GARANTIA };
