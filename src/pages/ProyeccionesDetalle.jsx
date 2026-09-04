import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { remoteUrl } from '../assetBase.js';

const LABELS = {
  praia:'PRAIA NATURA','pra-e1':'PRAIA NATURA · E1','pra-e2':'PRAIA NATURA · E2','pra-zc':'PRAIA NATURA · ZC',
  oporto:'RESERVA DE OPORTO','opo-e12':'OPORTO · E1-2','opo-e3':'OPORTO · E3',
  primera:'PRIMERA ESTE','pri-e12':'PRIMERA ESTE · E1-2','pri-zc':'PRIMERA ESTE · ZC',
  hacienda:'LA HACIENDA','hac-e1':'LA HACIENDA · E1','hac-e3':'LA HACIENDA · E3','hac-ref':'LA HACIENDA · Ref',
  bosque:'BOSQUE CENTRAL','cast-l':'CASTILLA LIVING','cast-i':'CASTILLA IMPERIAL',
  'cai-zc':'CASTILLA IMP · ZC','cai-e2b':'CASTILLA IMP · E2B',
  mitika:'MÍTIKA','mit-11':'MÍTIKA · T11','mit-12':'MÍTIKA · T1-2',
  'azul-t':'AZUL TURQUESA','azt-e1':'AZUL TQ · E1','azt-e2':'AZUL TQ · E2',
  'azul-c':'AZUL CELESTE','azc-e1':'AZUL CE · E1','azc-e2':'AZUL CE · E2','azc-e3':'AZUL CE · E3',
  verde:'VERDE VIVO','ver-e1':'VERDE · E1','ver-e2':'VERDE · E2','ver-e3':'VERDE · E3',
  well:'WELL', gaia:'GAIA',
};

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const CAUSA_COLORS = {
  'Presupuesto':                        '#5A5A8A',
  'Diseño':                             '#3A7228',
  'C. Cantidades':                      '#A01010',
  'Imprevistos':                        '#B85520',
  'Gestión de obra ':                   '#7A1070',
  'Incrementos precio':                 '#8A6010',
  'Incrementos ':                       '#9A7020',
  'Descuentos ':                        '#1A6070',
  'Re Contratacion':                    '#4A3F8A',
  'No calidad de obra ':                '#C04040',
  'GCC Compras y contratos':            '#2A5A3A',
  'GUNC Cambio gerencial':              '#6A3A70',
  'Reformas inmobiliarias ':            '#6A1030',
  'Mayor duración en venta':            '#2A6030',
  'Provision':                          '#888888',
  'Preinversion':                       '#4A6A8A',
  'Proyectos IC':                       '#7A5A20',
  'Proyectos socios ':                  '#5A7A40',
  'AJUSTE POR EJERCER NEGATIVO EK ':    '#AAAAAA',
  'AJUSTE POR EJERCER NEGATIVO GENERICO EK': '#CCCCCC',
};
const CAUSA_COLOR_DEFAULT = '#999999';

// Categorías del donut
const CAT_DEFS = [
  { key: 'cdd',  label: 'CDD',              color: '#4A6A9A', match: item => item.tipo === 'cdd' },
  { key: 'nom',  label: 'Nómina',           color: '#3A7228', match: item => item.num === 'CID51' },
  { key: 'spu',  label: 'Servicios Púb.',   color: '#B85520', match: item => item.num === 'CID52' },
  { key: 'gob',  label: 'Gastos Obra',      color: '#7A1070', match: item => item.num === 'CID53' },
  { key: 'sst',  label: 'SST',              color: '#A01010', match: item => item.num === 'CID54' },
];

const fmtM = v => {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs/1e9).toFixed(1)}MM`;
  if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`;
};

