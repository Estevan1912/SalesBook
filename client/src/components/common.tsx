import { createContext, useContext, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Phone, MoreHorizontal, Pencil, Trash2, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerDialog, CallDialog } from "@/components/dialogs";
import { TextDialog } from "@/components/quick";
import { STATUS_LABEL, STATUS_STYLE, dueDiff, dueLabel, initials, perMo, telHref, useDeleteTask, useSaveTask, type Contact, type Task } from "@/lib/crm";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-label="Sales Book" className={className}>
      <rect x="1" y="1" width="30" height="30" rx="7" className="fill-foreground" />
      <path d="M9 16.5l4.5 4.5L23 10" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLE[status])} data-testid={`badge-status-${status}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Avatar({ contact, size = "md" }: { contact: Contact; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={cn("avatar shrink-0 rounded-full grid place-items-center font-medium",
      size === "sm" && "h-8 w-8 text-xs", size === "md" && "h-9 w-9 text-sm", size === "lg" && "h-14 w-14 text-lg")}
      style={{ "--h": (contact.id * 47) % 360 } as React.CSSProperties}>
      {initials(contact.name)}
    </div>
  );
}

/** A callback in the to-do list. */
export function CallRow({ task, contact, showContact = true }: { task: Task; contact?: Contact; showContact?: boolean }) {
  const save = useSaveTask();
  const del = useDeleteTask();
  const { editCall } = useUI();
  const overdue = !task.done && task.dueDate && dueDiff(task.dueDate) < 0;
  const today = !task.done && task.dueDate && dueDiff(task.dueDate) === 0;
  return (
    <div className="group flex items-center gap-3 py-3" data-testid={`row-task-${task.id}`}>
      <Checkbox checked={task.done} onCheckedChange={(v) => save.mutate({ id: task.id, data: { done: !!v } })}
        aria-label={`Mark "${task.title}" ${task.done ? "not done" : "done"}`} data-testid={`checkbox-task-${task.id}`} />
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm leading-snug", task.done && "line-through text-muted-foreground")}>
          {showContact && contact ? (
            <><Link href={`/customers/${contact.id}`} className="font-medium hover:underline underline-offset-2" data-testid={`link-task-contact-${task.id}`}>{contact.name}</Link>
              <span className="text-muted-foreground"> · {task.title}</span></>
          ) : <span className="font-medium">{task.title}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className={cn(overdue && "text-primary font-medium", today && "text-foreground font-medium")}>{dueLabel(task.dueDate)}</span>
          {showContact && contact && <span>{contact.product}{contact.monthlyQuote ? ` · ${perMo(contact.monthlyQuote)}` : ""}</span>}
          {task.notes && <span className="truncate max-w-[28ch] sm:max-w-[48ch]">{task.notes}</span>}
        </div>
      </div>
      {contact?.phone && !task.done && (
        <Button size="sm" variant="outline" asChild className="shrink-0" data-testid={`button-call-${task.id}`}>
          <a href={telHref(contact.phone)}><Phone className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline tabular">{contact.phone}</span></a>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Callback actions" data-testid={`button-task-menu-${task.id}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => editCall(task)}><Pencil className="h-4 w-4 mr-2" />Edit / reschedule</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => del.mutate(task.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: any; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <div className="h-10 w-10 rounded-full bg-muted grid place-items-center mb-3"><Icon className="h-5 w-5 text-muted-foreground" /></div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1 max-w-xs">{body}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type UICtx = {
  newCustomer: () => void;
  editCustomer: (c: Contact) => void;
  newCall: (contactId?: number) => void;
  editCall: (t: Task) => void;
  textCustomer: (c: Contact) => void;
};
const Ctx = createContext<UICtx | null>(null);
export const useUI = () => useContext(Ctx)!;

export function UIProvider({ children }: { children: ReactNode }) {
  const [cOpen, setCOpen] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [tOpen, setTOpen] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [taskContact, setTaskContact] = useState<number>();
  const [txOpen, setTxOpen] = useState(false);
  const [txContact, setTxContact] = useState<Contact | null>(null);
  const value: UICtx = {
    newCustomer: () => { setContact(null); setCOpen(true); },
    editCustomer: (c) => { setContact(c); setCOpen(true); },
    newCall: (cid) => { setTask(null); setTaskContact(cid); setTOpen(true); },
    editCall: (t) => { setTask(t); setTaskContact(undefined); setTOpen(true); },
    textCustomer: (c) => { setTxContact(c); setTxOpen(true); },
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <CustomerDialog open={cOpen} onOpenChange={setCOpen} contact={contact} />
      <CallDialog open={tOpen} onOpenChange={setTOpen} task={task} contactId={taskContact} />
      <TextDialog open={txOpen} onOpenChange={setTxOpen} contact={txContact} />
    </Ctx.Provider>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export { CalendarPlus };
