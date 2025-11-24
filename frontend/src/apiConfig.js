export function getApiBaseUrl() {
  // Detectar si estamos en Vercel (producción)
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

  // 1) Si estamos en Vercel O en modo producción, usar rutas relativas
  if (isVercel || import.meta.env.PROD || import.meta.env.MODE === 'production') {
    return '';
  }

  // 2) Si está definida VITE_API_URL en desarrollo, usarla
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 3) Desarrollo local: fallback al backend clásico en localhost:4000
  return 'http://localhost:4000';
}
