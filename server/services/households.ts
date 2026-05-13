import { createHash, randomBytes, timingSafeEqual } from "crypto";
import {
  HouseholdInviteStatus,
  HouseholdKind,
  HouseholdMemberStatus,
  HouseholdRole,
  SharedParticipantStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, ForbiddenError, NotFoundError } from "../api/errors";

export async function assertHouseholdAccess(userProfileId: string, householdId: string) {
  const membership = await prisma.householdMember.findFirst({
    where: {
      householdId,
      userProfileId,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
      household: {
        deletedAt: null,
      },
    },
  });

  if (!membership) {
    throw new ForbiddenError();
  }

  return membership;
}

export async function assertCollaborativeHouseholdAccess(userProfileId: string, householdId: string) {
  const membership = await assertHouseholdAccess(userProfileId, householdId);

  const household = await prisma.household.findFirst({
    where: { id: householdId, kind: HouseholdKind.HOUSEHOLD, deletedAt: null },
    select: { id: true },
  });

  if (!household) {
    throw new ForbiddenError();
  }

  return membership;
}

export async function listHouseholds(userProfileId: string) {
  return prisma.household.findMany({
    where: {
      kind: HouseholdKind.HOUSEHOLD,
      deletedAt: null,
      members: {
        some: {
          userProfileId,
          status: HouseholdMemberStatus.ACTIVE,
          deletedAt: null,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      members: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          status: true,
          joinedAt: true,
          userProfileId: true,
          userProfile: { select: { fullName: true, email: true, avatarUrl: true } },
        },
      },
      invites: {
        where: { status: HouseholdInviteStatus.PENDING },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, expiresAt: true, status: true },
      },
    },
  });
}

export async function createHousehold(
  userProfileId: string,
  input: { name: string; avatar?: string | null },
) {
  return prisma.household.create({
    data: {
      name: input.name,
      avatar: input.avatar || null,
      kind: HouseholdKind.HOUSEHOLD,
      createdById: userProfileId,
      members: {
        create: {
          userProfileId,
          role: HouseholdRole.OWNER,
          status: HouseholdMemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      },
    },
    include: {
      members: {
        include: { userProfile: { select: { fullName: true, email: true, avatarUrl: true } } },
      },
      invites: true,
    },
  });
}

export async function createHouseholdInvite(
  userProfileId: string,
  input: { householdId: string; email: string; baseUrl: string },
) {
  const membership = await assertCollaborativeHouseholdAccess(userProfileId, input.householdId);

  if (membership.role !== HouseholdRole.OWNER) {
    throw new ForbiddenError("Solo el owner puede invitar miembros.");
  }

  const email = input.email.trim().toLowerCase();
  const existingMember = await prisma.householdMember.findFirst({
    where: {
      householdId: input.householdId,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
      userProfile: { email },
    },
    select: { id: true },
  });

  if (existingMember) {
    throw new ApiError(409, "Ese email ya forma parte del hogar.");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.householdInvite.updateMany({
    where: {
      householdId: input.householdId,
      email,
      status: HouseholdInviteStatus.PENDING,
    },
    data: { status: HouseholdInviteStatus.REVOKED },
  });

  const invite = await prisma.householdInvite.create({
    data: {
      householdId: input.householdId,
      email,
      tokenHash,
      expiresAt,
      invitedById: userProfileId,
    },
    select: { id: true, email: true, expiresAt: true, status: true },
  });

  return {
    invite,
    inviteUrl: `${input.baseUrl.replace(/\/$/, "")}/invite/${token}`,
  };
}

export async function getInvitePreview(token: string) {
  const invite = await findInviteByToken(token);

  return {
    id: invite.id,
    email: invite.email,
    expiresAt: invite.expiresAt,
    status: getEffectiveInviteStatus(invite),
    household: {
      id: invite.household.id,
      name: invite.household.name,
      avatar: invite.household.avatar,
    },
    invitedBy: {
      fullName: invite.invitedBy.fullName,
      email: invite.invitedBy.email,
    },
  };
}

export async function acceptHouseholdInvite(userProfileId: string, token: string) {
  const invite = await findInviteByToken(token);
  const now = new Date();

  if (invite.status !== HouseholdInviteStatus.PENDING) {
    throw new ApiError(409, "Esta invitación ya fue usada o revocada.");
  }

  if (invite.expiresAt <= now) {
    await prisma.householdInvite.update({
      where: { id: invite.id },
      data: { status: HouseholdInviteStatus.EXPIRED },
    });
    throw new ApiError(410, "Esta invitación venció.");
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: userProfileId },
    select: { email: true },
  });

  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new ForbiddenError("Esta invitación pertenece a otro email.");
  }

  return prisma.$transaction(async (tx) => {
    const freshInvite = await tx.householdInvite.findUnique({
      where: { id: invite.id },
      select: { status: true },
    });

    if (!freshInvite || freshInvite.status !== HouseholdInviteStatus.PENDING) {
      throw new ApiError(409, "Esta invitación ya fue usada.");
    }

    const member = await tx.householdMember.upsert({
      where: {
        householdId_userProfileId: {
          householdId: invite.householdId,
          userProfileId,
        },
      },
      update: {
        status: HouseholdMemberStatus.ACTIVE,
        role: HouseholdRole.MEMBER,
        joinedAt: now,
        deletedAt: null,
      },
      create: {
        householdId: invite.householdId,
        userProfileId,
        role: HouseholdRole.MEMBER,
        status: HouseholdMemberStatus.ACTIVE,
        joinedAt: now,
      },
    });

    await tx.householdInvite.update({
      where: { id: invite.id },
      data: { status: HouseholdInviteStatus.ACCEPTED, acceptedAt: now },
    });

    return member;
  });
}

