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

const CAUSA_COLORS = [
  '#5A5A8A','#3A7228','#A01010','#B85520','#7A1070',
  '#8A6010','#1A6070','#4A3F8A','#6A1030','#2A6030',
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

// ── Barra SVG mini ────────────────────────────────────────────────────────────
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
  const [loading, setLoading] = useState(true);
  const [anioP1, setAnioP1] = useState(null);
  const [selectedP1, setSelectedP1] = useState(null); // ym seleccionado en P1
  const [selectedP2, setSelectedP2] = useState(null); // ym seleccionado en P2
  const [sortP3, setSortP3] = useState('valor');
  const [sortP4, setSortP4] = useState('valor');

  useEffect(() => {
    fetch(remoteUrl('/data/proyecciones_data.json'))
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
        // Año por defecto = año más reciente en los datos del proyecto
        const proj = d.proyectos?.[macroKey];
        if (proj) {
          const years = [...new Set(Object.keys(proj.meses).map(ym => ym.slice(0,4)))].sort();
          if (years.length) setAnioP1(years[years.length-1]);
        }
      })
      .catch(() => setLoading(false));
  }, [macroKey]);

  const proyData = data?.proyectos?.[macroKey];

  // ── Causas y colores ────────────────────────────────────────────────────────
  const causaColors = useMemo(() => {
    if (!data?.causas) return {};
    const map = {};
    data.causas.forEach((c, i) => { map[c] = { color: CAUSA_COLORS[i % CAUSA_COLORS.length], data: {} }; });
    return map;
  }, [data]);

  // ── P1: meses del año seleccionado (acumulado) ──────────────────────────────
  const { p1Meses, p1CausaColors, p1Max, p1Acum } = useMemo(() => {
    if (!proyData || !anioP1) return { p1Meses:[], p1CausaColors:{}, p1Max:0, p1Acum:{} };
    const meses = Object.keys(proyData.meses)
      .filter(ym => ym.startsWith(anioP1))
      .sort();
    const cc = {};
    Object.keys(causaColors).forEach(c => { cc[c] = { ...causaColors[c], data: {} }; });
    // acumulado mes a mes
    const acumPorCausa = {};
    meses.forEach(ym => {
      const causas = proyData.meses[ym]?.causas || {};
      Object.entries(causas).forEach(([c, v]) => {
        acumPorCausa[c] = (acumPorCausa[c] || 0) + v;
        if (cc[c]) cc[c].data[ym] = acumPorCausa[c];
      });
    });
    const max = Math.max(0, ...meses.map(ym =>
      Object.values(cc).reduce((s, cd) => s + Math.max(0, cd.data[ym]||0), 0)
    ));
    return { p1Meses: meses, p1CausaColors: cc, p1Max: max, p1Acum: acumPorCausa };
  }, [proyData, anioP1, causaColors]);

  // ── P2: meses del año seleccionado (mensual) ────────────────────────────────
  const { p2Meses, p2CausaColors, p2Max } = useMemo(() => {
    if (!proyData || !anioP1) return { p2Meses:[], p2CausaColors:{}, p2Max:0 };
    const meses = Object.keys(proyData.meses)
      .filter(ym => ym.startsWith(anioP1))
      .sort();
    const cc = {};
    Object.keys(causaColors).forEach(c => { cc[c] = { ...causaColors[c], data: {} }; });
    meses.forEach(ym => {
      const causas = proyData.meses[ym]?.causas || {};
      Object.entries(causas).forEach(([c, v]) => {
        if (cc[c]) cc[c].data[ym] = (cc[c].data[ym] || 0) + v;
      });
    });
    const max = Math.max(0, ...meses.map(ym =>
      Object.values(cc).reduce((s, cd) => s + Math.max(0, cd.data[ym]||0), 0)
    ));
    return { p2Meses: meses, p2CausaColors: cc, p2Max: max };
  }, [proyData, anioP1, causaColors]);

  // ── Años disponibles ────────────────────────────────────────────────────────
  const anos = useMemo(() => {
    if (!proyData) return [];
    return [...new Set(Object.keys(proyData.meses).map(ym => ym.slice(0,4)))].sort();
  }, [proyData]);

  // ── Folios P3 (acumulado hasta mes seleccionado) ────────────────────────────
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

  // ── Folios P4 (solo mes seleccionado) ───────────────────────────────────────
  const foliosP4 = useMemo(() => {
    if (!proyData || !selectedP2) return [];
    return proyData.meses[selectedP2]?.folios || [];
  }, [proyData, selectedP2]);

  const titulo = LABELS[macroKey] || macroKey?.toUpperCase();

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
      <div className="spinner" /><span style={{marginLeft:8}}>Cargando proyecciones…</span>
    </div>
  );

  if (!proyData) return (
    <div style={{padding:20}}>
      <button className="ov-btn" onClick={() => navigate(-1)}>← Volver</button>
      <p style={{marginTop:16,color:'#666'}}>Sin datos de proyecciones para {titulo}.</p>
      <p style={{color:'#999',fontSize:'0.8rem'}}>Corre gen_proyecciones_api.py para generar proyecciones_data.json</p>
    </div>
  );

  const causasActivas = data.causas.filter(c =>
    p1Meses.some(ym => (proyData.meses[ym]?.causas?.[c] || 0) !== 0)
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--c-bg,#f8f8f8)'}}>

      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px',
        background:'var(--c-surface,#fff)',borderBottom:'1px solid #ddd',flexShrink:0}}>
        <button className="ov-btn" onClick={() => navigate(-1)}>← Volver</button>
        <span style={{fontWeight:700,fontSize:'0.95rem',color:'#333'}}>{titulo} — Proyecciones</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:'0.75rem',color:'#666'}}>Año:</span>
          {anos.map(a => (
            <button key={a}
              style={{padding:'2px 8px',border:'1px solid #ccc',borderRadius:4,cursor:'pointer',
                fontSize:'0.75rem',fontWeight: a===anioP1?700:400,
                background: a===anioP1?'#5A5A8A':'transparent',
                color: a===anioP1?'#fff':'#333'}}
              onClick={() => { setAnioP1(a); setSelectedP1(null); setSelectedP2(null); }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* ── Leyenda causas ── */}
      <div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px',padding:'6px 16px',
        background:'var(--c-surface,#fff)',borderBottom:'1px solid #eee',flexShrink:0}}>
        {causasActivas.map(c => (
          <span key={c} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.68rem'}}>
            <span style={{width:10,height:10,borderRadius:2,background:causaColors[c]?.color,display:'inline-block'}}/>
            {c}
          </span>
        ))}
      </div>

      {/* ── Paneles 2x2 ── */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',
        gridTemplateRows:'1fr 1fr',gap:8,padding:8,minHeight:0}}>

        {/* P1 — Variación Acumulada */}
        <div style={{background:'var(--c-surface,#fff)',borderRadius:6,border:'1px solid #ddd',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'6px 12px',borderBottom:'1px solid #eee',display:'flex',
            alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span style={{fontWeight:700,fontSize:'0.78rem',color:'#333'}}>P1 Variación Acumulada</span>
            {selectedP1 && (
              <span style={{fontSize:'0.7rem',color:'#5A5A8A',fontWeight:600}}>
                hasta {ymLabel(selectedP1)}
              </span>
            )}
          </div>
          <div style={{flex:1,padding:'6px 8px',minHeight:0,overflowX:'auto'}}>
            {p1Meses.length === 0
              ? <span style={{color:'#999',fontSize:'0.75rem'}}>Sin datos en {anioP1}</span>
              : <BarChart meses={p1Meses} causas={causasActivas}
                  causaColors={p1CausaColors} maxVal={p1Max}
                  onSelect={ym => setSelectedP1(ym === selectedP1 ? null : ym)}
                  selected={selectedP1} />
            }
          </div>
          {selectedP1 && (
            <div style={{padding:'4px 12px',borderTop:'1px solid #eee',
              fontSize:'0.72rem',color:'#555',flexShrink:0}}>
              Total acum.: <strong style={{color:'#5A5A8A'}}>{fmtM(foliosP3.reduce((s,f)=>s+f.valor,0))}</strong>
            </div>
          )}
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
                  Selecciona un mes en P1
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
