import { FICHA_STATUS, TRAJE_STATUS } from "@/lib/format";
import type { FichaStatus, TrajeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FichaStatusBadge({ status, testid }: { status: FichaStatus; testid?: string }) {
  const s = FICHA_STATUS[status];
  return (
    <span data-testid={testid} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

export function TrajeStatusBadge({ status, testid }: { status: TrajeStatus; testid?: string }) {
  const s = TRAJE_STATUS[status];
  return (
    <span data-testid={testid} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}
