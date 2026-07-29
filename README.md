# TPeaks

![CI](https://github.com/hidelink/tpeaks/actions/workflows/ci.yml/badge.svg)

Plataforma de entrenamiento para coaches y corredores — "TrainingPeaks simplificado", white-label por equipo.

Ver el spec completo (producto, arquitectura, esquema de datos, roles, flujos, backlog) en [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) antes de tocar código — ahí está el razonamiento detrás de cada decisión.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL (Supabase recomendado)
- Clerk (auth + Organizations = club) para identidad; los permisos finos viven en nuestra propia tabla `TeamMembership` y se checan por capacidad, no en Clerk — ver "Roles de club" abajo
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
src/lib/roles.ts               roles de club (ADMIN/COACH/ATHLETE) y qué capacidad tiene cada uno
src/lib/permissions.ts         getCurrentMembership / requireCapability — única fuente de verdad de permisos
scripts/_guard.ts              seguro de los scripts que borran datos (exige --force y dice a qué base apunta)
scripts/set-role.ts            cambia el rol de alguien en su club (sin argumentos, lista los actuales)
src/lib/subscription-gate.ts   gate de suscripción (Fase 2), hoy siempre permite acceso
src/lib/workout-structure.ts   contrato Zod de la estructura de un entrenamiento
src/lib/actions/                Server Actions (crear/editar plantilla, asignar/editar/duplicar entrenamiento, marcar completado, comentar)
src/lib/clerk-sync.ts          upsert de Team/User/TeamMembership desde datos de Clerk (usado por el webhook y como fallback sync-on-read)
src/lib/dates.ts               rangos de semana/mes + navegación (?date=yyyy-MM-dd&view=week|month) del calendario
src/lib/calendar-date.ts       toLocalCalendarDate/todayAsUtcMidnight — normaliza fechas @db.Date (ver nota de timezone abajo)
src/lib/calendar-url.ts        construye URLs de calendario preservando filtros activos
src/lib/nav-links.ts           navegación filtrada por capacidad (navLinksFor), compartida entre los layouts de club/socio y /workout/[id]
src/lib/page-guards.ts         requirePageCapability — guard de páginas: redirige en vez de mostrar un formulario que va a fallar
src/components/AppHeader.tsx     header con nav compartido (coach, atleta, y /workout/[id] que vive fuera de ambos árboles)
src/components/SegmentEditor.tsx  editor de segmentos compartido entre plantillas, asignación ad hoc y edición
src/components/TemplateForm.tsx   formulario compartido entre crear y editar una plantilla
src/components/CalendarFilterBar.tsx  filtro por atleta (coach) + búsqueda por título, form GET nativo
src/middleware.ts               Clerk middleware (protege todas las rutas salvo /sign-in, /sign-up, webhooks)
src/lib/actions/invite.ts       invitar/revocar atleta vía la API de invitaciones de Clerk Organizations
src/lib/actions/athlete-profile.ts  nota privada del coach + resultado de carrera/VDOT de un atleta
src/lib/coach-dashboard.ts     cálculos puros del dashboard: cumplimiento sobre lo vencido, inactividad, carga semana vs. anterior
src/lib/groups.ts              resolver grupos a socios sin duplicar a quien está en varios
src/lib/attendance.ts          pase de lista: validar la hora local, resumir y calcular % de asistencia
src/lib/actions/sessions.ts    sesiones presenciales del club + pase de lista (MANAGE_TRAINING)
src/lib/actions/groups.ts      CRUD de grupos de entrenamiento del club (MANAGE_MEMBERS)
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
src/app/admin/                  SOPORTE de plataforma (interno) — lista de clubes + detalle, ver requirePlatformAdmin. Distinto del rol ADMIN de club
src/app/terms/, src/app/privacy/  páginas legales públicas (borrador, ver nota abajo)
src/app/api/webhooks/clerk/     sincroniza User/Team/TeamMembership desde Clerk
```

## Estado actual (MVP Fase 1, en construcción)

Ya funciona (una vez conectada la base de datos y Clerk): auth + creación de equipo vía Clerk Organizations (con onboarding para crear el equipo si el usuario no tiene uno todavía), invitar/revocar atletas por email (invitación real de Clerk Organizations, ya no un placeholder), sincronización de usuarios/equipos por webhook o al vuelo si el webhook no está configurado, dashboard de coach y atleta con las 4 métricas, calendario **semanal y mensual** navegable (anterior/siguiente/hoy) con filtro por atleta y búsqueda por título, creación/edición/borrado de plantillas de entrenamiento con editor de segmentos, **asignación de un entrenamiento a uno o varios atletas a la vez** (checklist con "seleccionar todos" — el caso real de un coach con equipo, no uno-por-uno), edición de un entrenamiento ya asignado (incluye "moverlo" cambiando la fecha), duplicar/copiar un entrenamiento a otra fecha o a otro atleta, detalle de entrenamiento con feedback manual del atleta y comentarios del coach, perfil de atleta con historial + nota privada del coach editable, **cálculo automático de ritmos de entrenamiento** a partir de un resultado de carrera reciente (modelo VDOT, ver nota abajo), una gráfica de **carga de entrenamiento** (sRPE semanal + promedio móvil de 4 semanas) en el dashboard del atleta y en el perfil que ve el coach, **white-label activado** (logo + color de acento configurables en Ajustes, aplicados en runtime en toda la plataforma), **roles de club** (admin / coach / socio, con permisos por capacidad), un **acceso de soporte de plataforma** (`/admin`, ve todos los clubes — se activa a mano con `scripts/make-admin.ts`, no hay auto-registro), y páginas públicas de **Términos de servicio / Aviso de privacidad**.

Pendiente (ver Paso 8 del spec, "Nice to have"): drag-and-drop real en el calendario (mover/duplicar hoy se hacen desde botones explícitos, no arrastrando); notificaciones in-app de comentarios nuevos.

No construido todavía (a propósito, ver Paso 2 del spec): cobros reales con Stripe.

Desplegado en <https://tpeaks.vercel.app> — pero con llaves de Clerk **de desarrollo** y la misma
base de Supabase que usa el entorno local. Sirve para enseñárselo a alguien; no es todavía un
entorno de producción de verdad (falta instancia de Clerk de producción con dominio propio, y
una base separada de la de desarrollo).

### Roles de club y capacidades

Un club tiene tres roles: **Admin**, **Coach** y **Socio** (`ATHLETE`). Los permisos **no** se
checan comparando el rol, sino contra capacidades (`src/lib/roles.ts`):

| | Entrenamiento | Socios | Ajustes del club | Registrar lo propio |
|---|---|---|---|---|
| Admin | sí | sí | sí | — |
| Coach | sí | sí | — | — |
| Socio | — | — | — | sí |

**Admin es la unión de todo lo que un club puede hacer, a propósito.** El caso que manda es el club
de una persona que administra y entrena: necesita un rol que alcance para todo, no varios que haya
que combinar. Coach existe para el coach contratado, que no debe poder cambiar la marca del club ni,
más adelante, ver los cobros.

**No se modela "Admin que además es socio".** Quien administre un club y quiera entrenar en él como
socio usa otra cuenta. Con un solo valor la exclusión la garantiza el motor de datos; con una lista
de roles habría que validarla a mano en cada escritura, y un `["ADMIN","ATHLETE"]` colado dejaría a
esa persona calificando para dos layouts a la vez.

⚠️ **"Admin" de club ≠ "Soporte" de plataforma.** El rol `ADMIN` de arriba vive en
`TeamMembership` y solo manda dentro de su club. El acceso de soporte interno (`/admin`, que ve
todos los clubes) vive en `User.isPlatformAdmin`, se muestra como **Soporte** en la interfaz y se
activa con `scripts/make-admin.ts`.

La razón de la indirección es concreta: cuando solo existían `COACH` y `ATHLETE`, cada Server
Action hacía `requireRole("COACH")`. Al agregar un rol por encima de Coach, todas esas
comparaciones habrían dejado a esa persona fuera de su propia plataforma, y ningún test lo habría
atrapado — solo se vería al iniciar sesión con ese rol. Hay un test que fija exactamente ese caso.
La misma indirección permitió después fusionar dos roles en uno sin auditar ninguna acción.

Las tres capas se aplican juntas, y solo una es seguridad:

1. **Navegación** — `navLinksFor(role)` esconde las pestañas que el rol no puede usar. Un
   un coach no ve "Ajustes".
2. **Página** — `requirePageCapability` redirige a `/coach` a quien llegue por URL o link viejo.
3. **Server Action** — `requireCapability` lanza `ForbiddenError`. **Esta es la única que es
   seguridad**; las otras dos existen para no mostrar un formulario que va a fallar al guardar.

En Clerk, quien crea la organización queda como `ADMIN` de su club. Después se ajusta con:

```bash
npx tsx scripts/set-role.ts email@ejemplo.com COACH
```

Sin argumentos lista los roles actuales. Los roles se ven en **Socios y staff**.

### Grupos de entrenamiento

Un club agrupa socios por nivel o por día ("Avanzados", "Trail", "Principiantes") en
`/coach/groups`. **Un socio puede estar en varios grupos a la vez**, por eso es tabla de unión
(`TrainingGroupMember`) y no un campo en la membresía.

El punto no es la pantalla, es la asignación: al asignar un entrenamiento aparecen los grupos como
chips que agregan o quitan a sus socios de la misma lista de selección. Se combinan con personas
sueltas, y quien está en dos grupos **no recibe el entrenamiento dos veces** (`memberIdsOfGroups`
deduplica; hay un test que lo fija).

Borrar un grupo no borra socios ni entrenamientos: la pertenencia es `ON DELETE CASCADE` y lo ya
asignado no depende del grupo — el grupo era el atajo para asignar, no el dueño de nada.

### Sesiones presenciales y pase de lista

`ClubSession` es el entrenamiento presencial del club — día, hora, lugar, grupo y coach — y es
distinto de `ScheduledWorkout`, que es el plan individual de un socio y puede hacerse solo. Vive en
`/coach/sessions`; el detalle tiene el pase de lista.

**La hora es un string `"HH:mm"` en hora local del club, no un timestamp.** "Los martes a las 7:00
en el parque" es un hecho en la hora local; convertirlo a UTC solo reintroduce la clase de bug que
ya costó dos arreglos aquí. Como la base no valida el formato, lo hace `parseStartTime`, que además
normaliza `7:00` a `07:00` para que ordenar por texto ordene por hora.

**No tener marca no es faltar.** Solo existe fila de asistencia para quien ya fue marcado; la
ausencia de fila significa "todavía no se pasó lista". Si contáramos eso como falta, el historial
de un socio se llenaría de ausencias inventadas por sesiones que el coach nunca registró. Por lo
mismo, el porcentaje de asistencia se calcula sobre lo registrado y no sobre los convocados, y
muestra "—" cuando no hay nada — mismo criterio que el cumplimiento del dashboard.

El pase de lista marca de una persona a la vez y es optimista en el cliente: se usa de pie en el
parque, con mala red, mientras la gente llega. El estado optimista guarda **solo** las marcas en
vuelo y cada una se borra al resolverse, con éxito o con error — así el servidor vuelve a ser la
verdad en cuanto termina la petición. Se deshabilita únicamente la fila en vuelo, no todas: un
`disabled` global anularía justo el beneficio de ser optimista.

### El estado del socio tiene que propagarse

Dar de baja a un socio lo marca `REMOVED` (su historial sigue siendo del club) **y borra su
pertenencia a grupos**. Si no, el grupo sigue contándolo y seleccionándolo, y el guardado del grupo
se rompe. Hay tres capas: el webhook limpia al dar de baja, las lecturas de grupo filtran a socios
activos, y las acciones que asignan trabajo exigen `status: "ACTIVE"`.

Si agregas una acción que asigne algo a un socio, filtra por `status: "ACTIVE"` y no solo por
pertenecer al club — las pantallas solo ofrecen activos, así que aceptar más es aceptar ids que la
interfaz nunca mostró.

### Scripts que borran datos

`seed-marathon-training.ts` y `seed-templates.ts` borran antes de sembrar, y hoy la base de
desarrollo es la misma que sirve el sitio desplegado. Ambos exigen `--force` y antes imprimen a
qué base apuntan (`scripts/_guard.ts`). Sin la bandera se detienen sin tocar nada.

### Nota: dos URLs de base de datos, y la diferencia tumbó producción

`DATABASE_URL` apuntaba al pooler de Supabase en el puerto **5432 = session mode**, donde cada
conexión se queda con un backend de Postgres dedicado y el tope son 15 clientes. Cada instancia
serverless abre su propio pool de `pg` (default: hasta 10), y Next.js precarga los links del nav,
así que una sola visita dispara media docena de renders en paralelo. Resultado: toda la app
devolvió 500 con `(EMAXCONNSESSION) max clients reached in session mode`.

- **`DATABASE_URL`** → pooler en **transaction mode, puerto 6543**. Es la que usa la app.
- **`DIRECT_URL`** → conexión directa, **puerto 5432**. Solo para `prisma migrate` (las
  migraciones usan advisory locks que transaction mode no soporta). La lee `prisma.config.ts`.
- El pool de `pg` está acotado a 3 por instancia (`DATABASE_POOL_MAX`) en `src/lib/prisma.ts`.

Si clonas esto y ves 500 en todas las rutas, revisa primero el puerto de `DATABASE_URL`.

### Nota: el cumplimiento semanal medía otra cosa

`Cumplimiento semanal` dividía entre **todos** los entrenamientos de la semana, incluidos los de
días que aún no llegan. Un martes con 9 sesiones programadas y 1 hecha daba 11%, cuando de esas 9
solo 2 habían vencido. El número quedaba cerca de cero cada lunes y saltaba el domingo: no medía
cumplimiento sino cuánto de la semana había transcurrido, y eso entrena al coach a ignorarlo.

Ahora se calcula solo sobre lo vencido, **excluyendo hoy** (la sesión de hoy todavía se puede
hacer en la tarde), y muestra "—" cuando nada ha vencido en vez de un 0% falso. Ver
`weeklyCompliance` en `src/lib/coach-dashboard.ts`, con tests que encodifican el caso real.

La comparación de carga del dashboard tenía el mismo defecto: medía la semana en curso contra la
semana pasada **completa**. Un lunes con 184 de carga contra 2698 daba −93%, cuando contra el
mismo lunes de la semana anterior (120) el atleta iba **+53%, subiendo**. Ahora se compara contra
la misma porción de la semana pasada (`loadByAthlete`). Si vas a agregar otra métrica comparativa,
haz explícito sobre qué ventana está medida cada lado — es el mismo error tres veces en este
proyecto.

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
npx tsx scripts/seed-marathon-training.ts [email-del-atleta] --force
# default: member@yopmail.com
```

`scripts/seed-templates.ts` siembra 4 plantillas de entrenamiento reutilizables con
variedad real (series en pista, tempo, fondo largo progresivo, fartlek) — para que
`/coach/templates` se vea como se usaría de verdad en vez de vacío.

```bash
npx tsx scripts/seed-templates.ts [email-del-coach] --force
# sin argumento, asume que solo hay un coach y lo usa
```

```bash
npx tsx scripts/seed-test-workouts.ts [email-del-atleta]
# default: member@yopmail.com
```

## Soporte de plataforma

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
