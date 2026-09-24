import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PlanoBalneario from './PlanoBalneario';

/**
 * El plano entero del balneario cubriendo toda la pantalla, por encima del
 * sistema. Se cierra con el boton o con Esc.
 *
 * Tocar una unidad cierra el plano y hace lo mismo que en la Vista rapida
 * (ver la reserva o abrir una nueva): los modales de reserva viven debajo de
 * esta capa, asi que no pueden abrirse con el plano encima.
 */
function PlanoCompletoOverlay({ abierto, onCerrar, fechaTexto, estadoDe, onUnidadClick, fichaDe }) {
  const cerrarRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const previo = document.activeElement;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowPrevio;
      if (previo && typeof previo.focus === 'function') previo.focus();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const handleUnidad = onUnidadClick
    ? (serviceType, numero) => {
        onCerrar();
        onUnidadClick(serviceType, numero);
      }
    : undefined;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Plano completo del balneario"
      className="fixed inset-0 z-[60] flex flex-col bg-[#F6EEDB]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-200 bg-white px-4 py-2.5">
        <h2 className="text-[14px] font-semibold text-slate-900">Plano completo</h2>
        {fechaTexto && (
          <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] text-slate-700">
            {fechaTexto}
          </span>
        )}
        <div className="hidden items-center gap-3 text-[11px] text-slate-600 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-emerald-700 bg-emerald-600" /> Ocupada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-amber-400 bg-amber-50" /> Reserva próxima
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-slate-500 bg-white" /> Libre
          </span>
        </div>
        <button
          ref={cerrarRef}
          type="button"
          onClick={onCerrar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
        >
          ✕ Cerrar plano
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        <PlanoBalneario
          vista="completo"
          estadoDe={estadoDe}
          onUnidadClick={handleUnidad}
          fichaDe={fichaDe}
          className="h-full w-full min-w-[900px]"
        />
      </div>
    </div>,
    document.body
  );
}

export default PlanoCompletoOverlay;
