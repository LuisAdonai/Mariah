import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, Download, FolderOpen, HardDriveDownload, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { BackupInfo, BackupNow, ImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function Box({ icon: Icon, title, children, testid }: { icon: typeof Download; title: string; children: React.ReactNode; testid: string }) {
  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-[0_4px_20px_rgba(43,11,20,0.05)] animate-rise" data-testid={testid}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full border border-[#E6CA65] bg-gold-light text-wine">
          <Icon className="size-4" />
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function Backup() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const info = useQuery({ queryKey: ["backup-info"], queryFn: () => apiGet<BackupInfo>("/backup/info") });
  const i = info.isError ? undefined : info.data;

  const restore = useMutation({
    mutationFn: (data: unknown) => apiPost<ImportResult>("/backup/import", data),
    onSuccess: (r) => {
      setPending(null);
      qc.invalidateQueries();
      toast.success(`Dados restaurados: ${r.fichas} fichas e ${r.trajes} trajes. Próxima ficha: Nº ${r.proximo_numero}`);
    },
    onError: (e) => toast.error(errMsg(e, "Não foi possível restaurar o backup")),
  });
  const now = useMutation({
    mutationFn: () => apiPost<BackupNow>("/backup/agora"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["backup-info"] });
      toast.success(`Cópia salva em ${r.arquivo}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPending({ name: file.name, data: JSON.parse(await file.text()) });
    } catch {
      toast.error("Arquivo inválido — escolha um backup .json gerado pelo sistema");
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Segurança dos dados" title="Backup e restauração" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Box icon={Download} title="Fazer backup" testid="backup-export-box">
          <p className="text-sm text-muted-foreground">
            Salva uma cópia completa — fichas, clientes, pagamentos, estoque, fotos e numeração — em um único arquivo.
            Escolha um pendrive ou HD externo para guardar.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/api/backup/export" download className={buttonVariants()} data-testid="backup-export-button">
              <HardDriveDownload className="size-4" /> Salvar backup em…
            </a>
            {i?.desktop && (
              <Button variant="outline" onClick={() => now.mutate()} disabled={now.isPending} data-testid="backup-now-button">
                <DatabaseBackup className="size-4" /> Cópia rápida na pasta de backups
              </Button>
            )}
          </div>
        </Box>

        <Box icon={Upload} title="Restaurar backup" testid="backup-import-box">
          <p className="text-sm text-muted-foreground">
            Substitui os dados atuais pelos do arquivo escolhido. Use também para trazer os dados do sistema online para o programa.
            {i?.desktop && " Antes de restaurar, o programa guarda automaticamente uma cópia dos dados atuais."}
          </p>
          <label className={cn(buttonVariants({ variant: "outline" }), "mt-5 cursor-pointer")} data-testid="backup-import-button">
            <Upload className="size-4" /> Escolher arquivo de backup
            <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} data-testid="backup-import-file-input" />
          </label>
        </Box>
      </div>

      <section className="mt-6 rounded-lg bg-charcoal p-6 text-[#F5F5F4] animate-rise" data-testid="backup-info">
        <p className="label-caps text-[#E6CA65]!">Situação</p>
        <p className="mt-3 text-sm">
          Próxima ficha: <span className="font-mono text-lg text-[#E6CA65]" data-testid="backup-proximo-numero">Nº {i?.proximo_numero ?? "—"}</span>
        </p>
        {i?.desktop && (
          <div className="mt-4 space-y-2 text-sm text-stone-300">
            <p className="flex items-start gap-2"><FolderOpen className="size-4 mt-0.5 shrink-0" /> Dados: <span className="font-mono text-xs break-all">{i.pasta_dados}</span></p>
            <p className="flex items-start gap-2"><FolderOpen className="size-4 mt-0.5 shrink-0" /> Backups automáticos (diário e ao fechar): <span className="font-mono text-xs break-all">{i.pasta_backups}</span></p>
            {i.backups.length > 0 && (
              <ul className="mt-3 space-y-1 font-mono text-xs text-stone-400" data-testid="backup-list">
                {i.backups.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent data-testid="restore-dialog">
          <DialogHeader><DialogTitle className="font-serif text-xl">Restaurar este backup?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Arquivo: <span className="font-mono">{pending?.name}</span>. Os dados atuais serão substituídos pelos do arquivo.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} data-testid="restore-cancel-button">Voltar</Button>
            <Button onClick={() => pending && restore.mutate(pending.data)} disabled={restore.isPending} data-testid="restore-confirm-button">
              {restore.isPending ? "Restaurando..." : "Restaurar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
