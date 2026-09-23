import React from 'react';
import { format } from '../lib/dates';
import { formatPesos } from '../lib/money';
import { diasInclusivos, saldoDe } from '../lib/reservas';
import { formatearPatente } from '../lib/patente';

/**
 * Lo que hay que saber de una unidad de un vistazo, para la tarjeta que sale
 * al pasar el mouse en la Vista rapida.
 *
 * Ocupada: quien esta, hasta cuando, cuantos son, si debe plata y si tiene
 * estacionamiento. Libre: cuando entra la proxima reserva.
 */

const ddmm = (iso) => format(iso, 'dd/MM');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function Fila({ etiqueta, children }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[84px] shrink-0 text-slate-500">{etiqueta}</dt>
      <dd className="min-w-0 flex-1 text-slate-900">{children}</dd>
    </div>
  );
}

const PILL = {
  ocupada: 'bg-emerald-600 text-white',
  proxima: 'bg-amber-100 text-amber-900',
  libre: 'bg-slate-100 text-slate-700',
  reservada: 'bg-cyan-100 text-cyan-900',
  finalizada: 'bg-slate-200 text-slate-700'
};
const TEXTO_ESTADO = {
  ocupada: 'Ocupada',
  proxima: 'Libre',
  libre: 'Libre',
  reservada: 'Reservada',
  finalizada: 'Finalizada'
};

function FichaUnidad({ prefijo, numero, estado, fecha, reserva, proxima, estacionamiento, diasLibre, lookahead }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[16px] font-semibold text-slate-900">
          {prefijo} {numero}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${PILL[estado] ?? PILL.libre}`}>
          {TEXTO_ESTADO[estado] ?? 'Libre'}
        </span>
      </div>

      {reserva ? (
        <FichaOcupada reserva={reserva} fecha={fecha} estacionamiento={estacionamiento} />
      ) : (
        <FichaLibre proxima={proxima} fecha={fecha} diasLibre={diasLibre} lookahead={lookahead} />
      )}

      <p className="mt-2.5 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        {reserva ? 'Clic para ver la reserva' : 'Clic para reservar'}
      </p>
    </div>
  );
}

function FichaOcupada({ reserva, fecha, estacionamiento }) {
  const dias = diasInclusivos(reserva.startDate, reserva.endDate);
  const quedan = diasInclusivos(fecha, reserva.endDate);

  // En el calendario `fecha` es hoy y la reserva puede ser futura o pasada.
  const faltan = diasInclusivos(fecha, reserva.startDate) - 1;
  let momento;
  if (reserva.startDate > fecha) momento = faltan === 1 ? 'Entra mañana' : `Entra en ${faltan} días`;
  else if (reserva.endDate < fecha) momento = 'Ya se fue';
  else if (reserva.startDate === fecha && reserva.endDate === fecha) momento = 'Viene solo hoy';
  else if (reserva.startDate === fecha) momento = 'Entra hoy';
  else if (reserva.endDate === fecha) momento = 'Se va hoy';
  else momento = `Quedan ${plural(quedan, 'día', 'días')}, contando hoy`;

  const adultos = Number(reserva.adultsCount || 0);
  const menores = Number(reserva.childrenCount || 0);
  const personas = [
    adultos > 0 ? plural(adultos, 'adulto', 'adultos') : null,
    menores > 0 ? plural(menores, 'menor', 'menores') : null
  ].filter(Boolean);

  const total = Number.parseFloat(reserva.totalPrice);
  const saldo = saldoDe(reserva);

  return (
    <dl className="space-y-1.5">
      <Fila etiqueta="Cliente">
        <span className="font-semibold">{reserva.customerName || 'Sin nombre'}</span>
        {reserva.customerPhone && <span className="block text-slate-600">{reserva.customerPhone}</span>}
      </Fila>
      <Fila etiqueta="Estadía">
        {ddmm(reserva.startDate)} al {ddmm(reserva.endDate)} · {plural(dias, 'día', 'días')}
        <span className="block font-medium text-cyan-800">{momento}</span>
      </Fila>
      {personas.length > 0 && <Fila etiqueta="Personas">{personas.join(' y ')}</Fila>}
      {Number.isFinite(total) && total > 0 && (
        <Fila etiqueta="Pago">
          {saldo > 0.01 ? (
            <span className="font-semibold text-rose-700">Debe {formatPesos(saldo, 0)}</span>
          ) : (
            <span className="font-semibold text-emerald-700">Pagada</span>
          )}
          <span className="text-slate-500"> · total {formatPesos(total, 0)}</span>
        </Fila>
      )}
      {estacionamiento && (
        <Fila etiqueta="Cochera">
          Plaza {estacionamiento.resourceNumber}
          {estacionamiento.vehiclePlate && (
            <span className="font-semibold tracking-wider"> · {formatearPatente(estacionamiento.vehiclePlate)}</span>
          )}
        </Fila>
      )}
      {reserva.serviceType === 'parking' && (
        <Fila etiqueta="Patente">
          {reserva.vehiclePlate ? (
            <span className="font-semibold tracking-wider">{formatearPatente(reserva.vehiclePlate)}</span>
          ) : (
            <span className="font-medium text-amber-700">Sin cargar</span>
          )}
        </Fila>
      )}
      {reserva.notes && (
        <Fila etiqueta="Notas">
          <span className="line-clamp-2">{reserva.notes}</span>
        </Fila>
      )}
    </dl>
  );
}

function FichaLibre({ proxima, fecha, diasLibre, lookahead }) {
  if (!proxima) {
    return <p className="text-slate-600">Sin reservas por delante.</p>;
  }
  const faltan = diasInclusivos(fecha, proxima.startDate) - 1;
  return (
    <dl className="space-y-1.5">
      <Fila etiqueta="Libre">
        {diasLibre >= lookahead ? `Más de ${lookahead} días` : plural(faltan, 'día', 'días')}
      </Fila>
      <Fila etiqueta="Próxima">
        <span className="font-semibold">{proxima.customerName || 'Sin nombre'}</span>
        <span className="block text-slate-600">
          {ddmm(proxima.startDate)} al {ddmm(proxima.endDate)}
          {faltan === 1 ? ' · entra mañana' : ''}
        </span>
      </Fila>
    </dl>
  );
}

export default FichaUnidad;
