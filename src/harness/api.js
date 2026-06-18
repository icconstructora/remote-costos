import { useMsal } from "@azure/msal-react";
import { apiRequest } from "./msalConfig";
import { mockResponses } from "./mockData";

const API_URL = "https://api.icconstructora.co";

// Sin VITE_AUTH_MODE definido (build de producción dentro del shell) el
// modo por defecto es "real". Solo "npm run dev" (modo development) carga
// .env.development con VITE_AUTH_MODE=mock.
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || "real";

// Hook para llamar al backend único. Funciona igual en los 3 contextos:
//  - npm run dev        -> AUTH_MODE=mock, devuelve datos de harness/mockData.js
//  - npm run dev:real   -> AUTH_MODE=real, usa tu sesión Microsoft del harness
//  - dentro del shell   -> AUTH_MODE=real, usa la sesión del shell (MsalProvider compartido)
export function useApi() {
  const { instance, accounts } = useMsal();

  async function apiGet(path) {
    if (AUTH_MODE === "mock") {
      if (path in mockResponses) return mockResponses[path];
      throw new Error(`Sin mock para "${path}" — agrégalo en src/harness/mockData.js`);
    }

    const account = accounts[0];
    const { accessToken } = await instance.acquireTokenSilent({ ...apiRequest, account });
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  return { apiGet };
}
