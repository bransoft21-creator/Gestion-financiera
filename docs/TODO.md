# TODO

Roadmap del MVP organizado por fases pequenas. Al finalizar cada fase, este archivo debe actualizarse con avances, decisiones y nuevos pendientes.

## Fase 0 - Base del Proyecto

- [x] Crear documentacion inicial en `/docs`.
- [x] Crear `.env.example`.
- [x] Inicializar proyecto Next.js con TypeScript.
- [x] Configurar Tailwind CSS.
- [x] Configurar shadcn/ui.
- [x] Configurar Prisma.
- [ ] Configurar conexion a Supabase PostgreSQL.
- [x] Definir estructura base de carpetas.

## Fase 1 - Autenticacion

- [x] Configurar Supabase Auth. Parcial: helpers server/browser y validacion en APIs creados.
- [x] Crear flujo de registro. Parcial: pantalla inicial creada, falta confirmacion/recuperacion avanzada.
- [x] Crear flujo de login. Parcial: pantalla inicial creada.
- [x] Crear logout.
- [x] Proteger rutas privadas. Parcial: endpoints API y layout privado requieren usuario autenticado.
- [x] Crear layout autenticado.

Notas auth:

- Helpers Supabase creados en `lib/supabase/browser.ts` y `lib/supabase/server.ts`.
- Helper server/API creado en `server/auth/current-user.ts`.
- `UserProfile` se crea o actualiza automaticamente desde Supabase Auth.
- Si el usuario no tiene household activo, se crea un household individual inicial.
- Endpoints de categorias y transacciones validan membresia por `householdId`.
- UI inicial de login/register creada en `app/login`.
- Layout privado responsive creado con sidebar desktop y header movil.

## Fase 2 - Modelo de Datos Inicial

Estado: completada a nivel de modelo inicial. El schema Prisma, Prisma 7 config, migracion inicial y seed base estan definidos y ejecutados contra la base configurada.

- [x] Definir schema Prisma para usuarios y cuentas.
- [x] Definir schema Prisma para categorias.
- [x] Definir schema Prisma para transacciones.
- [x] Definir modelos iniciales para presupuestos, recurrentes, metas, deudas y snapshots mensuales.
- [x] Preparar estructura futura para inversiones.
- [x] Crear `prisma.config.ts` para Prisma 7.
- [x] Agregar scripts de base de datos en `package.json`.
- [x] Crear seed basico de categorias.
- [x] Crear migracion inicial.
- [x] Ejecutar seed contra la base real.

Notas de migracion:

- `.env.local` no existe, pero `.env` contiene `DATABASE_URL` y `DIRECT_URL`.
- Migracion detectada: `prisma/migrations/20260427031516_initial_finance_schema/migration.sql`.
- `npm run db:seed` ejecutado correctamente.

## Fase 3 - Transacciones y Categorias

Estado: parcialmente completada. Existen CRUD completos de categorias y transacciones con Zod, servicios, Prisma, autenticacion base y soft delete. Falta sumar reglas de negocio avanzadas.

- [x] Crear CRUD de categorias. Incluye listar, crear, editar, soft delete y categoria padre opcional.
- [x] Crear CRUD de transacciones. Incluye listar, crear, editar, soft delete y filtros.
- [x] Validar formularios con Zod.
- [ ] Usar React Hook Form.
- [x] Separar acciones server-side y componentes UI.

Notas backend:

- Cliente Prisma reutilizable creado en `lib/prisma.ts`.
- Servicios creados en `server/services`.
- Schemas Zod creados en `server/schemas`.
- Handlers creados en `app/api/categories/route.ts` y `app/api/transactions/route.ts`.
- UI de transacciones creada en `app/(private)/transactions`.
- Endpoints dinamicos creados en `app/api/transactions/[id]/route.ts` para `PATCH` y `DELETE`.
- UI de categorias creada en `app/(private)/categories`.
- Endpoints dinamicos creados en `app/api/categories/[id]/route.ts` para `PATCH` y `DELETE`.

## Fase 4 - Dashboard Financiero

Estado: parcialmente completada. Dashboard conectado a datos reales de transacciones y presupuestos del household actual; falta sumar metas y deudas al dinero disponible real.

