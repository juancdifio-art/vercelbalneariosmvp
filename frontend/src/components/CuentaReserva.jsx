import React from 'react';

const INPUT = 'rounded-lg border bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent';
const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

// Miles con puntos mientras se tipea; el estado guarda solo los digitos.
const conPuntos = (valor) => {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos).toLocaleString('es-AR') : '';
};

/** El monto tipeado como numero (0 si esta vacio). */
export function montoDelPago(valor) {
  const n = Number.parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * La cuenta de la reserva: el subtotal de cada item (la carpa o sombrilla, la
 * pileta paga, cada cochera) y el total. Se cobra con un solo pago, parcial o
 * total; el servidor lo imputa en orden a la unidad, las cocheras y la pileta.
 * `cuenta` sale de lib/incluidos.cuentaDelAlta.
 */
function CuentaReserva({ cuenta, monto, metodo, onChangeForm }) {
  const pago = montoDelPago(monto);
  const excede = pago > cuenta.total;
  const sinMetodo = pago > 0 && !metodo;
  const cambiar = (patch) => onChangeForm((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <section aria-label="Cuenta de la reserva" className="bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl border-2 border-emerald-200 p-4 mb-4">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Cuenta de la reserva</h3>
      <ul className="space-y-1 text-xs text-slate-700">
        {cuenta.lineas.map((linea) => (
          <li key={linea.clave} className="flex items-center justify-between gap-3">
            <span>{linea.etiqueta}</span>
            <span className="font-semibold text-slate-900">{linea.monto === null ? 'incluida' : pesos(linea.monto)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Total</span>
        <span className="text-2xl font-bold text-emerald-700">{pesos(cuenta.total)}</span>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-emerald-200 pt-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-700">Monto a pagar ahora (ARS)</span>
          <input
            aria-label="Monto a pagar ahora (ARS)"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={conPuntos(monto)}
            onChange={(e) => cambiar({ initialPaymentAmount: e.target.value.replace(/\D/g, '') })}
            className={`${INPUT} ${excede ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-700">Medio de pago</span>
          <select
            aria-label="Medio de pago"
            value={metodo || ''}
            onChange={(e) => cambiar({ initialPaymentMethod: e.target.value })}
            className={`${INPUT} border-slate-300`}
          >
            <option value="">Sin pago ahora</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta de crédito</option>
            <option value="other">Otro</option>
          </select>
        </label>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        Un solo pago por todo. Se imputa primero a la unidad, después a las cocheras y al final a la pileta paga.
      </p>
      {excede && (
        <p className="mt-2 text-[11px] text-red-700 bg-red-50 rounded px-2 py-1">
          ⚠️ El pago no puede superar el total de la cuenta ({pesos(cuenta.total)}).
        </p>
      )}
      {sinMetodo && !excede && (
        <p className="mt-2 text-[11px] text-red-700 bg-red-50 rounded px-2 py-1">⚠️ Elegí el medio de pago.</p>
      )}
      {pago > 0 && !excede && (
        <p className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 rounded px-2 py-1">Saldo: {pesos(cuenta.total - pago)}</p>
      )}
    </section>
  );
}

export default CuentaReserva;
