// ── HELPERS ───────────────────────────────────────────────────────────────────
const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function mesLabel(yyyymm) {
  const y = String(yyyymm).slice(0, 4);
  const m = parseInt(String(yyyymm).slice(4, 6), 10);
  return `${MESES[m] || '?'} ${y.slice(2)}`;
}

// ── MAPAS DE DIMENSIÓN ────────────────────────────────────────────────────────

/**
 * Convierte los 40 registros de adp_dtm_dim_controlclaseorigen en un mapa
 * skidclaseorigen → 'presupuesto' | 'proyectado' | 'asegurado' | 'consumido' | 'otro'
 * Usa las palabras clave en los campos de descripción para clasificar.
 */
export function buildClaseMap(rows) {
  const map = {};
  for (const row of rows) {
    // Usar el campo 'clase' directamente (código de un carácter de Sinco):
    // P=Presupuestado, Y=Proyectado, B/T=Asegurado, C/J=Consumido/Ejecutado
    const clase = (row.clase || '').toUpperCase();
    let cat;
    if      (clase === 'P')                    cat = 'presupuesto';
    else if (clase === 'Y')                    cat = 'proyectado';
    else if (clase === 'B' || clase === 'T')   cat = 'asegurado';
    else if (clase === 'C' || clase === 'J')   cat = 'consumido';
    else                                       cat = 'otro';
    map[row.skidclaseorigen] = cat;
  }
  return map;
}

/**
 * adp_dtm_dim_estadopordocumento → skidestado → nombre (string)
 */
export function buildEstadoMap(rows) {
  const map = {};
  for (const row of rows) {
    const id = row.skidestado ?? row.skidEstado;
    const nombre = row['Estado Descripcion'] || row.estado || row['Descripcion'] || String(id);
    if (id !== undefined) map[id] = nombre;
  }
  return map;
}

/**
 * adp_dtm_dim_capitulopresupuesto → skidcapitulo → { desc, tipo }
 * tipo: 'DIR' | 'IND' (determina si es CDD o CID)
 */
export function buildCapMap(rows) {
  const map = {};
  for (const row of rows) {
    const tipo = (row['Tipo Costo'] || '').toLowerCase();
    map[row.skidcapitulo] = {
      desc: row['Capitulo Descripcion'] || 'Cap.' + row.skidcapitulo,
      isCid: /indirect|ind\b|cid/.test(tipo),
    };
  }
  return map;
}

/**
 * adp_dtm_dim_tercero → skidtercero → { nombre, nit }
 */
export function buildTerceroMap(rows) {
  const map = {};
  for (const row of rows) {
    map[row.skidtercero] = {
      nombre: row.nombre || row['Nombre'] || '',
      nit: row.nit || row['NIT'] || '',
    };
  }
  return map;
}

/**
 * adp_dtm_dim_tipocontrato → skidtipocontrato → 'prov' | 'cont'
 */
export function buildTipoContratoMap(rows) {
  const map = {};
  for (const row of rows) {
    const desc = (row['Tipo Descripcion'] || '').toLowerCase();
    map[row.skidtipocontrato] = /proveedor/.test(desc) ? 'prov' : 'cont';
  }
  return map;
}

// ── AGREGACIONES POR TABLA ────────────────────────────────────────────────────

/**
 * Construye el panel de capítulos "Por Asegurar" que consume EstadoCaps.
 * Requiere claseMap y capMap para clasificar filas.
 *
 * Output: { crit, otro, caps: [{ pa, pct, cod, nom }] }
 */
export function buildEstadoCaps(controlRows, claseMap, capMap) {
  const byCap = {}; // skidcapitulo → { ppto, aseg }

  for (const row of controlRows) {
    const cat = claseMap[row.skidclaseorigen] || 'otro';
    if (cat !== 'presupuesto' && cat !== 'asegurado') continue;
    const val = row['Valor Sin IVA'] ?? row['Valor Total'] ?? 0;
    const sk = row.skidcapitulo;
    if (!byCap[sk]) byCap[sk] = { ppto: 0, aseg: 0 };
    if (cat === 'presupuesto') byCap[sk].ppto += val;
    if (cat === 'asegurado')   byCap[sk].aseg += val;
  }

  const caps = Object.entries(byCap)
    .map(([skid, d]) => {
      const pa = d.ppto - d.aseg;
      const pct = d.ppto > 0 ? d.aseg / d.ppto : 0;
      return {
        cod: String(skid),
        nom: capMap[skid]?.desc || 'Cap.' + skid,
        pa,
        pct,
      };
    })
    .filter(c => c.pa > 100)
    .sort((a, b) => b.pa - a.pa)
    .slice(0, 15);

  const crit = caps.filter(c => c.pct > 0.85).reduce((s, c) => s + c.pa, 0);
  const otro = caps.filter(c => c.pct <= 0.85).reduce((s, c) => s + c.pa, 0);

  return { crit, otro, caps };
}

