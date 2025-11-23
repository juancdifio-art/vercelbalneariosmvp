# Manual operativo - Balnearios

## Acceso al sistema

### Objetivo

Explicar cómo iniciar sesión en el panel interno del balneario y cómo cerrar sesión de forma segura.

### Cómo iniciar sesión

1. Abrir la URL del sistema en el navegador.
2. Completar **Email** y **Contraseña**.
3. Presionar **"Iniciar sesión"**.
4. Si los datos son correctos, se ingresa al panel interno del balneario.

En caso de error:

- Si las credenciales son incorrectas, el sistema muestra un mensaje y no permite el acceso.
- Si la sesión expira o es inválida, el sistema muestra un mensaje similar a **"Sesión inválida. Volvé a iniciar sesión."** y redirige nuevamente a la pantalla de login.

### Cómo cerrar sesión

- Desde el menú lateral (en escritorio), usar el botón **"Cerrar sesión"**.
- En pantallas chicas (mobile) también hay un botón **"Cerrar sesión"** dentro del panel principal.
- Al cerrar sesión, se limpia el estado interno (reservas mostradas, filtros, etc.) y se vuelve a la pantalla de login.

**Nota importante**: El sistema usa sesiones temporales. Si cerrás el navegador completamente, la sesión se cierra automáticamente y tendrás que volver a iniciar sesión la próxima vez que abras el sistema.

## Configuración del establecimiento

### Objetivo

Definir los datos básicos del balneario (nombre, servicios y capacidades) antes de comenzar a operar.

### Primer ingreso (configuración inicial)

1. Después de iniciar sesión por primera vez, si el establecimiento aún no está configurado, aparece una pantalla de **"Configurar establecimiento"**.
2. Completar:
   - **Nombre del establecimiento**.
   - **Servicios que ofrece**:
     - Carpas.
     - Sombrillas.
     - Estacionamiento.
     - Pileta.
   - **Capacidades**:
     - Cantidad de carpas.
     - Cantidad de sombrillas.
     - Cantidad de plazas de estacionamiento.
     - Aforo máximo de pileta.
3. Presionar **"Guardar"** para guardar la configuración.
4. Si todo es correcto, el sistema guarda los datos y te lleva a la sección **Inicio**.

### Modificar la configuración más adelante

1. Desde el menú lateral, ir a **"Configurar establecimiento"**.
2. Ajustar nombre, servicios habilitados y capacidades según sea necesario.
3. Guardar los cambios.

Notas:

- Las secciones **Carpas**, **Sombrillas**, **Estacionamiento** y **Pileta** solo aparecen en el menú si el servicio está habilitado en la configuración del establecimiento.
- Si se reduce la capacidad de algún servicio mientras ya hay reservas, revisar con cuidado para evitar inconsistencias operativas.

## Gestión de clientes

### Objetivo

Centralizar los datos de los clientes para reutilizarlos rápidamente al crear reservas.

### Cómo usar la sección "Clientes"

1. Ir a la sección **Clientes** desde el menú lateral.
2. En la tabla se muestran:
   - Nombre.
   - Teléfono.
   - Email.
   - Notas.
3. Acciones disponibles:
   - **+ Nuevo cliente**:
     - Abre un formulario para cargar un cliente nuevo (nombre, teléfono, email, notas).
   - **Editar**:
     - Permite actualizar los datos de un cliente existente.
   - **Eliminar**:
     - Elimina el cliente de la lista.
     - Las reservas existentes asociadas a ese cliente no se borran; simplemente dejan de mostrar al cliente en la lista de clientes guardados.

### Uso recomendado

- Cargar clientes frecuentes en esta sección y luego seleccionarlos desde las pantallas de reserva para completar automáticamente nombre y teléfono.

## Pagos de reserva

### Objetivo

Registrar correctamente los pagos de las reservas, ver el saldo pendiente y evitar errores comunes (como cobrar de más o dejar datos incompletos).

### Requisitos

- Tener usuario y contraseña para acceder al sistema.
- Estar logueado en el panel interno del balneario.
- Haber configurado el establecimiento (nombre, servicios y capacidades) desde la sección **"Configurar establecimiento"**.

### Cómo registrar un pago de una reserva

1. **Ir a la sección "Reservas"**
   - Desde el menú lateral, seleccionar la opción **Reservas**.

2. **Buscar la reserva**
   - Usar los filtros de la parte superior si hace falta:
     - Servicio: Carpas / Sombrillas / Estacionamiento o Todos.
     - Estado: Activas / Canceladas / Todas.
     - Fechas: Desde / Hasta.
   - Ubicar en la tabla la reserva sobre la que se quiere registrar el pago.

