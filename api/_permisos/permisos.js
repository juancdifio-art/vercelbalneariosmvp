// Qué puede hacer cada rol del personal de un balneario. Lo usan las dos APIs
// en un solo control a la entrada, antes de cada ruta. El rol se lee de la
// base en cada pedido (como el de soporte): el token solo dice quién es, y
// cambiarle el rol a alguien corta su acceso en el acto.
//
//   admin     el encargado o dueño: todo, incluida la configuración y los usuarios
//   operador  un empleado: reservas, clientes, pagos y reportes; mira las
//             tarifas y el contrato, pero no los cambia
//   pileta    el personal de pileta: solo mira los pases de pileta y quién va
//             en cada uno (lo usa desde el celular)
//
// Las rutas de auth, soporte y cuentas no pasan por acá: tienen sus propios
// controles (el chat de soporte es solo del encargado). Cualquier otro rol
// (soporte, uno vacío porque la cuenta se borró, o uno que no exista) no entra
// a los recursos del balneario.

const PERSONAL = ['operador', 'pileta'];

// Por recurso (el primer segmento de la ruta): si el empleado puede leer
// (GET) y escribir (el resto). El encargado puede todo; pileta va aparte.
const REGLAS = {
  establishment: { leer: true, escribir: false },
  tarifas: { leer: true, escribir: false },
  contrato: { leer: true, escribir: false },
  reports: { leer: true, escribir: false },
  usuarios: { leer: false, escribir: false },
  clients: { leer: true, escribir: true },
  reservations: { leer: true, escribir: true },
  'reservation-groups': { leer: true, escribir: true },
  'reservation-guests': { leer: true, escribir: true }
};

// La consulta del rol lleva una marca para que los tests la reconozcan
// (test/pg-mock.js la atiende aparte, como BEGIN y COMMIT).
const CONSULTA_ROL = 'SELECT role FROM users WHERE id = $1 /* permisos */';

/** Si el recurso pasa por el control de roles. */
const controla = (recurso) => Object.prototype.hasOwnProperty.call(REGLAS, recurso);

const esLectura = (method) => String(method).toUpperCase() === 'GET';

// Pileta solo mira: el nombre de su balneario, la lista de reservas filtrada a
// pases de pileta y las personas de un pase (la ruta ya exige que sea de pileta).
function puedePileta(method, recurso, partes, servicio) {
  if (!esLectura(method)) return false;
  if (recurso === 'establishment') return partes.length === 1 && partes[0] === 'me';
  if (recurso !== 'reservation-groups') return false;
  if (partes.length === 0) return servicio === 'pileta';
  return partes.length === 2 && partes[1] === 'pase-personas';
}

/**
 * Si el rol puede usar el recurso con ese método. `partes` son los segmentos
 * de la ruta después del recurso y `servicio`, el filtro ?service= de la lista
 * de reservas: solo los mira el rol pileta.
 */
function puede(rol, method, recurso, { partes = [], servicio = null } = {}) {
  if (!controla(recurso) || rol === 'admin') return true;
  if (rol === 'pileta') return puedePileta(method, recurso, partes, servicio);
  if (rol !== 'operador') return false;
  const regla = REGLAS[recurso];
  return esLectura(method) ? regla.leer : regla.escribir;
}

module.exports = { puede, controla, CONSULTA_ROL, PERSONAL };
