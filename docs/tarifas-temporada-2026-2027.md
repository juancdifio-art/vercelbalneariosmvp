# Tarifas Balneario Zeus — temporada 2026-2027

Precios que pasó el balneario, y cómo se cargan en la pantalla de tarifas del sistema.

## Período

**Temporada 2026-27:** del 15/12 al 15/03 (91 días). Sale del contrato de unidad de sombra. El período cruza fin de año; el sistema lo admite.

## Precios por temporada

Todas son tarifas de **estadía, precio cerrado**, atadas al período Temporada 2026-27.

| Tarifa | Servicio | Alcance | Precio |
|---|---|---|---|
| Carpa | Carpa | Todas | $1.820.000 |
| Carpa vista al mar | Carpa | Sector "Vista al mar" | $2.920.000 |
| Carpa terraza | Carpa | Sector "Terraza" | $2.920.000 |
| Sombrilla | Sombrilla | Todas | $1.500.000 |
| Cochera | Estacionamiento | Todas | $700.000 |
| Cochera descubierta | Estacionamiento | Sector "Descubierta" | $600.000 |

En la lista del balneario, "Carpa preferencial y terraza" es un solo precio que cubre dos grupos: las preferenciales, que son las de vista al mar, y las de terraza. Se cargan como dos sectores con el mismo precio, para que se distingan en el plano y se puedan separar si el precio cambia.

La tarifa de un sector le gana a la tarifa general del servicio, así que el resto de las unidades toma el precio común.

## Sectores

| Sector | Servicio | Unidades | Confirmado |
|---|---|---|---|
| Vista al mar | Carpa | 123 a 134: la carpa suelta al pie de cada columna, la más cercana a la playa (12 carpas) | Sí, por el balneario |
| Terraza | Carpa | 12 a 25: las dos terrazas (14 carpas) | Sale del plano |
| Descubierta | Estacionamiento | **Provisorio: 201 a 300.** Las 1 a 200 son con sombra y toman la tarifa general | No: se ajusta cuando llegue el plano del estacionamiento (son 300 y pico) |

## Qué quedó cargado en Vercel (26/09/2026)

El período "Temporada alta" (15/12 al 15/03) y los sectores "Terraza" y "Vista al mar" ya existían, con estas mismas unidades. Se cambió el precio de las tarifas "Temporada completa" que ya había y se creó la de vista al mar. Todas se aplican desde **90 días**: la temporada completa son 91.

| Tarifa | Precio | Cotización verificada (15/12 al 15/03) |
|---|---|---|
| Carpa | $1.820.000 | Carpa 50 → $1.820.000 |
| Carpa terraza | $2.920.000 | Carpa 20 → $2.920.000 |
| Carpa vista al mar | $2.920.000 | Carpa 130 → $2.920.000 |
| Sombrilla | $1.500.000 | Sombrilla 100 → $1.500.000 |
| Cochera (con sombra) | $700.000 | Cocheras 1 y 200 → $700.000 |
| Cochera descubierta | $600.000 | Cocheras 201 y 300 → $600.000 |

**Todavía son de prueba** y conviven con las reales: las tarifas por día, "Media temporada" (45 a 89 días), "Quincena" (15 a 44 días), los períodos "Enero" y "Fiestas", y el sector de sombrillas "Primera fila". Se reemplazan cuando lleguen los precios por mes y por día.

## Pendiente

- **Plano del estacionamiento:** cantidad total de cocheras (hoy la capacidad está en 300) y cuáles son descubiertas. Con el plano, se corrigen la capacidad y las unidades del sector "Descubierta".
- **Mínimo de días para el precio de temporada.** Quedó en 90. El contrato tiene la opción "MES", pero no da precios ni un mínimo. Revisarlo cuando lleguen los precios por mes.
- **Precios por mes:** no vinieron en la lista.
- **Pileta por temporada:** el contrato dice que la pileta tiene costo adicional por temporada o por día, pero no vino el precio. El sistema todavía no tiene dónde cargar un precio de pileta por temporada. Ver `docs/superpowers/specs/2026-09-26-pileta-incluida-design.md`.
- **"Menor de hasta 4-5 años"** en la nómina del contrato: falta que el balneario aclare qué regla es.