3. **Abrir el detalle de la reserva**
   - Hacer clic en el botón **"Detalle de reserva"** de esa fila.
   - Se abre un panel con la información principal:
     - Servicio y número de recurso.
     - Fechas de entrada y salida.
     - Nombre y teléfono del cliente.
     - Precio total de la estadía.
     - Pagos realizados hasta el momento.
     - **Saldo pendiente**.

4. **Agendar un pago**
   - Dentro del detalle, presionar el botón **"Agendar pago"**.
   - Se abre el modal **"Agregar pago"**.
   - En ese modal:
     - El campo **"Monto del pago"** se completa automáticamente con el **saldo pendiente** (se puede ajustar si hace falta cobrar solo una parte).
     - Completar **"Fecha del pago"**.
     - Seleccionar **"Método de pago"**:
       - Efectivo.
       - Transferencia.
       - Tarjeta de crédito.
       - Otro.
     - Opcional: escribir **Notas de pago** (ejemplo: "Transferencia Banco X", "Señal en efectivo", etc.).

5. **Guardar el pago**
   - Revisar que los datos sean correctos.
   - Presionar **"Guardar pago"**.

### Reglas importantes (validaciones)

- **Método obligatorio**
  - No se puede guardar un pago si **no se selecciona un método de pago**.
  - En ese caso, el sistema muestra un mensaje y no registra el pago.

- **Monto máximo permitido**
  - El sistema **no permite guardar un pago con un monto mayor al saldo pendiente**.
  - Si se ingresa un monto mayor, aparece un mensaje indicando que el valor supera el saldo.
  - Esto evita que se registren cobros de más por error.

- **Saldo pendiente y pagos realizados**
  - Después de guardar el pago:
    - El monto se suma a los **Pagos realizados** de la reserva.
    - El **Saldo pendiente** se actualiza automáticamente.
  - Si el saldo llega a cero, la reserva quedará marcada como totalmente cobrada (aunque el estado de la reserva sigue siendo *Activa* o *Cancelada* según corresponda).

### Cómo consultar los pagos de una reserva

1. Ir a **Reservas**.
2. Buscar la reserva.
3. Abrir **"Detalle de reserva"**.
4. En la sección **"Pagos de la reserva"** se ve una lista con:
   - Fecha del pago.
   - Monto.
   - Método entre paréntesis (Ej.: `15000 (Efectivo)`).

Esto permite revisar rápidamente el historial de cobros asociados a cada reserva.

## Uso de la sección "Reservas"

### Objetivo

Explicar cómo leer y utilizar la tabla de reservas para encontrar información rápidamente y realizar acciones básicas.

### Cómo usar la tabla de reservas

1. **Ingresar a la sección "Reservas"** desde el menú lateral.
2. **Filtrar las reservas** si hace falta:
   - Servicio: Carpas / Sombrillas / Estacionamiento o Todos.
   - Estado: Activas / Canceladas / Todas.
   - Fechas: Desde / Hasta (muestra las reservas cuyo rango se solapa con el intervalo elegido).
3. **Leer la fila de una reserva**:
   - Servicio y número de recurso (Carpa, Sombrilla, Estacionamiento).
   - Fechas de entrada y salida.
   - Cliente y teléfono.
   - Total (ARS) y notas.
   - Estado: chip verde (*Activa*) o gris (*Cancelada*).
4. **Acciones disponibles en cada reserva**:
   - Botón de **detalle** (icono gris): abre el modal con toda la información de la reserva.
   - Botón de **pago** (icono verde): abre directamente el modal para agendar un pago.

### Editar o cancelar una reserva

1. Abrir el **Detalle de reserva** desde la tabla.
2. Usar los botones de la parte inferior:
   - **Editar**: permite cambiar datos básicos de la reserva (cliente, teléfono, notas, precio total).
   - **Cancelar reserva**: marca la reserva como cancelada y libera las fechas en la grilla correspondiente.
   - **📄 Descargar comprobante**: genera un PDF con todos los datos de la reserva para compartir con el cliente.
3. Guardar los cambios y cerrar el modal.

### Generar comprobante de reserva

El sistema permite generar un comprobante en PDF para cada reserva, ideal para entregar al cliente como constancia.

**Cómo generar un comprobante:**

