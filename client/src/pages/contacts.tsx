import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Users, Phone } from "lucide-react";
import { Avatar, EmptyState, PageHeader, StatusBadge, useUI } from "@/components/common";
import { dueLabel, linesSummary, perMo, telHref, useContacts, useTasks, dueDiff } from "@/lib/crm";
import { PRODUCTS } from "@shared/schema";
import { downloadContactsCsv } from "@/lib/localdb";
import { cn } from "@/lib/utils";

type TabDef = [value: string, label: string, statuses: string[]];
export default function Customers() {
  return <CustomerList statuses={["closed"]} title="Customers" subtitle="Accounts you've closed." />;
}

export function CustomerList({ tabs, title, subtitle, statuses, emptyTitle = "No one here yet", emptyBody = "Add a new quote to start your book." }: {
  tabs?: TabDef[]; title?: string; subtitle?: string; statuses?: string[]; emptyTitle?: string; emptyBody?: string;
}) {
  const { data: contacts, isLoading } = useContacts();
  const { data: tasks = [] } = useTasks();
  const { newCustomer } = useUI();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(() => {
    const s = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("s");
    return tabs?.some((t) => t[0] === s) ? s! : tabs?.[0][0] ?? "all";
  });
  const allowed = statuses ?? tabs?.find((t) => t[0] === status)?.[2] ?? [];
  const showStatus = allowed.length > 1;
  const inScope = (c: { status: string }) => allowed.includes(c.status);
  const [product, setProduct] = useState("all");
  const [sort, setSort] = useState("recent");

  const nextCall = useMemo(() => {
    const m = new Map<number, string>();
    tasks.filter((t) => !t.done && t.dueDate && t.contactId).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .forEach((t) => { if (!m.has(t.contactId!)) m.set(t.contactId!, t.dueDate!); });
    return m;
  }, [tasks]);

  const rows = useMemo(() => {
    let list = (contacts ?? []).filter((c) => inScope(c) && (product === "all" || c.product === product));
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    if (s) list = list.filter((c) => [c.name, c.email, c.details, c.notes, c.product, c.carrier, c.lineItems].join(" ").toLowerCase().includes(s) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)));
    const out = [...list];
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "quote") out.sort((a, b) => b.monthlyQuote - a.monthlyQuote);
    if (sort === "next") out.sort((a, b) => (nextCall.get(a.id) ?? "9999").localeCompare(nextCall.get(b.id) ?? "9999"));
    return out;
  }, [contacts, q, status, product, sort, nextCall, allowed.join()]);

  const count = (st: string[]) => (contacts ?? []).filter((c) => st.includes(c.status)).length;

  return (
    <div>
      {title && <PageHeader title={title} subtitle={subtitle}>
        <Button variant="outline" size="sm" onClick={downloadContactsCsv} data-testid="button-export">
          <Download className="h-4 w-4 mr-1" />Export CSV
        </Button>
      </PageHeader>}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        {tabs && (
          <Tabs value={status} onValueChange={setStatus}>
            <TabsList>
              {tabs.map(([v, l, st]) => (
                <TabsTrigger key={v} value={v} data-testid={`tab-status-${v}`}>{l} <span className="ml-1.5 text-xs text-muted-foreground tabular">{count(st)}</span></TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <div className="relative flex-1 min-w-[180px] lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" className="pl-8" data-testid="input-search" />
          </div>
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="w-40" data-testid="select-product-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sale types</SelectItem>
              {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-36" data-testid="select-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Newest</SelectItem>
              <SelectItem value="next">Next call</SelectItem>
              <SelectItem value="quote">Monthly quote</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title={q ? "No matches" : emptyTitle} body={q ? "Try a different name or number." : emptyBody}
            action={!q && <Button size="sm" onClick={newCustomer} data-testid="button-empty-add">New quote</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/40">
                <tr className="text-left">
                  <th className="font-medium px-4 py-2.5">Customer</th>
                  <th className="font-medium px-4 py-2.5 hidden md:table-cell">Phones & plan</th>
                  <th className="font-medium px-4 py-2.5 text-right">Monthly</th>
                  {showStatus && <th className="font-medium px-4 py-2.5 hidden sm:table-cell">Status</th>}
                  <th className="font-medium px-4 py-2.5 hidden lg:table-cell">Next call</th>
                  <th className="px-2 py-2.5 w-10"><span className="sr-only">Call</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => {
                  const nc = nextCall.get(c.id);
                  return (
                    <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="cursor-pointer hover:bg-muted/40 transition-colors" data-testid={`row-contact-${c.id}`}>
                      <td className="pl-3 pr-2 sm:px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="hidden sm:block"><Avatar contact={c} size="sm" /></span>
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-2 max-w-[48vw] sm:max-w-none">{c.name}{showStatus && <span className="sm:hidden"><StatusBadge status={c.status} /></span>}</div>
                            <div className="text-xs text-muted-foreground tabular">{c.phone || "No phone"}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[42vw] md:hidden">{linesSummary(c) || c.product}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell max-w-[320px]">
                        <div className="font-medium">{c.product}{c.lines > 1 ? ` · ${c.lines} lines` : ""}</div>
                        <div className="text-xs text-muted-foreground truncate">{linesSummary(c) || c.details || "—"}</div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-right tabular font-medium whitespace-nowrap">{perMo(c.monthlyQuote)}</td>
                      {showStatus && <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={c.status} /></td>}
                      <td className={cn("px-4 py-3 text-xs hidden lg:table-cell", nc && dueDiff(nc) < 0 ? "text-primary font-medium" : "text-muted-foreground")}>{nc ? dueLabel(nc) : "—"}</td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        {c.phone && <Button size="icon" variant="ghost" className="h-8 w-8" asChild><a href={telHref(c.phone)} aria-label={`Call ${c.name}`} data-testid={`button-call-row-${c.id}`}><Phone className="h-4 w-4" /></a></Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
