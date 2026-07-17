import { apiRequest } from '../harness/msalConfig.js';

const BASE = 'https://api.icconstructora.co/api/sinco/data';
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'real';

const _dimCache = {};

export async function getToken(instance, accounts) {
  const { accessToken } = await instance.acquireTokenSilent({
    ...apiRequest,
    account: accounts[0],
  });
  return accessToken;
}

async function sincoGet(token, tabla, params = {}) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  );
  const qs = new URLSearchParams(filtered).toString();
  const url = `${BASE}/${tabla}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`[Sinco] ${tabla}: HTTP ${res.status}`);
  return res.json();
}

async function sincoGetSafe(token, tabla, params = {}) {
  try {
    return await sincoGet(token, tabla, params);
  } catch {
    return [];
  }
}

export async function fetchMerged(token, tabla, skids) {
  const results = await Promise.all(
    skids.map(sk => sincoGet(token, tabla, { skidproyecto: sk }))
  );
  return results.flat();
}

export async function fetchMergedSafe(token, tabla, skids) {
  const results = await Promise.all(
    skids.map(sk => sincoGetSafe(token, tabla, { skidproyecto: sk }))
  );
  return results.flat();
}

const CANDIDATES_CONTRATOS = [
  'adp_dtm_dim_especificaciondecontratos',
];
const CANDIDATES_ACTAS = [
  'adp_dtm_dim_especificaciondeactas',
];

let _probeDone = false;
export async function probeFactTables(token, sampleSkid) {
  if (_probeDone) return;
  _probeDone = true;
  for (const t of [...CANDIDATES_CONTRATOS, ...CANDIDATES_ACTAS]) {
    try {
      const rows = await sincoGet(token, t, { skidproyecto: sampleSkid });
      const n = Array.isArray(rows) ? rows.length : '?';
      console.log(`[probe] OK ${t} → ${n} rows`);
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`[probe] campos ${t}:`, Object.keys(rows[0]).join(', '));
      }
    } catch (e) {
      console.log(`[probe] FAIL ${t} → ${e.message}`);
    }
  }
  // Probe proyectos para ver nombres DIR/IND/NOMINA
  try {
    const rows = await sincoGet(token, 'adp_dtm_dim_proyecto', { skidempresa: 100 });
    console.log(`[probe] dim_proyecto (skidempresa=100): ${Array.isArray(rows) ? rows.length : '?'} rows`);
    if (Array.isArray(rows) && rows.length > 0) {
      console.log('[probe] dim_proyecto campos:', Object.keys(rows[0]).join(', '));
      console.log('[probe] dim_proyecto[0]:', JSON.stringify(rows[0]));
      // Mostrar skids del probe project y algunos con DIR/IND en nombre
      const dir = rows.filter(r => JSON.stringify(r).toUpperCase().includes('DIR')).slice(0,3);
      const ind = rows.filter(r => JSON.stringify(r).toUpperCase().includes('IND')).slice(0,3);
      if (dir.length) console.log('[probe] ejemplo DIR:', JSON.stringify(dir[0]));
      if (ind.length) console.log('[probe] ejemplo IND:', JSON.stringify(ind[0]));
    }
  } catch (e) {
    console.log('[probe] dim_proyecto FAIL:', e.message);
    // intentar sin param
    try {
      const rows2 = await sincoGet(token, 'adp_dtm_dim_proyecto', { skidproyecto: sampleSkid });
      console.log(`[probe] dim_proyecto (skidproyecto): ${Array.isArray(rows2) ? rows2.length : '?'} rows`);
      if (Array.isArray(rows2) && rows2.length > 0) console.log('[probe] dim_proyecto[0]:', JSON.stringify(rows2[0]));
    } catch (e2) {
      console.log('[probe] dim_proyecto skidproyecto FAIL:', e2.message);
    }
  }
}

export async function getDim(token, tabla) {
  if (_dimCache[tabla]) return _dimCache[tabla];
  const rows = await sincoGetSafe(token, tabla);
  _dimCache[tabla] = Array.isArray(rows) ? rows : [];
  return _dimCache[tabla];
}

// Para dims que requieren skidproyecto para activarse pero devuelven datos globales de empresa.
// Fetch una sola vez con el primer skid y cachea.
export async function getDimWithSkid(token, tabla, skid) {
  if (_dimCache[tabla]) return _dimCache[tabla];
  const rows = await sincoGetSafe(token, tabla, { skidproyecto: skid });
  _dimCache[tabla] = Array.isArray(rows) ? rows : [];
  return _dimCache[tabla];
}

export const isMock = () => AUTH_MODE === 'mock';
