import React from 'react';
import { lineasCondiciones } from '../../lib/contrato';

/**
 * Las condiciones generales: el texto como se escribe, y al lado como se lee
 * en el contrato, con el valor de cada dato en negrita. Una {marca} que no es
 * ningun dato se marca en amarillo.
 */
function TextoContrato({ condiciones, valores, onCambiar, textareaRef }) {
  const lineas = lineasCondiciones(condiciones, valores);
  const hayTexto = lineas.some((l) => l.texto.trim());

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        <li><code className="rounded bg-white px-1 text-cyan-800">{'{Pileta abre}'}</code> pone el valor del dato, en negrita</li>
        <li><code className="rounded bg-white px-1 text-cyan-800">**OBLIGATORIO**</code> el renglón entero en negrita</li>
        <li>Un renglón vacío separa párrafos</li>
      </ul>

      <div className="grid gap-3 lg:grid-cols-2">
        <label className="block text-[12px] font-medium text-slate-700">
          Condiciones generales
          <textarea
            ref={textareaRef}
            value={condiciones}
            onChange={(e) => onCambiar(e.target.value)}
            placeholder={'1 - La cantidad máxima de personas por unidad es de {Máximo de personas}.\n2 - ...'}
            className="mt-1 h-[34rem] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-normal leading-relaxed text-slate-800 focus:border-cyan-500 focus:outline-none"
          />
        </label>

        <div className="text-[12px] font-medium text-slate-700">
          Así se lee en el contrato
          <div
            aria-label="Así se lee en el contrato"
            className="mt-1 h-[34rem] overflow-y-auto rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] font-normal leading-relaxed text-slate-800"
          >
            {hayTexto ? (
              lineas.map((l, i) => (
                l.texto.trim()
                  ? (
                    <p key={i} className={l.negrita ? 'font-semibold text-slate-950' : ''}>
                      {l.partes.map((p, j) => {
                        // Sin relleno a los costados: separaria el valor de su puntuacion ("Marzo .").
                        if (p.dato) return <strong key={j} className="rounded-sm bg-cyan-100/70 font-semibold text-cyan-900">{p.texto}</strong>;
                        if (p.faltante) return <mark key={j} className="rounded-sm bg-amber-100 text-amber-900">{p.texto}</mark>;
                        return <React.Fragment key={j}>{p.texto}</React.Fragment>;
                      })}
                    </p>
                  )
                  : <div key={i} className="h-3" aria-hidden="true" />
              ))
            ) : (
              <p className="text-slate-400">Todavía no hay condiciones escritas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TextoContrato;
