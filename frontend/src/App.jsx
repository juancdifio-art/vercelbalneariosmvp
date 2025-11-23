import { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import ReservationDetailsModal from './components/ReservationDetailsModal';
import ReservationPaymentModal from './components/ReservationPaymentModal';
import ClientFormModal from './components/ClientFormModal';
import ClientsSection from './components/ClientsSection';
import ReservasSection from './components/ReservasSection';
import CarpasSection from './components/CarpasSection';
import SombrillasSection from './components/SombrillasSection';
import EstacionamientoSection from './components/EstacionamientoSection';
import PiletaSection from './components/PiletaSection';
import ReportsPaymentsSection from './components/ReportsPaymentsSection';
import CarpaReservationModal from './components/CarpaReservationModal';
import ParkingReservationModal from './components/ParkingReservationModal';
import SombrillaReservationModal from './components/SombrillaReservationModal';
import PoolPassModal from './components/PoolPassModal';
import ReservationEditModal from './components/ReservationEditModal';
import EstablishmentConfigForm from './components/EstablishmentConfigForm';
import AuthenticatedShell from './components/AuthenticatedShell';
import DailyViewSection from './components/DailyViewSection';
import DashboardSection from './components/DashboardSection';
import useReservationGroups from './hooks/useReservationGroups';
import useAuth from './hooks/useAuth';
import useEstablishment from './hooks/useEstablishment';
import useClients from './hooks/useClients';
import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = getApiBaseUrl();
const QUICK_VIEW_LOOKAHEAD_DAYS = 90;

const CARPA_RESERVATION_COLORS = [
  {
    normal: 'bg-amber-300 hover:bg-amber-400',
    today: 'bg-amber-500 hover:bg-amber-600'
  },
  {
    normal: 'bg-emerald-300 hover:bg-emerald-400',
    today: 'bg-emerald-500 hover:bg-emerald-600'
  },
  {
    normal: 'bg-rose-300 hover:bg-rose-400',
    today: 'bg-rose-500 hover:bg-rose-600'
  },
  {
    normal: 'bg-violet-300 hover:bg-violet-400',
    today: 'bg-violet-500 hover:bg-violet-600'
  },
  {
    normal: 'bg-indigo-300 hover:bg-indigo-400',
    today: 'bg-indigo-500 hover:bg-indigo-600'
  },
  {
    normal: 'bg-pink-300 hover:bg-pink-400',
    today: 'bg-pink-500 hover:bg-pink-600'
  },
  {
    normal: 'bg-lime-300 hover:bg-lime-400',
    today: 'bg-lime-500 hover:bg-lime-600'
  },
  {
    normal: 'bg-fuchsia-300 hover:bg-fuchsia-400',
    today: 'bg-fuchsia-500 hover:bg-fuchsia-600'
  },
  {
    normal: 'bg-teal-300 hover:bg-teal-400',
    today: 'bg-teal-500 hover:bg-teal-600'
  },
  {
    normal: 'bg-slate-300 hover:bg-slate-400',
    today: 'bg-slate-500 hover:bg-slate-600'
  }
];

function App() {
  const [activeSection, setActiveSection] = useState('inicio');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [carpasDayOffset, setCarpasDayOffset] = useState(0);
  const [sombrillasDayOffset, setSombrillasDayOffset] = useState(0);
  const [parkingDayOffset, setParkingDayOffset] = useState(0);
  const [carpasReservations, setCarpasReservations] = useState({});
  const [sombrillasReservations, setSombrillasReservations] = useState({});
  const [parkingReservations, setParkingReservations] = useState({});
  const [carpaReservationForm, setCarpaReservationForm] = useState(null);
  const [sombrillaReservationForm, setSombrillaReservationForm] = useState(null);
  const [parkingReservationForm, setParkingReservationForm] = useState(null);
  const [carpaReservationError, setCarpaReservationError] = useState('');
  const [sombrillaReservationError, setSombrillaReservationError] = useState('');
  const [parkingReservationError, setParkingReservationError] = useState('');
  const [poolPassForm, setPoolPassForm] = useState(null);
  const [poolPassError, setPoolPassError] = useState('');
  const [hoveredReservationGroupId, setHoveredReservationGroupId] = useState(null);

  const {
    isAuthenticated,
    setIsAuthenticated,
    authToken,
    userEmail,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    setError,
    success,
    setSuccess,
    handleSubmit,
    handleLogout
  } = useAuth({
    onLogoutCleanup: () => {
      setCarpasDayOffset(0);
      setSombrillasDayOffset(0);
      setParkingDayOffset(0);
      setCarpasReservations({});
      setSombrillasReservations({});
      setParkingReservations({});
      setCarpaReservationForm(null);
      setSombrillaReservationForm(null);
      setParkingReservationForm(null);
      setCarpaReservationError('');
      setSombrillaReservationError('');
      setParkingReservationError('');
      setActiveSection('inicio');
    }
  });

  const {
    establishment,
    establishmentLoaded,
    estName,
    setEstName,
    estHasParking,
    setEstHasParking,
    estHasCarpas,
    setEstHasCarpas,
    estHasSombrillas,
    setEstHasSombrillas,
    estHasPileta,
    setEstHasPileta,
    estParkingCapacity,
    setEstParkingCapacity,
    estCarpasCapacity,
    setEstCarpasCapacity,
    estSombrillasCapacity,
    setEstSombrillasCapacity,
    estPoolMaxOccupancy,
    setEstPoolMaxOccupancy,
    estSaving,
    fetchEstablishment,
    handleSaveEstablishment
  } = useEstablishment({
    authToken,
    isAuthenticated,
    setError,
    setSuccess,
    setIsAuthenticated,
    onSaveSuccess: () => setActiveSection('inicio')
  });

  const {
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
  } = useReservationGroups(authToken);
  const [reservationDetailsModal, setReservationDetailsModal] = useState(null);
  const [reservationPaymentModal, setReservationPaymentModal] = useState(null);
  const [reservationPaymentSaving, setReservationPaymentSaving] = useState(false);
  const [reservationEditModal, setReservationEditModal] = useState(null);
  const [reservationEditSaving, setReservationEditSaving] = useState(false);

  const {
    clients,
    clientsLoading,
    clientForm,
    clientSaving,
    clientDeletingId,
    clientFormOpen,
    setClientFormOpen,
    fetchClients,
    handleClientFieldChange,
    handleResetClientForm,
    handleEditClient,
    handleSubmitClientForm,
    handleDeleteClient
  } = useClients({
    authToken,
    setError,
    setSuccess,
    setIsAuthenticated
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!authToken) return;

    fetchEstablishment(authToken);
  }, [isAuthenticated, authToken, fetchEstablishment]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeSection !== 'reservas') return;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    fetchReservationGroups(token);
  }, [isAuthenticated, activeSection, authToken, reservationFilterService, reservationFilterStatus, reservationFilterFrom, reservationFilterTo]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeSection !== 'vista-diaria') return;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    const today = new Date();
    const from = format(today, 'yyyy-MM-dd');
    const to = format(addDays(today, QUICK_VIEW_LOOKAHEAD_DAYS - 1), 'yyyy-MM-dd');

    console.log('[App.jsx] Fetching reservationGroups for vista-diaria:', { from, to, status: 'active' });

    fetchReservationGroups(token, {
      status: 'active',
      from,
      to
    });
  }, [isAuthenticated, activeSection, authToken, fetchReservationGroups]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeSection !== 'inicio') return;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    // Cargar todas las reservas activas para el dashboard
    fetchReservationGroups(token, {
      status: 'active'
    });
  }, [isAuthenticated, activeSection, authToken, fetchReservationGroups]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishment || !establishment.hasPileta) return;
    if (activeSection !== 'pileta') return;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    fetchReservationGroups(token, {
      service: 'pileta',
      status: 'active'
    });
  }, [isAuthenticated, establishment, activeSection, authToken, fetchReservationGroups]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeSection !== 'clientes') return;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    fetchClients(token);
  }, [isAuthenticated, activeSection, authToken]);

  // Login y logout ahora se manejan desde useAuth (handleSubmit, handleLogout)

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishment || !establishment.hasCarpas) return;

    const today = new Date();
    const quickViewEndDate = addDays(today, QUICK_VIEW_LOOKAHEAD_DAYS - 1);
    const gridStartDate = addDays(today, carpasDayOffset);
    const gridEndDate = addDays(today, carpasDayOffset + 29);

    const startDate = gridStartDate < today ? gridStartDate : today;
    const endDate = gridEndDate > quickViewEndDate ? gridEndDate : quickViewEndDate;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    const controller = new AbortController();

    async function fetchCarpasReservations() {
      try {
        const params = new URLSearchParams({
          service: 'carpa',
          from: format(startDate, 'yyyy-MM-dd'),
          to: format(endDate, 'yyyy-MM-dd')
        });

        const response = await fetch(`${API_BASE_URL}/api/reservations?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const map = {};

        if (Array.isArray(data.reservations)) {
          // Ahora cada reserva tiene startDate y endDate - expandir a días individuales
          for (const r of data.reservations) {
            const start = parseLocalDateFromInput(r.startDate);
            const end = parseLocalDateFromInput(r.endDate);
            
            if (!start || !end) continue;
            
            // Iterar por cada día del rango
            let current = new Date(start);
            while (current <= end) {
              const dateKey = format(current, 'yyyy-MM-dd');
              const key = `${dateKey}-${r.resourceNumber}`;
              map[key] = true;
              current = addDays(current, 1);
            }
          }
        }

        setCarpasReservations(map);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Error fetching carpas reservations', err);
      }
    }

    fetchCarpasReservations();

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, establishment, carpasDayOffset, authToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishment || !establishment.hasCarpas) return;
    if (activeSection !== 'carpas') return;

    const today = new Date();
    const startDate = addDays(today, carpasDayOffset);
    const endDate = addDays(today, carpasDayOffset + 29);

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    fetchReservationGroups(token, {
      service: 'carpa',
      status: 'active',
      from: format(startDate, 'yyyy-MM-dd'),
      to: format(endDate, 'yyyy-MM-dd')
    });
  }, [isAuthenticated, establishment, activeSection, carpasDayOffset, authToken, fetchReservationGroups]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishment || !establishment.hasSombrillas) return;

    const today = new Date();
    const quickViewEndDate = addDays(today, QUICK_VIEW_LOOKAHEAD_DAYS - 1);
    const gridStartDate = addDays(today, sombrillasDayOffset);
    const gridEndDate = addDays(today, sombrillasDayOffset + 29);

    const startDate = gridStartDate < today ? gridStartDate : today;
    const endDate = gridEndDate > quickViewEndDate ? gridEndDate : quickViewEndDate;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    const controller = new AbortController();

    async function fetchSombrillasReservations() {
      try {
        const params = new URLSearchParams({
          service: 'sombrilla',
          from: format(startDate, 'yyyy-MM-dd'),
          to: format(endDate, 'yyyy-MM-dd')
        });

        const response = await fetch(`${API_BASE_URL}/api/reservations?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const map = {};

        if (Array.isArray(data.reservations)) {
          // Ahora cada reserva tiene startDate y endDate - expandir a días individuales
          for (const r of data.reservations) {
            const start = parseLocalDateFromInput(r.startDate);
            const end = parseLocalDateFromInput(r.endDate);
            
            if (!start || !end) continue;
            
            // Iterar por cada día del rango
            let current = new Date(start);
            while (current <= end) {
              const dateKey = format(current, 'yyyy-MM-dd');
              const key = `${dateKey}-${r.resourceNumber}`;
              map[key] = true;
              current = addDays(current, 1);
            }
          }
        }

        setSombrillasReservations(map);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Error fetching sombrillas reservations', err);
      }
    }

    fetchSombrillasReservations();

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, establishment, sombrillasDayOffset, authToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishment || !establishment.hasSombrillas) return;
    if (activeSection !== 'sombrillas') return;

    const today = new Date();
    const startDate = addDays(today, sombrillasDayOffset);
    const endDate = addDays(today, sombrillasDayOffset + 29);

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    fetchReservationGroups(token, {
      service: 'sombrilla',
      status: 'active',
      from: format(startDate, 'yyyy-MM-dd'),
      to: format(endDate, 'yyyy-MM-dd')
    });
  }, [isAuthenticated, establishment, activeSection, sombrillasDayOffset, authToken, fetchReservationGroups]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishment || !establishment.hasParking) return;

    const today = new Date();
    const quickViewEndDate = addDays(today, QUICK_VIEW_LOOKAHEAD_DAYS - 1);
    const gridStartDate = addDays(today, parkingDayOffset);
    const gridEndDate = addDays(today, parkingDayOffset + 29);

    const startDate = gridStartDate < today ? gridStartDate : today;
    const endDate = gridEndDate > quickViewEndDate ? gridEndDate : quickViewEndDate;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    const controller = new AbortController();

    async function fetchParkingReservations() {
      try {
        const params = new URLSearchParams({
          service: 'parking',
          from: format(startDate, 'yyyy-MM-dd'),
          to: format(endDate, 'yyyy-MM-dd')
        });

        const response = await fetch(`${API_BASE_URL}/api/reservations?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const map = {};

        if (Array.isArray(data.reservations)) {
          // Ahora cada reserva tiene startDate y endDate - expandir a días individuales
          for (const r of data.reservations) {
            const start = parseLocalDateFromInput(r.startDate);
            const end = parseLocalDateFromInput(r.endDate);
            
            if (!start || !end) continue;
            
            // Iterar por cada día del rango
            let current = new Date(start);
            while (current <= end) {
              const dateKey = format(current, 'yyyy-MM-dd');
              const key = `${dateKey}-${r.resourceNumber}`;
              map[key] = true;
              current = addDays(current, 1);
            }
          }
        }

        setParkingReservations(map);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Error fetching parking reservations', err);
      }
    }

    fetchParkingReservations();

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, establishment, parkingDayOffset, authToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishment || !establishment.hasParking) return;
    if (activeSection !== 'estacionamiento') return;

    const today = new Date();
    const startDate = addDays(today, parkingDayOffset);
    const endDate = addDays(today, parkingDayOffset + 29);

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    fetchReservationGroups(token, {
      service: 'parking',
      status: 'active',
      from: format(startDate, 'yyyy-MM-dd'),
      to: format(endDate, 'yyyy-MM-dd')
    });
  }, [isAuthenticated, establishment, activeSection, parkingDayOffset, authToken, fetchReservationGroups]);

  // Toggle individual deshabilitado - Ahora se usan solo modales para crear reservas
  const handleToggleCarpaReservation = (carpaNumero, day) => {
    setError('Para crear reservas, usá el botón "Nueva reserva" y completá el formulario.');
    // Opcional: abrir el modal automáticamente
    // handleOpenCarpaReservationFromQuickView(carpaNumero, day);
  };

  // Toggle individual deshabilitado - Ahora se usan solo modales para crear reservas
  const handleToggleSombrillaReservation = (sombrillaNumero, day) => {
    setError('Para crear reservas, usá el botón "Nueva reserva" y completá el formulario.');
    // Opcional: abrir el modal automáticamente
    // handleOpenSombrillaReservationFromQuickView(sombrillaNumero, day);
  };

  // Toggle individual deshabilitado - Ahora se usan solo modales para crear reservas
  const handleToggleParkingReservation = (plazaNumero, day) => {
    setError('Para crear reservas, usá el botón "Nueva reserva" y completá el formulario.');
    // Opcional: abrir el modal automáticamente
    // handleOpenParkingReservationFromQuickView(plazaNumero, day);
  };

  const parseLocalDateFromInput = (value) => {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split('-');
    if (parts.length !== 3) return null;
    const [yearStr, monthStr, dayStr] = parts;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const dayNum = Number.parseInt(dayStr, 10);
    if (!year || !month || !dayNum) return null;
    return new Date(year, month - 1, dayNum);
  };

  const findAvailableParkingSpotForRange = (startDateObj, endDateObj, preferredSpot) => {
    if (!establishment || !establishment.hasParking) return null;

    const totalPlazasRaw = establishment.parkingCapacity ?? '0';
    const totalPlazas = Number.parseInt(totalPlazasRaw, 10);
    if (!totalPlazas || Number.isNaN(totalPlazas)) return null;

    const preferred =
      preferredSpot && Number.isInteger(preferredSpot) && preferredSpot >= 1 && preferredSpot <= totalPlazas
        ? preferredSpot
        : 1;

    for (let offset = 0; offset < totalPlazas; offset += 1) {
      const plazaNumero = ((preferred - 1 + offset) % totalPlazas) + 1;

      let disponible = true;

      for (let d = new Date(startDateObj); d <= endDateObj; d = addDays(d, 1)) {
        const dateKeyStr = format(d, 'yyyy-MM-dd');
        const key = `${dateKeyStr}-${plazaNumero}`;
        if (parkingReservations[key]) {
          disponible = false;
          break;
        }
      }

      if (disponible) {
        return plazaNumero;
      }
    }

    return null;
  };

  const handleSaveCarpaReservationRange = async (
    carpaNumero,
    startDateStr,
    endDateStr,
    extra = {}
  ) => {
    if (!startDateStr || !endDateStr) {
      setCarpaReservationError('Completá la fecha de entrada y la fecha de salida.');
      return false;
    }

    let start = parseLocalDateFromInput(startDateStr);
    let end = parseLocalDateFromInput(endDateStr);

    if (!start || !end) {
      return;
    }

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    setCarpaReservationError('');
    const fromStr = format(start, 'yyyy-MM-dd');
    const toStr = format(end, 'yyyy-MM-dd');

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = end.getTime() - start.getTime();
    const daysCount = Math.floor(diffMs / msPerDay) + 1;

    const {
      customerName,
      customerPhone,
      dailyPrice,
      clientId,
      includeParking,
      parkingSpotNumber,
      parkingDailyPrice,
      initialPaymentAmount,
      initialPaymentMethod,
      parkingInitialPaymentAmount,
      parkingInitialPaymentMethod
    } = extra;

    let totalPrice = null;

    if (dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== '') {
      const parsedDaily = Number.parseFloat(String(dailyPrice).replace(',', '.'));
      if (!Number.isNaN(parsedDaily) && daysCount > 0) {
        totalPrice = parsedDaily * daysCount;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservation-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceType: 'carpa',
          resourceNumber: carpaNumero,
          startDate: fromStr,
          endDate: toStr,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          dailyPrice:
            dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== ''
              ? String(dailyPrice)
              : '',
          totalPrice: totalPrice !== null ? String(totalPrice) : '',
          notes: '',
          clientId: clientId ?? ''
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }

      if (!response.ok) {
        if (data && data.error === 'no_availability') {
          setCarpaReservationError('No hay disponibilidad en esa unidad en la fecha seleccionada.');
        } else {
          console.error('Error creating reservation group for carpas', data);
          setError('No se pudo crear la reserva.');
        }
        return false;
      }

      if (data && data.group) {
        setReservationGroups((prev) => {
          const exists = prev.some((g) => g.id === data.group.id);
          if (exists) {
            return prev.map((g) => (g.id === data.group.id ? data.group : g));
          }
          return [...prev, data.group];
        });

        const method = (initialPaymentMethod || '').trim();
        const rawAmount = initialPaymentAmount;

        if (method && rawAmount !== undefined && rawAmount !== null && rawAmount !== '') {
          const amountNum = Number.parseFloat(String(rawAmount).replace(',', '.'));

          if (!Number.isNaN(amountNum) && amountNum > 0) {
            try {
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              const todayStr = `${yyyy}-${mm}-${dd}`;

              const paymentResponse = await fetch(
                `${API_BASE_URL}/api/reservation-groups/${data.group.id}/payments`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    amount: String(rawAmount),
                    paymentDate: todayStr,
                    method,
                    notes: ''
                  })
                }
              );

              if (paymentResponse.ok) {
                const paymentData = await paymentResponse.json();
                if (paymentData.payment) {
                  setReservationGroups((prev) =>
                    prev.map((g) =>
                      g.id === data.group.id
                        ? {
                            ...g,
                            paidAmount:
                              Number(g.paidAmount || 0) + Number(paymentData.payment.amount || 0)
                          }
                        : g
                    )
                  );
                }
              }
            } catch (paymentErr) {
              console.error('Error creating initial payment for carpa reservation', paymentErr);
            }
          }
        }
      }

      // Actualizamos el mapa local para que el rango quede pintado sin esperar a un refetch
      setCarpasReservations((prev) => {
        const next = { ...prev };
        for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
          const dateKeyStr = format(d, 'yyyy-MM-dd');
          const key = `${dateKeyStr}-${carpaNumero}`;
          next[key] = true;
        }
        return next;
      });
      setCarpaReservationError('');

      if (
        includeParking &&
        establishment &&
        establishment.hasParking
      ) {
        const preferredRaw = parkingSpotNumber ? Number.parseInt(String(parkingSpotNumber), 10) : null;
        const plazaNumero = findAvailableParkingSpotForRange(start, end, preferredRaw);

        if (plazaNumero !== null) {
          await handleSaveParkingReservationRange(plazaNumero, fromStr, toStr, {
            customerName,
            customerPhone,
            dailyPrice: parkingDailyPrice ?? '',
            clientId,
            initialPaymentAmount: parkingInitialPaymentAmount,
            initialPaymentMethod: parkingInitialPaymentMethod
          });
        } else {
          setError(
            'Se creó la reserva de carpa, pero no se encontró ninguna plaza de estacionamiento disponible para ese rango de fechas.'
          );
        }
      }

      return true;
    } catch (err) {
      console.error('Error calling reservation-groups API', err);
      setError('No se pudo conectar con el servidor para crear la reserva.');
      return false;
    }
  };

  const handleOpenNewPoolPass = () => {
    const token = authToken || sessionStorage.getItem('authToken');
    if (token) {
      fetchClients(token);
    }

    setPoolPassError('');

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    setPoolPassForm({
      startDate: todayStr,
      endDate: todayStr,
      clientId: null,
      customerName: '',
      customerPhone: '',
      poolAdultsCount: '1',
      poolChildrenCount: '0',
      poolAdultPricePerDay: '',
      poolChildPricePerDay: '',
      initialPaymentAmount: '',
      initialPaymentMethod: ''
    });
  };

  const handleSavePoolPass = async (form) => {
    if (!form) return false;

    const {
      startDate,
      endDate,
      clientId,
      customerName,
      customerPhone,
      poolAdultsCount,
      poolChildrenCount,
      poolAdultPricePerDay,
      poolChildPricePerDay,
      initialPaymentAmount,
      initialPaymentMethod
    } = form;

    if (!startDate || !endDate) {
      setPoolPassError('Completá la fecha de inicio y fin del pase.');
      return false;
    }

    let start = parseLocalDateFromInput(startDate);
    let end = parseLocalDateFromInput(endDate);

    if (!start || !end) {
      setPoolPassError('Fechas inválidas.');
      return false;
    }

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return false;
    }

    const fromStr = format(start, 'yyyy-MM-dd');
    const toStr = format(end, 'yyyy-MM-dd');

    setPoolPassError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservation-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceType: 'pileta',
          resourceNumber: 1,
          startDate: fromStr,
          endDate: toStr,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          dailyPrice: '',
          totalPrice: '',
          notes: '',
          clientId: clientId ?? '',
          poolAdultsCount: poolAdultsCount || '0',
          poolChildrenCount: poolChildrenCount || '0',
          poolAdultPricePerDay: poolAdultPricePerDay || '0',
          poolChildPricePerDay: poolChildPricePerDay || '0'
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }

      if (!response.ok) {
        if (data && data.error === 'pool_client_required') {
          setPoolPassError('Seleccioná un cliente guardado para el pase de pileta.');
        } else {
          console.error('Error creating pool pass', data);
          setError('No se pudo crear el pase de pileta.');
        }
        return false;
      }

      if (data && data.group) {
        setReservationGroups((prev) => {
          const exists = prev.some((g) => g.id === data.group.id);
          if (exists) {
            return prev.map((g) => (g.id === data.group.id ? data.group : g));
          }
          return [...prev, data.group];
        });

        const method = (initialPaymentMethod || '').trim();
        const rawAmount = initialPaymentAmount;

        if (method && rawAmount !== undefined && rawAmount !== null && rawAmount !== '') {
          const amountNum = Number.parseFloat(String(rawAmount).replace(',', '.'));

          if (!Number.isNaN(amountNum) && amountNum > 0) {
            try {
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              const todayStr = `${yyyy}-${mm}-${dd}`;

              const paymentResponse = await fetch(
                `${API_BASE_URL}/api/reservation-groups/${data.group.id}/payments`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    amount: String(rawAmount),
                    paymentDate: todayStr,
                    method,
                    notes: ''
                  })
                }
              );

              if (paymentResponse.ok) {
                const paymentData = await paymentResponse.json();
                if (paymentData.payment) {
                  setReservationGroups((prev) =>
                    prev.map((g) =>
                      g.id === data.group.id
                        ? {
                            ...g,
                            paidAmount:
                              Number(g.paidAmount || 0) + Number(paymentData.payment.amount || 0)
                          }
                        : g
                    )
                  );
                }
              }
            } catch (paymentErr) {
              console.error('Error creating initial payment for pool pass', paymentErr);
            }
          }
        }
      }

      return true;
    } catch (err) {
      console.error('Error calling reservation-groups API (pileta)', err);
      setError('No se pudo conectar con el servidor para crear el pase de pileta.');
      return false;
    }
  };

  const handleSaveSombrillaReservationRange = async (
    sombrillaNumero,
    startDateStr,
    endDateStr,
    extra = {}
  ) => {
    if (!startDateStr || !endDateStr) {
      setSombrillaReservationError('Completá la fecha de entrada y la fecha de salida.');
      return false;
    }

    let start = parseLocalDateFromInput(startDateStr);
    let end = parseLocalDateFromInput(endDateStr);

    if (!start || !end) {
      return;
    }

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    setSombrillaReservationError('');
    const fromStr = format(start, 'yyyy-MM-dd');
    const toStr = format(end, 'yyyy-MM-dd');

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = end.getTime() - start.getTime();
    const daysCount = Math.floor(diffMs / msPerDay) + 1;

    const {
      customerName,
      customerPhone,
      dailyPrice,
      clientId,
      includeParking,
      parkingSpotNumber,
      parkingDailyPrice,
      initialPaymentAmount,
      initialPaymentMethod,
      parkingInitialPaymentAmount,
      parkingInitialPaymentMethod
    } = extra;

    let totalPrice = null;

    if (dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== '') {
      const parsedDaily = Number.parseFloat(String(dailyPrice).replace(',', '.'));
      if (!Number.isNaN(parsedDaily) && daysCount > 0) {
        totalPrice = parsedDaily * daysCount;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservation-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceType: 'sombrilla',
          resourceNumber: sombrillaNumero,
          startDate: fromStr,
          endDate: toStr,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          dailyPrice:
            dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== ''
              ? String(dailyPrice)
              : '',
          totalPrice: totalPrice !== null ? String(totalPrice) : '',
          notes: '',
          clientId: clientId ?? ''
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }

      if (!response.ok) {
        if (data && data.error === 'no_availability') {
          setSombrillaReservationError('No hay disponibilidad en esa unidad en la fecha seleccionada.');
        } else {
          console.error('Error creating reservation group for sombrillas', data);
          setError('No se pudo crear la reserva.');
        }
        return false;
      }

      if (data && data.group) {
        setReservationGroups((prev) => {
          const exists = prev.some((g) => g.id === data.group.id);
          if (exists) {
            return prev.map((g) => (g.id === data.group.id ? data.group : g));
          }
          return [...prev, data.group];
        });

        const method = (initialPaymentMethod || '').trim();
        const rawAmount = initialPaymentAmount;

        if (method && rawAmount !== undefined && rawAmount !== null && rawAmount !== '') {
          const amountNum = Number.parseFloat(String(rawAmount).replace(',', '.'));

          if (!Number.isNaN(amountNum) && amountNum > 0) {
            try {
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              const todayStr = `${yyyy}-${mm}-${dd}`;

              const paymentResponse = await fetch(
                `${API_BASE_URL}/api/reservation-groups/${data.group.id}/payments`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    amount: String(rawAmount),
                    paymentDate: todayStr,
                    method,
                    notes: ''
                  })
                }
              );

              if (paymentResponse.ok) {
                const paymentData = await paymentResponse.json();
                if (paymentData.payment) {
                  setReservationGroups((prev) =>
                    prev.map((g) =>
                      g.id === data.group.id
                        ? {
                            ...g,
                            paidAmount:
                              Number(g.paidAmount || 0) + Number(paymentData.payment.amount || 0)
                          }
                        : g
                    )
                  );
                }
              }
            } catch (paymentErr) {
              console.error('Error creating initial payment for sombrilla reservation', paymentErr);
            }
          }
        }
      }

      setSombrillasReservations((prev) => {
        const next = { ...prev };
        for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
          const dateKeyStr = format(d, 'yyyy-MM-dd');
          const key = `${dateKeyStr}-${sombrillaNumero}`;
          next[key] = true;
        }
        return next;
      });
      setSombrillaReservationError('');

      if (
        includeParking &&
        establishment &&
        establishment.hasParking
      ) {
        const preferredRaw = parkingSpotNumber ? Number.parseInt(String(parkingSpotNumber), 10) : null;
        const plazaNumero = findAvailableParkingSpotForRange(start, end, preferredRaw);

        if (plazaNumero !== null) {
          await handleSaveParkingReservationRange(plazaNumero, fromStr, toStr, {
            customerName,
            customerPhone,
            dailyPrice: parkingDailyPrice ?? '',
            clientId,
            initialPaymentAmount: parkingInitialPaymentAmount,
            initialPaymentMethod: parkingInitialPaymentMethod
          });
        } else {
          setError(
            'Se creó la reserva de sombrilla, pero no se encontró ninguna plaza de estacionamiento disponible para ese rango de fechas.'
          );
        }
      }

      return true;
    } catch (err) {
      console.error('Error calling reservation-groups API (sombrillas)', err);
      setError('No se pudo conectar con el servidor para crear la reserva.');
      return false;
    }
  };

  const handleSaveParkingReservationRange = async (
    plazaNumero,
    startDateStr,
    endDateStr,
    extra = {}
  ) => {
    if (!startDateStr || !endDateStr) {
      setParkingReservationError('Completá la fecha de entrada y la fecha de salida.');
      return false;
    }

    let start = parseLocalDateFromInput(startDateStr);
    let end = parseLocalDateFromInput(endDateStr);

    if (!start || !end) {
      return;
    }

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    setParkingReservationError('');
    const fromStr = format(start, 'yyyy-MM-dd');
    const toStr = format(end, 'yyyy-MM-dd');

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = end.getTime() - start.getTime();
    const daysCount = Math.floor(diffMs / msPerDay) + 1;

    const {
      customerName,
      customerPhone,
      dailyPrice,
      clientId,
      initialPaymentAmount,
      initialPaymentMethod
    } = extra;

    let totalPrice = null;

    if (dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== '') {
      const parsedDaily = Number.parseFloat(String(dailyPrice).replace(',', '.'));
      if (!Number.isNaN(parsedDaily) && daysCount > 0) {
        totalPrice = parsedDaily * daysCount;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservation-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceType: 'parking',
          resourceNumber: plazaNumero,
          startDate: fromStr,
          endDate: toStr,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          dailyPrice:
            dailyPrice !== undefined && dailyPrice !== null && dailyPrice !== ''
              ? String(dailyPrice)
              : '',
          totalPrice: totalPrice !== null ? String(totalPrice) : '',
          notes: '',
          clientId: clientId ?? ''
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }

      if (!response.ok) {
        if (data && data.error === 'no_availability') {
          setParkingReservationError('No hay disponibilidad en esa unidad en la fecha seleccionada.');
        } else {
          console.error('Error creating reservation group for parking', data);
          setError('No se pudo crear la reserva.');
        }
        return false;
      }

      if (data && data.group) {
        setReservationGroups((prev) => {
          const exists = prev.some((g) => g.id === data.group.id);
          if (exists) {
            return prev.map((g) => (g.id === data.group.id ? data.group : g));
          }
          return [...prev, data.group];
        });

        const method = (initialPaymentMethod || '').trim();
        const rawAmount = initialPaymentAmount;

        if (method && rawAmount !== undefined && rawAmount !== null && rawAmount !== '') {
          const amountNum = Number.parseFloat(String(rawAmount).replace(',', '.'));

          if (!Number.isNaN(amountNum) && amountNum > 0) {
            try {
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              const todayStr = `${yyyy}-${mm}-${dd}`;

              const paymentResponse = await fetch(
                `${API_BASE_URL}/api/reservation-groups/${data.group.id}/payments`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    amount: String(rawAmount),
                    paymentDate: todayStr,
                    method,
                    notes: ''
                  })
                }
              );

              if (paymentResponse.ok) {
                const paymentData = await paymentResponse.json();
                if (paymentData.payment) {
                  setReservationGroups((prev) =>
                    prev.map((g) =>
                      g.id === data.group.id
                        ? {
                            ...g,
                            paidAmount:
                              Number(g.paidAmount || 0) + Number(paymentData.payment.amount || 0)
                          }
                        : g
                    )
                  );
                }
              }
            } catch (paymentErr) {
              console.error('Error creating initial payment for parking reservation', paymentErr);
            }
          }
        }
      }

      setParkingReservations((prev) => {
        const next = { ...prev };
        for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
          const dateKeyStr = format(d, 'yyyy-MM-dd');
          const key = `${dateKeyStr}-${plazaNumero}`;
          next[key] = true;
        }
        return next;
      });
      setParkingReservationError('');
      return true;
    } catch (err) {
      console.error('Error calling reservation-groups API (parking)', err);
      setError('No se pudo conectar con el servidor para crear la reserva.');
      return false;
    }
  };

  const handleOpenCarpaReservationFromQuickView = (carpaNumero, day) => {
    const token = authToken || sessionStorage.getItem('authToken');
    if (token) {
      fetchClients(token);
    }

    setCarpaReservationError('');
    const dateStr = format(day, 'yyyy-MM-dd');

    setCarpaReservationForm({
      carpaNumero,
      day,
      isReserved: false,
      startDate: dateStr,
      endDate: '',
      clientId: null,
      customerName: '',
      customerPhone: '',
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

  const handleOpenSombrillaReservationFromQuickView = (sombrillaNumero, day) => {
    const token = authToken || sessionStorage.getItem('authToken');
    if (token) {
      fetchClients(token);
    }

    setSombrillaReservationError('');
    const dateStr = format(day, 'yyyy-MM-dd');

    setSombrillaReservationForm({
      sombrillaNumero,
      day,
      isReserved: false,
      startDate: dateStr,
      endDate: '',
      clientId: null,
      customerName: '',
      customerPhone: '',
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

  const handleOpenParkingReservationFromQuickView = (plazaNumero, day) => {
    const token = authToken || sessionStorage.getItem('authToken');
    if (token) {
      fetchClients(token);
    }

    setParkingReservationError('');
    const dateStr = format(day, 'yyyy-MM-dd');

    setParkingReservationForm({
      plazaNumero,
      day,
      isReserved: false,
      startDate: dateStr,
      endDate: '',
      clientId: null,
      customerName: '',
      customerPhone: '',
      dailyPrice: ''
    });
  };

  const handleReservationGroupFieldChange = (groupId, field, value) => {
    setReservationGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, [field]: value } : g))
    );
  };

  const handleSaveReservationGroup = async (group) => {
    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservation-groups/${group.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customerName: group.customerName || '',
          customerPhone: group.customerPhone || '',
          totalPrice:
            group.totalPrice === undefined || group.totalPrice === null
              ? ''
              : String(group.totalPrice),
          notes: group.notes || '',
          status: group.status
        })
      });

      if (!response.ok) {
        console.error('Error updating reservation group');
        return;
      }

      const data = await response.json();

      if (data.group) {
        setReservationGroups((prev) =>
          prev.map((g) => (g.id === data.group.id ? data.group : g))
        );
      }
    } catch (err) {
      console.error('Error updating reservation group', err);
    }
  };

  const handleCancelReservationGroup = async (group) => {
    if (!group || group.status === 'cancelled') return;

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservation-groups/${group.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (!response.ok) {
        console.error('Error cancelling reservation group');
        return;
      }

      const data = await response.json();

      if (data.group) {
        setReservationGroups((prev) =>
          prev.map((g) => (g.id === data.group.id ? data.group : g))
        );

        if (data.group.serviceType === 'carpa') {
          const start = parseLocalDateFromInput(data.group.startDate);
          const end = parseLocalDateFromInput(data.group.endDate);

          if (start && end) {
            let from = start;
            let to = end;

            if (to < from) {
              const tmp = from;
              from = to;
              to = tmp;
            }

            setCarpasReservations((prev) => {
              const next = { ...prev };
              for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
                const dateKeyStr = format(d, 'yyyy-MM-dd');
                const key = `${dateKeyStr}-${data.group.resourceNumber}`;
                delete next[key];
              }
              return next;
            });
          }
        }

        if (data.group.serviceType === 'sombrilla') {
          const start = parseLocalDateFromInput(data.group.startDate);
          const end = parseLocalDateFromInput(data.group.endDate);

          if (start && end) {
            let from = start;
            let to = end;

            if (to < from) {
              const tmp = from;
              from = to;
              to = tmp;
            }

            setSombrillasReservations((prev) => {
              const next = { ...prev };
              for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
                const dateKeyStr = format(d, 'yyyy-MM-dd');
                const key = `${dateKeyStr}-${data.group.resourceNumber}`;
                delete next[key];
              }
              return next;
            });
          }
        }

        if (data.group.serviceType === 'parking') {
          const start = parseLocalDateFromInput(data.group.startDate);
          const end = parseLocalDateFromInput(data.group.endDate);

          if (start && end) {
            let from = start;
            let to = end;

            if (to < from) {
              const tmp = from;
              from = to;
              to = tmp;
            }

            setParkingReservations((prev) => {
              const next = { ...prev };
              for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
                const dateKeyStr = format(d, 'yyyy-MM-dd');
                const key = `${dateKeyStr}-${data.group.resourceNumber}`;
                delete next[key];
              }
              return next;
            });
          }
        }
      }
    } catch (err) {
      console.error('Error cancelling reservation group', err);
    }
  };

  const handleAddPaymentForReservationGroup = (group) => {
    if (!group) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const totalPriceNumRaw =
      group.totalPrice !== null && group.totalPrice !== undefined && group.totalPrice !== ''
        ? Number.parseFloat(String(group.totalPrice))
        : null;

    const paidAmountNumRaw =
      group.paidAmount !== null && group.paidAmount !== undefined && group.paidAmount !== ''
        ? Number.parseFloat(String(group.paidAmount))
        : 0;

    let defaultAmount = '';
    if (totalPriceNumRaw !== null && !Number.isNaN(totalPriceNumRaw)) {
      const balance = totalPriceNumRaw - (Number.isNaN(paidAmountNumRaw) ? 0 : paidAmountNumRaw);
      if (balance > 0) {
        defaultAmount = balance.toFixed(2);
      }
    }

    setReservationPaymentModal({
      ...group,
      tempAmount: defaultAmount,
      tempPaymentDate: todayStr,
      tempMethod: '',
      tempNotes: ''
    });
  };

  const handleOpenReservationEditModal = (group) => {
    if (!group) return;
    setReservationEditModal({
      ...group,
      tempCustomerName: group.customerName || '',
      tempCustomerPhone: group.customerPhone || '',
      tempTotalPrice: group.totalPrice ?? '',
      tempNotes: group.notes || ''
    });
  };

  const handleViewReservationDetails = (group) => {
    if (!group) return;
    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    let linkedParkingResourceNumber = null;
    let linkedParkingData = null;

    if (group.serviceType === 'carpa' || group.serviceType === 'sombrilla') {
      const maybeParking = reservationGroups.find((g) => {
        if (!g) return false;
        if (g.serviceType !== 'parking') return false;
        if (g.status === 'cancelled') return false;
        if (g.startDate !== group.startDate || g.endDate !== group.endDate) return false;

        if (
          group.clientId &&
          g.clientId &&
          String(g.clientId) === String(group.clientId)
        ) {
          return true;
        }

        if (
          group.customerName &&
          g.customerName &&
          g.customerName === group.customerName
        ) {
          return true;
        }

        return false;
      });

      if (maybeParking) {
        linkedParkingResourceNumber = maybeParking.resourceNumber;
        linkedParkingData = {
          totalPrice: maybeParking.totalPrice,
          paidAmount: maybeParking.paidAmount
        };
      }
    }

    setReservationDetailsModal({
      ...group,
      linkedParkingResourceNumber,
      linkedParkingData,
      payments: [],
      paymentsLoading: true
    });

    if (
      linkedParkingResourceNumber === null &&
      (group.serviceType === 'carpa' || group.serviceType === 'sombrilla') &&
      group.startDate &&
      group.endDate
    ) {
      (async () => {
        try {
          const params = new URLSearchParams();
          params.set('service', 'parking');
          params.set('status', 'active');
          params.set('from', group.startDate);
          params.set('to', group.endDate);

          const url = `${API_BASE_URL}/api/reservation-groups?${params.toString()}`;

          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          if (!response.ok) {
            return;
          }

          const data = await response.json();

          if (!data || !Array.isArray(data.reservationGroups)) {
            return;
          }

          const maybeParking = data.reservationGroups.find((g) => {
            if (!g) return false;
            if (g.serviceType !== 'parking') return false;
            if (g.status === 'cancelled') return false;
            if (g.startDate !== group.startDate || g.endDate !== group.endDate) return false;

            if (
              group.clientId &&
              g.clientId &&
              String(g.clientId) === String(group.clientId)
            ) {
              return true;
            }

            if (
              group.customerName &&
              g.customerName &&
              g.customerName === group.customerName
            ) {
              return true;
            }

            return false;
          });

          if (maybeParking) {
            setReservationDetailsModal((prev) =>
              prev && prev.id === group.id
                ? {
                    ...prev,
                    linkedParkingResourceNumber: maybeParking.resourceNumber,
                    linkedParkingData: {
                      totalPrice: maybeParking.totalPrice,
                      paidAmount: maybeParking.paidAmount
                    }
                  }
                : prev
            );
          }
        } catch (fetchErr) {
          console.error('Error fetching linked parking reservation for details', fetchErr);
        }
      })();
    }

    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/reservation-groups/${group.id}/payments`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          console.error('Error fetching reservation payments');
          setReservationDetailsModal((prev) =>
            prev && prev.id === group.id
              ? { ...prev, paymentsLoading: false }
              : prev
          );
          return;
        }

        const data = await response.json();

        setReservationDetailsModal((prev) =>
          prev && prev.id === group.id
            ? {
                ...prev,
                payments: Array.isArray(data.payments) ? data.payments : [],
                paymentsLoading: false
              }
            : prev
        );
      } catch (err) {
        console.error('Error fetching reservation payments', err);
        setReservationDetailsModal((prev) =>
          prev && prev.id === group.id
            ? { ...prev, paymentsLoading: false }
            : prev
        );
      }
    })();
  };

  const handleNavigateToReservationsWithFilter = (serviceType) => {
    // Cambiar a la sección de reservas
    setActiveSection('reservas');
    
    // Aplicar el filtro de servicio
    if (serviceType) {
      setReservationFilterService(serviceType);
    }
    
    // Limpiar otros filtros para mostrar todas las reservas de ese servicio
    setReservationFilterStatus('');
    setReservationFilterFrom('');
    setReservationFilterTo('');
  };

  const handleSaveReservationPayment = async () => {
    if (!reservationPaymentModal) return;

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    const { id, tempAmount, tempPaymentDate, tempMethod, tempNotes } = reservationPaymentModal;

    // Validamos que haya método de pago seleccionado
    if (!tempMethod) {
      // eslint-disable-next-line no-alert
      window.alert('Seleccioná un método de pago antes de guardar.');
      return;
    }

    // Validamos que el monto no supere el saldo pendiente (si hay total cargado)
    const amountNum =
      tempAmount === undefined || tempAmount === null || tempAmount === ''
        ? NaN
        : Number.parseFloat(String(tempAmount).replace(',', '.'));

    const totalPriceNum =
      reservationPaymentModal.totalPrice !== null &&
      reservationPaymentModal.totalPrice !== undefined &&
      reservationPaymentModal.totalPrice !== ''
        ? Number.parseFloat(String(reservationPaymentModal.totalPrice))
        : null;

    const paidAmountNum =
      reservationPaymentModal.paidAmount !== null &&
      reservationPaymentModal.paidAmount !== undefined &&
      reservationPaymentModal.paidAmount !== ''
        ? Number.parseFloat(String(reservationPaymentModal.paidAmount))
        : 0;

    if (totalPriceNum !== null && !Number.isNaN(totalPriceNum) && !Number.isNaN(amountNum)) {
      const balance = totalPriceNum - (Number.isNaN(paidAmountNum) ? 0 : paidAmountNum);
      if (amountNum > balance + 1e-6) {
        // eslint-disable-next-line no-alert
        window.alert(
          `El monto del pago (${amountNum.toFixed(2)}) no puede ser mayor al saldo pendiente (${balance.toFixed(2)}).`
        );
        return;
      }
    }

    try {
      setReservationPaymentSaving(true);

      const response = await fetch(
        `${API_BASE_URL}/api/reservation-groups/${id}/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            amount:
              tempAmount === undefined || tempAmount === null || tempAmount === ''
                ? ''
                : String(tempAmount),
            paymentDate: tempPaymentDate,
            method: tempMethod || '',
            notes: tempNotes || ''
          })
        }
      );

      if (!response.ok) {
        console.error('Error creating reservation payment');
        return;
      }

      const data = await response.json();

      if (data.payment) {
        setReservationGroups((prev) =>
          prev.map((g) =>
            g.id === id
              ? {
                  ...g,
                  paidAmount:
                    Number(g.paidAmount || 0) + Number(data.payment.amount || 0),
                  payments: Array.isArray(g.payments)
                    ? [...g.payments, data.payment]
                    : [data.payment]
                }
              : g
          )
        );
      }

      setReservationPaymentModal(null);
    } catch (err) {
      console.error('Error creating reservation payment', err);
    } finally {
      setReservationPaymentSaving(false);
    }
  };

  const handleSaveReservationEdit = async () => {
    if (!reservationEditModal) return;

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    const {
      id,
      tempCustomerName,
      tempCustomerPhone,
      tempTotalPrice,
      tempNotes
    } = reservationEditModal;

    try {
      setReservationEditSaving(true);

      const response = await fetch(`${API_BASE_URL}/api/reservation-groups/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customerName: tempCustomerName || '',
          customerPhone: tempCustomerPhone || '',
          totalPrice:
            tempTotalPrice === undefined || tempTotalPrice === null || tempTotalPrice === ''
              ? ''
              : String(tempTotalPrice),
          notes: tempNotes || ''
        })
      });

      if (!response.ok) {
        console.error('Error updating reservation group');
        return;
      }

      const data = await response.json();

      if (data.group) {
        setReservationGroups((prev) =>
          prev.map((g) => (g.id === data.group.id ? data.group : g))
        );
      }

      setReservationEditModal(null);
    } catch (err) {
      console.error('Error updating reservation group', err);
    } finally {
      setReservationEditSaving(false);
    }
  };

  const handleReleaseCarpaReservationRange = async (carpaNumero, startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return;

    let start = parseLocalDateFromInput(startDateStr);
    let end = parseLocalDateFromInput(endDateStr);

    if (!start || !end) {
      return;
    }

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateKeyStr = format(d, 'yyyy-MM-dd');
      const key = `${dateKeyStr}-${carpaNumero}`;
      const isReserved = Boolean(carpasReservations[key]);

      if (isReserved) {
        // Libera sólo los días que ya están reservados
        // eslint-disable-next-line no-await-in-loop
        await handleToggleCarpaReservation(carpaNumero, d);
      }
    }
  };

  const handleReleaseSombrillaReservationRange = async (
    sombrillaNumero,
    startDateStr,
    endDateStr
  ) => {
    if (!startDateStr || !endDateStr) return;

    let start = parseLocalDateFromInput(startDateStr);
    let end = parseLocalDateFromInput(endDateStr);

    if (!start || !end) {
      return;
    }

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateKeyStr = format(d, 'yyyy-MM-dd');
      const key = `${dateKeyStr}-${sombrillaNumero}`;
      const isReserved = Boolean(sombrillasReservations[key]);

      if (isReserved) {
        // Libera sólo los días que ya están reservados
        // eslint-disable-next-line no-await-in-loop
        await handleToggleSombrillaReservation(sombrillaNumero, d);
      }
    }
  };

  const handleReleaseParkingReservationRange = async (
    plazaNumero,
    startDateStr,
    endDateStr
  ) => {
    if (!startDateStr || !endDateStr) return;

    let start = parseLocalDateFromInput(startDateStr);
    let end = parseLocalDateFromInput(endDateStr);

    if (!start || !end) {
      return;
    }

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateKeyStr = format(d, 'yyyy-MM-dd');
      const key = `${dateKeyStr}-${plazaNumero}`;
      const isReserved = Boolean(parkingReservations[key]);

      if (isReserved) {
        // Libera sólo los días que ya están reservados
        // eslint-disable-next-line no-await-in-loop
        await handleToggleParkingReservation(plazaNumero, d);
      }
    }
  };

  if (isAuthenticated) {
    if (!establishmentLoaded) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
          <div className="text-slate-200 text-sm">
            Cargando configuración del establecimiento...
          </div>
        </div>
      );
    }

    if (!establishment) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-2xl p-6 sm:p-8 text-slate-50">
            {/* Header con botón de cerrar sesión */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold mb-1">Configurar establecimiento</h1>
                <p className="text-xs text-slate-400">
                  Antes de empezar, definí el nombre del establecimiento y los servicios que ofrece.
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white transition-colors text-sm"
                title="Cerrar sesión"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </div>
            
            <EstablishmentConfigForm
              variant="dark"
              estName={estName}
              setEstName={setEstName}
              estHasParking={estHasParking}
              setEstHasParking={setEstHasParking}
              estParkingCapacity={estParkingCapacity}
              setEstParkingCapacity={setEstParkingCapacity}
              estHasCarpas={estHasCarpas}
              setEstHasCarpas={setEstHasCarpas}
              estCarpasCapacity={estCarpasCapacity}
              setEstCarpasCapacity={setEstCarpasCapacity}
              estHasSombrillas={estHasSombrillas}
              setEstHasSombrillas={setEstHasSombrillas}
              estSombrillasCapacity={estSombrillasCapacity}
              setEstSombrillasCapacity={setEstSombrillasCapacity}
              estHasPileta={estHasPileta}
              setEstHasPileta={setEstHasPileta}
              estPoolMaxOccupancy={estPoolMaxOccupancy}
              setEstPoolMaxOccupancy={setEstPoolMaxOccupancy}
              onSubmit={handleSaveEstablishment}
              estSaving={estSaving}
              error={error}
              success={success}
            />
          </div>
        </div>
      );
    }
    const navItems = [
      { id: 'inicio', label: 'Inicio' },
      { id: 'vista-diaria', label: 'Vista rápida' },
      { id: 'reservas', label: 'Reservas' }
    ];

    if (establishment?.hasCarpas) {
      navItems.push({ id: 'carpas', label: 'Carpas' });
    }
    if (establishment?.hasSombrillas) {
      navItems.push({ id: 'sombrillas', label: 'Sombrillas' });
    }
    if (establishment?.hasParking) {
      navItems.push({ id: 'estacionamiento', label: 'Estacionamiento' });
    }
    if (establishment?.hasPileta) {
      navItems.push({ id: 'pileta', label: 'Pileta' });
    }

    navItems.push({ id: 'clientes', label: 'Clientes' });
    navItems.push({ id: 'reportes', label: 'Reportes' });

    const sectionTitleMap = {
      inicio: 'Resumen general',
      'vista-diaria': 'Vista rápida',
      reservas: 'Reservas',
      reportes: 'Reportes',
      clientes: 'Clientes',
      carpas: 'Capacidades y reservas',
      sombrillas: 'Capacidades y reservas',
      estacionamiento: 'Capacidades y reservas',
      pileta: 'Pileta'
    };

    return (
      <AuthenticatedShell
        establishment={establishment}
        userEmail={userEmail}
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        onLogout={handleLogout}
        navItems={navItems}
      >
        <>
          {/* Modal de reserva de carpa */}
          {carpaReservationForm && (
            <CarpaReservationModal
              form={carpaReservationForm}
              clients={clients}
              establishment={establishment}
              error={carpaReservationError}
              parseLocalDateFromInput={parseLocalDateFromInput}
              onChangeForm={setCarpaReservationForm}
              onSaveRange={handleSaveCarpaReservationRange}
              onReleaseRange={handleReleaseCarpaReservationRange}
              onClose={() => setCarpaReservationForm(null)}
            />
          )}

          {/* Modal de reserva de estacionamiento */}
          {parkingReservationForm && (
            <ParkingReservationModal
              form={parkingReservationForm}
              clients={clients}
              error={parkingReservationError}
              parseLocalDateFromInput={parseLocalDateFromInput}
              onChangeForm={setParkingReservationForm}
              onSaveRange={handleSaveParkingReservationRange}
              onReleaseRange={handleReleaseParkingReservationRange}
              onClose={() => setParkingReservationForm(null)}
            />
          )}

          {/* Modal de reserva de sombrilla */}
          {sombrillaReservationForm && (
            <SombrillaReservationModal
              form={sombrillaReservationForm}
              clients={clients}
              establishment={establishment}
              error={sombrillaReservationError}
              parseLocalDateFromInput={parseLocalDateFromInput}
              onChangeForm={setSombrillaReservationForm}
              onSaveRange={handleSaveSombrillaReservationRange}
              onReleaseRange={handleReleaseSombrillaReservationRange}
              onClose={() => setSombrillaReservationForm(null)}
            />
          )}

          {/* Modal de edición de reserva madre */}
          {reservationEditModal && (
            <ReservationEditModal
              modal={reservationEditModal}
              setModal={setReservationEditModal}
              saving={reservationEditSaving}
              onSave={handleSaveReservationEdit}
              onClose={() => setReservationEditModal(null)}
            />
          )}

          {/* Modal de detalles de reserva madre */}
          {reservationDetailsModal && (
            <ReservationDetailsModal
              reservation={reservationDetailsModal}
              establishment={establishment}
              parseLocalDateFromInput={parseLocalDateFromInput}
              onClose={() => setReservationDetailsModal(null)}
              onEdit={(group) => {
                handleOpenReservationEditModal(group);
                setReservationDetailsModal(null);
              }}
              onCancel={(group) => {
                // eslint-disable-next-line no-alert
                const confirmed = window.confirm('¿Cancelar esta reserva? Esta acción no se puede deshacer.');
                if (!confirmed) return;
                handleCancelReservationGroup(group);
                setReservationDetailsModal(null);
              }}
              onAddPayment={(group) => {
                handleAddPaymentForReservationGroup(group);
                setReservationDetailsModal(null);
              }}
            />
          )}

          {/* Modal de pago de reserva madre */}
          {reservationPaymentModal && (
            <ReservationPaymentModal
              paymentModal={reservationPaymentModal}
              setPaymentModal={setReservationPaymentModal}
              saving={reservationPaymentSaving}
              onSave={handleSaveReservationPayment}
            />
          )}

          {/* Modal de pase de pileta */}
          {poolPassForm && (
            <PoolPassModal
              form={poolPassForm}
              clients={clients}
              establishment={establishment}
              error={poolPassError}
              parseLocalDateFromInput={parseLocalDateFromInput}
              onChangeForm={setPoolPassForm}
              onSave={handleSavePoolPass}
              onClose={() => setPoolPassForm(null)}
            />
          )}

          {/* Modal de formulario de cliente */}
          {clientFormOpen && (
            <ClientFormModal
              clientForm={clientForm}
              clientSaving={clientSaving}
              onFieldChange={handleClientFieldChange}
              onSubmit={handleSubmitClientForm}
              onCancel={() => {
                handleResetClientForm();
                setClientFormOpen(false);
              }}
            />
          )}

          <div className="w-full max-w-4xl rounded-2xl bg-white/95 border border-cyan-100 shadow-2xl p-5 sm:p-7 text-slate-900">
            {activeSection !== 'pileta' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  {activeSection !== 'clientes' && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700 mb-1">
                      {sectionTitleMap[activeSection] || 'Panel'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={handleLogout}
                    className="inline-flex md:hidden items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-[11px] font-medium text-slate-100 hover:bg-slate-800 hover:border-slate-500 transition"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}

            {/* Sección principal */}
            {activeSection === 'inicio' && (
              <DashboardSection
                establishment={establishment}
                reservationGroups={reservationGroups}
                onViewReservationDetails={handleViewReservationDetails}
                onNavigateToReservationsWithFilter={handleNavigateToReservationsWithFilter}
              />
            )}

            {activeSection === 'vista-diaria' && (
              <DailyViewSection
                establishment={establishment}
                carpasReservations={carpasReservations}
                sombrillasReservations={sombrillasReservations}
                parkingReservations={parkingReservations}
                carpasDayOffset={carpasDayOffset}
                sombrillasDayOffset={sombrillasDayOffset}
                parkingDayOffset={parkingDayOffset}
                quickViewLookaheadDays={QUICK_VIEW_LOOKAHEAD_DAYS}
                reservationGroups={reservationGroups}
                onViewReservationDetails={handleViewReservationDetails}
                onOpenNewCarpaReservation={handleOpenCarpaReservationFromQuickView}
                onFilterStatusChange={(value) => setReservationFilterStatus(value)}
                onFilterFromChange={(value) => setReservationFilterFrom(value)}
                onFilterToChange={(value) => setReservationFilterTo(value)}
                onClearFilters={() => {
                  setReservationFilterService('');
                  setReservationFilterStatus('active');
                  setReservationFilterFrom('');
                  setReservationFilterTo('');
                }}
                onViewDetails={handleViewReservationDetails}
                onAddPayment={handleAddPaymentForReservationGroup}
              />
            )}

            {activeSection === 'reservas' && (
              <ReservasSection
                reservationGroups={reservationGroups}
                reservationGroupsLoading={reservationGroupsLoading}
                reservationFilterService={reservationFilterService}
                reservationFilterStatus={reservationFilterStatus}
                reservationFilterFrom={reservationFilterFrom}
                reservationFilterTo={reservationFilterTo}
                onFilterServiceChange={(value) => setReservationFilterService(value)}
                onFilterStatusChange={(value) => setReservationFilterStatus(value)}
                onFilterFromChange={(value) => setReservationFilterFrom(value)}
                onFilterToChange={(value) => setReservationFilterTo(value)}
                onClearFilters={() => {
                  setReservationFilterService('');
                  setReservationFilterStatus('active');
                  setReservationFilterFrom('');
                  setReservationFilterTo('');
                }}
                onViewDetails={handleViewReservationDetails}
                onAddPayment={handleAddPaymentForReservationGroup}
              />
            )}

            {activeSection === 'reportes' && (
              <ReportsPaymentsSection authToken={authToken} />
            )}

            {activeSection === 'clientes' && (
              <ClientsSection
                clients={clients}
                clientsLoading={clientsLoading}
                clientDeletingId={clientDeletingId}
                onNewClient={() => {
                  handleResetClientForm();
                  setClientFormOpen(true);
                }}
                onEditClient={handleEditClient}
                onDeleteClient={handleDeleteClient}
                onViewReservationDetails={handleViewReservationDetails}
              />
            )}

            {activeSection === 'carpas' && (
              <CarpasSection
                establishment={establishment}
                carpasDayOffset={carpasDayOffset}
                setCarpasDayOffset={setCarpasDayOffset}
                carpasReservations={carpasReservations}
                reservationGroups={reservationGroups}
                hoveredReservationGroupId={hoveredReservationGroupId}
                setHoveredReservationGroupId={setHoveredReservationGroupId}
                parseLocalDateFromInput={parseLocalDateFromInput}
                onViewReservationDetails={handleViewReservationDetails}
                authToken={authToken}
                fetchClients={fetchClients}
                setCarpaReservationError={setCarpaReservationError}
                setCarpaReservationForm={setCarpaReservationForm}
                CARPA_RESERVATION_COLORS={CARPA_RESERVATION_COLORS}
              />
            )}

            {activeSection === 'config-establecimiento' && (
              <div className="rounded-xl bg-sky-50 border border-cyan-100 px-4 py-4 text-sm">
                <p className="text-slate-900 font-medium mb-2">Configurar establecimiento</p>
                <p className="text-[11px] text-slate-600 mb-4">
                  Actualizá el nombre y los servicios del establecimiento. Los cambios impactan en todas las secciones.
                </p>
                <EstablishmentConfigForm
                  variant="light"
                  estName={estName}
                  setEstName={setEstName}
                  estHasParking={estHasParking}
                  setEstHasParking={setEstHasParking}
                  estParkingCapacity={estParkingCapacity}
                  setEstParkingCapacity={setEstParkingCapacity}
                  estHasCarpas={estHasCarpas}
                  setEstHasCarpas={setEstHasCarpas}
                  estCarpasCapacity={estCarpasCapacity}
                  setEstCarpasCapacity={setEstCarpasCapacity}
                  estHasSombrillas={estHasSombrillas}
                  setEstHasSombrillas={setEstHasSombrillas}
                  estSombrillasCapacity={estSombrillasCapacity}
                  setEstSombrillasCapacity={setEstSombrillasCapacity}
                  estHasPileta={estHasPileta}
                  setEstHasPileta={setEstHasPileta}
                  estPoolMaxOccupancy={estPoolMaxOccupancy}
                  setEstPoolMaxOccupancy={setEstPoolMaxOccupancy}
                  onSubmit={handleSaveEstablishment}
                  estSaving={estSaving}
                  error={error}
                  success={success}
                />
              </div>
            )}

            {activeSection === 'sombrillas' && (
              <SombrillasSection
                establishment={establishment}
                sombrillasDayOffset={sombrillasDayOffset}
                setSombrillasDayOffset={setSombrillasDayOffset}
                sombrillasReservations={sombrillasReservations}
                reservationGroups={reservationGroups}
                hoveredReservationGroupId={hoveredReservationGroupId}
                setHoveredReservationGroupId={setHoveredReservationGroupId}
                parseLocalDateFromInput={parseLocalDateFromInput}
                onViewReservationDetails={handleViewReservationDetails}
                authToken={authToken}
                fetchClients={fetchClients}
                setSombrillaReservationError={setSombrillaReservationError}
                setSombrillaReservationForm={setSombrillaReservationForm}
                CARPA_RESERVATION_COLORS={CARPA_RESERVATION_COLORS}
              />
            )}

            {activeSection === 'estacionamiento' && (
              <EstacionamientoSection
                establishment={establishment}
                parkingDayOffset={parkingDayOffset}
                setParkingDayOffset={setParkingDayOffset}
                parkingReservations={parkingReservations}
                reservationGroups={reservationGroups}
                hoveredReservationGroupId={hoveredReservationGroupId}
                setHoveredReservationGroupId={setHoveredReservationGroupId}
                parseLocalDateFromInput={parseLocalDateFromInput}
                onViewReservationDetails={handleViewReservationDetails}
                authToken={authToken}
                fetchClients={fetchClients}
                setParkingReservationError={setParkingReservationError}
                setParkingReservationForm={setParkingReservationForm}
                CARPA_RESERVATION_COLORS={CARPA_RESERVATION_COLORS}
              />
            )}

            {activeSection === 'pileta' && (
              <PiletaSection
                establishment={establishment}
                reservationGroups={reservationGroups}
                reservationGroupsLoading={reservationGroupsLoading}
                onViewReservationDetails={handleViewReservationDetails}
                onOpenNewPoolPass={handleOpenNewPoolPass}
              />
            )}
          </div>
        </>
      </AuthenticatedShell>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-200 via-cyan-200 to-amber-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/95 shadow-2xl p-7">
        <h1 className="text-2xl font-semibold text-center text-slate-800 mb-1">
          Login Balnearios
        </h1>
        <p className="text-xs text-center text-slate-500 mb-6">
          Accedé al panel de gestión de tu balneario.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-slate-700">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-400/50 transition hover:bg-cyan-600 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-center text-xs text-red-600">{error}</p>
        )}

        {success && (
          <p className="mt-4 text-center text-xs text-green-600">{success}</p>
        )}
      </div>
    </div>
  );
}

export default App;
