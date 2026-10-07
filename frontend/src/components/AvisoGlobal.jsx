import React, { useEffect, useRef } from 'react';

const DURACION_EXITO_MS = 8000;

/**
 * Los avisos de la app una vez adentro: errores ("No se pudo crear la
 * reserva") y confirmaciones ("Cochera en la plaza 3").
 *
 * Antes `error` y `success` solo se dibujaban en la pantalla de ingreso, asi
 * que adentro de la app no se veian nunca. Flotan por encima de los modales.
 * El de exito se va solo; el de error queda hasta que se cierra, porque hay
 * que leerlo.
 */
function AvisoGlobal({ error, success, onCerrarError, onCerrarSuccess }) {
  // El cierre llega como funcion nueva en cada render de App: se guarda en una
  // ref para que el reloj dependa solo del mensaje y no se reinicie.
  const cerrarSuccess = useRef(onCerrarSuccess);
  cerrarSuccess.current = onCerrarSuccess;

  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => cerrarSuccess.current(), DURACION_EXITO_MS);
    return () => clearTimeout(t);
  }, [success]);

  if (!error && !success) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] flex w-[min(92vw,26rem)] flex-col gap-2">
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800 shadow-lg">
          <span className="flex-1">{error}</span>
          <button type="button" aria-label="Cerrar aviso de error" onClick={onCerrarError} className="font-bold text-red-700 hover:text-red-900">
            ✕
          </button>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 shadow-lg">
          <span className="flex-1">{success}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={onCerrarSuccess} className="font-bold text-emerald-700 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default AvisoGlobal;
