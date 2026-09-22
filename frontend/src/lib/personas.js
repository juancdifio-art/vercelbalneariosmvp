// Las personas que ocupan una reserva.

/**
 * La edad que se muestra de una persona.
 *
 * Si tiene fecha de nacimiento, la edad sale de ahi y es la de hoy. Si no,
 * vale la edad escrita a mano, que es la que tenia cuando se la cargo y no
 * se recalcula sola.
 *
 * @param {{ age?: number|string|null, birthDate?: string|null }} persona
 * @param {Date} [hoy] para poder fijarla en los tests
 * @returns {number|null}
 */
export function edadDe(persona, hoy = new Date()) {
  if (!persona) return null;

  if (persona.birthDate) {
    const [anio, mes, dia] = String(persona.birthDate).slice(0, 10).split('-').map(Number);
    if (anio && mes && dia) {
      let edad = hoy.getFullYear() - anio;
      const cumplioEsteAnio =
        hoy.getMonth() + 1 > mes || (hoy.getMonth() + 1 === mes && hoy.getDate() >= dia);
      if (!cumplioEsteAnio) edad -= 1;
      return edad >= 0 ? edad : null;
    }
  }

  if (persona.age === undefined || persona.age === null || persona.age === '') return null;

  const parsed = Number.parseInt(persona.age, 10);
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
}

/**
 * El aviso cuando la cantidad declarada no coincide con las personas cargadas.
 *
 * No bloquea nada: es para que el operador vea que le faltan datos. Si no se
 * declaro ninguna cantidad, o ya estan todas, no hay aviso.
 *
 * @returns {string|null}
 */
export function avisoCantidad(adultsCount, childrenCount, personas) {
  const declaradas =
    (Number.parseInt(adultsCount ?? 0, 10) || 0) + (Number.parseInt(childrenCount ?? 0, 10) || 0);

  if (declaradas <= 0) return null;

  const cargadas = Array.isArray(personas) ? personas.length : 0;

  if (cargadas >= declaradas) return null;

  return `Cargaste ${cargadas} de ${declaradas} personas`;
}
