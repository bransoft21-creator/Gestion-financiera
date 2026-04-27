import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CategoryType, CurrencyCode } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL for Prisma seed.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SYSTEM_USER = {
  supabaseId: "system-seed-user",
  email: "system@finance-control.local",
  fullName: "Finance Control System",
};

const SYSTEM_HOUSEHOLD_NAME = "Finance Control Base";

const baseCategories = [
  { name: "Salario", type: CategoryType.INCOME, color: "#16a34a", icon: "briefcase" },
  { name: "Extra", type: CategoryType.INCOME, color: "#22c55e", icon: "plus-circle" },
  { name: "Reembolso", type: CategoryType.INCOME, color: "#10b981", icon: "rotate-ccw" },

  { name: "Alquiler", type: CategoryType.EXPENSE, color: "#ef4444", icon: "home" },
  { name: "Comida", type: CategoryType.EXPENSE, color: "#f97316", icon: "utensils" },
  { name: "Transporte", type: CategoryType.EXPENSE, color: "#eab308", icon: "car" },
  { name: "Servicios", type: CategoryType.EXPENSE, color: "#06b6d4", icon: "receipt" },
  { name: "Salud", type: CategoryType.EXPENSE, color: "#ec4899", icon: "heart-pulse" },
  { name: "Ocio", type: CategoryType.EXPENSE, color: "#8b5cf6", icon: "gamepad-2" },
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
];

async function main() {
  const systemUser = await prisma.userProfile.upsert({
    where: { supabaseId: SYSTEM_USER.supabaseId },
    update: SYSTEM_USER,
    create: {
      ...SYSTEM_USER,
      currency: CurrencyCode.ARS,
    },
  });

  const existingHousehold = await prisma.household.findFirst({
    where: {
      name: SYSTEM_HOUSEHOLD_NAME,
      createdById: systemUser.id,
    },
  });

  const household =
    existingHousehold ??
    (await prisma.household.create({
      data: {
        name: SYSTEM_HOUSEHOLD_NAME,
        defaultCurrency: CurrencyCode.ARS,
        createdById: systemUser.id,
        members: {
          create: {
            userProfileId: systemUser.id,
            role: "OWNER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        },
      },
    }));

  for (const category of baseCategories) {
    await prisma.category.upsert({
      where: {
        householdId_name_type: {
          householdId: household.id,
          name: category.name,
          type: category.type,
        },
      },
      update: {
        color: category.color,
        icon: category.icon,
        isSystem: true,
        isArchived: false,
        deletedAt: null,
      },
      create: {
        householdId: household.id,
        createdById: systemUser.id,
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        isSystem: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
