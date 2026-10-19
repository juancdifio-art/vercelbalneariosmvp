import { useState, useEffect } from 'react';
import { addDays, isSameDay } from 'date-fns';
import { format } from './lib/dates';
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
import TarifasSection from './components/tarifas/TarifasSection';
import CarpaReservationModal from './components/CarpaReservationModal';
import ParkingReservationModal from './components/ParkingReservationModal';
import SombrillaReservationModal from './components/SombrillaReservationModal';
import PoolPassModal from './components/PoolPassModal';
import ReservationEditModal from './components/ReservationEditModal';
import EstablishmentConfigForm from './components/EstablishmentConfigForm';
import BandejaSoporte from './components/soporte/BandejaSoporte';
import PanelUsuarioSection from './components/PanelUsuarioSection';
import ClientDetailsModal from './components/ClientDetailsModal';
import AuthenticatedShell from './components/AuthenticatedShell';
import AvisoGlobal from './components/AvisoGlobal';
import DailyViewSection from './components/DailyViewSection';
import { normalizarPatente } from './lib/patente';
import { precioDesdeReserva } from './lib/tarifas';
import { armarIncluidos, mensajeErrorIncluidos, cambiosIncluidos } from './lib/incluidos';
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
    setUserEmail,
    userRole,
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

  // Sube cada vez que un cambio toca varias reservas a la vez (una carpa con
  // sus incluidos): las grillas y listas que dependen de esto se vuelven a pedir.
  const [datosVersion, setDatosVersion] = useState(0);
  const refrescarDatos = () => setDatosVersion((v) => v + 1);
  // A que reserva abierta va el cliente que se esta creando desde un modal.
  const [clienteNuevoPara, setClienteNuevoPara] = useState(null);
  // La reserva desde cuyo detalle se abrio otro modal (editar, agendar pago,
  // vender pase de pileta): al guardar o cerrar ese modal se vuelve a su detalle.
  const [volverACarpa, setVolverACarpa] = useState(null);

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
    estAjustes,
    setEstAjustes,
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
  // Ficha del cliente abierta desde una reserva: { id, nombre }. El nombre es
  // el respaldo por si la lista de clientes todavia no esta cargada.
  const [fichaCliente, setFichaCliente] = useState(null);
  const [reservationPaymentModal, setReservationPaymentModal] = useState(null);
  const [reservationPaymentSaving, setReservationPaymentSaving] = useState(false);
  const [reservationEditModal, setReservationEditModal] = useState(null);
  const [reservationEditSaving, setReservationEditSaving] = useState(false);
  const [reservationEditError, setReservationEditError] = useState('');

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

    // Cargar reservas (si no hay servicio seleccionado, carga todas)
    fetchReservationGroups(token);
  }, [
    datosVersion,
    isAuthenticated,
    activeSection,
    authToken,
    reservationFilterService,
    reservationFilterStatus,
    reservationFilterFrom,
    reservationFilterTo,
    fetchReservationGroups,
    setReservationGroups
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeSection !== 'vista-diaria') return;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    const today = new Date();
    const from = format(today, 'yyyy-MM-dd');
    const to = format(addDays(today, QUICK_VIEW_LOOKAHEAD_DAYS - 1), 'yyyy-MM-dd');


    fetchReservationGroups(token, {
      status: 'active',
      from,
      to
    });
  }, [datosVersion, isAuthenticated, activeSection, authToken, fetchReservationGroups]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeSection !== 'inicio') return;

    const token = authToken || sessionStorage.getItem('authToken');
    if (!token) return;

    // Cargar todas las reservas activas para el dashboard (independiente de los filtros de Reservas)
    fetchReservationGroups(token, {
      status: 'active',
      service: '',
      from: '',
      to: ''
    });
  }, [datosVersion, isAuthenticated, activeSection, authToken, fetchReservationGroups]);

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
  }, [datosVersion, isAuthenticated, establishment, activeSection, authToken, fetchReservationGroups]);

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
  }, [datosVersion, isAuthenticated, establishment, carpasDayOffset, authToken]);

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
  }, [datosVersion, isAuthenticated, establishment, activeSection, carpasDayOffset, authToken, fetchReservationGroups]);

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
  }, [datosVersion, isAuthenticated, establishment, sombrillasDayOffset, authToken]);

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
  }, [datosVersion, isAuthenticated, establishment, activeSection, sombrillasDayOffset, authToken, fetchReservationGroups]);

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
  }, [datosVersion, isAuthenticated, establishment, parkingDayOffset, authToken]);

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
  }, [datosVersion, isAuthenticated, establishment, activeSection, parkingDayOffset, authToken, fetchReservationGroups]);

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

  // Los pases pagos asociados no se mueven ni se cancelan con la carpa: se avisa.
  const avisarPasesPagos = (n, accion) => {
    if (!n) return;
    setSuccess(`La carpa ${accion}. Tiene ${n === 1 ? '1 pase de pileta pago asociado' : `${n} pases de pileta pagos asociados`}: revisalo.`);
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
      adultsCount,
      childrenCount,
      precio,
      clientId,
      incluyePileta,
      cocheras,
      personas,
      titular,
      pasePago,
      pagoInicial
    } = extra;

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
          totalPrice: precio?.cobrado ?? '',
          motivoAjuste: precio?.motivo ?? '',
          notes: '',
          clientId: clientId ?? '',
          adultsCount: String(adultsCount ?? ''),
          childrenCount: String(childrenCount ?? ''),
          // Pileta y cocheras: el servidor crea todo junto o nada.
          incluidos: armarIncluidos({ incluyePileta, cocheras }),
          // Acompanantes de esta reserva y datos del titular (van a su ficha).
          personas,
          titular,
          // Pases de pileta pagos (precio por dia) y un solo pago por toda la
          // cuenta: el servidor lo reparte y lo guarda en la misma transaccion.
          pasePago,
          pagoInicial
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }

      if (!response.ok) {
        // Si una cochera o la pileta no se pudo reservar, no se guardo nada.
        const mensaje = mensajeErrorIncluidos(data);
        if (mensaje) {
          setCarpaReservationError(mensaje);
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

      const cocherasCreadas = data?.incluidos?.cocheras || [];
      if (cocherasCreadas.length) {
        const plazas = cocherasCreadas.map((c) => c.plaza).join(', ');
        setSuccess(`Reserva guardada. ${cocherasCreadas.length === 1 ? 'Cochera en la plaza' : 'Cocheras en las plazas'} ${plazas}.`);
      }
      if (cocherasCreadas.length || data?.incluidos?.pileta || data?.incluidos?.pasePago || data?.pago) {
        refrescarDatos();
      }
      // La ficha del titular pudo haberse completado con DNI y fecha de nacimiento.
      if (titular && clientId) {
        fetchClients(token);
      }

      return true;
    } catch (err) {
      console.error('Error calling reservation-groups API', err);
      setError('No se pudo conectar con el servidor para crear la reserva.');
      return false;
    }
  };

  // Pase de pileta pago para personas de la carpa que no tienen pase.
  const handleVenderPase = async (carpa) => {
    const token = authToken || sessionStorage.getItem('authToken');
    if (!token || !carpa) return;
    const headers = { Authorization: `Bearer ${token}` };
    const leer = async (url, clave) => {
      try {
        const res = await fetch(`${API_BASE_URL}${url}`, { headers });
        if (!res.ok) return [];
        const data = await res.json();
        return data[clave] || [];
      } catch (err) {
        console.error('Error leyendo personas de la carpa', err);
        return [];
      }
    };

    const idsPases = [
      carpa.incluidos?.pileta?.id,
      ...(carpa.incluidos?.pasesPagos || []).map((p) => p.id)
    ].filter(Boolean);
    const [guests, ...conPase] = await Promise.all([
      leer(`/api/reservation-groups/${carpa.id}/guests`, 'guests'),
      ...idsPases.map((id) => leer(`/api/reservation-groups/${id}/pase-personas`, 'personas'))
    ]);
    const tienen = conPase.flat();
    const titular = (clients || []).find((c) => Number(c.id) === Number(carpa.clientId));

    const disponibles = [
      ...(titular && !tienen.some((p) => Number(p.clientId) === Number(titular.id))
        ? [{ key: `c-${titular.id}`, clientId: titular.id, fullName: titular.fullName, documentNumber: titular.documentNumber, birthDate: titular.birthDate }]
        : []),
      ...guests
        .filter((g) => !tienen.some((p) => Number(p.guestId) === Number(g.id)))
        .map((g) => ({ key: `g-${g.id}`, guestId: g.id, fullName: g.fullName, documentNumber: g.documentNumber, age: g.age, birthDate: g.birthDate }))
    ];

    setPoolPassError('');
    // El detalle se cierra para no apilar modales; al guardar o cerrar el
    // pase se vuelve a esta carpa.
    setVolverACarpa(carpa);
    setReservationDetailsModal(null);
    setPoolPassForm({
      startDate: carpa.startDate,
      endDate: carpa.endDate,
      clientId: carpa.clientId ?? null,
      customerName: carpa.customerName || '',
      customerPhone: carpa.customerPhone || '',
      poolAdultsCount: '0',
      poolChildrenCount: '0',
      poolAdultPricePerDay: '',
      poolChildPricePerDay: '',
      initialPaymentAmount: '',
      initialPaymentMethod: '',
      incluidaEnReservaId: carpa.id,
      carpaEtiqueta: `${carpa.serviceType === 'sombrilla' ? 'Sombrilla' : 'Carpa'} ${carpa.resourceNumber}`,
      personasDisponibles: disponibles,
      personasElegidas: []
    });
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

    // Calculate days count
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = end.getTime() - start.getTime();
    const daysCount = Math.floor(diffMs / msPerDay) + 1;

    // Calculate prices
    const adults = Number.parseInt(String(poolAdultsCount || '0'), 10);
    const children = Number.parseInt(String(poolChildrenCount || '0'), 10);
    const adultPrice = poolAdultPricePerDay ? Number.parseFloat(String(poolAdultPricePerDay).replace(',', '.')) : 0;
    const childPrice = poolChildPricePerDay ? Number.parseFloat(String(poolChildPricePerDay).replace(',', '.')) : 0;
    const dailyPrice = adults * adultPrice + children * childPrice;
    const totalPrice = dailyPrice * daysCount;

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
          dailyPrice: dailyPrice > 0 ? String(dailyPrice) : '',
          totalPrice: totalPrice > 0 ? String(totalPrice) : '',
          notes: '',
          clientId: clientId ?? '',
          adultsCount: String(adults),
          childrenCount: String(children),
          poolAdultPricePerDay: poolAdultPricePerDay ? String(poolAdultPricePerDay) : '',
          poolChildPricePerDay: poolChildPricePerDay ? String(poolChildPricePerDay) : '',
          // Pase pago vendido desde una carpa: queda asociado a ella.
          incluidaEnReservaId: form.incluidaEnReservaId || undefined
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

      const paseCreado = data && (data.group || data.reservationGroup);
      if (paseCreado) {
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
                `${API_BASE_URL}/api/reservation-groups/${paseCreado.id}/payments`,
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

              if (!paymentResponse.ok) {
                console.error('Error creating initial payment for pool pass');
              }
            } catch (paymentErr) {
              console.error('Error creating initial payment for pool pass', paymentErr);
            }
          }
        }
      }

      // Las personas elegidas de la carpa quedan con este pase.
      const elegidas = (form.personasDisponibles || []).filter((p) => (form.personasElegidas || []).includes(p.key));
      if (paseCreado && form.incluidaEnReservaId && elegidas.length) {
        const res = await fetch(`${API_BASE_URL}/api/reservation-groups/${paseCreado.id}/pase-personas`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            guestIds: elegidas.filter((p) => p.guestId).map((p) => p.guestId),
            incluyeTitular: elegidas.some((p) => p.clientId)
          })
        });
        if (!res.ok) {
          const falla = await res.json().catch(() => null);
          setError(`Se creó el pase, pero no se pudieron asignar las personas: ${mensajeErrorIncluidos(falla) || 'error del servidor'}.`);
        }
      }

      // Refresh the list from server
      await fetchReservationGroups(token);
      if (form.incluidaEnReservaId) refrescarDatos();

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
      adultsCount,
      childrenCount,
      precio,
      clientId,
      incluyePileta,
      cocheras,
      personas,
      titular,
      pasePago,
      pagoInicial
    } = extra;

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
          totalPrice: precio?.cobrado ?? '',
          motivoAjuste: precio?.motivo ?? '',
          notes: '',
          clientId: clientId ?? '',
          adultsCount: String(adultsCount ?? ''),
          childrenCount: String(childrenCount ?? ''),
          // Pileta y cocheras: el servidor crea todo junto o nada.
          incluidos: armarIncluidos({ incluyePileta, cocheras }),
          // Acompanantes de esta reserva y datos del titular (van a su ficha).
          personas,
          titular,
          // Pases de pileta pagos (precio por dia) y un solo pago por toda la
          // cuenta: el servidor lo reparte y lo guarda en la misma transaccion.
          pasePago,
          pagoInicial
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }

      if (!response.ok) {
        // Si una cochera o la pileta no se pudo reservar, no se guardo nada.
        const mensaje = mensajeErrorIncluidos(data);
        if (mensaje) {
          setSombrillaReservationError(mensaje);
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

      const cocherasCreadas = data?.incluidos?.cocheras || [];
      if (cocherasCreadas.length) {
        const plazas = cocherasCreadas.map((c) => c.plaza).join(', ');
        setSuccess(`Reserva guardada. ${cocherasCreadas.length === 1 ? 'Cochera en la plaza' : 'Cocheras en las plazas'} ${plazas}.`);
      }
      if (cocherasCreadas.length || data?.incluidos?.pileta || data?.incluidos?.pasePago || data?.pago) {
        refrescarDatos();
      }
      // La ficha del titular pudo haberse completado con DNI y fecha de nacimiento.
      if (titular && clientId) {
        fetchClients(token);
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
      adultsCount,
      childrenCount,
      precio,
      clientId,
      initialPaymentAmount,
      initialPaymentMethod,
      vehiclePlate
    } = extra;

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
          totalPrice: precio?.cobrado ?? '',
          motivoAjuste: precio?.motivo ?? '',
          notes: '',
          clientId: clientId ?? '',
          adultsCount: String(adultsCount ?? ''),
          childrenCount: String(childrenCount ?? ''),
          vehiclePlate: vehiclePlate || ''
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
        } else if (data && data.error === 'vehicle_plate_required') {
          const msg = 'Falta la patente del vehículo: es obligatoria para usar el estacionamiento.';
          setParkingReservationError(msg);
          setError(msg);
        } else if (data && data.error === 'motivo_ajuste_required') {
          setParkingReservationError('El total es distinto al de la tarifa: falta el motivo del ajuste.');
        } else if (data && (data.error === 'rango_invalido' || data.error === 'fecha_invalida')) {
          setParkingReservationError('Revisá las fechas: la salida no puede ser anterior a la entrada.');
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
      adultsCount: '',
      childrenCount: '',
      dailyPrice: '',
      incluyePileta: false,
      cocheras: [],
      initialPaymentAmount: '',
      initialPaymentMethod: ''
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
      adultsCount: '',
      childrenCount: '',
      dailyPrice: '',
      incluyePileta: false,
      cocheras: [],
      initialPaymentAmount: '',
      initialPaymentMethod: ''
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
      adultsCount: '',
      childrenCount: '',
      dailyPrice: '',
      initialPaymentAmount: '',
      initialPaymentMethod: ''
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
        const falla = await response.json().catch(() => null);
        setError(mensajeErrorIncluidos(falla) || 'No se pudo cancelar la reserva.');
        return;
      }

      const data = await response.json();
      avisarPasesPagos(data.adicionalesAsociados, 'se canceló');
      if (['carpa', 'sombrilla'].includes(group.serviceType)) {
        refrescarDatos();
      }

      if (data.reservationGroup) {
        if (data.reservationGroup.serviceType === 'carpa') {
          const start = parseLocalDateFromInput(data.reservationGroup.startDate);
          const end = parseLocalDateFromInput(data.reservationGroup.endDate);

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
                const key = `${dateKeyStr}-${data.reservationGroup.resourceNumber}`;
                delete next[key];
              }
              return next;
            });
          }
        }

        if (data.reservationGroup.serviceType === 'sombrilla') {
          const start = parseLocalDateFromInput(data.reservationGroup.startDate);
          const end = parseLocalDateFromInput(data.reservationGroup.endDate);

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
                const key = `${dateKeyStr}-${data.reservationGroup.resourceNumber}`;
                delete next[key];
              }
              return next;
            });
          }
        }

        if (data.reservationGroup.serviceType === 'parking') {
          const start = parseLocalDateFromInput(data.reservationGroup.startDate);
          const end = parseLocalDateFromInput(data.reservationGroup.endDate);

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
                const key = `${dateKeyStr}-${data.reservationGroup.resourceNumber}`;
                delete next[key];
              }
              return next;
            });
          }
        }
      }

      // Refresh the list from server
      await fetchReservationGroups(token);
    } catch (err) {
      console.error('Error cancelling reservation group', err);
    }
  };

  // `cuenta` ({ total, pagado }) viene del detalle de una carpa con servicios
  // asociados: el pago se cobra contra el saldo de toda la cuenta.
  const handleAddPaymentForReservationGroup = (group, cuenta = null) => {
    if (!group) return;
    if (cuenta) {
      const saldo = cuenta.total - cuenta.pagado;
      setReservationPaymentModal({
        ...group,
        esCuenta: true,
        totalPrice: cuenta.total,
        paidAmount: cuenta.pagado,
        tempAmount: saldo > 0 ? saldo.toFixed(2) : '',
        tempPaymentDate: format(new Date(), 'yyyy-MM-dd'),
        tempMethod: '',
        tempNotes: ''
      });
      return;
    }

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
    setReservationEditError('');
    setReservationEditModal({
      ...group,
      tempCustomerName: group.customerName || '',
      tempCustomerPhone: group.customerPhone || '',
      tempDailyPrice: group.dailyPrice ?? '',
      tempTotalPrice: group.totalPrice ?? '',
      tempNotes: group.notes || '',
      tempVehiclePlate: group.vehiclePlate || '',
      tempPrecio: precioDesdeReserva(group),
      tempIncluyePileta: undefined,
      tempCocherasCanceladas: [],
      cocheras: []
    });
  };

  // Desde un servicio incluido o un pase pago: abrir la reserva de su carpa.
  // Puede no estar en la lista cargada (la seccion Pileta trae solo pases).
  const abrirReservaVinculada = async (group) => {
    const id = group?.incluidaEnReservaId;
    if (!id) return;
    let madre = reservationGroups.find((g) => Number(g.id) === Number(id));
    if (!madre) {
      const token = authToken || sessionStorage.getItem('authToken');
      try {
        const params = new URLSearchParams({ service: group.incluidaEnTipo || 'carpa', from: group.startDate, to: group.endDate });
        const res = await fetch(`${API_BASE_URL}/api/reservation-groups?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        madre = (data.reservationGroups || []).find((g) => Number(g.id) === Number(id));
      } catch (err) {
        console.error('Error buscando la reserva de la carpa', err);
      }
    }
    setReservationEditModal(null);
    setVolverACarpa(null);
    if (madre) {
      handleViewReservationDetails(madre);
    } else {
      setError('No se encontró la reserva de la carpa.');
    }
  };

  // Vuelve a abrir el detalle de una reserva con sus datos al dia (por ejemplo,
  // con el pase pago que se le acaba de vender). Si no se puede traer del
  // servidor, se abre con lo que ya se tenia.
  const reabrirReserva = async (reserva) => {
    if (!reserva) return;
    const token = authToken || sessionStorage.getItem('authToken');
    const buscar = async (filtros) => {
      const params = new URLSearchParams({ service: reserva.serviceType, ...filtros });
      const res = await fetch(`${API_BASE_URL}/api/reservation-groups?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.reservationGroups || []).find((g) => Number(g.id) === Number(reserva.id)) || null;
    };
    let fresca = null;
    try {
      // Si se acaban de cambiar sus fechas puede no estar en el rango viejo.
      fresca = (await buscar({ from: reserva.startDate, to: reserva.endDate })) || (await buscar({}));
    } catch (err) {
      console.error('Error actualizando la reserva', err);
    }
    handleViewReservationDetails(fresca || reserva);
  };

  const volverAlDetalle = () => {
    if (!volverACarpa) return;
    reabrirReserva(volverACarpa);
    setVolverACarpa(null);
  };

  const handleViewReservationDetails = (group) => {
    if (!group) return;
    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      setIsAuthenticated(false);
      return;
    }

    // El titular (datos de su ficha) puede ocupar un pase de pileta: hace
    // falta la lista de clientes aunque la seccion no la haya cargado.
    if (group.clientId && !(clients || []).some((c) => Number(c.id) === Number(group.clientId))) {
      fetchClients(token);
    }

    // Los servicios incluidos vienen con el vinculo real (incluidos /
    // incluidaEnReservaId): ya no se busca una cochera "parecida".
    setReservationDetailsModal({
      ...group,
      payments: [],
      paymentsLoading: true
    });

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

    // Pago de la cuenta de una carpa: el servidor lo reparte en orden entre
    // la carpa, las cocheras y la pileta paga.
    if (reservationPaymentModal.esCuenta) {
      try {
        setReservationPaymentSaving(true);
        const response = await fetch(`${API_BASE_URL}/api/reservation-groups/${id}/pago-cuenta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: String(tempAmount ?? ''), paymentDate: tempPaymentDate, method: tempMethod, notes: tempNotes || '' })
        });
        if (!response.ok) {
          const falla = await response.json().catch(() => null);
          // eslint-disable-next-line no-alert
          window.alert(mensajeErrorIncluidos(falla) || 'No se pudo registrar el pago.');
          return;
        }
        setReservationPaymentModal(null);
        volverAlDetalle();
        refrescarDatos();
        await fetchReservationGroups(token, {
          service: reservationFilterService,
          status: reservationFilterStatus,
          from: reservationFilterFrom,
          to: reservationFilterTo
        });
      } catch (err) {
        console.error('Error registrando el pago de la cuenta', err);
      } finally {
        setReservationPaymentSaving(false);
      }
      return;
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
      volverAlDetalle();
    } catch (err) {
      console.error('Error creating reservation payment', err);
    } finally {
      setReservationPaymentSaving(false);
    }
  };

  const handleSaveReservationEdit = async ({ plazasCocheras = [] } = {}) => {
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
      tempDailyPrice,
      tempTotalPrice,
      tempNotes,
      tempVehiclePlate,
      tempResourceNumber,
      resourceNumber,
      serviceType,
      startDate,
      endDate,
      tempStartDate,
      tempEndDate,
      dailyPrice,
      tempPrecio,
      // Pool-specific fields
      tempPoolAdultsCount,
      tempPoolChildrenCount,
      tempPoolAdultPricePerDay,
      tempPoolChildPricePerDay,
      adultsCount,
      childrenCount,
      poolAdultPricePerDay,
      poolChildPricePerDay
    } = reservationEditModal;

    try {
      setReservationEditSaving(true);

      // Preparar el body con los campos actualizables
      const updateBody = {
        customerName: tempCustomerName || '',
        customerPhone: tempCustomerPhone || '',
        dailyPrice:
          tempDailyPrice === undefined || tempDailyPrice === null || tempDailyPrice === ''
            ? (dailyPrice ?? '')
            : String(tempDailyPrice),
        totalPrice:
          tempTotalPrice === undefined || tempTotalPrice === null || tempTotalPrice === ''
            ? ''
            : String(tempTotalPrice),
        notes: tempNotes || ''
      };

      // En estacionamiento la patente es obligatoria; el modal no deja guardarla vacia.
      if (serviceType === 'parking') {
        updateBody.vehiclePlate = normalizarPatente(tempVehiclePlate);
      }

      // Carpa, sombrilla y estacionamiento: el servidor recalcula; se manda lo cobrado y el motivo.
      if (serviceType !== 'pileta') {
        delete updateBody.dailyPrice;
        updateBody.totalPrice = tempPrecio?.cobrado ?? '';
        updateBody.motivoAjuste = tempPrecio?.motivo ?? '';
      }

      // Agregar campos de pileta solo si el servicio es pileta
      if (serviceType === 'pileta') {
        const finalPoolAdultsCount = tempPoolAdultsCount !== undefined ? tempPoolAdultsCount : (adultsCount ?? 0);
        const finalPoolChildrenCount = tempPoolChildrenCount !== undefined ? tempPoolChildrenCount : (childrenCount ?? 0);
        const finalPoolAdultPricePerDay = tempPoolAdultPricePerDay !== undefined ? tempPoolAdultPricePerDay : (poolAdultPricePerDay ?? 0);
        const finalPoolChildPricePerDay = tempPoolChildPricePerDay !== undefined ? tempPoolChildPricePerDay : (poolChildPricePerDay ?? 0);

        updateBody.adultsCount = finalPoolAdultsCount;
        updateBody.childrenCount = finalPoolChildrenCount;
        updateBody.poolAdultPricePerDay = finalPoolAdultPricePerDay;
        updateBody.poolChildPricePerDay = finalPoolChildPricePerDay;

        // Calcular dailyPrice y totalPrice automáticamente para pileta
        const adults = Number.parseInt(String(finalPoolAdultsCount), 10) || 0;
        const children = Number.parseInt(String(finalPoolChildrenCount), 10) || 0;
        const adultPrice = Number.parseFloat(String(finalPoolAdultPricePerDay)) || 0;
        const childPrice = Number.parseFloat(String(finalPoolChildPricePerDay)) || 0;

        const calculatedDailyTotal = adults * adultPrice + children * childPrice;

        // Calcular días
        const finalStartDate = tempStartDate || startDate;
        const finalEndDate = tempEndDate || endDate;
        let daysCount = 1;
        if (finalStartDate && finalEndDate) {
          const startParts = String(finalStartDate).split('-');
          const endParts = String(finalEndDate).split('-');
          const sDate = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
          const eDate = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
          const msPerDay = 24 * 60 * 60 * 1000;
          daysCount = Math.round((eDate - sDate) / msPerDay) + 1;
          if (daysCount <= 0) daysCount = 1;
        }

        const calculatedTotalPrice = calculatedDailyTotal * daysCount;

        updateBody.dailyPrice = String(calculatedDailyTotal);
        updateBody.totalPrice = String(calculatedTotalPrice);
      }

      // Carpa o sombrilla: pileta y cocheras que se agregan o se quitan.
      const cambios = ['carpa', 'sombrilla'].includes(serviceType) ? cambiosIncluidos(reservationEditModal, plazasCocheras) : undefined;
      if (cambios) {
        updateBody.incluidos = cambios;
      }

      // Agregar resourceNumber solo si cambió
      const resourceNumberChanged = tempResourceNumber !== undefined && tempResourceNumber !== resourceNumber;
      if (resourceNumberChanged) {
        updateBody.resourceNumber = tempResourceNumber;
      }

      // Agregar fechas solo si cambiaron
      const startDateChanged = tempStartDate && tempStartDate !== startDate;
      const endDateChanged = tempEndDate && tempEndDate !== endDate;
      if (startDateChanged) {
        updateBody.startDate = tempStartDate;
      }
      if (endDateChanged) {
        updateBody.endDate = tempEndDate;
      }

      const response = await fetch(`${API_BASE_URL}/api/reservation-groups/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updateBody)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const mensaje = mensajeErrorIncluidos(data);
        if (mensaje) {
          setReservationEditError(mensaje);
        } else {
          console.error('Error updating reservation group');
        }
        return;
      }

      setReservationEditError('');
      const respuesta = await response.json().catch(() => null);

      avisarPasesPagos(respuesta?.adicionalesAsociados, 'cambió de fechas');
      if (cambios || ['carpa', 'sombrilla'].includes(serviceType)) {
        refrescarDatos();
      }

      // Si cambió el resourceNumber o las fechas, actualizar el mapa visual de reservas
      const datesChanged = startDateChanged || endDateChanged;
      if ((resourceNumberChanged || datesChanged) && startDate && endDate) {
        const oldStart = parseLocalDateFromInput(startDate);
        const oldEnd = parseLocalDateFromInput(endDate);
        const newStart = parseLocalDateFromInput(tempStartDate || startDate);
        const newEnd = parseLocalDateFromInput(tempEndDate || endDate);
        const finalResourceNumber = tempResourceNumber ?? resourceNumber;

        if (oldStart && oldEnd && newStart && newEnd) {
          // Determinar qué setter usar según el tipo de servicio
          const setReservationsMap =
            serviceType === 'carpa' ? setCarpasReservations :
              serviceType === 'sombrilla' ? setSombrillasReservations :
                serviceType === 'parking' ? setParkingReservations : null;

          if (setReservationsMap) {
            setReservationsMap((prev) => {
              const next = { ...prev };
              // Eliminar las claves del rango/recurso anterior
              for (let d = new Date(oldStart); d <= oldEnd; d = addDays(d, 1)) {
                const dateKeyStr = format(d, 'yyyy-MM-dd');
                const oldKey = `${dateKeyStr}-${resourceNumber}`;
                delete next[oldKey];
              }
              // Agregar las claves del nuevo rango/recurso
              for (let d = new Date(newStart); d <= newEnd; d = addDays(d, 1)) {
                const dateKeyStr = format(d, 'yyyy-MM-dd');
                const newKey = `${dateKeyStr}-${finalResourceNumber}`;
                next[newKey] = true;
              }
              return next;
            });
          }
        }
      }

      // Refrescar la lista de reservas con los mismos filtros actuales
      await fetchReservationGroups(token, {
        service: reservationFilterService,
        status: reservationFilterStatus,
        from: reservationFilterFrom,
        to: reservationFilterTo
      });

      setReservationEditModal(null);
      volverAlDetalle();
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
    // La cuenta de soporte no administra un balneario: atiende la bandeja.
    if (userRole === 'soporte') {
      return <BandejaSoporte userEmail={userEmail} onLogout={handleLogout} />;
    }

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
              estAjustes={estAjustes}
              setEstAjustes={setEstAjustes}
              onSubmit={handleSaveEstablishment}
              estSaving={estSaving}
              error={error}
              success={success}
            />
          </div>
        </div>
      );
    }
    // Unica fuente de la navegacion: la consumen el menu de escritorio y el
    // de mobile. El 'group' define bajo que encabezado cae cada item.
    const navItems = [
      { id: 'inicio', label: 'Inicio', group: 'principal' },
      { id: 'vista-diaria', label: 'Vista rápida', group: 'principal' },
      { id: 'reservas', label: 'Reservas', group: 'principal' }
    ];

    if (establishment?.hasCarpas) {
      navItems.push({ id: 'carpas', label: 'Carpas', group: 'servicios' });
    }
    if (establishment?.hasSombrillas) {
      navItems.push({ id: 'sombrillas', label: 'Sombrillas', group: 'servicios' });
    }
    if (establishment?.hasParking) {
      navItems.push({ id: 'estacionamiento', label: 'Estacionamiento', group: 'servicios' });
    }
    if (establishment?.hasPileta) {
      navItems.push({ id: 'pileta', label: 'Pileta', group: 'servicios' });
    }

    navItems.push({ id: 'clientes', label: 'Clientes', group: 'admin' });
    navItems.push({ id: 'reportes', label: 'Reportes', group: 'admin' });
    navItems.push({ id: 'tarifas', label: 'Tarifas', group: 'admin' });
    navItems.push({ id: 'panel-usuario', label: 'Panel de usuario', group: 'admin' });

    const sectionTitleMap = {
      inicio: 'Resumen general',
      'vista-diaria': 'Vista rápida',
      reservas: 'Reservas',
      reportes: 'Reportes',
      tarifas: 'Tarifas',
      clientes: 'Clientes',
      carpas: 'Capacidades y reservas',
      sombrillas: 'Capacidades y reservas',
      estacionamiento: 'Capacidades y reservas',
      pileta: 'Pileta',
      'panel-usuario': 'Panel de usuario'
    };

    // Las 25 props del formulario de establecimiento viajan agrupadas para no
    // sumar 25 lineas de cableado en un archivo que ya tiene 2781.
    const propsEstablecimiento = {
      estName,
      setEstName,
      estHasParking,
      setEstHasParking,
      estParkingCapacity,
      setEstParkingCapacity,
      estHasCarpas,
      setEstHasCarpas,
      estCarpasCapacity,
      setEstCarpasCapacity,
      estHasSombrillas,
      setEstHasSombrillas,
      estSombrillasCapacity,
      setEstSombrillasCapacity,
      estHasPileta,
      setEstHasPileta,
      estPoolMaxOccupancy,
      setEstPoolMaxOccupancy,
      estAjustes,
      setEstAjustes,
      onSubmit: handleSaveEstablishment,
      estSaving,
      error,
      success
    };

    // Props de la vista rapida: la grilla de ocupacion por dia.
    const propsVistaRapida = {
      establishment,
      carpasReservations,
      sombrillasReservations,
      parkingReservations,
      carpasDayOffset,
      sombrillasDayOffset,
      parkingDayOffset,
      quickViewLookaheadDays: QUICK_VIEW_LOOKAHEAD_DAYS,
      reservationGroups,
      onViewReservationDetails: handleViewReservationDetails,
      onOpenNewCarpaReservation: handleOpenCarpaReservationFromQuickView,
      onOpenNewSombrillaReservation: handleOpenSombrillaReservationFromQuickView,
      onOpenNewParkingReservation: handleOpenParkingReservationFromQuickView,
      onViewDetails: handleViewReservationDetails,
      onAddPayment: handleAddPaymentForReservationGroup
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
          <AvisoGlobal
            error={error}
            success={success}
            onCerrarError={() => setError('')}
            onCerrarSuccess={() => setSuccess('')}
          />

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
              reservationGroups={reservationGroups}
              onNuevoCliente={() => {
                handleResetClientForm();
                setClienteNuevoPara('carpa');
                setClientFormOpen(true);
              }}
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
              establishment={establishment}
              reservationGroups={reservationGroups}
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
              reservationGroups={reservationGroups}
              onNuevoCliente={() => {
                handleResetClientForm();
                setClienteNuevoPara('sombrilla');
                setClientFormOpen(true);
              }}
            />
          )}

          {/* Modal de edición de reserva madre */}
          {reservationEditModal && (
            <ReservationEditModal
              modal={reservationEditModal}
              setModal={setReservationEditModal}
              saving={reservationEditSaving}
              error={reservationEditError}
              onSave={handleSaveReservationEdit}
              onClose={() => {
                setReservationEditModal(null);
                setReservationEditError('');
                volverAlDetalle();
              }}
              establishment={establishment}
              reservationGroups={reservationGroups}
              onIrALaReserva={abrirReservaVinculada}
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
                setVolverACarpa(group);
                setReservationDetailsModal(null);
              }}
              onCancel={(group) => {
                // eslint-disable-next-line no-alert
                const confirmed = window.confirm('¿Cancelar esta reserva? Esta acción no se puede deshacer.');
                if (!confirmed) return;
                handleCancelReservationGroup(group);
                setReservationDetailsModal(null);
              }}
              onAddPayment={(group, cuenta) => {
                handleAddPaymentForReservationGroup(group, cuenta);
                setVolverACarpa(group);
                setReservationDetailsModal(null);
              }}
              onViewReservation={(group) => setReservationDetailsModal(group)}
              titular={(() => {
                const c = (clients || []).find((x) => Number(x.id) === Number(reservationDetailsModal.clientId));
                return c ? { id: c.id, fullName: c.fullName, documentNumber: c.documentNumber, birthDate: c.birthDate } : null;
              })()}
              onVenderPase={handleVenderPase}
              onIrALaReserva={abrirReservaVinculada}
              onCambioPases={refrescarDatos}
              onViewClient={(clientId) => {
                // No se apilan los modales: se cierra la reserva y se abre la
                // ficha. Desde la ficha, tocar una reserva hace el camino inverso.
                setFichaCliente({ id: clientId, nombre: reservationDetailsModal.customerName });
                setReservationDetailsModal(null);
              }}
            />
          )}

          {fichaCliente && (
            <ClientDetailsModal
              client={
                (clients || []).find((c) => Number(c.id) === Number(fichaCliente.id)) || {
                  id: fichaCliente.id,
                  fullName: fichaCliente.nombre
                }
              }
              onClose={() => setFichaCliente(null)}
              onViewReservation={(group) => setReservationDetailsModal(group)}
            />
          )}

          {/* Modal de pago de reserva madre */}
          {reservationPaymentModal && (
            <ReservationPaymentModal
              paymentModal={reservationPaymentModal}
              setPaymentModal={(valor) => {
                setReservationPaymentModal(valor);
                if (valor === null) volverAlDetalle();
              }}
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
              onClose={() => {
                setPoolPassForm(null);
                // Abierto desde una carpa: se vuelve a su detalle.
                volverAlDetalle();
              }}
            />
          )}

          {/* Modal de formulario de cliente */}
          {clientFormOpen && (
            <ClientFormModal
              clientForm={clientForm}
              clientSaving={clientSaving}
              onFieldChange={handleClientFieldChange}
              onSubmit={async (e) => {
                const cliente = await handleSubmitClientForm(e);
                // Creado desde una reserva abierta: queda elegido en ella.
                if (cliente && clienteNuevoPara) {
                  const setForm = clienteNuevoPara === 'sombrilla' ? setSombrillaReservationForm : setCarpaReservationForm;
                  setForm((prev) => (prev ? {
                    ...prev,
                    clientId: cliente.id,
                    customerName: cliente.fullName || '',
                    customerPhone: cliente.phone || '',
                    cocheras: (prev.cocheras || []).map((c, i) =>
                      i === 0 && !c.vehiclePlate && cliente.vehiclePlate ? { ...c, vehiclePlate: cliente.vehiclePlate } : c
                    )
                  } : prev));
                  setClienteNuevoPara(null);
                }
              }}
              onCancel={() => {
                handleResetClientForm();
                setClientFormOpen(false);
                setClienteNuevoPara(null);
              }}
            />
          )}

          <div className="w-full rounded-2xl bg-white/95 border border-cyan-100 shadow-2xl p-5 sm:p-7 text-slate-900">
            {activeSection !== 'pileta' && (
              <div className="mb-6">
                {activeSection !== 'clientes' && activeSection !== 'reservas' && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                    {sectionTitleMap[activeSection] || 'Panel'}
                  </p>
                )}
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

            {activeSection === 'vista-diaria' && <DailyViewSection {...propsVistaRapida} />}

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
                  setReservationFilterStatus('');
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

            {activeSection === 'tarifas' && <TarifasSection establishment={establishment} />}

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

            {activeSection === 'panel-usuario' && (
              <PanelUsuarioSection
                authToken={authToken}
                userEmail={userEmail}
                onEmailChanged={(nuevo) => {
                  // La sesion sigue valida: el email del token no se usa para
                  // autorizar. Solo hay que refrescar lo que se muestra.
                  setUserEmail(nuevo);
                  sessionStorage.setItem('authEmail', nuevo);
                }}
                establecimiento={propsEstablecimiento}
              />
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
