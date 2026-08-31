import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const today = new Date();

function parseFecha(str) {
  if (!str) return null;
  const p = str.split('/');
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
  return null;
}

function classifyContract(r, acumulado, saldoAnticipo, saldoRte) {
  const faltante   = (r._valorContrato || 0) - acumulado;
  const fd         = parseFecha(r['Fecha fin'] || r['Fecha Final']);
  const vencido    = fd ? fd < today : false;
  const noVenc     = !fd || fd >= today;
  const estadoBase = r._estadoBase;

  if (faltante < 1 && (saldoAnticipo >= 1 || saldoRte >= 1)) return 'liquidar';
  if (estadoBase === 'Cerrado' && faltante < 1 && saldoAnticipo < 1 && saldoRte < 1) return 'cerrado';
  if (estadoBase !== 'Cerrado' && faltante < 1 && saldoAnticipo < 1 && saldoRte < 1) return 'por_cerrar';
  if (estadoBase === 'Por Aprobación' && noVenc && faltante >= 1) return 'por_aprobacion';
  if (vencido && acumulado === 0 && faltante >= 1) return 'no_inic_venc';
  if (vencido && faltante >= 1 && acumulado > 0) return 'venc_con_saldo';
  if (faltante >= 1 && noVenc && estadoBase === 'Abierto') return 'en_ejecucion';
  return 'sin_clasificar';
}

