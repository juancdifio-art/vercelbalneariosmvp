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
