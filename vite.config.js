import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

// ⚠️ Antes de empezar, personaliza estos dos valores:
//
// 1) REMOTE_NAME — nombre único de tu módulo (ej. "remote_contabilidad").
//    Avísale al super admin este nombre: lo necesita para registrar tu
//    módulo en remoteRegistry.js del shell.
//
// 2) PORT — puerto local para desarrollo (uno distinto por desarrollador,
//    ej. 3001-3010). Avísale al super admin el puerto elegido para que
//    agregue http://localhost:PORT como Redirect URI en Entra ID
//    (necesario solo para "npm run dev:real").
const REMOTE_NAME = "remote_costos";
const PORT = 3005;

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: REMOTE_NAME,
      filename: "remoteEntry.js",
      // Sin generación de tipos (.d.ts) entre remotes — proyecto en JS, no TS.
      dts: false,
      exposes: {
        // Esta clave ("./TuComponente") es la que el shell usará como
        // "module" en remoteRegistry.js. Si renombras el archivo o exportas
        // más de un componente, agrega/edita entradas aquí.
        "./TuComponente": "./src/TuComponente.jsx",
      },
      // Debe coincidir EXACTAMENTE con las versiones del shell — no
      // actualices estas dependencias por tu cuenta sin avisar.
      // @azure/msal-react y @azure/msal-browser se quitaron de shared: este
      // módulo ya no hace login ni llamadas en vivo (solo datos estáticos),
      // así que no los usa. Declararlos igual obligaba al runtime de MF a
      // inicializarlos al arrancar el remoto, lo cual causaba el error
      // "no se pudo cargar el módulo" en el shell.
      shared: {
        react: { singleton: true, requiredVersion: "^18.2.0" },
        "react-dom": { singleton: true, requiredVersion: "^18.2.0" },
        "react-router-dom": { singleton: true, requiredVersion: "^6.20.0" },
      },
    }),
  ],
  server: {
    port: PORT,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "esnext",
    modulePreload: false,
  },
});
