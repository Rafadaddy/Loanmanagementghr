import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Loans from "@/pages/loans";
import Payments from "@/pages/payments";
import Reports from "@/pages/reports";
import LoanDetails from "@/pages/loan-details";
import LoanCalculatorPage from "@/pages/loan-calculator-page";
import CobrosDia from "@/pages/cobros-dia";
import RegistroCaja from "@/pages/registro-caja";
import { AuthProvider } from "@/hooks/use-auth";
import { LoadingProvider } from "@/hooks/use-loading";
import { SidebarProvider } from "@/hooks/use-sidebar";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "./lib/protected-route";
import SidebarToggle from "@/components/navigation/sidebar-toggle";

// Componente principal de la aplicación
function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <LoadingProvider>
          <SidebarProvider>
            <AppContent />
            <SidebarToggle />
          </SidebarProvider>
        </LoadingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Contenido de la aplicación una vez que el AuthProvider está disponible
function AppContent() {
  return (
    <Switch>
      <Route path="/auth">
        <AuthPage />
      </Route>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/clientes" component={Clients} />
      <ProtectedRoute path="/prestamos" component={Loans} />
      <ProtectedRoute path="/prestamos/:id" component={LoanDetails} />
      <ProtectedRoute path="/pagos" component={Payments} />
      <ProtectedRoute path="/cobros-dia" component={CobrosDia} />
      <ProtectedRoute path="/caja" component={RegistroCaja} />  {/* Redirigir a Registro de Caja */}
      <ProtectedRoute path="/registro-caja" component={RegistroCaja} />
      <ProtectedRoute path="/reportes" component={Reports} />
      <ProtectedRoute path="/calculadora" component={LoanCalculatorPage} />
      <Route>
        {() => <NotFound />}
      </Route>
    </Switch>
  );
}

export default App;
