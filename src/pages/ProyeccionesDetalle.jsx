// v-ok
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
  'Gestión de obra':                    '#7A1070',
  'Incrementos':                        '#8A6010',
  'Descuentos':                         '#1A6070',
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

// Normaliza variantes de causa al nombre canónico
const normCausa = c => {
  if (!c) return 'Otra';
  const t = c.trim();
  if (/^incrementos/i.test(t)) return 'Incrementos';
  return t;
};

const CDD_LABEL = {
  gg:'Gastos Generales', ce:'Cimentación', it:'Inst. Técnicas',
  oga:'Obra Gris y Acabados', zv:'Zonas Verdes y Vías',
  nom:'Nómina Adm.', spu:'Servicios Públicos', gob:'Gastos de Obra',
  sst:'Seg. Industrial', imp:'Imprevistos', dsc:'Descuentos',
};


// Categorías del donut — CDD en verdes, CID en naranjas
// Arco visual: CDD=72% (259°), CID=28% (101°), gap=2° entre grupos y 1° entre items
const CAT_DEFS = [
  // Verdes — CDD (oscuro → claro)
  { key:'gg',  label:'Gastos Generales',      color:'#0A3D1A', tipo:'cdd' },
  { key:'ce',  label:'Cimentación',           color:'#1B6B30', tipo:'cdd' },
  { key:'it',  label:'Inst. Técnicas',        color:'#2E9E50', tipo:'cdd' },
  { key:'oga', label:'Obra Gris y Acabados',  color:'#52C76A', tipo:'cdd' },
  { key:'zv',  label:'Zonas Verdes y Vías',   color:'#96E0A0', tipo:'cdd' },
  // Naranjas — CID (oscuro → claro)
  { key:'nom', label:'Nómina Adm.',           color:'#BF360C', tipo:'cid' },
  { key:'spu', label:'Servicios Públicos',    color:'#E64A19', tipo:'cid' },
  { key:'gob', label:'Gastos de Obra',        color:'#FF7043', tipo:'cid' },
  { key:'sst', label:'Seg. Industrial',       color:'#FF8A65', tipo:'cid' },
  // Azul — IMP
  { key:'imp', label:'Imprevistos',           color:'#7B1041', tipo:'imp' },
  // Morado — DSC
  { key:'dsc', label:'Descuentos',            color:'#6A1B9A', tipo:'dsc' },
];
// Grados asignados a cada tipo (visual, independiente del valor real)
// 70% verdes CDD / 8% azules IMP / 20% naranjas CID / 2% morado DSC — gaps 3° x3
const TIPO_DEGS = { cdd: 246, imp: 28, cid: 70, dsc: 7 };

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

// ── Calcular ángulos de arco con espacio fijo por tipo ────────────────────────
// CDD ocupa TIPO_DEGS.cdd°, CID ocupa TIPO_DEGS.cid°, separados por gaps
function calcAngles(catDefs, vals) {
  const ITEM_GAP = 0.8;
  const TYPE_GAP = 3;
  const angles = {};
  const tipos = ['cdd', 'imp', 'cid', 'dsc'];

  function allocate(cats, budget) {
    if (!cats.length) return [];
    const total = cats.reduce((s, c) => s + Math.abs(vals[c.key] || 0), 0);
    const MIN_DEG = Math.min(5, budget / cats.length * 0.4);
    const n = cats.length;
    const reserved = n * MIN_DEG;
    const flexible = Math.max(budget - reserved, 0);
    return cats.map(cat => {
      const frac = total > 0 ? Math.abs(vals[cat.key] || 0) / total : 1 / n;
      return MIN_DEG + frac * flexible;
    });
  }

  let angle = 0;
  tipos.forEach((tipo, ti) => {
    const cats = catDefs.filter(c => c.tipo === tipo);
    if (!cats.length) return;
    const budget = TIPO_DEGS[tipo] - Math.max(cats.length - 1, 0) * ITEM_GAP;
    const sweeps = allocate(cats, budget);
    cats.forEach((cat, i) => {
      const sweep = sweeps[i];
      angles[cat.key] = { a1: angle, a2: angle + sweep, mid: angle + sweep / 2, sweep };
      angle += sweep + ITEM_GAP;
    });
    if (ti < tipos.length - 1) angle += TYPE_GAP;
  });
  return angles;
}