const ymLabel = ym => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MESES_ES[parseInt(m,10)-1]} ${y}`;
};

// ── SVG donut helpers ─────────────────────────────────────────────────────────
function polarToCart(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutSegmentPath(cx, cy, r1, r2, a1, a2) {
  if (Math.abs(a2 - a1) < 0.01) return '';
  const large = (a2 - a1) > 180 ? 1 : 0;
  const [ox1, oy1] = polarToCart(cx, cy, r2, a1);
  const [ox2, oy2] = polarToCart(cx, cy, r2, a2);
  const [ix1, iy1] = polarToCart(cx, cy, r1, a2);
  const [ix2, iy2] = polarToCart(cx, cy, r1, a1);
  return `M ${ox1} ${oy1} A ${r2} ${r2} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${r1} ${r1} 0 ${large} 0 ${ix2} ${iy2} Z`;
}

// ── Donut multi-anillo ────────────────────────────────────────────────────────
function DonutMultiRing({ rings, catDefs, center, totalLabel }) {
  const [hovered, setHovered] = useState(null);
  const cx = 110, cy = 110, SIZE = 220;
  const R_CENTER = 38;
  const RING_W = 18, GAP = 4;

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', maxHeight: 180, flex: '1 1 auto', minHeight: 0 }}>
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}>
      {/* Centro */}
      <circle cx={cx} cy={cy} r={R_CENTER} fill="var(--c-surface,#fff)" stroke="#e0e0e0" strokeWidth={1} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={7} fill="#888" fontFamily="Century Gothic,sans-serif">Presupuesto</text>
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#333" fontFamily="Century Gothic,sans-serif">
        {totalLabel}
      </text>

      {/* Anillos */}
      {rings.map((ring, ri) => {
        const r1 = R_CENTER + GAP + ri * (RING_W + GAP);
        const r2 = r1 + RING_W;
        const total = catDefs.reduce((s, c) => s + (ring.vals[c.key] || 0), 0);
        let angle = 0;
        return (
          <g key={ring.label}>
            {catDefs.map(cat => {
              const val = ring.vals[cat.key] || 0;
              const sweep = total > 0 ? (val / total) * 358 : 0;
              const a1 = angle, a2 = angle + sweep;
              angle = a2;
              const mid = (a1 + a2) / 2;
              const isHov = hovered?.ring === ri && hovered?.cat === cat.key;
              return (
                <path
                  key={cat.key}
                  d={donutSegmentPath(cx, cy, r1 + (isHov ? -1 : 0), r2 + (isHov ? 2 : 0), a1, a2)}
                  fill={cat.color}
                  fillOpacity={isHov ? 1 : 0.82}
                  stroke="var(--c-surface,#fff)"
                  strokeWidth={1}
                  style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={() => setHovered({ ring: ri, cat: cat.key, val, label: cat.label, ringLabel: ring.label, mid })}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            {/* Etiqueta del anillo (año) */}
            <text
              x={cx + (r2 + 3) * Math.cos((-90) * Math.PI / 180)}
              y={cy + (r2 + 3) * Math.sin((-90) * Math.PI / 180) - 2}
              textAnchor="middle" fontSize={6} fill="#888"
              fontFamily="Century Gothic,sans-serif">
              {ring.label}
            </text>
          </g>
        );
      })}

      {/* Tooltip */}
      {hovered && (() => {
        const [tx, ty] = polarToCart(cx, cy, R_CENTER + GAP + hovered.ring * (RING_W + GAP) + RING_W / 2, hovered.mid);
        const bx = Math.min(Math.max(tx - 30, 2), SIZE - 62);
        const by = ty < cy ? ty + 6 : ty - 26;
        return (
          <g>
            <rect x={bx} y={by} width={60} height={22} rx={3} fill="#222" fillOpacity={0.88} />
            <text x={bx + 30} y={by + 9} textAnchor="middle" fontSize={6} fill="#fff" fontFamily="Century Gothic,sans-serif">
              {hovered.ringLabel} · {hovered.label}
            </text>
            <text x={bx + 30} y={by + 18} textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff" fontFamily="Century Gothic,sans-serif">
              {fmtM(hovered.val)}
            </text>
          </g>
        );
      })()}
    </svg>
    </div>
  );
}

// ── Barras horizontales por causa ─────────────────────────────────────────────
function CausaBars({ causaAcum, causas }) {
  const sorted = [...causas]
    .map(c => ({ causa: c, val: causaAcum[c] || 0 }))
    .filter(x => x.val !== 0)
    .sort((a, b) => b.val - a.val);

  const maxAbs = Math.max(...sorted.map(x => Math.abs(x.val)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '4px 8px', overflowY: 'auto', flex: 1 }}>
      {sorted.map(({ causa, val }) => {
        const pct = Math.abs(val) / maxAbs * 100;
        const color = CAUSA_COLORS[causa] || CAUSA_COLOR_DEFAULT;
        const isPos = val >= 0;
        return (
          <div key={causa} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 18 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: '0.62rem', color: '#555', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, width: 80 }}
              title={causa}>{causa.trim()}</div>
            <div style={{ flex: 2, position: 'relative', height: 10, background: '#f0f0f0', borderRadius: 3 }}>
              <div style={{
                position: 'absolute', top: 0, height: '100%', borderRadius: 3,
                width: `${pct}%`,
                background: isPos ? color : '#3A7228',
                opacity: 0.8,
              }} />
            </div>
            <div style={{ width: 52, textAlign: 'right', fontSize: '0.62rem', fontWeight: 600,
              color: isPos ? '#A01010' : '#3A7228', flexShrink: 0 }}>
              {fmtM(val)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tabla detalle folios ──────────────────────────────────────────────────────
function TablaFolios({ folios, sortBy, onSortBy }) {
  const sorted = useMemo(() => {
    if (!folios) return [];
    const arr = [...folios];
    if (sortBy === 'valor')    arr.sort((a,b) => Math.abs(b.valor) - Math.abs(a.valor));
    if (sortBy === 'causa')    arr.sort((a,b) => (a.causa||'').localeCompare(b.causa||''));
    if (sortBy === 'capitulo') arr.sort((a,b) => (a.capitulo||'').localeCompare(b.capitulo||''));
    return arr;
  }, [folios, sortBy]);

  const cols = [
    { key:'folio',    label:'Folio',    w:'70px' },
    { key:'causa',    label:'Causa',    w:'110px' },
    { key:'capitulo', label:'Capítulo', w:'110px' },
    { key:'valor',    label:'Valor',    w:'90px'  },
    { key:'comentario', label:'Comentario', w:'auto' },
  ];

  return (
    <div style={{overflowX:'auto', fontSize:'0.7rem'}}>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr style={{background:'var(--c-surface-alt,#f4f4f4)'}}>
            {cols.map(c => (
              <th key={c.key}
                style={{padding:'4px 6px', textAlign: c.key==='valor'?'right':'left',
                  width:c.w, cursor: c.key!=='comentario'?'pointer':'default',
                  userSelect:'none', fontWeight:600, color: sortBy===c.key?'#5A5A8A':'#444',
                  whiteSpace:'nowrap', borderBottom:'1px solid #ddd'}}
                onClick={() => c.key!=='comentario' && onSortBy(c.key)}>
                {c.label}{sortBy===c.key ? ' ↓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((f, i) => (
            <tr key={i} style={{background: i%2===0?'transparent':'var(--c-surface-alt,#f9f9f9)'}}>
              <td style={{padding:'3px 6px', color:'#5A5A8A', fontWeight:600}}>{f.folio ?? '—'}</td>
              <td style={{padding:'3px 6px'}}>{f.causa}</td>
              <td style={{padding:'3px 6px', fontFamily:'monospace', fontSize:'0.65rem'}}>{f.capitulo}</td>
              <td style={{padding:'3px 6px', textAlign:'right', fontWeight:600,
                color: f.valor < 0 ? '#3A7228' : '#A01010'}}>
                {fmtM(f.valor)}
              </td>
              <td style={{padding:'3px 6px', color:'#555', maxWidth:'300px',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
                title={f.comentario}>
                {f.comentario}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={5} style={{padding:'12px', textAlign:'center', color:'#999'}}>
              Sin datos
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProyeccionesDetalle() {
  const { macroKey } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [anioP1, setAnioP1] = useState(null);
  const [selectedP1, setSelectedP1] = useState(null);
  const [selectedP2, setSelectedP2] = useState(null);
  const [sortP3, setSortP3] = useState('valor');
  const [sortP4, setSortP4] = useState('valor');

  useEffect(() => {
    Promise.all([
      fetch(remoteUrl('/data/proyecciones_data.json')).then(r => r.json()),
      fetch(remoteUrl('/data/estado_detalle_data.json')).then(r => r.json()),
    ]).then(([proy, det]) => {
      setData(proy);
      setDetalle(det?.data || {});
      setLoading(false);
      const proj = proy?.proyectos?.[macroKey];
      if (proj) {
        const years = [...new Set(Object.keys(proj.meses).map(ym => ym.slice(0,4)))].sort();
        if (years.length) setAnioP1(years[years.length-1]);
      }
    }).catch(() => setLoading(false));
  }, [macroKey]);

  const proyData = data?.proyectos?.[macroKey];

  // ── Causas y colores ────────────────────────────────────────────────────────
  const causaColors = useMemo(() => {
    if (!data?.causas) return {};
    const map = {};
    data.causas.forEach(c => { map[c] = { color: CAUSA_COLORS[c] || CAUSA_COLOR_DEFAULT, data: {} }; });
    return map;
  }, [data]);

  // ── Datos donut desde estado_detalle ───────────────────────────────────────
  const detalleItems = useMemo(() => {
    if (!detalle || !macroKey) return [];
    return detalle[macroKey]?.items || [];
  }, [detalle, macroKey]);

  const pptoCats = useMemo(() => {
    if (!detalleItems.length) return null;
    const vals = {};
    CAT_DEFS.forEach(cat => {
      vals[cat.key] = detalleItems.filter(cat.match).reduce((s, it) => s + (it.ppto || 0), 0);
    });
    return vals;
  }, [detalleItems]);

  const pptoTotal = useMemo(() => {
    if (!pptoCats) return 0;
    return Object.values(pptoCats).reduce((s, v) => s + v, 0);
  }, [pptoCats]);

  // ── Anillos donut (base + un anillo por año) ────────────────────────────────
  const donutRings = useMemo(() => {
    if (!pptoCats || !proyData) return [];
    const rings = [{ label: 'Base', vals: pptoCats }];

    // Acumular variación por año y sumar al base proporcional
    const years = [...new Set(Object.keys(proyData.meses).map(ym => ym.slice(0,4)))].sort();
    let acumTotal = 0;
    years.forEach(year => {
      // Suma variación total del año
      const varYear = Object.entries(proyData.meses)
        .filter(([ym]) => ym.startsWith(year))
        .reduce((s, [, md]) => s + Object.values(md.causas || {}).reduce((a, v) => a + v, 0), 0);
      acumTotal += varYear;

      // Aplicar variación proporcional sobre el base
      const factor = pptoTotal > 0 ? (pptoTotal + acumTotal) / pptoTotal : 1;
      const vals = {};
      CAT_DEFS.forEach(cat => { vals[cat.key] = (pptoCats[cat.key] || 0) * factor; });
      rings.push({ label: year, vals });
    });
    return rings;
  }, [pptoCats, proyData, pptoTotal]);

  // ── P1: causas acumuladas (todas) ───────────────────────────────────────────
  const causaAcumTotal = useMemo(() => {
    if (!proyData) return {};
    const acum = {};
    Object.values(proyData.meses).forEach(md => {
      Object.entries(md.causas || {}).forEach(([c, v]) => {
        acum[c] = (acum[c] || 0) + v;
      });
    });
    return acum;
  }, [proyData]);

  // ── P1/P2: meses del año seleccionado ──────────────────────────────────────
  const { p1Meses, p1CausaColors, p1Max } = useMemo(() => {
    if (!proyData || !anioP1) return { p1Meses:[], p1CausaColors:{}, p1Max:0 };
    const meses = Object.keys(proyData.meses).filter(ym => ym.startsWith(anioP1)).sort();
    const cc = {};
    Object.keys(causaColors).forEach(c => { cc[c] = { ...causaColors[c], data: {} }; });
    const acum = {};
    meses.forEach(ym => {
      Object.entries(proyData.meses[ym]?.causas || {}).forEach(([c, v]) => {
        acum[c] = (acum[c] || 0) + v;
        if (cc[c]) cc[c].data[ym] = acum[c];
      });
    });
    const max = Math.max(0, ...meses.map(ym =>
      Object.values(cc).reduce((s, cd) => s + Math.max(0, cd.data[ym]||0), 0)
    ));
    return { p1Meses: meses, p1CausaColors: cc, p1Max: max };
  }, [proyData, anioP1, causaColors]);

  const { p2Meses, p2CausaColors, p2Max } = useMemo(() => {
    if (!proyData || !anioP1) return { p2Meses:[], p2CausaColors:{}, p2Max:0 };
    const meses = Object.keys(proyData.meses).filter(ym => ym.startsWith(anioP1)).sort();
    const cc = {};
    Object.keys(causaColors).forEach(c => { cc[c] = { ...causaColors[c], data: {} }; });
    meses.forEach(ym => {
      Object.entries(proyData.meses[ym]?.causas || {}).forEach(([c, v]) => {
        if (cc[c]) cc[c].data[ym] = (cc[c].data[ym] || 0) + v;
      });
    });
    const max = Math.max(0, ...meses.map(ym =>
      Object.values(cc).reduce((s, cd) => s + Math.max(0, cd.data[ym]||0), 0)
    ));
    return { p2Meses: meses, p2CausaColors: cc, p2Max: max };
  }, [proyData, anioP1, causaColors]);

  const anos = useMemo(() => {
    if (!proyData) return [];
    return [...new Set(Object.keys(proyData.meses).map(ym => ym.slice(0,4)))].sort();
  }, [proyData]);

  const foliosP3 = useMemo(() => {
    if (!proyData || !selectedP1) return [];
    const all = {};
    Object.entries(proyData.meses)
      .filter(([ym]) => ym <= selectedP1 && ym.startsWith(anioP1))
      .forEach(([, md]) => {
        md.folios.forEach(f => {
          const k = String(f.folio);
          if (!all[k]) all[k] = { ...f };
          else all[k].valor += f.valor;
        });
      });
    return Object.values(all);
  }, [proyData, selectedP1, anioP1]);

  const foliosP4 = useMemo(() => {
    if (!proyData || !selectedP2) return [];
    return proyData.meses[selectedP2]?.folios || [];
  }, [proyData, selectedP2]);

  const titulo = LABELS[macroKey] || macroKey?.toUpperCase();
  const causasActivas = useMemo(() => (data?.causas || []).filter(c =>
    p1Meses.some(ym => (proyData?.meses[ym]?.causas?.[c] || 0) !== 0)
  ), [data, p1Meses, proyData]);

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
      <div className="spinner" /><span style={{marginLeft:8}}>Cargando proyecciones…</span>
    </div>
  );

  if (!proyData) return (
    <div className="det-page">
      <div className="det-header">
        <button className="det-back" onClick={() => navigate(-1)}>← Volver</button>
        <div className="det-title">PROYECCIONES<span className="det-title-sep">/</span><span className="det-title-proj">{titulo}</span></div>
        <div className="det-hdr-spacer" />
        <img className="det-hdr-ic" src="/images/IC_logo.png" alt="IC" />
      </div>
      <p style={{padding:'24px 16px',color:'#666'}}>Sin datos de proyecciones para {titulo}.</p>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--c-bg,#f8f8f8)'}}>

      {/* ── Header ── */}
      <div className="det-header">
        <button className="det-back" onClick={() => navigate(-1)}>← Volver</button>
        <div>
          <div className="det-title">
            PROYECCIONES
            <span className="det-title-sep">/</span>
            <span className="det-title-proj">{titulo}</span>
          </div>
        </div>
        <div className="det-hdr-spacer" />
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:'0.75rem',color:'#888'}}>Año:</span>
          {anos.map(a => (
            <button key={a}
              style={{padding:'2px 8px',border:'1px solid #ccc',borderRadius:4,cursor:'pointer',
                fontSize:'0.75rem',fontWeight: a===anioP1?700:400,
                background: a===anioP1?'#5A5A8A':'transparent',
                color: a===anioP1?'#fff':'#555'}}
              onClick={() => { setAnioP1(a); setSelectedP1(null); setSelectedP2(null); }}>
              {a}
            </button>
          ))}
        </div>
        <img className="det-hdr-ic" src="/images/IC_logo.png" alt="IC" />
      </div>

      {/* ── Paneles 2x2 ── */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',
        gridTemplateRows:'1fr 1fr',gap:8,padding:8,minHeight:0}}>

        {/* P1 — Donut + Causas acumuladas */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',flexShrink:0,
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P1 · Proyecciones</span>
            <span style={{fontSize:'0.65rem',color:'#888'}}>
              Base {fmtM(pptoTotal)} · {donutRings.length - 1} años
            </span>
          </div>
          <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}}>

            {/* Izquierda: Donut */}
            <div style={{flex:'0 0 52%',padding:'4px',display:'flex',flexDirection:'column',minHeight:0,minWidth:0}}>
              {donutRings.length > 0 ? (
                <>
                  <DonutMultiRing
                    rings={donutRings}
                    catDefs={CAT_DEFS}
                    totalLabel={fmtM(pptoTotal)}
                  />
                  {/* Leyenda categorías */}
                  <div style={{display:'flex',flexWrap:'wrap',gap:'2px 8px',padding:'0 4px 4px',flexShrink:0}}>
                    {CAT_DEFS.map(c => (
                      <span key={c.key} style={{display:'flex',alignItems:'center',gap:3,fontSize:'0.58rem',color:'#555'}}>
                        <span style={{width:8,height:8,borderRadius:2,background:c.color,display:'inline-block'}}/>
                        {c.label}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#999',fontSize:'0.75rem'}}>
                  Sin datos base
                </div>
              )}
            </div>

            {/* Derecha: Barras por causa acumulada (todos los años) */}
            <div style={{flex:1,display:'flex',flexDirection:'column',borderLeft:'1px solid #f0f0f0',minHeight:0}}>
              <div style={{padding:'4px 8px',fontSize:'0.65rem',fontWeight:600,color:'#666',flexShrink:0}}>
                Variación acumulada por causa
              </div>
              <CausaBars causaAcum={causaAcumTotal} causas={data?.causas || []} />
            </div>
          </div>
        </div>

        {/* P2 — Variación Mensual */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',display:'flex',
            alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P2 Variación Mensual</span>
            {selectedP2 && (
              <span style={{fontSize:'0.7rem',color:'#3A7228',fontWeight:600}}>
                {ymLabel(selectedP2)}
              </span>
            )}
          </div>
          <div style={{flex:1,padding:'6px 8px',minHeight:0,overflowX:'auto'}}>
            {p2Meses.length === 0
              ? <span style={{color:'#999',fontSize:'0.75rem'}}>Sin datos en {anioP1}</span>
              : <BarChart meses={p2Meses} causas={causasActivas}
                  causaColors={p2CausaColors} maxVal={p2Max}
                  onSelect={ym => setSelectedP2(ym === selectedP2 ? null : ym)}
                  selected={selectedP2} />
            }
          </div>
          {selectedP2 && (
            <div style={{padding:'4px 12px',borderTop:'1px solid #eee',
              fontSize:'0.72rem',color:'#555',flexShrink:0}}>
              Total mes: <strong style={{color:'#3A7228'}}>{fmtM(foliosP4.reduce((s,f)=>s+f.valor,0))}</strong>
            </div>
          )}
        </div>

        {/* P3 — Detalle Variación Acumulada */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',display:'flex',
            alignItems:'center',gap:8,flexShrink:0}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P3 Detalle Acumulado</span>
            <span style={{fontSize:'0.65rem',color:'#999'}}>Ordenar:</span>
            {['valor','causa','capitulo'].map(s => (
              <button key={s}
                style={{padding:'1px 6px',border:'1px solid #ccc',borderRadius:3,cursor:'pointer',
                  fontSize:'0.65rem',background:sortP3===s?'#5A5A8A':'transparent',
                  color:sortP3===s?'#fff':'#555'}}
                onClick={() => setSortP3(s)}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',minHeight:0}}>
            {!selectedP1
              ? <div style={{padding:16,color:'#999',fontSize:'0.75rem',textAlign:'center'}}>
                  Selecciona un mes en P2
                </div>
              : <TablaFolios folios={foliosP3} sortBy={sortP3} onSortBy={setSortP3} />
            }
          </div>
        </div>

        {/* P4 — Detalle Variación Mensual */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',display:'flex',
            alignItems:'center',gap:8,flexShrink:0}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P4 Detalle Mensual</span>
            <span style={{fontSize:'0.65rem',color:'#999'}}>Ordenar:</span>
            {['valor','causa','capitulo'].map(s => (
              <button key={s}
                style={{padding:'1px 6px',border:'1px solid #ccc',borderRadius:3,cursor:'pointer',
                  fontSize:'0.65rem',background:sortP4===s?'#3A7228':'transparent',
                  color:sortP4===s?'#fff':'#555'}}
                onClick={() => setSortP4(s)}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',minHeight:0}}>
            {!selectedP2
              ? <div style={{padding:16,color:'#999',fontSize:'0.75rem',textAlign:'center'}}>
                  Selecciona un mes en P2
                </div>
              : <TablaFolios folios={foliosP4} sortBy={sortP4} onSortBy={setSortP4} />
            }
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Barra SVG mensual (P2) ────────────────────────────────────────────────────
function BarChart({ meses, causas, causaColors, maxVal, onSelect, selected }) {
  const W = 36, GAP = 3, H = 100, PAD_B = 18;
  const total = meses.length;
  const svgW = total * (W + GAP) + GAP;

  return (
    <svg viewBox={`0 0 ${svgW} ${H + PAD_B}`} style={{width:'100%',height:'100%',display:'block'}}>
      {meses.map((ym, i) => {
        const x = GAP + i * (W + GAP);
        const isSelected = ym === selected;
        let yOff = H;
        return (
          <g key={ym} style={{cursor:'pointer'}} onClick={() => onSelect(ym)}>
            {isSelected && (
              <rect x={x-1} y={0} width={W+2} height={H}
                fill="none" stroke="#333" strokeWidth={1.5} rx={2} />
            )}
            {causas.map(causa => {
              const val = Math.max(0, causaColors[causa]?.data?.[ym] || 0);
              const h = maxVal > 0 ? (val / maxVal) * H : 0;
              yOff -= h;
              return (
                <rect key={causa} x={x} y={yOff} width={W} height={h}
                  fill={causaColors[causa]?.color || '#888'}
                  fillOpacity={isSelected ? 1 : 0.75} />
              );
            })}
            <text x={x + W/2} y={H + PAD_B - 2} textAnchor="middle"
              fontSize={7} fill={isSelected ? '#111' : '#666'} fontWeight={isSelected ? 700 : 400}
              fontFamily="Century Gothic,Nunito,sans-serif">
              {ymLabel(ym).slice(0,3)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
