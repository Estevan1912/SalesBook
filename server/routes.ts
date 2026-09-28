import type { Express } from "express";
import { storage, ensureDb } from "./storage.js";
import { insertContactSchema, insertTaskSchema, insertActivitySchema } from "../shared/schema.js";

const idOf = (p: string) => Number(p);

export function registerRoutes(app: Express) {
  app.use("/api", async (_req, _res, next) => { await ensureDb(); next(); });

  app.get("/api/contacts", async (_req, res) => res.json(await storage.listContacts()));
  app.get("/api/contacts/:id", async (req, res) => {
    const c = await storage.getContact(idOf(req.params.id));
    c ? res.json(c) : res.status(404).json({ message: "Not found" });
  });
  app.post("/api/contacts", async (req, res) => {
    const p = insertContactSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    res.json(await storage.createContact(p.data));
  });
  app.patch("/api/contacts/:id", async (req, res) => {
    const p = insertContactSchema.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    const c = await storage.updateContact(idOf(req.params.id), p.data);
    c ? res.json(c) : res.status(404).json({ message: "Not found" });
  });
  app.delete("/api/contacts/:id", async (req, res) => { await storage.deleteContact(idOf(req.params.id)); res.json({ ok: true }); });

  app.get("/api/contacts-export.csv", async (_req, res) => {
    const rows = await storage.listContacts();
    const cols = ["name","phone","email","status","product","details","lines","lineItems","monthlyQuote","credits","carrier","saleDate","notes","lastContacted"] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sales-book-customers.csv");
    res.send(csv);
  });

  app.get("/api/tasks", async (_req, res) => res.json(await storage.listTasks()));
  app.post("/api/tasks", async (req, res) => {
    const p = insertTaskSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    res.json(await storage.createTask(p.data));
  });
  app.patch("/api/tasks/:id", async (req, res) => {
    const p = insertTaskSchema.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    const t = await storage.updateTask(idOf(req.params.id), p.data);
    t ? res.json(t) : res.status(404).json({ message: "Not found" });
  });
  app.delete("/api/tasks/:id", async (req, res) => { await storage.deleteTask(idOf(req.params.id)); res.json({ ok: true }); });

  app.get("/api/activities", async (req, res) => {
    const cid = req.query.contactId ? Number(req.query.contactId) : undefined;
    res.json(await storage.listActivities(cid));
  });
  app.post("/api/activities", async (req, res) => {
    const p = insertActivitySchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    res.json(await storage.createActivity(p.data));
  });
  app.delete("/api/activities/:id", async (req, res) => { await storage.deleteActivity(idOf(req.params.id)); res.json({ ok: true }); });

  app.get("/api/settings", async (_req, res) => res.json(await storage.getSettings()));
  app.put("/api/settings", async (req, res) => {
    if (!req.body || typeof req.body !== "object") return res.status(400).json({ message: "Bad settings" });
    res.json(await storage.saveSettings(req.body));
  });
}
