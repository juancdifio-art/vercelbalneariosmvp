import React, { useEffect } from 'react';
import { format } from 'date-fns';

// Función para formatear montos con separadores de miles (formato argentino)
const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '0,00';
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Función para formatear el valor del input con separadores de miles (versión optimizada)
const formatInputValue = (value) => {
  if (!value && value !== 0) return '';
  const numStr = String(value).replace(/\D/g, '');
  if (!numStr) return '';
  // Agregar puntos como separadores de miles manualmente (más rápido que toLocaleString)
  let result = '';
  for (let i = numStr.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      result = '.' + result;
    }
    result = numStr[i] + result;
  }
  return result;
};

// Función para parsear el valor formateado a número
const parseInputValue = (formattedValue) => {
  if (!formattedValue) return '';
  return formattedValue.replace(/\./g, '');
};

function SombrillaReservationModal({
  form,
  clients,
  establishment,
  error,
  parseLocalDateFromInput,
  onChangeForm,
  onSaveRange,
  onReleaseRange,
  onClose,
  reservationGroups
}) {
  if (!form) return null;

  const {
    sombrillaNumero,
    day,
    isReserved,
    startDate,
    endDate,
    clientId,
    customerName,
    customerPhone,
    dailyPrice,
    includeParking,
    parkingSpotNumber,
    parkingDailyPrice,
    initialPaymentAmount,
    initialPaymentMethod,
    parkingInitialPaymentAmount,
    parkingInitialPaymentMethod
  } = form;

  const hasParking = establishment?.hasParking;
  const parkingCapacity = hasParking
    ? Number.parseInt(establishment?.parkingCapacity ?? '0', 10) || 0
    : 0;
  const parkingUnits = parkingCapacity > 0 ? Array.from({ length: parkingCapacity }, (_, i) => i + 1) : [];

  // Calcular sombrillas disponibles para el rango de fechas seleccionado
  const totalSombrillas = Number.parseInt(establishment?.sombrillasCapacity ?? '0', 10);

  const startStr = startDate || format(day, 'yyyy-MM-dd');
  const endStr = endDate || '';

  // Función para verificar si una unidad está ocupada en un rango de fechas
  const isUnitOccupied = (serviceType, unitNumber, start, end) => {
    if (!start || !end) return false;
    return reservationGroups?.some((g) => {
      if (g.serviceType !== serviceType) return false;
      if (Number(g.resourceNumber) !== unitNumber) return false;
      if (g.status !== 'active') return false;
      return g.startDate <= end && g.endDate >= start;
    }) || false;
  };

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

  let parkingTotalPreview = null;
  if (
    includeParking &&
    parkingDailyPrice !== undefined &&
    parkingDailyPrice !== null &&
    parkingDailyPrice !== '' &&
    daysCount > 0
  ) {
    const parsedDailyParking = Number.parseFloat(String(parkingDailyPrice).replace(',', '.'));
    if (!Number.isNaN(parsedDailyParking)) {
      parkingTotalPreview = parsedDailyParking * daysCount;
    }
  }

  const combinedTotalPreview = (() => {
    const base = totalPreview !== null ? totalPreview : 0;
    const parking = includeParking && parkingTotalPreview !== null ? parkingTotalPreview : 0;
    const sum = base + parking;
    return Number.isFinite(sum) && sum > 0 ? sum : null;
  })();

  // Validación de pagos que no excedan el total
  const paymentExceedsTotal = initialPaymentAmount && totalPreview !== null &&
    Number.parseFloat(initialPaymentAmount) > totalPreview;

  const parkingPaymentExceedsTotal = parkingInitialPaymentAmount && parkingTotalPreview !== null &&
    Number.parseFloat(parkingInitialPaymentAmount) > parkingTotalPreview;

  const hasPaymentError = paymentExceedsTotal || (includeParking && parkingPaymentExceedsTotal);

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
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">☂️</div>
              <div>
                <p className="text-xs font-medium opacity-90">{isReserved ? 'Reserva existente' : 'Nueva reserva'}</p>
                <p className="text-lg font-bold">Sombrilla {sombrillaNumero}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">

          {/* Selector de sombrilla */}
          {!isReserved && totalSombrillas > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>☂️</span>
                <span>Sombrilla</span>
              </h3>
              <div className="space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Número de sombrilla</span>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    value={sombrillaNumero || ''}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            sombrillaNumero: value
                          }
                          : prev
                      );
                    }}
                  >
                    {Array.from({ length: totalSombrillas }, (_, i) => i + 1).map((num) => {
                      const isOccupied = isUnitOccupied('sombrilla', num, startStr, endStr);
                      return (
                        <option
                          key={num}
                          value={num}
                          disabled={isOccupied}
                        >
                          Sombrilla {num}{isOccupied ? ' (ocupada)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
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
                  <span className="text-[11px] font-semibold text-slate-700">Cliente guardado</span>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    value={clientId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const id = value ? Number.parseInt(value, 10) : null;
                      const selected = clients.find((c) => c.id === id);
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            clientId: id,
                            customerName: selected ? selected.fullName : '',
                            customerPhone: selected ? selected.phone || '' : ''
                          }
                          : prev
                      );
                    }}
                  >
                    <option value="">Buscar cliente guardado...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                        {c.phone ? ` - ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
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
                <span>Precio y pago de sombrilla</span>
              </h3>
              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Valor por día (ARS)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatInputValue(dailyPrice)}
                    onChange={(e) => {
                      const rawValue = parseInputValue(e.target.value);
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            dailyPrice: rawValue
                          }
                          : prev
                      );
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="0"
                  />
                </label>
                {totalPreview !== null && daysCount > 0 && (
                  <div className="bg-cyan-50 rounded-lg px-3 py-2 border border-cyan-200">
                    <p className="text-xs font-semibold text-cyan-900">
                      💜 Total sombrilla: ${formatCurrency(totalPreview)} ARS
                    </p>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Monto a pagar ahora por sombrilla (ARS)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatInputValue(initialPaymentAmount)}
                      onChange={(e) => {
                        const rawValue = parseInputValue(e.target.value);
                        onChangeForm((prev) =>
                          prev
                            ? {
                              ...prev,
                              initialPaymentAmount: rawValue
                            }
                            : prev
                        );
                      }}
                      className={`rounded-lg border bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${paymentExceedsTotal ? 'border-red-500 bg-red-50' : 'border-slate-300'
                        }`}
                      placeholder="0"
                    />
                    {paymentExceedsTotal && (
                      <p className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1">
                        ⚠️ El pago no puede exceder el total de ${formatCurrency(totalPreview)}
                      </p>
                    )}
                    {initialPaymentAmount && totalPreview !== null && !paymentExceedsTotal && Number.parseFloat(initialPaymentAmount) > 0 && (
                      <p className="text-[10px] text-emerald-600 bg-emerald-50 rounded px-2 py-1">
                        ✅ Pendiente: ${formatCurrency(totalPreview - Number.parseFloat(initialPaymentAmount || 0))}
                      </p>
                    )}
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Método de pago sombrilla</span>
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
              </div>
            </div>
          )}

          {!isReserved && hasParking && parkingUnits.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="includeParking"
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500"
                  checked={!!includeParking}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChangeForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          includeParking: checked
                        }
                        : prev
                    );
                  }}
                />
                <label htmlFor="includeParking" className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1 cursor-pointer">
                  <span>🚗</span>
                  <span>Incluir estacionamiento</span>
                </label>
              </div>

              {includeParking && (
                <div className="space-y-3 pl-6">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Plaza de estacionamiento</span>
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      value={parkingSpotNumber || ''}
                      onChange={(e) => {
                        const value = e.target.value ? Number.parseInt(e.target.value, 10) : null;
                        onChangeForm((prev) =>
                          prev
                            ? {
                              ...prev,
                              parkingSpotNumber: value
                            }
                            : prev
                        );
                      }}
                    >
                      <option value="">Seleccionar plaza...</option>
                      {parkingUnits.map((num) => {
                        const isOccupied = isUnitOccupied('parking', num, startStr, endStr);
                        return (
                          <option
                            key={num}
                            value={num}
                            disabled={isOccupied}
                          >
                            Plaza {num}{isOccupied ? ' (ocupada)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Valor por día estacionamiento (ARS)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatInputValue(parkingDailyPrice)}
                      onChange={(e) => {
                        const rawValue = parseInputValue(e.target.value);
                        onChangeForm((prev) =>
                          prev
                            ? {
                              ...prev,
                              parkingDailyPrice: rawValue
                            }
                            : prev
                        );
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </label>

                  {parkingTotalPreview !== null && daysCount > 0 && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900">
                        🅿️ Total estacionamiento: ${formatCurrency(parkingTotalPreview)} ARS
                      </p>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-3 space-y-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-700">
                        Monto a pagar ahora por estacionamiento (ARS)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatInputValue(parkingInitialPaymentAmount)}
                        onChange={(e) => {
                          const rawValue = parseInputValue(e.target.value);
                          onChangeForm((prev) =>
                            prev
                              ? {
                                ...prev,
                                parkingInitialPaymentAmount: rawValue
                              }
                              : prev
                          );
                        }}
                        className={`rounded-lg border bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${parkingPaymentExceedsTotal ? 'border-red-500 bg-red-50' : 'border-slate-300'
                          }`}
                        placeholder="0"
                      />
                      {parkingPaymentExceedsTotal && (
                        <p className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1">
                          ⚠️ El pago no puede exceder el total de ${formatCurrency(parkingTotalPreview)}
                        </p>
                      )}
                      {parkingInitialPaymentAmount && parkingTotalPreview !== null && !parkingPaymentExceedsTotal && Number.parseFloat(parkingInitialPaymentAmount) > 0 && (
                        <p className="text-[10px] text-emerald-600 bg-emerald-50 rounded px-2 py-1">
                          ✅ Pendiente: ${formatCurrency(parkingTotalPreview - Number.parseFloat(parkingInitialPaymentAmount || 0))}
                        </p>
                      )}
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-700">Método de pago estacionamiento</span>
                      <select
                        value={parkingInitialPaymentMethod || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          onChangeForm((prev) =>
                            prev
                              ? {
                                ...prev,
                                parkingInitialPaymentMethod: value
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
                </div>
              )}
            </div>
          )}

          {daysCount > 0 && combinedTotalPreview !== null && (
            <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl border-2 border-emerald-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">💰 Monto total</span>
                <span className="text-2xl font-bold text-emerald-700">${formatCurrency(combinedTotalPreview)}</span>
              </div>
              {includeParking && (
                <div className="mt-2 pt-2 border-t border-emerald-200 text-[10px] text-slate-600 space-y-0.5">
                  <p>☂️ Sombrilla: ${totalPreview !== null ? formatCurrency(totalPreview) : '0,00'}</p>
                  <p>🚗 Estacionamiento: ${parkingTotalPreview !== null ? formatCurrency(parkingTotalPreview) : '0,00'}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            {!isReserved && (
              <button
                type="button"
                disabled={hasPaymentError}
                className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-md transition-all ${hasPaymentError
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-lg hover:from-cyan-600 hover:to-blue-600'
                  }`}
                onClick={async () => {
                  const ok = await onSaveRange(sombrillaNumero, startStr, endStr, {
                    customerName,
                    customerPhone,
                    dailyPrice,
                    includeParking,
                    parkingSpotNumber,
                    parkingDailyPrice,
                    initialPaymentAmount,
                    initialPaymentMethod,
                    parkingInitialPaymentAmount,
                    parkingInitialPaymentMethod
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
                  await onReleaseRange(sombrillaNumero, startStr, endStr);
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

export default SombrillaReservationModal;
