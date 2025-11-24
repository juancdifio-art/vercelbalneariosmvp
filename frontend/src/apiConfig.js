export function getApiBaseUrl() {
  // Detectar si estamos en Vercel o en producción
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isVercel = hostname.includes('vercel.app');
  const isProd = import.meta.env.MODE === 'production' || import.meta.env.PROD === true;

  // FORZAR: Si estamos en vercel.app, SIEMPRE usar rutas relativas
  if (isVercel) {
    console.log('[API Config] Detected Vercel, using relative paths');
    return '';
  }

  // Si está en modo producción, usar rutas relativas
  if (isProd) {
    console.log('[API Config] Production mode, using relative paths');
    return '';
  }

  // Si está definida VITE_API_URL en desarrollo, usarla
  if (import.meta.env.VITE_API_URL) {
    console.log('[API Config] Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }

  // Desarrollo local: fallback
  console.log('[API Config] Using localhost fallback');
  return 'http://localhost:4000';
}
