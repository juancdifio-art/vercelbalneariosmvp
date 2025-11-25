import { useState, useCallback } from 'react';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

function useReservationGroups(authToken) {
  const [reservationGroups, setReservationGroups] = useState([]);
  const [reservationGroupsLoading, setReservationGroupsLoading] = useState(false);
  const [reservationFilterService, setReservationFilterService] = useState('');
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

        // Cargar pagos para cada grupo de reserva en lotes para evitar muchas conexiones simultáneas
        const MAX_CONCURRENT_REQUESTS = 20;
        const groupsWithPayments = [];

        for (let i = 0; i < groups.length; i += MAX_CONCURRENT_REQUESTS) {
          const slice = groups.slice(i, i + MAX_CONCURRENT_REQUESTS);

          // eslint-disable-next-line no-await-in-loop
          const sliceResults = await Promise.all(
            slice.map(async (group) => {
              try {
                const paymentsResponse = await fetch(
                  `${API_BASE_URL}/api/reservation-groups/${group.id}/payments`,
                  {
                    headers: {
                      Authorization: `Bearer ${token}`
                    }
                  }
                );

                if (paymentsResponse.ok) {
                  const paymentsData = await paymentsResponse.json();
                  return {
                    ...group,
                    payments: Array.isArray(paymentsData.payments) ? paymentsData.payments : []
                  };
                }

                return { ...group, payments: [] };
              } catch (paymentErr) {
                console.error(`Error fetching payments for group ${group.id}`, paymentErr);
                return { ...group, payments: [] };
              }
            })
          );

          groupsWithPayments.push(...sliceResults);
        }

        setReservationGroups(groupsWithPayments);
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
