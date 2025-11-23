import React from 'react';

function ReservationEditModal({ modal, saving, setModal, onSave, onClose }) {
  if (!modal) return null;

  const serviceIcon = modal.serviceType === 'carpa' ? '🏖️' : modal.serviceType === 'sombrilla' ? '☂️' : '🚗';
  const serviceLabel = modal.serviceType === 'carpa' ? 'Carpa' : modal.serviceType === 'sombrilla' ? 'Sombrilla' : 'Estacionamiento';
  const gradientClass = modal.serviceType === 'carpa' 
    ? 'from-orange-500 to-red-500' 
    : modal.serviceType === 'sombrilla' 
      ? 'from-purple-500 to-pink-500' 
      : 'from-blue-600 to-indigo-600';

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4 py-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r ${gradientClass} px-5 py-4 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{serviceIcon}</div>
              <div>
                <p className="text-xs font-medium opacity-90">Editar reserva</p>
                <p className="text-lg font-bold">{serviceLabel} {modal.resourceNumber}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">

          {/* Fechas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
              <span>📅</span>
              <span>Fechas de estadía</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <span className="text-base">📥</span>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-medium">Entrada</p>
                  <p className="text-xs text-slate-900 font-semibold">{modal.startDate}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">📤</span>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-medium">Salida</p>
                  <p className="text-xs text-slate-900 font-semibold">{modal.endDate}</p>
                </div>
              </div>
            </div>
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
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">Precio total (ARS)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={modal.tempTotalPrice}
                    onChange={(e) =>
                      setModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              tempTotalPrice: e.target.value
                            }
                          : prev
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </label>
              </div>
            </div>
          </div>

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
