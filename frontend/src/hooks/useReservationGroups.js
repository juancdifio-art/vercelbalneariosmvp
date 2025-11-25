import { useState, useCallback } from 'react';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

function useReservationGroups(authToken) {
  const [reservationGroups, setReservationGroups] = useState([]);
  const [reservationGroupsLoading, setReservationGroupsLoading] = useState(false);
  // Por defecto, mostrar sombrillas activas hoy en la sección Reservas
  const [reservationFilterService, setReservationFilterService] = useState('sombrilla');
  const [reservationFilterStatus, setReservationFilterStatus] = useState('active');
  const [reservationFilterFrom, setReservationFilterFrom] = useState('');
  const [reservationFilterTo, setReservationFilterTo] = useState('');

  const fetchReservationGroups = useCallback(
    async (tokenFromParam, overrides = {}) => {
      const token = tokenFromParam || authToken || sessionStorage.getItem('authToken');

      if (!token) {
        return;
      }

      try {
        setReservationGroupsLoading(true);

        const service = overrides.service ?? reservationFilterService;
        let status = overrides.status ?? reservationFilterStatus;
        const from = overrides.from ?? reservationFilterFrom;
        const to = overrides.to ?? reservationFilterTo;

        const params = new URLSearchParams();

        if (service) params.set('service', service);

        // Map UI sub-statuses to backend statuses
        let backendStatus = status;
        if (status === 'reserved' || status === 'finished') {
          backendStatus = 'active';
        }
        if (backendStatus) params.set('status', backendStatus);
        if (from) params.set('from', from);
        if (to) params.set('to', to);

        const url = `${API_BASE_URL}/api/reservation-groups${
          params.toString() ? `?${params.toString()}` : ''
        }`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          console.error('Error fetching reservation groups');
          setReservationGroups([]);
          return;
        }

        const data = await response.json();
        const groups = Array.isArray(data.reservationGroups) ? data.reservationGroups : [];

        console.log('[useReservationGroups] Fetched groups:', {
          total: groups.length,
          byService: {
            carpa: groups.filter(g => g.serviceType === 'carpa').length,
            sombrilla: groups.filter(g => g.serviceType === 'sombrilla').length,
            parking: groups.filter(g => g.serviceType === 'parking').length,
            pileta: groups.filter(g => g.serviceType === 'pileta').length
          },
          filters: { service, status, from, to }
        });

        // OPTIMIZACIÓN: No cargar pagos aquí (eliminado N+1 problem)
        // El backend ya devuelve paidAmount (suma total de pagos)
        // Los pagos detallados se cargarán lazy solo cuando se necesiten:
        // - Dashboard "Últimos pagos": endpoint GET /api/reservation-groups/payments?limit=5
        // - Modal de detalles: endpoint GET /api/reservation-groups/{id}/payments
        setReservationGroups(groups);
      } catch (err) {
        console.error('Error fetching reservation groups', err);
        setReservationGroups([]);
      } finally {
        setReservationGroupsLoading(false);
      }
    },
    [authToken, reservationFilterService, reservationFilterStatus, reservationFilterFrom, reservationFilterTo]
  );

  return {
    reservationGroups,
    setReservationGroups,
    reservationGroupsLoading,
    reservationFilterService,
    setReservationFilterService,
    reservationFilterStatus,
    setReservationFilterStatus,
    reservationFilterFrom,
    setReservationFilterFrom,
    reservationFilterTo,
    setReservationFilterTo,
    fetchReservationGroups
  };
}

export default useReservationGroups;
