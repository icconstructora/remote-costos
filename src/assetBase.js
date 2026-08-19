// Resuelve rutas públicas (/data/..., /images/...) contra el origen donde está
// desplegado ESTE módulo remoto, no contra el origen de la página host (el shell
// en vic.icconstructora.co). Necesario porque el componente se ejecuta embebido
// dentro de la página del shell vía Module Federation, y un fetch('/data/x.json')
// sin resolver apuntaría por error al dominio del shell.
export function remoteUrl(path) {
  return new URL(path, import.meta.url).href;
}
