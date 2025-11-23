import React, { useMemo, useState } from 'react';

function ReservasSection({
  reservationGroups,
  reservationGroupsLoading,
  reservationFilterService,
  reservationFilterStatus,
  reservationFilterFrom,
  reservationFilterTo,
  onFilterServiceChange,
  onFilterStatusChange,
  onFilterFromChange,
  onFilterToChange,
  onClearFilters,
  onViewDetails,
  onAddPayment
}) {
  const [searchText, setSearchText] = useState('');
  const [paymentFilter, setPaymentFilter] = useState(''); // '', 'paid', 'pending'
  
  const formatShortDate = (value) => {
    if (!value || typeof value !== 'string') return value || '';
    const parts = value.split('-');
    if (parts.length !== 3) return value;

    const [year, month, day] = parts;
    const shortYear = year.slice(-2);
    return `${day}/${month}/${shortYear}`;
  };

  const getTodayString = () => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filtrar reservas por texto de búsqueda y estado de pago
  const filteredReservations = useMemo(() => {
    let filtered = reservationGroups;
    
    // Filtrar por nombre
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(group => {
        const customerName = (group.customerName || '').toLowerCase();
        return customerName.includes(searchLower);
      });
    }
    
    // Filtrar por estado de pago
    if (paymentFilter) {
      filtered = filtered.filter(group => {
        const totalPrice = parseFloat(group.totalPrice || 0);
        const paidAmount = parseFloat(group.paidAmount || 0);
        
        if (paymentFilter === 'paid') {
          // Pagado completo (con margen de error de 1 centavo)
          return paidAmount + 0.01 >= totalPrice;
        } else if (paymentFilter === 'pending') {
          // Tiene saldo pendiente
          return paidAmount + 0.01 < totalPrice;
        }
        return true;
      });
    }
    
    return filtered;
  }, [reservationGroups, searchText, paymentFilter]);

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Reservas</h2>
        <p className="text-xs text-slate-500">
          Listado de reservas por rango de fechas. Desde acá podés ver el detalle de cada reserva y registrar pagos asociados.
        </p>
      </div>

      {/* Contenedor scrollable con filtros y contenido */}
      <div className="max-h-[700px] overflow-y-auto">
        {/* Filtros */}
        <div className="sticky top-0 z-20 px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-end gap-3 text-[11px]">
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-0.5 text-slate-700">Buscar por nombre</label>
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full rounded-lg border border-cyan-200 bg-white pl-8 pr-2 py-1 text-[11px] text-slate-900 placeholder:text-slate-400"
              />
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          <div>
            <label className="block mb-0.5 text-slate-700">Servicio</label>
            <select
              value={reservationFilterService}
              onChange={(e) => onFilterServiceChange(e.target.value)}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
            >
              <option value="">Todos</option>
              <option value="carpa">Carpas</option>
              <option value="sombrilla">Sombrillas</option>
              <option value="parking">Estacionamiento</option>
              <option value="pileta">Pileta</option>
            </select>
          </div>
          <div>
            <label className="block mb-0.5 text-slate-700">Estado</label>
            <select
              value={reservationFilterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
            >
              <option value="">Todos</option>
              <option value="active">Activas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>
          <div>
            <label className="block mb-0.5 text-slate-700">Pagos</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
            >
              <option value="">Todos</option>
              <option value="paid">Pagado completo</option>
              <option value="pending">Pago pendiente</option>
            </select>
          </div>
          <div>
            <label className="block mb-0.5 text-slate-700">Rango de fechas</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={reservationFilterFrom}
                onChange={(e) => onFilterFromChange(e.target.value)}
                placeholder="Desde"
                className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
              />
              <span className="text-slate-400">—</span>
              <input
                type="date"
                value={reservationFilterTo}
                onChange={(e) => onFilterToChange(e.target.value)}
                placeholder="Hasta"
                className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchText('');
              setPaymentFilter('');
              onClearFilters();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar filtros
          </button>
          </div>
        </div>
        {!reservationGroupsLoading && reservationGroups.length > 0 && (
          <div className="mt-3 text-[11px] text-slate-600 flex justify-between items-center">
            <span>
              Mostrando{' '}
              <span className="font-semibold text-slate-800">{filteredReservations.length}</span>
              {' '}de{' '}
              <span className="font-semibold text-slate-800">{reservationGroups.length}</span>
              {' '}reservas
            </span>
          </div>
        )}
        {/* Contenido */}
        <div className="px-5 py-4">
        {reservationGroupsLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-2"></div>
              <p className="text-sm text-slate-500">Cargando reservas...</p>
            </div>
          </div>
        )}

        {!reservationGroupsLoading && reservationGroups.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-slate-600 font-medium">No hay reservas cargadas</p>
            <p className="text-xs text-slate-500 mt-1">Las reservas aparecerán aquí cuando se creen</p>
          </div>
        )}

        {!reservationGroupsLoading && reservationGroups.length > 0 && filteredReservations.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm text-slate-600 font-medium">No se encontraron resultados</p>
            <p className="text-xs text-slate-500 mt-1">Intenta ajustar los filtros de búsqueda</p>
          </div>
        )}

        {!reservationGroupsLoading && filteredReservations.length > 0 && (
          <div className="overflow-x-auto -mx-5">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Servicio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Recurso</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Entrada</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Salida</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Pagos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider sticky top-0 z-10 bg-slate-50">Acciones</th>
                </tr>
              </thead>
            <tbody>
              {filteredReservations.map((group) => {
                const isCancelled = group.status === 'cancelled';
                const todayStr = getTodayString();
                const serviceLabel =
                  group.serviceType === 'carpa'
                    ? 'Carpa'
                    : group.serviceType === 'sombrilla'
                      ? 'Sombrilla'
                      : group.serviceType === 'parking'
                        ? 'Estacionamiento'
                        : group.serviceType === 'pileta'
                          ? 'Pileta'
                          : group.serviceType;

                const totalPriceNum =
                  group.totalPrice !== null &&
                  group.totalPrice !== undefined &&
                  group.totalPrice !== ''
                    ? Number.parseFloat(String(group.totalPrice))
                    : null;

                const paidAmountNum =
                  group.paidAmount !== null &&
                  group.paidAmount !== undefined &&
                  group.paidAmount !== ''
                    ? Number.parseFloat(String(group.paidAmount))
                    : null;

                let paidClassName = 'inline-block';

                if (
                  totalPriceNum !== null &&
                  !Number.isNaN(totalPriceNum) &&
                  paidAmountNum !== null &&
                  !Number.isNaN(paidAmountNum)
                ) {
                  if (paidAmountNum + 1e-6 < totalPriceNum) {
                    paidClassName += ' text-red-600 font-semibold';
                  } else {
                    paidClassName += ' text-emerald-700 font-semibold';
                  }
                }

                let statusLabel = '';
                let statusClasses = 'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ';

                if (isCancelled) {
                  statusLabel = 'Cancelada';
                  statusClasses += 'bg-slate-100 text-slate-700';
                } else {
                  const startStr = group.startDate || '';
                  const endStr = group.endDate || '';

                  if (startStr && startStr > todayStr) {
                    statusLabel = 'Reservada';
                    statusClasses += 'bg-amber-100 text-amber-700';
                  } else if (endStr && endStr < todayStr) {
                    statusLabel = 'Finalizada';
                    statusClasses += 'bg-orange-100 text-orange-700';
                  } else {
                    statusLabel = 'Activa';
                    statusClasses += 'bg-emerald-100 text-emerald-700';
                  }
                }

                return (
                  <tr 
                    key={group.id} 
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isCancelled ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs font-medium text-slate-900">{serviceLabel}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs text-slate-700">{group.resourceNumber}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs text-slate-600">{formatShortDate(group.startDate)}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs text-slate-600">{formatShortDate(group.endDate)}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className="inline-block max-w-[140px] truncate font-semibold text-slate-900"
                        title={group.customerName || ''}
                      >
                        {group.customerName || <span className="font-normal text-slate-400">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`text-xs font-semibold ${paidAmountNum + 0.01 < totalPriceNum ? 'text-red-600' : 'text-emerald-600'}`}>
                        ${paidAmountNum !== null && !Number.isNaN(paidAmountNum)
                          ? paidAmountNum.toFixed(2)
                          : '0.00'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={statusClasses}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-800 bg-white hover:bg-slate-50 disabled:opacity-60"
                          onClick={() => onViewDetails(group)}
                          disabled={reservationGroupsLoading}
                        >
                          <svg
                            viewBox="0 0 16 16"
                            className="h-3.5 w-3.5 text-slate-600"
                            aria-hidden="true"
                          >
                            <circle
                              cx="8"
                              cy="8"
                              r="7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <circle cx="8" cy="5" r="0.8" fill="currentColor" />
                            <path
                              d="M7.2 7.2h1.2v4H7.2z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                        {!isCancelled && (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full border border-emerald-300 px-2 py-0.5 text-[10px] font-medium text-emerald-800 bg-white hover:bg-emerald-50 disabled:opacity-60"
                            onClick={() => onAddPayment(group)}
                            disabled={reservationGroupsLoading}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              className="h-3.5 w-3.5 text-emerald-700"
                              aria-hidden="true"
                            >
                              <rect
                                x="2.5"
                                y="4.5"
                                width="11"
                                height="7"
                                rx="1.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.2"
                              />
                              <path
                                d="M4 7.5h3.5M4 9.5h2"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <circle cx="11.5" cy="8.5" r="0.9" fill="currentColor" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default ReservasSection;
