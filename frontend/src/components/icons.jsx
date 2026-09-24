import React from 'react';
import {
  Umbrella,
  SquareParking,
  Waves,
  Home,
  LayoutGrid,
  CalendarDays,
  Users,
  BarChart3,
  User,
  LogOut,
  LayoutDashboard,
  CalendarCheck,
  CalendarClock,
  Wallet,
  TrendingUp,
  Gauge,
  ClipboardList,
  Banknote,
  X,
  TriangleAlert,
  Tags
} from 'lucide-react';

/**
 * Set de iconos de la app: lucide-react, con una excepcion propia.
 *
 * Lucide resuelve bien todo lo generico y mantiene el trazo consistente. La
 * carpa es la excepcion porque ninguna libreria dibuja la carpa de balneario:
 * el `Tent` de lucide es una carpa de camping (los lados bajan enteros hasta
 * el piso, se lee como toldo indigena). La de Mar del Plata es otra cosa: un
 * techo a dos aguas apoyado sobre parantes, abierta al frente. Ese corte
 * horizontal entre techo y parantes es lo que la hace reconocible.
 *
 * Los iconos usan `currentColor`, asi que se pintan segun el contexto: el
 * estado de la celda en la vista rapida, o el item activo del menu. El
 * `className` define el tamano (ej: h-4 w-4) y pisa el width/height del SVG.
 */

// Un solo lugar donde se fija el grosor de trazo, asi el icono propio y los de
// la libreria se leen como una familia.
const TRAZO = 1.75;

function conTrazo(Icon) {
  return function IconoConTrazo({ className = '' }) {
    return <Icon className={className} strokeWidth={TRAZO} aria-hidden="true" />;
  };
}

/** Carpa de balneario: techo a dos aguas sobre parantes, parada en la arena. */
function CarpaIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={TRAZO}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Techo: piramide baja y ancha, no un dos aguas empinado. La carpa de
          balneario es una lona tirante sobre cuatro canos, mas parecida a un
          quincho que a una casa. */}
      <path d="M12 4.5 2.5 9.5h19L12 4.5Z" />
      {/* Parante central: del vertice al medio del travesano. Es lo que levanta
          la lona y da el volumen del techo. */}
      <path d="M12 4.5v5" />
      {/* Patas: largas y al ras del alero, sin pared ni puerta. Esa proporcion
          (techo chico, patas largas) es lo que la hace reconocible de lejos. */}
      <path d="M4.5 9.5V20M19.5 9.5V20" />
    </svg>
  );
}

// --- Registros ---------------------------------------------------------

// Acepta singular y plural: la vista rapida nombra los servicios en plural
// ('carpas') y el dashboard en singular ('carpa'). En vez de normalizar en cada
// llamada, el registro entiende las dos formas.
const POR_SERVICIO = {
  carpas: CarpaIcon,
  carpa: CarpaIcon,
  sombrillas: conTrazo(Umbrella),
  sombrilla: conTrazo(Umbrella),
  parking: conTrazo(SquareParking),
  pileta: conTrazo(Waves)
};

const POR_SECCION = {
  inicio: conTrazo(Home),
  'vista-diaria': conTrazo(LayoutGrid),
  reservas: conTrazo(CalendarDays),
  carpas: CarpaIcon,
  sombrillas: conTrazo(Umbrella),
  estacionamiento: conTrazo(SquareParking),
  pileta: conTrazo(Waves),
  clientes: conTrazo(Users),
  reportes: conTrazo(BarChart3),
  tarifas: conTrazo(Tags),
  'panel-usuario': conTrazo(User)
};

export const SalirIcon = conTrazo(LogOut);

// --- Dashboard ---------------------------------------------------------
// Encabezados de seccion y tarjetas de metrica del resumen.

export const ResumenIcon = conTrazo(LayoutDashboard);
export const ActivasHoyIcon = conTrazo(CalendarCheck);
export const IngresosIcon = conTrazo(Wallet);
export const ClientesIcon = conTrazo(Users);
export const OcupacionIcon = conTrazo(TrendingUp);
export const EstadoServiciosIcon = conTrazo(Gauge);
export const UltimasReservasIcon = conTrazo(ClipboardList);
export const PagosIcon = conTrazo(Banknote);
export const CheckInsIcon = conTrazo(CalendarClock);
export const CerrarIcon = conTrazo(X);
export const AvisoIcon = conTrazo(TriangleAlert);

/**
 * Color de cada servicio. Unica fuente: si el naranja de carpas se define en
 * cada pantalla por separado, tarde o temprano una queda distinta.
 *
 * Los cuatro se eligieron bien separados en el circulo cromatico para que en
 * una lista mezclada se distingan de un vistazo, sin leer la etiqueta.
 */
export const COLOR_SERVICIO = {
  carpas: 'text-orange-500',
  carpa: 'text-orange-500',
  sombrillas: 'text-purple-500',
  sombrilla: 'text-purple-500',
  parking: 'text-sky-500',
  pileta: 'text-teal-500'
};

/** Icono de un servicio en la vista rapida. serviceId: carpas | sombrillas | parking */
export function ServiceIcon({ serviceId, className = '' }) {
  const Icon = POR_SERVICIO[serviceId];
  return Icon ? <Icon className={className} /> : null;
}

/** Icono de una seccion del menu, por el id que usa activeSection. */
export function NavIcon({ sectionId, className = '' }) {
  const Icon = POR_SECCION[sectionId];
  return Icon ? <Icon className={className} /> : null;
}