// ── Donut multi-anillo ────────────────────────────────────────────────────────
function DonutMultiRing({ rings, catDefs, totalLabel, deltaLabels }) {
  const [hovered, setHovered] = useState(null);
  const SIZE = 260;
  const cx = SIZE / 2, cy = SIZE / 2;
  const R_CENTER = 34;
  const RING_W = 14, GAP = 2;
  const R_OUTER = R_CENTER + GAP + rings.length * (RING_W + GAP);

  const baseAngles = rings[0] ? calcAngles(catDefs, rings[0].vals) : {};

  return (
    <div style={{ width: '100%', maxWidth: 360, margin: '0 auto', flex: '1 1 auto', minHeight: 0 }}>
    <div style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}>

      {/* Centro */}
      <circle cx={cx} cy={cy} r={R_CENTER} fill="var(--c-surface,#fff)" stroke="#ddd" strokeWidth={0.8} />
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize={6.5} fill="#aaa" fontFamily="Century Gothic,sans-serif">Ppto Base</text>
      <text x={cx} y={cy + 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="#222" fontFamily="Century Gothic,sans-serif">
        {totalLabel}
      </text>

      {/* Anillos */}
      {rings.map((ring, ri) => {
        const r1 = R_CENTER + GAP + ri * (RING_W + GAP);
        const r2 = r1 + RING_W;
        const angles = calcAngles(catDefs, ring.vals);
        return (
          <g key={ring.label}>
            {catDefs.map(cat => {
              const { a1, a2, mid } = angles[cat.key] || {};
              if (a2 === undefined || a2 - a1 < 0.3) return null;
              const val = ring.vals[cat.key] || 0;
              const isHov = hovered?.ring === ri && hovered?.cat === cat.key;
              return (
                <path
                  key={cat.key}
                  d={donutSegmentPath(cx, cy, r1 + (isHov ? -2 : 0), r2 + (isHov ? 2.5 : 0), a1, a2)}
                  fill={ri === 0 ? '#fff' : cat.color}
                  fillOpacity={ri === 0 ? 1 : (isHov ? 1 : 0.78 + ri * 0.04)}
                  stroke={ri === 0 ? cat.color : 'var(--c-surface,#fff)'}
                  strokeWidth={ri === 0 ? 1.5 : 0.7}
                  style={{ cursor: 'pointer', transition: 'all 0.12s' }}
                  onMouseEnter={() => setHovered({ ring: ri, cat: cat.key, val, label: cat.label, ringLabel: ring.label, mid })}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            {/* Año dentro del anillo — sobre segmento Cimentación (ce) */}
            {ri > 0 && (() => {
              const ceSeg = angles['ce'];
              if (!ceSeg || ceSeg.a2 - ceSeg.a1 < 1) return null;
              const r_mid = R_CENTER + GAP + ri * (RING_W + GAP) + RING_W / 2;
              const [lx, ly] = polarToCart(cx, cy, r_mid, ceSeg.a1 + 2);
              return (
                <text x={lx} y={ly} textAnchor="start" dominantBaseline="middle"
                  fontSize={6} fontWeight={700} fill="#fff"
                  fontFamily="Century Gothic,sans-serif"
                  transform={`rotate(${ceSeg.a1}, ${lx}, ${ly})`}>
                  {ring.label}
                </text>
              );
            })()}
          </g>
        );
      })}


      {/* Tooltip */}
      {hovered && (() => {
        const r_mid = R_CENTER + GAP + hovered.ring * (RING_W + GAP) + RING_W / 2;
        const [tx, ty] = polarToCart(cx, cy, r_mid, hovered.mid);
        const bx = Math.min(Math.max(tx - 30, 1), SIZE - 62);
        const by = ty < cy ? ty + 4 : ty - 24;
        return (
          <g>
            <rect x={bx} y={by} width={60} height={22} rx={3} fill="#111" fillOpacity={0.88} />
            <text x={bx+30} y={by+9} textAnchor="middle" fontSize={5.5} fill="#fff" fontFamily="Century Gothic,sans-serif">
              {hovered.ringLabel} · {hovered.label}
            </text>
            <text x={bx+30} y={by+18} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff" fontFamily="Century Gothic,sans-serif">
              {fmtM(hovered.val)}
            </text>
          </g>
        );
      })()}
    </svg>
    </div>
    </div>
  );
}

// ── Barras horizontales por causa ─────────────────────────────────────────────
const COLOR_POS = '#2D4170';
const COLOR_NEG = '#7A92C0';

function CausaBars({ causaAcum, causas, selectedCausa, onSelectCausa }) {
  const sorted = [...causas]
    .map(c => ({ causa: c, val: causaAcum[c] || 0 }))
    .filter(x => x.val !== 0)
    .sort((a, b) => b.val - a.val);

  const maxAbs = Math.max(...sorted.map(x => Math.abs(x.val)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '2px 8px 4px', overflow: 'hidden', flex: 1, justifyContent: 'space-between' }}>
      {sorted.map(({ causa, val }) => {
        const pct = Math.abs(val) / maxAbs * 100;
        const isPos = val >= 0;
        const color = isPos ? COLOR_POS : COLOR_NEG;
        const isSelected = causa === selectedCausa;
        return (
          <div key={causa}
            onClick={() => onSelectCausa(isSelected ? null : causa)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              borderRadius: 3, padding: '1px 2px',
              background: isSelected ? '#EEF2FF' : 'transparent' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: '0.62rem', color: isSelected ? '#1a237e' : '#555',
              fontWeight: isSelected ? 700 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, width: 80 }}
              title={causa}>{causa.trim()}</div>
            <div style={{ flex: 2, position: 'relative', height: 10, background: '#f0f0f0', borderRadius: 3 }}>
              <div style={{
                position: 'absolute', top: 0, height: '100%', borderRadius: 3,
                width: `${pct}%`, background: color, opacity: 0.85,
              }} />
            </div>
            <div style={{ width: 52, textAlign: 'right', fontSize: '0.62rem', fontWeight: 600,
              color, flexShrink: 0 }}>
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
  const [selectedCausa, setSelectedCausa] = useState(null);
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
    data.causas.forEach(c => {
      const nc = normCausa(c);
      map[nc] = { color: CAUSA_COLORS[nc] || CAUSA_COLOR_DEFAULT, data: {} };
    });
    return map;
  }, [data]);

  // ── Datos donut desde totales de estado_detalle (calculados por API) ─────────
  const detalleItems = useMemo(() => {
    if (!detalle || !macroKey) return [];
    return detalle[macroKey]?.items || [];
  }, [detalle, macroKey]);

  const pptoCats = useMemo(() => {
    const tot = detalle?.[macroKey]?.totales;
    if (!tot) return null;
    // Sumar ítems por grupo para obtener proporciones
    const raw = {};
    CAT_DEFS.forEach(c => { raw[c.key] = 0; });
    // Mapeo CDD# → grupo para el donut de presupuesto (estado_detalle)
    const CDDtoGrp = {
      CDD01:'gg',CDD02:'gg',CDD03:'gg',CDD37:'gg',CDD38:'gg',CDD39:'gg',CDD40:'gg',
      CDD04:'ce',CDD05:'ce',CDD06:'ce',CDD07:'ce',CDD08:'ce',CDD45:'ce',
      CDD09:'it',CDD10:'it',CDD11:'it',CDD12:'it',CDD13:'it',CDD14:'it',CDD43:'it',
      CDD15:'oga',CDD16:'oga',CDD17:'oga',CDD18:'oga',CDD19:'oga',CDD20:'oga',CDD21:'oga',
      CDD22:'oga',CDD23:'oga',CDD24:'oga',CDD26:'oga',CDD27:'oga',CDD28:'oga',CDD29:'oga',CDD30:'oga',
      CDD31:'zv',CDD32:'zv',CDD33:'zv',CDD34:'zv',
      CDD35:'imp',CDD36:'imp',CDD42:'imp',CDD44:'imp',
      CDD99:'dsc',
    };
    detalleItems.forEach(it => {
      const grp = CDDtoGrp[it.num];
      if (grp && raw[grp] !== undefined) raw[grp] += it.ppto || 0;
    });
    // Escalar CDD al total real de la API
    const cddRaw = CAT_DEFS.filter(c => c.tipo === 'cdd').reduce((s,c) => s + raw[c.key], 0);
    const cddReal = tot.cdd?.ppto || 0;
    const cddFactor = cddRaw > 0 ? cddReal / cddRaw : 1;
    // Escalar CID al total real de la API
    const cidRaw = CAT_DEFS.filter(c => c.tipo === 'cid').reduce((s,c) => s + raw[c.key], 0);
    const cidReal = tot.cid?.ppto || 0;
    const cidFactor = cidRaw > 0 ? cidReal / cidRaw : 1;
    const vals = {};
    CAT_DEFS.forEach(c => {
      const factor = c.tipo === 'cdd' ? cddFactor : cidFactor;
      vals[c.key] = raw[c.key] * factor;
    });
    // Fallback si no hay ítems: distribuir uniformemente
    if (cddRaw === 0 && cddReal > 0) {
      const cddCats = CAT_DEFS.filter(c => c.tipo === 'cdd');
      cddCats.forEach(c => { vals[c.key] = cddReal / cddCats.length; });
    }
    if (cidRaw === 0 && cidReal > 0) {
      const cidCats = CAT_DEFS.filter(c => c.tipo === 'cid');
      cidCats.forEach(c => { vals[c.key] = cidReal / cidCats.length; });
    }
    return vals;
  }, [detalleItems, detalle, macroKey]);

  const pptoTotal = useMemo(() => {
    const tot = detalle?.[macroKey]?.totales;
    if (tot) return (tot.cdd?.ppto || 0) + (tot.cid?.ppto || 0);
    if (!pptoCats) return 0;
    return Object.values(pptoCats).reduce((s, v) => s + v, 0);
  }, [pptoCats, detalle, macroKey]);

  // ── P1: causas acumuladas (todas) — debe ir antes de proyTotal/donutRings ───
  const causaAcumTotal = useMemo(() => {
    if (!proyData) return {};
    const acum = {};
    Object.values(proyData.meses).forEach(md => {
      Object.entries(md.causas || {}).forEach(([c, v]) => {
        const nc = normCausa(c);
        acum[nc] = (acum[nc] || 0) + v;
      });
    });
    return acum;
  }, [proyData]);

  const totalVariacion = useMemo(() =>
    Object.values(causaAcumTotal).reduce((s, v) => s + v, 0)
  , [causaAcumTotal]);


  const numMesesEjecucion = useMemo(() =>
    proyData ? Object.keys(proyData.meses).length : 0
  , [proyData]);

  const fechaInicioProyeccion = useMemo(() => {
    if (!proyData) return null;
    const primero = Object.keys(proyData.meses).sort()[0];
    return primero ? ymLabel(primero) : null;
  }, [proyData]);

  const proyTotal = useMemo(() =>
    pptoTotal + Object.values(causaAcumTotal).reduce((s, v) => s + v, 0)
  , [pptoTotal, causaAcumTotal]);

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
      rings.push({ label: year, vals, delta: varYear });
    });
    return rings;
  }, [pptoCats, proyData, pptoTotal]);

  const deltaLabels = useMemo(() =>
    donutRings.map((r, i) => i === 0 ? null : (r.delta >= 0 ? '+' : '') + fmtM(r.delta))
  , [donutRings]);

  // ── P1/P2: meses del año seleccionado ──────────────────────────────────────
  const { p1Meses, p1CausaColors, p1Max } = useMemo(() => {
    if (!proyData || !anioP1) return { p1Meses:[], p1CausaColors:{}, p1Max:0 };
    const meses = Object.keys(proyData.meses).filter(ym => ym.startsWith(anioP1)).sort();
    const cc = {};
    Object.keys(causaColors).forEach(c => { cc[c] = { ...causaColors[c], data: {} }; });
    const acum = {};
    meses.forEach(ym => {
      Object.entries(proyData.meses[ym]?.causas || {}).forEach(([c, v]) => {
        const nc = normCausa(c);
        acum[nc] = (acum[nc] || 0) + v;
        if (cc[nc]) cc[nc].data[ym] = acum[nc];
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
        const nc = normCausa(c);
        if (cc[nc]) cc[nc].data[ym] = (cc[nc].data[ym] || 0) + v;
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

  // P3: folios agrupados por folio-key, filtrados por causa seleccionada
  const foliosP3Data = useMemo(() => {
    if (!proyData) return [];
    const map = {};
    Object.entries(proyData.meses).forEach(([ym, md]) => {
      (md.folios || []).forEach(f => {
        if (selectedCausa && normCausa(f.causa) !== selectedCausa) return;
        const k = f._key ?? String(f.folio ?? f.reforma ?? f.id ?? `${ym}-anon`);
        if (!map[k]) map[k] = {
          folio: f.folio ?? f.reforma ?? k,
          ym,
          descripcion: f.comentario || f.descripcion || '',
          causa: normCausa(f.causa),
          caps: f.caps || [],
          capKeys: f.capKeys || [],
          valor: 0,
        };
        map[k].valor += f.valor || 0;
        (f.caps || []).forEach(c => { if (!map[k].caps.includes(c)) map[k].caps.push(c); });
        (f.capKeys || []).forEach(c => { if (!map[k].capKeys.includes(c)) map[k].capKeys.push(c); });
      });
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [proyData, selectedCausa]);

  // Fallback: meses agrupados por año cuando no hay folios
  const causaMesesData = useMemo(() => {
    if (!proyData) return [];
    const rows = [];
    Object.entries(proyData.meses).sort().forEach(([ym, md]) => {
      const val = selectedCausa
        ? Object.entries(md.causas || {}).reduce((s, [c, v]) => normCausa(c) === selectedCausa ? s + v : s, 0)
        : Object.values(md.causas || {}).reduce((s, v) => s + v, 0);
      if (val !== 0) rows.push({ ym, valor: val, year: ym.slice(0, 4) });
    });
    return rows.reverse();
  }, [proyData, selectedCausa]);

  const causaMesesPorAnio = useMemo(() => {
    const byYear = {};
    causaMesesData.forEach(r => {
      if (!byYear[r.year]) byYear[r.year] = [];
      byYear[r.year].push(r);
    });
    return Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0]));
  }, [causaMesesData]);

  const hasRealFolios = foliosP3Data.length > 0;

  const titulo = LABELS[macroKey] || macroKey?.toUpperCase();
  const causasActivas = useMemo(() => {
    const seen = new Set();
    return (data?.causas || [])
      .map(normCausa)
      .filter(nc => {
        if (seen.has(nc)) return false;
        seen.add(nc);
        return p1Meses.some(ym =>
          Object.entries(proyData?.meses[ym]?.causas || {}).some(([c, v]) => normCausa(c) === nc && v !== 0)
        );
      });
  }, [data, p1Meses, proyData]);

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
          display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',flexShrink:0,
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P1 · Proyecciones</span>
            <span style={{fontSize:'0.65rem',color:'#888'}}>
              Base {fmtM(pptoTotal)}
              {proyTotal != null && (
                <>
                  {' → '}
                  <span style={{color: proyTotal > pptoTotal ? '#B85520' : '#2E7D32', fontWeight:600}}>
                    Proy. {fmtM(proyTotal)}
                  </span>
                </>
              )}
              {fechaInicioProyeccion && numMesesEjecucion > 0 && (() => {
                const mp = detalle?.[macroKey]?.mesesProgramados;
                return (
                  <span style={{marginLeft:6, color:'#999'}}>
                    · desde {fechaInicioProyeccion}
                    {mp ? <> · <span style={{color:'#aaa'}}>{mp} prog</span></> : null}
                    {' · '}<span style={{color:'#666',fontWeight:600}}>{numMesesEjecucion} ejec</span>
                  </span>
                );
              })()}
            </span>
            <button
              onClick={() => setSelectedCausa(null)}
              style={{marginLeft:'auto',padding:'2px 8px',fontSize:'0.62rem',fontWeight:400,
                border:'1px solid #2D4170',borderRadius:4,cursor:'pointer',
                background:'transparent',color:'#222',whiteSpace:'nowrap',flexShrink:0}}>
              Proy. acum »
            </button>
          </div>
          <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}}>

            {/* Izquierda: Labels de categorías (verdes→naranjas→azules→morados) */}
            <div style={{flex:'0 0 15%',padding:'6px 4px 4px 6px',display:'flex',flexDirection:'column',
              justifyContent:'flex-start',gap:2,minHeight:0,overflowY:'auto',
              border:'1px solid #e0e0e0',borderRadius:5,margin:'6px 4px 6px 6px'}}>
              {CAT_DEFS.map(cat => (
                <div key={cat.key} style={{display:'flex',alignItems:'center',gap:4,minHeight:14}}>
                  <span style={{width:8,height:8,borderRadius:2,background:cat.color,flexShrink:0,display:'inline-block'}}/>
                  <span style={{fontSize:'0.58rem',color:cat.color,fontWeight:700,lineHeight:1.1,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {cat.label}
                  </span>
                </div>
              ))}
              {pptoCats && (() => {
                const lastRing = donutRings[donutRings.length - 1];
                return (
                  <>
                    <div style={{marginTop:10,marginBottom:2,display:'flex',gap:2,borderTop:'1px solid #eee',paddingTop:4}}>
                      <span style={{flex:1,fontSize:'0.5rem',color:'#333',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.03em'}}>Base</span>
                      <span style={{flex:1,fontSize:'0.5rem',color:'#333',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.03em'}}>Proy Act</span>
                    </div>
                    {CAT_DEFS.map(cat => {
                      const base = pptoCats[cat.key] || 0;
                      const proy = lastRing?.vals?.[cat.key] || 0;
                      if (!base && !proy) return null;
                      return (
                        <div key={`v-${cat.key}`} style={{display:'flex',alignItems:'center',gap:2,minHeight:13}}>
                          <span style={{width:6,height:6,borderRadius:1,background:cat.color,flexShrink:0,display:'inline-block'}}/>
                          <span style={{flex:1,fontSize:'0.55rem',color:'#444',fontWeight:600,whiteSpace:'nowrap'}}>{fmtM(base)}</span>
                          <span style={{flex:1,fontSize:'0.55rem',color:'#1565C0',fontWeight:600,whiteSpace:'nowrap'}}>{fmtM(proy)}</span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            {/* Centro: Donut */}
            <div style={{flex:'0 0 38%',padding:'4px',display:'flex',flexDirection:'column',minHeight:0,minWidth:0}}>
              {donutRings.length > 0 ? (
                <DonutMultiRing
                  rings={donutRings}
                  catDefs={CAT_DEFS}
                  totalLabel={fmtM(pptoTotal)}
                  deltaLabels={deltaLabels}
                />
              ) : (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#999',fontSize:'0.75rem'}}>
                  Sin datos base
                </div>
              )}
            </div>

            {/* Derecha: Barras por causa acumulada (todos los años) */}
            {(() => {
              const totalVar = Object.values(causaAcumTotal).reduce((s,v)=>s+v,0);
              return (
                <div style={{flex:1,display:'flex',flexDirection:'column',borderLeft:'1px solid #f0f0f0',minHeight:0,overflow:'hidden'}}>
                  <div style={{padding:'6px 8px 2px',fontSize:'0.65rem',fontWeight:600,color:'#666',flexShrink:0}}>
                    Variación acumulada por causa
                  </div>
                  <CausaBars causaAcum={causaAcumTotal} causas={data?.causas || []}
                    selectedCausa={selectedCausa} onSelectCausa={setSelectedCausa} />
                  <div style={{borderTop:'1px solid #e0e0e0',padding:'6px 8px 6px',display:'flex',alignItems:'center',gap:4,flexShrink:0,marginBottom:10}}>
                    <div style={{flex:1,fontSize:'0.62rem',fontWeight:700,color:'#333'}}>Total</div>
                    <div style={{fontSize:'0.65rem',fontWeight:700,color:'#222'}}>
                      {(totalVar>=0?'+':'')+fmtM(totalVar)}
                    </div>
                  </div>
                </div>
              );
            })()}
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

        {/* P3 — Folios por causa */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',flexShrink:0,
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P3</span>
            {selectedCausa
              ? <span style={{fontSize:'0.75rem',fontWeight:600,color:'#2D4170'}}>· {selectedCausa}</span>
              : <span style={{fontSize:'0.7rem',color:'#888'}}>· Total variación</span>}
            <span style={{marginLeft:'auto',fontSize:'0.65rem',color:'#888'}}>
              {hasRealFolios
                ? `${foliosP3Data.length} folios · Total ${fmtM(foliosP3Data.reduce((s,f)=>s+f.valor,0))}`
                : `${causaMesesData.length} meses · Total ${fmtM(causaMesesData.reduce((s,r)=>s+r.valor,0))}`}
            </span>
          </div>
          <div style={{flex:1,overflowY:'auto',minHeight:0}}>
            {hasRealFolios ? (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.67rem'}}>
                <thead>
                  <tr style={{background:'#f5f7fa',position:'sticky',top:0}}>
                    <th style={{padding:'4px 8px',textAlign:'left',fontWeight:600,color:'#666',whiteSpace:'nowrap',width:'8%'}}>Folio · Mes</th>
                    <th style={{padding:'4px 6px 4px 0',textAlign:'left',fontWeight:600,color:'#666',whiteSpace:'nowrap',width:'8%'}}>Causa</th>
                    <th style={{padding:'4px 4px 4px 0',textAlign:'left',fontWeight:600,color:'#666',whiteSpace:'nowrap',width:'9%'}}>Capítulos</th>
                    <th style={{padding:'4px 8px',textAlign:'left',fontWeight:600,color:'#666'}}>Descripción</th>
                    <th style={{padding:'4px 8px',textAlign:'right',fontWeight:600,color:'#666',whiteSpace:'nowrap',width:'7%'}}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {foliosP3Data.map((f, i) => (
                    <tr key={i} style={{background: i%2===0?'transparent':'#fafafa', verticalAlign:'top'}}>
                      <td style={{padding:'4px 8px',color:'#2D4170',fontWeight:700,whiteSpace:'nowrap',fontSize:'0.65rem'}}>
                        {f.folio}<br/>
                        <span style={{fontWeight:400,color:'#aaa',fontSize:'0.6rem'}}>{ymLabel(f.ym)}</span>
                      </td>
                      <td style={{padding:'4px 4px 4px 0',color:'#555',fontSize:'0.60rem',whiteSpace:'nowrap'}}>{f.causa || '—'}</td>
                      <td style={{padding:'4px 4px 4px 0',verticalAlign:'top'}}>
                        {(f.caps||[]).length > 0
                          ? [...new Set(f.caps)].map(label => (
                              <div key={label} style={{marginBottom:2}}>
                                <span style={{display:'inline-block',
                                  padding:'1px 4px',borderRadius:3,fontSize:'0.58rem',fontWeight:500,
                                  background:'#E8EBF4',color:'#2D4170',whiteSpace:'nowrap'}}>
                                  {label}
                                </span>
                              </div>
                            ))
                          : <span style={{color:'#ccc',fontSize:'0.6rem'}}>—</span>
                        }
                      </td>
                      <td style={{padding:'4px 8px',color:'#444',lineHeight:1.35,fontSize:'0.65rem',width:'35%'}}>{f.descripcion || '—'}</td>
                      <td style={{padding:'4px 8px',textAlign:'right',fontWeight:400,whiteSpace:'nowrap',
                        color: f.valor >= 0 ? '#c62828' : '#1565C0'}}>
                        {(f.valor>=0?'+':'')+fmtM(f.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : causaMesesData.length === 0 ? (
              <div style={{padding:16,color:'#bbb',fontSize:'0.72rem',textAlign:'center'}}>Sin datos</div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.68rem'}}>
                <tbody>
                  {causaMesesPorAnio.map(([year, meses]) => {
                    const yearTotal = meses.reduce((s, r) => s + r.valor, 0);
                    return (
                      <React.Fragment key={year}>
                        <tr style={{background:'#f0f4f8'}}>
                          <td colSpan={2} style={{padding:'4px 8px',fontWeight:700,color:'#2D4170',fontSize:'0.72rem'}}>{year}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',fontWeight:700,
                            color: yearTotal >= 0 ? '#c62828' : '#1565C0',fontSize:'0.72rem',whiteSpace:'nowrap'}}>
                            {(yearTotal >= 0 ? '+' : '') + fmtM(yearTotal)}
                          </td>
                        </tr>
                        {meses.map((r, i) => (
                          <tr key={r.ym} style={{background: i%2===0 ? 'transparent' : '#fafafa'}}>
                            <td style={{padding:'3px 8px 3px 20px',color:'#888',whiteSpace:'nowrap',width:80}}>{ymLabel(r.ym)}</td>
                            <td style={{padding:'3px 8px'}}>
                              <div style={{height:6,borderRadius:3,background:'#f0f0f0',position:'relative'}}>
                                <div style={{position:'absolute',top:0,height:'100%',borderRadius:3,
                                  background: r.valor >= 0 ? '#c62828' : '#1565C0',opacity:0.7,
                                  width:`${Math.min(100,Math.abs(r.valor)/Math.max(...causaMesesData.map(x=>Math.abs(x.valor)),1)*100)}%`}}/>
                              </div>
                            </td>
                            <td style={{padding:'3px 8px',textAlign:'right',fontWeight:600,
                              color: r.valor >= 0 ? '#c62828' : '#1565C0',whiteSpace:'nowrap'}}>
                              {(r.valor >= 0 ? '+' : '') + fmtM(r.valor)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
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
