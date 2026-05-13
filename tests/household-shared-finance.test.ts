import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CurrencyCode } from "@prisma/client";
import {
  buildHouseholdSummary,
  calculateHouseholdBriefing,
  calculateHouseholdMemberBalances,
  calculateHouseholdSettlement,
  hashInviteToken,
} from "../server/services/households";
import { createHouseholdInviteSchema } from "../server/schemas/households";
import { createTransactionSchema } from "../server/schemas/transactions";

describe("household shared finance", () => {
  it("hashes invite tokens instead of storing the raw token", () => {
    const token = "a".repeat(43);
    const hash = hashInviteToken(token);

    assert.equal(hash.length, 64);
    assert.notEqual(hash, token);
    assert.equal(hashInviteToken(token), hash);
  });

  it("normalizes invite email casing before persistence", () => {
    const parsed = createHouseholdInviteSchema.parse({
      householdId: "household-1",
      email: " Persona@Example.COM ",
    });

    assert.equal(parsed.email, "persona@example.com");
  });

  it("only allows shared household id for expense creation", () => {
    const base = {
      householdId: "personal-household",
      accountId: "account-1",
      amount: "1000",
      occurredAt: "2026-05-13",
      description: "Test",
      sharedHouseholdId: "shared-household",
      clientRequestId: "client-request-123456",
    };

    assert.equal(createTransactionSchema.safeParse({ ...base, type: "EXPENSE" }).success, true);
    assert.equal(createTransactionSchema.safeParse({ ...base, type: "INCOME" }).success, false);
  });

  it("computes a simple 50/50 settlement with human wording", () => {
    const balances = calculateHouseholdMemberBalances({
      members: [
        { userId: "user-1", name: "Ana", email: "ana@example.com" },
        { userId: "user-2", name: "Beto", email: "beto@example.com" },
      ],
      sharedTransactions: [
        {
          paidByUserId: "user-1",
          amount: 24000,
          participants: [
            { userId: "user-1", amount: 12000 },
            { userId: "user-2", amount: 12000 },
          ],
        },
      ],
    });

    assert.deepEqual(
      balances.map((member) => ({ userId: member.userId, balance: member.balance })),
      [
        { userId: "user-1", balance: 12000 },
        { userId: "user-2", balance: -12000 },
      ],
    );

    const settlement = calculateHouseholdSettlement(balances);
    assert.deepEqual(settlement, {
      fromUserId: "user-2",
      fromName: "Beto",
      toUserId: "user-1",
      toName: "Ana",
      amount: 12000,
    });
    const summary = buildHouseholdSummary(balances, settlement);
    assert.match(summary, /Ana cubrió más gastos este mes\./);
    assert.match(summary, /Beto debe/);
  });

  it("returns a calm stable message when balances are even", () => {
    const balances = calculateHouseholdMemberBalances({
      members: [
        { userId: "a", name: "A", email: "a@example.com" },
        { userId: "b", name: "B", email: "b@example.com" },
      ],
      sharedTransactions: [],
    });

    const settlement = calculateHouseholdSettlement(balances);

    assert.equal(settlement, null);
    assert.equal(buildHouseholdSummary(balances, settlement), "El hogar viene estable.");
  });

  it("builds a low-activity briefing for empty monthly shared spending", () => {
    const briefing = calculateHouseholdBriefing({
      household: { id: "home", name: "Casa" },
      period: { month: 5, year: 2026, from: new Date("2026-05-01"), to: new Date("2026-06-01") },
      members: [
        { userId: "a", name: "A", email: "a@example.com" },
        { userId: "b", name: "B", email: "b@example.com" },
      ],
      sharedTransactions: [],
    });

    assert.equal(briefing.status, "LOW_ACTIVITY");
    assert.equal(briefing.metrics.totalSharedAmount, 0);
    assert.equal(briefing.metrics.transactionCount, 0);
    assert.equal(briefing.summary, "Todavía no hay suficientes movimientos compartidos.");
    assert.deepEqual(briefing.topCategories, []);
  });

  it("builds monthly briefing metrics, top payer and top categories", () => {
    const briefing = calculateHouseholdBriefing({
      household: { id: "home", name: "Casa" },
      period: { month: 5, year: 2026, from: new Date("2026-05-01"), to: new Date("2026-06-01") },
      members: [
        { userId: "user-1", name: "Ana", email: "ana@example.com" },
        { userId: "user-2", name: "Beto", email: "beto@example.com" },
      ],
      sharedTransactions: [
        {
          id: "shared-1",
          paidByUserId: "user-1",
          paidByName: "Ana",
          amount: 30000,
          currency: CurrencyCode.ARS,
          description: "Super",
          occurredAt: new Date("2026-05-10"),
          category: { id: "food", name: "Supermercado", color: "#22c55e" },
          participants: [
            { userId: "user-1", amount: 15000 },
            { userId: "user-2", amount: 15000 },
          ],
        },
        {
          id: "shared-2",
          paidByUserId: "user-1",
          paidByName: "Ana",
          amount: 10000,
          currency: CurrencyCode.ARS,
          description: "Internet",
          occurredAt: new Date("2026-05-12"),
          category: { id: "services", name: "Servicios", color: "#38bdf8" },
          participants: [
            { userId: "user-1", amount: 5000 },
            { userId: "user-2", amount: 5000 },
          ],
        },
      ],
    });

    assert.equal(briefing.status, "NEEDS_BALANCE");
    assert.equal(briefing.metrics.totalSharedAmount, 40000);
    assert.equal(briefing.metrics.transactionCount, 2);
    assert.equal(briefing.metrics.topPayer?.name, "Ana");
    assert.equal(briefing.metrics.pendingAmount, 20000);
    assert.equal(briefing.topCategories[0].name, "Supermercado");
    assert.match(briefing.summary, /Ana cubrió más gastos compartidos/);
  });

  it("balance after settlement only counts post-cutoff transactions", () => {
    const members = [
      { userId: "user-1", name: "Ana", email: "ana@example.com" },
      { userId: "user-2", name: "Beto", email: "beto@example.com" },
    ];

    // Pre-settlement: Ana paid ARS 24.000 (split 50/50)
    const preSettlement = [
      {
        paidByUserId: "user-1",
        amount: 24000,
        participants: [
          { userId: "user-1", amount: 12000 },
          { userId: "user-2", amount: 12000 },
        ],
      },
    ];

    // Post-settlement: Ana paid ARS 10.000 (split 50/50)
    const postSettlement = [
      {
        paidByUserId: "user-1",
        amount: 10000,
        participants: [
          { userId: "user-1", amount: 5000 },
          { userId: "user-2", amount: 5000 },
        ],
      },
    ];

    // Without cutoff: both pre and post count — Beto owes ARS 17.000
    const balanceAll = calculateHouseholdMemberBalances({
      members,
      sharedTransactions: [...preSettlement, ...postSettlement],
    });
    assert.equal(balanceAll.find((m) => m.userId === "user-2")?.balance, -17000);

    // With cutoff applied (DB filters to post-settlement only): Beto owes ARS 5.000
    const balancePostCutoff = calculateHouseholdMemberBalances({
      members,
      sharedTransactions: postSettlement,
    });
    assert.equal(balancePostCutoff.find((m) => m.userId === "user-2")?.balance, -5000);

    // After full settlement with no new expenses: balance is zero, no CTA shown
    const balanceZero = calculateHouseholdMemberBalances({ members, sharedTransactions: [] });
    const settlementAfterZero = calculateHouseholdSettlement(balanceZero);
    assert.equal(settlementAfterZero, null);
  });

  it("marks high shared spend without aggressive language", () => {
    const briefing = calculateHouseholdBriefing({
      household: { id: "home", name: "Casa" },
      period: { month: 5, year: 2026, from: new Date("2026-05-01"), to: new Date("2026-06-01") },
      members: [
        { userId: "a", name: "A", email: "a@example.com" },
        { userId: "b", name: "B", email: "b@example.com" },
      ],
      sharedTransactions: [
        {
          id: "shared-1",
          paidByUserId: "a",
          paidByName: "A",
          amount: 300000,
          currency: CurrencyCode.ARS,
          description: "Reserva",
          occurredAt: new Date("2026-05-10"),
          category: null,
          participants: [
            { userId: "a", amount: 150000 },
            { userId: "b", amount: 150000 },
          ],
        },
        {
          id: "shared-2",
          paidByUserId: "b",
          paidByName: "B",
          amount: 2000,
          currency: CurrencyCode.ARS,
          description: "Cafe",
          occurredAt: new Date("2026-05-11"),
          category: null,
          participants: [
            { userId: "a", amount: 1000 },
            { userId: "b", amount: 1000 },
          ],
        },
      ],
    });

    assert.equal(briefing.status, "HIGH_SPEND");
    assert.match(briefing.summary, /Conviene revisar el ritmo del mes/);
  });
});
