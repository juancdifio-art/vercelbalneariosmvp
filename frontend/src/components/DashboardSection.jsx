import React, { useMemo, useState, useEffect } from 'react';
import { isToday, parseISO, differenceInCalendarDays, isTomorrow } from 'date-fns';
import { format } from '../lib/dates';
import { getApiBaseUrl } from '../apiConfig';
import {
  ServiceIcon,
  COLOR_SERVICIO,
  ResumenIcon,
  ActivasHoyIcon,
  IngresosIcon,
  ClientesIcon,
  OcupacionIcon,
  EstadoServiciosIcon,
  UltimasReservasIcon,
  PagosIcon,
  CheckInsIcon,
  CerrarIcon
} from './icons';

const API_BASE_URL = getApiBaseUrl();

function DashboardSection({
  establishment,
  reservationGroups,
  onViewReservationDetails,
  onNavigateToReservationsWithFilter
}) {
  // Estado para filtrar las últimas reservas
  const [recentReservationsFilter, setRecentReservationsFilter] = useState(null);
  // Estado para filtrar próximos check-ins (carpas o sombrillas)
  const [checkInsFilter, setCheckInsFilter] = useState('carpa');
  // Estado para ingresos y pagos (cargados del backend)
  const [todayIncome, setTodayIncome] = useState(0);
  const [recentPayments, setRecentPayments] = useState([]);
  // Cargar ingresos del día y últimos pagos desde el backend
  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // Cargar ingresos del día
    async function fetchTodayIncome() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/reservation-groups/payments?from=${today}&to=${today}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          const total = (data.payments || []).reduce((sum, p) => sum + Number.parseFloat(p.amount || 0), 0);
          setTodayIncome(total);
        }
      } catch (err) {
        console.error('Error loading today income', err);
      }
    }

    // Cargar últimos 5 pagos
    async function fetchRecentPayments() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/reservation-groups/payments?limit=5`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          setRecentPayments(data.payments || []);
        }
      } catch (err) {
        console.error('Error loading recent payments', err);
      }
    }

    fetchTodayIncome();
    fetchRecentPayments();
  }, []);

  // Calcular métricas del día
  const todayMetrics = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Reservas activas hoy
    const activeToday = reservationGroups.filter(group => {
      if (!group || group.status === 'cancelled') return false;
      const start = group.startDate;
      const end = group.endDate;
      return start <= today && end >= today;
    });

    // Clientes únicos hoy
    const uniqueClients = new Set();
    activeToday.forEach(group => {
      if (group.customerName) {
        uniqueClients.add(group.customerName.toLowerCase());
      }
    });

    // Ocupación por servicio
    const carpasOccupied = activeToday.filter(g => g.serviceType === 'carpa').length;
    const sombrillasOccupied = activeToday.filter(g => g.serviceType === 'sombrilla').length;
    const parkingOccupied = activeToday.filter(g => g.serviceType === 'parking').length;

    const carpasTotal = parseInt(establishment?.carpasCapacity || 0);
    const sombrillasTotal = parseInt(establishment?.sombrillasCapacity || 0);
    const parkingTotal = parseInt(establishment?.parkingCapacity || 0);

    const carpasPercent = carpasTotal > 0 ? (carpasOccupied / carpasTotal) * 100 : 0;
    const sombrillasPercent = sombrillasTotal > 0 ? (sombrillasOccupied / sombrillasTotal) * 100 : 0;
    const parkingPercent = parkingTotal > 0 ? (parkingOccupied / parkingTotal) * 100 : 0;

    return {
      activeToday: activeToday.length,
      uniqueClients: uniqueClients.size,
      carpasOccupied,
      carpasTotal,
      carpasPercent,
      sombrillasOccupied,
      sombrillasTotal,
      sombrillasPercent,
      parkingOccupied,
      parkingTotal,
      parkingPercent
    };
  }, [reservationGroups, establishment]);

  // Últimas reservas (5 más recientes, filtradas por servicio si aplica)
  const recentReservations = useMemo(() => {
    return [...reservationGroups]
      .filter(g => {
        if (!g || g.status !== 'active') return false;
        // Aplicar filtro de servicio si está activo
        if (recentReservationsFilter && g.serviceType !== recentReservationsFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.startDate);
        const dateB = new Date(b.createdAt || b.startDate);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [reservationGroups, recentReservationsFilter]);

  // Próximos check-ins (reservas que empiezan en los próximos 7 días, solo carpas y sombrillas)
  const upcomingCheckIns = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const sevenDaysFromNow = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    
    return [...reservationGroups]
      .filter(g => {
        if (!g || g.status !== 'active') return false;
        // Excluir estacionamientos
        if (g.serviceType === 'parking') return false;
        // Aplicar filtro de carpas o sombrillas
        if (checkInsFilter && g.serviceType !== checkInsFilter) return false;
        // Reservas que empiezan entre hoy y 7 días desde ahora
        return g.startDate >= today && g.startDate <= sevenDaysFromNow;
      })
      .sort((a, b) => {
        // Ordenar por fecha de inicio (más cercano primero)
        return a.startDate.localeCompare(b.startDate);
      })
      .slice(0, 5);
  }, [reservationGroups, checkInsFilter]);

  // El tamano viene del que la llama porque el mismo icono aparece chico en el
  // chip del filtro y grande en las filas de los listados. El color, en cambio,
  // lo pone el servicio: en un listado mezclado es lo que deja distinguir una
  // reserva de carpa de una de pileta sin leer la etiqueta.
  const getServiceIcon = (type, className = 'h-5 w-5') => (
    <ServiceIcon serviceId={type} className={`${className} ${COLOR_SERVICIO[type] || 'text-slate-500'}`} />
  );

  const getServiceLabel = (type) => {
    switch (type) {
      case 'carpa': return 'Carpa';
      case 'sombrilla': return 'Sombrilla';
      case 'parking': return 'Estacionamiento';
      case 'pileta': return 'Pileta';
      default: return type;
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      case 'card': return 'Tarjeta';
      case 'other': return 'Otro';
      default: return method || 'Sin método';
    }
  };

  return (
    <div className="space-y-6">
      {/* Métricas del día */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <ResumenIcon className="h-5 w-5 text-cyan-600" />
          <span>Resumen de hoy</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Reservas activas */}
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <ActivasHoyIcon className="h-6 w-6 text-cyan-600" />
              <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">Activas hoy</span>
            </div>
            <p className="text-3xl font-bold text-cyan-900">{todayMetrics.activeToday}</p>
            <p className="text-xs text-cyan-700 mt-1">Reservas en curso</p>
          </div>

          {/* Ingresos del día */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <IngresosIcon className="h-6 w-6 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Ingresos</span>
            </div>
            <p className="text-3xl font-bold text-emerald-900">${todayIncome.toFixed(0)}</p>
            <p className="text-xs text-emerald-700 mt-1">Pagos de hoy</p>
          </div>

          {/* Clientes activos */}
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <ClientesIcon className="h-6 w-6 text-violet-600" />
              <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Clientes</span>
            </div>
            <p className="text-3xl font-bold text-violet-900">{todayMetrics.uniqueClients}</p>
            <p className="text-xs text-violet-700 mt-1">Clientes únicos</p>
          </div>

          {/* Ocupación promedio */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <OcupacionIcon className="h-6 w-6 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Ocupación</span>
            </div>
            <p className="text-3xl font-bold text-amber-900">
              {Math.round((todayMetrics.carpasPercent + todayMetrics.sombrillasPercent + todayMetrics.parkingPercent) / 3)}%
            </p>
            <p className="text-xs text-amber-700 mt-1">Promedio general</p>
          </div>
        </div>
      </div>

      {/* Estado de servicios */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <EstadoServiciosIcon className="h-5 w-5 text-cyan-600" />
          <span>Estado de servicios</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Carpas */}
          {establishment?.hasCarpas && (
            <button
              onClick={() => setRecentReservationsFilter(recentReservationsFilter === 'carpa' ? null : 'carpa')}
              className={`rounded-xl border p-4 hover:shadow-md transition-all text-left w-full ${
                recentReservationsFilter === 'carpa' 
                  ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' 
                  : 'bg-white border-slate-200 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ServiceIcon serviceId="carpas" className={`h-6 w-6 ${COLOR_SERVICIO.carpas}`} />
                  <span className="text-sm font-bold text-slate-800">Carpas</span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {todayMetrics.carpasOccupied}/{todayMetrics.carpasTotal}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all"
                  style={{ width: `${todayMetrics.carpasPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
                {Math.round(todayMetrics.carpasPercent)}% ocupadas
              </p>
            </button>
          )}

          {/* Sombrillas */}
          {establishment?.hasSombrillas && (
            <button
              onClick={() => setRecentReservationsFilter(recentReservationsFilter === 'sombrilla' ? null : 'sombrilla')}
              className={`rounded-xl border p-4 hover:shadow-md transition-all text-left w-full ${
                recentReservationsFilter === 'sombrilla' 
                  ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-200' 
                  : 'bg-white border-slate-200 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ServiceIcon serviceId="sombrillas" className={`h-6 w-6 ${COLOR_SERVICIO.sombrillas}`} />
                  <span className="text-sm font-bold text-slate-800">Sombrillas</span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {todayMetrics.sombrillasOccupied}/{todayMetrics.sombrillasTotal}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                  style={{ width: `${todayMetrics.sombrillasPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
                {Math.round(todayMetrics.sombrillasPercent)}% ocupadas
              </p>
            </button>
          )}

          {/* Estacionamiento */}
          {establishment?.hasParking && (
            <button
              onClick={() => setRecentReservationsFilter(recentReservationsFilter === 'parking' ? null : 'parking')}
              className={`rounded-xl border p-4 hover:shadow-md transition-all text-left w-full ${
                recentReservationsFilter === 'parking' 
                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' 
                  : 'bg-white border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ServiceIcon serviceId="parking" className={`h-6 w-6 ${COLOR_SERVICIO.parking}`} />
                  <span className="text-sm font-bold text-slate-800">Estacionamiento</span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {todayMetrics.parkingOccupied}/{todayMetrics.parkingTotal}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all"
                  style={{ width: `${todayMetrics.parkingPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
                {Math.round(todayMetrics.parkingPercent)}% ocupado
              </p>
            </button>
          )}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Últimas reservas */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UltimasReservasIcon className="h-5 w-5 text-cyan-600" />
              <span>Últimas reservas</span>
            </h2>
            {recentReservationsFilter && (
              <button
                onClick={() => setRecentReservationsFilter(null)}
                className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-1"
              >
                {getServiceIcon(recentReservationsFilter, 'h-3.5 w-3.5')}
                <span>{getServiceLabel(recentReservationsFilter)}</span>
                <CerrarIcon className="ml-1 h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {recentReservations.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                {recentReservationsFilter 
                  ? `No hay reservas de ${getServiceLabel(recentReservationsFilter).toLowerCase()}`
                  : 'No hay reservas recientes'
                }
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentReservations.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => onViewReservationDetails(group)}
                    className="w-full p-4 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getServiceIcon(group.serviceType, 'h-6 w-6 shrink-0')}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {getServiceLabel(group.serviceType)} {group.resourceNumber}
                          </p>
                          <p className="text-xs text-slate-600 truncate">
                            {group.customerName || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {group.startDate} → {group.endDate}
                          </p>
                        </div>
                      </div>
                      {group.totalPrice && (
                        <span className="text-sm font-bold text-emerald-700">
                          ${parseFloat(group.totalPrice).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Últimos pagos */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PagosIcon className="h-5 w-5 text-emerald-600" />
            <span>Últimos pagos</span>
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {recentPayments.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No hay pagos recientes
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPayments.map((payment, idx) => (
                  <button
                    key={`${payment.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      const group = reservationGroups.find((g) => g && g.id === payment.groupId);
                      if (group) {
                        onViewReservationDetails(group);
                      }
                    }}
                    className="w-full text-left p-4 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getServiceIcon(payment.serviceType, 'h-6 w-6 shrink-0')}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {getServiceLabel(payment.serviceType)} {payment.resourceNumber}
                          </p>
                          <p className="text-xs text-slate-600 truncate">
                            {payment.customerName || 'Sin nombre'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">
                              {payment.paymentDate
                                ? format(parseISO(payment.paymentDate), 'dd/MM/yyyy')
                                : 'N/A'}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">
                              {getPaymentMethodLabel(payment.method)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-700">
                        ${parseFloat(payment.amount).toFixed(0)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Próximos check-ins */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CheckInsIcon className="h-5 w-5 text-cyan-600" />
            <span>Próximos check-ins</span>
            <span className="text-xs font-normal text-slate-500">(próximos 7 días)</span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCheckInsFilter('carpa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                checkInsFilter === 'carpa'
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ServiceIcon serviceId="carpas" className="h-4 w-4" />
              <span>Carpas</span>
            </button>
            <button
              onClick={() => setCheckInsFilter('sombrilla')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                checkInsFilter === 'sombrilla'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ServiceIcon serviceId="sombrillas" className="h-4 w-4" />
              <span>Sombrillas</span>
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {upcomingCheckIns.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No hay check-ins de {checkInsFilter === 'carpa' ? 'carpas' : 'sombrillas'} programados para los próximos 7 días
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingCheckIns.map((group) => {
                // Usar date-fns para comparaciones precisas de fechas
                const startDate = parseISO(group.startDate);
                const isTodayCheckIn = isToday(startDate);
                const isTomorrowCheckIn = isTomorrow(startDate);

                // Calcular días hasta el check-in usando differenceInCalendarDays
                const daysUntilCheckIn = differenceInCalendarDays(startDate, new Date());

                let dateLabel = group.startDate;
                if (isTodayCheckIn) dateLabel = '¡Hoy!';
                else if (isTomorrowCheckIn) dateLabel = 'Mañana';
                else if (daysUntilCheckIn > 0) dateLabel = `En ${daysUntilCheckIn} días`;
                else dateLabel = group.startDate;

                return (
                  <button
                    key={group.id}
                    onClick={() => onViewReservationDetails(group)}
                    className="w-full p-4 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getServiceIcon(group.serviceType, 'h-6 w-6 shrink-0')}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {getServiceLabel(group.serviceType)} {group.resourceNumber}
                          </p>
                          <p className="text-xs text-slate-600 truncate">
                            {group.customerName || 'Sin nombre'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-semibold ${
                              isTodayCheckIn ? 'text-red-600' : isTomorrowCheckIn ? 'text-orange-600' : 'text-slate-500'
                            }`}>
                              {dateLabel}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">
                              {group.startDate} → {group.endDate}
                            </span>
                          </div>
                        </div>
                      </div>
                      {group.totalPrice && (
                        <span className="text-sm font-bold text-slate-700">
                          ${parseFloat(group.totalPrice).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardSection;
