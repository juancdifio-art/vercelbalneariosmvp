import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

function ReportsPaymentsSection({ authToken }) {
  const [activeTab, setActiveTab] = useState('payments'); // 'payments' | 'occupancy'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [service, setService] = useState('');
  const [method, setMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [occupancyLoading, setOccupancyLoading] = useState(false);
  const [occupancyError, setOccupancyError] = useState('');
  const [occupancyData, setOccupancyData] = useState(null);

  useEffect(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    setFrom(todayStr);
    setTo(todayStr);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    if (!from || !to) return;

    let cancelled = false;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams();
        params.set('from', from);
        params.set('to', to);
        if (service) params.set('service', service);
        if (method) params.set('method', method);

        const response = await fetch(
          `${API_BASE_URL}/api/reports/payments?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        );

        if (!response.ok) {
          if (!cancelled) {
            setError('No se pudo cargar el reporte de pagos.');
            setReportData(null);
          }
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setReportData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Error al cargar el reporte de pagos.');
          setReportData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReport();

    return () => {
      cancelled = true;
    };
  }, [authToken, from, to, service, method]);

  useEffect(() => {
    if (!authToken) return;
    if (!from || !to) return;
    if (activeTab !== 'occupancy') return;

    let cancelled = false;

    const fetchOccupancy = async () => {
      try {
        setOccupancyLoading(true);
        setOccupancyError('');

        const params = new URLSearchParams();
        params.set('from', from);
        params.set('to', to);
        if (service) params.set('service', service);

        const response = await fetch(
          `${API_BASE_URL}/api/reports/occupancy?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        );

        if (!response.ok) {
          if (!cancelled) {
            setOccupancyError('No se pudieron cargar las estadísticas de ocupación.');
            setOccupancyData(null);
          }
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setOccupancyData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setOccupancyError('Error al cargar las estadísticas de ocupación.');
          setOccupancyData(null);
        }
      } finally {
        if (!cancelled) {
          setOccupancyLoading(false);
        }
      }
    };

    fetchOccupancy();

    return () => {
      cancelled = true;
    };
  }, [authToken, from, to, service, activeTab]);

  const totalsSummary = useMemo(() => {
    if (!reportData) {
      return {
        totalAmount: 0,
        daysWithPayments: 0,
        paymentsCount: 0
      };
    }

    const totalAmount = Number(reportData.totalAmount || 0);
    const daysWithPayments = Array.isArray(reportData.totalsByDate)
      ? reportData.totalsByDate.length
      : 0;
    const paymentsCount = Array.isArray(reportData.payments)
      ? reportData.payments.length
      : 0;

    return { totalAmount, daysWithPayments, paymentsCount };
  }, [reportData]);

  const occupancyRows = useMemo(() => {
    if (!occupancyData || !Array.isArray(occupancyData.byDate)) {
      return [];
    }

    const rows = [];
    occupancyData.byDate.forEach((day) => {
      if (!Array.isArray(day.services)) return;
      day.services.forEach((svc) => {
        rows.push({
          date: day.date,
          serviceType: svc.serviceType,
          occupiedUnits: svc.occupiedUnits,
          capacity: svc.capacity,
          occupancyPercent: svc.occupancyPercent
        });
      });
    });

    return rows;
  }, [occupancyData]);

  const occupancySummaryServices = useMemo(() => {
    if (!occupancyData || !occupancyData.summary || !Array.isArray(occupancyData.summary.services)) {
      return [];
    }
    return occupancyData.summary.services;
  }, [occupancyData]);

  const getServiceLabel = (serviceType) => {
    if (serviceType === 'carpa') return 'Carpas';
    if (serviceType === 'sombrilla') return 'Sombrillas';
    if (serviceType === 'parking') return 'Estacionamiento';
    if (serviceType === 'pileta') return 'Pileta';
    return serviceType || 'Servicio';
  };

  const handleExportExcel = () => {
    if (!reportData || !Array.isArray(reportData.payments) || reportData.payments.length === 0) {
      return;
    }

    const headers = ['Fecha pago', 'Importe', 'Método', 'Servicio', 'Recurso', 'Cliente', 'Notas'];

    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const rows = reportData.payments.map((payment) => {
      const customerName = payment.customerName || payment.clientFullName || '';

      return [
        payment.paymentDate || '',
        Number(payment.amount || 0).toFixed(0),
        payment.method || '',
        payment.serviceType || '',
        payment.resourceNumber || '',
        customerName,
        payment.notes || ''
      ]
        .map(escapeCell)
        .join(';');
    });

    const csvLines = [headers.map(escapeCell).join(';'), ...rows];

    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const safeFrom = from || '';
    const safeTo = to || '';
    link.href = url;
    link.download = `reporte_pagos_${safeFrom}_a_${safeTo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFromChange = (value) => {
    setFrom(value);
    if (to && value && value > to) {
      setTo(value);
    }
  };

  if (!authToken) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-4 text-sm text-slate-700">
        Necesitas iniciar sesión para ver los reportes.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-sky-50 border border-cyan-100 px-4 py-3 text-sm">
        <p className="text-[11px] text-slate-700">
          Reportes de pagos recibidos y estadísticas de ocupación por día. Podés elegir un rango de fechas y filtrar por servicio.
        </p>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="mb-3 flex gap-1 text-[11px] border-b border-slate-200 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`inline-flex items-center rounded-full px-3 py-0.5 border text-[10px] font-semibold transition ${
              activeTab === 'payments'
                ? 'bg-cyan-600 border-cyan-700 text-white'
                : 'bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-50'
            }`}
          >
            Pagos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('occupancy')}
            className={`inline-flex items-center rounded-full px-3 py-0.5 border text-[10px] font-semibold transition ${
              activeTab === 'occupancy'
                ? 'bg-cyan-600 border-cyan-700 text-white'
                : 'bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-50'
            }`}
          >
            Ocupación
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 text-[11px]">
          <div>
            <div className="mb-0.5 text-slate-700">Desde</div>
            <input
              type="date"
              value={from}
              onChange={(e) => handleFromChange(e.target.value)}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
            />
          </div>
          <div>
            <div className="mb-0.5 text-slate-700">Hasta</div>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
            />
          </div>
          <div>
            <div className="mb-0.5 text-slate-700">Servicio</div>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
            >
              <option value="">Todos</option>
              <option value="carpa">Carpas</option>
              <option value="sombrilla">Sombrillas</option>
              <option value="parking">Estacionamiento</option>
              <option value="pileta">Pileta</option>
            </select>
          </div>
          {activeTab === 'payments' && (
            <div>
              <div className="mb-0.5 text-slate-700">Método de pago</div>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] text-slate-900"
              >
                <option value="">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>
          )}
          <div className="ml-auto">
            {activeTab === 'payments' && (
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!reportData || !Array.isArray(reportData.payments) || reportData.payments.length === 0 || loading}
                className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Exportar a Excel
              </button>
            )}
          </div>
        </div>

        {activeTab === 'payments' && (
          <div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-[11px]">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <div className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">
                  Total cobrado
                </div>
                <div className="mt-1 text-lg font-bold text-emerald-900">
                  ${totalsSummary.totalAmount.toFixed(0)}
                </div>
              </div>
              <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
                <div className="text-[10px] font-semibold text-sky-800 uppercase tracking-wide">
                  Días con pagos
                </div>
                <div className="mt-1 text-lg font-bold text-sky-900">
                  {totalsSummary.daysWithPayments}
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                  Cantidad de pagos
                </div>
                <div className="mt-1 text-lg font-bold text-amber-900">
                  {totalsSummary.paymentsCount}
                </div>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-xs text-slate-500">
                Cargando reporte de pagos...
              </div>
            )}

            {error && (
              <div className="mt-4 text-xs text-red-600">
                {error}
              </div>
            )}

            {!loading && !error && reportData && Array.isArray(reportData.totalsByDate) && reportData.totalsByDate.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] font-semibold text-slate-900 mb-2">
                  Totales por día
                </div>
                <div className="overflow-x-auto -mx-2">
                  <table className="min-w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200">
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wide">
                          Fecha
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wide">
                          Importe total
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wide">
                          Cantidad de pagos
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.totalsByDate.map((item) => (
                        <tr key={item.date} className="border-b border-slate-100">
                          <td className="px-3 py-2 align-top text-slate-800">
                            {item.date}
                          </td>
                          <td className="px-3 py-2 align-top text-emerald-700 font-semibold">
                            ${Number(item.totalAmount || 0).toFixed(0)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">
                            {item.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!loading && !error && reportData && Array.isArray(reportData.payments) && reportData.payments.length > 0 && (
              <div className="mt-6">
                <div className="text-[11px] font-semibold text-slate-900 mb-2">
                  Pagos detallados
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {reportData.payments.map((payment) => (
                    <div key={payment.id} className="px-3 py-2 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900">
                          {payment.paymentDate} · ${Number(payment.amount || 0).toFixed(0)}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">
                          {(payment.customerName || payment.clientFullName || 'Sin nombre')} · {payment.serviceType} {payment.resourceNumber}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {payment.method || 'Sin método'}
                          {payment.notes ? ` · ${payment.notes}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && reportData && Array.isArray(reportData.payments) && reportData.payments.length === 0 && (
              <div className="mt-4 text-xs text-slate-500">
                No hay pagos en el rango seleccionado.
              </div>
            )}
          </div>
        )}

        {activeTab === 'occupancy' && (
          <div>
            {occupancyLoading && (
              <div className="mt-4 text-xs text-slate-500">
                Cargando estadísticas de ocupación...
              </div>
            )}

            {occupancyError && (
              <div className="mt-4 text-xs text-red-600">
                {occupancyError}
              </div>
            )}

            {!occupancyLoading && !occupancyError && occupancyData && (
              <div>
                {occupancySummaryServices.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-[11px]">
                    {occupancySummaryServices.map((svc) => (
                      <div
                        key={svc.serviceType}
                        className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2"
                      >
                        <div className="text-[10px] font-semibold text-sky-800 uppercase tracking-wide mb-1">
                          {getServiceLabel(svc.serviceType)}
                        </div>
                        <div className="text-[11px] text-slate-800">
                          <span className="font-semibold">Ocupación promedio:</span>{' '}
                          {Math.round((svc.avgOccupancyPercent || 0) * 100)}%
                        </div>
                        <div className="text-[11px] text-slate-800">
                          <span className="font-semibold">Pico de ocupación:</span>{' '}
                          {Math.round((svc.maxOccupancyPercent || 0) * 100)}%
                          {svc.maxOccupancyDate ? ` (${svc.maxOccupancyDate})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {occupancyRows.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[11px] font-semibold text-slate-900 mb-2">
                      Ocupación diaria
                    </div>
                    <div className="overflow-x-auto -mx-2">
                      <table className="min-w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-y border-slate-200">
                            <th className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wide">
                              Fecha
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wide">
                              Servicio
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wide">
                              Ocupadas / Capacidad
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wide">
                              % Ocupación
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {occupancyRows.map((row) => (
                            <tr key={`${row.date}-${row.serviceType}`} className="border-b border-slate-100">
                              <td className="px-3 py-2 align-top text-slate-800">
                                {row.date}
                              </td>
                              <td className="px-3 py-2 align-top text-slate-800">
                                {getServiceLabel(row.serviceType)}
                              </td>
                              <td className="px-3 py-2 align-top text-slate-800">
                                {row.occupiedUnits}/{row.capacity}
                              </td>
                              <td className="px-3 py-2 align-top text-slate-800">
                                {Math.round((row.occupancyPercent || 0) * 100)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {occupancyRows.length === 0 && (
                  <div className="mt-4 text-xs text-slate-500">
                    No hay ocupación registrada en el rango seleccionado.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPaymentsSection;