/**
 * Construye el consumido mensual para el panel 2 (barras CDD / CID).
 * Output: [{ label: 'Mar 26', cdd: X, cid: Y }, ...]
 */
export function buildConsuмido(controlRows, claseMap, capMap) {
  const byMonth = {}; // 'YYYYMM' → { cdd, cid }

  for (const row of controlRows) {
    const cat = claseMap[row.skidclaseorigen] || 'otro';
    if (cat !== 'consumido') continue;
    const val = row['Valor Sin IVA'] ?? row['Valor Total'] ?? 0;
    const ym = String(row.skidfecha).slice(0, 6);
    if (!byMonth[ym]) byMonth[ym] = { cdd: 0, cid: 0 };
    const isCid = capMap[row.skidcapitulo]?.isCid ?? false;
    if (isCid) byMonth[ym].cid += val;
    else       byMonth[ym].cdd += val;
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => ({ label: mesLabel(ym), cdd: v.cdd, cid: v.cid }));
}

/**
 * Construye la lista de contratos para panel 3 y VistaLiquidacion.
 * Output: [{ contrato, contratista, nit, estadoContrato, valorContrato,
 *            acumulado, faltante, saldoAnticipo, saldoRte, ... }]
 */
export function buildContratos(contratoRows, estadoMap, terceroMap) {
  // Agrupa por skidespecificaciondecontratos (un contrato = múltiples ítems)
  const byKey = {};

  for (const row of contratoRows) {
    const key = row.skidespecificaciondecontratos ?? row.skiditems;
    if (!byKey[key]) {
      byKey[key] = {
        _skidtercero: row.skidtercero,
        _skidestado:  row.skidestado,
        valorContrato: 0,
        valorDetalle:  0,
      };
    }
    const vc = row['Valor Contrato'] || row['Valor Contrato Sin IVA'] || 0;
    if (vc > byKey[key].valorContrato) byKey[key].valorContrato = vc;
    byKey[key].valorDetalle += row['Valor Detalle'] || 0;
  }

  return Object.entries(byKey)
    .map(([contrato, d]) => {
      const tercero = terceroMap[d._skidtercero] || {};
      const estado  = estadoMap[d._skidestado]   || '';
      const faltante = Math.max(d.valorContrato - d.valorDetalle, 0);
      return {
        contrato:       String(contrato),
        contratista:    tercero.nombre || '',
        nit:            tercero.nit    || '',
        descripcion:    '',
        estadoContrato: estado,
        fechaInicial:   null,
        fechaFinal:     null,
        valorContrato:  d.valorContrato,
        acumulado:      d.valorDetalle,
        faltante,
        saldoAnticipo:  0,
        saldoRte:       0,
        proyecto:       '',
        grupo:          '',
      };
    })
    .filter(r => r.valorContrato > 0);
}

/**
 * Construye la estructura de anticipos para drawAnticipos.
 * Separa proveedores vs contratistas usando la relación
 * anticipo.skidtercero → contrato.skidtipocontrato → tipoContratoMap.
 *
 * Output: { totals: { ant_prov, ant_prov_ant, ant_cont, ant_cont_ant,
 *                     gar_cum, gar_cum_ant, liq, liq_ant, dev_ret, dev_ret_ant } }
 */
export function buildAnticipos(anticipoRows, contratoRows, tipoContratoRows) {
  const tipoMap = buildTipoContratoMap(tipoContratoRows);

  // skidtercero → 'prov' | 'cont'
  const terceroTipo = {};
  for (const c of contratoRows) {
    if (c.skidtercero && c.skidtipocontrato) {
      terceroTipo[c.skidtercero] = tipoMap[c.skidtipocontrato] || 'cont';
    }
  }

  let ant_prov = 0, ant_cont = 0;
  for (const row of anticipoRows) {
    const v    = row['Valor Anticipo'] || 0;
    const tipo = terceroTipo[row.skidtercero] || 'cont';
    if (tipo === 'prov') ant_prov += v;
    else                 ant_cont += v;
  }

  return {
    totals: {
      ant_prov:     Math.max(ant_prov, 0),
      ant_prov_ant: 0,
      ant_cont:     Math.max(ant_cont, 0),
      ant_cont_ant: 0,
      gar_cum:      0,
      gar_cum_ant:  0,
      liq:          0,
      liq_ant:      0,
      dev_ret:      0,
      dev_ret_ant:  0,
    }
  };
}

/**
 * Fecha de corte legible a partir de los datos disponibles.
 * Toma el máximo skidfecha de las filas de control.
 */
export function buildCorte(controlRows) {
  if (!controlRows.length) return new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
  const maxFecha = Math.max(...controlRows.map(r => r.skidfecha || 0));
  if (!maxFecha) return '';
  const s = String(maxFecha);
  const d = parseInt(s.slice(6, 8), 10);
  const m = parseInt(s.slice(4, 6), 10);
  const y = parseInt(s.slice(0, 4), 10);
  const mNom = ['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m] || '';
  return `${d} de ${mNom} de ${y}`;
}
