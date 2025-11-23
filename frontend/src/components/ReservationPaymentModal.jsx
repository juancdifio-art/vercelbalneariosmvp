import React, { useEffect } from 'react';

function ReservationPaymentModal({
  paymentModal,
  setPaymentModal,
  saving,
  onSave
}) {
  if (!paymentModal) return null;

  const {
    serviceType,
    resourceNumber,
    startDate,
    endDate,
    tempAmount,
    tempPaymentDate,
    tempMethod,
    tempNotes
  } = paymentModal;

  const serviceLabel =
    serviceType === 'carpa'
      ? 'Carpa'
      : serviceType === 'sombrilla'
        ? 'Sombrilla'
        : serviceType === 'parking'
          ? 'Estacionamiento'
          : serviceType;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPaymentModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPaymentModal]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-emerald-100 shadow-2xl px-4 py-4 sm:px-5 sm:py-5 text-[11px] text-slate-900">
        <p className="text-xs font-semibold text-emerald-700 mb-1">Agregar pago</p>
        <p className="text-sm font-semibold mb-2">
          {serviceLabel} {resourceNumber}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-[11px] text-slate-700 mb-0.5">Entrada</p>
            <p className="text-[11px] text-slate-900 font-medium">{startDate}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-700 mb-0.5">Salida</p>
            <p className="text-[11px] text-slate-900 font-medium">{endDate}</p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-slate-700">Monto del pago (ARS)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tempAmount}
              onChange={(e) =>
                setPaymentModal((prev) =>
                  prev
                    ? {
                        ...prev,
                        tempAmount: e.target.value
                      }
                    : prev
                )
              }
              className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-slate-700">Fecha del pago</span>
              <input
                type="date"
                value={tempPaymentDate}
                onChange={(e) =>
                  setPaymentModal((prev) =>
                    prev
                      ? {
                          ...prev,
                          tempPaymentDate: e.target.value
                        }
                      : prev
                  )
                }
                className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-slate-700">Método de pago</span>
              <select
                value={tempMethod}
                onChange={(e) =>
                  setPaymentModal((prev) =>
                    prev
                      ? {
                          ...prev,
                          tempMethod: e.target.value
                        }
                      : prev
                  )
                }
                className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Seleccionar...</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta de crédito</option>
                <option value="other">Otro</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-slate-700">Notas de pago</span>
            <textarea
              rows={3}
              value={tempNotes}
              onChange={(e) =>
                setPaymentModal((prev) =>
                  prev
                    ? {
                        ...prev,
                        tempNotes: e.target.value
                      }
                    : prev
                )
              }
              className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
            onClick={() => setPaymentModal(null)}
            disabled={saving}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm shadow-emerald-400/40 hover:bg-emerald-600 transition disabled:opacity-70"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReservationPaymentModal;
