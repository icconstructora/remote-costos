import React, { useState, useMemo, useEffect } from 'react';
import { useStaticProyectos, useStaticCostosData } from '../hooks/useStaticData.js';
import Panel1Estado from '../components/Panel1Estado.jsx';
import Panel2Consumido from '../components/Panel2Consumido.jsx';
import Panel3Contratos from '../components/Panel3Contratos.jsx';
import Panel4Anticipos from '../components/Panel4Anticipos.jsx';
import { remoteUrl } from '../assetBase.js';

// Sub-filtros por proyecto (igual que dashboard.html + skids confirmados en Excel)
// skids = [DIR..., NOMINA...] — para modo live API
const PROJECT_SUBS = {
  'mitika': [
    { key: null,      label: 'Todo Mitika',     prefixes: ['MITIKA DIR'],                                               exact: false, skids: [408,187,188,186,184, 409,189,337,185] },
    { key: 'mit-11',  label: 'Mitika 1.1 y ZC', prefixes: ['MITIKA DIR ETAPA 1.1','MITIKA DIR ZONAS COMUNES Y URB'],   exact: true,  skids: [186,184, 185] },
    { key: 'mit-12',  label: 'Mitika 1.2',       prefixes: ['MITIKA DIR ETAPA 1.2'],                                   exact: false, skids: [408,187,188, 409,189,337] },
    { key: 'mit-t5',  label: 'Torre 5',          prefixes: ['MITIKA DIR ETAPA 1.2 TORRE 5'],                           exact: true,  skids: [408, 409] },
    { key: 'mit-t6',  label: 'Torre 6',          prefixes: ['MITIKA DIR ETAPA 1.2 TORRE 6'],                           exact: true,  skids: [187, 189] },
    { key: 'mit-t7',  label: 'Torre 7',          prefixes: ['MITIKA DIR ETAPA 1.2 TORRE 7'],                           exact: true,  skids: [188, 337] },
  ],
  'azul-t': [
    { key: null,      label: 'Todo',     prefixes: ['AZUL TURQUESA DIR'],          exact: false, skids: [168,169, 167] },
    { key: 'azt-e1',  label: 'Etapa 1', prefixes: ['AZUL TURQUESA DIR ETAPA 1'],  exact: true,  skids: [168, 167] },
    { key: 'azt-e2',  label: 'Etapa 2', prefixes: ['AZUL TURQUESA DIR ETAPA 2'],  exact: true,  skids: [169, 167] },
  ],
  'azul-c': [
    { key: null,      label: 'Todo',     prefixes: ['AZUL CELESTE DIR'],           exact: false, skids: [174,175,176, 173] },
    { key: 'azc-e1',  label: 'Etapa 1', prefixes: ['AZUL CELESTE DIR ETAPA 1'],   exact: true,  skids: [174, 173] },
    { key: 'azc-e2',  label: 'Etapa 2', prefixes: ['AZUL CELESTE DIR ETAPA 2'],   exact: true,  skids: [175, 173] },
    { key: 'azc-e3',  label: 'Etapa 3', prefixes: ['AZUL CELESTE DIR ETAPA 3'],   exact: true,  skids: [176] },
  ],
  'cast-i': [
    { key: null,      label: 'Todo',        prefixes: ['CASTILLA IMPERIAL DIR'],                     exact: false, skids: [201,193, 195] },
    { key: 'cai-e2b', label: 'Etapa 2B',   prefixes: ['CASTILLA IMPERIAL DIR ETAPA 2B'],             exact: true,  skids: [201, 195] },
    { key: 'cai-zc',  label: 'Zonas Com.', prefixes: ['CASTILLA IMPERIAL DIR ZONAS COMUNES Y URB'],  exact: true,  skids: [193] },
  ],
  'hacienda': [
    { key: null,      label: 'Todo',               prefixes: ['LA HACIENDA JAMUNDI DIR'],                                exact: false, skids: [133,139,457, 131] },
    { key: 'hac-e1',  label: 'Etapa 1',            prefixes: ['LA HACIENDA JAMUNDI DIR ETAPA 1'],                       exact: true,  skids: [133, 131] },
    { key: 'hac-ref', label: 'Reforzamiento ET 1', prefixes: ['LA HACIENDA JAMUNDI DIR ETAPA 1- REFORZAMIENTO SOLO IC'], exact: true, skids: [457] },
    { key: 'hac-e3',  label: 'Etapa 3',            prefixes: ['LA HACIENDA JAMUNDI DIR ETAPA 3'],                       exact: true,  skids: [139] },
  ],
  'primera': [
    { key: null,      label: 'Todo',        prefixes: ['PRIMERA ESTE DIR'],                      exact: false, skids: [125,119, 121] },
    { key: 'pri-e12', label: 'Etapa 1 y 2', prefixes: ['PRIMERA ESTE DIR ETAPA 1 Y 2'],         exact: true,  skids: [125, 121] },
    { key: 'pri-zc',  label: 'Zonas Com.',  prefixes: ['PRIMERA ESTE DIR ZONAS COMUNES Y URB'], exact: true,  skids: [119] },
  ],
  'oporto': [
    { key: null,      label: 'Todo',        prefixes: ['RESERVA DE OPORTO'],                                  exact: false, skids: [117,118, 116,401] },
    { key: 'opo-e12', label: 'Etapa 1 y 2', prefixes: ['RESERVA DE OPORTO DIR ETAPA 1, 2 Y ZONAS COMUNES'], exact: true,  skids: [117, 116] },
    { key: 'opo-e3',  label: 'Etapa 3',     prefixes: ['RESERVA DE OPORTO ETAPA 3 Y ZONAS COMUNES'],        exact: true,  skids: [118, 401] },
  ],
  'praia': [
    { key: null,      label: 'Todo',          prefixes: ['PRAIA NATURA DIR'],                exact: false, skids: [105,108,101, 103,344] },
    { key: 'pra-e1',  label: 'Etapa 1',       prefixes: ['PRAIA NATURA DIR ETAPA 1'],        exact: true,  skids: [105, 103] },
    { key: 'pra-e2',  label: 'Etapa 2',       prefixes: ['PRAIA NATURA DIR ETAPA 2'],        exact: true,  skids: [108, 344] },
    { key: 'pra-zc',  label: 'Zonas Comunes', prefixes: ['PRAIA NATURA DIR ZONAS COMUNES'], exact: false, skids: [101] },
  ],
  'verde': [
    { key: null,      label: 'Todo',     prefixes: ['VERDE VIVO DIR'],          exact: false, skids: [180,181,182, 179] },
    { key: 'ver-e1',  label: 'Etapa 1', prefixes: ['VERDE VIVO DIR ETAPA 1'],  exact: true,  skids: [180] },
    { key: 'ver-e2',  label: 'Etapa 2', prefixes: ['VERDE VIVO DIR ETAPA 2'],  exact: true,  skids: [181, 179] },
    { key: 'ver-e3',  label: 'Etapa 3', prefixes: ['VERDE VIVO DIR ETAPA 3'],  exact: true,  skids: [182] },
  ],
};

