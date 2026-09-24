import React from 'react';
import { PALETA } from '../../lib/tarifas';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Que periodo rige cada dia del anio. Los dias sin periodo se marcan en rojo:
 * una reserva que los toque sale como "Consultar precio".
 */
function TiraAnual({ periodos, calendario }) {
  const colorDe = new Map(periodos.map((p, i) => [p.id, PALETA[i % PALETA.length].fuerte]));
  const nombreDe = new Map(periodos.map((p) => [p.id, p.nombre]));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="space-y-0.5">
        {MESES.map((mes, i) => (
          <div key={mes} className="flex items-center gap-1">
            <span className="w-8 text-[10px] text-slate-500">{mes}</span>
            <div className="flex gap-px">
              {calendario.filter((d) => d.mes === i + 1).map((d) => (
                <span
                  key={d.dia}
                  title={`${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')} · ${d.periodoId ? nombreDe.get(d.periodoId) : 'Sin período'}`}
                  className={`h-3 w-2.5 ${d.periodoId ? '' : 'bg-white ring-1 ring-inset ring-red-300'}`}
                  style={d.periodoId ? { backgroundColor: colorDe.get(d.periodoId) } : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-600">
        {periodos.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorDe.get(p.id) }} />
            {p.nombre}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-red-300" />
          Sin período
        </span>
      </div>
    </div>
  );
}

export default TiraAnual;
