import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { remoteUrl } from '../assetBase.js';

/* ── Formato números ── */
const fmtFull = v => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`;
};
const fmtM = v => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}MM`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`;
};
const pctNum = v => (Math.abs(v) > 9.99 || !isFinite(v)) ? null : Math.round(v * 100);

/* ── Etiquetas completas ── */
const LABELS = {
  praia:'PRAIA NATURA','pra-e1':'PRAIA NATURA · Etapa 1','pra-e2':'PRAIA NATURA · Etapa 2','pra-zc':'PRAIA NATURA · Zonas Comunes',
  oporto:'RESERVA DE OPORTO','opo-e12':'RESERVA DE OPORTO · Etapas 1-2','opo-e3':'RESERVA DE OPORTO · Etapa 3',
  primera:'PRIMERA ESTE','pri-e12':'PRIMERA ESTE · Etapas 1-2','pri-zc':'PRIMERA ESTE · Zonas Comunes',
  hacienda:'LA HACIENDA','hac-e1':'LA HACIENDA · Etapa 1','hac-e3':'LA HACIENDA · Etapa 3','hac-ref':'LA HACIENDA · Reforma',
  bosque:'BOSQUE CENTRAL','cast-l':'CASTILLA LIVING','cast-i':'CASTILLA IMPERIAL',
  'cai-zc':'CASTILLA IMPERIAL · Zonas Comunes','cai-e2b':'CASTILLA IMPERIAL · Etapa 2B',
  mitika:'MÍTIKA','mit-11':'MÍTIKA · Torre 11','mit-12':'MÍTIKA · Torres 1-2',
  'mit-t5':'MÍTIKA · Torre 5','mit-t6':'MÍTIKA · Torre 6','mit-t7':'MÍTIKA · Torre 7',
  'azul-t':'AZUL TURQUESA','azt-e1':'AZUL TURQUESA · Etapa 1','azt-e2':'AZUL TURQUESA · Etapa 2',
  'azul-c':'AZUL CELESTE','azc-e1':'AZUL CELESTE · Etapa 1','azc-e2':'AZUL CELESTE · Etapa 2','azc-e3':'AZUL CELESTE · Etapa 3',
  verde:'VERDE VIVO','ver-e1':'VERDE VIVO · Etapa 1','ver-e2':'VERDE VIVO · Etapa 2','ver-e3':'VERDE VIVO · Etapa 3',
  well:'WELL', gaia:'GAIA',
};

/* ── Pill de porcentaje ── */
function PctPill({ pct }) {
  if (pct === null) return null;
  let bg, color;
  if (pct >= 100)      { bg = '#FDDADA'; color = '#A01010'; }
  else if (pct >= 70)  { bg = '#FDE8C8'; color = '#8A4000'; }
  else if (pct >= 0)   { bg = '#D8F0D0'; color = '#2E6E1E'; }
  else                 { bg = '#E8E8E8'; color = '#505050'; }
  return (
    <span style={{
      fontSize: '.56rem', fontWeight: 700, padding: '2px 6px', borderRadius: 9,
      background: bg, color, whiteSpace: 'nowrap', textAlign: 'center', minWidth: 40,
    }}>
      {pct}%
    </span>
  );
}

/* ── Fila de capítulo ── */
function CapRow({ item, tipo, expandAll }) {
  const [open, setOpen] = useState(false);
  const isOpen = expandAll || open;

  const rawPct = item.pct ?? (item.proy > 0 ? item.pa / item.proy : 0);
  const pct    = isFinite(rawPct) ? rawPct : 0;
  const pillPct = pctNum(pct);

  return (
    <div style={{ borderBottom: '2px solid #E8E8E8' }}>
      {/* Header capítulo */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'grid',
          gridTemplateColumns: '12px 1fr auto',
          gap: 8, alignItems: 'center',
          padding: '7px 14px', cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#F5F0FF'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        <span style={{ fontSize: '.65rem', color: '#707070', transition: 'transform .2s', display:'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span style={{
          fontSize: '.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3,
          background: '#EAE2F8', color: '#4A2080',
          whiteSpace: 'normal', lineHeight: 1.25,
        }}>
          {item.num ? <span style={{ opacity: .65, marginRight: 5 }}>{item.num}</span> : null}
          {item.cap}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
            {fmtFull(item.pa ?? 0)}
          </div>
          <div style={{ fontSize: '.56rem', color: '#707070', whiteSpace: 'nowrap' }}>
            {item.subs?.length ?? 1} ítem{(item.subs?.length ?? 1) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Ítem expandido */}
      {isOpen && (
        <div style={{ background: tipo === 'crit' ? '#FFFCFC' : tipo === 'otro' ? '#FCFFFC' : '#F5F9FF', borderTop: '1px solid #E8E8E8' }}>
          {/* Totales del capítulo */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8,
            padding: '5px 14px 7px 24px', borderBottom: '1px dashed #DDD',
            background: '#F0F0F0',
          }}>
            {[
              { k: 'ppto', l: 'Presupuesto' },
              { k: 'proy', l: 'Proyectado' },
              { k: 'aseg', l: 'Asegurado' },
              { k: 'cons', l: 'Consumido' },
              { k: 'pa',   l: 'Por Asegurar' },
            ].map(col => (
              <div key={col.k}>
                <div style={{ fontSize: '.5rem', textTransform: 'uppercase', color: '#707070', fontWeight: 700, letterSpacing: '.07em' }}>{col.l}</div>
                <div style={{ fontSize: '.65rem', fontWeight: col.k === 'pa' ? 700 : 500, color: col.k === 'pa' ? '#A01010' : '#1A1A1A' }}>
                  {fmtFull(item[col.k] ?? 0)}
                </div>
              </div>
            ))}
          </div>
          {/* Sub-ítems */}
          {(item.subs?.length > 0) && (
            <div>
              {/* Encabezado sub-ítems */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                padding: '3px 14px 3px 32px', gap: 6,
                fontSize: '.5rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.07em', color: '#909090', background: '#EBEBEB',
              }}>
                <span>Ítem</span><span style={{ textAlign: 'right' }}>Proyectado</span>
                <span style={{ textAlign: 'right' }}>Asegurado</span>
                <span style={{ textAlign: 'right' }}>Por Asegurar</span>
              </div>
              {item.subs.map((s, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                  padding: '4px 14px 4px 32px', gap: 6, alignItems: 'center',
                  borderBottom: '1px solid #EFEFEF',
                  background: i % 2 === 0 ? '#FAFAFA' : '#FFFFFF',
                }}>
                  <span style={{ fontSize: '.64rem', color: '#222', lineHeight: 1.25 }}>
                    {s.num && <span style={{ opacity: .6, marginRight: 4, fontWeight: 700 }}>{s.num}</span>}
                    {s.desc}
                  </span>
                  <span style={{ fontSize: '.64rem', textAlign: 'right', color: '#555' }}>{fmtFull(s.proy)}</span>
                  <span style={{ fontSize: '.64rem', textAlign: 'right', color: '#555' }}>{fmtFull(s.aseg)}</span>
                  <span style={{ fontSize: '.64rem', fontWeight: 700, textAlign: 'right', color: s.pa > 0 ? '#A01010' : '#1A1A1A' }}>{fmtFull(s.pa)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Columna ── */
function Col({ icon, title, tipo, items, total, expandAll, borderColor, headBg, titleColor }) {
  const sorted = useMemo(() => [...items].sort((a, b) => (b.pa ?? 0) - (a.pa ?? 0)), [items]);
  const totalItems = items.reduce((s, i) => s + (i.subs?.length ?? 1), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #CFCFCF' }}>
      {/* Cabecera columna */}
      <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: headBg, borderBottom: `2px solid ${borderColor}`, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: titleColor }}>
            {icon} {title}
          </div>
          <div style={{ fontSize: '.6rem', color: '#707070', marginTop: 2 }}>
            {items.length} capítulo{items.length !== 1 ? 's' : ''} · {totalItems} ítem{totalItems !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: titleColor, textAlign: 'right' }}>{fmtM(total)}</div>
      </div>

      {/* Encabezado tabla */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6,
        padding: '4px 14px', background: '#EBEBEB', borderBottom: '1px solid #CFCFCF',
        fontSize: '.56rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#707070',
        flexShrink: 0,
      }}>
        <span>Capítulo / Ítem</span><span>Por Asegurar</span><span>% Proy</span>
      </div>

      {/* Cuerpo scrollable */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sorted.map((item, i) => (
          <CapRow key={i} item={item} tipo={tipo} expandAll={expandAll} />
        ))}
        {items.length === 0 && (
          <div style={{ padding: 36, textAlign: 'center', color: '#707070', fontSize: '.75rem' }}>Sin datos</div>
        )}
      </div>
    </div>
  );
}

/* ── Página principal ── */
export default function EstadoDetalle() {
  const { macroKey } = useParams();
  const navigate     = useNavigate();
  const [raw, setRaw]         = useState(null);
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    fetch(remoteUrl('/data/estado_detalle_data.json'))
      .then(r => r.json())
      .then(d => setRaw(d.DETALLE_DATA || d.data || d))
      .catch(console.error);
  }, []);

  const entry = raw?.[macroKey];

  const { criticos, otros, cid, totalCrit, totalOtros, totalCid, totalPa } = useMemo(() => {
    if (!entry?.items) return { criticos: [], otros: [], cid: [], totalCrit: 0, totalOtros: 0, totalCid: 0, totalPa: 0 };
    const criticos = [], otros = [], cid = [];
    for (const it of entry.items) {
      const pa   = it.pa   ?? 0;
      const proy = it.proy ?? 1;
      const rawPct = it.pct ?? (proy > 0 ? pa / proy : 0);
      const pct  = isFinite(rawPct) ? rawPct : 0;
      if (it.tipo === 'cid')                    cid.push(it);
      else if (pct > 0.70 && pct <= 9.99)       criticos.push(it);
      else                                       otros.push(it);
    }
    const sum = arr => arr.reduce((s, i) => s + (i.pa ?? 0), 0);
    return { criticos, otros, cid, totalCrit: sum(criticos), totalOtros: sum(otros), totalCid: sum(cid), totalPa: sum(criticos)+sum(otros)+sum(cid) };
  }, [entry]);

  const label = LABELS[macroKey] || macroKey?.replace(/-/g, ' ').toUpperCase();

  const exportCSV = useCallback(() => {
    if (!entry?.items) return;
    const rows = [['Capítulo','Tipo','Presupuesto','Proyectado','Asegurado','Consumido','Por Asegurar','% Proy']];
    for (const it of entry.items) {
      const pct = it.proy > 0 ? it.pa / it.proy : 0;
      rows.push([it.cap, it.tipo?.toUpperCase()||'', it.ppto??0, it.proy??0, it.aseg??0, it.cons??0, it.pa??0, isFinite(pct) ? (pct*100).toFixed(1)+'%' : '—']);
    }
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `por_asegurar_${macroKey}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [entry, macroKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F0F0F0', fontFamily: "'Century Gothic','Nunito',sans-serif", fontSize: 13 }}>

      {/* ── Header ── */}
      <header style={{ background: '#D8D8D8', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '2px solid #C00', flexShrink: 0 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: '#6C0000', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '.72rem', fontFamily: 'inherit', fontWeight: 600 }}
        >
          ← Volver
        </button>
        <img src={remoteUrl('/images/IC_logo.png')} alt="IC" style={{ width: 46, height: 46, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
        <div>
          <h1 style={{ fontFamily: "'Oswald','Century Gothic',sans-serif", fontSize: '1rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            {label} · Por Asegurar
          </h1>
          <div style={{ fontSize: '.62rem', color: '#707070' }}>
            Costos Directos (CDD) + Retie/Conexión{entry?.fechaCorte ? ` · Corte ${entry.fechaCorte}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setExpandAll(e => !e)}
            style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '.68rem', fontFamily: 'inherit' }}
          >
            {expandAll ? '▾ Colapsar todo' : '▶ Expandir todo'}
          </button>
          <button
            onClick={exportCSV}
            style={{ background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '.68rem', fontFamily: 'inherit' }}
          >
            ⬇ Excel
          </button>
        </div>
      </header>

      {/* ── Resumen ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #CFCFCF', padding: '9px 20px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '.56rem', textTransform: 'uppercase', letterSpacing: '.1em', color: '#707070' }}>Total Por Asegurar</span>
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{fmtM(totalPa)}</span>
        </div>
        <div style={{ width: 1, height: 34, background: '#CFCFCF' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '.56rem', textTransform: 'uppercase', letterSpacing: '.1em', color: '#707070' }}>⚠️ Críticos (&gt;70%)</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#A01010' }}>{fmtM(totalCrit)}</span>
          <span style={{ fontSize: '.58rem', color: '#707070' }}>{criticos.length} ítems</span>
        </div>
        <div style={{ width: 1, height: 34, background: '#CFCFCF' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '.56rem', textTransform: 'uppercase', letterSpacing: '.1em', color: '#707070' }}>📋 Otros saldos (≤70%)</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2E6E1E' }}>{fmtM(totalOtros)}</span>
          <span style={{ fontSize: '.58rem', color: '#707070' }}>{otros.length} ítems</span>
        </div>
        <div style={{ width: 1, height: 34, background: '#CFCFCF' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '.56rem', textTransform: 'uppercase', letterSpacing: '.1em', color: '#707070' }}>🏢 Gastos Administrativos</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0B4D91' }}>{fmtM(totalCid)}</span>
          <span style={{ fontSize: '.58rem', color: '#707070' }}>{cid.length} ítems</span>
        </div>
      </div>

      {/* ── Sin datos ── */}
      {!entry && (
        <div style={{ padding: 40, textAlign: 'center', color: '#707070' }}>
          {raw ? `Sin datos para "${macroKey}"` : 'Cargando…'}
        </div>
      )}

      {/* ── Grid 3 columnas scrollable ── */}
      {entry && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', flex: 1, overflow: 'hidden' }}>
          <Col
            icon="⚠️" title="Críticos — Por Asegurar > 70% del Proyectado"
            tipo="crit" items={criticos} total={totalCrit} expandAll={expandAll}
            borderColor="#CC3333" headBg="#FDEAEA" titleColor="#A01010"
          />
          <Col
            icon="📋" title="Otros saldos — Por Asegurar ≤ 70% del Proyectado"
            tipo="otro" items={otros} total={totalOtros} expandAll={expandAll}
            borderColor="#3A8A50" headBg="#E6F5E2" titleColor="#2E6E1E"
          />
          <Col
            icon="🏢" title="Gastos Administrativos — CID"
            tipo="gd" items={cid} total={totalCid} expandAll={expandAll}
            borderColor="#5B8FC9" headBg="#DAE8FD" titleColor="#0B4D91"
          />
        </div>
      )}
    </div>
  );
}