const FONT = "'Century Gothic','Nunito',sans-serif";

function CorteBar({ corte, generatedAt, updateManifest }) {
  const [open, setOpen] = useState(false);
  const manifest = updateManifest || {};
  const scripts  = manifest.scripts || [];
  const lastRun  = manifest.last_run || generatedAt || '';
  const allOk    = manifest.all_ok !== false;

  if (!lastRun && !scripts.length) return null;

  return (
    <div style={{ position: 'absolute', top: 22, right: 24, zIndex: 20, fontFamily: FONT, textAlign: 'right' }}>
      <div
        style={{ fontSize: '.62rem', color: '#888', letterSpacing: '.05em', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}
        onClick={() => setOpen(o => !o)}
        title="Ver detalle de actualización"
      >
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: allOk ? '#2E7D32' : '#C62828', flexShrink: 0 }} />
        {lastRun && <>Actualizado: <strong style={{ color: '#555' }}>{lastRun}</strong></>}
        <span style={{ fontSize: '.55rem', color: '#aaa' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && scripts.length > 0 && (
        <div style={{ marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', minWidth: 220, boxShadow: '0 2px 8px rgba(0,0,0,.12)', textAlign: 'left' }}>
          <div style={{ fontSize: '.58rem', color: '#888', marginBottom: 4, fontWeight: 700, letterSpacing: '.06em' }}>ÚLTIMA ACTUALIZACIÓN POR COMPONENTE</div>
          {scripts.map(s => (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '.6rem', padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: '#555' }}>{s.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'ok' ? '#2E7D32' : '#C62828', display: 'inline-block', flexShrink: 0 }} />
                <strong style={{ color: s.status === 'ok' ? '#333' : '#C62828' }}>{s.timestamp || '—'}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardInner({ macros, loadingMacros, errorMacros }) {
  const [activeMacroKey, setActiveMacroKey] = useState(
    () => sessionStorage.getItem('activeMacroKey') || null
  );
  const [activeSubKey, setActiveSubKey] = useState(
    () => sessionStorage.getItem('activeSubKey') || null
  );

  const effectiveMacro = useMemo(() => {
    if (activeMacroKey) return macros.find(m => m.key === activeMacroKey) || null;
    return macros[0] || null;
  }, [macros, activeMacroKey]);

  const subs = effectiveMacro ? (PROJECT_SUBS[effectiveMacro.key] || null) : null;

  // Sub-filtro activo (primer chip = null = "Todo" por defecto)
  const activeSub = useMemo(() => {
    if (!subs) return null;
    return subs.find(s => s.key === activeSubKey) || subs[0];
  }, [subs, activeSubKey]);

  // Cambiar proyecto: resetear sub-filtro y persistir
  function selectMacro(key) {
    setActiveMacroKey(key);
    setActiveSubKey(null);
    sessionStorage.setItem('activeMacroKey', key || '');
    sessionStorage.removeItem('activeSubKey');
  }

  const data = useStaticCostosData(effectiveMacro);

  // Filtrar contratos estáticos según sub-filtro activo
  const contratosFiltered = useMemo(() => {
    if (!data.contratos) return null;
    if (!activeSub || !activeSub.key) return data.contratos;
    return data.contratos.filter(r => {
      const proy = r.proyecto || '';
      return activeSub.prefixes.some(p =>
        activeSub.exact ? proy === p : proy.startsWith(p)
      );
    });
  }, [data.contratos, activeSub]);

  // Sub-key para datos de detalle/consumido/balance
  // Si hay un sub seleccionado con key propio, usarlo siempre (aunque no tenga datos aún)
  const subDataKey = activeSub?.key || effectiveMacro?.key;
  const detalleKey = activeSub?.key
    ? activeSub.key
    : (data.detalleData && subDataKey && data.detalleData[subDataKey]) ? subDataKey : effectiveMacro?.key;
  const consumidoKey = activeSub?.key
    ? activeSub.key
    : (data.consumidoData && subDataKey && data.consumidoData[subDataKey]) ? subDataKey : effectiveMacro?.key;
  const balanceKey = activeSub?.key
    ? activeSub.key
    : (data.balanceData && subDataKey && data.balanceData[subDataKey]) ? subDataKey : effectiveMacro?.key;

  return (
    <>
      <header>
        <div>
          <h1>CONTROL DE COSTOS</h1>
          <div className="hdr-company">IC CONSTRUCTORA S.A.S.</div>
        </div>
        <div className="hdr-right">
          <span className="dot-live" style={{ background: '#999' }} />
          <span>Datos estáticos</span>
          <img src={remoteUrl('/images/IC_logo.png')} alt="IC Constructora" className="ic-logo" />
        </div>
      </header>

      <div style={{ position: 'relative' }}>
        <div className="ticker-wrap">
          <div className="ticker-track">
            <span>IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp; IC CONSTRUCTORA &nbsp;·&nbsp; 55 AÑOS TRANSFORMANDO VIDAS &nbsp;·&nbsp;</span>
          </div>
        </div>
        <CorteBar corte={data.corte || data.corteConsumido} generatedAt={data.generatedAt} updateManifest={data.updateManifest} />
        <div className="proj-strip">
        <div className="proj-strip-inner">
          {loadingMacros && <span style={{color:'#bbb',fontSize:'.7rem'}}>Cargando proyectos…</span>}
          {errorMacros   && <span style={{color:'red',fontSize:'.7rem'}}>{errorMacros}</span>}
          {macros.map(m => (
            <div
              key={m.key}
              className={`proj-chip${effectiveMacro?.key === m.key ? ' active' : ''}`}
              onClick={() => selectMacro(m.key)}
            >
              <div className="chip-img">
                <img src={remoteUrl(`/images/${m.img}`)} alt={m.label} onError={e => { e.target.style.display='none'; }} />
              </div>
              <span className="chip-label">{m.label}</span>
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="content">
        {effectiveMacro && (
          <div className="proj-title-bar">
            <h2>{effectiveMacro.label}</h2>
            {subs && (
              <div className="sub-strip-inline">
                <span className="sub-strip-label">VER:</span>
                {subs.map(s => (
                  <button
                    key={s.key ?? '__todo__'}
                    className={`sub-chip${activeSub?.key === s.key ? ' active' : ''}`}
                    onClick={() => { setActiveSubKey(s.key); sessionStorage.setItem('activeSubKey', s.key || ''); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {data.error && <div className="error-msg">Error: {data.error}</div>}
        <div className="panels-grid">
          <Panel1Estado
            loading={data.loading}
            corte={data.corte}
            detalleData={data.detalleData}
            estadoData={data.estadoData}
            macroKey={detalleKey}
            macro={effectiveMacro}
          />
          <Panel2Consumido
            loading={data.loading}
            controlRows={data.controlRows}
            claseMap={data.claseMap}
            capMap={data.capMap}
            corte={data.corte}
            consumidoData={data.consumidoData}
            consumidoDetalle={data.consumidoDetalle}
            corteConsumido={data.corteConsumido}
            macroKey={consumidoKey}
            macro={effectiveMacro}
          />
          <Panel3Contratos
            loading={data.loading}
            especContratosRows={data.especContratosRows}
            especActasRows={data.especActasRows}
            actasF={data.actasF}
            macro={effectiveMacro}
            activeSub={activeSub}
            liquidados={data.liquidados}
            contratosStatic={contratosFiltered}
            balanceData={data.balanceData}
            macroKey={balanceKey}
          />
          <Panel4Anticipos
            loading={data.loading}
            especActasRows={data.especActasRows}
            liquidados={data.liquidados}
            corte={data.corte}
            balanceData={data.balanceData}
            comprasData={data.comprasData}
            anticiposData={data.anticiposData}
            macroKey={balanceKey}
            macro={effectiveMacro}
            activeSub={activeSub}
          />
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { macros, loading, error } = useStaticProyectos();
  return <DashboardInner macros={macros} loadingMacros={loading} errorMacros={error} />;
}
