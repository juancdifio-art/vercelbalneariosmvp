import React, { useEffect, useState } from 'react';
import { format } from '../lib/dates';
import { generateReceipt } from '../utils/generateReceipt';
import { getApiBaseUrl } from '../apiConfig';
import { formatPesos } from '../lib/money';
import { otrasReservasVigentes, saldoDe } from '../lib/reservas';
import { ServiceIcon, COLOR_SERVICIO } from './icons';

const API_BASE_URL = getApiBaseUrl();

const ETIQUETA_SERVICIO = {
  carpa: 'Carpa',
  sombrilla: 'Sombrilla',
  parking: 'Estacionamiento',
  pileta: 'Pileta'
};

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ReservationDetailsModal({
  reservation,
  establishment,
  parseLocalDateFromInput,
  onClose,
  onEdit,
  onCancel,
  onAddPayment,
  onViewReservation,
  onViewClient
}) {
  if (!reservation) return null;

  const {
    id,
    serviceType,
    resourceNumber,
    startDate,
    endDate,
    customerName,
    customerPhone,
    dailyPrice,
    totalPrice,
    paidAmount,
    notes,
    status,
    linkedParkingResourceNumber,
    poolAdultsCount,
    poolChildrenCount,
    adultsCount,
    childrenCount
  } = reservation;

  // Estado para cargar pagos lazy (solo cuando se abre el modal)
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Cargar pagos cuando se abre el modal
  useEffect(() => {
    if (!id) return;

    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    async function fetchPayments() {
      setPaymentsLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/reservation-groups/${id}/payments`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          setPayments(data.payments || []);
        }
      } catch (err) {
        console.error('Error loading payments', err);
      } finally {
        setPaymentsLoading(false);
      }
    }

    fetchPayments();
  }, [id]);

  // Reservas del mismo cliente. Se piden aca y no se toman de la lista que ya
  // tiene la app, porque esa lista depende de la seccion: abierta desde Carpas
  // trae solo carpas, y el estacionamiento del mismo cliente no aparecia.
  const clienteId = reservation.clientId;
  const [reservasCliente, setReservasCliente] = useState([]);

  useEffect(() => {
    setReservasCliente([]);
    if (clienteId === null || clienteId === undefined || clienteId === '') return;

    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    let cancelado = false;
    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/reservation-groups?clientId=${encodeURIComponent(clienteId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelado) setReservasCliente(data.reservationGroups || []);
      } catch (err) {
        // Sin esta lista solo se pierde la seccion de otras reservas.
        console.error('Error loading client reservations', err);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [id, clienteId]);

  const getDaysCount = () => {
    const start = parseLocalDateFromInput(startDate);
    const end = parseLocalDateFromInput(endDate);
    if (!start || !end) return null;
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / msPerDay) + 1;
  };

  const daysCount = getDaysCount();

  const balance =
    totalPrice !== null && totalPrice !== undefined && paidAmount !== null && paidAmount !== undefined
      ? Number(totalPrice) - Number(paidAmount)
      : null;

  const saldoClassName = (() => {
    if (balance === null) return 'font-semibold text-emerald-600';
    return balance > 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600';
  })();

  const serviceLabel =
    serviceType === 'carpa'
      ? 'Carpa'
      : serviceType === 'sombrilla'
        ? 'Sombrilla'
        : serviceType === 'parking'
          ? 'Estacionamiento'
          : serviceType;

  const serviceIcon =
    serviceType === 'carpa'
      ? '🏖️'
      : serviceType === 'sombrilla'
        ? '☂️'
        : serviceType === 'parking'
          ? '🚗'
          : '📌';

  const balancePercentage =
    totalPrice !== null &&
    totalPrice !== undefined &&
    paidAmount !== null &&
    paidAmount !== undefined &&
    Number(totalPrice) > 0
      ? (Number(paidAmount) / Number(totalPrice)) * 100
      : 0;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{serviceIcon}</div>
              <div>
                <p className="text-xs font-medium opacity-90">Detalle de reserva</p>
                <p className="text-lg font-bold">
                  {serviceLabel} {resourceNumber}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span
                className={
                  'inline-flex rounded-full px-3 py-1 text-xs font-semibold ' +
                  (status === 'cancelled'
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-emerald-400 text-emerald-900')
                }
              >
                {status === 'cancelled' ? '❌ Cancelada' : '✅ Activa'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">

          {/* Grid layout: Info + Financials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Left: Reservation Info */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">📋 Información</h3>
              <div className="flex items-start gap-2">
                <span className="text-base">📅</span>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-medium">Entrada</p>
                  <p className="text-xs font-semibold text-slate-900">{format(startDate, 'dd/MM/yyyy')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">📅</span>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-medium">Salida</p>
                  <p className="text-xs font-semibold text-slate-900">{format(endDate, 'dd/MM/yyyy')}</p>
                </div>
              </div>
              {daysCount !== null && (
                <div className="flex items-start gap-2">
                  <span className="text-base">⏱️</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-medium">Duración</p>
                    <p className="text-xs font-semibold text-slate-900">
                      {daysCount} {daysCount === 1 ? 'día' : 'días'}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-base">👤</span>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-medium">Cliente</p>
                  <p className="text-xs font-semibold text-slate-900 truncate" title={customerName || ''}>
                    {customerName || '—'}
                  </p>
                  {reservation.clientId && onViewClient && (
                    <button
                      type="button"
                      onClick={() => onViewClient(reservation.clientId)}
                      className="mt-0.5 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
                    >
                      Ver ficha del cliente →
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">📞</span>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-medium">Teléfono</p>
                  <p className="text-xs font-semibold text-slate-900 truncate" title={customerPhone || ''}>
                    {customerPhone || '—'}
                  </p>
                </div>
              </div>
              {serviceType === 'pileta' && (
                <div className="flex items-start gap-2">
                  <span className="text-base">👨‍👩‍👧‍👦</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-medium">Composición pileta</p>
                    <p className="text-xs font-semibold text-slate-900">
                      Adultos: {Number(poolAdultsCount ?? adultsCount ?? 0)} · Niños: {Number(poolChildrenCount ?? childrenCount ?? 0)}
                    </p>
                  </div>
                </div>
              )}
              {serviceType !== 'parking' && linkedParkingResourceNumber && (
                <div className="flex items-start gap-2">
                  <span className="text-base">🚗</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-medium">Estacionamiento</p>
                    <p className="text-xs font-semibold text-slate-900">Plaza {linkedParkingResourceNumber}</p>
                  </div>
                </div>
              )}
              {notes && (
                <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                  <span className="text-base">📝</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-medium">Notas</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Financial Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">💰 Resumen financiero</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-600">Precio por día</span>
                  <span className="text-sm font-bold text-slate-900">
                    {dailyPrice !== null && dailyPrice !== undefined ? formatPesos(dailyPrice, 0) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-600">Total estadía</span>
                  <span className="text-sm font-bold text-cyan-600">
                    {totalPrice !== null && totalPrice !== undefined ? formatPesos(totalPrice, 0) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-600">Pagos realizados</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {paidAmount !== null && paidAmount !== undefined ? formatPesos(paidAmount, 0) : '—'}
                  </span>
                </div>
                <div className="h-px bg-slate-200 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-700">Saldo pendiente</span>
                  <span className={`text-lg font-bold ${balance !== null && balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {balance !== null ? formatPesos(balance, 0) : '—'}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              {totalPrice !== null && totalPrice !== undefined && Number(totalPrice) > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                    <span>Progreso de pago</span>
                    <span className="font-semibold">{balancePercentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
                      style={{ width: `${Math.min(balancePercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Otras reservas del mismo cliente: una familia suele alquilar carpa y
              estacionamiento juntos, y desde una hay que poder ver las demas. */}
          {(() => {
            // otrasReservasVigentes vuelve a filtrar por clientId: si algun backend
            // ignorara el parametro, igual no se mezclan clientes.
            const otras = otrasReservasVigentes(reservasCliente, reservation, hoyISO());
            if (otras.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">
                  Otras reservas activas de {customerName || 'este cliente'}
                </h3>
                <div className="space-y-1.5">
                  {otras.map((g) => {
                    const saldo = saldoDe(g);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => onViewReservation && onViewReservation(g)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-cyan-300 hover:bg-cyan-50/60 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ServiceIcon
                            serviceId={g.serviceType}
                            className={`h-5 w-5 shrink-0 ${COLOR_SERVICIO[g.serviceType] || 'text-slate-500'}`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900">
                              {ETIQUETA_SERVICIO[g.serviceType] || g.serviceType}
                              {g.serviceType !== 'pileta' && g.resourceNumber ? ` ${g.resourceNumber}` : ''}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {format(g.startDate, 'dd/MM/yyyy')} - {format(g.endDate, 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-semibold whitespace-nowrap ${saldo > 0 ? 'text-rose-700' : 'text-emerald-700'}`}
                        >
                          {saldo > 0 ? `Debe ${formatPesos(saldo, 0)}` : 'Pagada'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Payments section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">💳 Historial de pagos</h3>
              {status !== 'cancelled' && (
                <button
                  type="button"
                  className="inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-emerald-700 transition-all"
                  onClick={() => onAddPayment(reservation)}
                >
                  <span className="mr-1">+</span>
                  Agendar pago
                </button>
              )}
            </div>

            {paymentsLoading && (
              <p className="text-xs text-slate-500 text-center py-4">⏳ Cargando pagos...</p>
            )}

            {!paymentsLoading && (!payments || payments.length === 0) && (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">💸</p>
                <p className="text-xs text-slate-500">
                  Todavía no hay pagos registrados para esta reserva.
                </p>
              </div>
            )}

            {!paymentsLoading && payments && payments.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {payments.map((p) => {
                  const rawMethod = p.method || p.paymentMethod || '';
                  let methodLabel = '';
                  let methodIcon = '💵';
                  if (rawMethod === 'cash') {
                    methodLabel = 'Efectivo';
                    methodIcon = '💵';
                  } else if (rawMethod === 'transfer') {
                    methodLabel = 'Transferencia';
                    methodIcon = '🏦';
                  } else if (rawMethod === 'card') {
                    methodLabel = 'Tarjeta';
                    methodIcon = '💳';
                  } else if (rawMethod === 'other') {
                    methodLabel = 'Otro';
                    methodIcon = '💰';
                  }

                  // La API manda '2026-09-22'. Con new Date() eso es medianoche
                  // UTC, que en Argentina cae el dia anterior: todos los pagos se
                  // veian un dia antes. format() de lib/dates lo toma en hora local.
                  const paymentDateLabel = p.paymentDate
                    ? format(String(p.paymentDate).slice(0, 10), 'dd/MM/yyyy')
                    : '';

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 hover:border-cyan-200 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{methodIcon}</span>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-900">
                            {formatPesos(p.amount, 0)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {paymentDateLabel}
                          </p>
                        </div>
                      </div>
                      {methodLabel && (
                        <span className="text-[10px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                          {methodLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="flex gap-2 flex-wrap">
              {status !== 'cancelled' && (
                <>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-cyan-300 px-4 py-2 text-xs font-semibold text-cyan-700 bg-white hover:bg-cyan-50 transition shadow-sm"
                    onClick={() => onEdit(reservation)}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 transition shadow-sm"
                    onClick={() => onCancel(reservation)}
                  >
                    ❌ Cancelar reserva
                  </button>
                </>
              )}
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-blue-300 px-4 py-2 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 transition shadow-sm"
                // La reserva de la lista no trae el array de pagos: sin esto el
                // comprobante salia sin fecha ni metodo de pago y sin historial.
                onClick={() => generateReceipt({ ...reservation, payments }, establishment)}
              >
                📄 Descargar comprobante
              </button>
            </div>
            <button
              type="button"
              className="ml-auto inline-flex items-center rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-md"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReservationDetailsModal;
