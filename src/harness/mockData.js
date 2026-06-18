// Respuestas simuladas para el modo rápido (npm run dev, modo "mock" por
// defecto). Agrega aquí una entrada por cada ruta que tu componente consulte
// con apiGet() — la key debe ser exactamente el path que le pases a apiGet().
export const mockResponses = {
  "/api/me": {
    name: "Usuario de Prueba",
    email: "usuario.prueba@icconstructora.co",
    roles: ["mock"],
  },
};
