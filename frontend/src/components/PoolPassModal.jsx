import React, { useEffect } from 'react';
import { format } from 'date-fns';

// Función para formatear moneda para visualización
const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '0,00';
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Función para formatear el valor del input con separadores de miles (versión optimizada)
const formatInputValue = (value) => {
  if (!value && value !== 0) return '';
  const numStr = String(value).replace(/\D/g, '');
  if (!numStr) return '';
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

function PoolPassModal({
  form,
  clients,
  establishment,
  error,
  parseLocalDateFromInput,
  onChangeForm,
  onSave,
  onClose
}) {
  if (!form) return null;

  const {
    startDate,
    endDate,
    clientId,
    customerName,
    customerPhone,
    poolAdultsCount,
    poolChildrenCount,
    poolAdultPricePerDay,
    poolChildPricePerDay,
    initialPaymentAmount,
    initialPaymentMethod
  } = form;

  const startStr = startDate || format(new Date(), 'yyyy-MM-dd');
  const endStr = endDate || startStr;

  const startDateObj = parseLocalDateFromInput(startStr);
  const endDateObj = parseLocalDateFromInput(endStr);

  let daysCount = 0;
  if (startDateObj && endDateObj) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = endDateObj.getTime() - startDateObj.getTime();
    daysCount = Math.floor(diffMs / msPerDay) + 1;
  }

  const adults = Number.parseInt(String(poolAdultsCount ?? '0'), 10) || 0;
  const children = Number.parseInt(String(poolChildrenCount ?? '0'), 10) || 0;

  const adultPrice =
    poolAdultPricePerDay !== undefined && poolAdultPricePerDay !== null && poolAdultPricePerDay !== ''
      ? Number.parseFloat(String(poolAdultPricePerDay).replace(',', '.'))
      : 0;
  const childPrice =
    poolChildPricePerDay !== undefined && poolChildPricePerDay !== null && poolChildPricePerDay !== ''
      ? Number.parseFloat(String(poolChildPricePerDay).replace(',', '.'))
      : 0;

  const dailyTotal = adults * adultPrice + children * childPrice;
  const totalPreview = daysCount > 0 ? dailyTotal * daysCount : 0;

  // Validación de pago que no exceda el total
  const paymentExceedsTotal = initialPaymentAmount && totalPreview > 0 &&
    Number.parseFloat(String(initialPaymentAmount).replace(',', '.')) > totalPreview;

  // Validación de método de pago faltante
  const paymentAmountNum = initialPaymentAmount ? Number.parseFloat(String(initialPaymentAmount).replace(',', '.')) : 0;
  const paymentMissingMethod = paymentAmountNum > 0 && !initialPaymentMethod;

  const hasPaymentError = paymentExceedsTotal || paymentMissingMethod;

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
      <div className="w-full max-w-xl max-h-[90vh] rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🏊</div>
              <div>
                <p className="text-xs font-medium opacity-90">Nuevo pase de pileta</p>
                <p className="text-lg font-bold">Pileta</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {/* Cliente */}
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
                  <option value="">Seleccioná un cliente...</option>
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

          {/* Fechas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>📅</span>
              <span>Fechas del pase</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Desde</span>
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
                <span className="text-[11px] font-semibold text-slate-700">Hasta</span>
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
                  Pase por {daysCount} {daysCount === 1 ? 'día' : 'días'}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </p>
            </div>
          )}

          {/* Detalle de pase */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>👨‍👩‍👧‍👦</span>
              <span>Personas y precios</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Cantidad de adultos</span>
                <input
                  type="number"
                  min="0"
                  value={poolAdultsCount || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    onChangeForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          poolAdultsCount: value
                        }
                        : prev
                    );
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Cantidad de niños (2 a 12 años)</span>
                <input
                  type="number"
                  min="0"
                  value={poolChildrenCount || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    onChangeForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          poolChildrenCount: value
                        }
                        : prev
                    );
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Precio por adulto por día (ARS)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatInputValue(poolAdultPricePerDay)}
                  onChange={(e) => {
                    const rawValue = parseInputValue(e.target.value);
                    onChangeForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          poolAdultPricePerDay: rawValue
                        }
                        : prev
                    );
                  }}
                  placeholder="0"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Precio por niño por día (ARS)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatInputValue(poolChildPricePerDay)}
                  onChange={(e) => {
                    const rawValue = parseInputValue(e.target.value);
                    onChangeForm((prev) =>
                      prev
                        ? {
                          ...prev,
                          poolChildPricePerDay: rawValue
                        }
                        : prev
                    );
                  }}
                  placeholder="0"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
            </div>

            {daysCount > 0 && (adults > 0 || children > 0) && (
              <div className="bg-cyan-50 rounded-lg px-3 py-2 border border-cyan-200 text-[11px] text-slate-700 space-y-1">
                <p>
                  <span className="font-semibold text-slate-800">Total por día: </span>
                  ${formatCurrency(dailyTotal)} ARS
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Total estadía ({daysCount} {daysCount === 1 ? 'día' : 'días'}): </span>
                  ${formatCurrency(totalPreview)} ARS
                </p>
                <p className="text-[10px] text-slate-500 pt-1">
                  ({adults} {adults === 1 ? 'adulto' : 'adultos'} × ${formatInputValue(adultPrice)} + {children} {children === 1 ? 'niño' : 'niños'} × ${formatInputValue(childPrice)}) × {daysCount} {daysCount === 1 ? 'día' : 'días'}
                </p>
              </div>
            )}
          </div>

          {/* Pago inicial */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>💰</span>
              <span>Pago inicial (opcional)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Monto a pagar ahora (ARS)</span>
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
          </div>

          {/* Resumen total */}
          {daysCount > 0 && totalPreview > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl border-2 border-emerald-200 p-4 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Monto total estimado</span>
                <span className="text-2xl font-bold text-emerald-700">${formatCurrency(totalPreview)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Mensaje de error de pago */}
        {paymentMissingMethod && (
          <div className="mx-5 mb-3 bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
            ⚠️ Ingresaste un monto de pago pero no seleccionaste el método de pago.
          </div>
        )}

        {/* Acciones */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-md"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={hasPaymentError}
            className={`ml-auto inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-md transition-all ${hasPaymentError
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-lg hover:from-cyan-600 hover:to-blue-600'
              }`}
            onClick={async () => {
              const ok = await onSave(form);
              if (ok) {
                onClose();
              }
            }}
          >
            ✅ Guardar pase
          </button>
        </div>
      </div>
    </div>
  );
}

export default PoolPassModal;
