import { useEffect } from "react";
import { useFieldArray } from "react-hook-form";
import { Plus, X, Copy } from "lucide-react";
import { copyText, quoteText, useSettings } from "@/lib/quote";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PRODUCTS, CARRIERS, CALL_REASONS, STATUSES, DEVICE_GROUPS, PLANS, isSold } from "@shared/schema";
import {
  STATUS_LABEL, closeQuoteFollowups, createTask, parseLines, formatPhone, inDays, todayStr, useContacts, useSaveContact, useSaveTask,
  type Contact, type Task,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

const customerForm = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string(),
  email: z.union([z.literal(""), z.string().email("Enter a valid email")]),
  status: z.string(),
  product: z.string(),
  details: z.string(),
  lineItems: z.array(z.object({ device: z.string(), plan: z.string(), who: z.string() })),
  monthlyQuote: z.string().refine((v) => v === "" || !isNaN(Number(v.replace(/[$,]/g, ""))), "Enter a number"),
  carrier: z.string(),
  saleDate: z.string(),
  notes: z.string(),
  callbackDate: z.string(),
  callbackReason: z.string(),
});
type CustomerForm = z.infer<typeof customerForm>;

const empty: CustomerForm = {
  name: "", phone: "", email: "", status: "lead", product: "New account", details: "", lineItems: [{ device: "", plan: "", who: "" }], monthlyQuote: "",
  carrier: "", saleDate: "", notes: "", callbackDate: inDays(1), callbackReason: "Follow up on quote",
};

const toMoney = (v: string) => Number(v.replace(/[$,]/g, "")) || 0;

function Field({ form, name, label, placeholder, type = "text", onChangeMap, inputMode }: any) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input type={type} inputMode={inputMode} placeholder={placeholder} {...field} value={field.value ?? ""}
            onChange={(e) => field.onChange(onChangeMap ? onChangeMap(e.target.value) : e.target.value)}
            data-testid={`input-${name}`} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}
function Pick({ form, name, label, options, placeholder = "Select" }: any) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={field.value || undefined} onValueChange={field.onChange}>
          <FormControl><SelectTrigger data-testid={`select-${name}`}><SelectValue placeholder={placeholder} /></SelectTrigger></FormControl>
          <SelectContent>{options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </FormItem>
    )} />
  );
}

