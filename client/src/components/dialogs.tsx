import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { Plus, X, Copy } from "lucide-react";
import { DEVICE_PAY, copyText, priceQuote, quoteText, useSettings } from "@/lib/quote";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PRODUCTS, CARRIERS, CALL_REASONS, STATUSES, DEVICE_GROUPS, PLANS, PHONE_PLANS, isSold } from "@shared/schema";
import {
  STATUS_LABEL, closeQuoteFollowups, createTask, parseLines, formatPhone, inDays, scheduleSaleCheckins, todayStr, useContacts, useSaveContact, useSaveTask,
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
  lineItems: z.array(z.object({ device: z.string(), plan: z.string(), who: z.string(), planPrice: z.string(), devicePay: z.string() })),
  credits: z.string(),
  monthlyQuote: z.string().refine((v) => v === "" || !isNaN(Number(v.replace(/[$,]/g, ""))), "Enter a number"),
  carrier: z.string(),
  saleDate: z.string(),
  notes: z.string(),
  callbackDate: z.string(),
  callbackReason: z.string(),
  scheduleCheckins: z.boolean(),
});
type CustomerForm = z.infer<typeof customerForm>;

const empty: CustomerForm = {
  name: "", phone: "", email: "", status: "lead", product: "New account", details: "", lineItems: [{ device: "", plan: "", who: "", planPrice: "", devicePay: "" }], credits: "", monthlyQuote: "",
  carrier: "", saleDate: "", notes: "", callbackDate: inDays(1), callbackReason: "Follow up on quote", scheduleCheckins: true,
};

