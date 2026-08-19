import React, { useState, useMemo } from 'react';

const N_SHOW = 10;
const FONT   = "Century Gothic,Nunito,sans-serif";

// Idéntico al legacy — solo cambian colores CDD (rosa→verde)
const COLOR_CDD    = '#AACAAA';   // era #D4AAAA (rosa)
const STROKE_CDD   = '#3A7228';   // era #9C5050
const COLOR_CID    = '#D8C898';   // sin cambio (dorado)
const STROKE_CID   = '#A89030';   // sin cambio

const fmtV = v => {
  if (!v || v < 1000) return '$0';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'MM';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
  return '$' + Math.round(v / 1e3) + 'K';
};

const fmtM = v => {
  if (!v) return '$0';
  const abs = Math.abs(v);
  const s   = v < 0 ? '-' : '';
  if (abs >= 1e9) return s + '$' + (abs / 1e9).toFixed(2) + 'MM';
  if (abs >= 1e6) return s + '$' + (abs / 1e6).toFixed(1) + 'M';
  return s + '$' + Math.round(abs / 1e3) + 'K';
};

const CONCEPTOS = [
  { key: 'cid51',  label: 'Nómina personal obra' },
  { key: 'cid52',  label: 'Servicios Públicos' },
  { key: 'cid53',  label: 'Gastos de Obra' },
  { key: 'cid54',  label: 'SST Obra' },
  { key: 'cid_int',label: 'Interventoría' },
];

