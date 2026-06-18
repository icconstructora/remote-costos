import { useEffect, useState } from "react";
import { useApi } from "./harness/api";

// Este es el componente que el shell carga dentro de su layout (sidebar,
// header, permisos, etc.). Reemplaza el contenido por tu módulo real —
// mantén el `export default` y, si renombras el archivo o agregas más
// componentes, actualiza los "exposes" en vite.config.js.
export default function TuComponente() {
  const { apiGet } = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/me")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: "var(--color-brand)", fontSize: 20, marginBottom: 12 }}>
        Tu Módulo
      </h1>
      <p style={{ marginBottom: 12 }}>Reemplaza este contenido por tu interfaz.</p>

      {error && <p style={{ color: "crimson" }}>Error llamando al backend: {error}</p>}
      {data && (
        <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 13 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
