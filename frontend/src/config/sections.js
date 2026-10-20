/**
 * Ancho de cada pantalla.
 *
 * Las grillas operativas (200 carpas x 30 dias) necesitan todo el monitor:
 * encerrarlas en un ancho fijo obliga a scrollear de a 19 filas mientras
 * sobra media pantalla vacia. Las pantallas de lectura y formularios, en
 * cambio, se leen mejor con la linea corta, asi que mantienen un tope.
 */
export const WIDE_SECTIONS = new Set([
  'carpas',
  'sombrillas',
  'estacionamiento',
  'vista-diaria'
]);

/** Tope de ancho para las pantallas que no son grilla. */
export const DEFAULT_MAX_WIDTH = 'max-w-7xl';

export function isWideSection(sectionId) {
  return WIDE_SECTIONS.has(sectionId);
}

/**
 * Grupos del menu, en orden. El primero no lleva encabezado: son las
 * pantallas de uso diario y no necesitan que se las nombre.
 *
 * Cada item de navegacion declara a que grupo pertenece, asi el menu de
 * escritorio y el de mobile se arman de la misma fuente y agregar una
 * seccion es un solo cambio.
 */
export const NAV_GROUPS = [
  { id: 'principal', label: null },
  { id: 'servicios', label: 'Servicios' },
  { id: 'admin', label: 'Administración' }
];

/** Agrupa los navItems respetando el orden de NAV_GROUPS, salteando los vacios. */
export function groupNavItems(navItems) {
  const items = Array.isArray(navItems) ? navItems : [];
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: items.filter((item) => (item.group || 'principal') === group.id)
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Las secciones que ve cada rol del personal. El encargado ve todas; un
 * empleado, todas menos Tarifas; el de pileta, solo la Pileta y su perfil (lo
 * usa desde el celular). Es solo lo que se muestra: la API vuelve a controlar
 * cada pedido.
 */
const OCULTAS_POR_ROL = { operador: ['tarifas'] };
const SOLO_ESTAS_POR_ROL = { pileta: ['pileta', 'panel-usuario'] };

const visibleParaRol = (id, rol) =>
  SOLO_ESTAS_POR_ROL[rol] ? SOLO_ESTAS_POR_ROL[rol].includes(id) : !(OCULTAS_POR_ROL[rol] || []).includes(id);

export function seccionesDelRol(navItems, rol) {
  return (navItems || []).filter((item) => visibleParaRol(item.id, rol));
}

/** La seccion a mostrar: la pedida si el rol la ve, o la primera que ve. */
export function seccionPermitida(id, rol) {
  if (visibleParaRol(id, rol)) return id;
  return SOLO_ESTAS_POR_ROL[rol]?.[0] ?? 'inicio';
}

/**
 * Secciones que arma AuthenticatedShell por su cuenta: no estan en los
 * navItems de App.jsx (la Bandeja de soporte aparece solo si la cuenta atiende).
 */
export const SECCIONES_DEL_SHELL = ['bandeja-soporte'];

/**
 * La seccion que se muestra: la abierta si esta en el menu del rol o la arma
 * el shell; si no, la primera del menu.
 */
export function seccionVisible(activeSection, navDelRol) {
  if (SECCIONES_DEL_SHELL.includes(activeSection)) return activeSection;
  if ((navDelRol || []).some((item) => item.id === activeSection)) return activeSection;
  return navDelRol?.[0]?.id;
}

/** El personal (empleados, pileta) no usa el chat de soporte: es de la administracion. */
export const usaSoporte = (rol) => rol !== 'operador' && rol !== 'pileta';
