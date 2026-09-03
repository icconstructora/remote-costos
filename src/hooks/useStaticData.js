/**
 * useStaticData — carga datos desde /public/data/*.json (modo estático)
 * Activar con VITE_USE_STATIC=true en .env.development
 *
 * Retorna la misma forma que useCostosData para que los paneles funcionen igual.
 */
import { useState, useEffect } from 'react';
import { remoteUrl } from '../assetBase.js';

const today = new Date();

function parseFecha(str) {
  if (!str) return null;
  const p = str.split('/');
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
  return null;
}

function classifyContract(r) {
  const faltante    = r.faltante    ?? 0;
  const acumulado   = r.acumulado   ?? 0;
  const saldoAnt    = r.saldoAnticipo ?? 0;
  const saldoRte    = r.saldoRte    ?? 0;
  const estado      = r.estadoSinco ?? r.estadoContrato ?? '';
  const fd          = parseFecha(r.fechaFinal);
  const vencido     = fd ? fd < today : false;
  const noVenc      = !fd || fd >= today;

  if (faltante < 1 && (saldoAnt >= 1 || saldoRte >= 1)) return 'liquidar';
  if (estado === 'Cerrado' && faltante < 1 && saldoAnt < 1 && saldoRte < 1) return 'cerrado';
  if (estado !== 'Cerrado' && faltante < 1 && saldoAnt < 1 && saldoRte < 1) return 'por_cerrar';
  if ((estado === 'Por Aprobación' || estado === 'Por Aprobacion') && noVenc && faltante >= 1) return 'por_aprobacion';
  if (vencido && acumulado === 0 && faltante >= 1) return 'no_inic_venc';
  if (vencido && faltante >= 1 && acumulado > 0) return 'venc_con_saldo';
  if (faltante >= 1 && noVenc && estado === 'Abierto') return 'en_ejecucion';
  return 'sin_clasificar';
}

// Proyectos estáticos — prefijos de campo 'proyecto' en CONTRACTS_DATA
const PROJECT_PREFIXES = {
  'praia':    ['PRAIA NATURA DIR', 'PRAIA DIR'],
  'oporto':   ['RESERVA DE OPORTO'],
  'primera':  ['PRIMERA ESTE DIR'],
  'hacienda': ['LA HACIENDA JAMUNDI DIR'],
  'bosque':   ['BOSQUE CENTRAL DIR'],
  'cast-l':   ['CASTILLA LIVING DIR'],
  'gaia':     ['GAIA DIR'],
  'azul-t':   ['AZUL TURQUESA DIR'],
  'azul-c':   ['AZUL CELESTE DIR'],
  'verde':    ['VERDE VIVO DIR'],
  'mitika':   ['MITIKA DIR'],
  'well':     ['WELL DIR'],
  'cast-i':   ['CASTILLA IMPERIAL DIR'],
};

const LABEL_MAP = {
  'praia':    'PRAIA NATURA',
  'oporto':   'RESERVA OPORTO',
  'primera':  'PRIMERA ESTE',
  'hacienda': 'LA HACIENDA',
  'bosque':   'BOSQUE CENTRAL',
  'cast-l':   'CASTILLA LIV.',
  'gaia':     'GAIA',
  'azul-t':   'AZUL TURQUESA',
  'azul-c':   'AZUL CELESTE',
  'verde':    'VERDE VIVO',
  'mitika':   'MITIKA',
  'well':     'WELL',
  'cast-i':   'CASTILLA IMP.',
};

const IMG_MAP = {
  'praia':    'Praia.jpg',
  'oporto':   'Reserva de Oporto.jpg',
  'primera':  'Primera Este.jpg',
  'hacienda': 'Hacienda Jamundi.jpg',
  'bosque':   'Bosque Central.jpg',
  'cast-l':   'Castilla Living.jpg',
  'gaia':     'Gaia.jpg',
  'azul-t':   'Azul Turquesa.jpg',
  'azul-c':   'Azul Celeste.jpg',
  'verde':    'Verde Vivo.jpg',
  'mitika':   'Mitika.jpg',
  'well':     'Well.jpg',
  'cast-i':   'Castilla Imperial.jpg',
};


