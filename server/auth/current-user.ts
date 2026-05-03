import { AccountType, CategoryType, CurrencyCode, HouseholdRole, HouseholdMemberStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { UnauthorizedError } from "../api/errors";

const DEFAULT_ACCOUNTS = [
  { name: "Efectivo", type: AccountType.CASH, currency: CurrencyCode.ARS },
  { name: "Cuenta bancaria", type: AccountType.BANK, currency: CurrencyCode.ARS },
  { name: "Mercado Pago", type: AccountType.DIGITAL_WALLET, currency: CurrencyCode.ARS },
  { name: "Tarjeta de crédito", type: AccountType.CREDIT_CARD, currency: CurrencyCode.ARS },
  { name: "Caja de ahorro USD", type: AccountType.SAVINGS, currency: CurrencyCode.USD },
] as const;

const DEFAULT_CATEGORIES = [
  { name: "Salario", type: CategoryType.INCOME, color: "#16a34a", icon: "briefcase" },
  { name: "Extra", type: CategoryType.INCOME, color: "#22c55e", icon: "plus-circle" },
  { name: "Reembolso", type: CategoryType.INCOME, color: "#10b981", icon: "rotate-ccw" },
  { name: "Alquiler / Hipoteca", type: CategoryType.EXPENSE, color: "#ef4444", icon: "home" },
  { name: "Supermercado", type: CategoryType.EXPENSE, color: "#f97316", icon: "shopping-cart" },
  { name: "Restaurante / Delivery", type: CategoryType.EXPENSE, color: "#fb923c", icon: "utensils" },
  { name: "Transporte público", type: CategoryType.EXPENSE, color: "#eab308", icon: "bus" },
  { name: "Combustible", type: CategoryType.EXPENSE, color: "#ca8a04", icon: "fuel" },
  { name: "Servicios (luz, gas, agua)", type: CategoryType.EXPENSE, color: "#06b6d4", icon: "receipt" },
  { name: "Internet / Telefonía", type: CategoryType.EXPENSE, color: "#0891b2", icon: "wifi" },
  { name: "Salud / Farmacia", type: CategoryType.EXPENSE, color: "#ec4899", icon: "heart-pulse" },
  { name: "Indumentaria", type: CategoryType.EXPENSE, color: "#a855f7", icon: "shirt" },
  { name: "Ocio y entretenimiento", type: CategoryType.EXPENSE, color: "#8b5cf6", icon: "gamepad-2" },
  { name: "Suscripciones", type: CategoryType.EXPENSE, color: "#6366f1", icon: "repeat" },
  { name: "Educación", type: CategoryType.EXPENSE, color: "#0ea5e9", icon: "graduation-cap" },
  { name: "Mascotas", type: CategoryType.EXPENSE, color: "#84cc16", icon: "paw-print" },
  { name: "Imprevistos", type: CategoryType.EXPENSE, color: "#64748b", icon: "alert-triangle" },
  { name: "Fondo de emergencia", type: CategoryType.GOAL, color: "#14b8a6", icon: "shield" },
  { name: "Meta personal", type: CategoryType.GOAL, color: "#a855f7", icon: "target" },
  { name: "Tarjeta de crédito", type: CategoryType.DEBT, color: "#dc2626", icon: "credit-card" },
  { name: "Préstamo", type: CategoryType.DEBT, color: "#b91c1c", icon: "landmark" },
  { name: "Cripto", type: CategoryType.INVESTMENT, color: "#f59e0b", icon: "coins" },
  { name: "Acciones", type: CategoryType.INVESTMENT, color: "#2563eb", icon: "chart-candlestick" },
  { name: "Fondo común", type: CategoryType.INVESTMENT, color: "#059669", icon: "line-chart" },
] as const;

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new UnauthorizedError();
  }

  const fullName = getFullName(user.user_metadata);
  const avatarUrl = getAvatarUrl(user.user_metadata);

  let userProfile = await prisma.userProfile.findUnique({
    where: { supabaseId: user.id },
  });

  if (!userProfile) {
    userProfile = await prisma.userProfile.create({
      data: {
        supabaseId: user.id,
        email: user.email,
        fullName,
        avatarUrl,
        currency: CurrencyCode.ARS,
      },
    });
  } else if (
    userProfile.email !== user.email ||
    userProfile.fullName !== fullName ||
    userProfile.avatarUrl !== avatarUrl ||
    userProfile.deletedAt !== null
  ) {
    userProfile = await prisma.userProfile.update({
      where: { supabaseId: user.id },
      data: { email: user.email, fullName, avatarUrl, deletedAt: null },
    });
  }

  const activeMembership = await prisma.householdMember.findFirst({
    where: {
      userProfileId: userProfile.id,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
      household: {
        deletedAt: null,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!activeMembership) {
    await prisma.household.create({
      data: {
        name: "Mi hogar",
        defaultCurrency: userProfile.currency,
        createdById: userProfile.id,
        members: {
          create: {
            userProfileId: userProfile.id,
            role: HouseholdRole.OWNER,
            status: HouseholdMemberStatus.ACTIVE,
            joinedAt: new Date(),
          },
        },
        accounts: {
          create: DEFAULT_ACCOUNTS.map((a) => ({
            createdById: userProfile.id,
            name: a.name,
            type: a.type,
            currency: a.currency,
            openingBalance: 0,
            currentBalance: 0,
          })),
        },
        categories: {
          create: DEFAULT_CATEGORIES.map((c) => ({
            createdById: userProfile.id,
            name: c.name,
            type: c.type,
            color: c.color,
            icon: c.icon,
            isSystem: true,
          })),
        },
      },
    });
  }

  return {
    supabaseUser: user,
    userProfile,
  };
}

function getFullName(metadata: Record<string, unknown> | null | undefined) {
  return getStringMetadata(metadata, "full_name") ?? getStringMetadata(metadata, "name");
}

function getAvatarUrl(metadata: Record<string, unknown> | null | undefined) {
  return getStringMetadata(metadata, "avatar_url") ?? getStringMetadata(metadata, "picture");
}

function getStringMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