1. Abrir el **Detalle de reserva** desde la tabla de reservas o desde el dashboard.
2. Hacer clic en el botón **"📄 Descargar comprobante"** en la parte inferior del modal.
3. El sistema descargará automáticamente un archivo PDF con el nombre `Comprobante_Reserva_[ID]_[fecha].pdf`.

**Información incluida en el comprobante:**

- **Header con el nombre del establecimiento** y número de reserva
- **Datos del servicio**: tipo (Carpa/Sombrilla/Estacionamiento), número, fechas de entrada y salida, cantidad de días
- **Datos del cliente**: nombre y teléfono
- **Datos económicos**: precio total, monto pagado, saldo pendiente (o "PAGADO COMPLETO" si está saldado)
- **Historial de pagos**: listado de todos los pagos realizados con fecha, monto y método
- **Notas**: cualquier observación adicional sobre la reserva
- **Footer**: fecha y hora de emisión del comprobante

**Usos recomendados:**

- Entregar al cliente al momento de hacer la reserva
- Enviar por WhatsApp o email como confirmación
- Imprimir para archivo físico del establecimiento
- Compartir al momento del check-in como recordatorio

## Uso de la vista de "Carpas"

### Objetivo

Ver de forma rápida qué carpas están reservadas en los próximos días y crear nuevas reservas desde la grilla.

### Cómo leer la grilla

1. Ir a la sección **Carpas** en el menú lateral.
2. En la parte superior se ve:
   - La **capacidad configurada** de carpas.
   - El rango de fechas mostrado (siempre 30 días consecutivos).
   - Botones para moverse **10 días hacia atrás** o **10 días hacia adelante**.
3. En la grilla:
   - Filas = Carpa 1, Carpa 2, etc.
   - Columnas = días.
   - El **día de hoy** aparece resaltado en el encabezado y en la columna correspondiente.
   - Los bloques coloreados representan días reservados; los colores ayudan a distinguir reservas distintas.

### Acciones sobre la grilla de carpas

1. **Ver el detalle de una reserva existente**:
   - Posar el mouse sobre un bloque de color para ver un tooltip con nombre del cliente y rango de fechas.
   - Hacer clic en ese bloque: se abre el **Detalle de reserva** para esa carpa y fechas.
2. **Crear una nueva reserva desde la grilla**:
   - Hacer clic en una celda en blanco (no reservada).
   - El sistema prepara un formulario de reserva para esa carpa y fecha.
   - Completar los datos del cliente, fechas de entrada/salida y el valor diario según corresponda.
   - Guardar la reserva: el bloque de días quedará coloreado en la grilla.

> Nota: la lógica de pagos (agendar pagos, ver saldo pendiente, etc.) se maneja siempre desde la sección **Reservas** y su **Detalle de reserva**.

## Cómo crear una reserva de carpa paso a paso

1. Ir al menú lateral y seleccionar la sección **Carpas**.
2. Verificar que la **capacidad de carpas** esté configurada y que la grilla muestre el rango de fechas correcto.
3. Usar los botones de **"◀ 10 días"** y **"10 días ▶"** si necesitás moverte hacia atrás o adelante en el calendario.
4. En la grilla, buscar la fila de la carpa que querés reservar (Carpa 1, Carpa 2, etc.).
5. Hacer clic en una **celda en blanco** (un día sin reserva) en esa fila.
6. Se abrirá un formulario de reserva para esa carpa y fecha. Allí podés:
   - Usar el campo **"Cliente guardado"** para seleccionar un cliente ya cargado en la sección **Clientes** (el sistema completa automáticamente nombre y teléfono).
   - Ajustar la **fecha de entrada** y la **fecha de salida** si querés reservar varios días.
   - Completar o ajustar los datos del **cliente** (nombre, teléfono, etc.) si hace falta.
   - Definir el **precio por día** y, según el caso, el total estimado de la estadía.
7. Revisar que todos los datos sean correctos y confirmar/guardar la reserva.
8. Volver a la grilla de Carpas: los días reservados aparecerán **coloreados** en la fila de esa carpa.

## Uso de la vista de "Sombrillas"

### Objetivo

Ver de forma rápida qué sombrillas están reservadas en los próximos días y crear nuevas reservas desde la grilla.

### Cómo leer la grilla de sombrillas

1. Ir a la sección **Sombrillas** en el menú lateral.
2. En la parte superior se ve:
   - La **capacidad configurada** de sombrillas.
   - El rango de fechas mostrado (siempre 30 días consecutivos).
   - Botones para moverse **10 días hacia atrás** o **10 días hacia adelante**.
