import React, { useState } from 'react';
import { TIPOS_SOPORTE } from './MensajesSoporte';

const MAX_TEXTO = 2000;

/**
 * Caja para escribir al otro lado del chat. Con `conTipo` (el establecimiento)
 * se puede marcar si es un error, una sugerencia o una consulta; es opcional.
 * `onEnviar` devuelve true si se guardo: recien ahi se limpia lo escrito.
 */
function EscribirSoporte({ conTipo, enviando, onEnviar, placeholder }) {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState(null);

  const vacio = texto.trim() === '';

  const enviar = async (e) => {
    e?.preventDefault();
    if (vacio || enviando) return;
    const ok = await onEnviar(conTipo ? { texto, tipo } : { texto });
    if (ok) {
      setTexto('');
      setTipo(null);
    }
  };

  return (
    <form onSubmit={enviar} className="border-t border-slate-200 bg-white px-4 py-3">
      {conTipo && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipo de mensaje">
          {TIPOS_SOPORTE.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tipo === t.id}
              onClick={() => setTipo((actual) => (actual === t.id ? null : t.id))}
              className={
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ' +
                (tipo === t.id ? `border-transparent ${t.clase}` : 'border-slate-300 text-slate-600 hover:bg-slate-100')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          aria-label="Mensaje"
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
          onKeyDown={(e) => {
            // Enter solo es un renglon nuevo; Ctrl+Enter (o Cmd+Enter) manda.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(e);
          }}
          rows={3}
          placeholder={placeholder}
          className="min-h-[72px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <button
          type="submit"
          disabled={vacio || enviando}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
      {texto.length > MAX_TEXTO - 200 && (
        <p className="mt-1 text-right text-[10px] text-slate-500">{texto.length}/{MAX_TEXTO}</p>
      )}
    </form>
  );
}

export default EscribirSoporte;
