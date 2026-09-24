import React from 'react';
import { addDays } from 'date-fns';
import { format } from '../lib/dates';
import CalendarioOcupacion from './CalendarioOcupacion';
import { numerosDeUnidades } from '../lib/unidades';
function SombrillasSection({
  establishment,
  sombrillasDayOffset,
  setSombrillasDayOffset,
  sombrillasReservations,
  reservationGroups,
  hoveredReservationGroupId,
  setHoveredReservationGroupId,
  onViewReservationDetails,
  authToken,
  fetchClients,
  setSombrillaReservationError,
  setSombrillaReservationForm,
  CARPA_RESERVATION_COLORS
}) {
  const numerosSombrillas = numerosDeUnidades(establishment, 'sombrilla');

  // Desde el calendario: un clic trae solo la entrada; un arrastre, entrada y salida.
  const abrirNuevaReserva = (sombrillaNumero, day, startDate, endDate) => {
    const token = authToken || sessionStorage.getItem('authToken');
    if (token) {
      fetchClients(token);
    }
    setSombrillaReservationError('');
    setSombrillaReservationForm({
      sombrillaNumero,
      day,
      isReserved: false,
      startDate,
      endDate,
      clientId: null,
      customerName: '',
      customerPhone: '',
      adultsCount: '',
      childrenCount: '',
      dailyPrice: '',
      includeParking: false,
      parkingSpotNumber: '',
      parkingDailyPrice: '',
      initialPaymentAmount: '',
      initialPaymentMethod: '',
      parkingInitialPaymentAmount: '',
      parkingInitialPaymentMethod: ''
    });
  };

  return (
    <div className="rounded-xl bg-sky-50 border border-cyan-100 px-3 py-3 sm:px-4 sm:py-4 text-sm">
      <p className="text-slate-900 font-medium mb-1">Sombrillas</p>
      <p className="text-[11px] text-slate-600 mb-2">
        Capacidad configurada: {establishment?.sombrillasCapacity ?? 'sin definir'} sombrillas.
      </p>
      <p className="text-[11px] text-slate-600 mb-3">
        Disponibilidad de los próximos 30 días: cada fila es una sombrilla, cada columna un día. Arrastrá sobre una fila para cargar una reserva con entrada y salida.
      </p>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 bg-sky-50 pb-2">
        <span>
          Desde{' '}
          <span className="font-medium text-slate-800">
            {format(addDays(new Date(), sombrillasDayOffset), 'dd/MM/yyyy')}
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSombrillasDayOffset((prev) => prev - 10)}
            className="inline-flex items-center whitespace-nowrap rounded-full border border-cyan-400 px-3 py-1.5 text-[11px] bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            ◀ 10 días
          </button>
          <button
            type="button"
            onClick={() => setSombrillasDayOffset((prev) => prev + 10)}
            className="inline-flex items-center whitespace-nowrap rounded-full border border-cyan-400 px-3 py-1.5 text-[11px] bg-white hover:bg-cyan-50 hover:border-cyan-500"
          >
            10 días ▶
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-slate-300 bg-white max-h-[600px] overflow-y-auto overflow-x-auto">
        {numerosSombrillas.length === 0 ? (
          <div className="px-4 py-6 text-[11px] text-slate-600">
            Configurá primero la cantidad de sombrillas en la sección de configuración del establecimiento.
          </div>
        ) : (
          <CalendarioOcupacion
            serviceType="sombrilla"
            prefijo="Sombrilla"
            numeros={numerosSombrillas}
            reservations={sombrillasReservations}
            reservationGroups={reservationGroups}
            dayOffset={sombrillasDayOffset}
            hoveredReservationGroupId={hoveredReservationGroupId}
            setHoveredReservationGroupId={setHoveredReservationGroupId}
            onViewReservationDetails={onViewReservationDetails}
            onNuevaReserva={abrirNuevaReserva}
            colores={CARPA_RESERVATION_COLORS}
            anchoTh="w-24"
            anchoTd="w-20"
          />
        )}
      </div>
    </div>
  );
}

export default SombrillasSection;
