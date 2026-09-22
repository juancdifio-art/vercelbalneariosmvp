import React from 'react';

/** Dias entre dos fechas yyyy-mm-dd, contando los dos extremos. */
function diasInclusivos(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  // En UTC para que un cambio de horario no corra la cuenta un dia.
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000) + 1;
}

/**
 * Nombre del cliente sobre la barra de una reserva, en las grillas de
 * ocupacion de carpas, sombrillas y estacionamiento.
 *
 * Se dibuja una sola vez por reserva: en la celda donde arranca, o en la
 * primera columna si la reserva empezo antes de la ventana visible. Desde ahi
 * se estira sobre las celdas siguientes con un ancho de N veces la celda, que
 * funciona porque las grillas son table-fixed y todas las columnas de dias
 * miden lo mismo.
 *
 * Las celdas siguen siendo una por dia: la etiqueta flota por encima sin
 * capturar eventos, asi que el click para abrir la reserva, el resaltado al
 * pasar el mouse y el tooltip con las fechas siguen funcionando igual.
 *
 * El <td> que la contiene tiene que ser `relative`.
 */
function ReservaEtiqueta({ group, dateStr, esPrimeraColumna, ultimoDiaVentana }) {
  if (!group) return null;

  const nombre = (group.customerName || '').trim();
  if (!nombre) return null;

  const arrancaAca =
    group.startDate === dateStr || (esPrimeraColumna && group.startDate < dateStr);
  if (!arrancaAca) return null;

  const hasta = group.endDate < ultimoDiaVentana ? group.endDate : ultimoDiaVentana;
  const celdas = diasInclusivos(dateStr, hasta);

  return (
    <span
      // z-[1] y no z-10: el encabezado de la grilla es sticky con z-10, y al
      // scrollear las etiquetas tienen que pasar por debajo, no por encima.
      // Centrado con top-1/2 + translate y no con line-height: la fila es mas
      // alta que la celda (la columna del numero tiene padding), asi que un
      // alto fijo la dejaba pegada arriba. Sigue siendo un bloque, que es lo
      // que necesita truncate para poner los puntos suspensivos.
      className="pointer-events-none absolute left-0.5 top-1/2 z-[1] -translate-y-1/2 truncate text-[10px] font-medium leading-tight text-slate-800"
      style={{ width: `calc(${celdas * 100}% - 4px)` }}
    >
      {nombre}
    </span>
  );
}

export default ReservaEtiqueta;
