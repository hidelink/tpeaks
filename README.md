# TPeaks

![CI](https://github.com/hidelink/tpeaks/actions/workflows/ci.yml/badge.svg)

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
vitest.config.ts                config de tests (ver sección "Tests" abajo)
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
src/lib/actions/athlete-profile.ts  nota privada del coach + resultado de carrera/VDOT de un atleta
src/lib/sports.ts              tipos de sesión (correr, trail, bici, natación, fuerza, movilidad) y qué campos aplica cada uno
src/components/SportSelect.tsx  selector de tipo, compartido por plantillas, asignación y edición
src/lib/vdot.ts                cálculo de ritmos de entrenamiento (modelo VDOT de Daniels) — solo asfalto/pista, ver nota abajo
src/components/TrainingPacesList.tsx  los cinco ritmos en modo lectura, compartido entre el perfil que ve el coach y el dashboard del atleta
src/lib/training-load.ts       carga de entrenamiento por sRPE (RPE × duración), semanal + promedio móvil de 4 semanas
src/components/TrainingLoadChart.tsx  gráfica de carga (barras + línea de referencia), en dashboard de atleta y perfil que ve el coach
src/lib/actions/team.ts         marca del equipo (logo + color) — white-label
src/lib/team-theme.ts          --team-accent como CSS var, aplicada en cada layout autenticado
src/app/coach/                  rutas y layout del coach
src/app/athlete/                rutas y layout del atleta
src/app/workout/[id]/           detalle de entrenamiento compartido (render condicional por rol), con su propio layout + edición + duplicar
src/app/admin/                  admin de plataforma (soporte interno) — lista de equipos + detalle, ver requirePlatformAdmin
src/app/terms/, src/app/privacy/  páginas legales públicas (borrador, ver nota abajo)
src/app/api/webhooks/clerk/     sincroniza User/Team/TeamMembership desde Clerk
```

## Estado actual (MVP Fase 1, en construcción)

Ya funciona (una vez conectada la base de datos y Clerk): auth + creación de equipo vía Clerk Organizations (con onboarding para crear el equipo si el usuario no tiene uno todavía), invitar/revocar atletas por email (invitación real de Clerk Organizations, ya no un placeholder), sincronización de usuarios/equipos por webhook o al vuelo si el webhook no está configurado, dashboard de coach y atleta con las 4 métricas, calendario **semanal y mensual** navegable (anterior/siguiente/hoy) con filtro por atleta y búsqueda por título, creación/edición/borrado de plantillas de entrenamiento con editor de segmentos, **asignación de un entrenamiento a uno o varios atletas a la vez** (checklist con "seleccionar todos" — el caso real de un coach con equipo, no uno-por-uno), edición de un entrenamiento ya asignado (incluye "moverlo" cambiando la fecha), duplicar/copiar un entrenamiento a otra fecha o a otro atleta, detalle de entrenamiento con feedback manual del atleta y comentarios del coach, perfil de atleta con historial + nota privada del coach editable, **cálculo automático de ritmos de entrenamiento** a partir de un resultado de carrera reciente (modelo VDOT, ver nota abajo), una gráfica de **carga de entrenamiento** (sRPE semanal + promedio móvil de 4 semanas) en el dashboard del atleta y en el perfil que ve el coach, **white-label activado** (logo + color de acento configurables en Ajustes, aplicados en runtime en toda la plataforma), un **rol de admin de plataforma** (`/admin`, ve todos los equipos para soporte interno — se activa a mano con `scripts/make-admin.ts`, no hay auto-registro), y páginas públicas de **Términos de servicio / Aviso de privacidad**.

Pendiente (ver Paso 8 del spec, "Nice to have"): drag-and-drop real en el calendario (mover/duplicar hoy se hacen desde botones explícitos, no arrastrando); notificaciones in-app de comentarios nuevos.

No construido todavía (a propósito, ver Paso 2 del spec): cobros reales con Stripe.

Desplegado en <https://tpeaks.vercel.app> — pero con llaves de Clerk **de desarrollo** y la misma
base de Supabase que usa el entorno local. Sirve para enseñárselo a alguien; no es todavía un
entorno de producción de verdad (falta instancia de Clerk de producción con dominio propio, y
una base separada de la de desarrollo).

### Nota: multideporte es una etiqueta, no un modelo por deporte

Un entrenamiento tiene un **tipo** (`sport`): correr, trail, bici, natación, fuerza, movilidad u
otro. El default es correr, así que en el caso normal nadie lo toca. La estructura de segmentos
(duración, RPE, nota) siempre sirvió para cualquier deporte; el tipo solo decide qué campos tiene
sentido enseñar (`src/lib/sports.ts`): fuerza y movilidad no piden distancia ni ritmo, bici y
natación cambian el ejemplo del campo de ritmo, y las sugerencias de VDOT solo aparecen en correr
en plano.

Lo que **no** hay, a propósito: campos propios para series/reps/peso. Hoy eso se escribe en la
etiqueta del segmento ("Sentadilla 4x8 @ 70 kg"), que se lee bien pero no permite graficar la
progresión de un levantamiento. Es un cambio aditivo al contrato Zod cuando el uso lo pida — ver
`docs/PRODUCT_SPEC.md`.

Un campo que no aplica al deporte se esconde, **pero nunca si ya tiene valor**: cambiar una sesión
de correr a fuerza no borra ni oculta en silencio la distancia que ya tenía.

La lista de plantillas se agrupa por tipo y tiene filtros: chips por deporte con su conteo, tags
clicables y búsqueda por título (`?sport=&tag=&q=`). Agrupar solo no basta cuando casi todas las
plantillas son de correr — dentro de ese grupo lo que discrimina son los tags.

La gráfica de carga (RPE × duración) no cambió: es comparable entre deportes, que es justamente
para lo que sirve. La métrica de kilómetros sí — ahora dice "Km corriendo" y solo suma correr y
trail, porque sumar km de bici con km de carrera da un número sin significado.

### Nota: los ritmos calculados solo aplican en plano

`src/lib/vdot.ts` implementa el modelo VDOT de Jack Daniels (ecuaciones Daniels-Gilbert,
publicadas) para derivar los ritmos de fácil / maratón / umbral / intervalo / repetición a partir
de un resultado de carrera reciente. El coach lo captura en el perfil del atleta y los ritmos se
recalculan solos.

Los ritmos no se quedan en la pantalla del perfil: al asignar o editar un entrenamiento de ese
atleta, cada segmento ofrece los cinco como botones para llenar el "ritmo objetivo" sin
teclearlo. Solo aparecen cuando se conoce a **un** atleta — una plantilla es de todo el equipo, y
en una asignación múltiple cada quien tiene su propio ritmo. El atleta también los ve (solo
lectura) en su dashboard.

El modelo asume que el ritmo es una unidad de esfuerzo comparable — eso **se rompe en trail**: el
desnivel y el terreno técnico cambian el costo energético de forma no lineal, así que un "5:00/km"
no significa lo mismo cuesta arriba que en pista. Por eso los ritmos se presentan explícitamente
como de asfalto/pista, y para trail la recomendación es prescribir por RPE objetivo o por duración
en los segmentos (ambos ya soportados por `src/lib/workout-structure.ts`). La alternativa real
(grade-adjusted pace) necesita datos de desnivel que hoy no tenemos — llegarían con las
integraciones de Fase 3.

### Nota: páginas legales son un borrador

`src/app/terms/page.tsx` y `src/app/privacy/page.tsx` tienen contenido real (no Lorem Ipsum),
pensado honestamente para lo que la plataforma recolecta — pero no son una revisión legal.
Antes de operar con usuarios reales, en especial si vas a cobrar o si vas a tener atletas
menores de edad, hazlas revisar por alguien con conocimiento legal (en México, la referencia
relevante es la LFPDPPP, no GDPR).

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

## Tests

```bash
npm test              # corre toda la suite una vez
npm run test:watch    # modo watch
npm run test:coverage # con reporte de cobertura
```

Vitest, sin infraestructura (nada de test DB/Docker) — todo corre mockeando Prisma/Clerk.
Cubre las funciones puras y la lógica de negocio con más riesgo real de bug silencioso:

- `src/lib/calendar-date.ts`, `src/lib/dates.ts`, `src/lib/calendar-url.ts` — toda la
  aritmética de fechas/semanas/meses, incluyendo tests de regresión específicos para los
  dos bugs de timezone que ya mordieron (ver nota arriba).
- `src/lib/workout-structure.ts` — el contrato Zod completo (válido/inválido) y que los
  mensajes de error sean legibles en español, no el JSON crudo de ZodError.
- `src/lib/training-load.ts` — bucketing semanal de carga sRPE + promedio móvil de 4
  semanas (Prisma mockeado), incluyendo el caso exacto del bug: un entrenamiento fechado
  justo en lunes no debe contarse en la semana anterior.
- `src/lib/permissions.ts` — `getCurrentMembership`/`requireRole`/`requireMembership`
  (Clerk + Prisma mockeados): sin sesión, con membresía, sin membresía, rol equivocado,
  y que el fallback de sync-on-read se dispare solo cuando hace falta.
- `src/lib/subscription-gate.ts` — cada `SubscriptionStatus` da el acceso correcto (hoy
  inerte en Fase 1, pero es el gate real de Fase 2).
- `src/lib/clerk-sync.ts` — solo `mapOrgRole` (la única decisión real ahí); los upserts
  de Prisma no se testean a este nivel, tienen más sentido como test de integración.

**Lo que NO está cubierto todavía, a propósito:** los Server Actions en `src/lib/actions/*`
(requerirían mockear Clerk+Prisma por cada uno, con retorno de valor bajo respecto a un test
de integración real contra una base de datos de prueba) y componentes de React. Si el
proyecto crece, el siguiente escalón natural es un puñado de tests de integración contra una
base de datos de prueba real (Testcontainers o un Supabase de test), no más mocks.

## CI

`.github/workflows/ci.yml` corre en cada push a `main` y en cada pull request:
`npm ci` → `prisma generate` → lint → type check → tests → build. No depende de
ningún secreto real (Prisma Client se genera desde el schema sin conectar a nada, y
los tests mockean Clerk/Prisma) — si algo se rompe, se ve en rojo en la pestaña
**Actions** de GitHub, sin depender de que alguien se acuerde de correr los checks a mano
antes de hacer push.

## Datos de prueba

`scripts/seed-test-workouts.ts` siembra ~4 semanas de entrenamientos (con feedback ya
completado en las semanas pasadas) para un atleta que ya exista en tu base de datos —
útil para ver la gráfica de carga con datos reales. Sigue un patrón deliberado de
3 semanas construyendo + 1 de descarga.

`scripts/seed-marathon-training.ts` siembra un bloque completo de 9 semanas rumbo al
Maratón de la Ciudad de México (base → pico → taper → carrera), pensado como demo de
cómo se vería un plan real de un amateur normal — incluye una carrera de control (medio
maratón), el fondo largo más largo del bloque, y el día de la carrera. Reemplaza
cualquier entrenamiento previo del atleta para contar una sola historia coherente.

```bash
npx tsx scripts/seed-marathon-training.ts [email-del-atleta]
# default: member@yopmail.com
```

`scripts/seed-templates.ts` siembra 4 plantillas de entrenamiento reutilizables con
variedad real (series en pista, tempo, fondo largo progresivo, fartlek) — para que
`/coach/templates` se vea como se usaría de verdad en vez de vacío.

```bash
npx tsx scripts/seed-templates.ts [email-del-coach]
# sin argumento, asume que solo hay un coach y lo usa
```

```bash
npx tsx scripts/seed-test-workouts.ts [email-del-atleta]
# default: member@yopmail.com
```

## Admin de plataforma

No hay UI de auto-registro para el rol de admin (`/admin`) — son muy pocas personas las que
lo necesitan. Para dárselo a un usuario que ya exista:

```bash
npx tsx scripts/make-admin.ts tu-email@ejemplo.com
npx tsx scripts/make-admin.ts tu-email@ejemplo.com --revoke  # para quitarlo
```

## Verificación sin sesión activa

Muchos de estos cambios se validaron con `tsc --noEmit`, `eslint`, `vitest` y `next build` — no
con pruebas visuales en el navegador, porque el asistente no tiene forma de iniciar sesión con
tu cuenta de Clerk. Antes de darlo por bueno del todo, prueba manualmente: crear/editar una
plantilla, asignar/editar/duplicar un entrenamiento, navegar entre semanas en ambos calendarios,
poner un logo/color en Ajustes y confirmar que el header y los botones cambian, y (después de
correr `make-admin.ts` contigo mismo) entrar a `/admin` y ver tu equipo listado.
