# TPeaks — Plataforma de entrenamiento para coaches y corredores

> "TrainingPeaks simplificado" para equipos de running, white-label.

## Decisiones base (confirmadas contigo)

| Decisión | Elegida |
|---|---|
| Quién paga la suscripción | El **equipo/coach** paga por todos sus atletas (no hay cobro individual al atleta) |
| Multi-tenancy | Modelo de datos **multi-equipo desde el día 1**; UI de theming/branding se activa después |
| Idioma | Español |
| Ruta del proyecto | `/Users/home/Documents/AI_projects/tpeaks` |

---

## Paso 1 — Resumen ejecutivo

1. TPeaks es una plataforma web donde **coaches de running gestionan equipos de corredores**: crean entrenamientos, los programan en un calendario, y dan seguimiento al cumplimiento.
2. Cada equipo opera como un **tenant white-label**: mismo producto, logo y colores del equipo, sin que el atleta perciba que es una plataforma compartida.
3. El **coach es el actor de facturación**: contrata un plan con cupos de atletas; los atletas no ven pantallas de pago propias, solo se benefician (o se bloquean) según el estado de la suscripción de su equipo.
4. El **atleta** vive en un calendario simple: ve el entrenamiento del día, lo abre, lo marca como hecho y da feedback manual (duración, distancia, ritmo percibido, RPE, comentario).
5. Fase 1 es **100% manual** — sin relojes, sin GPS, sin importación automática — para salir rápido y validar el loop coach↔atleta.
6. Fase 2 activa el **gate de pago**: si el equipo no tiene suscripción activa, sus atletas entran a la plataforma pero ven una pantalla de bloqueo en vez de su calendario; el coach nunca pierde visibilidad de sus atletas.
7. Fase 3 abre la puerta a **Garmin/Coros/Polar/Suunto/Apple Health/Strava** mediante una capa de integraciones desacoplada del núcleo (actividades externas ≠ entrenamientos planeados, unidos por una tabla de enlace).
8. Stack recomendado: **Next.js 14 (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL (Supabase) + Clerk (auth + Organizations) + Stripe (fase 2) + Vercel**.
9. El modelo de datos se diseña **hoy** para soportar equipos, suscripción y integraciones futuras, aunque esas piezas no se activen todavía — así se evita una migración dolorosa más adelante.
10. Riesgo principal de producto: si el "loop de cumplimiento" (coach ve qué hizo el atleta y comenta) no es fricción-cero, el producto no se pega — por eso es la prioridad #1 del MVP, por encima de features vistosas.
11. Riesgo principal de arquitectura: mezclar "entrenamiento planeado" con "actividad real" en una sola tabla. Se separan desde el día 1 para no romper nada cuando lleguen los relojes.
12. Alcance explícito: **solo running**. Nada de fuerza, bici, natación, triatlón — eso simplifica el modelo de "estructura de entrenamiento" enormemente.

---

## Paso 2 — Alcance del MVP (Fase 1)

### Sí construimos ahora
- Auth con roles (coach, atleta, admin interno).
- Modelo de Team (equipo) desde el día 1, aunque solo exista un equipo real al inicio.
- Coach: crear atletas, crear plantillas, crear entrenamientos, programarlos en calendario semanal/mensual, editar/mover/copiar/duplicar, notas al atleta.
- Atleta: calendario, detalle de entrenamiento, marcar completado, feedback manual (duración, distancia, ritmo percibido, RPE, comentario).
- Coach: ver cumplimiento por atleta, comentar entrenamientos completados.
- Dashboard con métricas: programados, completados, cumplimiento semanal, km semanales.
- Esquema de datos preparado para suscripción (tabla `Subscription`, `Team.subscriptionStatus`) e integraciones (`Integration`, `ExternalActivity`), **sin lógica de negocio activa todavía** salvo el gate en modo "siempre permitido".

### Explícitamente NO construimos todavía
- Cobros reales con Stripe (solo el modelo de datos y el punto de extensión).
- ~~Theming/logo dinámico por equipo en la UI~~ — construido después del MVP inicial (ver Paso 8, backlog "Nice to have").
- Apps móviles nativas o cualquier integración con relojes/Strava/Apple Health.
- Roles intermedios (coach asistente con permisos limitados) — el modelo lo permite (enum ampliable) pero no se construye UI para eso.
- Notificaciones push/email transaccionales (recordatorios de entrenamiento, etc.) — se puede agregar sin rediseño.
- Analítica avanzada (zonas de ritmo, curvas de fatiga, PRs) — fuera de alcance de un "simplificado".
- Multi-equipo por coach (un coach en dos equipos distintos) — el esquema lo soporta (tabla de membresía) pero no hay UI para cambiar de equipo activo.

**Supuesto explícito:** cada equipo tiene un solo coach "dueño" por ahora; el rol de coach asistente queda como valor de enum sin implementar.

---

## Paso 3 — Arquitectura técnica

### Stack recomendado (y por qué)

| Capa | Elección | Por qué, no la alternativa |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | Server Components para el calendario/dashboard (menos JS al cliente), Server Actions para mutaciones simples (crear entrenamiento, marcar completado) sin montar una API REST separada. Un solo repo, un solo deploy. |
| Lenguaje | **TypeScript** | El modelo de "estructura de entrenamiento" (JSON con segmentos) se beneficia mucho de tipos + Zod en los bordes. |
| Estilos/UI | **Tailwind + shadcn/ui** | Look moderno y limpio out-of-the-box, componentes que se copian a tu repo (no dependencia de librería cerrada) — clave para poder "temeatizar" por equipo después (CSS variables por tenant). |
| Base de datos | **PostgreSQL vía Supabase** | Ya tienes contexto/cuenta de Supabase por el proyecto Andanza; además Supabase Storage sirve para logos de equipo (fase de branding) sin añadir otro proveedor. |
| ORM | **Prisma** | Migraciones versionadas explícitas — importante porque el esquema va a crecer en fases (suscripción, integraciones) y necesitas historial claro. |
| Auth | **Clerk, usando Organizations = Team** | Te da de fábrica: login, invitaciones por email, gestión de miembros de organización — que mapea 1:1 con "coach invita atleta a su equipo". Evita construir invitaciones/reset de password/sesiones a mano. |
| Roles finos (coach vs atleta) | **No en Clerk — en tu propia tabla `TeamMembership.role`** | Los roles/permisos custom de Clerk Organizations son de plan de pago; en vez de atarte a eso, usas Clerk solo para identidad + pertenencia a organización, y tu propia tabla decide "coach" vs "atleta". Así el costo de Clerk no escala con tu complejidad de permisos. |
| Pagos (Fase 2) | **Stripe, Customer = Team, Subscription = Team** | Coincide con "el equipo paga por todos". Un solo `stripeCustomerId` por Team. |
| Hosting | **Vercel** | Nativo para Next.js, cero config. |
| Validación | **Zod** | En Server Actions y en el contrato de "estructura de entrenamiento" (ver Paso 4). |
| Calendario/drag-drop | **date-fns + dnd-kit** | Ligero, sin licencia, control total del look. |

### Diagrama de capas

```
┌─────────────────────────────────────────────────────────┐
│  Next.js App (Vercel)                                    │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ Coach routes  │  │ Athlete routes│  │ Admin routes │  │
│  └───────┬───────┘  └───────┬───────┘  └──────┬───────┘  │
│          └──────────────┬───┴──────────────────┘         │
│                 Server Actions / Route Handlers           │
│                 (middleware: auth + team scope +          │
│                  subscription gate)                        │
└───────────────────────┬─────────────────────────────────┘
                         │ Prisma
                         ▼
                 PostgreSQL (Supabase)
                 Core: Team, User, TeamMembership,
                 WorkoutTemplate, ScheduledWorkout,
                 WorkoutCompletion, CoachComment
                 Fase 2: Subscription (ya existe, inactiva)
                 Fase 3: Integration, ExternalActivity,
                         WorkoutActivityLink (ya existe, inactiva)
                         │
                         ▼
        ┌────────────────┴─────────────────┐
        │                                   │
   Clerk (auth + orgs)              Stripe (fase 2, webhooks
   webhook → sync User/Team          actualizan Subscription
                                      + Team.subscriptionStatus)

Fase 3 (futuro, sin tocar el núcleo):
   Garmin/Coros/Polar/Suunto/Apple Health/Strava
        │  (OAuth por proveedor, adapter pattern)
        ▼
   Integration + sync job → ExternalActivity
        │
        ▼ (link manual o automático por fecha/hora)
   WorkoutActivityLink → ScheduledWorkout
```

### Por qué esta arquitectura soporta las fases futuras sin rehacer nada

- **Suscripción:** el gate se implementa como una función `assertTeamHasAccess(teamId)` que hoy siempre retorna `true` (o revisa un status que por defecto es `active`/`trialing`). En Fase 2 solo cambia la implementación interna de esa función — ningún código que la llama se toca.
- **Integraciones:** `ScheduledWorkout` (lo planeado) y `ExternalActivity` (lo real, importado) son tablas separadas desde el día 1. Si integrara Garmin directo dentro de `ScheduledWorkout`, cualquier cambio de proveedor rompería el modelo central. Con la tabla de enlace (`WorkoutActivityLink`), el atleta puede seguir dando feedback manual **incluso después** de tener un reloj conectado — no son mutuamente excluyentes.
- **Multi-tenant:** todo cuelga de `teamId` desde el día 1 (workouts, templates, membresías). Migrar de "un equipo" a "muchos equipos" después de tener datos reales es una de las migraciones más dolorosas en SaaS — por eso se decide ahora aunque solo haya un equipo real al lanzar.

---

## Paso 4 — Esquema de base de datos (Prisma)

```prisma
enum MembershipRole {
  COACH
  ATHLETE
  // ASSISTANT_COACH  -> valor futuro, no implementado en Fase 1
}

enum MembershipStatus {
  INVITED
  ACTIVE
  REMOVED
}

enum WorkoutStatus {
  PLANNED
  COMPLETED
  MISSED
  SKIPPED
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  PAUSED
}

enum IntegrationProvider {
  GARMIN
  COROS
  POLAR
  SUUNTO
  APPLE_HEALTH
  STRAVA
}

model Team {
  id                 String   @id @default(cuid())
  clerkOrgId         String   @unique // vincula con la Organization de Clerk
  name               String
  slug               String   @unique
  logoUrl            String?
  primaryColor       String?
  // Fase 2 — inactivo hasta entonces:
  subscriptionStatus SubscriptionStatus @default(TRIALING)
  stripeCustomerId   String?  @unique
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  memberships   TeamMembership[]
  templates     WorkoutTemplate[]
  scheduled     ScheduledWorkout[]
  subscription  Subscription?
}

model User {
  id           String   @id @default(cuid())
  clerkUserId  String   @unique
  email        String   @unique
  name         String
  avatarUrl    String?
  createdAt    DateTime @default(now())

  memberships  TeamMembership[]
}

model TeamMembership {
  id        String            @id @default(cuid())
  teamId    String
  userId    String
  role      MembershipRole
  status    MembershipStatus  @default(ACTIVE)
  createdAt DateTime          @default(now())

  team      Team @relation(fields: [teamId], references: [id])
  user      User @relation(fields: [userId], references: [id])

  athleteProfile     AthleteProfile?
  scheduledAsAthlete ScheduledWorkout[] @relation("AthleteSchedules")
  scheduledAsCoach   ScheduledWorkout[] @relation("CoachSchedules")
  coachComments      CoachComment[]
  integrations       Integration[]

  @@unique([teamId, userId])
}

model AthleteProfile {
  id               String   @id @default(cuid())
  membershipId     String   @unique
  dateOfBirth      DateTime?
  sex              String?
  coachPrivateNote String?  // visible solo para el coach, nunca al atleta
  createdAt        DateTime @default(now())

  membership TeamMembership @relation(fields: [membershipId], references: [id])
}

model WorkoutTemplate {
  id          String   @id @default(cuid())
  teamId      String
  createdById String   // userId del coach que la creó
  title       String
  description String?
  structure   Json     // ver "Contrato de estructura de entrenamiento" abajo
  tags        String[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  team      Team @relation(fields: [teamId], references: [id])
  scheduled ScheduledWorkout[]
}

model ScheduledWorkout {
  id            String        @id @default(cuid())
  teamId        String
  athleteMembershipId String
  coachMembershipId   String
  templateId    String?       // null = entrenamiento ad hoc, no venía de plantilla
  date          DateTime      @db.Date   // solo fecha, sin hora — evita líos de timezone
  title         String
  structure     Json          // snapshot copiado al asignar; editar la plantilla después NO afecta esto
  coachNote     String?
  status        WorkoutStatus @default(PLANNED)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  team     Team @relation(fields: [teamId], references: [id])
  athlete  TeamMembership @relation("AthleteSchedules", fields: [athleteMembershipId], references: [id])
  coach    TeamMembership @relation("CoachSchedules", fields: [coachMembershipId], references: [id])
  template WorkoutTemplate? @relation(fields: [templateId], references: [id])

  completion    WorkoutCompletion?
  comments      CoachComment[]
  activityLinks WorkoutActivityLink[]

  @@index([teamId, athleteMembershipId, date])
}

model WorkoutCompletion {
  id                 String   @id @default(cuid())
  scheduledWorkoutId String   @unique
  completedAt        DateTime @default(now())
  durationMinutes    Int?
  distanceKm         Float?
  perceivedPace      String?   // texto libre tipo "5:30/km" o percepción subjetiva
  rpe                Int?      // 1-10
  athleteComment     String?

  scheduledWorkout ScheduledWorkout @relation(fields: [scheduledWorkoutId], references: [id])
}

model CoachComment {
  id                 String   @id @default(cuid())
  scheduledWorkoutId String
  coachMembershipId  String
  comment            String
  createdAt          DateTime @default(now())

  scheduledWorkout ScheduledWorkout @relation(fields: [scheduledWorkoutId], references: [id])
  coach            TeamMembership   @relation(fields: [coachMembershipId], references: [id])
}

// ---- Fase 2: existe desde hoy, inactivo hasta que se conecte Stripe ----
model Subscription {
  id                   String             @id @default(cuid())
  teamId               String             @unique
  stripeSubscriptionId String?            @unique
  status               SubscriptionStatus @default(TRIALING)
  seatsIncluded         Int                @default(0)
  currentPeriodEnd     DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  team Team @relation(fields: [teamId], references: [id])
}

// ---- Fase 3: existe desde hoy, sin sync jobs activos ----
model Integration {
  id               String              @id @default(cuid())
  membershipId     String
  provider         IntegrationProvider
  externalAccountId String
  accessToken      String              // guardado cifrado a nivel de app
  refreshToken     String?
  connectedAt      DateTime            @default(now())
  lastSyncedAt     DateTime?

  membership TeamMembership @relation(fields: [membershipId], references: [id])
  activities ExternalActivity[]

  @@unique([membershipId, provider])
}

model ExternalActivity {
  id             String   @id @default(cuid())
  integrationId  String
  externalId     String
  startedAt      DateTime
  durationSeconds Int?
  distanceMeters Float?
  avgPaceSecPerKm Int?
  avgHeartRate   Int?
  rawPayload     Json?
  createdAt      DateTime @default(now())

  integration Integration @relation(fields: [integrationId], references: [id])
  links       WorkoutActivityLink[]

  @@unique([integrationId, externalId])
}

model WorkoutActivityLink {
  id                 String   @id @default(cuid())
  scheduledWorkoutId String
  externalActivityId String
  linkedBy           String   // "auto" | "manual"
  createdAt          DateTime @default(now())

  scheduledWorkout ScheduledWorkout  @relation(fields: [scheduledWorkoutId], references: [id])
  externalActivity ExternalActivity  @relation(fields: [externalActivityId], references: [id])

  @@unique([scheduledWorkoutId, externalActivityId])
}
```

### Contrato de "estructura de entrenamiento" (`structure: Json`)

Para que el JSON no se vuelva un blob sin forma, se valida con Zod contra este contrato desde el día 1:

```ts
const WorkoutSegment = z.object({
  label: z.string(),              // "Calentamiento", "Serie 1", "Enfriamiento"
  repeat: z.number().int().default(1),
  distanceMeters: z.number().optional(),
  durationSeconds: z.number().optional(),
  targetPace: z.string().optional(),   // "4:30-4:45/km"
  targetRpe: z.number().min(1).max(10).optional(),
  note: z.string().optional(),
});

const WorkoutStructure = z.object({
  segments: z.array(WorkoutSegment),
  totalDistanceMeters: z.number().optional(), // calculado o manual
});
```

Esto es lo que copia `ScheduledWorkout.structure` desde `WorkoutTemplate.structure` al momento de asignar — así una edición posterior de la plantilla no altera retroactivamente lo ya programado.

---

## Paso 5 — Roles y permisos

| Acción | Coach (propio equipo) | Atleta (propio perfil) | Admin interno |
|---|---|---|---|
| Crear/editar atletas de su equipo | ✅ | ❌ | ✅ (todos los equipos) |
| Crear plantillas de entrenamiento | ✅ | ❌ | — |
| Crear/editar/mover/duplicar entrenamientos | ✅ | ❌ | — |
| Ver calendario de un atleta | ✅ (sus atletas) | ✅ (solo el suyo) | ✅ |
| Marcar entrenamiento como completado | ❌ (solo lectura) | ✅ (el suyo) | ❌ |
| Dar feedback manual (duración, RPE, etc.) | ❌ | ✅ (el suyo) | ❌ |
| Comentar un entrenamiento | ✅ | ❌ (solo lee comentarios del coach) | ❌ |
| Ver dashboard de cumplimiento del equipo | ✅ | ❌ (ve solo su propio resumen) | ✅ (agregado cross-team) |
| Configurar branding del equipo (fase branding) | ✅ | ❌ | ✅ |
| Gestionar suscripción/facturación (fase 2) | ✅ | ❌ | ✅ (soporte) |
| Ver atletas aunque su suscripción esté vencida | ✅ (nunca se bloquea al coach) | — | ✅ |
| Acceso bloqueado por falta de pago | N/A | Se activa el gate | N/A |

**Regla de enforcement:** todo esto se valida en el servidor (Server Actions / route handlers), nunca solo en el cliente. El helper `requireRole(membership, role)` y `assertTeamHasAccess(teamId)` se llaman al inicio de cada acción sensible.

**Implementado:** `User.isPlatformAdmin` (no `MembershipRole` — un admin necesita ver equipos a
los que no pertenece, así que vive en `User`, no en `TeamMembership.role`) + `requirePlatformAdmin()`
en `src/lib/permissions.ts` + rutas `/admin` (lista de equipos) y `/admin/teams/[id]` (roster +
conteos). Sin auto-registro: se activa a mano con `scripts/make-admin.ts`. Alcance real hoy:
ver equipos y su roster para soporte — **no** incluye un dashboard de cumplimiento agregado
cross-team ni impersonar usuarios; ambos quedan como siguiente escalón si hace falta.

---

## Paso 6 — Flujos críticos

**Onboarding coach**
1. Coach se registra (Clerk) → se crea `User`.
2. Completa nombre de equipo → se crea `Team` + `TeamMembership(role=COACH)` + `Subscription(status=TRIALING)`.
3. Aterriza en dashboard vacío con CTA "Agrega tu primer atleta".

**Alta de atleta**
1. Coach va a "Atletas" → "Agregar atleta" (nombre + email).
2. Se crea `User` (o se reutiliza si el email ya existe) + `TeamMembership(role=ATHLETE, status=INVITED)`.
3. Clerk envía invitación por email; al aceptar, `status` pasa a `ACTIVE`.
4. Coach opcionalmente completa `AthleteProfile` (fecha de nacimiento, notas privadas).

**Creación de entrenamiento**
1. Coach elige "Nuevo entrenamiento" desde una plantilla o en blanco.
2. Define segmentos (distancia/duración/ritmo objetivo/RPE) vía el editor de estructura.
3. Guarda como `WorkoutTemplate` (reutilizable) o lo dirige directo al calendario de un atleta (`ScheduledWorkout` ad hoc, `templateId = null`).

**Asignación al calendario**
1. Desde el calendario, coach elige "Asignar entrenamiento" (o "+ Agregar" en un día) y selecciona uno o **varios atletas** (checklist con "seleccionar todos"), fecha, y plantilla o estructura ad hoc.
2. Se crea un `ScheduledWorkout` independiente por cada atleta seleccionado, todos con el mismo `structure` copiado en ese instante — cada quien completa/comenta el suyo por separado.
3. Coach puede mover (editar la fecha), copiar (a otro atleta) o duplicar (mismo atleta, otra fecha) desde la página de detalle de cada entrenamiento — no es drag-and-drop todavía.

**Visualización del atleta**
1. Atleta entra → gate de suscripción del equipo (`assertTeamHasAccess`) → si pasa, ve su calendario semanal con estados visuales (planeado / completado / perdido).
2. Abre un día → ve detalle: estructura completa, nota del coach, comentarios previos.

**Completar entrenamiento**
1. Atleta abre el entrenamiento del día → botón "Marcar como completado".
2. Se despliega formulario de feedback (duración, distancia, ritmo percibido, RPE 1-10, comentario libre).
3. Se crea `WorkoutCompletion` y `ScheduledWorkout.status = COMPLETED`.
4. Coach ve notificación/indicador en su dashboard de cumplimiento y puede comentar.

**Bloqueo por falta de pago (Fase 2)**
1. Webhook de Stripe cambia `Subscription.status` (ej. a `past_due` o `canceled`) → se propaga a `Team.subscriptionStatus`.
2. Atleta de ese equipo entra a la plataforma → `assertTeamHasAccess(teamId)` retorna `false` → se renderiza `BillingGateScreen` en vez del calendario (nunca un error, nunca un 403 crudo).
3. Coach entra normalmente — su membership es `COACH`, el gate solo aplica a `ATHLETE` — y sigue viendo el roster, historial y datos de sus atletas para no perder continuidad de coaching.

---

## Paso 7 — Estructura de pantallas

- **Auth** (`/sign-in`, `/sign-up`) — hospedado/embebido por Clerk.
- **Coach dashboard** (`/coach`) — métricas del equipo: entrenamientos programados vs completados, cumplimiento semanal, km totales, lista de atletas con semáforo de cumplimiento.
- **Athlete dashboard** (`/athlete`) — resumen personal: racha, km de la semana, próximo entrenamiento.
- **Calendar** (`/coach/calendar`, `/athlete/calendar`) — mismo componente, distintos permisos; vista semana/mes, drag-and-drop (solo coach).
- **Workout detail** (`/.../workout/[id]`) — coach ve estructura + edición + comentarios; atleta ve estructura + botón completar + su feedback + comentarios del coach.
- **Athlete profile** (`/coach/athletes/[id]`) — vista del coach sobre un atleta: historial, cumplimiento, notas privadas, perfil.
- **Billing gate** (`/athlete/billing-gate`) — pantalla de bloqueo cuando `Team.subscriptionStatus` no es válido (fase 2; en fase 1 esta ruta existe pero nunca se activa).
- **Settings** (`/coach/settings`) — datos del equipo, branding (placeholder en fase 1), gestión de suscripción (placeholder en fase 1).

---

## Paso 8 — Backlog priorizado

**Must have (Fase 1 — sin esto no hay producto)**
- [x] Auth + creación de Team + invitación de atletas.
- [x] CRUD de `WorkoutTemplate` con editor de estructura (segmentos), incluye borrar.
- [x] Asignación de entrenamientos al calendario (crear `ScheduledWorkout`).
- [x] Vista de calendario para atleta (semana y mes, navegable) + detalle de entrenamiento.
- [x] Marcar completado + formulario de feedback manual.
- [x] Vista de cumplimiento del coach por atleta + comentarios en entrenamientos.
- [x] Dashboard con las 4 métricas pedidas (programados, completados, cumplimiento semanal, km semanales).

**Should have (Fase 1, pero después del loop core)**
- [x] Editar / mover / copiar / duplicar entrenamientos — vía formularios explícitos (editar fecha = mover, botón duplicar/copiar), no drag-and-drop todavía.
- [x] Notas del coach al atleta (a nivel entrenamiento y a nivel perfil de atleta).
- [x] Filtros de calendario — por atleta (dropdown) y por título (búsqueda de texto; "tipo" no es un campo propio de `ScheduledWorkout`, el título es el proxy usado).
- [ ] Notificaciones in-app (no email todavía) de comentarios nuevos.
- [ ] Drag-and-drop real en el calendario (mejora sobre los botones explícitos de arriba).

**Nice to have (después de validar Fase 1)**
- [x] Theming/logo dinámico por equipo — `Team.logoUrl`/`primaryColor` editables en Ajustes, aplicados en runtime vía `--team-accent` (ver `src/lib/team-theme.ts`) en header y botones principales de toda la plataforma. No hay subida de archivos: el coach pega una URL de imagen ya alojada.
- Exportar historial del atleta a CSV/PDF.
- Recordatorios por email del entrenamiento del día.
- Roles de coach asistente con permisos limitados.
- [x] Analítica de tendencia — carga de entrenamiento semanal (sRPE) + promedio móvil de 4 semanas, ver abajo.
- [x] Admin de plataforma para soporte interno — ver Paso 5.
- [x] Páginas legales (Términos de servicio / Aviso de privacidad) — borrador honesto sobre qué datos se recolectan, no una revisión legal real. Ver `src/app/terms/` y `src/app/privacy/`.
- [x] **Cálculo automático de ritmos de entrenamiento** (VDOT) — ver abajo.
- [x] **Tipo de sesión (multideporte)** — correr, trail, bici, natación, fuerza, movilidad. Ver abajo.
- [ ] **Campos propios de fuerza** (series/reps/peso en el segmento): hoy se escriben en la etiqueta. Aditivo al contrato Zod cuando el uso real lo pida — ver abajo.
- [ ] **Objetivo de carrera del atleta** (idea de producto, sin construir): un lugar para capturar la carrera meta (nombre, fecha, distancia, desnivel, trail vs. asfalto). Sin esto, el coach no tiene dónde ver "para qué está entrenando" cada atleta, y el entrenamiento debería variar según eso (un trail con desnivel necesita fondos con subida y trabajo de fuerza; un maratón de asfalto necesita más volumen a ritmo objetivo). Candidato natural: campos en `AthleteProfile` (`goalRaceName`, `goalRaceDate`, `goalDistanceMeters`, `goalElevationGainMeters`, `goalTerrain: ROAD | TRAIL`), visibles en el perfil que ve el coach. Demostrado por ahora solo con datos de prueba (`scripts/seed-marathon-training.ts`), no con un campo real en el modelo.

### Fase 0 del pivote a clubes: roles y capacidades

El producto pasa de "herramienta para un coach independiente" a "plataforma para running clubs con
cobro integrado". Esta fase es plomería para que las siguientes se puedan construir.

- **`MembershipRole` pasa de 2 a 4 valores**: `OWNER`, `ADMIN`, `COACH`, `ATHLETE`. Un club tiene
  quien lo administra sin entrenar a nadie, y un dueño que responde por el negocio.
- **Los permisos se checan por CAPACIDAD, no por rol** (`src/lib/roles.ts`). Esto es lo importante
  de la fase, no el enum: cada Server Action hacía `requireRole("COACH")`, así que agregar `OWNER`
  habría dejado al dueño del club fuera de su propia plataforma. Un bug que ningún test existente
  detectaba, visible solo al iniciar sesión como dueño. Ahora agregar un rol es editar una tabla,
  y hay un test que fija exactamente ese escenario.
- **`org:admin` de Clerk mapea a `OWNER`**: quien crea la organización está dando de alta su club.
  El mapeo solo aplica al crear la membresía, nunca al actualizar — si no, un `ADMIN` degradado en
  la app volvería a `OWNER` en el siguiente login.
- **Limitación aceptada:** el rol es un solo valor, así que no se modela "dueño que además entrena
  como socio", común en clubes chicos. Cuando haga falta, `role` pasa a lista; las capacidades ya
  están listas porque nada compara el rol directamente.
- **Se decidió NO sacar Clerk de modo desarrollo todavía** (era parte de la Fase 0 original). Para
  un demo que maneja una sola persona, el banner es cosmético y el tope de 100 usuarios no aprieta
  — los socios sembrados no consumen usuarios de Clerk. Los dos límites reales que sí obligan a
  migrar antes de que entre un club de verdad: los datos de usuario **no se transfieren** entre
  instancias, y los correos de invitación llevan prefijo "development". La regla operativa es
  entonces: nadie real se incorpora hasta que Clerk esté en producción.
- **Seguro en los scripts que borran** (`scripts/_guard.ts`): hoy la base de desarrollo es la que
  sirve el sitio desplegado, y `seed-marathon-training.ts` borra entrenamientos, feedback y
  comentarios antes de sembrar. Exigen `--force` y dicen a qué base apuntan. Se prefirió esto a
  separar bases: resuelve el riesgo concreto en 20 minutos en vez de duplicar infraestructura para
  un producto pre-ingreso.

**Tres capas, y solo una es seguridad.** Al documentar los roles se encontró que ninguna pantalla
del área de club tenía check propio: solo el layout preguntaba "¿es staff?". Las Server Actions sí
validaban, así que nadie lograba hacer lo que no debía — pero un Administración podía abrir "Nueva
plantilla", llenarla y recibir un error al guardar. No era un hueco de seguridad sino de honestidad
de la interfaz, y se arregló antes de la Fase 1 porque esa fase agrega más pantallas de club.

1. `navLinksFor(role)` esconde las pestañas que el rol no puede usar.
2. `requirePageCapability` redirige a quien llegue por URL directa o link viejo.
3. `requireCapability` en la Server Action lanza `ForbiddenError`. **Solo esta es seguridad**; las
   otras dos existen para no mostrar un formulario que va a fallar.

Los enlaces sueltos que viven en pantallas abiertas a todo el staff (los "+ Agregar" y "Asignar
entrenamiento" del calendario, las herramientas de prescripción dentro del perfil de un socio)
también se condicionan por capacidad — es donde más fácil se cuela el problema, porque la página
sí le corresponde al rol y solo un botón no.

Lo que sigue (Fase 1) es lo que convierte esto en un club: grupos por nivel, sesiones grupales con
lugar y horario, asistencia, estado de membresía (sembrado, sin cobrar) y página pública para
unirse. Ahí el perfil del socio probablemente se divida en dos: la parte administrativa
(`MANAGE_MEMBERS`, con estado de pago) y la deportiva (`MANAGE_TRAINING`).

### Dashboard del coach: "¿de qué me tengo que ocupar?"

El dashboard tenía cuatro números y una lista de atletas que decía "1/9 esta semana". El problema
no era que estuviera vacío: era que no contestaba la única pregunta con la que un coach abre la
app por la mañana. Nadie entra a ver métricas; entra a saber de qué ocuparse.

- **`Cumplimiento semanal` estaba mal medido.** Dividía entre todos los entrenamientos de la
  semana, incluidos los de días que no habían llegado — un martes con 9 programados y 1 hecho daba
  11%. Era una medida de cuánto de la semana había transcurrido, no de cumplimiento. Ahora cuenta
  solo lo vencido, excluye hoy (la sesión de hoy aún puede hacerse) y muestra "—" en vez de un 0%
  falso cuando nada venció. Los tests encodifican el caso real que lo destapó.
- **"Requiere tu atención"** es la pieza central: vencidos sin marcar, feedback sin responder
  (comentario del atleta o RPE ≥ 8 sin comentario del coach, últimos 14 días) y atletas sin
  registrar nada en 10 días — incluidos los que nunca registraron uno, que es el caso más fácil de
  que se te pierda un atleta recién invitado. Cada renglón es un enlace directo.
- **La lista de atletas dice algo.** Cumplimiento propio, hace cuánto registró algo por última vez,
  y la carga de esta semana contra la anterior.
- **La comparación de carga se rompió por el mismo motivo que el cumplimiento**, y se descubrió
  mirando la pantalla ya desplegada. Comparaba la semana en curso contra la semana pasada
  **completa**: un lunes con 184 de carga contra 2698 mostraba −93%, cuando contra el mismo lunes
  de la semana anterior (120) el atleta iba **+53%, subiendo**. No era impreciso, apuntaba al lado
  contrario. Ahora se compara contra la misma porción de la semana pasada. Sigue en gris: con
  pocos días transcurridos una sola sesión mueve mucho el porcentaje.
- **Patrón, no coincidencia.** Van tres defectos de la misma familia (los dos de zona horaria, y
  estos dos de período parcial vs. completo). El denominador común es comparar dos magnitudes sin
  hacer explícito sobre qué ventana está medida cada una. Vale la pena buscarlo a propósito en la
  próxima revisión en vez de esperar a que aparezca.
- **La lógica vive en `src/lib/coach-dashboard.ts`, pura y testeada**; las queries se quedan en la
  página. La carga del equipo sale de una sola query agrupada en memoria, no de una por atleta.

### Tipo de sesión (multideporte)

Un corredor no solo corre: hace fuerza, movilidad, y a veces bici para sumar volumen sin impacto.
El diagnóstico al abordarlo fue que el modelo ya era casi multideporte sin proponérselo — un
segmento con duración, RPE y nota describe una sesión de gimnasio igual de bien que una serie en
pista, y la carga sRPE (RPE × minutos) es precisamente el método estándar para comparar deportes
distintos. Lo único genuinamente de correr eran el campo de ritmo y la métrica de kilómetros.

Por eso se eligió la opción mínima: **una etiqueta, no un modelo por deporte.**

- **`sport` en `WorkoutTemplate` y en `ScheduledWorkout`**, con default `RUN`. En el asignado es un
  snapshot, igual que `structure`: cambiar el deporte de la plantilla no reescribe lo ya asignado.
- **`src/lib/sports.ts` concentra qué significa cada tipo**: si pide distancia, si pide ritmo, qué
  ejemplo mostrar en cada campo, si se le pueden sugerir los ritmos del VDOT, y si sus kilómetros
  cuentan como kilometraje de carrera. Un test compara la lista contra el enum de Prisma, así que
  agregar un deporte y olvidar la metadata falla en CI en vez de renderizar vacío.
- **Sin campos por deporte, a propósito.** Series/reps/peso se escriben en la etiqueta del
  segmento ("Sentadilla 4x8 @ 70 kg"). Se lee bien y no permite graficar progresión de un
  levantamiento — esa es la limitación conocida. Añadir campos opcionales al contrato Zod después
  es aditivo y no rompe nada guardado, así que la decisión se pospone hasta que haya uso real que
  la justifique, en vez de diseñarla en el vacío.
- **Un campo que no aplica se esconde, pero nunca si ya tiene valor.** Cambiar una sesión de correr
  a fuerza dejaría una distancia guardada e invisible; en vez de borrarla en silencio, se sigue
  mostrando y el coach decide.
- **La lista de plantillas se agrupa por tipo, pero agrupar no era suficiente.** Para un coach de
  running la distribución está muy sesgada: de 30 plantillas, ~24 son de correr. Agrupar da un
  grupo enorme y varios diminutos — ayuda a llegar a "fuerza", no a encontrar *la* plantilla de
  correr correcta. Lo que discrimina dentro de correr son los tags que ya existían, así que además
  de los grupos hay chips por deporte con conteo, tags clicables y búsqueda por título
  (`?sport=&tag=&q=`), todo como enlaces y un form GET nativo — sin estado de cliente.
- **"Km semanales" pasó a "Km corriendo"** y solo suma correr y trail. Sumar los km de una sesión
  de bici con los de un fondo produce un número que no significa nada. Los demás deportes siguen
  contando en cumplimiento y en la gráfica de carga, donde sí son comparables.

### Cálculo automático de ritmos (VDOT)

Salió de la comparación con V.O2 (vdoto2.com): prescribir ritmos a mano, atleta por atleta,
es de las tareas que más tiempo le quitan a un coach y de las más fáciles de automatizar bien.

- **Modelo: VDOT de Jack Daniels** (ecuaciones Daniels-Gilbert). Son fórmulas publicadas, no
  código propietario; están implementadas desde cero en `src/lib/vdot.ts` con tests que usan
  valores de referencia calculados, no memorizados.
- **Entrada: un resultado de carrera reciente** (distancia + tiempo), capturado por el coach en
  el perfil del atleta. De ahí salen los cinco ritmos: fácil (rango), maratón, umbral,
  intervalo, repetición.
- **El VDOT se persiste** en `AthleteProfile` (`raceResultDistanceMeters`,
  `raceResultTimeSeconds`, `vdot`) en vez de calcularse al vuelo, para que quede registro de con
  qué números se prescribió, aunque después se cambie la fórmula.
- **Limitado a asfalto/pista, a propósito.** El modelo asume que el ritmo es una unidad de
  esfuerzo comparable, y eso no se sostiene en trail: el desnivel y el terreno técnico cambian
  el costo energético de forma no lineal. La alternativa honesta (grade-adjusted pace) necesita
  datos de desnivel que hoy no existen en el modelo — llegarían con las integraciones de Fase 3.
  Mientras tanto, la UI dice explícitamente que estos ritmos son de plano, y para trail la
  recomendación es prescribir por **RPE objetivo o duración** en los segmentos (ambos ya
  soportados por `workout-structure.ts`). Se prefirió eso a dar un número que se ve preciso y
  no lo es.
- **Se insertan solos en la sesión.** Una calculadora que obliga a copiar números a mano no
  ahorra trabajo. Al asignar o editar un entrenamiento, cada segmento ofrece los cinco ritmos
  como botones. Aparecen solo cuando hay **un** atleta conocido: una plantilla es de todo el
  equipo, y en una asignación múltiple ofrecer un ritmo sería prescribirle a todos el del
  primero.
- **El atleta también los ve**, en solo lectura, en su dashboard. Saber el ritmo fácil evita el
  error más común (correr los rodajes demasiado rápido); editar el resultado de carrera sigue
  siendo exclusivo del coach.
- **Precisión decreciente en los extremos.** La curva de Daniels se comporta peor en esfuerzos
  de menos de ~3 minutos y por encima del 100% del VDOT; por eso la acción rechaza distancias
  menores a 1500 m y tiempos menores a 3 minutos, y el ritmo de repetición está marcado en el
  código como el menos confiable de los cinco.

### Carga de entrenamiento (sRPE)

Se agregó antes de lo planeado porque resuelve una pregunta real de coaching: ver si un
atleta está construyendo carga de forma sostenida o si hubo un pico de riesgo, sin
necesitar reloj/HR (eso es Fase 3). Decisiones:

- **Métrica: sRPE** = `RPE (1-10) × duración en minutos` de `WorkoutCompletion` — el
  método estándar de ciencia del deporte cuando no hay datos de wearable, y ya
  teníamos ambos campos.
- **Solo carga real, no planeada.** `targetRpe` por segmento es opcional en el editor
  (decisión explícita para no forzar campos), así que una carga "planeada" sería un
  estimado poco confiable hoy. Si en algún momento se vuelve consistente pedir
  `targetRpe` al crear entrenamientos, se puede agregar una serie planeada en paralelo
  sin tocar `getWeeklyLoadSeries`.
- **Agregación por semana (lunes-domingo)**, asignada a `ScheduledWorkout.date` (el día
  para el que era el entrenamiento), no a `completedAt` — un feedback mandado tarde no
  distorsiona la semana a la que pertenece.
- **Referencia crónica** = promedio móvil de 4 semanas (semana actual + 3 anteriores),
  mostrada como línea sobre las barras semanales — así se ve si una semana rompió el
  patrón de construcción/descarga.
- Vive en `src/lib/training-load.ts` (cálculo) + `src/components/TrainingLoadChart.tsx`
  (gráfica SVG a mano, sin librería de charts). Se muestra en el dashboard del atleta
  (12 semanas) y en el perfil que ve el coach (8 semanas, versión compacta) — no en
  cada entrenamiento individual, ahí no aporta.

---

## Orden ideal de implementación

1. Scaffold del proyecto (Next.js + TS + Tailwind + Prisma + Clerk) — este mismo paso, ahora.
2. Modelo de datos completo (incluyendo tablas de fase 2/3 inactivas) + primera migración.
3. Auth + creación de Team + membership de coach.
4. Alta de atletas + invitación.
5. CRUD de plantillas de entrenamiento (con el contrato de estructura).
6. Calendario + asignación de entrenamientos (crear `ScheduledWorkout`).
7. Vista de atleta: calendario + detalle + marcar completado + feedback.
8. Vista de coach: cumplimiento + comentarios.
9. Dashboard de métricas (coach y atleta).
10. Pulido de UX (mover/copiar/duplicar, estados vacíos, responsive).
11. (Fase 2) Activar Stripe real sobre el modelo `Subscription` ya existente.
12. (Fase 3) Primer adapter de integración (recomendado empezar por Strava, tiene la API más simple de las seis).

---

## Riesgos señalados

- **Producto:** si marcar-completado + feedback no toma menos de 15 segundos, los atletas dejan de usarlo. Priorizar ese flujo sobre cualquier otra pantalla.
- **Producto:** el "cumplimiento" que ve el coach debe ser instantáneo y visual (semáforo, no tablas) — es el valor central para retener coaches.
- **Arquitectura:** no fusionar `ScheduledWorkout` con `ExternalActivity` nunca, ni como atajo — es la decisión que más dolor evita en Fase 3.
- **Arquitectura:** el gate de suscripción debe vivir en una sola función server-side reutilizada en todas las rutas de atleta — si se duplica la lógica, alguna ruta se queda sin proteger.
- **Costo/dependencia:** no depender de roles custom de pago de Clerk; los permisos finos viven en tu propia base de datos.
- **Timezone (bug real, encontrado y corregido dos veces):** `ScheduledWorkout.date` se guarda como fecha pura (`@db.Date`), pero Prisma la devuelve como medianoche UTC.
  1. **Lectura:** leerla con date-fns en hora LOCAL (`format`, `isSameDay`, `startOfWeek`) en cualquier servidor detrás de UTC (todo Latinoamérica) la mostraba/agrupaba un día antes del real. Arreglado con `toLocalCalendarDate()` en `src/lib/calendar-date.ts`, aplicado en cada punto donde se lee esa fecha (calendarios, detalle, edición, cálculo de carga).
  2. **Límites de query (encontrado después por una revisión independiente, confirmado empíricamente):** `getCurrentWeekRange`/`getMonthGridRange` construían `start`/`end` en hora LOCAL y esos mismos valores se usaban directo como `gte`/`lte` contra Postgres — el `lte` (fin de semana/mes en hora local) cae en la madrugada del día calendario SIGUIENTE en UTC, y Prisma lo trunca a esa fecha, así que el rango de "esta semana" incluía de más el lunes de la semana siguiente (inflando conteos/métricas si ya había algo programado ahí). Arreglado con `toQueryBoundary()` en `src/lib/calendar-date.ts`, aplicado solo al armar el filtro de Prisma — nunca a los valores usados para `eachDayOfInterval`/`isSameMonth` (esos deben seguir en hora local para que la cuadrícula del calendario se genere bien).

  Regla para código nuevo: (a) cualquier valor `date`/`completedAt` que venga de la base de datos y vaya a una función de date-fns no explícitamente UTC debe pasar primero por `toLocalCalendarDate`; (b) cualquier fecha calculada en hora local (`startOfWeek`, `endOfMonth`, etc.) que vaya a un filtro `gte`/`lte` de Prisma contra un campo `@db.Date` debe pasar primero por `toQueryBoundary`. Son funciones inversas para propósitos distintos — no intercambiables.

  Dos bugs de la misma clase, encontrados de forma reactiva (uno por mí corriendo la app,
  el otro por una revisión independiente) es la señal de que "correr la app y mirar" no
  alcanza para esta lógica. Se agregó una suite de tests unitarios (Vitest, ver README §Tests)
  con casos de regresión específicos para ambos — incluye un test que reproduce exactamente
  el escenario del segundo bug (un entrenamiento fechado justo en lunes, corriendo con
  `TZ=America/Mexico_City` forzado) para que no pueda volver a colarse en silencio.
