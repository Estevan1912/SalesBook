import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { lastBackupAt, readBackup, restoreBackup, saveBackup, type BackupSummary } from "@/lib/localdb";
import { ago, shortDate } from "@/lib/crm";

export function BackupCard() {
  const { toast } = useToast();
  const [last, setLast] = useState(lastBackupAt);
  const [pending, setPending] = useState<ReturnType<typeof readBackup> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const backup = async () => {
    try {
      if ((await saveBackup()) === "saved") {
        setLast(lastBackupAt());
        toast({ title: "Backup saved", description: "Keep the file somewhere safe, like iCloud Drive or email it to yourself." });
      }
    } catch (e: any) {
      toast({ title: "Couldn't save backup", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      setPending(readBackup(await file.text()));
    } catch (e: any) {
      toast({ title: "Couldn't read that file", description: String(e?.message ?? e), variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const restore = () => {
    if (!pending) return;
    restoreBackup(pending.data);
    queryClient.invalidateQueries();
    toast({ title: "Backup restored", description: describe(pending.summary) });
    setPending(null);
  };

  return (
    <Card className="p-5 mb-6">
      <h2 className="text-sm font-bold mb-1">Backup</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Your book is saved only in this browser. Back it up now and then, and use Restore to bring it back on a new phone or after clearing the browser.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={backup} data-testid="button-backup"><Download className="h-4 w-4 mr-1.5" />Back up now</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-restore"><Upload className="h-4 w-4 mr-1.5" />Restore from file</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid="input-restore-file" />
        <span className="text-xs text-muted-foreground ml-1" data-testid="text-last-backup">{last ? `Last backup ${ago(last)}` : "Never backed up"}</span>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your book with this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && <>The backup from {shortDate(pending.summary.exportedAt)} has {describe(pending.summary)}. </>}
              Everything currently in this browser will be replaced. Back up first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={restore} data-testid="button-confirm-restore">Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const describe = (s: BackupSummary) => `${plural(s.contacts, "customer")}, ${plural(s.tasks, "callback")} and ${plural(s.activities, "call log entry").replace("entrys", "entries")}`;