- [x] Mostrar resumen de ingresos.
- [x] Mostrar resumen de gastos.
- [x] Mostrar dinero reservado. Parcial: presupuesto restante reservado.
- [ ] Mostrar deudas proximas. Pendiente: requiere modulo de deudas.
- [ ] Calcular dinero disponible real. Parcial: ingresos - gastos - presupuesto restante reservado.
- [x] Crear visualizaciones basicas con Recharts.

Notas UI:

- Componentes reutilizables creados: `AppShell`, `Sidebar`, `MobileHeader`, `StatCard`, `EmptyState`, `PageHeader`.
- Navegacion mobile-first agregada con bottom navigation fija para Dashboard, Transacciones, Presupuestos y Metas.
- Layout privado ajustado para evitar que el contenido quede tapado por la navegacion inferior.
- Pantallas placeholder profesionales creadas para transacciones, categorias, presupuestos, metas y deudas.
- Endpoint creado: `GET /api/dashboard/summary`.
- Servicio creado: `server/services/dashboard.ts`.
- Dashboard reemplaza mocks por transacciones reales, con loading, error y empty state.
- Dashboard calcula `presupuestoRestanteReservado` y `dineroDisponibleReal` considerando presupuestos mensuales.
- Dashboard prioriza en mobile dinero disponible real, gastos, ingresos y presupuesto reservado.

## Fase 5 - Presupuesto Mensual

Estado: parcialmente completada. CRUD visual y backend de presupuestos mensuales creado para el mes actual; falta integrarlo al cálculo avanzado de dinero disponible.

- [x] Crear presupuestos por categoria.
- [x] Comparar gasto real contra presupuesto.
- [ ] Marcar dinero reservado por presupuesto.
- [x] Mostrar alertas visuales de exceso.

Notas presupuestos:

- Endpoints creados: `GET /api/budgets`, `POST /api/budgets`, `PATCH /api/budgets/[id]`, `DELETE /api/budgets/[id]`.
- Servicios y schemas creados en `server/services/budgets.ts` y `server/schemas/budgets.ts`.
- UI creada en `app/(private)/budgets`.
- Cards mobile mejoradas con presupuestado, gastado, restante y porcentaje usado.
- El gasto real se calcula con transacciones `EXPENSE` del mes actual agrupadas por categoria.
- Alertas visuales: 80% o mas y 100% o mas.

## Fase 6 - Gastos Recurrentes

- [ ] Crear gastos recurrentes.
- [ ] Calcular pagos proximos.
- [ ] Incluir pagos proximos en dinero disponible real.
- [ ] Permitir activar o pausar recurrencias.

## Fase 7 - Metas Financieras

Estado: parcialmente completada. CRUD visual y backend de metas creado; falta conectar aportes como movimientos y sumar aportes obligatorios al dinero disponible real.

- [x] Crear metas de ahorro.
- [x] Definir monto objetivo.
- [ ] Registrar aportes.
- [ ] Incluir aportes obligatorios en dinero disponible real.

Notas metas:

- Endpoints creados: `GET /api/goals`, `POST /api/goals`, `PATCH /api/goals/[id]`, `DELETE /api/goals/[id]`.
- Servicios y schemas creados en `server/services/goals.ts` y `server/schemas/goals.ts`.
- UI creada en `app/(private)/goals`.
- Cards mobile mejoradas con progreso, monto actual, objetivo, fecha objetivo y estado.
- Las metas muestran progreso, objetivo, monto actual, fecha objetivo, aporte mensual y estado.
- Las metas todavia no afectan el calculo de dinero disponible real.

## Fase 8 - Deudas

- [ ] Crear deudas.
- [ ] Registrar pagos de deuda.
- [ ] Calcular deuda pendiente.
- [ ] Incluir pagos proximos de deuda en dinero disponible real.

## Fase 9 - Reportes Basicos

- [ ] Reporte mensual de ingresos y gastos.
- [ ] Reporte por categoria.
- [ ] Tendencia de gasto.
- [ ] Evolucion de metas.
- [ ] Resumen de deudas.

## Fase 10 - Preparacion para Inversiones

- [ ] Definir modelo futuro para activos de inversion.
- [ ] Reservar espacio de navegacion para inversiones.
- [ ] Documentar decisiones pendientes antes de implementar.
