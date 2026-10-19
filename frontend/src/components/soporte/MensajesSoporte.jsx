import React, { useEffect, useRef } from 'react';
import { fechaHora } from '../../lib/formato';

export const TIPOS_SOPORTE = [
  { id: 'error', label: 'Error', clase: 'bg-rose-100 text-rose-800' },
  { id: 'sugerencia', label: 'Sugerencia', clase: 'bg-amber-100 text-amber-800' },
  { id: 'consulta', label: 'Consulta', clase: 'bg-sky-100 text-sky-800' }
];

const tipoDe = (id) => TIPOS_SOPORTE.find((t) => t.id === id);

/**
 * Hilo de soporte como chat. `lado` dice quien mira: 'establecimiento' ve a la
 * derecha lo que escribio y a la izquierda las respuestas de soporte;
 * 'soporte', al reves. `nombreOtro` firma los mensajes del otro lado.
 */
function MensajesSoporte({ mensajes, lado, nombreOtro, cargando, vacio }) {
  const contenedor = useRef(null);

  // Siempre al ultimo mensaje, como un chat.
  useEffect(() => {
    const el = contenedor.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes.length]);

  return (
    <div ref={contenedor} className="flex-1 overflow-y-auto px-4 py-4">
      {cargando && mensajes.length === 0 && <p className="text-center text-xs text-slate-500">Cargando mensajes...</p>}
      {!cargando && mensajes.length === 0 && <p className="mx-auto max-w-xs text-center text-sm text-slate-500">{vacio}</p>}
      <ul className="space-y-3">
        {mensajes.map((m) => {
          const mio = lado === 'soporte' ? m.deSoporte : !m.deSoporte;
          const tipo = tipoDe(m.tipo);
          return (
            <li key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ' +
                  (mio ? 'rounded-br-sm bg-cyan-600 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800')
                }
              >
                {(tipo || m.pantalla) && (
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                    {tipo && <span className={`rounded-full px-2 py-0.5 ${mio ? 'bg-white/20 text-white' : tipo.clase}`}>{tipo.label}</span>}
                    {m.pantalla && <span className={mio ? 'text-cyan-100' : 'text-slate-500'}>desde {m.pantalla}</span>}
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                <p className={`mt-1 text-right text-[10px] ${mio ? 'text-cyan-100' : 'text-slate-400'}`}>
                  {mio ? 'Vos' : nombreOtro} · {fechaHora(m.creado)}
                  {mio && m.leido ? ' · Visto' : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default MensajesSoporte;
