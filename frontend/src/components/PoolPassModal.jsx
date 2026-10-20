import React, { useEffect } from 'react';
import { contarPorEdad, personaCompletaParaPase } from '../lib/incluidos';
import { format } from '../lib/dates';
import ClientSearchInput from './ClientSearchInput';

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

  // Pase pago asociado a una carpa: se eligen las personas de la carpa que
  // no tienen pase, y adultos y menores se precargan segun la edad.
  const personasDisponibles = Array.isArray(form.personasDisponibles) ? form.personasDisponibles : null;
  const personasElegidas = Array.isArray(form.personasElegidas) ? form.personasElegidas : [];
  const alternarPersona = (key) =>
    onChangeForm((prev) => {
      if (!prev) return prev;
      const actuales = Array.isArray(prev.personasElegidas) ? prev.personasElegidas : [];
      const elegidas = actuales.includes(key) ? actuales.filter((k) => k !== key) : [...actuales, key];
      const seleccion = (prev.personasDisponibles || []).filter((p) => elegidas.includes(p.key));
      const { adults, children } = contarPorEdad(seleccion);
      return { ...prev, personasElegidas: elegidas, poolAdultsCount: String(adults), poolChildrenCount: String(children) };
    });

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

  // La pileta no usa tarifas: el precio por dia se carga en cada pase. Sin
  // personas o sin precio el pase quedaria en $0, asi que no se guarda.
  const faltanPersonas = adults + children === 0;
  const faltaPrecio = (adults > 0 && !(adultPrice > 0)) || (children > 0 && !(childPrice > 0));
  const bloqueaGuardar = hasPaymentError || faltanPersonas || faltaPrecio;

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
          {form.carpaEtiqueta && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
              Pase pago · {form.carpaEtiqueta}. Se cobra aparte: no es uno de los pases incluidos.
            </p>
          )}

          {personasDisponibles && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Personas sin pase</h3>
              {personasDisponibles.length === 0 && (
                <p className="text-[11px] text-slate-500">Todas las personas cargadas en la carpa ya tienen pase.</p>
              )}
              <ul className="space-y-1.5">
                {personasDisponibles.map((persona) => {
                  const completa = personaCompletaParaPase(persona);
                  return (
                    <li key={persona.key} className="flex items-center justify-between gap-2 text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Vender pase a ${persona.fullName}`}
                          checked={personasElegidas.includes(persona.key)}
                          disabled={!completa}
                          onChange={() => alternarPersona(persona.key)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500"
                        />
                        <span className="text-slate-900">{persona.fullName}</span>
                      </label>
                      {!completa && <span className="text-[10px] text-amber-700">Falta DNI o edad</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Cliente */}
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
                  aria-label="Cantidad de adultos"
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
                  aria-label="Cantidad de niños (2 a 12 años)"
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

        {faltanPersonas && (
          <div className="mx-5 mb-3 bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
            ⚠️ Cargá cuántos adultos y niños van.
          </div>
        )}
        {!faltanPersonas && faltaPrecio && (
          <div className="mx-5 mb-3 bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
            ⚠️ Cargá el precio por día de {adults > 0 && !(adultPrice > 0) && children > 0 && !(childPrice > 0) ? 'adultos y de niños' : adults > 0 && !(adultPrice > 0) ? 'adultos' : 'niños'}: sin precio el pase quedaría en $0.
          </div>
        )}

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
            disabled={bloqueaGuardar}
            className={`ml-auto inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-md transition-all ${bloqueaGuardar
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
