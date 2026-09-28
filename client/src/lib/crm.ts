import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Contact, Task, Activity, InsertContact, InsertTask, InsertActivity, LineItem } from "@shared/schema";
export { isSold } from "@shared/schema";
import { format, differenceInCalendarDays, parseISO, formatDistanceToNowStrict, addDays } from "date-fns";

export type { Contact, Task, Activity, LineItem };

export const STATUS_LABEL: Record<string, string> = { lead: "Lead", checkup: "Check up", closed: "Closed", lost: "Lost" };
export const STATUS_STYLE: Record<string, string> = {
  lead: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  checkup: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-300",
  closed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  lost: "bg-muted text-muted-foreground",
};
export const OUTCOME_LABEL: Record<string, string> = {
  talked: "Talked", "no answer": "No answer", voicemail: "Left voicemail", texted: "Texted", note: "Note",
};

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const perMo = (n: number) => (n ? `${money(n)}/mo` : "—");
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
export const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
export const smsHref = (p: string) => `sms:${p.replace(/[^\d+]/g, "")}`;
export function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  const x = d.length === 11 && d[0] === "1" ? d.slice(1) : d;
  if (x.length < 4) return x;
  if (x.length < 7) return `(${x.slice(0, 3)}) ${x.slice(3)}`;
  return `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6, 10)}`;
}
export const todayStr = () => format(new Date(), "yyyy-MM-dd");
export const inDays = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");
export const dueDiff = (d: string) => differenceInCalendarDays(parseISO(d), new Date());
export function dueLabel(d?: string | null) {
  if (!d) return "No date";
  const diff = dueDiff(d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return format(parseISO(d), "EEEE");
  return format(parseISO(d), "MMM d");
}
export const ago = (iso?: string | null) => (iso ? `${formatDistanceToNowStrict(parseISO(iso))} ago` : "Never");
export const daysSince = (iso?: string | null) => (iso ? -differenceInCalendarDays(parseISO(iso), new Date()) : Infinity);
export function parseLines(c: Pick<Contact, "lineItems">): LineItem[] {
  try { const v = JSON.parse(c.lineItems || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
/** "2x iPhone 18 Pro, BYOD · Unlimited Plus" */
export function linesSummary(c: Pick<Contact, "lineItems">) {
  const ls = parseLines(c).filter((l) => l.device || l.plan);
  if (!ls.length) return "";
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    xs.filter(Boolean).forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
    return Array.from(m, ([k, n]) => (n > 1 ? `${n}x ${k}` : k)).join(", ");
  };
  return [count(ls.map((l) => l.device)), count(ls.map((l) => l.plan))].filter(Boolean).join(" · ");
}
export const shortDate = (d?: string | null) => (d ? format(parseISO(d), "MMM d, yyyy") : "—");

export const useContacts = () => useQuery<Contact[]>({ queryKey: ["/api/contacts"] });
export const useTasks = () => useQuery<Task[]>({ queryKey: ["/api/tasks"] });
export const useActivities = (contactId?: number) =>
  useQuery<Activity[]>({
    queryKey: ["/api/activities", contactId ?? "all"],
    queryFn: async () => (await apiRequest("GET", `/api/activities${contactId ? `?contactId=${contactId}` : ""}`)).json(),
  });

const invalidate = (...keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

export const createTask = async (data: Partial<InsertTask>) =>
  (await apiRequest("POST", "/api/tasks", { done: false, notes: "", ...data })).json() as Promise<Task>;

export function useSaveContact() {
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: Partial<InsertContact> }) =>
      (await apiRequest(id ? "PATCH" : "POST", id ? `/api/contacts/${id}` : "/api/contacts", data)).json() as Promise<Contact>,
    onSuccess: () => invalidate("/api/contacts", "/api/tasks"),
  });
}
export function useDeleteContact() {
  return useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/contacts/${id}`),
    onSuccess: () => invalidate("/api/contacts", "/api/tasks", "/api/activities"),
  });
}
export function useSaveTask() {
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: Partial<InsertTask> }) =>
      id ? (await apiRequest("PATCH", `/api/tasks/${id}`, data)).json() as Promise<Task> : createTask(data),
    onMutate: async ({ id, data }) => {
      if (!id) return;
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const prev = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      queryClient.setQueryData<Task[]>(["/api/tasks"], (old) => old?.map((t) => (t.id === id ? ({ ...t, ...data } as Task) : t)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && queryClient.setQueryData(["/api/tasks"], ctx.prev),
    onSettled: () => invalidate("/api/tasks"),
  });
}
export function useDeleteTask() {
  return useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSuccess: () => invalidate("/api/tasks"),
  });
}
export function useAddActivity() {
  return useMutation({
    mutationFn: async (data: InsertActivity) => (await apiRequest("POST", "/api/activities", data)).json(),
    onSuccess: () => invalidate("/api/activities", "/api/contacts"),
  });
}
export function useDeleteActivity() {
  return useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/activities/${id}`),
    onSuccess: () => invalidate("/api/activities"),
  });
}

/** When a customer becomes Sold: schedule a 3-day and 30-day check-in call. */
/** They bought — any open "follow up on quote" calls are done. */
export async function closeQuoteFollowups(contactId: number) {
  const cached = queryClient.getQueryData<Task[]>(["/api/tasks"]) ?? [];
  for (const t of cached.filter((t) => t.contactId === contactId && !t.done && t.title === "Follow up on quote")) {
    await apiRequest("PATCH", `/api/tasks/${t.id}`, { done: true });
  }
  invalidate("/api/tasks");
}
export async function scheduleSaleCheckins(contactId: number) {
  await closeQuoteFollowups(contactId);
  await createTask({ title: "Check-in after sale", contactId, dueDate: inDays(3), notes: "Make sure everything's working, answer bill questions" });
  await createTask({ title: "Check-in after sale", contactId, dueDate: inDays(30), notes: "30-day check-in: first bill OK? Ask for a referral" });
  invalidate("/api/tasks");
}
