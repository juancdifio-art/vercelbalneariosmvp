import React, { useEffect } from 'react';
import { CerrarIcon } from '../icons';
import { useHiloSoporte } from '../../hooks/useSoporte';
import MensajesSoporte from './MensajesSoporte';
import EscribirSoporte from './EscribirSoporte';

/**
 * Chat del establecimiento con soporte, en un panel lateral sobre la pantalla
 * en la que esta: cada mensaje se guarda con esa `pantalla`, asi un reporte de
 * error ya dice donde paso. `onLeido` corre al leer el hilo (las respuestas
 * quedan leidas) para actualizar el contador del menu.
 */
function SoportePanel({ abierto, onCerrar, pantalla, onLeido }) {
  const hilo = useHiloSoporte(abierto ? 'mensajes' : null, { alCargar: onLeido });

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    // Por encima de los avisos globales (z-[70]): si no, uno tapa la cruz de cerrar.
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onCerrar} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Soporte" className="relative flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-3 bg-sky-900 px-4 py-3 text-white">
          <div>
            <h2 className="text-base font-semibold">Soporte</h2>
            <p className="text-xs text-sky-200">Contanos un error, una sugerencia o una consulta. Te respondemos acá.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar soporte" className="rounded-lg p-1.5 text-sky-100 hover:bg-sky-800">
            <CerrarIcon className="h-5 w-5" />
          </button>
        </header>

        <MensajesSoporte
          mensajes={hilo.mensajes}
          lado="establecimiento"
          nombreOtro="Soporte"
          cargando={hilo.cargando}
          vacio="Todavía no hay mensajes. Si algo no anda o se te ocurre una mejora, escribinos."
        />

        {hilo.error && (
          <p role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">
            {hilo.error}
          </p>
        )}

        <EscribirSoporte
          conTipo
          enviando={hilo.enviando}
          onEnviar={(datos) => hilo.enviar({ ...datos, pantalla })}
          placeholder="¿Qué pasó o qué te gustaría mejorar?"
        />
      </aside>
    </div>
  );
}

export default SoportePanel;
