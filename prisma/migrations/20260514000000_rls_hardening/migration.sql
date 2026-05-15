-- ============================================================
-- RLS Hardening — Meridian
-- Habilita Row Level Security en todas las tablas de datos.
--
-- ARQUITECTURA DE CONEXIÓN (crítico):
-- Prisma conecta vía DATABASE_URL con usuario 'postgres'
-- (pgbouncer=true). El rol 'postgres' es superusuario y
-- BYPASSA RLS automáticamente. Todas las queries existentes
-- de Prisma server-side continúan sin cambios.
--
-- Estas policies protegen el acceso directo vía:
-- - Supabase JS client con anon key
-- - Supabase JS client con authenticated JWT
-- - Supabase Studio (rol authenticated)
-- - Cualquier query directa que no use el rol postgres
--
-- MAPPING DE IDENTIDAD:
-- auth.uid()         → UUID del usuario en Supabase Auth
-- UserProfile.supabaseId → ese mismo UUID (stored as TEXT)
-- UserProfile.id     → CUID interno usado en todas las FK
--
-- Las policies usan funciones SECURITY DEFINER para resolver
-- el CUID interno sin recursión ni permisos especiales.
-- ============================================================

-- ── 0. HELPER FUNCTIONS ──────────────────────────────────────────────────────
-- SECURITY DEFINER: corre como el definidor (postgres) para leer
-- UserProfile incluso cuando esa tabla tiene RLS habilitado.
-- SET search_path = public: evita ataques de search_path injection.

CREATE OR REPLACE FUNCTION meridian_current_user_profile_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM "UserProfile"
  WHERE "supabaseId" = auth.uid()::text
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION meridian_current_user_profile_id() TO authenticated;

-- Retorna el SET de householdIds donde el usuario es miembro ACTIVE.
CREATE OR REPLACE FUNCTION meridian_user_household_ids()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "householdId"
  FROM "HouseholdMember"
  WHERE "userProfileId" = meridian_current_user_profile_id()
    AND status::text = 'ACTIVE'
    AND "deletedAt" IS NULL
$$;

GRANT EXECUTE ON FUNCTION meridian_user_household_ids() TO authenticated;


-- ── 1. UserProfile ───────────────────────────────────────────────────────────
-- Acceso: solo el propio perfil.
-- supabaseId es el campo que mapea con auth.uid().

ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "up_select_own"
  ON "UserProfile" FOR SELECT TO authenticated
  USING ("supabaseId" = auth.uid()::text);

CREATE POLICY "up_update_own"
  ON "UserProfile" FOR UPDATE TO authenticated
  USING ("supabaseId" = auth.uid()::text)
  WITH CHECK ("supabaseId" = auth.uid()::text);

-- INSERT/DELETE: solo server-side (Prisma). No policy = deny para clientes.


-- ── 2. Household ─────────────────────────────────────────────────────────────
-- Acceso: usuario es miembro ACTIVE del household.

ALTER TABLE "Household" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_select_member"
  ON "Household" FOR SELECT TO authenticated
  USING (id IN (SELECT meridian_user_household_ids()));

-- INSERT/UPDATE/DELETE: solo server-side (Prisma/API routes).


-- ── 3. HouseholdMember ───────────────────────────────────────────────────────
-- Acceso: miembros de ese household pueden ver la lista de miembros.

ALTER TABLE "HouseholdMember" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hm_select_same_household"
  ON "HouseholdMember" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));

-- INSERT/UPDATE/DELETE: solo server-side.


-- ── 4. HouseholdInvite ───────────────────────────────────────────────────────
-- Acceso:
-- (a) Miembros del household pueden ver sus invitaciones pendientes.
-- (b) El invitado puede ver su propia invitación (por email).
-- El token lookup en /invite/[token] ocurre vía Prisma (bypassa RLS).

ALTER TABLE "HouseholdInvite" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hi_select_member_or_invitee"
  ON "HouseholdInvite" FOR SELECT TO authenticated
  USING (
    "householdId" IN (SELECT meridian_user_household_ids())
    OR
    email = (
      SELECT email FROM "UserProfile"
      WHERE "supabaseId" = auth.uid()::text
      LIMIT 1
    )
  );

-- INSERT/UPDATE: solo server-side.


-- ── 5. Account ───────────────────────────────────────────────────────────────
-- Datos financieros sensibles. Solo miembros del household.

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_household_member"
  ON "Account" FOR ALL TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()))
  WITH CHECK ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 6. Category ──────────────────────────────────────────────────────────────

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_household_member"
  ON "Category" FOR ALL TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()))
  WITH CHECK ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 7. Transaction ───────────────────────────────────────────────────────────
-- Datos financieros sensibles. Solo miembros del household.

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_household_member"
  ON "Transaction" FOR ALL TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()))
  WITH CHECK ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 8. SharedTransaction ─────────────────────────────────────────────────────

ALTER TABLE "SharedTransaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_tx_household_member"
  ON "SharedTransaction" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));

-- INSERT/UPDATE: solo server-side.


-- ── 9. SharedTransactionParticipant ──────────────────────────────────────────
-- Acceso: el usuario es participante O es miembro del household de la tx compartida.

ALTER TABLE "SharedTransactionParticipant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_tx_participant_select"
  ON "SharedTransactionParticipant" FOR SELECT TO authenticated
  USING (
    "userId" = meridian_current_user_profile_id()
    OR EXISTS (
      SELECT 1 FROM "SharedTransaction" st
      WHERE st.id = "SharedTransactionParticipant"."sharedTransactionId"
        AND st."householdId" IN (SELECT meridian_user_household_ids())
    )
  );

