import React, { useState, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useStaticProyectos, useStaticCostosData } from '../hooks/useStaticData.js';

function fmtPesos(v) {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (!n && n !== 0) return '—';
  return '$' + Math.round(n).toLocaleString('es-CO');
}

const GRUPOS = [
  { key: 'Aprobada',           icon: '✅', color: '#1565C0' },
  { key: 'En Proceso Entrega', icon: '🚚', color: '#2E7D32' },
  { key: 'Generada',           icon: '📝', color: '#E8A000' },
  { key: 'Completada',         icon: '✔️', color: '#00897B' },
  { key: 'Cerrada',            icon: '🔒', color: '#607D8B' },
  { key: 'Cancelada',          icon: '🚫', color: '#C62828' },
  { key: 'Anulada',            icon: '❌', color: '#795548' },
];

const GRUPO_COLOR = Object.fromEntries(GRUPOS.map(g => [g.key, g.color]));
const TICKER_TEXT = 'IC CONSTRUCTORA · 55 AÑOS TRANSFORMANDO VIDAS · ';

export default function ComprasDetalle() {
  const { macroKey }  = useParams();
  const location      = useLocation();
  const navigate      = useNavigate();

  const filtroInicial = location.state?.filtroEstado ?? null;
  const [filtroActivo, setFiltroActivo] = useState(filtroInicial);
  const [busqueda, setBusqueda]         = useState('');

  const { macros }  = useStaticProyectos();
  const macro       = macros.find(m => m.key === macroKey) || null;
  const dataStatic  = useStaticCostosData(macro);

  const comprasEntry = useMemo(() => {
    const cd = dataStatic?.comprasData;
    return cd ? (cd[macroKey] || null) : null;
  }, [dataStatic, macroKey]);

  const anticiposEntry = useMemo(() => {
    const ad = dataStatic?.anticiposData;
    return ad ? (ad[macroKey] || null) : null;
  }, [dataStatic, macroKey]);

  const allRows    = useMemo(() => comprasEntry?.rows || [], [comprasEntry]);
  const irrTercs   = useMemo(() => anticiposEntry?.irr_terceros || [], [anticiposEntry]);

  // Conteos por estado para las cards
  const estadoCounts = useMemo(() => {
    const m = {};
    allRows.forEach(r => { m[r.estado] = (m[r.estado] || 0) + 1; });
    return m;
  }, [allRows]);

  const estadoValores = useMemo(() => {
    const m = {};
    allRows.forEach(r => {
      const v = Number(r.valor_compra || 0);
      m[r.estado] = (m[r.estado] || 0) + v;
    });
    return m;
  }, [allRows]);

  // Filas filtradas
  const rowsFiltrados = useMemo(() => {
    if (filtroActivo === 'irr') return [];
    let r = allRows;
    if (filtroActivo) r = r.filter(x => x.estado === filtroActivo);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      r = r.filter(x =>
        String(x.compra_no || '').includes(q) ||
        (x.proveedor || '').toLowerCase().includes(q) ||
        (x.estado || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [allRows, filtroActivo, busqueda]);

  const irrFiltrados = useMemo(() => {
    if (filtroActivo !== 'irr') return [];
    if (!busqueda.trim()) return irrTercs;
    const q = busqueda.trim().toLowerCase();
    return irrTercs.filter(t =>
      (t.nombre || '').toLowerCase().includes(q) || (t.nit || '').toLowerCase().includes(q)
    );
  }, [filtroActivo, irrTercs, busqueda]);

  const macroLabel = macro?.label || macroKey || '';
  const filtroLabel = filtroActivo === 'irr' ? 'Diferencia módulos'
    : filtroActivo ? filtroActivo : null;

  function nEntry(key) {
    if (!key) return comprasEntry?.total_n ?? 0;
    return estadoCounts[key] ?? comprasEntry?.estados?.[key]?.n ?? 0;
  }
  function vEntry(key) {
    if (!key) return comprasEntry?.total_valor ?? 0;
    return estadoValores[key] ?? comprasEntry?.estados?.[key]?.valor ?? 0;
  }

  function fmtDias(d) {
    if (d == null) return '—';
    return `${d}d`;
  }

  return (
    <div className="det-page">

      {/* HEADER */}
      <div className="det-header">
        <button className="det-back" onClick={() => navigate(-1)}>← Volver</button>
        <div>
          <div className="det-title">
            ESTADO DE COMPRAS
            <span className="det-title-sep">/</span>
            <span className="det-title-proj">{macroLabel}</span>
          </div>
        </div>
        <div className="det-hdr-spacer" />
        <div className="det-hdr-badge">
          <span className="det-hdr-dot" />
          {comprasEntry?.total_n ?? '—'} órdenes · {macroLabel}
        </div>
        <img className="det-hdr-ic" src="/images/IC.jpg" alt="IC" />
      </div>

      {/* TICKER */}
      <div className="det-ticker" aria-hidden="true">
        <span className="det-ticker-inner">{TICKER_TEXT.repeat(12)}</span>
      </div>

      {/* CARDS */}
      <div className="det-cards-section">
        <div className="det-cards-row">
          {/* Total */}
          <div className="det-card2" style={{ '--dc-col': '#6C0000' }}>
            <span className="dc2-icon">🛒</span>
            <span className="dc2-lbl">TOTAL ÓRDENES</span>
            <span className="dc2-num" style={{ color: '#6C0000' }}>{nEntry(null)}</span>
            <span className="dc2-sub">Valor: {fmtPesos(vEntry(null))}</span>
          </div>

          {GRUPOS.filter(g => nEntry(g.key) > 0).map(g => (
            <div
              key={g.key}
              className={`det-card2 det-card2-click${filtroActivo === g.key ? ' det-card2-active' : ''}`}
              style={{ '--dc-col': g.color }}
              onClick={() => setFiltroActivo(filtroActivo === g.key ? null : g.key)}
            >
              <span className="dc2-icon">{g.icon}</span>
              <span className="dc2-lbl">{g.key.toUpperCase()}</span>
              <span className="dc2-num" style={{ color: g.color }}>{nEntry(g.key)}</span>
              <span className="dc2-sub">Valor: {fmtPesos(vEntry(g.key))}</span>
            </div>
          ))}
        </div>

        {irrTercs.length > 0 && (
          <div className="det-cards-row2">
            <div
              className={`det-card2 det-card2-click${filtroActivo === 'irr' ? ' det-card2-active' : ''}`}
              style={{ '--dc-col': '#C62828', flex: '0 0 260px' }}
              onClick={() => setFiltroActivo(filtroActivo === 'irr' ? null : 'irr')}
            >
              <span className="dc2-icon">⚠️</span>
              <span className="dc2-lbl">DIFERENCIA MÓDULOS</span>
              <div className="dc2-irr-num">
                <span className="dc2-num" style={{ color: '#C62828' }}>{irrTercs.length}</span>
                <span className="dc2-irr-unit">Terceros</span>
              </div>
              <span className="dc2-sub dc2-irr-sub">Saldo A&amp;F sin amortizar en anticipos</span>
            </div>
          </div>
        )}
      </div>

      {/* PANEL */}
      <div className="det-panel">

        {filtroActivo && (
          <div className="det-panel-hdr">
            <span className="det-ph-icon">{filtroActivo === 'irr' ? '⚠️' : '📦'}</span>
            <span className="det-ph-lbl">{filtroLabel}</span>
            {filtroActivo === 'irr'
              ? <span className="det-ph-badge">{irrTercs.length} terceros</span>
              : <span className="det-ph-badge">{rowsFiltrados.length} órdenes</span>
            }
            <button className="det-ph-cerrar" onClick={() => { setFiltroActivo(null); setBusqueda(''); }}>
              ✕ Cerrar
            </button>
          </div>
        )}

        <div className="det-panel-toolbar">
          <input
            className="det-search"
            placeholder={filtroActivo === 'irr' ? 'Buscar NIT o proveedor…' : 'Buscar orden, estado…'}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <span className="det-count-label">
            {filtroActivo === 'irr'
              ? `${irrFiltrados.length} tercero${irrFiltrados.length !== 1 ? 's' : ''}`
              : `${rowsFiltrados.length} orden${rowsFiltrados.length !== 1 ? 'es' : ''}`}
          </span>
        </div>

        {/* Tabla irregularidades */}
        {filtroActivo === 'irr' && (
          <div className="det-table-wrap">
            <table className="det-table">
              <thead>
                <tr>
                  <th>NIT</th>
                  <th>Proveedor</th>
                  <th className="col-num">Saldo A&amp;F</th>
                </tr>
              </thead>
              <tbody>
                {irrFiltrados.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999' }}>Sin resultados</td></tr>
                )}
                {irrFiltrados.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '.85em' }}>{t.nit}</td>
                    <td>{t.nombre || t.nit}</td>
                    <td className="col-num" style={{ color: '#C62828', fontWeight: 600 }}>{fmtPesos(t.saldo_af)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabla compras */}
        {filtroActivo !== 'irr' && (
          allRows.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#888' }}>
              <p style={{ fontWeight: 600 }}>Detalle de órdenes no disponible.</p>
              <p style={{ fontSize: '.9em', marginTop: 8 }}>
                Ejecuta <code>gen_compras_api.py</code> para regenerar el JSON con filas individuales.
              </p>
            </div>
          ) : (
            <div className="det-table-wrap">
              <table className="det-table">
                <thead>
                  <tr>
                    <th className="col-num">No. Orden</th>
                    <th>Proveedor</th>
                    <th>Fecha Orden</th>
                    <th>Fecha Última Entrada</th>
                    <th className="col-num">Días sin Entrada</th>
                    <th>Estado</th>
                    <th className="col-num">Valor Orden</th>
                    <th className="col-num">Saldo por Entregar</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#999' }}>
                        Sin resultados
                      </td>
                    </tr>
                  )}
                  {rowsFiltrados.map((r, i) => (
                    <tr key={i}>
                      <td className="col-num" style={{ fontFamily: 'monospace' }}>{r.compra_no}</td>
                      <td>{r.proveedor || '—'}</td>
                      <td>{r.fecha_compra || '—'}</td>
                      <td>{r.fecha_ultima_entrada || '—'}</td>
                      <td className="col-num">{fmtDias(r.dias_sin_entrada)}</td>
                      <td>
                        <span style={{
                          background: GRUPO_COLOR[r.estado] || '#999',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: '.75em',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="col-num">{fmtPesos(r.valor_compra)}</td>
                      <td className="col-num">{fmtPesos(r.saldo_por_entregar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
