# Updates - MVP Balnearios

## Índice

- [2025-11-16 - Inicio del proyecto](#2025-11-16---inicio-del-proyecto)
- [2025-11-17 - Configuración y panel interno](#2025-11-17---configuración-y-panel-interno)
- [2025-11-17 - Reservas y vista de reservas](#2025-11-17---reservas-y-vista-de-reservas)
- [2025-11-18 - Pagos de reservas y mejoras de UI](#2025-11-18---pagos-de-reservas-y-mejoras-de-ui)

## 2025-11-16 - Inicio del proyecto

- **Estructura general**
  - Creado proyecto desde cero en la carpeta `Paso a paso Balnearios`.
  - Separación en `backend/` (API) y `frontend/` (SPA React).

- **Backend (Node + Express + PostgreSQL)**
  - Creado `backend/package.json` con scripts `start` y `dev` usando `nodemon`.
  - Creado servidor Express básico en `backend/src/index.js`.
  - Agregado middleware CORS y JSON.
  - Definido endpoint `GET /api/health` para comprobar estado de la API y la base de datos.
  - Configurado `dotenv` para cargar variables desde `.env`.
  - Creado módulo de base de datos `backend/src/db.js` con `pg.Pool`.
  - Creado archivo de ejemplo de configuración `backend/.env.example`.
  - Creado script SQL `backend/schema.sql` con la tabla `users`.

- **Base de datos (PostgreSQL)**
  - Creado usuario de base de datos: `balneariosmvp_user`.
  - Asignada contraseña: `Balnearios123` (solo entorno local de desarrollo).
  - Creada base de datos: `balnearios_mvp` con owner `balneariosmvp_user`.
  - Ejecutado `schema.sql` en `balnearios_mvp` para crear la tabla `users`.
  - Trabajo en la configuración de `.env` y carga correcta de variables de entorno.

- **Frontend (React + Vite)**
  - Creado proyecto básico en `frontend/` con React 18 y Vite.
  - Configurado `vite.config` con plugin React.
  - Creado `index.html`, `src/main.jsx` y `src/App.jsx`.
  - Implementada pantalla de login con campos `email` y `password`.
  - Conectado el formulario de login al endpoint `POST /api/auth/login` del backend.
  - Login funcional de punta a punta: frontend → backend → PostgreSQL, guardando `authToken` en `localStorage`.
  - Estilos básicos implementados con CSS plano (Tailwind/Geist se deja para más adelante si hace falta).

## 2025-11-17 - Configuración y panel interno

- **Backend (establecimiento y capacidades)**
  - Actualizado `backend/schema.sql` para agregar tabla `establishments` relacionada con `users`.
  - Campos principales: `name`, flags de servicios (`has_parking`, `has_carpas`, `has_sombrillas`, `has_pileta`) y capacidades (`parking_capacity`, `carpas_capacity`, `sombrillas_capacity`, `pool_max_occupancy`).
  - Agregado middleware `authenticateToken` en `backend/src/index.js` para proteger rutas con JWT.
  - Implementados endpoints:
    - `GET /api/establishment/me` para obtener la configuración del establecimiento del usuario autenticado.
    - `POST /api/establishment` para crear/actualizar la configuración del establecimiento.

- **Frontend (estado autenticado y configuración)**
  - Extendida `App.jsx` para manejar estado autenticado (`isAuthenticated`, `authToken`, `authEmail`) y cargar datos desde `localStorage` al iniciar.
  - Agregado flujo que, tras el login, verifica si existe establecimiento:
    - Si no existe, muestra pantalla de **Configurar establecimiento**.
    - Si existe, entra al dashboard.
  - Pantalla de configuración de establecimiento con:
    - Nombre del establecimiento.
    - Servicios: Estacionamiento, Carpas, Sombrillas, Pileta.
    - Capacidades opcionales por servicio: plazas de estacionamiento, cantidad de carpas, cantidad de sombrillas, ocupación máxima de pileta.
    - Los campos de capacidad se muestran solo si el servicio está marcado.

- **Frontend (dashboard y navegación interna)**
  - Agregada sidebar de navegación con Tailwind (solo en desktop):
    - Inicio
    - Vista diaria
    - Secciones dinámicas según servicios activos: Carpas, Sombrillas, Estacionamiento, Pileta.
    - Sección de configuración con:
      - Configurar establecimiento
      - Panel de usuario
  - Sidebar colapsable mediante botón de flecha (chevron) en la cabecera del sidebar.
  - Vista de panel principal con encabezado y secciones stub (Inicio, Vista diaria, Clientes, etc.).

- **Frontend (vista de Carpas)**
  - Sección `Carpas` en el dashboard que muestra una grilla conceptual:
    - Filas: carpas (1..carpasCapacity).
    - Columnas: días consecutivos.
  - Calendario de 30 días:
    - Rango base de 30 días a partir de hoy.
    - Posibilidad de navegar el rango de fechas avanzando/retrocediendo de a 10 días.
    - El día de hoy se resalta tanto en el encabezado como en la columna correspondiente.
  - Grilla compacta (celdas pegadas, sin padding excesivo) para visualizar claramente bloques de días consecutivos.

- **Frontend (vista de Sombrillas y Estacionamiento)**
  - Secciones `Sombrillas` y `Estacionamiento` reutilizan el mismo patrón de grilla que Carpas:
    - Filas = unidades (Sombrilla 1..N, Plaza 1..N) según capacidad configurada.
    - Columnas = días consecutivos.
    - Calendario de 30 días con navegación de a 10 días.
    - Día de hoy resaltado en encabezado y columna.

## 2025-11-17 - Reservas y vista de reservas

- **Backend (reservas diarias y reserva madre)**
  - Actualizado `backend/schema.sql` para agregar tabla `reservation_groups` que representa la "reserva madre" con:
    - `service_type`, `resource_number`, `start_date`, `end_date`.
    - Datos de cliente: `customer_name`, `customer_phone`.
    - Datos de negocio: `total_price`, `notes`, `status`.
  - Agregado `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para que las columnas nuevas se agreguen incluso si la tabla ya existía.
  - Endpoints en `backend/src/index.js`:
    - `GET /api/reservations`: devuelve reservas diarias (una fila por día) para Carpa/Sombrilla/Parking.
    - `POST /api/reservations/toggle`: alterna una reserva diaria puntual (crear/eliminar una fecha puntual).
    - `POST /api/reservation-groups`:
      - Crea una reserva madre (rango de fechas) para un servicio/recurso.
      - Inserta automáticamente las filas diarias correspondientes en `reservations` usando `generate_series`.
      - Acepta opcionalmente `customerName`, `customerPhone`, `totalPrice`, `notes`.
    - `GET /api/reservation-groups`:
      - Lista reservas madre del establecimiento.
      - Filtros opcionales: `service` (carpa/sombrilla/parking), `status` (active/cancelled), `from` y `to` (rango de fechas con lógica de solapamiento).
    - `PATCH /api/reservation-groups/:id`:
      - Permite actualizar `customerName`, `customerPhone`, `totalPrice`, `notes` y `status`.
      - Si el estado pasa a `cancelled`, elimina las filas diarias de `reservations` que caen dentro del rango `start_date`/`end_date`.

- **Frontend (Carpas - reservas con rango de fechas y horario AR)**
  - Al hacer click en una celda de la grilla de Carpas se abre un modal centrado que permite:
    - Seleccionar **Fecha de entrada** y **Fecha de salida**.
    - Guardar una reserva para todo el rango de fechas o liberar un rango completo.
  - Normalización de fechas para evitar problemas de zona horaria (UTC vs Argentina):
    - Se parsean las fechas `YYYY-MM-DD` como fechas locales usando `new Date(year, monthIndex, day)`.
    - Los rangos se iteran con `date-fns/addDays` y se serializan a `yyyy-MM-dd` de forma consistente.
  - Guardar reserva en Carpas ahora:
    - Llama a `POST /api/reservation-groups` con `serviceType = 'carpa'`, `resourceNumber`, `startDate`, `endDate`.
    - Marca en memoria todas las celdas del rango como reservadas para que la grilla se actualice inmediatamente.
  - Liberar reserva en Carpas (por ahora):
    - Recorre el rango día a día y llama a `POST /api/reservations/toggle` para eliminar las reservas diarias existentes.
    - La reserva madre permanece en la base (sirve como rastro histórico por ahora). Más adelante se podrá cancelar desde un flujo dedicado si hace falta.

- **Frontend (sección Reservas)**
  - Nueva sección **"Reservas"** en la navegación principal.
  - Contiene un listado de reservas madre (resultado de `GET /api/reservation-groups`) presentado como tabla con columnas:
    - Servicio (Carpa/Sombrilla/Estacionamiento).
    - Recurso (número de carpa/sombrilla/plaza).
    - Entrada / Salida.
    - Cliente, Teléfono, Precio total y Notas (solo lectura, con truncado y `title` para ver el valor completo).
    - Estado (chip verde para *Activa*, chip gris para *Cancelada*).
  - Filtros en la parte superior:
    - **Servicio**: Todos / Carpas / Sombrillas / Estacionamiento.
    - **Estado**: Todos / Activas / Canceladas.
    - **Rango de fechas**: Desde / Hasta (filtra reservas cuyo rango se solapa con el intervalo seleccionado).
  - Acciones por reserva (columna de íconos):
    - Ícono gris de información: abre un **modal de Detalle de reserva** con datos completos de la reserva.
    - Ícono verde de tarjeta: abre un **modal de Pago de reserva** para editar importe total y notas de pago.
  - Modales:
    - **Detalle de reserva**:
      - Muestra servicio + recurso, fechas, cliente, teléfono, precio total, notas y estado con chip de color.
      - Solo lectura; botón "Cerrar".
    - **Pago de reserva** (versión inicial):
      - Muestra servicio + recurso, fechas.
      - Permitía editar `Importe total (ARS)` y `Notas de pago` (antes de implementar pagos múltiples).
  - Pulido de UI:
    - Se eliminaron los textos en los botones de acciones en la tabla, quedando solo los íconos (detalle/pago) para una vista más limpia.
    - El título interno de la tarjeta ahora es simplemente "Reservas" y se evita duplicar el título con el encabezado de la sección.

## 2025-11-18 - Pagos de reservas y mejoras de UI

- **Backend (pagos de reservas)**
  - Agregada tabla dedicada de pagos de reservas (`reservation_payments`) en `schema.sql` para registrar múltiples pagos asociados a un `reservation_group`.
  - Implementados endpoints en `backend/src/index.js`:
    - `GET /api/reservation-groups/:id/payments`: devuelve el listado de pagos de una reserva madre.
    - `POST /api/reservation-groups/:id/payments`: crea un nuevo pago asociado a la reserva madre.

- **Frontend (detalle de reserva y pagos)**
  - El modal **"Detalle de reserva"** ahora muestra:
    - Total de la estadía (`totalPrice`).
    - Pagos realizados (`paidAmount`).
    - **Saldo pendiente** calculado dinámicamente (`total - pagos`), en verde si está cubierto y en rojo si todavía hay saldo por cobrar.
    - Listado de pagos realizados con fecha, monto y método (Efectivo / Transferencia / Tarjeta / Otro) entre paréntesis junto al monto.
  - Agregado botón **"Agendar pago"** dentro del modal de detalle, además del botón de la tabla de reservas.

- **Frontend (modal "Agregar pago")**
  - Nuevo flujo de pagos múltiples por reserva usando el endpoint `POST /api/reservation-groups/:id/payments`.
  - El modal de **"Agregar pago"** incluye:
    - Monto del pago, fecha, método de pago y notas.
    - Monto sugerido precargado con el **saldo pendiente** para agilizar el trabajo del operador.
  - Validaciones de negocio en el cliente:
    - No permite guardar si **no se selecciona método de pago**.
    - No permite guardar un pago con monto **mayor al saldo pendiente**, mostrando un mensaje claro al operador.
  - Al guardar un pago se actualiza en memoria el `paidAmount` del grupo, para que el saldo se vea actualizado sin recargar toda la lista.

- **Refactor de frontend (estructuración de componentes)**
  - Extraído el modal de detalle de reserva a `frontend/src/components/ReservationDetailsModal.jsx`.
  - Extraído el modal de pago de reserva a `frontend/src/components/ReservationPaymentModal.jsx`.
  - `App.jsx` ahora delega en estos componentes la presentación de los modales y se concentra en la lógica de negocio y el manejo de estado.
  - Extraída la sección de **Clientes** a `frontend/src/components/ClientsSection.jsx` y el formulario a `frontend/src/components/ClientFormModal.jsx`.
  - Extraída la sección de **Reservas** (filtros + tabla) a `frontend/src/components/ReservasSection.jsx`.
  - Extraída la sección de **Carpas** (grilla 30 días x carpas) a `frontend/src/components/CarpasSection.jsx`, manteniendo la lógica de colores, navegación por días y apertura del detalle de reserva desde la grilla.

## 2025-11-19 - Refactor de frontend

- **Refactor de frontend (estructuración de componentes)**
  - Consolidada la estructura de `App.jsx` como orquestador principal, delegando UI en componentes específicos.
  - Extraído el layout autenticado a `frontend/src/components/AuthenticatedShell.jsx` y el sidebar a `frontend/src/components/Sidebar.jsx`.
  - Extraída la lógica de autenticación a un hook `frontend/src/hooks/useAuth.js`.
  - Extraída la lógica de establecimiento a `frontend/src/hooks/useEstablishment.js`.
  - Extraída la lógica de grupos de reserva (lista + filtros) a `frontend/src/hooks/useReservationGroups.js`.
  - Extraída la lógica de clientes (fetch + CRUD + formulario) a `frontend/src/hooks/useClients.js`.

- **Reservas madre + diarias para Sombrillas y Estacionamiento**
  - Las secciones de **Sombrillas** y **Estacionamiento** usan ahora el mismo flujo que Carpas:
    - Creación de reservas a través de `POST /api/reservation-groups` con `serviceType = 'sombrilla' | 'parking'`.
    - Generación automática de reservas diarias en `reservations` mediante `generate_series`.
    - Cancelación de reservas desde la sección **Reservas**, actualizando tanto la reserva madre como las reservas diarias y las grillas.

- **Refactor del sistema de reservas (eliminación de tabla `reservations`)**
  - **Backend**:
    - Eliminada la tabla `reservations` del esquema. Ahora `reservation_groups` es la única tabla de reservas.
    - Los grupos de reserva almacenan directamente `start_date` y `end_date` como bloques de fechas.
    - Actualizado `schema.sql` para reflejar el nuevo modelo sin tabla `reservations`.
    - Creado script de migración `migrate-remove-reservations.sql` para actualizar bases de datos existentes.
    - Modificado endpoint `GET /api/reservations` para devolver bloques de `reservation_groups` expandidos a días individuales para compatibilidad con el frontend.
    - Eliminado endpoint `POST /api/reservations/toggle` (ya no se permite toggle individual de días).
    - Actualizado endpoint `POST /api/reservation-groups` para eliminar inserción en tabla `reservations`.
    - Actualizado endpoint `PATCH /api/reservation-groups/:id` para trabajar solo con `reservation_groups`.
    - Agregados índices en `reservation_groups` para mejorar performance de consultas.
  - **Frontend**:
    - Deshabilitadas funciones de toggle individual (`handleToggleCarpaReservation`, `handleToggleSombrillaReservation`, `handleToggleParkingReservation`).
    - Ahora todas las reservas se crean exclusivamente desde modales con rango de fechas.
    - Actualizado `App.jsx` para expandir los rangos de `reservation_groups` en días individuales para visualización en grillas.
    - Las grillas de Carpas, Sombrillas y Estacionamiento siguen mostrando días individuales pero internamente trabajan con bloques.

- **Gestión de sesiones**
  - Cambiado almacenamiento de token de `localStorage` a `sessionStorage`.
  - El usuario se desloguea automáticamente al cerrar el navegador.

- **Script de backup**
  - Creado script PowerShell `create-backup.ps1` para realizar copias de seguridad del proyecto.
  - El script copia todo el proyecto a una carpeta `backup/` con timestamp.

## 2025-11-19 - Dashboard completo y mejoras de UI

- **Dashboard de inicio (nueva sección completa)**
  - Creado componente `frontend/src/components/DashboardSection.jsx` con vista completa del negocio.
  - **Métricas del día** (4 cards con gradientes):
    - 📅 Reservas activas hoy
    - 💰 Ingresos del día (suma de pagos realizados hoy)
    - 👥 Clientes únicos activos
    - 📈 Ocupación promedio de todos los servicios
  - **Estado de servicios** (3 cards clickeables con barras de progreso):
    - 🏖️ Carpas: ocupadas/total con porcentaje y barra de progreso naranja-roja
    - ☂️ Sombrillas: ocupadas/total con porcentaje y barra de progreso púrpura-rosa
    - 🚗 Estacionamiento: ocupado/total con porcentaje y barra de progreso azul-índigo
    - Al hacer click en un card, filtra las "Últimas reservas" por ese servicio
  - **Actividad reciente** (2 listas en grid):
    - 📋 **Últimas 5 reservas** creadas (clickeables para ver detalles)
      - Filtrable por servicio mediante los cards de estado
      - Badge visual que muestra el filtro activo con opción de limpiarlo
    - 💵 **Últimos 5 pagos** registrados con método de pago
      - Muestra servicio, recurso, cliente, fecha y método de pago
  - **Próximos check-ins** (nueva sección):
    - Muestra las próximas 5 reservas que empiezan en los próximos 7 días
    - Solo incluye carpas y sombrillas (excluye estacionamientos)
    - Botones para alternar entre ver carpas o sombrillas
    - Indicadores de urgencia con colores:
      - 🔴 "¡Hoy!" en rojo para check-ins del día
      - 🟠 "Mañana" en naranja para check-ins de mañana
      - ⚪ "En X días" en gris para el resto
    - Clickeable para ver detalle completo de la reserva

- **Carga de datos del dashboard**
  - Modificado `useReservationGroups.js` para cargar automáticamente los pagos de cada grupo de reserva.
  - Los pagos se cargan en paralelo usando `Promise.all` para eficiencia.
  - Agregado `useEffect` en `App.jsx` para cargar `reservationGroups` cuando `activeSection === 'inicio'`.
  - Esto asegura que el dashboard muestre información desde la primera carga.

- **Actualización de iconos**
  - Cambiados los emojis de servicios en toda la aplicación:
    - 🏖️ **Carpas** (antes ⛱️): emoji de playa más representativo
    - ☂️ **Sombrillas** (antes 🌂): paraguas más claro y bonito
    - 🚗 **Estacionamiento**: se mantiene igual
  - Iconos actualizados en:
    - `DashboardSection.jsx`
    - `ReservationEditModal.jsx`
    - `ReservationDetailsModal.jsx`
    - `CarpaReservationModal.jsx`
    - `SombrillaReservationModal.jsx`

- **Mejoras de UI en listado de reservas**
  - Resaltado el nombre del cliente en `ReservasSection.jsx` con:
    - Texto en negrita (`font-semibold`)
    - Color más oscuro (`text-slate-900`)
    - Placeholder "—" en gris claro cuando no hay nombre

- **Diseño moderno y responsive**
  - Dashboard completamente responsive con grid adaptativo
  - Uso de gradientes modernos en cards y headers
  - Efectos hover y transiciones suaves
  - Cards clickeables con feedback visual (bordes de color, rings, sombras)
  - Badges y chips con colores semánticos

## Próximos pasos

- Mantener el script interno `npm run create-user -- <email> <password>` para gestión de usuarios sin registro público.
- Profundizar la sección **Clientes** para mostrar información detallada de cada cliente y permitir la búsqueda y filtrado de clientes.
- Profundizar en la "Vista diaria" para mostrar capacidad/ocupación agregada por día, combinando información de reservas madre, reservas diarias y pagos.
