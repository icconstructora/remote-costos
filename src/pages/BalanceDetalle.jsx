import React, { useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useStaticProyectos, useStaticCostosData } from '../hooks/useStaticData.js';
import { remoteUrl } from '../assetBase.js';

function fmtK(v) {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (!n) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n).toLocaleString('es-CO');
}

const TICKER_TEXT = 'IC CONSTRUCTORA · 55 AÑOS TRANSFORMANDO VIDAS · ';

export default function BalanceDetalle() {
  const { macroKey } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const balanceKey = location.state?.balanceKey || macroKey;
  const subLabel   = location.state?.subLabel   || null;

  const { macros } = useStaticProyectos();
  const macro      = macros.find(m => m.key === macroKey) || null;

  const data = useStaticCostosData(macro);

  const balanceData    = data.balanceData;
  const contratosRaw   = data.contratos || [];

  // NC → contratista (para mapear Con Acta)
  const ncToContratista = useMemo(() => {
    const m = {};
    contratosRaw.forEach(c => {
      const nc = String(c.noContrato || c['No. Contrato'] || '');
      if (nc) m[nc] = (c.contratista || '').toUpperCase().trim();
    });
    return m;
  }, [contratosRaw]);

  // Construir tabla por tercero
  const { rows: tableRows, totals } = useMemo(() => {
    const brows  = balanceData?.[balanceKey]?.rows || [];
    const btotal = balanceData?.[balanceKey]?.totals || {};

    const map = {};
    const ensure = k => {
      if (!map[k]) map[k] = { gta: 0, gtaAnt: 0, ant: 0, conActa: 0, conActaEk: 0, devRet: 0, gtaPag: 0, isEkOnly: false };
    };

    brows.forEach(r => {
      const acct    = r.acct || '';
      const saldo   = r.saldo || 0;
      const saldoAnt = r.saldo_ant || 0;

      if (acct === 'Gta. Cumplimiento') {
        const k = (r.tercero || '').trim();
        ensure(k);
        map[k].gta    += saldo;
        map[k].gtaAnt += saldoAnt;

      } else if (acct === 'Ant. Contratistas') {
        const k = (r.tercero || '').trim();
        ensure(k);
        map[k].ant += saldo;

      } else if (acct === 'Con Acta') {
        const k = (r.tercero || '').trim();
        ensure(k);
        map[k].conActa += saldo;

      } else if (acct === 'Con Acta EK') {
        const k = (r.tercero || '').trim();
        ensure(k);
        map[k].conActaEk += saldo;
        map[k].isEkOnly   = true;

      } else if (acct === 'Dev. Ret. Garantía') {
        const k = (r.tercero || '').trim();
        ensure(k);
        map[k].devRet += saldo;

      } else if (acct === 'Gta. Pagadas') {
        const k = (r.tercero || '').trim();
        ensure(k);
        map[k].gtaPag += saldo;
      }
    });

    const sorted = Object.entries(map)
      .filter(([, v]) => v.gta + v.ant + v.conActa + v.conActaEk + v.devRet + v.gtaPag > 0)
      .map(([tercero, v]) => ({ tercero, ...v }))
      .sort((a, b) => {
        // Con Gta. Cumplimiento primero (desc); sin gta al final (desc por conActaEk / gtaPag)
        if (a.gta > 0 && b.gta === 0) return -1;
        if (a.gta === 0 && b.gta > 0) return  1;
        if (a.gta !== b.gta) return b.gta - a.gta;
        return (b.conActaEk + b.gtaPag) - (a.conActaEk + a.gtaPag);
      });

    const sumOf = f => sorted.reduce((s, r) => s + (r[f] || 0), 0);

    return {
      rows: sorted,
      totals: {
        gta:       sumOf('gta'),
        gtaAnt:    sumOf('gtaAnt'),
        ant:       sumOf('ant'),
        conActa:   sumOf('conActa'),
        conActaEk: sumOf('conActaEk'),
        devRet:    sumOf('devRet'),
        gtaPag:    sumOf('gtaPag'),
        liquidado: btotal.liquidado || 0,
      },
    };
  }, [balanceData, balanceKey, ncToContratista]);

  const macroLabel = macro?.label || macroKey;
  const isLoading  = data.loading;

  return (
    <div className="det-page">

      {/* HEADER */}
      <div className="det-header">
        <button className="det-back" onClick={() => navigate(-1)}>← Volver</button>
        <div>
          <div className="det-title">
            A&amp;F · BALANCE DE GARANTÍAS
            <span className="det-title-sep">/</span>
            <span className="det-title-proj">{macroLabel}{subLabel ? ` · ${subLabel}` : ''}</span>
          </div>
        </div>
        <div className="det-hdr-spacer" />
        <div className="det-hdr-badge">
          <span className="det-hdr-dot" />
          {tableRows.length} terceros · {macroLabel}
        </div>
        <img className="det-hdr-ic" src={remoteUrl('/images/IC_logo.png')} alt="IC" />
      </div>

      {/* TICKER */}
      <div className="det-ticker" aria-hidden="true">
        <span className="det-ticker-inner">{TICKER_TEXT.repeat(12)}</span>
      </div>

      {/* RESUMEN CARDS */}
      <div className="det-cards-section">
        <div className="det-cards-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {[
            { lbl: 'Gta. Cumplimiento', val: totals.gta,       color: '#B85520' },
            { lbl: 'Saldo Anticipo',    val: totals.ant,        color: '#8A6010' },
            { lbl: 'Con Acta',          val: totals.conActa,    color: '#7B3F00' },
            { lbl: 'Con Acta EK',       val: totals.conActaEk,  color: '#7B3F00' },
            { lbl: 'Gta. para Pago',    val: totals.devRet || totals.liquidado, color: '#3A7228' },
            { lbl: 'Gta. Pagadas',      val: totals.gtaPag,     color: '#1A6B7C' },
          ].map(({ lbl, val, color }) => (
            <div key={lbl} className="det-card2" style={{ '--dc-col': color, flex: '0 0 160px' }}>
              <span className="dc2-lbl" style={{ fontSize: '.72rem' }}>{lbl}</span>
              <span className="dc2-num" style={{ color, fontSize: '1rem' }}>{fmtK(val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TABLA */}
      <div className="det-panel">
        <div className="det-panel-toolbar">
          <span className="det-count-label">{tableRows.length} terceros</span>
        </div>

        <div className="det-table-wrap">
          {isLoading && (
            <div className="state-center" style={{ padding: 40 }}>
              <div className="spinner" /><span>Cargando…</span>
            </div>
          )}
          {!isLoading && (
            <table className="det-table">
              <thead>
                <tr>
                  <th>TERCERO</th>
                  <th className="col-num" style={{ color: '#B85520' }}>GTA. CUMPLIMIENTO</th>
                  <th className="col-num" style={{ color: '#8A6010' }}>SALDO ANTICIPO</th>
                  <th className="col-num" style={{ color: '#7B3F00' }}>CON ACTA</th>
                  <th className="col-num" style={{ color: '#7B3F00' }}>CON ACTA EK</th>
                  <th className="col-num" style={{ color: '#3A7228' }}>GTA. PARA PAGO</th>
                  <th className="col-num" style={{ color: '#1A6B7C' }}>GTA. PAGADAS</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(r => (
                  <tr key={r.tercero}>
                    <td className="col-cont" title={r.tercero}>{r.tercero || '—'}</td>
                    <td className="col-num" style={{ color: r.gta > 0 ? '#B85520' : undefined }}>{fmtK(r.gta)}</td>
                    <td className="col-num" style={{ color: r.ant > 0 ? '#8A6010' : undefined }}>{fmtK(r.ant)}</td>
                    <td className="col-num" style={{ color: r.conActa > 0 ? '#7B3F00' : undefined }}>{fmtK(r.conActa)}</td>
                    <td className="col-num" style={{ color: r.conActaEk > 0 ? '#7B3F00' : undefined }}>{fmtK(r.conActaEk)}</td>
                    <td className="col-num" style={{ color: r.devRet > 0 ? '#3A7228' : undefined }}>{fmtK(r.devRet)}</td>
                    <td className="col-num" style={{ color: r.gtaPag > 0 ? '#1A6B7C' : undefined }}>{fmtK(r.gtaPag)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="row-total">
                  <td>TOTALES ({tableRows.length})</td>
                  <td className="col-num">{fmtK(totals.gta)}</td>
                  <td className="col-num">{fmtK(totals.ant)}</td>
                  <td className="col-num">{fmtK(totals.conActa)}</td>
                  <td className="col-num">{fmtK(totals.conActaEk)}</td>
                  <td className="col-num">{fmtK(totals.devRet || totals.liquidado)}</td>
                  <td className="col-num">{fmtK(totals.gtaPag)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          {!isLoading && tableRows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              Sin datos de balance para este proyecto
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
