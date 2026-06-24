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
 * Construye la lista de contratos para panel 3.
 * Fuente: adp_dtm_fact_especificacioncontratos (encabezado) +
 *         adp_dtm_fact_especificacionactas (acumulado ejecutado)
 */
export function buildContratos(especContratosRows, especActasRows, estadoMap, terceroMap) {
  // Acumulado por especificacion desde actas
  const acumByEspec = {};
  const antByEspec  = {};
  const rteByEspec  = {};
  for (const row of especActasRows) {
    const key = row.skidespecificacion ?? row.skidEspecificacion;
    if (key === undefined) continue;
    acumByEspec[key] = (acumByEspec[key] || 0) + (row['Valor Acta'] || row['valoracta'] || row['Valor'] || 0);
    // Saldo anticipo y retención vienen del último valor del acta (no se suman, se toma el más reciente)
    if (row['Saldo Anticipo'] !== undefined) antByEspec[key] = row['Saldo Anticipo'];
    if (row['Saldo Retencion'] !== undefined || row['Saldo Retención'] !== undefined)
      rteByEspec[key] = row['Saldo Retencion'] ?? row['Saldo Retención'];
  }

  return especContratosRows
    .map(row => {
      const key = row.skidespecificacion ?? row.skidEspecificacion;
      const valorContrato = row['Valor Contrato'] || row['valorcontrato'] || 0;
      const acumulado     = acumByEspec[key] || 0;
      const faltante      = Math.max(valorContrato - acumulado, 0);
      const tercero       = terceroMap[row.skidtercero] || {};
      return {
        contrato:       String(key),
        contratista:    tercero.nombre || '',
        nit:            tercero.nit    || '',
        descripcion:    row['Descripcion'] || row['descripcion'] || '',
        estadoContrato: estadoMap[row.skidestado] || '',
        fechaInicial:   row['Fecha Inicial'] || row['fechainicial'] || null,
        fechaFinal:     row['Fecha Final']   || row['fechafinal']   || null,
        valorContrato,
        acumulado,
        faltante,
        saldoAnticipo:  antByEspec[key] ?? 0,
        saldoRte:       rteByEspec[key] ?? 0,
        proyecto:       row['Proyecto'] || '',
        grupo:          row['Grupo']    || '',
      };
    })
    .filter(r => r.valorContrato > 0);
}

/**
 * Construye la estructura de anticipos para drawAnticipos.
 * Fuente: adp_dtm_fact_especificacionactas (saldoAnticipo, saldoRetencion)
 * Separa prov vs cont por skidtipocontrato de especificacioncontratos.
 *
 * Output: { totals: { ant_prov, ant_prov_ant, ant_cont, ant_cont_ant,
 *                     gar_cum, gar_cum_ant, liq, liq_ant, dev_ret, dev_ret_ant } }
 */
export function buildAnticipos(especActasRows, especContratosRows, tipoContratoRows) {
  const tipoMap = buildTipoContratoMap(tipoContratoRows);

  // skidespecificacion → 'prov' | 'cont'
  const especTipo = {};
  for (const c of especContratosRows) {
    const key = c.skidespecificacion ?? c.skidEspecificacion;
    if (key !== undefined && c.skidtipocontrato) {
      especTipo[key] = tipoMap[c.skidtipocontrato] || 'cont';
    }
  }

  let ant_prov = 0, ant_cont = 0, gar_cum = 0, dev_ret = 0;
  // Tomar el último saldo por especificacion (no sumar — es un saldo puntual)
  const lastAnt = {}, lastGar = {}, lastRte = {};
  for (const row of especActasRows) {
    const key  = row.skidespecificacion ?? row.skidEspecificacion;
    if (key === undefined) continue;
    if (row['Saldo Anticipo']   !== undefined) lastAnt[key] = row['Saldo Anticipo'];
    if (row['Saldo Garantia']   !== undefined || row['Saldo Garantía'] !== undefined)
      lastGar[key] = row['Saldo Garantia'] ?? row['Saldo Garantía'];
    if (row['Saldo Retencion']  !== undefined || row['Saldo Retención'] !== undefined)
      lastRte[key] = row['Saldo Retencion'] ?? row['Saldo Retención'];
  }

  for (const [key, saldo] of Object.entries(lastAnt)) {
    if ((especTipo[key] || 'cont') === 'prov') ant_prov += saldo;
    else                                        ant_cont += saldo;
  }
  for (const saldo of Object.values(lastGar)) gar_cum += saldo;
  for (const saldo of Object.values(lastRte)) dev_ret += saldo;

  return {
    totals: {
      ant_prov:     Math.max(ant_prov, 0),
      ant_prov_ant: 0,
      ant_cont:     Math.max(ant_cont, 0),
      ant_cont_ant: 0,
      gar_cum:      Math.max(gar_cum, 0),
      gar_cum_ant:  0,
      liq:          0,
      liq_ant:      0,
      dev_ret:      Math.max(dev_ret, 0),
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
