import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import { format } from '../lib/dates';
import { ServiceIcon } from './icons';
import { diasOcupadaDesde, reservaEnFecha, proximaReserva, estacionamientoVinculado } from '../lib/reservas';
import { numerosDeUnidades } from '../lib/unidades';
import { PLANO_ACTIVO } from '../config/planoZeus';
import PlanoBalneario from './PlanoBalneario';
import PlanoCompletoOverlay from './PlanoCompletoOverlay';
import TooltipFlotante from './TooltipFlotante';
import FichaUnidad from './FichaUnidad';

// Servicio de la Vista rapida -> tipo de reserva y vista del plano.
const TIPO_DE_SERVICIO = { carpas: 'carpa', sombrillas: 'sombrilla', parking: 'parking' };
const SERVICIO_DE_TIPO = { carpa: 'carpas', sombrilla: 'sombrillas', parking: 'parking' };
const PREFIJO = { carpas: 'Carpa', sombrillas: 'Sombrilla', parking: 'Plaza' };

function DailyViewSection({
  establishment,
  carpasReservations,
  sombrillasReservations,
  parkingReservations,
  carpasDayOffset,
  sombrillasDayOffset,
  parkingDayOffset,
  quickViewLookaheadDays = 90,
  reservationGroups = [],
  onViewReservationDetails,
  onOpenNewCarpaReservation,
  onOpenNewSombrillaReservation,
  onOpenNewParkingReservation,
  conPlano = PLANO_ACTIVO
}) {
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  // Con plano, carpas y sombrillas se ven sobre el plano; la lista queda a mano.
  const [modo, setModo] = useState('plano');
  const [planoCompletoAbierto, setPlanoCompletoAbierto] = useState(false);
  const tooltipListaRef = useRef(null);

  const today = useMemo(() => new Date(), []);
  const baseOffset = useMemo(() => {
    if (selectedServiceId === 'carpas') {
      return Number.parseInt(carpasDayOffset ?? 0, 10) || 0;
    }
    if (selectedServiceId === 'sombrillas') {
      return Number.parseInt(sombrillasDayOffset ?? 0, 10) || 0;
    }
    if (selectedServiceId === 'parking') {
      return Number.parseInt(parkingDayOffset ?? 0, 10) || 0;
    }
    return 0;
  }, [selectedServiceId, carpasDayOffset, sombrillasDayOffset, parkingDayOffset]);

  const currentDay = useMemo(
    () => addDays(today, baseOffset + dayOffset),
    [today, baseOffset, dayOffset]
  );
  const currentDateStr = format(currentDay, 'yyyy-MM-dd');

  const reservasPorServicio = useMemo(
    () => ({
      carpas: carpasReservations || {},
      sombrillas: sombrillasReservations || {},
      parking: parkingReservations || {}
    }),
    [carpasReservations, sombrillasReservations, parkingReservations]
  );

  const services = useMemo(() => {
    const armar = (id, label, habilitado) => {
      if (!habilitado) return null;
      const unidades = numerosDeUnidades(establishment, TIPO_DE_SERVICIO[id], conPlano);
      return {
        id,
        label,
        unidades,
        capacity: unidades.length,
        reservations: reservasPorServicio[id],
        enPlano: conPlano && id !== 'parking'
      };
    };
    return [
      armar('carpas', 'Carpas', establishment?.hasCarpas),
      armar('sombrillas', 'Sombrillas', establishment?.hasSombrillas),
      armar('parking', 'Estacionamiento', establishment?.hasParking)
    ].filter(Boolean);
  }, [establishment, conPlano, reservasPorServicio]);

  useEffect(() => {
    if (!services.length) {
      return;
    }

    if (!selectedServiceId || !services.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  useEffect(() => {
    if (!selectedServiceId) return;
    // Ajustamos el offset local para que, por defecto, "Hoy" sea el día de calendario actual
    setDayOffset(-baseOffset);
  }, [selectedServiceId, baseOffset]);

  const computeSpanSameStatus = useCallback(
    (reservationsMap, startDate, numero, isOccupied) => {
      let days = 0;

      for (let offset = 0; offset < quickViewLookaheadDays; offset += 1) {
        const date = addDays(startDate, offset);
        const dateStr = format(date, 'yyyy-MM-dd');
        const key = `${dateStr}-${numero}`;
        const hasReservation = Boolean(reservationsMap[key]);
        if (hasReservation === isOccupied) {
          days += 1;
        } else {
          break;
        }
      }

      return days;
    },
    [quickViewLookaheadDays]
  );

  /**
   * Estado de una unidad en el dia seleccionado: ocupada, libre con reserva
   * proxima o libre. Lo usan la lista, el plano de la solapa y el plano completo.
   */
  const estadoUnidad = useCallback(
    (serviceId, numero) => {
      const reservations = reservasPorServicio[serviceId];
      const ocupada = Boolean(reservations[`${currentDateStr}-${numero}`]);

      // Ocupada: los dias salen de la fecha de fin real de la reserva.
      // El mapa dia por dia solo cubre los proximos 90 dias, y con el
      // una estadia de temporada marcaba "Ocupada 90 dias". Si por
      // algun motivo no se encuentra la reserva, se cae al mapa.
      // Libre: se sigue usando el mapa, porque ahi el tope es a
      // proposito ("sin reservas en los proximos 90 dias").
      const diasOcupada = ocupada
        ? diasOcupadaDesde(reservationGroups, TIPO_DE_SERVICIO[serviceId], numero, currentDateStr)
        : 0;
      const dias =
        diasOcupada > 0 ? diasOcupada : computeSpanSameStatus(reservations, currentDay, numero, ocupada);

      const diasTexto = dias === 1 ? 'día' : 'días';
      const prefijo = PREFIJO[serviceId];

      if (ocupada) {
        return {
          estado: 'ocupada',
          title: `${prefijo} ${numero} - Ocupada ${dias} ${diasTexto} (incluyendo hoy)`,
          label: `Ocupada ${dias} ${diasTexto}`
        };
      }
      if (dias >= quickViewLookaheadDays) {
        return {
          estado: 'libre',
          title: `${prefijo} ${numero} - Libre, sin reservas en los próximos ${quickViewLookaheadDays} días`,
          label: 'Libre'
        };
      }
      return {
        estado: 'proxima',
        title: `${prefijo} ${numero} - Libre ${dias} ${diasTexto} hasta la próxima reserva`,
        label: `Libre ${dias} ${diasTexto}`
      };
    },
    [reservasPorServicio, currentDateStr, currentDay, reservationGroups, computeSpanSameStatus, quickViewLookaheadDays]
  );

  const clickUnidad = useCallback(
    (serviceId, numero) => {
      const ocupada = Boolean(reservasPorServicio[serviceId][`${currentDateStr}-${numero}`]);
      const serviceType = TIPO_DE_SERVICIO[serviceId];

      if (ocupada) {
        if (!onViewReservationDetails) return;
        if (!Array.isArray(reservationGroups) || reservationGroups.length === 0) return;

        const group = reservationGroups.find(
          (g) =>
            g.serviceType === serviceType &&
            g.resourceNumber === numero &&
            g.status === 'active' &&
            g.startDate <= currentDateStr &&
            g.endDate >= currentDateStr
        );

        if (group) {
          onViewReservationDetails(group);
        }
        return;
      }

      if (serviceId === 'carpas' && onOpenNewCarpaReservation) {
        onOpenNewCarpaReservation(numero, currentDay);
      } else if (serviceId === 'sombrillas' && onOpenNewSombrillaReservation) {
        onOpenNewSombrillaReservation(numero, currentDay);
      } else if (serviceId === 'parking' && onOpenNewParkingReservation) {
        onOpenNewParkingReservation(numero, currentDay);
      }
    },
    [
      reservasPorServicio,
      currentDateStr,
      currentDay,
      reservationGroups,
      onViewReservationDetails,
      onOpenNewCarpaReservation,
      onOpenNewSombrillaReservation,
      onOpenNewParkingReservation
    ]
  );

  /**
   * Tarjeta que sale al pasar el mouse: con la reserva del dia si esta
   * ocupada, o con la proxima si esta libre. Sale de las reservas que la app
   * ya tiene cargadas, sin pedir nada al servidor.
   */
  const fichaUnidad = useCallback(
    (serviceId, numero) => {
      const serviceType = TIPO_DE_SERVICIO[serviceId];
      const info = estadoUnidad(serviceId, numero);
      const reserva =
        info.estado === 'ocupada'
          ? reservaEnFecha(reservationGroups, serviceType, numero, currentDateStr)
          : null;
      const dias = info.estado === 'libre' ? quickViewLookaheadDays : null;
      return (
        <FichaUnidad
          prefijo={PREFIJO[serviceId]}
          numero={numero}
          estado={info.estado}
          fecha={currentDateStr}
          reserva={reserva}
          proxima={reserva ? null : proximaReserva(reservationGroups, serviceType, numero, currentDateStr)}
          estacionamiento={reserva && serviceType !== 'parking' ? estacionamientoVinculado(reservationGroups, reserva) : null}
          diasLibre={dias ?? 0}
          lookahead={quickViewLookaheadDays}
        />
      );
    },
    [estadoUnidad, reservationGroups, currentDateStr, quickViewLookaheadDays]
  );

  // El plano habla en tipos de reserva ('carpa'); la Vista rapida en servicios ('carpas').
  const estadoEnPlano = useCallback(
    (serviceType, numero) => estadoUnidad(SERVICIO_DE_TIPO[serviceType], numero),
    [estadoUnidad]
  );
  const clickEnPlano = useCallback(
    (serviceType, numero) => clickUnidad(SERVICIO_DE_TIPO[serviceType], numero),
    [clickUnidad]
  );
  const fichaEnPlano = useCallback(
    (serviceType, numero) => fichaUnidad(SERVICIO_DE_TIPO[serviceType], numero),
    [fichaUnidad]
  );
  const cerrarPlanoCompleto = useCallback(() => setPlanoCompletoAbierto(false), []);

  const getOccupancyColor = (ratio) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return 'bg-emerald-50 text-emerald-800 border-emerald-100';
    if (ratio < 0.6) return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    if (ratio < 0.9) return 'bg-amber-100 text-amber-900 border-amber-200';
    return 'bg-rose-100 text-rose-900 border-rose-200';
  };

  if (!establishment) {
    return (
      <div className="rounded-xl bg-sky-50 border border-cyan-100 px-4 py-4 text-sm">
        <p className="text-[11px] text-slate-600">
          Configurá primero el establecimiento para ver la vista rápida de ocupación.
        </p>
      </div>
    );
  }

  const visibleServices = services.filter((service) => service.id === selectedServiceId);
  const hayPlano = services.some((service) => service.enPlano);

  // Con mas de un servicio la navegacion son solapas: el borde y el redondeo
  // los pone el contenedor, asi la solapa activa y el panel forman una sola
  // superficie continua.
  const hasTabs = services.length > 1;
  const panelClasses = hasTabs
    ? 'rounded-b-xl bg-white px-3 py-3 text-[11px] text-slate-700'
    : 'rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] text-slate-700';

  if (services.length === 0) {
    return (
      <div className="rounded-xl bg-sky-50 border border-cyan-100 px-4 py-4 text-sm">
        <p className="text-[11px] text-slate-600">
          No hay servicios de temporada (carpas, sombrillas, estacionamiento) habilitados en el establecimiento.
        </p>
      </div>
    );
  }

  const botonDia =
    'inline-flex items-center whitespace-nowrap rounded-full border border-cyan-400 px-3 py-1.5 bg-white hover:bg-cyan-50 hover:border-cyan-500';

  return (
    <div className="rounded-xl bg-sky-50 border border-cyan-100 px-3 py-3 sm:px-4 sm:py-4 text-sm">
      <p className="text-[11px] text-slate-600 mb-2">
        Vista simplificada del balneario para un día, mostrando qué unidades están ocupadas y cuáles libres.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-[11px] text-slate-600">
          <span className="font-medium text-slate-800 mr-2">Día seleccionado:</span>
          <span className="inline-flex items-center rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5">
            {format(currentDay, 'dd/MM/yyyy')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <button type="button" onClick={() => setDayOffset((prev) => prev - 1)} className={botonDia}>
            ◀ Día anterior
          </button>
          <button type="button" onClick={() => setDayOffset(-baseOffset)} className={botonDia}>
            Hoy
          </button>
          <button type="button" onClick={() => setDayOffset((prev) => prev + 1)} className={botonDia}>
            Día siguiente ▶
          </button>
          {hayPlano && (
            <button
              type="button"
              onClick={() => setPlanoCompletoAbierto(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1"
            >
              ⛶ Plano completo
            </button>
          )}
        </div>
      </div>

      <div className={hasTabs ? 'rounded-xl border border-slate-200 bg-white' : ''}>
      {hasTabs && (
        <div className="border-b border-slate-200 p-2 sm:hidden">
          <select
            aria-label="Servicio"
            value={selectedServiceId ?? ''}
            onChange={(event) => setSelectedServiceId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasTabs && (
        <div role="tablist" aria-label="Servicio" className="hidden gap-1 border-b border-slate-200 px-2 pt-2 sm:flex">
          {services.map((service) => {
            const isActive = selectedServiceId === service.id;
            return (
              <button
                key={service.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${service.id}`}
                onClick={() => setSelectedServiceId(service.id)}
                className={
                  '-mb-px whitespace-nowrap rounded-t-lg px-2.5 py-2 text-[12px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:px-4 sm:text-[13px] ' +
                  (isActive
                    ? 'border border-slate-200 border-b-white bg-white font-semibold text-slate-900'
                    : 'border border-transparent font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800')
                }
              >
                {service.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {visibleServices.map((service) => {
          const { id, label, capacity, unidades, reservations, enPlano } = service;

          if (!capacity) {
            return (
              <div key={id} id={`panel-${id}`} role={hasTabs ? 'tabpanel' : undefined} className={panelClasses}>
                {!hasTabs && <p className="font-semibold text-slate-900 mb-1">{label}</p>}
                <p className="text-[10px] text-slate-500">Sin capacidad configurada para este servicio.</p>
              </div>
            );
          }

          let usadas = 0;
          for (const numero of unidades) {
            if (reservations[`${currentDateStr}-${numero}`]) {
              usadas += 1;
            }
          }

          // Reservas activas en numeros que no estan en el plano (p. ej. la
          // carpa 7): no tienen donde dibujarse, asi que se avisan aparte para
          // poder reubicarlas.
          const numerosValidos = new Set(unidades);
          const fueraDelPlano = enPlano && Array.isArray(reservationGroups)
            ? reservationGroups.filter(
                (g) =>
                  g.serviceType === TIPO_DE_SERVICIO[id] &&
                  g.status === 'active' &&
                  g.endDate >= currentDateStr &&
                  !numerosValidos.has(Number(g.resourceNumber))
              )
            : [];

          const ratio = capacity > 0 ? usadas / capacity : 0;
          const resumeColor = getOccupancyColor(ratio);
          const verPlano = enPlano && modo === 'plano';

          const botonModo = (valor, texto) => (
            <button
              type="button"
              aria-pressed={modo === valor}
              onClick={() => setModo(valor)}
              className={
                'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ' +
                (modo === valor ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')
              }
            >
              {texto}
            </button>
          );

          return (
            <div key={id} id={`panel-${id}`} role={hasTabs ? 'tabpanel' : undefined} className={panelClasses}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div>
                  {/* Con solapas el nombre del servicio ya lo dice la solapa activa. */}
                  {!hasTabs && <p className="font-semibold text-slate-900">{label}</p>}
                  <p className="text-[10px] text-slate-500">
                    {capacity} unidades totales. Vista rápida de ocupación para el día seleccionado.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {enPlano && (
                    <div className="inline-flex rounded-full border border-slate-200 p-0.5" role="group" aria-label="Forma de ver">
                      {botonModo('plano', 'Plano')}
                      {botonModo('lista', 'Lista')}
                    </div>
                  )}
                  <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${resumeColor}`}>
                    <span className="font-medium mr-1">{usadas}/{capacity}</span>
                    <span>{Math.round(ratio * 100)}% ocupado</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2 text-[10px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border border-emerald-700 bg-emerald-600" />
                  Ocupada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-sm border bg-amber-50 ${verPlano ? 'border-amber-400' : 'border-amber-200'}`} />
                  Libre, con reserva próxima
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-sm border bg-white ${verPlano ? 'border-slate-500' : 'border-slate-200'}`} />
                  Libre
                </span>
              </div>

              {fueraDelPlano.length > 0 && (
                <div role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <p className="font-semibold">
                    {fueraDelPlano.length === 1
                      ? `Hay 1 reserva en un número que no está en el plano.`
                      : `Hay ${fueraDelPlano.length} reservas en números que no están en el plano.`}{' '}
                    Abrila para pasarla a una unidad que exista.
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {fueraDelPlano.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => onViewReservationDetails && onViewReservationDetails(g)}
                          className="rounded-full border border-amber-400 bg-white px-2.5 py-0.5 font-medium hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                        >
                          {PREFIJO[id]} {g.resourceNumber}
                          {g.customerName ? ` · ${g.customerName}` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {verPlano ? (
                <div className="mt-2 overflow-x-auto rounded-lg border border-amber-200">
                  <PlanoBalneario
                    vista={id}
                    estadoDe={estadoEnPlano}
                    onUnidadClick={clickEnPlano}
                    fichaDe={fichaEnPlano}
                    className="h-auto w-full min-w-[720px]"
                  />
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {unidades.map((numero) => {
                    const { estado, title, label: secondaryLabel } = estadoUnidad(id, numero);

                    let boxClasses;
                    let numberClasses;
                    let labelClasses;

                    if (estado === 'ocupada') {
                      boxClasses = 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700';
                      numberClasses = 'text-white';
                      labelClasses = 'text-emerald-50';
                    } else if (estado === 'libre') {
                      boxClasses = 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50';
                      numberClasses = 'text-slate-900';
                      labelClasses = 'text-slate-500';
                    } else {
                      boxClasses = 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-100';
                      numberClasses = 'text-slate-900';
                      labelClasses = 'text-amber-700';
                    }

                    return (
                      <button
                        type="button"
                        key={numero}
                        className={`flex h-9 items-center gap-2 rounded-md border px-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 ${boxClasses}`}
                        aria-label={title}
                        onClick={() => {
                          tooltipListaRef.current?.ocultar();
                          clickUnidad(id, numero);
                        }}
                        onMouseEnter={(e) => tooltipListaRef.current?.mostrar(e.currentTarget, fichaUnidad(id, numero))}
                        onMouseLeave={() => tooltipListaRef.current?.ocultar()}
                        onFocus={(e) => tooltipListaRef.current?.mostrar(e.currentTarget, fichaUnidad(id, numero))}
                        onBlur={() => tooltipListaRef.current?.ocultar()}
                      >
                        <span className={`text-[15px] font-semibold leading-none tabular-nums ${numberClasses}`}>
                          {numero}
                        </span>
                        <span className={`ml-auto truncate text-[11px] font-medium leading-none ${labelClasses}`}>
                          {secondaryLabel}
                        </span>
                        <ServiceIcon serviceId={id} className={`h-3.5 w-3.5 shrink-0 opacity-80 ${labelClasses}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      <TooltipFlotante ref={tooltipListaRef} />

      {hayPlano && (
        <PlanoCompletoOverlay
          abierto={planoCompletoAbierto}
          onCerrar={cerrarPlanoCompleto}
          fechaTexto={format(currentDay, 'dd/MM/yyyy')}
          estadoDe={estadoEnPlano}
          onUnidadClick={clickEnPlano}
          fichaDe={fichaEnPlano}
        />
      )}
    </div>
  );
}

export default DailyViewSection;
