export function getApiBaseUrl() {
  // Detectar si estamos en Vercel o en producción
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isVercel = hostname.includes('vercel.app');
  const isProd = import.meta.env.MODE === 'production' || import.meta.env.PROD === true;

  // FORZAR: Si estamos en vercel.app, SIEMPRE usar rutas relativas
  if (isVercel) {
    return '';
  }

  // Si está en modo producción, usar rutas relativas
  if (isProd) {
    return '';
  }

  // Si está definida VITE_API_URL en desarrollo, usarla
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Desarrollo local: fallback
  return 'http://localhost:4000';
}
