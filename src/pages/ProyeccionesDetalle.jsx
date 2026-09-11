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
// 30 grupos granulares "Nombre en App" del Excel capitulos_control_proyecto.xlsx
const CDD_APP_GROUPS = [
  { key:'gg',   label:'Gastos Generales',             color:'#0A3D1A', codes:['CDD01','CDD02','CDD03','CDD37','CDD38','CDD39','CDD40'], tipo:'cdd' },
  { key:'dcp',  label:'Descapote, excav. y rellenos', color:'#155724', codes:['CDD04'], tipo:'cdd' },
  { key:'pil',  label:'Pilotaje',                     color:'#1B6B30', codes:['CDD05'], tipo:'cdd' },
  { key:'cie',  label:'Cimentacion y Estructura',     color:'#256E3A', codes:['CDD06','CDD07','CDD08'], tipo:'cdd' },
  { key:'ihs',  label:'Inst. Hidrosanitarias',        color:'#1A7A38', codes:['CDD09','CDD10'], tipo:'cdd' },
  { key:'iel',  label:'Inst. Electricas',             color:'#229444', codes:['CDD11'], tipo:'cdd' },
  { key:'igs',  label:'Inst. de Gas',                 color:'#28A850', codes:['CDD12'], tipo:'cdd' },
  { key:'irci', label:'Inst. Red contra Incendio',    color:'#2EBC5C', codes:['CDD13'], tipo:'cdd' },
  { key:'isc',  label:'Inst. Seguridad y Control',    color:'#34CC68', codes:['CDD14'], tipo:'cdd' },
  { key:'mamp', label:'Mampostería y Pañetes',        color:'#2E9E50', codes:['CDD15','CDD16'], tipo:'cdd' },
  { key:'pint', label:'Pinturas y Drywall',           color:'#3DB060', codes:['CDD17','CDD18','CDD24'], tipo:'cdd' },
  { key:'piso', label:'Pisos y Enchapes',             color:'#52C76A', codes:['CDD19','CDD21'], tipo:'cdd' },
  { key:'impe', label:'Impermeabilizaciones',         color:'#68D680', codes:['CDD20'], tipo:'cdd' },
  { key:'equi', label:'Equipamento',                  color:'#80E090', codes:['CDD22'], tipo:'cdd' },
  { key:'eesp', label:'Equipos Especiales',           color:'#96E0A0', codes:['CDD23'], tipo:'cdd' },
  { key:'cmet', label:'Carpintería Metálica',         color:'#4CAF50', codes:['CDD26'], tipo:'cdd' },
  { key:'calu', label:'Carpintería Aluminio',         color:'#66BB6A', codes:['CDD27'], tipo:'cdd' },
  { key:'cmad', label:'Carpintería Madera',           color:'#81C784', codes:['CDD28'], tipo:'cdd' },
  { key:'nome', label:'Nomenclatura',                 color:'#A5D6A7', codes:['CDD29'], tipo:'cdd' },
  { key:'aseo', label:'Aseo',                         color:'#4E9A56', codes:['CDD30'], tipo:'cdd' },
  { key:'zv',   label:'Zonas Verdes, Vías',           color:'#2E7D32', codes:['CDD31','CDD32','CDD33'], tipo:'cdd' },
  { key:'omit', label:'Obras de Mitigación',          color:'#558B2F', codes:['CDD34'], tipo:'cdd' },
  { key:'ref',  label:'Reformas',                     color:'#7B1041', codes:['CDD35'], tipo:'cdd' },
  { key:'imp',  label:'Imprevistos',                  color:'#880E4F', codes:['CDD36','CDD42','CDD44','CDD45'], tipo:'imp' },
  { key:'hvac', label:'Inst. de HVAC',                color:'#3ACC6A', codes:['CDD43'], tipo:'cdd' },
  { key:'dsc',  label:'Descuentos',                   color:'#6A1B9A', codes:['CDD99'], tipo:'dsc' },
  { key:'nom',  label:'Nómina Administrativa',        color:'#BF360C', codes:['CID51','CID'], tipo:'cid' },
  { key:'spu',  label:'Servicios Públicos',           color:'#E64A19', codes:['CID52'], tipo:'cid' },
  { key:'gob',  label:'Gastos de Obra',               color:'#FF7043', codes:['CID53','CID56'], tipo:'cid' },
  { key:'sst',  label:'Seguridad Industrial',         color:'#FF8A65', codes:['CID54'], tipo:'cid' },
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
  if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(0)}Mil`;
  return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`;
};

