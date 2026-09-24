import React, { useEffect } from 'react';
import { format } from '../lib/dates';
import ClientSearchInput from './ClientSearchInput';
import useUnidadesOcupadas from '../hooks/useUnidadesOcupadas';
import PersonasFields from './PersonasFields';
import { numerosDeUnidades } from '../lib/unidades';
import { normalizarPatente } from '../lib/patente';
import PatenteField from './PatenteField';
import PrecioReserva from './PrecioReserva';
import { PRECIO_VACIO, aNumero, faltaMotivoAjuste } from '../lib/tarifas';

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

function CarpaReservationModal({
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
    carpaNumero,
    day,
    isReserved,
    startDate,
    endDate,
    clientId,
    customerName,
    customerPhone,
    adultsCount,
    childrenCount,
    includeParking,
    parkingSpotNumber,
    initialPaymentAmount,
    initialPaymentMethod,
    parkingInitialPaymentAmount,
    parkingInitialPaymentMethod,
    vehiclePlate
  } = form;

  const precio = form.precio ?? PRECIO_VACIO;
  const precioCochera = form.precioCochera ?? PRECIO_VACIO;
  const cambiarPrecio = (campo) => (patch) =>
    onChangeForm((prev) => (prev ? { ...prev, [campo]: { ...(prev[campo] ?? PRECIO_VACIO), ...patch } } : prev));

  const hasParking = establishment?.hasParking;
  const parkingCapacity = hasParking
    ? Number.parseInt(establishment?.parkingCapacity ?? '0', 10) || 0
    : 0;
  const parkingUnits = parkingCapacity > 0 ? Array.from({ length: parkingCapacity }, (_, i) => i + 1) : [];

  // Calcular carpas disponibles para el rango de fechas seleccionado
  // Con el plano, la numeracion tiene huecos: la lista sale de ahi y no de 1..capacidad.
  const numerosCarpas = numerosDeUnidades(establishment, 'carpa');
  const totalCarpas = numerosCarpas.length;

  const startStr = startDate || format(day, 'yyyy-MM-dd');
  const endStr = endDate || '';

  // Disponibilidad real de todo el periodo, pedida al servidor. Antes se
  // miraba la lista de reservas de la app, que en esta seccion trae solo carpas
  // y solo los 30 dias de la grilla: ninguna plaza figuraba ocupada y, en una
  // estadia larga, una carpa tomada despues del dia 30 aparecia libre.
  const principal = useUnidadesOcupadas('carpa', startStr, endStr, !isReserved);
  const estacionamiento = useUnidadesOcupadas('parking', startStr, endStr, !isReserved && Boolean(includeParking));

  // Sin plaza elegida, la que asignaria el sistema: asi se cotiza (y se
  // guarda) la misma plaza, en vez de cotizar sin numero y asignar otra al guardar.
  const plazaEfectiva = parkingSpotNumber || (estacionamiento.verificando ? null : parkingUnits.find((n) => !estacionamiento.ocupadas.has(n)) ?? null);
  const mensajePlaza = parkingSpotNumber || estacionamiento.verificando
    ? null
    : plazaEfectiva
      ? `Se asigna la plaza ${plazaEfectiva}.`
      : 'No hay plazas libres en esas fechas.';

  const startDateObj = parseLocalDateFromInput(startStr);
  const endDateObj = parseLocalDateFromInput(endStr);
  let daysCount = 0;

  if (startDateObj && endDateObj) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = endDateObj.getTime() - startDateObj.getTime();
    daysCount = Math.floor(diffMs / msPerDay) + 1;
  }

  // El total sale del recuadro de precio: la tarifa, o lo que cargo el encargado.
  const totalPreview = aNumero(precio.cobrado);
  const parkingTotalPreview = includeParking ? aNumero(precioCochera.cobrado) : null;

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

  // Validación de método de pago faltante
  const paymentAmountNum = initialPaymentAmount ? Number.parseFloat(String(initialPaymentAmount).replace(',', '.')) : 0;
  const paymentMissingMethod = paymentAmountNum > 0 && !initialPaymentMethod;

  const parkingPaymentAmountNum = parkingInitialPaymentAmount ? Number.parseFloat(String(parkingInitialPaymentAmount).replace(',', '.')) : 0;
  const parkingPaymentMissingMethod = includeParking && parkingPaymentAmountNum > 0 && !parkingInitialPaymentMethod;

  const hasPaymentError = paymentExceedsTotal || (includeParking && parkingPaymentExceedsTotal) || paymentMissingMethod || parkingPaymentMissingMethod;

  // Una unidad ya elegida que choca con otra reserva en algun dia del periodo
  // no se guarda: antes, con estacionamiento, App la cambiaba por otra plaza
  // sin avisar.
  const conflictoPrincipal = !isReserved && principal.ocupadas.has(Number(carpaNumero));
  const conflictoEstacionamiento = Boolean(
    !isReserved && includeParking && parkingSpotNumber && estacionamiento.ocupadas.has(Number(parkingSpotNumber))
  );
  const verificandoDisponibilidad = principal.verificando || Boolean(includeParking && estacionamiento.verificando);
  // Sin patente no hay estacionamiento: es un dato obligatorio.
  const faltaPatente = Boolean(includeParking) && !normalizarPatente(vehiclePlate);
  const bloqueaGuardar = hasPaymentError || conflictoPrincipal || conflictoEstacionamiento || verificandoDisponibilidad || faltaPatente ||
    faltaMotivoAjuste(precio) || (Boolean(includeParking) && faltaMotivoAjuste(precioCochera)) ||
    // Sin la cotizacion de las fechas actuales se guardaria el precio de las anteriores.
    Boolean(precio.cotizando) || (Boolean(includeParking) && Boolean(precioCochera.cotizando));

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
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🏖️</div>
              <div>
                <p className="text-xs font-medium opacity-90">{isReserved ? 'Reserva existente' : 'Nueva reserva'}</p>
                <p className="text-lg font-bold">Carpa {carpaNumero}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">

          {/* Selector de carpa */}
          {!isReserved && totalCarpas > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>🏖️</span>
                <span>Carpa</span>
              </h3>
              <div className="space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Número de carpa</span>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    value={carpaNumero || ''}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      onChangeForm((prev) =>
                        prev
                          ? {
                            ...prev,
                            carpaNumero: value
                          }
                          : prev
                      );
                    }}
                  >
                    {numerosCarpas.map((num) => {
                      const isOccupied = principal.ocupadas.has(num);
                      return (
                        <option
                          key={num}
                          value={num}
                          disabled={isOccupied && num !== carpaNumero}
                        >
                          Carpa {num}{isOccupied ? ' (ocupada)' : ''}
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
                            customerPhone: client ? client.phone || '' : '',
                            // Si la ficha tiene patente, se completa sola (se puede cambiar).
                            vehiclePlate: prev.vehiclePlate || (client && client.vehiclePlate) || ''
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
              idPrefijo="carpa"
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
                <span>Precio y pago de carpa</span>
              </h3>
              <div className="space-y-3">
                <PrecioReserva
                  serviceType="carpa"
                  resourceNumber={carpaNumero}
                  desde={startStr}
                  hasta={endStr}
                  valor={precio}
                  onChange={cambiarPrecio('precio')}
                  titulo="Precio de la carpa"
                />
                <div className="border-t border-slate-200 pt-3 space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Monto a pagar ahora por carpa (ARS)</span>
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
                    <span className="text-[11px] font-semibold text-slate-700">Método de pago carpa</span>
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
                        const isOccupied = estacionamiento.ocupadas.has(num);
                        return (
                          <option
                            key={num}
                            value={num}
                            disabled={isOccupied && num !== Number(parkingSpotNumber)}
                          >
                            Plaza {num}{isOccupied ? ' (ocupada)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {mensajePlaza && (
                      <span className="text-[10px] text-slate-600">{mensajePlaza}</span>
                    )}
                  </label>
                  <PatenteField
                    value={vehiclePlate}
                    onChange={(value) =>
                      onChangeForm((prev) => (prev ? { ...prev, vehiclePlate: value } : prev))
                    }
                  />
                  <PrecioReserva
                    serviceType="parking"
                    resourceNumber={plazaEfectiva}
                    desde={startStr}
                    hasta={endStr}
                    valor={precioCochera}
                    onChange={cambiarPrecio('precioCochera')}
                    titulo="Precio del estacionamiento"
                  />

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
                  <p>🏖️ Carpa: ${totalPreview !== null ? formatCurrency(totalPreview) : '0,00'}</p>
                  <p>🚗 Estacionamiento: ${parkingTotalPreview !== null ? formatCurrency(parkingTotalPreview) : '0,00'}</p>
                </div>
              )}
            </div>
          )}

          {/* Disponibilidad */}
          {conflictoPrincipal && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ La carpa {carpaNumero} está ocupada en alguno de esos días. Elegí otra o cambiá las fechas.
            </div>
          )}
          {conflictoEstacionamiento && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ La plaza {parkingSpotNumber} está ocupada en alguno de esos días. Elegí otra.
            </div>
          )}
          {(principal.fallo || estacionamiento.fallo) && (
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200 mb-4">
              No se pudo verificar la disponibilidad. Al guardar, el sistema igual controla que no se superponga con otra reserva.
            </div>
          )}

          {/* Mensajes de error de pago */}
          {paymentMissingMethod && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Ingresaste un monto de pago pero no seleccionaste el método de pago para la carpa.
            </div>
          )}
          {faltaPatente && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Falta la patente del vehículo: es obligatoria para usar el estacionamiento.
            </div>
          )}
          {parkingPaymentMissingMethod && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Ingresaste un monto de pago pero no seleccionaste el método de pago para el estacionamiento.
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
                  const ok = await onSaveRange(carpaNumero, startStr, endStr, {
                    // Sin esto la reserva se guardaba sin vincular al cliente elegido
                    // en el buscador: quedaba solo el nombre como texto.
                    clientId,
                    customerName,
                    customerPhone,
                    adultsCount,
                    childrenCount,
                    precio,
                    includeParking,
                    // La plaza que se cotizo arriba: asi lo cotizado es lo que se guarda.
                    parkingSpotNumber: plazaEfectiva,
                    precioCochera,
                    initialPaymentAmount,
                    initialPaymentMethod,
                    parkingInitialPaymentAmount,
                    parkingInitialPaymentMethod,
                    vehiclePlate: normalizarPatente(vehiclePlate)
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
                  await onReleaseRange(carpaNumero, startStr, endStr);
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

export default CarpaReservationModal;
