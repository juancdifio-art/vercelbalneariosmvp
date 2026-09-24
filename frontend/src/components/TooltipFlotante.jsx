import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tarjeta flotante que aparece al instante al pasar el mouse sobre algo.
 *
 * Reemplaza al `title` nativo, que tarda un par de segundos en mostrarse y no
 * admite formato. Se controla por ref para que mostrarla u ocultarla no vuelva
 * a dibujar a quien la usa (el plano tiene 337 unidades):
 *
 *   ref.current.mostrar(elemento, contenido)
 *   ref.current.ocultar()
 *
 * Va en un portal con posicion fija, asi no la recortan los contenedores con
 * scroll, y se acomoda arriba o abajo del elemento segun el lugar que haya.
 */
const MARGEN = 8;

const TooltipFlotante = forwardRef(function TooltipFlotante(_props, ref) {
  const [actual, setActual] = useState(null); // { rect, contenido }
  const [pos, setPos] = useState(null);
  const cajaRef = useRef(null);

  const ocultar = useCallback(() => {
    setActual(null);
    setPos(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      mostrar(elemento, contenido) {
        if (!elemento || !contenido) return;
        setActual({ rect: elemento.getBoundingClientRect(), contenido });
      },
      ocultar
    }),
    [ocultar]
  );

  // Posicion: centrada sobre el elemento; si no entra arriba, va abajo.
  useLayoutEffect(() => {
    if (!actual || !cajaRef.current) return;
    const { rect } = actual;
    const caja = cajaRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.top - caja.height - MARGEN;
    if (top < MARGEN) top = rect.bottom + MARGEN;
    if (top + caja.height > vh - MARGEN) top = Math.max(MARGEN, vh - caja.height - MARGEN);

    let left = rect.left + rect.width / 2 - caja.width / 2;
    left = Math.min(Math.max(MARGEN, left), vw - caja.width - MARGEN);

    setPos({ top, left });
  }, [actual]);

  // Con scroll o resize el elemento se mueve: se oculta en vez de quedar desfasada.
  useEffect(() => {
    if (!actual) return undefined;
    window.addEventListener('scroll', ocultar, true);
    window.addEventListener('resize', ocultar);
    return () => {
      window.removeEventListener('scroll', ocultar, true);
      window.removeEventListener('resize', ocultar);
    };
  }, [actual, ocultar]);

  if (!actual) return null;

  return createPortal(
    <div
      ref={cajaRef}
      role="tooltip"
      className="pointer-events-none fixed z-[70] w-80 max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] leading-snug text-slate-700 shadow-xl"
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
    >
      {actual.contenido}
    </div>,
    document.body
  );
});

export default TooltipFlotante;
