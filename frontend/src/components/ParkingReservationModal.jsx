import React, { useEffect } from 'react';
import { format } from '../lib/dates';
import ClientSearchInput from './ClientSearchInput';
import useUnidadesOcupadas from '../hooks/useUnidadesOcupadas';
import PersonasFields from './PersonasFields';

function ParkingReservationModal({
  form,
  clients,
  error,
  parseLocalDateFromInput,
  onChangeForm,
  onSaveRange,
  onReleaseRange,
  onClose,
  establishment,
  reservationGroups
}) {
  if (!form) return null;

  const {
    plazaNumero,
    day,
    isReserved,
    startDate,
    endDate,
    clientId,
    customerName,
    customerPhone,
    adultsCount,
    childrenCount,
    dailyPrice,
    initialPaymentAmount,
    initialPaymentMethod
  } = form;

  // Calcular plazas disponibles para el rango de fechas seleccionado
  const totalPlazas = Number.parseInt(establishment?.parkingCapacity ?? '0', 10);

  // Disponibilidad real de todo el periodo, pedida al servidor. Antes se
  // miraba la lista de reservas de la app, que en esta seccion trae solo los
  // 30 dias de la grilla: en una estadia larga, una plaza tomada despues del
  // dia 30 aparecia libre. Y la plaza ya elegida se daba siempre por libre.
  const desdeDisponibilidad = startDate || (day ? format(day, 'yyyy-MM-dd') : '');
  const ocupacion = useUnidadesOcupadas('parking', desdeDisponibilidad, endDate || '', !isReserved);
  const hayRango = Boolean(endDate);

  const availablePlazas = hayRango && totalPlazas
    ? Array.from({ length: totalPlazas }, (_, i) => i + 1).filter((n) => !ocupacion.ocupadas.has(n))
    : [];

  const startStr = startDate || format(day, 'yyyy-MM-dd');
  const endStr = endDate || '';

  const startDateObj = parseLocalDateFromInput(startStr);
  const endDateObj = parseLocalDateFromInput(endStr);
  let daysCount = 0;

  if (startDateObj && endDateObj) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = endDateObj.getTime() - startDateObj.getTime();
    daysCount = Math.floor(diffMs / msPerDay) + 1;
  }

  let totalPreview = null;
  if (dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== '' && daysCount > 0) {
    const parsedDaily = Number.parseFloat(String(dailyPrice).replace(',', '.'));
    if (!Number.isNaN(parsedDaily)) {
      totalPreview = parsedDaily * daysCount;
    }
  }

  // Validación de pago que no exceda el total
  const paymentExceedsTotal = initialPaymentAmount && totalPreview !== null &&
    Number.parseFloat(initialPaymentAmount) > totalPreview;

  // Validación de método de pago faltante
  const paymentAmountNum = initialPaymentAmount ? Number.parseFloat(String(initialPaymentAmount).replace(',', '.')) : 0;
  const paymentMissingMethod = paymentAmountNum > 0 && !initialPaymentMethod;

  const hasPaymentError = paymentExceedsTotal || paymentMissingMethod;

  // La plaza elegida que choca con otra reserva en algun dia del periodo no
  // se guarda.
  const conflictoPlaza = !isReserved && hayRango && ocupacion.ocupadas.has(Number(plazaNumero));
  const bloqueaGuardar = hasPaymentError || conflictoPlaza || ocupacion.verificando;

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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4 py-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🚗</div>
              <div>
                <p className="text-xs font-medium opacity-90">{isReserved ? 'Reserva existente' : 'Nueva reserva'}</p>
                <p className="text-lg font-bold">Plaza {plazaNumero}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">

          {/* Selector de plaza */}
          {!isReserved && totalPlazas > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>🅿️</span>
                <span>Plaza de estacionamiento</span>
              </h3>
              <div className="space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Número de plaza</span>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    value={plazaNumero || ''}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            plazaNumero: value
                          }
                          : prev
                      );
                    }}
                  >
                    {Array.from({ length: totalPlazas }, (_, i) => i + 1).map((num) => {
                      // Sin fecha de salida todavia no hay nada que chequear.
                      const isAvailable = !hayRango || !ocupacion.ocupadas.has(num);
                      const isCurrent = num === plazaNumero;
                      return (
                        <option
                          key={num}
                          value={num}
                          disabled={!isAvailable && !isCurrent}
                        >
                          Plaza {num}{!isAvailable ? ' (ocupada)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {endDate && availablePlazas.length > 0 && (
                  <p className="text-[10px] text-slate-500">
                    {availablePlazas.length} {availablePlazas.length === 1 ? 'plaza disponible' : 'plazas disponibles'} para las fechas seleccionadas
                  </p>
                )}
              </div>
            </div>
          )}

          {!isReserved && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>👤</span>
                <span>Información del cliente</span>
              </h3>
              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Buscar cliente guardado</span>
                  <ClientSearchInput
                    clients={clients}
                    selectedClientId={clientId}
                    onSelect={(client) => {
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            clientId: client ? client.id : null,
                            customerName: client ? client.fullName : '',
                            customerPhone: client ? client.phone || '' : ''
                          }
                          : prev
                      );
                    }}
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Nombre del cliente</span>
                    <input
                      type="text"
                      value={customerName || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onChangeForm((prev) =>
                          prev
                            ? {
                              ...prev,
                              customerName: value
                            }
                            : prev
                        );
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Teléfono</span>
                    <input
                      type="text"
                      value={customerPhone || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onChangeForm((prev) =>
                          prev
                            ? {
                              ...prev,
                              customerPhone: value
                            }
                            : prev
                        );
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>📅</span>
              <span>Fechas de estadía</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Fecha de entrada</span>
                <input
                  type="date"
                  value={startStr}
                  onChange={(e) => {
                    const value = e.target.value;
                    onChangeForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          startDate: value
                        }
                        : prev
                    );
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Fecha de salida</span>
                <input
                  type="date"
                  value={endStr}
                  onChange={(e) => {
                    const value = e.target.value;
                    onChangeForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          endDate: value
                        }
                        : prev
                    );
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
            </div>
            {daysCount > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-cyan-50 rounded-lg px-3 py-2 border border-cyan-200">
                <span className="text-lg">⏱️</span>
                <p className="text-xs font-semibold text-cyan-900">
                  Estadía de {daysCount} {daysCount === 1 ? 'día' : 'días'}
                </p>
              </div>
            )}
          </div>

          {!isReserved && (
            <PersonasFields
              adultsCount={adultsCount}
              childrenCount={childrenCount}
              onChangeForm={onChangeForm}
              idPrefijo="parking"
            />
          )}

          {!isReserved && error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </p>
            </div>
          )}

          {!isReserved && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>💰</span>
                <span>Precio</span>
              </h3>
              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Valor por día (ARS)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={dailyPrice || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            dailyPrice: value
                          }
                          : prev
                      );
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
                {totalPreview !== null && daysCount > 0 && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900">
                      🅿️ Total estacionamiento: ${totalPreview.toFixed(2)} ARS
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pago inicial */}
          {!isReserved && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>💳</span>
                <span>Pago inicial (opcional)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Monto a pagar ahora (ARS)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={initialPaymentAmount || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            initialPaymentAmount: value
                          }
                          : prev
                      );
                    }}
                    placeholder="0"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Método de pago</span>
                  <select
                    value={initialPaymentMethod || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            initialPaymentMethod: value
                          }
                          : prev
                      );
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Sin pago ahora</option>
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta de crédito</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
              </div>
              {initialPaymentAmount && initialPaymentMethod && totalPreview !== null && Number(initialPaymentAmount) > totalPreview && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-700 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>El pago inicial no puede superar el total (${totalPreview.toFixed(2)})</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Disponibilidad */}
          {conflictoPlaza && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ La plaza {plazaNumero} está ocupada en alguno de esos días. Elegí otra o cambiá las fechas.
            </div>
          )}
          {ocupacion.fallo && (
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200 mb-4">
              No se pudo verificar la disponibilidad. Al guardar, el sistema igual controla que no se superponga con otra reserva.
            </div>
          )}

          {/* Mensaje de error de pago */}
          {paymentMissingMethod && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Ingresaste un monto de pago pero no seleccionaste el método de pago.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            {!isReserved && (
              <button
                type="button"
                disabled={bloqueaGuardar}
                className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-md transition-all ${bloqueaGuardar
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-lg hover:from-cyan-600 hover:to-blue-600'
                  }`}
                onClick={async () => {
                  const ok = await onSaveRange(plazaNumero, startStr, endStr, {
                    // Sin esto la reserva se guardaba sin vincular al cliente elegido
                    // en el buscador: quedaba solo el nombre como texto.
                    clientId,
                    customerName,
                    customerPhone,
                    adultsCount,
                    childrenCount,
                    dailyPrice,
                    initialPaymentAmount,
                    initialPaymentMethod
                  });

                  if (ok) {
                    onClose();
                  }
                }}
              >
                ✅ Guardar reserva
              </button>
            )}
            {isReserved && (
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:bg-amber-600 transition-all"
                onClick={async () => {
                  await onReleaseRange(plazaNumero, startStr, endStr);
                  onClose();
                }}
              >
                🗑️ Liberar reserva
              </button>
            )}
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

export default ParkingReservationModal;
