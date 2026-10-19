/**
 * Preguntas frecuentes del panel de Soporte.
 *
 * Salen del manual de uso (docs/manual/manual.html): el capitulo 14 y los
 * "como hago" de cada capitulo. Si el manual cambia, revisar estas respuestas.
 *
 * `secciones`: en que pantallas se muestran primero (los ids de activeSection).
 * Una pregunta sin secciones vale para cualquier pantalla y va con las demas.
 */
export const PREGUNTAS_FRECUENTES = [
  // --- Tomar una reserva ---
  {
    id: 'reservar-carpa',
    pregunta: '¿Cómo tomo una reserva de carpa?',
    respuesta:
      'Entrá a Carpas. Apretá sobre el día de entrada en la fila de la carpa y, sin soltar, arrastrá hasta el día de salida: al soltar se abre el formulario con las fechas cargadas. Elegí el cliente, revisá las personas y el precio, y tocá Guardar reserva. También podés hacer un clic en un día libre y completar la salida a mano.',
    secciones: ['carpas', 'vista-diaria', 'inicio']
  },
  {
    id: 'sombrillas',
    pregunta: '¿Las sombrillas se reservan igual?',
    respuesta:
      'Sí, desde Sombrillas. La diferencia es que no traen pases de pileta incluidos: en cada persona aparece solo el botón 💲 Pago, por si alguien quiere pileta. Pueden llevar cochera igual que una carpa.',
    secciones: ['sombrillas']
  },
  {
    id: 'tramo-rojo',
    pregunta: 'Al arrastrar, el tramo se pone rojo.',
    respuesta: 'Hay días ocupados en ese tramo. Elegí otra unidad u otras fechas. Si te equivocaste mientras arrastrás, apretá Esc para cancelar.',
    secciones: ['carpas', 'sombrillas']
  },
  {
    id: 'no-guarda',
    pregunta: 'No me deja guardar la reserva.',
    respuesta:
      'Falta algo y está marcado en rojo: la patente de la cochera, el motivo si cambiaste el precio, una seña mayor que el total, más de 6 personas, o la unidad está ocupada en esas fechas.',
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'vista-diaria']
  },
  {
    id: 'nuevo-cliente',
    pregunta: '¿Cómo cargo un cliente nuevo?',
    respuesta:
      'En Clientes, con Nuevo Cliente. También desde el formulario de una reserva, con + Nuevo cliente: al guardar la ficha queda elegido en la reserva.',
    secciones: ['clientes', 'carpas', 'sombrillas']
  },
  {
    id: 'siete-personas',
    pregunta: 'Vienen 7 personas a una carpa.',
    respuesta: 'El tope es de 6 contando al titular. La séptima no entra en esa carpa: hace falta otra unidad.',
    secciones: ['carpas', 'sombrillas']
  },

  // --- Pileta y cocheras ---
  {
    id: 'que-incluye-carpa',
    pregunta: '¿Qué incluye una carpa?',
    respuesta:
      'Pases de pileta (4 por carpa, se cambia en Panel de usuario): se reparten con el botón 🏊 Incluido de cada persona. Si el cliente no los quiere, desmarcá Incluye pileta. Si viene en auto, tildá Incluir estacionamiento: la cochera queda atada a la carpa, con su propio precio.',
    secciones: ['carpas', 'pileta']
  },
  {
    id: 'pileta-cochera-sin-cliente',
    pregunta: 'No me deja tildar Incluye pileta o Incluir estacionamiento.',
    respuesta: 'La reserva necesita un cliente guardado. Elegilo en Buscar cliente guardado o crealo con + Nuevo cliente.',
    secciones: ['carpas', 'sombrillas']
  },
  {
    id: 'pase-persona',
    pregunta: 'No puedo darle el pase de pileta a una persona.',
    respuesta:
      'Le faltan el DNI o la edad. Completalos con el lápiz en la lista de personas del detalle. Si ya están los 4 pases asignados, sacale el tilde a otra persona o vendele un pase pago.',
    secciones: ['carpas', 'pileta', 'reservas']
  },
  {
    id: 'vender-pase',
    pregunta: '¿Cómo vendo un pase de pileta?',
    respuesta:
      'Para alguien de una carpa: en el detalle de la carpa, en Servicios incluidos, tocá Vender pase de pileta, tildá a quién es y cargá el precio por adulto y por niño por día. Para alguien que viene solo a la pileta: en Pileta, Nuevo Pase, con el cliente (obligatorio), las fechas, cuántos adultos y niños y el precio por día.',
    secciones: ['pileta', 'carpas', 'sombrillas']
  },
  {
    id: 'cochera-se-movio',
    pregunta: 'Moví una carpa y la cochera se movió sola.',
    respuesta: 'Es así: la cochera y la pileta incluidas acompañan a la carpa. Los pases pagos no: el aviso te pide que los revises.',
    secciones: ['carpas', 'estacionamiento', 'reservas']
  },
  {
    id: 'cambiar-plaza',
    pregunta: 'Quiero cambiar la cochera incluida de plaza.',
    respuesta: 'Desde Editar en la carpa, o abriendo la cochera: acepta otra plaza y otra patente, pero no otras fechas.',
    secciones: ['estacionamiento', 'carpas']
  },
  {
    id: 'otro-auto',
    pregunta: 'Un cliente viene con otro auto.',
    respuesta: 'Escribí la patente nueva en la reserva: la patente va en cada reserva, no solo en la ficha del cliente.',
    secciones: ['estacionamiento', 'clientes']
  },

  // --- Precio y cobro ---
  {
    id: 'de-donde-sale-precio',
    pregunta: '¿De dónde sale el precio de una reserva?',
    respuesta:
      'Lo calcula el sistema con las tarifas cargadas en Tarifas, día por día. Si la estadía cruza de una temporada a otra, cada día se cobra al precio de su temporada. Si entra en una tarifa por estadía (una quincena o la temporada completa), se cobra esa en lugar de sumar los días.',
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'tarifas']
  },
  {
    id: 'cobrar-distinto',
    pregunta: '¿Cómo cobro distinto a la tarifa (un descuento o un redondeo)?',
    respuesta:
      'Cambiá el Total cobrado. El sistema muestra la diferencia y pide el Motivo del ajuste, que es obligatorio. La reserva guarda el precio de la tarifa, lo cobrado y el motivo.',
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'reservas']
  },
  {
    id: 'consultar-precio',
    pregunta: 'El precio dice “Consultar precio”.',
    respuesta: 'Faltan tarifas para esos días o para ese servicio. Cargá el total a mano, o completá los precios en Tarifas → Precios.',
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'tarifas']
  },
  {
    id: 'tarifa-vieja',
    pregunta: 'Cambié una tarifa y una reserva vieja no cambió.',
    respuesta: 'Es así a propósito: la reserva conserva el precio con que se hizo. Solo se recalcula si le cambiás las fechas o la unidad.',
    secciones: ['tarifas', 'reservas']
  },
  {
    id: 'registrar-pago',
    pregunta: '¿Cómo registro un pago?',
    respuesta:
      'Abrí la reserva y, en Historial de pagos, tocá + Agendar pago. Completá el Monto, la Fecha y el Método de pago, y tocá Guardar pago. Desde el listado de Reservas también podés cobrar con el botón verde de cada fila.',
    secciones: ['reservas', 'carpas', 'sombrillas', 'estacionamiento', 'pileta']
  },
  {
    id: 'pagar-todo-junto',
    pregunta: 'El cliente quiere pagar todo junto.',
    respuesta: 'Agendá un solo pago desde el detalle de la carpa: se reparte solo entre la carpa, las cocheras y la pileta paga.',
    secciones: ['reservas', 'carpas']
  },
  {
    id: 'comprobante',
    pregunta: '¿Cómo le doy un comprobante al cliente?',
    respuesta:
      'Abrí la reserva y tocá Descargar comprobante: genera un PDF de toda la cuenta (la carpa, la pileta, las cocheras, los pases pagos), con cada pago y el saldo.',
    secciones: ['reservas', 'carpas', 'sombrillas']
  },

  // --- Cambiar o cancelar ---
  {
    id: 'editar',
    pregunta: '¿Cómo cambio las fechas o la carpa de una reserva?',
    respuesta:
      'Abrí la reserva y tocá Editar. Si cambiás las fechas o la unidad, el sistema recalcula el precio con las tarifas de las fechas nuevas y lo muestra antes de guardar. La pileta incluida y las cocheras se mueven con la carpa; los pases pagos no, y el sistema avisa para que los revises.',
    secciones: ['reservas', 'carpas', 'sombrillas']
  },
  {
    id: 'cancelar',
    pregunta: '¿Cómo cancelo una reserva?',
    respuesta:
      'Abrí la reserva y tocá Cancelar reserva: libera la unidad y queda en el historial como cancelada. La pileta y las cocheras incluidas se cancelan con ella; los pases pagos quedan como están, para que decidas qué hacer.',
    secciones: ['reservas', 'carpas', 'sombrillas']
  },

  // --- Pantallas y reportes ---
  {
    id: 'colores-vista-rapida',
    pregunta: '¿Qué significan los colores de la Vista rápida?',
    respuesta:
      'Verde: ocupada ese día. Amarillo: libre, pero con una reserva que empieza pronto. Blanco: libre. Pasando el mouse ves la ficha de la unidad; un clic en una ocupada abre la reserva y en una libre empieza una nueva.',
    secciones: ['vista-diaria']
  },
  {
    id: 'caja-efectivo',
    pregunta: 'Quiero saber cuánto se cobró hoy en efectivo.',
    respuesta: 'Reportes → Pagos, con la fecha de hoy y el método Efectivo.',
    secciones: ['reportes', 'inicio']
  },
  {
    id: 'deudores',
    pregunta: 'Quiero ver quién se fue debiendo plata.',
    respuesta: 'En Clientes, tildando Solo con deuda de reservas terminadas.',
    secciones: ['clientes', 'reportes']
  },
  {
    id: 'cargar-temporadas',
    pregunta: '¿Cómo cargo las temporadas y los precios?',
    respuesta:
      'En Tarifas, en orden: 1) Períodos: cada temporada con su nombre, desde y hasta (día/mes) y la prioridad. 2) Sectores, solo si hay unidades que se cobran distinto. 3) Precios: el precio por día de cada período en la grilla, que se guarda al salir de la celda. Las fechas no tienen año: sirven para todas las temporadas.',
    secciones: ['tarifas']
  },

  // --- Cuenta ---
  {
    id: 'sesion-vencio',
    pregunta: 'Me sacó del sistema: “Tu sesión venció”.',
    respuesta: 'La sesión se cierra sola una hora después de entrar. Volvé a ingresar. Si estabas cargando una reserva, no se guardó: cargala de nuevo.',
    secciones: []
  },
  {
    id: 'cambiar-clave',
    pregunta: '¿Cómo cambio mi contraseña?',
    respuesta: 'En Panel de usuario → Perfil, Cambiar contraseña. Pide la contraseña actual; la nueva tiene que tener al menos 8 caracteres.',
    secciones: ['panel-usuario']
  }
];

// Para buscar sin que importen las tildes ni las mayusculas.
export const normalizar = (texto) =>
  String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Las preguntas que contienen todas las palabras buscadas, en pregunta o respuesta. */
export function buscarPreguntas(busqueda, preguntas = PREGUNTAS_FRECUENTES) {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (!palabras.length) return preguntas;
  return preguntas.filter((p) => {
    const texto = normalizar(`${p.pregunta} ${p.respuesta}`);
    return palabras.every((palabra) => texto.includes(palabra));
  });
}
