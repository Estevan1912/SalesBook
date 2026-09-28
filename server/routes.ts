import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { insertContactSchema, insertTaskSchema, insertActivitySchema } from "@shared/schema";

const idOf = (p: string) => Number(p);

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/contacts", (_req, res) => res.json(storage.listContacts()));
  app.get("/api/contacts/:id", (req, res) => {
    const c = storage.getContact(idOf(req.params.id));
    c ? res.json(c) : res.status(404).json({ message: "Not found" });
  });
  app.post("/api/contacts", (req, res) => {
    const p = insertContactSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    res.json(storage.createContact(p.data));
  });
  app.patch("/api/contacts/:id", (req, res) => {
    const p = insertContactSchema.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    const c = storage.updateContact(idOf(req.params.id), p.data);
    c ? res.json(c) : res.status(404).json({ message: "Not found" });
  });
  app.delete("/api/contacts/:id", (req, res) => { storage.deleteContact(idOf(req.params.id)); res.json({ ok: true }); });

  app.get("/api/contacts-export.csv", (_req, res) => {
    const rows = storage.listContacts();
    const cols = ["name","phone","email","status","product","details","lines","lineItems","monthlyQuote","credits","carrier","saleDate","notes","lastContacted"] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sales-book-customers.csv");
    res.send(csv);
  });

  app.get("/api/tasks", (_req, res) => res.json(storage.listTasks()));
  app.post("/api/tasks", (req, res) => {
    const p = insertTaskSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    res.json(storage.createTask(p.data));
  });
  app.patch("/api/tasks/:id", (req, res) => {
    const p = insertTaskSchema.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    const t = storage.updateTask(idOf(req.params.id), p.data);
    t ? res.json(t) : res.status(404).json({ message: "Not found" });
  });
  app.delete("/api/tasks/:id", (req, res) => { storage.deleteTask(idOf(req.params.id)); res.json({ ok: true }); });

  app.get("/api/activities", (req, res) => {
    const cid = req.query.contactId ? Number(req.query.contactId) : undefined;
    res.json(storage.listActivities(cid));
  });
  app.post("/api/activities", (req, res) => {
    const p = insertActivitySchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.message });
    res.json(storage.createActivity(p.data));
  });
  app.delete("/api/activities/:id", (req, res) => { storage.deleteActivity(idOf(req.params.id)); res.json({ ok: true }); });

  app.get("/api/settings", (_req, res) => res.json(storage.getSettings()));
  app.put("/api/settings", (req, res) => {
    if (!req.body || typeof req.body !== "object") return res.status(400).json({ message: "Bad settings" });
    res.json(storage.saveSettings(req.body));
  });

  return httpServer;
}