export function StatusToggle({ value, onChange, size = "md" }: { value: string; onChange: (v: string) => void; size?: "sm" | "md" }) {
  const on: Record<string, string> = {
    lead: "bg-amber-500 text-white border-amber-500", closed: "bg-emerald-600 text-white border-emerald-600", lost: "bg-foreground/70 text-background border-foreground/70",
  };
  return (
    <div className="inline-flex rounded-lg border p-0.5 bg-muted/50" role="radiogroup" aria-label="Status">
      {STATUSES.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} onClick={() => onChange(s)}
          className={cn("rounded-md border border-transparent font-medium transition-colors whitespace-nowrap", size === "sm" ? "px-2 py-1 text-xs" : "px-4 py-1.5 text-sm",
            value === s ? on[s] : "text-muted-foreground hover:text-foreground")}
          data-testid={`status-${s}`}>
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export function CustomerDialog({ open, onOpenChange, contact, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; contact?: Contact | null; onSaved?: (c: Contact) => void;
}) {
  const save = useSaveContact();
  const { toast } = useToast();
  const form = useForm<CustomerForm>({ resolver: zodResolver(customerForm), defaultValues: empty });
  const status = form.watch("status");
  const wasSold = !!contact && isSold(contact.status);
  const lines = useFieldArray({ control: form.control, name: "lineItems" });

  useEffect(() => {
    if (!open) return;
    form.reset(contact ? {
      ...empty, name: contact.name, phone: contact.phone, email: contact.email, status: contact.status, product: contact.product,
      details: contact.details,
      lineItems: parseLines(contact).length ? parseLines(contact).map((l) => ({ device: l.device ?? "", plan: l.plan ?? "", who: l.who ?? "" })) : [{ device: "", plan: "", who: "" }],
      monthlyQuote: contact.monthlyQuote ? String(contact.monthlyQuote) : "",
      carrier: contact.carrier, saleDate: contact.saleDate ?? "", notes: contact.notes, callbackDate: "",
      callbackReason: "Follow up on quote",
    } : { ...empty, callbackDate: inDays(1) });
  }, [open, contact]);

  const { settings } = useSettings();

  const copyQuote = async () => {
    const v = form.getValues();
    const draft = {
      name: v.name || "Customer", product: v.product, details: v.details, monthlyQuote: toMoney(v.monthlyQuote),
      lineItems: JSON.stringify(v.lineItems.filter((l) => l.device || l.plan)),
    };
    const ok = await copyText(quoteText(draft, settings));
    toast({ title: ok ? "Quote copied" : "Couldn't copy", description: ok ? "Paste it into a text or email." : undefined });
  };

  const onSubmit = async (v: CustomerForm) => {
    const { callbackDate, callbackReason, lineItems, ...rest } = v;
    const kept = lineItems.filter((l) => l.device || l.plan || l.who.trim());
    const data = {
      ...rest,
      lineItems: JSON.stringify(kept.map((l) => ({ device: l.device, plan: l.plan, who: l.who.trim() }))),
      lines: kept.length,
      monthlyQuote: toMoney(v.monthlyQuote),
      saleDate: isSold(v.status) ? (v.saleDate || todayStr()) : null,
    };
    try {
      const c = await save.mutateAsync({ id: contact?.id, data });
      if (isSold(v.status) && !wasSold) await closeQuoteFollowups(c.id);
      if (v.status === "lead" && callbackDate) await createTask({ title: callbackReason, contactId: c.id, dueDate: callbackDate });
      toast({ title: contact ? "Saved" : "Customer added", description: c.name });
      onOpenChange(false); onSaved?.(c);
    } catch (e: any) {
      toast({ title: "Couldn't save", description: String(e.message), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>Who they are, what they came in for and what you quoted.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel><div><StatusToggle value={field.value} onChange={field.onChange} /></div></FormItem>
            )} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1"><Field form={form} name="name" label="Name" placeholder="First and last name" /></div>
              <Field form={form} name="phone" label="Phone" type="tel" inputMode="tel" placeholder="(760) 555-0100" onChangeMap={formatPhone} />
              <Field form={form} name="email" label="Email (optional)" type="email" placeholder="name@email.com" />
            </div>
            <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
              <div className="text-sm font-bold">{status === "lead" ? "What you quoted" : status === "lost" ? "What you quoted" : "What they got"}</div>
              <div className="grid grid-cols-2 gap-4">
                <Pick form={form} name="product" label="Type of sale" options={PRODUCTS} />
                <Pick form={form} name="carrier" label="Coming from" options={CARRIERS} placeholder="Unknown" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Lines <span className="text-muted-foreground font-normal tabular">· {lines.fields.length}</span></div>
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => lines.append({ device: "", plan: form.getValues("lineItems").at(-1)?.plan ?? "", who: "" })} data-testid="button-add-line">
                    <Plus className="h-3.5 w-3.5 mr-1" />Add line
                  </Button>
                </div>
                <div className="space-y-2">
                  {lines.fields.map((f, i) => (
                    <div key={f.id} className="flex items-start gap-2 rounded-md bg-background border p-2" data-testid={`line-${i}`}>
                      <span className="text-xs text-muted-foreground tabular w-4 pt-2.5 text-center shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="min-w-0"><FormField control={form.control} name={`lineItems.${i}.device`} render={({ field }) => (
                          <Select value={field.value || undefined} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9 text-left [&>span]:truncate" aria-label={`Line ${i + 1} phone`} data-testid={`select-line-device-${i}`}><SelectValue placeholder="Phone / BYOD" /></SelectTrigger>
                            <SelectContent>
                              {DEVICE_GROUPS.map((g) => (
                                <SelectGroup key={g.label}>
                                  <SelectLabel className="text-xs text-muted-foreground">{g.label}</SelectLabel>
                                  {g.items.map((d) => <SelectItem key={d} value={d}>{d === "BYOD" ? "BYOD (own phone)" : d}</SelectItem>)}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        )} /></div>
                        <div className="min-w-0"><FormField control={form.control} name={`lineItems.${i}.plan`} render={({ field }) => (
                          <Select value={field.value || undefined} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9 text-left [&>span]:truncate" aria-label={`Line ${i + 1} plan`} data-testid={`select-line-plan-${i}`}><SelectValue placeholder="Plan" /></SelectTrigger>
                            <SelectContent>{PLANS.map((pl) => <SelectItem key={pl} value={pl}>{pl}</SelectItem>)}</SelectContent>
                          </Select>
                        )} /></div>
                        <div className="min-w-0 sm:col-span-2"><FormField control={form.control} name={`lineItems.${i}.who`} render={({ field }) => (
                          <Input className="h-8 text-sm" placeholder="Who's on this line (optional)" aria-label={`Line ${i + 1} user`} {...field} data-testid={`input-line-who-${i}`} />
                        )} /></div>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Remove line ${i + 1}`}
                        onClick={() => lines.remove(i)} disabled={lines.fields.length === 1} data-testid={`button-remove-line-${i}`}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3" data-testid="quote-summary">
                <FormField control={form.control} name="monthlyQuote" render={({ field }) => (
                  <FormItem className="space-y-1 w-40">
                    <FormLabel>{status === "closed" ? "Monthly bill" : "Monthly quoted"}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
                        <Input inputMode="decimal" className="pl-6 font-bold tabular" placeholder="0.00" {...field} data-testid="input-monthlyQuote" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="button" variant="outline" onClick={copyQuote} data-testid="button-copy-quote-dialog"><Copy className="h-4 w-4 mr-1.5" />Copy quote</Button>
              </div>

              <FormField control={form.control} name="details" render={({ field }) => (
                <FormItem>
                  <FormLabel>Promos, trade-ins, extras</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="e.g. $800 switcher credit, trading in iPhone 14, added Total Mobile Protection" {...field} data-testid="input-details" /></FormControl>
                </FormItem>
              )} />
              {isSold(status) && <div className="max-w-[12rem]"><Field form={form} name="saleDate" label="Sale date" type="date" /></div>}
            </div>

            {status === "lead" && (
              <div className="grid grid-cols-2 gap-4">
                <Field form={form} name="callbackDate" label={contact ? "Add a callback (optional)" : "Call back on"} type="date" />
                <Pick form={form} name="callbackReason" label="Reason" options={CALL_REASONS} />
              </div>
            )}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} placeholder="Best time to call, objections, family on the account…" {...field} data-testid="input-notes" /></FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting} data-testid="button-save-contact">
                {form.formState.isSubmitting ? "Saving…" : contact ? "Save changes" : "Add customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const callForm = z.object({
  title: z.string().trim().min(1, "Pick a reason"),
  contactId: z.string(),
  dueDate: z.string(),
  notes: z.string(),
});
type CallForm = z.infer<typeof callForm>;

export function CallDialog({ open, onOpenChange, task, contactId }: {
  open: boolean; onOpenChange: (o: boolean) => void; task?: Task | null; contactId?: number;
}) {
  const save = useSaveTask();
  const { data: contacts = [] } = useContacts();
  const { toast } = useToast();
  const form = useForm<CallForm>({ resolver: zodResolver(callForm), defaultValues: { title: "Follow up on quote", contactId: "none", dueDate: todayStr(), notes: "" } });
  useEffect(() => {
    if (!open) return;
    form.reset({
      title: task?.title ?? "Follow up on quote",
      contactId: task?.contactId ? String(task.contactId) : contactId ? String(contactId) : "none",
      dueDate: task ? task.dueDate ?? "" : todayStr(),
      notes: task?.notes ?? "",
    });
  }, [open, task, contactId]);

  const onSubmit = (v: CallForm) => {
    save.mutate({ id: task?.id, data: { ...v, contactId: v.contactId === "none" ? null : Number(v.contactId), dueDate: v.dueDate || null } }, {
      onSuccess: () => { toast({ title: task ? "Callback updated" : "Callback scheduled", description: v.title }); onOpenChange(false); },
      onError: (e) => toast({ title: "Couldn't save", description: String(e.message), variant: "destructive" }),
    });
  };
  const reasons = Array.from(new Set([...CALL_REASONS, form.watch("title")].filter(Boolean)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit callback" : "Schedule a callback"}</DialogTitle>
          <DialogDescription>Who to call, when, and why.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="contactId" render={({ field }) => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger data-testid="select-call-contact"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">No customer</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <Pick form={form} name="title" label="Reason" options={reasons} />
              <Field form={form} name="dueDate" label="Call on" type="date" />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>What to say / ask</FormLabel>
                <FormControl><Textarea rows={2} placeholder="e.g. Mention the switcher promo ends Friday" {...field} data-testid="input-call-notes" /></FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending} data-testid="button-save-call">{task ? "Save" : "Schedule"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
