# Migración a Vercel – Checklist

## 0. Estado actual local
- [ ] Backend Express corriendo en puerto 9000
- [ ] Frontend Vite corriendo en puerto 9001
- [ ] Base de datos PostgreSQL (local o Neon) accesible

---

## 1. Preparar arquitectura serverless `/api`
- [ ] Crear carpeta `api/` en la raíz del proyecto
- [ ] Crear `api/_lib/db.js` con conexión a PostgreSQL compatible con serverless
- [ ] Crear `api/_lib/auth.js` con lógica de JWT (`authenticateToken`)
- [ ] Crear `api/_lib/cors.js` con manejo de CORS y preflight (OPTIONS)
- [ ] Crear `api/health.js` para `GET /api/health`

---

## 2. Endpoints de autenticación
- [ ] Crear `api/auth/login.js` basado en `/api/auth/login` del backend actual
- [ ] Crear `api/auth/register.js` basado en `/api/auth/register`
- [ ] Probar login contra la base de datos usando `vercel dev` o despliegue de prueba

---

## 3. Endpoints de establecimiento
- [ ] Crear `api/establishment/me.js` (`GET /api/establishment/me`)
- [ ] Crear `api/establishment/index.js` (`POST /api/establishment`)
- [ ] Verificar que el frontend puede leer/guardar la configuración del balneario

---

## 4. Endpoints de clientes (CRUD)
- [ ] Crear `api/clients/index.js` con `GET /api/clients` y `POST /api/clients`
- [ ] Crear `api/clients/[id].js` con `PATCH /api/clients/:id` y `DELETE /api/clients/:id`
- [ ] Probar listado, alta, edición y borrado de clientes desde el frontend

---

## 5. Endpoints de reservas
- [ ] Crear `api/reservations.js` (`GET /api/reservations`)
- [ ] Crear `api/reservation-groups/index.js` (`GET/POST /api/reservation-groups`)
- [ ] Crear `api/reservation-groups/[id].js` (`PATCH /api/reservation-groups/:id`)
- [ ] Crear `api/reservation-groups/[id]/payments.js` (`GET/POST /api/reservation-groups/:id/payments`)
- [ ] Verificar que la UI de reservas funciona (consultas y alta/modificación)

---

## 6. Endpoints de reportes
- [ ] Crear `api/reports/payments.js` (`GET /api/reports/payments`)
- [ ] Crear `api/reports/occupancy.js` (`GET /api/reports/occupancy`)
- [ ] Validar que las pantallas de reportes cargan correctamente

---

## 7. Configuración de Vercel
- [ ] Crear `vercel.json` en la raíz con:
  - [ ] Build estático del frontend (`frontend/package.json`, `dist`)
  - [ ] Rutas para `/api/(.*)` → `/api/$1`
  - [ ] Rutas para `/ (.*)` → frontend
- [ ] Crear `package.json` en la raíz con dependencias usadas por `/api` (`pg`, `jsonwebtoken`, `bcryptjs`, etc.)
- [ ] Instalar y configurar `@vercel/postgres` (opcional/recomendado para Neon)

---

## 8. Frontend y URLs de API
- [ ] Ajustar `VITE_API_URL` o lógica en el frontend para usar:
  - [ ] `http://localhost:9000/api` (o similar) en desarrollo local
  - [ ] `https://tu-app.vercel.app/api` en producción Vercel
- [ ] Probar `npm run build` en `frontend/` y corregir warnings/errores
- [ ] Probar `vercel dev` localmente (opcional) para simular entorno Vercel

---

## 9. Variables de entorno en Vercel
- [ ] Configurar en el dashboard de Vercel:
  - [ ] `DATABASE_URL` (Neon PostgreSQL con `sslmode=require`)
  - [ ] `JWT_SECRET`
  - [ ] `FRONTEND_URL` (ej: `https://tu-app.vercel.app`)
- [ ] Verificar que las funciones `/api` leen correctamente las env vars

---

## 10. Testing y despliegue final
- [ ] Hacer recorrido completo de la app en entorno Vercel:
  - [ ] Login
  - [ ] Configuración de establecimiento
  - [ ] Gestión de clientes
  - [ ] Reservas (alta, consulta, modificación, pagos)
  - [ ] Reportes
- [ ] Ajustar CORS (origins de producción y desarrollo)
- [ ] Documentar en `README.md` o `updates.md` el flujo de deploy a Vercel
