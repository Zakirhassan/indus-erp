import { Router } from "express";
import { requireAuth, requireRole } from "@indus/auth";
import { Role } from "@indus/shared-types";
import { listAuditLogs } from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const auditLogsRouter = Router();
auditLogsRouter.use(requireAuth, requireRole(Role.Admin));

auditLogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { actorId, dateFrom, dateTo, page, pageSize } = req.query;
    res.json(
      await listAuditLogs({
        actorId: typeof actorId === "string" ? actorId : undefined,
        dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
        dateTo: typeof dateTo === "string" ? dateTo : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    );
  }),
);
