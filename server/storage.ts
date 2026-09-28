import { contacts, tasks, activities } from "../shared/schema.js";
import { DEFAULT_SETTINGS, PHONE_PLANS, type Settings } from "../shared/schema.js";
import type { Contact, InsertContact, Task, InsertTask, Activity, InsertActivity } from "../shared/schema.js";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add a Neon database in Vercel -> Storage, or put the URL in .env for local dev.");
}
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'lead', product TEXT NOT NULL DEFAULT 'New account',
    details TEXT NOT NULL DEFAULT '', lines INTEGER NOT NULL DEFAULT 1, line_items TEXT NOT NULL DEFAULT '[]',
    monthly_quote DOUBLE PRECISION NOT NULL DEFAULT 0, credits DOUBLE PRECISION NOT NULL DEFAULT 0,
    carrier TEXT NOT NULL DEFAULT '', sale_date TEXT, notes TEXT NOT NULL DEFAULT '', last_contacted TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, contact_id INTEGER, due_date TEXT,
    done BOOLEAN NOT NULL DEFAULT FALSE, notes TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY, contact_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'note',
    body TEXT NOT NULL DEFAULT '', date TEXT NOT NULL
  )`,
];

/** Creates tables and seeds demo data once per server instance; every storage call awaits it. */
let ready: Promise<void> | undefined;
export function ensureDb() {
  ready ??= (async () => {
    for (const stmt of SCHEMA) await sql.query(stmt);
    await seedIfEmpty();
  })().catch((err) => { ready = undefined; throw err; });
  return ready;
}

export interface IStorage {
  listContacts(): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(c: InsertContact): Promise<Contact>;
  updateContact(id: number, c: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;
  listTasks(): Promise<Task[]>;
  createTask(t: InsertTask): Promise<Task>;
  updateTask(id: number, t: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  listActivities(contactId?: number): Promise<Activity[]>;
  createActivity(a: InsertActivity): Promise<Activity>;
  deleteActivity(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  listContacts() { return db.select().from(contacts).orderBy(desc(contacts.id)); }
  async getContact(id: number) { return (await db.select().from(contacts).where(eq(contacts.id, id)))[0]; }
  async createContact(c: InsertContact) {
    return (await db.insert(contacts).values({ ...c, createdAt: new Date().toISOString() }).returning())[0];
  }
  async updateContact(id: number, c: Partial<InsertContact>) {
    return (await db.update(contacts).set(c).where(eq(contacts.id, id)).returning())[0];
  }
  async deleteContact(id: number) {
    await db.delete(activities).where(eq(activities.contactId, id));
    await db.update(tasks).set({ contactId: null }).where(eq(tasks.contactId, id));
    await db.delete(contacts).where(eq(contacts.id, id));
  }
  listTasks() { return db.select().from(tasks).orderBy(tasks.dueDate); }
  async createTask(t: InsertTask) { return (await db.insert(tasks).values(t).returning())[0]; }
  async updateTask(id: number, t: Partial<InsertTask>) {
    return (await db.update(tasks).set(t).where(eq(tasks.id, id)).returning())[0];
  }
  async deleteTask(id: number) { await db.delete(tasks).where(eq(tasks.id, id)); }
  listActivities(contactId?: number) {
    const q = db.select().from(activities);
    return (contactId ? q.where(eq(activities.contactId, contactId)) : q).orderBy(desc(activities.date));
  }
  async createActivity(a: InsertActivity) {
    const date = new Date().toISOString();
    const [row] = await db.insert(activities).values({ ...a, date }).returning();
    if (a.type !== "note") await db.update(contacts).set({ lastContacted: date }).where(eq(contacts.id, a.contactId));
    return row;
  }
  async deleteActivity(id: number) { await db.delete(activities).where(eq(activities.id, id)); }
  async getSettings(): Promise<Settings> {
    const rows = (await sql.query("SELECT key, value FROM settings")) as { key: string; value: string }[];
    const out: any = { ...DEFAULT_SETTINGS };
    for (const r of rows) { try { out[r.key] = JSON.parse(r.value); } catch {} }
    out.prices = { ...DEFAULT_SETTINGS.prices, ...(out.prices ?? {}) };
    return out;
  }
  async saveSettings(patch: Partial<Settings>) {
    for (const [k, v] of Object.entries(patch)) {
      if (k in DEFAULT_SETTINGS) {
        await sql.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [k, JSON.stringify(v)]);
      }
    }
    return this.getSettings();
  }
}

export const storage = new DatabaseStorage();

// Seed demo data on first run
async function seedIfEmpty() {
  const [{ n }] = (await sql.query("SELECT COUNT(*)::int AS n FROM contacts")) as { n: number }[];
  if (n > 0) return;
  const d = (o: number) => { const x = new Date(); x.setDate(x.getDate() + o); return x.toISOString().slice(0, 10); };
  const ago = (days: number) => { const x = new Date(); x.setDate(x.getDate() - days); return x.toISOString(); };
  const seed: (InsertContact & { lc?: string; ca: number })[] = [
    { name: "Maria Delgado", phone: "(760) 555-0142", email: "maria.d@gmail.com", status: "lead", product: "Switch / port-in", details: "Coming from T-Mobile, $800 switcher credit per line", credits: 0, lineItems: JSON.stringify([{device:"iPhone 18 Pro",plan:"Unlimited Plus",who:"Maria"},{device:"iPhone 18 Pro",plan:"Unlimited Plus",who:"Husband"},{device:"BYOD",plan:"Unlimited Welcome",who:"Son"},{device:"BYOD",plan:"Unlimited Welcome",who:"Daughter"}]), lines: 4, monthlyQuote: 185, carrier: "T-Mobile", notes: "Waiting on husband to decide. Best time after 5pm.", lc: ago(1), ca: 2 },
    { name: "James Whitaker", phone: "(760) 555-0198", email: "", status: "lead", product: "5G Home Internet", details: "Home Internet Plus, currently on Spectrum paying $90", lines: 1, monthlyQuote: 45, carrier: "Spectrum", notes: "", lc: ago(3), ca: 3 },
    { name: "Priya Natarajan", phone: "(858) 555-0110", email: "priya.n@outlook.com", status: "checkup", product: "Upgrade", details: "Traded in Galaxy S23", lineItems: JSON.stringify([{device:"Galaxy S26 Ultra",plan:"Unlimited Welcome",who:"Priya"}]), lines: 1, monthlyQuote: 95, carrier: "Verizon", saleDate: d(-2), notes: "Trade-in credit should show in 2 bills.", lc: ago(2), ca: 2 },
    { name: "Tom Reyes", phone: "(760) 555-0163", email: "", status: "lead", product: "New account", details: "Line for his daughter, asked about prepaid vs postpaid", lineItems: JSON.stringify([{device:"iPhone 17e",plan:"Unlimited Welcome",who:"Daughter"}]), lines: 1, monthlyQuote: 35, carrier: "Cricket", notes: "", ca: 0 },
    { name: "Hannah Cho", phone: "(760) 555-0177", email: "hannah.cho@yahoo.com", status: "checkup", product: "Add a line", details: "Added watch + iPad to her existing account", lineItems: JSON.stringify([{device:"Apple Watch",plan:"Watch / tablet plan",who:"Hannah"},{device:"iPad",plan:"Watch / tablet plan",who:"Hannah"}]), lines: 2, monthlyQuote: 30, carrier: "Verizon", saleDate: d(-25), notes: "Loyal customer, sent her sister in.", lc: ago(25), ca: 25 },
    { name: "Derek Olsen", phone: "(619) 555-0121", email: "", status: "lead", product: "Switch / port-in", details: "Wants to keep his numbers, price shopping", lineItems: JSON.stringify([{device:"Galaxy S26",plan:"Unlimited Welcome",who:"Derek"},{device:"Galaxy S26",plan:"Unlimited Welcome",who:"Wife"},{device:"BYOD",plan:"Unlimited Welcome",who:"Son"}]), lines: 3, monthlyQuote: 150, carrier: "AT&T", notes: "Said AT&T offered him $140. Try the switcher promo.", lc: ago(6), ca: 8 },
    { name: "Aisha Grant", phone: "(760) 555-0135", email: "agrant@gmail.com", status: "closed", product: "Switch / port-in", details: "Bundled with Fios Gigabit", lineItems: JSON.stringify([{device:"iPhone 17 Pro",plan:"Unlimited Ultimate",who:"Aisha"},{device:"Pixel 11",plan:"Unlimited Plus",who:"Marcus"}]), lines: 2, monthlyQuote: 160, carrier: "Xfinity", saleDate: d(-40), notes: "", lc: ago(10), ca: 40 },
    { name: "Kevin Tran", phone: "(760) 555-0189", email: "", status: "lost", product: "Upgrade", details: "Went with Visible for price", lineItems: JSON.stringify([{device:"Pixel 11 Pro",plan:"Unlimited Plus",who:"Kevin"}]), lines: 1, monthlyQuote: 80, carrier: "Verizon", notes: "Revisit when his Visible promo ends.", lc: ago(30), ca: 32 },
  ];
  const ids: number[] = [];
  const pay: Record<string, number> = { "iPhone 18 Pro": 33.31, "Galaxy S26": 24.99, "Galaxy S26 Ultra": 36.11, "Pixel 11": 24.99, "iPhone 17 Pro": 30.55, "iPhone 17e": 16.66, "Pixel 11 Pro": 27.77, "Apple Watch": 11.11, "iPad": 13.88 };
  const credit: Record<string, number> = { "Maria Delgado": 20, "Derek Olsen": 15, "Priya Natarajan": 10 };
  for (const x of seed) {
    const ls = JSON.parse(x.lineItems ?? "[]");
    if (!ls.length) continue;
    const tier = Math.min(Math.max(ls.filter((l: any) => PHONE_PLANS.includes(l.plan)).length, 1), 5) - 1;
    for (const l of ls) {
      const t = DEFAULT_SETTINGS.prices[l.plan] ?? [0];
      l.planPrice = PHONE_PLANS.includes(l.plan) ? t[tier] : t[0];
      l.devicePay = pay[l.device] ?? 0;
    }
    x.lineItems = JSON.stringify(ls);
    x.credits = credit[x.name] ?? 0;
    x.monthlyQuote = Math.round((ls.reduce((s: number, l: any) => s + l.planPrice + l.devicePay, 0) - x.credits) * 100) / 100;
  }
  for (const { lc, ca, ...c } of seed) {
    ids.push((await db.insert(contacts).values({ ...c, lastContacted: lc ?? null, createdAt: ago(ca) }).returning())[0].id);
  }
  const t: InsertTask[] = [
    { title: "Follow up on quote", contactId: ids[0], dueDate: d(0), done: false, notes: "Ask if husband is on board" },
    { title: "Follow up on quote", contactId: ids[5], dueDate: d(-1), done: false, notes: "Mention switcher promo" },
    { title: "Check-in after sale", contactId: ids[2], dueDate: d(1), done: false, notes: "Make sure data transferred OK" },
    { title: "Follow up on quote", contactId: ids[1], dueDate: d(2), done: false, notes: "" },
    { title: "Follow up on quote", contactId: ids[3], dueDate: d(0), done: false, notes: "" },
    { title: "Check-in after sale", contactId: ids[4], dueDate: d(5), done: false, notes: "30-day check-in, ask for referral" },
    { title: "Trade-in / rebate status", contactId: ids[2], dueDate: d(28), done: false, notes: "Confirm trade-in credit posted" },
    { title: "Promo ending", contactId: ids[7], dueDate: d(60), done: false, notes: "" },
  ];
  await db.insert(tasks).values(t);
  const acts: [number, string, string, number][] = [
    [ids[0], "talked", "Came in store, went over 4 lines with AutoPay and the switcher credit", 2],
    [ids[0], "voicemail", "Left VM about the quote", 1],
    [ids[2], "talked", "Sold upgrade, trade-in processed", 2],
    [ids[5], "talked", "Went over 3 lines, keeping his numbers", 8],
    [ids[5], "no answer", "", 6],
    [ids[1], "texted", "Sent Home Internet availability for his address", 3],
  ];
  await db.insert(activities).values(acts.map(([cid, type, body, days]) => ({ contactId: cid, type, body, date: ago(days) })));
}
