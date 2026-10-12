import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { beginSession } from "@/lib/session";
import { LOJA } from "@/lib/store";
import type { Me } from "@/lib/types";

const HERO =
  "https://images.unsplash.com/photo-1549416878-b9ca95e26903?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400";

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => apiPost<Me>("/auth/login", { password }),
    onSuccess: (me) => {
      beginSession(me);
      navigate("/", { replace: true });
    },
    onError: (e) => toast.error(errMsg(e, "Não foi possível entrar")),
  });

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.15fr_1fr] bg-ivory">
      <section className="relative hidden lg:block overflow-hidden bg-[#2B0B14]">
        <img src={HERO} alt="Noiva com véu longo" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2B0B14] via-[#2B0B14]/40 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-end p-14 text-[#FAF7F2] animate-rise">
          <p className="text-[0.7rem] tracking-[0.35em] uppercase text-[#E6CA65]">{LOJA.sub}</p>
          <h1 className="mt-3 font-serif italic text-6xl font-bold leading-[1.05]">{LOJA.nome}</h1>
          <div className="mt-6 h-px w-40 bg-gradient-to-r from-[#E6CA65] to-transparent" />
          <p className="mt-6 max-w-md text-[#E7D8C9] leading-relaxed">{LOJA.linha}</p>
          <p className="mt-2 text-sm text-[#E7D8C9]/80">
            {LOJA.endereco} · Tel. {LOJA.tel}
          </p>
        </div>
      </section>

      <section className="flex items-center px-6 py-16 sm:px-14">
        <form
          className="w-full max-w-sm animate-rise"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
          data-testid="login-form"
        >
          <p className="lg:hidden font-serif italic text-4xl font-bold text-wine mb-2">{LOJA.nome}</p>
          <div className="mb-8 inline-flex size-12 items-center justify-center rounded-full border border-[#E6CA65] bg-gold-light text-wine">
            <Lock className="size-5" />
          </div>
          <p className="label-caps">Acesso da loja</p>
          <h2 className="mt-2 text-3xl font-semibold text-charcoal">Bem-vinda de volta</h2>
          <p className="mt-2 text-sm text-muted-foreground">Digite a senha da loja para abrir o sistema de fichas.</p>

          <div className="mt-8 space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white"
              placeholder="••••••••"
              data-testid="login-password-input"
            />
          </div>
          <Button
            type="submit"
            disabled={!password || login.isPending}
            className="mt-6 h-11 w-full active:scale-[0.98] transition-transform"
            data-testid="login-submit-button"
          >
            {login.isPending ? "Entrando..." : "Entrar"}
          </Button>
          <div className="gold-rule mt-10" />
          <p className="mt-4 text-center text-xs text-muted-foreground">WhatsApp {LOJA.whats}</p>
        </form>
      </section>
    </div>
  );
}
