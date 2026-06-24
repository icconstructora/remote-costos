import { apiRequest } from '../harness/msalConfig.js';

const BASE = 'https://api.icconstructora.co/api/sinco/data';
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'real';

// Cache global de dims (vive durante la sesión del browser)
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

// Llama la tabla para cada skidproyecto en paralelo y fusiona
export async function fetchMerged(token, tabla, skids) {
  const results = await Promise.all(
    skids.map(sk => sincoGet(token, tabla, { skidproyecto: sk }))
  );
  return results.flat();
}

// Tablas de dimensión (sin skidproyecto) — cached por nombre de tabla
export async function getDim(token, tabla) {
  if (_dimCache[tabla]) return _dimCache[tabla];
  const rows = await sincoGet(token, tabla);
  _dimCache[tabla] = Array.isArray(rows) ? rows : [];
  return _dimCache[tabla];
}

export const isMock = () => AUTH_MODE === 'mock';
