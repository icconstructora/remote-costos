import { useState, useEffect, useRef, useCallback } from 'react';
import './costos.css';
import { PROJECTS, DATA, PROJECT_PREFIXES, PROJECT_SUBS } from './data/projectData.js';

// ── CARGA SCRIPTS EXTERNOS DE DATOS ──────────────────────────────────────────
const DATA_SCRIPTS = [
  '/data/contracts_data.js',
  '/data/balance_data.js',
  '/data/estado_resumen.js',
  '/data/proyecciones_data.js',
  '/data/consumido_data.js',
  '/data/cierre_data.js',
];

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[data-costos-src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.setAttribute('data-costos-src', src);
    // Ruta absoluta resuelta contra el origen propio del remote (import.meta.url),
    // no contra el origen del shell que lo está montando vía Module Federation.
    s.src = new URL(src, import.meta.url).href;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

// ── SVG HELPERS ───────────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
function se(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
  if (parent) parent.appendChild(e);
  return e;
}
function st(text, attrs, parent) {
  const e = se('text', attrs, parent);
  e.textContent = text;
  return e;
}
function fmtM(n) {
  const m = Math.round(n / 1e6);
  return m >= 1000 ? '$' + (m / 1000).toFixed(1) + 'B' : '$' + m.toLocaleString('es-CO') + 'M';
}

// ── CATEGORIZAR CONTRATOS ─────────────────────────────────────────────────────
const todayDate = new Date();
function parseDate(str) {
  if (!str) return null;
  const p = str.split('/');
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
  return null;
}
function isVencido(r) { const fd = parseDate(r.fechaFinal); return fd && fd < todayDate; }
function categorizeContracts(rows) {
  const total = rows.filter(r => r.valorContrato > 0);
  const noVenc = r => !parseDate(r.fechaFinal) || parseDate(r.fechaFinal) >= todayDate;
  const cerrados = total.filter(r => r.estadoContrato === 'Cerrado' && r.faltante < 1 && r.saldoAnticipo < 1 && r.saldoRte < 1);
  const porCerrar = total.filter(r => r.estadoContrato !== 'Cerrado' && r.faltante < 1 && r.saldoAnticipo < 1 && r.saldoRte < 1);
  const enEjecucion = total.filter(r => r.faltante >= 1 && noVenc(r) && r.estadoContrato === 'Abierto');
  const porAprobacion = total.filter(r => r.estadoContrato === 'Por Aprobación' && noVenc(r) && r.faltante >= 1);
  const noIniciadosVencidos = total.filter(r => isVencido(r) && r.acumulado === 0 && r.faltante >= 1);
  const vencidosConSaldo = total.filter(r => isVencido(r) && r.faltante >= 1 && r.acumulado > 0);
  const liquidar = total.filter(r => r.faltante < 1 && (r.saldoAnticipo >= 1 || r.saldoRte >= 1));
  return { total, cerrados, porCerrar, enEjecucion, porAprobacion, noIniciadosVencidos, vencidosConSaldo, liquidar };
}

function getContractsByFilter(activePj, activeSubFilter) {
  if (typeof window.CONTRACTS_DATA === 'undefined') return null;
  const subs = PROJECT_SUBS[activePj];
  if (subs) {
    const sub = subs.find(s => s.key === activeSubFilter) || subs[0];
    return window.CONTRACTS_DATA.filter(r => {
      if (!r.proyecto) return false;
      return sub.exact
        ? sub.prefixes.includes(r.proyecto)
        : sub.prefixes.some(p => r.proyecto.startsWith(p));
    });
  }
  const prefixes = PROJECT_PREFIXES[activePj] || [];
  return window.CONTRACTS_DATA.filter(r => prefixes.some(p => r.proyecto && r.proyecto.startsWith(p)));
}

// ── PANEL 1: ESTADO DEL PROYECTO ─────────────────────────────────────────────
function drawEstado(d, svg) {
  if (!svg || !d?.estado) return;
  svg.innerHTML = '';
  const e = d.estado;
  const W = 400, H = 175, pad = { t: 30, b: 32, l: 8, r: 8 };
  const proy = e.proyectado.cdd + e.proyectado.cid;
  const ppto = e.presupuesto.cdd + e.presupuesto.cid;
  const cols = [
    { label:'Presupuesto', data:e.presupuesto, pctRef:null, colorFondo:'#C8C4D8', colorCDD:'#5A5A8A', colorCID:'#9490B8' },
    { label:'Proyectado',  data:e.proyectado,  pctRef:ppto, colorFondo:'#D4AAAA', colorCDD:'#6C0000', colorCID:'#9C3030' },
    { label:'Asegurado',   data:e.asegurado,   pctRef:proy, colorFondo:'#D8C898', colorCDD:'#8A6010', colorCID:'#B89040' },
    { label:'Consumido',   data:e.consumido,   pctRef:proy, colorFondo:'#AACAAA', colorCDD:'#3A7228', colorCID:'#6AA258' },
    { label:'Por Aseg.',   data:e.porAsegurar, pctRef:proy, colorFondo:'#D8AAAA', colorCDD:'#A01010', colorCID:'#C04040' },
  ];
  const maxV = Math.max(...cols.map(c => c.data.cdd + c.data.cid));
  const chartH = H - pad.t - pad.b;
  const cW = (W - pad.l - pad.r) / cols.length;
  const barW = cW * 0.68;
  se('line', { x1:pad.l, y1:pad.t+chartH, x2:W-pad.r, y2:pad.t+chartH, stroke:'#CFCFCF', 'stroke-width':1 }, svg);
  cols.forEach((col, i) => {
    const x = pad.l + i * cW + (cW - barW) / 2;
    const dat = col.data;
    const cx = x + barW / 2;
    const hTot = ((dat.cdd + dat.cid) / maxV) * chartH;
    const hCDD = (dat.cdd / maxV) * chartH;
    const hCID = (dat.cid / maxV) * chartH;
    const topY = pad.t + chartH - hTot;
    se('rect', { x, y:topY, width:barW, height:hTot, fill:col.colorFondo, 'fill-opacity':.45, stroke:col.colorFondo, 'stroke-width':'0.75' }, svg);
    const gap = 3, thinW = (barW - gap) / 2;
    const xCDD = x, xCID = x + thinW + gap;
    const topCDD = pad.t + chartH - hCDD, topCID = pad.t + chartH - hCID;
    const cxCDD = xCDD + thinW / 2, cxCID = xCID + thinW / 2;
    se('rect', { x:xCDD, y:topCDD, width:thinW, height:hCDD, fill:col.colorCDD, 'fill-opacity':.7, stroke:col.colorCDD, 'stroke-width':'0.75' }, svg);
    se('rect', { x:xCID, y:topCID, width:thinW, height:hCID, fill:col.colorCID, 'fill-opacity':.7, stroke:col.colorCID, 'stroke-width':'0.75' }, svg);
    if (i === 0) {
      const lxCDD = xCDD - 10, midY = topCDD + hCDD / 2;
      st('Costo Directo', { x:lxCDD, y:midY, 'text-anchor':'middle', 'font-size':'8.5', fill:col.colorCDD, stroke:'#fff', 'stroke-width':'2', 'paint-order':'stroke fill', 'font-family':'Century Gothic,Nunito,sans-serif', transform:`rotate(-90 ${lxCDD} ${midY})` }, svg);
      const lxCID = x + barW + 10;
      st('Costo Indirecto', { x:lxCID, y:midY, 'text-anchor':'middle', 'font-size':'8.5', fill:col.colorCID, stroke:'#fff', 'stroke-width':'2', 'paint-order':'stroke fill', 'font-family':'Century Gothic,Nunito,sans-serif', transform:`rotate(-90 ${lxCID} ${midY})` }, svg);
    }
    if (hCDD > 26) {
      const pctCDD = col.pctRef ? (dat.cdd / col.pctRef * 100).toFixed(1) : (dat.cdd / (dat.cdd + dat.cid) * 100).toFixed(1);
      st(fmtM(dat.cdd), { x:cxCDD, y:topCDD+12, 'text-anchor':'middle', 'font-size':'6', fill:'#fff', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      st(pctCDD + '%', { x:cxCDD, y:topCDD+20, 'text-anchor':'middle', 'font-size':'5.5', fill:'#fff', 'fill-opacity':'0.82', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    } else if (hCDD > 10) {
      st(fmtM(dat.cdd), { x:cxCDD, y:topCDD+9, 'text-anchor':'middle', 'font-size':'6', fill:'#fff', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    }
    if (topCID - 4 < topY - 16) {
      st(fmtM(dat.cid), { x:cxCID, y:topCID-4, 'text-anchor':'middle', 'font-size':'6', fill:col.colorCID, 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    }
    const lblBase = topY - 3, lblValY = lblBase - 11;
    st(fmtM(dat.cdd + dat.cid), { x:cx, y:lblValY, 'text-anchor':'middle', 'font-size':'10', fill:'#111', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    if (col.pctRef) {
      const pct = ((dat.cdd + dat.cid) / col.pctRef * 100).toFixed(1);
      st(pct + '%', { x:cx, y:lblBase, 'text-anchor':'middle', 'font-size':'10', fill:col.colorCDD, 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    }
    st(col.label, { x:cx, y:H-pad.b+12, 'text-anchor':'middle', 'font-size':'7.5', fill:'#707070', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  });
}

// ── PANEL 2b: CONSUMIDO MES A MES ────────────────────────────────────────────
function drawConsumed(dataKey, svg) {
  if (!svg) return;
  svg.innerHTML = '';
  const periods = window.CONSUMIDO_DATA && window.CONSUMIDO_DATA[dataKey];
  if (!periods || !periods.length) return;
  const W = 500, H = 155, pad = { t:20, b:38, l:6, r:6 };
  const chartH = H - pad.t - pad.b, chartW = W - pad.l - pad.r, baseY = pad.t + chartH;
  const fmtV = v => { if (!v || v < 1000) return '$0'; if (v >= 1e9) return '$'+(v/1e9).toFixed(1)+'MM'; if (v >= 1e6) return '$'+(v/1e6).toFixed(0)+'M'; return '$'+Math.round(v/1e3)+'K'; };
  const maxAll = Math.max(...periods.map(p => p.cdd + p.cid), 1);
  const n = Math.min(periods.length, 10), shown = periods.slice(-n);
  const step = chartW / n, barW = Math.min(step * 0.70, 32);
  const colorCDD = '#D4AAAA', colorCID = '#D8C898', strokeCDD = '#9C5050', strokeCID = '#A89030';
  se('line', { x1:pad.l, y1:baseY, x2:W-pad.r, y2:baseY, stroke:'#CFCFCF', 'stroke-width':1 }, svg);
  se('rect', { x:W/2-62, y:3, width:7, height:7, fill:colorCDD, 'fill-opacity':0.85, rx:1, stroke:strokeCDD, 'stroke-width':'0.8' }, svg);
  st('Costo Directo (CDD)', { x:W/2-52, y:10, 'font-size':'6', fill:'#555', 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  se('rect', { x:W/2+44, y:3, width:7, height:7, fill:colorCID, 'fill-opacity':0.85, rx:1, stroke:strokeCID, 'stroke-width':'0.8' }, svg);
  st('Costos admin. obra (CID)', { x:W/2+54, y:10, 'font-size':'6', fill:'#555', 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  shown.forEach((p, i) => {
    const total = p.cdd + p.cid, hTotal = (total / maxAll) * chartH;
    const hCDD = (p.cdd / maxAll) * chartH, hCID = (p.cid / maxAll) * chartH;
    const bx = pad.l + i * step + (step - barW) / 2, cx = bx + barW / 2;
    se('rect', { x:bx, y:baseY-hCDD, width:barW, height:hCDD, fill:colorCDD, 'fill-opacity':0.85, stroke:strokeCDD, 'stroke-width':'0.8' }, svg);
    if (hCID >= 0.5) se('rect', { x:bx, y:baseY-hTotal, width:barW, height:hCID, fill:colorCID, 'fill-opacity':0.85, stroke:strokeCID, 'stroke-width':'0.8' }, svg);
    if (hCID >= 1 && hCDD >= 1) se('line', { x1:bx, y1:baseY-hCDD, x2:bx+barW, y2:baseY-hCDD, stroke:'#fff', 'stroke-width':'1' }, svg);
    st(fmtV(p.cid), { x:cx, y:baseY-hTotal-2, 'text-anchor':'middle', 'font-size':'5.8', fill:'#1A1A1A', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    if (hCDD > 8) st(fmtV(p.cdd), { x:cx, y:baseY-hCDD/2+2.5, 'text-anchor':'middle', 'font-size':'5.8', fill:'#fff', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    if (hCID > 11) st(fmtV(p.cid), { x:cx, y:baseY-hTotal+hCID/2+2.5, 'text-anchor':'middle', 'font-size':'5.8', fill:'#fff', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    st(p.label, { x:cx, y:baseY+10, 'text-anchor':'middle', 'font-size':'5.8', fill:'#404040', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    if (p.cdd > 0) {
      const pct = p.cid / p.cdd * 100;
      const pctColor = pct < 6 ? '#2E7D32' : pct <= 9 ? '#F9A825' : '#C62828';
      st(pct.toFixed(1)+'%', { x:cx, y:baseY+20, 'text-anchor':'middle', 'font-size':'5.5', fill:pctColor, 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    }
  });
}

// ── PANEL 2 GENÉRICO: MENSUAL ────────────────────────────────────────────────
function drawProyGenerico(d, svg) {
  if (!svg || !d?.mensual?.length) return;
  svg.innerHTML = '';
  const W = 400, H = 155, pad = { t:14, b:28, l:8, r:8 };
  const meses = d.mensual, n = meses.length;
  let acc = 0;
  const cumul = meses.map(m => { acc += m.v; return acc; });
  const maxAll = Math.max(...cumul);
  if (maxAll <= 0) return;
  const chartH = H - pad.t - pad.b, chartW = W - pad.l - pad.r;
  const stepM = chartW / n, bw = stepM * 0.42;
  se('line', { x1:pad.l, y1:pad.t+chartH, x2:W-pad.r, y2:pad.t+chartH, stroke:'#CFCFCF', 'stroke-width':1 }, svg);
  meses.forEach((m, i) => {
    const bh = (m.v / maxAll) * chartH, bx = pad.l + i * stepM + (stepM - bw) / 2;
    if (bh > 0) se('rect', { x:bx, y:pad.t+chartH-bh, width:bw, height:bh, fill:'#8A6010', 'fill-opacity':.45, stroke:'#8A6010', 'stroke-width':'0.75' }, svg);
  });
  if (n > 1) {
    const stepL = chartW / (n - 1);
    const pts = cumul.map((v, i) => [pad.l + i * stepL, pad.t + chartH - (v / maxAll) * chartH]);
    const linePath = `M${pts[0][0]},${pts[0][1]} ` + pts.slice(1).map(p => `L${p[0]},${p[1]}`).join(' ');
    const areaPath = linePath + ` L${pts[n-1][0]},${pad.t+chartH} L${pts[0][0]},${pad.t+chartH} Z`;
    se('path', { d:areaPath, fill:'#B85520', opacity:.1 }, svg);
    se('path', { d:linePath, fill:'none', stroke:'#B85520', 'stroke-width':2, 'stroke-linejoin':'round' }, svg);
    pts.forEach(([x, y]) => se('circle', { cx:x, cy:y, r:2.5, fill:'#B85520' }, svg));
  }
  meses.forEach((m, i) => {
    if (i % 2 === 0) st(m.mes, { x:pad.l+i*stepM+stepM/2, y:H-pad.b+11, 'text-anchor':'middle', 'font-size':'6.5', fill:'#707070', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  });
}

// ── PANEL 3: EMBUDO DE CONTRATOS ─────────────────────────────────────────────
function drawFunnel(contracts, svg) {
  if (!svg) return;
  svg.innerHTML = '';
  const H = 178, labelW = 138, gap = 6, barX = labelW + gap, barMaxW = 155, W = 470;
  const infoX = barX + barMaxW + gap + 2;
  const fmtC = v => { if (!v) return '—'; if (Math.abs(v) >= 1e9) return '$'+(v/1e9).toFixed(1)+'MM'; if (Math.abs(v) >= 1e6) return '$'+(v/1e6).toFixed(1)+'M'; return '$'+Math.round(v).toLocaleString('es-CO'); };
  if (!contracts || !contracts.length) {
    st('Sin datos de contratos', { x:W/2, y:H/2, 'text-anchor':'middle', 'font-size':'10', fill:'#707070', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    return;
  }
  const cats = categorizeContracts(contracts);
  const total = cats.total.length;
  function stateSaldo(key) {
    if (key === 'cerrados') return null;
    const r = cats[key] || [];
    return { ant:r.reduce((s,x)=>s+(x.saldoAnticipo||0),0), rte:r.reduce((s,x)=>s+(x.saldoRte||0),0) };
  }
  const stages = [
    { key:'total',               label:'Total Contratos',       color:'#6C0000', alpha:.55 },
    { key:'porAprobacion',       label:'Por Aprobación',        color:'#8A6010', alpha:.60 },
    { key:'noIniciadosVencidos', label:'No Iniciados Vencidos', color:'#B85520', alpha:.65 },
    { key:'enEjecucion',         label:'En Ejecución',          color:'#4A3F8A', alpha:.60 },
    { key:'vencidosConSaldo',    label:'Vencidos con Saldo',    color:'#A01010', alpha:.65 },
    { key:'liquidar',            label:'Liquidar',              color:'#7A1070', alpha:.65 },
    { key:'porCerrar',           label:'Cerrar',                color:'#1A6080', alpha:.60 },
    { key:'cerrados',            label:'Cerrado',               color:'#3A7228', alpha:.60 },
  ];
  const n = stages.length, rowH = H / n;
  const stagesNoTotal = stages.filter(s => s.key !== 'total');
  let cumCount = 0;
  const cumPct = {};
  stagesNoTotal.forEach((s, i) => {
    cumCount += (cats[s.key] || []).length;
    cumPct[s.key] = i === stagesNoTotal.length - 1 ? 100 : (total > 0 ? Math.round(cumCount / total * 100) : 0);
  });
  const stackSeg = stages.filter(s => s.key !== 'total' && s.key !== 'cerrados');
  const segInfo = {};
  let accumX = barX;
  stackSeg.forEach(seg => {
    const segW = total > 0 ? ((cats[seg.key]||[]).length / total) * barMaxW : 0;
    segInfo[seg.key] = { startX:accumX, width:segW };
    accumX += segW;
  });
  const cerradoStartX = accumX, cerradoW = Math.max(barMaxW - (cerradoStartX - barX), 0);
  stages.forEach((s, i) => {
    const count = (cats[s.key] || []).length;
    const barH = rowH * 0.38, y = i * rowH + (rowH - barH) / 2, midY = i * rowH + rowH / 2 + 3.5;
    se('rect', { x:barX, y, width:barMaxW, height:barH, fill:'#E8E8E8' }, svg);
    if (s.key !== 'total' && s.key !== 'cerrados') {
      const si = segInfo[s.key], leftW = si ? si.startX - barX : 0;
      if (leftW > 0) se('rect', { x:barX, y, width:leftW, height:barH, fill:'#A0A0A0', stroke:s.color, 'stroke-width':'0.75' }, svg);
    }
    if (s.key === 'total') {
      se('rect', { x:barX, y, width:barMaxW, height:barH, fill:s.color, 'fill-opacity':s.alpha, stroke:s.color, 'stroke-width':'0.75' }, svg);
    } else if (s.key === 'cerrados') {
      stackSeg.forEach(seg => {
        const si = segInfo[seg.key];
        if (si.width > 0) se('rect', { x:si.startX, y, width:si.width, height:barH, fill:seg.color, 'fill-opacity':seg.alpha, stroke:'#fff', 'stroke-width':'0.6' }, svg);
      });
      if (cerradoW > 0) se('rect', { x:cerradoStartX, y, width:cerradoW, height:barH, fill:s.color, 'fill-opacity':s.alpha, stroke:'#fff', 'stroke-width':'0.6' }, svg);
    } else {
      const si = segInfo[s.key];
      if (si && si.width > 0) se('rect', { x:si.startX, y, width:si.width, height:barH, fill:s.color, 'fill-opacity':s.alpha, stroke:s.color, 'stroke-width':'0.75' }, svg);
    }
    st(s.label, { x:labelW-18, y:midY, 'text-anchor':'end', 'font-size':'7.8', fill:'#3A3A3A', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    st(`${count}`, { x:labelW-9, y:midY, 'text-anchor':'start', 'font-size':'6.5', fill:'#1A1A1A', 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif', stroke:'#fff', 'stroke-width':'2', 'paint-order':'stroke fill' }, svg);
    const pct = total > 0 ? Math.round(count / total * 100) : 0;
    if (s.key === 'total') {
      st(`${pct}%`, { x:infoX, y:midY+1, 'text-anchor':'start', 'font-size':'6.5', fill:'#909090', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    } else {
      st(`${pct}%`, { x:infoX, y:midY-3, 'text-anchor':'start', 'font-size':'6.5', fill:'#909090', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      st(`${cumPct[s.key]||0}%`, { x:infoX, y:midY+6, 'text-anchor':'start', 'font-size':'6.5', fill:'#444', 'font-weight':'600', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    }
    const si2 = stateSaldo(s.key);
    if (si2 && (si2.ant >= 1 || si2.rte >= 1)) {
      const bx2 = infoX + 18, col = s.color, hasAnt = si2.ant >= 1, hasRte = si2.rte >= 1;
      const yAnt = (hasAnt && hasRte) ? midY-3.5 : midY+1, yRte = (hasAnt && hasRte) ? midY+5.5 : midY+1;
      if (hasAnt) { st('Ant:', { x:bx2, y:yAnt, 'text-anchor':'start', 'font-size':'6', fill:col, 'font-family':'Century Gothic,Nunito,sans-serif' }, svg); st(fmtC(si2.ant), { x:bx2+14, y:yAnt, 'text-anchor':'start', 'font-size':'6', fill:col, 'font-family':'Century Gothic,Nunito,sans-serif' }, svg); }
      if (hasRte) { st('Rte:', { x:bx2, y:yRte, 'text-anchor':'start', 'font-size':'6', fill:col, 'font-family':'Century Gothic,Nunito,sans-serif' }, svg); st(fmtC(si2.rte), { x:bx2+14, y:yRte, 'text-anchor':'start', 'font-size':'6', fill:col, 'font-family':'Century Gothic,Nunito,sans-serif' }, svg); }
    }
  });
}

// ── PANEL 4: ANTICIPOS Y RETEGARANTÍAS ───────────────────────────────────────
function drawAnticipos(balanceKey, svg) {
  if (!svg) return;
  svg.innerHTML = '';
  const bd = window.BALANCE_DATA && window.BALANCE_DATA[balanceKey];
  if (!bd) return;
  const t = bd.totals || bd;
  const W = 500, H = 155, padT = 26, padB = 52, chartH = H - padT - padB, baseY = padT + chartH;
  const fmtC = v => { if (!v || v < 1) return '$0'; if (v >= 1e9) return '$'+(v/1e9).toFixed(1)+'MM'; if (v >= 1e6) return '$'+(v/1e6).toFixed(1)+'M'; return '$'+Math.round(v/1000)+'K'; };
  const _cb = window.CORTE_BALANCE || '';
  const _cbParts = _cb.match(/(\d+)\s+(\w+)\s+(\d{4})/);
  const _lblCurr = _cbParts ? _cbParts[2].substring(0,3)+' '+_cbParts[3].slice(2) : _cb;
  const MESES_AB = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const _mIdx = _cbParts ? MESES_AB.indexOf(_cbParts[2].substring(0,3)) : 0;
  const _mAntIdx = _mIdx > 1 ? _mIdx - 1 : 12;
  const _yAnt = _mIdx > 1 ? _cbParts[3].slice(2) : String(parseInt(_cbParts?.[3]||'2026')-1).slice(2);
  const _lblPrev = MESES_AB[_mAntIdx]+' '+_yAnt;
  se('rect', { x:W/2-48, y:4, width:8, height:8, fill:'#888', 'fill-opacity':0.25, rx:1 }, svg);
  st(_lblPrev, { x:W/2-37, y:11, 'font-size':'6.5', fill:'#888', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  se('rect', { x:W/2+10, y:4, width:8, height:8, fill:'#555', 'fill-opacity':0.75, rx:1 }, svg);
  st(_lblCurr, { x:W/2+21, y:11, 'font-size':'6.5', fill:'#555', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  se('line', { x1:14, y1:baseY, x2:W-14, y2:baseY, stroke:'#CFCFCF', 'stroke-width':1 }, svg);
  se('line', { x1:W/2, y1:padT, x2:W/2, y2:baseY+padB-8, stroke:'#E0E0E0', 'stroke-width':1, 'stroke-dasharray':'3,3' }, svg);
  st('ANTICIPOS', { x:104, y:baseY+46, 'text-anchor':'middle', 'font-size':'6.8', fill:'#6C0000', 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  st('RET. GARANTÍAS', { x:356, y:baseY+46, 'text-anchor':'middle', 'font-size':'6.8', fill:'#3A7228', 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
  const pairs = [
    { key:'ant_prov', line1:'Anticipo',  line2:'Proveedores',  color:'#6C0000', barW:28, iGap:5, x0:34  },
    { key:'ant_cont', line1:'Anticipos', line2:'Contratistas', color:'#B85520', barW:28, iGap:5, x0:113 },
    { key:'gar_cum',  line1:'Gta.',      line2:'Cumplimiento', color:'#8A6010', barW:22, iGap:4, x0:272 },
    { key:'liq',      line1:'Liquidado', line2:'',             color:'#1A6B7C', barW:22, iGap:4, x0:332 },
    { key:'dev_ret',  line1:'Dev. Ret.', line2:'Garantía',     color:'#3A7228', barW:22, iGap:4, x0:392 },
  ];
  pairs.forEach(p => { p.xMar = p.x0; p.xAbr = p.x0+p.barW+p.iGap; p.cx = p.x0+(p.barW*2+p.iGap)/2; });
  const allVals = pairs.flatMap(p => p.key === 'liq' ? [Math.abs(t['liq']||0)+Math.abs(t['liq_ant']||0)] : [Math.abs(t[p.key]||0), Math.abs(t[p.key+'_ant']||0)]);
  const maxVal = Math.max(...allVals, 1);
  pairs.forEach(p => {
    const abr = Math.abs(t[p.key]||0), mar = Math.abs(t[p.key+'_ant']||0), delta = abr - mar;
    const dColor = delta > 0 ? '#A01010' : (delta < 0 ? '#2D7A3A' : '#909090'), arrow = delta > 0 ? '▲' : (delta < 0 ? '▼' : '—');
    if (p.key === 'liq') {
      const curr = abr, prev = mar, total2 = curr + prev;
      const hTotal = (total2/maxVal)*chartH, hPrev = (prev/maxVal)*chartH, hCurr = (curr/maxVal)*chartH;
      const bw = 26, bx2 = p.cx - bw/2;
      if (hPrev >= 1) se('rect', { x:bx2, y:baseY-hPrev, width:bw, height:hPrev, fill:p.color, 'fill-opacity':0.22, stroke:p.color, 'stroke-width':'0.6', 'stroke-opacity':0.45 }, svg);
      if (hCurr >= 1) se('rect', { x:bx2, y:baseY-hTotal, width:bw, height:hCurr, fill:p.color, 'fill-opacity':0.75, stroke:p.color, 'stroke-width':'0.6' }, svg);
      if (hPrev >= 1 && hCurr >= 1) se('line', { x1:bx2, y1:baseY-hPrev, x2:bx2+bw, y2:baseY-hPrev, stroke:'#fff', 'stroke-width':'1.2' }, svg);
      st(fmtC(total2), { x:p.cx, y:hTotal >= 1 ? baseY-hTotal-3 : baseY-5, 'text-anchor':'middle', 'font-size':'6', fill:'#1A1A1A', 'font-weight':'600', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      if (hCurr >= 8) st(fmtC(curr), { x:p.cx, y:baseY-hTotal+hCurr/2+2.5, 'text-anchor':'middle', 'font-size':'6', fill:'#fff', 'font-weight':'600', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      if (hPrev >= 8) st(fmtC(prev), { x:p.cx, y:baseY-hPrev/2+2.5, 'text-anchor':'middle', 'font-size':'6', fill:p.color, 'font-weight':'600', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      st(p.line1, { x:p.cx, y:baseY+11, 'text-anchor':'middle', 'font-size':'6.2', fill:'#555', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      st(arrow+' '+fmtC(Math.abs(delta)), { x:p.cx, y:baseY+23, 'text-anchor':'middle', 'font-size':'7', fill:dColor, 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    } else {
      const hAbr = (abr/maxVal)*chartH, hMar = (mar/maxVal)*chartH;
      if (hMar >= 1) se('rect', { x:p.xMar, y:baseY-hMar, width:p.barW, height:hMar, fill:p.color, 'fill-opacity':0.20, stroke:p.color, 'stroke-width':'0.6', 'stroke-opacity':0.45 }, svg);
      if (hAbr >= 1) se('rect', { x:p.xAbr, y:baseY-hAbr, width:p.barW, height:hAbr, fill:p.color, 'fill-opacity':0.75, stroke:p.color, 'stroke-width':'0.6' }, svg);
      st(fmtC(mar), { x:p.xMar+p.barW/2, y:hMar >= 1 ? baseY-hMar-3 : baseY-5, 'text-anchor':'middle', 'font-size':'6', fill:'#888', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      st(fmtC(abr), { x:p.xAbr+p.barW/2, y:hAbr >= 1 ? baseY-hAbr-3 : baseY-5, 'text-anchor':'middle', 'font-size':'6', fill:'#1A1A1A', 'font-weight':'600', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      st(p.line1, { x:p.cx, y:baseY+11, 'text-anchor':'middle', 'font-size':'6.2', fill:'#555', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      if (p.line2) st(p.line2, { x:p.cx, y:baseY+20, 'text-anchor':'middle', 'font-size':'6.2', fill:'#555', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
      st(arrow+' '+fmtC(Math.abs(delta)), { x:p.cx, y:baseY+(p.line2?32:23), 'text-anchor':'middle', 'font-size':'7', fill:dColor, 'font-weight':'700', 'font-family':'Century Gothic,Nunito,sans-serif' }, svg);
    }
  });
}

// ── CAPÍTULOS ESTADO RESUMEN (sidebar P1) ────────────────────────────────────
function EstadoCaps({ dataKey }) {
  const r = window.ESTADO_RESUMEN && window.ESTADO_RESUMEN[dataKey];
  if (!r) return null;
  const caps = r.caps || [];
  if (!caps.length) return null;
  const maxPa = caps[0].pa;
  const total = r.crit + r.otro;
  const pctCrit = total > 0 ? Math.round(r.crit / total * 100) : 0;
  const pctOtro = total > 0 ? Math.round(r.otro / total * 100) : 0;
  return (
    <div className="er-wrap">
      <div className="er-totals">
        {r.crit > 0 && <span className="er-pill crit">⚠ Crít. {fmtM(r.crit)} <b style={{opacity:.75}}>{pctCrit}%</b></span>}
        {r.otro > 0 && <span className="er-pill otro">✔ Otros {fmtM(r.otro)} <b style={{opacity:.75}}>{pctOtro}%</b></span>}
      </div>
      {caps.map((cap, idx) => {
        const pct = maxPa > 0 ? cap.pa / maxPa : 0;
        const barColor = cap.pct > 0.90 ? '#A01010' : cap.pct > 0.70 ? '#B85520' : '#8A6010';
        return (
          <div key={idx} className="er-cap">
            <div className="er-cap-top">
              <span className="er-cod">{cap.cod}</span>
              <span className="er-nom">{cap.nom}</span>
              <span className="er-val" style={{color:barColor}}>{fmtM(cap.pa)}</span>
            </div>
            <div className="er-bar-wrap">
              <div className="er-bar" style={{width:`${Math.min(pct*100,100)}%`, background:barColor}}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── VISTA LIQUIDACIÓN: TABLA DE CONTRATOS ────────────────────────────────────
function VistaLiquidacion({ contracts, label, onBack }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('contrato');
  const [sortDir, setSortDir] = useState(1);
  const [grupoFilter, setGrupoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  const rows = contracts || [];
  const grupos = [...new Set(rows.map(r => r.grupo).filter(Boolean))].sort();
  const estados = [...new Set(rows.map(r => r.estadoContrato).filter(Boolean))].sort();

  const fmtCOP = v => {
    if (!v) return '$0';
    const abs = Math.abs(v); const sign = v < 0 ? '-' : '';
    if (abs >= 1e9) return sign + '$' + (abs/1e9).toFixed(2) + 'MM';
    if (abs >= 1e6) return sign + '$' + (abs/1e6).toFixed(1) + 'M';
    return sign + '$' + Math.round(abs).toLocaleString('es-CO');
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.contrato?.toLowerCase().includes(q) || r.contratista?.toLowerCase().includes(q) || r.descripcion?.toLowerCase().includes(q);
    return matchQ && (!grupoFilter || r.grupo === grupoFilter) && (!estadoFilter || r.estadoContrato === estadoFilter);
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (typeof va === 'number') return (va - vb) * sortDir;
    return String(va).localeCompare(String(vb)) * sortDir;
  });

  const cats = categorizeContracts(rows.filter(r => r.valorContrato > 0));
  const stats = [
    { label:'Total',              value:cats.total.length,               color:'#6C0000' },
    { label:'Cerrados',           value:cats.cerrados.length,            color:'#3A7228' },
    { label:'Por Cerrar',         value:cats.porCerrar.length,           color:'#1A6080' },
    { label:'En Ejecución',       value:cats.enEjecucion.length,         color:'#4A3F8A' },
    { label:'Por Aprobación',     value:cats.porAprobacion.length,       color:'#8A6010' },
    { label:'No Inic. Vencidos',  value:cats.noIniciadosVencidos.length, color:'#B85520' },
    { label:'Vencidos c/Saldo',   value:cats.vencidosConSaldo.length,    color:'#A01010' },
    { label:'Liquidar',           value:cats.liquidar.length,            color:'#7A1070' },
  ];

  const thClick = col => { setSortCol(col); setSortDir(sortCol === col ? -sortDir : 1); };
  const thStyle = col => ({ cursor:'pointer', userSelect:'none', background: sortCol === col ? '#F0E8E8' : undefined, whiteSpace:'nowrap' });

  return (
    <div className="cv-liquidacion">
      <div className="cv-liq-header">
        <button className="cv-back-btn" onClick={onBack}>← Volver</button>
        <h2 className="cv-liq-title">{label} · Contratos</h2>
      </div>
      <div className="cv-stat-cards">
        {stats.map(s => (
          <div key={s.label} className="cv-stat-card" style={{borderTop:`3px solid ${s.color}`}}>
            <div className="cv-stat-val" style={{color:s.color}}>{s.value}</div>
            <div className="cv-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="cv-liq-filters">
        <input className="cv-search" placeholder="Buscar contrato, contratista…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="cv-select" value={grupoFilter} onChange={e => setGrupoFilter(e.target.value)}>
          <option value="">Todos los grupos</option>
          {grupos.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="cv-select" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {estados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="cv-count">{sorted.length} de {rows.length}</span>
      </div>
      <div className="cv-table-wrap">
        <table className="cv-table">
          <thead>
            <tr>
              <th style={thStyle('contrato')} onClick={() => thClick('contrato')}>Contrato{sortCol==='contrato'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th style={thStyle('contratista')} onClick={() => thClick('contratista')}>Contratista{sortCol==='contratista'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th>Descripción</th>
              <th style={thStyle('estadoContrato')} onClick={() => thClick('estadoContrato')}>Estado{sortCol==='estadoContrato'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th style={thStyle('fechaFinal')} onClick={() => thClick('fechaFinal')}>Fecha Final{sortCol==='fechaFinal'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th style={thStyle('valorContrato')} onClick={() => thClick('valorContrato')}>Valor{sortCol==='valorContrato'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th style={thStyle('acumulado')} onClick={() => thClick('acumulado')}>Acumulado{sortCol==='acumulado'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th style={thStyle('faltante')} onClick={() => thClick('faltante')}>Faltante{sortCol==='faltante'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th style={thStyle('saldoAnticipo')} onClick={() => thClick('saldoAnticipo')}>Saldo Ant.{sortCol==='saldoAnticipo'?(sortDir>0?' ▲':' ▼'):''}</th>
              <th style={thStyle('saldoRte')} onClick={() => thClick('saldoRte')}>Saldo Rte.{sortCol==='saldoRte'?(sortDir>0?' ▲':' ▼'):''}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const vencido = isVencido(r);
              const rowCls = r.estadoContrato === 'Cerrado' ? 'cv-row-cerrado' : vencido ? 'cv-row-vencido' : '';
              return (
                <tr key={i} className={rowCls}>
                  <td className="cv-td-code">{r.contrato}</td>
                  <td className="cv-td-cont">{r.contratista}</td>
                  <td className="cv-td-desc">{r.descripcion}</td>
                  <td><span className={`cv-estado cv-est-${(r.estadoContrato||'').replace(/\s+/g,'-').toLowerCase()}`}>{r.estadoContrato}</span></td>
                  <td className={vencido ? 'cv-td-venc' : ''}>{r.fechaFinal}</td>
                  <td className="cv-td-num">{fmtCOP(r.valorContrato)}</td>
                  <td className="cv-td-num">{fmtCOP(r.acumulado)}</td>
                  <td className="cv-td-num">{fmtCOP(r.faltante)}</td>
                  <td className="cv-td-num cv-td-ant">{r.saldoAnticipo >= 1 ? fmtCOP(r.saldoAnticipo) : '—'}</td>
                  <td className="cv-td-num cv-td-rte">{r.saldoRte >= 1 ? fmtCOP(r.saldoRte) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function CostosModule() {
  const [activePj, setActivePj] = useState(() => localStorage.getItem('dash_activePj') || 'mitika');
  const [activeSubFilter, setActiveSubFilter] = useState(() => {
    const s = localStorage.getItem('dash_activeSubFilter');
    return s || null;
  });
  const [view, setView] = useState('dashboard');
  const [viewLabel, setViewLabel] = useState('');
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [cidModal, setCidModal] = useState(null);

  const svgEstadoRef = useRef(null);
  const svgProyRef   = useRef(null);
  const svgFunnelRef = useRef(null);
  const svgAntRef    = useRef(null);

  useEffect(() => {
    Promise.all(DATA_SCRIPTS.map(loadScript)).then(() => setScriptsLoaded(true));
  }, []);

  const getDataKey = useCallback(() => {
    const subs = PROJECT_SUBS[activePj];
    if (subs && activeSubFilter) {
      const sub = subs.find(s => s.key === activeSubFilter);
      if (sub && DATA[sub.key]) return sub.key;
    }
    return DATA[activePj] ? activePj : null;
  }, [activePj, activeSubFilter]);

  const getBalanceKey = useCallback(() => {
    if (activeSubFilter && window.BALANCE_DATA && window.BALANCE_DATA[activeSubFilter]) return activeSubFilter;
    if (window.BALANCE_DATA && window.BALANCE_DATA[activePj]) return activePj;
    return null;
  }, [activePj, activeSubFilter, scriptsLoaded]);

  const getActiveSub = useCallback(() => {
    const subs = PROJECT_SUBS[activePj];
    if (!subs) return null;
    return subs.find(s => s.key === activeSubFilter) || subs[0];
  }, [activePj, activeSubFilter]);

  const getContracts = useCallback(() => {
    if (!scriptsLoaded) return null;
    return getContractsByFilter(activePj, activeSubFilter);
  }, [activePj, activeSubFilter, scriptsLoaded]);

  useEffect(() => {
    if (view !== 'dashboard') return;
    const dataKey = getDataKey();
    const d = dataKey ? DATA[dataKey] : null;
    const balanceKey = getBalanceKey();
    const contracts = getContracts();
    const id = requestAnimationFrame(() => {
      if (svgEstadoRef.current && d) drawEstado(d, svgEstadoRef.current);
      if (svgProyRef.current) {
        if (scriptsLoaded && window.CONSUMIDO_DATA && window.CONSUMIDO_DATA[dataKey]) {
          drawConsumed(dataKey, svgProyRef.current);
        } else if (d) {
          drawProyGenerico(d, svgProyRef.current);
        }
      }
      if (svgFunnelRef.current) drawFunnel(contracts, svgFunnelRef.current);
      if (svgAntRef.current && balanceKey) drawAnticipos(balanceKey, svgAntRef.current);
    });
    return () => cancelAnimationFrame(id);
  }, [activePj, activeSubFilter, scriptsLoaded, view]);

  const selectPj = id => {
    setActivePj(id);
    setActiveSubFilter(null);
    setView('dashboard');
    localStorage.setItem('dash_activePj', id);
    localStorage.setItem('dash_activeSubFilter', '');
  };

  const selectSubFilter = key => {
    setActiveSubFilter(key);
    localStorage.setItem('dash_activeSubFilter', key || '');
  };

  const openLiquidacion = () => {
    const pjItem = PROJECTS.find(p => p.id === activePj);
    const sub = getActiveSub();
    setViewLabel(sub && sub.key ? sub.label : pjItem?.name || activePj);
    setView('liquidacion');
  };

  const visibleSubs = (() => {
    const subs = PROJECT_SUBS[activePj];
    if (!subs) return [];
    return subs.filter(s => {
      if (s.key === null) return true;
      if (DATA[s.key]) return true;
      if (!scriptsLoaded || !window.CONTRACTS_DATA) return false;
      return window.CONTRACTS_DATA.some(r => {
        if (!r.proyecto) return false;
        return s.exact ? s.prefixes.includes(r.proyecto) : s.prefixes.some(p => r.proyecto.startsWith(p));
      });
    });
  })();

  const dataKey = getDataKey();
  const d = dataKey ? DATA[dataKey] : null;
  const pj = PROJECTS.find(p => p.id === activePj);
  const activeSub = getActiveSub();
  const balanceKey = getBalanceKey();
  const hasBalance = !!balanceKey;
  const hasConsumed = scriptsLoaded && window.CONSUMIDO_DATA && !!window.CONSUMIDO_DATA[dataKey];
  const contracts = getContracts();

  if (view === 'liquidacion') {
    return (
      <div className="costos-module">
        <VistaLiquidacion contracts={contracts || []} label={viewLabel} onBack={() => setView('dashboard')} />
      </div>
    );
  }

  const subLabel = (activeSubFilter && activeSub) ? activeSub.label : d?.sub;

  return (
    <div className="costos-module">

      {/* Ticker */}
      <div className="cv-ticker-wrap">
        <div className="cv-ticker-track">
          <span>IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp;</span>
        </div>
      </div>

      {/* Project strip */}
      <div className="cv-proj-strip">
        <div className="cv-proj-strip-inner">
          {PROJECTS.map(p => (
            <div key={p.id} className={`cv-proj-chip${p.id === activePj ? ' active' : ''}`} onClick={() => selectPj(p.id)}>
              <div className="cv-chip-img">
                <img src={p.img} alt={p.name}
                  onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML=`<span style="font-size:.5rem;color:#6b7a99">${p.name.slice(0,4)}</span>`; }} />
              </div>
              <span className="cv-chip-label">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-filter strip */}
      <div className="cv-sub-strip">
        <span className="cv-sub-label">VER:</span>
        {visibleSubs.length <= 1 ? (
          <span className="cv-sub-chip active" style={{cursor:'default'}}>Única</span>
        ) : visibleSubs.map(s => (
          <div key={s.key ?? 'all'} className={`cv-sub-chip${s.key === activeSubFilter ? ' active' : ''}`} onClick={() => selectSubFilter(s.key)}>
            {s.label}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="cv-main-content">
        {d ? (
          <>
            <div className="cv-proj-title-bar">
              <h2 className="cv-proj-h2">{d.nombre}</h2>
              <span className="cv-proj-meta">{subLabel} &nbsp;·&nbsp; Informe {d.informe} &nbsp;·&nbsp; Corte: {d.fechaCorte}</span>
            </div>

            <div className="cv-overview-grid">

              {/* P1: Estado del Proyecto */}
              <div className="cv-ov-panel cv-p1">
                <div className="cv-ov-side"><div className="cv-ov-title">Estado del Proyecto</div></div>
                <div className="cv-ov-body">
                  <div className="cv-ov-corte">{d.fechaCorte}</div>
                  <div style={{display:'flex', flex:1, minHeight:0, gap:8}}>
                    <div style={{flex:1, minWidth:0, position:'relative'}}>
                      <svg ref={svgEstadoRef} viewBox="0 0 400 175" preserveAspectRatio="xMidYMid meet"
                        style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}}></svg>
                    </div>
                    <div className="cv-estado-caps">
                      <div className="cv-caps-ttl">Por Asegurar</div>
                      {scriptsLoaded && <EstadoCaps key={dataKey} dataKey={dataKey} />}
                    </div>
                  </div>
                  <div className="cv-ov-legend">
                    <div className="cv-leg-item"><div className="cv-leg-dot" style={{background:'#6C0000'}}></div>Directos CDD</div>
                    <div className="cv-leg-item"><div className="cv-leg-dot" style={{background:'#B85520'}}></div>Indirectos CID</div>
                  </div>
                  <div className="cv-ov-footer">
                    <button className="cv-btn cv-btn-primary" onClick={openLiquidacion}>Ver contratos »</button>
                  </div>
                </div>
              </div>

              {/* P2: Consumido */}
              <div className="cv-ov-panel cv-p2" style={{cursor:'default'}}>
                <div className="cv-ov-side"><div className="cv-ov-title">Consumido</div></div>
                <div className="cv-ov-body">
                  <div className="cv-ov-corte">{window.CORTE_CONSUMIDO || ''}</div>
                  <div className="cv-ov-chart">
                    <svg ref={svgProyRef} viewBox={hasConsumed ? '0 0 500 155' : '0 0 400 155'} preserveAspectRatio="xMidYMid meet"></svg>
                  </div>
                  {!hasConsumed && (
                    <div className="cv-ov-legend">
                      <div className="cv-leg-item"><div className="cv-leg-dot" style={{background:'#B85520'}}></div>Acumulado</div>
                      <div className="cv-leg-item"><div className="cv-leg-dot" style={{background:'#8A6010'}}></div>Mensual</div>
                    </div>
                  )}
                  <div className="cv-ov-footer">
                    {hasConsumed && (
                      <button className="cv-btn cv-btn-primary" onClick={() => {
                        if (window.CONSUMIDO_DETALLE?.[dataKey]) setCidModal({ rows:window.CONSUMIDO_DETALLE[dataKey], name:d.nombre });
                      }}>Detalle CID ›</button>
                    )}
                    <button className="cv-btn cv-btn-secondary" onClick={openLiquidacion}>Contratos ›</button>
                  </div>
                </div>
              </div>

              {/* P3: Estado de Contratos */}
              <div className="cv-ov-panel cv-p3" style={{cursor:'default'}}>
                <div className="cv-ov-side"><div className="cv-ov-title">Estado de Contratos</div></div>
                <div className="cv-ov-body">
                  <div className="cv-ov-corte">{window.CORTE_CONTRATOS || ''}</div>
                  <div className="cv-ov-chart">
                    <svg ref={svgFunnelRef} viewBox="0 0 470 178" preserveAspectRatio="xMidYMid meet"></svg>
                  </div>
                  <div className="cv-ov-footer">
                    <button className="cv-btn cv-btn-primary" onClick={openLiquidacion}>Detalle contratos ›</button>
                  </div>
                </div>
              </div>

              {/* P4: Anticipos y Retegarantías */}
              {hasBalance ? (
                <div className="cv-ov-panel cv-p4" style={{cursor:'default'}}>
                  <div className="cv-ov-side"><div className="cv-ov-title">Anticipos y Retegarantías<span className="cv-title-abbr">A&amp;F</span></div></div>
                  <div className="cv-ov-body">
                    <div className="cv-ov-corte">{window.CORTE_BALANCE || ''}</div>
                    <div className="cv-ov-chart">
                      <svg ref={svgAntRef} viewBox="0 0 500 155" preserveAspectRatio="xMidYMid meet"></svg>
                    </div>
                    <div className="cv-ov-footer">
                      <button className="cv-btn cv-btn-secondary" onClick={openLiquidacion}>Contratos ›</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cv-ov-panel cv-p4" style={{opacity:.35, pointerEvents:'none'}}>
                  <div className="cv-ov-side"><div className="cv-ov-title">Anticipos y Retegarantías<span className="cv-title-abbr">A&amp;F</span></div></div>
                  <div className="cv-ov-body">
                    <div className="cv-ov-chart" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:'.65rem',color:'#707070'}}>Pendiente de carga</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </>
        ) : (
          /* Sin datos financieros */
          <>
            <div className="cv-proj-title-bar">
              <h2 className="cv-proj-h2">{pj?.name}</h2>
              <span className="cv-proj-meta">Vista de contratos · Datos financieros pendientes</span>
            </div>
            <div className="cv-overview-grid">
              <div className="cv-ov-panel cv-p1" style={{opacity:.35, pointerEvents:'none'}}>
                <div className="cv-ov-side"><div className="cv-ov-title">Estado del Proyecto</div></div>
                <div className="cv-ov-body"><div className="cv-ov-chart" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'.65rem',color:'#707070'}}>Pendiente</span></div></div>
              </div>
              <div className="cv-ov-panel cv-p2" style={{opacity:.35, pointerEvents:'none'}}>
                <div className="cv-ov-side"><div className="cv-ov-title">Consumido</div></div>
                <div className="cv-ov-body"><div className="cv-ov-chart" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'.65rem',color:'#707070'}}>Pendiente</span></div></div>
              </div>
              <div className="cv-ov-panel cv-p3" onClick={openLiquidacion} style={{cursor:'pointer'}}>
                <div className="cv-ov-side"><div className="cv-ov-title">Estado de Contratos</div></div>
                <div className="cv-ov-body">
                  <div className="cv-ov-chart"><svg ref={svgFunnelRef} viewBox="0 0 470 178" preserveAspectRatio="xMidYMid meet"></svg></div>
                  <div className="cv-ov-footer"><span className="cv-btn cv-btn-primary">Ver detalle ›</span></div>
                </div>
              </div>
              <div className="cv-ov-panel cv-p4" style={{opacity:.35, pointerEvents:'none'}}>
                <div className="cv-ov-side"><div className="cv-ov-title">Anticipos y Retegarantías</div></div>
                <div className="cv-ov-body"><div className="cv-ov-chart" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'.65rem',color:'#707070'}}>Pendiente</span></div></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal CID Detalle */}
      {cidModal && (
        <div className="cv-modal-bg" onClick={e => { if (e.target === e.currentTarget) setCidModal(null); }}>
          <div className="cv-modal">
            <button className="cv-modal-close" onClick={() => setCidModal(null)}>✕</button>
            <h3 className="cv-modal-title">Costos Administrativos · {cidModal.name}</h3>
            <div style={{overflowX:'auto'}}>
              <table className="cv-modal-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    {cidModal.rows.map((r, i) => <th key={i}>{r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {key:'cid51',  label:'Nómina personal obra'},
                    {key:'cid52',  label:'Servicios Públicos'},
                    {key:'cid53',  label:'Gastos de Obra'},
                    {key:'cid54',  label:'SST Obra'},
                    {key:'cid_int',label:'Interventoría'},
                  ].map(c => (
                    <tr key={c.key}>
                      <td>{c.label}</td>
                      {cidModal.rows.map((r, i) => <td key={i}>{r[c.key] ? fmtM(r[c.key]) : '$0'}</td>)}
                    </tr>
                  ))}
                  <tr className="cv-total-row">
                    <td>TOTAL CID</td>
                    {cidModal.rows.map((r, i) => <td key={i}>{fmtM((r.cid51||0)+(r.cid52||0)+(r.cid53||0)+(r.cid54||0)+(r.cid_int||0))}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
