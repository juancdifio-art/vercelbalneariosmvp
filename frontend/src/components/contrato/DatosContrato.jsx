import React from 'react';
import { datosDelSistema, esDatoDelSistema } from '../../lib/contrato';
import { AutomaticoIcon, InsertarIcon, QuitarIcon } from '../icons';

// En el celular el nombre va arriba (ocupa las dos columnas) y el valor queda al lado de sus botones.
const COLUMNAS = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]';
const BOTON_ICONO = 'rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-cyan-700';

/**
 * Tabla de datos del contrato: nombre y valor. Los del sistema van primero y
 * no se editan. Cada fila puede insertar su {Nombre} en el texto, donde esta el
 * cursor. En el celular el nombre queda arriba del valor y sus botones.
 */
function DatosContrato({ datos, sistema, onCambiar, onQuitar, onAgregar, onInsertar }) {
  return (
    <div className="space-y-2">
      <div className={`${COLUMNAS} hidden border-b border-slate-200 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid`}>
        <span>Dato</span>
        <span>Valor en el contrato</span>
        <span className="sr-only">Acciones</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {datosDelSistema(sistema).map((d) => (
          <li key={d.nombre} className={`${COLUMNAS} py-2`}>
            <span className="col-span-2 flex items-center gap-1.5 px-2 text-[13px] font-medium text-slate-600 sm:col-span-1">
              <AutomaticoIcon className="h-3.5 w-3.5 text-slate-400" />
              {d.nombre}
            </span>
            <span className="px-2 text-[13px]">
              <span className="font-semibold text-slate-900">{d.valor || '—'}</span>
              <span className="ml-2 text-[11px] text-slate-500">automático, se cambia en {d.origen}</span>
            </span>
            <span className="flex justify-end">
              <button type="button" onClick={() => onInsertar(d.nombre)} className={BOTON_ICONO} aria-label={`Insertar ${d.nombre} en el texto`} title="Insertar en el texto">
                <InsertarIcon className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}

        {datos.map((d, i) => (
          <li key={i} className={`${COLUMNAS} py-2`}>
            <label className="col-span-2 block sm:col-span-1">
              <span className="sr-only">Nombre del dato {i + 1}</span>
              <input
                type="text"
                value={d.nombre}
                onChange={(e) => onCambiar(i, 'nombre', e.target.value)}
                placeholder="Nombre del dato"
                maxLength={60}
                className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-medium text-slate-700 hover:border-slate-200 focus:border-cyan-500 focus:bg-white focus:outline-none"
              />
              {esDatoDelSistema(d.nombre) && <span className="block px-2 text-[11px] text-rose-700">Ese dato ya lo pone el sistema.</span>}
            </label>
            <label className="block">
              <span className="sr-only">Valor del dato {i + 1}</span>
              <input
                type="text"
                value={d.valor}
                onChange={(e) => onCambiar(i, 'valor', e.target.value)}
                placeholder="Valor"
                maxLength={200}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-900 focus:border-cyan-500 focus:outline-none"
              />
            </label>
            <span className="flex justify-end gap-0.5">
              <button
                type="button"
                onClick={() => onInsertar(d.nombre)}
                disabled={!d.nombre.trim()}
                className={`${BOTON_ICONO} disabled:opacity-30`}
                aria-label={`Insertar ${d.nombre || 'el dato'} en el texto`}
                title="Insertar en el texto"
              >
                <InsertarIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onQuitar(i)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                aria-label={`Quitar el dato ${d.nombre || i + 1}`}
                title="Quitar"
              >
                <QuitarIcon className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onAgregar} className="rounded-full border border-cyan-400 bg-white px-3 py-1 text-[12px] hover:bg-cyan-50">
        + Agregar dato
      </button>
    </div>
  );
}

export default DatosContrato;
