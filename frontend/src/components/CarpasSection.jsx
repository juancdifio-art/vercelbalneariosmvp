import React from 'react';
import { format, addDays, isSameDay } from 'date-fns';

function CarpasSection({
  establishment,
  carpasDayOffset,
  setCarpasDayOffset,
  carpasReservations,
  reservationGroups,
  hoveredReservationGroupId,
  setHoveredReservationGroupId,
  parseLocalDateFromInput,
  onViewReservationDetails,
  authToken,
  fetchClients,
  setCarpaReservationError,
  setCarpaReservationForm,
  CARPA_RESERVATION_COLORS
}) {
  const getGroupColorIndex = (groupId, serviceType) => {
    const paletteSize = CARPA_RESERVATION_COLORS.length || 1;
    if (!groupId || !paletteSize) return 0;

    const str = `${serviceType || ''}:${groupId}`;
    let hash = 0;

    for (let i = 0; i < str.length; i += 1) {
      const ch = str.charCodeAt(i);
      hash = (hash * 31 + ch) | 0;
    }

    const index = Math.abs(hash) % paletteSize;
    return index;
  };

  return (
    <div className="rounded-xl bg-sky-50 border border-cyan-100 px-3 py-3 sm:px-4 sm:py-4 text-sm">
      <p className="text-slate-900 font-medium mb-1">Carpas</p>
      <p className="text-[11px] text-slate-600 mb-2">
        Capacidad configurada: {establishment?.carpasCapacity ?? 'sin definir'} carpas.
      </p>
      <p className="text-[11px] text-slate-600 mb-3">
        Vista conceptual de los próximos 30 días: filas = carpas, columnas = días. Más adelante vamos a colorear estos
        bloques según reservas y ocupación.
      </p>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 bg-sky-50 pb-2">
        <span>
          Desde{' '}
          <span className="font-medium text-slate-800">
            {format(addDays(new Date(), carpasDayOffset), 'dd/MM/yyyy')}
          </span>
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setCarpasDayOffset((prev) => prev - 10)}
            className="inline-flex items-center rounded-full border border-cyan-400 px-2 py-0.5 text-[10px] bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            ◀ 10 días
          </button>
          <button
            type="button"
            onClick={() => setCarpasDayOffset((prev) => prev + 10)}
            className="inline-flex items-center rounded-full border border-cyan-400 px-2 py-0.5 text-[10px] bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            10 días ▶
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-slate-300 bg-white max-h-[600px] overflow-y-auto overflow-x-auto">
        {(() => {
          const totalCarpas = Number.parseInt(
            establishment?.carpasCapacity ?? '0',
            10
          );

          if (!totalCarpas || Number.isNaN(totalCarpas)) {
            return (
              <div className="px-4 py-6 text-[11px] text-slate-600">
                Configurá primero la cantidad de carpas en la sección de configuración del establecimiento.
              </div>
            );
          }

          const today = new Date();
          const days = Array.from({ length: 30 }, (_, i) => addDays(today, carpasDayOffset + i));

          return (
            <table className="w-full table-fixed text-[10px]">
              <thead>
                <tr>
                  <th className="bg-cyan-50 px-1 py-1 text-left font-semibold text-cyan-900 border-b border-slate-400 w-16 sticky top-0 z-10">
                    Carpa
                  </th>
                  {days.map((day, idx) => {
                    const isToday = isSameDay(day, today);
                    return (
                      <th
                        key={idx}
                        className={
                          'px-0.5 py-1 text-center font-medium border-b border-slate-200 sticky top-0 z-10 ' +
                          (isToday
                            ? 'text-cyan-900 bg-cyan-200'
                            : 'text-slate-700 bg-white')
                        }
                      >
                        <div>{format(day, 'dd')}</div>
                        <div className="text-[9px] text-slate-500">
                          {format(day, 'EEE')[0]}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalCarpas }, (_, i) => i + 1).map((carpaNumero) => {
                  return (
                    <tr key={carpaNumero} className="border-t border-slate-200">
                      <td className="bg-cyan-50 px-1 py-1 text-cyan-900 border-r border-slate-300 w-16">
                        Carpa {carpaNumero}
                      </td>
                      {days.map((day, idx) => {
                        const isToday = isSameDay(day, today);
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const key = `${dateStr}-${carpaNumero}`;
                        const isReserved = Boolean(carpasReservations[key]);

                        let colorIndexForCell = 0;
                        let groupForCell = null;

                        if (isReserved) {
                          groupForCell = reservationGroups.find(
                            (g) =>
                              g.serviceType === 'carpa' &&
                              g.resourceNumber === carpaNumero &&
                              g.status === 'active' &&
                              g.startDate <= dateStr &&
                              g.endDate >= dateStr
                          );

                          const groupId = groupForCell?.id ?? null;

                          if (groupId !== null) {
                            colorIndexForCell = getGroupColorIndex(groupId, 'carpa');
                          }
                        }

                        let cellClasses =
                          'h-5 border-l border-slate-300 transition-colors cursor-pointer ';

                        if (isReserved) {
                          const paletteSize = CARPA_RESERVATION_COLORS.length || 1;
                          const index = ((colorIndexForCell % paletteSize) + paletteSize) % paletteSize;
                          const colorDef = CARPA_RESERVATION_COLORS[index];

                          if (colorDef) {
                            cellClasses += isToday ? colorDef.today : colorDef.normal;
                          } else {
                            cellClasses += isToday
                              ? 'bg-amber-500 hover:bg-amber-600'
                              : 'bg-amber-300 hover:bg-amber-400';
                          }

                          if (
                            groupForCell &&
                            hoveredReservationGroupId &&
                            hoveredReservationGroupId === groupForCell.id
                          ) {
                            cellClasses += ' border-2 border-slate-900';
                          }
                        } else {
                          cellClasses += isToday
                            ? 'bg-cyan-400 hover:bg-cyan-500'
                            : 'bg-white hover:bg-slate-200';
                        }

                        const groupForClick = groupForCell;

                        let tooltip = '';

                        if (groupForCell) {
                          const customerLabel = (groupForCell.customerName || '').trim() || 'Sin cliente';
                          const startObj = parseLocalDateFromInput(groupForCell.startDate);
                          const endObj = parseLocalDateFromInput(groupForCell.endDate);

                          let rangeLabel = '';

                          if (startObj && endObj) {
                            const startStr = format(startObj, 'dd/MM');
                            const endStr = format(endObj, 'dd/MM');
                            rangeLabel = `Del ${startStr} al ${endStr}`;
                          } else {
                            rangeLabel = `Del ${groupForCell.startDate} al ${groupForCell.endDate}`;
                          }

                          tooltip = `${customerLabel}\n${rangeLabel}`;
                        }

                        return (
                          <td
                            key={idx}
                            className={cellClasses}
                            title={tooltip}
                            onMouseEnter={() => {
                              if (groupForClick) {
                                setHoveredReservationGroupId(groupForClick.id);
                              } else {
                                setHoveredReservationGroupId(null);
                              }
                            }}
                            onMouseLeave={() => {
                              setHoveredReservationGroupId(null);
                            }}
                            onClick={() => {
                              if (isReserved) {
                                console.log('[CarpasSection] Click on occupied cell:', {
                                  carpaNumero,
                                  dateStr,
                                  groupForClick,
                                  totalGroups: reservationGroups.length,
                                  carpaGroups: reservationGroups.filter(g => g.serviceType === 'carpa').length
                                });

                                const group =
                                  groupForClick ||
                                  reservationGroups.find(
                                    (g) =>
                                      g.serviceType === 'carpa' &&
                                      g.resourceNumber === carpaNumero &&
                                      g.status === 'active' &&
                                      g.startDate <= dateStr &&
                                      g.endDate >= dateStr
                                  );

                                console.log('[CarpasSection] Found group:', group);

                                if (group) {
                                  onViewReservationDetails(group);
                                  return;
                                }
                              }

                              const token = authToken || sessionStorage.getItem('authToken');
                              if (token) {
                                fetchClients(token);
                              }

                              setCarpaReservationError('');

                              setCarpaReservationForm({
                                carpaNumero,
                                day,
                                isReserved,
                                startDate: dateStr,
                                endDate: '',
                                clientId: null,
                                customerName: '',
                                customerPhone: '',
                                dailyPrice: '',
                                includeParking: false,
                                parkingSpotNumber: '',
                                parkingDailyPrice: '',
                                initialPaymentAmount: '',
                                initialPaymentMethod: '',
                                parkingInitialPaymentAmount: '',
                                parkingInitialPaymentMethod: ''
                              });
                            }}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
}

export default CarpasSection;
