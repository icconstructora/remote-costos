# remote-template

Plantilla base para los módulos federados (microfrontends) de IC Constructora.
Guía completa de uso: `docs/guia-desarrollo-remotes.md` en el repo del shell
(`icconstructora/vic-ic-constructora-app`).

## Quick start

```bash
npm install

# Modo rápido — datos de ejemplo, sin login
npm run dev

# Modo real — login con tu cuenta Microsoft (IC), llamadas reales al backend
npm run dev:real
```

## Antes de empezar

1. En `vite.config.js`, cambia `REMOTE_NAME` (ej. `remote_contabilidad`) y `PORT`
   (uno distinto por desarrollador, 3001-3010).
2. Avísale al super admin tu `REMOTE_NAME` y `PORT` para:
   - Registrar tu módulo en `remoteRegistry.js` del shell
   - Agregar `http://localhost:PORT` como Redirect URI en Entra ID (solo si usas `dev:real`)

## Tu código va en

- `src/TuComponente.jsx` — el componente que el shell carga en su layout
- `src/harness/mockData.js` — respuestas simuladas para `npm run dev`

No necesitas tocar nada más de `src/harness/` ni `vite.config.js` (salvo `REMOTE_NAME`/`PORT`
y, si agregas más componentes, la sección `exposes`).

## Build y deploy

```bash
npm run build    # genera dist/ con remoteEntry.js + chunks
npm run preview  # sirve dist/ localmente
```

El push a `main` despliega automáticamente a Azure Static Web Apps
(`.github/workflows/azure-static-web-apps.yml`).