const ymLabel = ym => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MESES_ES[parseInt(m,10)-1]} ${y}`;
};

// ── Staircase timeline chart (P1 center) ─────────────────────────────────────
function StaircaseChart({ donutRings, pptoTotal, fmtM, startYm, mesesProgramados, numMesesEjecucion }) {
  if (!donutRings || donutRings.length < 2) return null;

  // Build steps: Base + one per year, with CUMULATIVE month count from startYm
  let cumMeses = 0;
  const steps = donutRings.map((r, i) => {
    if (i === 0) return { label: 'Base', value: pptoTotal, delta: null, meses: null };
    const acum = donutRings.slice(1, i + 1).reduce((s, x) => s + (x.delta || 0), 0);
    const isLast = i === donutRings.length - 1;
    const periodMeses = r.vals ? Object.keys(r.vals).length : 0;
    cumMeses += periodMeses;
    return { label: isLast ? `${r.label}*` : r.label, value: pptoTotal + acum, delta: r.delta, meses: cumMeses };
  });

  // Planned-end line: bar index + fraction within that bar + label
  let plannedBarIdx = null, plannedFrac = 0, plannedLabel = '';
  if (startYm && mesesProgramados) {
    const [sy, sm] = startYm.split('-').map(Number);
    const totalOffset = (sm - 1) + (mesesProgramados - 1);
    const endAbsYear = sy + Math.floor(totalOffset / 12);
    const endMonth = (totalOffset % 12) + 1;
    const MN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    for (let i = 1; i < donutRings.length; i++) {
      if (donutRings[i].label.replace('*','') === String(endAbsYear)) {
        plannedBarIdx = i;
        plannedFrac = endMonth / 12;
        plannedLabel = `${MN[endMonth-1]} ${endAbsYear} · mes ${mesesProgramados}`;
        break;
      }
    }
  }

  const COLORS    = ['#546E7A','#5C35D4','#1D9E8F','#E07B39','#8B4513','#1565C0'];
  const OPACITIES = [0.75, 0.90, 0.90, 1.0, 0.9, 0.9];

  const W = 320, H = 210;
  const PAD_L = 52, PAD_R = 10, PAD_T = 62, PAD_B = 32;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const n = steps.length;
  const barW = Math.floor(chartW / n * 0.58);
  const spacing = chartW / n;
  const bx = i => PAD_L + i * spacing + (spacing - barW) / 2;

  const values = steps.map(s => s.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const yMin = minV - range * 0.15;
  const yMax = maxV + range * 0.12;
  const yRange = yMax - yMin;
  const toY  = v => PAD_T + chartH - (v - yMin) / yRange * chartH;
  const toBH = v => (v - yMin) / yRange * chartH;

  // Compute ~5 nice Y ticks
  const rawStep = (yMax - yMin) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceStep = Math.ceil(rawStep / mag) * mag;
  const tickStart = Math.ceil(yMin / niceStep) * niceStep;
  const ticks = [];
  for (let t = tickStart; t <= yMax + niceStep * 0.01; t += niceStep) ticks.push(t);

  const fmtAbs = v => {
    const abs = Math.abs(v || 0);
    if (abs >= 1e9) return `$${(abs/1e9).toFixed(1)}MM`;
    if (abs >= 1e6) return `$${(abs/1e6).toFixed(1)}M`;
    return `$${Math.round(abs).toLocaleString('es-CO')}`;
  };
  const fmtDlt = v => {
    if (v == null) return '';
    const abs = Math.abs(v), sign = v < 0 ? '-' : '+';
    if (abs >= 1e9) return `${sign}$${(abs/1e9).toFixed(1)}MM`;
    if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(0)}Mil`;
    return `${sign}$${Math.round(abs)}`;
  };

  return (
    <div style={{width:'100%',flex:'1 1 auto',minHeight:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'100%',display:'block'}}>

        {/* Y axis grid lines + labels */}
        {ticks.map((tv, ti) => {
          const gy = toY(tv);
          if (gy < PAD_T - 6 || gy > PAD_T + chartH + 6) return null;
          return (
            <g key={`g${ti}`}>
              <line x1={PAD_L - 4} y1={gy} x2={W - PAD_R} y2={gy}
                stroke="#ddd" strokeWidth={0.6} strokeDasharray="3,2" opacity={0.8}/>
              <text x={PAD_L - 6} y={gy + 3.5} textAnchor="end"
                fontSize={5.5} fill="#999" fontFamily="Century Gothic,sans-serif">
                {fmtAbs(tv)}
              </text>
            </g>
          );
        })}

        {/* X axis base line */}
        <line x1={PAD_L - 4} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH}
          stroke="#ccc" strokeWidth={0.8}/>

        {/* Axis break // symbol */}
        <text x={PAD_L - 18} y={PAD_T + chartH + 10} textAnchor="middle"
          fontSize={9} fill="#aaa" fontFamily="Century Gothic,sans-serif">//</text>

        {/* Staircase connectors */}
        {steps.map((step, i) => {
          if (i >= n - 1) return null;
          const x1 = bx(i) + barW, x2 = bx(i + 1);
          const y1 = toY(step.value), y2 = toY(steps[i + 1].value);
          return <polyline key={`c${i}`} points={`${x1},${y1} ${x2},${y1} ${x2},${y2}`}
            fill="none" stroke="#ccc" strokeWidth={0.8} strokeDasharray="3,2"/>;
        })}

        {/* Bars */}
        {steps.map((step, i) => {
          const x = bx(i), yTop = toY(step.value), bh = toBH(step.value);
          const col = COLORS[Math.min(i, COLORS.length - 1)];
          const op  = OPACITIES[Math.min(i, OPACITIES.length - 1)];
          const isLast = i === n - 1;
          const isPos = (step.delta || 0) >= 0;

          // Labels stacked above bar (from bar top, going up):
          // pill (14px) → chip (13px) → total value (10px)
          const pillY   = yTop - 18;   // pill rect top
          const chipY   = yTop - 36;   // chip rect top (above pill)
          const totalY  = yTop - 48;   // total value text

          return (
            <g key={`b${i}`}>
              {isLast && <rect x={x+1.5} y={yTop+1.5} width={barW} height={bh} fill={col} opacity={0.15} rx={2}/>}
              <rect x={x} y={yTop} width={barW} height={bh} fill={col} opacity={op} rx={2}/>
              <rect x={x} y={yTop} width={barW} height={3} fill={col} rx={2}/>

              {/* Year pill */}
              <rect x={x-1} y={pillY} width={barW+2} height={14} fill={col} opacity={op} rx={2}/>
              <text x={x + barW/2} y={pillY + 10} textAnchor="middle"
                fontSize={isLast ? 7.5 : 7} fontWeight={700} fill="#fff"
                fontFamily="Century Gothic,sans-serif" letterSpacing="0.03em">
                {step.label}
              </text>

              {/* Delta chip — above pill */}
              {step.delta != null && i > 0 && (
                <g>
                  <rect x={x + barW/2 - 19} y={chipY} width={38} height={12}
                    fill={isPos ? '#E8F5E9' : '#FFF3E0'} rx={5} opacity={0.95}/>
                  <text x={x + barW/2} y={chipY + 8.5} textAnchor="middle"
                    fontSize={6} fontWeight={700}
                    fill={isPos ? '#2E7D32' : '#E65100'}
                    fontFamily="Century Gothic,sans-serif">
                    {fmtDlt(step.delta)}
                  </text>
                </g>
              )}

              {/* Total accumulated value — topmost */}
              <text x={x + barW/2} y={totalY} textAnchor="middle"
                fontSize={isLast ? 7 : 6.5} fontWeight={isLast ? 700 : 500}
                fill={isLast ? col : '#777'} fontFamily="Century Gothic,sans-serif">
                {fmtAbs(step.value)}
              </text>

              {/* Months label below X axis */}
              {step.meses != null && (
                <text x={x + barW/2} y={PAD_T + chartH + 13} textAnchor="middle"
                  fontSize={5.5} fill="#999" fontFamily="Century Gothic,sans-serif">
                  {step.meses} meses
                </text>
              )}
            </g>
          );
        })}

        {/* Planned-end vertical line */}
        {plannedBarIdx != null && (() => {
          const lx = bx(plannedBarIdx) + plannedFrac * barW;
          const dmY = PAD_T + chartH * 0.82;
          return (
            <g>
              <text x={lx} y={14} textAnchor="middle"
                fontSize={5.5} fontWeight={600} fill="#C62828"
                fontFamily="Century Gothic,sans-serif" opacity={0.85}>
                {plannedLabel || `Fin prog. · mes ${mesesProgramados}`}
              </text>
              <line x1={lx} y1={18} x2={lx} y2={PAD_T + chartH}
                stroke="#C62828" strokeWidth={0.9} strokeDasharray="4,4" opacity={0.6}/>
              <polygon points={`${lx},${dmY-5} ${lx+4},${dmY} ${lx},${dmY+5} ${lx-4},${dmY}`}
                fill="#C62828" opacity={0.7}/>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

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

// DonutMultiRing kept for reference but no longer rendered
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
  // Usar causaAcum directamente para no perder causas que no estén en data.causas
  const sorted = Object.entries(causaAcum)
    .filter(([, v]) => v !== 0)
    .map(([c, v]) => ({ causa: c, val: v }))
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

// ── Helper: semanas Vie–Jue para un array de folios ──────────────────────────
function getWeekChips(folios) {
  const weekMap = {};
  folios.forEach(f => {
    if (!f.fecha) return;
    const ds = String(f.fecha);
    if (ds.length < 8) return;
    const y = parseInt(ds.slice(0,4),10), mo = parseInt(ds.slice(4,6),10)-1, d = parseInt(ds.slice(6,8),10);
    const date = new Date(y, mo, d);
    const dow = date.getDay(); // 0=Dom...5=Vie,6=Sab
    const daysBack = dow >= 5 ? dow - 5 : dow + 2;
    const fri = new Date(date); fri.setDate(date.getDate() - daysBack);
    const thu = new Date(fri); thu.setDate(fri.getDate() + 6);
    const fmt = dt => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
    const key = fri.toISOString().slice(0,10);
    if (!weekMap[key]) weekMap[key] = { key, label: `${fmt(fri)}–${fmt(thu)}`, count: 0 };
    weekMap[key].count++;
  });
  return Object.values(weekMap).sort((a,b) => a.key.localeCompare(b.key));
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
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [sortP3, setSortP3] = useState('valor');
  const [sortP4, setSortP4] = useState('valor');
  // P1 right half: month + week + causa selection
  const [selectedMonthP1, setSelectedMonthP1] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  });
  const [selectedWeekP1, setSelectedWeekP1] = useState(null);
  const [selectedCausaP1, setSelectedCausaP1] = useState(null);

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

  // Base presupuesto por grupo granular — fuente: pptoCaps del controlproyecto (gen_proyecciones_api)
  const pptoCatsGranular = useMemo(() => {
    const codeToGrp = {};
    CDD_APP_GROUPS.forEach(g => { g.codes.forEach(c => { codeToGrp[c] = g.key; }); });
    const raw = {};
    CDD_APP_GROUPS.forEach(g => { raw[g.key] = 0; });

    // Fuente primaria: pptoCaps del JSON de proyecciones (adp_dtm_fact_controlproyecto)
    const pptoCaps = proyData?.pptoCaps;
    if (pptoCaps && Object.keys(pptoCaps).length > 0) {
      Object.entries(pptoCaps).forEach(([code, val]) => {
        const grp = codeToGrp[code];
        if (grp !== undefined) raw[grp] += val || 0;
      });
      return { ...raw };
    }

    // Fallback: detalleItems de estado_detalle (si pptoCaps aún no existe en el JSON)
    const tot = detalle?.[macroKey]?.totales;
    if (!tot) return null;
    detalleItems.forEach(it => {
      const grp = codeToGrp[it.num];
      if (grp !== undefined) raw[grp] += it.ppto || 0;
    });
    const cddCats = CDD_APP_GROUPS.filter(g => g.tipo !== 'cid');
    const cddRaw = cddCats.reduce((s, g) => s + raw[g.key], 0);
    const cddFactor = cddRaw > 0 ? (tot.cdd?.ppto || 0) / cddRaw : 1;
    const vals = {};
    cddCats.forEach(g => { vals[g.key] = raw[g.key] * cddFactor; });
    const cidCats = CDD_APP_GROUPS.filter(g => g.tipo === 'cid');
    const cidRaw = cidCats.reduce((s, g) => s + raw[g.key], 0);
    const cidFactor = cidRaw > 0 ? (tot.cid?.ppto || 0) / cidRaw : 1;
    cidCats.forEach(g => { vals[g.key] = raw[g.key] * cidFactor; });
    return vals;
  }, [proyData, detalleItems, detalle, macroKey]);

  // Variación acumulada real por grupo granular usando capVals (valor exacto por capítulo)
  const variaGranular = useMemo(() => {
    if (!proyData) return {};
    const codeToGrp = {};
    CDD_APP_GROUPS.forEach(g => { g.codes.forEach(c => { codeToGrp[c] = g.key; }); });
    const varia = {};
    CDD_APP_GROUPS.forEach(g => { varia[g.key] = 0; });
    Object.values(proyData.meses).forEach(md => {
      (md.folios || []).forEach(f => {
        const capVals = f.capVals;
        if (capVals && Object.keys(capVals).length > 0) {
          // Usar valores reales por capítulo (precisión exacta)
          Object.entries(capVals).forEach(([ck, cv]) => {
            const gk = codeToGrp[ck];
            if (gk) varia[gk] += cv;
          });
        } else {
          // Fallback: distribuir total entre capKeys (datos sin capVals)
          const keys = f.capKeys || [];
          const grpsList = [...new Set(keys.map(ck => codeToGrp[ck]).filter(Boolean))];
          if (grpsList.length > 0) {
            const share = (f.valor || 0) / grpsList.length;
            grpsList.forEach(gk => { varia[gk] += share; });
          }
        }
      });
    });
    return varia;
  }, [proyData]);

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

  // P3 folios for selected month (P1 right half), filtered by causa and/or week
  const foliosP3Month = useMemo(() => {
    if (!proyData || !selectedMonthP1) return [];
    let folios = proyData.meses[selectedMonthP1]?.folios || [];
    if (selectedCausaP1) {
      folios = folios.filter(f => normCausa(f.causa) === selectedCausaP1);
    }
    if (selectedWeekP1) {
      folios = folios.filter(f => {
        if (!f.fecha) return false;
        const ds = String(f.fecha);
        if (ds.length < 8) return false;
        const y = parseInt(ds.slice(0,4),10), mo = parseInt(ds.slice(4,6),10)-1, d = parseInt(ds.slice(6,8),10);
        const date = new Date(y, mo, d);
        const dow = date.getDay();
        const daysBack = dow >= 5 ? dow - 5 : dow + 2;
        const fri = new Date(date); fri.setDate(date.getDate() - daysBack);
        return fri.toISOString().slice(0,10) === selectedWeekP1;
      });
    }
    return [...folios].sort((a,b) => Math.abs(b.valor) - Math.abs(a.valor));
  }, [proyData, selectedMonthP1, selectedWeekP1, selectedCausaP1]);

  // P3: folios agrupados por folio-key, filtrados por causa o actividad seleccionada
  const foliosP3Data = useMemo(() => {
    if (!proyData) return [];
    const actGrp = selectedActivity ? CDD_APP_GROUPS.find(g => g.key === selectedActivity) : null;
    const actCodes = new Set(actGrp?.codes || []);
    const map = {};
    Object.entries(proyData.meses).forEach(([ym, md]) => {
      (md.folios || []).forEach(f => {
        if (selectedCausa && normCausa(f.causa) !== selectedCausa) return;

        // Calcular valor y caps filtrados por actividad seleccionada
        let valorFolio, capsMatch, capKeysMatch;
        if (actCodes.size > 0) {
          // Solo capítulos que pertenecen a la actividad seleccionada
          capKeysMatch = (f.capKeys || []).filter(ck => actCodes.has(ck));
          if (capKeysMatch.length === 0) return; // folio no toca esta actividad
          // Valor exacto desde capVals; fallback: proporción del total
          const capVals = f.capVals || {};
          const hasCapVals = Object.keys(capVals).length > 0;
          if (hasCapVals) {
            valorFolio = capKeysMatch.reduce((s, ck) => s + (capVals[ck] || 0), 0);
          } else {
            // Fallback: proporción según capKeys que coinciden
            const totalKeys = (f.capKeys || []).length || 1;
            valorFolio = (f.valor || 0) * capKeysMatch.length / totalKeys;
          }
          if (valorFolio === 0) return;
          // Caps display: descripciones de los caps que coinciden, vía capMap
          const capMap = f.capMap || {};
          capsMatch = capKeysMatch.map(ck => capMap[ck] || ck);
          if (capsMatch.length === 0) capsMatch = capKeysMatch;
        } else {
          valorFolio = f.valor || 0;
          capsMatch = f.caps || [];
          capKeysMatch = f.capKeys || [];
        }

        const k = f._key ?? String(f.folio ?? f.reforma ?? f.id ?? `${ym}-anon`);
        if (!map[k]) map[k] = {
          folio: f.folio ?? f.reforma ?? k,
          ym,
          descripcion: f.comentario || f.descripcion || '',
          causa: normCausa(f.causa),
          caps: [...capsMatch],
          capKeys: [...capKeysMatch],
          valor: 0,
        };
        map[k].valor += valorFolio;
        capsMatch.forEach(c => { if (!map[k].caps.includes(c)) map[k].caps.push(c); });
        capKeysMatch.forEach(c => { if (!map[k].capKeys.includes(c)) map[k].capKeys.push(c); });
      });
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [proyData, selectedCausa, selectedActivity]);

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
        <img className="det-hdr-ic" src="/images/IC_logo.png" alt="IC" />
      </div>

      {/* ── Paneles 2x2 ── */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',
        gridTemplateRows:'1fr 1fr',gap:8,padding:8,minHeight:0}}>

        {/* P1 — Escalera proyecciones */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',overflow:'hidden',minHeight:0}}>
          {/* Contenido — mitad izquierda */}
          <div style={{width:'50%',flexShrink:0,display:'flex',flexDirection:'column',minHeight:0,
            borderRight:'1px solid #eee',overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'5px 12px',borderBottom:'1px solid #eee',flexShrink:0}}>
              <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#888'}}>
                {macroKey} · Proyecciones acumuladas
              </div>
              <div style={{fontSize:'0.75rem',fontWeight:700,color:'#222',marginTop:1}}>
                Variación por año{fechaInicioProyeccion ? ` · desde ${fechaInicioProyeccion}` : ''}
              </div>
            </div>
            {/* KPI strip */}
            {(() => {
              const mp = proyData?.mesesProgramados ?? detalle?.[macroKey]?.mesesProgramados;
              const varTotal = proyTotal != null ? proyTotal - pptoTotal : null;
              return (
                <div style={{display:'flex',borderBottom:'1px solid #eee',flexShrink:0}}>
                  {[
                    {label:'Ppto Base', val: fmtM(pptoTotal), color:'#333'},
                    {label:'Proyección', val: proyTotal != null ? fmtM(proyTotal) : '—', color: proyTotal > pptoTotal ? '#B85520' : '#2E7D32'},
                    {label:'Variación', val: varTotal != null ? (varTotal>=0?'+':'')+fmtM(varTotal) : '—', color: varTotal >= 0 ? '#B85520' : '#2E7D32'},
                    {label:'Meses ejec', val: numMesesEjecucion ? `${numMesesEjecucion} de ${mp||'?'}` : '—', color:'#444'},
                  ].map(({label,val,color},ki) => (
                    <div key={ki} style={{flex:1,padding:'4px 6px',borderRight:'1px solid #eee',minWidth:0}}>
                      <div style={{fontSize:'0.48rem',color:'#aaa',textTransform:'uppercase',letterSpacing:'0.07em',whiteSpace:'nowrap'}}>{label}</div>
                      <div style={{fontSize:'0.72rem',fontWeight:700,color,marginTop:1,whiteSpace:'nowrap'}}>{val}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* Chart */}
            <div style={{flex:1,minHeight:0,overflow:'hidden'}}>
              {donutRings.length > 1 ? (
                <StaircaseChart
                  donutRings={donutRings} pptoTotal={pptoTotal} fmtM={fmtM}
                  startYm={Object.keys(proyData.meses).sort()[0]}
                  mesesProgramados={proyData?.mesesProgramados ?? detalle?.[macroKey]?.mesesProgramados}
                  numMesesEjecucion={numMesesEjecucion}
                />
              ) : (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#999',fontSize:'0.75rem'}}>
                  Sin datos base
                </div>
              )}
            </div>
            {/* Legend */}
            <div style={{display:'flex',gap:10,padding:'4px 10px',borderTop:'1px solid #eee',flexShrink:0,flexWrap:'wrap',alignItems:'center'}}>
              {[{c:'#546E7A',l:'Base'},{c:'#5C35D4',l:'2024'},{c:'#1D9E8F',l:'2025'},{c:'#E07B39',l:'2026*'}].map(({c,l})=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.6rem',color:'#777'}}>
                  <div style={{width:8,height:8,borderRadius:2,background:c,flexShrink:0}}/>
                  {l}
                </div>
              ))}
              <div style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.6rem',color:'#777'}}>
                <div style={{width:16,height:0,borderTop:'2px dashed #C62828',flexShrink:0}}/>
                Fin programado
              </div>
            </div>
          </div>
          {/* Mitad derecha — variación mensual */}
          <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden',position:'relative'}}>
            {/* Header + month chips */}
            <div style={{padding:'5px 8px',borderBottom:'1px solid #eee',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center'}}>
                <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#888',flex:1}}>
                  Variación mensual · {anioP1||'2026'}
                </div>
                {(selectedCausaP1 || selectedWeekP1) && (
                  <button onClick={() => { setSelectedCausaP1(null); setSelectedWeekP1(null); }}
                    style={{padding:'2px 8px',fontSize:'0.62rem',fontWeight:400,
                      border:'1px solid #2D4170',borderRadius:4,cursor:'pointer',
                      background:'transparent',color:'#222',whiteSpace:'nowrap',flexShrink:0}}>
                    Limpiar filtro
                  </button>
                )}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:4}}>
                {(() => {
                  const year = anioP1||'2026';
                  const mesesDisp = proyData ? Object.keys(proyData.meses).filter(ym=>ym.startsWith(year)).sort() : [];
                  return mesesDisp.map(ym => {
                    const isSel = ym === selectedMonthP1;
                    return (
                      <button key={ym}
                        onClick={() => { setSelectedMonthP1(ym); setSelectedWeekP1(null); }}
                        style={{padding:'2px 6px',fontSize:'0.6rem',fontWeight:isSel?700:400,
                          border:`1px solid ${isSel?'#5A5A8A':'#ddd'}`,borderRadius:10,cursor:'pointer',
                          background:isSel?'#5A5A8A':'transparent',color:isSel?'#fff':'#555'}}>
                        {ymLabel(ym).slice(0,3)}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
            {/* Causa bars for selected month + week chips inside */}
            {(() => {
              const causasMes = selectedMonthP1 && proyData?.meses[selectedMonthP1]
                ? Object.fromEntries(Object.entries(proyData.meses[selectedMonthP1].causas||{}).map(([c,v])=>[normCausa(c),v]))
                : {};
              const n = new Date();
              const curYM = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
              const foliosMes = proyData?.meses[selectedMonthP1]?.folios || [];
              const weeks = selectedMonthP1 === curYM
                ? getWeekChips(foliosMes).filter(w => {
                    const fri = new Date(w.key);
                    const thu = new Date(fri); thu.setDate(fri.getDate() + 6);
                    const toYM = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                    return toYM(fri) === selectedMonthP1 || toYM(thu) === selectedMonthP1;
                  })
                : [];
              return (
                <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden',paddingBottom:28}}>
                  <div style={{padding:'4px 8px 2px',fontSize:'0.55rem',fontWeight:700,color:'#888',flexShrink:0,
                    letterSpacing:'0.05em',borderBottom:'1px solid #f0f0f0'}}>
                    VARIACIÓN POR CAUSA{selectedMonthP1?` · ${ymLabel(selectedMonthP1)}`:''}
                  </div>
                  {weeks.length > 0 && (
                    <div style={{padding:'3px 8px 3px',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
                      <div style={{fontSize:'0.52rem',color:'#aaa',fontWeight:700,textTransform:'uppercase',
                        letterSpacing:'0.05em',marginBottom:2}}>Semanas Vie–Jue</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                        {weeks.map(w => {
                          const isSel = selectedWeekP1 === w.key;
                          return (
                            <button key={w.key}
                              onClick={() => setSelectedWeekP1(isSel ? null : w.key)}
                              style={{padding:'2px 6px',fontSize:'0.57rem',fontWeight:isSel?700:400,
                                border:`1px solid ${isSel?'#2D4170':'#ddd'}`,borderRadius:10,cursor:'pointer',
                                background:isSel?'#2D4170':'transparent',color:isSel?'#fff':'#555'}}>
                              {w.label} ({w.count})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <CausaBars
                    causaAcum={causasMes}
                    causas={data?.causas||[]}
                    selectedCausa={selectedCausaP1}
                    onSelectCausa={c => { setSelectedCausaP1(c); }}
                  />
                </div>
              );
            })()}
            {/* Total — posición absoluta en el fondo del panel */}
            {(() => {
              const causasMes = selectedMonthP1 && proyData?.meses[selectedMonthP1]
                ? Object.fromEntries(Object.entries(proyData.meses[selectedMonthP1].causas||{}).map(([c,v])=>[normCausa(c),v]))
                : {};
              const totalMes = selectedWeekP1
                ? foliosP3Month.reduce((s,f)=>s+f.valor,0)
                : selectedCausaP1
                  ? (causasMes[selectedCausaP1] ?? 0)
                  : Object.values(causasMes).reduce((s,v)=>s+v,0);
              return (
                <div style={{position:'absolute',bottom:0,left:0,right:0,
                  borderTop:'1px solid #e0e0e0',padding:'6px 8px',display:'flex',
                  alignItems:'center',gap:4,background:'var(--c-surface,#fff)'}}>
                  <div style={{flex:1,fontSize:'0.62rem',fontWeight:700,color:'#333'}}>
                    {selectedCausaP1 ? selectedCausaP1 : 'Total'}
                  </div>
                  <div style={{fontSize:'0.65rem',fontWeight:700,color:'#222'}}>
                    {(totalMes>=0?'+':'')+fmtM(totalMes)}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* P2 — Variación por actividad + Acumulada por causa */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',flexShrink:0,
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P2 · Variación acumulada</span>
            <span style={{display:'inline-flex',alignItems:'center',gap:4,marginLeft:8}}>
              <span style={{width:10,height:10,borderRadius:2,background:'#2E9E50',display:'inline-block'}}/>
              <span style={{fontSize:'0.6rem',color:'#555',fontWeight:600}}>CDD</span>
              <span style={{width:10,height:10,borderRadius:2,background:'#FF7043',display:'inline-block',marginLeft:4}}/>
              <span style={{fontSize:'0.6rem',color:'#555',fontWeight:600}}>CID</span>
            </span>
            <button
              onClick={() => { setSelectedCausa(null); setSelectedActivity(null); }}
              style={{marginLeft:'auto',padding:'2px 8px',fontSize:'0.62rem',fontWeight:400,
                border:'1px solid #2D4170',borderRadius:4,cursor:'pointer',
                background:'transparent',color:'#222',whiteSpace:'nowrap',flexShrink:0}}>
              Limpiar filtros
            </button>
          </div>
          <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}}>
            {/* Izquierda: Variación por actividad */}
            <div style={{flex:'1 1 0',padding:'6px 4px 4px 6px',display:'flex',flexDirection:'column',
              justifyContent:'flex-start',gap:2,minHeight:0,overflowY:'auto',
              border:'1px solid #e0e0e0',borderRadius:5,margin:'6px 4px 6px 6px'}}>
              <div style={{display:'flex',gap:3,borderBottom:'1px solid #e0e0e0',paddingBottom:3,marginBottom:2,flexShrink:0}}>
                <span style={{flex:'0 0 10px'}}/>
                <span style={{flex:1,fontSize:'0.55rem',color:'#888',fontWeight:700,textTransform:'uppercase'}}>Variación por actividad</span>
                <span style={{width:72,fontSize:'0.55rem',color:'#888',fontWeight:700,textAlign:'right'}}>Base</span>
                <span style={{width:72,fontSize:'0.55rem',color:'#1565C0',fontWeight:700,textAlign:'right'}}>Proy</span>
                <span style={{width:50,fontSize:'0.55rem',color:'#888',fontWeight:700,textAlign:'right'}}>%Δ</span>
              </div>
              {pptoCatsGranular ? (() => {
                const sortedGrps = [...CDD_APP_GROUPS]
                  .map(g => ({ grp: g, base: pptoCatsGranular[g.key] || 0, varia: variaGranular[g.key] || 0 }))
                  .filter(x => x.base > 0 || x.varia !== 0)
                  .sort((a, b) => {
                    const pa = a.base > 0 ? a.varia / a.base : (a.varia > 0 ? Infinity : -Infinity);
                    const pb = b.base > 0 ? b.varia / b.base : (b.varia > 0 ? Infinity : -Infinity);
                    return pb - pa;
                  });
                return sortedGrps.map(({ grp, base, varia }) => {
                  const proy = base + varia;
                  const pctDelta = base > 0 ? (varia / base * 100) : (varia !== 0 ? 100 : 0);
                  const deltaColor = pctDelta > 0 ? '#1a6b1a' : pctDelta < 0 ? '#b00' : '#888';
                  const pctStr = (pctDelta >= 0 ? '+' : '') + pctDelta.toFixed(1) + '%';
                  const isActSelected = selectedActivity === grp.key;
                  return (
                    <div key={grp.key}
                      onClick={() => { setSelectedActivity(isActSelected ? null : grp.key); setSelectedCausa(null); }}
                      style={{display:'flex',alignItems:'center',gap:3,minHeight:15,cursor:'pointer',
                        opacity: selectedActivity && !isActSelected ? 0.4 : 1,
                        background: isActSelected ? '#f0f4ff' : 'transparent', borderRadius:3, padding:'0 2px'}}>
                      {(() => { const tc = grp.tipo==='cid'?'#E64A19':(grp.codes||[]).some(c=>c.startsWith('CDD'))?'#2E9E50':'#888'; return (<>
                      <span style={{width:10,height:10,borderRadius:2,background:tc,flexShrink:0,display:'inline-block'}}/>
                      <span style={{flex:1,fontSize:'0.6rem',color:tc,fontWeight:700,
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}
                        title={grp.label}>{grp.label}</span>
                      </>); })()}
                      <span style={{width:72,fontSize:'0.6rem',color:'#555',fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{fmtM(base)}</span>
                      <span style={{width:72,fontSize:'0.6rem',color:'#1565C0',fontWeight:700,textAlign:'right',whiteSpace:'nowrap'}}>{fmtM(proy)}</span>
                      <span style={{width:50,fontSize:'0.6rem',fontWeight:700,color:deltaColor,textAlign:'right',whiteSpace:'nowrap'}}>
                        {pctStr}
                      </span>
                    </div>
                  );
                });
              })() : CDD_APP_GROUPS.map(grp => (
                <div key={grp.key} style={{display:'flex',alignItems:'center',gap:4,minHeight:15}}>
                  <span style={{width:10,height:10,borderRadius:2,background:grp.color,flexShrink:0,display:'inline-block'}}/>
                  <span style={{fontSize:'0.62rem',color:grp.color,fontWeight:700,lineHeight:1.1,
                    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {grp.label}
                  </span>
                </div>
              ))}
            </div>
            {/* Derecha: Variación acumulada por causa */}
            {(() => {
              const totalVar = Object.values(causaAcumTotal).reduce((s,v)=>s+v,0);
              return (
                <div style={{flex:'1 1 0',display:'flex',flexDirection:'column',borderLeft:'1px solid #f0f0f0',minHeight:0,overflow:'hidden'}}>
                  <div style={{padding:'12px 8px 3px',fontSize:'0.55rem',fontWeight:700,color:'#888',flexShrink:0,letterSpacing:'0.05em',borderBottom:'1px solid #e0e0e0'}}>
                    VARIACIÓN POR CAUSA
                  </div>
                  <CausaBars causaAcum={causaAcumTotal} causas={data?.causas || []}
                    selectedCausa={selectedCausa} onSelectCausa={c => { setSelectedCausa(c); setSelectedActivity(null); }} />
                  <div style={{borderTop:'1px solid #e0e0e0',padding:'6px 8px 6px',display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                    <div style={{flex:1,fontSize:'0.62rem',fontWeight:700,color: selectedCausa ? '#2D4170' : '#333'}}>
                      {selectedCausa ? selectedCausa : 'Total'}
                    </div>
                    <div style={{fontSize:'0.65rem',fontWeight:700,color:'#222'}}>
                      {(() => {
                        const v = selectedCausa ? (causaAcumTotal[selectedCausa] ?? 0) : totalVar;
                        return (v>=0?'+':'')+fmtM(v);
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* P3 — Detalle folios del mes seleccionado en P1 */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',flexShrink:0,
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P3</span>
            <span style={{fontSize:'0.75rem',fontWeight:600,color:'#5A5A8A'}}>
              · {selectedMonthP1 ? ymLabel(selectedMonthP1) : '—'}
              {selectedCausaP1 ? ` · ${selectedCausaP1}` : ''}
              {selectedWeekP1 ? ` · ${getWeekChips(proyData?.meses[selectedMonthP1]?.folios||[]).find(w=>w.key===selectedWeekP1)?.label||''}` : ''}
            </span>
            <span style={{marginLeft:'auto',fontSize:'0.65rem',color:'#888'}}>
              {foliosP3Month.length} folios · {fmtM((() => {
                if (selectedWeekP1) return foliosP3Month.reduce((s,f)=>s+f.valor,0);
                if (selectedCausaP1 && proyData?.meses[selectedMonthP1]?.causas) {
                  const causasMesP3 = Object.fromEntries(Object.entries(proyData.meses[selectedMonthP1].causas).map(([c,v])=>[normCausa(c),v]));
                  return causasMesP3[selectedCausaP1] ?? foliosP3Month.reduce((s,f)=>s+f.valor,0);
                }
                return foliosP3Month.reduce((s,f)=>s+f.valor,0);
              })())}
            </span>
          </div>
          <div style={{flex:1,overflowY:'auto',minHeight:0}}>
            {foliosP3Month.length === 0 ? (
              <div style={{padding:16,color:'#bbb',fontSize:'0.72rem',textAlign:'center'}}>Sin datos</div>
            ) : (
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
                  {foliosP3Month.map((f, i) => (
                    <tr key={i} style={{background: i%2===0?'transparent':'#fafafa',verticalAlign:'top'}}>
                      <td style={{padding:'4px 8px',color:'#2D4170',whiteSpace:'nowrap',fontSize:'0.65rem'}}>
                        {f.folio || '—'}
                      </td>
                      <td style={{padding:'4px 4px 4px 0',color:'#555',fontSize:'0.60rem',whiteSpace:'nowrap'}}>{f.causa||'—'}</td>
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
                      <td style={{padding:'4px 8px',color:'#444',lineHeight:1.35,fontSize:'0.65rem'}}>{f.comentario||'—'}</td>
                      <td style={{padding:'4px 8px',textAlign:'right',fontWeight:400,whiteSpace:'nowrap',
                        color: f.valor>=0?'#c62828':'#1565C0'}}>
                        {(f.valor>=0?'+':'')+fmtM(f.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* P4 — Folios por causa */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',flexShrink:0,
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P4</span>
            {selectedCausa
              ? <span style={{fontSize:'0.75rem',fontWeight:600,color:'#2D4170'}}>· {selectedCausa}</span>
              : selectedActivity
                ? <span style={{fontSize:'0.75rem',fontWeight:600,color:'#256E3A'}}>· {CDD_APP_GROUPS.find(g=>g.key===selectedActivity)?.label}</span>
                : <span style={{fontSize:'0.7rem',color:'#888'}}>· Total variación</span>}
            <span style={{marginLeft:'auto',fontSize:'0.65rem',color:'#888'}}>
              {hasRealFolios
                ? (() => {
                    const total = selectedCausa
                      ? (causaAcumTotal[selectedCausa] ?? foliosP3Data.reduce((s,f)=>s+f.valor,0))
                      : selectedActivity
                        ? (variaGranular[selectedActivity] ?? foliosP3Data.reduce((s,f)=>s+f.valor,0))
                        : foliosP3Data.reduce((s,f)=>s+f.valor,0);
                    return `${foliosP3Data.length} folios · Total ${fmtM(total)}`;
                  })()
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
