import { useState, useEffect } from 'react';
import { getToken, fetchMergedSafe, getDim, getDimWithSkid, getDimProyecto, isMock, probeFactTables } from '../services/sincoApi.js';
import {
  buildClaseMap,
  buildEstadoMap,
  buildCapMap,
  buildTerceroMap,
  buildTipoContratoMap,
  buildEstadoCaps,
  buildConsuмido,
  buildContratos,
  buildAnticipos,
  buildCorte,
} from '../utils/sincoAggregations.js';

// ── Mapeo macro-proyecto → lista de skidproyecto ──────────────────────────────
// Fórmula: skidproyecto = skidempresa(100) * 1000 + "Codigo Proyecto" de Sinco
// Fuente: contracts_data histórico + adp_dtm_dim_capitulopresupuesto
export const SKIDS = {
  // + 344 = NOMINA Etapa 2, antes ausente de este mapa
  praia:    [100101,100102,100103,100105,100106,100108,100109,100111,100112,100344],
  // + 401 = NOMINA Etapa 3, antes ausente de este mapa
  oporto:   [100116,100117,100118,100214,100215,100401],
  primera:  [100119,100120,100121,100125,100126,100127,100128],
  // + 457 = DIR Etapa 1 Reforzamiento, antes ausente de este mapa
  hacienda: [100129,100130,100131,100133,100134,100136,100137,100139,100140,100457],
  bosque:   [100141,100142,100143,100147,100148,100150,100151,100153,100154],
  'cast-l': [100155,100156,100157],
  gaia:     [100160,100161,100162],
  'azul-t': [100166,100167,100168,100169,100170,100171],
  'azul-c': [100172,100173,100174,100175,100176,100177],
  verde:    [100178,100179,100180,100181,100182,100183],
  // Mitika: 184=ZC-URB, 186=E1.1, 187=T6, 188=T7, 408=T5 (código fuera de secuencia)
  // + nómina de cada etapa (185,189,337,409), antes ausentes de este mapa
  mitika:   [100184,100185,100186,100187,100188,100189,100337,100408,100409],
  well:     [100190,100191,100192],
  'cast-i': [100193,100194,100195,100197,100198,100201,100202],
};

// Deriva el tipo de proyecto desde Nombre Proyecto de adp_dtm_dim_proyecto:
// " DIR " → DIR (contratos de terceros)
// " IND " → IND (indirectos, solo para presupuesto interno)
// "NOMINA" → NOMINA (nómina de personal, sin contratos de terceros)
export function buildSkidTipoMap(proyRows) {
  const map = {};
  for (const r of proyRows) {
    const name = (' ' + (r['Nombre Proyecto'] || '') + ' ').toUpperCase();
    if (name.includes('NOMINA'))  map[r.skidproyecto] = 'NOMINA';
    else if (name.includes(' DIR ')) map[r.skidproyecto] = 'DIR';
    else if (name.includes(' IND ')) map[r.skidproyecto] = 'IND';
  }
  return map;
}

function controlSkids(skids, tipoMap) {
  return skids.filter(sk => tipoMap[sk] !== 'IND');
}

function contratoSkids(skids, tipoMap) {
  return skids.filter(sk => tipoMap[sk] === 'DIR');
}

const EMPTY = { contratos: null, consumido: null, estadoCaps: null, anticipos: null, corte: null, loading: false, error: null };

export function useCostosData(activePj, instance, accounts) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (isMock()) return;

    const skids = SKIDS[activePj] || [];
    if (!skids.length || !instance || !accounts?.length) return;

    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const token = await getToken(instance, accounts);

        probeFactTables(token, skids[0]);

        // Cargar dim_proyecto primero para derivar tipos DIR/IND/NOMINA
        const proyRows = await getDimProyecto(token);
        const tipoMap  = buildSkidTipoMap(proyRows);

        const skidsControl   = controlSkids(skids, tipoMap);
        const skidsContratos = contratoSkids(skids, tipoMap);

        const [
          claseOrigenRows,
          estadoRows,
          tipoContratoRows,
          capRows,
          terceroRows,
          controlRows,
          especContratosRows,
          especActasRows,
        ] = await Promise.all([
          getDim(token, 'adp_dtm_dim_controlclaseorigen'),
          getDim(token, 'adp_dtm_dim_estadopordocumento'),
          getDim(token, 'adp_dtm_dim_tipocontrato'),
          getDim(token, 'adp_dtm_dim_capitulopresupuesto'),
          getDim(token, 'adp_dtm_dim_tercero'),
          fetchMergedSafe(token, 'adp_dtm_fact_controlproyecto', skidsControl),
          getDimWithSkid(token, 'adp_dtm_dim_especificaciondecontratos', skidsContratos[0] || skids[0]),
          getDim(token, 'adp_dtm_dim_especificaciondeactas'),
        ]);

        if (cancelled) return;

        console.log(`[Sinco] ${activePj} — control:${controlRows.length} espec_contratos:${especContratosRows.length} espec_actas:${especActasRows.length}`);
        if (especContratosRows[0]) console.log('[Sinco] contrato[0]:', JSON.stringify(especContratosRows[0]));
        if (especActasRows[0]) console.log('[Sinco] acta[0]:', JSON.stringify(especActasRows[0]));

        const claseMap   = buildClaseMap(claseOrigenRows);
        const estadoMap  = buildEstadoMap(estadoRows);
        const capMap     = buildCapMap(capRows);
        const terceroMap = buildTerceroMap(terceroRows);

        setState({
          loading:    false,
          error:      null,
          estadoCaps: buildEstadoCaps(controlRows, claseMap, capMap),
          consumido:  buildConsuмido(controlRows, claseMap, capMap),
          contratos:  buildContratos(especContratosRows, especActasRows, estadoMap, terceroMap, skidsContratos),
          anticipos:  null,
          corte:      buildCorte(controlRows),
        });
      } catch (err) {
        if (!cancelled) {
          console.error('[useCostosData]', err);
          setState(s => ({ ...s, loading: false, error: err.message }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activePj, instance, accounts]);

  return state;
}
