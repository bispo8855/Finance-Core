import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/landing";
import NewDocument from "./pages/NewDocument";
import Receivables from "./pages/Receivables";
import Payables from "./pages/Payables";
import CashFlow from "./pages/CashFlow";
import Transactions from "./pages/Transactions";
import DREPage from "./pages/DREPage";
import ExtractPage from "./pages/ExtractPage";
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
import { getAuthRedirectPath } from "./utils/navigation";
import { GlobalErrorBoundary } from "./components/shared/GlobalErrorBoundary";

const Home = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 animate-in fade-in duration-500">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center border border-slate-100">
          <img src="/aurys-icon.png" alt="Aurys" className="h-16 w-16 mb-4 animate-pulse" />
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
            <span className="ml-2">Carregando Aurys System...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Landing />;
  }

  return <Navigate to={getAuthRedirectPath()} replace />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <div className="flex items-center gap-2 text-slate-400 font-medium italic">
          <div className="w-1 h-1 bg-primary rounded-full animate-ping" />
          Verificando credenciais...
        </div>
      </div>
    );
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
          <GlobalErrorBoundary>
            <Routes>
              {/* Rotas Públicas */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Rota de Onboarding (protegida, mas sem layout padrão) */}
              <Route element={<ProtectedRoute><Onboarding /></ProtectedRoute>} path="/onboarding" />
              
              {/* Rotas do App (protegidas e com layout) */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/lancar" element={<NewDocument />} />
                <Route path="/receber" element={<Receivables />} />
                <Route path="/pagar" element={<Payables />} />
                <Route path="/lancamentos" element={<Transactions />} />
                <Route path="/fluxo" element={<CashFlow />} />
                <Route path="/extrato" element={<ExtractPage />} />
                <Route path="/dre" element={<DREPage />} />
                <Route path="/precificacao" element={<PricingPage />} />
                <Route path="/categorias" element={<Categories />} />
                <Route path="/contas" element={<Accounts />} />
                <Route path="/contatos" element={<Contacts />} />
                <Route path="/configuracoes" element={<SettingsPage />} />
              </Route>
              
              <Route path="*" element={<Landing />} />
            </Routes>
          </GlobalErrorBoundary>
        </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