export async function getHouseholdBalance(userProfileId: string, householdId: string) {
  await assertCollaborativeHouseholdAccess(userProfileId, householdId);

  const household = await prisma.household.findFirst({
    where: { id: householdId, kind: HouseholdKind.HOUSEHOLD, deletedAt: null },
    select: {
      id: true,
      name: true,
      avatar: true,
      members: {
        where: { status: HouseholdMemberStatus.ACTIVE, deletedAt: null },
        select: {
          userProfileId: true,
          userProfile: { select: { fullName: true, email: true, avatarUrl: true } },
        },
      },
      sharedTransactions: {
        where: {
          transaction: { deletedAt: null, status: { not: "CANCELED" } },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          paidByUserId: true,
          createdAt: true,
          transaction: {
            select: {
              id: true,
              amount: true,
              currency: true,
              description: true,
              occurredAt: true,
            },
          },
          paidBy: { select: { fullName: true, email: true } },
          participants: {
            where: { status: SharedParticipantStatus.OPEN },
            select: {
              userId: true,
              amount: true,
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!household) throw new NotFoundError("Household not found");

  const memberBalances = calculateHouseholdMemberBalances({
    members: household.members.map((member) => ({
      userId: member.userProfileId,
      name: member.userProfile.fullName ?? member.userProfile.email,
      email: member.userProfile.email,
      avatarUrl: member.userProfile.avatarUrl,
    })),
    sharedTransactions: household.sharedTransactions.map((shared) => ({
      paidByUserId: shared.paidByUserId,
      amount: Number(shared.transaction.amount),
      participants: shared.participants.map((participant) => ({
        userId: participant.userId,
        amount: Number(participant.amount),
      })),
    })),
  });

  const settlement = calculateHouseholdSettlement(memberBalances);

  return {
    household: {
      id: household.id,
      name: household.name,
      avatar: household.avatar,
    },
    members: memberBalances,
    settlement,
    summary: buildHouseholdSummary(memberBalances, settlement),
    recentSharedTransactions: household.sharedTransactions.map((shared) => ({
      id: shared.id,
      transactionId: shared.transaction.id,
      description: shared.transaction.description,
      amount: Number(shared.transaction.amount),
      currency: shared.transaction.currency,
      occurredAt: shared.transaction.occurredAt,
      paidByName: shared.paidBy.fullName ?? shared.paidBy.email,
      participantCount: shared.participants.length,
    })),
  };
}

export function calculateHouseholdMemberBalances(input: {
  members: Array<{ userId: string; name: string; email: string; avatarUrl?: string | null }>;
  sharedTransactions: Array<{
    paidByUserId: string;
    amount: number;
    participants: Array<{ userId: string; amount: number }>;
  }>;
}) {
  const balances = new Map<string, number>();
  input.members.forEach((member) => balances.set(member.userId, 0));

  input.sharedTransactions.forEach((shared) => {
    balances.set(shared.paidByUserId, (balances.get(shared.paidByUserId) ?? 0) + shared.amount);
    shared.participants.forEach((participant) => {
      balances.set(participant.userId, (balances.get(participant.userId) ?? 0) - participant.amount);
    });
  });

  return input.members.map((member) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
    avatarUrl: member.avatarUrl ?? null,
    balance: roundMoney(balances.get(member.userId) ?? 0),
  }));
}

export function calculateHouseholdSettlement(
  memberBalances: Array<{ userId: string; name: string; balance: number }>,
) {
  const debtor = [...memberBalances].sort((a, b) => a.balance - b.balance)[0];
  const creditor = [...memberBalances].sort((a, b) => b.balance - a.balance)[0];

  return debtor && creditor && debtor.userId !== creditor.userId && debtor.balance < 0 && creditor.balance > 0
    ? {
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount: roundMoney(Math.min(Math.abs(debtor.balance), creditor.balance)),
      }
    : null;
}

export function buildHouseholdSummary(
  members: Array<{ name: string; balance: number }>,
  settlement: { fromName: string; toName: string; amount: number } | null,
) {
  if (!members.length) return "El hogar está listo para empezar.";
  if (!settlement) return "El hogar viene estable.";

  const creditor = [...members].sort((a, b) => b.balance - a.balance)[0];
  const lead = creditor?.balance > 0 ? `${creditor.name} cubrió más gastos este mes.` : "El hogar viene estable.";

  return `${lead} ${settlement.fromName} debe ${formatArs(settlement.amount)}.`;
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function findInviteByToken(token: string) {
  if (!token || token.length < 24) {
    throw new NotFoundError("Invitación no encontrada.");
  }

  const tokenHash = hashInviteToken(token);
  const invite = await prisma.householdInvite.findUnique({
    where: { tokenHash },
    include: {
      household: true,
      invitedBy: { select: { fullName: true, email: true } },
    },
  });

  if (!invite || !constantTimeEqual(invite.tokenHash, tokenHash) || invite.household.kind !== HouseholdKind.HOUSEHOLD) {
    throw new NotFoundError("Invitación no encontrada.");
  }

  return invite;
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getEffectiveInviteStatus(invite: { status: HouseholdInviteStatus; expiresAt: Date }) {
  if (invite.status === HouseholdInviteStatus.PENDING && invite.expiresAt <= new Date()) {
    return HouseholdInviteStatus.EXPIRED;
  }

  return invite.status;
}

function formatArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
