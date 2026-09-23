import React, { useEffect } from 'react';
import useCotizacion from '../hooks/useCotizacion';
import { lineasDesglose, diferenciaAjuste, faltaMotivoAjuste, formatearPesos } from '../lib/tarifas';

// Miles con puntos y decimales con coma, formato es-AR (9999.5 -> "9.999,5").
// El estado (`valor.cobrado`) siempre guarda un string numerico plano, sin
// separadores ("9999.5"): el formato es solo para mostrar mientras se tipea.
// Antes esto sacaba todo lo que no fuera digito, así que una tarifa con
// centavos (el backend redondea a 2 decimales) se mostraba y re-guardaba mal
// (9999.5 -> "99995" en vez de "9.999,5").
const aTextoVisual = (valor) => {
  const texto = String(valor ?? '');
  if (!texto) return '';
  const [enteroCrudo, decimales] = texto.split('.');
  const entero = enteroCrudo.replace(/\D/g, '');
  const enteroVisual = entero ? Number(entero).toLocaleString('es-AR') : '0';
  return decimales !== undefined ? `${enteroVisual},${decimales}` : enteroVisual;
};

// Inversa de aTextoVisual: de lo que hay en el input (con puntos de miles y
// coma decimal) a un string numerico plano para guardar en el estado.
const aValorPlano = (texto) => {
  let limpio = String(texto ?? '').replace(/\./g, '').replace(',', '.');
  limpio = limpio.replace(/[^\d.]/g, '');
  const i = limpio.indexOf('.');
  if (i !== -1) limpio = `${limpio.slice(0, i + 1)}${limpio.slice(i + 1).replace(/\./g, '')}`;
  return limpio;
};

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function listaDeFechas(fechas) {
  const primeras = fechas.slice(0, 5).map(ddmm);
  const resto = fechas.length - primeras.length;
  if (resto > 0) return `${primeras.join(', ')} y ${resto} más`;
  if (primeras.length === 1) return primeras[0];
  return `${primeras.slice(0, -1).join(', ')} y ${primeras[primeras.length - 1]}`;
}

/**
 * Precio de una reserva de carpa, sombrilla o estacionamiento.
 *
 * Cotiza con el servidor y precarga el total de la tarifa. El encargado lo
 * puede cambiar: si difiere, el motivo es obligatorio (el servidor tambien lo
 * exige). `editadoEn` guarda para que fechas se edito el total: si cambian las
 * fechas, el total vuelve al de la tarifa nueva, porque el ajuste era para otra estadia.
 *
 * `cotizar=false` (al editar sin tocar fechas ni unidad) muestra lo guardado.
 */
function PrecioReserva({ serviceType, resourceNumber, desde, hasta, valor, onChange, cotizar = true, titulo = 'Precio' }) {
  const { clave, cotizacion, verificando, fallo } = useCotizacion(serviceType, resourceNumber, desde, hasta, cotizar);

  useEffect(() => {
    if (!cotizacion) return;
    const precioTarifa = cotizacion.completo ? cotizacion.total : null;
    const patch = { precioTarifa, desglose: cotizacion.desglose };
    // Si las fechas cambiaron (editadoEn !== clave), el cobrado anterior era
    // para otra estadia: se reemplaza por el de la tarifa nueva, o se vacia
    // si la tarifa nueva quedo incompleta (no queda un total viejo colgado).
    if (valor.editadoEn !== clave) patch.cobrado = precioTarifa != null ? String(precioTarifa) : '';
    onChange(patch);
    // Solo reacciona a una cotizacion nueva, no a cada tecla del total.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacion, clave]);

  const lineas = lineasDesglose(valor.desglose);
  const faltan = valor.precioTarifa == null ? valor.desglose?.diasSinTarifa ?? [] : [];
  const diferencia = diferenciaAjuste(valor);
  const falta = faltaMotivoAjuste(valor);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-slate-700">{titulo}</p>

      {verificando && <p className="text-[11px] text-slate-500">Calculando precio…</p>}
      {fallo && <p className="text-[11px] text-amber-700">No se pudo calcular el precio. Cargalo a mano.</p>}

      {lineas.length > 0 && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] text-cyan-900 space-y-0.5">
          {lineas.map((l) => <p key={l}>{l}</p>)}
          {valor.precioTarifa != null && (
            <p className="font-semibold">Tarifa: {formatearPesos(valor.precioTarifa)}</p>
          )}
        </div>
      )}

      {faltan.length > 0 && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
          Consultar precio: faltan tarifas para el {listaDeFechas(faltan)}.
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-slate-700">Total cobrado (ARS)</span>
        <input
          type="text"
          inputMode="numeric"
          value={aTextoVisual(valor.cobrado)}
          onChange={(e) => onChange({ cobrado: aValorPlano(e.target.value), editadoEn: clave || 'manual' })}
          placeholder="0"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        />
      </label>

      {diferencia !== 0 && (
        <>
          <p className={`text-[11px] font-semibold ${diferencia < 0 ? 'text-amber-700' : 'text-slate-700'}`}>
            {diferencia < 0 ? '−' : '+'}{formatearPesos(Math.abs(diferencia))} respecto de la tarifa
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">
              Motivo del ajuste <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={valor.motivo ?? ''}
              onChange={(e) => onChange({ motivo: e.target.value })}
              required
              aria-invalid={falta}
              placeholder="Ej.: cliente de años, redondeo"
              className={`rounded-lg border bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${falta ? 'border-red-300' : 'border-slate-300'}`}
            />
            {falta && <span className="text-[10px] text-red-600">Obligatorio si cobrás distinto a la tarifa.</span>}
          </label>
        </>
      )}
    </div>
  );
}

export default PrecioReserva;
