import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const fmtM = v => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs/1e9).toFixed(1)}`;
  if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(0)}M`;
  return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`;
};

// Valores de Presupuesto fijos por macroKey — NO se recalculan desde la fuente de datos.
// Fuente: "Valor columna presupuesto.xlsx". Solo aplica a los proyectos listados aquí;
// cualquier otro macroKey sigue tomando el Presupuesto dinámicamente de estado_detalle_data.json.
const FIXED_PPTO = {
  'mit-11':  { cdd: 21266854881.7913 + 7448854672.3511, cid: 1108895102.5575 + 0 }, // Mitika 1.1 + Mitika zc
  'opo-e12': { cdd: 41601895567.9881, cid: 2697936025.6638 },
  'opo-e3':  { cdd: 21388001028.4762, cid: 1501434109.9339 },
  'azt-e1':  { cdd: 20417655793.1077, cid: 1091905381.0377 },
  'azt-e2':  { cdd: 18937370079.25,   cid: 1429506544.99 },
  'azc-e1':  { cdd: 22222642243.2616, cid: 1274524283.0723 },
  'azc-e2':  { cdd: 8631689000.07,    cid: 804429158.32 },
  'azc-e3':  { cdd: 5707117630.799999, cid: 980177401.83 },
  'ver-e1':  { cdd: 16647574852.364597, cid: 751808121.0101999 },
  'ver-e2':  { cdd: 15513662308.3082, cid: 692949690.1314 },
  'ver-e3':  { cdd: 8535683553.454802, cid: 111607362.7239 },
  'cai-e2b': { cdd: 16627358121.57,   cid: 1718076464.3400002 },
  'cai-zc':  { cdd: 1845525391.95,    cid: 14725666.81 },
  'bosque':  { cdd: 69199099607.5925, cid: 3964572253.3732 },
};

// Etapas que componen cada macro-proyecto (para la vista "Todo") — mismas claves que PROJECT_SUBS en Dashboard.jsx.
// El Presupuesto de "Todo" = suma de sus etapas, usando el valor fijo donde exista y el dinámico donde no.
const MACRO_SUBS = {
  'mitika':   ['mit-11', 'mit-12'],
  'azul-t':   ['azt-e1', 'azt-e2'],
  'azul-c':   ['azc-e1', 'azc-e2', 'azc-e3'],
  'cast-i':   ['cai-e2b', 'cai-zc'],
  'hacienda': ['hac-e1', 'hac-ref', 'hac-e3'],
  'primera':  ['pri-e12', 'pri-zc'],
  'oporto':   ['opo-e12', 'opo-e3'],
  'praia':    ['pra-e1', 'pra-e2', 'pra-zc'],
  'verde':    ['ver-e1', 'ver-e2', 'ver-e3'],
};

const COL_DEFS = [
  { label:'Presupuesto', colorFondo:'#C8C4D8', colorCDD:'#5A5A8A', colorCID:'#9490B8', pctRef: null },
  { label:'Proyectado',  colorFondo:'#D4AAAA', colorCDD:'#6C0000', colorCID:'#9C3030', pctRef: 'ppto' },
  { label:'Asegurado',   colorFondo:'#D8C898', colorCDD:'#8A6010', colorCID:'#B89040', pctRef: 'proy' },
  { label:'Consumido',   colorFondo:'#AACAAA', colorCDD:'#3A7228', colorCID:'#6AA258', pctRef: 'proy' },
  { label:'Por Aseg.',   colorFondo:'#D8AAAA', colorCDD:'#A01010', colorCID:'#C04040', pctRef: 'proy' },
];

// SVG dimensions — igual que dashboard.html
const W = 400, SH = 175;
const pad = { t: 30, r: 8, b: 22, l: 12 };
const chartH = SH - pad.t - pad.b;
const N = 5;
const cW = (W - pad.l - pad.r) / N;
const barW = cW * 0.68;
const gap = 3;
const thinW = (barW - gap) / 2;
const FONT = 'Century Gothic,Nunito,sans-serif';

export default function Panel1Estado({ loading, corte, detalleData, macroKey, macro, estadoData }) {
  const navigate = useNavigate();

  const data = useMemo(() => {
    if (!macroKey) return null;
    const entry = detalleData?.[macroKey];
    if (!entry?.items?.length) return null;

    // Totales reales (todos los capítulos) vienen de entry.totales si existe
    // PA y alertas se calculan solo desde items (PA != 0)
    const tot = entry.totales || {};
    let pptoCDD = 0, pptoCID = 0;
    let proyCDD = 0, proyCID = 0;
    let asegCDD = 0, asegCID = 0;
    let consCDD = 0, consCID = 0;
    let paCDD   = 0, paCID   = 0;
    let critPa = 0, otrosPa = 0, adminPa = 0;
    const capPa = {}, capCrit = {}, capAdmin = {};

    for (const it of entry.items) {
      const isCID = it.tipo === 'cid';
      const proy  = it.proy ?? 0;
      const pa    = it.pa   ?? 0;
      const cap   = it.cap  || '?';

      if (isCID) {
        paCID += pa;
        adminPa += pa;
        capAdmin[cap] = (capAdmin[cap] || 0) + pa;
      } else {
        paCDD += pa;
        capPa[cap]  = (capPa[cap]  || 0) + pa;
        const esCrit = proy > 0 && pa / proy > 0.70;
        capCrit[cap] = capCrit[cap] || esCrit;
        if (esCrit) critPa += pa; else otrosPa += pa;
      }
    }

    // Si hay totales precalculados (cdd/cid separados) usarlos; si no, sumar desde items
    if (tot.cdd != null) {
      pptoCDD = tot.cdd.ppto ?? 0; pptoCID = tot.cid?.ppto ?? 0;
      proyCDD = tot.cdd.proy ?? 0; proyCID = tot.cid?.proy ?? 0;
      asegCDD = tot.cdd.aseg ?? 0; asegCID = tot.cid?.aseg ?? 0;
      consCDD = tot.cdd.cons ?? 0; consCID = tot.cid?.cons ?? 0;
    } else {
      for (const it of entry.items) {
        const isCID = it.tipo === 'cid';
        if (isCID) { pptoCID += it.ppto??0; proyCID += it.proy??0; asegCID += it.aseg??0; consCID += it.cons??0; }
        else        { pptoCDD += it.ppto??0; proyCDD += it.proy??0; asegCDD += it.aseg??0; consCDD += it.cons??0; }
      }
    }

    // Override SOLO de Presupuesto para proyectos con valor fijo (no viene de la fuente)
    const subKeys = MACRO_SUBS[macroKey];
    if (subKeys) {
      // Vista "Todo" de un macro con etapas: sumar Presupuesto por etapa,
      // usando el valor fijo donde exista y el dinámico (de la fuente) donde no.
      pptoCDD = 0; pptoCID = 0;
      for (const sk of subKeys) {
        const skFixed = FIXED_PPTO[sk];
        if (skFixed) {
          pptoCDD += skFixed.cdd; pptoCID += skFixed.cid;
        } else {
          const skTot = detalleData?.[sk]?.totales;
          pptoCDD += skTot?.cdd?.ppto ?? 0;
          pptoCID += skTot?.cid?.ppto ?? 0;
        }
      }
    } else {
      const fixed = FIXED_PPTO[macroKey];
      if (fixed) { pptoCDD = fixed.cdd; pptoCID = fixed.cid; }
    }

    const totPpto = pptoCDD + pptoCID || 1;
    const totProy = proyCDD + proyCID || 1;

    const cols = COL_DEFS.map((def, i) => {
      const [cddV, cidV] = [
        [pptoCDD, pptoCID],
        [proyCDD, proyCID],
        [asegCDD, asegCID],
        [consCDD, consCID],
        [paCDD,   paCID],
      ][i];
      const cdd = Math.max(cddV, 0);
      const cid = Math.max(cidV, 0);
      const ref = def.pctRef === 'ppto' ? totPpto : def.pctRef === 'proy' ? totProy : null;
      return { ...def, cdd, cid, tot: cdd + cid, ref };
    });

    const maxV = Math.max(...cols.map(c => c.tot), 1);

    const totalPa  = critPa + otrosPa + adminPa;
    const critPct  = totalPa > 0 ? critPa  / totalPa : 0;
    const otrosPct = totalPa > 0 ? otrosPa / totalPa : 0;

    // Barras ordenadas: 1) Críticos  2) Otros  3) Admin — hasta 5 en total
    const critList  = Object.entries(capPa).filter(([c]) =>  capCrit[c]).sort((a,b) => b[1]-a[1]).map(([cap,pa]) => ({ cap, pa, grupo:'crit' }));
    const otrosList = Object.entries(capPa).filter(([c]) => !capCrit[c]).sort((a,b) => b[1]-a[1]).map(([cap,pa]) => ({ cap, pa, grupo:'otros' }));
    const adminList = Object.entries(capAdmin).sort((a,b) => b[1]-a[1]).map(([cap,pa]) => ({ cap, pa, grupo:'admin' }));

    const topCaps = [...critList, ...otrosList, ...adminList].slice(0, 5);
    const maxCapPa = Math.max(...topCaps.map(c => c.pa), 1);

    return { cols, maxV, totalPa, critPa, otrosPa, adminPa, critPct, otrosPct, topCaps, maxCapPa };
  }, [detalleData, macroKey]);

  // Render SVG bars
  const svgBars = useMemo(() => {
    if (!data) return null;

    const baseY = pad.t + chartH;
    const elems = [];

    // Baseline
    elems.push(
      <line key="base" x1={pad.l} y1={baseY} x2={W - pad.r} y2={baseY}
        stroke="#CFCFCF" strokeWidth={1} />
    );

    data.cols.forEach((col, i) => {
      const x    = pad.l + i * cW + (cW - barW) / 2;
      const cx   = x + barW / 2;
      const hTot = (col.tot / data.maxV) * chartH;
      const hCDD = (col.cdd / data.maxV) * chartH;
      const hCID = (col.cid / data.maxV) * chartH;
      const topY = baseY - hTot;
      const topCDD = baseY - hCDD;
      const topCID = baseY - hCID;
      const xCDD = x;
      const xCID = x + thinW + gap;
      const cxCDD = xCDD + thinW / 2;
      const cxCID = xCID + thinW / 2;

      // Fondo — color propio, opacidad 0.45, altura proporcional
      elems.push(
        <rect key={`fondo-${i}`} x={x} y={topY} width={barW} height={hTot}
          fill={col.colorFondo} fillOpacity={0.45}
          stroke={col.colorFondo} strokeWidth={0.75} strokeOpacity={1} />
      );

      // CDD bar
      elems.push(
        <rect key={`cdd-${i}`} x={xCDD} y={topCDD} width={thinW} height={hCDD}
          fill={col.colorCDD} fillOpacity={0.7}
          stroke={col.colorCDD} strokeWidth={0.75} strokeOpacity={1} />
      );

      // CID bar
      elems.push(
        <rect key={`cid-${i}`} x={xCID} y={topCID} width={thinW} height={hCID}
          fill={col.colorCID} fillOpacity={0.7}
          stroke={col.colorCID} strokeWidth={0.75} strokeOpacity={1} />
      );

      // "Costo Directo" / "Costo Indirecto" — solo primera columna
      if (i === 0) {
        const midCDD = topCDD + hCDD / 2;
        const lxCDD = xCDD - 10;
        const lxCID = x + barW + 10;
        elems.push(
          <text key="lbl-cdd" x={lxCDD} y={midCDD} textAnchor="middle"
            fontSize={8.5} fill={col.colorCDD} fontWeight={400}
            stroke="#fff" strokeWidth={2} paintOrder="stroke fill"
            fontFamily={FONT}
            transform={`rotate(-90 ${lxCDD} ${midCDD})`}>
            Costo Directo
          </text>
        );
        elems.push(
          <text key="lbl-cid" x={lxCID} y={midCDD} textAnchor="middle"
            fontSize={8.5} fill={col.colorCID} fontWeight={400}
            stroke="#fff" strokeWidth={2} paintOrder="stroke fill"
            fontFamily={FONT}
            transform={`rotate(-90 ${lxCID} ${midCDD})`}>
            Costo Indirecto
          </text>
        );
      }

      // Valor + % dentro de CDD
      const pctCDD = col.ref
        ? (col.cdd / col.ref * 100).toFixed(1)
        : (col.tot > 0 ? (col.cdd / col.tot * 100).toFixed(1) : '0.0');
      if (hCDD > 26) {
        elems.push(
          <text key={`vcdd-${i}`} x={cxCDD} y={topCDD + 12}
            textAnchor="middle" fontSize={6} fill="#fff" fontFamily={FONT}>
            {fmtM(col.cdd)}
          </text>
        );
        elems.push(
          <text key={`pcdd-${i}`} x={cxCDD} y={topCDD + 20}
            textAnchor="middle" fontSize={5.5} fill="#fff" fillOpacity={0.82}
            fontFamily={FONT}>
            {pctCDD}%
          </text>
        );
      } else if (hCDD > 10) {
        elems.push(
          <text key={`vcdd-${i}`} x={cxCDD} y={topCDD + 9}
            textAnchor="middle" fontSize={6} fill="#fff" fontFamily={FONT}>
            {fmtM(col.cdd)}
          </text>
        );
      }

      // Valor CID encima de la barra CID
      if (topCID - 4 < topY - 16) {
        elems.push(
          <text key={`vcid-${i}`} x={cxCID} y={topCID - 4}
            textAnchor="middle" fontSize={6} fill={col.colorCID} fontFamily={FONT}>
            {fmtM(col.cid)}
          </text>
        );
      }

      // Valor total + % encima de la barra
      const lblBase = topY - 3;
      const lblValY = lblBase - 11;
      const pctColor = col.ref
        ? (col.tot / col.ref > 1.05 ? '#C01010' : col.tot / col.ref > 0.95 ? '#C07010' : '#3A7228')
        : '#111';
      elems.push(
        <text key={`vtot-${i}`} x={cx} y={lblValY}
          textAnchor="middle" fontSize={10} fill="#111" fontFamily={FONT}
          fontWeight={700}>
          {fmtM(col.tot)}
        </text>
      );
      if (col.ref) {
        const pct = (col.tot / col.ref * 100).toFixed(1);
        elems.push(
          <text key={`ptot-${i}`} x={cx} y={lblBase}
            textAnchor="middle" fontSize={7.5} fill={pctColor} fontFamily={FONT}
            fontWeight={700}>
            {pct}%
          </text>
        );
      }

      // Etiqueta inferior
      elems.push(
        <text key={`lbot-${i}`} x={cx} y={baseY + 12}
          textAnchor="middle" fontSize={7.5} fill="#555" fontFamily={FONT}>
          {col.label}
        </text>
      );
    });

    return elems;
  }, [data]);

  return (
    <div className="ov-panel p1">
      <div className="ov-side"><span className="ov-title">Estado del Proyecto</span></div>
      <div className="ov-body">

        {loading && !data && (
          <div className="state-center" style={{height:'100%'}}>
            <div className="spinner" /><span>Cargando…</span>
          </div>
        )}
        {!loading && !data && (
          <div className="state-center" style={{height:'100%'}}><span>Selecciona un proyecto</span></div>
        )}

        {data && (
          <div className="p1-inner">

            {/* ── IZQUIERDA: SVG gráfico ── */}
            <div className="p1-chart">
              <svg viewBox={`0 0 ${W} ${SH}`} preserveAspectRatio="xMidYMid meet"
                style={{width:'100%', height:'100%', display:'block'}}>
                {svgBars}
              </svg>
              <div className="p1-legend">
                <span className="p1-leg-dot" style={{background:'#6C0000'}} />Directos CDD
                <span className="p1-leg-dot" style={{background:'#B85520', marginLeft:8}} />Indirectos CID
              </div>
            </div>

            {/* ── DERECHA: Por Asegurar ── */}
            <div className="p1-pa">
              <div className="p1-pa-top-row">
                <div className="p1-pa-header">Por Asegurar</div>
                              </div>
              <div className="p1-pa-chips">
                <span className="p1-chip crit">▲ Crit. {fmtM(data.critPa)} {(data.critPct*100).toFixed(0)}%</span>
                <span className="p1-chip otros">✓ Otros {fmtM(data.otrosPa)} {(data.otrosPct*100).toFixed(0)}%</span>
                {data.adminPa > 0 && (
                  <span className="p1-chip admin">Admin {fmtM(data.adminPa)}</span>
                )}
              </div>
              {data.topCaps.length > 0 && (
                <div className="p1-pa-list">
                  {data.topCaps.map((c, i) => {
                    const parts  = c.cap.split('-');
                    const code   = parts[0];
                    const name   = parts.slice(1).join('-').trim();
                    const barPct = data.maxCapPa > 0 ? c.pa / data.maxCapPa : 0;
                    const barClr = c.grupo === 'crit' ? '#A01010' : c.grupo === 'admin' ? '#5B8FC9' : '#3A7228';
                    return (
                      <div key={i} className="p1-pa-row">
                        <div className="p1-pa-row-top">
                          <span className="p1-pa-code" style={{color: barClr}}>{code}</span>
                          <span className="p1-pa-name">{name}</span>
                          <span className="p1-pa-val">{fmtM(c.pa)}</span>
                        </div>
                        <div className="p1-pa-bar-bg">
                          <div className="p1-pa-bar-fill" style={{width:`${barPct*100}%`, background: barClr}} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {data && (macroKey || macro?.key) && (
          <div className="ov-footer">
            <button className="ov-btn ov-btn-primary"
              onClick={() => navigate(`/proyecciones/${macroKey || macro.key}`)}>
              Ver detalle proyecciones »
            </button>
            <button className="ov-btn ov-btn-primary" style={{marginLeft:'auto'}}
              onClick={() => navigate(`/estado/${macroKey || macro.key}`)}>
              Ver detalle por asegurar »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
