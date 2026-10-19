import React, { useEffect, useState } from 'react';
import { PREGUNTAS_FRECUENTES, buscarPreguntas } from '../../config/preguntasFrecuentes';

const urlImagen = (archivo) => `${import.meta.env.BASE_URL}ayuda/${archivo}`;
const sinMarcas = (texto) => String(texto || '').replace(/\*\*/g, '');

// **asi** va en negrita: los nombres de botones y campos, como en pantalla.
function ConNegritas({ texto }) {
  return String(texto)
    .split(/\*\*(.+?)\*\*/g)
    .map((parte, i) => (i % 2 ? <strong key={i} className="font-semibold text-slate-900">{parte}</strong> : parte));
}

function Captura({ archivo, descripcion, onAmpliar }) {
  return (
    <button
      type="button"
      onClick={() => onAmpliar({ src: urlImagen(archivo), alt: descripcion })}
      aria-label={`Agrandar imagen: ${descripcion}`}
      className="mt-2 block w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    >
      <img src={urlImagen(archivo)} alt={descripcion} loading="lazy" className="block w-full" />
    </button>
  );
}

// El contenido se arma recien al abrir la pregunta: asi las imagenes se
// descargan solo cuando alguien las va a ver.
function Pregunta({ p, onAmpliar }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <details className="group rounded-lg border border-slate-200 bg-white" onToggle={(e) => setAbierta(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
        <span>{p.pregunta}</span>
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-90">›</span>
      </summary>
      {abierta && (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3 text-sm leading-relaxed text-slate-700">
          <p><ConNegritas texto={p.resumen} /></p>
          {p.imagen && <Captura archivo={p.imagen} descripcion={sinMarcas(p.resumen)} onAmpliar={onAmpliar} />}
          {p.pasos && (
            <ol className="space-y-3">
              {p.pasos.map((paso, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p><ConNegritas texto={paso.texto} /></p>
                    {paso.imagen && <Captura archivo={paso.imagen} descripcion={`Paso ${i + 1}: ${sinMarcas(paso.texto)}`} onAmpliar={onAmpliar} />}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {p.nota && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <ConNegritas texto={p.nota} />
            </p>
          )}
        </div>
      )}
    </details>
  );
}

// La captura a tamano real (alto maximo, la pantalla): en el celular una
// captura ancha se desliza de costado en vez de achicarse al ancho del
// telefono. Esc la cierra sin cerrar el panel de Soporte: el listener va en
// captura sobre window y no deja seguir el evento.
function Ampliada({ imagen, onCerrar }) {
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCerrar();
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => window.removeEventListener('keydown', alTeclear, true);
  }, [onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
      onClick={onCerrar}
      className="fixed inset-0 z-[90] cursor-zoom-out overflow-auto bg-slate-950/80"
    >
      <div className="flex min-h-full min-w-full w-max items-center justify-center p-4">
        <img src={imagen.src} alt={imagen.alt} className="max-h-[85vh] max-w-none rounded-lg bg-white shadow-2xl" />
      </div>
      <p className="pointer-events-none fixed bottom-3 left-0 right-0 text-center text-xs text-slate-200">Tocá para cerrar</p>
    </div>
  );
}

function Lista({ titulo, preguntas, onAmpliar }) {
  if (!preguntas.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {preguntas.map((p) => <Pregunta key={p.id} p={p} onAmpliar={onAmpliar} />)}
    </section>
  );
}

/**
 * Preguntas frecuentes del manual, con pasos e imagenes. Sin busqueda, primero
 * las de la pantalla en la que esta el usuario (`seccion`). Al pie, el pase al chat.
 */
function PreguntasFrecuentes({ seccion, onEscribir }) {
  const [busqueda, setBusqueda] = useState('');
  const [ampliada, setAmpliada] = useState(null);
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
          <Lista
            titulo={`${encontradas.length} ${encontradas.length === 1 ? 'resultado' : 'resultados'}`}
            preguntas={encontradas}
            onAmpliar={setAmpliada}
          />
        ) : (
          <p className="text-center text-sm text-slate-500">No encontramos nada con “{busqueda.trim()}”.</p>
        )
      ) : (
        <>
          <Lista titulo="Sobre esta pantalla" preguntas={deEstaPantalla} onAmpliar={setAmpliada} />
          <Lista titulo={deEstaPantalla.length ? 'Otras preguntas' : 'Preguntas frecuentes'} preguntas={otras} onAmpliar={setAmpliada} />
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

      {ampliada && <Ampliada imagen={ampliada} onCerrar={() => setAmpliada(null)} />}
    </div>
  );
}

export default PreguntasFrecuentes;
