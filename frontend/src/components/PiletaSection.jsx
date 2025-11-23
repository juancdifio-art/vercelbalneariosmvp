import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';

function PiletaSection({
  establishment,
  reservationGroups,
  reservationGroupsLoading,
  onViewReservationDetails,
  onOpenNewPoolPass
}) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'cancelled'
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'current', 'past', 'future'

  const poolGroups = useMemo(
    () => (Array.isArray(reservationGroups)
      ? reservationGroups.filter((g) => g.serviceType === 'pileta')
      : []),
    [reservationGroups]
  );

  const stats = useMemo(() => {
    const capRaw = establishment?.poolMaxOccupancy ?? null;
    const cap = capRaw !== null && capRaw !== undefined && capRaw !== ''
      ? Number.parseInt(String(capRaw), 10)
      : null;

    let activeToday = 0;

    poolGroups.forEach((g) => {
      if (!g || g.status !== 'active') return;
      const start = typeof g.startDate === 'string' ? g.startDate : g.startDate?.toString?.() ?? '';
      const end = typeof g.endDate === 'string' ? g.endDate : g.endDate?.toString?.() ?? '';
      if (!start || !end) return;
      if (start <= todayStr && end >= todayStr) {
        const adults = Number.parseInt(String(g.poolAdultsCount ?? '0'), 10) || 0;
        const children = Number.parseInt(String(g.poolChildrenCount ?? '0'), 10) || 0;
        activeToday += adults + children;
      }
    });

    const percentage = cap && cap > 0 ? Math.min((activeToday / cap) * 100, 999) : null;

    return {
      capacity: cap,
      activeToday,
      percentage
    };
  }, [poolGroups, establishment, todayStr]);

  const filteredAndSortedGroups = useMemo(() => {
    let filtered = [...poolGroups];

    // Filtro por búsqueda de texto
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((g) => {
        const name = (g.customerName || '').toLowerCase();
        const phone = (g.customerPhone || '').toLowerCase();
        return name.includes(search) || phone.includes(search);
      });
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter((g) => {
        if (statusFilter === 'active') return g.status === 'active';
        if (statusFilter === 'cancelled') return g.status === 'cancelled';
        return true;
      });
    }

    // Filtro por fecha
    if (dateFilter !== 'all') {
      filtered = filtered.filter((g) => {
        const start = g.startDate || '';
        const end = g.endDate || '';

        if (dateFilter === 'current') {
          // Pases activos hoy
          return start <= todayStr && end >= todayStr;
        }
        if (dateFilter === 'past') {
          // Pases finalizados
          return end < todayStr;
        }
        if (dateFilter === 'future') {
          // Pases que aún no comenzaron
          return start > todayStr;
        }
        return true;
      });
    }

    // Ordenar
    return filtered.sort((a, b) => {
      const aStart = a.startDate || '';
      const bStart = b.startDate || '';
      if (aStart < bStart) return -1;
      if (aStart > bStart) return 1;
      return (a.customerName || '').localeCompare(b.customerName || '');
    });
  }, [poolGroups, searchTerm, statusFilter, dateFilter, todayStr]);

  const formatShortDate = (value) => {
    if (!value || typeof value !== 'string') return value || '';
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    const [year, month, day] = parts;
    const shortYear = year.slice(-2);
    return `${day}/${month}/${shortYear}`;
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600 px-6 py-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-lg">
              🏊
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                Gestión de Pileta
              </h2>
              <p className="text-sm text-blue-50">
                Administrá los pases y ocupación de la pileta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNewPoolPass}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-blue-600 shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all transform hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Pase
          </button>
        </div>
      </div>

      {/* Resumen de ocupación */}
      <div className="px-6 py-5 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tarjeta de Ocupación Actual */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ocupación Actual</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.activeToday}
                  {stats.capacity && <span className="text-base font-medium text-slate-400"> / {stats.capacity}</span>}
                </p>
                <p className="text-xs text-slate-500 mt-1">personas con pase hoy</p>
              </div>
            </div>
          </div>

          {/* Tarjeta de Porcentaje */}
          {stats.capacity && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm ${
                      stats.percentage >= 80 ? 'bg-gradient-to-br from-red-400 to-red-600' :
                      stats.percentage >= 60 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                      'bg-gradient-to-br from-emerald-400 to-green-500'
                    }`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Capacidad</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.percentage !== null ? `${stats.percentage.toFixed(0)}%` : '—'}
                  </p>
                  <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.percentage >= 80 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                        stats.percentage >= 60 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                        'bg-gradient-to-r from-emerald-400 to-green-500'
                      }`}
                      style={{ width: `${Math.min(stats.percentage || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tarjeta de Fecha */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fecha de Referencia</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {format(today, 'dd/MM')}
                </p>
                <p className="text-xs text-slate-500 mt-1">{format(today, 'yyyy')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      {!reservationGroupsLoading && poolGroups.length > 0 && (
        <div className="px-6 py-4 border-b border-slate-200 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Búsqueda por nombre o teléfono */}
            <div className="md:col-span-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por cliente o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por estado */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>

            {/* Filtro por fecha */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="all">Todos los períodos</option>
                <option value="current">Activos hoy</option>
                <option value="future">Próximos</option>
                <option value="past">Finalizados</option>
              </select>
            </div>
          </div>

          {/* Indicador de resultados */}
          {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all') && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-600">
                Mostrando <span className="font-semibold text-cyan-600">{filteredAndSortedGroups.length}</span> de {poolGroups.length} pases
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setDateFilter('all');
                }}
                className="text-xs text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contenido */}
      <div className="px-6 py-5">
        {reservationGroupsLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-cyan-200 border-t-cyan-600 mb-3" />
              <p className="text-sm font-medium text-slate-600">Cargando pases de pileta...</p>
            </div>
          </div>
        )}

        {!reservationGroupsLoading && poolGroups.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center">
              <span className="text-4xl">🏊</span>
            </div>
            <p className="text-base text-slate-700 font-semibold mb-2">No hay pases de pileta registrados</p>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Comenzá a gestionar la ocupación de tu pileta creando el primer pase
            </p>
            <button
              type="button"
              onClick={onOpenNewPoolPass}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-cyan-600 hover:to-blue-600 transition-all transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Primer Pase
            </button>
          </div>
        )}

        {!reservationGroupsLoading && filteredAndSortedGroups.length === 0 && poolGroups.length > 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-600 font-medium mb-1">No se encontraron resultados</p>
            <p className="text-xs text-slate-500 mb-4">
              Intentá ajustar los filtros para encontrar lo que buscás
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setDateFilter('all');
              }}
              className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {!reservationGroupsLoading && filteredAndSortedGroups.length > 0 && (
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto -mx-6">
            <table className="min-w-full">
              <thead>
                <tr className="border-y border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30">
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50/30">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Cliente
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50/30">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Período
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50/30">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Adultos
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50/30">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Niños
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50/30">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pagos
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50/30">Estado</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50/30">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedGroups.map((group) => {
                  const isCancelled = group.status === 'cancelled';

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

                  let paidClassName = 'text-xs font-semibold ';

                  if (
                    totalPriceNum !== null &&
                    !Number.isNaN(totalPriceNum) &&
                    paidAmountNum !== null &&
                    !Number.isNaN(paidAmountNum)
                  ) {
                    if (paidAmountNum + 1e-6 < totalPriceNum) {
                      paidClassName += 'text-red-600';
                    } else {
                      paidClassName += 'text-emerald-600';
                    }
                  } else {
                    paidClassName += 'text-slate-500';
                  }

                  const adults = Number.parseInt(String(group.poolAdultsCount ?? '0'), 10) || 0;
                  const children = Number.parseInt(String(group.poolChildrenCount ?? '0'), 10) || 0;

                  const startStr = group.startDate || '';
                  const endStr = group.endDate || '';

                  let statusLabel = '';
                  let statusClassesBase = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border ';

                  if (isCancelled) {
                    statusLabel = 'Cancelado';
                    statusClassesBase += 'bg-slate-50 text-slate-700 border-slate-200';
                  } else if (startStr && startStr > todayStr) {
                    statusLabel = 'Próximo';
                    statusClassesBase += 'bg-sky-50 text-sky-700 border-sky-200';
                  } else if (endStr && endStr < todayStr) {
                    statusLabel = 'Finalizado';
                    statusClassesBase += 'bg-orange-50 text-orange-700 border-orange-200';
                  } else {
                    statusLabel = 'Activo';
                    statusClassesBase += 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  }

                  const statusDotClass = isCancelled
                    ? 'bg-slate-500'
                    : startStr && startStr > todayStr
                      ? 'bg-sky-500'
                      : endStr && endStr < todayStr
                        ? 'bg-orange-500'
                        : 'bg-emerald-500';

                  return (
                    <tr
                      key={group.id}
                      className={`border-b border-slate-100 hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-transparent transition-all ${isCancelled ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-slate-900 mb-0.5" title={group.customerName || ''}>
                            {group.customerName || <span className="font-normal text-slate-400 italic">Sin nombre</span>}
                          </span>
                          {group.customerPhone && (
                            <span className="text-xs text-slate-500">{group.customerPhone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                          <span className="text-sm font-medium text-slate-700">{formatShortDate(group.startDate)}</span>
                          <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-medium text-slate-700">{formatShortDate(group.endDate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-lg font-bold text-blue-600">{adults}</span>
                          <span className="text-xs text-slate-500">adultos</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-lg font-bold text-purple-600">{children}</span>
                          <span className="text-xs text-slate-500">niños</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-slate-500">Pagado:</span>
                            <span className={paidClassName.replace('text-xs', 'text-sm')}>
                              {paidAmountNum !== null && !Number.isNaN(paidAmountNum)
                                ? `$${paidAmountNum.toFixed(2)}`
                                : '$0.00'}
                            </span>
                          </div>
                          {totalPriceNum !== null && !Number.isNaN(totalPriceNum) && (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs text-slate-500">Total:</span>
                              <span className="text-sm font-medium text-slate-700">${totalPriceNum.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={statusClassesBase}
                        >
                          <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:from-cyan-600 hover:to-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                          onClick={() => onViewReservationDetails(group)}
                          disabled={reservationGroupsLoading}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver Detalle
                        </button>
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
  );
}

export default PiletaSection;
