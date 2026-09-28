import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, MessageSquare, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Contact } from "@/lib/crm";
import { copyText, fillTemplate, smsWithBody, useSettings } from "@/lib/quote";

/** Pick a text template, tweak it, then send from your phone or copy it. */
export function TextDialog({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (o: boolean) => void; contact: Contact | null }) {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [tid, setTid] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (!open || !contact) return;
    const t = settings.templates.find((x) => x.id === tid) ?? settings.templates[0];
    if (t) { setTid(t.id); setBody(fillTemplate(t.body, contact, settings)); }
  }, [open, contact?.id]);
  if (!contact) return null;
  const pick = (id: string) => {
    const t = settings.templates.find((x) => x.id === id);
    if (t) { setTid(id); setBody(fillTemplate(t.body, contact, settings)); }
  };
  const copy = async () => {
    const ok = await copyText(body);
    toast({ title: ok ? "Text copied" : "Couldn't copy" });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Text {contact.name}</DialogTitle>
          <DialogDescription className="tabular">{contact.phone || "No phone number saved"}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {settings.templates.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t.id)} aria-pressed={tid === t.id}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                tid === t.id ? "bg-foreground text-background border-foreground" : "hover:bg-muted")}
              data-testid={`chip-template-${t.id}`}>{t.name}</button>
          ))}
        </div>
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} className="text-sm" data-testid="input-text-body" />
        {!settings.yourName && (
          <p className="text-xs text-muted-foreground">Tip: add your name in <Link href="/setup" onClick={() => onOpenChange(false)} className="underline">Setup</Link> so texts sign off as you.</p>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" asChild><Link href="/setup" onClick={() => onOpenChange(false)} data-testid="link-edit-templates"><Settings2 className="h-4 w-4 mr-1.5" />Edit templates</Link></Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copy} data-testid="button-copy-text"><Copy className="h-4 w-4 mr-1.5" />Copy</Button>
            {contact.phone && <Button asChild data-testid="button-send-text"><a href={smsWithBody(contact.phone, body)} onClick={() => onOpenChange(false)}><MessageSquare className="h-4 w-4 mr-1.5" />Open in Messages</a></Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
