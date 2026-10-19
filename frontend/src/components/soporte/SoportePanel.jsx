import React, { useEffect, useState } from 'react';
import { CerrarIcon } from '../icons';
import { useHiloSoporte } from '../../hooks/useSoporte';
import MensajesSoporte from './MensajesSoporte';
import EscribirSoporte from './EscribirSoporte';
import PreguntasFrecuentes from './PreguntasFrecuentes';

const PESTANAS = [
  { id: 'preguntas', label: 'Preguntas frecuentes' },
  { id: 'mensajes', label: 'Mensajes' }
];

/**
 * Soporte del establecimiento, en un panel lateral sobre la pantalla en la que
 * esta. Dos pestanas: las preguntas frecuentes del manual (primero las de esa
 * `seccion`) y el chat, donde cada mensaje se guarda con la `pantalla`, asi un
 * reporte de error ya dice donde paso.
 * Abre en `pestanaInicial`: el shell elige Mensajes si hay respuestas sin leer.
 * El hilo se pide recien al entrar a Mensajes (leerlo marca leidas las
 * respuestas); `onLeido` corre entonces para actualizar el contador del menu.
 */
function SoportePanel({ abierto, onCerrar, pantalla, seccion, pestanaInicial = 'preguntas', noLeidos = 0, onLeido }) {
  const [pestana, setPestana] = useState(pestanaInicial);
  const hilo = useHiloSoporte(abierto && pestana === 'mensajes' ? 'mensajes' : null, { alCargar: onLeido });

  // Cada vez que se abre, arranca en la pestana que corresponde en ese momento.
  useEffect(() => {
    if (abierto) setPestana(pestanaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

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
      <aside role="dialog" aria-modal="true" aria-label="Soporte" className="relative flex h-full w-full max-w-lg flex-col bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-3 bg-sky-900 px-4 py-3 text-white">
          <div>
            <h2 className="text-base font-semibold">Soporte</h2>
            <p className="text-xs text-sky-200">Buscá tu duda en las preguntas frecuentes o escribinos: te respondemos acá.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar soporte" className="rounded-lg p-1.5 text-sky-100 hover:bg-sky-800">
            <CerrarIcon className="h-5 w-5" />
          </button>
        </header>

        <div role="tablist" aria-label="Soporte" className="flex border-b border-slate-200 bg-white">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={
                'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition ' +
                (pestana === p.id ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-700')
              }
            >
              {p.label}
              {p.id === 'mensajes' && noLeidos > 0 && (
                <span className="rounded-full bg-cyan-600 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${noLeidos} sin leer`}>
                  {noLeidos}
                </span>
              )}
            </button>
          ))}
        </div>

        {pestana === 'preguntas' ? (
          <PreguntasFrecuentes seccion={seccion} onEscribir={() => setPestana('mensajes')} />
        ) : (
          <>
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
          </>
        )}
      </aside>
    </div>
  );
}

export default SoportePanel;
