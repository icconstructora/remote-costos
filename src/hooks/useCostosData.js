import { useState, useEffect } from 'react';
import { getToken, fetchMerged, fetchMergedSafe, getDim, getDimWithSkid, isMock, probeFactTables } from '../services/sincoApi.js';
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

// ── Clasificación de cada skidproyecto por "Clase de Proyecto" en Sinco ───────
// DIR    = administración directa (obra) → contratos con terceros
// NOMINA = nómina de personal de obra → Clase de Proyecto también es "Directos"
//          en Sinco, pero no tiene contratos de terceros
// IND    = Clase de Proyecto "Indirectos" → no entra ni a control ni a contratos
// Fuente: comentarios de gen_estado.py/gen_consumido.py (histórico Excel) +
// patrón confirmado en adp_dtm_dim_proyecto (código intermedio de cada tríada
// simple = Indirectos)
export const SKID_TIPO = {
  // MITIKA
  100184:'DIR', 100185:'NOMINA', 100186:'DIR', 100187:'DIR', 100188:'DIR',
  100189:'NOMINA', 100337:'NOMINA', 100408:'DIR', 100409:'NOMINA',
  // GAIA
  100160:'DIR', 100161:'IND', 100162:'NOMINA',
  // AZUL TURQUESA
  100166:'IND', 100167:'NOMINA', 100168:'DIR', 100169:'DIR', 100170:'IND', 100171:'IND',
  // AZUL CELESTE
  100172:'IND', 100173:'NOMINA', 100174:'DIR', 100175:'DIR', 100176:'DIR', 100177:'IND',
  // CASTILLA IMPERIAL
  100193:'DIR', 100194:'IND', 100195:'NOMINA', 100197:'IND', 100198:'IND',
  100201:'DIR', 100202:'IND',
  // CASTILLA LIVING
  100155:'DIR', 100156:'IND', 100157:'NOMINA',
  // BOSQUE CENTRAL
  100141:'IND', 100142:'IND', 100143:'NOMINA', 100147:'DIR', 100148:'IND',
  100150:'IND', 100151:'IND', 100153:'IND', 100154:'IND',
  // LA HACIENDA JAMUNDÍ
  100129:'IND', 100130:'IND', 100131:'NOMINA', 100133:'DIR', 100134:'IND',
  100136:'IND', 100137:'IND', 100139:'DIR', 100140:'IND', 100457:'DIR',
  // PRIMERA ESTE
  100119:'DIR', 100120:'IND', 100121:'NOMINA', 100125:'DIR', 100126:'IND',
  100127:'IND', 100128:'IND',
  // RESERVA DE OPORTO
  100116:'NOMINA', 100117:'DIR', 100118:'DIR', 100214:'IND', 100215:'IND', 100401:'NOMINA',
  // PRAIA NATURA
  100101:'DIR', 100102:'IND', 100103:'NOMINA', 100105:'DIR', 100106:'IND',
  100108:'DIR', 100109:'IND', 100111:'IND', 100112:'IND', 100344:'NOMINA',
  // VERDE VIVO
  100178:'IND', 100179:'NOMINA', 100180:'DIR', 100181:'DIR', 100182:'DIR', 100183:'IND',
  // WELL
  100190:'DIR', 100191:'IND', 100192:'NOMINA',
};

// Codigos de "control proyecto" (estado del proyecto): DIR + NOMINA, sin IND
function controlSkids(skids) {
  return skids.filter(sk => SKID_TIPO[sk] !== 'IND');
}

// Codigos de "contratos": solo DIR (NOMINA e IND no tienen contratos de terceros)
function contratoSkids(skids) {
  return skids.filter(sk => SKID_TIPO[sk] === 'DIR');
}

const EMPTY = { contratos: null, consumido: null, estadoCaps: null, anticipos: null, corte: null, loading: false, error: null };

export function useCostosData(activePj, instance, accounts) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (isMock()) return;

    const skids = SKIDS[activePj] || [];
    if (!skids.length || !instance || !accounts?.length) return;

    const skidsControl   = controlSkids(skids);   // DIR + NOMINA (sin IND)
    const skidsContratos = contratoSkids(skids);  // solo DIR

    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const token = await getToken(instance, accounts);

        probeFactTables(token, skidsControl[0]);

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
