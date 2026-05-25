import { prisma } from "@/lib/prisma";
import { NotFoundError } from "../api/errors";
import type { CreateContactInput, ListContactsInput, UpdateContactInput } from "../schemas/person-contacts";
import { assertHouseholdAccess } from "./households";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

function pickAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function serializeContact(c: Awaited<ReturnType<typeof prisma.personContact.findFirstOrThrow>>) {
  return {
    id: c.id,
    householdId: c.householdId,
    name: c.name,
    alias: c.alias,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    avatarColor: c.avatarColor,
    totalLentToThem: Number(c.totalLentToThem),
    totalBorrowedFromThem: Number(c.totalBorrowedFromThem),
    avgReturnDays: c.avgReturnDays,
    agreementCount: c.agreementCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function listContacts(userProfileId: string, input: ListContactsInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const contacts = await prisma.personContact.findMany({
    where: {
      householdId: input.householdId,
      deletedAt: null,
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { alias: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ agreementCount: "desc" }, { name: "asc" }],
  });

  return contacts.map(serializeContact);
}

export async function createContact(userProfileId: string, input: CreateContactInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const contact = await prisma.personContact.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      name: input.name,
      alias: input.alias ?? null,
      phone: input.phone ?? null,
      email: input.email || null,
      notes: input.notes ?? null,
      avatarColor: input.avatarColor ?? pickAvatarColor(input.name),
    },
  });

  return serializeContact(contact);
}

export async function updateContact(userProfileId: string, input: UpdateContactInput) {
  const contact = await prisma.personContact.findFirst({
    where: { id: input.contactId, deletedAt: null },
  });
  if (!contact) throw new NotFoundError("Contacto no encontrado");
  await assertHouseholdAccess(userProfileId, contact.householdId);

  const updated = await prisma.personContact.update({
    where: { id: input.contactId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.alias !== undefined && { alias: input.alias }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  return serializeContact(updated);
}

export async function deleteContact(userProfileId: string, contactId: string) {
  const contact = await prisma.personContact.findFirst({
    where: { id: contactId, deletedAt: null },
  });
  if (!contact) throw new NotFoundError("Contacto no encontrado");
  await assertHouseholdAccess(userProfileId, contact.householdId);

  await prisma.personContact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  });
}
