// In-browser replacement for the old Express API. Everything is saved in this browser's localStorage,
// like the commission tracker and budget apps. apiRequest() in queryClient.ts routes the same
// "/api/..." calls here, so the rest of the app doesn't know the server is gone.
import {
  DEFAULT_SETTINGS, insertContactSchema, insertTaskSchema, insertActivitySchema,
  type Contact, type Task, type Activity, type Settings,
} from "@shared/schema";

const KEY = "salesbook";

type Store = {
  contacts: Contact[];
  tasks: Task[];
  activities: Activity[];
  settings: Partial<Settings>;
  nextId: number;
};

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s: Store = JSON.parse(raw);
      // "Check up" was removed as a status; those customers were already sold.
      s.contacts.forEach((c) => { if ((c.status as string) === "checkup") c.status = "closed"; });
      return s;
    }
  } catch {}
  return { contacts: [], tasks: [], activities: [], settings: {}, nextId: 1 };
}

function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function getSettings(s: Store): Settings {
  return { yourName: s.settings.yourName ?? DEFAULT_SETTINGS.yourName, templates: s.settings.templates ?? DEFAULT_SETTINGS.templates };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const notFound = () => json({ message: "Not found" }, 404);
const bad = (message: string) => json({ message }, 400);

// Mirrors the routes the server used to have (see git history: server/routes.ts).
export function localApi(method: string, url: string, data?: any): Response {
  const [path, query = ""] = url.split("?");
  const parts = path.replace(/^\/api\//, "").split("/");
  const [resource, idStr] = parts;
  const id = idStr ? Number(idStr) : undefined;
  const s = load();
  const now = () => new Date().toISOString();

  if (resource === "contacts") {
    if (method === "GET" && id === undefined) return json([...s.contacts].sort((a, b) => b.id - a.id));
    if (method === "GET") return s.contacts.find((c) => c.id === id) ? json(s.contacts.find((c) => c.id === id)) : notFound();
    if (method === "POST") {
      const p = insertContactSchema.safeParse(data);
      if (!p.success) return bad(p.error.message);
      const c = { ...defaults.contact, ...p.data, id: s.nextId++, createdAt: now() } as Contact;
      s.contacts.push(c); save(s); return json(c);
    }
    if (method === "PATCH") {
      const p = insertContactSchema.partial().safeParse(data);
      if (!p.success) return bad(p.error.message);
      const c = s.contacts.find((x) => x.id === id);
      if (!c) return notFound();
      Object.assign(c, p.data); save(s); return json(c);
    }
    if (method === "DELETE") {
      s.activities = s.activities.filter((a) => a.contactId !== id);
      s.tasks.forEach((t) => { if (t.contactId === id) t.contactId = null; });
      s.contacts = s.contacts.filter((c) => c.id !== id);
      save(s); return json({ ok: true });
    }
  }

  if (resource === "tasks") {
    if (method === "GET") {
      // same order as SQL "ORDER BY due_date": dated tasks by date, undated last
      return json([...s.tasks].sort((a, b) => (a.dueDate ?? "￿").localeCompare(b.dueDate ?? "￿")));
    }
    if (method === "POST") {
      const p = insertTaskSchema.safeParse(data);
      if (!p.success) return bad(p.error.message);
      const t = { ...defaults.task, ...p.data, id: s.nextId++ } as Task;
      s.tasks.push(t); save(s); return json(t);
    }
    if (method === "PATCH") {
      const p = insertTaskSchema.partial().safeParse(data);
      if (!p.success) return bad(p.error.message);
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return notFound();
      Object.assign(t, p.data); save(s); return json(t);
    }
    if (method === "DELETE") { s.tasks = s.tasks.filter((t) => t.id !== id); save(s); return json({ ok: true }); }
  }

  if (resource === "activities") {
    if (method === "GET") {
      const cid = Number(new URLSearchParams(query).get("contactId")) || undefined;
      const list = cid ? s.activities.filter((a) => a.contactId === cid) : s.activities;
      return json([...list].sort((a, b) => b.date.localeCompare(a.date)));
    }
    if (method === "POST") {
      const p = insertActivitySchema.safeParse(data);
      if (!p.success) return bad(p.error.message);
      const date = now();
      const a = { ...defaults.activity, ...p.data, id: s.nextId++, date } as Activity;
      s.activities.push(a);
      if (a.type !== "note") {
        const c = s.contacts.find((x) => x.id === a.contactId);
        if (c) c.lastContacted = date;
      }
      save(s); return json(a);
    }
    if (method === "DELETE") { s.activities = s.activities.filter((a) => a.id !== id); save(s); return json({ ok: true }); }
  }

  if (resource === "settings") {
    if (method === "GET") return json(getSettings(s));
    if (method === "PUT") {
      if (!data || typeof data !== "object") return bad("Bad settings");
      for (const [k, v] of Object.entries(data)) if (k in DEFAULT_SETTINGS) (s.settings as any)[k] = v;
      save(s); return json(getSettings(s));
    }
  }

  return notFound();
}

// Column defaults the database used to fill in.
const defaults = {
  contact: {
    phone: "", email: "", status: "lead", product: "New account", details: "", lines: 1, lineItems: "[]",
    monthlyQuote: 0, credits: 0, carrier: "", saleDate: null, notes: "", lastContacted: null,
  },
  task: { contactId: null, dueDate: null, done: false, notes: "" },
  activity: { type: "note", body: "" },
};

/** Downloads all contacts as a CSV file (replaces the old /api/contacts-export.csv route). */
export function downloadContactsCsv() {
  const rows = load().contacts.sort((a, b) => b.id - a.id);
  const cols = ["name","phone","email","status","product","details","lines","lineItems","monthlyQuote","carrier","saleDate","notes","lastContacted"] as const;
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "sales-book-customers.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
