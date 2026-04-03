import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import NewDocument from "./pages/NewDocument";
import Receivables from "./pages/Receivables";
import Payables from "./pages/Payables";
import CashFlow from "./pages/CashFlow";
import Transactions from "./pages/Transactions";
import DREPage from "./pages/DREPage";
import PricingPage from "./pages/PricingPage";
import Categories from "./pages/Categories";
import Accounts from "./pages/Accounts";
import Contacts from "./pages/Contacts";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center p-4">Carregando sessão...</div>;
  }
  
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <AuthProvider>
    <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute><Onboarding /></ProtectedRoute>} path="/onboarding" />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/lancar" element={<NewDocument />} />
              <Route path="/receber" element={<Receivables />} />
              <Route path="/pagar" element={<Payables />} />
              <Route path="/lancamentos" element={<Transactions />} />
              <Route path="/fluxo" element={<CashFlow />} />
              <Route path="/dre" element={<DREPage />} />
              <Route path="/precificacao" element={<PricingPage />} />
              <Route path="/categorias" element={<Categories />} />
              <Route path="/contas" element={<Accounts />} />
              <Route path="/contatos" element={<Contacts />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
