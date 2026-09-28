import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEFAULT_SETTINGS, PHONE_PLANS, type LineItem, type Settings, type Contact } from "@shared/schema";
import { money, parseLines } from "@/lib/crm";

export type { Settings };

export const useSettings = () => {
  const q = useQuery<Settings>({ queryKey: ["/api/settings"] });
  return { ...q, settings: q.data ?? DEFAULT_SETTINGS };
};
export function useSaveSettings() {
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => (await apiRequest("PUT", "/api/settings", patch)).json(),
    onSuccess: (s) => queryClient.setQueryData(["/api/settings"], s),
  });
}

/** Typical 36-month device payments at retail price — edit per line when the price is different. */
export const DEVICE_PAY: Record<string, number> = {
  BYOD: 0,
  "iPhone 18 Pro": 33.31,
  "Galaxy S26": 24.99,
  "Galaxy S26 Ultra": 36.11,
  "Pixel 11": 24.99,
};

export type PricedLine = LineItem & { planPrice: number; devicePay: number; total: number };
export type Quote = { lines: PricedLine[]; plans: number; devices: number; credits: number; total: number; phoneLines: number };

export function priceQuote(items: LineItem[], credits: number, settings: Settings): Quote {
  const used = items.filter((l) => l.device || l.plan);
  const phoneLines = used.filter((l) => PHONE_PLANS.includes(l.plan)).length;
  const tier = Math.min(Math.max(phoneLines, 1), 5) - 1;
  const lines = used.map((l) => {
    const table = settings.prices[l.plan];
    const planPrice = l.planPrice ?? (table ? table[PHONE_PLANS.includes(l.plan) ? tier : 0] ?? 0 : 0);
    const devicePay = Number(l.devicePay ?? 0) || 0;
    return { ...l, planPrice, devicePay, total: planPrice + devicePay };
  });
  const plans = lines.reduce((s, l) => s + l.planPrice, 0);
  const devices = lines.reduce((s, l) => s + l.devicePay, 0);
  const c = Math.max(0, credits || 0);
  return { lines, plans, devices, credits: c, total: Math.max(0, round2(plans + devices - c)), phoneLines };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";
const deviceLabel = (d: string) => (d === "BYOD" ? "Bring your own phone" : d || "Line");

/** Plain-text quote, ready to paste into a text or email. */
export function quoteText(c: Contact, settings: Settings) {
  const items = parseLines(c);
  const q = priceQuote(items, c.credits ?? 0, settings);
  const out: string[] = [];
  out.push(`Verizon quote for ${c.name}`);
  out.push(`${c.product}${q.lines.length ? ` · ${q.lines.length} line${q.lines.length > 1 ? "s" : ""}` : ""}`);
  out.push("");
  q.lines.forEach((l, i) => {
    const parts = [`${i + 1}. ${deviceLabel(l.device)}`];
    if (l.plan) parts.push(l.plan);
    let line = parts.join(" · ") + (l.who ? ` (${l.who})` : "");
    const money2 = [l.planPrice ? `${money(l.planPrice)} plan` : "", l.devicePay ? `${money(l.devicePay)} phone` : ""].filter(Boolean).join(" + ");
    if (money2) line += ` — ${money2}`;
    out.push(line);
  });
  if (q.lines.length) out.push("");
  if (q.credits) out.push(`Credits: -${money(q.credits)}/mo`);
  out.push(`Total: ${money(c.monthlyQuote || q.total)}/mo with AutoPay, plus taxes & fees`);
  if (c.details) out.push(`Includes: ${c.details}`);
  if (settings.yourName) { out.push(""); out.push(`${settings.yourName}, Verizon`); }
  return out.join("\n");
}

export function fillTemplate(body: string, c: Contact, settings: Settings) {
  const items = parseLines(c).filter((l) => l.device || l.plan);
  const phones = items.map((l) => l.device).filter((d) => d && d !== "BYOD");
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    xs.filter(Boolean).forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
    return Array.from(m, ([k, n]) => (n > 1 ? `${n}x ${k}` : k)).join(", ");
  };
  const vars: Record<string, string> = {
    first: firstName(c.name),
    name: c.name,
    me: settings.yourName || "your rep",
    monthly: money(c.monthlyQuote || 0),
    lines: items.length ? `${items.length} line${items.length > 1 ? "s" : ""}` : c.product,
    device: count(phones) || (items.some((l) => l.device === "BYOD") ? "your own phone" : "the new phone"),
    plan: count(items.map((l) => l.plan)) || "the plan",
    product: c.product,
  };
  return body.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
export const TEMPLATE_VARS = ["{first}", "{name}", "{me}", "{monthly}", "{lines}", "{device}", "{plan}", "{product}"];

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
export const smsWithBody = (phone: string, body: string) => `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