async function fetchJson(path) {
  const url = remoteUrl(path);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

// ── Hook de proyectos estáticos ───────────────────────────────────────────────
export function useStaticProyectos() {
  const [macros, setMacros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: CONTRACTS_DATA = [] } = await fetchJson('/data/contracts_data.json');
        const keys = Object.keys(PROJECT_PREFIXES);
        // Skids por macro (DIR + NOMINA) — para modo live API
        const MACRO_SKIDS = {
          'mitika':   [408,187,188,186,184, 409,189,337,185],
          'praia':    [105,108,101, 103,344],
          'oporto':   [117,118, 116,401],
          'primera':  [125,119, 121],
          'hacienda': [133,139,457, 131],
          'azul-t':   [168,169, 167],
          'azul-c':   [174,175,176, 173],
          'verde':    [180,181,182, 179],
          'cast-i':   [201,193, 195],
          'gaia':     [160, 162],
          'bosque':   [147, 143],
          'cast-l':   [155, 157],
          'well':     [190, 192],
        };

        const normProy = s => (s || '').replace(/\s+/g, ' ').trim();

        const result = keys.map(key => ({
          key,
          label: LABEL_MAP[key] || key,
          img:   IMG_MAP[key]   || '',
          skids:        MACRO_SKIDS[key] || [],
          skidsDir:     [],
          skidsControl: [],
        })).filter(m => {
          const prefixes = PROJECT_PREFIXES[m.key];
          return CONTRACTS_DATA.some(r => prefixes.some(p => normProy(r.proyecto).startsWith(p)));
        });
        setMacros(result);
      } catch (e) {
        console.error('[useStaticProyectos]', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { macros, loading, error: null };
}

// ── Hook de datos estáticos por proyecto ─────────────────────────────────────
export function useStaticCostosData(macro) {
  const [state, setState] = useState({
    loading: false, error: null,
    controlRows: null, especContratosRows: null, especActasRows: null,
    actasF: null, contratosRows: null,
    claseMap: null, capMap: null, terceroMap: null, estadoMap: null, tipoContratoMap: null,
    liquidados: null, corte: null,
    // Datos estáticos específicos
    contratos: null,       // contratos clasificados listos para Panel3 y detalle
    detalleData: null,     // DETALLE_DATA por subkey
    balanceData: null,     // BALANCE_DATA
    consumidoData:    null,   // CONSUMIDO_DATA
    consumidoDetalle: null,   // CONSUMIDO_DETALLE
    corteConsumido:   '',     // corte del JSON consumido
    updateManifest:   {},     // update_manifest.json con timestamps por componente
    estadoData: null,      // ESTADO_DATA (presupuesto/proy/aseg/cons/pa por proyecto)
  });

  useEffect(() => {
    if (!macro) return;
    setState(s => ({ ...s, loading: true }));

    (async () => {
      try {
        const [
          { corte: CORTE_CONTRATOS = '', data: CONTRACTS_DATA = [] },
          { data: DETALLE_DATA = {} },
          { corte: CORTE_LIQUIDADOS = '', data: LIQUIDADOS_DATA = {} },
          { data: BALANCE_DATA = {} },
          { data: CONSUMIDO_DATA = {}, detalle: CONSUMIDO_DETALLE = {}, corte: CORTE_CONSUMIDO = '', generated_at: GENERATED_AT = '' },
          { data: COMPRAS_DATA = {} },
          { data: ANTICIPOS_DATA = {} },
          UPDATE_MANIFEST,
        ] = await Promise.all([
          fetchJson('/data/contracts_data.json'),
          fetchJson('/data/estado_detalle_data.json'),
          fetchJson('/data/liquidados_data.json'),
          fetchJson('/data/balance_data.json'),
          fetchJson('/data/consumido_data.json'),
          fetchJson('/data/compras_data.json'),
          fetchJson('/data/anticipos_data.json'),
          fetchJson('/data/update_manifest.json').catch(() => ({})),
        ]);

        // Filtrar contratos por proyecto
        const normP = s => (s || '').replace(/\s+/g, ' ').trim();
        const prefixes = PROJECT_PREFIXES[macro.key] || [];
        const rawContratos = CONTRACTS_DATA.filter(r =>
          prefixes.some(p => normP(r.proyecto).startsWith(p))
        );

        // Clasificar contratos
        const contratos = rawContratos.map(r => ({
          ...r,
          estado: LIQUIDADOS_DATA[String(r.noContrato)]?.liquidado > 0
            ? 'cerrado'
            : classifyContract(r),
        }));

        setState({
          loading: false, error: null,
          contratos,
          corte:        CORTE_CONTRATOS || CORTE_LIQUIDADOS,
          liquidados:   LIQUIDADOS_DATA,
          detalleData:  DETALLE_DATA?.data ?? DETALLE_DATA,
          balanceData:  BALANCE_DATA,
          consumidoData:    CONSUMIDO_DATA,
          consumidoDetalle: CONSUMIDO_DETALLE,
          corteConsumido:   CORTE_CONSUMIDO,
          generatedAt:      GENERATED_AT,
          updateManifest:   UPDATE_MANIFEST || {},
          comprasData:      COMPRAS_DATA,
          anticiposData:    ANTICIPOS_DATA,
          estadoData:   null,
                // Campos legacy (null en modo estático — paneles los ignorarán)
          controlRows: null, especContratosRows: null, especActasRows: null,
          actasF: null, contratosRows: null,
          claseMap: null, capMap: null, terceroMap: null, estadoMap: null, tipoContratoMap: null,
        });
      } catch (e) {
        setState(s => ({ ...s, loading: false, error: e.message }));
      }
    })();
  }, [macro?.key]);

  return state;
}
