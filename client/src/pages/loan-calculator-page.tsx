import { Helmet } from "react-helmet";
import LoanCalculator from "@/components/loan-calculator";
import MainLayout from "@/components/layout/main-layout";

export default function LoanCalculatorPage() {
  return (
    <>
      <Helmet>
        <title>Calculadora de Préstamos</title>
      </Helmet>
      
      <MainLayout>
        <h1 className="text-2xl font-bold text-foreground mb-6">
          Calculadora de Préstamos
        </h1>
        
        <div className="grid grid-cols-1 gap-6">
          <LoanCalculator />
          
          <div className="bg-card rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Información sobre Préstamos</h2>
            
            <div className="prose dark:prose-invert max-w-none">
              <p>
                Nuestra calculadora de préstamos te permite estimar con precisión:
              </p>
              
              <ul>
                <li>
                  <strong>Pago semanal:</strong> Monto que se debe pagar cada semana.
                </li>
                <li>
                  <strong>Total a pagar:</strong> Suma total incluyendo el capital e intereses.
                </li>
                <li>
                  <strong>Interés total:</strong> Monto total que se pagará solo en intereses.
                </li>
                <li>
                  <strong>Tabla de amortización:</strong> Desglose detallado de cada pago semanal.
                </li>
              </ul>
              
              <h3 className="text-lg font-medium mt-4">¿Cómo se calcula el interés?</h3>
              
              <p>
                El interés se calcula sobre el monto total del préstamo. Por ejemplo, con un 
                préstamo de $5,000 a una tasa de interés del 10%, el interés será de $500.
              </p>
              
              <p>
                La tasa efectiva anualizada puede variar dependiendo del plazo del préstamo.
                Para obtener una proyección más personalizada, ajusta los parámetros en la
                calculadora y observa cómo cambian los resultados en tiempo real.
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    </>
  );
}