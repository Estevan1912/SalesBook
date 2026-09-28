import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Phone, MessageSquare, Mail, Pencil, Trash2, Plus, X, PhoneCall, PhoneMissed, Voicemail, StickyNote, Users, Copy } from "lucide-react";
import { Avatar, CallRow, EmptyState, useUI } from "@/components/common";
import { StatusToggle } from "@/components/dialogs";
import {
  OUTCOME_LABEL, ago, closeQuoteFollowups, isSold, parseLines, perMo, scheduleSaleCheckins, shortDate, telHref, todayStr, useActivities, useAddActivity,
  useContacts, useDeleteActivity, useDeleteContact, useSaveContact, useTasks,
} from "@/lib/crm";
import { useToast } from "@/hooks/use-toast";
import { copyText, priceQuote, quoteText, useSettings } from "@/lib/quote";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const OUT_ICON: Record<string, any> = { talked: PhoneCall, "no answer": PhoneMissed, voicemail: Voicemail, texted: MessageSquare, note: StickyNote };

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);
  const { data: contacts, isLoading } = useContacts();
  const { data: tasks = [] } = useTasks();
  const { data: acts = [] } = useActivities(cid);
  const { editCustomer, newCall, textCustomer } = useUI();
  const { settings } = useSettings();
  const save = useSaveContact();
  const del = useDeleteContact();
  const addAct = useAddActivity();
  const delAct = useDeleteActivity();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [note, setNote] = useState("");

  const c = contacts?.find((x) => x.id === cid);
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (!c) return <EmptyState icon={Users} title="Customer not found" body="They may have been deleted." action={<Button asChild size="sm" variant="outline"><Link href="/customers">Back to customers</Link></Button>} />;

  const mine = tasks.filter((t) => t.contactId === cid);
  const openCalls = mine.filter((t) => !t.done);
  const doneCalls = mine.filter((t) => t.done);

  const setStatus = (s: string) => {
    if (s === c.status) return;
    const becameSold = isSold(s) && !isSold(c.status);
    save.mutate({ id: cid, data: { status: s, saleDate: isSold(s) ? (c.saleDate || todayStr()) : null } }, {
      onSuccess: async () => {
        if (becameSold && s === "checkup") {
          await scheduleSaleCheckins(cid);
          toast({ title: "Sold — added to Check up", description: "Check-in calls scheduled for 3 and 30 days out." });
        } else if (becameSold) {
          await closeQuoteFollowups(cid);
          toast({ title: "Sold — marked Closed" });
        } else toast({ title: `Moved to ${s === "lead" ? "Leads" : s === "checkup" ? "Check up" : s === "closed" ? "Closed" : "Lost"}` });
      },
    });
  };
  const copyQuote = async () => {
    const ok = await copyText(quoteText(c, settings));
    toast({ title: ok ? "Quote copied" : "Couldn't copy", description: ok ? "Paste it into a text or email." : undefined });
  };
  const priced = priceQuote(parseLines(c), c.credits ?? 0, settings);
  const log = (type: string, body = note.trim()) => {
    if (type === "note" && !body) return;
    addAct.mutate({ contactId: cid, type, body }, { onSuccess: () => { setNote(""); toast({ title: OUTCOME_LABEL[type], description: "Added to call log" }); } });
  };

  return (
    <div>
      <Link href={isSold(c.status) ? "/customers" : c.status === "lost" ? "/leads?s=lost" : "/leads"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" />{isSold(c.status) ? "Customers" : "Leads"}
      </Link>

      <div className="flex flex-wrap items-start gap-4 mb-6">
        <Avatar contact={c} size="lg" />
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-contact-name">{c.name}</h1>
          <div className="text-sm text-muted-foreground mt-0.5 tabular">{c.phone || "No phone"}{c.email ? ` · ${c.email}` : ""}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {c.phone && <Button size="sm" asChild data-testid="button-call"><a href={telHref(c.phone)}><Phone className="h-4 w-4 mr-1.5" />Call</a></Button>}
            {c.phone && <Button size="sm" variant="outline" onClick={() => textCustomer(c)} data-testid="button-text"><MessageSquare className="h-4 w-4 mr-1.5" />Text</Button>}
            <Button size="sm" variant="outline" onClick={copyQuote} data-testid="button-copy-quote"><Copy className="h-4 w-4 mr-1.5" />Copy quote</Button>
            {c.email && <Button size="sm" variant="outline" asChild data-testid="button-email"><a href={`mailto:${c.email}`} target="_blank" rel="noopener noreferrer"><Mail className="h-4 w-4 mr-1.5" />Email</a></Button>}
          </div>
        </div>
        <div className="flex w-full sm:w-auto flex-wrap sm:flex-col items-center sm:items-end justify-between gap-3">
          <StatusToggle value={c.status} onChange={setStatus} size="sm" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => editCustomer(c)} data-testid="button-edit-contact"><Pencil className="h-4 w-4 mr-1" />Edit</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive" aria-label="Delete customer" data-testid="button-delete-contact"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {c.name}?</AlertDialogTitle>
                  <AlertDialogDescription>This removes the customer and their call log. Their callbacks stay but are unlinked.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction data-testid="button-confirm-delete" onClick={() => del.mutate(cid, { onSuccess: () => { toast({ title: "Customer deleted" }); navigate(isSold(c.status) ? "/customers" : "/leads"); } })}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">{isSold(c.status) ? "What they got" : "What you quoted"}</h2>
              <div className="flex">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyQuote} aria-label="Copy quote" data-testid="button-copy-quote-card"><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => editCustomer(c)} aria-label="Edit quote" data-testid="button-edit-quote"><Pencil className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div className="text-2xl font-bold tabular" data-testid="text-monthly">{perMo(c.monthlyQuote)}</div>
            <div className="text-sm mt-1 font-medium">{c.product}{c.lines ? ` · ${c.lines} line${c.lines > 1 ? "s" : ""}` : ""}</div>
            {parseLines(c).length > 0 && (
              <ol className="mt-3 space-y-1.5" data-testid="list-lines">
                {priced.lines.map((l, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm rounded-md bg-muted/50 px-2.5 py-2">
                    <span className="text-xs text-muted-foreground tabular w-4 pt-0.5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{l.device === "BYOD" ? "BYOD · own phone" : l.device || "No phone picked"}</div>
                      <div className="text-xs text-muted-foreground">{l.plan || "No plan"}{l.who ? ` · ${l.who}` : ""}</div>
                    </div>
                    {l.total > 0 && <div className="text-xs tabular text-right text-muted-foreground whitespace-nowrap pt-0.5">
                      <div className="font-medium text-foreground">{perMo(l.total)}</div>
                      {l.devicePay > 0 && <div>{perMo(l.planPrice)} + {perMo(l.devicePay)}</div>}
                    </div>}
                  </li>
                ))}
              </ol>
            )}
            {priced.credits > 0 && <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Credits</span><span className="tabular">−{perMo(priced.credits)}</span></div>}
            {c.details && <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{c.details}</p>}
            <dl className="grid grid-cols-2 gap-3 text-sm mt-4 pt-4 border-t">
              <div><dt className="text-xs text-muted-foreground">Coming from</dt><dd className="mt-0.5">{c.carrier || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{isSold(c.status) ? "Sale date" : "Added"}</dt><dd className="mt-0.5">{isSold(c.status) ? shortDate(c.saleDate) : format(parseISO(c.createdAt), "MMM d, yyyy")}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Last contact</dt><dd className="mt-0.5">{ago(c.lastContacted)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Calls logged</dt><dd className="mt-0.5 tabular">{acts.filter((a) => a.type !== "note").length}</dd></div>
            </dl>
            {c.notes && <div className="mt-4 pt-4 border-t text-sm whitespace-pre-wrap"><div className="text-xs text-muted-foreground mb-1">Notes</div>{c.notes}</div>}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Callbacks</h2>
              <Button size="sm" variant="ghost" onClick={() => newCall(cid)} data-testid="button-add-callback"><Plus className="h-4 w-4 mr-1" />Schedule</Button>
            </div>
            {mine.length === 0 ? (
              <EmptyState icon={PhoneCall} title="No callbacks scheduled" body={c.status === "lead" ? "Set a date to follow up on the quote." : c.status === "closed" ? "They're closed out. Schedule a call if something comes up." : "Schedule a check-in to keep in touch."}
                action={<Button size="sm" variant="outline" onClick={() => newCall(cid)} data-testid="button-empty-callback">Schedule a callback</Button>} />
            ) : (
              <div className="divide-y">
                {openCalls.map((t) => <CallRow key={t.id} task={t} showContact={false} />)}
                {doneCalls.map((t) => <CallRow key={t.id} task={t} showContact={false} />)}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold mb-3">Call log</h2>
            <div className="rounded-lg border p-3 mb-4">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="What happened? e.g. Wants to wait for Black Friday deals"
                className="border-0 shadow-none focus-visible:ring-0 px-1 resize-none" data-testid="input-activity" />
              <div className="flex flex-wrap gap-2 mt-2">
                {(["talked", "no answer", "voicemail", "texted", "note"] as const).map((t) => {
                  const I = OUT_ICON[t];
                  return (
                    <Button key={t} size="sm" variant={t === "talked" ? "default" : "outline"} onClick={() => log(t)}
                      disabled={addAct.isPending || (t === "note" && !note.trim())} data-testid={`button-log-${t.replace(" ", "-")}`}>
                      <I className="h-3.5 w-3.5 mr-1.5" />{OUTCOME_LABEL[t]}
                    </Button>
                  );
                })}
              </div>
            </div>
            {acts.length === 0 ? <div className="text-sm text-muted-foreground py-4 text-center">No calls logged yet.</div> : (
              <ol className="relative border-l ml-2 space-y-4">
                {acts.map((a) => {
                  const I = OUT_ICON[a.type] ?? StickyNote;
                  return (
                    <li key={a.id} className="group ml-5" data-testid={`item-activity-${a.id}`}>
                      <span className={cn("absolute -left-[11px] h-5 w-5 rounded-full bg-card border grid place-items-center", a.type === "talked" && "border-primary")}>
                        <I className={cn("h-3 w-3 text-muted-foreground", a.type === "talked" && "text-primary")} />
                      </span>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">{OUTCOME_LABEL[a.type] ?? a.type}</span> · {format(parseISO(a.date), "MMM d, h:mm a")}</div>
                          {a.body && <div className="text-sm mt-0.5 whitespace-pre-wrap">{a.body}</div>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Delete entry" onClick={() => delAct.mutate(a.id)} data-testid={`button-delete-activity-${a.id}`}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
