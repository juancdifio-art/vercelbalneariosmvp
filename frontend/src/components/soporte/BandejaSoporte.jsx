import React, { useCallback, useEffect, useState } from 'react';
import { SalirIcon } from '../icons';
import { fechaHora } from '../../lib/formato';
import { pedirSoporte, useHiloSoporte } from '../../hooks/useSoporte';
import MensajesSoporte from './MensajesSoporte';
import EscribirSoporte from './EscribirSoporte';

/**
 * Pantalla de la cuenta de soporte: un hilo por establecimiento. Primero los
 * que esperan respuesta. En el celular se ve la lista o el hilo, no los dos.
 */
function BandejaSoporte({ userEmail, onLogout }) {
  const [lista, setLista] = useState([]);
  const [errorLista, setErrorLista] = useState('');
  const [elegidoId, setElegidoId] = useState(null);

  const cargarLista = useCallback(async () => {
    try {
      const d = await pedirSoporte('bandeja');
      setLista(d.establecimientos || []);
      setErrorLista('');
    } catch (e) {
      setErrorLista(e.message);
    }
  }, []);

  useEffect(() => {
    cargarLista();
    const id = setInterval(cargarLista, 30000);
    return () => clearInterval(id);
  }, [cargarLista]);

  // Al leer un hilo sus mensajes quedan leidos: la lista se actualiza.
  const hilo = useHiloSoporte(elegidoId ? `bandeja/${elegidoId}` : null, { alCargar: cargarLista });
  const elegido = lista.find((e) => e.id === elegidoId) || null;
  const totalNoLeidos = lista.reduce((t, e) => t + e.noLeidos, 0);

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between gap-3 bg-sky-900 px-4 py-3 text-white">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">
            Bandeja de soporte
            {totalNoLeidos > 0 && (
              <span className="ml-2 rounded-full bg-cyan-400 px-2 py-0.5 text-xs font-bold text-sky-950">{totalNoLeidos}</span>
            )}
          </h1>
          <p className="truncate text-xs text-sky-200">{userEmail}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sky-100 hover:bg-sky-800"
        >
          <SalirIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Balnearios" className={`${elegido ? 'hidden md:block' : 'block'} w-full overflow-y-auto border-r border-slate-200 bg-white md:w-80`}>
          {errorLista && <p role="alert" className="px-4 py-3 text-xs text-rose-700">{errorLista}</p>}
          <ul>
            {lista.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setElegidoId(e.id)}
                  aria-current={e.id === elegidoId ? 'true' : undefined}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${e.id === elegidoId ? 'bg-cyan-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${e.noLeidos > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{e.nombre}</span>
                    {e.noLeidos > 0 && (
                      <span className="shrink-0 rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white" aria-label={`${e.noLeidos} sin leer`}>
                        {e.noLeidos}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {e.ultimo ? `${e.ultimo.deSoporte ? 'Vos: ' : ''}${e.ultimo.texto}` : 'Sin mensajes'}
                  </p>
                  {e.ultimo && <p className="text-[10px] text-slate-400">{fechaHora(e.ultimo.creado)}</p>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className={`${elegido ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-slate-50`}>
          {elegido ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                <button type="button" onClick={() => setElegidoId(null)} className="text-sm text-cyan-700 md:hidden">
                  ← Volver
                </button>
                <h2 className="truncate text-sm font-semibold text-slate-900">{elegido.nombre}</h2>
              </div>
              <MensajesSoporte
                mensajes={hilo.mensajes}
                lado="soporte"
                nombreOtro={elegido.nombre}
                cargando={hilo.cargando}
                vacio="Este balneario todavía no escribió. Podés mandarle el primer mensaje."
              />
              {hilo.error && (
                <p role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">{hilo.error}</p>
              )}
              <EscribirSoporte enviando={hilo.enviando} onEnviar={hilo.enviar} placeholder={`Respondé a ${elegido.nombre}`} />
            </>
          ) : (
            <p className="m-auto text-sm text-slate-500">Elegí un balneario para ver la conversación.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default BandejaSoporte;
