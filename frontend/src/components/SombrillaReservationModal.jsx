import React, { useEffect } from 'react';
import { format } from '../lib/dates';
import ClientSearchInput from './ClientSearchInput';
import useUnidadesOcupadas from '../hooks/useUnidadesOcupadas';
import PersonasFields from './PersonasFields';
import { numerosDeUnidades } from '../lib/unidades';
import PrecioReserva from './PrecioReserva';
import ServiciosIncluidosFields from './ServiciosIncluidosFields';
import useCocherasIncluidas from '../hooks/useCocherasIncluidas';
import { PRECIO_VACIO, aNumero, faltaMotivoAjuste } from '../lib/tarifas';
import { maxPersonasPara, superaTope, filasDePersonas, armarPersonasAlta, pasesIncluidosPara } from '../lib/incluidos';
import PersonasAltaFields from './PersonasAltaFields';
import { normalizarPatente } from '../lib/patente';

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
  reservationGroups,
  onNuevoCliente
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
    adultsCount,
    childrenCount,
    incluyePileta,
    initialPaymentAmount,
    initialPaymentMethod
  } = form;
  const cocheras = Array.isArray(form.cocheras) ? form.cocheras : [];

  const precio = form.precio ?? PRECIO_VACIO;
  const cambiarPrecio = (campo) => (patch) =>
    onChangeForm((prev) => (prev ? { ...prev, [campo]: { ...(prev[campo] ?? PRECIO_VACIO), ...patch } } : prev));


  // Calcular sombrillas disponibles para el rango de fechas seleccionado
  const numerosSombrillas = numerosDeUnidades(establishment, 'sombrilla');
  const totalSombrillas = numerosSombrillas.length;

  const startStr = startDate || format(day, 'yyyy-MM-dd');
  const endStr = endDate || '';

  // Disponibilidad real de todo el periodo, pedida al servidor. Antes se
  // miraba la lista de reservas de la app, que en esta seccion trae solo sombrillas
  // y solo los 30 dias de la grilla: ninguna plaza figuraba ocupada y, en una
  // estadia larga, una sombrilla tomada despues del dia 30 aparecia libre.
  const principal = useUnidadesOcupadas('sombrilla', startStr, endStr, !isReserved);
  // Pileta y cocheras incluidas: disponibilidad de plazas y validacion.
  const cocherasIncluidas = useCocherasIncluidas({ establishment, cocheras, desde: startStr, hasta: endStr, activo: !isReserved });
  const { analisis: cocherasAnalisis, estacionamiento } = cocherasIncluidas;
  const clienteElegido = (clients || []).find((c) => c.id === clientId) || null;

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
  const hayCocheras = cocheras.length > 0;
  const parkingTotalPreview = hayCocheras ? cocherasAnalisis.total : null;

  const combinedTotalPreview = (() => {
    const base = totalPreview !== null ? totalPreview : 0;
    const parking = hayCocheras && parkingTotalPreview !== null ? parkingTotalPreview : 0;
    const sum = base + parking;
    return Number.isFinite(sum) && sum > 0 ? sum : null;
  })();

  // Validación de pagos que no excedan el total
  const paymentExceedsTotal = initialPaymentAmount && totalPreview !== null &&
    Number.parseFloat(initialPaymentAmount) > totalPreview;


  // Validación de método de pago faltante
  const paymentAmountNum = initialPaymentAmount ? Number.parseFloat(String(initialPaymentAmount).replace(',', '.')) : 0;
  const paymentMissingMethod = paymentAmountNum > 0 && !initialPaymentMethod;


  const hasPaymentError = paymentExceedsTotal || paymentMissingMethod;

  // Una unidad ya elegida que choca con otra reserva en algun dia del periodo
  // no se guarda: antes, con estacionamiento, App la cambiaba por otra plaza
  // sin avisar.
  const conflictoPrincipal = !isReserved && principal.ocupadas.has(Number(sombrillaNumero));
  const verificandoDisponibilidad = principal.verificando;
  // Tope de personas por unidad: lo fija el contrato, se bloquea.
  const excedeTope = !isReserved && superaTope(establishment, adultsCount, childrenCount);
  // Los servicios incluidos quedan a nombre de un cliente guardado.
  const faltaCliente = !isReserved && (Boolean(incluyePileta) || hayCocheras) && !clientId;
  const bloqueaGuardar = hasPaymentError || conflictoPrincipal || verificandoDisponibilidad ||
    cocherasAnalisis.bloquea || excedeTope || faltaCliente || faltaMotivoAjuste(precio) ||
    // Sin la cotizacion de las fechas actuales se guardaria el precio de las anteriores.
    Boolean(precio.cotizando);

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
                    {numerosSombrillas.map((num) => {
                      const isOccupied = principal.ocupadas.has(num);
                      return (
                        <option
                          key={num}
                          value={num}
                          disabled={isOccupied && num !== sombrillaNumero}
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
                {onNuevoCliente && (
                  <div className="flex justify-end -mb-2">
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-cyan-700 hover:underline"
                      onClick={onNuevoCliente}
                    >
                      + Nuevo cliente
                    </button>
                  </div>
                )}
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
                            // Si la ficha tiene patente, la primera cochera la toma (se puede cambiar).
                            cocheras: (prev.cocheras || []).map((c, i) =>
                              i === 0 && !c.vehiclePlate && client && client.vehiclePlate ? { ...c, vehiclePlate: client.vehiclePlate } : c
                            )
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
              idPrefijo="sombrilla"
            />
          )}

          {!isReserved && (
            <PersonasAltaFields
              form={form}
              onChangeForm={onChangeForm}
              cliente={clienteElegido}
              establishment={establishment}
              serviceType="sombrilla"
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
                <span>Precio y pago de sombrilla</span>
              </h3>
              <div className="space-y-3">
                <PrecioReserva
                  serviceType="sombrilla"
                  resourceNumber={sombrillaNumero}
                  desde={startStr}
                  hasta={endStr}
                  valor={precio}
                  onChange={cambiarPrecio('precio')}
                  titulo="Precio de la sombrilla"
                />
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

          {!isReserved && (
            <ServiciosIncluidosFields
              establishment={establishment}
              serviceType="sombrilla"
              desde={startStr}
              hasta={endStr}
              incluyePileta={incluyePileta}
              cocheras={cocheras}
              cocherasIncluidas={cocherasIncluidas}
              patenteSugerida={clienteElegido?.vehiclePlate || ''}
              onChangeForm={onChangeForm}
            />
          )}

          {daysCount > 0 && combinedTotalPreview !== null && (
            <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl border-2 border-emerald-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">💰 Monto total</span>
                <span className="text-2xl font-bold text-emerald-700">${formatCurrency(combinedTotalPreview)}</span>
              </div>
              {hayCocheras && (
                <div className="mt-2 pt-2 border-t border-emerald-200 text-[10px] text-slate-600 space-y-0.5">
                  <p>☂️ Sombrilla: ${totalPreview !== null ? formatCurrency(totalPreview) : '0,00'}</p>
                  <p>🚗 Estacionamiento{cocheras.length > 1 ? ` (${cocheras.length} cocheras)` : ''}: ${parkingTotalPreview !== null ? formatCurrency(parkingTotalPreview) : '0,00'}</p>
                </div>
              )}
            </div>
          )}

          {/* Disponibilidad */}
          {conflictoPrincipal && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ La sombrilla {sombrillaNumero} está ocupada en alguno de esos días. Elegí otra o cambiá las fechas.
            </div>
          )}
          {(principal.fallo || (hayCocheras && estacionamiento.fallo)) && (
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200 mb-4">
              No se pudo verificar la disponibilidad. Al guardar, el sistema igual controla que no se superponga con otra reserva.
            </div>
          )}

          {/* Mensajes de error de pago */}
          {paymentMissingMethod && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Ingresaste un monto de pago pero no seleccionaste el método de pago para la sombrilla.
            </div>
          )}
          {excedeTope && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Máximo {maxPersonasPara(establishment)} personas por unidad.
            </div>
          )}
          {faltaCliente && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Para incluir pileta o cochera, elegí un cliente o creá uno nuevo.
            </div>
          )}
          {hayCocheras && cocherasAnalisis.faltaPatente && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4">
              ⚠️ Falta la patente del vehículo: es obligatoria para usar el estacionamiento.
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
                  const ok = await onSaveRange(sombrillaNumero, startStr, endStr, {
                    // Sin esto la reserva se guardaba sin vincular al cliente elegido
                    // en el buscador: quedaba solo el nombre como texto.
                    clientId,
                    customerName,
                    customerPhone,
                    adultsCount,
                    childrenCount,
                    precio,
                    incluyePileta: Boolean(incluyePileta),
                    // Cada cochera con la plaza que se cotizo: lo cotizado es lo que se guarda.
                    cocheras: cocheras.map((c, i) => ({ ...c, plaza: cocherasAnalisis.efectivas[i], vehiclePlate: normalizarPatente(c.vehiclePlate) })),
                    initialPaymentAmount,
                    initialPaymentMethod,
                    // Personas de esta reserva y datos del titular (van a su ficha).
                    ...armarPersonasAlta(filasDePersonas({
                      adultsCount,
                      childrenCount,
                      cliente: clienteElegido,
                      customerName,
                      titularDatos: form.titularDatos,
                      acompanantes: form.acompanantes || [],
                      max: maxPersonasPara(establishment),
                      pases: pasesIncluidosPara(establishment, 'sombrilla'),
                      incluyePileta: Boolean(incluyePileta)
                    }))
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
