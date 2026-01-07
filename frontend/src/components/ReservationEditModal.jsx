import React from 'react';

function ReservationEditModal({ modal, saving, setModal, onSave, onClose, establishment, reservationGroups }) {
  if (!modal) return null;

  const serviceIcon = modal.serviceType === 'carpa' ? '🏖️' : modal.serviceType === 'sombrilla' ? '☂️' : modal.serviceType === 'parking' ? '🚗' : '🏊';
  const serviceLabel = modal.serviceType === 'carpa' ? 'Carpa' : modal.serviceType === 'sombrilla' ? 'Sombrilla' : modal.serviceType === 'parking' ? 'Estacionamiento' : 'Pileta';
  const gradientClass = modal.serviceType === 'carpa'
    ? 'from-orange-500 to-red-500'
    : modal.serviceType === 'sombrilla'
      ? 'from-purple-500 to-pink-500'
      : modal.serviceType === 'parking'
        ? 'from-blue-600 to-indigo-600'
        : 'from-cyan-500 to-teal-500';

  // Obtener capacidad según tipo de servicio
  const getCapacity = () => {
    if (!establishment) return 0;
    switch (modal.serviceType) {
      case 'carpa': return Number.parseInt(establishment.carpasCapacity ?? '0', 10);
      case 'sombrilla': return Number.parseInt(establishment.sombrillasCapacity ?? '0', 10);
      case 'parking': return Number.parseInt(establishment.parkingCapacity ?? '0', 10);
      default: return 0;
    }
  };

  const capacity = getCapacity();
  const currentResourceNumber = modal.tempResourceNumber ?? modal.resourceNumber;

  // Función para verificar si una unidad está ocupada en un rango de fechas
  const isUnitOccupied = (unitNumber) => {
    if (!modal.startDate || !modal.endDate) return false;
    const modalId = Number(modal.id);

    return reservationGroups?.some((g) => {
      if (g.serviceType !== modal.serviceType) return false;
      if (Number(g.resourceNumber) !== unitNumber) return false;
      if (g.status !== 'active') return false;
      if (Number(g.id) === modalId) return false; // Excluir la reserva actual
      // Verificar solapamiento de fechas
      return g.startDate <= modal.endDate && g.endDate >= modal.startDate;
    }) || false;
  };

  const unitLabel = modal.serviceType === 'carpa' ? 'Carpa' : modal.serviceType === 'sombrilla' ? 'Sombrilla' : 'Plaza';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r ${gradientClass} px-5 py-4 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{serviceIcon}</div>
              <div>
                <p className="text-xs font-medium opacity-90">Editar reserva</p>
                <p className="text-lg font-bold">{serviceLabel} {currentResourceNumber}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">

          {/* Selector de unidad (solo para carpas, sombrillas, estacionamiento) */}
          {capacity > 0 && modal.serviceType !== 'pileta' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>🔄</span>
                <span>Cambiar {unitLabel.toLowerCase()}</span>
              </h3>
              <div className="space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Número de {unitLabel.toLowerCase()}</span>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    value={currentResourceNumber || ''}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      setModal((prev) =>
                        prev
                          ? {
                            ...prev,
                            tempResourceNumber: value
                          }
                          : prev
                      );
                    }}
                  >
                    {Array.from({ length: capacity }, (_, i) => i + 1).map((num) => {
                      const isOccupied = isUnitOccupied(num);
                      const isCurrent = num === Number(modal.resourceNumber);
                      return (
                        <option
                          key={num}
                          value={num}
                          disabled={isOccupied && !isCurrent}
                        >
                          {unitLabel} {num}{isCurrent ? ' (actual)' : ''}{isOccupied && !isCurrent ? ' (ocupada)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {currentResourceNumber !== modal.resourceNumber && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                    La reserva se moverá de {unitLabel} {modal.resourceNumber} a {unitLabel} {currentResourceNumber}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fechas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>📅</span>
              <span>Fechas de estadía</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">📥 Fecha de entrada</span>
                <input
                  type="date"
                  value={modal.tempStartDate ?? modal.startDate ?? ''}
                  onChange={(e) =>
                    setModal((prev) =>
                      prev
                        ? {
                          ...prev,
                          tempStartDate: e.target.value
                        }
                        : prev
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">📤 Fecha de salida</span>
                <input
                  type="date"
                  value={modal.tempEndDate ?? modal.endDate ?? ''}
                  onChange={(e) =>
                    setModal((prev) =>
                      prev
                        ? {
                          ...prev,
                          tempEndDate: e.target.value
                        }
                        : prev
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
            </div>
            {((modal.tempStartDate && modal.tempStartDate !== modal.startDate) ||
              (modal.tempEndDate && modal.tempEndDate !== modal.endDate)) && (
                <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1 mt-2">
                  Las fechas serán modificadas de {modal.startDate} - {modal.endDate} a {modal.tempStartDate || modal.startDate} - {modal.tempEndDate || modal.endDate}
                </p>
              )}
          </div>

          {/* Información del cliente y precio */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>👤</span>
              <span>Información del cliente</span>
            </h3>
            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Nombre del cliente</span>
                <input
                  type="text"
                  value={modal.tempCustomerName}
                  onChange={(e) =>
                    setModal((prev) =>
                      prev
                        ? {
                          ...prev,
                          tempCustomerName: e.target.value
                        }
                        : prev
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Teléfono</span>
                  <input
                    type="text"
                    value={modal.tempCustomerPhone}
                    onChange={(e) =>
                      setModal((prev) =>
                        prev
                          ? {
                            ...prev,
                            tempCustomerPhone: e.target.value
                          }
                          : prev
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
                {/* Solo mostrar tarifa y total para servicios que no son pileta */}
                {modal.serviceType !== 'pileta' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-700">Tarifa por día (ARS)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={modal.tempDailyPrice ?? modal.dailyPrice ?? ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setModal((prev) =>
                            prev
                              ? {
                                ...prev,
                                tempDailyPrice: value
                              }
                              : prev
                          );
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-700">Precio total (ARS)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={modal.tempTotalPrice}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setModal((prev) =>
                            prev
                              ? {
                                ...prev,
                                tempTotalPrice: value
                              }
                              : prev
                          );
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </label>
                  </>
                )}
              </div>
              {/* Resumen financiero para carpa, sombrilla y estacionamiento */}
              {modal.serviceType !== 'pileta' && (() => {
                const dailyPrice = Number.parseFloat(String(modal.tempDailyPrice ?? modal.dailyPrice ?? '0')) || 0;
                const currentTotal = Number.parseFloat(String(modal.tempTotalPrice ?? '0')) || 0;

                // Calcular días con las nuevas fechas
                const startStr = modal.tempStartDate || modal.startDate;
                const endStr = modal.tempEndDate || modal.endDate;
                let newDaysCount = 1;
                if (startStr && endStr) {
                  const startParts = String(startStr).split('-');
                  const endParts = String(endStr).split('-');
                  const startDate = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
                  const endDate = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
                  const msPerDay = 24 * 60 * 60 * 1000;
                  newDaysCount = Math.round((endDate - startDate) / msPerDay) + 1;
                  if (newDaysCount <= 0) newDaysCount = 1;
                }

                // Calcular días originales
                let originalDaysCount = 1;
                if (modal.startDate && modal.endDate) {
                  const origStartParts = String(modal.startDate).split('-');
                  const origEndParts = String(modal.endDate).split('-');
                  const origStartDate = new Date(parseInt(origStartParts[0], 10), parseInt(origStartParts[1], 10) - 1, parseInt(origStartParts[2], 10));
                  const origEndDate = new Date(parseInt(origEndParts[0], 10), parseInt(origEndParts[1], 10) - 1, parseInt(origEndParts[2], 10));
                  const msPerDay = 24 * 60 * 60 * 1000;
                  originalDaysCount = Math.round((origEndDate - origStartDate) / msPerDay) + 1;
                  if (originalDaysCount <= 0) originalDaysCount = 1;
                }

                const suggestedTotal = dailyPrice * newDaysCount;
                const daysChanged = newDaysCount !== originalDaysCount;
                const priceChanged = modal.tempDailyPrice !== undefined && modal.tempDailyPrice !== null;

                if (!dailyPrice || dailyPrice <= 0) return null;

                return (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-4 py-3 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-600">Tarifa por día:</span>
                      <span className="text-sm font-bold text-slate-800">${dailyPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-600">Duración:</span>
                      <span className="text-sm font-bold text-slate-800">
                        {newDaysCount} {newDaysCount === 1 ? 'día' : 'días'}
                        {daysChanged && (
                          <span className="text-amber-600 ml-1">(antes: {originalDaysCount})</span>
                        )}
                      </span>
                    </div>
                    <div className="h-px bg-blue-200 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Total sugerido:</span>
                      <span className="text-lg font-bold text-blue-700">${suggestedTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {(daysChanged || priceChanged) && currentTotal !== suggestedTotal && (
                      <button
                        type="button"
                        onClick={() =>
                          setModal((prev) =>
                            prev
                              ? {
                                ...prev,
                                tempTotalPrice: String(suggestedTotal)
                              }
                              : prev
                          )
                        }
                        className="mt-2 w-full text-center text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-white rounded-lg px-3 py-1.5 border border-blue-300 hover:bg-blue-50 transition"
                      >
                        Aplicar total sugerido (${suggestedTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Detalles de pileta (solo para pases de pileta) */}
          {modal.serviceType === 'pileta' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
                <span>👨‍👩‍👧‍👦</span>
                <span>Composición del pase</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Adultos</span>
                  <input
                    type="number"
                    min="0"
                    value={modal.tempPoolAdultsCount ?? modal.poolAdultsCount ?? ''}
                    onChange={(e) =>
                      setModal((prev) =>
                        prev
                          ? {
                            ...prev,
                            tempPoolAdultsCount: e.target.value
                          }
                          : prev
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Niños</span>
                  <input
                    type="number"
                    min="0"
                    value={modal.tempPoolChildrenCount ?? modal.poolChildrenCount ?? ''}
                    onChange={(e) =>
                      setModal((prev) =>
                        prev
                          ? {
                            ...prev,
                            tempPoolChildrenCount: e.target.value
                          }
                          : prev
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Precio adulto/día</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={modal.tempPoolAdultPricePerDay ?? modal.poolAdultPricePerDay ?? ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setModal((prev) =>
                        prev
                          ? {
                            ...prev,
                            tempPoolAdultPricePerDay: value
                          }
                          : prev
                      );
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Precio niño/día</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={modal.tempPoolChildPricePerDay ?? modal.poolChildPricePerDay ?? ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setModal((prev) =>
                        prev
                          ? {
                            ...prev,
                            tempPoolChildPricePerDay: value
                          }
                          : prev
                      );
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
              </div>
              {/* Total calculado para pileta */}
              {(() => {
                const adults = Number.parseInt(String(modal.tempPoolAdultsCount ?? modal.poolAdultsCount ?? '0'), 10) || 0;
                const children = Number.parseInt(String(modal.tempPoolChildrenCount ?? modal.poolChildrenCount ?? '0'), 10) || 0;
                const adultPrice = Number.parseFloat(String(modal.tempPoolAdultPricePerDay ?? modal.poolAdultPricePerDay ?? '0')) || 0;
                const childPrice = Number.parseFloat(String(modal.tempPoolChildPricePerDay ?? modal.poolChildPricePerDay ?? '0')) || 0;

                // Calcular días
                const startStr = modal.tempStartDate || modal.startDate;
                const endStr = modal.tempEndDate || modal.endDate;
                let daysCount = 1;
                if (startStr && endStr) {
                  const startParts = String(startStr).split('-');
                  const endParts = String(endStr).split('-');
                  const startDate = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
                  const endDate = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
                  const msPerDay = 24 * 60 * 60 * 1000;
                  daysCount = Math.round((endDate - startDate) / msPerDay) + 1;
                  if (daysCount <= 0) daysCount = 1;
                }

                const dailyTotal = adults * adultPrice + children * childPrice;
                const totalPreview = dailyTotal * daysCount;

                return (
                  <div className="mt-4 bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-lg px-4 py-3 border border-emerald-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-600">Total por día:</span>
                      <span className="text-sm font-bold text-slate-800">${dailyTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Total estadía ({daysCount} {daysCount === 1 ? 'día' : 'días'}):</span>
                      <span className="text-lg font-bold text-emerald-700">${totalPreview.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">({adults} adultos × ${adultPrice.toLocaleString('es-AR')} + {children} niños × ${childPrice.toLocaleString('es-AR')}) × {daysCount} días</p>
                  </div>
                );
              })()}
            </div>
          )}
          {/* Notas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>📝</span>
              <span>Notas</span>
            </h3>
            <textarea
              rows={4}
              value={modal.tempNotes}
              onChange={(e) =>
                setModal((prev) =>
                  prev
                    ? {
                      ...prev,
                      tempNotes: e.target.value
                    }
                    : prev
                )
              }
              placeholder="Agregar notas adicionales sobre la reserva..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? '⏳ Guardando...' : '✅ Guardar cambios'}
            </button>
            <button
              type="button"
              className="ml-auto inline-flex items-center rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReservationEditModal;
