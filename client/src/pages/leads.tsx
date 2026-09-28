import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common";
import { CustomerList } from "@/pages/contacts";
import Callbacks from "@/pages/tasks";
import { dueDiff, useContacts, useTasks } from "@/lib/crm";

const VIEWS = ["leads", "calls", "lost"] as const;

export default function Leads() {
  const { data: contacts = [] } = useContacts();
  const { data: tasks = [] } = useTasks();
  const [view, setView] = useState<string>(() => {
    const s = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("s");
    return VIEWS.includes(s as any) ? s! : "leads";
  });
  const leads = contacts.filter((c) => c.status === "lead").length;
  const lost = contacts.filter((c) => c.status === "lost").length;
  const due = tasks.filter((t) => !t.done && t.dueDate && dueDiff(t.dueDate) <= 0).length;

  return (
    <div>
      <PageHeader title="Leads" subtitle="People you've quoted, who you need to call back, and the ones that got away." />
      <Tabs value={view} onValueChange={setView} className="mb-5">
        <TabsList>
          <TabsTrigger value="leads" data-testid="tab-leads">Leads <span className="ml-1.5 text-xs text-muted-foreground tabular">{leads}</span></TabsTrigger>
          <TabsTrigger value="calls" data-testid="tab-calls">Callbacks {due > 0 && <span className="ml-1.5 text-xs font-bold text-primary tabular">{due}</span>}</TabsTrigger>
          <TabsTrigger value="lost" data-testid="tab-lost">Lost <span className="ml-1.5 text-xs text-muted-foreground tabular">{lost}</span></TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "leads" && <CustomerList key="leads" statuses={["lead"]} emptyTitle="No open leads" emptyBody="Tap New quote when someone comes in." />}
      {view === "calls" && <Callbacks embedded />}
      {view === "lost" && <CustomerList key="lost" statuses={["lost"]} emptyTitle="No lost leads" emptyBody="Leads you mark Lost show up here." />}
    </div>
  );
}
