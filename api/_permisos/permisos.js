// Qué puede hacer cada rol del personal de un balneario. Lo usan las dos APIs
// en un solo control a la entrada, antes de cada ruta. El rol se lee de la
// base en cada pedido (como el de soporte): el token solo dice quién es, y
// cambiarle el rol a alguien corta su acceso en el acto.
//
//   admin     el encargado o dueño: todo, incluida la configuración y los usuarios
//   operador  un empleado: reservas, clientes, pagos y reportes; mira las
//             tarifas y el contrato, pero no los cambia
//   pileta    el personal de pileta: solo mira reservas, pases y clientes
//
// Las rutas de auth, soporte y cuentas no pasan por acá: tienen sus propios
// controles. Cualquier otro rol (soporte, uno vacío porque la cuenta se borró,
// o uno que no exista) no entra a los recursos del balneario.

const PERSONAL = ['operador', 'pileta'];

// Por recurso (el primer segmento de la ruta): qué roles del personal pueden
// leer (GET) y cuáles escribir (el resto). El encargado puede todo.
const REGLAS = {
  establishment: { leer: ['operador', 'pileta'], escribir: [] },
  tarifas: { leer: ['operador'], escribir: [] },
  contrato: { leer: ['operador'], escribir: [] },
  reports: { leer: ['operador'], escribir: [] },
  usuarios: { leer: [], escribir: [] },
  clients: { leer: ['operador', 'pileta'], escribir: ['operador'] },
  reservations: { leer: ['operador', 'pileta'], escribir: ['operador'] },
  'reservation-groups': { leer: ['operador', 'pileta'], escribir: ['operador'] },
  'reservation-guests': { leer: ['operador', 'pileta'], escribir: ['operador'] }
};

// La consulta del rol lleva una marca para que los tests la reconozcan
// (test/pg-mock.js la atiende aparte, como BEGIN y COMMIT).
const CONSULTA_ROL = 'SELECT role FROM users WHERE id = $1 /* permisos */';

/** Si el recurso pasa por el control de roles. */
const controla = (recurso) => Object.prototype.hasOwnProperty.call(REGLAS, recurso);

/** Si el rol puede usar el recurso con ese método. */
function puede(rol, method, recurso) {
  if (!controla(recurso) || rol === 'admin') return true;
  if (!PERSONAL.includes(rol)) return false;
  const regla = REGLAS[recurso];
  const quienes = String(method).toUpperCase() === 'GET' ? regla.leer : regla.escribir;
  return quienes.includes(rol);
}

module.exports = { puede, controla, CONSULTA_ROL, PERSONAL };