const num = (v: string | number | undefined | null) => Number(String(v ?? "").replace(/[$,]/g, "")) || 0;
const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
function MoneyInput({ field, label, testid, disabled, ph }: any) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
      <Input inputMode="decimal" className="h-9 pl-5 tabular" placeholder={ph ?? "0"} aria-label={label} disabled={disabled} {...field} value={field.value ?? ""} data-testid={testid} />
    </div>
  );
}

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
    lead: "bg-amber-500 text-white border-amber-500", checkup: "bg-sky-600 text-white border-sky-600", closed: "bg-emerald-600 text-white border-emerald-600", lost: "bg-foreground/70 text-background border-foreground/70",
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
      lineItems: parseLines(contact).length ? parseLines(contact).map((l) => ({ device: l.device ?? "", plan: l.plan ?? "", who: l.who ?? "", planPrice: l.planPrice != null ? String(l.planPrice) : "", devicePay: l.devicePay ? String(l.devicePay) : "" })) : [{ device: "", plan: "", who: "", planPrice: "", devicePay: "" }],
      credits: contact.credits ? String(contact.credits) : "", monthlyQuote: contact.monthlyQuote ? String(contact.monthlyQuote) : "",
      carrier: contact.carrier, saleDate: contact.saleDate ?? "", notes: contact.notes, callbackDate: "",
      callbackReason: isSold(contact.status) ? "Check-in after sale" : "Follow up on quote",
    } : { ...empty, callbackDate: inDays(1) });
  }, [open, contact]);

  // ---- Quote builder ----
  const { settings } = useSettings();
  const watched = form.watch("lineItems");
  const creditsV = form.watch("credits");
  const [autoTotal, setAutoTotal] = useState(true);
  const planKey = useRef("");
  const deviceKey = useRef<string[]>([]);
  const toItems = (ls: CustomerForm["lineItems"]) => ls.map((l) => ({ ...l, planPrice: l.planPrice === "" ? undefined : num(l.planPrice), devicePay: num(l.devicePay) }));
  const quote = useMemo(() => priceQuote(toItems(watched ?? []), num(creditsV), settings), [JSON.stringify(watched), creditsV, settings]);

  // Remember the starting point whenever the dialog opens so saved prices aren't overwritten.
  useEffect(() => {
    if (!open) return;
    const ls = form.getValues("lineItems");
    planKey.current = ls.map((l) => l.plan).join("|");
    deviceKey.current = ls.map((l) => l.device);
    const saved = contact ? contact.monthlyQuote : 0;
    const calc = priceQuote(toItems(ls), num(form.getValues("credits")), settings).total;
    setAutoTotal(!contact || !saved || Math.abs(saved - calc) < 0.01);
  }, [open, contact]);

  // When plans or the number of lines change, re-price every line from your price sheet.
  useEffect(() => {
    if (!open || !watched) return;
    const key = watched.map((l) => l.plan).join("|");
    if (key !== planKey.current) {
      planKey.current = key;
      const phoneLines = watched.filter((l) => PHONE_PLANS.includes(l.plan)).length;
      const tier = Math.min(Math.max(phoneLines, 1), 5) - 1;
      watched.forEach((l, i) => {
        const t = settings.prices[l.plan];
        const price = t ? t[PHONE_PLANS.includes(l.plan) ? tier : 0] ?? 0 : 0;
        if (l.plan) form.setValue(`lineItems.${i}.planPrice`, String(price));
      });
    }
    watched.forEach((l, i) => {
      if (l.device !== deviceKey.current[i]) {
        const prev = deviceKey.current[i];
        const pay = DEVICE_PAY[l.device];
        if (pay != null && (!l.devicePay || (prev && DEVICE_PAY[prev] === num(l.devicePay)))) form.setValue(`lineItems.${i}.devicePay`, pay ? String(pay) : "");
      }
    });
    deviceKey.current = watched.map((l) => l.device);
  }, [JSON.stringify(watched?.map((l) => [l.plan, l.device])), open, settings]);

  useEffect(() => {
    if (open && autoTotal) form.setValue("monthlyQuote", quote.total ? String(quote.total) : "");
  }, [quote.total, autoTotal, open]);

  const copyQuote = async () => {
    const v = form.getValues();
    const fake: any = {
      name: v.name || "Customer", product: v.product, details: v.details, credits: num(v.credits), monthlyQuote: num(v.monthlyQuote),
      lineItems: JSON.stringify(v.lineItems.filter((l) => l.device || l.plan).map((l) => ({ ...l, planPrice: l.planPrice === "" ? undefined : num(l.planPrice), devicePay: num(l.devicePay) }))),
    };
    const ok = await copyText(quoteText(fake, settings));
    toast({ title: ok ? "Quote copied" : "Couldn't copy", description: ok ? "Paste it into a text or email." : undefined });
  };

  const onSubmit = async (v: CustomerForm) => {
    const { callbackDate, callbackReason, scheduleCheckins, lineItems, ...rest } = v;
    const kept = lineItems.filter((l) => l.device || l.plan || l.who.trim());
    const data = {
      ...rest,
      lineItems: JSON.stringify(kept.map((l) => ({ device: l.device, plan: l.plan, who: l.who.trim(), planPrice: num(l.planPrice), devicePay: num(l.devicePay) }))),
      credits: num(v.credits),
      lines: kept.length,
      monthlyQuote: Number(v.monthlyQuote.replace(/[$,]/g, "")) || 0,
      saleDate: isSold(v.status) ? (v.saleDate || todayStr()) : null,
    };
    try {
      const c = await save.mutateAsync({ id: contact?.id, data });
      if (isSold(v.status) && !wasSold) {
        if (v.status === "checkup" && scheduleCheckins) await scheduleSaleCheckins(c.id);
        else await closeQuoteFollowups(c.id);
      }
      if ((v.status === "lead" || (v.status === "checkup" && wasSold)) && callbackDate) await createTask({ title: callbackReason, contactId: c.id, dueDate: callbackDate });
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
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => lines.append({ device: "", plan: form.getValues("lineItems").at(-1)?.plan ?? "", who: "", planPrice: "", devicePay: "" })} data-testid="button-add-line">
                    <Plus className="h-3.5 w-3.5 mr-1" />Add line
                  </Button>
                </div>
                <div className="hidden sm:flex gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
                  <span className="w-4 shrink-0" />
                  <div className="flex-1 grid grid-cols-[1.3fr_1.2fr_0.75fr_0.75fr] gap-2"><span>Phone</span><span>Plan</span><span>Plan $/mo</span><span>Phone $/mo</span></div>
                  <span className="w-9 shrink-0" />
                </div>
                <div className="space-y-2">
                  {lines.fields.map((f, i) => (
                    <div key={f.id} className="flex items-start gap-2 rounded-md bg-background border p-2" data-testid={`line-${i}`}>
                      <span className="text-xs text-muted-foreground tabular w-4 pt-2.5 text-center shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-[1.3fr_1.2fr_0.75fr_0.75fr] gap-2">
                        <div className="min-w-0 col-span-2 sm:col-span-1"><FormField control={form.control} name={`lineItems.${i}.device`} render={({ field }) => (
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
                        <div className="min-w-0 col-span-2 sm:col-span-1"><FormField control={form.control} name={`lineItems.${i}.plan`} render={({ field }) => (
                          <Select value={field.value || undefined} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9 text-left [&>span]:truncate" aria-label={`Line ${i + 1} plan`} data-testid={`select-line-plan-${i}`}><SelectValue placeholder="Plan" /></SelectTrigger>
                            <SelectContent>{PLANS.map((pl) => <SelectItem key={pl} value={pl}>{pl}</SelectItem>)}</SelectContent>
                          </Select>
                        )} /></div>
                        <div className="min-w-0"><FormField control={form.control} name={`lineItems.${i}.planPrice`} render={({ field }) => (
                          <MoneyInput field={field} ph="Plan" label={`Line ${i + 1} plan price`} testid={`input-line-plan-price-${i}`} />
                        )} /></div>
                        <div className="min-w-0"><FormField control={form.control} name={`lineItems.${i}.devicePay`} render={({ field }) => (
                          <MoneyInput field={field} ph="Phone" label={`Line ${i + 1} phone payment per month`} testid={`input-line-device-pay-${i}`} disabled={watched?.[i]?.device === "BYOD"} />
                        )} /></div>
                        <div className="min-w-0 col-span-2 sm:col-span-4"><FormField control={form.control} name={`lineItems.${i}.who`} render={({ field }) => (
                          <Input className="h-8 text-sm" placeholder="Who's on this line (optional)" aria-label={`Line ${i + 1} user`} {...field} data-testid={`input-line-who-${i}`} />
                        )} /></div>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Remove line ${i + 1}`}
                        onClick={() => lines.remove(i)} disabled={lines.fields.length === 1} data-testid={`button-remove-line-${i}`}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border bg-background p-3" data-testid="quote-summary">
                <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1.2fr] gap-3 items-end">
                  <div><div className="text-xs text-muted-foreground">Plans{quote.phoneLines ? ` (${quote.phoneLines}-line price)` : ""}</div><div className="font-medium tabular mt-1">{fmt(quote.plans)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Phones</div><div className="font-medium tabular mt-1">{fmt(quote.devices)}</div></div>
                  <FormField control={form.control} name="credits" render={({ field }) => (
                    <div><div className="text-xs text-muted-foreground mb-1">Credits −$/mo</div><MoneyInput field={field} label="Monthly credits" testid="input-credits" /></div>
                  )} />
                  <FormField control={form.control} name="monthlyQuote" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs text-muted-foreground font-normal">{status === "lead" || status === "lost" ? "Monthly quoted" : "Monthly bill"}</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="h-9 font-bold tabular" placeholder="0.00" {...field}
                          onChange={(e) => { setAutoTotal(false); field.onChange(e.target.value); }} data-testid="input-monthlyQuote" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-muted-foreground">
                  {autoTotal ? <span>Total adds up automatically. Type over it to set your own price.</span> : (
                    <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setAutoTotal(true)} data-testid="button-use-calculated">
                      Use calculated total ({fmt(quote.total)})
                    </button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={copyQuote} data-testid="button-copy-quote-dialog"><Copy className="h-3.5 w-3.5 mr-1.5" />Copy quote</Button>
                </div>
              </div>

              <FormField control={form.control} name="details" render={({ field }) => (
                <FormItem>
                  <FormLabel>Promos, trade-ins, extras</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="e.g. $800 switcher credit, trading in iPhone 14, added Total Mobile Protection" {...field} data-testid="input-details" /></FormControl>
                </FormItem>
              )} />
              {isSold(status) && <div className="max-w-[12rem]"><Field form={form} name="saleDate" label="Sale date" type="date" /></div>}
            </div>

            {status === "closed" && (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed px-3 py-2">Closed means you're done with them. Move them to Check up anytime you want to call them again.</p>
            )}
            {(status === "lead" || (status === "checkup" && wasSold)) && (
              <div className="grid grid-cols-2 gap-4">
                <Field form={form} name="callbackDate" label={contact ? "Add a callback (optional)" : "Call back on"} type="date" />
                <Pick form={form} name="callbackReason" label="Reason" options={CALL_REASONS} />
              </div>
            )}
            {status === "checkup" && !wasSold && (
              <FormField control={form.control} name="scheduleCheckins" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} data-testid="checkbox-checkins" /></FormControl>
                  <FormLabel className="font-normal">Schedule check-in calls in 3 days and 30 days</FormLabel>
                </FormItem>
              )} />
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
