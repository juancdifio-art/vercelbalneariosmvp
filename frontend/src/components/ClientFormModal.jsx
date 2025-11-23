import React, { useEffect, useState } from 'react';

function ClientFormModal({ clientForm, clientSaving, onFieldChange, onSubmit, onCancel }) {
  if (!clientForm) return null;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const [showAddress, setShowAddress] = useState(() => {
    if (!clientForm) return false;
    return Boolean(
      clientForm.addressStreet ||
        clientForm.addressNeighborhood ||
        clientForm.addressPostalCode ||
        clientForm.addressCity ||
        clientForm.addressState ||
        clientForm.addressCountry
    );
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4 py-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg">
                {clientForm.id ? '✏️' : '👤'}
              </div>
              <div>
                <p className="text-sm font-medium opacity-90">
                  {clientForm.id ? 'Editar Cliente' : 'Nuevo Cliente'}
                </p>
                <p className="text-lg font-bold">
                  {clientForm.id ? clientForm.fullName || 'Cliente' : 'Registro de Cliente'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Datos personales */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Datos Personales</h3>
                <p className="text-xs text-slate-500">Información básica del cliente</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientForm.fullName}
                  onChange={(e) => onFieldChange('fullName', e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Documento (DNI/CUIT/CUIL)</label>
                  <input
                    type="text"
                    value={clientForm.documentNumber}
                    onChange={(e) => onFieldChange('documentNumber', e.target.value)}
                    placeholder="Ej: 12.345.678"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={clientForm.birthDate}
                    onChange={(e) => onFieldChange('birthDate', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Nacionalidad</label>
                <input
                  type="text"
                  value={clientForm.nationality}
                  onChange={(e) => onFieldChange('nationality', e.target.value)}
                  placeholder="Ej: Argentina"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Información de Contacto</h3>
                <p className="text-xs text-slate-500">Teléfono y email del cliente</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Teléfono</label>
                <input
                  type="text"
                  value={clientForm.phone}
                  onChange={(e) => onFieldChange('phone', e.target.value)}
                  placeholder="Ej: +54 9 11 1234 5678"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  placeholder="Ej: cliente@ejemplo.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Domicilio */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Domicilio</h3>
                  <p className="text-xs text-slate-500">Dirección del cliente (opcional)</p>
                </div>
              </div>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 bg-white hover:bg-purple-50 transition font-medium shadow-sm"
                onClick={() => setShowAddress((prev) => !prev)}
              >
                {showAddress ? 'Ocultar' : '+ Agregar'}
              </button>
            </div>

            {showAddress ? (
              <div className="space-y-3">
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-slate-700">Calle y número</label>
                  <input
                    type="text"
                    value={clientForm.addressStreet}
                    onChange={(e) => onFieldChange('addressStreet', e.target.value)}
                    placeholder="Ej: Av. Siempre Viva 742"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Barrio</label>
                    <input
                      type="text"
                      value={clientForm.addressNeighborhood}
                      onChange={(e) => onFieldChange('addressNeighborhood', e.target.value)}
                      placeholder="Ej: Palermo"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Código postal</label>
                    <input
                      type="text"
                      value={clientForm.addressPostalCode}
                      onChange={(e) => onFieldChange('addressPostalCode', e.target.value)}
                      placeholder="Ej: 1414"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Ciudad</label>
                    <input
                      type="text"
                      value={clientForm.addressCity}
                      onChange={(e) => onFieldChange('addressCity', e.target.value)}
                      placeholder="Ej: CABA"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">Provincia</label>
                    <input
                      type="text"
                      value={clientForm.addressState}
                      onChange={(e) => onFieldChange('addressState', e.target.value)}
                      placeholder="Ej: Buenos Aires"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-slate-700">País</label>
                    <input
                      type="text"
                      value={clientForm.addressCountry}
                      onChange={(e) => onFieldChange('addressCountry', e.target.value)}
                      placeholder="Ej: Argentina"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Hacé clic en "+ Agregar" para completar la dirección del cliente
              </p>
            )}
          </div>

          {/* Vehículo */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Vehículo</h3>
                <p className="text-xs text-slate-500">Datos del vehículo del cliente (opcional)</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Marca</label>
                <input
                  type="text"
                  value={clientForm.vehicleBrand}
                  onChange={(e) => onFieldChange('vehicleBrand', e.target.value)}
                  placeholder="Ej: Toyota"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Modelo</label>
                <input
                  type="text"
                  value={clientForm.vehicleModel}
                  onChange={(e) => onFieldChange('vehicleModel', e.target.value)}
                  placeholder="Ej: Corolla"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">Dominio/Patente</label>
                <input
                  type="text"
                  value={clientForm.vehiclePlate}
                  onChange={(e) => onFieldChange('vehiclePlate', e.target.value)}
                  placeholder="Ej: ABC123"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Notas Internas</h3>
                <p className="text-xs text-slate-500">Comentarios y observaciones (opcional)</p>
              </div>
            </div>
            <div>
              <textarea
                rows={3}
                value={clientForm.notes}
                onChange={(e) => onFieldChange('notes', e.target.value)}
                placeholder="Ej: Cliente VIP, preferencias especiales, referencias, etc."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer con botones */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition disabled:opacity-60"
            onClick={onCancel}
            disabled={clientSaving}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancelar
          </button>
          <button
            type="submit"
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-70 transform hover:scale-105"
            disabled={clientSaving}
          >
            {clientSaving ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {clientForm.id ? 'Guardar Cambios' : 'Guardar Cliente'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClientFormModal;
