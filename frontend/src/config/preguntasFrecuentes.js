/**
 * Preguntas frecuentes del panel de Soporte.
 *
 * Salen del manual de uso (docs/manual/manual.html): el capitulo 14 y los
 * "como hago" de cada capitulo. Si el manual cambia, revisar estas respuestas.
 *
 * Cada pregunta:
 *   resumen   la respuesta en una o dos oraciones (siempre).
 *   pasos     [{ texto, imagen? }]: una accion por paso, en orden.
 *   imagen    una captura sola, para las que explican sin pasos.
 *   nota      un dato extra al final.
 *   secciones en que pantallas se muestran primero (ids de activeSection).
 * En los textos, **asi** va en negrita: los nombres de botones y campos,
 * tal como se ven en la pantalla.
 *
 * Las imagenes son las capturas del manual (docs/manual/img), copiadas a
 * frontend/public/ayuda. Si se rehace una captura del manual, copiarla de nuevo.
 */
export const PREGUNTAS_FRECUENTES = [
  // --- Tomar una reserva ---
  {
    id: 'reservar-carpa',
    pregunta: '¿Cómo tomo una reserva de carpa?',
    resumen: 'Se marca en el calendario de Carpas y se completa el formulario.',
    pasos: [
      { texto: 'Entrá a **Carpas** en el menú. Cada fila es una carpa y cada columna un día: los días en blanco están libres.', imagen: '04-calendario.png' },
      { texto: 'Apretá sobre el día de entrada en la fila de la carpa y, sin soltar, arrastrá hasta el día de salida. Al soltar se abre el formulario con las fechas cargadas.', imagen: '04-arrastre.png' },
      { texto: 'En **Buscar cliente guardado** escribí el nombre, el teléfono o el DNI y elegilo de la lista. Si es la primera vez que viene, tocá **+ Nuevo cliente**.', imagen: '04-cliente.png' },
      { texto: 'Cargá cuántos **Adultos** y **Menores** van. El máximo es 6, contando al titular.', imagen: '04-personas-cantidad.png' },
      { texto: 'Revisá el precio: el sistema lo calcula solo con las tarifas.', imagen: '04-precio.png' },
      { texto: 'Si deja seña, escribila en **Monto a pagar ahora** y elegí el **Medio de pago**.', imagen: '04-cuenta.png' },
      { texto: 'Tocá **Guardar reserva**.' }
    ],
    nota: 'También podés hacer un clic en un día libre: se abre el formulario con esa fecha de entrada y completás la de salida.',
    secciones: ['carpas', 'vista-diaria', 'inicio']
  },
  {
    id: 'sombrillas',
    pregunta: '¿Las sombrillas se reservan igual?',
    resumen: 'Sí, igual que una carpa, desde **Sombrillas**.',
    pasos: [
      { texto: 'Entrá a **Sombrillas** y arrastrá sobre la fila de la sombrilla, del día de entrada al de salida.' },
      { texto: 'Completá el cliente, las personas y la seña como en una carpa, y tocá **Guardar reserva**.' }
    ],
    nota: 'Las sombrillas no traen pases de pileta incluidos: si alguien quiere pileta, tocá 💲 **Pago** en esa persona. Pueden llevar cochera igual que una carpa.',
    secciones: ['sombrillas']
  },
  {
    id: 'tramo-rojo',
    pregunta: 'Al arrastrar, el tramo se pone rojo.',
    resumen: 'Hay días ocupados en ese tramo: la unidad no está libre en todas esas fechas.',
    pasos: [
      { texto: 'Apretá **Esc** para cancelar el arrastre.' },
      { texto: 'Elegí otra unidad, u otras fechas en las que esa esté libre (los días en blanco).' }
    ],
    secciones: ['carpas', 'sombrillas']
  },
  {
    id: 'no-guarda',
    pregunta: 'No me deja guardar la reserva.',
    resumen: 'Falta algo, y el formulario lo marca en rojo.',
    pasos: [
      { texto: 'Bajá por el formulario hasta encontrar el aviso en rojo.' },
      { texto: 'Lo más común: falta la **Patente** de la cochera, falta el **Motivo del ajuste** porque cambiaste el precio, la seña es mayor que el total, hay más de 6 personas, o la unidad ya está ocupada en esas fechas.' },
      { texto: 'Corregilo y tocá **Guardar reserva** de nuevo.' }
    ],
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'vista-diaria']
  },
  {
    id: 'nuevo-cliente',
    pregunta: '¿Cómo cargo un cliente nuevo?',
    resumen: 'Desde **Clientes**, o desde la misma reserva mientras la cargás.',
    pasos: [
      { texto: 'Entrá a **Clientes** y tocá **Nuevo Cliente**.', imagen: '08-clientes.png' },
      { texto: 'Completá el nombre, el DNI, el teléfono y, si viene en auto, la patente.' },
      { texto: 'Tocá **Guardar Cliente**.' }
    ],
    nota: 'Desde el formulario de una reserva, **+ Nuevo cliente** abre la misma ficha: al guardarla, el cliente queda elegido en la reserva.',
    secciones: ['clientes', 'carpas', 'sombrillas']
  },
  {
    id: 'siete-personas',
    pregunta: 'Vienen 7 personas a una carpa.',
    resumen: 'El tope es de 6 personas por carpa o sombrilla, contando al titular: la séptima no entra.',
    pasos: [
      { texto: 'Reservá otra unidad para quienes no entran, por ejemplo una sombrilla al lado.' }
    ],
    nota: 'El tope se cambia en **Panel de usuario → Establecimiento**, en **Máximo de personas por unidad**.',
    secciones: ['carpas', 'sombrillas']
  },

  // --- Pileta y cocheras ---
  {
    id: 'que-incluye-carpa',
    pregunta: '¿Qué incluye una carpa y cómo reparto los pases de pileta?',
    resumen: 'Cada carpa trae 4 pases de pileta y puede llevar cochera. Se eligen en el mismo formulario de la reserva.',
    pasos: [
      { texto: 'En **Datos de las personas**, completá el DNI y la edad de cada una: sin eso no se le puede dar un pase.' },
      { texto: 'Tocá 🏊 **Incluido** en cada persona que va a usar la pileta. Arriba se ve cuántos pases quedan.', imagen: '04-personas.png' },
      { texto: 'Si el cliente no quiere pileta, desmarcá **Incluye pileta**.', imagen: '04-pileta.png' },
      { texto: 'Si viene en auto, tildá **Incluir estacionamiento** y escribí la **Patente**. La plaza se puede dejar vacía: el sistema asigna la primera libre.', imagen: '04-cochera.png' }
    ],
    nota: 'La cochera queda atada a la carpa: si cambiás las fechas de la carpa se mueve con ella, y si la cancelás se cancela también.',
    secciones: ['carpas', 'pileta']
  },
  {
    id: 'pileta-cochera-sin-cliente',
    pregunta: 'No me deja tildar Incluye pileta o Incluir estacionamiento.',
    resumen: 'La reserva necesita un cliente guardado, no solo un nombre escrito.',
    pasos: [
      { texto: 'Buscalo en **Buscar cliente guardado** y elegilo de la lista.', imagen: '04-cliente.png' },
      { texto: 'Si no existe, tocá **+ Nuevo cliente**, completá la ficha y guardala: queda elegido en la reserva.' }
    ],
    secciones: ['carpas', 'sombrillas']
  },
  {
    id: 'pase-persona',
    pregunta: 'No puedo darle el pase de pileta a una persona.',
    resumen: 'A esa persona le faltan el DNI o la edad, o ya están asignados los 4 pases de la carpa.',
    pasos: [
      { texto: 'Abrí la reserva y, en **Personas**, tocá el lápiz de esa persona.', imagen: '06-personas.png' },
      { texto: 'Completá el **DNI** y la **Edad**, y guardá.' },
      { texto: 'Tildá **Pileta**. Si ya hay 4 asignados, sacale el tilde a otra persona o vendele un pase pago.' }
    ],
    secciones: ['carpas', 'pileta', 'reservas']
  },
  {
    id: 'vender-pase',
    pregunta: '¿Cómo vendo un pase de pileta?',
    resumen: 'A alguien de una carpa se le vende desde la reserva de esa carpa; a quien viene solo a la pileta, desde **Pileta**.',
    pasos: [
      { texto: 'Abrí la reserva de la carpa y, en **Servicios incluidos**, tocá **Vender pase de pileta**.', imagen: '06-incluidos.png' },
      { texto: 'En **Personas sin pase**, tildá a quién es: el cliente y las fechas ya vienen de la carpa.', imagen: '06-vender-pase.png' },
      { texto: 'Escribí el **Precio por adulto por día** y el **Precio por niño por día**: el total se calcula solo.' },
      { texto: 'Si paga en el momento, cargá el **Pago inicial**. Tocá **Guardar pase**.' }
    ],
    nota: 'Para alguien que viene solo a la pileta: en **Pileta**, tocá **Nuevo Pase** y elegí el cliente (obligatorio), las fechas, cuántos adultos y niños, y el precio por día.',
    secciones: ['pileta', 'carpas', 'sombrillas']
  },
  {
    id: 'cochera-se-movio',
    pregunta: 'Moví una carpa y la cochera se movió sola.',
    resumen: 'Es así a propósito: la cochera y la pileta incluidas acompañan a la carpa.',
    pasos: [
      { texto: 'Si aparece un aviso sobre un pase pago, abrí la carpa y revisá ese pase: los pases pagos no se mueven solos.', imagen: '06-aviso.png' }
    ],
    secciones: ['carpas', 'estacionamiento', 'reservas']
  },
  {
    id: 'cambiar-plaza',
    pregunta: 'Quiero cambiar la cochera incluida de plaza.',
    resumen: 'Se cambia desde la carpa, no desde la cochera.',
    pasos: [
      { texto: 'Abrí la reserva de la carpa y tocá **Editar**.', imagen: '06-botones.png' },
      { texto: 'En **Cocheras incluidas**, cambiá la plaza o la patente.' },
      { texto: 'Tocá **Guardar cambios**.' }
    ],
    nota: 'La cochera incluida acepta otra plaza y otra patente, pero no otras fechas: esas siguen a la carpa.',
    secciones: ['estacionamiento', 'carpas']
  },
  {
    id: 'otro-auto',
    pregunta: 'Un cliente viene con otro auto.',
    resumen: 'La patente va en cada reserva, no solo en la ficha del cliente.',
    pasos: [
      { texto: 'En la reserva o en su cochera, escribí la patente nueva en **Patente**.' },
      { texto: 'Guardá. La ficha del cliente no cambia: solo se usa para completar la patente sola.' }
    ],
    secciones: ['estacionamiento', 'clientes']
  },

  // --- Precio y cobro ---
  {
    id: 'de-donde-sale-precio',
    pregunta: '¿De dónde sale el precio de una reserva?',
    resumen: 'Lo calcula el sistema día por día con las tarifas cargadas en **Tarifas**, y muestra el detalle en el formulario.',
    imagen: '04-precio.png',
    nota: 'Si la estadía cruza de una temporada a otra, cada día se cobra al precio de su temporada. Si entra en una tarifa por estadía (una quincena o la temporada completa), se cobra esa en lugar de sumar los días.',
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'tarifas']
  },
  {
    id: 'cobrar-distinto',
    pregunta: '¿Cómo cobro distinto a la tarifa (un descuento o un redondeo)?',
    resumen: 'Se cambia el total y se explica el motivo, que queda guardado.',
    pasos: [
      { texto: 'En el formulario de la reserva, cambiá el **Total cobrado**.' },
      { texto: 'Escribí el **Motivo del ajuste**: es obligatorio cuando el total no coincide con la tarifa.', imagen: '05-ajuste.png' },
      { texto: 'Tocá **Guardar reserva**.' }
    ],
    nota: 'La reserva guarda el precio de la tarifa, lo cobrado y el motivo, así después se puede revisar cada descuento.',
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'reservas']
  },
  {
    id: 'consultar-precio',
    pregunta: 'El precio dice “Consultar precio”.',
    resumen: 'Faltan tarifas para esos días o para ese servicio.',
    pasos: [
      { texto: 'Para esta reserva: escribí el total a mano en **Total cobrado** y guardá. No pide motivo.' },
      { texto: 'Para que no vuelva a pasar: en **Tarifas → Precios**, completá el precio de los períodos que faltan.', imagen: '13-tarifas-precios.png' }
    ],
    secciones: ['carpas', 'sombrillas', 'estacionamiento', 'tarifas']
  },
  {
    id: 'tarifa-vieja',
    pregunta: 'Cambié una tarifa y una reserva vieja no cambió.',
    resumen: 'Es así a propósito: cada reserva conserva el precio con que se hizo.',
    nota: 'Una reserva se recalcula con las tarifas nuevas solo si le cambiás las fechas o la unidad desde **Editar**.',
    secciones: ['tarifas', 'reservas']
  },
  {
    id: 'registrar-pago',
    pregunta: '¿Cómo registro un pago?',
    resumen: 'Desde la reserva, en el historial de pagos.',
    pasos: [
      { texto: 'Abrí la reserva: un clic sobre ella en el calendario, o el botón ⓘ en **Reservas**.' },
      { texto: 'En **Historial de pagos**, tocá **+ Agendar pago**.', imagen: '06-pagos.png' },
      { texto: 'Completá el **Monto del pago**, la **Fecha del pago** y el **Método de pago**.', imagen: '06-agendar-pago.png' },
      { texto: 'Tocá **Guardar pago**: volvés al detalle con el saldo actualizado.' }
    ],
    nota: 'En el listado de **Reservas** también podés cobrar con el botón verde de cada fila.',
    secciones: ['reservas', 'carpas', 'sombrillas', 'estacionamiento', 'pileta']
  },
  {
    id: 'pagar-todo-junto',
    pregunta: 'El cliente quiere pagar todo junto.',
    resumen: 'Se carga un solo pago y el sistema lo reparte solo: la carpa, las cocheras y la pileta paga.',
    pasos: [
      { texto: 'Abrí la reserva de la carpa y tocá **+ Agendar pago**.' },
      { texto: 'El monto ya viene con el **Saldo de la cuenta**: elegí el **Método de pago** y tocá **Guardar pago**.', imagen: '06-agendar-pago.png' }
    ],
    secciones: ['reservas', 'carpas']
  },
  {
    id: 'comprobante',
    pregunta: '¿Cómo le doy un comprobante al cliente?',
    resumen: 'Desde la reserva se descarga un PDF con toda la cuenta.',
    pasos: [
      { texto: 'Abrí la reserva.' },
      { texto: 'Tocá **Descargar comprobante**, abajo de todo.', imagen: '06-botones.png' },
      { texto: 'Se descarga un PDF con la carpa, la pileta, las cocheras, los pases pagos, cada pago y el saldo. Mandáselo o imprimilo.' }
    ],
    secciones: ['reservas', 'carpas', 'sombrillas']
  },
  {
    id: 'imprimir-contrato',
    pregunta: '¿Cómo imprimo el contrato de una carpa?',
    resumen: 'Desde la reserva de la carpa o la sombrilla se baja un PDF listo para firmar.',
    pasos: [
      { texto: 'Abrí la reserva.' },
      { texto: 'Tocá **Imprimir contrato**, abajo de todo.', imagen: '06-botones.png' },
      { texto: 'Se descarga un PDF con los datos del titular, la unidad, el período, el importe, las cocheras, las personas y las condiciones del balneario. Imprimilo y que lo firme.', imagen: '06-contrato.png' }
    ],
    nota: 'Lo que falte en la ficha del cliente, como el DNI o la dirección, sale con puntos para completar a mano.',
    secciones: ['reservas', 'carpas', 'sombrillas']
  },

  // --- Cambiar o cancelar ---
  {
    id: 'editar',
    pregunta: '¿Cómo cambio las fechas o la carpa de una reserva?',
    resumen: 'Desde **Editar**, en la reserva.',
    pasos: [
      { texto: 'Abrí la reserva y tocá **Editar**.', imagen: '06-botones.png' },
      { texto: 'Cambiá el **Número de carpa** o las fechas. El sistema recalcula el precio con las tarifas de las fechas nuevas y lo muestra antes de guardar.' },
      { texto: 'Tocá **Guardar cambios**.' }
    ],
    nota: 'La pileta incluida y las cocheras se mueven con la carpa. Los pases pagos no: el sistema avisa para que los revises.',
    secciones: ['reservas', 'carpas', 'sombrillas']
  },
  {
    id: 'cancelar',
    pregunta: '¿Cómo cancelo una reserva?',
    resumen: 'Desde la reserva. La unidad queda libre y la reserva pasa al historial como cancelada.',
    pasos: [
      { texto: 'Abrí la reserva y tocá **Cancelar reserva**.', imagen: '06-botones.png' },
      { texto: 'Confirmá.' }
    ],
    nota: 'La pileta y las cocheras incluidas se cancelan con ella. Los pases pagos quedan como están, para que decidas qué hacer.',
    secciones: ['reservas', 'carpas', 'sombrillas']
  },

  // --- Pantallas y reportes ---
  {
    id: 'colores-vista-rapida',
    pregunta: '¿Qué significan los colores de la Vista rápida?',
    resumen: '**Verde**: ocupada ese día. **Amarillo**: libre, pero con una reserva que empieza pronto. **Blanco**: libre.',
    imagen: '03-vista-rapida.png',
    nota: 'Pasando el mouse por una unidad ves su ficha. Un clic en una ocupada abre la reserva, y en una libre empieza una nueva.',
    secciones: ['vista-diaria']
  },
  {
    id: 'caja-efectivo',
    pregunta: 'Quiero saber cuánto se cobró hoy en efectivo.',
    resumen: 'Está en el reporte de pagos, filtrando por efectivo.',
    pasos: [
      { texto: 'Entrá a **Reportes** y elegí **Pagos**.' },
      { texto: 'Poné la fecha de hoy en **Desde** y en **Hasta**.' },
      { texto: 'En **Método de pago**, elegí **Efectivo**. Arriba ves el **Total cobrado**.', imagen: '11-reportes-pagos.png' }
    ],
    secciones: ['reportes', 'inicio']
  },
  {
    id: 'deudores',
    pregunta: 'Quiero ver quién se fue debiendo plata.',
    resumen: 'En **Clientes** hay un filtro para eso.',
    pasos: [
      { texto: 'Entrá a **Clientes**.' },
      { texto: 'Tildá **Solo con deuda de reservas terminadas**: cada cliente muestra en rojo cuánto debe.', imagen: '08-clientes.png' }
    ],
    secciones: ['clientes', 'reportes']
  },
  {
    id: 'cargar-temporadas',
    pregunta: '¿Cómo cargo las temporadas y los precios?',
    resumen: 'En **Tarifas**, completando las pestañas en orden. Se carga una vez y sirve para todas las temporadas.',
    pasos: [
      { texto: 'En **Períodos**, cargá cada temporada: el nombre, **Desde** y **Hasta** (día/mes) y la **Prioridad**. Tocá **Agregar período**.', imagen: '13-tarifas-periodos.png' },
      { texto: 'Si hay unidades que se cobran distinto (una terraza, la primera fila), en **Sectores** creá un sector y tocá esas unidades en el plano. Si no, salteá este paso.', imagen: '13-tarifas-sectores.png' },
      { texto: 'En **Precios**, elegí el servicio y escribí el precio por día de cada período. Se guarda solo al salir de la celda.', imagen: '13-tarifas-precios.png' }
    ],
    nota: 'Las fechas no tienen año. Los días que no caen en ningún período se marcan en rojo en la tira del año: esas reservas saldrían “Consultar precio”.',
    secciones: ['tarifas']
  },
  {
    id: 'datos-contrato',
    pregunta: '¿Cómo cambio las fechas o los horarios del contrato?',
    resumen: 'En **Panel de usuario**, pestaña **Contrato**: se cambia el valor en la tabla de datos y el texto se actualiza solo.',
    pasos: [
      { texto: 'Entrá a **Panel de usuario**, pestaña **Contrato**.' },
      { texto: 'En **Datos del contrato**, cambiá el valor que corresponda: la temporada, una fecha, un horario.', imagen: '13-contrato-datos.png' },
      { texto: 'Tocá **Guardar**. Con **Vista previa en PDF** ves cómo queda.' }
    ],
    nota: 'En las condiciones, un dato se escribe con su nombre entre llaves, como {Pileta abre}, y sale en negrita con su valor.',
    secciones: ['panel-usuario']
  },

  // --- Cuenta ---
  {
    id: 'sesion-vencio',
    pregunta: 'Me sacó del sistema: “Tu sesión venció”.',
    resumen: 'La sesión se cierra sola una hora después de entrar, por seguridad.',
    pasos: [
      { texto: 'Volvé a ingresar con tu email y tu contraseña.', imagen: '01-sesion-vencida.png' },
      { texto: 'Si estabas cargando una reserva, no se guardó: cargala de nuevo.' }
    ],
    secciones: []
  },
  {
    id: 'cambiar-clave',
    pregunta: '¿Cómo cambio mi contraseña?',
    resumen: 'En **Panel de usuario**, pestaña **Perfil**.',
    pasos: [
      { texto: 'Entrá a **Panel de usuario**, pestaña **Perfil**.', imagen: '12-perfil.png' },
      { texto: 'Tocá **Cambiar contraseña**, escribí la actual y la nueva (de 8 caracteres o más) y guardá.' }
    ],
    secciones: ['panel-usuario']
  },
  {
    id: 'usuario-empleado',
    pregunta: 'Quiero darle un usuario a un empleado.',
    resumen: 'En **Panel de usuario**, pestaña **Usuarios**. Cada persona entra con el suyo y ve solo lo que su rol le permite.',
    pasos: [
      { texto: 'Entrá a **Panel de usuario**, pestaña **Usuarios**.' },
      { texto: 'Escribí su **Email**, elegí el **Rol** y tocá **Crear usuario**.', imagen: '13-usuarios.png' },
      { texto: 'Pasale la clave que aparece, o tocá **Copiar usuario y clave**: no se vuelve a mostrar.' }
    ],
    nota: '**Empleado**: reservas, cobros, clientes y reportes, sin Tarifas ni Soporte. **Pileta**: solo los pases de pileta, para controlar la entrada desde el celular.',
    secciones: ['panel-usuario']
  },
  {
    id: 'clave-empleado',
    pregunta: 'Un empleado se olvidó la clave.',
    resumen: 'En **Panel de usuario**, pestaña **Usuarios**, tocá **Clave nueva** en su renglón y pasale la que aparece.',
    nota: 'Si alguien deja de trabajar en el balneario, borrá su usuario con el tacho: así ya no puede entrar.',
    secciones: ['panel-usuario']
  }
];

// Para buscar sin que importen las tildes ni las mayusculas.
export const normalizar = (texto) =>
  String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const textoCompleto = (p) =>
  [p.pregunta, p.resumen, ...(p.pasos || []).map((paso) => paso.texto), p.nota].filter(Boolean).join(' ').replace(/\*\*/g, '');

/** Las imagenes que usa una pregunta, en orden. */
export const imagenesDe = (p) => [p.imagen, ...(p.pasos || []).map((paso) => paso.imagen)].filter(Boolean);

/** Las preguntas que contienen todas las palabras buscadas. */
export function buscarPreguntas(busqueda, preguntas = PREGUNTAS_FRECUENTES) {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (!palabras.length) return preguntas;
  return preguntas.filter((p) => {
    const texto = normalizar(textoCompleto(p));
    return palabras.every((palabra) => texto.includes(palabra));
  });
}
