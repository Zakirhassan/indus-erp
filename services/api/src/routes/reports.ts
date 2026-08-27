import { Router } from "express";
import { requireAuth } from "@indus/auth";
import { Role } from "@indus/shared-types";
import {
  findUserById,
  getCollectDueReport,
  getCollectionsReport,
  getCustomersReport,
  getFinanceReport,
  getInventoryReport,
  getOutstandingReport,
  getReportsOverview,
  getReturnsReport,
  getSalesReport,
  getStatementsReport,
  getTodaysAddOnSales,
  listCollectors,
  listProductTypes
} from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function bool(v: unknown): boolean {
  return v === "true" || v === "1";
}

reportsRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    res.json(await getReportsOverview(str(req.query.asOfDate)));
  })
);

reportsRouter.get(
  "/sales",
  asyncHandler(async (req, res) => {
    res.json(
      await getSalesReport({
        dateFrom: str(req.query.dateFrom),
        dateTo: str(req.query.dateTo),
        fieldId: str(req.query.fieldId),
        productType: str(req.query.productType),
        compare: bool(req.query.compare)
      })
    );
  })
);

reportsRouter.get(
  "/collections",
  asyncHandler(async (req, res) => {
    res.json(
      await getCollectionsReport({
        dateFrom: str(req.query.dateFrom),
        dateTo: str(req.query.dateTo),
        fieldId: str(req.query.fieldId),
        collectorId: str(req.query.collectorId)
      })
    );
  })
);

reportsRouter.get(
  "/outstanding",
  asyncHandler(async (req, res) => {
    res.json(
      await getOutstandingReport({
        fieldId: str(req.query.fieldId),
        asOfDate: str(req.query.asOfDate)
      })
    );
  })
);

reportsRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    res.json(
      await getCustomersReport({
        fieldId: str(req.query.fieldId),
        dateFrom: str(req.query.dateFrom),
        dateTo: str(req.query.dateTo)
      })
    );
  })
);

reportsRouter.get(
  "/collect-due",
  asyncHandler(async (req, res) => {
    res.json(
      await getCollectDueReport({
        fieldId: str(req.query.fieldId),
        asOfDate: str(req.query.asOfDate)
      })
    );
  })
);

reportsRouter.get(
  "/finance",
  asyncHandler(async (req, res) => {
    res.json(
      await getFinanceReport({
        dateFrom: str(req.query.dateFrom),
        dateTo: str(req.query.dateTo),
        fieldId: str(req.query.fieldId)
      })
    );
  })
);

reportsRouter.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    res.json(await getInventoryReport({ type: str(req.query.type) }));
  })
);

reportsRouter.get(
  "/returns",
  asyncHandler(async (req, res) => {
    res.json(
      await getReturnsReport({
        dateFrom: str(req.query.dateFrom),
        dateTo: str(req.query.dateTo),
        fieldId: str(req.query.fieldId),
        productId: str(req.query.productId)
      })
    );
  })
);

reportsRouter.get(
  "/statements",
  asyncHandler(async (req, res) => {
    res.json(
      await getStatementsReport({
        dateFrom: str(req.query.dateFrom),
        dateTo: str(req.query.dateTo),
        fieldId: str(req.query.fieldId),
        compare: bool(req.query.compare)
      })
    );
  })
);

reportsRouter.get(
  "/today-add-on-sales",
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const actor = await findUserById(req.user.userId);
    const actorName = actor?.name ?? (req.user.role === Role.Collector ? "Collector" : "Admin");
    res.json(await getTodaysAddOnSales(actorName, str(req.query.asOfDate)));
  })
);

reportsRouter.get(
  "/meta/collectors",
  asyncHandler(async (_req, res) => {
    res.json(await listCollectors());
  })
);

reportsRouter.get(
  "/meta/product-types",
  asyncHandler(async (_req, res) => {
    res.json(await listProductTypes());
  })
);
