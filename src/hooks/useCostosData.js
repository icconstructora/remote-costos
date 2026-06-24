import { useState, useEffect } from 'react';
import { getToken, fetchMerged, getDim, isMock } from '../services/sincoApi.js';
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
export const SKIDS = {
  praia:    [100101,100102,100103,100105,100106,100108,100109,100111,100112],
  oporto:   [100116,100117,100118,100214,100215],
  primera:  [100119,100120,100121,100125,100126,100127,100128],
  hacienda: [100129,100130,100131,100133,100134,100136,100137,100139,100140],
  bosque:   [100141,100142,100143,100147,100148,100150,100151,100153,100154],
  'cast-l': [100155,100156,100157],
  gaia:     [100160,100161,100162],
  'azul-t': [100166,100167,100168,100169,100170,100171],
  'azul-c': [100172,100173,100174,100175,100176,100177],
  verde:    [100178,100179,100180,100181,100182,100183],
  mitika:   [100184,100185,100186,100187,100188,100189],
  well:     [100190,100191,100192],
  'cast-i': [100193,100194,100195,100197,100198,100201,100202],
};

const EMPTY = { contratos: null, consumido: null, estadoCaps: null, anticipos: null, corte: null, loading: false, error: null };

/**
 * Hook que carga los datos de Sinco para el proyecto activo.
 *
 * @param {string}   activePj   - id del macro-proyecto (e.g. 'mitika')
 * @param {object}   instance   - MSAL PublicClientApplication (de useMsal)
 * @param {Array}    accounts   - cuentas MSAL (de useMsal)
 *
 * @returns {{ contratos, consumido, estadoCaps, anticipos, corte, loading, error }}
 */
export function useCostosData(activePj, instance, accounts) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    // En modo mock (npm run dev) no hay token — salir silenciosamente
    if (isMock()) return;

    const skids = SKIDS[activePj] || [];
    if (!skids.length || !instance || !accounts?.length) return;

    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const token = await getToken(instance, accounts);

        // Tablas de dimensión (cached tras la primera llamada) + fact tables en paralelo
        const [
          claseOrigenRows,
          estadoRows,
          tipoContratoRows,
          capRows,
          terceroRows,
          controlRows,
          contratoRows,
          anticipoRows,
        ] = await Promise.all([
          getDim(token, 'adp_dtm_dim_controlclaseorigen'),
          getDim(token, 'adp_dtm_dim_estadopordocumento'),
          getDim(token, 'adp_dtm_dim_tipocontrato'),
          getDim(token, 'adp_dtm_dim_capitulopresupuesto'),
          getDim(token, 'adp_dtm_dim_tercero'),
          fetchMerged(token, 'adp_dtm_fact_controlproyecto', skids),
          fetchMerged(token, 'adp_dtm_fact_contrato', skids),
          fetchMerged(token, 'adp_dtm_fact_anticipo', skids),
        ]);

        if (cancelled) return;

        // Log siempre visible (producción y dev) para verificar mapeos
        console.groupCollapsed('[Sinco] dims loaded — ' + activePj);
        console.log('claseOrigen', claseOrigenRows);
        console.log('estadoPorDocumento', estadoRows);
        console.log('tipoContrato', tipoContratoRows);
        console.log('capituloPresupuesto (sample)', capRows.slice(0, 5));
        console.log('controlRows count', controlRows.length);
        console.log('contratoRows count', contratoRows.length);
        console.log('anticipoRows count', anticipoRows.length);
        console.groupEnd();

        // Construir mapas de lookup
        const claseMap   = buildClaseMap(claseOrigenRows);
        const estadoMap  = buildEstadoMap(estadoRows);
        const capMap     = buildCapMap(capRows);
        const terceroMap = buildTerceroMap(terceroRows);

        setState({
          loading:    false,
          error:      null,
          estadoCaps: buildEstadoCaps(controlRows, claseMap, capMap),
          consumido:  buildConsuмido(controlRows, claseMap, capMap),
          contratos:  buildContratos(contratoRows, estadoMap, terceroMap),
          anticipos:  buildAnticipos(anticipoRows, contratoRows, tipoContratoRows),
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
