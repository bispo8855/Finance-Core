import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FinancialProvider } from "@/contexts/FinancialContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import NewDocument from "./pages/NewDocument";
import Receivables from "./pages/Receivables";
import Payables from "./pages/Payables";
import CashFlow from "./pages/CashFlow";
import DREPage from "./pages/DREPage";
import Categories from "./pages/Categories";
import Accounts from "./pages/Accounts";
import Contacts from "./pages/Contacts";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <FinancialProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/lancar" element={<NewDocument />} />
              <Route path="/receber" element={<Receivables />} />
              <Route path="/pagar" element={<Payables />} />
              <Route path="/fluxo" element={<CashFlow />} />
              <Route path="/dre" element={<DREPage />} />
              <Route path="/categorias" element={<Categories />} />
              <Route path="/contas" element={<Accounts />} />
              <Route path="/contatos" element={<Contacts />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </FinancialProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
