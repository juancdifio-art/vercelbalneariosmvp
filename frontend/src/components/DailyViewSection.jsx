import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';

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
        Plano simplificado del balneario para un día, mostrando qué unidades están ocupadas y cuáles libres.
      </p>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-slate-600">
          <span className="font-medium text-slate-800 mr-2">Día seleccionado:</span>
          <span className="inline-flex items-center rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5">
            {format(currentDay, 'dd/MM/yyyy')}
          </span>
        </div>
        <div className="flex gap-1.5 text-[10px]">
          <button
            type="button"
            onClick={() => setDayOffset((prev) => prev - 1)}
            className="inline-flex items-center rounded-full border border-cyan-400 px-2 py-0.5 bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            ◀ Día anterior
          </button>
          <button
            type="button"
            onClick={() => setDayOffset(-baseOffset)}
            className="inline-flex items-center rounded-full border border-cyan-400 px-2 py-0.5 bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setDayOffset((prev) => prev + 1)}
            className="inline-flex items-center rounded-full border border-cyan-400 px-2 py-0.5 bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            Día siguiente ▶
          </button>
        </div>
      </div>

      {services.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelectedServiceId(service.id)}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                selectedServiceId === service.id
                  ? 'bg-cyan-600 border-cyan-700 text-white'
                  : 'bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-50'
              }`}
            >
              {service.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {visibleServices.map((service) => {
          const { id, label, capacity, reservations } = service;

          if (!capacity) {
            return (
              <div
                key={id}
                className="rounded-xl bg-white border border-slate-200 px-3 py-3 text-[11px] text-slate-700"
              >
                <p className="font-semibold text-slate-900 mb-1">{label}</p>
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
            <div
              key={id}
              className="rounded-xl bg-white border border-slate-200 px-3 py-3 text-[11px] text-slate-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-[10px] text-slate-500">
                    {capacity} unidades totales. Vista rápida de ocupación para el día seleccionado.
                  </p>
                </div>
                <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${resumeColor}`}>
                  <span className="font-medium mr-1">{usadas}/{capacity}</span>
                  <span>{Math.round(ratio * 100)}% ocupado</span>
                </div>
              </div>

              <div className="mt-1 grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1">
                {unidades.map((numero) => {
                  const key = `${currentDateStr}-${numero}`;
                  const ocupada = Boolean(reservations[key]);

                  const diasMismoEstado = computeSpanSameStatus(
                    reservations,
                    currentDay,
                    numero,
                    ocupada
                  );

                  const boxClasses = ocupada
                    ? 'bg-emerald-500 border-emerald-600 text-white cursor-pointer hover:bg-emerald-600'
                    : 'bg-slate-50 border-slate-300 text-slate-600 cursor-pointer hover:bg-slate-100';

                  const diasTexto = diasMismoEstado === 1 ? 'día' : 'días';

                  let title;
                  let secondaryLabel;

                  if (ocupada) {
                    title = `${unidadLabelPrefix} ${numero} - Ocupada ${diasMismoEstado} ${diasTexto} (incluyendo hoy)`;
                    secondaryLabel = `${diasMismoEstado} ${diasTexto}`;
                  } else if (diasMismoEstado >= quickViewLookaheadDays) {
                    title = `${unidadLabelPrefix} ${numero} - Sin reservas próximas (al menos en los próximos ${quickViewLookaheadDays} días desde hoy)`;
                    secondaryLabel = 'Sin reserva';
                  } else {
                    title = `${unidadLabelPrefix} ${numero} - Libre ${diasMismoEstado} ${diasTexto} hasta la próxima reserva (a partir de hoy)`;
                    secondaryLabel = `Libre ${diasMismoEstado} ${diasTexto}`;
                  }

                  const handleClick = () => {
                    if (ocupada) {
                      console.log('[DailyViewSection] Click on occupied cell:', {
                        serviceType: serviceTypeForGroups,
                        numero,
                        currentDateStr,
                        totalGroups: reservationGroups.length,
                        groupsByService: {
                          carpa: reservationGroups.filter(g => g.serviceType === 'carpa').length,
                          sombrilla: reservationGroups.filter(g => g.serviceType === 'sombrilla').length,
                          parking: reservationGroups.filter(g => g.serviceType === 'parking').length
                        }
                      });

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

                      console.log('[DailyViewSection] Found group:', group);

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
                    <div
                      key={numero}
                      className={`h-7 rounded-sm text-[9px] flex items-center justify-center border ${boxClasses}`}
                      title={title}
                      onClick={handleClick}
                    >
                      <div className="flex flex-col items-center leading-tight">
                        <span>{numero}</span>
                        <span className="text-[8px] font-semibold">{secondaryLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DailyViewSection;
