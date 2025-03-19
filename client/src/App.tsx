import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Loans from "@/pages/loans";
import Payments from "@/pages/payments";
import Reports from "@/pages/reports";
import LoanDetails from "@/pages/loan-details";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";

// Componente principal de la aplicación
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Contenido de la aplicación una vez que el AuthProvider está disponible
function AppContent() {
  return (
    <Switch>
      <Route path="/auth">
        <AuthPage />
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/clientes">
        <ProtectedRoute>
          <Clients />
        </ProtectedRoute>
      </Route>
      <Route path="/prestamos">
        <ProtectedRoute>
          <Loans />
        </ProtectedRoute>
      </Route>
      <Route path="/prestamos/:id">
        <ProtectedRoute>
          <LoanDetails />
        </ProtectedRoute>
      </Route>
      <Route path="/pagos">
        <ProtectedRoute>
          <Payments />
        </ProtectedRoute>
      </Route>
      <Route path="/reportes">
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

export default App;