-- INSERT/UPDATE: solo server-side.


-- ── 10. Budget ───────────────────────────────────────────────────────────────

ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_household_member"
  ON "Budget" FOR ALL TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()))
  WITH CHECK ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 11. RecurringExpense ─────────────────────────────────────────────────────

ALTER TABLE "RecurringExpense" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_expense_household_member"
  ON "RecurringExpense" FOR ALL TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()))
  WITH CHECK ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 12. Goal ─────────────────────────────────────────────────────────────────

ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_household_member"
  ON "Goal" FOR ALL TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()))
  WITH CHECK ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 13. Debt ─────────────────────────────────────────────────────────────────

ALTER TABLE "Debt" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debt_household_member"
  ON "Debt" FOR ALL TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()))
  WITH CHECK ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 14. MonthlySnapshot ──────────────────────────────────────────────────────
-- Solo lectura para el cliente. Escritura exclusivamente server-side.

ALTER TABLE "MonthlySnapshot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshot_household_member"
  ON "MonthlySnapshot" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 15. AiFinancialAnalysis ──────────────────────────────────────────────────
-- Datos de análisis IA. Solo el propio usuario.

ALTER TABLE "AiFinancialAnalysis" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_analysis_own"
  ON "AiFinancialAnalysis" FOR SELECT TO authenticated
  USING ("userId" = meridian_current_user_profile_id());

-- INSERT/UPDATE: solo server-side.


-- ── 16. AiUsage ──────────────────────────────────────────────────────────────
-- Métricas de uso IA. Solo el propio usuario.

ALTER TABLE "AiUsage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_own"
  ON "AiUsage" FOR SELECT TO authenticated
  USING ("userId" = meridian_current_user_profile_id());

-- INSERT: solo server-side.


-- ── 17. SmartImportCache ─────────────────────────────────────────────────────
-- Cache de resultados de IA para el household.

ALTER TABLE "SmartImportCache" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_import_cache_household_member"
  ON "SmartImportCache" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));

-- INSERT/UPDATE: solo server-side.


-- ── 18. ActivityItem ─────────────────────────────────────────────────────────
-- Actividad y notificaciones. Solo el propio usuario.

ALTER TABLE "ActivityItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_item_own_select"
  ON "ActivityItem" FOR SELECT TO authenticated
  USING ("userId" = meridian_current_user_profile_id());

CREATE POLICY "activity_item_own_update"
  ON "ActivityItem" FOR UPDATE TO authenticated
  USING ("userId" = meridian_current_user_profile_id())
  WITH CHECK ("userId" = meridian_current_user_profile_id());

-- INSERT: solo server-side.


-- ── 19. HouseholdSettlement ──────────────────────────────────────────────────

ALTER TABLE "HouseholdSettlement" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlement_household_member"
  ON "HouseholdSettlement" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));

-- INSERT: solo server-side.


-- ── 20. HouseholdRecurringPayment ────────────────────────────────────────────

ALTER TABLE "HouseholdRecurringPayment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hrp_household_member"
  ON "HouseholdRecurringPayment" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));

-- INSERT/UPDATE/DELETE: solo server-side.


-- ── 21. HouseholdRecurringPaymentParticipant ─────────────────────────────────
-- Acceso: el usuario es participante O es miembro del household del payment.

ALTER TABLE "HouseholdRecurringPaymentParticipant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hrp_participant_select"
  ON "HouseholdRecurringPaymentParticipant" FOR SELECT TO authenticated
  USING (
    "userId" = meridian_current_user_profile_id()
    OR EXISTS (
      SELECT 1 FROM "HouseholdRecurringPayment" hrp
      WHERE hrp.id = "HouseholdRecurringPaymentParticipant"."recurringPaymentId"
        AND hrp."householdId" IN (SELECT meridian_user_household_ids())
    )
  );

-- INSERT/UPDATE/DELETE: solo server-side.


-- ── 22. HouseholdRecurringPaymentOccurrence ──────────────────────────────────

ALTER TABLE "HouseholdRecurringPaymentOccurrence" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hrp_occurrence_select"
  ON "HouseholdRecurringPaymentOccurrence" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "HouseholdRecurringPayment" hrp
      WHERE hrp.id = "HouseholdRecurringPaymentOccurrence"."recurringPaymentId"
        AND hrp."householdId" IN (SELECT meridian_user_household_ids())
    )
  );

-- INSERT/UPDATE: solo server-side.


-- ── 23. Investment tables (no activas — schema reservado) ────────────────────
-- Locked-down: solo lectura para miembros del household.
-- No hay features activas que expongan estas tablas al cliente.

ALTER TABLE "InvestmentAccount" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_account_household_member"
  ON "InvestmentAccount" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));

ALTER TABLE "InvestmentAsset" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_asset_household_member"
  ON "InvestmentAsset" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));

ALTER TABLE "InvestmentTransaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_tx_household_member"
  ON "InvestmentTransaction" FOR SELECT TO authenticated
  USING ("householdId" IN (SELECT meridian_user_household_ids()));


-- ── 24. _prisma_migrations ───────────────────────────────────────────────────
-- Tabla interna de Prisma. Solo accesible por el rol postgres (server).
-- Ningún cliente debería ver el estado de migraciones.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Sin policies = deny total para anon/authenticated.
-- El rol postgres bypassa RLS: prisma migrate continúa funcionando.
