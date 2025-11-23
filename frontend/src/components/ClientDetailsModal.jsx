import React, { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function ClientDetailsModal({ client, onClose, onViewReservation }) {
  if (!client) return null;

  const {
    fullName,
    phone,
    email,
    notes,
    documentNumber,
    birthDate,
    nationality,
    addressStreet,
    addressNeighborhood,
    addressPostalCode,
    addressCity,
    addressState,
    addressCountry,
    vehicleBrand,
    vehicleModel,
    vehiclePlate,
    createdAt,
    updatedAt,
    id
  } = client;

  const [clientReservations, setClientReservations] = useState([]);
  const [clientReservationsLoading, setClientReservationsLoading] = useState(false);
  const [clientReservationsError, setClientReservationsError] = useState('');

  const formatDateTime = (value) => {
    if (!value) return '—';

    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toLocaleString('es-AR');
    } catch (e) {
      return String(value);
    }
  };

  const formatShortDate = (value) => {
    if (!value || typeof value !== 'string') return value || '';
    const parts = value.split('-');
    if (parts.length !== 3) return value;

    const [year, month, day] = parts;
    const shortYear = year.slice(-2);
    return `${day}/${month}/${shortYear}`;
  };

  const getTodayString = () => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getReservationStatus = (group) => {
    const todayStr = getTodayString();

    if (group.status === 'cancelled') {
      return {
        label: 'Cancelada',
        classes: 'bg-slate-100 text-slate-700'
      };
    }

    const startStr = group.startDate || '';
    const endStr = group.endDate || '';

    if (startStr && startStr > todayStr) {
      return {
        label: 'Reservada',
        classes: 'bg-amber-100 text-amber-700'
      };
    }

    if (endStr && endStr < todayStr) {
      return {
        label: 'Finalizada',
        classes: 'bg-orange-100 text-orange-700'
      };
    }

    return {
      label: 'Activa',
      classes: 'bg-emerald-100 text-emerald-700'
    };
  };

  const getPaymentStatus = (group) => {
    const totalPriceNum =
      group.totalPrice !== null &&
      group.totalPrice !== undefined &&
      group.totalPrice !== ''
        ? Number.parseFloat(String(group.totalPrice))
        : 0;

    const paidAmountNum =
      group.paidAmount !== null &&
      group.paidAmount !== undefined &&
      group.paidAmount !== ''
        ? Number.parseFloat(String(group.paidAmount))
        : 0;

    if (totalPriceNum <= 0) {
      return {
        label: 'Sin monto',
        classes: 'text-slate-500'
      };
    }

    if (paidAmountNum <= 0.01) {
      return {
        label: 'Sin pagar',
        classes: 'text-red-600 font-semibold'
      };
    }

    if (paidAmountNum + 0.01 >= totalPriceNum) {
      return {
        label: 'Pagado',
        classes: 'text-emerald-600 font-semibold'
      };
    }

    return {
      label: 'Parcial',
      classes: 'text-amber-600 font-semibold'
    };
  };

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

  useEffect(() => {
    if (!id) return;

    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    let cancelled = false;

    const fetchClientReservations = async () => {
      try {
        setClientReservationsLoading(true);
        setClientReservationsError('');

        const response = await fetch(`${API_BASE_URL}/api/reservation-groups`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Error fetching client reservations');
        }

        const data = await response.json();
        const groups = Array.isArray(data.reservationGroups) ? data.reservationGroups : [];

        const normalizedName = (fullName || '').trim().toLowerCase();
        const clientIdNumber = Number(id) || null;

        const groupsForClient = groups.filter((group) => {
          const groupClientId =
            group.clientId !== null &&
            group.clientId !== undefined &&
            group.clientId !== ''
              ? Number(group.clientId)
              : null;

          const matchesId =
            clientIdNumber !== null &&
            groupClientId !== null &&
            !Number.isNaN(groupClientId) &&
            groupClientId === clientIdNumber;

          const groupName = (group.customerName || '').trim().toLowerCase();

          const matchesName =
            normalizedName &&
            (groupName === normalizedName ||
              groupName.includes(normalizedName) ||
              normalizedName.includes(groupName));

          return matchesId || matchesName;
        });

        if (!cancelled) {
          setClientReservations(groupsForClient);
        }
      } catch (err) {
        console.error('Error fetching client reservation history', err);
        if (!cancelled) {
          setClientReservations([]);
          setClientReservationsError('No se pudo cargar el historial de reservas.');
        }
      } finally {
        if (!cancelled) {
          setClientReservationsLoading(false);
        }
      }
    };

    fetchClientReservations();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Detalle de Cliente</p>
              <p className="text-lg font-bold" title={fullName || ''}>
                {fullName || 'Sin nombre'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Cerrar (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* Información Personal */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800">Información Personal</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <p className="text-xs text-slate-500 mb-1">Documento</p>
                <p className="text-sm font-medium text-slate-900">{documentNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Fecha de Nacimiento</p>
                <p className="text-sm font-medium text-slate-900">
                  {birthDate
                    ? formatShortDate(
                        typeof birthDate === 'string'
                          ? birthDate.split('T')[0] || birthDate
                          : String(birthDate)
                      )
                    : '—'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 mb-1">Nacionalidad</p>
                <p className="text-sm font-medium text-slate-900">{nationality || '—'}</p>
              </div>
            </div>
          </div>

          {/* Información de Contacto */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800">Información de Contacto</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <p className="text-xs text-slate-500 mb-1">Teléfono</p>
                <p className="text-sm font-medium text-slate-900">{phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Email</p>
                <p className="text-sm font-medium text-slate-900 truncate" title={email || ''}>{email || '—'}</p>
              </div>
            </div>
          </div>

          {/* Domicilio */}
          {(addressStreet || addressNeighborhood || addressCity || addressState || addressCountry) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800">Domicilio</h3>
              </div>
              <div className="text-sm text-slate-700">
                {addressStreet && <p className="mb-1">{addressStreet}</p>}
                <p className="text-sm text-slate-600">
                  {addressNeighborhood && `${addressNeighborhood}`}
                  {addressPostalCode && ` (CP ${addressPostalCode})`}
                  {addressCity && ` - ${addressCity}`}
                  {addressState && `, ${addressState}`}
                  {addressCountry && ` - ${addressCountry}`}
                </p>
              </div>
            </div>
          )}

          {/* Historial de reservas */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800">Historial de reservas</h3>
            </div>

            {clientReservationsLoading && (
              <div className="py-3 text-xs text-slate-600">
                Cargando historial de reservas...
              </div>
            )}

            {!clientReservationsLoading && clientReservationsError && (
              <div className="py-3 text-xs text-red-600">
                {clientReservationsError}
              </div>
            )}

            {!clientReservationsLoading && !clientReservationsError && clientReservations.length === 0 && (
              <div className="py-3 text-xs text-slate-500">
                Este cliente aún no tiene reservas registradas.
              </div>
            )}

            {!clientReservationsLoading && !clientReservationsError && clientReservations.length > 0 && (
              <div className="mt-1 max-h-60 overflow-y-auto space-y-1.5">
                {clientReservations
                  .slice()
                  .sort((a, b) => {
                    const aDate = a.startDate || '';
                    const bDate = b.startDate || '';
                    if (aDate < bDate) return 1;
                    if (aDate > bDate) return -1;
                    return 0;
                  })
                  .map((group) => {
                    const serviceLabel =
                      group.serviceType === 'carpa'
                        ? 'Carpa'
                        : group.serviceType === 'sombrilla'
                          ? 'Sombrilla'
                          : group.serviceType === 'parking'
                            ? 'Estacionamiento'
                            : group.serviceType === 'pileta'
                              ? 'Pileta'
                              : group.serviceType;

                    const { label: statusLabel, classes: statusClasses } = getReservationStatus(group);
                    const { label: paymentLabel, classes: paymentClasses } = getPaymentStatus(group);

                    const handleClick = () => {
                      if (onViewReservation) {
                        onViewReservation(group);
                        onClose();
                      }
                    };

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={handleClick}
                        className="w-full text-left flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] hover:border-cyan-300 hover:bg-cyan-50/60 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {serviceLabel} {group.resourceNumber ? `#${group.resourceNumber}` : ''}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusClasses}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600">
                            <span>
                              {formatShortDate(group.startDate)}
                              {' - '}
                              {formatShortDate(group.endDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <span className={`text-[10px] ${paymentClasses}`}>{paymentLabel}</span>
                          {group.totalPrice && (
                            <span className="text-[10px] text-slate-500">
                              Total ${Number.parseFloat(String(group.totalPrice)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Vehículo */}
          {(vehicleBrand || vehicleModel || vehiclePlate) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800">Vehículo</h3>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {vehicleBrand && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Marca</p>
                    <p className="text-sm font-medium text-slate-900">{vehicleBrand}</p>
                  </div>
                )}
                {vehicleModel && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Modelo</p>
                    <p className="text-sm font-medium text-slate-900">{vehicleModel}</p>
                  </div>
                )}
                {vehiclePlate && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Patente</p>
                    <p className="text-sm font-medium text-slate-900">{vehiclePlate}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notas */}
          {notes && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800">Notas Internas</h3>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Metadatos */}
          <div className="pt-3 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-500">
              <div>
                <span className="font-medium">Creado:</span>
                <span className="ml-2">{formatDateTime(createdAt)}</span>
              </div>
              <div>
                <span className="font-medium">Actualizado:</span>
                <span className="ml-2">{formatDateTime(updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition"
            onClick={onClose}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClientDetailsModal;
