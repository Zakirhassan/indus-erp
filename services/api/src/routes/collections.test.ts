import { beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

vi.mock("@indus/db", () => ({
  approveCollectionBatch: vi.fn(),
  deleteCollectionBatch: vi.fn(),
  findBatchForDateField: vi.fn(),
  findBatchForDateFieldCollector: vi.fn(),
  findUserById: vi.fn(),
  getBatch: vi.fn(),
  listBatchesForCollectorDay: vi.fn(),
  listCollectionBatches: vi.fn(),
  listPendingCollectionBatches: vi.fn(),
  listRecentCollectorBatches: vi.fn(),
  listUnsubmittedPriorDayBatches: vi.fn(),
  rejectCollectionBatch: vi.fn(),
  reopenCollectionBatch: vi.fn(),
  saveCollectionBatch: vi.fn(),
  submitAllPriorDayBatches: vi.fn(),
  submitCollectorBatch: vi.fn(),
  submitDraftBatchesForDay: vi.fn(),
  submitFieldBatchForDay: vi.fn(),
  todayIso: vi.fn(() => "2026-01-01"),
  validateBatchEntries: vi.fn(),
  verifyCollectionBatch: vi.fn(),
}));

describe("DELETE /api/collections/:id", () => {
  let app: express.Express;
  let db: typeof import("@indus/db");
  let signAccessToken: typeof import("@indus/auth").signAccessToken;
  let Role: typeof import("@indus/shared-types").Role;

  beforeAll(async () => {
    db = await import("@indus/db");
    ({ signAccessToken } = await import("@indus/auth"));
    ({ Role } = await import("@indus/shared-types"));
    const { collectionsRouter } = await import("./collections.js");
    app = express();
    app.use(express.json());
    app.use("/api/collections", collectionsRouter);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).delete("/api/collections/batch1");
    expect(res.status).toBe(401);
    expect(db.deleteCollectionBatch).not.toHaveBeenCalled();
  });

  it("rejects a non-admin collector", async () => {
    const token = signAccessToken({ userId: "collector-1", role: Role.Collector });
    const res = await request(app).delete("/api/collections/batch1").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(db.deleteCollectionBatch).not.toHaveBeenCalled();
  });

  it("allows an admin to delete the batch", async () => {
    vi.mocked(db.deleteCollectionBatch).mockResolvedValueOnce(undefined);
    const token = signAccessToken({ userId: "admin-1", role: Role.Admin });
    const res = await request(app).delete("/api/collections/batch1").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    expect(db.deleteCollectionBatch).toHaveBeenCalledWith("batch1");
  });
});
