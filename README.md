# TPeaks

Plataforma de entrenamiento para coaches y corredores — "TrainingPeaks simplificado", white-label por equipo.

Ver el spec completo (producto, arquitectura, esquema de datos, roles, flujos, backlog) en [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) antes de tocar código — ahí está el razonamiento detrás de cada decisión.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL (Supabase recomendado)
- Clerk (auth + Organizations = Team) para identidad; permisos finos (coach/atleta) viven en nuestra propia tabla `TeamMembership`, no en Clerk
- Stripe (Fase 2, no conectado todavía)
- Vercel (hosting recomendado)

## Setup local

1. **Base de datos**: crea un proyecto en [Supabase](https://supabase.com) (o cualquier Postgres) y copia el connection string.
2. **Clerk**: crea una app en [Clerk Dashboard](https://dashboard.clerk.com), **activa Organizations** (Settings → Organizations), y copia las llaves pública/secreta.
3. Copia `.env.example` a `.env` y llena las variables:

   ```bash
   cp .env.example .env
   ```

4. Instala dependencias y aplica el schema:

   ```bash
   npm install
   npx prisma migrate dev --name init
   ```

5. Configura el webhook de Clerk (Dashboard → Webhooks) apuntando a `<tu-url>/api/webhooks/clerk`, con los eventos: `user.created`, `organization.created`, `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`. Copia el signing secret a `CLERK_WEBHOOK_SECRET`. En local, usa `ngrok`/`clerk dev tunnel` para exponer el endpoint.
6. Corre el servidor de desarrollo:

   ```bash
   npm run dev
   ```

## Estructura del proyecto

```
docs/PRODUCT_SPEC.md          spec de producto + arquitectura + DB + backlog
prisma/schema.prisma           modelo de datos (incluye tablas de Fase 2/3 ya definidas, inactivas)
src/lib/permissions.ts         getCurrentMembership / requireRole — única fuente de verdad de permisos
src/lib/subscription-gate.ts   gate de suscripción (Fase 2), hoy siempre permite acceso
src/lib/workout-structure.ts   contrato Zod de la estructura de un entrenamiento
src/lib/actions/                Server Actions (crear/editar plantilla, asignar/editar/duplicar entrenamiento, marcar completado, comentar)
src/lib/clerk-sync.ts          upsert de Team/User/TeamMembership desde datos de Clerk (usado por el webhook y como fallback sync-on-read)
src/lib/dates.ts               rangos de semana/mes + navegación (?date=yyyy-MM-dd&view=week|month) del calendario
src/lib/calendar-date.ts       toLocalCalendarDate/todayAsUtcMidnight — normaliza fechas @db.Date (ver nota de timezone abajo)
src/lib/calendar-url.ts        construye URLs de calendario preservando filtros activos
src/lib/nav-links.ts           links de navegación por rol, compartidos entre los layouts de coach/atleta y /workout/[id]
src/components/AppHeader.tsx     header con nav compartido (coach, atleta, y /workout/[id] que vive fuera de ambos árboles)
src/components/SegmentEditor.tsx  editor de segmentos compartido entre plantillas, asignación ad hoc y edición
src/components/TemplateForm.tsx   formulario compartido entre crear y editar una plantilla
src/components/CalendarFilterBar.tsx  filtro por atleta (coach) + búsqueda por título, form GET nativo
src/middleware.ts               Clerk middleware (protege todas las rutas salvo /sign-in, /sign-up, webhooks)
src/lib/actions/invite.ts       invitar/revocar atleta vía la API de invitaciones de Clerk Organizations
src/lib/actions/athlete-profile.ts  nota privada del coach sobre un atleta
src/lib/training-load.ts       carga de entrenamiento por sRPE (RPE × duración), semanal + promedio móvil de 4 semanas
src/components/TrainingLoadChart.tsx  gráfica de carga (barras + línea de referencia), en dashboard de atleta y perfil que ve el coach
src/app/coach/                  rutas y layout del coach
src/app/athlete/                rutas y layout del atleta
src/app/workout/[id]/           detalle de entrenamiento compartido (render condicional por rol), con su propio layout + edición + duplicar
src/app/api/webhooks/clerk/     sincroniza User/Team/TeamMembership desde Clerk
```

## Estado actual (MVP Fase 1, en construcción)

Ya funciona (una vez conectada la base de datos y Clerk): auth + creación de equipo vía Clerk Organizations (con onboarding para crear el equipo si el usuario no tiene uno todavía), invitar/revocar atletas por email (invitación real de Clerk Organizations, ya no un placeholder), sincronización de usuarios/equipos por webhook o al vuelo si el webhook no está configurado, dashboard de coach y atleta con las 4 métricas, calendario **semanal y mensual** navegable (anterior/siguiente/hoy) con filtro por atleta y búsqueda por título, creación/edición/borrado de plantillas de entrenamiento con editor de segmentos, **asignación de un entrenamiento a uno o varios atletas a la vez** (checklist con "seleccionar todos" — el caso real de un coach con equipo, no uno-por-uno), edición de un entrenamiento ya asignado (incluye "moverlo" cambiando la fecha), duplicar/copiar un entrenamiento a otra fecha o a otro atleta, detalle de entrenamiento con feedback manual del atleta y comentarios del coach, perfil de atleta con historial + nota privada del coach editable, y una gráfica de **carga de entrenamiento** (sRPE semanal + promedio móvil de 4 semanas) en el dashboard del atleta y en el perfil que ve el coach.

Pendiente (ver Paso 8 del spec, "Nice to have"): drag-and-drop real en el calendario (mover/duplicar hoy se hacen desde botones explícitos, no arrastrando); notificaciones in-app de comentarios nuevos.

No construido todavía (a propósito, ver Paso 2 del spec): cobros reales con Stripe, theming/logo por equipo en runtime, integraciones con relojes/Strava.

### Nota importante: timezone en fechas de entrenamiento

`ScheduledWorkout.date` es `@db.Date` en Postgres — Prisma la devuelve como medianoche UTC.
En cualquier servidor con timezone detrás de UTC (todo Latinoamérica incluida), leerla con
funciones de date-fns en hora local (`format`, `isSameDay`, `startOfWeek`) la mostraba/agrupaba
**un día antes** del real — lo confirmé empíricamente corriendo la app en este entorno
(America/Mexico_City). Ya está arreglado (`src/lib/calendar-date.ts`,
`toLocalCalendarDate`/`todayAsUtcMidnight`, aplicado en cada punto donde se leía esa fecha),
pero si notaste antes que un entrenamiento aparecía en el día equivocado en el calendario, en
el detalle, o al editarlo — era este bug.

Una revisión independiente encontró una segunda instancia del mismo problema: los límites de
la query de "esta semana"/"este mes" (`getCurrentWeekRange`/`getMonthGridRange`) también se
calculaban en hora local, lo que hacía que el rango incluyera de más el primer día de la
semana/mes siguiente — inflando conteos y métricas si ya había algo programado ahí. También
arreglado (`toQueryBoundary()` en `src/lib/calendar-date.ts`), confirmado con una query directa
a la base de datos. Ver `docs/PRODUCT_SPEC.md`, sección de riesgos, para el detalle completo.

## Datos de prueba

`scripts/seed-test-workouts.ts` siembra ~4 semanas de entrenamientos (con feedback ya
completado en las semanas pasadas) para un atleta que ya exista en tu base de datos —
útil para ver la gráfica de carga con datos reales. Sigue un patrón deliberado de
3 semanas construyendo + 1 de descarga.

```bash
npx tsx scripts/seed-test-workouts.ts [email-del-atleta]
# default: member@yopmail.com
```

## Verificación sin sesión activa

Muchos de estos cambios se validaron con `tsc --noEmit`, `eslint` y `next build` — no con pruebas visuales en el navegador, porque el asistente no tiene forma de iniciar sesión con tu cuenta de Clerk. Antes de darlo por bueno del todo, prueba manualmente: crear/editar una plantilla, asignar/editar/duplicar un entrenamiento, y navegar entre semanas en ambos calendarios (coach y atleta).
