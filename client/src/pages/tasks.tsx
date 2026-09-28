import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneCall, Plus } from "lucide-react";
import { CallRow, EmptyState, PageHeader, useUI } from "@/components/common";
import { dueDiff, todayStr, useContacts, useSaveTask, useTasks, type Task } from "@/lib/crm";
import { CALL_REASONS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Callbacks({ embedded = false }: { embedded?: boolean }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: contacts = [] } = useContacts();
  const save = useSaveTask();
  const { newCall } = useUI();
  const { toast } = useToast();
  const [view, setView] = useState("open");
  const [who, setWho] = useState("all");
  const [cid, setCid] = useState("");
  const [reason, setReason] = useState<string>("Follow up on quote");
  const [due, setDue] = useState(todayStr());
  const byId = new Map(contacts.map((c) => [c.id, c]));

  const quickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cid) return;
    save.mutate({ data: { title: reason, dueDate: due || null, contactId: Number(cid), done: false, notes: "" } }, {
      onSuccess: () => { setCid(""); toast({ title: "Callback scheduled", description: `${byId.get(Number(cid))?.name} · ${reason}` }); },
    });
  };

  const all = (tasks ?? []).filter((t) => {
    if (who === "all") return true;
    const c = t.contactId ? byId.get(t.contactId) : undefined;
    return c?.status === who;
  });
  const open = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  const groups: [string, Task[]][] = view === "open" ? [
    ["Overdue", open.filter((t) => t.dueDate && dueDiff(t.dueDate) < 0)],
    ["Today", open.filter((t) => t.dueDate && dueDiff(t.dueDate) === 0)],
    ["This week", open.filter((t) => t.dueDate && dueDiff(t.dueDate) > 0 && dueDiff(t.dueDate) <= 7)],
    ["Later", open.filter((t) => t.dueDate && dueDiff(t.dueDate) > 7)],
    ["No date", open.filter((t) => !t.dueDate)],
  ] : [["Completed", done]];

  return (
    <div className={embedded ? "" : "max-w-4xl"}>
      {!embedded && <PageHeader title="Callbacks" subtitle="Everyone you need to call: lead follow-ups and check-ins with sold customers." />}

      <Card className="p-3 mb-5">
        <form onSubmit={quickAdd} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1.2fr_auto_auto] gap-2">
          <Select value={cid} onValueChange={setCid}>
            <SelectTrigger className="col-span-2 sm:col-span-1" data-testid="select-quick-contact"><SelectValue placeholder="Who to call…" /></SelectTrigger>
            <SelectContent>{contacts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger data-testid="select-quick-reason"><SelectValue /></SelectTrigger>
            <SelectContent>{CALL_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-40" data-testid="input-quick-due" />
          <Button type="submit" className="col-span-2 sm:col-span-1" disabled={!cid || save.isPending} data-testid="button-quick-add">Add</Button>
        </form>
      </Card>

      <div className="flex items-center justify-between gap-3 mb-3">
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="open" data-testid="tab-open">To call <span className="ml-1.5 text-xs text-muted-foreground tabular">{open.length}</span></TabsTrigger>
            <TabsTrigger value="done" data-testid="tab-done">Done <span className="ml-1.5 text-xs text-muted-foreground tabular">{done.length}</span></TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="w-40" data-testid="select-who-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="lead">Leads only</SelectItem>
            <SelectItem value="checkup">Check up only</SelectItem>
            <SelectItem value="closed">Closed only</SelectItem>
            <SelectItem value="lost">Lost only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Skeleton className="h-64" /> : groups.every(([, l]) => l.length === 0) ? (
        <Card><EmptyState icon={PhoneCall} title={view === "open" ? "No calls to make" : "Nothing completed yet"} body={view === "open" ? "Schedule a callback above to stay on top of your quotes." : "Checked-off calls show up here."} /></Card>
      ) : (
        <div className="space-y-5">
          {groups.filter(([, l]) => l.length).map(([label, list]) => (
            <Card key={label} className="px-4 py-2">
              <div className={`text-xs font-medium uppercase tracking-wide pt-2 ${label === "Overdue" ? "text-primary" : "text-muted-foreground"}`}>{label} <span className="tabular">· {list.length}</span></div>
              <div className="divide-y">{list.map((t) => <CallRow key={t.id} task={t} contact={t.contactId ? byId.get(t.contactId) : undefined} />)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
