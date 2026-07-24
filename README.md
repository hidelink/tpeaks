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
src/lib/dates.ts               rango de semana + navegación entre semanas (?week=yyyy-MM-dd) del calendario
src/lib/nav-links.ts           links de navegación por rol, compartidos entre los layouts de coach/atleta y /workout/[id]
src/components/AppHeader.tsx     header con nav compartido (coach, atleta, y /workout/[id] que vive fuera de ambos árboles)
src/components/SegmentEditor.tsx  editor de segmentos compartido entre plantillas, asignación ad hoc y edición
src/components/TemplateForm.tsx   formulario compartido entre crear y editar una plantilla
src/middleware.ts               Clerk middleware (protege todas las rutas salvo /sign-in, /sign-up, webhooks)
src/lib/actions/invite.ts       invitar/revocar atleta vía la API de invitaciones de Clerk Organizations
src/lib/training-load.ts       carga de entrenamiento por sRPE (RPE × duración), semanal + promedio móvil de 4 semanas
src/components/TrainingLoadChart.tsx  gráfica de carga (barras + línea de referencia), en dashboard de atleta y perfil que ve el coach
src/app/coach/                  rutas y layout del coach
src/app/athlete/                rutas y layout del atleta
src/app/workout/[id]/           detalle de entrenamiento compartido (render condicional por rol), con su propio layout + edición + duplicar
src/app/api/webhooks/clerk/     sincroniza User/Team/TeamMembership desde Clerk
```

## Estado actual (MVP Fase 1, en construcción)

Ya funciona (una vez conectada la base de datos y Clerk): auth + creación de equipo vía Clerk Organizations (con onboarding para crear el equipo si el usuario no tiene uno todavía), invitar/revocar atletas por email (invitación real de Clerk Organizations, ya no un placeholder), sincronización de usuarios/equipos por webhook o al vuelo si el webhook no está configurado, dashboard de coach y atleta con las 4 métricas, calendario semanal navegable (anterior/siguiente/hoy), creación y edición de plantillas de entrenamiento con editor de segmentos, asignación de entrenamientos (desde plantilla o ad hoc) al calendario de un atleta, edición de un entrenamiento ya asignado (incluye "moverlo" cambiando la fecha), duplicar/copiar un entrenamiento a otra fecha o a otro atleta, detalle de entrenamiento con feedback manual del atleta y comentarios del coach, perfil de atleta con historial, y una gráfica de **carga de entrenamiento** (sRPE semanal + promedio móvil de 4 semanas) en el dashboard del atleta y en el perfil que ve el coach.

Pendiente (ver Paso 8 del spec, "Should have"/"Nice to have"): drag-and-drop real en el calendario (mover/duplicar hoy se hacen desde botones explícitos, no arrastrando); vista mensual del calendario (hoy es semanal con navegación); notificaciones in-app de comentarios nuevos; filtros de calendario por atleta/tipo.

No construido todavía (a propósito, ver Paso 2 del spec): cobros reales con Stripe, theming/logo por equipo en runtime, integraciones con relojes/Strava.

## Verificación sin sesión activa

Muchos de estos cambios se validaron con `tsc --noEmit`, `eslint` y `next build` — no con pruebas visuales en el navegador, porque el asistente no tiene forma de iniciar sesión con tu cuenta de Clerk. Antes de darlo por bueno del todo, prueba manualmente: crear/editar una plantilla, asignar/editar/duplicar un entrenamiento, y navegar entre semanas en ambos calendarios (coach y atleta).
