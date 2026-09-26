import React from 'react';
import { filasDePersonas, pasesIncluidosPara, maxPersonasPara } from '../lib/incluidos';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500';

/**
 * Los datos de cada persona en el alta de una carpa o sombrilla, una fila por
 * persona segun adultos + menores. El titular va primero: sus datos salen de
 * la ficha del cliente y lo que se complete aca vuelve a la ficha. Los
 * acompanantes son de esta reserva, no del cliente.
 *
 * Con "Incluye pileta", cada fila tiene un boton para darle o sacarle el pase.
 * Nada es obligatorio: una fila sin nombre no se guarda.
 */
function PersonasAltaFields({ form, onChangeForm, cliente, establishment, serviceType }) {
  const pases = pasesIncluidosPara(establishment, serviceType);
  const incluyePileta = Boolean(form.incluyePileta) && pases > 0;
  const filas = filasDePersonas({
    adultsCount: form.adultsCount,
    childrenCount: form.childrenCount,
    cliente,
    customerName: form.customerName,
    titularDatos: form.titularDatos,
    acompanantes: form.acompanantes || [],
    max: maxPersonasPara(establishment),
    pases,
    incluyePileta
  });
  if (filas.length === 0) return null;

  const elegidos = filas.filter((f) => f.pileta).length;

  const cambiarTitular = (patch) =>
    onChangeForm((prev) => (prev ? { ...prev, titularDatos: { ...(prev.titularDatos || {}), ...patch } } : prev));
  const cambiarAcompanante = (indice, patch) =>
    onChangeForm((prev) => {
      if (!prev) return prev;
      const lista = [...(prev.acompanantes || [])];
      while (lista.length <= indice) lista.push({});
      lista[indice] = { ...lista[indice], ...patch };
      return { ...prev, acompanantes: lista };
    });
  const alternarPase = (fila) => {
    const patch = { pileta: !fila.pileta };
    if (fila.esTitular) cambiarTitular(patch);
    else cambiarAcompanante(fila.indice, patch);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Datos de las personas</h3>
        {incluyePileta && (
          <span className="rounded bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
            {elegidos} de {pases} pases elegidos
          </span>
        )}
      </div>
      <p className="mb-3 text-[10px] text-slate-500">
        Opcional: lo que falte se completa después desde el detalle de la reserva.
      </p>
      <ul className="space-y-2">
        {filas.map((fila) => {
          const nombre = fila.esTitular ? 'titular' : `acompañante ${fila.indice + 1}`;
          const etiquetaPase = `Pase de pileta para ${fila.fullName.trim() || nombre}`;
          const bloqueado = !fila.pileta && (!fila.completa || elegidos >= pases);
          return (
            <li key={fila.esTitular ? 'titular' : fila.indice} className="rounded-lg border border-slate-200 p-2">
              <div className="grid grid-cols-12 gap-2 items-end">
                {fila.esTitular ? (
                  <>
                    <div className="col-span-12 md:col-span-4">
                      <p className="text-[10px] font-semibold text-slate-500">Titular</p>
                      <p className="text-xs font-semibold text-slate-900 truncate">{fila.fullName || 'Sin nombre'}</p>
                    </div>
                    <label className="col-span-6 md:col-span-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-600">DNI</span>
                      <input
                        aria-label="DNI del titular"
                        type="text"
                        disabled={fila.sinFicha}
                        value={fila.documentNumber}
                        onChange={(e) => cambiarTitular({ documentNumber: e.target.value })}
                        className={INPUT}
                      />
                    </label>
                    <label className="col-span-6 md:col-span-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-600">Fecha de nacimiento</span>
                      <input
                        aria-label="Fecha de nacimiento del titular"
                        type="date"
                        disabled={fila.sinFicha}
                        value={fila.birthDate}
                        onChange={(e) => cambiarTitular({ birthDate: e.target.value })}
                        className={INPUT}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="col-span-12 md:col-span-4 flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-600">Acompañante {fila.indice + 1}</span>
                      <input
                        aria-label={`Nombre del acompañante ${fila.indice + 1}`}
                        type="text"
                        placeholder="Nombre y apellido"
                        value={fila.fullName}
                        onChange={(e) => cambiarAcompanante(fila.indice, { fullName: e.target.value })}
                        className={INPUT}
                      />
                    </label>
                    <label className="col-span-6 md:col-span-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-600">DNI</span>
                      <input
                        aria-label={`DNI del acompañante ${fila.indice + 1}`}
                        type="text"
                        value={fila.documentNumber}
                        onChange={(e) => cambiarAcompanante(fila.indice, { documentNumber: e.target.value })}
                        className={INPUT}
                      />
                    </label>
                    <label className="col-span-6 md:col-span-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-600">Edad</span>
                      <input
                        aria-label={`Edad del acompañante ${fila.indice + 1}`}
                        type="number"
                        min="0"
                        value={fila.age}
                        onChange={(e) => cambiarAcompanante(fila.indice, { age: e.target.value })}
                        className={INPUT}
                      />
                    </label>
                  </>
                )}
                {incluyePileta && (
                  <div className="col-span-12 md:col-span-2 flex md:justify-end">
                    <button
                      type="button"
                      aria-label={etiquetaPase}
                      aria-pressed={fila.pileta}
                      disabled={bloqueado}
                      onClick={() => alternarPase(fila)}
                      className={`w-full md:w-auto rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${fila.pileta
                        ? 'border-cyan-500 bg-cyan-500 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-cyan-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      🏊 Pileta
                    </button>
                  </div>
                )}
              </div>
              {fila.sinFicha && (
                <p className="mt-1 text-[10px] text-amber-700">Elegí o creá un cliente para cargar sus datos.</p>
              )}
              {incluyePileta && !fila.sinFicha && !fila.completa && (fila.esTitular || fila.fullName.trim()) && (
                <p className="mt-1 text-[10px] text-amber-700">
                  {fila.esTitular ? 'Completá DNI y fecha de nacimiento para darle pase.' : 'Completá DNI y edad para darle pase.'}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PersonasAltaFields;
