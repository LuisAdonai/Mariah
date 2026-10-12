import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FilePlus2, FileText, LayoutDashboard, LogOut, Shirt } from "lucide-react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import { LOJA } from "@/lib/store";
import type { Me } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RequireAuth() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<Me>("/auth/me"), retry: false });
  if (me.isPending) {
    return (
      <div className="min-h-screen grid place-items-center bg-ivory" data-testid="auth-loading">
        <p className="font-serif text-2xl text-wine animate-pulse">{LOJA.nome}</p>
      </div>
    );
  }
  if (me.isError) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, id: "painel", end: true },
  { to: "/fichas", label: "Fichas", icon: FileText, id: "fichas", end: true },
  { to: "/fichas/nova", label: "Nova ficha", icon: FilePlus2, id: "nova-ficha", end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, id: "agenda", end: true },
  { to: "/estoque", label: "Estoque", icon: Shirt, id: "estoque", end: true },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const logout = async () => {
    await endSession();
    navigate("/login", { replace: true });
  };
  return (
    <div className="min-h-screen bg-ivory lg:pl-64">
      <aside className="no-print fixed inset-x-0 top-0 z-30 flex items-center gap-2 bg-charcoal px-4 py-3 lg:inset-y-0 lg:right-auto lg:w-64 lg:flex-col lg:items-stretch lg:gap-0 lg:px-5 lg:py-8">
        <div className="mr-auto lg:mr-0 lg:mb-10">
          <p className="font-serif text-xl lg:text-2xl italic font-bold text-[#F5F5F4] leading-none" data-testid="sidebar-brand">
            {LOJA.nome}
          </p>
          <p className="hidden lg:block mt-2 text-[0.65rem] tracking-[0.3em] uppercase text-[#E6CA65]">{LOJA.sub}</p>
          <div className="hidden lg:block mt-4 h-px bg-gradient-to-r from-[#D4AF37] to-transparent" />
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`nav-${n.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm whitespace-nowrap transition-colors duration-150",
                  isActive
                    ? "bg-wine text-white shadow-[inset_3px_0_0_#E6CA65]"
                    : "text-stone-400 hover:bg-[#2A2420] hover:text-[#E6CA65]",
                )
              }
            >
              <n.icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="lg:mt-auto">
          <div className="hidden lg:block text-xs text-stone-500 leading-relaxed mb-4">
            {LOJA.endereco}
            <br />Tel. {LOJA.tel} · WhatsApp {LOJA.whats}
          </div>
          <button
            onClick={logout}
            data-testid="logout-button"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-stone-400 hover:text-white hover:bg-[#2A2420] transition-colors"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </aside>
      <main className="pt-20 lg:pt-0">
        <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        <p className="label-caps text-gold!">{eyebrow}</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-charcoal" data-testid="page-title">
          {title}
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
