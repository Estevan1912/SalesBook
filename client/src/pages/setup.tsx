import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/common";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_SETTINGS, PHONE_PLANS, type Settings } from "@shared/schema";
import { TEMPLATE_VARS, useSaveSettings, useSettings } from "@/lib/quote";

const TIERS = ["1 line", "2 lines", "3 lines", "4 lines", "5+ lines"];
const EXTRA = ["Watch / tablet plan"];

export default function Setup() {
  const { data, isLoading } = useSettings();
  const save = useSaveSettings();
  const { toast } = useToast();
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { if (data && !s) setS(structuredClone(data)); }, [data]);
  if (isLoading || !s) return <div className="space-y-4 max-w-4xl"><Skeleton className="h-8 w-40" /><Skeleton className="h-64" /></div>;

  const dirty = JSON.stringify(s) !== JSON.stringify(data);
  const setPrice = (plan: string, i: number, v: string) => {
    const row = [...(s.prices[plan] ?? [0, 0, 0, 0, 0])];
    if (EXTRA.includes(plan)) row.fill(Number(v) || 0); else row[i] = Number(v) || 0;
    setS({ ...s, prices: { ...s.prices, [plan]: row } });
  };
  const onSave = () => save.mutate(s, { onSuccess: () => toast({ title: "Setup saved" }) });

  return (
    <div className="max-w-4xl pb-20">
      <PageHeader title="Setup" subtitle="Your name, the plan prices the quote builder uses, and your text templates.">
        <Button onClick={onSave} disabled={!dirty || save.isPending} data-testid="button-save-setup">{save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>
      </PageHeader>

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-bold mb-3">You</h2>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="your-name">Your name (used to sign texts and quotes)</Label>
          <Input id="your-name" value={s.yourName} onChange={(e) => setS({ ...s, yourName: e.target.value })} placeholder="First name" data-testid="input-your-name" />
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-bold">Plan prices</h2>
          <Button size="sm" variant="ghost" onClick={() => setS({ ...s, prices: structuredClone(DEFAULT_SETTINGS.prices) })} data-testid="button-reset-prices"><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset</Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Price per line, per month, with AutoPay. The quote builder uses the column for how many phone lines are on the quote. Starting prices are estimates, so update them to match your current rate card.</p>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-xs text-muted-foreground text-left">
              <th className="font-medium pb-2 pr-3">Plan</th>
              {TIERS.map((t) => <th key={t} className="font-medium pb-2 px-1 text-right">{t}</th>)}
            </tr></thead>
            <tbody>
              {[...PHONE_PLANS, ...EXTRA].map((plan) => (
                <tr key={plan} className="border-t">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{plan}</td>
                  {TIERS.map((_, i) => (
                    <td key={i} className="py-2 px-1">
                      {EXTRA.includes(plan) && i > 0 ? <div className="text-right text-xs text-muted-foreground">same</div> : (
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <Input inputMode="decimal" className="h-9 pl-5 text-right tabular" value={String(s.prices[plan]?.[i] ?? 0)}
                            onChange={(e) => setPrice(plan, i, e.target.value.replace(/[^\d.]/g, ""))}
                            aria-label={`${plan} ${TIERS[i]}`} data-testid={`input-price-${plan.replace(/\W+/g, "-").toLowerCase()}-${i}`} />
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold">Text templates</h2>
          <Button size="sm" variant="outline" onClick={() => setS({ ...s, templates: [...s.templates, { id: `t${Date.now()}`, name: "New template", body: "Hi {first}, it's {me} from Verizon. " }] })} data-testid="button-add-template">
            <Plus className="h-3.5 w-3.5 mr-1" />Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">These words fill in automatically: {TEMPLATE_VARS.map((v) => <code key={v} className="mx-0.5 rounded bg-muted px-1 py-0.5">{v}</code>)}</p>
        <div className="space-y-4">
          {s.templates.map((t, i) => (
            <div key={t.id} className="rounded-lg border p-3 space-y-2" data-testid={`template-${i}`}>
              <div className="flex items-center gap-2">
                <Input value={t.name} onChange={(e) => { const ts = [...s.templates]; ts[i] = { ...t, name: e.target.value }; setS({ ...s, templates: ts }); }}
                  className="h-8 font-medium max-w-xs" aria-label="Template name" data-testid={`input-template-name-${i}`} />
                <div className="flex-1" />
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${t.name}`}
                  onClick={() => setS({ ...s, templates: s.templates.filter((x) => x.id !== t.id) })} data-testid={`button-delete-template-${i}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Textarea rows={3} value={t.body} onChange={(e) => { const ts = [...s.templates]; ts[i] = { ...t, body: e.target.value }; setS({ ...s, templates: ts }); }}
                className="text-sm" aria-label={`${t.name} message`} data-testid={`input-template-body-${i}`} />
            </div>
          ))}
        </div>
      </Card>

      {dirty && (
        <div className="fixed bottom-4 right-4 z-30">
          <Button size="lg" onClick={onSave} disabled={save.isPending} className="shadow-lg" data-testid="button-save-setup-floating">Save changes</Button>
        </div>
      )}
    </div>
  );
}
