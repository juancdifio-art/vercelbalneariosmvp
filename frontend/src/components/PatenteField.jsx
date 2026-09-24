import React from 'react';
import { normalizarPatente } from '../lib/patente';

/**
 * Patente del vehiculo, obligatoria en toda reserva que use estacionamiento.
 * Se escribe como venga; se muestra en mayusculas y se guarda normalizada.
 */
function PatenteField({ value, onChange }) {
  const falta = !normalizarPatente(value);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-slate-700">
        Patente del vehículo <span className="text-red-600">*</span>
      </span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="AB 123 CD"
        autoComplete="off"
        aria-required="true"
        aria-invalid={falta}
        className={`rounded-lg border bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${falta ? 'border-red-300' : 'border-slate-300'}`}
      />
      {falta && (
        <span className="text-[10px] text-red-600">Obligatoria para usar el estacionamiento.</span>
      )}
    </label>
  );
}

export default PatenteField;
