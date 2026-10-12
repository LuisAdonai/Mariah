import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout, { RequireAuth } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Fichas from "@/pages/Fichas";
import FichaForm from "@/pages/FichaForm";
import FichaDetalhe from "@/pages/FichaDetalhe";
import Agenda from "@/pages/Agenda";
import Estoque from "@/pages/Estoque";
import Impressao from "@/pages/Impressao";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/impressao/:id" element={<Impressao />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fichas" element={<Fichas />} />
            <Route path="/fichas/nova" element={<FichaForm />} />
            <Route path="/fichas/:id" element={<FichaDetalhe />} />
            <Route path="/fichas/:id/editar" element={<FichaForm />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/estoque" element={<Estoque />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