/* ── SVG chart — replica exacta del legacy ───────────────────────────────── */
function ConsumimoSVG({ items }) {
  const W = 500, H = 155;
  const pad = { t: 20, b: 38, l: 6, r: 6 };
  const chartH = H - pad.t - pad.b;
  const chartW = W - pad.l - pad.r;
  const baseY  = pad.t + chartH;
  const n      = items.length;
  const step   = chartW / n;
  const barW   = Math.min(step * 0.70, 32);
  const maxAll = Math.max(...items.map(p => (p.cdd || 0) + (p.cid || 0)), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} overflow="visible" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      {/* Línea base */}
      <line x1={pad.l} y1={baseY} x2={W - pad.r} y2={baseY} stroke="#CFCFCF" strokeWidth={1} />


      {/* Leyenda — bottom right */}
      <rect x={W/2-90} y={baseY+35} width={6} height={6} fill={COLOR_CDD} fillOpacity={0.85} rx={1} stroke={STROKE_CDD} strokeWidth={0.8} />
      <text x={W/2-82} y={baseY+41} fontSize={5.5} fill="#555" fontWeight={700} fontFamily={FONT}>Costo Directo (CDD)</text>
      <rect x={W/2-7} y={baseY+35} width={6} height={6} fill={COLOR_CID} fillOpacity={0.85} rx={1} stroke={STROKE_CID} strokeWidth={0.8} />
      <text x={W/2+1} y={baseY+41} fontSize={5.5} fill="#555" fontWeight={700} fontFamily={FONT}>Costos Administrativos (CID)</text>

      {items.map((p, i) => {
        const cdd    = p.cdd || 0;
        const cid    = p.cid || 0;
        const total  = cdd + cid;
        const hTotal = (total / maxAll) * chartH;
        const hCDD   = (cdd   / maxAll) * chartH;
        const hCID   = (cid   / maxAll) * chartH;
        const bx     = pad.l + i * step + (step - barW) / 2;
        const cx     = bx + barW / 2;
        const pct    = cdd > 0 ? (cid / cdd * 100) : 0;
        const pctCol = pct < 6 ? '#2E7D32' : pct <= 9 ? '#F9A825' : '#C62828';

        return (
          <g key={i}>
            {/* CDD — segmento inferior */}
            {hCDD > 0 && (
              <rect x={bx} y={baseY - hCDD} width={barW} height={hCDD}
                fill={COLOR_CDD} fillOpacity={0.85} stroke={STROKE_CDD} strokeWidth={0.8} />
            )}
            {/* CID — segmento superior apilado */}
            {hCID >= 0.5 && (
              <rect x={bx} y={baseY - hTotal} width={barW} height={hCID}
                fill={COLOR_CID} fillOpacity={0.85} stroke={STROKE_CID} strokeWidth={0.8} />
            )}
            {/* Divisor blanco CDD/CID */}
            {hCID >= 1 && hCDD >= 1 && (
              <line x1={bx} y1={baseY - hCDD} x2={bx + barW} y2={baseY - hCDD}
                stroke="#fff" strokeWidth={1} />
            )}
            {/* CID encima de la barra total */}
            <text x={cx} y={baseY - hTotal - 5} textAnchor="middle" fontSize={5.8}
              fill="#7A6010" fontWeight={700} fontFamily={FONT}>
              {fmtV(cid)}
            </text>
            {/* CDD dentro del segmento CDD */}
            {hCDD > 8 && (
              <text x={cx} y={baseY - hCDD / 2 + 2.5} textAnchor="middle" fontSize={5.8}
                fill={STROKE_CDD} fontWeight={700} fontFamily={FONT}>
                {fmtV(cdd)}
              </text>
            )}
            {/* CID dentro del segmento CID (si hay espacio) */}
            {hCID > 11 && (
              <text x={cx} y={baseY - hTotal + hCID / 2 + 2.5} textAnchor="middle" fontSize={5.8}
                fill={STROKE_CID} fontFamily={FONT}>
                {fmtV(cid)}
              </text>
            )}
            {/* Etiqueta mes */}
            <text x={cx} y={baseY + 10} textAnchor="middle" fontSize={5.8}
              fill="#404040" fontFamily={FONT}>
              {p.label}
            </text>
            {/* % CID/CDD con semáforo */}
            {cdd > 0 && (
              <text x={cx} y={baseY + 25} textAnchor="middle" fontSize={5.5}
                fill={pctCol} fontWeight={700} fontFamily={FONT}>
                {pct.toFixed(1)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Modal detalle CID — replica del legacy ──────────────────────────────── */
function Modal({ macroLabel, detRows, onClose }) {
  const cols   = detRows || [];
  const totals = cols.map(c => CONCEPTOS.reduce((s, con) => s + (c[con.key] || 0), 0));

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: '22px 26px 18px', boxShadow: '0 8px 40px rgba(0,0,0,.25)', minWidth: 460, maxWidth: 640, position: 'relative' }}>
        <span onClick={onClose} style={{ position: 'absolute', top: 12, right: 14, cursor: 'pointer', fontSize: '1rem', color: '#999', fontFamily: FONT }}>✕</span>
        <h3 style={{ fontSize: '.78rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 12, color: '#1A1A1A' }}>
          Detalle Costos Administrativos · {macroLabel} · Últimos 4 Meses
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.68rem', fontFamily: FONT }}>
            <thead>
              <tr>
                <th style={{ background: '#EAF5EA', color: STROKE_CDD, fontWeight: 700, padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid #D0E8D0' }}>Concepto</th>
                {cols.map((c, i) => (
                  <th key={i} style={{ background: '#EAF5EA', color: STROKE_CDD, fontWeight: 700, padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #D0E8D0' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONCEPTOS.map(con => (
                <tr key={con.key}>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid #F0F0F0', textAlign: 'left', color: '#555' }}>{con.label}</td>
                  {cols.map((c, ci) => (
                    <td key={ci} style={{ padding: '5px 10px', borderBottom: '1px solid #F0F0F0', textAlign: 'right' }}>{fmtM(c[con.key] || 0)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ padding: '5px 10px', fontWeight: 800, borderTop: '2px solid #AACAAA', color: STROKE_CDD }}>TOTAL CID Administrativo</td>
                {totals.map((t, ci) => (
                  <td key={ci} style={{ padding: '5px 10px', fontWeight: 800, borderTop: '2px solid #AACAAA', textAlign: 'right' }}>{fmtM(t)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Panel principal ─────────────────────────────────────────────────────── */
export default function Panel2Consumido({ loading, controlRows, claseMap, capMap, corteConsumido, consumidoData, consumidoDetalle, macroKey, macro }) {
  const [showModal, setShowModal] = useState(false);

  const items = useMemo(() => {
    if (consumidoData && macroKey) {
      const raw = consumidoData[macroKey];
      if (!raw?.length) return null;
      return raw.slice(-N_SHOW);
    }
    if (!controlRows?.length || !claseMap || !capMap) return null;
    const porMes = {};
    for (const r of controlRows) {
      const clase = claseMap[r.skidclaseorigen];
      if (clase !== 'consumido') continue;
      const cap = capMap[r.skidcapitulo];
      if (!cap) continue;
      const fecha = String(r.skidfecha || '');
      const mes   = fecha.slice(0, 6);
      if (mes.length < 6) continue;
      if (!porMes[mes]) porMes[mes] = { cdd: 0, cid: 0 };
      const val = r['Valor Sin IVA'] ?? r['Valor Total'] ?? 0;
      if (cap.isCid) porMes[mes].cid += val;
      else           porMes[mes].cdd += val;
    }
    const ML = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return Object.keys(porMes).sort().slice(-N_SHOW).map(m => ({
      label: `${ML[parseInt(m.slice(4, 6))]} ${m.slice(2, 4)}`,
      cdd: porMes[m].cdd, cid: porMes[m].cid,
    }));
  }, [controlRows, claseMap, capMap, consumidoData, macroKey]);

  const detRows    = consumidoDetalle?.[macroKey] ?? null;
  const macroLabel = macro?.label || macroKey?.toUpperCase() || '';

  return (
    <div className="ov-panel p2">
      <div className="ov-side"><span className="ov-title">Consumido</span></div>
      <div className="ov-body">
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '.55rem', fontWeight: 700, color: '#6C0000', fontFamily: FONT, letterSpacing: '.07em' }}>
            CARGA ADMINISTRATIVA SOBRE COSTOS DIRECTO
          </span>
        </div>

        {loading && !items && (
          <div className="state-center" style={{ height: '100%' }}><div className="spinner" /><span>Cargando…</span></div>
        )}
        {!loading && !items && (
          <div className="state-center" style={{ height: '100%' }}><span>Selecciona un proyecto</span></div>
        )}

        {items && (
          <>
            {/* SVG chart — posición relativa igual que legacy (.ov-chart) */}
            <div className="ov-chart" style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'visible' }}>
              <ConsumimoSVG items={items} />
            </div>

            {/* Botón Ver detalle */}
            {detRows && (
              <div className="ov-footer">
                <button className="ov-btn ov-btn-primary" onClick={() => setShowModal(true)}>Ver detalle costos administrativos ›</button>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && detRows && (
        <Modal macroLabel={macroLabel} detRows={detRows} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
