export function getApiBaseUrl() {
  // 1) Si está definida VITE_API_URL, siempre la usamos (desarrollo o producción)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2) En producción (Vercel), si no hay VITE_API_URL, asumimos mismo origen
  //    Esto hace que `${API_BASE_URL}/api/...` se convierta en `/api/...`
  if (import.meta.env.PROD) {
    return '';
  }

  // 3) Desarrollo local: fallback al backend clásico en localhost:4000
  return 'http://localhost:4000';
}
