import React, { useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { format } from '../lib/dates';
import { ServiceIcon } from './icons';
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
  onOpenNewParkingReservation
}) {
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState(null);

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

  const services = useMemo(
    () => [
      establishment?.hasCarpas
        ? {
            id: 'carpas',
            label: 'Carpas',
            capacity: Number.parseInt(establishment.carpasCapacity ?? '0', 10) || 0,
            reservations: carpasReservations
          }
        : null,
      establishment?.hasSombrillas
        ? {
            id: 'sombrillas',
            label: 'Sombrillas',
            capacity: Number.parseInt(establishment.sombrillasCapacity ?? '0', 10) || 0,
            reservations: sombrillasReservations
          }
        : null,
      establishment?.hasParking
        ? {
            id: 'parking',
            label: 'Estacionamiento',
            capacity: Number.parseInt(establishment.parkingCapacity ?? '0', 10) || 0,
            reservations: parkingReservations
          }
        : null
    ].filter(Boolean),
    [
      establishment?.hasCarpas,
      establishment?.carpasCapacity,
      establishment?.hasSombrillas,
      establishment?.sombrillasCapacity,
      establishment?.hasParking,
      establishment?.parkingCapacity,
      carpasReservations,
      sombrillasReservations,
      parkingReservations
    ]
  );

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

  const computeSpanSameStatus = (reservationsMap, startDate, numero, isOccupied) => {
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
  };

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
          <button
            type="button"
            onClick={() => setDayOffset((prev) => prev - 1)}
            className="inline-flex items-center whitespace-nowrap rounded-full border border-cyan-400 px-3 py-1.5 bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            ◀ Día anterior
          </button>
          <button
            type="button"
            onClick={() => setDayOffset(-baseOffset)}
            className="inline-flex items-center whitespace-nowrap rounded-full border border-cyan-400 px-3 py-1.5 bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setDayOffset((prev) => prev + 1)}
            className="inline-flex items-center whitespace-nowrap rounded-full border border-cyan-400 px-3 py-1.5 bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            Día siguiente ▶
          </button>
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
          const { id, label, capacity, reservations } = service;

          if (!capacity) {
            return (
              <div key={id} id={`panel-${id}`} role={hasTabs ? 'tabpanel' : undefined} className={panelClasses}>
                {!hasTabs && <p className="font-semibold text-slate-900 mb-1">{label}</p>}
                <p className="text-[10px] text-slate-500">Sin capacidad configurada para este servicio.</p>
              </div>
            );
          }

          const unidades = Array.from({ length: capacity }, (_, i) => i + 1);
          let usadas = 0;

          for (const numero of unidades) {
            const key = `${currentDateStr}-${numero}`;
            if (reservations[key]) {
              usadas += 1;
            }
          }

          const ratio = capacity > 0 ? usadas / capacity : 0;
          const resumeColor = getOccupancyColor(ratio);

          const unidadLabelPrefix = id === 'carpas'
            ? 'Carpa'
            : id === 'sombrillas'
              ? 'Sombrilla'
              : 'Plaza';

          const serviceTypeForGroups = id === 'carpas'
            ? 'carpa'
            : id === 'sombrillas'
              ? 'sombrilla'
              : 'parking';

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
                <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${resumeColor}`}>
                  <span className="font-medium mr-1">{usadas}/{capacity}</span>
                  <span>{Math.round(ratio * 100)}% ocupado</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2 text-[10px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border border-emerald-700 bg-emerald-600" />
                  Ocupada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border border-amber-200 bg-amber-50" />
                  Libre, con reserva próxima
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border border-slate-200 bg-white" />
                  Libre
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {unidades.map((numero) => {
                  const key = `${currentDateStr}-${numero}`;
                  const ocupada = Boolean(reservations[key]);

                  const diasMismoEstado = computeSpanSameStatus(
                    reservations,
                    currentDay,
                    numero,
                    ocupada
                  );

                  const diasTexto = diasMismoEstado === 1 ? 'día' : 'días';
                  const libreSinReservas = !ocupada && diasMismoEstado >= quickViewLookaheadDays;

                  let title;
                  let secondaryLabel;
                  let boxClasses;
                  let numberClasses;
                  let labelClasses;

                  if (ocupada) {
                    title = `${unidadLabelPrefix} ${numero} - Ocupada ${diasMismoEstado} ${diasTexto} (incluyendo hoy)`;
                    secondaryLabel = `Ocupada ${diasMismoEstado} ${diasTexto}`;
                    boxClasses = 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700';
                    numberClasses = 'text-white';
                    labelClasses = 'text-emerald-50';
                  } else if (libreSinReservas) {
                    title = `${unidadLabelPrefix} ${numero} - Libre, sin reservas en los próximos ${quickViewLookaheadDays} días`;
                    secondaryLabel = 'Libre';
                    boxClasses = 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50';
                    numberClasses = 'text-slate-900';
                    labelClasses = 'text-slate-500';
                  } else {
                    title = `${unidadLabelPrefix} ${numero} - Libre ${diasMismoEstado} ${diasTexto} hasta la próxima reserva`;
                    secondaryLabel = `Libre ${diasMismoEstado} ${diasTexto}`;
                    boxClasses = 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-100';
                    numberClasses = 'text-slate-900';
                    labelClasses = 'text-amber-700';
                  }

                  const handleClick = () => {
                    if (ocupada) {

                      if (!onViewReservationDetails) return;
                      if (!Array.isArray(reservationGroups) || reservationGroups.length === 0) return;

                      const group = reservationGroups.find(
                        (g) =>
                          g.serviceType === serviceTypeForGroups &&
                          g.resourceNumber === numero &&
                          g.status === 'active' &&
                          g.startDate <= currentDateStr &&
                          g.endDate >= currentDateStr
                      );


                      if (group) {
                        onViewReservationDetails(group);
                      }
                    } else {
                      if (id === 'carpas' && onOpenNewCarpaReservation) {
                        onOpenNewCarpaReservation(numero, currentDay);
                      } else if (id === 'sombrillas' && onOpenNewSombrillaReservation) {
                        onOpenNewSombrillaReservation(numero, currentDay);
                      } else if (id === 'parking' && onOpenNewParkingReservation) {
                        onOpenNewParkingReservation(numero, currentDay);
                      }
                    }
                  };

                  return (
                    <button
                      type="button"
                      key={numero}
                      className={`flex h-9 items-center gap-2 rounded-md border px-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 ${boxClasses}`}
                      title={title}
                      onClick={handleClick}
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
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export default DailyViewSection;