3. En la grilla:
   - Filas = Sombrilla 1, Sombrilla 2, etc.
   - Columnas = días.
   - El **día de hoy** aparece resaltado en el encabezado y en la columna correspondiente.
   - Los bloques coloreados representan días reservados; los colores ayudan a distinguir reservas distintas.

### Acciones sobre la grilla de sombrillas

1. **Ver el detalle de una reserva existente**:
   - Posar el mouse sobre un bloque de color para ver un tooltip con nombre del cliente y rango de fechas.
   - Hacer clic en ese bloque: se abre el **Detalle de reserva** para esa sombrilla y fechas.
2. **Crear una nueva reserva desde la grilla**:
   - Hacer clic en una celda en blanco (no reservada).
   - El sistema prepara un formulario de reserva para esa sombrilla y fecha.
   - Completar los datos del cliente, fechas de entrada/salida y el valor diario según corresponda.
   - Guardar la reserva: el bloque de días quedará coloreado en la grilla.

> Nota: igual que en Carpas, la lógica de pagos (agendar pagos, ver saldo pendiente, etc.) se maneja siempre desde la sección **Reservas** y su **Detalle de reserva**.

## Cómo crear una reserva de sombrilla paso a paso

1. Ir al menú lateral y seleccionar la sección **Sombrillas**.
2. Verificar que la **capacidad de sombrillas** esté configurada y que la grilla muestre el rango de fechas correcto.
3. Usar los botones de **"◀ 10 días"** y **"10 días ▶"** si necesitás moverte hacia atrás o adelante en el calendario.
4. En la grilla, buscar la fila de la sombrilla que querés reservar (Sombrilla 1, Sombrilla 2, etc.).
5. Hacer clic en una **celda en blanco** (un día sin reserva) en esa fila.
6. Se abrirá un formulario de reserva para esa sombrilla y fecha. Allí podés:
   - Usar el campo **"Cliente guardado"** para seleccionar un cliente ya cargado en la sección **Clientes** (el sistema completa automáticamente nombre y teléfono).
   - Ajustar la **fecha de entrada** y la **fecha de salida** si querés reservar varios días.
   - Completar o ajustar los datos del **cliente** (nombre, teléfono, etc.) si hace falta.
   - Definir el **precio por día** y, según el caso, el total estimado de la estadía.
7. Revisar que todos los datos sean correctos y confirmar/guardar la reserva.
8. Volver a la grilla de Sombrillas: los días reservados aparecerán **coloreados** en la fila de esa sombrilla.

## Uso de la vista de "Estacionamiento"

### Objetivo

Ver de forma rápida qué plazas de estacionamiento están reservadas en los próximos días y crear nuevas reservas desde la grilla.

### Cómo leer la grilla de estacionamiento

1. Ir a la sección **Estacionamiento** en el menú lateral.
2. En la parte superior se ve:
   - La **capacidad configurada** de plazas de estacionamiento.
   - El rango de fechas mostrado (siempre 30 días consecutivos).
   - Botones para moverse **10 días hacia atrás** o **10 días hacia adelante**.
3. En la grilla:
   - Filas = Plaza 1, Plaza 2, etc.
   - Columnas = días.
   - El **día de hoy** aparece resaltado en el encabezado y en la columna correspondiente.
   - Los bloques coloreados representan días reservados; los colores ayudan a distinguir reservas distintas.

### Acciones sobre la grilla de estacionamiento

1. **Ver el detalle de una reserva existente**:
   - Posar el mouse sobre un bloque de color para ver un tooltip con nombre del cliente y rango de fechas.
   - Hacer clic en ese bloque: se abre el **Detalle de reserva** para esa plaza y fechas.
2. **Crear una nueva reserva desde la grilla**:
   - Hacer clic en una celda en blanco (no reservada).
   - El sistema prepara un formulario de reserva para esa plaza y fecha.
   - Completar los datos del cliente, fechas de entrada/salida y el valor diario según corresponda.
   - Guardar la reserva: el bloque de días quedará coloreado en la grilla.

> Nota: igual que en Carpas y Sombrillas, la lógica de pagos (agendar pagos, ver saldo pendiente, etc.) se maneja siempre desde la sección **Reservas** y su **Detalle de reserva**.

## Cómo crear una reserva de estacionamiento paso a paso

