import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const fmtM = v => {
  if (!v && v !== 0) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'MM';
  if (abs >= 1e6) return '$' + Math.round(v / 1e6) + 'M';
  if (abs >= 1e3) return '$' + Math.round(v / 1e3) + 'Mil';
  return '$' + Math.round(v);
};

// Grupos del embudo — mismo estilo acumulado que P3 Contratos
const GRUPOS = [
  { key: 'Aprobada',           label: 'Aprobada',           color: '#1565C0', alpha: 0.85, activa: true,
    sub: null },
  { key: 'En Proceso Entrega', label: 'En Proceso Entrega', color: '#2E7D32', alpha: 0.85, activa: true,
    sub: null },
  { key: 'Generada',           label: 'Generada',           color: '#E8A000', alpha: 0.85, activa: false,
    sub: null },
  { key: 'Completada',         label: 'Completada',         color: '#00897B', alpha: 0.75, activa: false,
    sub: { key: 'Cerrada', label: '· Cerrada', color: '#607D8B', alpha: 0.60 } },
  { key: 'Cancelada',          label: 'Cancelada',          color: '#C62828', alpha: 0.60, activa: false,
    sub: null },
  { key: 'Anulada',            label: 'Anulada',            color: '#795548', alpha: 0.55, activa: false,
    sub: null },
];

// Barras apiladas acumuladas (de abajo hacia arriba, como P3 Contratos)
const STACK_SEGS = [
  { key: 'Anulada',            color: '#795548', alpha: 0.55 },
  { key: 'Cancelada',          color: '#C62828', alpha: 0.60 },
  { key: 'Cerrada',            color: '#607D8B', alpha: 0.60 },
  { key: 'Completada',         color: '#00897B', alpha: 0.75 },
  { key: 'Generada',           color: '#E8A000', alpha: 0.85 },
  { key: 'En Proceso Entrega', color: '#2E7D32', alpha: 0.85 },
  { key: 'Aprobada',           color: '#1565C0', alpha: 0.85 },
];
const SEG_MAP = Object.fromEntries(STACK_SEGS.map(s => [s.key, s]));
const CUMUL_KEYS = {
  Anulada:            ['Anulada'],
  Cancelada:          ['Anulada','Cancelada'],
  Completada:         ['Anulada','Cancelada','Cerrada','Completada'],
  Generada:           ['Anulada','Cancelada','Cerrada','Completada','Generada'],
  'En Proceso Entrega': ['Anulada','Cancelada','Cerrada','Completada','Generada','En Proceso Entrega'],
  Aprobada:           ['Anulada','Cancelada','Cerrada','Completada','Generada','En Proceso Entrega','Aprobada'],
};

