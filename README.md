# Indus ERP

Indus ERP is a retail furniture/household-goods shop management system covering installment
sales, collections, and inventory — an admin web dashboard plus a vendor Android app, backed by
a Node/TypeScript API and Postgres. See `Indus Business Logic.docx` and
`Indus ERP Platform Proposal.pdf` at the repo root for full business context.

**Prerequisites:** Node.js 20+, Docker Desktop.

**Getting started:**

```
npm install
npm run dev:up
```

`npm run dev:up` starts Postgres in Docker, waits for it to be healthy, runs database
migrations/seed once they exist, and starts the API and admin web dev servers once those exist
too — right now several packages/apps are placeholders, so `dev:up` will skip whatever isn't
built yet and tell you so.

This README is a stub — Athena will expand it as the system takes shape.