1. Ir al menú lateral y seleccionar la sección **Estacionamiento**.
2. Verificar que la **capacidad de plazas de estacionamiento** esté configurada y que la grilla muestre el rango de fechas correcto.
3. Usar los botones de **"◀ 10 días"** y **"10 días ▶"** si necesitás moverte hacia atrás o adelante en el calendario.
4. En la grilla, buscar la fila de la plaza que querés reservar (Plaza 1, Plaza 2, etc.).
5. Hacer clic en una **celda en blanco** (un día sin reserva) en esa fila.
6. Se abrirá un formulario de reserva para esa plaza y fecha. Allí podés:
   - Usar el campo **"Cliente guardado"** para seleccionar un cliente ya cargado en la sección **Clientes** (el sistema completa automáticamente nombre y teléfono).
   - Ajustar la **fecha de entrada** y la **fecha de salida** si querés reservar varios días.
   - Completar o ajustar los datos del **cliente** (nombre, teléfono, etc.) si hace falta.
   - Definir el **precio por día** y, según el caso, el total estimado de la estadía.
7. Revisar que todos los datos sean correctos y confirmar/guardar la reserva.
8. Volver a la grilla de Estacionamiento: los días reservados aparecerán **coloreados** en la fila de esa plaza.

## Otras secciones del menú

### Inicio (Dashboard)

La sección **Inicio** es el panel principal del sistema que muestra un resumen completo del estado del negocio en tiempo real.

#### Métricas del día

En la parte superior se muestran 4 tarjetas con información clave:

- **📅 Reservas activas hoy**: Cantidad de reservas que están activas en el día actual.
- **💰 Ingresos del día**: Suma total de los pagos registrados en el día de hoy.
- **👥 Clientes únicos activos**: Cantidad de clientes diferentes con reservas activas.
- **📈 Ocupación promedio**: Porcentaje promedio de ocupación de todos los servicios (carpas, sombrillas, estacionamiento).

#### Estado de servicios

Muestra 3 tarjetas con barras de progreso que indican la ocupación actual de cada servicio:

- **🏖️ Carpas**: Cantidad de carpas ocupadas vs. total disponible, con porcentaje y barra de progreso naranja-roja.
- **☂️ Sombrillas**: Cantidad de sombrillas ocupadas vs. total disponible, con porcentaje y barra de progreso púrpura-rosa.
- **🚗 Estacionamiento**: Cantidad de plazas ocupadas vs. total disponible, con porcentaje y barra de progreso azul.

**Funcionalidad especial**: Al hacer clic en cualquiera de estas tarjetas, se filtra automáticamente la lista de "Últimas reservas" para mostrar solo las reservas de ese servicio.

#### Actividad reciente

Se divide en dos columnas:

**📋 Últimas reservas** (columna izquierda):
- Muestra las 5 reservas más recientes creadas en el sistema.
- Cada reserva muestra: servicio, número de recurso, nombre del cliente, fechas y precio.
- Al hacer clic en una reserva, se abre el modal de detalle completo.
- Se puede filtrar por servicio haciendo clic en las tarjetas de "Estado de servicios".
- Cuando hay un filtro activo, aparece un badge con el servicio seleccionado y un botón ✕ para quitarlo.

**💵 Últimos pagos** (columna derecha):
- Muestra los 5 pagos más recientes registrados en el sistema.
- Cada pago muestra: servicio, número de recurso, nombre del cliente, fecha, método de pago y monto.

#### Próximos check-ins

Sección ubicada en la parte inferior que muestra las próximas reservas que están por ingresar:

- Muestra las **próximas 5 reservas** que empiezan en los **próximos 7 días**.
- Solo incluye **carpas y sombrillas** (el estacionamiento no se muestra aquí).
- **Botones de filtro**: En la parte superior derecha hay dos botones para alternar entre ver solo carpas o solo sombrillas.
- **Indicadores de urgencia** con colores:
  - 🔴 **"¡Hoy!"** en rojo: para reservas que ingresan hoy.
  - 🟠 **"Mañana"** en naranja: para reservas que ingresan mañana.
  - ⚪ **"En X días"** en gris: para el resto de las reservas.
- Al hacer clic en cualquier check-in, se abre el modal de detalle completo de la reserva.

**Uso recomendado**: Revisar esta sección cada mañana para preparar las carpas/sombrillas que recibirán clientes ese día.

### Vista diaria

Vista pensada para mostrar disponibilidad y ocupación del día actual de forma rápida y visual. Permite ver de un vistazo qué recursos están ocupados y cuáles están disponibles para el día de hoy.

### Panel de usuario

Sección reservada para ajustes de la cuenta de usuario, según vaya evolucionando el sistema.
