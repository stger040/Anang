import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => {
  return {
    allocatePaymentToPlanInstallments: vi.fn(),
    platformLog: vi.fn(),
    tenantPrisma: vi.fn(),
    primaryDb: {},
  };
});

vi.mock("@/lib/pay/plan-installment-allocation", () => ({
  allocatePaymentToPlanInstallments: mocks.allocatePaymentToPlanInstallments,
}));

vi.mock("@/lib/platform-log", () => ({
  platformLog: mocks.platformLog,
  readRequestId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.primaryDb,
  tenantPrisma: mocks.tenantPrisma,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: vi.fn(),
}));

import { handleCheckoutCompleted } from "./route";

function checkoutSession(
  amountTotal: number,
): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    amount_total: amountTotal,
    metadata: {
      tenantId: "tenant_1",
      statementId: "stmt_1",
      orgSlug: "synthetic-test",
    },
  } as unknown as Stripe.Checkout.Session;
}

function makeDb(statementBalanceCents: number) {
  const tx = {
    $queryRaw: vi.fn(
      async (
        _strings: TemplateStringsArray,
        _statementId: string,
        _tenantId: string,
      ) => [],
    ),
    payment: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "pay_1" })),
    },
    statement: {
      findFirst: vi.fn(async () => ({
        id: "stmt_1",
        tenantId: "tenant_1",
        balanceCents: statementBalanceCents,
        status: "open",
      })),
      update: vi.fn(async () => ({})),
    },
    auditEvent: {
      create: vi.fn(async () => ({})),
    },
  };
  const db = {
    payment: {
      findFirst: vi.fn(async () => null),
    },
    $transaction: vi.fn(async (fn: (arg: typeof tx) => Promise<void>) => fn(tx)),
  };
  return { db, tx };
}

describe("handleCheckoutCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes posting by locking the statement before reading its balance", async () => {
    const { db, tx } = makeDb(5_000);
    mocks.tenantPrisma.mockReturnValue(db);

    await handleCheckoutCompleted(checkoutSession(12_000), "req_1", "evt_1");

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    const [strings, statementId, tenantId] = tx.$queryRaw.mock.calls[0]!;
    expect(strings.join("")).toContain("FOR UPDATE");
    expect(statementId).toBe("stmt_1");
    expect(tenantId).toBe("tenant_1");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.statement.findFirst.mock.invocationCallOrder[0]!,
    );
  });

  it("applies only the remaining balance to statements and installments", async () => {
    const { db, tx } = makeDb(5_000);
    mocks.tenantPrisma.mockReturnValue(db);

    await handleCheckoutCompleted(checkoutSession(12_000), "req_1", "evt_1");

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 12_000,
        stripeCheckoutSessionId: "cs_test_123",
      }),
    });
    expect(tx.statement.update).toHaveBeenCalledWith({
      where: { id: "stmt_1" },
      data: { balanceCents: 0, status: "paid" },
    });
    expect(mocks.allocatePaymentToPlanInstallments).toHaveBeenCalledWith(tx, {
      tenantId: "tenant_1",
      statementId: "stmt_1",
      paymentId: "pay_1",
      amountCents: 5_000,
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          amountCents: 12_000,
          appliedCents: 5_000,
          overpaymentCents: 7_000,
        }),
      }),
    });
  });

  it("records distinct concurrent-session overpayments without allocating them twice", async () => {
    const { db, tx } = makeDb(0);
    mocks.tenantPrisma.mockReturnValue(db);

    await handleCheckoutCompleted(checkoutSession(8_000), "req_1", "evt_2");

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 8_000,
        status: "posted",
      }),
    });
    expect(tx.statement.update).toHaveBeenCalledWith({
      where: { id: "stmt_1" },
      data: { balanceCents: 0, status: "paid" },
    });
    expect(mocks.allocatePaymentToPlanInstallments).toHaveBeenCalledWith(tx, {
      tenantId: "tenant_1",
      statementId: "stmt_1",
      paymentId: "pay_1",
      amountCents: 0,
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          amountCents: 8_000,
          appliedCents: 0,
          overpaymentCents: 8_000,
        }),
      }),
    });
  });
});
