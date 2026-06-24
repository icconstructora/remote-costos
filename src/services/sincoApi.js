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
  'adp_dtm_fact_contratos',
  'adp_dtm_fact_especificacioncontratos',
  'adp_dtm_fact_encabezadocontratos',
  'adp_dtm_fact_contrato',
];
const CANDIDATES_ACTAS = [
  'adp_dtm_fact_actas',
  'adp_dtm_fact_especificacionactas',
  'adp_dtm_fact_encabezadoactas',
  'adp_dtm_fact_acta',
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
}

export async function getDim(token, tabla) {
  if (_dimCache[tabla]) return _dimCache[tabla];
  const rows = await sincoGet(token, tabla);
  _dimCache[tabla] = Array.isArray(rows) ? rows : [];
  return _dimCache[tabla];
}

export const isMock = () => AUTH_MODE === 'mock';
