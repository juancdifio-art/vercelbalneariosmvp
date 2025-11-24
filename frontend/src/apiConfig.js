export function getApiBaseUrl() {
  // 1) En producción, SIEMPRE usar rutas relativas (mismo origen)
  if (import.meta.env.PROD) {
    return '';
  }

  // 2) Si está definida VITE_API_URL en desarrollo, usarla
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 3) Desarrollo local: fallback al backend clásico en localhost:4000
  return 'http://localhost:4000';
}