export default function Panel4Anticipos({ loading, comprasData, anticiposData, macroKey, macro, activeSub }) {
  const navigate = useNavigate();
  const entry = useMemo(() => {
    if (!comprasData || !macroKey) return null;
    return comprasData[macroKey] || null;
  }, [comprasData, macroKey]);

  const ant = useMemo(() => {
    if (!anticiposData || !macroKey) return null;
    return anticiposData[macroKey] || null;
  }, [anticiposData, macroKey]);

  const data = useMemo(() => {
    if (!entry) return null;
    const est = entry.estados || {};
    const total = entry.total_n || 0;
    return { total, est, entry };
  }, [entry]);

  function irDetalle(estadoKey) {
    if (!macro?.key) return;
    navigate(`/compras/${macro.key}`, {
      state: {
        filtroEstado: estadoKey,
        subKey:   activeSub?.key   || null,
        subLabel: activeSub?.key ? activeSub.label : null,
      },
    });
  }

  // Ancho columna derecha — igual que P3
  const irrColW = 210;

  return (
    <div className="ov-panel p4">
      <div className="ov-side"><span className="ov-title">Estado de Compras</span></div>
      <div className="ov-body p3-body-row">

        {loading && !data && (
          <div className="state-center"><div className="spinner" /><span>Cargando…</span></div>
        )}
        {!loading && !data && (
          <div className="state-center"><span>Selecciona un proyecto</span></div>
        )}

        {data && (<>
          {/* ── Columna izquierda — idéntica a P3 ── */}
          <div className="p3-chart-col">
            <div className="p3-chart-box">

              <div className="p3-adpro-hdr">
                <span className="p3-adpro-hdr-lbl">Estado de Compras</span>
                <span className="p3-adpro-badge">ADP</span>
              </div>

              {/* Fila total */}
              <div className="p3-row p3-row-total" style={{cursor:'pointer'}} onClick={() => irDetalle(null)}>
                <span className="p3-lbl">Total órdenes</span>
                <span className="p3-cnt">{data.total}</span>
                <div className="p3-bar-wrap">
                  <div className="p3-bar p3-bar-total" style={{ width: '100%' }} />
                </div>
                <span className="p3-pct">100%</span>
                <span className="p3-saldos">
                  <span className="p4-vr">{fmtM(data.entry.total_valor)}</span>
                </span>
              </div>

              {(() => {
                const est = data.est;
                // Contar n por estado incluyendo Cerrada
                const nByKey = k => (est[k]?.n || 0);
                const ACUM = {
                  Anulada:            nByKey('Anulada'),
                  Cancelada:          nByKey('Anulada') + nByKey('Cancelada'),
                  Completada:         nByKey('Anulada') + nByKey('Cancelada') + nByKey('Cerrada') + nByKey('Completada'),
                  Generada:           nByKey('Anulada') + nByKey('Cancelada') + nByKey('Cerrada') + nByKey('Completada') + nByKey('Generada'),
                  'En Proceso Entrega': nByKey('Anulada') + nByKey('Cancelada') + nByKey('Cerrada') + nByKey('Completada') + nByKey('Generada') + nByKey('En Proceso Entrega'),
                  Aprobada:           data.total,
                };
                return (
                  <div className="p3-cats">
                    {GRUPOS.map(g => {
                      const mainN  = nByKey(g.key);
                      const subN   = g.sub ? nByKey(g.sub.key) : 0;
                      const groupN = mainN + subN;
                      const hasSub = g.sub && subN > 0;
                      const pct    = data.total > 0 ? Math.round(groupN / data.total * 100) : 0;
                      const cumul  = ACUM[g.key] || 0;
                      const valor  = (est[g.key]?.valor || 0) + (g.sub ? (est[g.sub.key]?.valor || 0) : 0);
                      const barSegs = (CUMUL_KEYS[g.key] || [])
                        .map(k => ({ ...SEG_MAP[k], w: data.total > 0 ? nByKey(k) / data.total * 100 : 0 }))
                        .filter(s => s.w > 0);
                      if (groupN === 0 && !g.activa) return null;
                      return (
                        <div key={g.key} className="p3-grupo" style={{ cursor:'pointer', gridTemplateRows: hasSub ? '1fr 1fr' : '1fr' }} onClick={() => irDetalle(g.key)}>
                          <span className="p3-lbl" style={{ gridColumn:1, gridRow:1, color: g.color }}>{g.label}</span>
                          <span className="p3-cnt" style={{ gridColumn:2, gridRow:1 }}>{mainN}</span>
                          <div className="p3-bar-wrap" style={{ gridColumn:3, gridRow: hasSub ? '1/3' : '1', position:'relative' }}>
                            {barSegs.map(s => (
                              <div key={s.key} className="p3-bar" style={{ width: s.w+'%', background: s.color, opacity: s.alpha, float:'left' }} />
                            ))}
                            <span style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',fontSize:'0.62rem',fontWeight:700,color:'rgba(0,0,0,0.82)',lineHeight:1,pointerEvents:'none'}}>{cumul}</span>
                          </div>
                          <span className="p3-pct" style={{ gridColumn:4, gridRow:1 }}>{pct}%</span>
                          <span className="p3-saldos" style={{ gridColumn:5, gridRow: hasSub ? '1/3' : '1' }}>
                            {valor >= 1000 && <span className="p4-vr">{fmtM(valor)}</span>}
                          </span>
                          {hasSub && <span className="p3-sub-lbl" style={{ gridColumn:1, gridRow:2, color: g.sub.color }}>{g.sub.label}</span>}
                          {hasSub && <span className="p3-sub-cnt" style={{ gridColumn:2, gridRow:2 }}>{subN}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}


            </div>
          </div>

          {/* ── Columna derecha ── */}
          <div className="p3-irr-col" style={{ width: irrColW }}>
            {/* Card A&F vs ADPRO */}
            <div className="p3-af-box">
              {ant ? (
                <>
                  <div className="p3-af-ttl">A&amp;F vs ADPRO</div>
                  <div className="p3-af-row">
                    <span className="p3-af-lbl">Ant. Proveedores</span>
                    <span className="p3-af-val" style={{ color: '#1565C0' }}>{fmtM(ant.ant_prov_af)}</span>
                  </div>
                  <div className="p3-af-row">
                    <span className="p3-af-lbl">Ant. amortizado</span>
                    <span className="p3-af-val" style={{ color: ant.pct_amort >= 80 ? '#1A6B7C' : ant.pct_amort >= 50 ? '#8A6010' : '#B85520' }}>{fmtM(ant.ant_amort_af)}</span>
                  </div>
                  <div className="p3-af-row">
                    <span className="p3-af-lbl">Saldo A&amp;F x amortizar</span>
                    <span className="p3-af-val" style={{ color: '#B85520' }}>{fmtM(ant.saldo_af)}</span>
                  </div>
                  <div className="p3-af-row">
                    <span className="p3-af-lbl">Saldo ADPRO x amortizar</span>
                    <span className="p3-af-val" style={{ color: '#8A6010' }}>{fmtM(ant.saldo_adpro)}</span>
                  </div>
                  <div className="p3-af-row">
                    <span className="p3-af-lbl">Diferencia entre módulos</span>
                    <span className="p3-af-val" style={{ color: ant.diferencia < 0 ? '#C62828' : ant.diferencia > 0 ? '#E8A000' : '#2E7D32' }}>{fmtM(ant.diferencia)}</span>
                  </div>
                  <div
                    className="p3-af-row"
                    style={ant.n_sin_mov > 0 ? { cursor: 'pointer' } : {}}
                    onClick={() => ant.n_sin_mov > 0 && irDetalle('sin_mov')}
                  >
                    <span className="p3-af-lbl">Ant. &gt;2m sin mov</span>
                    <span className="p3-af-val" style={{ color: '#C62828' }}>
                      {fmtM(ant.sin_mov)}
                      {ant.n_sin_mov > 0 && <span className="p3-af-badge">{ant.n_sin_mov}</span>}
                    </span>
                  </div>
                  <div className="p3-af-divider" />
                  <div className="p3-af-row p3-af-pct-row">
                    <span className="p3-af-lbl">% Amortizado</span>
                    <span className="p3-af-val p3-af-pct" style={{ color: ant.pct_amort >= 80 ? '#2E7D32' : ant.pct_amort >= 50 ? '#E8A000' : '#C62828' }}>
                      {ant.pct_amort}%
                    </span>
                  </div>
                  <div className="p3-af-pct-bar-wrap">
                    <div className="p3-af-pct-bar" style={{
                      width: ant.pct_amort + '%',
                      background: ant.pct_amort >= 80 ? '#2E7D32' : ant.pct_amort >= 50 ? '#E8A000' : '#C62828',
                    }} />
                  </div>
                </>
              ) : (
                <div className="p3-af-empty">—</div>
              )}
            </div>
            {ant && ant.n_irr > 0 ? (
              <div className="p3-irr-box" style={{ cursor: 'pointer' }}
                   onClick={() => irDetalle('irr')}>
                <span className="p3-irr-num">{ant.n_irr}</span>
                <span className="p3-irr-lbl">terceros con<br/>diferencia módulos</span>
                <span className="p3-irr-desc">Saldo A&amp;F sin registrar<br/>en ADPRO</span>
              </div>
            ) : (
              <div className="p3-irr-box" />
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}
