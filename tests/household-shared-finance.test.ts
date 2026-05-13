import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHouseholdSummary,
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
        { userId: "brandon", name: "Brandon", email: "brandon@example.com" },
        { userId: "zoirelys", name: "Zoirelys", email: "zoirelys@example.com" },
      ],
      sharedTransactions: [
        {
          paidByUserId: "brandon",
          amount: 24000,
          participants: [
            { userId: "brandon", amount: 12000 },
            { userId: "zoirelys", amount: 12000 },
          ],
        },
      ],
    });

    assert.deepEqual(
      balances.map((member) => ({ userId: member.userId, balance: member.balance })),
      [
        { userId: "brandon", balance: 12000 },
        { userId: "zoirelys", balance: -12000 },
      ],
    );

    const settlement = calculateHouseholdSettlement(balances);
    assert.deepEqual(settlement, {
      fromUserId: "zoirelys",
      fromName: "Zoirelys",
      toUserId: "brandon",
      toName: "Brandon",
      amount: 12000,
    });
    const summary = buildHouseholdSummary(balances, settlement);
    assert.match(summary, /Brandon cubrió más gastos este mes\./);
    assert.match(summary, /Zoirelys debe/);
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
});
