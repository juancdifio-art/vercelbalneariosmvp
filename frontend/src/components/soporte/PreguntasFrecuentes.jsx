import React, { useState } from 'react';
import { PREGUNTAS_FRECUENTES, buscarPreguntas } from '../../config/preguntasFrecuentes';

function Pregunta({ p }) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
        <span>{p.pregunta}</span>
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-90">›</span>
      </summary>
      <p className="border-t border-slate-100 px-3 py-2.5 text-sm leading-relaxed text-slate-600">{p.respuesta}</p>
    </details>
  );
}

function Lista({ titulo, preguntas }) {
  if (!preguntas.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {preguntas.map((p) => <Pregunta key={p.id} p={p} />)}
    </section>
  );
}

/**
 * Preguntas frecuentes del manual. Sin busqueda, primero las de la pantalla
 * en la que esta el usuario (`seccion`). Al pie, el pase al chat.
 */
function PreguntasFrecuentes({ seccion, onEscribir }) {
  const [busqueda, setBusqueda] = useState('');
  const buscando = busqueda.trim() !== '';
  const encontradas = buscando ? buscarPreguntas(busqueda) : [];
  const deEstaPantalla = PREGUNTAS_FRECUENTES.filter((p) => p.secciones.includes(seccion));
  const otras = PREGUNTAS_FRECUENTES.filter((p) => !p.secciones.includes(seccion));

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <input
        type="search"
        aria-label="Buscar en las preguntas frecuentes"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscá tu duda: pago, cochera, tarifa..."
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />

      {buscando ? (
        encontradas.length ? (
          <Lista titulo={`${encontradas.length} ${encontradas.length === 1 ? 'resultado' : 'resultados'}`} preguntas={encontradas} />
        ) : (
          <p className="text-center text-sm text-slate-500">No encontramos nada con “{busqueda.trim()}”.</p>
        )
      ) : (
        <>
          <Lista titulo="Sobre esta pantalla" preguntas={deEstaPantalla} />
          <Lista titulo={deEstaPantalla.length ? 'Otras preguntas' : 'Preguntas frecuentes'} preguntas={otras} />
        </>
      )}

      <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-center">
        <p className="text-sm text-slate-700">¿No encontraste lo que buscabas?</p>
        <button
          type="button"
          onClick={onEscribir}
          className="mt-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-cyan-700"
        >
          Escribinos
        </button>
      </div>
    </div>
  );
}

export default PreguntasFrecuentes;
