# Sistema de Gestión de Balnearios MVP

Sistema completo para la gestión de reservas de balnearios, incluyendo carpas, sombrillas, estacionamiento y pileta.

## 🚀 Características

- **Dashboard con métricas en tiempo real**: Visualización de reservas activas, ingresos del día y próximos check-ins
- **Vista diaria**: Calendario consolidado de todas las reservas del día
- **Gestión de reservas**: CRUD completo para carpas, sombrillas, estacionamiento y pileta
- **Sistema de pagos**: Registro de pagos parciales y totales con seguimiento
- **Gestión de clientes**: Base de datos de clientes con historial de reservas
- **Reportes**: Informes de pagos y ocupación
- **Autenticación**: Sistema de login con JWT

## 📋 Requisitos

- Node.js 16+ y npm
- PostgreSQL 12+
- Git

## ⚙️ Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/juancdifio-art/balneariosmvp.git
cd balneariosmvp
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

Crear el archivo `.env` basándote en `.env.example`:

```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones:

```env
PORT=4000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=balnearios_mvp
DB_USER=tu_usuario
DB_PASSWORD=tu_password

JWT_SECRET=un_secreto_muy_seguro_cambiar_en_produccion
```

### 3. Configurar la Base de Datos

Crear la base de datos en PostgreSQL:

```bash
psql -U postgres
CREATE DATABASE balnearios_mvp;
\q
```

Ejecutar el schema:

```bash
psql -U tu_usuario -d balnearios_mvp -f schema.sql
```

Crear usuario administrador:

```bash
node create-admin.js
```

### 4. Configurar Frontend

```bash
cd ../frontend
npm install
```

Si tu backend corre en un puerto diferente a 4000, editar `vite.config.js` o crear un archivo `.env` con:

```env
VITE_API_URL=http://localhost:4000
```

## 🏃 Ejecución

### Modo Desarrollo

**Backend** (en terminal 1):
```bash
cd backend
npm start
```

**Frontend** (en terminal 2):
```bash
cd frontend
npm run dev
```

La aplicación estará disponible en:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

### Modo Producción

**Backend**:
```bash
cd backend
NODE_ENV=production npm start
```

**Frontend** (construir):
```bash
cd frontend
npm run build
```

Los archivos de producción estarán en `frontend/dist/`

## 📁 Estructura del Proyecto

```
balneariosmvp/
├── backend/
│   ├── src/
│   │   ├── routes/          # Rutas de la API
│   │   ├── middleware/      # Middlewares (autenticación, etc.)
│   │   └── index.js         # Punto de entrada del servidor
│   ├── schema.sql           # Schema de la base de datos
│   ├── .env.example         # Plantilla de variables de entorno
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes de React
│   │   ├── hooks/           # Custom hooks
│   │   ├── App.jsx          # Componente principal
│   │   └── main.jsx         # Punto de entrada
│   └── package.json
│
└── README.md
```

## 🔑 Credenciales por Defecto

Después de ejecutar `create-admin.js`, las credenciales por defecto son:

- **Email**: admin@balneario.com
- **Contraseña**: La que definas durante la creación

⚠️ **Importante**: Cambiar estas credenciales en producción.

## 🛠️ Tecnologías

### Backend
- Node.js + Express
- PostgreSQL
- JWT para autenticación
- bcrypt para encriptación de contraseñas

### Frontend
- React 18
- Vite
- Tailwind CSS
- date-fns para manejo de fechas

## 📝 Scripts Útiles

### Backend

```bash
npm start              # Iniciar servidor
node create-admin.js   # Crear usuario administrador
```

### Frontend

```bash
npm run dev           # Modo desarrollo
npm run build         # Construir para producción
npm run preview       # Preview del build de producción
```

## 🗃️ Migraciones

Si necesitas actualizar el schema, hay varios scripts SQL disponibles en `backend/`:

- `migrate-pool-passes.sql` - Migración para passes de pileta
- `migrate-clients-extra-fields.sql` - Campos adicionales para clientes

Ejecutar con:
```bash
psql -U tu_usuario -d balnearios_mvp -f backend/nombre-migracion.sql
```

## 🤝 Contribuir

1. Fork del proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto es privado y de uso interno.

## 📧 Contacto

Para consultas o soporte, contactar al desarrollador.
