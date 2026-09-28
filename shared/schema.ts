import { pgTable, serial, text, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const STATUSES = ["lead", "closed", "lost"] as const;
export const isSold = (s: string) => s === "closed";
export const PRODUCTS = [
  "New account", "Upgrade", "Switch / port-in", "Add a line", "5G Home Internet", "Fios",
  "Tablet / watch", "Accessories", "Protection plan", "Other",
] as const;
export const CARRIERS = ["Verizon", "AT&T", "T-Mobile", "Spectrum", "Xfinity", "Cricket", "Metro", "Visible", "Other"] as const;
export const CALL_REASONS = [
  "Follow up on quote", "Check-in after sale", "Trade-in / rebate status", "Upgrade eligible",
  "Bill review", "Promo ending", "Referral ask", "Other",
] as const;
export const DEVICE_GROUPS: { label: string; items: string[] }[] = [
  { label: "Apple iPhone", items: ["iPhone 18 Pro Max", "iPhone 18 Pro", "iPhone Duo", "iPhone Air", "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17", "iPhone 17e", "iPhone 16", "iPhone 16e", "iPhone 15"] },
  { label: "Samsung Galaxy", items: ["Galaxy S26 Ultra", "Galaxy S26+", "Galaxy S26", "Galaxy S26 FE", "Galaxy Z Fold8 Ultra", "Galaxy Z Fold8", "Galaxy Z Flip8", "Galaxy S25", "Galaxy A36 5G", "Galaxy A17 5G", "Galaxy A16 5G"] },
  { label: "Google Pixel", items: ["Pixel 11 Pro Fold", "Pixel 11 Pro XL", "Pixel 11 Pro", "Pixel 11", "Pixel 10a"] },
  { label: "Keep own phone", items: ["BYOD"] },
  { label: "Other devices", items: ["Apple Watch", "Galaxy Watch", "iPad", "Galaxy Tab", "Hotspot / Jetpack", "Other phone"] },
];
export const PLANS = [
  "Unlimited Welcome", "Unlimited Plus", "Unlimited Ultimate", "Simplicity Plan", "Watch / tablet plan", "Prepaid", "Keeping current plan", "Other",
] as const;
export type LineItem = { device: string; plan: string; who: string };

export type Template = { id: string; name: string; body: string };
export type Settings = {
  yourName: string;
  templates: Template[];
};
export const DEFAULT_SETTINGS: Settings = {
  yourName: "",
  templates: [
    { id: "t1", name: "Quote follow-up", body: "Hi {first}, it's {me} from Verizon. Following up on the quote we put together: {lines} for {monthly}/mo. Any questions? I can get you set up whenever you're ready." },
    { id: "t2", name: "Missed your call", body: "Hi {first}, it's {me} from Verizon. Tried giving you a call. Text or call me back when you get a chance." },
    { id: "t3", name: "Deal still available", body: "Hi {first}, {me} from Verizon here. The deal we talked about ({device} on {plan}, {monthly}/mo) is still available. Want me to hold it for you?" },
    { id: "t4", name: "Check-in after sale", body: "Hi {first}, it's {me} from Verizon. Just checking in to make sure everything's working great with your new service. Anything I can help with?" },
    { id: "t5", name: "Referral ask", body: "Hi {first}, thanks again for coming in! If any friends or family are looking to switch, send them my way and ask for {me}." },
  ],
};
export const OUTCOMES = ["talked", "no answer", "voicemail", "texted", "note"] as const;

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("lead"),
  product: text("product").notNull().default("New account"),
  details: text("details").notNull().default(""),
  lines: integer("lines").notNull().default(1),
  /** JSON array of LineItem: the phone and plan for each line */
  lineItems: text("line_items").notNull().default("[]"),
  monthlyQuote: doublePrecision("monthly_quote").notNull().default(0),
  /** no longer shown; kept so older saved customers still load */
  credits: doublePrecision("credits").notNull().default(0),
  carrier: text("carrier").notNull().default(""),
  saleDate: text("sale_date"),
  notes: text("notes").notNull().default(""),
  lastContacted: text("last_contacted"),
  createdAt: text("created_at").notNull(),
});
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  contactId: integer("contact_id"),
  dueDate: text("due_date"),
  done: boolean("done").notNull().default(false),
  notes: text("notes").notNull().default(""),
});
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  type: text("type").notNull().default("note"),
  body: text("body").notNull().default(""),
  date: text("date").notNull(),
});
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, date: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
