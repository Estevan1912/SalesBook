import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";
import { Avatar, CallRow, EmptyState, PageHeader, useUI } from "@/components/common";
import { dueDiff, isSold, money, perMo, useContacts, useTasks } from "@/lib/crm";
import { format } from "date-fns";

function Kpi({ label, value, hint, testid }: { label: string; value: string; hint?: string; testid: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-2 text-xl font-bold tabular" data-testid={testid}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { data: contacts, isLoading } = useContacts();
  const { data: tasks = [] } = useTasks();
  const { newCall } = useUI();
  const byId = new Map((contacts ?? []).map((c) => [c.id, c]));

  if (isLoading || !contacts) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-72" /></div>;
  }

  const open = tasks.filter((t) => !t.done);
  const dueNow = open.filter((t) => t.dueDate && dueDiff(t.dueDate) <= 0).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const overdue = dueNow.filter((t) => dueDiff(t.dueDate!) < 0);
  const upcoming = open.filter((t) => t.dueDate && dueDiff(t.dueDate) > 0 && dueDiff(t.dueDate) <= 7);
  const leads = contacts.filter((c) => c.status === "lead");
  const leadQuoted = leads.reduce((s, c) => s + c.monthlyQuote, 0);
  const monthKey = format(new Date(), "yyyy-MM");
  const soldMonth = contacts.filter((c) => isSold(c.status) && c.saleDate?.startsWith(monthKey));
  const sold = contacts.filter((c) => isSold(c.status));
  const lost = contacts.filter((c) => c.status === "lost");
  const closeRate = sold.length + lost.length ? Math.round((sold.length / (sold.length + lost.length)) * 100) : 0;
  const withCallback = new Set(open.map((t) => t.contactId));
  const noCallback = leads.filter((c) => !withCallback.has(c.id));

  return (
    <div>
      <PageHeader title="Today" subtitle={`${format(new Date(), "EEEE, MMMM d")} · ${dueNow.length ? `${dueNow.length} call${dueNow.length > 1 ? "s" : ""} to make` : "No calls due"}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Calls due" value={String(dueNow.length)} hint={overdue.length ? `${overdue.length} overdue` : "Nothing overdue"} testid="kpi-due" />
        <Kpi label="Open leads" value={String(leads.length)} hint={`${money(leadQuoted)}/mo quoted`} testid="kpi-leads" />
        <Kpi label={`Sold in ${format(new Date(), "MMMM")}`} value={String(soldMonth.length)} hint={`${money(soldMonth.reduce((s, c) => s + c.monthlyQuote, 0))}/mo · ${soldMonth.reduce((s, c) => s + c.lines, 0)} lines`} testid="kpi-sold" />
        <Kpi label="Close rate" value={`${closeRate}%`} hint={`${sold.length} sold · ${lost.length} lost`} testid="kpi-close" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold">Calls to make</h2>
            <Link href="/leads?s=calls" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="link-all-calls">All callbacks <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {dueNow.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="You're caught up" body="No callbacks due today."
              action={<Button size="sm" variant="outline" onClick={() => newCall()} data-testid="button-empty-add-call">Schedule a callback</Button>} />
          ) : (
            <div className="divide-y">{dueNow.map((t) => <CallRow key={t.id} task={t} contact={t.contactId ? byId.get(t.contactId) : undefined} />)}</div>
          )}
          {upcoming.length > 0 && (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-5">Next 7 days</div>
              <div className="divide-y">{upcoming.map((t) => <CallRow key={t.id} task={t} contact={t.contactId ? byId.get(t.contactId) : undefined} />)}</div>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-primary" />Leads with no callback</h2>
            <p className="text-xs text-muted-foreground mb-3">Open quotes you haven't scheduled a call for</p>
            {noCallback.length === 0 ? <div className="text-sm text-muted-foreground py-3">Every lead has a callback set.</div> : (
              <div className="space-y-1">
                {noCallback.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-md py-1.5">
                    <Avatar contact={c} size="sm" />
                    <Link href={`/customers/${c.id}`} className="min-w-0 flex-1 hover:underline" data-testid={`link-nocb-${c.id}`}>
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.product} · {perMo(c.monthlyQuote)}</div>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => newCall(c.id)} data-testid={`button-schedule-${c.id}`}>Schedule</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
