import React from 'react';
import PatenteField from './PatenteField';
import PrecioReserva from './PrecioReserva';
import { PRECIO_VACIO } from '../lib/tarifas';
import { cocheraVacia, pasesIncluidosPara } from '../lib/incluidos';

const INPUT = 'rounded-lg border bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent';

// Miles con puntos mientras se tipea; el estado guarda solo los digitos.
const conPuntos = (valor) => {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos).toLocaleString('es-AR') : '';
};
const soloDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

/**
 * Pileta y cocheras incluidas en una carpa o sombrilla nueva.
 *
 * El servidor crea todo junto en una transaccion: si una cochera no se puede
 * reservar, no se guarda nada. `cocherasIncluidas` es lo que devuelve
 * useCocherasIncluidas (disponibilidad y validacion).
 */
function ServiciosIncluidosFields({
  establishment,
  serviceType,
  desde,
  hasta,
  incluyePileta,
  cocheras,
  cocherasIncluidas,
  patenteSugerida,
  onChangeForm,
  // Al editar: el tilde de pileta vive en otra clave y las cocheras son "nuevas".
  clavePileta = 'incluyePileta',
  tituloCocheras = 'Incluir estacionamiento'
}) {
  const lista = Array.isArray(cocheras) ? cocheras : [];
  const pases = pasesIncluidosPara(establishment, serviceType);
  const { capacidad, estacionamiento, analisis } = cocherasIncluidas;

  const cambiar = (patch) => onChangeForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const cambiarCochera = (indice, patch) =>
    onChangeForm((prev) => {
      if (!prev) return prev;
      const actuales = prev.cocheras || [];
      return {
        ...prev,
        cocheras: actuales.map((c, i) => (i === indice ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c))
      };
    });
  const agregarCochera = () =>
    onChangeForm((prev) => {
      if (!prev) return prev;
      const actuales = prev.cocheras || [];
      // La primera cochera toma la patente de la ficha del cliente, si tiene.
      const patente = actuales.length === 0 ? patenteSugerida || '' : '';
      return { ...prev, cocheras: [...actuales, { ...cocheraVacia(), vehiclePlate: patente }] };
    });
  const quitarCochera = (indice) =>
    onChangeForm((prev) => (prev ? { ...prev, cocheras: (prev.cocheras || []).filter((_, i) => i !== indice) } : prev));

  const unidades = Array.from({ length: capacidad }, (_, i) => i + 1);

  return (
    <>
      {pases > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`${serviceType}-incluye-pileta`}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500"
              checked={Boolean(incluyePileta)}
              onChange={(e) => cambiar({ [clavePileta]: e.target.checked })}
            />
            <label htmlFor={`${serviceType}-incluye-pileta`} className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1 cursor-pointer">
              <span>🏊</span>
              <span>Incluye pileta</span>
            </label>
          </div>
          {incluyePileta && (
            <p className="mt-2 pl-6 text-[11px] text-slate-600">
              {pases} pases de pileta incluidos en el precio. Elegí a quién le toca en Datos de las personas.
            </p>
          )}
        </div>
      )}

      {establishment?.hasParking && capacidad > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="includeParking"
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500"
              checked={lista.length > 0}
              onChange={(e) => (e.target.checked ? agregarCochera() : cambiar({ cocheras: [] }))}
            />
            <label htmlFor="includeParking" className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1 cursor-pointer">
              <span>🚗</span>
              <span>{tituloCocheras}</span>
            </label>
          </div>

          {lista.map((cochera, i) => {
            const elegidasPorOtras = new Set(
              lista.filter((_, j) => j !== i).map((c) => Number(c.plaza)).filter(Boolean)
            );
            return (
              <div key={i} className="space-y-3 pl-6 pb-3 mb-3 border-b border-slate-100 last:border-b-0 last:mb-0">
                {lista.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Cochera {i + 1}</span>
                    <button type="button" className="text-[11px] font-semibold text-red-600 hover:underline" onClick={() => quitarCochera(i)}>
                      Quitar
                    </button>
                  </div>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Plaza de estacionamiento</span>
                  <select
                    className={`${INPUT} border-slate-300`}
                    value={cochera.plaza || ''}
                    onChange={(e) => cambiarCochera(i, { plaza: e.target.value ? Number.parseInt(e.target.value, 10) : '' })}
                  >
                    <option value="">Seleccionar plaza...</option>
                    {unidades.map((num) => {
                      const ocupada = estacionamiento.ocupadas.has(num);
                      const deOtra = elegidasPorOtras.has(num);
                      return (
                        <option key={num} value={num} disabled={(ocupada || deOtra) && num !== Number(cochera.plaza)}>
                          Plaza {num}{ocupada ? ' (ocupada)' : deOtra ? ' (elegida en otra cochera)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {analisis.mensajes[i] && <span className="text-[10px] text-slate-600">{analisis.mensajes[i]}</span>}
                </label>
                {analisis.conflicto[i] && (
                  <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
                    ⚠️ La plaza {cochera.plaza} está ocupada en alguno de esos días. Elegí otra.
                  </div>
                )}
                <PatenteField value={cochera.vehiclePlate} onChange={(value) => cambiarCochera(i, { vehiclePlate: value })} />
                <PrecioReserva
                  serviceType="parking"
                  resourceNumber={analisis.efectivas[i]}
                  desde={desde}
                  hasta={hasta}
                  valor={cochera.precio ?? PRECIO_VACIO}
                  onChange={(patch) => cambiarCochera(i, (c) => ({ precio: { ...(c.precio ?? PRECIO_VACIO), ...patch } }))}
                  titulo="Precio del estacionamiento"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Monto a pagar ahora por estacionamiento (ARS)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={conPuntos(cochera.pagoMonto)}
                      onChange={(e) => cambiarCochera(i, { pagoMonto: soloDigitos(e.target.value) })}
                      className={`${INPUT} ${analisis.pagoExcede[i] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                      placeholder="0"
                    />
                    {analisis.pagoExcede[i] && (
                      <p className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1">⚠️ El pago no puede exceder el total de la cochera.</p>
                    )}
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Método de pago estacionamiento</span>
                    <select
                      value={cochera.pagoMetodo || ''}
                      onChange={(e) => cambiarCochera(i, { pagoMetodo: e.target.value })}
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
                {analisis.pagoSinMetodo[i] && (
                  <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
                    ⚠️ Ingresaste un monto de pago pero no seleccionaste el método de pago para el estacionamiento.
                  </div>
                )}
              </div>
            );
          })}

          {lista.length > 0 && (
            <button type="button" className="ml-6 text-[11px] font-semibold text-cyan-700 hover:underline" onClick={agregarCochera}>
              + Agregar otra cochera
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default ServiciosIncluidosFields;
