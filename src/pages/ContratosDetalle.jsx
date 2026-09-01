import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useStaticProyectos, useStaticCostosData } from '../hooks/useStaticData.js';
import { remoteUrl } from '../assetBase.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtFecha(v) {
  if (!v) return '—';
  // Acepta DD/MM/YYYY o YYYY-MM-DD
  const p = String(v).split('/');
  if (p.length === 3) {
    const d = new Date(+p[2], +p[1]-1, +p[0]);
    return isNaN(d) ? v : d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function parseFecha(v) {
  if (!v) return null;
  const p = String(v).split('/');
  if (p.length === 3) return new Date(+p[2], +p[1]-1, +p[0]);
  const d = new Date(v); return isNaN(d) ? null : d;
}

function diasVencido(fechaFinalStr) {
  const d = parseFecha(fechaFinalStr);
  if (!d) return null;
  return Math.floor((d - new Date()) / 86400000);
}

function diasSinActa(skidfecha) {
  if (!skidfecha) return null;
  const s = String(skidfecha);
  if (s.length !== 8) return null;
  const d = new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8));
  return Math.floor((new Date() - d) / 86400000);
}

function fmtPesos(v) {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (!n && n !== 0) return '—';
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function fmtK(v) {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

const ESTADO_LABEL = {
  por_aprobacion: 'Por Aprobación',
  no_inic_venc:   'No Inic. Vencidos',
  en_ejecucion:   'En Ejecución',
  venc_con_saldo: 'Vencidos con Saldo',
  liquidar:       'Liquidar',
  por_cerrar:     'Por Cerrar',
  cerrado:        'Cerrado',
  sin_clasificar: 'Sin Clasificar',
};
const ESTADO_CLS = {
  por_aprobacion: 'badge-apro',
  no_inic_venc:   'badge-nvenc',
  en_ejecucion:   'badge-open',
  venc_con_saldo: 'badge-vsaldo',
  liquidar:       'badge-liq',
  por_cerrar:     'badge-pcerr',
  cerrado:        'badge-cerr',
  sin_clasificar: 'badge-otro',
};

// Color fijo por valor de estadoSinco (independiente del filtro activo)
const SINCO_CLS = {
  'Cerrado':        'sinco-cerrado',
  'Abierto':        'sinco-abierto',
  'Por Aprobación': 'sinco-apro',
  'Por Tecnica':    'sinco-tecnica',
  'Por Juridica':   'sinco-tecnica',
};

const _today = new Date();
function _parseFecha(str) {
  if (!str) return null;
  const p = str.split('/');
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
  return null;
}

function derivarEstado(r, acumulado, saldoAnticipo, saldoRte, actasByNC, liquidados) {
  const nc    = String(r['No. Contrato'] ?? '');
  // SGD liquidado → cerrado directo
  if (liquidados?.[nc]?.liquidado > 0) return 'cerrado';

  const numActas   = actasByNC[nc] || 0;
  const fd         = _parseFecha(r['Fecha fin'] || r['Fecha Final']);
  const vencido    = fd ? fd < _today : false;
  const noVenc     = !fd || fd >= _today;
  const valorC     = r['Valor Contrato'] ?? r['valorContrato'] ?? 0;
  const faltante   = valorC - acumulado;

  let estadoBase;
  if (r['nopago'] === true)   estadoBase = 'Cerrado';
  else if (numActas > 0)      estadoBase = 'Abierto';
  else                        estadoBase = 'Por Aprobación';

  if (faltante < 1 && (saldoAnticipo >= 1 || saldoRte >= 1)) return 'liquidar';
  if (estadoBase === 'Cerrado' && faltante < 1 && saldoAnticipo < 1 && saldoRte < 1) return 'cerrado';
  if (estadoBase !== 'Cerrado' && faltante < 1 && saldoAnticipo < 1 && saldoRte < 1) return 'por_cerrar';
  if ((estadoBase === 'Por Aprobación' || estadoBase === 'Por Aprobacion') && noVenc && faltante >= 1) return 'por_aprobacion';
  if (vencido && acumulado === 0 && faltante >= 1) return 'no_inic_venc';
  if (vencido && faltante >= 1 && acumulado > 0)  return 'venc_con_saldo';
  if (faltante >= 1 && noVenc && estadoBase === 'Abierto') return 'en_ejecucion';
  return 'sin_clasificar';
}

// ── Constantes de cards ───────────────────────────────────────────────────────
const CARD_ROW1 = [
  { key: null,             label: 'TOTAL CONTRATOS',       icon: '📋', color: '#6C0000' },
  { key: 'cerrado',        label: 'CERRADOS',              icon: '✅', color: '#2E7D32' },
  { key: 'por_cerrar',     label: 'POR CERRAR',            icon: '🔒', color: '#1565C0' },
  { key: 'en_ejecucion',   label: 'EN EJECUCIÓN',          icon: '⚙️', color: '#37474F' },
  { key: 'por_aprobacion', label: 'POR APROBACIÓN',        icon: '🔍', color: '#B8A000' },
  { key: 'no_inic_venc',   label: 'NO INICIADOS VENCIDOS', icon: '🚫', color: '#E64A19' },
  { key: 'venc_con_saldo', label: 'VENCIDOS CON SALDO',    icon: '⚠️', color: '#C62828' },
];

const PH_ICON = {
  cerrado: '✅', por_cerrar: '🔒', en_ejecucion: '⚙️',
  por_aprobacion: '🔍', no_inic_venc: '🚫', venc_con_saldo: '⚠️',
  liquidar: '🪙', irr: '⚠️',
};

const TICKER_TEXT = 'IC CONSTRUCTORA · 55 AÑOS TRANSFORMANDO VIDAS · ';

// ── Componente principal ──────────────────────────────────────────────────────
export default function ContratosDetalle() {
  const { macroKey } = useParams();
  const location = useLocation();
  const navigate  = useNavigate();
  const filtroEstadoInicial = location.state?.filtroEstado || null;
  const subPrefixes = location.state?.subPrefixes || null;
  const subExact    = location.state?.subExact    ?? false;
  const subLabel    = location.state?.subLabel    || null;
  const subKey      = location.state?.subKey      || null;

  const { macros } = useStaticProyectos();
  const macro = macros.find(m => m.key === macroKey) || null;

  const dataStatic = useStaticCostosData(macro);

  // ── Normaliza nombre para comparación: uppercase, sin puntos finales ─────
  const normN = s => (s || '').toUpperCase().trim().replace(/\.+$/, '');

  // ── Construir tabla de contratos ──────────────────────────────────────────
  const mapContrato = (r, liq) => {
    const ncStr   = String(r.noContrato || '');
    const ld      = liq[ncStr];
    const conActa = ld ? (ld.con_acta || 0) + (ld.con_acta_ant || 0) : 0;
    return {
      noContrato:    ncStr,
      contratista:   r.contratista  || '',
      descripcion:   r.descripcion  || '',
      fechaInicial:  r.fechaInicial || '',
      fechaFinal:    r.fechaFinal   || '',
      estado:        r.estado       || 'sin_clasificar',
      estadoSinco:   r.estadoSinco  || '',
      ultimaActa:    r.ultimaActa   || 0,
      valorContrato: r.valorContrato || 0,
      acumulado:     r.acumulado     || 0,
      saldoAnticipo:    r.saldoAnticipo    || 0,
      saldoRte:         r.saldoRte         || 0,
      faltante:         r.faltante         || 0,
      tuvoAnticipo:     r.tuvoAnticipo     ?? null,
      tuvoRteGarantia:  r.tuvoRteGarantia  ?? null,
      conActa,
    };
  };

  const contratosBase = useMemo(() => {
    const liq = dataStatic.liquidados || {};
    let src = dataStatic.contratos || [];
    if (subPrefixes?.length) {
      src = src.filter(r => {
        const proy = r.proyecto || '';
        return subPrefixes.some(p => subExact ? proy === p : proy.startsWith(p));
      });
    }
    return src.map(r => mapContrato(r, liq)).sort((a, b) => Number(a.noContrato) - Number(b.noContrato));
  }, [dataStatic, subPrefixes, subExact]);

  const contratos = useMemo(() => contratosBase.filter(r => r.valorContrato > 0), [contratosBase]);

  // ── Filtro activo ─────────────────────────────────────────────────────────
  const [filtroActivo, setFiltroActivo] = useState(filtroEstadoInicial);
  const [filtroTercero, setFiltroTercero] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => { setFiltroTercero(null); }, [filtroActivo]);

  // Irregularidades por CC del sub-proyecto activo (subKey) o macro si es "Todo"
  const balanceData  = dataStatic.balanceData;
  const balanceKey   = subKey || macroKey;

  const gtaByTercero = useMemo(() => {
    const rows = balanceData?.[balanceKey]?.rows || [];
    const map = {};
    rows.forEach(r => {
      if (r.acct === 'Gta. Cumplimiento' && r.saldo > 0) {
        const k = normN(r.tercero);
        map[k] = (map[k] || 0) + r.saldo;
      }
    });
    return map;
  }, [balanceData, balanceKey]);

  // Con Acta Sinco — solo actas ADPRO/Sinco (excluye EK). Por tercero y por no_contrato.
  const { conActaByTercero, conActaByNC } = useMemo(() => {
    const rows = balanceData?.[balanceKey]?.rows || [];
    const byTercero = {};
    const byNC = {};
    rows.forEach(r => {
      if (!r.saldo || r.saldo < 1) return;
      if (r.acct !== 'Con Acta') return;   // excluye 'Con Acta EK'
      const cont = normN(r.tercero);
      if (cont) byTercero[cont] = (byTercero[cont] || 0) + r.saldo;
      if (r.nc)  byNC[String(r.nc)] = (byNC[String(r.nc)] || 0) + r.saldo;
    });
    return { conActaByTercero: byTercero, conActaByNC: byNC };
  }, [balanceData, balanceKey]);

  // Saldo RTE por tercero — contratos del CC activo
  const saldoRteByTercero = useMemo(() => {
    const map = {};
    contratos.forEach(c => {
      const k = normN(c.contratista);
      map[k] = (map[k] || 0) + (c.saldoRte || 0);
    });
    return map;
  }, [contratos]);

  // Ant. Contratistas por tercero (desde balance)
  const antByTercero = useMemo(() => {
    const rows = balanceData?.[balanceKey]?.rows || [];
    const map = {};
    rows.forEach(r => {
      if (r.acct === 'Ant. Contratistas' && r.saldo > 0) {
        const k = normN(r.tercero);
        map[k] = (map[k] || 0) + r.saldo;
      }
    });
    return map;
  }, [balanceData, balanceKey]);

  // Saldo Anticipo por tercero (desde contracts)
  const saldoAntByTercero = useMemo(() => {
    const map = {};
    contratos.forEach(c => {
      const k = normN(c.contratista);
      map[k] = (map[k] || 0) + (c.saldoAnticipo || 0);
    });
    return map;
  }, [contratos]);

  // Irregular anticipo: Ant. Contratistas > Saldo Anticipo
  const irrAntTerceros = useMemo(() => {
    const TOL = 1000;
    const terceros = new Set([
      ...Object.keys(antByTercero),
      ...contratos.map(c => normN(c.contratista)).filter(Boolean),
    ]);
    return [...terceros].filter(k => {
      const ant = antByTercero[k] || 0;
      if (ant < TOL) return false;
      const saldoAnt = saldoAntByTercero[k] || 0;
      return ant > saldoAnt + TOL;
    }).sort();
  }, [contratos, antByTercero, saldoAntByTercero]);

  // Irregular cuando: GtaCumpl − ConActa > SaldoRte + TOL
  // (el remanente de garantía supera lo retenido en ADPRO)
  const irrTerceros = useMemo(() => {
    const TOL = 1000;
    const terceros = new Set([
      ...Object.keys(gtaByTercero),
      ...contratos.map(c => normN(c.contratista)).filter(Boolean),
    ]);
    return [...terceros].filter(k => {
      const gtaCumpl  = gtaByTercero[k]      || 0;
      if (gtaCumpl < TOL) return false;
      const conActa   = conActaByTercero[k]  || 0;
      const saldoRte  = saldoRteByTercero[k] || 0;
      const remanente = gtaCumpl - conActa;
      return remanente > saldoRte + TOL;
    }).sort();
  }, [contratos, gtaByTercero, conActaByTercero, saldoRteByTercero]);

  const contratosFiltrados = useMemo(() => {
    let list = contratos;
    if (filtroActivo === 'irr') {
      const irrSet = new Set(irrTerceros);
      list = contratosBase.filter(c => irrSet.has(normN(c.contratista)) && (c.tuvoRteGarantia ?? true));
      if (filtroTercero) list = list.filter(c => normN(c.contratista) === filtroTercero);
    } else if (filtroActivo === 'irr-ant') {
      const irrSet = new Set(irrAntTerceros);
      list = contratosBase.filter(c => irrSet.has(normN(c.contratista)) && (c.tuvoAnticipo ?? true));
      if (filtroTercero) list = list.filter(c => normN(c.contratista) === filtroTercero);
    } else if (filtroActivo) {
      list = list.filter(c => c.estado === filtroActivo);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(c =>
        c.noContrato.includes(q) ||
        c.contratista.toLowerCase().includes(q) ||
        c.descripcion.toLowerCase().includes(q)
      );
    }
    // Ordenar por días sin acta: mayor a menor (sin acta al final con Infinity)
    if (filtroActivo !== 'cerrado' && filtroActivo !== 'irr' && filtroActivo !== 'irr-ant') {
      list = [...list].sort((a, b) => {
        const da = a.ultimaActa ? Math.floor((Date.now() - new Date(+String(a.ultimaActa).slice(0,4), +String(a.ultimaActa).slice(4,6)-1, +String(a.ultimaActa).slice(6,8))) / 86400000) : Infinity;
        const db = b.ultimaActa ? Math.floor((Date.now() - new Date(+String(b.ultimaActa).slice(0,4), +String(b.ultimaActa).slice(4,6)-1, +String(b.ultimaActa).slice(6,8))) / 86400000) : Infinity;
        return db - da;
      });
    }
    return list;
  }, [contratos, contratosBase, filtroActivo, filtroTercero, busqueda, irrTerceros, irrAntTerceros]);

  // ── Resumen (tarjetas superiores) ────────────────────────────────────────
  const resumen = useMemo(() => {
    const byEstado = {};
    for (const c of contratos) byEstado[c.estado] = (byEstado[c.estado] || []).concat(c);

    const sum = (arr, f) => (arr || []).reduce((s, c) => s + (c[f] || 0), 0);

    return {
      total:           contratos.length,
      cerrados:        (byEstado.cerrado        || []).length,
      porCerrar:       (byEstado.por_cerrar     || []).length,
      enEjecucion:     (byEstado.en_ejecucion   || []).length,
      porAprobacion:   (byEstado.por_aprobacion || []).length,
      noInicVenc:      (byEstado.no_inic_venc   || []).length,
      vencConSaldo:    (byEstado.venc_con_saldo  || []).length,
      liquidar:        (byEstado.liquidar        || []).length,
      valorCerrados:   sum(byEstado.cerrado,        'valorContrato'),
      valorPorCerrar:  sum(byEstado.por_cerrar,     'valorContrato'),
      valorEnEjecucion:sum(byEstado.en_ejecucion,   'valorContrato'),
      valorPorApro:    sum(byEstado.por_aprobacion, 'valorContrato'),
      valorNoInic:     sum(byEstado.no_inic_venc,   'valorContrato'),
      valorVencSaldo:  sum(byEstado.venc_con_saldo,  'valorContrato'),
      valorLiquidar:   sum(byEstado.liquidar,        'valorContrato'),
      valorTotal:      sum(contratos, 'valorContrato'),
    };
  }, [contratos]);

  // ── Totales de la vista actual ────────────────────────────────────────────
  const totales = useMemo(() => ({
    valorContrato: contratosFiltrados.reduce((s, c) => s + c.valorContrato, 0),
    acumulado:     contratosFiltrados.reduce((s, c) => s + c.acumulado,     0),
    saldoAnticipo: contratosFiltrados.reduce((s, c) => s + c.saldoAnticipo, 0),
    saldoRte:      contratosFiltrados.reduce((s, c) => s + c.saldoRte,      0),
    faltante:      contratosFiltrados.reduce((s, c) => s + c.faltante,      0),
    conActa:       contratosFiltrados.reduce((s, c) => s + c.conActa,       0),
  }), [contratosFiltrados]);

  const isLoading = dataStatic.loading;
  const macroLabel = macro?.label || macroKey;

  // helpers para cards
  function cardCount(key) {
    if (!key) return resumen.total;
    const map = { cerrado:'cerrados', por_cerrar:'porCerrar', en_ejecucion:'enEjecucion',
                  por_aprobacion:'porAprobacion', no_inic_venc:'noInicVenc',
                  venc_con_saldo:'vencConSaldo', liquidar:'liquidar' };
    return resumen[map[key]] || 0;
  }
  function cardValorTotal(key) {
    if (!key) return resumen.valorTotal;
    const map = { cerrado:'valorCerrados', por_cerrar:'valorPorCerrar', en_ejecucion:'valorEnEjecucion',
                  por_aprobacion:'valorPorApro', no_inic_venc:'valorNoInic',
                  venc_con_saldo:'valorVencSaldo', liquidar:'valorLiquidar' };
    return resumen[map[key]] || 0;
  }

  const filtroLabel = filtroActivo === 'irr' ? 'Irregularidades'
    : filtroActivo === 'irr-ant' ? 'Irreg. Anticipos'
    : filtroActivo ? (ESTADO_LABEL[filtroActivo] || filtroActivo)
    : null;

  return (
    <div className="det-page">

      {/* HEADER */}
      <div className="det-header">
        <button className="det-back" onClick={() => navigate(-1)}>← Volver</button>
        <div>
          <div className="det-title">
            ESTADO DE CONTRATOS
            <span className="det-title-sep">/</span>
            <span className="det-title-proj">{macroLabel}{subLabel ? ` · ${subLabel}` : ''}</span>
          </div>
        </div>
        <div className="det-hdr-spacer" />
        <div className="det-hdr-badge">
          <span className="det-hdr-dot" />
          {contratos.length} registros · {macroLabel}
        </div>
        <img className="det-hdr-ic" src={remoteUrl('/images/IC_logo.png')} alt="IC" />
      </div>

      {/* TICKER */}
      <div className="det-ticker" aria-hidden="true">
        <span className="det-ticker-inner">{TICKER_TEXT.repeat(12)}</span>
      </div>

      {/* CARDS SECTION */}
      <div className="det-cards-section">
        {/* Fila 1: 7 cards */}
        <div className="det-cards-row">
          {CARD_ROW1.map(card => {
            const isActive = filtroActivo === card.key;
            return (
              <div
                key={card.key || 'total'}
                className={`det-card2${card.key ? ' det-card2-click' : ''}${isActive ? ' det-card2-active' : ''}`}
                style={{'--dc-col': card.color}}
                onClick={() => card.key && setFiltroActivo(isActive ? null : card.key)}
              >
                <span className="dc2-icon">{card.icon}</span>
                <span className="dc2-lbl">{card.label}</span>
                <span className="dc2-num" style={{color: card.color}}>{cardCount(card.key)}</span>
                <span className="dc2-sub">Valor total: {fmtPesos(cardValorTotal(card.key))}</span>
              </div>
            );
          })}
        </div>

        {/* Fila 2: Liquidar + Irregularidades */}
        <div className="det-cards-row2">
          <div
            className={`det-card2 det-card2-click${filtroActivo === 'liquidar' ? ' det-card2-active' : ''}`}
            style={{'--dc-col':'#7B2D8B', flex:'0 0 220px'}}
            onClick={() => setFiltroActivo(filtroActivo === 'liquidar' ? null : 'liquidar')}
          >
            <span className="dc2-icon">🪙</span>
            <span className="dc2-lbl">LIQUIDAR</span>
            <span className="dc2-num" style={{color:'#7B2D8B'}}>{resumen.liquidar}</span>
            <span className="dc2-sub">Valor total: {fmtPesos(resumen.valorLiquidar)}</span>
          </div>

          <div
            className={`det-card2 det-card2-click${filtroActivo === 'irr' ? ' det-card2-active' : ''}`}
            style={{'--dc-col':'#E8A000', flex:'0 0 260px'}}
            onClick={() => setFiltroActivo(filtroActivo === 'irr' ? null : 'irr')}
          >
            <span className="dc2-icon">⚠️</span>
            <span className="dc2-lbl">IRREGULARIDADES</span>
            <div className="dc2-irr-num">
              <span className="dc2-num" style={{color:'#C07000'}}>{irrTerceros.length}</span>
              <span className="dc2-irr-unit">Terceros</span>
            </div>
            <span className="dc2-sub dc2-irr-sub">SaldoRte {'>'} GtaCumpl − ConActa · o garantía sobrante</span>
          </div>

          <div
            className={`det-card2 det-card2-click${filtroActivo === 'irr-ant' ? ' det-card2-active' : ''}`}
            style={{'--dc-col':'#8A6010', flex:'0 0 260px'}}
            onClick={() => { setFiltroActivo(filtroActivo === 'irr-ant' ? null : 'irr-ant'); setFiltroTercero(null); }}
          >
            <span className="dc2-icon">💰</span>
            <span className="dc2-lbl">IRREG. ANTICIPOS</span>
            <div className="dc2-irr-num">
              <span className="dc2-num" style={{color:'#8A6010'}}>{irrAntTerceros.length}</span>
              <span className="dc2-irr-unit">Terceros</span>
            </div>
            <span className="dc2-sub dc2-irr-sub">Ant. Contratistas {'>'} Saldo Anticipo</span>
          </div>
        </div>
      </div>

      {/* PANEL: header + toolbar + tabla */}
      <div className="det-panel">

        {filtroActivo && (
          <div className="det-panel-hdr">
            <span className="det-ph-icon">{PH_ICON[filtroActivo] || '📋'}</span>
            <span className="det-ph-lbl">{filtroLabel}</span>
            {filtroActivo === 'irr'
              ? <span className="det-ph-badge">{irrTerceros.length} terceros</span>
              : filtroActivo === 'irr-ant'
              ? <span className="det-ph-badge">{irrAntTerceros.length} terceros</span>
              : <span className="det-ph-badge">{contratosFiltrados.length} contratos</span>
            }
            <button className="det-ph-cerrar" onClick={() => { setFiltroActivo(null); setFiltroTercero(null); setBusqueda(''); }}>
              ✕ Cerrar
            </button>
          </div>
        )}

        {/* Subtítulo + dropdown terceros para IRR */}
        {filtroActivo === 'irr' && (
          <div className="det-irr-toolbar">
            <span className="det-irr-sub">
              Caso 1: ∑SaldoRte &gt; GtaCumpl − ConActa · Caso 2: SaldoRte=0 pero GtaCumpl − ConActa &gt; 0
            </span>
            <select
              className="det-irr-select"
              value={filtroTercero || ''}
              onChange={e => setFiltroTercero(e.target.value || null)}
            >
              <option value="">— Todos los terceros —</option>
              {irrTerceros.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {filtroActivo === 'irr-ant' && (
          <div className="det-irr-toolbar">
            <span className="det-irr-sub">
              Ant. Contratistas (balance) &gt; Saldo Anticipo (contratos)
            </span>
            <select
              className="det-irr-select"
              value={filtroTercero || ''}
              onChange={e => setFiltroTercero(e.target.value || null)}
            >
              <option value="">— Todos los terceros —</option>
              {irrAntTerceros.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        <div className="det-panel-toolbar">
          {filtroActivo !== 'irr' && filtroActivo !== 'irr-ant' && (
            <input
              className="det-search"
              placeholder="Buscar contrato, contratista…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          )}
          <span className="det-count-label">
            {filtroActivo === 'irr'
              ? `${contratosFiltrados.length} contrato(s) · ${filtroTercero ? 1 : irrTerceros.length} tercero(s)`
              : filtroActivo === 'irr-ant'
              ? `${contratosFiltrados.length} contrato(s) · ${filtroTercero ? 1 : irrAntTerceros.length} tercero(s)`
              : `${contratosFiltrados.length} de ${contratos.length} registros`
            }
          </span>
        </div>

        {/* TABLA */}
        <div className="det-table-wrap">
        {isLoading && (
          <div className="state-center" style={{padding:40}}>
            <div className="spinner" /><span>Cargando contratos…</span>
          </div>
        )}
        {!isLoading && (
          <table className="det-table">
            <thead>
              <tr>
                <th>CONTRATO</th>
                <th>CONTRATISTA</th>
                <th className="col-desc">DESCRIPCIÓN</th>
                <th>F. INICIO</th>
                <th>F. FINAL</th>
                <th className="col-num">DÍAS VENC.</th>
                <th style={{paddingLeft:'18px', textAlign:'center'}}>ESTADO SINCO</th>
                {filtroActivo !== 'cerrado' && filtroActivo !== 'irr' && filtroActivo !== 'irr-ant' && (
                  <th className="col-num">DÍAS S/ACTA</th>
                )}
                <th className="col-num">VALOR CONTRATO</th>
                <th className="col-num">ACUMULADO</th>
                <th className="col-num">SALDO ANTICIPO</th>
                <th className="col-num">SALDO RTE</th>
                <th className="col-num">FALTANTE</th>
                {filtroActivo === 'irr' && <>
                  <th className="col-num col-gta">∑ SALDO RTE</th>
                  <th className="col-num col-gta" title="Negrita: valor del contrato · ∑ cursiva: total del tercero (sin contrato específico)">CON ACTA</th>
                  <th className="col-num col-gta">GTA. CUMPL.</th>
                  <th className="col-num col-gta">REMANENTE</th>
                  <th className="col-num col-gta">CASO</th>
                </>}
                {filtroActivo === 'irr-ant' && <>
                  <th className="col-num col-gta" style={{color:'#8A6010'}}>∑ SALDO ANT.</th>
                  <th className="col-num col-gta" style={{color:'#8A6010'}}>ANT. CONTRAT.</th>
                  <th className="col-num col-gta" style={{color:'#8A6010'}}>DIFERENCIA</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.map(c => {
                const dias = diasVencido(c.fechaFinal);
                const diasStr = dias === null ? '—' : dias > 0 ? `+${dias}d` : `${dias}d`;
                const diasCls = dias === null ? '' : dias < 0 ? 'txt-red' : dias < 30 ? 'txt-warn' : '';
                const ffCls   = dias !== null && dias < 0 ? 'txt-red' : '';
                const normT      = normN(c.contratista);
                const gtaCumpl   = filtroActivo === 'irr' ? (gtaByTercero[normT]      || 0) : 0;
                const conActaT   = filtroActivo === 'irr' ? (conActaByTercero[normT]  || 0) : 0;
                const conActaNC  = filtroActivo === 'irr' ? (conActaByNC[c.noContrato] || 0) : 0;
                const saldoRteT  = filtroActivo === 'irr' ? (saldoRteByTercero[normT] || 0) : 0;
                const remanente  = gtaCumpl - conActaT;
                const caso       = filtroActivo === 'irr'
                  ? (saldoRteT === 0 && remanente > 0 ? 'Gta. sobrante' : 'Saldo desc.')
                  : '';
                const antContrat = filtroActivo === 'irr-ant' ? (antByTercero[normT]      || 0) : 0;
                const saldoAntT  = filtroActivo === 'irr-ant' ? (saldoAntByTercero[normT] || 0) : 0;
                const diffAnt    = antContrat - saldoAntT;
                return (
                  <tr key={c.noContrato}>
                    <td className="col-nc">{c.noContrato}</td>
                    <td className="col-cont" title={c.contratista}>{c.contratista || '—'}</td>
                    <td className="col-desc" title={c.descripcion}>{c.descripcion || '—'}</td>
                    <td className="col-fecha">{fmtFecha(c.fechaInicial)}</td>
                    <td className={`col-fecha ${ffCls}`}>{fmtFecha(c.fechaFinal)}</td>
                    <td className={`col-num ${diasCls}`}>{diasStr}</td>
                    <td style={{paddingLeft:'18px', textAlign:'center'}}><span className={`badge ${c.estadoSinco ? (SINCO_CLS[c.estadoSinco] || 'sinco-otro') : ESTADO_CLS[c.estado]}`}>{c.estadoSinco || ESTADO_LABEL[c.estado]}</span></td>
                    {filtroActivo !== 'cerrado' && filtroActivo !== 'irr' && filtroActivo !== 'irr-ant' && (() => {
                      const dsa = diasSinActa(c.ultimaActa);
                      const dsaCls = dsa === null ? '' : dsa > 90 ? ' txt-err' : dsa > 60 ? ' txt-warn' : '';
                      return <td className={`col-num${dsaCls}`}>{dsa !== null ? dsa : '—'}</td>;
                    })()}
                    <td className="col-num">{fmtPesos(c.valorContrato) !== '$0' ? fmtPesos(c.valorContrato) : '—'}</td>
                    <td className="col-num">{fmtPesos(c.acumulado)}</td>
                    <td className={`col-num${c.saldoAnticipo > 0 ? ' txt-warn' : ''}`}>{fmtPesos(c.saldoAnticipo)}</td>
                    <td className={`col-num${c.saldoRte > 0 ? ' txt-warn' : ''}`}>{fmtPesos(c.saldoRte)}</td>
                    <td className="col-num">{c.faltante > 0 ? fmtPesos(c.faltante) : '$0'}</td>
                    {filtroActivo === 'irr' && <>
                      <td className={`col-num col-gta${saldoRteT > 0 ? ' txt-warn' : ''}`}>{saldoRteT > 0 ? fmtPesos(saldoRteT) : '—'}</td>
                      <td className="col-num col-gta"
                        title={conActaNC > 0
                          ? `Acta de este contrato: ${fmtPesos(conActaNC)}`
                          : conActaT > 0
                            ? `Total del tercero (sin asignar por contrato): ${fmtPesos(conActaT)}`
                            : 'Sin actas'}>
                        {conActaNC > 0
                          ? <strong style={{ color: '#1A5C1A' }}>{fmtPesos(conActaNC)}</strong>
                          : conActaT > 0
                            ? <span style={{ color: '#999', fontStyle: 'italic', fontSize: '.8em' }}>∑ {fmtPesos(conActaT)}</span>
                            : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td className="col-num col-gta">{gtaCumpl > 0 ? fmtPesos(gtaCumpl) : '—'}</td>
                      <td className={`col-num col-gta${remanente > 0 ? ' txt-warn' : ''}`}>{remanente !== 0 ? fmtPesos(remanente) : '—'}</td>
                      <td className="col-gta"><span className={`badge ${remanente > 0 && saldoRteT === 0 ? 'sinco-apro' : 'badge-vsaldo'}`}>{caso}</span></td>
                    </>}
                    {filtroActivo === 'irr-ant' && <>
                      <td className={`col-num col-gta${saldoAntT > 0 ? ' txt-warn' : ''}`}>{saldoAntT > 0 ? fmtPesos(saldoAntT) : '—'}</td>
                      <td className={`col-num col-gta${antContrat > 0 ? ' txt-warn' : ''}`}>{antContrat > 0 ? fmtPesos(antContrat) : '—'}</td>
                      <td className={`col-num col-gta${diffAnt > 0 ? ' txt-warn' : ''}`}>{diffAnt > 0 ? fmtPesos(diffAnt) : '—'}</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
            {contratosFiltrados.length > 0 && (
              <tfoot>
                <tr className="row-total">
                  <td colSpan={7}>TOTALES ({contratosFiltrados.length})</td>
                  <td className="col-num">{fmtPesos(totales.valorContrato)}</td>
                  <td className="col-num">{fmtPesos(totales.acumulado)}</td>
                  <td className="col-num txt-warn">{totales.saldoAnticipo > 0 ? fmtPesos(totales.saldoAnticipo) : '—'}</td>
                  <td className="col-num txt-warn">{totales.saldoRte > 0 ? fmtPesos(totales.saldoRte) : '$0'}</td>
                  <td className="col-num">{fmtPesos(totales.faltante)}</td>
                  {filtroActivo === 'irr'     && <><td /><td /><td /><td /><td /></>}
                  {filtroActivo === 'irr-ant' && <><td /><td /><td /></>}
                </tr>
                <tr className="row-summary">
                  <td colSpan={filtroActivo === 'irr' ? 17 : filtroActivo === 'irr-ant' ? 15 : 12}>
                    Valor Total: {fmtK(totales.valorContrato)} &nbsp;·&nbsp;
                    Acumulado: {fmtK(totales.acumulado)} &nbsp;·&nbsp;
                    Faltante: {fmtK(totales.faltante)} &nbsp;·&nbsp;
                    Saldo Rte: {fmtK(totales.saldoRte)} &nbsp;·&nbsp;
                    Contratos: {contratosFiltrados.length}
                  </td>
                </tr>
              </tfoot>
            )}
            {contratosFiltrados.length === 0 && (
              <tbody>
                <tr><td colSpan={filtroActivo === 'irr' ? 17 : 12} style={{textAlign:'center',padding:'32px',color:'var(--muted)'}}>
                  Sin contratos en esta categoría
                </td></tr>
              </tbody>
            )}
          </table>
        )}
      </div>
      </div>{/* /det-panel */}
    </div>
  );
}
