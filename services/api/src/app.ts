import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { auditMiddleware } from "./auditMiddleware.js";
import { authRouter } from "./routes/auth.js";
import { fieldsRouter } from "./routes/fields.js";
import { productsRouter } from "./routes/products.js";
import { customersRouter } from "./routes/customers.js";
import { collectionsRouter } from "./routes/collections.js";
import { reportsRouter } from "./routes/reports.js";
import { usersRouter } from "./routes/users.js";
import { auditLogsRouter } from "./routes/auditLogs.js";

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(auditMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/fields", fieldsRouter);
app.use("/api/products", productsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/users", usersRouter);
app.use("/api/audit-logs", auditLogsRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
