import React from 'react';
import { filasDePersonas, pasesIncluidosPara, maxPersonasPara } from '../lib/incluidos';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500';
const BOTON = 'w-full rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';

/** Las filas de personas del alta, tal como las ve y las manda el modal. */
export function filasDelAlta({ form, cliente, establishment, serviceType }) {
  const pases = pasesIncluidosPara(establishment, serviceType);
  return filasDePersonas({
    adultsCount: form.adultsCount,
    childrenCount: form.childrenCount,
    cliente,
    customerName: form.customerName,
    titularDatos: form.titularDatos,
    acompanantes: form.acompanantes || [],
    max: maxPersonasPara(establishment),
    pases,
    incluyePileta: Boolean(form.incluyePileta) && pases > 0,
    ventaPases: Boolean(establishment?.hasPileta)
  });
}

/**
 * Los datos de cada persona en el alta de una carpa o sombrilla, una fila por
 * persona segun adultos + menores. El titular va primero: sus datos salen de
 * la ficha del cliente y lo que se complete aca vuelve a la ficha. Los
 * acompanantes son de esta reserva, no del cliente.
 *
 * Cada fila puede tener un pase de pileta incluido (si la carpa incluye
 * pileta, hasta la cantidad de pases) o uno pago, que se suma a la cuenta.
 * Nada es obligatorio: una fila sin nombre no se guarda.
 */
function PersonasAltaFields({ form, onChangeForm, cliente, establishment, serviceType }) {
  const pases = pasesIncluidosPara(establishment, serviceType);
  const incluyePileta = Boolean(form.incluyePileta) && pases > 0;
  const ventaPases = Boolean(establishment?.hasPileta);
  const filas = filasDelAlta({ form, cliente, establishment, serviceType });
  if (filas.length === 0) return null;

  const elegidos = filas.filter((f) => f.pileta).length;
  const pagos = filas.filter((f) => f.pasePago).length;
  const precios = form.pasePagoPrecios || {};

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
  const cambiarFila = (fila, patch) => (fila.esTitular ? cambiarTitular(patch) : cambiarAcompanante(fila.indice, patch));
  // Un pase incluido o uno pago: prender uno apaga el otro.
  const alternarIncluido = (fila) => cambiarFila(fila, fila.pileta ? { pileta: false } : { pileta: true, pasePago: false });
  const alternarPago = (fila) => cambiarFila(fila, fila.pasePago ? { pasePago: false } : { pasePago: true, pileta: false });
  const cambiarPrecio = (clave) => (e) => {
    const valor = e.target.value.replace(/[^\d.,]/g, '');
    onChangeForm((prev) => (prev ? { ...prev, pasePagoPrecios: { ...(prev.pasePagoPrecios || {}), [clave]: valor } } : prev));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Datos de las personas</h3>
        <div className="flex items-center gap-1">
          {incluyePileta && (
            <span className="rounded bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
              {elegidos} de {pases} pases elegidos
            </span>
          )}
          {pagos > 0 && (
            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {pagos} {pagos === 1 ? 'pase pago' : 'pases pagos'}
            </span>
          )}
        </div>
      </div>
      <p className="mb-3 text-[10px] text-slate-500">
        Opcional: lo que falte se completa después desde el detalle de la reserva.
      </p>
      <ul className="space-y-2">
        {filas.map((fila) => {
          const nombre = fila.fullName.trim() || (fila.esTitular ? 'titular' : `acompañante ${fila.indice + 1}`);
          const sinLugar = !fila.pileta && (!fila.completa || elegidos >= pases);
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
                {(incluyePileta || ventaPases) && (
                  <div className="col-span-12 md:col-span-2 flex md:flex-col gap-1">
                    {incluyePileta && (
                      <button
                        type="button"
                        aria-label={`Pase de pileta para ${nombre}`}
                        aria-pressed={fila.pileta}
                        disabled={sinLugar}
                        onClick={() => alternarIncluido(fila)}
                        className={`${BOTON} ${fila.pileta ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-cyan-50'}`}
                      >
                        🏊 Incluido
                      </button>
                    )}
                    {ventaPases && (
                      <button
                        type="button"
                        aria-label={`Pase de pileta pago para ${nombre}`}
                        aria-pressed={fila.pasePago}
                        disabled={!fila.pasePago && !fila.completa}
                        onClick={() => alternarPago(fila)}
                        className={`${BOTON} ${fila.pasePago ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-amber-50'}`}
                      >
                        💲 Pago
                      </button>
                    )}
                  </div>
                )}
              </div>
              {fila.sinFicha && (
                <p className="mt-1 text-[10px] text-amber-700">Elegí o creá un cliente para cargar sus datos.</p>
              )}
              {(incluyePileta || ventaPases) && !fila.sinFicha && !fila.completa && (fila.esTitular || fila.fullName.trim()) && (
                <p className="mt-1 text-[10px] text-amber-700">
                  {fila.esTitular ? 'Completá DNI y fecha de nacimiento para darle pase.' : 'Completá DNI y edad para darle pase.'}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {pagos > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-2 text-[11px] font-semibold text-amber-900">
            Pases de pileta pagos: precio por día. Menor es quien tiene menos de 18 años.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-slate-600">Adulto, por día (ARS)</span>
              <input
                aria-label="Precio por día adulto (ARS)"
                type="text"
                inputMode="numeric"
                value={precios.adulto || ''}
                onChange={cambiarPrecio('adulto')}
                className={INPUT}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-slate-600">Menor, por día (ARS)</span>
              <input
                aria-label="Precio por día menor (ARS)"
                type="text"
                inputMode="numeric"
                value={precios.menor || ''}
                onChange={cambiarPrecio('menor')}
                className={INPUT}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonasAltaFields;