const fmtM = v => {
  if (!v && v !== 0) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'MM';
  if (abs >= 1e6) return '$' + Math.round(v / 1e6) + 'M';
  if (abs >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
  return '$' + Math.round(v);
};

function calcIrrCount(balanceData, macroKey, contratosStatic) {
  if (!balanceData || !macroKey || !balanceData[macroKey]) return 0;
  const normN = s => (s || '').toUpperCase().trim().replace(/\s+/g, ' ').replace(/\.+$/, '');

  const brows = balanceData[macroKey].rows || [];
  const gtaMap = {};
  brows.forEach(r => {
    if (r.acct === 'Gta. Cumplimiento' && r.saldo > 0)
      gtaMap[normN(r.tercero)] = (gtaMap[normN(r.tercero)] || 0) + r.saldo;
  });

  const contracts = contratosStatic || [];
  // NC → contratista
  const ncToContratista = {};
  contracts.forEach(c => { if (c.noContrato) ncToContratista[String(c.noContrato)] = normN(c.contratista); });

  const conActaMap = {};
  let ekTotal = 0;
  brows.forEach(r => {
    if (!r.saldo || r.saldo < 1) return;
    if (r.acct === 'Con Acta') {
      const cont = normN(r.tercero || '');
      if (cont) conActaMap[cont] = (conActaMap[cont] || 0) + r.saldo;
    } else if (r.acct === 'Con Acta EK') {
      ekTotal += r.saldo;
    }
  });
  if (ekTotal > 0) {
    const gtaTotal = Object.values(gtaMap).reduce((s, v) => s + v, 0);
    if (gtaTotal > 0)
      Object.entries(gtaMap).forEach(([k, gta]) => {
        conActaMap[k] = (conActaMap[k] || 0) + ekTotal * (gta / gtaTotal);
      });
  }

  const rteByTercero = {};
  contracts.forEach(r => {
    const k = normN(r.contratista);
    rteByTercero[k] = (rteByTercero[k] || 0) + (r.saldoRte || 0);
  });

  const TOL = 1000;
  let count = 0;
  Object.keys(gtaMap).forEach(k => {
    const gta      = gtaMap[k]      || 0;
    if (gta < TOL) return;
    const conActa  = conActaMap[k]  || 0;
    const saldoRte = rteByTercero[k]|| 0;
    const remanente = gta - conActa;
    if (remanente > saldoRte + TOL) count++;
  });
  return count;
}

export default function Panel3Contratos({
  loading, especContratosRows, especActasRows, actasF,
  macro, activeSub, liquidados, contratosStatic,
  balanceData, macroKey,
}) {
  const navigate = useNavigate();

  const data = useMemo(() => {
    if (contratosStatic) {
      const counts = {};
      const antByK = {};
      const rteByK = {};
      let totalAnt = 0, totalRte = 0;
      for (const c of contratosStatic) {
        const k = c.estado || 'sin_clasificar';
        counts[k] = (counts[k] || 0) + 1;
        const ant = c.saldoAnticipo || 0;
        const rte = c.saldoRte || 0;
        antByK[k] = (antByK[k] || 0) + ant;
        rteByK[k] = (rteByK[k] || 0) + rte;
        totalAnt += ant;
        totalRte += rte;
      }
      return { total: contratosStatic.length, counts, antByK, rteByK, totalAnt, totalRte };
    }

    if (!especContratosRows?.length) return null;

    const projectCodes = new Set((macro?.skidsDir || []).map(sk => sk - 100000));
    // Deduplicar por (No Contrato, No Acta) — Valor Total Acta se repite en cada ítem
    const acumByNC = {};
    const actasVistasP3 = new Set();
    for (const r of (actasF || [])) {
      const nc    = String(r['No. Contrato'] ?? r['No Contrato'] ?? '');
      const acta  = r['No Acta'];
      if (!nc) continue;
      const clave = `${nc}|${acta}`;
      if (actasVistasP3.has(clave)) continue;
      actasVistasP3.add(clave);
      acumByNC[nc] = (acumByNC[nc] || 0) + (Number(r['Valor Total Acta'] ?? 0));
    }
    const saldosByNC = {};
    for (const r of (especActasRows || [])) {
      const nc = String(r['No Contrato'] ?? r['No. Contrato'] ?? '');
      if (!nc) continue;
      if (!saldosByNC[nc]) saldosByNC[nc] = { anticipo: 0, rte: 0 };
      saldosByNC[nc].anticipo += r['Saldo Anticipo']  ?? 0;
      saldosByNC[nc].rte      += r['Saldo Retencion'] ?? r['Saldo Retención'] ?? 0;
    }
    const actasByNC = {};
    for (const r of (especActasRows || [])) {
      const nc = r['No Contrato'] ?? r['No. Contrato'];
      if (!nc) continue;
      if (projectCodes.size > 0 && !projectCodes.has(Math.floor(nc / 10000))) continue;
      actasByNC[nc] = (actasByNC[nc] || 0) + 1;
    }

    const counts = { por_aprobacion: 0, no_inic_venc: 0, en_ejecucion: 0, venc_con_saldo: 0, liquidar: 0, por_cerrar: 0, cerrado: 0, sin_clasificar: 0 };
    const seen = new Set();
    let total = 0;

    for (const r of especContratosRows) {
      const nc = r['No. Contrato'];
      if (!nc) continue;
      if (projectCodes.size > 0 && !projectCodes.has(Math.floor(nc / 10000))) continue;
      if (seen.has(nc)) continue;
      seen.add(nc);
      total++;
      const ncStr = String(nc);
      const numActas = actasByNC[nc] || 0;
      let estadoBase = r['nopago'] === true ? 'Cerrado' : numActas > 0 ? 'Abierto' : 'Por Aprobación';
      if (liquidados?.[ncStr]?.liquidado > 0) { counts.cerrado++; continue; }
      const enriched = { ...r, _estadoBase: estadoBase, _valorContrato: r['Valor Contrato'] ?? r['valorContrato'] ?? 0 };
      const saldos   = saldosByNC[ncStr] || {};
      const acum     = acumByNC[ncStr] || 0;
      const cat      = classifyContract(enriched, acum, saldos.anticipo || 0, saldos.rte || 0);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    return { total, counts };
  }, [especContratosRows, especActasRows, actasF, macro, liquidados, contratosStatic]);

  // A&F totals desde balanceData
  const afData = useMemo(() => {
    const t = balanceData?.[macroKey]?.totals || null;
    if (!t) return null;
    const gta        = t.gar_cum     || 0;
    const completado = t.completado  || 0;
    const liquidado  = t.liquidado   || 0;
    const con_acta   = t.con_acta    || 0;
    const con_acta_ek= t.con_acta_ek || 0;
    const base100    = gta + completado + liquidado;
    const avance     = completado + liquidado + con_acta + con_acta_ek;
    const pct        = base100 > 0 ? Math.round(avance / base100 * 100) : 0;
    return {
      gta,
      ant:         t.ant_cont || 0,
      liquidado,
      completado,
      con_acta,
      con_acta_ek,
      pct,
    };
  }, [balanceData, macroKey]);

  const balanceKey = activeSub?.key || macroKey;
  const irrCount = useMemo(() =>
    calcIrrCount(balanceData, balanceKey, contratosStatic),
    [balanceData, balanceKey, contratosStatic]
  );

  const hasAFData = !!afData;
  const irrColW   = hasAFData ? 210 : 100;

  // Colores y opacidades exactas del SVG original (dashboard.html)
  const GRUPOS = [
    { key: 'por_aprobacion', label: 'Por Aprobación', cls: 'cat-apro', color: '#8A6010', alpha: 0.65,
      sub: { key: 'no_inic_venc',  label: '· No Inic. Vencidos',  color: '#B85520', alpha: 0.70 } },
    { key: 'en_ejecucion',   label: 'En Ejecución',   cls: 'cat-ejec', color: '#4A3F8A', alpha: 0.65,
      sub: { key: 'venc_con_saldo', label: '· Vencidos con Saldo', color: '#A01010', alpha: 0.70 } },
    { key: 'liquidar',       label: 'Liquidar',        cls: 'cat-liq',  color: '#7A1070', alpha: 0.65,
      sub: { key: 'por_cerrar',     label: '· Cerrar',             color: '#1A6080', alpha: 0.65 } },
    { key: 'cerrado',        label: 'Cerrados',        cls: 'cat-cerr', color: '#3A7228', alpha: 0.60, sub: null },
  ];

  function irDetalle(estadoKey) {
    if (!macro?.key) return;
    navigate(`/contratos/${macro.key}`, {
      state: {
        filtroEstado: estadoKey,
        subPrefixes:  activeSub?.prefixes || null,
        subExact:     activeSub?.exact    ?? false,
        subLabel:     activeSub?.label    || null,
        subKey:       activeSub?.key      || null,
      },
    });
  }

  return (
    <div className="ov-panel p3">
      <div className="ov-side"><span className="ov-title">Estado de Contratos</span></div>
      <div className="ov-body p3-body-row">


        {loading && !data && (
          <div className="state-center"><div className="spinner" /><span>Cargando…</span></div>
        )}
        {!loading && !data && (
          <div className="state-center"><span>Selecciona un proyecto</span></div>
        )}

        {data && (<>
          {/* ── Columna izquierda: embudo ── */}
          <div className="p3-chart-col">
            <div className="p3-chart-box">

              <div className="p3-adpro-hdr">
                <span className="p3-adpro-hdr-lbl">Estado de Contratos</span>
                <span className="p3-adpro-badge">ADPRO</span>
              </div>

              {/* Fila total */}
              {(() => {
                const ant = data.totalAnt || 0;
                const rte = data.totalRte || 0;
                return (
                  <div className="p3-row p3-row-total" onClick={() => irDetalle(null)}>
                    <span className="p3-lbl">Total contratos</span>
                    <span className="p3-cnt">{data.total}</span>
                    <div className="p3-bar-wrap">
                      <div className="p3-bar p3-bar-total" style={{ width: '100%' }} />
                    </div>
                    <span className="p3-pct">100%</span>
                    <span className="p3-saldos">
                      {rte >= 1000 && <span className="p3-rte">{fmtM(rte)}</span>}
                      {ant >= 1000 && <span className="p3-ant">{fmtM(ant)}</span>}
                    </span>
                  </div>
                );
              })()}

              <div className="p3-cats">
                {GRUPOS.map(g => {
                  const count      = data.counts[g.key] || 0;
                  const subCount   = g.sub ? (data.counts[g.sub.key] || 0) : 0;
                  const groupTotal = count + subCount;
                  const pct  = data.total > 0 ? Math.round(groupTotal / data.total * 100) : 0;
                  const mainW = data.total > 0 ? (count / data.total * 100) : 0;
                  const subW  = data.total > 0 ? (subCount / data.total * 100) : 0;
                  const hasSub = g.sub && subCount > 0;
                  const ant = (data.antByK?.[g.key] || 0) + (g.sub ? (data.antByK?.[g.sub.key] || 0) : 0);
                  const rte = (data.rteByK?.[g.key] || 0) + (g.sub ? (data.rteByK?.[g.sub.key] || 0) : 0);
                  return (
                    // Grid 2D: columnas [label 130px | cnt 28px | bar 1fr | % 28px | saldos 68px]
                    //          filas [main | sub] — bar y saldos abarcan las dos filas
                    <div key={g.key} className={`p3-grupo ${g.cls}`} onClick={() => irDetalle(g.key)}>
                      {/* Col 1 fila 1: label principal */}
                      <span className="p3-lbl" style={{ gridColumn:1, gridRow:1, color: g.color }}>{g.label}</span>
                      {/* Col 2 fila 1: count principal */}
                      <span className="p3-cnt" style={{ gridColumn:2, gridRow:1 }}>{count}</span>
                      {/* Col 3 filas 1-2: barra dual centrada verticalmente */}
                      <div className="p3-bar-wrap" style={{ gridColumn:3, gridRow: hasSub ? '1/3' : '1' }}>
                        {mainW > 0 && <div className="p3-bar" style={{ width: mainW+'%', background: g.color, opacity: g.alpha, float:'left' }} />}
                        {g.sub && subW > 0 && <div className="p3-bar" style={{ width: subW+'%', background: g.sub.color, opacity: g.sub.alpha, float:'left' }} />}
                      </div>
                      {/* Col 4 fila 1: % */}
                      <span className="p3-pct" style={{ gridColumn:4, gridRow:1 }}>{pct}%</span>
                      {/* Col 5 filas 1-2: Ant/Rte */}
                      {(ant >= 1000 || rte >= 1000) && (
                        <span className="p3-saldos" style={{ gridColumn:5, gridRow: hasSub ? '1/3' : '1' }}>
                          {rte >= 1000 && <span className="p3-rte">{fmtM(rte)}</span>}
                          {g.key === 'liquidar' && afData?.gta && rte >= 1000 && (() => {
                            const saldoGta = afData.gta - (afData.con_acta || 0) - (afData.con_acta_ek || 0);
                            const pctSaldo = saldoGta > 0 ? Math.round(rte / saldoGta * 100) : 0;
                            return (
                              <>
                                <span style={{color:'#A01010', fontSize:'0.68rem', fontWeight:800, lineHeight:1.1, whiteSpace:'nowrap'}}>
                                  <span style={{fontWeight:400, color:'#777'}}>Saldo Gta </span>{pctSaldo}%
                                </span>
                                <span style={{marginTop:'2px', alignSelf:'flex-start', background:'#A01010', color:'#fff', fontSize:'0.55rem', fontWeight:700, padding:'1px 4px', borderRadius:'3px', letterSpacing:'0.03em', whiteSpace:'nowrap'}}>LIQUIDAR</span>
                              </>
                            );
                          })()}
                          {ant >= 1000 && <span className="p3-ant">{fmtM(ant)}</span>}
                        </span>
                      )}
                      {/* Col 1 fila 2: sub-label */}
                      {hasSub && <span className="p3-sub-lbl" style={{ gridColumn:1, gridRow:2, color: g.sub.color }}>{g.sub.label}</span>}
                      {/* Col 2 fila 2: sub-count */}
                      {hasSub && <span className="p3-sub-cnt" style={{ gridColumn:2, gridRow:2 }}>{subCount}</span>}
                    </div>
                  );
                })}
              </div>

              <div className="ov-footer" style={{marginTop:'auto'}}>
                <button className="ov-btn ov-btn-primary" onClick={() => {
                  if (!macro?.key) return;
                  const remoteBase = 'https://proud-stone-03dea5710.7.azurestaticapps.net';
                  window.location.href = `${remoteBase}/assets/cierre/cierre_detalle.html?proyecto=${macro.key}&label=${encodeURIComponent(macro.label || macro.key)}`;
                }}>Ver estado liquidación ›</button>
              </div>

            </div>
          </div>

          {/* ── Columna derecha: A&F + irregularidades ── */}
          <div className="p3-irr-col" style={{ width: irrColW }}>

            {hasAFData && (
              <div className="p3-af-box" style={{cursor:'pointer'}} onClick={() => {
                if (!macro?.key) return;
                navigate(`/balance/${macro.key}`, {
                  state: {
                    balanceKey: activeSub?.key || macroKey,
                    subLabel:   activeSub?.label || null,
                  }
                });
              }}>
                <div className="p3-af-ttl">A&amp;F · Balance</div>
                <div className="p3-af-row">
                  <span className="p3-af-lbl">Gta. Cumplimiento</span>
                  <span className="p3-af-val" style={{color:'#B85520'}}>{fmtM(afData.gta)}</span>
                </div>
                <div className="p3-af-row">
                  <span className="p3-af-lbl">Ant. Contratistas</span>
                  <span className="p3-af-val" style={{color:'#8A6010'}}>{fmtM(afData.ant)}</span>
                </div>
                <div className="p3-af-row">
                  <span className="p3-af-lbl">Gta. pagadas</span>
                  <span className="p3-af-val" style={{color:'#1A6B7C'}}>{fmtM(afData.completado)}</span>
                </div>
                <div className="p3-af-row">
                  <span className="p3-af-lbl">Gta. para pago</span>
                  <span className="p3-af-val" style={{color:'#3A7228'}}>{fmtM(afData.liquidado)}</span>
                </div>
                <div className="p3-af-row">
                  <span className="p3-af-lbl">Con acta</span>
                  <span className="p3-af-val" style={{color:'#7B3F00'}}>{fmtM(afData.con_acta)}</span>
                </div>
                <div className="p3-af-row">
                  <span className="p3-af-lbl">Con Acta de EK</span>
                  <span className="p3-af-val" style={{color:'#7B3F00'}}>{fmtM(afData.con_acta_ek)}</span>
                </div>
                <div className="p3-af-divider" />
                <div className="p3-af-row p3-af-pct-row">
                  <span className="p3-af-lbl">% Liquidado</span>
                  <span className="p3-af-val p3-af-pct" style={{
                    color: afData.pct >= 80 ? '#1A6B7C' : afData.pct >= 50 ? '#8A6010' : '#B85520',
                    fontWeight: 700,
                  }}>{afData.pct}%</span>
                </div>
                <div className="p3-af-pct-bar-wrap">
                  <div className="p3-af-pct-bar" style={{
                    width: Math.min(afData.pct, 100) + '%',
                    background: afData.pct >= 80 ? '#1A6B7C' : afData.pct >= 50 ? '#8A6010' : '#B85520',
                  }} />
                </div>
              </div>
            )}

            <div className="p3-irr-box" onClick={() => irDetalle('irr')} style={{cursor:'pointer'}}>
              <span className="p3-irr-num">{irrCount}</span>
              <span className="p3-irr-lbl">terceros con<br/>irregularidades</span>
              <span className="p3-irr-desc">Gta. sin devolución<br/>ni acta de liquidación firmada</span>
            </div>

          </div>
        </>)}

      </div>
    </div>
  );
}
