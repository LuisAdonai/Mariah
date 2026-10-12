import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { waLink } from "@/lib/format";
import { waTemplates } from "@/lib/store";

type Props = {
  telefone: string;
  data: Parameters<typeof waTemplates>[0];
  size?: "sm" | "default" | "icon-sm";
  testid: string;
};

export default function WhatsAppMenu({ telefone, data, size = "default", testid }: Props) {
  const templates = waTemplates(data);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!telefone}
        data-testid={testid}
        render={
          <Button
            variant="outline"
            size={size}
            className="border-[#B7DCC3] text-[#166534] hover:bg-[#E8F3EC] transition-colors"
          />
        }
      >
        <MessageCircle className="size-4" />
        {size !== "icon-sm" && "WhatsApp"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Enviar mensagem pronta</DropdownMenuLabel>
        {templates.map((t) => (
          <DropdownMenuItem
            key={t.key}
            data-testid={`${testid}-${t.key}`}
            onClick={() => window.open(waLink(telefone, t.msg), "_blank", "noopener")}
          >
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
