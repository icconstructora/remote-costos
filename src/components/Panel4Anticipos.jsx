import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const fmtM = v => {
  if (!v && v !== 0) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'MM';
  if (abs >= 1e6) return '$' + Math.round(v / 1e6) + 'M';
  if (abs >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
  return '$' + Math.round(v);
};

// Grupos en el mismo orden del embudo P3
const GRUPOS = [
  { key: 'Aprobada',           color: '#1565C0', alpha: 0.85, activa: true  },
  { key: 'En Proceso Entrega', color: '#2E7D32', alpha: 0.85, activa: true  },
  { key: 'Generada',           color: '#E8A000', alpha: 0.85, activa: false },
  { key: 'Completada',         color: '#00897B', alpha: 0.75, activa: false },
  { key: 'Cerrada',            color: '#607D8B', alpha: 0.60, activa: false },
  { key: 'Cancelada',          color: '#C62828', alpha: 0.60, activa: false },
  { key: 'Anulada',            color: '#795548', alpha: 0.55, activa: false },
];

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
                // Calcular porcentajes con suma exacta = 100%
                const visibles = GRUPOS.map(g => {
                  const est = data.est[g.key] || { n: 0, valor: 0 };
                  return { ...g, est, n: est.n || 0 };
                }).filter(g => g.n > 0 || g.activa);

                const rawPcts = visibles.map(g => data.total > 0 ? g.n / data.total * 100 : 0);
                const rounded = rawPcts.map(p => Math.floor(p));
                const diff    = 100 - rounded.reduce((s, v) => s + v, 0);
                // Distribuir el residuo a los de mayor parte decimal
                const remainders = rawPcts.map((p, i) => ({ i, r: p - rounded[i] }))
                  .sort((a, b) => b.r - a.r);
                for (let k = 0; k < diff; k++) rounded[remainders[k].i]++;

                return (
                  <div className="p3-cats">
                    {visibles.map((g, idx) => {
                      const pct  = rounded[idx];
                      const barW = data.total > 0 ? (g.n / data.total * 100) : 0;
                      return (
                        <div key={g.key} className="p3-grupo" style={{...(g.key === 'Aprobada' ? { paddingTop: 18 } : {}), cursor:'pointer'}} onClick={() => irDetalle(g.key)}>
                          <span className="p3-lbl" style={{ gridColumn:1, gridRow:1, color: g.color }}>{g.key}</span>
                          <span className="p3-cnt" style={{ gridColumn:2, gridRow:1 }}>{g.n}</span>
                          <div className="p3-bar-wrap" style={{ gridColumn:3, gridRow:1 }}>
                            {barW > 0 && <div className="p3-bar" style={{ width: barW+'%', background: g.color, opacity: g.alpha }} />}
                          </div>
                          <span className="p3-pct" style={{ gridColumn:4, gridRow:1 }}>{pct}%</span>
                          <span className="p3-saldos" style={{ gridColumn:5, gridRow:1 }}>
                            {g.est.valor >= 1000 && <span className="p4-vr">{fmtM(g.est.valor)}</span>}
                          </span>
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
